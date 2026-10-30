import assert from 'node:assert/strict';
import { CloudWorlds } from '../src/net/CloudWorlds.js';

// A world whose saved position was lost used to open at the top of the world.
const meta = { id: 'w', name: 'No position', mode: 'duilt', sizeX: null, sizeZ: null, height: 200, spawn: null,
  economy: {}, duilt: null, worldGen: { seed: 672287, homeX: -1, homeZ: 8, emergingPlaces: [] }, blockCount: 0, revision: 1 };
const cloud = Object.create(CloudWorlds.prototype);
cloud.sync = { pull: async () => ({ meta, chunks: [] }) };
const data = await cloud.restore('w');
const ground = data.world.gen.heightAt(-1, 8);
assert.ok(data.player.y < 190, `opens at ${data.player.y}, not at the top of the world`);
assert.equal(data.player.y, ground + 2);
console.log('PASS a world with no saved position opens on the ground at home');
