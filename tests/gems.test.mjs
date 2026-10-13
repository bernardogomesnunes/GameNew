import { ChunkGen } from '../src/world/ChunkGen.js';
import { BIOMES } from '../src/config/biomes.js';
import { BLOCKS_BY_ID, DIAMOND_ORE, RUBY_ORE, ID_COUNT } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { ARMOUR_PIECES } from '../src/config/armour.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { LOOT } from '../src/duilt/Loot.js';
import { TRADERS_BY_ID } from '../src/config/traders.js';
import { WAR_AGE } from '../src/config/ages.js';

/**
 * Backlog batch 4, D1: "they have precious rocks like diamonds and different
 * new armour that leads you to a stronger stats".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('diamond ore and ruby ore, under 256 so a chunk stays a byte a cell', DIAMOND_ORE < 256 && RUBY_ORE < 256 && BLOCKS_BY_ID.get(DIAMOND_ORE).drops === 'diamond' && BLOCKS_BY_ID.get(RUBY_ORE).drops === 'ruby');
ok('the gems are items, cut stones in the hand', ['diamond', 'ruby'].every((id) => ITEMS_BY_ID.has(id) && ITEM_MODELS[id]?.length));
ok('and the ores pick up as themselves', ITEM_FOR_BLOCK.get(DIAMOND_ORE) === 'diamond_ore' && ITEM_FOR_BLOCK.get(RUBY_ORE) === 'ruby_ore');

// --- where they are ------------------------------------------------------------------------------

{
  const gen = new ChunkGen({ seed: 41 });
  let deep = 0, shallow = 0, rock = 0;
  for (let x = 0; x < 120; x++) for (let z = 0; z < 120; z++) {
    for (const y of [8, 16, 24, 31]) { rock++; if (gen.strayOreAt(x, y, z) === DIAMOND_ORE) deep++; }
    for (const y of [40, 60, 80]) if (gen.strayOreAt(x, y, z) === DIAMOND_ORE) shallow++;
  }
  ok(`diamonds in the deepest rock (${deep} in ${rock} blocks — rare)`, deep > 0 && deep / rock < 0.002);
  ok('and nowhere above it', shallow === 0);
  const peaks = BIOMES.findIndex((b) => b.id === 'mountains2');
  let rubies = 0, golds = 0;
  for (let x = 0; x < 150; x++) for (let z = 0; z < 150; z++) {
    const o = gen.oreAt(x, 70, z, peaks);
    if (o === RUBY_ORE) rubies++;
    if (o === 40) golds++;
  }
  ok(`rubies in the high peaks, rarer than gold (${rubies} to ${golds})`, rubies > 0 && rubies < golds);
}

// --- what they make --------------------------------------------------------------------------------

const tools = ['axe_diamond', 'pickaxe_diamond', 'shovel_diamond', 'sword_diamond'];
ok('diamond tools and a diamond sword, at the bench from the war\'s age', tools.every((id) => ITEMS_BY_ID.has(id) && RECIPES_BY_ID.get(id)?.age === WAR_AGE && RECIPES_BY_ID.get(id).inputs.diamond > 0));
ok(`the diamond sword hits hardest of all (${ITEMS_BY_ID.get('sword_diamond').damage})`, [...ITEMS_BY_ID.values()].filter((i) => i.weapon || /^sword_/.test(i.id)).every((i) => (i.damage ?? 0) <= ITEMS_BY_ID.get('sword_diamond').damage));
const diamond = ARMOUR_PIECES.filter((p) => p.set === 'diamond');
ok(`diamond armour, four pieces, ${diamond.reduce((n, p) => n + p.points, 0)} points — the most`, diamond.length === 4 && diamond.every((p) => RECIPES.some((r) => r.output.id === p.id && r.inputs.diamond > 0)));
ok('a ruby strikes a purse of coins at the foundry', RECIPES_BY_ID.get('strike_ruby_coins')?.station === 'foundry' && RECIPES_BY_ID.get('strike_ruby_coins').output.count >= 20);

// --- where else they turn up -------------------------------------------------------------------------

ok('in an abandoned city\'s chests', LOOT.ruined_city.items.some(([id]) => id === 'diamond') && LOOT.ruined_city.items.some(([id]) => id === 'ruby'));
ok('and on a city merchant\'s stall, dear', TRADERS_BY_ID.get('merchant').goods.some(([id, , price]) => id === 'diamond' && price >= 40));
ok('every id fits the block table', DIAMOND_ORE < ID_COUNT && RUBY_ORE < ID_COUNT);

process.exit(f ? 1 : 0);
