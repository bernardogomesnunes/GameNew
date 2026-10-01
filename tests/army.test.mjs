import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Army, ARMY_SIZE, ON_FIELD, WARRIOR, DESERTION, MODES } from '../src/world/Army.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { kingdomFor } from '../src/world/kingdom.js';
import { BLOCKS_BY_ID, WAR_TENT, CAMPFIRE, NIGHTSTONE_ORE, isTent } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { NEWS } from '../src/config/wanderers.js';

/**
 * The dark path, its first part (docs/plan-phase7-lore.md): the alliance,
 * the oath at the dark god's altar, the King's thousand warriors, the
 * command wheel, and the camp.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const flat = () => {
  const world = new World({ sizeX: 192, sizeZ: 192, height: 32 });
  for (let x = 0; x < 192; x++) for (let z = 0; z < 192; z++) world.setBlock(x, 0, z, 3);
  return world;
};
const run = (army, seconds, player, facing, enemies = [], on = {}) => {
  for (let i = 0; i < seconds * 20; i++) army.tick(0.05, player, facing, enemies, on);
};
// Yaw 0 looks along -z; behind you is +z.
const behind = (w, p, yaw) => (w.x - p.x) * Math.sin(yaw) + (w.z - p.z) * Math.cos(yaw);

// --- the oath -----------------------------------------------------------------------------------

{
  const k = kingdomFor(new ChunkGen({ seed: 3 }));
  const heart = k.byChunk.get(`${k.altar.x >> 4},${k.altar.z >> 4}`).find((b) => b[0] === k.altar.x && b[1] === k.altar.y && b[2] === k.altar.z);
  ok('the dark temple\'s altar has a heart of Nightstone, and the city knows where', heart?.[3] === NIGHTSTONE_ORE);
  ok('Place on it swears the oath', /aimed\.block === NIGHTSTONE_ORE && this\.isAltar\(aimed\)\) return void this\.swearOath\(\)/.test(game));
  ok('only with the Black Ring on your hand', /if \(d\.ringWorn\(\) !== 'black'\)/.test(game) && /The dark god turns from the White Ring/.test(game));
  ok('and the King speaks to you as his sworn', NEWS.king.sworn?.length >= 2 && /army\.sworn \? 'sworn'/.test(game));
}

// --- the army -----------------------------------------------------------------------------------

{
  const world = flat();
  const army = new Army({ world, rand: rng(1) });
  ok('no army before the oath', !army.active);
  ok(`sworn: ${ARMY_SIZE} warriors`, army.swear(0) && army.total === 1000 && army.active);
  ok('once', !army.swear(1) && army.total === 1000);

  const you = { x: 96, y: 1, z: 96 };
  run(army, 0.1, you, 0);
  ok(`${ON_FIELD} of them out on the ground at once, not a thousand`, army.field.length === ON_FIELD);
  run(army, 12, you, 0);
  ok('following: in ranks behind you', army.field.every((w) => behind(w, you, 0) > 1) && Math.max(...army.field.map((w) => Math.hypot(w.x - you.x, w.z - you.z))) < 14);
  // Walk off east; they come along.
  const east = { x: 130, y: 1, z: 96 };
  run(army, 15, east, Math.PI / 2);
  ok('and they come with you', army.field.every((w) => Math.hypot(w.x - east.x, w.z - east.z) < 14));

  // Hold here, then walk away.
  army.command('hold', east, Math.PI / 2);
  run(army, 15, { x: 60, y: 1, z: 96 }, 0);
  ok('hold: they stay where you gave the order', army.field.every((w) => Math.hypot(w.x - east.x, w.z - east.z) < 12));

  // A line across the way you face, ahead of you.
  army.command('line', you, 0);
  run(army, 15, you, 0);
  const xs = army.field.map((w) => w.x), zs = army.field.map((w) => w.z);
  ok(`a line: wide across (${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}), shallow (${(Math.max(...zs) - Math.min(...zs)).toFixed(0)}), ahead of you`,
    Math.max(...xs) - Math.min(...xs) > 15 && Math.max(...zs) - Math.min(...zs) < 5 && zs.every((z) => z < you.z));

  // Something hostile near: whatever the order, they fight it; in attack, they go after it.
  army.command('follow', you, 0);
  run(army, 10, you, 0);
  const enemy = { x: you.x + 16, y: 1, z: you.z, name: 'Rook' };
  const blows = [];
  run(army, 6, you, 0, [enemy], { strike: (e, n, w) => blows.push(w) });
  ok('following, they leave a bandit 16 blocks off alone', blows.length === 0);
  army.command('attack', you, 0);
  run(army, 8, you, 0, [enemy], { strike: (e, n, w) => blows.push(w) });
  ok(`attack: they go for it (${blows.length} blows)`, blows.length >= 10 && blows.every((w) => w.kind === 'warrior'));

  // Losses: the count drops, and fresh ones march in.
  const w0 = army.field[0];
  ok('a warrior can fall, and the army is one fewer', army.hurt(w0, 99) && army.total === 999 && army.lost === 1);
  run(army, 0.1, you, 0);
  ok('another marches in to take the place', army.field.length === ON_FIELD && !army.field.includes(w0));
  army.total = 12;
  army.field.length = 0;
  run(army, 0.1, you, 0);
  ok('with only twelve left, twelve on the ground', army.field.length === 12);
  army.total = 1000;

  // Rations.
  let taken = 0;
  ok('they eat once a day', army.eat(0.9, () => 99) === null);
  const meal = army.eat(1.1, (n) => { taken += n; return n; });
  ok(`a day's rations: ${meal.need} for a thousand, none desert when fed`, meal.need === 10 && meal.deserted === 0 && taken === 10);
  const hungry = army.eat(2.1, () => 0);
  ok(`a day without: ${hungry.deserted} desert`, hungry.deserted === Math.floor(1000 * DESERTION) && army.total === 970);
  const three = army.eat(5.2, (n) => Math.floor(n / 2));
  ok('days missed are all counted', three.need >= 30 && three.deserted > 0);

  // Saved.
  const back = new Army({ world });
  back.loadJSON(JSON.parse(JSON.stringify(army.toJSON())));
  ok('saved with the world: sworn, how many, the order', back.sworn && back.total === army.total && back.mode === army.mode && back.field.length === 0);
  ok('every order the wheel gives exists', ['follow', 'hold', 'attack', 'line'].every((m) => MODES.includes(m)));
}

// --- the camp -----------------------------------------------------------------------------------

{
  const tent = ITEMS_BY_ID.get(ITEM_FOR_BLOCK.get(WAR_TENT));
  const fire = ITEMS_BY_ID.get(ITEM_FOR_BLOCK.get(CAMPFIRE));
  ok('a war tent: modelled, turned four ways, made at the bench, drawn in the bag',
    PROP_SHAPES.war_tent?.length >= 10 && isTent(WAR_TENT + 3) && RECIPES.some((r) => r.output.id === tent?.id) && (itemIcon(tent) ?? '').includes('<svg'));
  ok('a campfire that burns with a light of its own', PROP_SHAPES.campfire?.some((b) => b.glow) && BLOCKS_BY_ID.get(CAMPFIRE).light && RECIPES.some((r) => r.output.id === fire?.id));
  ok('Place on a tent makes camp: you wake there, and the army holds round it',
    /isTent\(aimed\.block\)\) return void this\.makeCamp\(aimed\)/.test(game) && /d\.spawn = \{ x, y, z \};\s*if \(d\.army\.active\) d\.army\.command\('hold'/.test(game) && /isPainting\(at\) \|\| isTent\(at\)/.test(game));
}

// --- in the game ----------------------------------------------------------------------------------

ok('the army marches and fights every frame, and is drawn', /this\.tickArmy\(dt\);/.test(game) && /this\.warriorView\.update\(this\.duilt\?\.army\.field/.test(game));
ok('raiders fight your warriors back', /foes: \(\) => \[\.\.\.\(this\.duilt\?\.defenders\.soldiers \?\? \[\]\), \.\.\.\(this\.duilt\?\.army\.field \?\? \[\]\)\]/.test(game));
ok('rations come from your bag, then your storehouses', /for \(const inv of \[d\.inventory, \.\.\.d\.structures\.stores\(\)\.map\(\(s\) => s\.store\)\]\)/.test(game));
ok('a ⚔ banner with the count, and the command wheel under it', /id="vital-army"/.test(ui) && ['follow', 'hold', 'attack', 'line'].every((m) => ui.includes(`data-army="${m}"`)) && /this\.game\.commandArmy\(b\.dataset\.army\)/.test(ui));
ok('the banner is hidden until you have an army', /const on = !!army\?\.active && !this\.duilt\.sandbox;/.test(ui));
ok(`a warrior fights like a soldier of the Stone Kingdom (${WARRIOR.hp} strength)`, WARRIOR.hp >= 18 && WARRIOR.hits >= 3);

process.exit(f ? 1 : 0);
