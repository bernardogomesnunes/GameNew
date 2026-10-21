import assert from 'node:assert/strict';
import { DuiltUI } from '../src/ui/DuiltUI.js';
import { PLAYABLE_SLOTS } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, run) => {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
};
function fixture(query = '') {
  const slots = Array(PLAYABLE_SLOTS + 16).fill(null);
  slots[0] = { id: 'stone', count: 2 };
  slots[PLAYABLE_SLOTS + 2] = { id: 'cobblestone', count: 4 };
  slots[PLAYABLE_SLOTS + 9] = { id: 'sword_iron', count: 1 };
  const node = () => ({ innerHTML: '', textContent: '', querySelectorAll: () => [] });
  const nodes = Object.fromEntries(['#bag-hotbar-grid', '#bag-grid', '#bag-sub', '#bag-grid-label', '#bag-loadout'].map(id => [id, node()]));
  nodes['#bag-search'] = { value: query };
  const ui = Object.assign(Object.create(DuiltUI.prototype), {
    game: { duilt: { inventory: { slots, endless: false } } },
    held: null, q: id => nodes[id], renderWear() {}, renderBagSkills() {},
    renderDetail() {}, refreshSlotTip() {},
    slotHtml: (slot, index) => `<button data-slot="${index}">${slot?.id ?? 'empty'}</button>`,
  });
  return { ui, nodes, slots, grid: nodes['#bag-grid'] };
}
check('search matches display names regardless of case or surrounding whitespace', () => {
  const { ui, grid } = fixture('  IRON SWORD  ');
  ui.renderBag();
  assert.match(grid.innerHTML, /sword_iron/);
  assert.doesNotMatch(grid.innerHTML, /cobblestone|>empty</);
});
check('results retain absolute inventory indices and leave inventory untouched', () => {
  const { ui, grid, slots } = fixture('cobble');
  const before = structuredClone(slots);
  ui.renderBag();
  assert.match(grid.innerHTML, new RegExp(`data-slot="${PLAYABLE_SLOTS + 2}"`));
  assert.doesNotMatch(grid.innerHTML, /data-slot="0"/);
  assert.deepEqual(slots, before);
});
check('search also finds equipped items without changing the equipped grid', () => {
  const { ui, grid, nodes } = fixture('stone');
  ui.renderBag();
  assert.match(grid.innerHTML, /data-slot="0"/);
  assert.match(grid.innerHTML, /cobblestone/);
  assert.equal((nodes['#bag-hotbar-grid'].innerHTML.match(/data-slot=/g) ?? []).length, PLAYABLE_SLOTS);
});
check('no matches show a readable empty state', () => {
  const { ui, grid } = fixture('nothing-matches-this');
  ui.renderBag();
  assert.match(grid.innerHTML, /No items match/i);
  assert.doesNotMatch(grid.innerHTML, /data-slot=/);
});
check('clearing search restores bag positions and empty drop targets', () => {
  const { ui, grid, nodes } = fixture('cobble');
  ui.renderBag();
  nodes['#bag-search'].value = '';
  ui.renderBag();
  assert.equal((grid.innerHTML.match(/data-slot=/g) ?? []).length, 16);
  assert.doesNotMatch(grid.innerHTML, /data-slot="0"/);
  assert.match(grid.innerHTML, />empty</);
});
check('inventory updates preserve query and the lifted slot', () => {
  const { ui, grid, slots, nodes } = fixture('sword');
  ui.held = PLAYABLE_SLOTS + 9;
  ui.renderBag();
  slots[PLAYABLE_SLOTS + 3] = { id: 'sword_iron', count: 1 };
  ui.renderBag();
  assert.equal(nodes['#bag-search'].value, 'sword');
  assert.equal(ui.held, PLAYABLE_SLOTS + 9);
  assert.equal((grid.innerHTML.match(/data-slot=/g) ?? []).length, 2);
});
check('search makes room for results and clearing restores equipment rows', () => {
  const { ui, nodes } = fixture('stone');
  ui.renderBag();
  assert.equal(nodes['#bag-loadout'].hidden, true);
  nodes['#bag-search'].value = '';
  ui.renderBag();
  assert.equal(nodes['#bag-loadout'].hidden, false);
});
check('tooltip refresh stays in the search results instead of jumping to an equipped duplicate', () => {
  const result = { dataset: { tip: 'Stone' }, offsetParent: {} };
  const requested = [];
  let shown;
  const ui = Object.assign(Object.create(DuiltUI.prototype), {
    tipAt: { attr: 'data-slot', index: '0', grid: 'bag-grid' },
    el: { querySelector: selector => { requested.push(selector); return result; } },
    showSlotTip: button => { shown = button; }, hideSlotTip() {},
  });
  ui.refreshSlotTip();
  assert.match(requested[0], /^#bag-grid /);
  assert.equal(shown, result);
});
process.exitCode = failures ? 1 : 0;
