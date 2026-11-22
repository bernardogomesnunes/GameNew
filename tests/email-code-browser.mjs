// ACCT-4 in a real page on a phone, against a stand-in auth server: creating
// an account asks for the 6-digit emailed code; a wrong code says so in red;
// the right one signs you in. Signing in to an unconfirmed account asks too.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('https://ep-fake.neon.test/neondb') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const calls = [];
  let siteCalls = 0;
  let signedIn = false;
  const user = { id: 'u1', email: 'new@duilt.test', name: 'new', emailVerified: false };
  await page.route('**/*', (route) => {
    const req = route.request();
    const u = new URL(req.url());
    // PLAY-1: sign-in goes through the page's own address, /neonauth.
    const viaSite = u.pathname.startsWith('/neonauth/');
    if (u.hostname === '127.0.0.1' && !viaSite) return route.continue();
    const headers = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*', 'access-control-expose-headers': 'set-auth-jwt' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const json = (status, body) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (!viaSite && !u.hostname.includes('neonauth')) return json(200, []);
    const path = viaSite ? u.pathname.replace(/^\/neonauth/, '') : u.pathname.replace(/^.*\/auth/, '');
    calls.push(path);
    if (viaSite) siteCalls += 1;
    if (path === '/sign-up/email') return json(200, { token: null, user });
    if (path === '/sign-in/email') return json(403, { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    if (path === '/email-otp/send-verification-otp') return json(200, { success: true });
    if (path === '/email-otp/verify-email') {
      const { otp } = JSON.parse(req.postData() || '{}');
      if (otp !== '123456') return json(400, { code: 'INVALID_OTP', message: 'Invalid OTP' });
      signedIn = true;
      return json(200, { status: true, token: 'tok', user: { ...user, emailVerified: true } });
    }
    if (path === '/get-session') return json(200, signedIn ? { session: { id: 's1', token: 'tok', userId: 'u1' }, user } : null);
    return json(200, null);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
  mkdirSync('docs/screens/email-code', { recursive: true });

  // Creating an account: the code step comes up.
  await page.evaluate(() => { window.__game.ui.setAccountMode('create'); window.__game.ui.openPanel('panel-account'); });
  await page.fill('#cloud-email', user.email);
  await page.fill('#cloud-password', 'longenough1');
  await page.click('#btn-cloud-signin');
  await page.waitForSelector('#cloud-code-step:not([hidden])', { timeout: 10_000 });
  assert.equal(await page.isHidden('#cloud-signed-out'), true, 'the email form steps aside');
  assert.match(await page.textContent('#cloud-code-sent'), /new@duilt\.test/);
  assert.equal(await page.textContent('#account-title'), 'Check your email');
  await page.screenshot({ path: 'docs/screens/email-code/code-step.png' });

  // A wrong code: red, and the step stays.
  await page.fill('#cloud-code', '111111');
  await page.waitForSelector('#cloud-code-error:not([hidden])', { timeout: 10_000 });
  assert.match(await page.textContent('#cloud-code-error'), /code is not right/);
  assert.equal(await page.isVisible('#cloud-code-step'), true);
  await page.screenshot({ path: 'docs/screens/email-code/wrong-code.png' });

  // Send a new code.
  await page.click('#btn-cloud-resend');
  await page.waitForFunction(() => true);
  await page.waitForTimeout(500);
  assert.ok(calls.includes('/email-otp/send-verification-otp'), 'a new code was asked for');
  assert.equal(siteCalls, calls.length, 'every sign-in call went through the page\'s own /neonauth');

  // The right code: signed in, panel closed.
  await page.fill('#cloud-code', '123456');
  await page.waitForFunction(() => !document.querySelector('#panel-account')?.classList.contains('open')
    && window.__game.cloudAuth.summary()?.email === 'new@duilt.test', null, { timeout: 15_000 });

  // Signing in to an unconfirmed account asks for the code too.
  await page.evaluate(async () => { await window.__game.cloudAuth.signOut(); window.__game.ui.codeFor = null; window.__game.ui.setAccountMode('signin'); window.__game.ui.refreshCloudPanel(); window.__game.ui.openPanel('panel-account'); });
  signedIn = false;
  await page.fill('#cloud-email', user.email);
  await page.fill('#cloud-password', 'longenough1');
  await page.click('#btn-cloud-signin');
  await page.waitForSelector('#cloud-code-step:not([hidden])', { timeout: 10_000 });
  // Back to the form.
  await page.click('#btn-cloud-code-back');
  assert.equal(await page.isVisible('#cloud-signed-out'), true, 'Use a different email goes back');

  assert.deepEqual(errors, []);
  console.log('PASS create asks for the emailed code; wrong code in red; new code; right code signs in; unconfirmed sign-in asks too');
} finally {
  await browser?.close();
  await server.close();
}
