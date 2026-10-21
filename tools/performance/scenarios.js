import * as THREE from 'three';
import { World } from '../../src/world/World.js';
import { ChunkGen, WORLD_HEIGHT } from '../../src/world/ChunkGen.js';
import { ChunkMesher } from '../../src/world/ChunkMesher.js';
import { Mobs } from '../../src/world/Mobs.js';
import { MOBS_BY_ID } from '../../src/config/mobs.js';
import { generateEndlessWorld } from '../../src/world/StarterWorld.js';

// Deliberately fixed, small windows of costly terrain. Never choose whichever
// random seed happens to be cheap in a particular run. Keep a neighbour ring
// so missing chunk borders cannot dominate the geometry measurements.
export const SCENARIOS = Object.freeze([
  { id: 'peak', x: -2521, z: -2720, minHeight: 170 },
  { id: 'range_slope', x: -2521, z: -2584, minHeight: 100 },
  { id: 'forest', x: -744, z: 600 },
  { id: 'cave', x: 340, z: 781 },
  { id: 'settlement', x: 0, z: 0, settlement: true },
]);

export function createScenario(spec, scene = new THREE.Scene()) {
  const start = performance.now();
  const world = spec.settlement
    ? generateEndlessWorld({ seed: 4242 }).world
    : new World({ height: WORLD_HEIGHT, gen: new ChunkGen({ seed: 4242 }) });
  const x = spec.settlement ? world.centreX : spec.x;
  const z = spec.settlement ? world.centreZ : spec.z;
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  const y = world.gen.heightAt(x, z);
  if (spec.minHeight != null && y < spec.minHeight) {
    throw new Error(`${spec.id} fixture lost its crest: height ${y} < ${spec.minHeight}`);
  }
  const chunks = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const chunk = world.getChunk(cx + dx, cz + dz);
    if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) chunks.push(chunk);
  }
  const generationMs = performance.now() - start;
  const mesher = new ChunkMesher(scene);
  return { scene, world, chunks, mesher, x, y, z, generationMs };
}

export function meshMetrics(fixture) {
  const start = performance.now();
  for (const chunk of fixture.chunks) fixture.mesher.rebuild(fixture.world, chunk);
  const meshMs = performance.now() - start;
  const out = { generationMs: fixture.generationMs, meshMs, surfaceHeight: fixture.y, chunks: fixture.chunks.length,
    surfaceTriangles: 0, deepTriangles: 0, geometryBytes: 0, meshes: fixture.mesher.activeMeshes.size };
  for (const mesh of fixture.mesher.activeMeshes) {
    const geometry = mesh.geometry;
    const triangles = (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    out[mesh.userData.deep ? 'deepTriangles' : 'surfaceTriangles'] += triangles;
    out.geometryBytes += geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(geometry.attributes)) out.geometryBytes += attribute.array.byteLength;
  }
  return out;
}

export function crowdMetrics() {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 4, z, 3);
  // Same cap as production, with deterministic choices and loaded flat ground.
  const mobs = new Mobs({ world, cap: 0, rand: () => 0.6 });
  for (let i = 0; i < 24; i++) mobs.list.push(mobs.make(MOBS_BY_ID.get('cow'), 4 + i % 6 * 4, 5, 4 + Math.floor(i / 6) * 4));
  const count = world.chunks.size, start = performance.now();
  for (let frame = 0; frame < 600; frame++) mobs.tick(1 / 60, { x: 16, y: 5, z: 16 });
  return { tickMs: (performance.now() - start) / 600, animals: mobs.list.length, generatedChunks: world.chunks.size - count };
}
