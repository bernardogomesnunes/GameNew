import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame, wizardSpots } from '../src/duilt/DuiltGame.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { OUTFITS } from '../src/config/outfits.js';
import { PANELS } from '../src/config/panels.js';

/** WIZ-2 and WIZ-4 in the game: arrival when the hut stands, saving, old saves. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const at = { x: 8, y: 4, z: 8 };
function make() {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) for (let y = 0; y < at.y; y++) world.setBlock(x, y, z, 3);
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age: 3, sandbox: true });
  return { g, world };
}
function stamp(world) {
  const d = DESIGN_FOR_STRUCTURE.get('wizard_hut');
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, b.type);
  return { minX: at.x, maxX: at.x + d.extent.x, minY: at.y, maxY: at.y + d.extent.y, minZ: at.z, maxZ: at.z + d.extent.z };
}

ok('the wizard is a person kind with an outfit and a panel', !!WANDERERS.wizard && !!OUTFITS.wizard && PANELS.some((p) => p.id === 'panel-wizard'));

{
  const { g, world } = make();
  ok('no hut: no wizard, magic off, level 0', !g.checkWizard() && !g.magic.active && g.magic.level === 0);
  const region = stamp(world);
  const r = g.claim(region, 'wizard_hut');
  ok(`the hut can be claimed (${r.reason ?? 'ok'})`, r.ok);
  ok('the wizard arrives once it stands, magic level 1', g.checkWizard() === true && g.magic.active && g.magic.level === 1);
  ok('his door spot is outside the hut and his night spot inside it',
    g.magic.home && g.magic.home.inside
    && g.magic.home.inside.x > region.minX && g.magic.home.inside.x < region.maxX);
  ok('he arrives once only', g.checkWizard() === false);

  g.magic.add(30);
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  ok('the save carries magic', json.magic?.points === 30);
  const { g: g2 } = make();
  g2.loadJSON(json);
  ok('load restores points, level and home', g2.magic.active && g2.magic.points === 30 && g2.magic.level === 2 && g2.magic.home.inside.y === g.magic.home.inside.y);

  delete json.magic;
  const { g: g3 } = make();
  g3.loadJSON(json);
  ok('an old save without magic loads with magic off', !g3.magic.active && g3.magic.level === 0);
}

{
  const { world } = make();
  const region = stamp(world);
  const s = wizardSpots(world, region);
  ok('wizardSpots finds the door side: open air on a hut wall line', world.getBlock(Math.floor(s.door.x), Math.floor(s.door.y), Math.floor(s.door.z)) === 0);
}
process.exit(f ? 1 : 0);
