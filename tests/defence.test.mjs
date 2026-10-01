import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';
import { BLOCKS_BY_ID, WEAPON_RACK, TRAINING_DUMMY, ARCHERY_TARGET, roofPart } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { Defenders, SOLDIER, TRAIN_DAYS, MAX_SOLDIERS } from '../src/world/Defenders.js';
import { Wanderers } from '../src/world/Wanderers.js';

/**
 * The defence buildings (White path), asked for as "detailed": a wall, a
 * gatehouse, a watchtower and a barracks, each drawn properly and each
 * doing something in the war.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const KINDS = ['wall', 'gatehouse', 'watchtower', 'barracks'];

/** A flat world with a design stamped in it; returns the world and the design's region. */
function stamped(id, at = { x: 40, y: 4, z: 40 }) {
  const world = new World({ sizeX: 128, sizeZ: 128, height: 48 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 0; y < at.y; y++) world.setBlock(x, y, z, 3);
  const d = DESIGN_FOR_STRUCTURE.get(id);
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, b.type);
  return { world, region: { minX: at.x, maxX: at.x + d.extent.x, minY: at.y, maxY: at.y + d.extent.y, minZ: at.z, maxZ: at.z + d.extent.z } };
}

// --- the buildings ----------------------------------------------------------------------------

for (const id of KINDS) {
  const spec = STRUCTURES_BY_ID.get(id);
  ok(`${spec?.name}: from Age 5, before the war comes`, spec?.age === 5);
  const d = DESIGN_FOR_STRUCTURE.get(id);
  const kinds = new Set(d.blocks.map((b) => BLOCKS_BY_ID.get(b.type)?.stateOf ?? b.type));
  ok(`  a detailed design: ${d.blocks.length} blocks of ${kinds.size} kinds`, d.blocks.length > 200 && kinds.size >= 8);
  const { world, region } = stamped(id);
  const v = validateStructure(world, region, id);
  ok(`  and it stands as one (${v.reason})`, v.ok);
}
{
  const wall = DESIGN_FOR_STRUCTURE.get('wall');
  ok('the wall: battlements, arrow slits, a walk with a stair up to it',
    wall.blocks.some((b) => b.dy === 5) && wall.blocks.some((b) => b.type === 162) && wall.blocks.filter((b) => BLOCKS_BY_ID.get(b.type)?.shape === 'stair').length >= 3);
  const gate = DESIGN_FOR_STRUCTURE.get('gatehouse');
  ok('the gatehouse: a gate of three doors, guardrooms with doors of their own, banners and lanterns',
    gate.blocks.filter((b) => b.type >= 69 && b.type <= 84).length >= 10 && gate.blocks.some((b) => b.type >= 182 && b.type <= 185) && gate.blocks.some((b) => b.type === 26));
  const tower = DESIGN_FOR_STRUCTURE.get('watchtower');
  ok('the watchtower: a winding stair, a lookout, a roof, a signal lantern',
    tower.blocks.filter((b) => BLOCKS_BY_ID.get(b.type)?.shape === 'stair').length >= 11 && tower.blocks.some((b) => roofPart(b.type)) && tower.extent.y >= 15);
  const barracks = DESIGN_FOR_STRUCTURE.get('barracks');
  const has = (lo, n) => barracks.blocks.filter((b) => b.type >= lo && b.type < lo + 4).length >= n;
  ok('the barracks: six bunks, racks of arms, dummies and targets in a fenced yard, a mess table',
    has(193, 6) && has(WEAPON_RACK, 4) && has(TRAINING_DUMMY, 2) && has(ARCHERY_TARGET, 2) && barracks.blocks.some((b) => b.type === 47) && barracks.blocks.some((b) => b.type === 31));
}
{
  // The rules ask for what makes each what it is, and say what's missing.
  const { world, region } = stamped('wall');
  for (let x = region.minX; x <= region.maxX; x++) world.setBlock(x, region.maxY, region.minZ, 0);
  ok('a wall with no battlements isn\'t one, and says so', /battlements/.test(validateStructure(world, region, 'wall').reason));
  const b = stamped('barracks');
  for (let x = b.region.minX; x <= b.region.maxX; x++) for (let y = b.region.minY; y <= b.region.maxY; y++) for (let z = b.region.minZ; z <= b.region.maxZ; z++) {
    const id = b.world.getBlock(x, y, z);
    if (id >= WEAPON_RACK && id < WEAPON_RACK + 4) b.world.setBlock(x, y, z, 0);
  }
  ok('a barracks with no arms isn\'t one, and says so', /weapon rack/.test(validateStructure(b.world, b.region, 'barracks').reason));
}

// --- the furnishings ----------------------------------------------------------------------------

for (const [block, shape] of [[WEAPON_RACK, 'weapon_rack'], [TRAINING_DUMMY, 'training_dummy'], [ARCHERY_TARGET, 'archery_target']]) {
  const item = ITEMS_BY_ID.get(ITEM_FOR_BLOCK.get(block));
  ok(`${item?.name}: modelled (${PROP_SHAPES[shape]?.length} pieces), turned four ways, made at the bench, drawn in the bag`,
    PROP_SHAPES[shape]?.length >= 12 && BLOCKS_BY_ID.get(block + 3)?.stateOf === block
    && RECIPES.some((r) => r.output.id === item.id && r.station === 'hand') && (itemIcon(item) ?? '').includes('<svg'));
}

// --- the soldiers and the archers ----------------------------------------------------------------

{
  const { world, region } = stamped('barracks');
  const tw = DESIGN_FOR_STRUCTURE.get('watchtower');
  const towerAt = { x: 80, y: 4, z: 40 };
  for (const b of tw.blocks) world.setBlock(towerAt.x + b.dx, towerAt.y + b.dy, towerAt.z + b.dz, b.type);
  const tower = { minX: towerAt.x, maxX: towerAt.x + tw.extent.x, minY: towerAt.y, maxY: towerAt.y + tw.extent.y, minZ: towerAt.z, maxZ: towerAt.z + tw.extent.z };
  const posts = [
    // Number ids, as StructureRegistry gives them.
    { id: 1, type: 'barracks', region, valid: true, beds: 6 },
    { id: 2, type: 'watchtower', region: tower, valid: true },
  ];
  const d = new Defenders({ world, rand: rng(1) });
  d.sync(posts, 0);
  ok('a new barracks has trained nobody yet', d.soldiers.length === 0);
  ok('a watchtower has its two archers at once', d.archers.length === 2);
  ok(`  up on the lookout, not on the roof (y ${d.archers[0].y - towerAt.y} of ${tw.extent.y})`, d.archers.every((a) => a.y - towerAt.y === 12));
  d.sync(posts, TRAIN_DAYS * 2.5);
  ok(`a soldier every ${TRAIN_DAYS} of a day (${d.soldiers.length} after ${TRAIN_DAYS * 2.5})`, d.soldiers.length === 2);
  d.sync(posts, 10);
  ok(`up to a soldier a bunk, ${MAX_SOLDIERS} at most`, d.soldiers.length === 6);
  ok('formed up outside the barracks, in front of it', d.soldiers.every((s) => s.z < region.minZ && s.x >= region.minX - 3 && s.x <= region.maxX + 3));

  // An enemy comes near: the soldiers go for it, the archers shoot.
  const enemy = { x: region.minX + 6, y: 4, z: region.minZ - 14, hp: 999, name: 'Rook' };
  const blows = [], shots = [];
  const before = d.soldiers.map((s) => Math.hypot(s.x - enemy.x, s.z - enemy.z));
  for (let i = 0; i < 200; i++) d.tick(0.05, [enemy], { strike: (e, n, by) => blows.push(by), shot: (e, n, by) => shots.push(by) });
  const after = d.soldiers.map((s) => Math.hypot(s.x - enemy.x, s.z - enemy.z));
  ok(`soldiers march out to it (nearest ${Math.min(...before).toFixed(1)} → ${Math.min(...after).toFixed(1)})`, Math.min(...after) < 2.5);
  ok(`and fight it (${blows.length} blows in 10 s)`, blows.length >= 6 && blows.every((b) => b.kind === 'soldier'));
  const far = { x: towerAt.x + 3, y: 4, z: towerAt.z - 18, hp: 999, name: 'Saba' };
  for (let i = 0; i < 200; i++) d.tick(0.05, [far], { shot: (e, n, by) => shots.push({ e, by }) });
  ok(`the tower's archers shoot what comes in range (${shots.length} arrows home in 10 s)`, shots.length >= 4 && shots.every((s) => s.by.kind === 'archer' && s.e === far));
  // It's gone: back to their posts.
  for (let i = 0; i < 400; i++) d.tick(0.05, [], {});
  ok('nothing left to fight, they go back to their posts', d.soldiers.every((s) => Math.hypot(s.x - s.post.x, s.z - s.post.z) < 0.6));

  // A soldier falls: the barracks trains another.
  const s0 = d.soldiers[0];
  ok('a soldier can be beaten', d.hurt(s0, 99) && d.trained['1'].count === 5);
  d.tick(0.05, [], {});
  ok('and is gone', !d.soldiers.includes(s0));
  d.sync(posts, 10 + TRAIN_DAYS);
  ok('and the barracks trains another', d.soldiers.length === 6);

  // Saved with the world.
  const back = new Defenders({ world });
  back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
  back.sync(posts, 10 + TRAIN_DAYS);
  ok('saved: the same soldiers are there when you come back', back.soldiers.length === 6);
  d.sync(posts.map((p) => (p.id === 1 ? { ...p, valid: false } : p)), 11);
  ok('the barracks broken, its soldiers are gone', d.soldiers.length === 0 && !d.trained['1']);

  // A raider meets your soldier on the way in: it fights the soldier.
  const hits = [];
  const w = new Wanderers({ world, rand: rng(3), foes: () => d2.soldiers, onFoe: (p, s, n) => hits.push(s), onAttack: () => hits.push('you') });
  w.untilMessenger = w.untilExplorer = 1e9;
  const d2 = new Defenders({ world, rand: rng(2) });
  d2.sync(posts, 0);
  d2.sync(posts, 10);
  const target = d2.soldiers[0];
  const [raider] = w.sendWarband({ x: target.x, z: target.z + 1 }, { x: target.x, z: -1000 }, 4, [['soldier', 1]], 7);
  for (let i = 0; i < 400 && !hits.length; i++) { w.tick(0.05, { x: 120, y: 4, z: 120 }); d2.tick(0.05, [raider], {}); }
  ok('a raider fights the soldier in its way, not you far off', hits.length && hits[0] !== 'you' && d2.soldiers.includes(hits[0]));
}

// --- in the game -----------------------------------------------------------------------------------

ok('claimed defences are built to take it: three blows a block', /const REINFORCED = 3;/.test(game)
  && /STRUCTURES_BY_ID\.get\(s\.type\)\?\.defence[\s\S]{0,300}blows < REINFORCED/.test(game));
ok('  for the wall, the gatehouse and the watchtower', KINDS.slice(0, 3).every((k) => STRUCTURES_BY_ID.get(k).defence) && !STRUCTURES_BY_ID.get('barracks').defence);
ok('a gatehouse shuts its gate when a round is coming', /if \(what === 'warn'\) \{\s*const shut = this\.shutGates\(\)/.test(game) && /doorBlock\(\{ \.\.\.part, open: false \}\)/.test(game));
ok('the soldiers and archers run every frame, and are drawn', /this\.tickWar\(\);\s*this\.tickDefence\(dt\);/.test(game) && /this\.defenderView\.update\(ours\?\.people/.test(game));
ok('a barracks is as big as its bunks', /beds: s\.type === 'barracks' \? this\.bedsIn\(s\.region\) : 0/.test(game));
ok('raiders fight your soldiers, and a soldier can fall', /foes: \(\) => this\.duilt\?\.defenders\.soldiers/.test(game) && /One of your soldiers has fallen/.test(game));

process.exit(f ? 1 : 0);
