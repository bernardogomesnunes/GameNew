import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { WEAR_SLOTS, BACKPACKS } from '../src/config/armour.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { GLYPHS } from '../src/config/glyphs.js';

/**
 * Backlog batch 3, #1: "A backpack. Crafted, worn in the boots/ring row (or
 * its own slot). Adds bag slots: e.g. +10 leather, +20 reinforced."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const recipe = (id) => RECIPES.find((r) => r.id === id);
const fresh = () => new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
const at = (g, id) => g.inventory.slots.findIndex((s) => s?.id === id);

// --- made, and worn in the row --------------------------------------------------------

ok('its own slot, in the row between the boots and the ring', WEAR_SLOTS.indexOf('back') === WEAR_SLOTS.indexOf('feet') + 1 && WEAR_SLOTS.at(-1) === 'ring');
ok('leather: +10, by hand from Age 1, of hide and string',
  ITEMS_BY_ID.get('backpack_leather')?.bagSlots === 10 && recipe('backpack_leather')?.station === 'hand' && recipe('backpack_leather').age === 1
  && recipe('backpack_leather').inputs.hide > 0 && recipe('backpack_leather').inputs.string > 0);
ok('reinforced: +20, the leather one with iron at the seams',
  ITEMS_BY_ID.get('backpack_reinforced')?.bagSlots === 20 && recipe('backpack_reinforced')?.inputs.backpack_leather === 1 && recipe('backpack_reinforced').inputs.iron_ingot > 0);
ok('both go on your back, and look like backpacks',
  BACKPACKS.every((b) => ITEMS_BY_ID.get(b.id).wears === 'back' && (itemIcon(ITEMS_BY_ID.get(b.id)) ?? '').startsWith('<svg')) && !!GLYPHS.backpack);

// --- more slots while it's on ------------------------------------------------------------

{
  const g = fresh();
  ok('the bag has forty slots to start with', g.inventory.size === 40);
  g.inventory.add('backpack_leather', 1);
  ok('put on, the leather one makes it fifty', g.wear(at(g, 'backpack_leather')).ok && g.inventory.size === 50 && g.worn.back?.id === 'backpack_leather');
  ok('and it is not still in the bag', at(g, 'backpack_leather') === -1);
  ok('armour isn\'t changed by it', g.armour() === 0);

  // Swap up: the reinforced one off the bag, the leather one into its place.
  g.inventory.add('backpack_reinforced', 1);
  ok('the reinforced one, seventy — and the leather one comes back to the bag',
    g.wear(at(g, 'backpack_reinforced')).ok && g.inventory.size === 60 && at(g, 'backpack_leather') >= 0);

  // Saved and loaded: still on, still sixty.
  const back = fresh();
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('saved and loaded, it is still on and the bag still that big', back.worn.back?.id === 'backpack_reinforced' && back.inventory.size === 60);
}

// --- taking it off never throws anything away --------------------------------------------

{
  const g = fresh();
  g.inventory.add('backpack_leather', 1);
  g.wear(at(g, 'backpack_leather'));
  // Fill all fifty slots with different things — nowhere left to go.
  const ids = [...ITEMS_BY_ID.keys()].filter((id) => !id.startsWith('backpack') && ITEMS_BY_ID.get(id).stackTo === 1).slice(0, 50);
  for (const id of ids) g.inventory.add(id, 1);
  ok('a full bag fills the backpack\'s slots too', g.inventory.slots.every(Boolean));
  const r = g.takeOff('back');
  ok('full, it won\'t come off, and says how much room to make', !r.ok && /make room for/i.test(r.reason));
  ok('and nothing changed', g.worn.back?.id === 'backpack_leather' && g.inventory.size === 50 && g.inventory.slots.every(Boolean));

  // Empty most of it: what's in its slots moves down into the room left.
  for (let i = 9; i < 30; i++) g.inventory.slots[i] = null;
  const kept = g.inventory.slots.filter(Boolean).map((s) => s.id).sort().join();
  const off = g.takeOff('back');
  ok('with room, it comes off and the bag is forty again', off.ok && g.inventory.size === 40 && !g.worn.back);
  const now = g.inventory.slots.filter(Boolean).map((s) => s.id).filter((id) => id !== 'backpack_leather').sort().join();
  ok('everything that was in it is still in the bag, and the backpack with it', now === kept && at(g, 'backpack_leather') >= 0);
}

{
  // Swapping down, reinforced to leather, is refused the same way when it wouldn't fit.
  const g = fresh();
  g.inventory.add('backpack_reinforced', 1);
  g.wear(at(g, 'backpack_reinforced'));
  const ids = [...ITEMS_BY_ID.keys()].filter((id) => !id.startsWith('backpack') && ITEMS_BY_ID.get(id).stackTo === 1).slice(0, 59);
  for (const id of ids) g.inventory.add(id, 1);
  g.inventory.slots[0] = { id: 'backpack_leather', count: 1, wear: 0 };
  const r = g.wear(0);
  ok('a smaller backpack for a full bigger one is refused, nothing moved', !r.ok && g.worn.back?.id === 'backpack_reinforced' && g.inventory.size === 60 && g.inventory.slots[0]?.id === 'backpack_leather');
}

{
  // A creative bag already holds one of everything; a backpack doesn't resize it.
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null, sandbox: true });
  g.grantCreativeKit();
  const size = g.inventory.size;
  ok('in creative, it goes on and off and the bag stays as it is', g.wear(at(g, 'backpack_leather')).ok && g.inventory.size === size && g.takeOff('back').ok && g.inventory.size === size);
}

ok('the bag shows the Back slot, what it adds, and how to get one',
  /back: 'backpack'/.test(ui) && /\+\$\{spec\.bagSlots\} bag slots/.test(ui) && /Make a backpack at the bench/.test(ui));

process.exit(f ? 1 : 0);
