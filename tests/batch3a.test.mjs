import { readFileSync } from 'node:fs';
import { Inventory } from '../src/items/Inventory.js';

/** The new batch after a big play, first part: the quick fixes. */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// "Getting bag is full toast when there's clearly slots in my bag": in
// Creative, where every slot holds one of something, a tool (which never
// stacks) had no room.
{
  const bag = new Inventory({ slots: 3, endless: true });
  bag.add('dirt', 1); bag.add('sand', 1); bag.add('stone', 1);
  ok('a full endless bag still has room for a tool', bag.roomFor('axe', 1) === 1);
  ok('and takes it', bag.add('axe', 1) === 0);
  const real = new Inventory({ slots: 1 });
  real.add('dirt', 1);
  ok('a real full bag still has no room for one', real.roomFor('axe', 1) === 0);
}

// "Take something apart goal is not working": in a Creative world nothing
// counts, and the panel said nothing about it.
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('the goals panel says a Creative world has none', /if \(this\.game\.duilt\?\.sandbox\) \{\s*this\.q\('#stats-sub'\)\.textContent = 'Creative · no goals here';/.test(ui));

// "Sand texture needs to have less noise."
const { TEXTURES } = await import('../src/config/textures.js');
ok('sand has a third of the grains it had, and finer speckle', TEXTURES.sand.marks <= 20 && TEXTURES.sand.speck <= 0.02);

process.exit(f ? 1 : 0);
