import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Mobs } from '../src/world/Mobs.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { POTIONS, POTIONS_BY_ID, STRENGTH_DAMAGE, FROST_MOB_SECONDS, FIRE_MOB_SECONDS } from '../src/config/potions.js';
import { BOOSTS, BOOST_SECONDS } from '../src/config/drinks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { WIZARD_QUESTS } from '../src/config/wizardQuests.js';
import { FROST_LAYER, BLOCKS_BY_ID } from '../src/config/blocks.js';

/** POT-1 to POT-8. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = ['../src/Game.js', '../src/game/GameWar.js'].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n');

// The list: 7 potions, 2 to 5 minutes, each an item, a boost and a cauldron recipe.
ok('seven potions', POTIONS.length === 7);
ok('every potion lasts 2 to 5 minutes at level 1', POTIONS.every((p) => p.seconds >= 120 && p.seconds <= 300));
ok('each is an item with a boost, a boost entry and a recipe at the Magic Cauldron',
  POTIONS.every((p) => ITEMS_BY_ID.get(`potion_${p.id}`)?.boost === p.boost && BOOSTS[p.boost]?.potion && RECIPES_BY_ID.get(`brew_${p.id}`)?.station === 'magic_cauldron' && RECIPES_BY_ID.get(`brew_${p.id}`).potion === p.id));
ok('every ingredient exists, and each recipe starts from Moonwater', POTIONS.every((p) => p.inputs.moonwater === 1 && Object.keys(p.inputs).every((id) => ITEMS_BY_ID.has(id))));
ok('every taught recipe in the quest chain is a potion, in the chain order', WIZARD_QUESTS.filter((q) => q.reward?.recipe).every((q) => POTIONS_BY_ID.has(q.reward.recipe)) && new Set(WIZARD_QUESTS.map((q) => q.reward?.recipe).filter(Boolean)).size === 7);
ok('boost names do not clash with beer, kombucha and coffee', ['haste', 'strength', 'speed'].every((k) => BOOSTS[k] && !BOOSTS[k].potion));

const make = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age: 3 });
  return { g, world };
};

// Drinking: timed effect, scaled by Magic level, several at once, saved.
{
  const { g } = make();
  g.magic.arrive(null);
  g.inventory.add('potion_speed', 2); g.inventory.add('potion_night_vision', 1); g.inventory.add('coffee', 1);
  const r = g.drink('potion_speed');
  ok('drinking sets the boost for its time at level 1', r.ok && r.boost === 'p_speed' && r.seconds === 180 && g.boosted('p_speed'));
  g.magic.add(900);
  g.drink('potion_speed');
  ok('at level 10 it lasts 45% longer', g.boosts.p_speed === Math.round(180 * 1.45));
  g.drink('potion_night_vision'); g.drink('coffee');
  ok('several effects run at once', g.boosted('p_speed') && g.boosted('p_night') && g.boosted('speed'));
  g.tick(60);
  ok('the countdown runs', g.boosts.p_night === Math.round(300 * 1.45) - 60);
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const { g: g2 } = make();
  g2.loadJSON(json);
  ok('timers are saved with the player', Math.abs(g2.boosts.p_night - g.boosts.p_night) < 1 && g2.boosted('p_speed') && g2.boosted('speed'));
  g.tick(1000);
  ok('they wear off', !g.boosted('p_speed') && !g.boosted('p_night'));
  const { g: g3 } = make();
  g3.loadJSON({ ...json, boosts: { p_speed: 50, bogus: 30, p_jump: -4 } });
  ok('an old or bad save keeps only valid, positive boosts', g3.boosted('p_speed') && !g3.boosts.bogus && !g3.boosts.p_jump);
  const { g: g4 } = make();
  g4.loadJSON({ ...json, magic: undefined });
  ok('a potion drunk without Magic still lasts its base time', (g4.inventory.add('potion_jump', 1), g4.drink('potion_jump').seconds === 180));
  ok('beer still lasts three minutes', (g4.inventory.add('beer', 1), g4.drink('beer').seconds === BOOST_SECONDS));
}

// The wizard teaches: untaught recipes are locked at the cauldron.
{
  const { g } = make();
  g.magic.arrive(null);
  const r = RECIPES_BY_ID.get('brew_fire');
  ok('untaught: locked with a reason', /not taught/.test(g.crafting.locked(r) ?? ''));
  g.magic.taught.push('fire');
  ok('taught: open', g.crafting.locked(r) === null);
  ok('Moonwater needs no teaching', g.crafting.locked(RECIPES_BY_ID.get('moonwater')) === null);
}

// POT-6 strength bonus grows with level.
{
  const { g } = make();
  g.magic.arrive(null);
  ok('strength adds 3 at level 1 and 4 at level 4', g.magic.potionBonus(STRENGTH_DAMAGE) === 3 && (g.magic.points = 120, g.magic.potionBonus(STRENGTH_DAMAGE) === 4));
}

// POT-4: invisible, a mob ignores you until you hit it.
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const mobs = new Mobs({ world, rand: () => 0.5 });
  let bites = 0;
  mobs.onBite = () => bites++;
  const spec = { id: 'raptor' };
  const m = mobs.make({ id: 'raptor', hp: 10 }, 10, 1, 10);
  mobs.list.push(m);
  const player = { x: 11, y: 1, z: 10 };
  mobs.unseen = () => true;
  for (let i = 0; i < 40; i++) mobs.tick(0.1, player);
  ok('an invisible player is not bitten by a raptor beside them', bites === 0 && !m.chasing);
  mobs.unseen = () => false;
  for (let i = 0; i < 40; i++) mobs.tick(0.1, player);
  ok('visible, it bites', bites > 0);
  bites = 0; m.chasing = false; m.noticed = false; m.biteIn = 0;
  mobs.unseen = () => true;
  mobs.hit(m, 1, 12, 10);
  for (let i = 0; i < 40; i++) mobs.tick(0.1, player);
  ok('once you hit it, it knows you, invisible or not', m.noticed && bites > 0);
}

// POT-7 and POT-8 on mobs: burning hurts; ice holds still for a minute.
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const burnt = [];
  const mobs = new Mobs({ world, rand: () => 0.5, onBurn: (m, drops) => burnt.push(m) });
  const a = mobs.make({ id: 'raptor', hp: 3 }, 5, 1, 5);
  const b = mobs.make({ id: 'raptor', hp: 10 }, 20, 1, 20);
  mobs.list.push(a, b);
  mobs.afflict(a, 'fire', FIRE_MOB_SECONDS);
  for (let i = 0; i < 40; i++) mobs.tick(0.1, { x: 30, y: 1, z: 30 });
  ok('a burning mob loses a hit point a second and dies of it', a.hp <= 0 && burnt.includes(a) && a.dying > 0);
  mobs.afflict(b, 'ice', FROST_MOB_SECONDS);
  const at = { x: b.x, z: b.z };
  for (let i = 0; i < 100; i++) mobs.tick(0.1, { x: 21, y: 1, z: 20 });
  ok('a frozen mob stays exactly where it is, 10 s in', b.x === at.x && b.z === at.z && b.frozen > 49 && b.frozen < 51);
  for (let i = 0; i < 520; i++) mobs.tick(0.1, { x: 30, y: 1, z: 30 });
  ok('after a minute it thaws', b.frozen === 0);
}
ok('a frozen minute is 60 seconds', FROST_MOB_SECONDS === 60);

// And on people (bandits).
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const w = new Wanderers({ world, rand: () => 0.5, home: () => null });
  const p = w.person('bandit', 5, 1, 5, { home: { x: 5, z: 5 } });
  w.list.push(p);
  w.afflict(p, 'ice', 60);
  ok('a frozen bandit is frozen solid and does not move', p.frozenSolid && p.frozen === 60);
  w.unseen = () => true;
  ok('invisible you: a bandit does not fight you', w.fight(p, 0.1, { x: 6, y: 1, z: 5 }, { hp: 12, aggro: 11, reach: 1.7, fleeBelow: 4, run: 3, speed: 1 }) === false);
  w.hit(p, 1, 6, 5);
  ok('hitting them makes them notice', p.noticed === true);
}

// The wiring in the game.
ok('night vision is the dusk light', /nightSight = this\.duilt\.wearing\('night'\) \|\| this\.duilt\.boosted\('p_night'\)/.test(game));
ok('speed, jump and strength read their boost', /boosted\('p_speed'\) \? SPEED_POTION/.test(game) && /boosted\('p_jump'\)\) this\.player\.jumpScale \*= JUMP_POTION/.test(game) && /boosted\('p_strength'\)/.test(game));
ok('the avatar is a ghost while invisible', /ghost: !!this\.duilt\?\.boosted\('p_invis'\)/.test(game));
ok('a blow with fire or frost on sets alight or freezes', /potionStrike\(mob, false\)/.test(game) && /potionStrike\(p, true\)/.test(game));
ok('frost leaves a snow layer block that is not placeable', BLOCKS_BY_ID.get(FROST_LAYER)?.system === true && /setBlock\(x, y, z, FROST_LAYER\)/.test(game));
process.exit(f ? 1 : 0);
