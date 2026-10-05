import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { tierStatus } from '../src/structures/validate.js';

/**
 * Reported directly: "When I'm editing the building also I can only delete
 * blocks, if I add more and lock this new added blocks do not make part of
 * the building which is weird." And about the quarry: "what the fuck is a
 * cut? ... If it is adding a new layer already tried it and it does not
 * work." A building's box was fixed at the claim, so nothing built or dug
 * against it ever counted — and in a quarry's fixed box every block dug out
 * was one less stone showing, so its two needs fought each other.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 7 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
const STONE = 3, AIR = 0;

// A patch of solid stone with a shallow scrape in it, open to the sky.
const ox = origin.minX + 4, oz = origin.minZ + 4, top = 40;
for (let x = ox - 6; x < ox + 18; x++) for (let z = oz - 6; z < oz + 18; z++) {
  for (let y = top - 12; y < 200; y++) world.setBlock(x, y, z, y < top ? STONE : AIR);
}
const region = { minX: ox, maxX: ox + 5, minY: top - 2, maxY: top, minZ: oz, maxZ: oz + 5 };
for (let x = ox; x < ox + 4; x++) for (let z = oz; z < oz + 3; z++) world.setBlock(x, top - 1, z, AIR);
const claim = g.claim(region, 'quarry');
if (!claim.ok) console.log('claim:', claim.reason);
ok('a quarry claims', claim.ok);
const q = claim.structure;
const reg = g.structures;

// --- the box grows with what you do against it -------------------------------------
const below = { x: ox + 1, y: top - 3, z: oz + 1, prev: STONE, next: AIR };
world.setBlock(below.x, below.y, below.z, AIR);
ok('digging just below it makes it deeper', reg.grow(q.id, [below]) && q.region.minY === top - 3);
const beside = { x: ox + 6, y: top, z: oz + 2, prev: AIR, next: STONE };
world.setBlock(beside.x, beside.y, beside.z, STONE);
ok('a block placed against its side makes it wider', reg.grow(q.id, [beside]) && q.region.maxX === ox + 6);
ok('something two blocks away does not', !reg.grow(q.id, [{ x: ox + 9, y: top, z: oz, prev: AIR, next: STONE }]) && q.region.maxX === ox + 6);
ok('nor outside your land', !reg.grow(q.id, [{ x: ox - 1, y: top, z: oz, prev: AIR, next: STONE }], { inside: () => false }) && q.region.minX === ox);
const spec = STRUCTURES_BY_ID.get('quarry');
let far = q.region.maxX;
for (let i = 0; i < 30; i++) reg.grow(q.id, [{ x: far + 1, y: top, z: oz, prev: AIR, next: STONE }]), far = q.region.maxX;
ok(`it stops at the largest a quarry can be (${spec.maxSize})`, q.region.maxX - q.region.minX + 1 === spec.maxSize);

// --- so a quarry can actually be climbed -------------------------------------------
const before = tierStatus(world, q.region, 'quarry', 0);
const dug = [];
for (let x = ox; x < ox + 4; x++) for (let z = oz; z < oz + 3; z++) {
  const y = q.region.minY - 1;
  world.setBlock(x, y + 1, z, AIR);
  dug.push({ x, y: y + 1, z, prev: STONE, next: AIR });
  dug.push({ x, y, z, prev: STONE, next: STONE });
}
reg.grow(q.id, dug);
const after = tierStatus(world, q.region, 'quarry', 0);
const short = (st, re) => st.next?.missing?.find((m) => re.test(m)) ?? '';
const n = (s) => Number(/\d+/.exec(s)?.[0] ?? 0);
ok('digging deeper uncovers more stone and more space at once',
  n(short(after, /^Dig out/)) < n(short(before, /^Dig out/)) || !short(after, /^Dig out/));

// --- plain words ----------------------------------------------------------------------
const structures = readFileSync(new URL('../src/config/structures.js', import.meta.url), 'utf8');
ok('no "cut" in what a quarry asks for', !/more cut out of it|Nothing has been cut|Seam Cut|Deep Cut/.test(structures));
ok('no "cells" anywhere a building asks for something', !/cells of/.test(structures));
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('building it yourself is a checklist, folded under the button', /<details class="evolve-diy"><summary>Or build it yourself<\/summary>/.test(ui));
ok('and it says how', /Press Change and build these in — it levels up by itself, and only the level's own cost is taken\./.test(ui));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('only while the building is open for changes', /growEditing\(changes\) \{\s*const s = this\.editingStructure;\s*if \(!s/.test(game)
  && (game.match(/this\.growEditing\(changes\);/g) ?? []).length === 2);

// --- a quarry grows as you dig it, open for changes or not -----------------------------
q.locked = true;
ok('a quarry never stops you digging it', reg.blocking([{ x: q.region.minX + 1, y: q.region.minY, z: q.region.minZ + 1 }]) === null);
const fy = q.region.minY, fx = q.region.minX + 1, fz = q.region.minZ + 1;
world.setBlock(fx, fy, fz, AIR);
const dugInto = reg.growDug([{ x: fx, y: fy, z: fz, prev: STONE, next: AIR }]);
ok('digging out its floor takes in the rock below', dugInto.includes(q) && q.region.minY === fy - 1);
ok('digging far from it does nothing', reg.growDug([{ x: q.region.maxX + 9, y: fy, z: fz, prev: STONE, next: AIR }]).length === 0);

process.exit(f ? 1 : 0);
