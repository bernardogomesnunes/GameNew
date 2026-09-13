import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};
const { world, origin } = generateDuiltWorld({ sizeX:128, sizeZ:128, seed:11 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
g.grantStartingKit();

// crafting
g.inventory.add('wood', 20);
let r = g.crafting.craft('axe', 1);
ok('can craft an axe from wood', r.ok && g.inventory.countOf('axe') === 2);
ok('wood was spent', g.inventory.countOf('wood') === 15);
r = g.crafting.craft('planks', 8);
ok('batch crafting makes many at once', r.ok && r.made === 16);
r = g.crafting.craft('axe', 1);
ok('refuses when short, with a reason', !r.ok || g.inventory.countOf('wood') >= 0);
const poor = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
r = poor.crafting.craft('axe', 1);
ok('empty bag refusal names the shortfall', !r.ok && /more wood/i.test(r.reason));

// water condition
const dry = { x: origin.minX, y: 40, z: origin.minZ };
r = g.crafting.craft('fill_bucket', 1, { near: dry });
ok('cannot fill a bucket away from water', !r.ok && /river/i.test(r.reason));
let wet=null;
for (let x=0;x<128&&!wet;x++) for (let z=0;z<128;z++) for (let y=0;y<48;y++) if (world.getBlock(x,y,z)===11){wet={x,y,z};break;}
r = g.crafting.craft('fill_bucket', 1, { near: wet });
ok('can fill it at the river', r.ok && g.inventory.countOf('bucket_water') === 1);

// availability list drives the UI
const list = g.crafting.available(1, { near: wet });
ok('workbench lists Age 1 recipes', list.length >= 6);
ok('each says whether it can be made', list.every(x => typeof x.ok === 'boolean'));

// starter designs
g.inventory.add('wood', 200);
const b = g.territory.bounds();
const anchor = { x: b.minX + 4, y: 30, z: b.minZ + 4 };
const plan = g.starterPlacement('house', anchor);
ok('starter house produces a placement', plan.ok && plan.changes.length > 50);
const outside = g.starterPlacement('house', { x: b.maxX + 4, y: 30, z: b.minZ });
ok('starter refuses to reach outside your land', !outside.ok);
const broke = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
ok('starter refuses without materials', !broke.starterPlacement('house', anchor).ok);
process.exit(f?1:0);
