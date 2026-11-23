// ACCT-2 and ACCT-10 against CloudAuth, with the auth client mocked.
import { CloudAuth, describeDevice, agoText, readableResetError } from '../src/net/CloudAuth.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

function make(overrides = {}) {
  const calls = [];
  const rec = (name, result) => async (...args) => { calls.push([name, ...args]); return typeof result === 'function' ? result(...args) : result; };
  const auth = {
    requestPasswordReset: rec('requestPasswordReset', { data: { status: true } }),
    resetPassword: rec('resetPassword', { data: { status: true } }),
    signIn: { email: rec('signIn', { data: { token: 't', user: { id: 'u1', email: 'a@b.co', name: 'a' } } }) },
    getSession: rec('getSession', { data: { session: { id: 's1', token: 'tok1' }, user: { id: 'u1' } } }),
    listSessions: rec('listSessions', { data: [
      { id: 's2', token: 'tok2', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Safari/604', updatedAt: '2026-11-20T10:00:00Z' },
      { id: 's1', token: 'tok1', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537', updatedAt: '2026-11-22T10:00:00Z' },
    ] }),
    revokeSession: rec('revokeSession', { data: { status: true } }),
    revokeOtherSessions: rec('revokeOtherSessions', { data: { status: true } }),
    revokeSessions: rec('revokeSessions', { data: { status: true } }),
    ...overrides,
  };
  const a = new CloudAuth(null);
  a.client = { auth };
  return { a, calls };
}

// --- ACCT-2 ---
{
  const { a, calls } = make();
  await a.requestPasswordReset('a@b.co', 'https://x.test/?reset=1');
  ok('reset request sends email and redirectTo', JSON.stringify(calls[0]) === JSON.stringify(['requestPasswordReset', { email: 'a@b.co', redirectTo: 'https://x.test/?reset=1' }]));
}
{
  const { a } = make({ requestPasswordReset: async () => ({ error: { status: 429, message: 'Too many requests' } }) });
  const err = await a.requestPasswordReset('a@b.co', 'https://x.test/').catch((e) => e);
  ok('reset request rate limit reads plainly', /Too many tries/.test(err.message));
}
{
  const { a } = make({ requestPasswordReset: async () => { throw new TypeError('Failed to fetch'); } });
  const err = await a.requestPasswordReset('a@b.co', 'https://x.test/').catch((e) => e);
  ok('reset request offline reads plainly', /Could not reach/.test(err.message));
}
{
  const { a, calls } = make();
  await a.resetPassword('TOK', 'newpassword1');
  ok('reset sends token and new password', JSON.stringify(calls[0]) === JSON.stringify(['resetPassword', { token: 'TOK', newPassword: 'newpassword1' }]));
  ok('reset sets the revoke-after-reset flag', store.get('duilt.revokeAfterReset') === '1');
  ok('reset does not revoke yet (no session to revoke with)', !calls.some((c) => c[0] === 'revokeOtherSessions'));
  await a.signIn('a@b.co', 'newpassword1');
  const names = calls.map((c) => c[0]);
  ok('next sign-in revokes the other sessions', names.indexOf('revokeOtherSessions') > names.indexOf('signIn'));
  ok('flag is cleared after the revoke', !store.has('duilt.revokeAfterReset'));
  await a.signIn('a@b.co', 'newpassword1');
  ok('later sign-ins do not revoke again', calls.filter((c) => c[0] === 'revokeOtherSessions').length === 1);
}
{
  store.clear();
  const { a } = make({ resetPassword: async () => ({ error: { code: 'INVALID_TOKEN', message: 'Invalid token', status: 400 } }) });
  const err = await a.resetPassword('BAD', 'newpassword1').catch((e) => e);
  ok('expired token says so', /expired or was already used/.test(err.message));
  ok('failed reset sets no flag', !store.has('duilt.revokeAfterReset'));
  ok('short password error reads plainly', /longer password/.test(readableResetError({ code: 'PASSWORD_TOO_SHORT' })));
}
{
  store.set('duilt.revokeAfterReset', '1');
  const { a } = make({ revokeOtherSessions: async () => { throw new Error('offline'); } });
  const quiet = console.error; console.error = () => {};
  await a.signIn('a@b.co', 'newpassword1');
  console.error = quiet;
  ok('a failed revoke does not block sign-in', a.user?.id === 'u1');
  ok('a failed revoke keeps the flag for the next try', store.get('duilt.revokeAfterReset') === '1');
  store.clear();
}

// --- ACCT-10 ---
{
  const { a } = make();
  const rows = await a.listSessions();
  ok('two sessions listed', rows.length === 2);
  ok('this device is first and marked', rows[0].current && rows[0].id === 's1');
  ok('device names read from user agent', rows[0].device === 'Chrome on Linux' && rows[1].device === 'Safari on iPhone');
  ok('last active passed through', rows[1].lastActive === '2026-11-20T10:00:00Z');
}
{
  const { a, calls } = make();
  await a.revokeSession('tok2');
  ok('revoke one sends its token', JSON.stringify(calls[0]) === JSON.stringify(['revokeSession', { token: 'tok2' }]));
  await a.revokeOtherSessions();
  ok('revoke others calls revokeOtherSessions', calls[1][0] === 'revokeOtherSessions');
}
{
  const events = [];
  const { a, calls } = make();
  a.bus = { emit: (n, p) => events.push([n, p]) };
  a.user = { id: 'u1' }; a.jwt = 'x';
  await a.revokeAllSessions();
  ok('revoke all calls revokeSessions', calls[0][0] === 'revokeSessions');
  ok('revoke all signs this device out', a.user === null && a.jwt === null && events[0][1].user === null);
}
{
  const { a } = make({ revokeOtherSessions: async () => ({ error: { status: 500, message: 'x' } }) });
  const err = await a.revokeOtherSessions().catch((e) => e);
  ok('revoke failure surfaces', /trouble/.test(err.message));
}

// --- helpers ---
ok('unknown agent', describeDevice('') === 'Unknown device');
ok('Edge on Windows', describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120') === 'Edge on Windows');
ok('Firefox on Mac', describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/120') === 'Firefox on Mac');
ok('Chrome on Android', describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537') === 'Chrome on Android');
const now = Date.parse('2026-11-23T12:00:00Z');
ok('ago: just now', agoText('2026-11-23T11:59:30Z', now) === 'just now');
ok('ago: 1 minute', agoText('2026-11-23T11:58:30Z', now) === '1 minute ago');
ok('ago: 5 hours', agoText('2026-11-23T07:00:00Z', now) === '5 hours ago');
ok('ago: 3 days', agoText('2026-11-20T12:00:00Z', now) === '3 days ago');

process.exit(f ? 1 : 0);
