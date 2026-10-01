import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { BOOSTS, BOOST_SECONDS, BEER_COOLDOWN, KOMBUCHA_DAMAGE, COFFEE_SPEED, clockOf } from '../src/config/drinks.js';
import { ITEMS_BY_ID, isFood } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { CROPS, CROP_IDS, cropBlock, cropOf } from '../src/config/crops.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { LOOT } from '../src/duilt/Loot.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Playtest, P5. Asked for directly: "Stats improvement items, found here
 * too and craftable: beer, kombucha and coffee. Beer gives you energy and
 * lets you throw more hits per second; kombucha gives you 2 more points when
 * hitting; coffee gives you speed."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- the three drinks ---------------------------------------------------------------------

for (const [id, boost] of [['beer', 'haste'], ['kombucha', 'strength'], ['coffee', 'speed']]) {
  const item = ITEMS_BY_ID.get(id);
  ok(`${item?.name}: a drink that gives ${BOOSTS[boost].says.toLowerCase()}`, item?.kind === 'drink' && item.boost === boost && BOOSTS[boost].drink === id);
  ok(`  made at the workshop`, RECIPES.some((r) => r.output.id === id && r.station === 'workshop'));
  ok(`  and found in chests`, Object.values(LOOT).some((t) => t.items.some(([i]) => i === id)));
  ok(`  drawn as itself`, (itemIcon(item) ?? '').includes('<svg'));
}
ok('beer: blows come faster', BEER_COOLDOWN < 1 && /STRIKE_COOLDOWN_MS \* \(this\.duilt\?\.boosted\('haste'\) \? BEER_COOLDOWN : 1\)/.test(game));
ok('kombucha: two more on every hit', KOMBUCHA_DAMAGE === 2 && /\(tool\?\.damage \?\? FIST_DAMAGE\) \+ \(this\.duilt\?\.boosted\('strength'\) \? KOMBUCHA_DAMAGE : 0\)/.test(game));
ok('  on animals and bandits alike', (game.match(/this\.blowDamage\(tool\), x, z\)/g) ?? []).length === 2);
ok('  and every blow waits the shorter time', (game.match(/< this\.strikeCooldown\(\)/g) ?? []).length === 3);
ok('coffee: faster on your feet', COFFEE_SPEED > 1 && /this\.duilt\.boosted\('speed'\) \? COFFEE_SPEED : 1/.test(game));
ok('break with one selected drinks it', ['beer', 'kombucha', 'coffee'].every((id) => game.includes(`${id}: 'drinkSelected'`)));

// --- coffee, the crop ----------------------------------------------------------------------

{
  const coffee = CROPS.find((c) => c.kind === 'coffee');
  ok('coffee grows on farmland like any crop', !!coffee && ITEMS_BY_ID.get('seeds_coffee')?.block === cropBlock('coffee', 0));
  ok('its beans you can brew, or chew', coffee.produce === 'coffee_beans' && isFood('coffee_beans'));
  ok('its blocks are real and clash with nothing', [0, 1, 2, 3].every((s) => BLOCKS_BY_ID.get(cropBlock('coffee', s))?.crop?.kind === 'coffee')
    && new Set(CROP_IDS).size === CROP_IDS.length && cropOf(cropBlock('coffee', 3)).stage === 3);
  ok('the other crops are where they always were', cropBlock('carrot', 0) === 119 && cropBlock('broccoli', 3) === 146);
  ok('mixed seeds can come up coffee, and the hermit keeps some', LOOT.hermit.items.some(([i]) => i === 'seeds_coffee'));
}

// --- drinking: timed, one of each ----------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.inventory.add('beer', 2);
  g.inventory.add('coffee', 1);
  ok('nothing going to start with', !g.boosted('haste') && !g.boosted('speed'));
  const r = g.drink('beer');
  ok(`a beer drunk, quicker blows for ${BOOST_SECONDS / 60} minutes`, r.ok && r.boost === 'haste' && g.boosted('haste') && g.inventory.countOf('beer') === 1);
  g.tick(100);
  g.drink('beer');
  ok('another tops the time up rather than doubling it', g.boosts.haste === BOOST_SECONDS);
  g.drink('coffee');
  ok('a coffee on top: both at once', g.boosted('haste') && g.boosted('speed'));
  ok('and nothing to drink, nothing happens', !g.drink('kombucha').ok);

  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('saved and loaded, still going', back.boosted('haste') && Math.abs(back.boosts.speed - BOOST_SECONDS) < 0.01);

  const ended = [];
  g.bus = { emit: (e, d) => ended.push([e, d]) };
  g.tick(BOOST_SECONDS + 1);
  ok('after three minutes they wear off, and you are told', !g.boosted('haste') && !g.boosted('speed')
    && ended.filter(([e]) => e === 'duilt:boostEnded').length === 2);
  ok('wearing off is heard', /this\.bus\.on\('duilt:boostEnded'/.test(game));
}

// --- the HUD -------------------------------------------------------------------------------------

ok('a chip by the hearts for each, counting down', /renderBoosts\(\)/.test(ui) && /id="vital-boosts"/.test(ui) && /this\.ui\?\.duiltUI\?\.renderBoosts\(\)/.test(game));
ok('as minutes and seconds', clockOf(165) === '2:45' && clockOf(9.2) === '0:10' && clockOf(-1) === '0:00');

process.exit(f ? 1 : 0);
