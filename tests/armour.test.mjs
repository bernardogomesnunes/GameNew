import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { ARMOUR_SETS, ARMOUR_PIECES, WEAR_SLOTS, throughArmour, HIT_CAUSES } from '../src/config/armour.js';
import { ITEMS_BY_ID, wornOn, isTool } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { GLYPHS } from '../src/config/glyphs.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Phase 7b (docs/plan-phase7-lore.md): "new bag slots for armour (head,
 * body and legs) and one ring. Armour sets, one per realm: leather; Sky
 * armour: white steel and gold; Stone armour: blackened iron. It takes
 * damage off each hit. Sky armour lets you walk among its people."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- the sets ---------------------------------------------------------------------------

ok('five places to wear things: head, body, legs, feet (playtest, P6) and a ring', WEAR_SLOTS.join() === 'head,body,legs,feet,ring');
ok('five sets in tiers — leather, iron, gold, sky, dark (key stone) — of four pieces each, boots and all (backlog batch 2)',
  ARMOUR_SETS.map((s) => s.key).join() === 'leather,iron,gold,sky,stone' && ARMOUR_PIECES.length === 20);
const total = (key) => ARMOUR_PIECES.filter((p) => p.set === key).reduce((n, p) => n + p.points, 0);
ok(`leather is light (${total('leather')}), the two kingdoms' metal is heavier (${total('sky')}, ${total('stone')})`,
  total('leather') < total('sky') && total('sky') === total('stone'));
ok('sky armour is white steel and gold; stone, blackened iron',
  ARMOUR_SETS.find((s) => s.key === 'sky').main > 0xd00000 && ARMOUR_SETS.find((s) => s.key === 'sky').trim === 0xe2c26a
  && ARMOUR_SETS.find((s) => s.key === 'stone').main < 0x505050);
{
  const items = ARMOUR_PIECES.map((p) => ITEMS_BY_ID.get(p.id));
  ok('every piece is a thing you carry, worn in its place', items.every((i, k) => i?.kind === 'armour' && wornOn(i.id) === ARMOUR_PIECES[k].slot && i.armour > 0));
  ok('which wears out, one at a time', items.every((i) => i.durability > 0 && i.stackTo === 1));
  ok('and isn\'t a tool, so it goes in the chest with the rest when you die', items.every((i) => !isTool(i.id)));
  ok('each made at the bench, from things that exist',
    ARMOUR_PIECES.every((p) => RECIPES.some((r) => r.output.id === p.id && r.station === 'hand' && Object.keys(r.inputs).every((k) => ITEMS_BY_ID.has(k)))));
  ok('leather from hides at Age 1; the metal sets from the foundry\'s iron', RECIPES.find((r) => r.id === 'armour_leather_body').inputs.hide
    && ['sky', 'stone'].every((s) => RECIPES.find((r) => r.id === `armour_${s}_body`).inputs.iron_ingot && RECIPES.find((r) => r.id === `armour_${s}_body`).age === 4));
  ok('modelled in the bag — a helm, a cuirass, greaves — in each set\'s colours',
    ARMOUR_PIECES.every((p) => ITEM_MODELS[p.id]?.some((b) => b.color === p.main) && (itemIcon(ITEMS_BY_ID.get(p.id)) ?? '').startsWith('<svg')));
  ok('with marks of their own', ['helm', 'cuirass', 'greaves', 'ring'].every((g) => GLYPHS[g]));
}

// --- what it does -------------------------------------------------------------------------

ok('a bandit\'s blow through full metal armour is half a heart, not a whole one', throughArmour(2, 9) === 1);
ok('a heavy blow is taken down by a third', throughArmour(14, 9) === 9);
ok('a blow is never nothing', throughArmour(1, 100) === 1);
ok('and no armour, no change', throughArmour(5, 0) === 5);
ok('armour helps with being hit, not with falling or lava', HIT_CAUSES.has('bandit') && !HIT_CAUSES.has('fall') && !HIT_CAUSES.has('lava'));

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  const at = (id) => g.inventory.slots.findIndex((s) => s?.id === id);
  for (const p of ARMOUR_PIECES.filter((p) => p.set === 'stone')) g.inventory.add(p.id, 1);
  g.inventory.add('armour_sky_head', 1);
  g.inventory.add('stone', 5);

  ok('nothing on to start with', g.armour() === 0 && WEAR_SLOTS.every((k) => g.worn[k] === null));
  ok('a stone isn\'t something you wear', !g.wear(at('stone')).ok);
  for (const k of ['head', 'body', 'legs']) g.wear(at(`armour_stone_${k}`));
  ok('put on, the pieces leave the bag', WEAR_SLOTS.slice(0, 3).every((k) => g.worn[k]?.id === `armour_stone_${k}`) && at('armour_stone_body') === -1);
  ok(`and add up (${g.armour()} armour)`, g.armour() === 11);
  ok('a full set of stone isn\'t a disguise in the sky', g.disguisedAs() === null);

  // A blow, through it.
  const before = g.health.value;
  g.hurt(2, 'bandit');
  ok('a bandit\'s blow comes through softened', before - g.health.value === 1);
  ok('and every piece that took it is a little worn', ['head', 'body', 'legs'].every((k) => g.worn[k].wear === 1));
  const h = g.health.value;
  g.hurt(4, 'fall');
  ok('a fall is a fall, armour or not', h - g.health.value === 4);

  // Swap the helm.
  const skyAt = at('armour_sky_head');
  const r = g.wear(skyAt);
  ok('putting on a helm takes the other one off, into the same slot', r.ok && r.swapped === 'armour_stone_head'
    && g.worn.head.id === 'armour_sky_head' && g.inventory.slots[skyAt]?.id === 'armour_stone_head' && g.inventory.slots[skyAt].wear === 1);
  ok(`and the armour changes with it (${g.armour()})`, g.armour() === 11);

  // Saved with the world.
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('what you wear is saved, wear and all', back.worn.body?.id === 'armour_stone_body' && back.worn.body.wear === 1 && back.armour() === 11);
  const old = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  old.loadJSON({ ...JSON.parse(JSON.stringify(g.toJSON())), worn: undefined });
  ok('and a save from before armour loads wearing nothing', old.armour() === 0);

  // Take off.
  const t = g.takeOff('legs');
  ok('taken off, it goes back in the bag', t.ok && at('armour_stone_legs') >= 0 && g.worn.legs === null && g.armour() === 8);
  ok('nothing to take off is nothing', !g.takeOff('ring').ok);

  // Worn through.
  g.worn.body.wear = ITEMS_BY_ID.get('armour_stone_body').durability - 1;
  g.hurt(2, 'bandit');
  ok('worn through, a piece falls apart', g.worn.body === null);

  // Dying keeps what you wear.
  g.leaveGrave(3, 3, 3);
  ok('dying, what you wear stays on you', g.worn.head?.id === 'armour_sky_head');

  // The Sky disguise.
  const sky = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  for (const k of ['head', 'body', 'legs']) { sky.inventory.add(`armour_sky_${k}`, 1); sky.wear(sky.inventory.slots.findIndex((s) => s?.id === `armour_sky_${k}`)); }
  ok('a full set of sky armour passes for one of its people', sky.disguisedAs() === 'sky');

  // Full bag.
  const full = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  full.inventory.add('armour_leather_head', 1);
  full.wear(full.inventory.slots.findIndex((s) => s?.id === 'armour_leather_head'));
  for (let i = 0; i < full.inventory.slots.length; i++) if (!full.inventory.slots[i]) full.inventory.slots[i] = { id: 'stone', count: 1, wear: 0 };
  ok('with no room in the bag, it stays on', !full.takeOff('head').ok && full.worn.head?.id === 'armour_leather_head');

  const creative = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: true });
  ok('nothing hurts in Creative, armour or not', creative.hurt(10, 'bandit') === 0);
}

// --- on screen ---------------------------------------------------------------------------

ok('the bag has a row for what you wear', /id="bag-wear-grid"/.test(ui) && /renderWear\(\)/.test(ui) && /data-wear="\$\{k\}"/.test(ui));
ok('lift a piece, tap its place to put it on; tap what you wear to take it off', /tapWear\(k\)[\s\S]{0,700}d\.wear\(this\.held\)[\s\S]{0,700}d\.takeOff\(k\)/.test(ui));
ok('and your armour shows beside your hearts', /armour-badge/.test(ui));

process.exit(f ? 1 : 0);
