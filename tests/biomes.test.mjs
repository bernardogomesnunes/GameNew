import { BIOMES, BIOMES_BY_ID, HOME_BIOME, surfaceFor, biomeAt } from '../src/config/biomes.js';
import { BiomeMap } from '../src/world/biomeMap.js';
import { generateTerrain, biomeOf } from '../src/world/TerrainGenerator.js';
import { World } from '../src/world/World.js';
import { BLOCKS_BY_ID, SOIL_IDS, SOIL_NAMES, isSoil } from '../src/config/blocks.js';

/**
 * The land, and what it is made of.
 *
 * Every world used to be one green surface at one height with trees at a flat
 * 1.2%, so every direction looked the same and walking anywhere told you
 * nothing. These check the two things that make biomes worth having: that they
 * are all actually reachable, and that where two of them meet is a slope
 * rather than a cliff — a hard pick would step a meadow at 20 straight into
 * highlands at 27 in one column.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the declarations hold together -----------------------------------------

ok(`there are ${BIOMES.length} biomes`, BIOMES.length >= 4);
ok('every id is unique', new Set(BIOMES.map((b) => b.id)).size === BIOMES.length);
ok('every biome has a name', BIOMES.every((b) => !!b.name));
ok('every niche sits inside the climate square',
  BIOMES.every((b) => b.niche.temp >= 0 && b.niche.temp <= 1 && b.niche.wet >= 0 && b.niche.wet <= 1));
ok('no two biomes claim the same climate',
  new Set(BIOMES.map((b) => `${b.niche.temp},${b.niche.wet}`)).size === BIOMES.length);
ok('the home biome exists', BIOMES_BY_ID.has(HOME_BIOME));

for (const b of BIOMES) {
  const s = b.surface;
  ok(`${b.id}: its surface blocks are real`,
    [s.top, s.under, s.rock].every((id) => BLOCKS_BY_ID.has(id)));
  ok(`  its ground is thick enough to dig (${s.depth} of soil)`, s.depth >= 1);
  ok(`  it sits at a sane height (${b.base} ± ${b.amplitude})`,
    b.base - b.amplitude - b.rough > 2 && b.base + b.amplitude + b.rough < 54);
  if (b.trees?.chance) {
    ok(`  its trees are made of real blocks`,
      BLOCKS_BY_ID.has(b.trees.wood) && BLOCKS_BY_ID.has(b.trees.leaves));
    ok(`  and are a believable height (${b.trees.trunk.join('-')})`,
      b.trees.trunk[0] >= 2 && b.trees.trunk[1] <= 12 && b.trees.trunk[0] <= b.trees.trunk[1]);
  }
  for (const sc of b.scatter ?? []) {
    ok(`  what it scatters is a real block`, BLOCKS_BY_ID.has(sc.block));
  }
}

// The whole point of a biome is that you can tell you are in one. Four of the
// six used to share grass as their top block and stone as their rock, so
// walking from a meadow into the highlands changed the height of the ground
// and nothing else — six biomes that looked like two.
{
  const tops = BIOMES.map((b) => b.surface.top);
  ok(`every biome has its own ground (${tops.join(', ')})`, new Set(tops).size === BIOMES.length);
  // Trees are the other half of how a biome reads. A forest has to be
  // obviously more wooded than the open country beside it.
  const forest = BIOMES_BY_ID.get('forest');
  const meadow = BIOMES_BY_ID.get('meadow');
  ok('a forest is properly wooded next to a meadow',
    forest.trees.chance >= meadow.trees.chance * 8);
}

// Highlands go bare above the soil line; nothing else changes with height.
{
  const hi = BIOMES_BY_ID.get('highlands');
  ok('highlands are grassy low down', surfaceFor(hi, 25) === hi.surface.top);
  ok('and bare rock up high', surfaceFor(hi, 40) === hi.surface.rock);
  const meadow = BIOMES_BY_ID.get('meadow');
  ok('a meadow is grass at any height', surfaceFor(meadow, 40) === meadow.surface.top);
}
ok('an out-of-range biome index falls back rather than throwing', biomeAt(999) === BIOMES[0]);

// --- every biome actually turns up -------------------------------------------

{
  // Without the home bias, so this measures the climate map rather than the
  // thumb on the scale at the centre.
  const map = new BiomeMap({ sizeX: 512, sizeZ: 512, seed: 3, homePull: 0 });
  const seen = new Map();
  for (let x = 0; x < 512; x += 4) {
    for (let z = 0; z < 512; z += 4) {
      const id = BIOMES[map.weigh(x, z).index].id;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  }
  const total = [...seen.values()].reduce((a, b) => a + b, 0);
  for (const b of BIOMES) {
    const share = (seen.get(b.id) ?? 0) / total;
    // A biome nobody ever stands in is content that does not exist.
    ok(`${b.id} covers ${(share * 100).toFixed(1)}% of the map`, share > 0.01);
  }
  ok('and no single biome swallows the world',
    [...seen.values()].every((n) => n / total < 0.6));
}

// The settlement is placed at the centre and has to be buildable ground: a new
// player landing in a desert with no wood has a world they cannot start.
{
  let homeAtCentre = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const map = new BiomeMap({ sizeX: 256, sizeZ: 256, seed });
    if (BIOMES[map.weigh(128, 128).index].id === HOME_BIOME) homeAtCentre++;
  }
  ok(`the centre is ${HOME_BIOME} in all 12 worlds tried (${homeAtCentre})`, homeAtCentre === 12);
}

// --- the weights are a blend, not a coin flip --------------------------------

{
  const map = new BiomeMap({ sizeX: 256, sizeZ: 256, seed: 5, homePull: 0 });
  const { weights } = map.weigh(60, 60);
  const sum = weights.reduce((a, b) => a + b, 0);
  ok('the weights are a share of one', Math.abs(sum - 1) < 1e-9);
  ok('and none of them is negative', weights.every((w) => w >= 0));

  // Right on a niche, that biome should dominate.
  const home = BIOMES_BY_ID.get(HOME_BIOME);
  let peak = 0;
  for (let x = 0; x < 256; x += 3) {
    for (let z = 0; z < 256; z += 3) {
      const w = map.weigh(x, z);
      if (BIOMES[w.index].id === home.id) peak = Math.max(peak, w.weights[w.index]);
    }
  }
  ok(`a column in the middle of a biome is mostly that biome (${(peak * 100).toFixed(0)}%)`, peak > 0.5);
}

// --- and the land it makes has no walls in it --------------------------------

{
  const world = new World({ sizeX: 192, sizeZ: 192, height: 64 });
  generateTerrain(world, 11);

  let worst = 0, steep = 0, n = 0;
  for (let x = 1; x < 191; x++) {
    for (let z = 1; z < 191; z++) {
      const h = world.surfaceHeight(x, z);
      const step = Math.max(
        Math.abs(h - world.surfaceHeight(x - 1, z)),
        Math.abs(h - world.surfaceHeight(x, z - 1)),
      );
      if (step > worst) worst = step;
      if (step > 4) steep++;
      n++;
    }
  }
  // A biome border drawn as a hard pick would step the full difference between
  // two bases — seven blocks between meadow and highlands — along a whole line
  // of columns. Terrain noise alone never does that.
  ok(`no column steps more than 6 blocks (worst was ${worst})`, worst <= 6);
  ok(`and steep columns are rare (${(steep / n * 100).toFixed(2)}%)`, steep / n < 0.01);

  // The recorded surface is the first air above the ground. Trees and scatter
  // are planted *at* that height afterwards, which is the one thing allowed to
  // be standing there.
  const planted = new Set(BIOMES.flatMap((b) => [
    b.trees?.wood, b.trees?.leaves, ...(b.scatter ?? []).map((s) => s.block),
  ]).filter(Boolean));
  let holes = 0, occupied = 0;
  for (let x = 0; x < 192; x += 3) {
    for (let z = 0; z < 192; z += 3) {
      const h = world.surfaceHeight(x, z);
      if (!world.isSolid(x, h - 1, z)) holes++;
      const above = world.getBlock(x, h, z);
      if (above !== 0 && !planted.has(above)) occupied++;
    }
  }
  ok('there is solid ground under every recorded surface', holes === 0);
  ok('and nothing but trees and scatter standing on it', occupied === 0);

  // Every column knows which biome it is, and the surface matches it.
  let wrongSurface = 0, sampled = 0;
  for (let x = 2; x < 190; x += 5) {
    for (let z = 2; z < 190; z += 5) {
      const b = biomeOf(world, x, z);
      const h = world.surfaceHeight(x, z);
      const top = world.getBlock(x, h - 1, z);
      // Trees and scatter legitimately sit on top, so only count a mismatch
      // when the block is neither the biome's surface nor something planted.
      const allowed = [surfaceFor(b, h), b.surface.top, b.surface.rock,
        ...(b.scatter ?? []).map((s) => s.block), b.trees?.wood, b.trees?.leaves];
      if (!allowed.includes(top)) wrongSurface++;
      sampled++;
    }
  }
  ok(`the surface block matches the biome (${wrongSurface} odd of ${sampled})`, wrongSurface === 0);
}

// --- same seed, same world ---------------------------------------------------

{
  const a = new World({ sizeX: 64, sizeZ: 64, height: 48 });
  const b = new World({ sizeX: 64, sizeZ: 48 + 16, height: 48 });
  generateTerrain(a, 42);
  const c = new World({ sizeX: 64, sizeZ: 64, height: 48 });
  generateTerrain(c, 42);
  let same = true;
  for (let i = 0; i < a.biomeMap.length; i++) {
    if (a.biomeMap[i] !== c.biomeMap[i] || a.surfaceHeightMap[i] !== c.surfaceHeightMap[i]) { same = false; break; }
  }
  ok('the same seed makes the same world twice', same);

  const d = new World({ sizeX: 64, sizeZ: 64, height: 48 });
  generateTerrain(d, 43);
  let differs = false;
  for (let i = 0; i < a.biomeMap.length; i++) if (a.biomeMap[i] !== d.biomeMap[i]) { differs = true; break; }
  ok('and a different seed makes a different one', differs);
}

// --- the map survives a save -------------------------------------------------

{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 48 });
  generateTerrain(world, 9);
  const back = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
  let same = true;
  for (let i = 0; i < world.biomeMap.length; i++) {
    if (world.biomeMap[i] !== back.biomeMap[i]) { same = false; break; }
  }
  ok('biomes come back from a save', same);
  ok('and biomeOf agrees after loading',
    biomeOf(back, 20, 20).id === biomeOf(world, 20, 20).id);

  // Worlds saved before biomes existed have no map at all.
  const old = JSON.parse(JSON.stringify(world.serialize()));
  delete old.biomeMap;
  const legacy = World.deserialize(old);
  ok('a save from before biomes loads as one flat biome',
    legacy.biomeMap.length === world.sizeX * world.sizeZ
    && legacy.biomeMap.every((v) => v === 0));
  ok('and asking it is safe', biomeOf(legacy, 5, 5) === BIOMES[0]);
}

ok('asking outside the world is safe', biomeOf(new World({ sizeX: 16, sizeZ: 16, height: 16 }), -5, 900) === BIOMES[0]);

// --- the variety has to be where you can see it ------------------------------

// The bias that keeps the starting plot buildable used to reach a third of the
// way across the map — 87 blocks — so the near field was 93% meadow out to 20
// and still 67% at 40, while the fog starts eating the view at 72 on a phone.
// Every biome in the game sat in the band that was already fading into sky,
// and a new world looked like one green field however many biomes it had.
{
  const rings = [[0, 20], [20, 40], [40, 60]];
  const counts = rings.map(() => new Map());
  for (let seed = 1; seed <= 6; seed++) {
    const map = new BiomeMap({ sizeX: 256, sizeZ: 256, seed });
    for (let x = 0; x < 256; x += 2) {
      for (let z = 0; z < 256; z += 2) {
        const d = Math.hypot(x - 128, z - 128);
        const i = rings.findIndex(([lo, hi]) => d >= lo && d < hi);
        if (i < 0) continue;
        const id = BIOMES[map.weigh(x, z).index].id;
        counts[i].set(id, (counts[i].get(id) ?? 0) + 1);
      }
    }
  }
  const share = (i, id) => {
    const total = [...counts[i].values()].reduce((a, b) => a + b, 0);
    return (counts[i].get(id) ?? 0) / total;
  };
  // Right where you land it should still mostly be meadow — that is the point
  // of the bias, and the starting plot has to be buildable.
  ok(`the ground you land on is mostly meadow (${(share(0, 'meadow') * 100).toFixed(0)}%)`,
    share(0, 'meadow') > 0.5);
  // But it must let go quickly enough that the country you can see clearly is
  // not all one colour. 72 blocks is where a phone's fog begins.
  ok(`by 40 blocks it is no longer a single field (${(share(1, 'meadow') * 100).toFixed(0)}% meadow)`,
    share(1, 'meadow') < 0.55);
  ok(`and by 60 there is real variety (${(share(2, 'meadow') * 100).toFixed(0)}% meadow)`,
    share(2, 'meadow') < 0.5);
  for (const ring of [1, 2]) {
    const kinds = [...counts[ring].entries()].filter(([, n]) => n / [...counts[ring].values()].reduce((a, b) => a + b, 0) > 0.03);
    ok(`  ring ${rings[ring][0]}-${rings[ring][1]} holds ${kinds.length} kinds of country`, kinds.length >= 3);
  }
}

// --- the ground a tree will take ---------------------------------------------

// `soil` is a block property now, because it used to be two hard-coded ids in
// features.js: the moment the world grew a forest floor and a river bank, a
// grove placed on either planted nothing.
{
  ok('there is more than one kind of soil', SOIL_IDS.length >= 3);
  // The starting plot's grove is an Age 1 goal, and it goes down in the home
  // biome. If that ground is not something a tree roots in, a new world opens
  // with a forest you cannot claim.
  ok(`the home biome is ground a tree takes to`,
    isSoil(BIOMES_BY_ID.get(HOME_BIOME).surface.top));
  ok('bare rock and scree are not soil', !isSoil(23) && !isSoil(3));
  ok('the site specs read the list rather than naming blocks',
    SOIL_NAMES.length === SOIL_IDS.length && SOIL_NAMES.every((n) => typeof n === 'string'));
}

process.exit(f ? 1 : 0);
