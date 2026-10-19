import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { SKY_LIFT, CHAIN } from '../src/config/blocks.js';

/**
 * Asked for directly: "When the train is on the rails in mobile if I want
 * to add coal it does not work as place action is the same as pick the
 * train — train should be broke with pressing and adding coal with click",
 * and "Sky lift in creative does not work because when I click it shows the
 * pop up what is. Does not make sense."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the train under a thumb -----------------------------------------------------------------------

const tap = game.slice(game.indexOf('  tapAction('), game.indexOf('  secondaryAction() {'));
ok('a tap at a train or a flying machine is Place, whatever you hold', /if \(this\.trainTarget\(aimed\) \|\| this\.machineTarget\(aimed\)\) return places\(\);/.test(tap));
ok('  and that comes before what you hold has its say (coal used to make it Break)',
  tap.indexOf('this.trainTarget(aimed)') < tap.indexOf("const item = this.selectedItemId;"));
ok('  Place with coal at a train puts it in the bunker', /const train = this\.trainTarget\(aimed\);\s*if \(train\) return void this\.useTrain/.test(game) && /if \(this\.selectedItemId === 'coal'\) \{\s*const n = d\.fuelTrain\(t\);/.test(game));
ok('holding still takes it apart: Break at a train picks it up', /if \(this\.pickUpMachine\(hit\) \|\| this\.pickUpTrain\(hit\)\) return true;/.test(game));
ok('  one piece a press — a long hold no longer takes every car and then the engine',
  /const r = this\.duilt\.pickUpTrain\(found\.train\);\s*\/\/[^\n]*\n[^\n]*\n\s*this\.holdSpent = true;/.test(game)
  && /if \(!this\.breaking \|\| this\.holdSpent\) return;/.test(game) && /setBreaking\(on, \{ once = false \} = \{\}\) \{\s*if \(!on\) this\.holdSpent = false;/.test(game));

// --- a sky lift of your own --------------------------------------------------------------------------

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
const w = new World({ sizeX: 16, sizeZ: 16, height: 40 });
for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 0, z, 3);
// A lift on the ground, chain up from it, and a lift on a ledge at the top.
w.setBlock(5, 1, 5, SKY_LIFT);
for (let y = 2; y <= 20; y++) w.setBlock(5, y, 5, CHAIN);
w.setBlock(5, 21, 5, SKY_LIFT);
for (const [x, z] of [[5, 6], [4, 6], [6, 6]]) w.setBlock(x, 20, z, 3);
// A lone one, chain hanging down with nothing at the end.
w.setBlock(10, 8, 10, SKY_LIFT);
for (let y = 3; y <= 7; y++) w.setBlock(10, y, 10, CHAIN);
const fake = { world: w, standBeside: Game.prototype.standBeside };
const up = Game.prototype.chainLift.call(fake, 5, 1, 5);
ok(`your own lift rides its chain up to the lift at the top (${up && up.links} links)`, up && up.up && up.links === 19);
ok(`  and sets you down beside it, on the ledge (${up && [up.to.x, up.to.y, up.to.z]})`,
  up && up.to.y === 21 && w.isSolid(Math.floor(up.to.x), 20, Math.floor(up.to.z)) && !w.isSolid(Math.floor(up.to.x), 21, Math.floor(up.to.z)));
const down = Game.prototype.chainLift.call(fake, 5, 21, 5);
ok('and back down again', down && !down.up && down.links === 19 && down.to.y === 1);
ok('with no lift at the chain\'s end, it goes nowhere', Game.prototype.chainLift.call(fake, 10, 8, 10) === null);
ok('and with no chain at all', Game.prototype.chainLift.call(fake, 5, 1, 9) === null);
ok('Place on one rides it — an anchor tower\'s as before, else your own chain, else it says how', /const own = this\.chainLift\(x, y, z\);\s*if \(!own\) return void this\.ui\?\.toast\(\{ kind: 'xp', title: 'It goes nowhere yet'/.test(game));
ok('its hint says where it goes', /lift\.tower \? \(lift\.up \? 'up to the Sky Kingdom' : 'down to the ground'\) : \(lift\.up \? 'up the chain' : 'down the chain'\)/.test(game));
ok('tapping a lift\'s hint rides it — never the "What is this?" claim panel', /this\.hintUses = \(!!swing \|\| !!lift\) && !onBuilding;/.test(game) && /\(!swing && !sapling && !lift\) \|\| !!onBuilding/.test(game));

process.exit(f ? 1 : 0);
