import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Army, MARCH_DAYS, ON_FIELD } from '../src/world/Army.js';

/**
 * The expedition (docs/plan-phase7-lore.md): from the map, send the army
 * ahead to the Sky Kingdom. It marches on its own for days, still eating,
 * makes camp below the island, and holds there until you join it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const world = new World({ sizeX: 256, sizeZ: 256, height: 32 });
for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) world.setBlock(x, 0, z, 3);
const run = (army, seconds, player) => { for (let i = 0; i < seconds * 20; i++) army.tick(0.05, player, 0, []); };

// --- the march ----------------------------------------------------------------------------------

{
  const army = new Army({ world, rand: rng(1) });
  const camp = { x: 200, y: 1, z: 200, facing: 1 };
  ok('no army, no expedition', !army.sendTo(camp, 0));
  army.swear(0);
  const home = { x: 30, y: 1, z: 30 };
  run(army, 1, home);
  ok('before: they\'re here with you', army.field.length === ON_FIELD);
  ok(`sent: it takes ${MARCH_DAYS} days`, army.sendTo(camp, 5) && army.marching && army.march.arrives === 5 + MARCH_DAYS);
  ok('and only once at a time', !army.sendTo(camp, 5.5));
  run(army, 1, home);
  ok('on the march: nobody on the ground with you', army.field.length === 0);
  ok('the day after, still on the road', army.update(6) === null && army.marching && !army.camp);
  const meal = army.eat(6, () => 0);
  ok('they still eat on the road (and desert when there\'s nothing)', meal?.need > 0 && meal.deserted > 0);
  ok('arrived: they make camp', army.update(5 + MARCH_DAYS) === 'arrived' && !army.marching
    && army.camp?.x === 200 && army.camp.z === 200);
  ok('just the once', army.update(5 + MARCH_DAYS + 1) === null);
  ok('and hold there, facing the island', army.mode === 'hold' && army.anchor.x === 200.5 && army.anchor.z === 200.5 && army.anchor.facing === 1);
  run(army, 1, home);
  ok('far from their camp, you don\'t see them — nor they you', army.field.length === 0 && army.away(home));
  const there = { x: 200.5, y: 1, z: 197.5 };
  run(army, 1, there);
  ok('at the camp, there they are, round its fire', army.field.length === ON_FIELD && !army.away(there)
    && army.field.every((w) => Math.hypot(w.x - 200.5, w.z - 200.5) < 12));

  const saved = JSON.parse(JSON.stringify(army.toJSON()));
  const back = new Army({ world, rand: rng(2) });
  back.loadJSON(saved);
  ok('the camp is saved', back.camp?.x === 200 && back.mode === 'hold' && !back.marching);
  const going = new Army({ world, rand: rng(3) });
  going.swear(0);
  going.sendTo(camp, 1);
  const again = new Army({ world, rand: rng(4) });
  again.loadJSON(JSON.parse(JSON.stringify(going.toJSON())));
  ok('and so is a march under way', again.marching && again.march.arrives === 1 + MARCH_DAYS && again.march.to.x === 200 && again.march.to.facing === 1);
  again.loadJSON({ sworn: true, total: 10, march: { since: 'x' }, camp: { x: 1 } });
  ok('nonsense in a save is dropped', !again.marching && !again.camp);

  army.command('follow', there, 0);
  ok('your first order there breaks camp: they\'re with you again', !army.camp && army.mode === 'follow');
}

{
  const army = new Army({ world, rand: rng(5) });
  army.swear(0);
  army.command('hold', { x: 20, z: 20 }, 0);
  const near = { x: 40, y: 1, z: 40 }, far = { x: 200, y: 1, z: 200 };
  run(army, 0.2, near);
  const seen = army.field.length;
  run(army, 0.2, far);
  ok('holding anywhere: walk far enough off and they\'re out of sight, but still yours', seen === ON_FIELD && army.field.length === 0 && army.total === 1000);
}

// --- in the game --------------------------------------------------------------------------------

ok('offered on the map: sworn, the Sky Kingdom standing, on the dark path', /expeditionState\(\) \{[\s\S]{0,200}if \(!d \|\| d\.sandbox \|\| !d\.army\.active \|\| !this\.skyOpen\(\) \|\| d\.skyFallen\) return null;/.test(game));
ok('the map: send it, see it on the road, join it at its camp', /Send the army to the Sky Kingdom/.test(ui) && /on the march/.test(ui) && /Join your army at its camp/.test(ui)
  && /game\.sendExpedition\(\)/.test(ui) && /game\.joinExpedition\(\)/.test(ui));
ok('the camp is out beyond the anchor tower nearest home, facing the island', /expeditionCampSpot\(\) \{[\s\S]{0,400}s\.towers\.reduce\([\s\S]{0,900}t\.x \+ ux \* out/.test(game));
ok('the day they arrive, the camp goes up', /if \(d\.army\.update\(d\.days\) === 'arrived'\) this\.makeExpeditionCamp\(\);/.test(game));
const make = game.slice(game.indexOf('  makeExpeditionCamp() {'), game.indexOf('  joinExpedition() {'));
ok('the ground cleared first: no tents in the canopy, no arriving inside a tree', /for \(let by = g; by < g \+ 18; by\+\+\) \{\s*if \(this\.world\.getBlock\(x \+ dx, by, z \+ dz\) !== AIR\) this\.world\.setBlock\(x \+ dx, by, z \+ dz, AIR\);/.test(make));
ok('tents, a fire and black banners, each on its own ground', /turned\(WAR_TENT, 0\)/.test(make) && /CAMPFIRE/.test(make) && /BLACK_BANNER/.test(make) && /const by = gen\.heightAt\(bx, bz\);/.test(make));
ok('and you wake at its middle tent now', /d\.spawn = tents\[1\];/.test(make));
ok('joining takes you there, in front of the ranks, looking up at the island', /joinExpedition\(\) \{[\s\S]{0,500}Math\.sin\(f\) \* 8[\s\S]{0,200}this\.player\.teleport\(jx \+ 0\.5, this\.world\.gen\.heightAt\(jx, jz\) \+ 0\.5, jz \+ 0\.5\)[\s\S]{0,200}this\.player\.yaw = Math\.atan2/.test(game));
ok('pitched on dry, level ground: never in a lake', /if \(gen\.waterLevelAt\?\.\(x \+ dx, z \+ dz\) \|\| Math\.abs\(gen\.heightAt\(x \+ dx, z \+ dz\) - y\) > 1\) return null;/.test(game));
ok('no orders reach it on the march, nor at a camp you\'re far from', /if \(army\.marching\) return void this\.ui\?\.toast/.test(game) && /if \(army\.camp && army\.away\(this\.player\.position\)\) return void/.test(game));
ok('the army banner says it\'s on the march', /army\.marching \? 'on the march'/.test(hud));

process.exit(f ? 1 : 0);
