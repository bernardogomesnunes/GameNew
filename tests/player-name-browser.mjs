// ACCT-11 in a real page, against stand-in auth and Data API servers: the name
// prompt after sign-in, a taken name, a bad name, skipping (and not being asked
// again), changing the name from the account panel, and a database without
// migration 0010 (no prompt, no name row). Phone (390x844) and desktop (1280x800).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = 'docs/screens/db-additive';
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

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'none' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const user = { id: 'u1', email: 'me@duilt.test', name: 'me', emailVerified: true };

  /** opts: names ('present' | 'missing'), context (a browser context to reuse, so localStorage carries over) */
  async function open(viewport, mobile, opts = {}) {
    const context = opts.context ?? await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const calls = [];
    const state = { signedIn: false, name: opts.startName ?? null };
    await page.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      const headers = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*', 'access-control-expose-headers': 'set-auth-jwt' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const json = (status, body, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, contentType: 'application/json', body: JSON.stringify(body) });
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* none */ }
      if (u.hostname.includes('neonauth')) {
        const path = u.pathname.replace(/^.*\/auth/, '');
        calls.push({ api: 'auth', path, body });
        if (path === '/sign-in/email') { state.signedIn = true; return json(200, { token: 'tok', user }, { 'set-auth-jwt': jwt }); }
        if (path === '/get-session') return json(200, state.signedIn ? { session: { id: 's1', token: 'tok', userId: 'u1' }, user } : null, { 'set-auth-jwt': jwt });
        if (path === '/list-sessions') return json(200, [{ id: 's1', token: 'tok', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120', updatedAt: new Date().toISOString() }]);
        return json(200, null);
      }
      if (u.hostname.includes('apirest')) {
        const path = u.pathname.replace(/^.*\/rest\/v1/, '');
        calls.push({ api: 'data', path, body });
        if (path.startsWith('/rpc/') && /player_name/.test(path) && opts.names === 'missing') {
          return json(404, { code: 'PGRST202', message: 'Could not find the function public.my_player_name' });
        }
        if (path === '/rpc/my_player_name') return json(200, state.name);
        if (path === '/rpc/player_name_available') return json(200, true);
        if (path === '/rpc/claim_player_name') {
          if (body.p_name.toLowerCase() === 'taken one') return json(409, { code: '23505', message: 'name_taken' });
          state.name = body.p_name;
          return json(200, body.p_name);
        }
        if (path === '/players') return json(200, [{ id: 'p1' }]);
        return json(200, []);
      }
      return json(200, []);
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
    return { page, calls, state, errors, context };
  }

  const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const tall = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
  const signIn = async (page) => {
    await page.evaluate(() => { window.__game.ui.setAccountMode('signin'); window.__game.ui.refreshCloudPanel(); window.__game.ui.openPanel('panel-account'); });
    await page.waitForSelector('#cloud-email', { state: 'visible' });
    await page.fill('#cloud-email', 'me@duilt.test');
    await page.fill('#cloud-password', 'password-123');
    await page.click('#btn-cloud-signin');
  };
  const claims = (calls) => calls.filter((c) => c.path === '/rpc/claim_player_name').map((c) => c.body.p_name);

  for (const [tag, viewport, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 800 }, false]]) {
    // --- Prompt after sign-in: bad, taken, then a good name ---
    {
      const { page, calls, errors, context } = await open(viewport, mobile, { names: 'present' });
      await signIn(page);
      await page.waitForSelector('#name-input');
      assert.ok((await tall(page, '.name-card button, .name-card input')).every((h) => h >= 44), 'name card controls 44px');
      assert.ok(await noSideScroll(page), 'no sideways scroll');
      await page.screenshot({ path: `${OUT}/acct11-${tag}-1-prompt.png` });
      await page.fill('#name-input', 'ab');
      await page.click('[data-yes]');
      assert.match(await page.textContent('#name-error'), /at least 3/);
      assert.deepEqual(claims(calls), [], 'a bad name never reaches the database');
      await page.fill('#name-input', 'Taken One');
      await page.click('[data-yes]');
      await page.waitForFunction(() => /taken/.test(document.querySelector('#name-error')?.textContent ?? ''));
      await page.screenshot({ path: `${OUT}/acct11-${tag}-2-taken.png` });
      assert.deepEqual(claims(calls), ['Taken One']);
      await page.fill('#name-input', '  Anna Builder  ');
      await page.click('[data-yes]');
      await page.waitForSelector('#name-input', { state: 'detached' });
      assert.deepEqual(claims(calls), ['Taken One', 'Anna Builder'], 'trimmed before sending');
      await page.waitForFunction(() => window.__game.ui.playerName === 'Anna Builder');
      assert.match(await page.textContent('#home-account-label'), /Anna Builder/);
      await page.screenshot({ path: `${OUT}/acct11-${tag}-3-saved-home.png` });
      await page.evaluate(() => window.__game.ui.openPanel('panel-account'));
      await page.waitForSelector('#account-name-row:not([hidden])');
      assert.equal(await page.textContent('#account-name-value'), 'Anna Builder');
      assert.equal(await page.textContent('#btn-name-edit'), 'Change name');
      assert.ok((await tall(page, '#btn-name-edit')).every((h) => h >= 44));
      assert.ok(await noSideScroll(page));
      await page.screenshot({ path: `${OUT}/acct11-${tag}-4-account-name.png` });
      // Change it.
      await page.click('#btn-name-edit');
      await page.waitForSelector('#name-input');
      assert.equal(await page.inputValue('#name-input'), 'Anna Builder');
      await page.fill('#name-input', 'Anna the Builder');
      await page.press('#name-input', 'Enter');
      await page.waitForSelector('#name-input', { state: 'detached' });
      assert.equal(await page.textContent('#account-name-value'), 'Anna the Builder');
      assert.deepEqual(errors, []);
      await context.close();
    }

    // --- Skip: no second prompt on the next sign-in, and the email fallback shows ---
    {
      const first = await open(viewport, mobile, { names: 'present' });
      await signIn(first.page);
      await first.page.waitForSelector('#name-input');
      await first.page.click('[data-skip]');
      await first.page.waitForSelector('#name-input', { state: 'detached' });
      assert.deepEqual(claims(first.calls), []);
      assert.match(await first.page.textContent('#home-account-label'), /me@duilt\.test/, 'email fallback after skipping');
      await first.page.evaluate(() => window.__game.ui.openPanel('panel-account'));
      await first.page.waitForSelector('#account-name-row:not([hidden])');
      assert.equal(await first.page.textContent('#account-name-value'), 'Not chosen yet');
      assert.equal(await first.page.textContent('#btn-name-edit'), 'Choose a name');
      assert.equal(await first.page.textContent('#account-email'), 'me@duilt.test');
      await first.page.screenshot({ path: `${OUT}/acct11-${tag}-5-skipped-fallback.png` });
      // Sign out and in again in the same browser: not asked again.
      await first.page.evaluate(() => window.__game.cloudAuth.signOut());
      first.state.signedIn = false;
      await signIn(first.page);
      await first.page.waitForFunction(() => window.__game.cloudAuth.summary()?.id === 'u1');
      await first.page.waitForTimeout(800);
      assert.equal(await first.page.locator('#name-input').count(), 0, 'not asked again after skipping');
      assert.deepEqual(first.errors, []);
      await first.context.close();
    }

    // --- Database without migration 0010: no prompt, no name row ---
    {
      const { page, errors, context } = await open(viewport, mobile, { names: 'missing' });
      await signIn(page);
      await page.waitForFunction(() => window.__game.cloudAuth.summary()?.id === 'u1');
      await page.waitForTimeout(800);
      assert.equal(await page.locator('#name-input').count(), 0, 'no prompt without the functions');
      await page.evaluate(() => window.__game.ui.openPanel('panel-account'));
      await page.waitForSelector('#cloud-signed-in:not([hidden])');
      assert.equal(await page.isVisible('#account-name-row'), false, 'no name row without the functions');
      assert.match(await page.textContent('#account-email'), /me@duilt\.test/);
      await page.screenshot({ path: `${OUT}/acct11-${tag}-6-no-migration.png` });
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  console.log('PASS name prompt after sign-in, bad and taken names, change, skip once, and no UI without the migration (phone and desktop)');
} finally {
  await browser?.close();
  await server.close();
}
