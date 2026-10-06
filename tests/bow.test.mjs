import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { BIOMES } from '../src/config/biomes.js';
import { cropBlock, RIPE, CROPS_BY_KIND } from '../src/config/crops.js';
import { harvestOf } from '../src/duilt/Crops.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { TRADERS } from '../src/config/traders.js';
import { itemIcon } from '../src/config/cubes.js';
import { Arrows, ARROW_SPEED, ARROW_DAMAGE, STUCK_SECONDS } from '../src/world/Arrows.js';

/**
 * Asked for directly: "we don't have bow and arrows ... Arrow is made from
 * string, which should come from fiber from hemp that is planted in the
 * wild. Traders will allow to trade for this. If you get one plant, you
 * should be able to plant its seeds to have more. Or you can be lucky
 * enough to find a seed while going through turf."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const duilt = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');

// --- hemp -----------------------------------------------------------------------------

{
  const hemp = CROPS_BY_KIND.get('hemp');
  ok('hemp is a crop, with seeds you plant', !!hemp && ITEMS_BY_ID.get('seeds_hemp')?.block === cropBlock('hemp', 0));
  const ripe = harvestOf(cropBlock('hemp', RIPE));
  ok(`picked ripe it gives fibre, and seeds to plant more (${JSON.stringify(ripe)})`, ripe.hemp_fibre === 2 && ripe.seeds_hemp === 2);
  ok('a seed can turn up in the turf', /GRASS_DROPS = \[\[WILD_SEEDS/.test(duilt) && /FIELD_CROPS\.map/.test(duilt) && hemp.kind !== 'coffee');

  // It grows wild on open grass in the plains.
  const PLAINS = BIOMES.findIndex((b) => b.id === 'plains');
  let found = 0, onGrass = 0, columns = 0;
  for (const seed of [1, 2, 3]) {
    const gen = new ChunkGen({ seed });
    const world = new World({ height: gen.height, gen });
    for (let x = -400; x < 400 && found < 20; x += 3) {
      for (let z = -400; z < 400 && found < 20; z += 3) {
        if (gen.biomeIndexAt(x, z) !== PLAINS) continue;
        columns++;
        const h = world.surfaceHeight(x, z);
        if (world.getBlock(x, h, z) !== cropBlock('hemp', RIPE)) continue;
        found++;
        if (world.getBlock(x, h - 1, z) === 1) onGrass++;
      }
    }
    if (found >= 20) break;
  }
  ok(`wild hemp grows in the plains (${found} found in ${columns} columns looked at), ripe`, found >= 5);
  ok('and only on grass', onGrass === found);
}

// --- what it makes ----------------------------------------------------------------------

{
  const recipe = (id) => RECIPES.find((r) => r.output.id === id);
  ok('fibre is spun into string', recipe('string')?.inputs.hemp_fibre > 0);
  ok('string and planks make a bow', recipe('bow')?.inputs.string > 0 && recipe('bow').inputs.planks > 0);
  ok('and arrows', recipe('arrow')?.inputs.string > 0 && recipe('arrow').output.count > 1);
  ok('all from the first age, by hand', ['string', 'bow', 'arrow'].every((id) => recipe(id).age === 1 && recipe(id).station === 'hand'));
  const bow = ITEMS_BY_ID.get('bow');
  ok('the bow is a weapon that wears', bow.kind === 'tool' && bow.weapon && bow.ranged && bow.durability > 0);
  ok('each has an icon', ['bow', 'arrow', 'string', 'hemp_fibre', 'seeds_hemp'].every((id) => (itemIcon(ITEMS_BY_ID.get(id)) ?? '').startsWith('<svg')));
  const sold = new Set(TRADERS.flatMap((t) => t.goods.map(([id]) => id)));
  ok('traders sell hemp seeds, fibre, string, bows and arrows', ['seeds_hemp', 'hemp_fibre', 'string', 'bow', 'arrow'].every((id) => sold.has(id)));
}

// --- arrows in flight -------------------------------------------------------------------

const flatWorld = () => {
  const w = new World({ sizeX: 128, sizeZ: 32, height: 16 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 32; z++) w.setBlock(x, 0, z, 3);
  return w;
};
const run = (arrows, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) arrows.tick(1 / 60); };

{
  const w = flatWorld();
  for (let y = 1; y < 16; y++) for (let z = 0; z < 32; z++) w.setBlock(40, y, z, 3);
  const arrows = new Arrows({ world: w });
  const a = arrows.shoot({ x: 10, y: 8, z: 16 }, { x: 1, y: 0, z: 0 });
  ok(`an arrow flies fast (${ARROW_SPEED} blocks a second)`, Math.abs(a.vx - ARROW_SPEED) < 1e-9);
  run(arrows, 0.5);
  ok(`and drops a little as it goes (${(8 - a.y).toFixed(2)} blocks over ${(a.x - 10).toFixed(1)})`, a.x > 25 && a.y < 8 && a.y > 6.5);
  run(arrows, 1);
  ok(`it sticks in the wall it meets (at x ${a.x.toFixed(2)})`, a.stuck && a.x > 39 && a.x < 40.5 && arrows.list.includes(a));
  run(arrows, STUCK_SECONDS + 1);
  ok('and is gone a while later', !arrows.list.includes(a));
}

{
  // Something alive in the way: the arrow stops in it and says so.
  const w = flatWorld();
  const deer = { x: 30, y: 8, z: 16 };
  const hits = [];
  const arrows = new Arrows({
    world: w,
    hitTest: (from, dir, len) => {
      const t = (deer.x - from.x) * dir.x;
      return t >= 0 && t <= len && Math.abs(from.y + dir.y * t - deer.y) < 1 ? { kind: 'mob', mob: deer, t } : null;
    },
    onHit: (arrow, hit) => hits.push({ arrow, hit }),
  });
  arrows.shoot({ x: 10, y: 8.2, z: 16 }, { x: 1, y: 0, z: 0 });
  run(arrows, 1);
  ok('an arrow that meets an animal hits it, once, and is spent', hits.length === 1 && hits[0].hit.mob === deer && arrows.list.length === 0);
  ok(`right where it is (x ${hits[0]?.arrow.x.toFixed(2)})`, Math.abs(hits[0].arrow.x - 30) < 0.01);
  ok(`for ${ARROW_DAMAGE} — a bandit falls to three`, ARROW_DAMAGE === 5);
}

// --- in the game -------------------------------------------------------------------------

// Drawn and let go now (tests/drawbow.test.mjs); Break still shoots where nothing draws.
ok('with the bow in hand, Break shoots', /bow: 'shootBow'/.test(game) && /shootBow\(shot = drawShot\(FULL_DRAW_MS\)\) \{/.test(game));
ok('each shot spends an arrow, and you\'re told when there are none', /inventory\.remove\('arrow', 1\)/.test(game) && /title: 'No arrows'/.test(game));
ok('it wears the bow', /useTool\('bow'\)/.test(game));
ok('animals and bandits both take the hit — as hard as the bow was drawn', /const damage = arrow\.damage \?\? ARROW_DAMAGE;/.test(game) && /this\.mobs\.hit\(hit\.mob, damage/.test(game) && /this\.wanderers\.hit\(p, damage/.test(game));
ok('and fall the same as to a blow', /if \(killed\) this\.mobFell\(hit\.mob, drops\)/.test(game) && /if \(res\.killed\) this\.banditFell\(p, res\)/.test(game));
ok('your own horse is never shot', /!mob\.mob\.owned/.test(game));

process.exit(f ? 1 : 0);
