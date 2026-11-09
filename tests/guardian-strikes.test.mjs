// Owner, 8 November: "Aurelion does not attack them, it stays in place and
// they die." Its blows landed with nothing shown, and it never turned to
// what it struck. Now it faces its target and lunges when it strikes; told
// to attack, it hunts round you as well as round itself.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Guardian, STRIKE_SHOWS } from '../src/world/Guardian.js';

const world = new World({ sizeX: 96, sizeZ: 96, height: 16 });
for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) world.setBlock(x, 0, z, 3);
const make = (mode) => { const g = new Guardian({ world, ring: 'white', home: { x: 40.5, y: 1, z: 40.5 } }); g.mode = mode; return g; };

{
  const g = make('stay');
  g.facing = 0; // looking +z
  const foe = { x: 42.5, y: 1, z: 40.5, hp: 99 };   // beside it, to +x, in reach
  const strikes = [];
  g.tick(0.05, { x: 40.5, y: 1, z: 40.5 }, [foe], { strike: (e) => strikes.push(e) });
  assert.equal(strikes.length, 1, 'it strikes what is in reach');
  assert.ok(Math.abs(g.facing - Math.PI / 2) < 1e-6, `it turns to face it (${g.facing.toFixed(2)})`);
  assert.ok(g.striking > 0 && g.striking <= STRIKE_SHOWS, 'and the blow shows');
  for (let i = 0; i < 20; i++) g.tick(0.05, { x: 40.5, y: 1, z: 40.5 }, [], {});
  assert.equal(g.striking, 0, 'the lunge ends');
}
console.log('PASS it turns to what it strikes, and the blow shows as a lunge');

{
  const g = make('attack');
  const you = { x: 70.5, y: 1, z: 40.5 };          // 30 from it
  const foe = { x: 74.5, y: 1, z: 40.5, hp: 99 };  // 4 from you, 34 from it
  g.tick(0.05, you, [foe], {});
  assert.equal(g.target, foe, 'told to attack, it goes for an attacker near you');
  const x0 = g.x;
  for (let i = 0; i < 40; i++) g.tick(0.05, you, [foe], {});
  assert.ok(g.x > x0 + 5, `and runs to it (${(g.x - x0).toFixed(1)} blocks)`);
}
console.log('PASS told to attack, it hunts round you as well as round itself');

// Owner, 8 November: "a distance attack, like fire a beam out of its mouth".
{
  const g = make('stay');
  const foe = { x: 48, y: 1, z: 40.5, hp: 99 };   // 7.5 blocks off
  const strikes = [];
  const x0 = g.x;
  g.tick(0.05, { x: 40.5, y: 1, z: 40.5 }, [foe], { strike: (e, n) => strikes.push(n) });
  assert.equal(strikes.length, 1, 'it fires at what is 7.5 blocks off');
  assert.ok(g.beam && Math.abs(g.beam.x - foe.x) < 1e-9, 'the beam goes to it');
  assert.equal(g.x, x0, 'from where it stands');
  for (let i = 0; i < 20; i++) g.tick(0.05, { x: 40.5, y: 1, z: 40.5 }, [], {});
  assert.equal(g.beam, null, 'and fades');
}
console.log('PASS it fires a beam from where it stands, out to 10 blocks');
