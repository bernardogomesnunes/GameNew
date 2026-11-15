import assert from 'node:assert/strict';
import { Mobs } from '../src/world/Mobs.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { DRAGON_SCALE, DRAGON_CLAW } from '../src/config/blocks.js';
import { RECIPES } from '../src/config/recipes.js';
import { LOOT } from '../src/duilt/Loot.js';
import { landmarkDesigns } from '../src/world/landmarks.js';
import { readFileSync } from 'node:fs';

// IMP-45 (owner, 9 November): bigger dragons, fire, nests, scales and claws, the Dragon Axe.
const elder = MOBS_BY_ID.get('elder_dragon');
assert.ok(elder.body.l >= 8.5 && elder.head >= 3, 'the Elder Dragon is half as big again, with a big head');
for (const id of ['elder_dragon', 'fire_drake', 'frost_wyvern', 'storm_dragon']) {
  const s = MOBS_BY_ID.get(id);
  assert.ok(s.breath?.damage > 0 && s.sheds?.dragon_scale, `${id} breathes fire and sheds scales`);
  assert.deepEqual(s.biomes, [], `${id} lives only at a nest`);
}
console.log('PASS every dragon breathes fire, sheds, and keeps to a nest');

{
  const world = { getBlock: () => 0, surfaceHeight: () => 10, height: 64, collisionBoxAt: () => null, hasChunk: () => true, biomeIndex: () => 0 };
  const hurt = [];
  const mobs = new Mobs({ world, rand: () => 0.5, onBreath: (m, d) => hurt.push(d) });
  mobs.nests = [{ key: 'n1', x: 0, y: 10, z: 0, type: 'fire_drake' }];
  const player = { x: 5, y: 12, z: 5 };
  mobs.tendNests(player, 0);
  assert.equal(mobs.list.filter((m) => m.nest === 'n1').length, 1, 'a near nest gets its dragon');
  mobs.tendNests(player, 0);
  assert.equal(mobs.list.length, 1, 'only one');
  const d = mobs.list[0];
  d.breathIn = 0; d.y = player.y + 4;
  mobs.fly(d, 0.1, player);
  assert.equal(hurt[0], 3, 'within reach it breathes fire on you');
  assert.ok(d.breathing > 0 && d.breathAt, 'and the flames have somewhere to go');
  mobs.hit(d, 9999, 0, 0);
  d.dead = true; mobs.list.length = 0;
  mobs.tendNests(player, Date.now());
  assert.equal(mobs.list.length, 0, 'a slain nest dragon is a while coming back');
  console.log('PASS a nest keeps one dragon, which breathes fire and comes back only after a while');
}

assert.equal(ITEM_FOR_BLOCK.get(DRAGON_SCALE), 'dragon_scale');
assert.equal(ITEM_FOR_BLOCK.get(DRAGON_CLAW), 'dragon_claw');
const axe = RECIPES.find((r) => r.output.id === 'dragon_axe');
assert.ok(axe.inputs.dragon_scale > 0 && axe.inputs.dragon_claw > 0, 'the axe is made from scales and claws');
assert.equal(ITEMS_BY_ID.get('dragon_axe').kind, 'tool');
assert.ok(LOOT.dragon_nest.items.some(([id, chance]) => id === 'dragon_relic' && chance === 1), 'every hoard holds the relic');
assert.ok(landmarkDesigns().some((d) => d.kind === 'dragon_nest' && d.blocks.some((b) => b[3] === 13)), 'a nest has gold in it');
console.log('PASS scales and claws are blocks you break to pick up; the axe, the hoard and the relic');

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
assert.ok(/tool\?\.id === 'dragon_axe' && target && !target\.god\) return DRAGON_AXE_BLOW/.test(game), 'one blow, but not a god');
assert.ok(/regen: this\.selectedItemId === 'dragon_axe'/.test(game), 'held, you heal without eating');
console.log('PASS the Dragon Axe fells anything but a god, and heals you while held');
