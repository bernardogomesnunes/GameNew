import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

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
  d.inventory.add('fruit', 3);

  const before = d.inventory.countOf('fruit');
  const result = d.eat('fruit'); // exactly what Game.js's eatSelected passes
  ok('eating the selected item takes one from the bag', d.inventory.countOf('fruit') === before - 1);
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

// --- wired into Break, the same way the bucket is ---------------------------

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('fruit and vegetables take over Break, like the bucket does',
  /BREAK_OVERRIDE = \{ bucket: 'fillBucket', fruit: 'eatSelected', vegetables: 'eatSelected' \}/.test(game));
ok('eatSelected calls DuiltGame\'s own eat() with whatever is selected',
  /eatSelected\(\)[\s\S]{0,200}this\.duilt\.eat\(this\.selectedItemId\)/.test(game));
ok('and food is a selectable hotbar slot, with its own hint',
  /fruit: 'Break to eat'/.test(ui) && /vegetables: 'Break to eat'/.test(ui));

process.exit(f ? 1 : 0);
