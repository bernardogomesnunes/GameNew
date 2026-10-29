import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
import { skyTerrainReady } from '../src/core/optionalFeatures.js';
import { warBehaviorsReady } from '../src/core/warBehaviors.js';

assert.equal(skyTerrainReady(), false, 'importing the complete game must leave planned Sky terrain unloaded');
assert.equal(warBehaviorsReady(), false, 'the full game import must leave warband, siege and mount simulation unloaded');
const notices = [], actions = [];
const game = Object.create(Game.prototype);
game.ui = { toast: notice => notices.push(notice) };
game.world = { id: 'original' };
const first = game.prepareFeatures(['war'], () => actions.push('horn'));
const second = game.prepareFeatures(['war'], () => actions.push('command'));
await Promise.all([first, second]);
assert.equal(warBehaviorsReady(), true);
assert.deepEqual(actions, ['horn', 'command'], 'concurrent actions both finish after the shared import');
assert.equal(game.featureLoading, false);
assert.equal(await game.prepareFeatures(['war']), true, 'readiness works without an action callback');
console.log('PASS real Game feature preparation preserves concurrent actions and supports readiness-only callers');

const oldWorld = game.world;
let restored = false;
game.loadFromData = () => { restored = true; };
const opening = Game.prototype.loadFromData.call(game, { world: { gen: {} }, mode: 'duilt', duilt: { ring: 'black' } });
game.featureScope.cancel();
assert.equal(await opening, false);
assert.equal(restored, false);
assert.equal(game.world, oldWorld);
console.log('PASS a cancelled saved-world feature load leaves the previous world intact');

assert.equal(await game.prepareFeatures(['missing'], () => { game.world = null; }), false);
assert.equal(game.world, oldWorld);
assert.equal(notices.at(-1).action.label, 'Retry');
assert.equal(game.featureLoading, false);
assert.equal(await game.prepareFeatures(['sky']), true);
assert.equal(game.featureFailure, null);
console.log('PASS feature failure preserves the world, offers retry, and a later successful load clears failure');
