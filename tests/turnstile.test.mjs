/**
 * ACCT-7: Turnstile behind a build-time switch, with mocks (no network, no DOM).
 * Key set: script injected once, widget rendered, token sent as x-captcha-response.
 * No key: nothing loads, nothing renders, sign-in and sign-up send no extra header.
 */
import assert from 'node:assert/strict';
import { CloudAuth } from '../src/net/CloudAuth.js';
import {
  isTurnstileEnabled, turnstileSiteKey, captchaOptions, mountTurnstile, TURNSTILE_SCRIPT, CAPTCHA_HEADER,
} from '../src/net/turnstile.js';

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}: ${err.message}`); }
}

function fakeDom() {
  const appended = [];
  const rendered = [];
  const resets = [];
  const win = { innerWidth: 1280 };
  const doc = {
    createElement: () => ({}),
    head: {
      appendChild: (s) => {
        appended.push(s);
        // The script arrives, installs window.turnstile, fires onload.
        win.turnstile = {
          render: (el, opts) => { rendered.push({ el, opts }); return 'w1'; },
          reset: (id) => resets.push(id),
        };
        queueMicrotask(() => s.onload());
      },
    },
  };
  return { win, doc, appended, rendered, resets };
}

function authWithClient() {
  const calls = [];
  const ok = { data: { user: { id: 'u1', email: 'a@b.co' }, token: 't' } };
  const auth = new CloudAuth(null);
  auth.client = {
    auth: {
      signIn: { email: async (body, opts) => { calls.push({ kind: 'in', body, opts }); return ok; } },
      signUp: { email: async (body, opts) => { calls.push({ kind: 'up', body, opts }); return ok; } },
    },
  };
  return { auth, calls };
}

await test('no key: switch is off', () => {
  assert.equal(turnstileSiteKey({}), '');
  assert.equal(isTurnstileEnabled({}), false);
  assert.equal(isTurnstileEnabled({ VITE_TURNSTILE_SITE_KEY: '   ' }), false);
});

await test('no key: nothing loads or renders', async () => {
  const d = fakeDom();
  const handle = await mountTurnstile({}, { env: {}, win: d.win, doc: d.doc });
  assert.equal(handle, null);
  assert.equal(d.appended.length, 0);
  assert.equal(d.rendered.length, 0);
});

await test('no key: sign-in and sign-up send no captcha header', async () => {
  const { auth, calls } = authWithClient();
  await auth.signIn('a@b.co', 'pw123456');
  await auth.signUp('a@b.co', 'pw123456');
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.opts.headers, undefined);
    assert.equal(typeof c.opts.onSuccess, 'function');
  }
  assert.deepEqual(captchaOptions(''), {});
  assert.deepEqual(captchaOptions(undefined), {});
});

await test('key set: script loads once from Cloudflare and widget renders', async () => {
  const d = fakeDom();
  const env = { VITE_TURNSTILE_SITE_KEY: 'site-key-1' };
  assert.equal(isTurnstileEnabled(env), true);
  const el = { id: 'slot' };
  const h = await mountTurnstile(el, { env, win: d.win, doc: d.doc });
  assert.equal(d.appended.length, 1);
  assert.equal(d.appended[0].src, TURNSTILE_SCRIPT);
  assert.ok(d.appended[0].src.startsWith('https://challenges.cloudflare.com/'));
  assert.equal(d.rendered.length, 1);
  assert.equal(d.rendered[0].el, el);
  assert.equal(d.rendered[0].opts.sitekey, 'site-key-1');
  // A second mount reuses window.turnstile: no second script.
  await mountTurnstile({}, { env, win: d.win, doc: d.doc });
  assert.equal(d.appended.length, 1);
  // Token follows the widget callbacks; reset clears it and resets the widget.
  assert.equal(h.token(), '');
  d.rendered[0].opts.callback('tok-1');
  assert.equal(h.token(), 'tok-1');
  d.rendered[0].opts['expired-callback']();
  assert.equal(h.token(), '');
  d.rendered[0].opts.callback('tok-2');
  h.reset();
  assert.equal(h.token(), '');
  assert.deepEqual(d.resets, ['w1']);
});

await test('key set: token goes out as x-captcha-response on sign-in and sign-up', async () => {
  const { auth, calls } = authWithClient();
  await auth.signIn('a@b.co', 'pw123456', 'tok-in');
  await auth.signUp('a@b.co', 'pw123456', 'tok-up');
  assert.equal(CAPTCHA_HEADER, 'x-captcha-response');
  assert.equal(calls[0].opts.headers['x-captcha-response'], 'tok-in');
  assert.equal(calls[1].opts.headers['x-captcha-response'], 'tok-up');
  assert.equal(typeof calls[0].opts.onSuccess, 'function');
});

if (failed) process.exit(1);
