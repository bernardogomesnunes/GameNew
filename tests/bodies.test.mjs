// IMP-28 (owner, 8 November): "physical behaviours when interacting with
// other mobs, like pushing them with my body, or if I hit them they should
// have some slight knock back, this should be a bit higher with sword."
// And how bodies move at all: speed gained and lost, turning, falling,
// water. world/bodies.js, Mobs, Wanderers, Defenders, Army, Guardian.
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Mobs, groundAt } from '../src/world/Mobs.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { Army } from '../src/world/Army.js';
import { Guardian } from '../src/world/Guardian.js';
import { stepAround, settle } from '../src/world/Defenders.js';
import { Crowd, gatherCrowd, knock, drift, ease, turnTo, SWORD_KNOCK, PERSON_RADIUS } from '../src/world/bodies.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { WATER } from '../src/config/blocks.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const flat = (size = 96, top = 0) => {
  const world = new World({ sizeX: size, sizeZ: size, height: 32 });
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) for (let y = 0; y <= top; y++) world.setBlock(x, y, z, 3);
  return world;
};
const far = { x: 5, y: 1, z: 5 };
const animal = (mobs, type, x, z) => {
  const m = mobs.make(MOBS_BY_ID.get(type), x, 1, z);
  m.penId = 'test'; m.timer = 1e9; m.facing = 0;
  mobs.list.push(m);
  return m;
};
/** Hit once from the south (-z), then left alone: how far it went, and how high. */
const struck = (type, power = 1) => {
  const mobs = new Mobs({ world: flat(), rand: rng(1), cap: 0 });
  const m = animal(mobs, type, 48.5, 48.5);
  m.hp = 1e6;
  mobs.hit(m, 1, 48.5, 47.5, power);
  // Only the blow moves it: it stands where it lands.
  let high = m.y, sideways = 0;
  for (let i = 0; i < 120; i++) {
    m.fleeFor = 0; m.angryFor = 0; m.chasing = false; m.target = null; m.speed = 0;
    mobs.move(m, 1 / 60);
    high = Math.max(high, m.y); sideways = Math.max(sideways, Math.abs(m.x - 48.5));
  }
  return { went: m.z - 48.5, high: high - 1, sideways, y: m.y, m };
};

// --- a blow knocks its target back ---------------------------------------------------------------

{
  const chicken = struck('chicken'), deer = struck('deer'), cow = struck('cow'), trike = struck('trike'), neck = struck('longneck');
  ok(`a hit knocks the target back along the blow (a deer ${deer.went.toFixed(2)} blocks, ${deer.sideways.toFixed(3)} sideways)`,
    deer.went > 0.3 && deer.went < 1 && deer.sideways < 1e-6);
  ok(`with a small hop, and back onto the ground (${deer.high.toFixed(2)} up)`, deer.high > 0.05 && deer.high < 0.6 && deer.y === 1);
  ok(`scaled by size: a chicken flies (${chicken.went.toFixed(2)} back, ${chicken.high.toFixed(2)} up)`, chicken.went > 1.2 && chicken.high > 0.6);
  ok(`a cow less than a deer (${cow.went.toFixed(2)})`, cow.went < deer.went && cow.went > 0.1);
  ok(`a triceratops barely moves (${trike.went.toFixed(2)}) and doesn't leave the ground`, trike.went > 0 && trike.went < 0.2 && trike.high === 0);
  ok(`a long-neck less still (${neck.went.toFixed(2)})`, neck.went < trike.went);
  const sword = struck('deer', SWORD_KNOCK);
  ok(`a sword knocks further than a fist (${sword.went.toFixed(2)} against ${deer.went.toFixed(2)})`, sword.went > deer.went * 1.3);
  ok('Game hits harder with a sword in hand, and an arrow less',
    /blowKnock\(tool\) \{\s*return tool\?\.weapon && !tool\.ranged \? SWORD_KNOCK : 1;/.test(game)
    && /this\.mobs\.hit\(mob, this\.blowDamage\(tool\), x, z, this\.blowKnock\(tool\)\)/.test(game)
    && /this\.wanderers\.hit\(p, this\.blowDamage\(tool\) \* \(ambush \? AMBUSH : 1\), x, z, this\.blowKnock\(tool\)\)/.test(game)
    && /arrow\.z - arrow\.vz, ARROW_KNOCK\)/.test(game));
  // The one that fights back is thrown too, and still turns on you.
  const mobs = new Mobs({ world: flat(), rand: rng(2), cap: 0 });
  const raptor = animal(mobs, 'raptor', 48.5, 48.5);
  mobs.hit(raptor, 1, 48.5, 47.5);
  ok('a dinosaur that fights back is knocked back as well', raptor.kz > 0 && raptor.chasing);
  // And the blow that kills.
  const hen = animal(mobs, 'chicken', 40.5, 40.5);
  const res = mobs.hit(hen, 99, 40.5, 39.5);
  for (let i = 0; i < 20; i++) mobs.move(hen, 1 / 60);
  ok('the blow that kills throws it as it falls', res.killed && hen.z > 40.9);
}

{
  // Never up a step, never through a wall.
  const world = flat();
  for (let x = 40; x < 56; x++) { world.setBlock(x, 1, 50, 3); }
  const mobs = new Mobs({ world, rand: rng(3), cap: 0 });
  const m = animal(mobs, 'chicken', 48.5, 49.4);
  m.hp = 1e6;
  let top = 1;
  for (let k = 0; k < 5; k++) {
    mobs.hit(m, 1, 48.5, 47.5);
    for (let i = 0; i < 60; i++) { m.fleeFor = 0; m.target = null; m.speed = 0; mobs.move(m, 1 / 60); top = Math.max(top, m.y); }
  }
  ok(`a blow never throws anything up a step (z ${m.z.toFixed(2)}, feet back at ${m.y})`, m.z < 50 && m.y === 1);
  // Off a ledge it falls, it isn't set down.
  const cliff = flat(96, 3);
  for (let x = 0; x < 96; x++) for (let z = 50; z < 96; z++) for (let y = 2; y <= 3; y++) cliff.setBlock(x, y, z, 0);
  const high = new Mobs({ world: cliff, rand: rng(4), cap: 0 });
  const c = high.make(MOBS_BY_ID.get('chicken'), 48.5, 4, 49.6);
  c.penId = 'test'; c.hp = 1e6; high.list.push(c);
  high.hit(c, 1, 48.5, 48.6);
  const ys = [];
  for (let i = 0; i < 90; i++) { c.fleeFor = 0; c.target = null; c.speed = 0; high.move(c, 1 / 60); ys.push(c.y); }
  const steps = ys.filter((y, i) => i && y < ys[i - 1]).length;
  ok(`knocked off a ledge it falls to the ground below (${steps} frames of falling, lands at ${c.y})`, c.z > 50 && c.y === 2 && steps > 8);
}

{
  // People: the same, by the same rule.
  const world = flat();
  const w = new Wanderers({ world, rand: rng(5), hostile: () => true });
  w.untilMessenger = w.untilExplorer = 1e9;
  const b = w.person('bandit', 48.5, 1, 48.5, { home: { x: 48.5, z: 48.5 } });
  w.list.push(b);
  const before = b.z;
  w.hit(b, 1, 48.5, 47.5);
  ok('a struck bandit is not moved in the same instant', b.z === before && b.kz > 0);
  let high = 1;
  for (let i = 0; i < 40; i++) { b.target = null; b.speed = 0; w.move(b, 1 / 60); high = Math.max(high, b.y); }
  const fist = b.z - before;
  ok(`it is carried back over the next frames (${fist.toFixed(2)} blocks), with a hop (${(high - 1).toFixed(2)})`, fist > 0.35 && fist < 0.8 && high > 1.02 && b.y === 1);
  const c = w.person('bandit', 30.5, 1, 30.5, { home: { x: 30.5, z: 30.5 } });
  w.list.push(c);
  w.hit(c, 1, 30.5, 29.5, SWORD_KNOCK);
  for (let i = 0; i < 40; i++) { c.target = null; c.speed = 0; w.move(c, 1 / 60); }
  ok(`further for a sword (${(c.z - 30.5).toFixed(2)})`, c.z - 30.5 > fist * 1.3);
  const ram = w.person('ram', 60.5, 1, 60.5, { home: { x: 60.5, z: 60.5 } });
  w.hit(ram, 1, 60.5, 59.5);
  ok('a siege engine is not knocked anywhere', !ram.kx && !ram.kz);
  ok('your soldiers, warriors and villagers are knocked back by the raider that hits them',
    /soldierHit\(p, soldier, hits\) \{[\s\S]{0,200}knock\(soldier, p\.x, p\.z, 1, 1, /.test(game));
  ok('and you by any blow, not only a heavy one', /this\.player\.nudge\(this\.player\.position\.x - p\.x, this\.player\.position\.z - p\.z\)/.test(game)
    && /this\.player\.nudge\(this\.player\.position\.x - m\.x/.test(game));
  // A soldier: knocked, carried, landed.
  const s = { x: 20.5, y: 1, z: 20.5, speed: 0 };
  knock(s, 20.5, 19.5);
  let up = 1;
  for (let i = 0; i < 60; i++) { settle(world, s, 1 / 60); up = Math.max(up, s.y); }
  ok(`a soldier struck goes back (${(s.z - 20.5).toFixed(2)}) with a hop and lands`, s.z - 20.5 > 0.35 && up > 1.02 && s.y === 1 && s.vy === 0);
}

// --- bodies push each other apart ---------------------------------------------------------------

const pairsInside = (list, radius) => {
  let n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (Math.abs(list[i].y - list[j].y) > 1.5) continue;
    const min = radius(list[i]) + radius(list[j]);
    // Pressed together they give a little, as a crowd does: inside means well inside.
    if (Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z) < min * 0.7) n++;
  }
  return n;
};

{
  const world = flat();
  const crowd = new Crowd();
  const a = { x: 48.5, y: 1, z: 48.5 }, b = { x: 48.6, y: 1, z: 48.5 };
  for (let i = 0; i < 30; i++) { crowd.clear(); crowd.add(a); crowd.add(b); crowd.resolve(world); }
  ok(`two people in the same place end up apart (${Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)} blocks)`, Math.hypot(a.x - b.x, a.z - b.z) > 0.59);
  ok('each moved, by the same amount', Math.abs((48.55 - a.x) - (b.x - 48.55)) < 1e-6 && a.x < 48.5);
  // Exactly on one another: still apart.
  const c = { x: 30.5, y: 1, z: 30.5 }, d = { x: 30.5, y: 1, z: 30.5 };
  for (let i = 0; i < 30; i++) { crowd.clear(); crowd.add(c); crowd.add(d); crowd.resolve(world); }
  ok('exactly on one another, still apart', Math.hypot(c.x - d.x, c.z - d.z) > 0.59);
  // By weight.
  const person = { x: 20.5, y: 1, z: 20.5 }, trike = { x: 21.2, y: 1, z: 20.5 };
  const spec = MOBS_BY_ID.get('trike');
  for (let i = 0; i < 40; i++) { crowd.clear(); crowd.add(person); crowd.add(trike, spec.radius, spec.mass); crowd.resolve(world); }
  ok(`the lighter gives way: a person ${(20.5 - person.x).toFixed(2)}, a triceratops ${(trike.x - 21.2).toFixed(3)}`,
    20.5 - person.x > 0.4 && trike.x - 21.2 < 0.05 && trike.x - 21.2 > 0);
  // What never moves.
  const engine = { x: 60.5, y: 1, z: 60.5 }, man = { x: 60.9, y: 1, z: 60.5 };
  for (let i = 0; i < 40; i++) { crowd.clear(); crowd.add(engine, 0.7, Infinity); crowd.add(man); crowd.resolve(world); }
  ok('a siege engine is walked round, not shifted', engine.x === 60.5 && man.x - engine.x > 0.99);
  // On different floors they don't touch.
  const up = { x: 70.5, y: 4, z: 70.5 }, down = { x: 70.5, y: 1, z: 70.5 };
  crowd.clear(); crowd.add(up); crowd.add(down);
  ok('one on a wall and one below it don\'t touch', crowd.resolve(world) === 0 && up.x === 70.5);
}

{
  // Not into a wall, not up a step, not off a ledge.
  const world = flat();
  world.setBlock(49, 1, 48, 3); world.setBlock(49, 2, 48, 3); // a wall east of (48, 48)
  const crowd = new Crowd();
  const a = { x: 48.65, y: 1, z: 48.5 }, b = { x: 48.4, y: 1, z: 48.5 };
  for (let i = 0; i < 40; i++) { crowd.clear(); crowd.add(a); crowd.add(b, PERSON_RADIUS, Infinity); crowd.resolve(world); }
  ok(`pushed at a wall, nobody goes into it (x ${a.x.toFixed(2)})`, a.x + 0.28 <= 49 && Math.floor(a.x) === 48);
  const cliff = flat(96, 3);
  for (let x = 50; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 1; y <= 3; y++) cliff.setBlock(x, y, z, 0);
  const c = { x: 49.8, y: 4, z: 48.5 }, d = { x: 49.4, y: 4, z: 48.5 };
  for (let i = 0; i < 60; i++) { crowd.clear(); crowd.add(c); crowd.add(d, PERSON_RADIUS, Infinity); crowd.resolve(cliff); }
  ok(`nor off a ledge (x ${c.x.toFixed(2)}, y ${c.y})`, c.x < 50 && c.y === 4);
  const step = flat();
  for (let z = 40; z < 56; z++) step.setBlock(50, 1, z, 3);
  const e = { x: 49.8, y: 1, z: 48.5 }, g = { x: 49.4, y: 1, z: 48.5 };
  for (let i = 0; i < 60; i++) { crowd.clear(); crowd.add(e); crowd.add(g, PERSON_RADIUS, Infinity); crowd.resolve(step); }
  ok(`nor up a step (x ${e.x.toFixed(2)}, y ${e.y})`, e.x < 50 && e.y === 1);
}

{
  // You.
  const world = flat();
  const mobs = new Mobs({ world, rand: rng(6), cap: 0 });
  const cow = animal(mobs, 'cow', 48.5, 48.5), hen = animal(mobs, 'chicken', 30.5, 30.5);
  const crowd = new Crowd();
  const you = { x: 48.5, y: 1, z: 47.9, pushX: 0, pushZ: 0 };
  gatherCrowd(crowd, { mobs: mobs.list, player: you }).resolve(world);
  ok(`walking into a cow, you are pushed back (${you.pushZ.toFixed(3)}) more than it is pushed on (${(cow.z - 48.5).toFixed(3)})`,
    you.pushZ < 0 && cow.z > 48.5 && -you.pushZ > (cow.z - 48.5) * 2);
  const me = { x: 30.5, y: 1, z: 30.2, pushX: 0, pushZ: 0 };
  gatherCrowd(crowd, { mobs: mobs.list, player: me }).resolve(world);
  ok(`a chicken gets out of your way (${(hen.z - 30.5).toFixed(3)}), you barely slow (${me.pushZ.toFixed(3)})`, hen.z - 30.5 > -me.pushZ * 5);
  gatherCrowd(crowd, { mobs: mobs.list, player: { x: 80, y: 1, z: 80 } }).resolve(world);
  const clear = { x: 80, y: 1, z: 80, pushX: 9, pushZ: 9 };
  gatherCrowd(crowd, { mobs: mobs.list, player: clear }).resolve(world);
  ok('nobody near, nothing pushes you', clear.pushX === 0 && clear.pushZ === 0);
  // The dead, the dying, the ridden and the showcase's take up no room.
  cow.ridden = true; hen.dying = 0.3;
  ok('a mount under you, a falling animal: no room taken', gatherCrowd(crowd, { mobs: mobs.list }).n === 0);
  ok('Game runs it every frame through your own collision, and not for you in the air or the saddle',
    /this\.player\.update\(dt\);\s*this\.keepApart\(\);/.test(game)
    && /who\.player = this\.player\.flying \|\| this\.riding \|\| this\.piloting \|\| this\.driving \? null : self;/.test(game)
    && /this\.player\.moveAndCollide\(self\.pushX, 0, self\.pushZ\)/.test(game));
}

{
  // The crowd the owner stood next to: 60 warriors on the same few enemies, 40 animals at your heel.
  const world = flat(192);
  const you = { x: 96.5, y: 1, z: 96.5, pushX: 0, pushZ: 0 };
  const armies = [new Army({ world, rand: rng(1) }), new Army({ world, rand: rng(2) })];
  for (const a of armies) { a.swear(0); a.command('attack', you, 0); }
  const place = rng(3);
  const enemies = [];
  for (let i = 0; i < 8; i++) enemies.push({ x: 92 + place() * 9, y: 1, z: 86 + place() * 6, dead: false });
  const mobs = new Mobs({ world, rand: rng(4), cap: 0 });
  const kinds = ['cow', 'sheep', 'pig', 'chicken'];
  for (let i = 0; i < 40; i++) animal(mobs, kinds[i % 4], 90 + place() * 13, 98 + place() * 8).timer = 0;
  const warriors = () => [...armies[0].field, ...armies[1].field];
  const radius = (b) => (b.type ? MOBS_BY_ID.get(b.type).radius : PERSON_RADIUS);
  const move = () => { for (const a of armies) a.tick(1 / 30, you, 0, enemies, {}); mobs.tick(1 / 30, you, { lure: true }); };
  for (let i = 0; i < 300; i++) move();
  const stacked = pairsInside([...warriors(), ...mobs.list], radius);
  const crowd = new Crowd(8);
  const who = { mobs: mobs.list, warriors: null, player: you };
  const frame = () => {
    move();
    gatherCrowd(crowd, who);
    for (const w of warriors()) crowd.add(w);
    return crowd.resolve(world);
  };
  for (let i = 0; i < 300; i++) frame();
  const all = [...warriors(), ...mobs.list];
  const after = pairsInside(all, radius);
  ok(`${all.length} bodies: without it ${stacked} pairs stand in one another, with it ${after}`, all.length === 100 && stacked > 200 && after === 0);
  // The grid finds exactly the pairs a search of every pair would.
  gatherCrowd(crowd, who);
  for (const w of warriors()) crowd.add(w);
  let brute = 0;
  for (let i = 0; i < crowd.n; i++) for (let j = i + 1; j < crowd.n; j++) {
    const a = crowd.bodies[i], b = crowd.bodies[j];
    if (Math.abs(a.y - b.y) > 1.5) continue;
    if (Math.hypot(a.x - b.x, a.z - b.z) < Math.fround(crowd.radius[i] + crowd.radius[j])) brute++;
  }
  const found = crowd.resolve(world);
  ok(`the grid finds the pairs an all-pairs search does (${found} of ${brute})`, found === brute);
  // Nothing made per frame: the same arrays, frame after frame.
  const kept = [crowd.bodies, crowd.radius, crowd.inv, crowd.ax, crowd.az, crowd.cx, crowd.cz, crowd.next, crowd.head, crowd.flags];
  for (let i = 0; i < 50; i++) frame();
  const now = [crowd.bodies, crowd.radius, crowd.inv, crowd.ax, crowd.az, crowd.cx, crowd.cz, crowd.next, crowd.head, crowd.flags];
  ok(`its arrays are kept from frame to frame (room for ${crowd.capacity}, grown from 8)`, kept.every((a, i) => a === now[i]) && crowd.capacity >= 101);
  ok('everybody still on the ground, inside the world', all.every((b) => b.y === 1 && Number.isFinite(b.x) && Number.isFinite(b.z)));
  // Far apart, it costs next to nothing and moves nobody.
  const spread = [];
  for (let i = 0; i < 100; i++) spread.push({ x: 10 + (i % 10) * 9, y: 1, z: 10 + Math.floor(i / 10) * 9 });
  crowd.clear();
  for (const b of spread) crowd.add(b);
  ok('a hundred bodies apart: no pairs, nobody moved', crowd.resolve(world) === 0 && spread.every((b, i) => b.x === 10 + (i % 10) * 9));
}

// --- speed is gained and lost; turning is a turn ------------------------------------------------

{
  ok('ease moves by at most its rate', ease(0, 5, 10, 0.1) === 1 && ease(5, 0, 10, 0.1) === 4 && ease(4.95, 5, 10, 0.1) === 5);
  ok('turnTo goes the short way round, a step at a time', Math.abs(turnTo(3, -3, 0.1) - 3.1) < 1e-9 && turnTo(0, 0.05, 0.1) === 0.05);
  const mobs = new Mobs({ world: flat(), rand: rng(7), cap: 0 });
  const m = animal(mobs, 'deer', 48.5, 40.5);
  m.target = { x: 48.5, z: 70.5 }; m.speed = 6.8;
  const paces = [];
  for (let i = 0; i < 40; i++) { mobs.move(m, 1 / 60); paces.push(m.pace); }
  ok(`an animal gathers speed: ${paces[0].toFixed(2)}, ${paces[5].toFixed(2)}, ${paces[39].toFixed(2)} blocks a second`,
    paces[0] < 0.5 && paces[5] > paces[0] && paces[5] < 2 && paces[39] === 6.8);
  // Told to stop, it pulls up.
  m.target = null; m.speed = 0;
  const z0 = m.z;
  mobs.move(m, 1 / 60);
  const first = m.pace;
  for (let i = 0; i < 60; i++) mobs.move(m, 1 / 60);
  ok(`and pulls up over a few steps (${(m.z - z0).toFixed(2)} blocks on) instead of stopping dead`, first > 5 && first < 6.8 && m.pace === 0 && m.z - z0 > 0.5 && m.z - z0 < 2.5);
  // Heavy is slow off the mark.
  const neck = animal(mobs, 'longneck', 20.5, 20.5), hen = animal(mobs, 'chicken', 30.5, 20.5);
  neck.target = { x: 20.5, z: 60 }; neck.speed = 3; hen.target = { x: 30.5, z: 60 }; hen.speed = 3;
  for (let i = 0; i < 6; i++) { mobs.move(neck, 1 / 60); mobs.move(hen, 1 / 60); }
  ok(`a long-neck is slower off the mark than a chicken (${neck.pace.toFixed(2)} against ${hen.pace.toFixed(2)})`, neck.pace < hen.pace * 0.5);
  // Slows into where it's going.
  const cow = animal(mobs, 'cow', 60.5, 20.5);
  cow.target = { x: 60.5, z: 23.5 }; cow.speed = 4.4;
  let fastest = 0, last = 0;
  while (cow.target) { last = cow.pace; mobs.move(cow, 1 / 60); fastest = Math.max(fastest, cow.pace); }
  ok(`it slows into where it's going (${fastest.toFixed(1)} at most, ${last.toFixed(1)} arriving)`, fastest > 3 && last < 2.6);
  // Facing the wrong way, it turns before it goes.
  const turner = animal(mobs, 'sheep', 70.5, 40.5);
  turner.facing = Math.PI; turner.target = { x: 70.5, z: 60 }; turner.speed = 1.1;
  const before = turner.facing;
  mobs.move(turner, 1 / 60);
  const turned = Math.abs(turner.facing - before);
  ok(`facing the other way it turns a little each frame (${turned.toFixed(3)} rad), going slowly meanwhile`, turned > 0 && turned <= 3 / 60 + 1e-9 && turner.pace <= 1.1 * 0.3 + 1e-9);
}

{
  // People on foot.
  const world = flat();
  const s = { x: 20.5, y: 1, z: 20.5, speed: 0 };
  const paces = [];
  for (let i = 0; i < 30; i++) { stepAround(world, s, 20.5, 60, 1 / 60, 3.6); paces.push(s.pace); }
  ok(`a soldier gathers speed (${paces[0].toFixed(2)} … ${paces[29].toFixed(2)})`, paces[0] <= 0.21 && paces[10] < 3.6 && paces[29] === 3.6);
  s.speed = 0;
  stepAround(world, s, 20.5, 60, 1 / 60, 3.6);
  ok('stopped and sent off again, from a standstill again', s.pace <= 0.21);
  // The ground gone from under one: a fall, not a jump down.
  const high = flat(96, 4);
  const t = { x: 30.5, y: 5, z: 30.5, speed: 0 };
  settle(high, t, 1 / 60);
  ok('standing on the ground, a soldier stays on it', t.y === 5);
  for (let y = 2; y <= 4; y++) high.setBlock(30, y, 30, 0);
  const ys = [];
  for (let i = 0; i < 60; i++) { settle(high, t, 1 / 60); ys.push(t.y); }
  ok(`dug out from under, it falls (${ys.filter((y, i) => i && y < ys[i - 1]).length} frames) and lands at ${t.y}`,
    ys[0] < 5 && ys[0] > 4.9 && t.y === 2 && ys.filter((y, i) => i && y < ys[i - 1]).length > 10);
  // The guardian turns its head round, and gets going.
  const g = new Guardian({ world, ring: 'white', home: { x: 48.5, y: 1, z: 48.5 } });
  g.facing = 0;
  g.stepTowards(60, 48.5, 1 / 60, 6.5);
  ok(`the guardian turns towards where it runs (${g.facing.toFixed(2)} rad the first frame) and gathers speed (${g.pace.toFixed(2)})`,
    g.facing > 0.1 && g.facing < 0.2 && g.pace > 0 && g.pace < 1);
  for (let i = 0; i < 40; i++) g.stepTowards(60, 48.5, 1 / 60, 6.5);
  ok('until it faces that way at full speed', Math.abs(g.facing - Math.PI / 2) < 1e-6 && g.pace === 6.5);
}

// --- water ---------------------------------------------------------------------------------------

{
  // A river four wide across the way, its top level with the land.
  const world = flat(96, 1);
  for (let x = 0; x < 96; x++) for (let z = 50; z < 54; z++) world.setBlock(x, 1, z, WATER);
  ok('water is nowhere to stand', groundAt(world, 48.5, 51.5, 2, 2) === null);
  const mobs = new Mobs({ world, rand: rng(8), cap: 0 });
  const cow = mobs.make(MOBS_BY_ID.get('cow'), 48.5, 2, 48.5);
  cow.penId = 'test'; cow.timer = 1e9; cow.facing = 0; mobs.list.push(cow);
  for (let i = 0; i < 300; i++) { cow.target = { x: 48.5, z: 60 }; cow.speed = 4.4; cow.fleeFor = 1; mobs.move(cow, 1 / 60); }
  ok(`a cow stops at the water's edge (z ${cow.z.toFixed(2)})`, cow.z < 50 && cow.y === 2);
  const deer = mobs.make(MOBS_BY_ID.get('deer'), 40.5, 2, 48.5);
  deer.penId = 'test'; deer.timer = 1e9; deer.facing = 0; mobs.list.push(deer);
  for (let i = 0; i < 200; i++) { deer.target = { x: 40.5, z: 60 }; deer.speed = 1.5; deer.fleeFor = 0; mobs.move(deer, 1 / 60); }
  ok(`a deer at a wander keeps out of it too (z ${deer.z.toFixed(2)})`, deer.z < 50);
  let swam = false, lowest = 2, slowest = 9;
  for (let i = 0; i < 400 && deer.z < 56; i++) {
    deer.target = { x: 40.5, z: 60 }; deer.speed = 6.8; deer.fleeFor = 1;
    mobs.move(deer, 1 / 60);
    if (deer.swimming) { swam = true; lowest = Math.min(lowest, deer.y); if (deer.z > 51 && deer.z < 53) slowest = Math.min(slowest, deer.pace); }
  }
  ok(`running for it, a deer swims across (afloat at ${lowest.toFixed(2)}, ${slowest.toFixed(1)} blocks a second) and climbs out`,
    swam && deer.z >= 56 && lowest < 1.6 && lowest > 1 && slowest < 6.8 * 0.61 && !deer.swimming);
  for (let i = 0; i < 30; i++) { deer.target = null; deer.speed = 0; mobs.move(deer, 1 / 60); }
  ok('and stands on the far bank', deer.y === 2);
}

console.log(f ? `\n${f} FAILED` : '\nall passed');
process.exit(f ? 1 : 0);
