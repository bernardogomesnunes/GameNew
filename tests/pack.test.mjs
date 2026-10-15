import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Mobs } from '../src/world/Mobs.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';

/**
 * Time travel, part two: a dinosaur army, and a creature out of legend
 * (backlog batch 4, D3: "taming: feed a dinosaur to tame it, then ride it or
 * have it fight beside you ... build an army of dinosaurs", "dinosaurs and
 * mythological creatures"). Asked for directly: "Nice keep going".
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const { Game } = await import('../src/Game.js');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('every dinosaur fights for you, the long-neck hardest', ['raptor', 'trike', 'longneck'].every((id) => MOBS_BY_ID.get(id).fight?.damage > 0)
  && MOBS_BY_ID.get('longneck').fight.damage > MOBS_BY_ID.get('raptor').fight.damage);
ok('a whistle, made by hand after the war, from hide and string', ITEMS_BY_ID.get('dino_whistle') && RECIPES.find((r) => r.output.id === 'dino_whistle')?.age === 11);
ok('  Place (a tap) blows it', /dino_whistle: 'blowWhistle'/.test(game));

// A stand-in for the game: a flat world, your dinosaurs, a bandit.
const world = new World({ sizeX: 96, sizeZ: 96, height: 40 });
for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) world.setBlock(x, 0, z, 3);
const mobs = new Mobs({ world, rand: () => 0.5, cap: 0 });
const raptor = mobs.make(MOBS_BY_ID.get('raptor'), 10.5, 1, 10.5); raptor.owned = true;
const trike = mobs.make(MOBS_BY_ID.get('trike'), 14.5, 1, 10.5); trike.owned = true;
mobs.list.push(raptor, trike);
const bandit = { kind: 'bandit', name: 'Grim', x: 60.5, y: 1, z: 40.5, hp: 12, dead: false };
const hits = [];
const fake = Object.assign(Object.create(Game.prototype), {
  world, mobs, player: { position: { x: 40.5, y: 1, z: 40.5 } },
  duilt: { mounts: [raptor, trike], collect: (d) => d },
  wanderers: {
    list: [bandit], hostile: () => true, hostileOf: () => true,
    hit: (e, dmg) => { hits.push(dmg); e.hp -= dmg; if (e.hp <= 0) { e.dead = true; return { killed: true, drops: { coin: 2 } }; } return { killed: false }; },
  },
  ui: { toast: (t) => toasts.push(t.title) }, sound: null, editedAt: 0,
});
const toasts = [];

fake.blowWhistle();
ok('blown: every dinosaur in earshot follows', raptor.follow && trike.follow && /at your heel/.test(toasts.at(-1)));
const run = (secs) => { for (let i = 0; i < secs * 20; i++) { fake.tickPack(0.05); mobs.tick(0.05, fake.player.position); } };
bandit.x = 300; // nobody to fight yet
run(9);
ok(`they come to your side (${Math.round(Math.hypot(raptor.x - 40.5, raptor.z - 40.5))} and ${Math.round(Math.hypot(trike.x - 40.5, trike.z - 40.5))} blocks off)`,
  Math.hypot(raptor.x - 40.5, raptor.z - 40.5) < 6 && Math.hypot(trike.x - 40.5, trike.z - 40.5) < 6);
bandit.x = 48.5; bandit.z = 44.5;
run(8);
ok(`a bandit near you: they go for him, and bring him down (${hits.length} blows)`, hits.length > 0 && bandit.dead && toasts.some((t) => /brought down Grim/.test(t)));
fake.blowWhistle();
const at = [raptor.x, raptor.z];
fake.player.position = { x: 80.5, y: 1, z: 80.5 };
run(3);
ok('blown again: they stay where they are', !raptor.follow && Math.hypot(raptor.x - at[0], raptor.z - at[1]) < 0.5);
fake.blowWhistle();
fake.player.position = { x: raptor.x + 2, y: 1, z: raptor.z };
fake.bringPack(fake.player.position, { x: 5000, y: 50, z: 5000 });
ok('following, they come through time with you', Math.hypot(raptor.x - 5000, raptor.z - 5000) < 4 && raptor.y === 51);
ok('  the time machine takes them', /this\.bringPack\(p, \{ x: at\.x, y, z: at\.z \}\);/.test(game) && /this\.bringPack\(this\.player\.position, b\);/.test(game));
ok('and which follow is saved', /\.\.\.\(m\.follow \? \{ follow: true \} : \{\}\)/.test(readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8')));

{
  // Shut in behind a wall it can't get round: it catches you up anyway.
  const w2 = new World({ sizeX: 96, sizeZ: 96, height: 40 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) w2.setBlock(x, 0, z, 3);
  for (let x = 0; x < 96; x++) for (let y = 1; y <= 6; y++) w2.setBlock(x, y, 30, 4);
  const m2 = new Mobs({ world: w2, rand: () => 0.5, cap: 0 });
  const ln = m2.make(MOBS_BY_ID.get('longneck'), 40.5, 1, 20.5); ln.owned = true; ln.follow = true;
  m2.list.push(ln);
  const g2 = Object.assign(Object.create(Game.prototype), { world: w2, mobs: m2, player: { position: { x: 40.5, y: 1, z: 45.5 }, yaw: 0 },
    duilt: { mounts: [ln], collect: (d) => d }, wanderers: { list: [], hostile: () => false, hostileOf: () => false }, ui: { toast() {} } });
  for (let i = 0; i < 200; i++) { g2.tickPack(0.05); m2.tick(0.05, g2.player.position); }
  ok(`a follower that can't get to you catches you up (${Math.round(Math.hypot(ln.x - 40.5, ln.z - 45.5))} blocks off)`, Math.hypot(ln.x - 40.5, ln.z - 45.5) < 8);
}

// --- the Basilisk --------------------------------------------------------------------------------------
const b = MOBS_BY_ID.get('basilisk');
ok('the Basilisk: rare, deep in the jungle, a hunter out of legend', b && b.biomes.join() === 'pastJungle' && b.weight < 1 && b.hunts?.damage >= 6 && b.hp >= 100);
ok('  nobody tames it; it leaves scales', !b.tameWith && ITEMS_BY_ID.has('basilisk_scale') && b.drops.basilisk_scale);

process.exit(f ? 1 : 0);
