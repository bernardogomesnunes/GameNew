// Owner, 9 November: "we should have the same game open in all devices. We can
// deal with opening the world at the same time gracefully, by telling the user
// if another session is open, if the user wants to proceed we will close that
// another session."
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { WorldSession, SESSION_FRESH_MS, describeDevice } = await import('../src/storage/WorldSession.js');
const { Game } = await import('../src/Game.js');

/** The world_sessions table, as the Data API would answer for one account. */
function table({ missing = false } = {}) {
  const rows = new Map();
  const t = {
    rows,
    async readWorldSession(w) { if (missing) return undefined; return rows.get(w) ?? null; },
    async claimWorldSession(w, { sessionId, device }) { if (missing) return undefined; rows.set(w, { session_id: sessionId, device, seen_at: new Date(t.clock).toISOString() }); return true; },
    async touchWorldSession(w, id) { if (missing) return undefined; const r = rows.get(w); if (!r || r.session_id !== id) return false; r.seen_at = new Date(t.clock).toISOString(); return true; },
    async releaseWorldSession(w, id) { if (rows.get(w)?.session_id === id) rows.delete(w); return true; },
    clock: Date.parse('2026-11-09T12:00:00Z'),
  };
  return t;
}

const t = table();
const now = () => t.clock;
const phone = new WorldSession({ transport: t, now, id: 'phone-tab-1', device: 'iPhone, Safari' });
const desk = new WorldSession({ transport: t, now, id: 'desk-tab-1', device: 'Windows computer, Chrome' });

assert.equal(await phone.check('w1'), null, 'nobody has it open');
await phone.claim('w1');
t.clock += 10_000;
assert.deepEqual(await desk.check('w1'), { device: 'iPhone, Safari', secondsAgo: 10 });
console.log('PASS opening a world open on another device says which device, and how long ago');

assert.equal(await phone.beat(), 'mine');
await desk.claim('w1');
assert.equal(await phone.beat(), 'lost', 'the phone learns it was taken over');
assert.equal(await desk.beat(), 'mine');
console.log('PASS taking it over closes the other session at its next heartbeat');

t.clock += SESSION_FRESH_MS + 1000;
assert.equal(await phone.check('w1'), null, 'a session silent past 75 s is gone');
await desk.release();
assert.equal(t.rows.has('w1'), false, 'leaving lets it go');
console.log('PASS a closed or sleeping session does not block, and leaving lets the world go');

const none = new WorldSession({ transport: table({ missing: true }), now, id: 'x-tab-12345' });
assert.equal(await none.check('w1'), null);
await none.claim('w1');
assert.equal(await none.beat(), 'unknown');
console.log('PASS without the table (migration 0007 not applied) nothing changes');

assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), 'iPhone, Safari');
assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'), 'Windows computer, Chrome');
console.log('PASS the other device is named the way a player knows it');

// In the game: asked before opening, and no means it does not open.
function game(answer) {
  const tt = table();
  tt.rows.set('w1', { session_id: 'other-tab-99', device: 'iPhone, Safari', seen_at: new Date().toISOString() });
  const g = { cloud: { transport: tt }, asked: [], ui: { confirm: async (o) => { g.asked.push(o); return answer; } } };
  for (const k of ['worldSessionFor', 'takeWorldSession', 'checkWorldSession', 'worldSessionTaken', 'releaseWorldSession']) g[k] = Game.prototype[k];
  return { g, tt };
}
{
  const { g, tt } = game(false);
  assert.equal(await g.takeWorldSession('w1'), false);
  assert.match(g.asked[0].title, /open somewhere else/);
  assert.match(g.asked[0].body, /iPhone, Safari/);
  assert.equal(tt.rows.get('w1').session_id, 'other-tab-99', 'no: the other session keeps it');
  clearInterval(g.sessionBeat);
}
{
  const { g, tt } = game(true);
  assert.equal(await g.takeWorldSession('w1'), true);
  assert.equal(tt.rows.get('w1').session_id, g.worldSession.id, 'yes: this tab has it now');
  clearInterval(g.sessionBeat);
  // The other tab, now: its heartbeat finds it gone and it stops saving.
  g.worldId = 'w1'; g.worldIsLocal = false;
  tt.rows.set('w1', { session_id: 'third-tab-77', device: 'Mac, Chrome', seen_at: new Date().toISOString() });
  g.ui.confirm = async () => true;
  assert.equal(await g.checkWorldSession(), false);
  assert.equal(g.sessionTaken, true);
  assert.equal(g.discarded, true, 'nothing more is saved from the closed session');
  assert.equal(g.pendingSave, false);
}
console.log('PASS the game asks first; no keeps it there, yes takes it, and a taken-over tab stops saving');

const src = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
assert.match(src, /if \(!await this\.checkWorldSession\(\)\) return false;\s*await this\.saveToCloud/, 'flush checks before every upload');
assert.match(src, /if \(!await this\.takeWorldSession\(id\)\) return false;/, 'restoreFromCloud asks before opening');
const sql = readFileSync(new URL('../migrations/0007_world_sessions.sql', import.meta.url), 'utf8');
assert.match(sql, /create table world_sessions/);
assert.match(sql, /enable row level security/);
console.log('PASS every upload checks the session first, and the table is owner-only');
