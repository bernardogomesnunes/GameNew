import * as THREE from 'three';
import { hasGlyph } from '../src/config/glyphs.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Step 2 of the tool plan the user confirmed with "yeah go for it": real
 * pickaxe and shovel items, craftable like the axe, each with its own icon —
 * before any material actually breaks faster for having one equipped (that's
 * the hardness table, wired in separately).
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('a pickaxe is a real, one-per-slot tool', ITEMS_BY_ID.get('pickaxe')?.kind === 'tool'
  && ITEMS_BY_ID.get('pickaxe').stackTo === 1 && ITEMS_BY_ID.get('pickaxe').durability > 0);
ok('a shovel is too', ITEMS_BY_ID.get('shovel')?.kind === 'tool'
  && ITEMS_BY_ID.get('shovel').stackTo === 1 && ITEMS_BY_ID.get('shovel').durability > 0);
ok('both have their own icon, not a borrowed one', hasGlyph('pickaxe') && hasGlyph('shovel')
  && ITEMS_BY_ID.get('pickaxe').glyph === 'pickaxe' && ITEMS_BY_ID.get('shovel').glyph === 'shovel');

{
  const { world } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 11 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.inventory.add('wood', 20);
  g.inventory.add('stone', 20);

  let r = g.crafting.craft('pickaxe', 1);
  ok('a pickaxe is craftable by hand from wood and stone', r.ok && g.inventory.countOf('pickaxe') === 1);
  ok('and the ingredients were actually spent', g.inventory.countOf('wood') === 17 && g.inventory.countOf('stone') === 16);

  r = g.crafting.craft('shovel', 1);
  ok('a shovel is craftable by hand from wood alone', r.ok && g.inventory.countOf('shovel') === 1);
}

process.exit(f ? 1 : 0);
