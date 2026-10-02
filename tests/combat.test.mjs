import { readFileSync } from 'node:fs';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { landmarksFor } from '../src/world/landmarks.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { ITEMS_BY_ID, isTool } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';

/**
 * Phase 6b — swords, and bandits that fight. Chosen directly: wood, stone
 * and iron swords made at the bench, each hitting harder; bandits hostile
 * from Age 2, coming out at night for you or your storehouses, and running
 * when they're badly hurt.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- swords ------------------------------------------------------------------------------

{
  const swords = ['sword_wood', 'sword_stone', 'sword_iron'].map((id) => ITEMS_BY_ID.get(id));
  ok('three swords: wood, stone, iron', swords.every((s) => s && isTool(s.id) && s.durability > 0 && s.weapon));
  ok('each hitting harder than the last', swords[0].damage < swords[1].damage && swords[1].damage < swords[2].damage);
  ok('and harder than any other tool', swords[0].damage > Math.max(...['axe', 'pickaxe', 'shovel'].map((id) => ITEMS_BY_ID.get(id).damage)));
  const recipes = swords.map((s) => RECIPES.find((r) => r.output.id === s.id));
  ok('all made at the bench', recipes.every((r) => r && r.station === 'hand'));
  ok('stone from Age 2, iron needs the foundry\'s iron', recipes[1].inputs.stone && recipes[1].age === 2 && recipes[2].inputs.iron_ingot);
  ok('and drawn as a sword', typeof GLYPHS.sword === 'string' && swords.every((s) => s.glyph === 'sword'));
  const hp = WANDERERS.bandit.hp;
  ok(`a bandit (${hp} points) takes three wooden blows, two of stone`,
    Math.ceil(hp / swords[0].damage) === 3 && Math.ceil(hp / swords[1].damage) === 2);
}

// --- a camp, hostile -------------------------------------------------------------------------

const { world } = generateEndlessWorld({ seed: 42 });
const lms = landmarksFor(world.gen);
const camp = lms.find((l) => l.kind === 'camp');
const atCamp = { x: camp.x + 0.5, y: camp.y, z: camp.z + 0.5 };
world.ensureAround(atCamp.x, atCamp.z, 48);

{
  const blows = [];
  let hostile = false;
  const w = new Wanderers({
    world, rand: rng(7), hostile: () => hostile,
    onAttack: (p, hits) => blows.push({ p, hits }),
  });
  const watch = { x: camp.x + 30, y: camp.y, z: camp.z };
  w.tick(0.05, watch);
  const bandits = w.list.filter((p) => p.kind === 'bandit');
  ok(`bandits have hit points (${bandits[0]?.hp})`, bandits.length >= 3 && bandits.every((b) => b.hp === WANDERERS.bandit.hp));

  for (let i = 0; i < 300; i++) w.tick(0.05, atCamp);
  ok('before Age 2 they keep away and never swing', !blows.length);

  hostile = true;
  for (let i = 0; i < 300; i++) w.tick(0.05, atCamp);
  const nearest = Math.min(...bandits.map((b) => Math.hypot(b.x - atCamp.x, b.z - atCamp.z)));
  ok(`from Age 2 they come at you (nearest ${nearest.toFixed(1)})`, nearest < WANDERERS.bandit.reach + 0.5);
  // Never quite the same twice (Wanderers.blow): a blow is its weight give
  // or take a quarter, now and then a heavy one twice that.
  const most = (WANDERERS.bandit.hits + Math.max(1, Math.round(WANDERERS.bandit.hits * 0.25))) * 2;
  ok(`and land blows (${blows.length} in 15 s, ${[...new Set(blows.map((b) => b.hits))].sort().join('/')} half-hearts)`, blows.length >= 3 && blows.every((b) => b.hits >= 1 && b.hits <= most));
  const perBandit = Math.max(...bandits.map((b) => blows.filter((x) => x.p === b).length));
  ok('each no faster than its cooldown', perBandit <= Math.ceil(15 / WANDERERS.bandit.every) + 1);

  // Walk away: past the leash they stop following.
  const far = { x: camp.x + 70, y: camp.y, z: camp.z };
  world.ensureAround(far.x, far.z, 32);
  blows.length = 0;
  for (let i = 0; i < 400; i++) w.tick(0.05, { x: camp.x + 40, y: camp.y, z: camp.z });
  const strayed = Math.max(...bandits.map((b) => Math.hypot(b.x - atCamp.x, b.z - atCamp.z)));
  ok(`and don't follow you far from their fire (furthest ${strayed.toFixed(1)})`, strayed < 32 && !blows.length);

  // Fighting one.
  const b = bandits[0];
  const r1 = w.hit(b, 6, atCamp.x, atCamp.z);
  ok('a blow hurts it and flashes it red', !r1.killed && b.hp === WANDERERS.bandit.hp - 6 && b.hurt > 0);
  w.hit(b, 3, atCamp.x, atCamp.z);
  ok('badly hurt, it runs', b.hp <= WANDERERS.bandit.fleeBelow);
  const was = Math.hypot(b.x - atCamp.x, b.z - atCamp.z);
  for (let i = 0; i < 40; i++) w.tick(0.05, atCamp);
  ok(`away from you (${was.toFixed(1)} → ${Math.hypot(b.x - atCamp.x, b.z - atCamp.z).toFixed(1)})`, Math.hypot(b.x - atCamp.x, b.z - atCamp.z) > was + 1);
  const r2 = w.hit(b, 9, atCamp.x, atCamp.z);
  ok('beaten, it drops gold', r2.killed && r2.drops.gold >= 1);
  w.tick(0.05, atCamp);
  ok('and is gone', !w.list.includes(b));
  ok('the Stone King can\'t be struck', w.hit({ kind: 'king', x: 0, z: 0 }, 5, 0, 0) === null);
}

// --- starting it yourself ------------------------------------------------------------------

{
  const blows = [];
  const w = new Wanderers({ world, rand: rng(9), hostile: () => false, onAttack: (p) => blows.push(p) });
  w.tick(0.05, { x: camp.x + 30, y: camp.y, z: camp.z });
  const bandits = w.list.filter((p) => p.kind === 'bandit');
  const near = { x: bandits[0].x + 1, y: bandits[0].y, z: bandits[0].z };
  w.hit(bandits[0], 1, near.x, near.z);
  ok('hit a peaceful bandit and the whole camp turns on you', bandits.every((b) => b.angry));
  for (let i = 0; i < 200; i++) w.tick(0.05, near);
  ok('and fights back, whatever the age', blows.length > 0);
}

// --- raids ---------------------------------------------------------------------------------

{
  const home = { x: Math.floor((camp.x + world.centreX) / 2), z: Math.floor((camp.z + world.centreZ) / 2) };
  // A home within raiding distance of the camp, with one storehouse.
  const region = { minX: home.x - 2, maxX: home.x + 2, minY: 0, maxY: 100, minZ: home.z - 2, maxZ: home.z + 2 };
  const structure = { id: 's1', type: 'storehouse', region };
  world.ensureAround(home.x, home.z, 80);
  let night = false;
  const raids = [], stolen = [];
  const w = new Wanderers({
    world, rand: rng(3),
    home: () => home,
    hostile: () => true,
    night: () => night,
    stores: () => [{ structure, region }],
    onSteal: (p, s) => { stolen.push({ p, s }); return { planks: 8 }; },
    onRaid: (dir, raiders) => raids.push({ dir, raiders }),
  });
  w.untilMessenger = 1e9;
  w.untilExplorer = 1e9;
  const standOff = { x: home.x + 40, y: 250, z: home.z }; // up out of reach, but near enough they stay about
  for (let i = 0; i < 400; i++) w.tick(0.05, standOff);
  ok('no raids by day', !raids.length);

  let nights = 0;
  for (let n = 0; n < 6; n++) {
    night = true;
    for (let i = 0; i < 1000; i++) w.tick(0.05, standOff);
    night = false;
    w.tick(0.05, standOff);
    nights++;
  }
  ok(`most nights a raid sets out (${raids.length} of ${nights})`, raids.length >= 2 && raids.length <= nights);
  ok('two or three at a time', raids.every((r) => r.raiders.length >= 2 && r.raiders.length <= 3));
  const r = raids[0];
  const from = Math.hypot(r.raiders[0].home.x - home.x, r.raiders[0].home.z - home.z);
  ok(`from the camp's side, ${Math.round(from)} blocks out`, from > 30 && from <= 51
    && Math.sign(r.raiders[0].home.x - home.x) === Math.sign(camp.x - home.x || 1));
  ok(`they reach the storehouse and rob it (${stolen.length})`, stolen.length >= 1 && stolen[0].s === structure);
  ok('carrying it off', stolen[0]?.p.loot?.planks === 8 && stolen[0].p.stage === 'leaving');
}

{
  // Catch a raider and you get back what they took.
  const w = new Wanderers({ world, rand: rng(4) });
  const p = w.person('bandit', atCamp.x, atCamp.y, atCamp.z, { raider: true, loot: { planks: 8 }, home: atCamp });
  w.list.push(p);
  const res = w.hit(p, 99, atCamp.x + 1, atCamp.z);
  ok('beat a raider and what they stole is yours again', res.killed && res.drops.planks === 8);
}

// --- in the game ---------------------------------------------------------------------------

ok('break hits a bandit before an animal or a block', /if \(this\.hitBandit\(hit\)\) return;\s*(if \(this\.\w+\(hit\)\) return;\s*)*if \(this\.hitMob\(hit\)\) return;/.test(game));
ok('swords hit with their damage, and wear', /this\.wanderers\.hit\(p, this\.blowDamage\(tool\)( \* \(ambush \? AMBUSH : 1\))?, x, z\)/.test(game) && /return \(tool\?\.damage \?\? FIST_DAMAGE\)/.test(game) && /hitBandit[\s\S]{0,1300}useTool\(tool\.id\)/.test(game));
ok('bandits are hostile from Age 2, never in Creative', /hostile: \(\) => !!\(this\.duilt && !this\.duilt\.sandbox && this\.duilt\.age >= 2\)/.test(game));
ok('a bandit\'s blow costs you hearts', /this\.duilt\.hurt\(hits, p\.war \? 'army' : WANDERERS\[p\.kind\]\?\.sky \? 'sky' : 'bandit'\)/.test(game));
ok('and dying to one says so', /bandit: 'The bandits beat you'/.test(game));
ok('a raid is announced, a robbery too', /Bandits on the road/.test(game) && /robbed your/.test(game));

process.exit(f ? 1 : 0);
