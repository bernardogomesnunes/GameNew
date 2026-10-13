import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { landmarksFor, PLACE_NAMES } from '../src/world/landmarks.js';
import { cityDesign, CITY_HALF } from '../src/world/cities.js';
import { WANDERERS, NEWS } from '../src/config/wanderers.js';
import { BLOCKS_BY_ID, isChest } from '../src/config/blocks.js';
import { CITY_TRADERS, TRADERS_BY_ID, tradersFor, TRADERS } from '../src/config/traders.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { LOOT } from '../src/duilt/Loot.js';
import { MOMENTS } from '../src/config/moments.js';
import { talkLine, CITIZEN_TALK, CITY_GUARD_TALK } from '../src/config/talk.js';

/**
 * Backlog batch 2, "More places in the wild": "abandoned cities, and cities
 * with people living in them" — asked for again directly: "you can build
 * the cities".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const name = (id) => BLOCKS_BY_ID.get(id)?.name ?? '';

// --- where they are ------------------------------------------------------------------------------

{
  let living = 0, ruins = 0, far = true, apart = true;
  for (const seed of [41, 2024, 7, 99]) {
    const gen = new ChunkGen({ seed });
    const lms = landmarksFor(gen);
    for (const c of lms.filter((l) => l.kind === 'city' || l.kind === 'ruined_city')) {
      if (c.kind === 'city') living++; else ruins++;
      if (Math.hypot(c.x - gen.biomes.centreX, c.z - gen.biomes.centreZ) < 300) far = false;
      if (lms.some((o) => o !== c && Math.max(Math.abs(o.x - c.x), Math.abs(o.z - c.z)) < o.half + c.half)) apart = false;
    }
  }
  ok(`two living cities and two abandoned ones a world (${living} and ${ruins} over four)`, living >= 7 && ruins >= 7);
  ok('out past the old border, for after the war', far);
  ok('never on top of another place', apart);
  ok('named, in the news and in the stories, with a moment each', PLACE_NAMES.city && PLACE_NAMES.ruined_city
    && NEWS.city.every((l) => l.includes('{dir}')) && NEWS.ruined_city.every((l) => l.includes('{dir}')) && MOMENTS.found_city && MOMENTS.found_ruined_city);
}

// --- the plan ----------------------------------------------------------------------------------------

const city = cityDesign(0.3, false), ruin = cityDesign(0.3, true);
const at = (d) => { const m = new Map(d.blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id])); return (x, y, z) => m.get(`${x},${y},${z}`) ?? 0; };
const get = at(city), getRuin = at(ruin);
{
  ok('it fits its footprint', city.blocks.every(([x, , z]) => Math.abs(x) <= CITY_HALF && Math.abs(z) <= CITY_HALF));
  let walled = 0;
  for (let x = -24; x <= 24; x++) if (/Stone Brick/.test(name(get(x, 2, -24)))) walled++;
  ok(`a stone-brick wall round it (${walled} of the north side, less the gate)`, walled >= 44);
  ok('a gate north and south you can walk through', [-24, 24].every((z) => [0, 1].every((y) => !get(0, y, z) && !get(-1, y, z) && !get(1, y, z))));
  let clear = true;
  for (let z = -23; z <= -2; z++) if (get(0, 0, z) || get(0, 1, z) || !/Cal/.test(name(get(0, -1, z)))) clear = false;
  ok('a calçada street from the gate to the square, clear all the way', clear);
  ok('a statue in the square, and two market stalls', /Pillar/.test(name(get(0, 2, 0))) && city.people.filter((p) => p.kind === 'merchant').length === 2);
  const lanterns = city.blocks.filter(([, , , id]) => name(id) === 'Lantern').length;
  ok(`a light in every house (${lanterns} lanterns)`, lanterns >= 12 + 4);
  ok(`houses with roofs and doors (${city.blocks.filter(([, , , id]) => /Door/.test(name(id))).length} doors)`, city.blocks.filter(([, , , id]) => /Door/.test(name(id))).length >= 24);
  ok(`chests in some of them (${city.chests})`, city.chests >= 3);
}
{
  ok('an abandoned city: the same plan, nobody in it', ruin.people.length === 0);
  ok(`  its wall fallen to stumps`, ruin.blocks.filter(([, y, , id]) => y >= 4 && /Stone Brick/.test(name(id))).length < city.blocks.filter(([, y, , id]) => y >= 4 && /Stone Brick/.test(name(id))).length / 4);
  ok('  moss and gravel through its streets', ruin.blocks.filter(([, y, , id]) => y === -1 && /Moss|Gravel/.test(name(id))).length > 50);
  ok(`  roofs caved in (${ruin.blocks.filter(([, , , id]) => /Roof/.test(name(id))).length} roof tiles left of ${city.blocks.filter(([, , , id]) => /Roof/.test(name(id))).length})`,
    ruin.blocks.filter(([, , , id]) => /Roof/.test(name(id))).length < city.blocks.filter(([, , , id]) => /Roof/.test(name(id))).length / 2);
  ok(`  and more chests left behind (${ruin.chests})`, ruin.chests > city.chests);
  ok('  with better in them', LOOT.ruined_city.items.some(([id]) => id === 'sword_gold') && LOOT.ruined_city.items.every(([id]) => ITEMS_BY_ID.has(id)) && LOOT.city.items.every(([id]) => ITEMS_BY_ID.has(id)));
  ok('  no lights burning', !ruin.blocks.some(([, , , id]) => name(id) === 'Lantern'));
}

// --- the merchants ----------------------------------------------------------------------------------

ok('two merchants, with goods a market at home doesn\'t keep', CITY_TRADERS.length === 2 && CITY_TRADERS.every((t) => TRADERS_BY_ID.get(t.id) === t && t.goods.every(([id, n, price]) => ITEMS_BY_ID.has(id) && n > 0 && price > 0)));
ok('and not one of your market\'s goblins', tradersFor(9).every((t) => TRADERS.includes(t)) && !tradersFor(9).some((t) => CITY_TRADERS.includes(t)));
ok('point at one and Place to trade — a tap too', /p\.kind === 'merchant' && p\.trader && !p\.dead && !p\.angry/.test(game) && /this\.talkTarget\(aimed\) \|\| this\.traderTarget\(aimed\)\) return places\(\)/.test(game));
ok('they say what they sell', /stranger\.kind === 'merchant' && stranger\.trader && !stranger\.angry \?/.test(game));

// --- the people ----------------------------------------------------------------------------------------

{
  const world = new World({ sizeX: 128, sizeZ: 128, height: 40 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) world.setBlock(x, 0, z, 3);
  const lm = { kind: 'city', x: 64, z: 64, y: 1, half: CITY_HALF, people: city.people };
  for (const [x, y, z, id] of city.blocks) world.setBlock(lm.x + x, lm.y + y, lm.z + z, id);
  const hits = [];
  const w = new Wanderers({ world, rand: rng(9), onAttack: (p, n) => hits.push(n), hostile: () => true });
  w.untilMessenger = w.untilExplorer = 1e9;
  w.landmarks = [lm];
  w.populate(lm);
  const kinds = (k) => w.list.filter((p) => p.kind === k);
  ok(`${w.list.length} people: guards, citizens and merchants`, kinds('city_guard').length === 4 && kinds('citizen').length >= 8 && kinds('merchant').length === 2 && kinds('merchant').every((m) => CITY_TRADERS.some((t) => t.id === m.trader)));
  const player = { x: lm.x + 0.5, y: 1, z: lm.z - 12 };
  const mx = kinds('merchant').map((m) => [m.x, m.z]);
  for (let i = 0; i < 600; i++) w.tick(0.05, player);
  ok('neutral, even where bandits would be hostile: nobody strikes you', hits.length === 0 && w.list.every((p) => !w.hostileOf(p)));
  ok('the merchants keep their stalls', kinds('merchant').every((m, i) => Math.hypot(m.x - mx[i][0], m.z - mx[i][1]) < 0.01));
  ok('the citizens stay in the city', kinds('citizen').every((p) => Math.abs(p.x - lm.x) < 24 && Math.abs(p.z - lm.z) < 24));
  // Robbed: the guards come, the rest run.
  w.anger(lm);
  ok('rob them and the guards turn on you', kinds('city_guard').every((g) => w.hostileOf(g)));
  ok('and the citizens and merchants run', kinds('citizen').every((p) => p.fear > 0) && kinds('merchant').every((p) => p.fear > 0));
  for (let i = 0; i < 400; i++) w.tick(0.05, player);
  ok(`the guards reach you (${hits.length} blows)`, hits.length > 0);
}

ok('taking from a house\'s chest is theft', /l\.kind === 'tribe' \|\| l\.kind === 'city'/.test(game) && /title: 'Thief!'/.test(game));
ok('they talk, while you\'re welcome', /TALKERS = new Set\(\[[^\]]*'citizen', 'city_guard'/.test(game)
  && CITIZEN_TALK.includes(talkLine({ who: 'citizen', person: { id: 2 } })) && CITY_GUARD_TALK.includes(talkLine({ who: 'city_guard', person: { id: 2 } })));
ok('everyone has a look of their own', ['citizen', 'city_guard', 'merchant'].every((k) => WANDERERS[k] && readFileSync(new URL('../src/config/outfits.js', import.meta.url), 'utf8').includes(`${k}: {`)));
ok('chests in a city are its own kind of chest', isChest(148));

process.exit(f ? 1 : 0);
