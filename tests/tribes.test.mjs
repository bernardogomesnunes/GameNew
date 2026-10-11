import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { landmarksFor, landmarkDesigns, PLACE_NAMES } from '../src/world/landmarks.js';
import { WANDERERS, NEWS } from '../src/config/wanderers.js';
import { BIOMES } from '../src/config/biomes.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { LOOT } from '../src/duilt/Loot.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { talkLine, TRIBE_TALK } from '../src/config/talk.js';
import { MOMENTS } from '../src/config/moments.js';

/**
 * Backlog batch 2, "More places in the wild" — tree tribes in the tallest
 * trees: "mystical tree houses full of vibrant greens, with wooden bridges
 * between trees; huts inside the leaves, and watchtowers on top of the
 * canopy with stairs around them; neutral, but hostile if you steal from
 * their chests or attack them; they never come down from the trees."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- where they are ------------------------------------------------------------------------------

{
  let total = 0, wooded = 0, far = true;
  for (const seed of [41, 2024, 7, 99]) {
    const gen = new ChunkGen({ seed });
    const tribes = landmarksFor(gen).filter((l) => l.kind === 'tribe');
    total += tribes.length;
    for (const t of tribes) {
      if (['giantGrove', 'forestOak', 'forestDark', 'forestBirch'].includes(BIOMES[gen.biomeIndexAt(t.x, t.z)]?.id)) wooded++;
      const d = Math.hypot(t.x - gen.biomes.centreX, t.z - gen.biomes.centreZ);
      // Out past where the border runs before the war (512 across at the most).
      if (d < 300) far = false;
    }
  }
  ok(`tree tribes in every world (${total} over four seeds)`, total >= 8);
  ok(`in the woods, most of them (${wooded} of ${total})`, wooded >= total * 0.75);
  ok('out past the old border — somewhere to go once the wall is down', far);
  const gen = new ChunkGen({ seed: 41 });
  const lms = landmarksFor(gen);
  const tribes = lms.filter((l) => l.kind === 'tribe');
  ok('never on top of another place', tribes.every((t) => lms.every((o) => o === t || Math.max(Math.abs(o.x - t.x), Math.abs(o.z - t.z)) >= o.half + t.half)));
  ok('the same for the same seed', JSON.stringify(landmarksFor(new ChunkGen({ seed: 41 })).filter((l) => l.kind === 'tribe').map((l) => [l.x, l.z])) === JSON.stringify(tribes.map((l) => [l.x, l.z])));
  ok('named, on the map, and in the news', PLACE_NAMES.tribe === 'A tree tribe' && NEWS.tribe.every((l) => l.includes('{dir}')) && MOMENTS.found_tribe);
}

// --- what it's made of -----------------------------------------------------------------------------

const design = landmarkDesigns().find((d) => d.kind === 'tribe');
const at = new Map(design.blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
const get = (x, y, z) => at.get(`${x},${y},${z}`) ?? 0;
const name = (id) => BLOCKS_BY_ID.get(id)?.name ?? '';
const DECK = 12;
{
  const ids = design.blocks.map((b) => b[3]);
  const count = (re) => ids.filter((id) => re.test(name(id))).length;
  ok(`giant trees: ${count(/^Wood$/)} blocks of trunk`, count(/^Wood$/) > 400);
  ok(`vibrant greens: ${count(/Leaves/)} leaves, moss through them`, count(/Leaves/) > 800 && count(/Moss/) > 20);
  ok('firefly lanterns among them', count(/Firefly Lantern/) >= 8);
  ok('two chests', ids.filter((id) => /Chest/.test(name(id))).length === 2);
  ok('it fits its footprint', design.blocks.every(([x, , z]) => Math.abs(x) <= design.half && Math.abs(z) <= design.half));

  // Every deck and bridge reachable from the great tree's deck, walking.
  const floor = new Set();
  for (const [x, y, z, id] of design.blocks) {
    if (y === DECK && (/Planks|Moss/.test(name(id))) && !get(x, DECK + 1, z)) floor.add(`${x},${z}`);
  }
  const seen = new Set(['-3,-3']);
  const todo = ['-3,-3'];
  while (todo.length) {
    const [x, z] = todo.pop().split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${z + dz}`;
      if (floor.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); }
    }
  }
  const outer = [[-10, -8], [10, -7], [-9, 10], [9, 9]];
  ok('bridges run from the great tree to every other', outer.every(([tx, tz]) => [...seen].some((k) => { const [x, z] = k.split(',').map(Number); return Math.abs(x - tx) <= 4 && Math.abs(z - tz) <= 4; })));
  // A rail along every edge of the walkway, so a step wrong isn't a twelve-block fall.
  let open = 0;
  for (const k of floor) {
    const [x, z] = k.split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (floor.has(`${nx},${nz}`) || get(nx, DECK, nz) || get(nx, DECK + 1, nz)) continue;
      if (nx >= -1 && nx <= 2 && nz >= -1 && nz <= 2) continue; // the stair's ring
      open++;
    }
  }
  ok(`railed all round (${open} gaps)`, open === 0);
  // A hut on each of the four, with leaves for a roof.
  ok('huts in under the leaves', outer.every(([tx, tz]) => /Leaves/.test(name(get(tx - 2, DECK + 4, tz - 2))) && get(tx - 2, DECK + 2, tz - 2)));

  // The stair: from the ground, round the great tree, to the tower on top.
  const stairs = design.blocks.filter(([, , , id]) => /Stairs/.test(name(id))).sort((a, b) => a[1] - b[1]);
  const climbs = stairs.every((s, i) => i === 0 || s[1] === stairs[i - 1][1] + 1);
  ok(`a stair round the great tree, ${stairs.length} steps, one up each`, stairs[0][1] === 0 && climbs && stairs.length >= 27);
  ok('with headroom all the way', stairs.every(([x, y, z]) => !get(x, y + 1, z) && !get(x, y + 2, z)));
  const top = stairs[stairs.length - 1];
  ok('to a watchtower on top of the crown, railed and roofed', /Planks/.test(name(get(-2, top[1], -2))) && /Fence/.test(name(get(-2, top[1] + 1, 0)))
    && /Slab/.test(name(get(0, top[1] + 4, 0))) && Math.max(...design.blocks.filter(([, , , id]) => /Leaves/.test(name(id))).map((b) => b[1])) < top[1]);
}

// --- the people ------------------------------------------------------------------------------------

ok('they wear green hoods and carry bows', WANDERERS.tribe && readFileSync(new URL('../src/config/outfits.js', import.meta.url), 'utf8').includes("tribe: { hat: 'hood'"));

const flat = () => {
  const world = new World({ sizeX: 128, sizeZ: 128, height: 64 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) world.setBlock(x, 0, z, 3);
  return world;
};

{
  const world = flat();
  const lm = { kind: 'tribe', x: 64, z: 64, y: 1, half: design.half, perches: landmarksFor(new ChunkGen({ seed: 41 })).find((l) => l.kind === 'tribe').perches };
  for (const [x, y, z, id] of design.blocks) world.setBlock(lm.x + x, lm.y + y, lm.z + z, id);
  const hits = [];
  const w = new Wanderers({ world, rand: rng(3), onAttack: (p, n) => hits.push(n), hostile: () => true });
  w.untilMessenger = w.untilExplorer = 1e9;
  w.landmarks = [lm];
  w.populate(lm);
  const tribe = w.list.filter((p) => p.kind === 'tribe');
  ok(`${tribe.length} of them, up on the decks and the tower`, tribe.length === 7 && tribe.every((p) => p.y >= lm.y + DECK + 1 && world.collisionBoxAt(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z))));
  const player = { x: lm.x + 6.5, y: 1, z: lm.z + 12.5 };
  for (let i = 0; i < 1200; i++) w.tick(0.05, player);
  ok('a minute later, none has come down', tribe.every((p) => p.y >= p.perch - 0.6));
  ok('and none has loosed an arrow at you: they leave you be', hits.length === 0 && w.arrows.length === 0);

  // Take from their chest — and they all see it.
  ok('rob them and every one of them turns', w.anger(lm) === tribe.length && tribe.every((p) => w.hostileOf(p)));
  // Out in the open beside the village — under the decks the planks and
  // leaves stop most of them.
  const open = { x: lm.x + 20, y: 1, z: lm.z };
  let loosed = 0;
  const loose = w.loose.bind(w);
  w.loose = (p, pl) => { loosed++; loose(p, pl); };
  for (let i = 0; i < 600; i++) w.tick(0.05, open);
  ok(`now the arrows come, from up in the trees (${loosed} loosed, ${hits.length} hit you)`, loosed > 10 && hits.length > 0);
  ok('and still none of them comes down after you', tribe.every((p) => p.y >= p.perch - 0.6));
}

{
  // Struck, the same: the whole tribe.
  const world = flat();
  const lm = { kind: 'tribe', x: 64, z: 64, y: 1, half: design.half, perches: [{ dx: 0.5, dy: 13, dz: 4.5 }, { dx: 4.5, dy: 13, dz: 0.5 }] };
  for (const [x, y, z, id] of design.blocks) world.setBlock(lm.x + x, lm.y + y, lm.z + z, id);
  const w = new Wanderers({ world, rand: rng(4), hostile: () => true });
  w.populate(lm);
  const [a, b] = w.list;
  ok('neutral, even where bandits would be hostile', !w.hostileOf(a) && !w.hostileOf(b));
  w.hit(a, 1, a.x + 1, a.z);
  ok('strike one, and they all turn', w.hostileOf(a) && w.hostileOf(b));
}

// --- what they keep, and what they say ---------------------------------------------------------

ok('their chest holds what the forest gives, and bows', LOOT.tribe.items.every(([id]) => ITEMS_BY_ID.has(id)) && LOOT.tribe.items.some(([id]) => id === 'bow'));
ok('taking from it is noticed', /if \(c && !d\.chestAt\(c\.x, c\.y, c\.z\)\?\.grave\) this\.game\.tookFromChest\?\.\(c\);/.test(ui)
  && /tookFromChest\(\{ x, z \}\)[\s\S]{0,400}l\.kind === 'tribe'[\s\S]{0,300}this\.wanderers\.anger\(lm\)/.test(game));
ok('they\'ll talk, while they\'re not angry with you', /TALKERS = new Set\(\[[^\]]*'tribe'/.test(game) && /!p\.angry && !p\.dead/.test(game)
  && TRIBE_TALK.includes(talkLine({ who: 'tribe', person: { id: 1 } })));

process.exit(f ? 1 : 0);
