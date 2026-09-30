import * as THREE from 'three';
import { ACTIONS, DEFAULT_CONTROLS, rebind, keyLabel, loadControls, saveControls } from '../src/config/controls.js';
import { World } from '../src/world/World.js';
import { Sound, soundOf } from '../src/audio/Sound.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';

/**
 * Requested directly: "in settings we should add controls to change
 * keyboards, sound, FOV would be a nice to have."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const store = new Map();
globalThis.localStorage ??= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
const { PlayerController } = await import('../src/player/PlayerController.js');

ok('every action has a default key, and no key does two things', new Set(Object.values(DEFAULT_CONTROLS.keys)).size === ACTIONS.length);
const moved = rebind(DEFAULT_CONTROLS, 'forward', 'KeyS');
ok('taking a key another action had swaps them, so nothing is left unbound', moved.keys.forward === 'KeyS' && moved.keys.back === 'KeyW');
ok('keys read the way a person says them', keyLabel('KeyW') === 'W' && keyLabel('ShiftLeft') === 'Left Shift' && keyLabel('Space') === 'Space');

saveControls({ ...DEFAULT_CONTROLS, fov: 95, keys: { ...DEFAULT_CONTROLS.keys, jump: 'KeyJ' } });
const loaded = loadControls();
ok('your choices are remembered', loaded.fov === 95 && loaded.keys.jump === 'KeyJ' && loaded.keys.forward === 'KeyW');

// A rebound key really moves you.
const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
const p = new PlayerController(world, new THREE.Object3D(), { x: 16.5, y: 1, z: 16.5 });
p.binds = { ...rebind(DEFAULT_CONTROLS, 'forward', 'ArrowUp').keys };
p.update(1 / 60);
p.keys.add('KeyW');
for (let i = 0; i < 30; i++) p.update(1 / 60);
const afterOld = p.position.z;
p.keys.clear();
p.keys.add('ArrowUp');
for (let i = 0; i < 30; i++) p.update(1 / 60);
ok('walking follows the key you chose', Math.abs(afterOld - 16.5) < 0.01 && p.position.z < afterOld - 1);

// Sound: silent until a click allows it, and safe to call before.
const s = new Sound({ volume: 0.5 });
let threw = false;
try { s.place('stone'); s.walk(3, 'dirt'); s.creak(true); s.eat(); s.click(); } catch { threw = true; }
ok('sounds before audio is allowed are silently skipped', !threw && !s.ready);
s.setVolume(2);
ok('volume stays between off and full', s.volume === 1);
ok('each block sounds like what it is made of',
  soundOf(BLOCKS_BY_ID.get(3)) === 'stone' && soundOf(BLOCKS_BY_ID.get(7)) === 'wood' && soundOf(BLOCKS_BY_ID.get(10)) === 'glass');

process.exit(f ? 1 : 0);
