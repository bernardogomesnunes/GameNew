import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';

const FARMLAND = 21, WATER = 11, DIRT = 2;
const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
  world.setBlock(x, 10, z, DIRT);
  world.surfaceHeightMap[x * 64 + z] = 11;
}
for (let x = 4; x <= 12; x++) for (let z = 4; z <= 12; z++) world.setBlock(x, 10, z, FARMLAND);
for (let z = 4; z <= 12; z++) world.setBlock(14, 10, z, WATER);

/**
 * A claim you can no longer reach must not hold the ground for ever.
 *
 * Claimed buildings are locked, so the only way to change one is through the
 * panel you get by pointing at it. Which means a building whose blocks are
 * gone is a claim with nothing left to point at: invalid, producing nothing,
 * and impossible to release. "My farms stopped being farms, I destroyed them,
 * and I cannot build them in the same spot again" was a dead end with no way
 * out short of abandoning the ground.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const inventory = new Inventory();
inventory.add('seeds', 40);
const reg = new StructureRegistry({ world, bus: null, inventory });
const region = { minX: 4, maxX: 12, minY: 10, maxY: 13, minZ: 4, maxZ: 12 };

const first = reg.claim(region, 'farm');
ok(`a farm claims: ${first.reason}`, first.ok);

// The farm stops being a farm — the soil is gone.
for (let x = 4; x <= 12; x++) for (let z = 4; z <= 12; z++) world.setBlock(x, 10, z, DIRT);
reg.recheck(first.structure);
ok(`and then stops being one: ${first.structure.brokenReason}`, !first.structure.valid);

// Before: this was the trap — the dead claim held the ground for ever.
const blocked = reg.claim(region, 'farm');
ok('a farm cannot be claimed while the soil is gone', !blocked.ok);
ok('  and it says why, rather than blaming the old claim',
  !/overlaps/.test(blocked.reason ?? ''));

// Put the soil back and claim again: the dead claim gets out of the way.
for (let x = 4; x <= 12; x++) for (let z = 4; z <= 12; z++) world.setBlock(x, 10, z, FARMLAND);
const again = reg.claim(region, 'farm');
ok(`claiming the same ground again works: ${again.reason}`, again.ok);
ok('and the dead claim is gone rather than stacked under it',
  reg.list().filter((s) => s.type === 'farm').length === 1);
ok('it says one was replaced', again.replaced === 1);

// A building that is still standing is still somebody's building.
const other = { minX: 4, maxX: 12, minY: 10, maxY: 13, minZ: 4, maxZ: 12 };
const onTop = reg.claim(other, 'farm');
ok('claiming over a standing building is still refused', !onTop.ok);
ok('  with the overlap as the reason', /overlaps/.test(onTop.reason));

// --- and a recipe you cannot afford answers the press ------------------------

// The Make button was disabled, so tapping it did nothing whatsoever. The
// reason was on screen the whole time, in small grey type under a row you had
// already given up on — which reads exactly like a broken button.
{
  const { readFileSync } = await import('node:fs');
  const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
  ok('the Make button is never disabled', !/data-craft="\$\{r\.id\}" data-times="1" \$\{r\.ok \? '' : 'disabled'\}/.test(duiltUi));
  ok('it is dimmed instead', /class="secondary\$\{r\.ok \? '' : ' cannot'\}"/.test(duiltUi));
  ok('and pressing one you cannot afford says why',
    /Cannot make that/.test(duiltUi) && /res\.reason/.test(duiltUi));
}

process.exit(f ? 1 : 0);
