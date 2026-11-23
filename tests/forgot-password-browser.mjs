// ACCT-2 and ACCT-10 in a real page, against a stand-in auth server: forgot
// password, the emailed link, revoking other sessions after a reset, and the
// session list in account settings. Phone (390x844) and desktop (1280x800).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = 'docs/screens/acct-2-10';
const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('https://ep-fake.neon.test/neondb') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync(OUT, { recursive: true });

  const user = { id: 'u1', email: 'me@duilt.test', name: 'me', emailVerified: true };
  const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile Safari/604';
  const laptop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537 Chrome/120 Safari/537 Edg/120';
  const here = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537 HeadlessChrome/120 Safari/537';

  async function open(viewport, mobile, url = base) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const calls = [];
    const state = { signedIn: false, sessions: [], resetOk: true };
    const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
    state.sessions = [
      { id: 's1', token: 'tok-here', userAgent: here, updatedAt: ago(0), createdAt: ago(5) },
      { id: 's2', token: 'tok-phone', userAgent: phone, updatedAt: ago(90), createdAt: ago(5000) },
      { id: 's3', token: 'tok-laptop', userAgent: laptop, updatedAt: ago(60 * 50), createdAt: ago(9000) },
    ];
    await page.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      const headers = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*', 'access-control-expose-headers': 'set-auth-jwt' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const json = (status, body) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
      if (!u.hostname.includes('neonauth')) return json(200, []);
      const path = u.pathname.replace(/^.*\/auth/, '');
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* none */ }
      calls.push({ path, body });
      if (path === '/request-password-reset') return json(200, { status: true });
      if (path === '/reset-password') {
        return state.resetOk ? json(200, { status: true }) : json(400, { code: 'INVALID_TOKEN', message: 'Invalid token' });
      }
      if (path === '/sign-in/email') { state.signedIn = true; return json(200, { token: 'tok-here', user }); }
      if (path === '/get-session') return json(200, state.signedIn ? { session: { id: 's1', token: 'tok-here', userId: 'u1' }, user } : null);
      if (path === '/list-sessions') return json(200, state.sessions);
      if (path === '/revoke-session') { state.sessions = state.sessions.filter((s) => s.token !== body.token); return json(200, { status: true }); }
      if (path === '/revoke-other-sessions') { state.sessions = state.sessions.filter((s) => s.token === 'tok-here'); return json(200, { status: true }); }
      if (path === '/revoke-sessions') { state.sessions = []; state.signedIn = false; return json(200, { status: true }); }
      return json(200, null);
    });
    await page.goto(url);
    await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
    return { page, calls, state, errors };
  }

  const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const tall = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));

  for (const [tag, viewport, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 800 }, false]]) {
    // --- Forgot password, from the sign-in screen ---
    {
      const { page, calls, errors } = await open(viewport, mobile);
      await page.evaluate(() => { window.__game.ui.setAccountMode('signin'); window.__game.ui.openPanel('panel-account'); });
      await page.waitForSelector('#btn-cloud-forgot', { state: 'visible' });
      assert.ok((await tall(page, '#btn-cloud-forgot'))[0] >= 44, 'forgot link is 44px tall');
      await page.screenshot({ path: `${OUT}/${tag}-1-signin-forgot-link.png` });
      await page.fill('#cloud-email', 'me@duilt.test');
      await page.click('#btn-cloud-forgot');
      await page.waitForSelector('#cloud-forgot-step:not([hidden])');
      assert.equal(await page.inputValue('#cloud-forgot-email'), 'me@duilt.test', 'email carried over');
      assert.equal(await page.textContent('#account-title'), 'Reset your password');
      // Bad email caught before a request.
      await page.fill('#cloud-forgot-email', 'nope');
      await page.click('#btn-cloud-forgot-send');
      assert.match(await page.textContent('#cloud-forgot-error'), /does not look like an email/);
      await page.screenshot({ path: `${OUT}/${tag}-2-forgot-bad-email.png` });
      await page.fill('#cloud-forgot-email', 'me@duilt.test');
      await page.click('#btn-cloud-forgot-send');
      await page.waitForSelector('#cloud-forgot-sent:not([hidden])');
      const req = calls.find((c) => c.path === '/request-password-reset');
      assert.equal(req.body.email, 'me@duilt.test');
      assert.match(req.body.redirectTo, /\/\?reset=1$/, 'redirect lands back on this app');
      assert.match(await page.textContent('#cloud-forgot-sent'), /If me@duilt\.test has an account/);
      assert.ok(await noSideScroll(page), 'no sideways scroll');
      await page.screenshot({ path: `${OUT}/${tag}-3-forgot-sent.png` });
      await page.click('#btn-cloud-forgot-back');
      assert.equal(await page.isVisible('#cloud-signed-out'), true, 'Back returns to sign in');
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- The emailed link, then the first sign-in revokes other sessions ---
    {
      const { page, calls, state, errors } = await open(viewport, mobile, `${base}?reset=1&token=TOK123`);
      await page.waitForSelector('#cloud-reset-step:not([hidden])');
      assert.equal(await page.textContent('#account-title'), 'New password');
      assert.equal(new URL(page.url()).search, '', 'token is gone from the address bar');
      assert.ok((await tall(page, '#cloud-new-password, #cloud-new-password2, #btn-cloud-reset')).every((h) => h >= 44), 'reset controls 44px');
      await page.screenshot({ path: `${OUT}/${tag}-4-reset-page.png` });
      await page.fill('#cloud-new-password', 'brandnew-pass1');
      await page.fill('#cloud-new-password2', 'different-pass1');
      await page.click('#btn-cloud-reset');
      assert.match(await page.textContent('#cloud-reset-error'), /do not match/);
      await page.screenshot({ path: `${OUT}/${tag}-5-reset-mismatch.png` });
      await page.fill('#cloud-new-password2', 'brandnew-pass1');
      await page.click('#btn-cloud-reset');
      await page.waitForSelector('#cloud-signed-out:not([hidden])');
      const rp = calls.find((c) => c.path === '/reset-password');
      assert.deepEqual(rp.body, { token: 'TOK123', newPassword: 'brandnew-pass1' });
      assert.match(await page.textContent('#cloud-note'), /Password changed/);
      assert.ok(!calls.some((c) => c.path === '/revoke-other-sessions'), 'not revoked until signed in');
      await page.screenshot({ path: `${OUT}/${tag}-6-reset-done-signin.png` });
      await page.fill('#cloud-email', user.email);
      await page.fill('#cloud-password', 'brandnew-pass1');
      await page.click('#btn-cloud-signin');
      await page.waitForFunction(() => window.__game.cloudAuth.summary()?.email === 'me@duilt.test', null, { timeout: 15_000 });
      await page.waitForFunction(() => true);
      await page.waitForTimeout(500);
      const names = calls.map((c) => c.path);
      assert.ok(names.indexOf('/revoke-other-sessions') > names.indexOf('/sign-in/email'), 'other sessions revoked after the reset sign-in');
      assert.equal(state.sessions.length, 1, 'only this session is left');
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- An expired link ---
    {
      const { page, errors } = await open(viewport, mobile, `${base}?reset=1&error=INVALID_TOKEN`);
      await page.waitForSelector('#cloud-reset-step:not([hidden])');
      assert.match(await page.textContent('#cloud-reset-error'), /expired or was already used/);
      assert.equal(await page.isVisible('#btn-cloud-reset-again'), true);
      await page.screenshot({ path: `${OUT}/${tag}-7-reset-expired.png` });
      await page.click('#btn-cloud-reset-again');
      await page.waitForSelector('#cloud-forgot-step:not([hidden])');
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- Sessions in account settings ---
    {
      const { page, calls, state, errors } = await open(viewport, mobile);
      state.signedIn = true;
      await page.evaluate(async () => { await window.__game.cloudAuth.recheck(); window.__game.ui.refreshCloudPanel(); window.__game.ui.openPanel('panel-account'); });
      await page.waitForSelector('.session-row');
      assert.equal(await page.locator('.session-row').count(), 3);
      const text = await page.textContent('#sessions-list');
      assert.match(text, /This device, active now/);
      assert.match(text, /Safari on iPhone/);
      assert.match(text, /Last active 1 hour ago/);
      assert.match(text, /Edge on Windows/);
      assert.match(text, /Last active 2 days ago/);
      assert.equal(await page.locator('.session-end').count(), 2, 'no Sign out on this device');
      assert.ok((await tall(page, '#account-sessions button')).every((h) => h >= 44), 'session buttons 44px');
      assert.ok(await noSideScroll(page), 'no sideways scroll');
      await page.locator('#account-sessions').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-8-sessions.png` });

      await page.click('button[data-token="tok-phone"]');
      await page.waitForFunction(() => document.querySelectorAll('.session-row').length === 2);
      assert.ok(calls.some((c) => c.path === '/revoke-session' && c.body.token === 'tok-phone'));

      await page.click('#btn-sessions-others');
      await page.waitForFunction(() => document.querySelectorAll('.session-row').length === 1);
      assert.ok(calls.some((c) => c.path === '/revoke-other-sessions'));
      await page.screenshot({ path: `${OUT}/${tag}-9-sessions-after-others.png` });

      await page.click('#btn-sessions-all');
      await page.waitForSelector('.confirm-card');
      await page.screenshot({ path: `${OUT}/${tag}-10-sign-out-everywhere-confirm.png` });
      await page.click('[data-yes]');
      await page.waitForFunction(() => window.__game.cloudAuth.summary() === null, null, { timeout: 10_000 });
      assert.ok(calls.some((c) => c.path === '/revoke-sessions'));
      await page.waitForSelector('#cloud-signed-out:not([hidden])');
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('PASS forgot password, reset link, revoke after reset, session list, sign out others and everywhere (phone and desktop)');
} finally {
  await browser?.close();
  await server.close();
}
