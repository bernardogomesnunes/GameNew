import { World } from '../src/world/World.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';

/** WIZ-1: the Wizard's Hut. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

function stamped(mutate = null, at = { x: 40, y: 4, z: 40 }) {
  const world = new World({ sizeX: 128, sizeZ: 128, height: 48 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 0; y < at.y; y++) world.setBlock(x, y, z, 3);
  const d = DESIGN_FOR_STRUCTURE.get('wizard_hut');
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, mutate ? mutate(b) : b.type);
  return { world, region: { minX: at.x, maxX: at.x + d.extent.x, minY: at.y, maxY: at.y + d.extent.y, minZ: at.z, maxZ: at.z + d.extent.z } };
}
const without = (test) => { const { world, region } = stamped((b) => (test(b) ? 0 : b.type)); return validateStructure(world, region, 'wizard_hut'); };

const s = STRUCTURES_BY_ID.get('wizard_hut');
ok('Wizard hut: Age 3, optional, no cost', s.age === 3 && s.optional === true && Object.keys(s.cost).length === 0);
ok('requirement order', s.requires.map((r) => r.id).join() === 'logs,mushrooms,lantern,room');
ok('a starter design exists', !!DESIGN_FOR_STRUCTURE.get('wizard_hut'));
const { world, region } = stamped();
const v = validateStructure(world, region, 'wizard_hut');
ok(`the starter design stands as one (${v.reason ?? 'ok'})`, v.ok);
ok('without logs it says logs', /log/.test(without((b) => b.type === 4).reason ?? ''));
ok('without mushrooms it says mushroom', /mushroom/.test(without((b) => b.type === 505 || b.type === 506).reason ?? ''));
ok('without a lantern it says lantern', /lantern/.test(without((b) => b.type === 26).reason ?? ''));
process.exit(f ? 1 : 0);
