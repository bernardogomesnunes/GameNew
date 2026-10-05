import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { GliderView } from '../src/render/GliderView.js';

/**
 * Asked for directly: "a flying machine that should fly with front and
 * space to go up, left and right to move, this is a wooden plane da Vinci
 * style" — at Age 3.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { PlayerController } = await import('../src/player/PlayerController.js');

// --- making one --------------------------------------------------------------------
const item = ITEMS_BY_ID.get('flying_machine');
ok('there is a flying machine', item?.flies === true && item.glyph === 'glider');
const r = RECIPES.find((x) => x.output?.id === 'flying_machine');
ok('built at a workshop in Age 3, from planks and wool', r?.station === 'workshop' && r.age === 3 && r.inputs.planks > 0 && r.inputs.wool > 0);
ok('it has a 3D model in the bag', Array.isArray(ITEM_MODELS.flying_machine) && ITEM_MODELS.flying_machine.length > 3);

// --- flying is the machine's ---------------------------------------------------------
let refused = 0;
const p = { flying: false, canFly: () => false, onFlyRefused: () => { refused++; }, velocity: { set() {} } };
PlayerController.prototype.toggleFly.call(p);
ok('without one, Fly does nothing and says why', p.flying === false && refused === 1);
p.canFly = () => true;
PlayerController.prototype.toggleFly.call(p);
ok('with one, Fly takes off', p.flying === true);
PlayerController.prototype.toggleFly.call(p);
ok('and Fly again lands', p.flying === false);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('in Duilt you fly once you own one; Creative flies as before',
  /p\.canFly = \(\) => !this\.duilt \|\| this\.duilt\.sandbox \|\| this\.hasFlyingMachine\(\);/.test(game));
ok('every player made is wired for it', (game.match(/this\.wireFlight\(\);/g) ?? []).length === 2);
ok('lose the machine mid-flight and you come down on its wings',
  /if \(this\.player\.flying && !this\.player\.canFly\(\)\) \{\s*this\.player\.flying = false;/.test(game));

// --- the glide -----------------------------------------------------------------------
const pc = readFileSync(new URL('../src/player/PlayerController.js', import.meta.url), 'utf8');
ok('stop flying in the air and its wings slow the fall', /this\.gliding = !this\.grounded && this\.velocity\.y < -GLIDE_FALL_SPEED && this\.canGlide\(\);\s*if \(this\.gliding\) this\.velocity\.y = -GLIDE_FALL_SPEED;/.test(pc));
ok('and a glide never hurts on landing', /if \(this\.flying \|\| this\.swimming \|\| this\.gliding\) \{ this\.fallPeak = null; return; \}/.test(pc));

// --- what you see ---------------------------------------------------------------------
const scene = new THREE.Scene();
const g = new GliderView(scene);
const you = { position: new THREE.Vector3(10, 50, 10), yaw: 1 };
g.update(you, 'fly', 0.1);
ok('flying, the machine is drawn above you, facing your way', g.group.visible && g.group.position.y > 51 && g.group.rotation.y === 1);
g.update(you, null, 0.1);
ok('and not when you are on your feet', !g.group.visible);
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('the Fly button only shows when you can fly', /if \(fly\) fly\.hidden = !\(this\.cb\.canFly\?\.\(\) \?\? true\);/.test(ui));

process.exit(f ? 1 : 0);
