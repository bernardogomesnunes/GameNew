import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { World } from '../src/world/World.js';

/**
 * Asked for directly: "would be nice to have an accelerator on the
 * building. That would allow me to craft whatever items needed if I have
 * materials in my inventory. Like a craft button. If something is missing we
 * just don't craft it because it can't be done."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const make = ({ age = 4, owns = [] } = {}) => {
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  g.territory.setAge(age);
  g.inventory.slots.fill(null);
  owns.forEach((type, i) => g.structures.structures.push({ id: 100 + i, type, valid: true, tier: 0, region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 } }));
  return g;
};

// A Tended level's bill, and a lantern for it: planks, cobblestone, a lantern.
const bill = { planks: 12, cobblestone: 8, lantern: 1 };

{
  const g = make({ owns: ['workshop'] });
  g.inventory.add('wood', 10); g.inventory.add('stone', 4); g.inventory.add('glass', 1);
  g.world.setBlock(2, 2, 2, 380);
  const { made, still } = g.craftMissing(bill, { position: { x: 2, y: 2, z: 2 } });
  ok(`all of it, from wood, stone and glass in the bag (${JSON.stringify(made)})`, !Object.keys(still).length
    && g.inventory.countOf('planks') >= 12 && g.inventory.countOf('cobblestone') >= 8 && g.inventory.countOf('lantern') === 1);
  ok('the lantern\'s planks came on top of the twelve, not out of them', g.inventory.countOf('planks') >= 12);
  ok('the workshop\'s planks (four a log) — you have one, so it\'s the cheaper way', g.inventory.countOf('wood') >= 10 - 4);
}

{
  // No workshop: a lantern can't be made anywhere you have.
  const g = make();
  g.inventory.add('wood', 10); g.inventory.add('stone', 4); g.inventory.add('glass', 1);
  const { made, still } = g.craftMissing(bill);
  ok('hand work makes planks; cobble waits for a stone mill', made.planks > 0 && !made.cobblestone && still.cobblestone === 8);
  ok('and the lantern, which needs a workshop you don\'t have, is left — and said', still.lantern === 1 && g.inventory.countOf('glass') === 1);
}

{
  // Not enough: nothing is half-made.
  const g = make({ owns: ['workshop'] });
  g.inventory.add('wood', 1);
  const before = JSON.stringify(g.inventory.toJSON());
  const { made, still } = g.craftMissing({ lantern: 1 });
  ok('a lantern with no glass in the bag: not made', still.lantern === 1 && !Object.keys(made).length);
  ok('and the wood isn\'t turned into planks for it on the way', JSON.stringify(g.inventory.toJSON()) === before);
  const none = g.craftMissing({ chest: 1 });
  ok('a chest needs six planks: one log makes four — so not that either', none.still.chest === 1 && JSON.stringify(g.inventory.toJSON()) === before);
}

{
  // Nothing from a later age, and never a ring.
  const g = make({ age: 1 });
  g.inventory.add('stone', 10);
  const { still } = g.craftMissing({ cobblestone: 4 });
  ok('nothing from an age you haven\'t reached (cobblestone is Age 3)', still.cobblestone === 4 && g.inventory.countOf('stone') === 10);
}

{
  // What you already have counts.
  const g = make({ owns: ['workshop'] });
  g.inventory.add('planks', 20);
  const { made, still } = g.craftMissing({ planks: 12 });
  ok('already enough: nothing made', !Object.keys(made).length && !Object.keys(still).length && g.inventory.countOf('planks') === 20);
}

ok('the button sits by Evolve, when the next level is short of something with a recipe',
  /data-craft-missing>Craft what\\'s missing<\/button>/.test(ui) && /const craftable = !ready && this\.craftable\(short\);/.test(ui));
ok('on a building\'s pop-up, a storehouse\'s — and a ready-made building\'s card (asked for directly: "the option to craft from the building is not showing")',
  (ui.match(/this\.wireCraftMissing\(/g) ?? []).length === 3 && /data-craft-for="\$\{spec\.id\}">Craft what's missing<\/button>/.test(ui));
ok('  the whole bill goes in, so what it takes as it is is held back', /\?\.evolvePlan\(structure, \{ dry: true \}\)\?\.bill\)/.test(ui) && /selectedDesign\(btn\.dataset\.craftFor\)\?\.cost/.test(ui));
ok('and it says what it made, and what it couldn\'t', /Couldn't make \$\{list\(still\)\}/.test(ui) && /Nothing could be made/.test(ui));

{
  // More than a batch: a house's twenty-five planks used to stop at the
  // first eight presses' sixteen, and say it was done.
  const g = make({ age: 2 });
  g.inventory.add('wood', 40);
  const { made, still } = g.craftMissing({ planks: 25 });
  ok(`more than a batch is made in as many as it takes (${made.planks} planks)`, g.inventory.countOf('planks') >= 25 && !still.planks);
}
{
  // A bill that takes wood as it is: the wood stays wood.
  const g = make({ age: 2 });
  g.inventory.add('wood', 80);
  const { made, still } = g.craftMissing({ planks: 25, wood: 75 });
  ok(`what the bill takes as it is is never made into something else on it (${g.inventory.countOf('wood')} wood left)`, g.inventory.countOf('wood') >= 75 || (still.planks > 0 && g.inventory.countOf('wood') === 80));
  ok('  and what can\'t be made without it is said', still.planks > 0 || made.planks >= 25);
}

process.exit(f ? 1 : 0);
