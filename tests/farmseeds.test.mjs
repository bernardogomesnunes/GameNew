import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame, GRASS_DROPS, WILD_SEEDS } from '../src/duilt/DuiltGame.js';
import { ITEMS_BY_ID, LEGACY_ITEMS } from '../src/config/items.js';
import { Inventory } from '../src/items/Inventory.js';
import { STRUCTURES, STRUCTURES_BY_ID } from '../src/config/structures.js';
import { RECIPES } from '../src/config/recipes.js';
import { LOOT } from '../src/duilt/Loot.js';
import { FARM_SEED_SLOTS } from '../src/duilt/Crops.js';

/**
 * Backlog batch 2, the farm seeds rework:
 *   - no mixed seeds;
 *   - a farm needs no seeds to build;
 *   - put in one seed per crop you want, up to 4 crops;
 *   - a carrot seed in means carrots and carrot seeds come out.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- no mixed seeds ------------------------------------------------------------------

ok('there is no Mixed Seeds item any more', !ITEMS_BY_ID.has('seeds'));
ok('nothing makes it, costs it or needs it',
  STRUCTURES.every((s) => !('seeds' in (s.produces ?? {})) && !('seeds' in (s.cost ?? {})))
  && RECIPES.every((r) => !('seeds' in (r.inputs ?? {})) && r.output?.id !== 'seeds')
  && Object.values(LOOT).every((l) => l.items.every(([id]) => id !== 'seeds')));
ok('grass gives one crop\'s seeds, never coffee — hemp\'s too (asked for: "lucky enough to find a seed while going through turf")', GRASS_DROPS[0][0] === WILD_SEEDS && WILD_SEEDS.length === 8 && !WILD_SEEDS.includes('seeds_coffee') && WILD_SEEDS.includes('seeds_hemp'));
ok('Place with seeds no longer plants "whatever comes up"', !/plantMixed/.test(game));
{
  const inv = new Inventory();
  inv.loadJSON({ slots: [{ id: 'seeds', count: 6 }, null, { id: 'seeds_potato', count: 2 }] });
  ok('an old bag\'s mixed seeds come back as carrot seeds', LEGACY_ITEMS.seeds === 'seeds_carrot' && inv.countOf('seeds_carrot') === 6 && inv.countOf('seeds_potato') === 2);
}

// --- a farm, sown from its pop-up ------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.grantStartingKit();
  ok('a farm costs nothing to build', !STRUCTURES_BY_ID.get('farm').cost);
  ok('a new game starts with no mixed seeds, and some carrot and potato seeds', g.inventory.countOf('seeds_carrot') > 0 && g.inventory.countOf('seeds_potato') > 0);

  const farm = { id: 1, type: 'farm', region: { minX: 0, maxX: 3, minY: 0, maxY: 1, minZ: 0, maxZ: 3 } };
  ok('an empty farm grows nothing', Object.keys(g.producesFor(farm)).length === 0);

  const carrots = g.inventory.countOf('seeds_carrot');
  ok('a carrot seed goes in', g.sowFarm(farm, 'carrot').ok && farm.seeds.join() === 'carrot');
  ok('taken from your bag', g.inventory.countOf('seeds_carrot') === carrots - 1);
  const made = g.producesFor(farm);
  ok('and carrots and carrot seeds come out', made.vegetables === 1 && made.seeds_carrot === 1 && Object.keys(made).length === 2);
  ok('one seed a crop: a second carrot seed is refused', !g.sowFarm(farm, 'carrot').ok && g.inventory.countOf('seeds_carrot') === carrots - 1);

  const nope = g.sowFarm(farm, 'pepper');
  ok('a seed you have none of is refused, and says so', !nope.ok && /no pepper seeds/i.test(nope.reason));

  for (const k of ['potato', 'cabbage', 'lettuce']) g.inventory.add(`seeds_${k}`, 1);
  g.inventory.add('seeds_pepper', 1);
  ok('up to four crops', ['potato', 'cabbage', 'lettuce'].every((k) => g.sowFarm(farm, k).ok) && farm.seeds.length === FARM_SEED_SLOTS);
  const full = g.sowFarm(farm, 'pepper');
  ok('a fifth is refused', !full.ok && /4 crops at most/.test(full.reason) && g.inventory.countOf('seeds_pepper') === 1);
  const four = g.producesFor(farm);
  ok('four crops in, four crops out, each with its seeds', ['vegetables', 'potato', 'cabbage', 'lettuce'].every((id) => four[id] === 1)
    && ['carrot', 'potato', 'cabbage', 'lettuce'].every((k) => four[`seeds_${k}`] === 1));

  ok('taking one out gives its seed back', g.unsowFarm(farm, 'cabbage').ok && !farm.seeds.includes('cabbage') && g.inventory.countOf('seeds_cabbage') === 1);
  ok('and then there is room again', g.sowFarm(farm, 'pepper').ok);
}

// --- kept with the save -------------------------------------------------------------------

{
  const reg = readFileSync(new URL('../src/structures/StructureRegistry.js', import.meta.url), 'utf8');
  ok('a farm\'s seeds are saved with it', /\.\.\.\(s\.seeds\?\.length \? \{ seeds: s\.seeds \} : \{\}\)/.test(reg));
}

// --- the pop-up -----------------------------------------------------------------------

ok('the farm\'s pop-up shows its crop slots', /spec\?\.fromCrops \? this\.farmSeedsHtml\(structure\) : ''/.test(ui) && /Crops · \$\{sown\.length\} of \$\{FARM_SEED_SLOTS\}/.test(ui));
ok('tap a seed to put it in, a crop to take it out',
  /data-sow="\$\{c\.kind\}"/.test(ui) && /data-unsow="\$\{kind\}"/.test(ui)
  && /onSow: \(kind\) => this\.sowFarm\(structure, kind, true\)/.test(game) && /onUnsow: \(kind\) => this\.sowFarm\(structure, kind, false\)/.test(game));
ok('and it redraws when the crops change', /this\.bus\.on\('structure:sown'/.test(ui));

process.exit(f ? 1 : 0);
