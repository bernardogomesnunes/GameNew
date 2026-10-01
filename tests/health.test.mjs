import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Health, MAX_HEALTH, SAFE_FALL, LAVA_PER_SECOND, HOUSE_REGEN, fallDamage } from '../src/survival/Health.js';
import { World } from '../src/world/World.js';
import { DuiltGame, CHEST_SLOTS } from '../src/duilt/DuiltGame.js';
import { CHEST, isChest, turned, facingOf, BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { boxesFor } from '../src/world/propShapes.js';

/**
 * Phase 6a — health, and what happens when it runs out. Chosen directly:
 * ten hearts; falls and lava hurt; food heals while you're fed, resting in a
 * house faster; and on dying, "the chest appears in place with my items".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- health ----------------------------------------------------------------------

{
  const events = [];
  const bus = { emit: (e, d) => events.push([e, d]) };
  const h = new Health(bus);
  ok('ten hearts, counted in halves', MAX_HEALTH === 20 && h.hearts === 10);
  h.hurt(3, 'fall');
  ok('a hurt takes what it says', h.value === 17 && events.some(([e, d]) => e === 'health:change' && d.hurt === 3));
  ok('a steady hurt (lava) waits out its cooldown', h.hurt(2, 'lava', { steady: true }) === 0);
  h.tick(1, { hungerRatio: 1 });
  ok('and then stings again', h.hurt(2, 'lava', { steady: true }) === 2 && h.value === 15);

  h.tick(3.99, { hungerRatio: 1 });
  ok('no healing in under four seconds', h.value === 15);
  h.tick(0.02, { hungerRatio: 1 });
  ok('then half a heart', h.value === 16);
  h.tick(8, { hungerRatio: 0.3 });
  ok('but not while hungry', h.value === 16);
  h.tick(4, { hungerRatio: 1, resting: true });
  ok(`resting in a house heals ${HOUSE_REGEN} times as fast`, h.value === 16 + HOUSE_REGEN);

  h.hurt(100, 'lava');
  ok('it runs out at zero, and says so', h.value === 0 && h.dead && events.some(([e]) => e === 'health:died'));
  ok('the dead don\'t heal', (h.tick(10, { hungerRatio: 1 }), h.value === 0));
  h.restore();
  ok('a respawn is back to full', h.value === MAX_HEALTH);

  const saved = JSON.parse(JSON.stringify({ value: 7 }));
  const back = new Health(); back.loadJSON(saved);
  ok('saved and loaded', back.value === 7);
  const fresh = new Health(); fresh.loadJSON(undefined);
  ok('an old save with no health starts full', fresh.value === MAX_HEALTH);
  const dead = new Health(); dead.loadJSON({ value: 0 });
  ok('and one saved dead doesn\'t load straight into death', dead.value === MAX_HEALTH);
}

ok(`a fall of ${SAFE_FALL} blocks is free`, fallDamage(SAFE_FALL) === 0 && fallDamage(1) === 0);
ok('past that, half a heart a block', fallDamage(6) === 3 && fallDamage(10.4) === 7);
ok('lava takes two hearts a second', LAVA_PER_SECOND === 4);

// --- falling, as the player does it ------------------------------------------------

{
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  const { PlayerController } = await import('../src/player/PlayerController.js');
  const world = new World({ sizeX: 32, sizeZ: 32, height: 40 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const p = new PlayerController(world, new THREE.Object3D(), { x: 16.5, y: 1, z: 16.5 });
  p.teleport(16.5, 12, 16.5);
  for (let i = 0; i < 200; i++) p.update(1 / 60);
  const drop = p.takeLanding();
  ok(`a fall is measured on landing (${drop.toFixed(1)} blocks)`, drop > 10.5 && drop < 11.5);
  ok('and handed over once', p.takeLanding() === 0);
  p.flying = true;
  p.teleport(16.5, 20, 16.5);
  p.flying = false;
  p.teleport(16.5, 1, 16.5);
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  ok('a teleport is not a fall', p.takeLanding() < 0.5);
}

// --- the chest -----------------------------------------------------------------------

{
  const chest = BLOCKS_BY_ID.get(CHEST);
  ok('there is a chest block', chest?.name === 'Chest' && isChest(CHEST));
  ok('that turns to face you, its other facings states of it',
    [1, 2, 3].every((d) => isChest(turned(CHEST, d)) && facingOf(turned(CHEST, d)) === d && BLOCKS_BY_ID.get(CHEST + d).stateOf === CHEST));
  ok('one of them in the block list, not four', PLACEABLE_BLOCKS.filter((b) => b.chest).length === 1);
  ok('modelled: a body, a lid, iron bands and a latch', boxesFor('chest').length >= 8 && boxesFor('chest').some((b) => b.color === 0xc9a44c));
  ok('made from planks at the bench', RECIPES.some((r) => r.output.id === 'chest' && r.inputs.planks));
  ok('and picked up as a chest, whichever way it faced', ITEM_FOR_BLOCK.get(CHEST + 2) === 'chest' && ITEMS_BY_ID.get('chest').block === CHEST);
}

// --- dying ---------------------------------------------------------------------------

{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.inventory.add('axe', 1);
  g.inventory.add('stone', 40);
  g.inventory.add('fruit', 3);
  const n = g.leaveGrave(5, 10, 5);
  ok('dying leaves what you carried in a chest', n === 43 && g.inventory.countOf('stone') === 0 && g.inventory.countOf('fruit') === 0);
  ok('except your tools, so you can walk back and dig', g.inventory.countOf('axe') === 1);
  const c = g.chestAt(5, 10, 5, { create: false });
  ok('the chest is marked as the one you fell by', c?.grave === true && c.inventory.countOf('stone') === 40);
  ok('and opens on the store screen', g.storeSummary({ chest: { x: 5, y: 10, z: 5 } }).grave === true);
  ok('with nothing to leave, no chest', g.leaveGrave(6, 10, 6) === 0 && !g.chestAt(6, 10, 6, { create: false }));

  // A chest you made: slots of its own, saved with the world.
  const mine = g.chestAt(8, 10, 8);
  ok(`a chest you make holds ${CHEST_SLOTS}`, mine.inventory.size === CHEST_SLOTS && !mine.grave);
  mine.inventory.add('dirt', 9);
  ok('a chest with things in it is not empty', !g.chestEmpty(8, 10, 8) && g.chestEmpty(9, 9, 9));

  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('chests are saved with the world', back.chestAt(8, 10, 8, { create: false })?.inventory.countOf('dirt') === 9
    && back.chestAt(5, 10, 5, { create: false })?.grave === true);

  const sandbox = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: true });
  ok('nothing hurts in Creative', sandbox.hurt(10, 'lava') === 0 && sandbox.health.value === MAX_HEALTH);
}

// --- in the game ---------------------------------------------------------------------

ok('falls and lava hurt as you play', /feelHurt\(\)[\s\S]{0,400}fallDamage\(fall\)[\s\S]{0,400}LAVA_PER_SECOND/.test(game));
ok('resting at home heals faster', /this\.duilt\.tick\(dt, \{ resting: this\.restingAtHome\(wasAt\) \}\)/.test(game));
ok('dying sends you home and leaves the chest', /this\.bus\.on\('health:died'/.test(game) && /leaveGrave\(x, y, z\)/.test(game) && /this\.player\.teleport\(home\.x, home\.y, home\.z\)/.test(game));
ok('Place opens a chest', /isChest\(aimed\.block\)\) return void this\.openChest\(aimed\)/.test(game));
ok('a chest with things in it can\'t be broken', /Empty the chest first/.test(game));
ok('the chest you fell by goes once it\'s empty', /clearGrave\(\{ x, y, z \}\)/.test(game) && /this\.game\.clearGrave\?\.\(c\)/.test(ui));
ok('ten hearts on the HUD, hidden in Creative', /renderHealth\(\)[\s\S]{0,300}box\.hidden = !!d\.sandbox/.test(ui) && /length: 10/.test(ui));
ok('and a red flash when you\'re hurt', /if \(hurt\) this\.flashHurt\(false\)/.test(ui));

process.exit(f ? 1 : 0);
