import { readFileSync } from 'node:fs';
import { Inventory } from '../src/items/Inventory.js';

/**
 * Reported as: "Fill bucket doesn't make sense. Bucket should be an item for
 * the inventory, when I have it selected I can use break to fill it and
 * place to empty it."
 *
 * Before this, the only way to fill or empty a bucket was the crafting
 * menu — treating a bucket of water like a thing you assemble from a recipe
 * rather than a tool you use where you're standing. This makes the bucket a
 * selectable hotbar slot: select it, aim at water, press Break to fill;
 * with a full one selected, press Place to pour it out. Game.js and
 * UIManager wiring can't run outside a browser (no canvas, no DOM), so that
 * half is checked against the source the way account.test.mjs checks
 * Game.js's cloud wiring; the inventory swap itself is real and runs.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

// --- the swap itself, for real -------------------------------------------

{
  const inv = new Inventory();
  inv.add('bucket', 1);
  ok('starts holding an empty bucket', inv.countOf('bucket') === 1);

  // What fillBucket does.
  ok('filling takes the empty bucket', inv.remove('bucket', 1) === 1);
  inv.add('bucket_water', 1);
  ok('and leaves a full one', inv.countOf('bucket') === 0 && inv.countOf('bucket_water') === 1);

  // What emptyBucket does, the other way.
  ok('emptying takes the full bucket', inv.remove('bucket_water', 1) === 1);
  inv.add('bucket', 1);
  ok('and leaves an empty one back', inv.countOf('bucket_water') === 0 && inv.countOf('bucket') === 1);
}

{
  // Nothing to take: both sides must refuse rather than manufacture water
  // or a bucket out of nothing.
  const inv = new Inventory();
  ok('filling with no bucket held takes nothing', inv.remove('bucket', 1) === 0);
  ok('emptying with no full bucket held takes nothing', inv.remove('bucket_water', 1) === 0);
}

// --- wired into Break/Place, not a menu ------------------------------------

ok('an empty bucket takes the Break button before it digs',
  /selectedItemId === 'bucket'\)\s*return void this\.fillBucket\(\);/.test(game));
ok('a full bucket takes the Place button before it builds',
  /selectedItemId === 'bucket_water'\)\s*return void this\.emptyBucket\(\);/.test(game));
ok('filling checks what you are actually pointing at',
  /fillBucket\(\)[\s\S]{0,400}getBlock\(hit\.x, hit\.y, hit\.z\) === WATER/.test(game));
ok('and says so when you are not pointing at water',
  /Point at water and press Break/.test(game));
ok('filling takes the bucket and gives back a full one, in the bag',
  /fillBucket\(\)[\s\S]{0,600}inventory\.remove\('bucket', 1\)[\s\S]{0,100}inventory\.add\('bucket_water', 1\)/.test(game));
ok('emptying is the same swap in reverse',
  /emptyBucket\(\)[\s\S]{0,300}inventory\.remove\('bucket_water', 1\)[\s\S]{0,100}inventory\.add\('bucket', 1\)/.test(game));

// --- selectable from the hotbar, like any other held thing ------------------

ok('the bucket and a full one are selectable hotbar slots',
  /TOOL_HOTBAR_IDS = \['bucket', 'bucket_water'\]/.test(ui));
ok('selecting one is its own thing, not a block choice',
  /selectItem\(id\) \{/.test(ui) && /this\.selectedItemId = id;/.test(ui));
ok('and picking a block cancels it, so only one slot is ever active',
  /selectBlock\(id\) \{\s*this\.selectedBlockId = id;\s*this\.selectedItemId = null;/.test(ui));
ok('a click on a tool slot selects the item, not a block id',
  /dataset\.tool\) \{ this\.selectItem\(slot\.dataset\.item\); return; \}/.test(ui));
ok('running out of the held tool falls back sensibly',
  /stillValid[\s\S]{0,300}selectBlock\(placeable\[0\]\.spec\.block\)[\s\S]{0,60}selectItem\(tools\[0\]\.id\)/.test(ui));

process.exit(f ? 1 : 0);
