import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { DuiltUI } from '../src/ui/DuiltUI.js';

let failed = 0;
const check = (name, run) => {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
};
function healthBox() {
  let html = '';
  const classes = new Set();
  return {
    writes: 0, hidden: false, title: '',
    get innerHTML() { return html; },
    set innerHTML(value) { this.writes++; html = value; },
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
}
function fixture() {
  let armour = 0;
  const world = { sandbox: false, health: { value: 20 }, armour: () => armour };
  const state = { box: healthBox() };
  const ui = Object.assign(Object.create(DuiltUI.prototype), {
    game: { duilt: world }, q: () => state.box,
  });
  return { ui, world, state, setArmour: (value) => { armour = value; } };
}
function fills(box) {
  return [...box.innerHTML.matchAll(/class="heart (full|half|empty)"/g)].map((match) => match[1]);
}

check('unchanged health HUD calls preserve the existing heart nodes', () => {
  const { ui, state } = fixture();
  ui.renderHealth();
  const original = state.box.innerHTML;
  for (let i = 0; i < 1000; i++) ui.renderHealth();
  assert.equal(state.box.writes, 1, 'unchanged calls rewrote the heart markup');
  assert.equal(state.box.innerHTML, original);
  assert.deepEqual(fills(state.box), Array(10).fill('full'));
  assert.equal(state.box.title, 'Health: 10 of 10 hearts');
  assert.equal(state.box.classList.contains('low'), false);
});

check('damage healing and armour changes immediately update hearts badge title and low state', () => {
  const { ui, world, state, setArmour } = fixture();
  ui.renderHealth();
  world.health.value = 5;
  ui.renderHealth();
  assert.deepEqual(fills(state.box), ['full', 'full', 'half', ...Array(7).fill('empty')]);
  assert.equal(state.box.classList.contains('low'), true);
  assert.equal(state.box.title, 'Health: 2.5 of 10 hearts');
  setArmour(7);
  ui.renderHealth();
  assert.ok(state.box.innerHTML.includes('class="armour-badge"'));
  assert.ok(state.box.innerHTML.includes('<b>7</b>'));
  assert.equal(state.box.title, 'Health: 2.5 of 10 hearts · 7 armour');
  world.health.value = 7;
  setArmour(0);
  ui.renderHealth();
  assert.equal(state.box.classList.contains('low'), false);
  assert.ok(!state.box.innerHTML.includes('armour-badge'));
  assert.deepEqual(fills(state.box), ['full', 'full', 'full', 'half', ...Array(6).fill('empty')]);
  assert.equal(state.box.writes, 4);
});

check('creative hides hearts without rewriting and survival restores current health and armour', () => {
  const { ui, world, state, setArmour } = fixture();
  ui.renderHealth();
  const survivalHTML = state.box.innerHTML;
  world.sandbox = true;
  world.health.value = 3;
  setArmour(4);
  for (let i = 0; i < 10; i++) ui.renderHealth();
  assert.equal(state.box.hidden, true);
  assert.equal(state.box.writes, 1);
  assert.equal(state.box.innerHTML, survivalHTML);
  world.sandbox = false;
  ui.renderHealth();
  assert.equal(state.box.hidden, false);
  assert.equal(state.box.title, 'Health: 1.5 of 10 hearts · 4 armour');
  assert.equal(state.box.classList.contains('low'), true);
  assert.equal(state.box.writes, 2);
});

check('replaced HUD elements and equal-health replacement worlds receive fresh markup', () => {
  const { ui, state, world } = fixture();
  ui.renderHealth();
  const expected = state.box.innerHTML;
  state.box = healthBox();
  ui.renderHealth();
  assert.equal(state.box.writes, 1);
  assert.equal(state.box.innerHTML, expected);
  ui.game.duilt = { ...world };
  ui.renderHealth();
  assert.equal(state.box.writes, 2);
  assert.equal(state.box.innerHTML, expected);
  ui.game.duilt = null;
  ui.renderHealth();
  ui.game.duilt = world;
  ui.renderHealth();
  assert.equal(state.box.writes, 3, 'returning world reused stale HUD state');
});

check('a temporarily missing HUD invalidates its cached render', () => {
  const { ui, state } = fixture();
  ui.renderHealth();
  const box = state.box;
  state.box = null;
  ui.renderHealth();
  state.box = box;
  ui.renderHealth();
  assert.equal(box.writes, 2);
});

check('1000 equivalent renders produce identical output while stable HUD calls skip rebuilds', () => {
  const unchanged = fixture(), replaced = fixture();
  const started = performance.now();
  for (let i = 0; i < 1000; i++) unchanged.ui.renderHealth();
  const stableMs = performance.now() - started;
  const redrawStarted = performance.now();
  for (let i = 0; i < 1000; i++) {
    replaced.ui.game.duilt = { ...replaced.world };
    replaced.ui.renderHealth();
  }
  const redrawMs = performance.now() - redrawStarted;
  assert.equal(unchanged.state.box.innerHTML, replaced.state.box.innerHTML);
  assert.equal(unchanged.state.box.title, replaced.state.box.title);
  assert.equal(unchanged.state.box.writes, 1);
  assert.equal(replaced.state.box.writes, 1000);
  console.log(`Health HUD benchmark: stable 1000 calls ${stableMs.toFixed(3)} ms / ${unchanged.state.box.writes} rebuild; equivalent replacement-world calls ${redrawMs.toFixed(3)} ms / ${replaced.state.box.writes} rebuilds`);
});

if (failed) process.exit(1);
