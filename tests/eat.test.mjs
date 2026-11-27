import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Inventory } from '../src/items/Inventory.js';

/**
 * Requested directly, as part of the same pass that added mining tools:
 * "this way to eat fruit, I'll hold fruit and eat it with left click." Food
 * joins the bucket as a selected item that takes over Break instead of
 * digging — see Game.js's BREAK_OVERRIDE and eatSelected(). DuiltGame.eat()
 * already did the real work (which slot, the hunger math, the refusal
 * reasons); this only wires "the hotbar slot you have selected" to it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const scene = new THREE.Scene();
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

// --- eatSelected wiring, for real, against DuiltGame's own eat() ------------

{
  const { world } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 7 });
  const d = new DuiltGame({ world, scene, bus: null });
  d.hunger.value = 50; // hungry enough that eating isn't refused as wasteful
  d.inventory.add('apple', 3);

  const before = d.inventory.countOf('apple');
  const result = d.eat('apple'); // exactly what Game.js's eatSelected passes
  ok('eating the selected item takes one from the bag', d.inventory.countOf('apple') === before - 1);
  ok('and restores hunger', result.ok && result.restored > 0);
}

{
  const { world } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 7 });
  const d = new DuiltGame({ world, scene, bus: null });
  d.hunger.value = 50;
  // Nothing of that in the bag — a bucket, say, selected instead of food.
  const result = d.eat('bucket');
  ok('eating something that is not food is refused, not silently a no-op',
    !result.ok && /can't eat/.test(result.reason));
}

// --- throwing it away, the other button --------------------------------------

{
  const inv = new Inventory();
  inv.add('apple', 3);
  ok('throwing takes one from the bag', inv.remove('apple', 1) === 1 && inv.countOf('apple') === 2);
  ok('with none left, throwing takes nothing', new Inventory().remove('apple', 1) === 0);
}

// --- wired into Break/Place, the same way the bucket is ----------------------

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/game/GameInput.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('fruit and vegetables take over Break, like the bucket does',
  /BREAK_OVERRIDE = \{ bucket: 'fillBucket', apple: 'eatSelected', vegetables: 'eatSelected'[, }]/.test(game));
ok('and so does any other food — meat, eggs, milk — without listing each one',
  /BREAK_OVERRIDE\[this\.selectedItemId\] \?\? \(isFood\(this\.selectedItemId\) \? 'eatSelected' : null\)/.test(game)
  && /PLACE_OVERRIDE\[this\.selectedItemId\] \?\? \(isFood\(this\.selectedItemId\) \? 'throwSelected' : null\)/.test(game)
  && /isFood\(this\.selectedItemId\) \? \['Eat', 'Throw'\]/.test(ui));
ok('eatSelected calls DuiltGame\'s own eat() with whatever is selected',
  /eatSelected\(\)[\s\S]{0,200}this\.duilt\.eat\(this\.selectedItemId\)/.test(game));
ok('and food takes over Place too, throwing it away instead of building',
  /PLACE_OVERRIDE = \{[\s\S]{0,100}apple: 'throwSelected', vegetables: 'throwSelected'[, }]/.test(game));
ok('throwSelected removes one unit of whatever is selected',
  /throwSelected\(\)[\s\S]{0,200}this\.duilt\.inventory\.remove\(id, 1\)/.test(game));
ok('and food is a selectable hotbar slot, with its own hint',
  /apple: 'Break to eat'/.test(ui) && /vegetables: 'Break to eat'/.test(ui));
ok('the two buttons say Eat and Throw while food is selected, not Break and Place',
  /fruit: \['Eat', 'Throw'\]/.test(ui) && /vegetables: \['Eat', 'Throw'\]/.test(ui));

process.exit(f ? 1 : 0);
