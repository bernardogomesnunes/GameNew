import { readFileSync } from 'node:fs';
import { Inventory, PLAYABLE_SLOTS } from '../src/items/Inventory.js';
import { BLOCKS } from '../src/config/blocks.js';
import { TEXTURES, BLOCK_TEXTURES } from '../src/config/textures.js';

/**
 * Quick wins from the third list (docs/backlog-batch-3.md).
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- "When I break a new block and there's an equipped empty slot that block should go there and not the bag"
const inv = new Inventory({ slots: 40 });
inv.slots[0] = { id: 'axe', count: 1, wear: 0 };
inv.slots[PLAYABLE_SLOTS + 3] = { id: 'stone', count: 12, wear: 0 };
ok('stone only in the bag moves up to the first free equipped slot', inv.bringUp('stone') && inv.slots[1]?.id === 'stone' && inv.slots[1].count === 12 && !inv.slots[PLAYABLE_SLOTS + 3]);
inv.add('stone', 1);
ok('and what was just picked up joins it there', inv.slots[1].count === 13);
inv.slots[PLAYABLE_SLOTS + 5] = { id: 'planks', count: 3, wear: 0 };
ok('something already equipped stays put', !inv.bringUp('stone'));
for (let i = 2; i < PLAYABLE_SLOTS; i++) inv.slots[i] = { id: 'dirt', count: 1, wear: 0 };
ok('with no free equipped slot, the bag keeps it', !inv.bringUp('planks') && inv.slots[PLAYABLE_SLOTS + 5]?.id === 'planks');
const duilt = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
ok('every pickup asks for it', /this\.inventory\.bringUp\(id\);\s*const leftover = this\.inventory\.add\(id, n\);/.test(duilt));

// --- "Let's add a bar of durability to the inventory icon"
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('the hotbar shows a tool\'s wear, coloured by how much is left', /\$\{wearBar\(s, spec\)\}/.test(ui) && /left > 0\.5 \? 'ok' : left > 0\.2 \? 'low' : 'out'/.test(ui));

// --- "Stone needs to be lighter like cobble"
const by = (n) => BLOCKS.find((b) => b.name === n);
const lum = (c) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
ok('stone is lighter, close to cobblestone', lum(by('Stone').color) > 170 && lum(by('Cobblestone').color) - lum(by('Stone').color) < 20);
ok('its slab, stairs and wall match it', ['Stone Slab', 'Stone Stairs', 'Stone Wall'].every((n) => by(n).color === by('Stone').color));

// --- "Logs texture looks odd ... round forms ... lighter ... white log ... thinner and more grey"
ok('the log is lighter wood', lum(by('Wood').color) > lum(0x7d5a3a));
ok('no round knots on any log', !TEXTURES.log.knots && !BLOCK_TEXTURES['Dark Wood'].knots);
const tex = readFileSync(new URL('../src/render/BlockTextures.js', import.meta.url), 'utf8');
ok('birch dashes are one pixel and grey', !/thick = hash01\(i, 43, salt\)/.test(tex) && /tint\(c, x \+ d, y, \[0\.92, 0\.92, 0\.95\]\)/.test(tex));

// --- "I should be able to leave the water to a block that it's the same height as the water"
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { PlayerController } = await import('../src/player/PlayerController.js');
const swimmer = (top) => ({ flying: false, grounded: false, swimming: true, stepLag: 0, position: { x: 0, y: 10, z: 0 },
  collisionBoxesAt: () => [{ maxY: top }], collidesAt: () => false });
const a = swimmer(10.9);
ok('swimming, you climb out onto a bank level with the water', PlayerController.prototype.stepUp.call(a, 1, 0) && a.position.y === 10.9);
ok('but not onto one a block above it', !PlayerController.prototype.stepUp.call(swimmer(11.9), 1, 0));
const walker = { ...swimmer(10.9), swimming: false, grounded: true };
ok('on foot, a whole block is still too high to step', !PlayerController.prototype.stepUp.call(walker, 1, 0));

// --- "Should be able to place blocks on water ... a lonely block of water a bucket should clear it out. If it's more like 2 don't"
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('pointing at water, a block goes into it', /const into = hit\.block === WATER \|\| isFlowing\(hit\.block\);\s*const targets = into \? this\.computeTargets\(hit\.x, hit\.y, hit\.z\)/.test(game));
ok('a bucket clears a lone water block, never one joined to more water',
  /const joined = \[\[1, 0, 0\][\s\S]{0,200}=== WATER\);\s*const cleared = !joined && this\.applyChanges\(\[\{ x: hit\.x, y: hit\.y, z: hit\.z, prev: WATER, next: AIR \}\]/.test(game));

process.exit(f ? 1 : 0);
