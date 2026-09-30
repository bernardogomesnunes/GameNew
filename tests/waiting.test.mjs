import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';

/**
 * Reported directly: some buildings "do not have a tap to see the pop up".
 * A design placed where it didn't qualify yet — a granary with no fields
 * near, a market on its own — was refused with one toast and was loose
 * blocks from then on. Now it's remembered, says what it's waiting for, and
 * counts the moment it can.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const DIRT = 2, STONE = 3, FARMLAND = 21;
const world = new World({ sizeX: 96, sizeZ: 96, height: 64 });
for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 20; y++) world.setBlock(x, y, z, y === 19 ? DIRT : STONE);
const d = new DuiltGame({ world, scene: new THREE.Scene(), sandbox: true });

const design = DESIGN_FOR_STRUCTURE.get('granary');
const at = { x: 40, y: 20, z: 40 };
for (const b of design.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, b.type);
const e = design.extent;
const region = { minX: at.x, maxX: at.x + e.x, minY: at.y, maxY: at.y + e.y, minZ: at.z, maxZ: at.z + e.z };

const first = d.claim(region, 'granary');
ok('a granary with no fields near it is refused', !first.ok && /fields/i.test(first.reason));
d.waitFor(region, 'granary', first.reason);
const w = d.waitingAt(at.x + 2, at.y + 1, at.z + 2);
ok('but it is remembered: looking at it finds what it is meant to be, and why it isn\'t yet', w?.type === 'granary' && /fields/i.test(w.reason));
ok('and it isn\'t found anywhere else', d.waitingAt(5, 20, 5) === null);

// Something unrelated, far away, doesn't set it trying again.
const far = [{ x: 2, y: 20, z: 2, prev: 0, next: STONE }];
ok('an edit far off leaves it waiting', d.retryWaiting(far).length === 0 && d.waiting.length === 1);

// Dig fields next to it.
const changes = [];
for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) {
  const x = at.x - 8 + dx, z = at.z + dz;
  world.setBlock(x, 19, z, FARMLAND);
  changes.push({ x, y: 19, z, prev: DIRT, next: FARMLAND });
}
const now = d.retryWaiting(changes);
ok('fields dug beside it: it counts, by itself', now.length === 1 && now[0].type === 'granary');
ok('it is a real building now, with its pop-up', d.structures.at(at.x + 2, at.y + 1, at.z + 2)?.type === 'granary');
ok('and no longer waiting', d.waiting.length === 0);

// Saved and loaded with the world.
d.waitFor({ minX: 70, maxX: 76, minY: 20, maxY: 25, minZ: 70, maxZ: 76 }, 'market', 'Put it among your town');
const d2 = new DuiltGame({ world, scene: new THREE.Scene(), sandbox: true });
d2.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
ok('what is still waiting is kept with the world', d2.waitingAt(72, 21, 72)?.type === 'market');

process.exit(f ? 1 : 0);
