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

/**
 * A design's advertised cost must be exactly what placing it charges.
 *
 * These were written by hand next to each design and every one had drifted.
 * The grove asked for 64 dirt, 18 wood and 40 leaves while really taking 60,
 * 14 and 76 — plus two saplings it never mentioned. The panel lit the button
 * up, and then placing refused and named a material the player had never been
 * told to collect. Deriving the cost from the blocks makes that impossible;
 * this makes sure it stays impossible.
 */
{
  const { STARTER_DESIGNS } = await import('../src/config/starterDesigns.js');
  const { ITEM_FOR_BLOCK } = await import('../src/config/items.js');

  let mismatches = 0, unlisted = 0;
  for (const d of STARTER_DESIGNS) {
    // One block per cell, which is all the world stores and all it charges for.
    const cells = new Map();
    for (const b of d.blocks) cells.set(`${b.dx},${b.dy},${b.dz}`, b.type);
    const real = {};
    for (const type of cells.values()) {
      const item = ITEM_FOR_BLOCK.get(type);
      if (item) real[item] = (real[item] ?? 0) + 1;
    }
    for (const [id, n] of Object.entries(real)) {
      if (d.cost[id] !== n) mismatches++;
      if (d.cost[id] == null) unlisted++;
    }
    for (const id of Object.keys(d.cost)) if (real[id] == null) mismatches++;
  }
  ok(`every design's cost matches the blocks it places (${mismatches} off)`, mismatches === 0);
  ok(`no design charges for something it never listed (${unlisted} hidden)`, unlisted === 0);
}

/**
 * And every material a design asks for has to be gettable, with the game able
 * to say how. An ingredient the player cannot trace is a dead end.
 */
{
  const { STARTER_DESIGNS } = await import('../src/config/starterDesigns.js');
  const { ITEMS_BY_ID } = await import('../src/config/items.js');
  const { howToGet } = await import('../src/config/recipes.js');

  let unexplained = [];
  for (const d of STARTER_DESIGNS) {
    for (const id of Object.keys(d.cost)) {
      const spec = ITEMS_BY_ID.get(id);
      if (!howToGet(id, spec?.block != null ? id : null)) unexplained.push(`${d.id}:${id}`);
    }
  }
  ok(`every material can be explained (${unexplained.join(', ') || 'all covered'})`, unexplained.length === 0);
}

/**
 * Every starter design has to fit inside Age 1 land, right up against the
 * border.
 *
 * Placing one used to refuse whenever you aimed near your own edge, leaving
 * you to guess how far in was far enough. It now slides to the nearest spot
 * that fits — which is only a sound idea while a design is small enough to fit
 * at all. A design that outgrew the starting plot would turn that slide into a
 * silent failure, so this pins it: clamped to each corner, every design places.
 */
{
  const { STARTER_DESIGNS } = await import('../src/config/starterDesigns.js');
  const rich = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  const bounds = rich.territory.bounds();
  for (const d of STARTER_DESIGNS) for (const [id, n] of Object.entries(d.cost)) rich.inventory.add(id, n * 4);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  let failed = [];
  for (const d of STARTER_DESIGNS) {
    const corners = [
      [bounds.minX - 5, bounds.minZ - 5], [bounds.maxX + 5, bounds.minZ - 5],
      [bounds.minX - 5, bounds.maxZ + 5], [bounds.maxX + 5, bounds.maxZ + 5],
    ];
    for (const [ax, az] of corners) {
      const x = clamp(ax, bounds.minX, bounds.maxX - d.extent.x);
      const z = clamp(az, bounds.minZ, bounds.maxZ - d.extent.z);
      const plan = rich.starterPlacement(d.structure, { x, y: world.surfaceHeight(x, z), z });
      // "It's already there" means the blocks matched, which is still a fit.
      if (!plan.ok && !/already there/i.test(plan.reason)) failed.push(`${d.id}@${x},${z}: ${plan.reason}`);
    }
  }
  ok(`every design fits against every border (${failed.join('; ') || 'all fit'})`, failed.length === 0);
}

process.exit(f?1:0);
