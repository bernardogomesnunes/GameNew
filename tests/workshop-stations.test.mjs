// CRAFT3D-1, Task 5: a Workshop lists the stations placed inside it, with
// their work in progress, and opens any of them.
import assert from 'node:assert/strict';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, append() {} }), querySelector: () => null };
const { DuiltUI } = await import('../src/ui/DuiltUI.js');
const { World } = await import('../src/world/World.js');
const { Counters } = await import('../src/duilt/Counter.js');
const { StationWork } = await import('../src/duilt/StationWork.js');
const { Inventory } = await import('../src/items/Inventory.js');

const world = new World({ sizeX: 32, sizeZ: 32, height: 24 });
const bag = new Inventory(); bag.add('planks', 8); bag.add('carpentry_saw', 1); bag.add('wood', 10);
const counters = new Counters({ bag: () => bag });
const stationWork = new StationWork({ bag: () => bag });
world.setBlock(5, 2, 5, 530);   // a counter
world.setBlock(7, 2, 5, 525);   // a forge
world.setBlock(20, 2, 20, 525); // a forge outside
counters.choose('5,2,5', 'table_oak'); counters.cut('5,2,5'); counters.cut('5,2,5');
stationWork.put('7,2,5', 'wood_dark', 2);
const ui = { duilt: { world, counters, stationWork }, game: { world }, workshopStations: DuiltUI.prototype.workshopStations };
const workshop = { id: 1, type: 'workshop', valid: true, region: { minX: 4, maxX: 9, minY: 1, maxY: 4, minZ: 4, maxZ: 7 } };
const list = DuiltUI.prototype.workshopStations.call(ui, workshop);
assert.deepEqual(list.map((s) => s.station), ['counter', 'forge']);
assert.deepEqual(list.map((s) => s.state), ['Oak Table: 2 of 5 cut', '2 waiting']);
assert.deepEqual(list[0].at, { x: 5, y: 2, z: 5 });
console.log('PASS a workshop lists its counter and forge, with their work, and not the forge outside');

const html = DuiltUI.prototype.workshopHtml.call(ui, workshop);
assert.match(html, /data-open-station="5,2,5"/);
assert.match(html, /Counter/);
assert.match(html, /Forge/);
console.log('PASS each with an Open button');
