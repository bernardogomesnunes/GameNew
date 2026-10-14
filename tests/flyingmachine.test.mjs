import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { GliderView, MachineView } from '../src/render/GliderView.js';
import { HelixView } from '../src/render/HelixView.js';
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
// Renamed and worn (asked for directly: "the one we have now should be called
// plainer ... Plainer should be held as chest plate instead of placed").
const item = ITEMS_BY_ID.get('flying_machine');
ok('there is a Plainer (the flying machine, renamed — the same id, so saves keep it)', item?.name === 'Plainer' && item?.flies === true && item.glyph === 'glider');
ok('  worn on the body, like a breastplate', item.wears === 'body' && !item.armour);
const r = RECIPES.find((x) => x.output?.id === 'flying_machine');
ok('built at a workshop in Age 4, from planks and wool', r?.station === 'workshop' && r.age === 4 && r.inputs.planks > 0 && r.inputs.wool > 0 && r.name === 'Plainer');
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
const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 5 });
const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
d.inventory.add('flying_machine', 1);
const at = d.inventory.slots.findIndex((x) => x?.id === 'flying_machine');
ok('put on, it goes in the Body place', d.wear(at).ok && d.worn.body?.id === 'flying_machine' && d.inventory.countOf('flying_machine') === 0);
ok('wearing it is what lets you fly, and glide', /hasFlyingMachine\(\) \{\s*return !!this\.duilt && \(this\.wearingPlainer\(\) \|\| !!this\.piloting\);/.test(game)
  && /wearingPlainer\(\) \{\s*return this\.duilt\?\.worn\?\.body\?\.id === 'flying_machine';/.test(game) && /p\.canGlide = \(\) => this\.wearingPlainer\(\);/.test(game));
ok('holding it, Place puts it on — it is never set down any more', /flying_machine: 'wearSelected'/.test(game) && !/flying_machine: 'setDownMachine'/.test(game));
ok('no armour to it: it never wears through', d.armour() === 0);
ok('taken off, it is back in the bag', d.takeOff('body').ok && d.inventory.countOf('flying_machine') === 1);
// A Plainer an older save parked in the world: still there, and picked up as a Plainer.
const old = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
old.loadJSON({ ...JSON.parse(JSON.stringify(d.toJSON())), machines: [{ x: 3.5, y: 30, z: 3.5, yaw: 0 }] });
ok('a Plainer an older save left parked is still there', old.machines.length === 1 && old.machines[0].kind === undefined);
ok('  and hit, it comes back to the bag as a Plainer to wear', old.pickUpMachine(old.machines[0]).id === 'flying_machine' && old.inventory.countOf('flying_machine') === 2);
ok('  it can\'t be climbed into', /if \(m\.kind !== 'helix'\) return void this\.ui\.toast\(\{ kind: 'xp', title: 'A Plainer'/.test(game));

// --- the Helix: set down, climbed into, flown as Creative flies ---------------------
// Asked for directly: "we should add a diff flying machine called helix ...
// similar to fly mode in creative", in "a more helicopter form".
const helix = ITEMS_BY_ID.get('helix');
const hr = RECIPES.find((x) => x.output?.id === 'helix');
ok('there is a Helix, built at an engineering centre', helix?.name === 'Helix' && hr?.station === 'engineering' && hr.inputs.iron_ingot > 0 && Array.isArray(ITEM_MODELS.helix));
ok('without one in the bag, nothing is set down', !d.placeMachine(10.5, 30, 10.5).ok && d.machines.length === 0);
d.inventory.add('helix', 1);
const placed = d.placeMachine(10.5, 30, 10.5, 0.5);
ok('with one, it stands in the world and leaves the bag', placed.ok && placed.machine.kind === 'helix' && d.machines.length === 1 && d.inventory.countOf('helix') === 0);
const saved = JSON.parse(JSON.stringify(d.toJSON()));
const d2 = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
d2.loadJSON(saved);
ok('it is still there when you come back', d2.machines.length === 1 && d2.machines[0].kind === 'helix' && d2.machines[0].x === 10.5 && d2.machines[0].yaw === 0.5);
ok('hit it and it is back in your bag', d.pickUpMachine(placed.machine).id === 'helix' && d.machines.length === 0 && d.inventory.countOf('helix') === 1);
ok('holding it, Place sets it down, on its skids', /helix: 'setDownMachine'/.test(game) && /const x = hit\.x \+ 0\.5, y = hit\.y \+ 1 \+ HELIX_SKIDS, z = hit\.z \+ 0\.5;/.test(game));
ok('Place on one climbs in', /const machine = this\.machineTarget\(aimed\);\s*if \(machine\) return void this\.pilot\(machine\);/.test(game));
ok('in it you fly, as Creative does — hovering, nothing to glide', /this\.player\.flying = true;/.test(game.slice(game.indexOf('  pilot(m) {'), game.indexOf('  leaveMachine('))));
ok('  sat up in the cabin, over its skids, so it lands on them', /this\.player\.seatHeight = HELIX_SKIDS;/.test(game) && /m\.y = p\.position\.y \+ \(m\.kind === 'helix' \? HELIX_SKIDS : 0\);/.test(game));
ok('the machine goes where you go', /this\.tickRide\(dt\);\s*this\.tickPilot\(\);/.test(game));
ok('on the ground, Sneak gets you out', /if \(p\.grounded && \(p\.sneaking \|\| \(p\.flying && down\)\)\) this\.leaveMachine\(\);/.test(game));
ok('left in the air, it comes down to the ground under it, on its skids', /while \(y > 0 && !this\.world\.isCollidable\(Math\.floor\(m\.x\), y - 1, Math\.floor\(m\.z\)\)\) y--;\s*m\.y = y \+ \(m\.kind === 'helix' \? HELIX_SKIDS : 0\);/.test(game));

ok('in Duilt you fly with one; Creative flies as before',
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
ok('flying in the Plainer, its wings are drawn above you, facing your way', g.group.visible && g.group.position.y > 51 && g.group.rotation.y === 1);
g.update(you, null, 0.1);
ok('and not when you are on your feet', !g.group.visible);
ok('  only while it carries you, and not in a Helix', /const wings = playing && this\.wearingPlainer\(\) && !this\.piloting && \(this\.player\.flying \|\| this\.player\.gliding\);/.test(game));
const mv = new MachineView(scene);
const heli = { kind: 'helix', x: 4, y: 20.9, z: 4, yaw: 0 }, plainer = { x: 9, y: 30, z: 9, yaw: 0 }, flown = { kind: 'helix', x: 20, y: 40, z: 20, yaw: 0 };
const pilot = { position: new THREE.Vector3(20, 39.1, 20), yaw: 0.3, seatHeight: 0.9 };
mv.update([heli, plainer, flown], flown, 0.1, pilot);
ok('a Helix set down is drawn as a helicopter, standing on its skids', mv.views.get(heli) instanceof HelixView && mv.views.get(heli).group.position.y === 20.9);
ok('a parked Plainer, as its wings on their frame', mv.views.get(plainer) instanceof GliderView && mv.views.get(plainer).stand.visible);
const fv = mv.views.get(flown);
ok('the Helix you fly is drawn round you, its floor where you sit', fv.group.visible && Math.abs(fv.group.position.y - 40) < 1e-9 && fv.group.rotation.y === 0.3);
const r0 = fv.rotor.rotation.y;
for (let i = 0; i < 20; i++) mv.update([heli, plainer, flown], flown, 0.1, pilot);
ok('  its rotor turning', fv.rotor.rotation.y - r0 > 1);
const still = mv.views.get(heli).rotor.rotation.y;
ok('  and a parked one\'s still', still === 0);
let parts = 0;
fv.group.traverse((o) => { if (o.isMesh) parts++; });
ok(`  made of blocks: cabin, glass, skids, boom, fin, rotors (${parts} boxes)`, parts >= 25 && (() => { let round = 0; fv.group.traverse((o) => { if (o.geometry && o.geometry.type !== 'BoxGeometry') round++; }); return round === 0; })());
const view = mv.views.get(heli);
mv.update([], null);
ok('and a machine picked up is gone from the world', mv.views.size === 0 && !scene.children.includes(view.group));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('the Fly button only shows when you can fly', /if \(fly\) fly\.hidden = !\(this\.cb\.canFly\?\.\(\) \?\? true\);/.test(ui));

process.exit(f ? 1 : 0);
