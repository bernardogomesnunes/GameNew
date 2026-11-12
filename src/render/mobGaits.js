/**
 * How each animal moves (owner, 11 November: "improve their 3d model,
 * animations"). A pose is { bone: [x, y, z] } radians on top of the model's
 * rest pose (render/Models.js), plus `lift`, how far the whole animal rises
 * off the ground this frame, in blocks.
 *
 * Each species has a gait for walking and one for running:
 *   walk    four beats, one foot after another (hind left, fore left, hind right, fore right)
 *   trot    two beats, the diagonal pairs together, the body bouncing twice a stride
 *   gallop  the hind pair then the fore pair, the body rocking and leaving the ground once a stride
 *   hop     both hind feet together: the rabbit's bound, off the ground between landings
 *   strut   a bird's two legs in turn, its head held still then thrust forward each step
 *   crawl   a lizard's sprawl: diagonal pairs, the spine bending side to side
 * A leg goes back steadily while its foot is down and comes forward quickly
 * in the air. The neck nods against the bob, drops to graze (and comes up
 * now and then for a look round), the ears flick, the tail swishes or wags.
 *
 * Nothing here allocates: a pose's arrays are made once and written in place.
 */

import { poseBone } from './Models.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);

/** Writes a bone's turn into the pose, making its array the first time only. */
export function put(pose, name, x, y, z) {
  const a = pose[name];
  if (a) { a[0] = x; a[1] = y; a[2] = z; } else pose[name] = [x, y, z];
}

/** Where a leg is in its swing, 1 fully forward to -1 fully back: 60% of a stride on the ground, 40% in the air. */
export function legWave(p) {
  p = frac(p);
  if (p < 0.6) return 1 - p / 0.3;
  const u = (p - 0.6) / 0.4;
  return -1 + 2 * u * u * (3 - 2 * u);
}

/** A pulse that is 0 most of the time and rises to 1 for a moment, every 2π / rate seconds. */
const pulse = (t, rate, width) => { const s = Math.sin(t * rate) - (1 - width); return s > 0 ? s / width : 0; };

// When each foot lands, as a fraction of the stride: [fore left, fore right, hind left, hind right].
const BEATS = {
  walk: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  gallop: [0.5, 0.62, 0, 0.12],
  hop: [0.5, 0.5, 0, 0],
  crawl: [0, 0.5, 0.5, 0],
};
// How far a leg swings (radians) and how long a stride is, in leg lengths plus a little.
const REACH = { walk: 0.42, trot: 0.55, gallop: 0.78, hop: 0.9, crawl: 0.5, strut: 0.6 };
const STRIDE = { walk: [1.5, 0.15], trot: [2, 0.3], gallop: [3.2, 1], hop: [0, 1], crawl: [1.7, 0.2], strut: [2, 0.2] };

/**
 * Each species: its gaits, how far the neck and head drop to graze, its
 * tail (swish: hangs and swings; flag: short, wags, up when it runs; curl:
 * wiggles; lash: held out behind, swinging; chain: in parts, each after the
 * last), and its ears (up: pricked, laid back at a run; side: out sideways).
 */
export const GAITS = {
  cow: { walk: 'walk', run: 'trot', graze: [-1.25, -0.55], tail: 'swish', ears: 'side', heavy: 1 },
  moon_cow: { walk: 'walk', run: 'trot', graze: [-1.25, -0.55], tail: 'swish', ears: 'side', heavy: 1 },
  deer: { walk: 'walk', run: 'gallop', graze: [-1.9, 0.45], tail: 'flag', ears: 'up' },
  rabbit: { walk: 'hop', run: 'hop', graze: [0, -0.35], tail: 'flag', ears: 'up' },
  boar: { walk: 'walk', run: 'trot', graze: [0, -0.5], tail: 'curl', ears: 'up', heavy: 0.6 },
  goat: { walk: 'walk', run: 'gallop', graze: [-1.8, 0.3], tail: 'flag', ears: 'side' },
  sheep: { walk: 'walk', run: 'trot', graze: [-1.3, -0.5], tail: 'flag', ears: 'side' },
  pig: { walk: 'walk', run: 'trot', graze: [0, -0.45], tail: 'curl', ears: 'up', heavy: 0.6 },
  chicken: { walk: 'strut', run: 'strut', graze: [-0.7, -0.5], tail: 'flag', ears: null },
  horse: { walk: 'walk', run: 'gallop', graze: [-1.95, 0.6], tail: 'swish', ears: 'up' },
  basilisk: { walk: 'crawl', run: 'crawl', graze: [-0.2, -0.1], tail: 'chain', ears: null, jaw: 1 },
  aurelion: { walk: 'walk', run: 'gallop', graze: [-1.8, 0.4], tail: 'flag', ears: 'up' },
  umbra: { walk: 'walk', run: 'gallop', graze: [-0.4, -0.2], tail: 'lash', ears: 'up', jaw: 1 },
  warbeast: { walk: 'walk', run: 'trot', graze: [-1.7, 0.45], tail: 'swish', ears: 'up', heavy: 1 },
};

const BONES = ['body', 'neck', 'head', 'ears', 'jaw', 'tail', 'tail1', 'tail2', 'tail3', 'leg_fl', 'leg_fr', 'leg_bl', 'leg_br', 'leg_l', 'leg_r', 'wing_l', 'wing_r', 'crystal'];

/** A pose with every bone these animals have, at rest. */
export function makePose() {
  const pose = { lift: 0 };
  for (const b of BONES) pose[b] = [0, 0, 0];
  return pose;
}

/** How long one stride is, in blocks, for a leg `leg` blocks long. */
export function strideLength(gait, leg, speed) {
  const s = STRIDE[gait];
  return gait === 'hop' ? 0.9 + speed * 0.25 : s[0] * leg + s[1];
}

/**
 * Fills `pose` for one animal. `g` is its entry in GAITS; `s` says what it is doing:
 *   p         where it is in its stride, in strides (any number; the fraction is used)
 *   moving    walking or running
 *   running   at its run
 *   size      its height at the shoulder, in blocks (the bob scales with it)
 *   t         seconds, offset per animal so a herd is out of step
 *   grazing, chasing
 *   look, nod a standing animal's glance about (radians)
 */
export function gaitPose(pose, g, s) {
  const { p, moving, running, size, t } = s;
  const gait = running ? g.run : g.walk;
  const look = s.look ?? 0, nod = s.nod ?? 0;
  let lift = 0, pitch = 0, roll = 0, yaw = 0;
  let neck = 0, head = 0;
  const reach = moving ? REACH[gait] * (running && gait === 'trot' ? 1.15 : 1) : 0;

  if (gait === 'strut') {
    // A bird: one leg, then the other; the head held back as the body goes
    // on, then thrust forward, once a step.
    put(pose, 'leg_l', legWave(p) * reach, 0, 0);
    put(pose, 'leg_r', legWave(p + 0.5) * reach, 0, 0);
    if (moving) {
      const u = frac(p * 2);
      const hold = u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.3;
      neck = -0.3 + hold * 0.55;
      head = -neck * 0.9;
      lift = Math.abs(Math.sin(p * TAU)) * 0.02;
      roll = Math.sin(p * TAU) * 0.07;
      pitch = running ? -0.18 : 0;
    }
    // Wings: out and beating at a run, a shake of them now and then at rest.
    const shake = moving ? 0 : pulse(t, 0.5, 0.04);
    const flap = running ? 0.55 + Math.sin(t * 34) * 0.5 : shake * (0.35 + Math.sin(t * 30) * 0.3);
    put(pose, 'wing_l', 0, 0, -flap);
    put(pose, 'wing_r', 0, 0, flap);
  } else {
    const beats = BEATS[gait];
    put(pose, 'leg_fl', legWave(p - beats[0]) * reach, 0, 0);
    put(pose, 'leg_fr', legWave(p - beats[1]) * reach, 0, 0);
    put(pose, 'leg_bl', legWave(p - beats[2]) * reach, 0, 0);
    put(pose, 'leg_br', legWave(p - beats[3]) * reach, 0, 0);
    if (moving) {
      const a = p * TAU;
      if (gait === 'walk') {
        lift = (0.5 - 0.5 * Math.cos(a * 2)) * 0.02 * size;
        roll = Math.sin(a) * (0.02 + 0.025 * (g.heavy ?? 0));
        neck = Math.sin(a * 2 + 0.6) * 0.05;
        head = -neck * 0.5;
      } else if (gait === 'trot') {
        lift = (0.5 - 0.5 * Math.cos(a * 2)) * 0.055 * size;
        roll = Math.sin(a) * 0.02;
        pitch = Math.sin(a * 2) * 0.02;
        neck = Math.sin(a * 2 + 0.9) * 0.07 - 0.08;
        head = -neck * 0.6;
      } else if (gait === 'gallop') {
        // The hind feet drive it up and forward, it hangs, the fore feet take the landing.
        lift = Math.max(0, Math.sin(a - 0.5)) * 0.14 * size;
        pitch = Math.sin(a - 1.1) * 0.1;
        neck = -0.28 - Math.sin(a - 1.1) * 0.12;
        head = 0.16 + Math.sin(a - 1.6) * 0.06;
      } else if (gait === 'hop') {
        // Off the hind feet, up and over, down onto the fore feet.
        const u = frac(p);
        const air = u < 0.7 ? Math.sin((u / 0.7) * Math.PI) : 0;
        lift = air * (running ? 0.34 : 0.2);
        pitch = u < 0.7 ? Math.cos((u / 0.7) * Math.PI) * 0.32 : -0.32 + ((u - 0.7) / 0.3) * 0.32;
        head = -pitch * 0.7;
        put(pose, 'leg_bl', u < 0.7 ? -0.9 + (u / 0.7) * 1.5 : 0.6 - ((u - 0.7) / 0.3) * 1.5, 0, 0);
        put(pose, 'leg_br', pose.leg_bl[0], 0, 0);
        put(pose, 'leg_fl', u < 0.7 ? 0.2 + air * 0.5 : 0.2 - ((u - 0.7) / 0.3) * 0.4, 0, 0);
        put(pose, 'leg_fr', pose.leg_fl[0], 0, 0);
      } else if (gait === 'crawl') {
        yaw = Math.sin(a) * 0.07;
        roll = Math.sin(a) * 0.03;
        lift = (0.5 - 0.5 * Math.cos(a * 2)) * 0.02 * size;
        neck = running ? 0.12 : 0;
      }
    }
  }

  // Standing: breathing, a glance about; a rabbit sits up for a look.
  if (!moving && !s.grazing) {
    neck += nod * 0.65;
    head += nod;
    if (gait === 'hop') {
      const up = pulse(t, 0.45, 0.25);
      pitch = up * 0.4;
      lift = up * 0.07;
      head -= up * 0.3;
    }
  }
  // Grazing: the head down, nibbling, and up now and then to look about.
  let glance = look;
  if (s.grazing) {
    const up = pulse(t, 0.55, 0.12);
    const down = 1 - up;
    const nibble = Math.sin(t * (gait === 'strut' ? 5.5 : 7));
    if (gait === 'strut') {
      // A hen pecks: down sharply, and back.
      const peck = Math.max(0, nibble) ** 3;
      neck = g.graze[0] * (0.35 + peck * 0.65) * down;
      head = g.graze[1] * (0.4 + peck * 0.6) * down;
      pitch = -0.4 * (0.4 + peck * 0.6) * down;
    } else {
      neck = g.graze[0] * down + nibble * 0.03 * down;
      head = g.graze[1] * down + nibble * 0.05 * down;
      if (!g.graze[0]) pitch = -0.08 * down;          // no neck to speak of: it leans into it
    }
    glance = up * Math.sin(t * 0.9) * 0.5;
  }

  put(pose, 'body', pitch, yaw, roll);
  put(pose, 'neck', neck, glance * 0.55 - yaw * 0.5, 0);
  put(pose, 'head', head, glance - yaw * 0.5, -roll);
  pose.lift = lift;

  // Ears: a flick now and then, one way then the other; laid back at a run.
  if (g.ears) {
    const flick = pulse(t * 1.7 + 1, 1, 0.1) * Math.sin(t * 26);
    if (g.ears === 'up') put(pose, 'ears', running ? 0.55 : flick * 0.3 + (s.grazing ? 0.15 : 0), flick * 0.12, 0);
    else put(pose, 'ears', running ? 0.25 : 0, flick * 0.3, 0);
  }

  // Tail.
  const stride = moving ? Math.sin(p * TAU * 2) : 0;
  if (g.tail === 'swish') {
    const swat = pulse(t * 0.8 + 2, 1, 0.3);
    put(pose, 'tail', running ? -0.85 + stride * 0.12 : moving ? -0.12 : 0, 0,
      running ? Math.sin(t * 9) * 0.12 : Math.sin(t * 1.4) * 0.07 + swat * Math.sin(t * 7) * 0.45);
  } else if (g.tail === 'flag') {
    const wag = pulse(t * 0.9 + 4, 1, 0.25);
    put(pose, 'tail', running ? -0.9 : stride * 0.1, wag * Math.sin(t * 16) * 0.45, 0);
  } else if (g.tail === 'curl') {
    put(pose, 'tail', stride * 0.15, 0, Math.sin(t * (moving ? 13 : 5)) * (moving ? 0.35 : 0.15));
  } else if (g.tail === 'lash') {
    put(pose, 'tail', running ? -0.35 : stride * 0.06, Math.sin(t * (s.chasing ? 5 : 1.7)) * (s.chasing ? 0.5 : 0.3), 0);
  } else if (g.tail === 'chain') {
    // Each part swings after the one before; walking, the wave runs down it from the hips.
    const rate = moving ? p * TAU : t * 0.9;
    const amp = moving ? 0.26 : 0.12;
    put(pose, 'tail', 0, -yaw + Math.sin(rate - 0.9) * amp, 0);
    put(pose, 'tail1', 0, Math.sin(rate - 1.8) * amp, 0);
    put(pose, 'tail2', 0, Math.sin(rate - 2.7) * amp * 1.1, 0);
    put(pose, 'tail3', 0, Math.sin(rate - 3.6) * amp * 1.2, 0);
  }

  // Jaws: snapping on the hunt, a gape now and then otherwise. A jaw opens downwards.
  if (g.jaw) {
    const open = s.chasing ? Math.max(0, Math.sin(t * 7)) * 0.5 : pulse(t, 0.45, 0.07) * 0.45;
    put(pose, 'jaw', -open, 0, 0);
  }
  return pose;
}

/**
 * An animal out in the world (world/Mobs.js): its stride is the distance
 * it has walked, so its feet keep pace with the ground.
 */
export function beastPose(pose, m, spec, now, phase, look, nod) {
  const g = GAITS[m.type];
  const moving = m.speed > 0;
  const running = moving && m.speed >= (spec.walk + spec.run) / 2;
  const s = SCRATCH;
  s.p = (m.stride ?? 0) / strideLength(running ? g.run : g.walk, spec.leg, m.speed) + phase;
  s.moving = moving; s.running = running;
  s.size = spec.leg + spec.body.h;
  s.t = now + phase;
  s.grazing = !!m.grazing; s.chasing = !!m.chasing;
  s.look = look; s.nod = nod;
  return gaitPose(pose, g, s);
}
const SCRATCH = { p: 0, moving: false, running: false, size: 1, t: 0, grazing: false, chasing: false, look: 0, nod: 0 };

/** Turns a dressed model's bones (Models.dress) to a pose. */
export function applyPose(bones, pose) {
  for (let i = 0; i < BONES.length; i++) {
    const b = bones[BONES[i]];
    if (!b) continue;
    const r = pose[BONES[i]];
    poseBone(b, r[0], r[1], r[2]);
  }
}

const TAILS = ['tail0', 'tail1', 'tail2'];

/**
 * A dinosaur (tools/mobs/dinos.py: a neck in two parts, a head with a jaw, a
 * tail in three), reviewed 11 November. The raptor runs like a bird, leaning
 * into it with its neck out and its tail held stiff behind; the triceratops
 * walks four beats with a heavy roll and trots when it charges, its horns
 * down; the long-neck paces slowly, its neck swaying. The tail swings part
 * after part, in time with the stride. Grazing, the neck goes down (it went
 * up before: the turn was the wrong way round), and the jaw opens downwards.
 */
export function dinoPose(pose, m, now, phase, look, nod, swing, spec) {
  const t = now + phase;
  const moving = m.speed > 0;
  const running = moving && (spec ? m.speed >= (spec.walk + spec.run) / 2 : m.speed > 3);
  const leg = spec?.leg ?? 1.12;
  const size = leg + (spec?.body.h ?? 1);
  const raptor = m.type === 'raptor', longneck = m.type === 'longneck';
  const gait = raptor ? 'strut' : running ? 'trot' : 'walk';
  const p = (m.stride ?? 0) / strideLength(gait, leg, m.speed) + phase;
  const a = p * TAU;
  const reach = moving ? (raptor ? (running ? 0.8 : 0.55) : running ? 0.5 : 0.36) : 0;
  let pitch = 0, roll = 0, lift = 0;

  if (raptor) {
    put(pose, 'leg_l', legWave(p) * reach, 0, 0);
    put(pose, 'leg_r', legWave(p + 0.5) * reach, 0, 0);
    if (moving) {
      lift = Math.abs(Math.sin(a)) * (running ? 0.1 : 0.04);
      roll = Math.sin(a) * 0.05;
      pitch = running ? -0.16 : -0.04;
    }
  } else {
    const beats = BEATS[gait];
    put(pose, 'leg_fl', legWave(p - beats[0]) * reach, 0, 0);
    put(pose, 'leg_fr', legWave(p - beats[1]) * reach, 0, 0);
    put(pose, 'leg_bl', legWave(p - beats[2]) * reach, 0, 0);
    put(pose, 'leg_br', legWave(p - beats[3]) * reach, 0, 0);
    if (moving) {
      lift = (0.5 - 0.5 * Math.cos(a * 2)) * (running ? 0.035 : 0.012) * size;
      roll = Math.sin(a) * (longneck ? 0.025 : 0.045);
      pitch = running ? Math.sin(a * 2) * 0.02 : 0;
    }
  }
  put(pose, 'body', pitch, 0, roll);
  pose.lift = lift;

  // The tail: side to side, each part after the one before; at a run the
  // raptor's is held up stiff and only its end whips.
  const beat = moving ? a : t * 0.8;
  const amp = moving ? (raptor && running ? 0.1 : 0.2) : 0.12;
  for (let i = 0; i < 3; i++) put(pose, TAILS[i], i === 0 ? -pitch * 0.8 : 0, Math.sin(beat - 0.6 - i * 0.9) * amp * (1 + i * 0.25), i === 0 ? -roll : 0);

  // The neck and head.
  const step = moving ? Math.sin(a * 2 + 0.6) : 0;
  const up = m.grazing ? pulse(t, 0.5, 0.12) : 0;
  const down = m.grazing ? 1 - up : 0;
  const nibble = down * Math.sin(t * 6) * 0.04;
  const glance = m.grazing ? up * Math.sin(t * 0.9) * 0.5 : look;
  if (longneck) {
    const browse = Math.sin(t * 0.35) * 0.12;
    put(pose, 'neck0', m.grazing ? -0.85 * down : browse + step * 0.025, glance * 0.5, 0);
    put(pose, 'neck1', m.grazing ? -0.75 * down : -browse * 0.5, glance * 0.6, 0);
    put(pose, 'head', m.grazing ? -0.3 * down + nibble : nod - browse * 0.5, glance * 0.3, -roll);
  } else {
    // A raptor at a run stretches its neck out ahead; a triceratops charging drops its horns.
    const thrust = running ? (raptor ? -0.3 : m.chasing ? -0.22 : -0.08) : 0;
    put(pose, 'neck0', -0.45 * down + thrust - pitch * 0.5 + (moving ? step * 0.05 : nod), glance * 0.4, 0);
    put(pose, 'neck1', -0.35 * down + (raptor && moving ? -step * 0.04 : 0), glance * 0.4, 0);
    put(pose, 'head', -0.25 * down + nibble + (running ? (raptor ? 0.34 : m.chasing ? -0.2 : 0) : moving ? 0 : nod), glance * (raptor ? 0.5 : 0.3), -roll);
  }
  const snap = m.chasing ? Math.max(0, Math.sin(t * 7)) * 0.5 : pulse(t, 0.45, 0.07) * 0.45;
  put(pose, 'jaw', -snap, 0, 0);
}
