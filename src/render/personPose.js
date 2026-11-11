/**
 * How a person's model stands and moves (render/SettlerView.js): one pose a
 * frame, a turn in radians for each bone, written into arrays made once.
 *
 * A model faces -z. For a limb, +x swings it forward and up; for the body,
 * -x leans it forward and +y brings the right shoulder forward; for the head,
 * +x looks up. An arm's +z lifts the right arm out to the side (the left arm
 * in across the body), and turns a raised arm to the figure's right.
 */

const of = (...ids) => new Set(ids);
/** What each model carries in its right hand (tools/mobs/people.py). */
const SWORD = of('soldier', 'footman', 'swordsman', 'bandit', 'rival_soldier', 'warrior', 'king', 'warlord', 'sky_king', 'dark_god', 'shade');
const SPEAR = of('shield_guard', 'city_guard', 'rival_guard', 'guard', 'sky_guard', 'royal_guard', 'seraph', 'sky_warrior');
const STAFF = of('hermit', 'white_god', 'explorer');
const BOW = of('archer', 'bowman', 'tribe', 'stone_archer');
const SHIELD = of('soldier', 'swordsman', 'shield_guard', 'city_guard', 'rival_guard', 'guard', 'sky_warrior');
const ROBED = of('hermit', 'merchant', 'sky_king', 'white_god', 'dark_god', 'shade');
const WINGED = of('seraph', 'sky_warrior');
/** Work that is a swing of the tool; the rest is carried. */
const CHOPS = of('axe', 'hoe', 'pick', 'hammer', 'tongs');

export const GEAR_NONE = 0, GEAR_SWORD = 1, GEAR_SPEAR = 2, GEAR_STAFF = 3, GEAR_BOW = 4;
const traits = new Map();
/** { gear, shield, robed, winged } for a model id, worked out once. */
export function traitsOf(id) {
  let t = traits.get(id);
  if (!t) {
    t = {
      gear: SWORD.has(id) ? GEAR_SWORD : SPEAR.has(id) ? GEAR_SPEAR : STAFF.has(id) ? GEAR_STAFF : BOW.has(id) ? GEAR_BOW : GEAR_NONE,
      shield: SHIELD.has(id), robed: ROBED.has(id), winged: WINGED.has(id),
    };
    traits.set(id, t);
  }
  return t;
}

/** How long a blow or a loosed arrow plays for, in seconds. */
export const ATTACK_TIME = 0.5;
/** A bow comes up this long before the arrow goes. */
export const DRAW_TIME = 0.9;

export function makePose() {
  return {
    body: [0, 0, 0], head: [0, 0, 0], arm_l: [0, 0, 0], arm_r: [0, 0, 0], leg_l: [0, 0, 0], leg_r: [0, 0, 0],
    wing_l: [0, 0, 0], wing_r: [0, 0, 0],
    /** How far the hips sink this frame, in the model's own units (a block). */
    drop: 0,
  };
}

/** What the pose is made from; a view fills one of these in per person. */
export function makeState() {
  return {
    phase: 0,        // the stride, in radians: sin(phase) is the left leg
    stride: 0,       // 0 standing .. 1 walking
    run: 0,          // 0 a walk .. 1 flat out
    now: 0,          // seconds
    seed: 0,         // the person's own offset, so a crowd isn't in step
    idle: false,     // nowhere to go: they look about
    tool: null,      // a job's tool in hand, at work
    attack: -1,      // 0..1 through a blow; -1 none
    heavy: false,    // the blow follows a wind-up: it starts overhead
    windup: false,   // winding up a heavy blow
    draw: 0,         // 0..1 a bow drawn
    hurt: 0,         // 0..1 just struck
    stunned: false,
    frozen: false,
  };
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;

/** Fills `pose` for one person. Allocates nothing. */
export function posePerson(pose, s, t) {
  const { body, head, arm_l: al, arm_r: ar, leg_l: ll, leg_r: lr, wing_l: wl, wing_r: wr } = pose;
  const st = s.stride, still = 1 - st;
  const sin = Math.sin(s.phase), now = s.frozen ? 0 : s.now, seed = s.seed;

  // --- the walk: legs, arms against them, the shoulders turning into each step.
  const reach = (0.6 + 0.22 * s.run) * (t.robed ? 0.5 : 1) * st;
  const leg = sin * reach;
  ll[0] = leg; ll[1] = 0; ll[2] = 0;
  lr[0] = -leg; lr[1] = 0; lr[2] = 0;
  // Straight legs lift the feet as they swing: the hips come down to meet the ground.
  pose.drop = 0.75 * (1 - Math.cos(leg)) * 0.7;
  const armSwing = Math.sin(s.phase - 0.25) * (0.5 + 0.3 * s.run) * st;
  const breath = Math.sin(now * 1.7 + seed);
  const out = 0.05 + 0.03 * st + 0.015 * breath * still;
  body[0] = -(0.035 + 0.11 * s.run) * st + breath * 0.012 * still;
  body[1] = sin * 0.07 * st;
  // Standing: the weight goes from one foot to the other.
  const shift = Math.sin(now * 0.45 + seed * 1.3) * 0.028 * still;
  body[2] = Math.cos(s.phase) * 0.018 * st + shift;
  head[0] = -body[0] * 0.8;
  head[1] = -body[1];
  head[2] = -shift * 0.6;
  al[0] = -armSwing; al[1] = 0; al[2] = -out;
  ar[0] = armSwing; ar[1] = 0; ar[2] = out;

  // --- what they carry.
  if (t.gear === GEAR_SWORD) ar[0] = 0.1 + armSwing * 0.55;
  else if (t.gear === GEAR_SPEAR) { ar[0] = 0.1 + armSwing * 0.12; ar[2] = 0.02; }
  else if (t.gear === GEAR_STAFF) { ar[0] = 0.12 + sin * 0.22 * st; ar[2] = 0.02; }   // planted with each step
  else if (t.gear === GEAR_BOW) ar[0] = 0.55 + armSwing * 0.15;
  if (t.shield) { al[0] = 0.32 - armSwing * 0.15; al[2] = 0; }

  // --- standing about: they look round, and now and then down or up.
  if (s.idle && !s.frozen) {
    const g = still;
    head[1] += (Math.sin(now * 0.7 + seed) * 0.17 + Math.sin(now * 0.23 + seed * 2.1) * 0.13) * g;
    head[0] += Math.sin(now * 0.5 + seed * 3.3) * 0.05 * g;
  }

  // --- at work: the tool goes up and comes down, three blows and a breather.
  if (s.tool && st < 0.05) {
    if (CHOPS.has(s.tool)) {
      const c = (now * 0.8 + seed) % 3.2;
      if (c < 2.4) {
        const u = (c / 0.8) % 1;
        const a = u < 0.55 ? ease(u / 0.55) : 1 - ease((u - 0.55) / 0.2);
        ar[0] = 0.35 + a * 1.9; ar[2] = 0.05;
        al[0] = 0.3 + a * 1.2; al[2] = 0.3;
        body[0] += (a - 0.55) * 0.2;
        body[1] += (0.5 - a) * 0.2;
        head[0] += (0.5 - a) * 0.15; head[1] = -body[1];
      }
    } else if (s.tool === 'mug') {
      const sip = Math.max(0, Math.sin(now * 0.6 + seed) - 0.75) * 4;
      ar[0] = 0.9 + sip * 0.9; ar[2] = -0.15;
      head[0] += sip * 0.2;
    } else if (s.tool === 'ledger') { ar[0] = 1.0; ar[2] = -0.2; head[0] -= 0.22; head[1] *= 0.3; }
    else if (s.tool === 'staff') ar[0] = 0.25;
    else ar[0] = 0.5;                          // a sack, held up before them
  }

  // --- a bow drawn: side on, the bow arm out, the other hand back to the cheek.
  let draw = s.draw;
  const loosed = t.gear === GEAR_BOW && s.attack >= 0;
  if (loosed) draw = Math.max(draw, 1 - ease(s.attack * 1.4));
  if (t.gear === GEAR_BOW && draw > 0) {
    const d = ease(draw), turn = 0.45 * d;
    body[1] += turn; head[1] -= turn;
    ar[0] = lerp(ar[0], 1.5, d); ar[2] = lerp(ar[2], turn, d);
    al[0] = lerp(al[0], 1.42, d);
    al[2] = lerp(al[2], turn + 0.45 + 0.55 * draw * draw + (loosed ? 0.5 * (1 - s.attack) : 0), d);
  }

  // --- winding up a heavy blow: both arms overhead, leaning back, shaking with it.
  if (s.windup) {
    ar[0] = al[0] = 2.7 + Math.sin(now * 38) * 0.03;
    ar[2] = 0.1; al[2] = -0.1;
    body[0] += 0.2; head[0] -= 0.1;
  }

  // --- a blow.
  if (s.attack >= 0 && t.gear !== GEAR_BOW) {
    const k = s.heavy ? 0.3 + s.attack * 0.7 : s.attack;
    // Back (or up), through, and home again. A spear is upright in the hand,
    // so the arm goes back to level it, point first; a blade tips up from the
    // fist, so it comes over the top and ends level ahead; a bare fist punches.
    const back = ease(k / 0.3), through = ease((k - 0.3) / 0.2), home = ease((k - 0.5) / 0.5);
    const up = t.gear === GEAR_SPEAR ? 0.45 : t.gear === GEAR_NONE ? -0.5 : 2.5;
    const down = t.gear === GEAR_SPEAR ? -1.3 : t.gear === GEAR_NONE ? 1.35 : -0.35;
    const rest = ar[0];
    ar[0] = k < 0.3 ? lerp(rest, up, back) : k < 0.5 ? lerp(up, down, through) : lerp(down, rest, home);
    const lean = k < 0.3 ? 0.13 * back : k < 0.5 ? lerp(0.13, -0.24, through) : -0.24 * (1 - home);
    const twist = k < 0.3 ? -0.3 * back : k < 0.5 ? lerp(-0.3, 0.36, through) : 0.36 * (1 - home);
    body[0] += lean; body[1] += twist;
    head[0] -= lean * 0.7; head[1] -= twist;
    if (s.heavy) al[0] = ar[0];
    // A step into it.
    const step = Math.sin(Math.min(1, Math.max(0, (k - 0.2) / 0.8)) * Math.PI) * still;
    ll[0] += 0.34 * step; lr[0] -= 0.2 * step;
    pose.drop += 0.03 * step;
  }

  // --- struck: thrown back, arms out.
  if (s.hurt > 0) {
    const h = s.hurt;
    body[0] += 0.3 * h; body[1] += (seed % 2 < 1 ? 0.2 : -0.2) * h;
    head[0] += 0.3 * h;
    ar[2] += 0.5 * h; al[2] -= 0.5 * h;
    ar[0] -= 0.25 * h; al[0] -= 0.25 * h;
  }
  if (s.stunned && !s.frozen) {
    head[2] += Math.sin(s.now * 9) * 0.16;
    body[2] += Math.sin(s.now * 4.5) * 0.06;
  }

  // --- wings: a slow beat standing, quicker on the move.
  if (t.winged) {
    const beat = 0.17 + 0.17 * Math.sin(now * (3 + 5 * st) + seed);
    wl[1] = beat; wl[2] = -beat * 0.3;
    wr[1] = -beat; wr[2] = beat * 0.3;
  }
  return pose;
}
