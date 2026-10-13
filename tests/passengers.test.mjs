import { readFileSync } from 'node:fs';
import { stationsFor, stationAt, stop, serve, ridersIn, SEATS, STOP_RANGE, FARE_BLOCKS, cityName } from '../src/world/Passengers.js';
import { Trains } from '../src/world/Trains.js';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { landmarksFor } from '../src/world/landmarks.js';

/**
 * Backlog batch 2: "An engine plus up to 5 cars, each carrying 10 people" —
 * waiting on the living cities, so there was somewhere to take them.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const stations = stationsFor([
  { kind: 'city', x: 600, z: 0, name: 'Testford' },
  { kind: 'ruined_city', x: -600, z: 0 },
  { kind: 'tribe', x: 0, z: 600 },
], { x: 0, z: 0 });
ok('the stations: home, and the living cities — not the ruins', stations.map((s) => s.key).join() === 'home,city@600,0');
ok('every living city has a name of its own', landmarksFor(new ChunkGen({ seed: 41 })).filter((l) => l.kind === 'city').every((l) => typeof l.name === 'string' && l.name === cityName(l.x, l.z)));
ok(`a train stops at one within ${STOP_RANGE} blocks of its middle`, stationAt({ x: 590, z: 20 }, stations)?.key === 'city@600,0' && !stationAt({ x: 300, z: 0 }, stations));

{
  const t = { cars: 3, speed: 0, riders: [] };
  const city = stations[1];
  const res = stop(t, city, stations, rng(1));
  ok(`at a city, people get on — ${res.on} of them, bound for home`, res.on > 0 && t.riders.every((r) => r.to === 'home'));
  ok('never more than ten to a car', [0, 1, 2].every((c) => ridersIn(t, c) <= SEATS) && t.riders.every((r) => r.car < 3));
  const each = Math.round(600 / FARE_BLOCKS);
  ok(`their fare: a coin for every ${FARE_BLOCKS} blocks (${each} each from Testford)`, t.riders.every((r) => r.fare === each));
  const aboard = res.on;
  const home = stop(t, stations[0], stations, rng(2));
  ok(`home: all ${aboard} get off and pay ${home.fare}`, home.off === aboard && home.fare === aboard * each);
  ok('and new ones get on for the city', home.on > 0 && t.riders.every((r) => r.to === 'city@600,0'));
}

{
  // Served once per stop: it has to pull away first.
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const t = { cars: 2, speed: 0, riders: [] };
  let at = { x: 600, z: 0 };
  const once = serve([t], stations, () => at, rng(3));
  const again = serve([t], stations, () => at, rng(4));
  ok('a train standing at a station is served once', once.length === 1 && again.length === 0);
  t.speed = 5;
  ok('not while it\'s moving', serve([t], stations, () => ({ x: 0, z: 0 }), rng(5)).length === 0);
  t.speed = 0;
  at = { x: 0, z: 0 };
  ok('then at the next station, again', serve([t], stations, () => at, rng(6)).length === 1);
  const engineOnly = { cars: 0, speed: 0, riders: [] };
  ok('an engine with no cars carries nobody', serve([engineOnly], stations, () => at, rng(7)).length === 0);
}

{
  // Saved with the train; a car taken off lets its people down.
  const world = new World({ sizeX: 32, sizeZ: 32, height: 8 });
  for (let x = 2; x < 30; x++) world.setBlock(x, 1, 5, 378);
  const trains = new Trains({ world });
  const { train } = trains.place({ x: 28, y: 1, z: 5 }, { x: 1, z: 0 });
  trains.couple(train);
  train.riders = [{ car: 0, n: 6, to: 'home', fare: 3 }];
  const back = new Trains({ world });
  back.loadJSON(JSON.parse(JSON.stringify(trains.toJSON())));
  ok('who\'s riding is saved with the train', back.list[0].riders.length === 1 && back.list[0].riders[0].n === 6);
  trains.uncouple(train);
  ok('take the car off and they get down', train.riders.length === 0);
}

ok('the fare goes in your bag, and a storehouse if it\'s full', /this\.inventory\.add\('coin', m\.fare\)/.test(readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8')));
ok('each stop is said: who got off and paid, who got on', /title: `Station: \$\{where\}`/.test(game));
ok('pointing at a car says who\'s aboard and where to', /ridersText\(t, aboard\.part\.index - 1\)/.test(game));
ok('and they sit in the windows', /v\.seats\.forEach/.test(readFileSync(new URL('../src/render/TrainView.js', import.meta.url), 'utf8')));

process.exit(f ? 1 : 0);
