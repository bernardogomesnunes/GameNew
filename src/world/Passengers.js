/**
 * People riding the trains (backlog batch 2: "An engine plus up to 5 cars,
 * each carrying 10 people" — waiting, until now, for the living cities, so
 * there was somewhere to take them).
 *
 * The stations are your settlement and every living city. Stop a train with
 * its engine within STOP_RANGE of one and, once per stop, whoever was going
 * there gets off and pays their fare — a coin for every FARE_BLOCKS of the
 * journey — and whoever's waiting gets on, for one of the other stations,
 * as many as there are seats. Pure logic: DuiltGame calls `serve` and pays
 * the coins; TrainView seats them in the windows.
 *
 * On a train: `riders`, a list of { car, n, to, fare } — `car` the car's
 * index from 0, `n` how many, `to` a station's key, `fare` each.
 */

/** Seats in a car. */
export const SEATS = 10;
/** How near a station's middle the engine has to stop. */
export const STOP_RANGE = 40;
/** A coin for every this many blocks travelled. */
export const FARE_BLOCKS = 120;
/** Below this speed a train counts as stopped. */
const STOPPED = 0.05;

/** The names a living city goes by — one each, from where it stands. */
export const CITY_NAMES = ['Ashford', 'Marrowgate', 'Pellmoor', 'Cindervale', 'Harrowmere', 'Oakhollow', 'Westerley', 'Brindlecombe', 'Saltmarsh', 'Thornwick', 'Larkspur', 'Duncaster'];

/** A city's name, the same every time for the same place. */
export function cityName(x, z) {
  const h = Math.abs((Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)) >>> 0);
  return CITY_NAMES[h % CITY_NAMES.length];
}

/**
 * The stations: home (your settlement's middle) and every living city.
 * Each { key, name, x, z }.
 */
export function stationsFor(landmarks, home) {
  const out = [];
  if (home) out.push({ key: 'home', name: 'home', x: home.x, z: home.z });
  for (const l of landmarks ?? []) {
    if (l.kind === 'city') out.push({ key: `city@${l.x},${l.z}`, name: l.name ?? cityName(l.x, l.z), x: l.x, z: l.z });
  }
  return out;
}

/** The station a point is at, or null. */
export function stationAt(point, stations) {
  let best = null, bd = STOP_RANGE;
  for (const s of stations) {
    const d = Math.hypot(point.x - s.x, point.z - s.z);
    if (d <= bd) { best = s; bd = d; }
  }
  return best;
}

/** How many ride in car `car`. */
export function ridersIn(train, car) {
  return (train.riders ?? []).filter((r) => r.car === car).reduce((t, r) => t + r.n, 0);
}

/**
 * One stop at `station`: who's for here gets off and pays; who's waiting
 * gets on. `rand` decides how many are waiting. Returns { off, fare, on, to }
 * — `to`, the names of where the new ones are going.
 */
export function stop(train, station, stations, rand = Math.random) {
  train.riders ??= [];
  let off = 0, fare = 0;
  train.riders = train.riders.filter((r) => {
    if (r.to !== station.key) return true;
    off += r.n;
    fare += r.n * r.fare;
    return false;
  });
  const elsewhere = stations.filter((s) => s.key !== station.key);
  let on = 0;
  const to = new Set();
  if (elsewhere.length) {
    for (let car = 0; car < (train.cars ?? 0); car++) {
      const free = SEATS - ridersIn(train, car);
      // A few to a carriage-full: never nobody, a busy station fills it.
      const waiting = Math.min(free, 2 + Math.floor(rand() * (SEATS - 1)));
      if (waiting <= 0) continue;
      const dest = elsewhere[Math.floor(rand() * elsewhere.length)];
      const each = Math.max(1, Math.round(Math.hypot(dest.x - station.x, dest.z - station.z) / FARE_BLOCKS));
      const same = train.riders.find((r) => r.car === car && r.to === dest.key);
      if (same) same.n += waiting;
      else train.riders.push({ car, n: waiting, to: dest.key, fare: each });
      on += waiting;
      to.add(dest.name);
    }
  }
  return { off, fare, on, to: [...to] };
}

/**
 * Every train standing at a station, served once per stop — it has to pull
 * away (out of range) before that station serves it again. Returns the stops
 * made, each { train, station, off, fare, on, to }.
 */
export function serve(trains, stations, engineAt, rand = Math.random) {
  const made = [];
  for (const t of trains) {
    if (!t.cars) { t.lastStop = null; continue; }
    const at = stationAt(engineAt(t), stations);
    if (!at) { t.lastStop = null; continue; }
    if (Math.abs(t.speed) > STOPPED || t.lastStop === at.key) continue;
    t.lastStop = at.key;
    const res = stop(t, at, stations, rand);
    if (res.off || res.on) made.push({ train: t, station: at, ...res });
  }
  return made;
}
