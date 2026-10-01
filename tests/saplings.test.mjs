import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { DuiltGame, LEAF_DROPS } from '../src/duilt/DuiltGame.js';
import { Saplings, SAPLING, GROW_DAYS, treeFor, treeStyleAt } from '../src/duilt/Saplings.js';
import { BIOMES } from '../src/config/biomes.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { boxesFor } from '../src/world/propShapes.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Playtest, P8. Asked for directly: "Sapling should be a 3D model, and
 * should grow into a tree in 10 game days. Let's remove the sapling from the
 * world generation and it needs to be planted. Leaves should drop saplings
 * from time to time, as fruit."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const features = readFileSync(new URL('../src/world/features.js', import.meta.url), 'utf8');

const flat = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 48 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 1);
  return world;
};

// --- a 3D sapling ------------------------------------------------------------------------

ok('a sapling is a model, not a cube: a stem and leaves', BLOCKS_BY_ID.get(SAPLING).shape === 'sapling'
  && boxesFor('sapling').length >= 6 && boxesFor('sapling').some((b) => b.maxX - b.minX < 0.1 && b.maxY > 0.7));
{
  const w = flat();
  w.setBlock(4, 1, 4, SAPLING);
  ok('you walk through it', w.collisionBoxAt(4, 1, 4) === null);
}
ok('drawn as itself in the bag', (itemIcon(ITEMS_BY_ID.get('sapling')) ?? '').startsWith('<svg'));

// --- none in the wild ---------------------------------------------------------------------

ok('no biome scatters saplings any more', BIOMES.every((b) => !(b.scatter ?? []).some((s) => s.block === SAPLING)));
ok('nor does the starting grove or the riverbank scrub', !/SAPLING/.test(features));
{
  const gen = new ChunkGen({ seed: 4242 });
  const world = new World({ height: 128, gen });
  let saplings = 0;
  for (let cx = -3; cx <= 3; cx++) {
    for (let cz = -3; cz <= 3; cz++) {
      const chunk = world.getChunk(cx, cz);
      for (let i = 0; i < chunk.data.length; i++) if (chunk.data[i] === SAPLING) saplings++;
    }
  }
  ok(`49 chunks of fresh world, and not one sapling in them (${saplings})`, saplings === 0);
}

// --- ten game days ------------------------------------------------------------------------

{
  const world = flat();
  world.setBlock(10, 1, 10, SAPLING);
  const s = new Saplings();
  s.plant(10, 1, 10, 3.2);
  ok('ten days to grow', GROW_DAYS === 10 && s.daysLeft(10, 1, 10, 3.2) === 10 && s.daysLeft(10, 1, 10, 12.5) === 1);
  ok('nothing on day nine', s.grow(world, 12.1).length === 0 && world.getBlock(10, 1, 10) === SAPLING);
  const back = new Saplings();
  back.loadJSON(JSON.parse(JSON.stringify(s.toJSON())));
  const grown = back.grow(world, 13.3);
  ok('on day ten it is a tree, saved and loaded or not', grown.length > 10 && world.getBlock(10, 1, 10) === 4 && world.getBlock(10, 2, 10) === 4);
  ok('with a crown of leaves on top', grown.filter((c) => c.next === 5).length >= 10);
  ok('and the sapling is forgotten', back.planted.size === 0);
}
{
  const world = flat();
  world.setBlock(10, 1, 10, SAPLING);
  world.setBlock(10, 3, 10, 9); // a brick ceiling two above it
  const s = new Saplings();
  s.plant(10, 1, 10, 0);
  ok('under a roof it waits for room rather than growing through it', s.grow(world, GROW_DAYS).length === 0 && s.get(10, 1, 10).blocked);
  world.setBlock(10, 3, 10, 0);
  ok('and grows once the roof is gone', s.grow(world, GROW_DAYS + 1).length > 0);
}
{
  const world = flat();
  const s = new Saplings();
  s.plant(5, 1, 5, 0); // planted, then broken some way that didn't say
  s.grow(world, GROW_DAYS);
  ok('a sapling that has gone is forgotten', s.planted.size === 0);
}
{
  const dark = BIOMES.find((b) => b.trees?.wood === 43);
  ok('a fixed world with no land behind it grows an oak', treeStyleAt(flat(), 3, 3).wood === 4);
  ok('a sapling grows the wood of the land it stands in', !!dark && treeStyleAt({ gen: { biomeIndexAt: () => BIOMES.indexOf(dark), seed: 1 } }, 0, 0).wood === 43);
  ok('the same shape as a wild tree', /treeShape\(put, x, z, tree, this\.seed\)/.test(readFileSync(new URL('../src/world/ChunkGen.js', import.meta.url), 'utf8')));
}
{
  // The trees it grows are of every size a wild tree comes in.
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  const trunks = new Set();
  for (let x = 6; x < 60; x += 7) for (let z = 6; z < 60; z += 7) {
    const cells = treeFor(world, x, 1, z);
    if (cells) trunks.add(cells.filter((c) => c.x === x && c.z === z && c.block === 4).length);
  }
  ok(`and as many sizes (${[...trunks].sort((a, b) => a - b).join(', ')} tall)`, trunks.size >= 3);
}

// --- leaves drop them ------------------------------------------------------------------------

{
  const world = flat();
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  const had = g.inventory.countOf('sapling');
  g.rand = () => 0; // always lucky
  g.onBlocksBroken([{ x: 1, y: 5, z: 1, prev: 5, next: 0 }]);
  ok('a broken leaf can drop a sapling and a fruit, as well as itself',
    g.inventory.countOf('sapling') === had + 1 && g.inventory.countOf('leaves') >= 1);
  const before = g.inventory.countOf('sapling');
  g.rand = () => 0.99; // never
  g.onBlocksBroken([{ x: 1, y: 5, z: 1, prev: 44, next: 0 }]);
  ok('though most of the time it is just leaves', g.inventory.countOf('sapling') === before);
  ok('one leaf in ten or so', LEAF_DROPS.find(([id]) => id === 'sapling')[1] === 0.1);
  g.days = 23.5;
  g.saplings.plant(1, 1, 1, 20);
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the days and what is planted are saved with the world', back.days === 23.5 && back.saplings.get(1, 1, 1)?.at === 20);
}

// --- in the game -----------------------------------------------------------------------------

ok('a sapling only goes in the ground', /held === SAPLING && !isSoil\(this\.world\.getBlock\(t\.x, t\.y - 1, t\.z\)\)/.test(game) && /Saplings go in the ground/.test(game));
ok('planted, it counts from that day', /this\.duilt\.saplings\.plant\(c\.x, c\.y, c\.z, this\.duilt\.days\)/.test(game));
ok('and broken, it is forgotten', /this\.duilt\.saplings\.remove\(c\.x, c\.y, c\.z\)/.test(game));
ok('the world counts its days as the clock turns', /this\.duilt\.days \+= \(this\.dayCycle\.time - clockWas \+ 1\) % 1/.test(game));
ok('and grows what is due', /this\.duilt\.saplings\.grow\(this\.world, this\.duilt\.days\)/.test(game));
ok('pointed at, it says how long', /Sapling · a tree in \$\{left\} days/.test(game));

process.exit(f ? 1 : 0);
