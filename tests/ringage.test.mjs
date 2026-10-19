import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Reported directly: "ive finish age seven and cant progress to 8". Forging
 * a ring is one of Age 7's goals, and forging never asked whether the age
 * was done: with the ring the last goal met, nothing moved until the next
 * block you placed — and a world saved like that stayed at Age 7.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

/** At Age 7 with everything but the ring done, and what a ring takes. */
function atAge7(ring) {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.territory.setAge(7);
  const t = Date.now();
  for (const type of ['temple', 'engineering', 'granary']) {
    g.structures.structures.push({ id: g.structures.nextId++, type, region: { minX: 0, maxX: 3, minY: 10, maxY: 13, minZ: 0, maxZ: 3 }, valid: true, locked: true, claimedAt: t, lastPaidAt: t, brokenReason: null, excludes: [], tier: 0 });
  }
  g.inventory.add('sunstone', 3); g.inventory.add('gold', 4);
  g.inventory.add('nightstone', 3); g.inventory.add('obsidian', 4);
  g.inventory.add('devotion', 30);
  return g;
}
const atHigh = ['temple', 'temple@0', 'temple@1', 'temple@2', 'temple@3', 'temple@4'];

for (const ring of ['white', 'black']) {
  const g = atAge7();
  ok(`${ring}: everything but the ring done, still Age 7`, g.age === 7 && g.ageGoals().filter((x) => !x.done).map((x) => x.id).join() === 'ring');
  const forged = g.crafting.craft(`ring_${ring}`, 1, { atStations: atHigh });
  ok(`  the ring forged, it's Age 8 at once (age ${g.age})`, forged.ok && g.ring === ring && g.age === 8);
}

{
  // Saved stuck: the ring forged, the age never moved on.
  const g = atAge7();
  g.ring = 'white';
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  const back = new DuiltGame({ world: g.world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(saved);
  // Standing, as they are in a real world (this one has no blocks for them).
  for (const st of back.structures.structures) st.valid = true;
  ok('a world saved stuck at Age 7 loads at Age 7', back.age === 7 && back.ageComplete());
  back.checkAgeAdvance();
  ok('  and the check it gets as it opens moves it on', back.age === 8);
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('opening a world checks its age', /this\.applyTerritoryBounds\(\);[\s\S]{0,300}if \(!sandbox\) this\.duilt\.checkAgeAdvance\(\);/.test(game));

process.exit(f ? 1 : 0);
