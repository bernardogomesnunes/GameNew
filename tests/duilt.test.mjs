import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};
const FARMLAND=21, WOOD=4;

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 7 });
const scene = new THREE.Scene();
const events = [];
const bus = { emit: (t, p) => events.push({ t, p }) };
const g = new DuiltGame({ world, scene, bus });
g.grantStartingKit();

ok('starts with an axe, bucket and food', g.inventory.countOf('axe')===1 && g.inventory.countOf('bucket')===1 && g.inventory.countOf('fruit')===4);
ok('starts in Age 1 at 32 blocks', g.age === 1 && g.territory.size === 32);

// --- the border ---
const b = g.territory.bounds();
ok('centre is inside the border', g.canEditAt(origin.minX+16, origin.minZ+16).ok);
ok('outside the border is refused', !g.canEditAt(b.maxX + 5, b.minZ).ok);
ok('and it explains why', /outside your land/.test(g.canEditAt(b.maxX+5, b.minZ).reason));

// --- mining fills the bag ---
const before = g.inventory.countOf('wood');
g.onBlocksBroken([{ x:0,y:0,z:0, prev: WOOD, next: 0 }]);
ok('chopping wood fills the bag', g.inventory.countOf('wood') > before);
ok('and it counts toward foraging', g.skills.countOf('foraging') >= 1);

// --- placing spends from it ---
const dirtNeeded = [{x:1,y:1,z:1, prev:0, next:2}];
let pay = g.payForPlacement(dirtNeeded);
ok('cannot place what you do not have', !pay.ok && /need/i.test(pay.reason));
g.inventory.add('dirt', 10);
pay = g.payForPlacement(dirtNeeded);
ok('placing spends the item', pay.ok && g.inventory.countOf('dirt') === 9);
g.refundPlacement(pay.bill);
ok('undo puts it back', g.inventory.countOf('dirt') === 10);

// --- claiming ---
const fx = origin.minX + 2, fz = origin.minZ + 2;
const GY = world.surfaceHeight(fx, fz) - 1;          // whatever the land is here
for (let x=fx;x<fx+4;x++) for (let z=fz;z<fz+4;z++) world.setBlock(x, GY, z, FARMLAND);
world.setBlock(fx+1, GY, fz+5, 11); // water within 6
const region = {minX:fx,maxX:fx+3,minY:GY,maxY:GY+1,minZ:fz,maxZ:fz+3};
const opts = g.claimOptionsFor(region);
ok('claim menu offers every Age 1 building', opts.length === 3);
ok('the farm qualifies', opts.find(o=>o.id==='farm').ok);
ok('the house does not, and says so', !opts.find(o=>o.id==='house').ok);
const claim = g.claim(region, 'farm');
ok('claiming the farm works', claim.ok);
ok('seeds were charged', g.inventory.countOf('seeds') === 2);

// outside the border is refused even if the blocks are right
const far = {minX:b.maxX+2,maxX:b.maxX+5,minY:GY,maxY:GY+1,minZ:fz,maxZ:fz+3};
ok('cannot claim outside your land', !g.claim(far, 'farm').ok);

// --- the age gate ---
let goals = g.ageGoals();
ok('Age 1 has three goals', goals.length === 3);
ok('farm goal is done, others are not', goals.find(x=>x.id==='farm').done && !goals.find(x=>x.id==='house').done);
ok('age does not advance early', g.age === 1);

// satisfy the other two
const hx = origin.minX + 10, hz = origin.minZ + 10;
const HY = world.surfaceHeight(hx, hz);
for (let x=hx;x<hx+5;x++) for (let z=hz;z<hz+5;z++) for (let y=HY;y<HY+4;y++) {
  const shell = x===hx||x===hx+4||z===hz||z===hz+4||y===HY||y===HY+3;
  world.setBlock(x,y,z, shell ? WOOD : 0);
}
g.claim({minX:hx,maxX:hx+4,minY:HY,maxY:HY+3,minZ:hz,maxZ:hz+4}, 'house');
ok('house claimed', g.structures.countOf('house') === 1);
ok('house grants capacity', g.structures.capacity() === 4);

// a forest from the trees the generator planted
let found = null;
outer: for (let x = origin.minX+1; x < origin.minX+24; x++) {
  for (let z = origin.minZ+1; z < origin.minZ+24; z++) {
    const sy = world.surfaceHeight(x, z) - 1;
    const r = {minX:x,maxX:x+7,minY:sy,maxY:sy+9,minZ:z,maxZ:z+7};
    if (!g.territory.containsRegion(r) || g.structures.overlaps(r)) continue;
    if (g.claimOptionsFor(r).find(o=>o.id==='forest').ok) { found = r; break outer; }
  }
}
ok('the generated trees form a claimable forest', found !== null);
if (found) {
  g.claim(found, 'forest');
  ok('claiming the last goal advances the age', g.age === 2);
  ok('and the border doubles to 64', g.territory.size === 64);
  ok('the expansion is announced', events.some(e => e.t === 'duilt:age'));
}

// --- save round trip ---
const saved = JSON.parse(JSON.stringify(g.toJSON()));
const g2 = new DuiltGame({ world, scene, bus: null });
g2.loadJSON(saved);
ok('save restores the age', g2.age === g.age);
ok('save restores the bag', g2.inventory.countOf('axe') === 1);
ok('save restores the buildings', g2.structures.list().length === g.structures.list().length);

process.exit(f?1:0);
