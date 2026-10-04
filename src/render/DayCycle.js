import * as THREE from 'three';
import { SkyDome, heightFog, mistAt } from './atmosphere.js';

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
/** How much light a Helm of Night Sight keeps, however dark it gets. */
export const NIGHT_SIGHT_AMBIENT = 0.5;
const NIGHT_SIGHT_HEMI = 0.28;
/** Where a brand new world's clock starts: mid-morning. */
export const MORNING = 0.32;

/*
 * The sky's colours: the horizon (which the fog matches) and the top of the
 * sky above it (see atmosphere.js's SkyDome) — a deeper blue overhead by day,
 * a warm band and a violet-blue overhead at sunset, near black at night.
 */
const SKY_DAY = new THREE.Color(0xb3dbf5);
const SKY_NIGHT = new THREE.Color(0x0f1834);
const SKY_DUSK = new THREE.Color(0xf7a46c);
const ZENITH_DAY = new THREE.Color(0x4f93dc);
const ZENITH_NIGHT = new THREE.Color(0x050a1c);
const ZENITH_DUSK = new THREE.Color(0x5b6aae);
/** The glow round the sun: faint by day, a wide orange wash as it sets. */
const GLOW_DAY = new THREE.Color(0x4a4232);
const GLOW_DUSK = new THREE.Color(0xff8a3c);
/*
 * Light with contrast (plan section 2): a warmer sun, and shade filled by a
 * cooler sky, so a lit face and a shaded one differ in colour as well as in
 * brightness. Low down the sun turns gold.
 */
const SUN_DAY = new THREE.Color(0xffe6bf);
const SUN_LOW = new THREE.Color(0xffb46e);
const AMBIENT_DAY = new THREE.Color(0xd9e4ff);
const AMBIENT_DUSK = new THREE.Color(0xe6c7d6);
const AMBIENT_NIGHT = new THREE.Color(0xaab4cf);
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
    // Less fill and more sun than before tone mapping came in (see
    // atmosphere.js): the contrast between a lit face and a shaded one is
    // most of what makes a wall read as solid.
    ambient: 0.15 + 0.33 * day,
    // Up quickly at sunrise and late to go at sunset, so the low gold light
    // gets a real share of the day.
    sun: 1.3 * smooth(-0.05, 0.12, e),
    moon: 0.3 * (1 - day),
    hemi: 0.08 + 0.42 * day,
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

    this.moonLight = new THREE.DirectionalLight(0xc4d0f0, 0);
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

    this.dome = new SkyDome(scene);
    /** The mist that lies low (atmosphere.js) — the graphics setting turns it off. */
    this.atmosphere = true;

    this.sky = new THREE.Color();
    this.zenith = new THREE.Color();
    this.cloudColor = new THREE.Color();
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

    this.sky.copy(SKY_NIGHT).lerp(SKY_DAY, l.day).lerp(SKY_DUSK, l.dusk * 0.6);
    this.zenith.copy(ZENITH_NIGHT).lerp(ZENITH_DAY, l.day).lerp(ZENITH_DUSK, l.dusk * 0.5);
    if (this.scene.background?.isColor) this.scene.background.copy(this.sky);
    this.scene.fog?.color.copy(this.sky);

    // A Helm of Night Sight (playtest, P6): the dark never gets dark.
    this.ambient.intensity = this.nightSight ? Math.max(l.ambient, NIGHT_SIGHT_AMBIENT) : l.ambient;
    this.ambient.color.copy(AMBIENT_NIGHT).lerp(AMBIENT_DAY, l.day).lerp(AMBIENT_DUSK, l.dusk * 0.7);
    this.sunLight.intensity = l.sun;
    this.sunLight.color.copy(SUN_DAY).lerp(SUN_LOW, l.dusk);
    this.moonLight.intensity = l.moon;
    this.hemi.intensity = this.nightSight ? Math.max(l.hemi, NIGHT_SIGHT_HEMI) : l.hemi;
    // The shade is lit by the sky overhead, not the pale horizon: cool.
    this.hemi.color.copy(this.sky).lerp(this.zenith, 0.55);
    this.hemi.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, l.day);
    this.cloudColor.copy(CLOUD_NIGHT).lerp(CLOUD_DAY, l.day).lerp(CLOUD_DUSK, l.dusk * 0.7);
    this.clouds?.setColor?.(this.cloudColor);

    // The sun rises in the east (+x), crosses the south, sets in the west.
    const a = (this.time - 0.25) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.35).normalize();

    const dome = this.dome.uniforms;
    dome.horizon.value.copy(this.sky);
    dome.zenith.value.copy(this.zenith);
    dome.glow.value.copy(GLOW_DAY).lerp(GLOW_DUSK, l.dusk).multiplyScalar(Math.max(0, Math.min(1, (l.sunHeight + 0.25) * 4)));
    dome.glowWidth.value = 10 - 6 * l.dusk;
    dome.sunDir.value.copy(dir);

    // Mist that lies low: thick at dawn, thin by day (atmosphere.js).
    const mist = mistAt(this.time, l.day, l.dusk);
    this.mist = mist;
    heightFog.mistDensity.value = this.atmosphere ? mist.density : 0;
    // Three adds fog after converting to the screen's colours; so does this.
    mist.color.getRGB(heightFog.mistColor.value, THREE.SRGBColorSpace);
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

    // The sphere's flat faces sit a little inside its radius.
    this.dome.follow(eye, camera ? camera.far * 0.93 : reach);
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
