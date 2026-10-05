import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { tierStatus } from '../src/structures/validate.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * Reported directly: "can't seem to evolve any building even with the items
 * in inventory." A level's lights and chests had to be placed inside the
 * building, and a claimed building is locked — so the lantern in your bag
 * never counted. Evolve now puts them in from the bag itself. And: "let's
 * use the same pattern for needed items with icons and the pill too."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 7 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });

// A tavern, stamped and claimed (it makes gold, so it has the standard ladder).
const design = DESIGN_FOR_STRUCTURE.get('tavern');
const ox = origin.minX + 4, oz = origin.minZ + 4, gy = 40;
for (let x = ox - 4; x < ox + 14; x++) for (let z = oz - 4; z < oz + 14; z++) {
  for (let y = gy - 1; y < gy + 16; y++) world.setBlock(x, y, z, y === gy - 1 ? 2 : 0);
}
for (const b of design.blocks) world.setBlock(ox + b.dx, gy + b.dy, oz + b.dz, b.type);
for (let y = gy; y < gy + 3; y++) world.setBlock(ox - 2, y, oz - 2, 7);
const region = { minX: ox, maxX: ox + design.extent.x, minY: gy, maxY: gy + design.extent.y, minZ: oz, maxZ: oz + design.extent.z };
for (const [id, n] of Object.entries(STRUCTURES_BY_ID.get('tavern').cost ?? {})) g.inventory.add(id, n);
const claim = g.claim(region, 'tavern');
ok('a tavern claims', claim.ok);
const s = claim.structure;

// --- what it wants, as things ---------------------------------------------------
const status = tierStatus(world, region, 'tavern', 0);
const light = status.next.wants.find((w) => w.item === 'lantern');
ok('its next level wants a light, as a lantern pill', light && light.n === 1 && light.fit?.includes('lantern'));

// --- nothing in the bag: it says what to bring ---------------------------------
for (const [id, n] of Object.entries(STRUCTURES_BY_ID.get('tavern').tiers[1].cost)) g.inventory.add(id, n);
let plan = g.evolvePlan(s);
ok('without a lantern it says to bring one', !plan.ok && /lantern/i.test(plan.reason) && /bag/.test(plan.reason));

// --- a lantern in the bag: Evolve hangs it -------------------------------------
g.inventory.add('lantern', 1);
plan = g.evolvePlan(s);
ok('with one, the plan puts it in', plan.ok && plan.changes.length === 1 && plan.changes[0].next === 26);
const c = plan.changes[0];
ok('inside the building', c.x >= region.minX && c.x <= region.maxX && c.y >= region.minY && c.y <= region.maxY && c.z >= region.minZ && c.z <= region.maxZ);
ok('hung from the ceiling', world.getBlock(c.x, c.y + 1, c.z) !== 0 && world.getBlock(c.x, c.y, c.z) === 0);
ok('and planning changed nothing', world.getBlock(c.x, c.y, c.z) === 0 && g.inventory.countOf('lantern') === 1);
// What Game.evolveBuilding does with it: place (paid from the bag), then evolve.
world.setBlock(c.x, c.y, c.z, c.next);
g.inventory.remove('lantern', 1);
const r = g.structures.evolve(s.id);
ok('and then it evolves', r.ok && s.tier === 1);

// --- the next level: two lights and a chest, all from the bag ------------------
for (const [id, n] of Object.entries(STRUCTURES_BY_ID.get('tavern').tiers[2].cost)) g.inventory.add(id, n);
g.inventory.add('lantern', 1);
g.inventory.add('chest', 1);
plan = g.evolvePlan(s);
ok('a chest and another light go in together', plan.ok && plan.changes.length === 2
  && plan.changes.some((x) => x.next === 148) && plan.changes.some((x) => x.next === 26));
const chest = plan.changes.find((x) => x.next === 148);
ok('the chest stands on the floor', chest && world.getBlock(chest.x, chest.y - 1, chest.z) !== 0);
ok('the two never share a cell', new Set(plan.changes.map((x) => `${x.x},${x.y},${x.z}`)).size === 2);

// --- its bill is checked before anything goes in -------------------------------
const poor = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
poor.structures.structures.push({ ...s, tier: 1 });
poor.inventory.add('lantern', 2); poor.inventory.add('chest', 1);
ok('without the coins, nothing is put in', /coin/.test(poor.evolvePlan(poor.structures.structures[0]).reason ?? ''));

// --- what's built into the walls still says Change it --------------------------
const shed = DESIGN_FOR_STRUCTURE.get('storehouse');
const sx = ox + 16;
for (let x = sx - 1; x < sx + 9; x++) for (let z = oz - 1; z < oz + 9; z++) {
  for (let y = gy - 1; y < gy + 12; y++) world.setBlock(x, y, z, y === gy - 1 ? 2 : 0);
}
for (const b of shed.blocks) world.setBlock(sx + b.dx, gy + b.dy, oz + b.dz, b.type);
const shedRegion = { minX: sx, maxX: sx + shed.extent.x, minY: gy, maxY: gy + shed.extent.y, minZ: oz, maxZ: oz + shed.extent.z };
for (const [id, n] of Object.entries(STRUCTURES_BY_ID.get('storehouse').cost ?? {})) g.inventory.add(id, n);
const sh = g.claim(shedRegion, 'storehouse');
ok('a shed claims', sh.ok);
const shedPlan = g.evolvePlan(sh.structure);
ok('its next level wants planks built in: Change it', !shedPlan.ok && /Change it/.test(shedPlan.reason));
const shedWants = tierStatus(world, shedRegion, 'storehouse', sh.structure.tier).next.wants;
ok('and planks show as a pill, not a sentence', shedWants.some((w) => w.item === 'planks' && w.n > 0 && !w.fit));

// --- the panels -----------------------------------------------------------------
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('needs are drawn as pills', /needsHtml\(next\)/.test(ui) && /itemChip\(w\.item, w\.n/.test(ui));
ok('the storehouse panel uses the same pills, with an Evolve button', /this\.needsHtml\(up\)/.test(ui) && /data-store-evolve/.test(ui));
ok('and no longer says it settles on your next change', !/settle there on your next change/.test(ui));
ok('Evolve puts the plan in before evolving', /const plan = this\.duilt\.evolvePlan\(structure\)/.test(game));

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
