// Owner, 8 November: the raid "reaches the village and starts killing
// everyone"; villagers can die. A villager takes blows, falls at 0, and is
// gone (bed free); out of a fight they heal back.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Settlers, VILLAGER_HP } from '../src/duilt/Settlers.js';

const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 3, z, 3);
const events = [];
const settlers = new Settlers({ world, structures: { list: () => [], capacity: () => 0 }, rand: () => 0.5, bus: { emit: (n, e) => events.push([n, e]) } });
const ada = { id: 1, name: 'Ada', x: 10.5, y: 4, z: 10.5, homeId: null, workId: null, target: null, wait: 5, hp: VILLAGER_HP };
const bo = { id: 2, name: 'Bo', x: 12.5, y: 4, z: 10.5, homeId: null, workId: null, target: null, wait: 5 };
settlers.people.push(ada, bo);
settlers.tick(0.1);
assert.equal(bo.hp, VILLAGER_HP, 'a villager from an old save gets full health');

assert.equal(settlers.hurt(ada, 4), false);
assert.equal(ada.hp, VILLAGER_HP - 4);
assert.ok(ada.hurt > 0, 'flashes hurt');
for (let i = 0; i < 50; i++) settlers.tick(0.1);
assert.equal(ada.hp, VILLAGER_HP - 4, 'no healing in the 8 s after a blow');
for (let i = 0; i < 300; i++) settlers.tick(0.1);
assert.equal(ada.hp, VILLAGER_HP, 'out of the fight, back to full');
console.log('PASS a villager takes blows and heals once the fight is over');

assert.equal(settlers.hurt(ada, 99), true, 'killed');
assert.ok(!settlers.people.includes(ada), 'gone from the village');
assert.equal(settlers.people.length, 1);
assert.deepEqual(events.filter(([n]) => n === 'settler:died').map(([, e]) => e.settler.name), ['Ada']);
assert.equal(settlers.hurt(ada, 1), false, 'the dead take no more blows');
console.log('PASS at 0 a villager dies: gone, the bed free, and word of it');
