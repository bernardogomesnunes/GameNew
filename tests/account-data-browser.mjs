// ACCT-5 in a real page, against stand-in auth and Data API servers: Download my
// data, and Delete my account (asks twice, deletes through the SQL function, then
// the sign-in user, then signs out). Also a database without migration 0009
// (no delete button) and a sign-in service that refuses to delete users.
// Phone (390x844) and desktop (1280x800).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
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

  /** opts: rpc ('present' | 'missing'), deleteUser ('ok' | 'unavailable' | 'needs-password') */
  async function open(viewport, mobile, opts = {}) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (process.env.DEBUG_PAGE) page.on('console', (m) => console.log('[page]', m.text().slice(0, 300)));
    const calls = [];
    const state = { signedIn: true, dataDeleted: false, passwordSeen: null };
    await page.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') return route.continue();
      const headers = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*', 'access-control-expose-headers': 'set-auth-jwt' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const json = (status, body) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* none */ }
      if (u.hostname.includes('neonauth')) {
        const path = u.pathname.replace(/^.*\/auth/, '');
        calls.push({ api: 'auth', path, body });
        if (path === '/get-session') {
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { ...headers, 'set-auth-jwt': jwt },
            body: JSON.stringify(state.signedIn ? { session: { id: 's1', token: 'tok', userId: 'u1' }, user } : null) });
        }
        if (path === '/list-sessions') return json(200, [{ id: 's1', token: 'tok', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120', updatedAt: new Date().toISOString() }]);
        if (path === '/delete-user') {
          state.passwordSeen = body.password ?? null;
          if (opts.deleteUser === 'unavailable') return json(404, { message: 'Not Found' });
          if (opts.deleteUser === 'needs-password' && !body.password) return json(403, { code: 'SESSION_EXPIRED', message: 'Session expired. Re-authenticate to perform this action' });
          state.signedIn = false;
          return json(200, { success: true, message: 'User deleted' });
        }
        if (path === '/sign-out') { state.signedIn = false; return json(200, { success: true }); }
        return json(200, null);
      }
      if (u.hostname.includes('apirest')) {
        const path = u.pathname.replace(/^.*\/rest\/v1/, '');
        calls.push({ api: 'data', path: path + u.search, body, method: req.method() });
        if (path === '/rpc/delete_my_account_data') {
          if (opts.rpc === 'missing') return json(404, { code: 'PGRST202', message: 'Could not find the function public.delete_my_account_data' });
          if (body.p_dry_run === false) state.dataDeleted = true;
          return json(200, { dry_run: body.p_dry_run, worlds: 2, chunks: 5, templates: 0, had_name: false });
        }
        if (path === '/players') return json(200, [{ id: 'p1' }]);
        if (path === '/worlds' && u.searchParams.get('id')?.startsWith('eq.')) {
          const id = u.searchParams.get('id').slice(3);
          if (u.searchParams.get('select') === 'revision') return json(200, [{ revision: 1 }]);
          return json(200, [{ id, name: id === 'w1' ? 'Hill town' : 'Lake', mode: 'duilt', size_x: 0, size_z: 0, height: 200, spawn: null, economy: {}, duilt: { bag: { wood: 4 } }, world_gen: null, block_count: 9, revision: 1 }]);
        }
        if (path === '/worlds') return json(200, [
          { id: 'w1', name: 'Hill town', mode: 'duilt', battle: null, block_count: 9, revision: 1, updated_at: '2026-11-20T10:00:00Z' },
          { id: 'w2', name: 'Lake', mode: 'duilt', battle: null, block_count: 9, revision: 1, updated_at: '2026-11-21T10:00:00Z' },
        ]);
        if (path === '/world_chunks') return json(200, [{ cx: 0, cz: 0, rle: '\\x010203' }, { cx: 1, cz: 0, rle: '\\x0a0b' }]);
        if (path === '/progression') return json(200, [{ xp: 50, level: 2, stats: { xp: 50, level: 2 } }]);
        return json(200, []);
      }
      return json(200, []);
    });
    await page.goto(base);
    await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
    await page.evaluate(async () => { await window.__game.cloudAuth.recheck(); window.__game.ui.refreshCloudPanel(); window.__game.ui.openPanel('panel-account'); });
    await page.waitForSelector('#account-data', { state: 'visible' });
    return { page, calls, state, errors };
  }

  const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const tall = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
  const rpcCalls = (calls) => calls.filter((c) => c.path === '/rpc/delete_my_account_data');

  for (const [tag, viewport, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 800 }, false]]) {
    // --- Download, then a full delete ---
    {
      const { page, calls, state, errors } = await open(viewport, mobile, { rpc: 'present', deleteUser: 'ok' });
      await page.waitForSelector('#btn-data-delete:not([hidden])', { timeout: 8000 }).catch(async () => { console.log(await page.evaluate(() => JSON.stringify({ f: window.__game.ui.deletePreviewFor, p: window.__game.ui.deletePreview, hid: document.querySelector('#btn-data-delete').hidden, user: window.__game.cloudAuth.summary(), cloud: !!window.__game.cloud }))); console.log(JSON.stringify(calls.slice(-8))); throw new Error('no button'); });
      await page.locator('#account-data').scrollIntoViewIfNeeded();
      assert.ok((await tall(page, '#account-data button')).every((h) => h >= 44), 'data buttons 44px');
      assert.ok(await noSideScroll(page), 'no sideways scroll');
      await page.screenshot({ path: `${OUT}/acct5-${tag}-1-your-data.png` });

      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-data-download')]);
      assert.match(download.suggestedFilename(), /^duilt-my-data-\d{4}-\d{2}-\d{2}\.json$/);
      const file = JSON.parse(readFileSync(await download.path(), 'utf8'));
      assert.equal(file.format, 'duilt-account-export');
      assert.equal(file.account.email, 'me@duilt.test');
      assert.equal(file.worlds.length, 2);
      assert.equal(file.worlds[0].name, 'Hill town');
      assert.equal(file.worlds[0].chunks.length, 2);
      assert.equal(file.worlds[0].meta.duilt.bag.wood, 4);
      assert.equal(file.progression.xp, 50);
      await page.waitForFunction(() => /Saved 2 worlds/.test(document.querySelector('#data-status').textContent));
      await page.screenshot({ path: `${OUT}/acct5-${tag}-2-downloaded.png` });
      assert.equal(rpcCalls(calls).filter((c) => c.body.p_dry_run === false).length, 0, 'download deletes nothing');

      // First ask.
      await page.click('#btn-data-delete');
      await page.waitForSelector('.confirm-card');
      assert.match(await page.textContent('.confirm-body'), /2 worlds/);
      await page.screenshot({ path: `${OUT}/acct5-${tag}-3-first-ask.png` });
      await page.click('[data-no]');
      assert.equal(rpcCalls(calls).filter((c) => c.body.p_dry_run === false).length, 0, 'cancel deletes nothing');

      await page.click('#btn-data-delete');
      await page.click('[data-yes]');
      await page.waitForSelector('#data-delete-box:not([hidden])');
      assert.equal(await page.isDisabled('#btn-data-delete-go'), true, 'disabled until DELETE is typed');
      await page.fill('#data-delete-type', 'delete me');
      assert.equal(await page.isDisabled('#btn-data-delete-go'), true, 'wrong text keeps it disabled');
      assert.ok((await tall(page, '#data-delete-box button, #data-delete-box input')).every((h) => h >= 44), 'delete box controls 44px');
      await page.screenshot({ path: `${OUT}/acct5-${tag}-4-type-delete.png` });
      await page.fill('#data-delete-type', 'DELETE');
      assert.equal(await page.isDisabled('#btn-data-delete-go'), false);
      assert.ok(await noSideScroll(page), 'no sideways scroll in the box');
      await page.click('#btn-data-delete-go');
      await page.waitForFunction(() => window.__game.cloudAuth.summary() === null, null, { timeout: 15_000 });
      assert.equal(state.dataDeleted, true);
      const order = calls.filter((c) => c.path === '/rpc/delete_my_account_data' && c.body.p_dry_run === false || c.path === '/delete-user').map((c) => c.path);
      assert.deepEqual(order, ['/rpc/delete_my_account_data', '/delete-user'], 'data first, then the sign-in user');
      await page.waitForSelector('#cloud-signed-out:not([hidden])');
      await page.screenshot({ path: `${OUT}/acct5-${tag}-5-after-delete.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- Database without migration 0009: no delete button, download still works ---
    {
      const { page, calls, errors } = await open(viewport, mobile, { rpc: 'missing' });
      await page.waitForFunction(() => window.__game.ui.deletePreviewFor === 'u1');
      assert.equal(await page.isVisible('#btn-data-delete'), false, 'delete hidden without the function');
      assert.equal(await page.isVisible('#btn-data-download'), true);
      await page.locator('#account-data').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/acct5-${tag}-6-no-migration.png` });
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-data-download')]);
      assert.equal(JSON.parse(readFileSync(await download.path(), 'utf8')).worlds.length, 2);
      assert.equal(rpcCalls(calls).length, 1, 'asked once, remembered');
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- The sign-in service will not delete users: data goes, message says why, signed out ---
    {
      const { page, calls, errors } = await open(viewport, mobile, { rpc: 'present', deleteUser: 'unavailable' });
      await page.waitForSelector('#btn-data-delete:not([hidden])');
      await page.click('#btn-data-delete');
      await page.click('[data-yes]');
      await page.fill('#data-delete-type', 'DELETE');
      await page.click('#btn-data-delete-go');
      await page.waitForSelector('#cloud-error:not([hidden)]', { timeout: 15_000 }).catch(() => {});
      await page.waitForFunction(() => window.__game.cloudAuth.summary() === null, null, { timeout: 15_000 });
      await page.waitForFunction(() => /could not be removed/.test(document.querySelector('#cloud-error')?.textContent ?? ''));
      assert.ok(calls.some((c) => c.path === '/sign-out'), 'signed out');
      assert.equal(rpcCalls(calls).filter((c) => c.body.p_dry_run === false).length, 1);
      await page.screenshot({ path: `${OUT}/acct5-${tag}-7-auth-delete-unavailable.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }

    // --- A stale session asks for the password, and does not delete the data twice ---
    {
      const { page, calls, state, errors } = await open(viewport, mobile, { rpc: 'present', deleteUser: 'needs-password' });
      await page.waitForSelector('#btn-data-delete:not([hidden])');
      await page.click('#btn-data-delete');
      await page.click('[data-yes]');
      await page.fill('#data-delete-type', 'DELETE');
      await page.click('#btn-data-delete-go');
      await page.waitForSelector('#data-delete-pass-row:not([hidden])');
      assert.match(await page.textContent('#data-error'), /type your password/);
      await page.screenshot({ path: `${OUT}/acct5-${tag}-8-needs-password.png` });
      await page.fill('#data-delete-pass', 'my-password-1');
      await page.click('#btn-data-delete-go');
      await page.waitForFunction(() => window.__game.cloudAuth.summary() === null, null, { timeout: 15_000 });
      assert.equal(state.passwordSeen, 'my-password-1');
      assert.equal(rpcCalls(calls).filter((c) => c.body.p_dry_run === false).length, 1, 'data deleted once');
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('PASS download my data, delete my account (asks twice), no delete button without the migration, unavailable and password paths (phone and desktop)');
} finally {
  await browser?.close();
  await server.close();
}
