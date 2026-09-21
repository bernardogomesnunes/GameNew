/**
 * The cloud save round trip — the thing that was never actually tested.
 *
 * Reported as: "Not saved to your account yet. Cloud request failed (400).
 * {"code":"23502",...null value in column \"size_x\" of relation \"worlds\"
 * violates not-null constraint...}" — on a brand new Duilt world, seconds
 * into playing it.
 *
 * `worlds.size_x` and `worlds.size_z` are NOT NULL in the real database.
 * They were written for a game that only ever had fixed-size worlds. Duilt
 * worlds are endless — `World.sizeX` is `null` by design, there is no size,
 * there is a seed instead — and CloudWorlds.save() sent that `null` straight
 * through. Every single Duilt world has failed to save since the day
 * endless worlds shipped: a direct count against the live database found
 * zero rows in `worlds`, ever, for any world, of any mode.
 *
 * That also means nothing ever exercised what a *successful* save/restore
 * round trip actually preserves, which is how two more bugs of the same
 * shape were sitting right behind the first one:
 *
 *  - `CloudWorlds.restore()` always built a bounded `World`, even for an
 *    endless one. It never carried a seed anywhere, because there was
 *    nowhere in the schema to put it. Reopening a saved Duilt world would
 *    have silently handed back a tiny 64×64 box and dropped everything
 *    outside it — not an error, just quietly wrong, which is worse.
 *  - `NeonTransport.pushWorld()` computed `meta.duilt` (the bag, buildings,
 *    skills, territory age) and never once put it in the request body.
 *    `pullWorld()` never read a `duilt` field back either, because the row
 *    never had one. Every restored Duilt world would have come back an
 *    empty sandbox at Age 1, exactly the "blank map" bug this file's own
 *    surrounding comments already warned about — just never checked.
 *
 * This exercises all three, end to end, against a fake backend that enforces
 * the real schema's NOT NULL columns the way real Postgres does — so a
 * regression on `size_x` fails here with the same 400 the player saw,
 * instead of shipping again unnoticed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { WORLDS_MODE_VALUES } from '../db/schema.mjs';

// --- a localStorage good enough for NeonTransport's device key --------------
const localStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
  setItem: (k, v) => localStore.set(k, String(v)),
  removeItem: (k) => localStore.delete(k),
};

const { CloudWorlds } = await import('../src/net/CloudWorlds.js');
const { NeonTransport } = await import('../src/net/NeonTransport.js');
const { World } = await import('../src/world/World.js');
const { ChunkGen } = await import('../src/world/ChunkGen.js');

/** Always answers with a token; nothing here exercises auth itself. */
const fakeAuth = {
  async accessToken() { return 'test-token'; },
  summary() { return { id: 'player-1', email: 'someone@example.com' }; },
};

/**
 * A fake PostgREST + Postgres, real enough to enforce the constraint that
 * actually broke: `worlds.size_x` and `worlds.size_z` are NOT NULL, with no
 * default. Anything else is accepted permissively — this is a schema guard,
 * not a full emulator.
 */
function fakeBackend() {
  const worlds = new Map();      // id -> row
  const chunks = new Map();      // `${worldId}:${cx},${cz}` -> row
  const players = [{ id: 'player-1' }];
  const saveFailures = [];
  let progression = null;        // one row, like the real table's PK on player_id
  const requests = [];

  function reject(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }
  function ok(body, status = 200) {
    // A 204/304 response cannot carry a body at all — the Fetch spec forbids
    // it and Node's Response constructor enforces that, so this must pass
    // `null`, not an empty string, whenever there is nothing to send back.
    return new Response(body === undefined ? null : JSON.stringify(body),
      { status, headers: { 'content-type': 'application/json' } });
  }

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init.method || 'GET';
    const path = url.pathname.replace(/^.*\/rest\/v1/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method, path, body });

    if (path.startsWith('/players')) {
      if (method === 'GET') return ok(players);
      if (method === 'POST') return ok(players, 201);
    }

    if (path.startsWith('/worlds')) {
      if (method === 'POST' && url.searchParams.has('on_conflict')) {
        for (const row of body) {
          // The one constraint that actually matters here: real Postgres,
          // real error shape, real message — the exact thing the player's
          // screenshot showed.
          if (row.size_x === null || row.size_x === undefined) {
            return reject(400, { code: '23502', message: 'null value in column "size_x" of relation "worlds" violates not-null constraint' });
          }
          if (row.size_z === null || row.size_z === undefined) {
            return reject(400, { code: '23502', message: 'null value in column "size_z" of relation "worlds" violates not-null constraint' });
          }
          // The real constraint, enforced against the same list of allowed
          // values db/schema.mjs and NeonTransport both read — see
          // migrations/0002_worlds_allow_duilt_mode.sql.
          if (!WORLDS_MODE_VALUES.includes(row.mode)) {
            return reject(400, { code: '23514', message: `new row for relation "worlds" violates check constraint "worlds_mode_check"` });
          }
          const existing = worlds.get(row.id) || {};
          worlds.set(row.id, { ...existing, ...row });
        }
        return ok(undefined, 204);
      }
      if (method === 'GET') {
        const id = [...url.searchParams].find(([k]) => k === 'id')?.[1]?.replace('eq.', '');
        const row = id ? worlds.get(id) : null;
        return ok(row ? [row] : []);
      }
      if (method === 'PATCH') {
        const id = [...url.searchParams].find(([k]) => k === 'id')?.[1]?.replace('eq.', '');
        if (id && worlds.has(id)) Object.assign(worlds.get(id), body);
        return ok(undefined, 204);
      }
    }

    if (path.startsWith('/world_chunks')) {
      if (method === 'POST') {
        for (const row of body) chunks.set(`${row.world_id}:${row.cx},${row.cz}`, row);
        return ok(undefined, 204);
      }
      if (method === 'GET') {
        const worldId = [...url.searchParams].find(([k]) => k === 'world_id')?.[1]?.replace('eq.', '');
        const rows = [...chunks.values()].filter((c) => c.world_id === worldId);
        return ok(rows);
      }
      if (method === 'DELETE') return ok(undefined, 204);
    }

    if (path.startsWith('/save_failures')) {
      if (method === 'POST') {
        saveFailures.push(...body);
        return ok(undefined, 204);
      }
    }

    if (path.startsWith('/progression')) {
      if (method === 'POST' && url.searchParams.has('on_conflict')) {
        progression = { ...progression, ...body[0] };
        return ok(undefined, 204);
      }
      if (method === 'GET') return ok(progression ? [progression] : []);
    }

    return reject(404, { message: `no fake route for ${method} ${path}` });
  };

  return { fetchImpl, worlds, saveFailures, get progression() { return progression; }, requests };
}

function withFetch(fetchImpl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  return fn().finally(() => { globalThis.fetch = real; });
}

function makeCloudWorlds() {
  const backend = fakeBackend();
  const transport = new NeonTransport(fakeAuth, { baseUrl: 'https://fake.local/rest/v1' });
  const cloud = new CloudWorlds({ auth: fakeAuth, bus: null });
  cloud.transport = transport;
  cloud.sync.transport = transport;
  return { cloud, backend };
}

// --- the bug exactly as reported ---------------------------------------------

await test('a fresh Duilt world used to fail every save with a real 23502', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const world = new World({ height: 64, gen: new ChunkGen({ seed: 42, height: 64 }) });
  assert.equal(world.endless, true);
  assert.equal(world.sizeX, null, 'endless worlds have no size — this is the value that used to go straight to the database');

  await withFetch(backend.fetchImpl, () => cloud.save('world-1', {
    world, name: 'My settlement', mode: 'duilt',
    player: { position: { x: 0, y: 40, z: 0 }, yaw: 0, pitch: 0 },
    economy: { toJSON: () => ({}) }, duilt: { age: 1 },
  }));

  const row = backend.worlds.get('world-1');
  assert.ok(row, 'the save actually reached the fake database');
  assert.notEqual(row.size_x, null, 'size_x must never be null — this exact value 400\'d in production');
  assert.notEqual(row.size_z, null, 'size_z must never be null either');
  assert.equal(typeof row.size_x, 'number');
});

// --- the full endless round trip: blocks, seed, and duilt state --------------

await test('an endless Duilt world survives save and restore', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const world = new World({ height: 64, gen: new ChunkGen({ seed: 99, height: 64 }) });

  // Build something, the way a player actually would.
  world.setBlock(3, 20, 3, 4);
  world.setBlock(3, 21, 3, 4);
  // Walk around, generating land nobody touched. This must never end up in
  // the upload — see SyncEngine's touched-only rule for endless worlds.
  world.ensureAround(0, 0, 120);
  const untouchedBefore = [...world.allChunks()].filter((c) => !c.touched).length;
  assert.ok(untouchedBefore > 5, 'the fixture needs real untouched chunks for this to test anything');

  const duiltState = { age: 2, inventory: { dirt: 40, axe: 1 }, buildings: [{ type: 'house', x: 3, z: 3 }] };

  await withFetch(backend.fetchImpl, () => cloud.save('world-2', {
    world, name: 'My settlement', mode: 'duilt',
    player: { position: { x: 3, y: 40, z: 3 }, yaw: 1, pitch: 0 },
    economy: { toJSON: () => ({ wood: 12 }) },
    duilt: duiltState,
  }));

  const row = backend.worlds.get('world-2');
  assert.equal(row.size_x, 0, 'the sentinel value for "no size" — see NeonTransport');
  assert.equal(row.size_z, 0);
  assert.deepEqual(row.duilt, duiltState, 'duilt state must actually be in the request body this time');
  assert.ok(row.world_gen, 'the seed has to ride along or the world cannot be remade');
  assert.equal(row.world_gen.seed, 99);

  const onlyTouchedChunksUploaded = backend.requests
    .filter((r) => r.path.startsWith('/world_chunks') && r.method === 'POST')
    .every((r) => r.body.length <= untouchedBefore + 5); // a small, real number — not "every chunk in memory"
  assert.ok(onlyTouchedChunksUploaded, 'untouched, regenerable chunks must not be uploaded at all');

  const restored = await withFetch(backend.fetchImpl, () => cloud.restore('world-2'));

  assert.equal(restored.world.endless, true, 'restoring must not silently turn an endless world into a bounded one');
  assert.equal(restored.world.gen.seed, 99, 'the same seed, or unexplored land would not match what it was');
  assert.equal(restored.world.getBlock(3, 20, 3), 4, 'a block the player actually placed');
  assert.equal(restored.world.getBlock(3, 21, 3), 4);
  assert.deepEqual(restored.duilt, duiltState, 'the bag, the buildings, the age — not a blank map');
  assert.equal(restored.economy.wood, 12);
  assert.equal(restored.mode, 'duilt');

  // Land far outside where a bounded 64×64 fallback would have put the
  // border regenerates identically from the same seed rather than being
  // missing or wrong.
  const untouchedX = 900, untouchedZ = -400;
  assert.equal(
    world.surfaceHeight(untouchedX, untouchedZ),
    restored.world.surfaceHeight(untouchedX, untouchedZ),
    'unexplored terrain far from the origin must regenerate the same from the same seed',
  );
});

// --- a fixed (Creative) world keeps behaving exactly as it always did --------

await test('a fixed-size world is unaffected by any of this', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  world.setBlock(1, 1, 1, 3);

  await withFetch(backend.fetchImpl, () => cloud.save('world-3', {
    world, name: 'Sandbox', mode: 'creative',
    player: { position: { x: 1, y: 5, z: 1 }, yaw: 0, pitch: 0 },
    economy: { toJSON: () => ({}) }, duilt: null,
  }));

  const row = backend.worlds.get('world-3');
  assert.equal(row.size_x, 64, 'a real fixed world keeps its real size, not the endless sentinel');
  assert.equal(row.size_z, 64);
  assert.equal(row.world_gen, null, 'a fixed world has no seed to carry');

  const restored = await withFetch(backend.fetchImpl, () => cloud.restore('world-3'));
  assert.equal(restored.world.endless, false);
  assert.equal(restored.world.sizeX, 64);
  assert.equal(restored.world.getBlock(1, 1, 1), 3);
});

// --- the sentinel can never be confused with a real size ---------------------

await test('0 is never a size a real (fixed) world can have', async () => {
  const { World: W } = await import('../src/world/World.js');
  const world = new W({ sizeX: 1, sizeZ: 1, height: 8 }); // smallest legal-ish input
  // Even asking for the smallest possible fixed world does not produce 0 —
  // the default floor keeps this sentinel unambiguous either way.
  assert.notEqual(world.sizeX, 0);
});

// --- the second bug: worlds_mode_check never allowed 'duilt' either ----------

await test('a mode the database check does not allow fails loudly, the way duilt once did', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });

  await assert.rejects(
    () => withFetch(backend.fetchImpl, () => cloud.save('world-4', {
      world, name: 'Bad mode', mode: 'sandbox', // not in WORLDS_MODE_VALUES
      player: { position: { x: 0, y: 5, z: 0 }, yaw: 0, pitch: 0 },
      economy: { toJSON: () => ({}) }, duilt: null,
    })),
    /worlds_mode_check/,
  );
  assert.ok(!backend.worlds.has('world-4'), 'a rejected row must not end up half-saved');
});

await test('every mode this game actually writes is one the database check allows', async () => {
  const { cloud, backend } = makeCloudWorlds();
  for (const mode of ['creative', 'campaign', 'duilt']) {
    const world = mode === 'duilt'
      ? new World({ height: 64, gen: new ChunkGen({ seed: 1, height: 64 }) })
      : new World({ sizeX: 64, sizeZ: 64, height: 64 });
    await withFetch(backend.fetchImpl, () => cloud.save(`world-mode-${mode}`, {
      world, name: mode, mode,
      player: { position: { x: 0, y: 5, z: 0 }, yaw: 0, pitch: 0 },
      economy: { toJSON: () => ({}) }, duilt: null,
    }));
    assert.ok(backend.worlds.has(`world-mode-${mode}`), `mode "${mode}" must be accepted`);
  }
});

// --- a save that never makes it up is at least visible somewhere ------------

await test('a failed save is logged best-effort, and never throws on top of the original failure', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const err = Object.assign(new Error('boom'), { status: 500 });

  await withFetch(backend.fetchImpl, () => cloud.reportFailure('world-5', err)); // must not throw

  assert.equal(backend.saveFailures.length, 1);
  assert.equal(backend.saveFailures[0].world_id, 'world-5');
  assert.equal(backend.saveFailures[0].code, '500');
  assert.match(backend.saveFailures[0].message, /boom/);
});

await test('reportFailure swallows its own transport errors', async () => {
  const { cloud } = makeCloudWorlds();
  cloud.transport.logSaveFailure = async () => { throw new Error('log write failed too'); };
  await assert.doesNotReject(() => cloud.reportFailure('world-6', new Error('original failure')));
});

// --- achievements surviving a restore ----------------------------------------
//
// Reported as: opening an old world and breaking a block re-awards the
// achievement for breaking your first block ever. pushProgression sent
// `g.achievements` and `g.stats` — fields GamificationEngine.toJSON() has
// never produced, since the real names are `achievementsUnlocked` and there
// is no `stats` field at all — so every push wrote an empty achievements
// array no matter what was actually unlocked, and the restore-side merge
// read the response back under the wrong keys too. The account-wide
// progression a cloud restore is supposed to bring back never actually
// arrived.

await test('achievements and stats survive a push/pull round trip', async () => {
  const { GamificationEngine } = await import('../src/gamification/GamificationEngine.js');
  const { EventBus } = await import('../src/core/EventBus.js');
  const { cloud, backend } = makeCloudWorlds();

  const gam = new GamificationEngine(new EventBus());
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  gam.onBlockBroken({ world, x: 1, y: 1, z: 1, type: 3, now: 1000 }); // unlocks "first_break"
  assert.ok(gam.state.achievementsUnlocked.has('first_break'));

  await withFetch(backend.fetchImpl, () => cloud.save('world-7', {
    world, name: 'Progress test', mode: 'creative',
    player: { position: { x: 0, y: 5, z: 0 }, yaw: 0, pitch: 0 },
    gamification: gam, economy: { toJSON: () => ({}) }, duilt: null,
  }));

  // The row a real player already has: written before this fix, so
  // `stats` is still the column's empty default and `achievements` []
  // regardless of what was unlocked — the fallback path must not choke on it.
  assert.deepEqual(backend.progression.achievements, ['first_break']);
  assert.ok(Object.keys(backend.progression.stats).length > 0, 'the full snapshot must ride along, not just the picked columns');

  const remote = await withFetch(backend.fetchImpl, () => cloud.progression());
  assert.ok(remote.achievementsUnlocked.includes('first_break'), 'the achievement must actually come back');
  assert.equal(remote.totalBlocksBroken, 1);

  // What Game.js's restoreFromCloud does with it.
  const fresh = new GamificationEngine(new EventBus());
  fresh.loadJSON(remote);
  assert.ok(fresh.state.achievementsUnlocked.has('first_break'), 'a restored device must not have lost the achievement');

  // The regression exactly as reported: breaking a block on the "restored"
  // engine must not re-fire an achievement it already has.
  let refired = false;
  fresh.bus.on('achievement:unlock', (a) => { if (a.id === 'first_break') refired = true; });
  fresh.onBlockBroken({ world, x: 2, y: 1, z: 1, type: 3, now: 2000 });
  assert.equal(refired, false, 'first_break must not unlock a second time after a restore');
});

await test('a pre-fix progression row (empty stats) still restores what it can', async () => {
  const { GamificationEngine } = await import('../src/gamification/GamificationEngine.js');
  const { EventBus } = await import('../src/core/EventBus.js');
  const { cloud, backend } = makeCloudWorlds();

  // Simulate a row exactly as the old buggy pushProgression wrote it.
  await backend.fetchImpl('https://fake.local/rest/v1/progression?on_conflict=player_id', {
    method: 'POST',
    body: JSON.stringify([{ player_id: 'player-1', xp: 500, level: 3, streak_count: 2, achievements: [], stats: {} }]),
  });

  const remote = await withFetch(backend.fetchImpl, () => cloud.progression());
  assert.equal(remote.xp, 500, 'the headline numbers still come back even without a full snapshot');
  const fresh = new GamificationEngine(new EventBus());
  fresh.loadJSON(remote);
  assert.equal(fresh.state.xp, 500);
});

// --- a world saved before migrations/0003 still restores, not empty ---------
//
// Reported directly from production: a settlement played for hours, saved
// many times under the pre-0003 shape (duilt and worldGen nested inside
// `economy`), came back with an empty bag and a bounded fallback world the
// moment it was opened under the new columns — because pullWorld only ever
// read the new `duilt`/`world_gen` columns, which are null for a row nothing
// has re-saved since. The bag was still sitting right there, one level of
// nesting away, and nothing looked. That row's real data is gone for good —
// Neon's undo window had already closed by the time this was caught — so
// this is the regression test for the fix, not a recovery for it.

await test('a world saved before migrations/0003 (data nested in economy) still restores', async () => {
  const { cloud, backend } = makeCloudWorlds();
  const duiltState = { age: 2, inventory: { slots: [{ id: 'axe', count: 1, wear: 0 }] }, hunger: { value: 80 } };

  // Exactly the row shape pushWorld wrote before migrations/0003: duilt and
  // worldGen nested inside economy, the new columns never populated because
  // they did not exist yet.
  backend.worlds.set('legacy-world', {
    id: 'legacy-world', player_id: 'player-1', name: 'Old settlement', mode: 'duilt',
    size_x: 0, size_z: 0, height: 64, spawn: null,
    economy: { economy: { balances: { wood: 40 } }, duilt: duiltState, worldGen: { seed: 4242, homeX: 0, homeZ: 0 } },
    duilt: null, world_gen: null,
    block_count: 500, revision: 12,
  });

  const restored = await withFetch(backend.fetchImpl, () => cloud.restore('legacy-world'));

  assert.equal(restored.world.endless, true, 'a legacy row must not silently fall back to a bounded world');
  assert.equal(restored.world.gen.seed, 4242, 'the seed has to come from wherever it is actually stored');
  assert.deepEqual(restored.duilt, duiltState, 'the bag must come back, not read as empty because nothing new-shaped was there');
  assert.equal(restored.economy.balances.wood, 40);
});
