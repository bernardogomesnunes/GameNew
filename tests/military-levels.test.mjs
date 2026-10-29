// IMP-2 and IMP-3: "update the building and allow to create more, remove the
// number of beds logic", and the same rule for the Garrison.
// Decided 29 October: 10, 20 and 40 soldiers for levels 1 to 3.
import { World } from '../src/world/World.js';
import { Defenders, MAX_SOLDIERS } from '../src/world/Defenders.js';
import { SOLDIER_CAPS, soldierCap } from '../src/config/soldiers.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { readFileSync } from 'node:fs';

let failed = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) failed++; };

ok('levels hold 10, 20 and 40', SOLDIER_CAPS.join() === '10,20,40' && MAX_SOLDIERS === 40);
ok('a building with no level yet holds ten', soldierCap({}) === 10 && soldierCap(null) === 10);

for (const id of ['barracks', 'military']) {
  const spec = STRUCTURES_BY_ID.get(id);
  ok(`${id} has three levels, the first needing nothing`, spec.tiers.length === 3 && spec.tiers[0].needs.length === 0);
  ok(`${id} no longer asks for beds`, !spec.requires.some((r) => r.id === 'bunks'));
  ok(`${id}'s upgrades cost something and ask for more of what it already has`, spec.tiers.slice(1).every((t) => t.cost && t.needs.length >= 1));
}

// With no beds anywhere, a barracks forms up as many as its level allows.
{
  const world = new World({ sizeX: 80, sizeZ: 80, height: 32 });
  for (let x = 0; x < 80; x++) for (let z = 0; z < 80; z++) world.setBlock(x, 0, z, 3);
  const region = { minX: 30, maxX: 40, minY: 1, maxY: 6, minZ: 30, maxZ: 40 };
  const rng = () => 0.5;
  for (const [tier, held] of [[0, 10], [1, 20], [2, 40]]) {
    const d = new Defenders({ world, rand: rng });
    const post = [{ id: 1, type: 'barracks', region, valid: true, cap: SOLDIER_CAPS[tier] }];
    d.sync(post, 0);
    for (let i = 0; i < 40; i++) d.order(1, 'warrior', 0);
    d.sync(post, 100);
    ok(`level ${tier + 1}: ${held} stand outside, from a queue of forty, with no beds`, d.soldiers.length === held);
    ok(`level ${tier + 1}: they stay in front of the building`, d.soldiers.every((s) => s.z < region.minZ));
  }
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('the game no longer counts beds', !/bedsIn/.test(game));

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
