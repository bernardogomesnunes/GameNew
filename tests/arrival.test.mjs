import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DEFAULT_CONTROLS, loadControls } from '../src/config/controls.js';

/**
 * Two things reported directly:
 *  - "when I log into a world, I fall from the sky, and it hurts. It should
 *    not hurt that time."
 *  - "In desktop fly down is not on shift anymore because of sprint but we
 *    should have both on shift if possible."
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { PlayerController } = await import('../src/player/PlayerController.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const flat = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 96 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  return world;
};
const camera = () => new THREE.PerspectiveCamera(75, 1, 0.2, 500);
const settle = (p, seconds = 6) => { for (let i = 0; i < seconds * 60; i++) p.update(1 / 60); };

// --- arriving doesn't hurt ---------------------------------------------------------------------

{
  const p = new PlayerController(flat(), camera(), { x: 16.5, y: 60, z: 16.5 });
  settle(p);
  ok('come into a world high in the air, and the landing doesn\'t hurt', p.grounded && p.takeLanding() === 0);
  // But after that, a fall is a fall.
  p.position.y = 40; p.velocity.set(0, 0, 0);
  settle(p);
  ok('the next big drop does', p.takeLanding() > 30);
}
{
  const p = new PlayerController(flat(), camera(), { x: 16.5, y: 1, z: 16.5 });
  settle(p, 0.5);
  p.position.y = 30;
  settle(p);
  ok('come in standing on the ground, and a fall straight after still hurts', p.takeLanding() > 20);
}
{
  const p = new PlayerController(flat(), camera(), { x: 16.5, y: 1, z: 16.5 });
  settle(p, 0.5);
  p.teleport(16.5, 50, 16.5); // a respawn, before the ground under you is drawn
  settle(p);
  ok('and waking after a fall, dropping into place doesn\'t hurt either', p.takeLanding() === 0);
}

// --- Ctrl runs, Shift sneaks (asked for directly: "Running in desktop is on
// shift, that should be sneaking, we can have run on ctrl, and ... if I click
// two times front and leave it then it should run too") -------------------------------------

{
  const keys = DEFAULT_CONTROLS.keys;
  ok('Ctrl runs, Shift sneaks', keys.sprint === 'ControlLeft' && keys.down === 'ShiftLeft');
  const p = new PlayerController(flat(), camera(), { x: 16.5, y: 30, z: 16.5 });
  p.flying = true;
  p.keys.add(keys.down);
  const y0 = p.position.y;
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  ok('flying, Shift still takes you down', p.position.y < y0 - 1);
  p.keys.clear();
  p.keys.add(keys.forward);
  for (let i = 0; i < 6; i++) p.update(1 / 60);
  const cruise = Math.hypot(p.velocity.x, p.velocity.z);
  p.keys.add(keys.sprint);
  for (let i = 0; i < 6; i++) p.update(1 / 60);
  ok('and Ctrl flies faster, without going down', Math.hypot(p.velocity.x, p.velocity.z) > cruise && Math.abs(p.velocity.y) < 1e-6);
  p.keys.clear();
  p.flying = false;
  settle(p);
  p.keys.add(keys.forward);
  for (let i = 0; i < 6; i++) p.update(1 / 60);
  const walk = Math.hypot(p.velocity.x, p.velocity.z);
  p.keys.add(keys.sprint);
  for (let i = 0; i < 6; i++) p.update(1 / 60);
  ok('on your feet, Ctrl runs', Math.hypot(p.velocity.x, p.velocity.z) > walk * 1.2);
  p.keys.clear();
  p.keys.add(keys.down);
  p.update(1 / 60);
  ok('and Shift sneaks', p.sneaking && !p.running);
  p.keys.clear();

  // Forward, let go, forward again quickly and hold: running till you let go.
  const press = (code, repeat = false) => p._onKeyDown({ code, repeat, target: null });
  const release = (code) => p._onKeyUp({ code, target: null });
  press(keys.forward); release(keys.forward); press(keys.forward);
  for (let i = 0; i < 6; i++) p.update(1 / 60);
  ok('forward twice, quickly, and held: you run', p.running && Math.hypot(p.velocity.x, p.velocity.z) > walk * 1.2);
  release(keys.forward);
  p.forwardTapAt -= 1000; // a second later
  press(keys.forward);
  ok('let go, and the next press (a moment later) walks again', !p.tapRun);
  release(keys.forward);
}

// Settings saved before the swap, still on the old defaults: swapped. Keys chosen by hand stay.
{
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  store.set('voxelgame:controls', JSON.stringify({ volume: 0.3, keys: { ...DEFAULT_CONTROLS.keys, sprint: 'ShiftLeft', down: 'ControlLeft' } }));
  const old = loadControls();
  ok('saved on the old defaults: Ctrl runs and Shift sneaks now, the rest kept', old.keys.sprint === 'ControlLeft' && old.keys.down === 'ShiftLeft' && old.volume === 0.3);
  store.set('voxelgame:controls', JSON.stringify({ keys: { ...DEFAULT_CONTROLS.keys, sprint: 'KeyQ', down: 'KeyE' } }));
  ok('your own keys are left alone', loadControls().keys.sprint === 'KeyQ');
  store.set('voxelgame:controls', JSON.stringify({ keysVersion: 2, keys: { ...DEFAULT_CONTROLS.keys, sprint: 'ShiftLeft', down: 'ControlLeft' } }));
  ok('and once swapped, choosing Shift to run again sticks', loadControls().keys.sprint === 'ShiftLeft');
}

process.exit(f ? 1 : 0);
