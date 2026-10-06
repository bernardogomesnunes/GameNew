import * as THREE from 'three';
import { FlameView } from '../src/render/FlameView.js';
import { flicker } from '../src/render/LightManager.js';
import { BLOCKS_BY_ID, CAMPFIRE } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';

/** Asked for directly: "Campfire fire needs some movement to show flames." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const light = BLOCKS_BY_ID.get(CAMPFIRE).light;
ok('a campfire has flames and a wavering light', light.flame && light.flicker);
ok('the block itself only holds the embers', PROP_SHAPES.campfire.filter((b) => b.glow).every((b) => b.maxY <= 0.25));

const vals = Array.from({ length: 200 }, (_, i) => flicker(i * 0.05));
ok('its light wavers, never out and never far over', Math.min(...vals) > 0.7 && Math.max(...vals) < 1.1 && Math.max(...vals) - Math.min(...vals) > 0.1);

const scene = new THREE.Scene();
const v = new FlameView(scene);
const world = { lights: new Map([['0,10,0', { x: 0, y: 10, z: 0, light }], ['1,10,0', { x: 300, y: 10, z: 0, light: { color: 0xffffff } }]]) };
v.update(world, { x: 2, z: 2 }, 1000);
const lit = v.fires.filter((fire) => fire.group.visible);
ok('flames show over a campfire near you, and nothing else', lit.length === 1 && Math.abs(lit[0].group.position.x - 0.5) < 1e-9);
const h1 = lit[0].tongues.map((t) => t.scale.y).join();
v.update(world, { x: 2, z: 2 }, 1170);
ok('and they move', lit[0].tongues.map((t) => t.scale.y).join() !== h1);
v.update(world, { x: 900, z: 900 }, 2000);
ok('walk away and they go', v.fires.every((fire) => !fire.group.visible));

process.exit(f ? 1 : 0);
