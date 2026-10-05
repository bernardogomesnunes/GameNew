import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { GliderView, MachineView } from '../src/render/GliderView.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

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
// --- a vehicle you set down and climb into ------------------------------------------
// Asked for directly: "The idea is to have a physical vehicle to fly. I could
// place it and fly in it."
const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 5 });
const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
ok('without one in the bag, nothing is set down', !d.placeMachine(10.5, 30, 10.5).ok && d.machines.length === 0);
d.inventory.add('flying_machine', 1);
const placed = d.placeMachine(10.5, 30, 10.5, 0.5);
ok('with one, it stands in the world and leaves the bag', placed.ok && d.machines.length === 1 && d.inventory.countOf('flying_machine') === 0);
const saved = JSON.parse(JSON.stringify(d.toJSON()));
const d2 = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
d2.loadJSON(saved);
ok('it is still there when you come back', d2.machines.length === 1 && d2.machines[0].x === 10.5 && d2.machines[0].yaw === 0.5);
ok('hit it and it is back in your bag', d.pickUpMachine(placed.machine).ok && d.machines.length === 0 && d.inventory.countOf('flying_machine') === 1);
ok('holding it, Place sets it down', /flying_machine: 'setDownMachine'/.test(game));
ok('Place on one climbs in', /const machine = this\.machineTarget\(aimed\);\s*if \(machine\) return void this\.pilot\(machine\);/.test(game));
ok('you fly while you are in it, and only then', /hasFlyingMachine\(\) \{\s*return !!this\.duilt && !!this\.piloting;/.test(game));
ok('the machine goes where you go', /this\.tickRide\(dt\);\s*this\.tickPilot\(\);/.test(game) && /m\.x = p\.position\.x; m\.y = p\.position\.y; m\.z = p\.position\.z;/.test(game));
ok('on the ground, Sneak gets you out', /if \(p\.grounded && \(p\.sneaking \|\| \(p\.flying && down\)\)\) this\.leaveMachine\(\);/.test(game));
ok('left in the air, it comes down to the ground under it', /while \(y > 0 && !this\.world\.isCollidable\(Math\.floor\(m\.x\), y - 1, Math\.floor\(m\.z\)\)\) y--;/.test(game));

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
g.update(you, 'parked', 0.1);
ok('parked, it stands on its frame', g.group.visible && g.stand.visible);
g.update(you, 'fly', 0.1);
ok('and flying, the frame folds away', !g.stand.visible);
const mv = new MachineView(scene);
const parked = { x: 4, y: 20, z: 4, yaw: 0 }, flown = { x: 9, y: 40, z: 9, yaw: 0 };
mv.update([parked, flown], flown);
ok('every machine set down is drawn where it stands, but not the one you are flying', mv.views.has(parked) && !mv.views.has(flown));
const view = mv.views.get(parked);
mv.update([], null);
ok('and a machine picked up is gone from the world', mv.views.size === 0 && !scene.children.includes(view.group));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('the Fly button only shows when you can fly', /if \(fly\) fly\.hidden = !\(this\.cb\.canFly\?\.\(\) \?\? true\);/.test(ui));

process.exit(f ? 1 : 0);
