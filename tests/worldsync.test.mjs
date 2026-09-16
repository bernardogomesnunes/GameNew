import {
  decide, mergeWorldList, SyncState,
  PUSH, PULL, IN_SYNC, CONFLICT, LOCAL_ONLY, CLOUD_ONLY,
} from '../src/storage/WorldSync.js';

/**
 * Same account, two devices, one set of worlds.
 *
 * Worlds were saved to whichever browser you were sitting at, and the cloud
 * was an opt-in question at creation plus a button nobody presses. Signed in
 * on a phone and a desktop, you got two separate piles of worlds under one
 * account — which is the bug.
 *
 * The risky half of fixing it is not the uploading, it is deciding whose copy
 * wins, because getting that wrong deletes an afternoon. These are the cases
 * that has to survive, and the one that matters most is the last:
 * two devices that both played and neither silently losing.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const act = (o) => decide(o).action;

// --- one world, two places ----------------------------------------------------

ok('a world this device has and the account does not goes up',
  act({ local: { changedAt: 100 }, cloud: null }) === PUSH);

ok('a world on the account this device has never seen comes down',
  act({ local: null, cloud: { revision: 3 } }) === CLOUD_ONLY);

ok('a world nobody has is nothing to do',
  act({ local: null, cloud: null }) === IN_SYNC);

// The agreement is the whole mechanism: what this device and the server last
// shook hands on. Timestamps across two devices cannot be compared — their
// clocks disagree — so the comparison is a revision the server alone issues.
ok('untouched here, moved on there: we are behind, so pull',
  act({ local: { changedAt: 100 }, cloud: { revision: 5 }, agreed: { revision: 4, at: 100 } }) === PULL);

ok('touched here, unmoved there: we are ahead, so push',
  act({ local: { changedAt: 200 }, cloud: { revision: 4 }, agreed: { revision: 4, at: 100 } }) === PUSH);

ok('neither moved: leave it alone',
  act({ local: { changedAt: 100 }, cloud: { revision: 4 }, agreed: { revision: 4, at: 100 } }) === IN_SYNC);

// --- the one that must never guess --------------------------------------------

// This is the case the whole file exists for. Play on the phone, play on the
// desktop, and *any* automatic answer throws away one of the two afternoons.
{
  const both = decide({
    local: { changedAt: 500 },
    cloud: { revision: 6, updatedAt: 400 },
    agreed: { revision: 4, at: 100 },
  });
  ok('played in both places is a conflict, not a winner', both.action === CONFLICT);
  ok('and it hands over both copies so the player can be asked',
    both.local?.changedAt === 500 && both.cloud?.revision === 6);
  ok('and says what happened in words', /another device/.test(both.why));
}

// A newer local timestamp must not be allowed to win on its own — that is
// exactly the "my phone world got overwritten by my desktop" failure.
ok('a local copy being newer by the clock does not beat an unseen cloud revision',
  act({
    local: { changedAt: 9_999_999 },
    cloud: { revision: 9, updatedAt: 1 },
    agreed: { revision: 2, at: 9_999_998 },
  }) === CONFLICT);

// And with no agreement at all we assume both sides matter, rather than
// assuming ours does not.
ok('never having synced counts as having something worth keeping',
  act({ local: { changedAt: 1 }, cloud: { revision: 1 } }) === CONFLICT);

// --- deleting somewhere else --------------------------------------------------

// Re-uploading a world somebody binned on their other device is the same bug
// as losing one, pointing the other way.
ok('a world deleted on the account is not sent back up',
  act({ local: { changedAt: 500 }, cloud: null, agreed: { revision: 3, at: 100 } }) === LOCAL_ONLY);
ok('but one that was never up there still goes up',
  act({ local: { changedAt: 500 }, cloud: null, agreed: null }) === PUSH);

// --- one list, not two --------------------------------------------------------

// The worlds screen drew the local saves, then a separate "On your account"
// list of the ones it could not find locally. A world you have in both places
// is one world, and it looked like two.
{
  // Local rows are what SaveManager.list() hands over: one record per world,
  // under the id the world was born with.
  const local = [
    { id: 'a', name: 'Riverbend', at: 500, mode: 'duilt', age: 2 },
    { id: 'b', name: 'Old town', at: 300, mode: 'duilt' },
  ];
  const cloud = [
    { id: 'a', name: 'Riverbend', revision: 4, updatedAt: 450, mode: 'duilt' },
    { id: 'c', name: 'Phone world', revision: 2, updatedAt: 900, mode: 'duilt' },
  ];
  const agreed = { a: { revision: 4, at: 500 }, b: { revision: 1, at: 300 } };
  const rows = mergeWorldList({
    local, cloud, lastOpened: 'a', agreedFor: (id) => agreed[id] ?? null,
  });

  ok(`three worlds across both places, not four (${rows.length})`, rows.length === 3);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  ok('the one in both places appears once', by.a.here && by.a.onAccount);
  ok('and is settled, having moved nowhere', by.a.action === IN_SYNC);
  ok('the one only here says so', by.b.here && !by.b.onAccount);
  ok('the one only on the account says so', !by.c.here && by.c.onAccount);
  ok('and offers to come down', by.c.action === CLOUD_ONLY);
  ok('every row can be opened, because every row has an id', rows.every((r) => !!r.id));

  ok('the world you were last in comes first', rows[0].id === 'a' && rows[0].isLast);
  ok('and only that one is marked as such', rows.filter((r) => r.isLast).length === 1);
  const rest = rows.slice(1).map((r) => Math.max(r.changedAt ?? 0, r.cloudAt ?? 0));
  ok('and the rest are newest first, wherever they were touched',
    rest.every((v, i) => i === 0 || rest[i - 1] >= v));
}

// A world on the account and edited here since the handshake wants sending.
{
  const rows = mergeWorldList({
    local: [{ id: 'a', name: 'W', at: 900 }],
    cloud: [{ id: 'a', name: 'W', revision: 3, updatedAt: 400 }],
    agreedFor: () => ({ revision: 3, at: 500 }),
  });
  ok('a world played here since the last sync is due to go up', rows[0].action === PUSH);
}

// --- opening a world is not playing it ----------------------------------------

/**
 * The bug behind "the same world looks different on my two devices".
 *
 * Leaving a world writes it down. So a device that only opened a world and
 * closed it again had a local save newer than the last handshake, which is
 * indistinguishable from a device that built something — and from then on every
 * difference with the account read as "we both played". That is a conflict, and
 * a conflict is deliberately never resolved on its own, so the stale copy
 * stayed stale forever and no amount of reopening fixed it.
 *
 * The decision asks when the world was last *played*, which only a block
 * changing advances.
 */
{
  const agreed = { revision: 4, at: 1000 };
  // Opened and closed: written at 2000, but nothing was built.
  ok('a world only opened and closed is not ahead of the account',
    act({ local: { changedAt: 0 }, cloud: { revision: 4 }, agreed }) === IN_SYNC);
  ok('and when the account moves on, it simply comes down',
    act({ local: { changedAt: 0 }, cloud: { revision: 5 }, agreed }) === PULL);
  ok('a world actually built in does go up',
    act({ local: { changedAt: 2000 }, cloud: { revision: 4 }, agreed }) === PUSH);
  ok('and built in on both sides is still a conflict',
    act({ local: { changedAt: 2000 }, cloud: { revision: 5 }, agreed }) === CONFLICT);
}

// --- what a device remembers ---------------------------------------------------

{
  const store = new Map();
  const fake = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  const s = new SyncState(fake);
  ok('a world nobody has synced has no agreement', s.agreedFor('a') === null);
  s.agree('a', 7, 1234);
  ok('agreeing records the revision and when', s.agreedFor('a').revision === 7 && s.agreedFor('a').at === 1234);
  ok('and it survives a reload', new SyncState(fake).agreedFor('a').revision === 7);
  s.forget('a');
  ok('forgetting clears it', new SyncState(fake).agreedFor('a') === null);

  // A browser that refuses storage is a private window, not a crash.
  const deaf = { getItem: () => { throw new Error('nope'); }, setItem: () => { throw new Error('nope'); } };
  const d = new SyncState(deaf);
  d.agree('a', 1);
  ok('a browser that refuses storage still runs', d.agreedFor('a').revision === 1);
}

process.exit(f ? 1 : 0);
