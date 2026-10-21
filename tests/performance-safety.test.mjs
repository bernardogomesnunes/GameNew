import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { Crowd } from '../src/render/Models.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { FarTerrain } from '../src/render/FarTerrain.js';

let failures = 0;
function check(name, run) {
  try { run(); console.log('PASS ' + name); }
  catch (error) { failures++; console.log('FAIL ' + name + ': ' + error.message); }
}
check('high mountain rock does not acquire ordinary surface-breaking caves', () => {
  const gen = new ChunkGen({ seed: 4242 });
  // No gallery here; force noise to its carve value so this catches a missing
  // height guard rather than depending on how often this seed rolls a cave.
  gen.cave = () => 0;
  const carved = gen.caveAt(-2521, 150, -2584, 0);
  assert.notEqual(carved, 0, 'above the ordinary cave ceiling must stay rock');
  assert.equal(gen.caveAt(-2521, 80, -2584, 0), 0, 'ordinary caves below remain');
});
check('sealed cave across a chunk corner stays in the deep mesh', () => {
  const world = new World({ sizeX: 48, sizeZ: 48, height: 32 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) for (let y = 0; y < 20; y++) world.setBlock(x, y, z, 3);
  world.setBlock(16, 8, 15, 0);
  world.setBlock(16, 8, 16, 0);
  const mesher = new ChunkMesher(new THREE.Scene());
  const chunk = world.getChunk(1, 1);
  mesher.rebuild(world, chunk);
  let surface = 0, deep = 0;
  for (const mesh of chunk.mesh.values()) {
    if (mesh.userData.deep) deep += mesh.geometry.index.count / 6;
    else surface += mesh.geometry.index.count / 6;
  }
  assert.equal(deep, 4);
  assert.equal(surface, 1);
  mesher.clearAll();
});
check('disposing a crowd releases instance buffers without disposing shared assets', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const kit = { id: 'perf-fixture', bones: [{ name: 'root', parent: -1, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry }], material };
  const crowd = new Crowd(scene, kit, 4);
  let instances = 0, assets = 0;
  for (const mesh of crowd.meshes) if (mesh) mesh.addEventListener('dispose', () => instances++);
  geometry.addEventListener('dispose', () => assets++);
  material.addEventListener('dispose', () => assets++);
  crowd.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok(instances > 0, 'instance GPU buffers must receive a dispose event');
  assert.equal(assets, 0, 'cached model geometry/material belong to the kit');
});
check('first distant-terrain update respects an explicit play budget', () => {
  const realPerformance = globalThis.performance;
  let time = 0, made = 0;
  globalThis.performance = { now: () => time++ };
  try {
    const gen = {};
    const terrain = { gen, layers: [{ from: 0, to: 100, tiles: new Map() }],
      uniforms: { uCentre: { value: { set() {} } } },
      forgetFar() {}, wanted: () => [[0, 0], [1, 0], [2, 0]],
      makeTile() { made++; time += 20; },
    };
    FarTerrain.prototype.update.call(terrain, gen, 0, 0, { budgetMs: 0, initialBudgetMs: 0 });
    assert.equal(made, 1, 'first update must stop after its expensive tile');
  } finally { globalThis.performance = realPerformance; }
});
check('long exploration releases untouched terrain but preserves player edits', () => {
  const world = new World({ height: 32, gen: { fill() {}, biomes: { centreX: 0, centreZ: 0 } } });
  world.setBlock(0, 5, 0, 3);
  const scene = new THREE.Scene(), mesher = new ChunkMesher(scene);
  const home = world.getChunk(0, 0);
  mesher.rebuild(world, home);
  for (let stop = 1; stop <= 12; stop++) {
    const x = stop * 160;
    world.getChunk(x / 16, 0);
    for (const chunk of world.forgetBeyond(x, 0, 32)) mesher.remove(chunk);
    assert.ok(world.chunks.size <= 2, 'unmodified terrain accumulates during travel');
    assert.equal(world.getBlock(0, 5, 0), 3, 'edited terrain must survive');
  }
  mesher.clearAll();
  assert.equal(scene.children.length, 0);
});
process.exitCode = failures ? 1 : 0;
