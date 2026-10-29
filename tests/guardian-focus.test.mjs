// IMP-5: "Aurelion should kill the mobs the user attacks." ... "ONLY ENEMIES YES."
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Guardian } from '../src/world/Guardian.js';

let failed = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) failed++; };
const flat = () => {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  return world;
};
const player = { x: 20.5, y: 1, z: 20.5 };
const enemy = (x, z) => ({ x, y: 1, z, dead: false });

// The one you struck beats a nearer one.
{
  const g = new Guardian({ world: flat(), ring: 'white', home: { x: 20.5, y: 1, z: 20.5 } });
  g.mode = 'attack';
  const near = enemy(24.5, 20.5), struck = enemy(34.5, 20.5);
  g.tick(0.1, player, [near, struck]);
  ok('without a blow it goes for the nearest enemy', g.target === near);
  g.focus(struck);
  g.tick(0.1, player, [near, struck]);
  ok('after you strike one, it goes for that one first', g.target === struck);
}

// Follow mode too, from beyond its usual guard range.
{
  const g = new Guardian({ world: flat(), ring: 'white', home: { x: 20.5, y: 1, z: 20.5 } });
  const far = enemy(44.5, 20.5);
  g.tick(0.1, player, [far]);
  ok('following, it ignores an enemy out of range', g.target === null);
  g.focus(far);
  g.tick(0.1, player, [far]);
  ok('following, it still goes for the enemy you struck', g.target === far);
}

// Stay keeps holding.
{
  const g = new Guardian({ world: flat(), ring: 'white', home: { x: 20.5, y: 1, z: 20.5 } });
  g.mode = 'stay';
  const far = enemy(44.5, 20.5);
  g.focus(far);
  g.tick(0.1, player, [far]);
  ok('told to stay, it holds its ground', g.target === null);
}

// Only enemies: a creature not in the list it is given is never chosen.
{
  const g = new Guardian({ world: flat(), ring: 'white', home: { x: 20.5, y: 1, z: 20.5 } });
  g.mode = 'attack';
  const cow = enemy(22.5, 20.5);
  g.focus(cow);
  g.tick(0.1, player, []);
  ok('something that is not on the enemy list is never its target', g.target === null && g.focused === null);
}

// It lets go: dead, or the clock runs out.
{
  const g = new Guardian({ world: flat(), ring: 'white', home: { x: 20.5, y: 1, z: 20.5 } });
  g.mode = 'attack';
  const struck = enemy(34.5, 20.5);
  g.focus(struck);
  struck.dead = true;
  g.tick(0.1, player, [struck]);
  ok('it lets go of one that is dead', g.focused === null);
  const other = enemy(30.5, 20.5);
  g.focus(other);
  for (let i = 0; i < 140; i++) g.tick(0.1, player, [other]);
  ok('it lets go after twelve seconds', g.focused === null);
}

// Wiring: a blow on a person tells the guardian.
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('your blow on a person focuses the guardian', /else this\.duilt\?\.guardian\?\.focus\(p\)/.test(game));

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
