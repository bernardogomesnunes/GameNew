import * as THREE from 'three';
import { DayCycle, daylightAt, sunHeight, MORNING, DAYLIGHT_SECONDS } from '../src/render/DayCycle.js';

/** Requested directly: "night and day is pretty standard, and should be done." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const noon = daylightAt(0.5), midnight = daylightAt(0), dusk = daylightAt(0.75);
ok('noon is full day', noon.day > 0.99 && noon.sun > 0.8 && noon.stars === 0);
ok('midnight is dark, lit by the moon, with stars', midnight.day < 0.01 && midnight.sun === 0 && midnight.moon > 0.1 && midnight.stars > 0.99);
ok('night is dark but not black — you can still see where you are', midnight.ambient > 0.1 && midnight.ambient < noon.ambient / 3);
ok('sunset is its own colour', dusk.dusk > 0.9 && noon.dusk === 0 && midnight.dusk === 0);
ok('a new world starts in the morning, sun up', sunHeight(MORNING) > 0.3);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(0xffffff, 1, 2);
const ambient = new THREE.AmbientLight(), sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
let tint = null;
const cycle = new DayCycle(scene, { ambient, sun, hemi, clouds: { setColor: (c) => { tint = c; } } });

// A whole day, a frame at a time.
let t = 0, frames = 0, sawNight = false, sawDay = false, dayFrames = 0, nightFrames = 0;
cycle.time = 0.5;
while (t < 1 && frames < 1e6) {
  const before = cycle.time;
  cycle.advance(1 / 20);
  t += ((cycle.time - before) + 1) % 1;
  frames++;
  if (sunHeight(cycle.time) > 0) { sawDay = true; dayFrames++; } else { sawNight = true; nightFrames++; }
}
const seconds = frames / 20;
ok(`a whole day takes ${Math.round(seconds / 60)} minutes`, Math.abs(seconds - DAYLIGHT_SECONDS * 1.5) < 5);
ok(`night passes twice as fast as day (${(dayFrames / nightFrames).toFixed(2)}×)`, sawDay && sawNight && Math.abs(dayFrames / nightFrames - 2) < 0.05);

cycle.time = 0; cycle.apply();
const dark = scene.background.clone();
ok('at night the sky, the fog and the clouds go dark', dark.r + dark.g + dark.b < 0.5 && scene.fog.color.equals(dark) && tint.r < 0.4);
ok('and the stars are out, and the moon up', cycle.stars.visible && cycle.moonDisc.visible && !cycle.sunDisc.visible);
cycle.time = 0.5; cycle.apply();
ok('by day the sky is blue again and the sun is up', scene.background.b > 0.9 && cycle.sunDisc.visible && !cycle.stars.visible && sun.intensity > 0.8);

{
  // Stars come out as the sky darkens, not only once it's black.
  const { STAR_DRIFT } = await import('../src/render/DayCycle.js');
  let firstStars = null;
  for (let t = 0.7; t < 0.85; t += 0.002) {
    if (daylightAt(t).stars > 0.05) { firstStars = t; break; }
  }
  const at = daylightAt(firstStars);
  ok(`the first stars show while the sky is still going dark (sky ${Math.round(at.day * 100)}% day, sun ${at.sunHeight.toFixed(2)})`,
    firstStars != null && at.day > 0.3 && at.sunHeight > 0);
  ok('and they are all out by the time it is night', daylightAt(0.82).stars > 0.95);

  // They drift far slower than the moon.
  const c = new DayCycle(new THREE.Scene(), { ambient: new THREE.AmbientLight(), sun: new THREE.DirectionalLight(), hemi: new THREE.HemisphereLight() });
  c.time = 0.9; c.apply();
  const s0 = c.stars.rotation.z, m0 = c.moonDisc.position.clone();
  c.time = 0.95; c.apply();
  const starTurn = Math.abs(c.stars.rotation.z - s0), moonTurn = (0.05) * Math.PI * 2;
  ok(`the stars turn at a fraction of the moon's pace (${(starTurn / moonTurn).toFixed(2)}×)`, starTurn > 0 && starTurn / moonTurn < 0.2 && Math.abs(STAR_DRIFT - starTurn / moonTurn) < 1e-9);
  ok('and they are small', c.stars.material.size <= 1.5);
}

process.exit(f ? 1 : 0);
