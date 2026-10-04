import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { PlayerController } from '../src/player/PlayerController.js';

/**
 * Asked for directly: "on the right we should have two buttons, one with an
 * arrow top to jump, the other arrow down to sneak. This can then be used
 * for fly".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, pointerLockElement: null };

// A ledge: a 4×4 platform of stone at y=4, nothing else for miles.
const STONE = 3;
const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
for (let x = 10; x < 14; x++) for (let z = 10; z < 14; z++) world.setBlock(x, 4, z, STONE);
const player = () => {
  const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 12, y: 5, z: 12 });
  for (let i = 0; i < 30; i++) p.update(1 / 60); // land
  return p;
};
const walk = (p, seconds, z = 1) => {
  p.externalMove.z = z;
  for (let i = 0; i < seconds * 60; i++) p.update(1 / 60);
  p.externalMove.z = 0;
};

{
  const p = player();
  ok('standing on the platform', p.grounded && Math.abs(p.position.y - 5) < 0.01);
  p.sneakHeld = true;
  walk(p, 3);
  ok(`sneaking off the edge stops at it (y ${p.position.y.toFixed(2)})`, p.grounded && Math.abs(p.position.y - 5) < 0.01);
  ok('and still standing on the platform', p.position.z > 9.5 && p.position.z < 14.4 && p.position.x > 9.5 && p.position.x < 14.4);
}
{
  const p = player();
  walk(p, 3);
  ok(`walking off the same edge, you fall (y ${p.position.y.toFixed(2)})`, p.position.y < 4.5);
}
{
  const a = player(), b = player();
  b.sneakHeld = true;
  walk(a, 0.3); walk(b, 0.3);
  const za = a.position.z, zb = b.position.z;
  a.position.set(12, 5, 12); b.position.set(12, 5, 12);
  ok(`a sneak is slower than a walk`, Math.abs(zb - 12) < Math.abs(za - 12) * 0.5);
  b.stickSprint = true; b.sneakHeld = true; b.externalMove.z = 1; b.update(1 / 60);
  ok('and never a run', b.running === false);
}
{
  const p = player();
  p.sneakHeld = true;
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  ok(`your head dips while you sneak (${p.camera.position.y.toFixed(2)})`, p.camera.position.y < 5 + 1.62 - 0.2);
  p.sneakHeld = false;
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  ok('and comes back up after', Math.abs(p.camera.position.y - (5 + 1.62)) < 0.02);
}
{
  const p = player();
  p.flying = true; p.sneakHeld = true;
  p.update(1 / 60);
  ok('flying, Down is not a sneak', p.sneaking === false);
}

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('two buttons on the right: an up arrow and a down arrow', /id="t-jump">\$\{icon\('up'\)\}/.test(ui) && /id="t-down">\$\{icon\('down'\)\}<span id="t-down-label">Sneak<\/span>/.test(ui));
ok('both always showing', !/id="t-down" hidden/.test(ui) && !/#t-down'\)\.hidden/.test(ui));
ok('Jump and Sneak on your feet, Up and Down in the air', /textContent = flying \? 'Up' : 'Jump'/.test(ui) && /textContent = flying \? 'Down' : 'Sneak'/.test(ui));
ok('Down sneaks on your feet and descends in the air', /this\.downHeld = held;\s*this\.player\.sneakHeld = held;\s*this\.recomputeVertical\(\);/.test(game));

process.exit(f ? 1 : 0);
