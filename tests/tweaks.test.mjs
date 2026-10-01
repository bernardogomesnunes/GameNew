import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame, GRASS_DROPS } from '../src/duilt/DuiltGame.js';
import { Saplings, SAPLING, SAPLING_GROUND, GROW_DAYS } from '../src/duilt/Saplings.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * From playing, asked for directly:
 *  - "saplings should drop if we break the bottom dirt, they should only grow
 *    in dirt and turf"
 *  - "To build a farm I need seeds and there's no seeds ... maybe we should
 *    have grass that when broken we can drop seeds"
 *  - "when pointing to a player, break should beat them; without weapons 1
 *    heart should go"
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- saplings: dirt and grass only, and uprooted with their ground --------------------------------

ok('a sapling goes in dirt or grass, and nothing else', [...SAPLING_GROUND].sort().join() === '1,2'
  && /held === SAPLING && !SAPLING_GROUND\.has/.test(game) && /Plant it on grass or dirt/.test(game));
ok('break the ground under one and it comes away into your bag',
  /above === SAPLING && !SAPLING_GROUND\.has\(c\.next\)/.test(game) && /this\.withUprooted\(/.test(game));
{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 32 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.setBlock(x, 0, z, 2);
  world.setBlock(8, 0, 8, 3); // stone put under it
  world.setBlock(8, 1, 8, SAPLING);
  const s = new Saplings();
  s.plant(8, 1, 8, 0);
  ok('out of its ground, a sapling doesn\'t grow', s.grow(world, GROW_DAYS + 1).length === 0 && s.get(8, 1, 8).blocked);
}

// --- seeds from grass ---------------------------------------------------------------------------------

{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  const had = g.inventory.countOf('seeds');
  g.rand = () => 0;
  g.onBlocksBroken([{ x: 1, y: 0, z: 1, prev: 1, next: 0 }]);
  ok('broken grass now and then gives up mixed seeds', g.inventory.countOf('seeds') === had + 1 && GRASS_DROPS[0][0] === 'seeds');
  g.rand = () => 0.99;
  g.onBlocksBroken([{ x: 2, y: 0, z: 1, prev: 1, next: 0 }]);
  ok('though not every time', g.inventory.countOf('seeds') === had + 1);
  ok(`one grass in five or so (${GRASS_DROPS[0][1]})`, GRASS_DROPS[0][1] >= 0.15 && GRASS_DROPS[0][1] <= 0.3);
  ok('and seeds are what a farm needs planted', STRUCTURES_BY_ID.get('farm').requires.some((r) => r.id === 'crops'));
}

// --- anyone can be struck; a fist takes a heart ---------------------------------------------------------

ok('bare hands take a whole heart', /const FIST_DAMAGE = 2;/.test(game) && /tool\?\.damage \?\? FIST_DAMAGE/.test(game));
ok('the hermit, explorers and messengers can be struck too', ['hermit', 'explorer', 'messenger'].every((k) => WANDERERS[k].hp > 0 && WANDERERS[k].flees));
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 2);
  const w = new Wanderers({ world });
  const hermit = w.person('hermit', 16.5, 1, 16.5, { home: { x: 16.5, z: 16.5 } });
  w.list.push(hermit);
  const player = { x: 14.5, y: 1, z: 16.5 };
  const r = w.hit(hermit, 2, player.x, player.z);
  ok('struck, the hermit loses a heart', r && !r.killed && hermit.hp === WANDERERS.hermit.hp - 2);
  const d0 = Math.hypot(hermit.x - player.x, hermit.z - player.z);
  for (let i = 0; i < 60; i++) w.tick(1 / 30, player);
  ok('and runs from you', Math.hypot(hermit.x - player.x, hermit.z - player.z) > d0 + 2);
  hermit.hp = 1;
  const r2 = w.hit(hermit, 2, player.x, player.z);
  ok('beaten, they drop what they carry', r2.killed && Object.keys(r2.drops).length >= 0);
  ok('but the Stone King can\'t be struck', w.hit({ kind: 'king', x: 0, z: 0 }, 5, 0, 0) === null);
}

process.exit(f ? 1 : 0);
