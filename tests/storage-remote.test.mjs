import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { itemIcon } from '../src/config/cubes.js';
import { heldGeometryFor } from '../src/render/heldModel.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DuiltUI } from '../src/ui/DuiltUI.js';
import { UIManager } from '../src/ui/UIManager.js';
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
let failures = 0;
function check(name, run) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
}

// Real directory rendering and panel routing, without constructing WebGL or a DOM.
function fixture(stores = []) {
  const inventory = new Inventory();
  inventory.add('storage_remote', 1);
  const d = Object.assign(Object.create(DuiltGame.prototype), {
    inventory, structures: { structures: stores, stores: () => stores.filter(s => s.valid) },
  });
  const list = { innerHTML: '', querySelectorAll: () => [] };
  const where = { textContent: '' }, search = { value: '' };
  const nodes = { '#stores-list': list, '#stores-where': where, '#stores-search': search };
  const duiltUI = Object.assign(Object.create(DuiltUI.prototype), { game: { duilt: d }, q: id => nodes[id] });
  const panels = [];
  const ui = Object.assign(Object.create(UIManager.prototype), { duiltUI, openPanel: id => panels.push(id) });
  const game = Object.assign(Object.create(Game.prototype), {
    duilt: d, ui, selectedItemId: 'storage_remote', selectedBlockId: 3,
    moving: null, manning: null, placing: false, hoverBox: { visible: true },
    raycast: () => null,
    kingTarget: () => null, hermitTarget: () => null, traderTarget: () => null,
    talkTarget: () => null, horseTarget: () => null, machineTarget: () => null,
    trainTarget: () => null, guardianTarget: () => null, banditTarget: () => null,
    mobTarget: () => null, fireflyTarget: () => null,
    placeBlock() { throw new Error('Remote must never place a block'); },
  });
  return { game, inventory, duiltUI, ui, list, where, panels };
}

check('age 3 hand crafting makes a reusable remote with no terrain requirement', () => {
  const inventory = new Inventory();
  inventory.add('planks', 4); inventory.add('glass', 1); inventory.add('copper_ingot', 2);
  const crafting = new Crafting({ inventory, world: {} });
  assert.equal(crafting.availableRecipe('storage_remote', 2), null);
  assert.equal(crafting.availableRecipe('storage_remote', 3)?.ok, true);
  assert.equal(crafting.craft('storage_remote').ok, true);
  assert.equal(inventory.countOf('storage_remote'), 1);
  assert.equal(ITEMS_BY_ID.get('storage_remote')?.durability, null);
  assert.equal(ITEMS_BY_ID.get('storage_remote')?.block, undefined);
  assert.match(itemIcon(ITEMS_BY_ID.get('storage_remote')), /<path/);
  assert.ok(heldGeometryFor({ itemId: 'storage_remote' }).attributes.position.count > 24);
});

check('using a held remote at empty sky opens the current world directory without consuming it', () => {
  const { game, inventory, panels, list } = fixture([
    { id: 7, type: 'storehouse', valid: true, store: new Inventory() },
  ]);
  game.secondaryAction();
  assert.deepEqual(panels, ['panel-stores']);
  assert.match(list.innerHTML, /Storehouse #7/);
  assert.match(list.innerHTML, /Open shelves/);
  assert.equal(inventory.countOf('storage_remote'), 1);
});

check('touch tap uses the remote even with no aimed block', () => {
  const { game, panels } = fixture();
  assert.equal(game.tapAction(), 'place');
  assert.deepEqual(panels, ['panel-stores']);
});

check('holding Place with the remote never repeats or places the previous block', () => {
  const { game, panels } = fixture();
  game.secondaryAction();
  game.setPlacing(true);
  game.tickPlacing(performance.now() + 5000);
  assert.equal(game.placing, false);
  assert.deepEqual(panels, ['panel-stores']);
});

check('an existing place hold cannot place after switching to the remote', () => {
  const { game } = fixture();
  // Exercise the actual placement method rather than the fixture tripwire.
  game.raycast = () => { throw new Error('A held remote must not reach terrain placement'); };
  Game.prototype.placeBlock.call(game);
});

check('empty remote directory explains how to start storing', () => {
  const { game, where, list } = fixture();
  game.secondaryAction();
  assert.equal(where.textContent, 'No stores yet');
  assert.match(list.innerHTML, /Build a store or granary/);
});

check('guest remote use only opens the same directory and leaves shelves intact', () => {
  const store = new Inventory(); store.add('stone', 12);
  const { game, panels } = fixture([{ id: 8, type: 'storehouse', valid: true, store }]);
  game.peerSession = { role: 'guest' };
  game.secondaryAction();
  assert.deepEqual(panels, ['panel-stores']);
  assert.equal(store.countOf('stone'), 12);
});

check('the held remote advertises the use action while looking at sky', () => {
  const { game, ui } = fixture();
  let hint;
  ui.setAimedSwing = () => {};
  ui.setBuildingHint = value => { hint = value; };
  ui.isTouch = true;
  game.updateHover();
  assert.equal(game.hintUses, true);
  assert.match(hint, /Storage Remote.*tap/);
  assert.equal(game.hoverBox.visible, false);
});

process.exitCode = failures ? 1 : 0;
