import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Magic } from '../src/duilt/Magic.js';
import { Inventory } from '../src/items/Inventory.js';
import { Arrows, BOLT_SPEED } from '../src/world/Arrows.js';
import { WIZARD_QUESTS } from '../src/config/wizardQuests.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { MAGIC_TARGET, MAGIC_CAULDRON, stationOf } from '../src/config/blocks.js';

/** WIZ-5, WAND-1, WAND-2, WAND-4: the quest chain, the wand's bolt, the targets and the cauldron. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// The chain: 8 to 12 quests, in a fixed order, rewards in the order asked for.
ok(`${WIZARD_QUESTS.length} quests (8 to 12)`, WIZARD_QUESTS.length >= 8 && WIZARD_QUESTS.length <= 12);
ok('ids are unique', new Set(WIZARD_QUESTS.map((q) => q.id)).size === WIZARD_QUESTS.length);
const rewards = WIZARD_QUESTS.map((q) => q.reward?.item ?? (q.reward?.recipe ? 'recipe' : null)).filter(Boolean);
ok('the Wand first, the Cauldron second, then only recipes, and the Hat last', rewards[0] === 'wizard_wand' && rewards[1] === 'magic_cauldron' && rewards.slice(2, -1).every((r) => r === 'recipe') && rewards.at(-1) === 'wizard_hat');
ok('it mixes gather, brew, kills, targets and casts', ['bring', 'brew', 'kills', 'targets', 'casts'].every((k) => WIZARD_QUESTS.some((q) => q.kind === k)));
ok('seven potion recipes are taught, one per quest', WIZARD_QUESTS.filter((q) => q.reward?.recipe).length === 7);
ok('every item a quest asks for or gives exists', WIZARD_QUESTS.every((q) => Object.keys(q.items ?? {}).every((id) => ITEMS_BY_ID.has(id)) && (!q.reward?.item || ITEMS_BY_ID.has(q.reward.item))));

// Playing the chain through Magic.
{
  const m = new Magic();
  const inv = new Inventory({ slots: 20 });
  ok('no open quest before the wizard comes', m.current() === null);
  m.arrive(null);
  ok('the first quest is the first in the list', m.current().id === WIZARD_QUESTS[0].id);
  ok('handing in without the items fails and takes nothing', !m.complete(inv).ok && m.chain.step === 0);
  inv.add('mushroom_red', 3); inv.add('leaves', 6);
  ok('counting a kill does nothing to a bring quest', !m.note('kills') && m.progress(inv).ready);
  const r = m.complete(inv);
  ok('quest 1 hands over the wand and its points', r.ok && inv.countOf('wizard_wand') === 1 && m.given.includes('wizard_wand') && m.points === 5);
  ok('and takes the items', inv.countOf('mushroom_red') === 0 && inv.countOf('leaves') === 0);
  ok('quest 2 is next, counted from now', m.current().kind === 'casts' && m.chain.count.casts === undefined);
  for (let i = 0; i < 9; i++) m.note('casts');
  ok('9 casts of 10 is not done', !m.complete(inv).ok);
  m.note('casts');
  ok('10 casts is done', m.complete(inv).ok && m.current().kind === 'targets');
  ok('a cast does not count for a target quest', !m.note('casts'));
  for (let i = 0; i < 5; i++) m.note('targets');
  ok('targets done', m.complete(inv).ok && m.current().id === 'moss_and_stone');
  inv.add('cobblestone', 10); inv.add('clay', 4); inv.add('mushroom_lilac', 2);
  ok('the Cauldron comes at quest 4', m.complete(inv).ok && inv.countOf('magic_cauldron') === 1);
  ok('no recipe is taught yet', m.taught.length === 0);
  for (let i = 0; i < 3; i++) m.note('brew');
  ok('three brews teach night vision', m.complete(inv).ok && m.knows('night_vision') && !m.knows('speed'));
  // Level-gated quests: kills before the level count for nothing.
  while (m.current().kind !== 'brew' || m.current().level !== 3) {
    const q = m.current();
    if (q.kind === 'bring') for (const [id, n] of Object.entries(q.items)) inv.add(id, n);
    else for (let i = 0; i < q.n; i++) m.note(q.kind);
    if (!m.complete(inv).ok) break;
  }
  ok('reached the level-3 brew quest, taught in order', m.current().id === 'fire_in_the_pot' && m.taught.join() === 'night_vision,speed,jump,strength');
  m.points = 0;
  ok('below level 3 brewing counts for nothing', !m.note('brew') && (m.chain.count.brew ?? 0) === 0);
  m.points = 60;
  for (let i = 0; i < 6; i++) m.note('brew');
  ok('at level 3 it counts and completes', m.level >= 3 && m.complete(inv).ok && m.knows('fire'));
  const saved = JSON.parse(JSON.stringify(m.toJSON()));
  const b = new Magic(); b.loadJSON(saved);
  ok('the chain position and recipes survive a save', b.chain.step === m.chain.step && b.taught.join() === m.taught.join() && b.current().id === m.current().id);
  // Finishing the list.
  b.chain.step = WIZARD_QUESTS.length;
  ok('past the last quest there is none, and handing in says so', b.current() === null && !b.complete(inv).ok);
}

// A full bag blocks a reward and keeps the quest open.
{
  const m = new Magic(); m.arrive(null);
  const inv = new Inventory({ slots: 2 });
  inv.add('mushroom_red', 3); inv.add('leaves', 6);
  inv.add('stone', 1);
  const before = m.chain.step;
  const r = m.complete(inv);
  ok('no room for the wand: refused, nothing taken', !r.ok && m.chain.step === before && inv.countOf('mushroom_red') === 3);
}

// The bolt: straight, bursts on blocks, calls back with the cell.
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  world.setBlock(10, 2, 5, MAGIC_TARGET);
  const seen = [];
  const arrows = new Arrows({ world, onBlock: (a, x, y, z) => seen.push([x, y, z]) });
  const bolt = arrows.shoot({ x: 2.5, y: 2.5, z: 5.5 }, { x: 1, y: 0, z: 0 }, BOLT_SPEED, 7, true);
  for (let i = 0; i < 60; i++) arrows.tick(1 / 30);
  ok('a bolt flies level (no drop) and bursts on the target block', seen.length === 1 && seen[0].join() === '10,2,5' && bolt.y > 2.4);
  ok('a bolt is gone after it bursts, not stuck', arrows.list.length === 0 && !bolt.stuck);
  const arrow = arrows.shoot({ x: 2.5, y: 2.5, z: 5.5 }, { x: 1, y: 0, z: 0 }, 20, 3);
  for (let i = 0; i < 10; i++) arrows.tick(1 / 30);
  ok('an ordinary arrow still drops', arrow.y < 2.5);
}

// Blocks and items.
ok('Training Target is block 600 with an item and a recipe', ITEMS_BY_ID.get('training_target')?.block === MAGIC_TARGET && !!RECIPES_BY_ID.get('training_target'));
ok('Magic Cauldron is block 601, a station, placed from its item', stationOf(MAGIC_CAULDRON) === 'magic_cauldron' && ITEMS_BY_ID.get('magic_cauldron')?.block === MAGIC_CAULDRON);
ok('the wand is a tool with no wear', ITEMS_BY_ID.get('wizard_wand')?.kind === 'tool' && ITEMS_BY_ID.get('wizard_wand').durability === null);

// In the game: targets by the hut, restored, and the cauldron brewing.
{
  const world = new World({ sizeX: 40, sizeZ: 40, height: 32 });
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) for (let y = 0; y < 4; y++) world.setBlock(x, y, z, 3);
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age: 3, sandbox: true });
  const d = DESIGN_FOR_STRUCTURE.get('wizard_hut');
  for (const b of d.blocks) world.setBlock(14 + b.dx, 4 + b.dy, 14 + b.dz, b.type);
  ok('hut claimed', g.claim({ minX: 14, maxX: 14 + d.extent.x, minY: 4, maxY: 4 + d.extent.y, minZ: 14, maxZ: 14 + d.extent.z }, 'wizard_hut').ok);
  g.checkWizard();
  ok('three training targets stand by the hut', g.magic.targets.length === 3 && g.magic.targets.every((t) => world.getBlock(t.x, t.y, t.z) === MAGIC_TARGET));
  const t = g.magic.targets[0];
  world.setBlock(t.x, t.y, t.z, 0);
  g.magic.chain.step = 2; // the targets quest
  g.tick(3);
  ok('a broken target is put back while a targets quest is open', world.getBlock(t.x, t.y, t.z) === MAGIC_TARGET);
  world.setBlock(t.x, t.y, t.z, 0);
  g.magic.chain.step = 4;
  g.tick(3);
  ok('and left alone otherwise', world.getBlock(t.x, t.y, t.z) === 0);

  // Brewing at the cauldron counts for the brew quest.
  const key = '5,5,5';
  world.setBlock(5, 5, 5, MAGIC_CAULDRON);
  g.inventory.add('water', 3); g.inventory.add('mushroom_pale', 3); g.inventory.add('leaves', 6);
  g.magic.chain = { step: 4, count: {} };
  const put = g.stationWork.put(key, 'moonwater', 3);
  ok('moonwater goes in a cauldron spot (three inputs, one batch)', put.ok && put.batches === 3);
  g.tick(100);
  ok('three batches brewed count three for the brew quest', (g.magic.chain.count.brew ?? 0) === 3 && g.stationWork.spot(key)?.out === 3);
  ok('the brew quest can then be handed in', g.magic.progress(g.inventory).ready);
  g.stationWork.take(key);
  ok('taking it out empties the spot', !g.stationWork.spot(key));
}
process.exit(f ? 1 : 0);
