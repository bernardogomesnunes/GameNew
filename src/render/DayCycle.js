import * as THREE from 'three';

/**
 * Day and night. Requested directly: "night and day is pretty standard, and
 * should be done."
 *
 * One number, `time`, runs 0..1 round the clock: 0 midnight, 0.25 sunrise,
 * 0.5 noon, 0.75 sunset. Everything else is read off how high the sun is:
 * the sky and the fog behind it, how much light the ambient, sun and
 * hemisphere lights give, the colour of the clouds, a square sun and moon
 * crossing the sky, and the stars coming out. Every block in the game is lit
 * by those three lights (they're all Lambert), so dimming them is what makes
 * night dark — and what makes a lantern worth hanging.
 *
 * Night passes twice as fast as day, so it's long enough to notice and short
 * enough not to be a chore: ten minutes of daylight, five of dark.
 */

/** Real seconds for the sun to cross from sunrise to sunset. */
export const DAYLIGHT_SECONDS = 600;
/** How much faster the clock runs while the sun is down. */
const NIGHT_SPEED = 2;
/** How fast the stars turn, as a fraction of the sun and moon's speed. */
export const STAR_DRIFT = 0.12;
/** Where a brand new world's clock starts: mid-morning. */
export const MORNING = 0.32;

const SKY_DAY = new THREE.Color(0xadd7f5);
const SKY_NIGHT = new THREE.Color(0x0f1834);
const SKY_DUSK = new THREE.Color(0xf2a67e);
const SUN_DAY = new THREE.Color(0xfff3d6);
const SUN_LOW = new THREE.Color(0xffb27a);
const CLOUD_DAY = new THREE.Color(0xfbfaf4);
const CLOUD_NIGHT = new THREE.Color(0x3b4563);
const CLOUD_DUSK = new THREE.Color(0xf6c3a4);
const GROUND_DAY = new THREE.Color(0x7f6445);
const GROUND_NIGHT = new THREE.Color(0x1d1a24);

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How high the sun is at a time of day: 1 at noon, 0 on the horizon, -1 at midnight. */
export function sunHeight(time) {
  return Math.sin((time - 0.25) * Math.PI * 2);
}

/**
 * What the sky and the lights should be at a time of day, as plain numbers
 * — kept apart from the Three.js objects so it can be tested on its own.
 */
export function daylightAt(time) {
  const e = sunHeight(time);
  const day = smooth(-0.18, 0.22, e);   // 0 full night .. 1 full day
  const dusk = Math.max(0, 1 - Math.abs(e) / 0.28) * smooth(-0.3, 0, e + 0.1);
  return {
    sunHeight: e,
    day,
    dusk,
    ambient: 0.13 + 0.47 * day,
    sun: 0.85 * smooth(-0.04, 0.18, e),
    moon: 0.2 * (1 - day),
    hemi: 0.07 + 0.33 * day,
    // Out as soon as the sky starts going dark, not once it's black.
    // Reported directly: "Stars should start appearing in the sky as soon
    // as the sky goes dark."
    stars: 1 - smooth(0.25, 0.8, day),
  };
}

export class DayCycle {
  constructor(scene, { ambient, sun, hemi, clouds = null }) {
    this.scene = scene;
    this.ambient = ambient;
    this.sunLight = sun;
    this.hemi = hemi;
    this.clouds = clouds;
    this.time = MORNING;

    this.moonLight = new THREE.DirectionalLight(0xa9bcff, 0);
    scene.add(this.moonLight);

    // A square sun and moon — this is a world of blocks.
    const disc = (color, size) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, depthWrite: false }),
      );
      m.renderOrder = -2;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.sunDisc = disc(0xfff1c2, 40);
    this.moonDisc = disc(0xe8ecf5, 26);

    const STARS = 700;
    const pos = new Float32Array(STARS * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < STARS; i++) {
      // Only the upper sky, and none right down on the horizon where the
      // fog and the hills are.
      const y = 0.08 + rand() * 0.92, a = rand() * Math.PI * 2, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      // Small: a pinprick, not a dot.
      color: 0xffffff, size: 1.25, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.stars.renderOrder = -3;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sky = new THREE.Color();
    this.apply();
  }

  /** Runs the clock on by `dt` seconds. */
  advance(dt) {
    const night = sunHeight(this.time) < 0;
    this.time = (this.time + (dt * (night ? NIGHT_SPEED : 1)) / (DAYLIGHT_SECONDS * 2)) % 1;
  }

  /** Brings the sky and the lights in line with the clock, round the camera. */
  apply(camera = null, reach = 400) {
    const l = daylightAt(this.time);
    this.light = l;

    this.sky.copy(SKY_NIGHT).lerp(SKY_DAY, l.day).lerp(SKY_DUSK, l.dusk * 0.55);
    if (this.scene.background?.isColor) this.scene.background.copy(this.sky);
    this.scene.fog?.color.copy(this.sky);

    this.ambient.intensity = l.ambient;
    this.sunLight.intensity = l.sun;
    this.sunLight.color.copy(SUN_DAY).lerp(SUN_LOW, l.dusk);
    this.moonLight.intensity = l.moon;
    this.hemi.intensity = l.hemi;
    this.hemi.color.copy(this.sky);
    this.hemi.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, l.day);
    this.clouds?.setColor?.(new THREE.Color().copy(CLOUD_NIGHT).lerp(CLOUD_DAY, l.day).lerp(CLOUD_DUSK, l.dusk * 0.6));

    // The sun rises in the east (+x), crosses the south, sets in the west.
    const a = (this.time - 0.25) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.35).normalize();
    this.sunLight.position.copy(dir).multiplyScalar(100);
    this.moonLight.position.copy(dir).multiplyScalar(-100);

    const eye = camera?.position ?? new THREE.Vector3();
    const r = reach * 0.85;
    this.sunDisc.position.copy(eye).addScaledVector(dir, r);
    this.moonDisc.position.copy(eye).addScaledVector(dir, -r);
    this.sunDisc.lookAt(eye);
    this.moonDisc.lookAt(eye);
    this.sunDisc.visible = dir.y > -0.1;
    this.moonDisc.visible = dir.y < 0.1;
    this.moonDisc.material.opacity = 0.35 + 0.65 * (1 - l.day);

    this.stars.position.copy(eye);
    this.stars.scale.setScalar(r * 0.98);
    this.stars.material.opacity = 0.9 * l.stars;
    this.stars.visible = l.stars > 0.01;
    // The stars wheel slowly, far behind the moon — reported directly: they
    // "move with the moon, it does not make sense, they should move in some
    // kind of parallax, slower than the moon."
    this.stars.rotation.z = a * STAR_DRIFT;
  }
}
