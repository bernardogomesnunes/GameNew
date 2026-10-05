import { STARTER_DESIGNS } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { roofPart } from '../src/config/blocks.js';

/**
 * Reported: "I need to craft brick tiles roofs to the workshop, but I need the
 * workshop to build them". Brick comes from a workshop, so nothing you can
 * build before one stands — the workshop included — is roofed in brick tiles.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const brickTiled = (d) => d.blocks.some((b) => roofPart(b.type)?.mat === 0);
const early = (d) => d.structure === 'workshop' || (STRUCTURES_BY_ID.get(d.structure)?.age ?? 9) < 3
  || ['kiln', 'university', 'engineering'].includes(d.structure);
for (const d of STARTER_DESIGNS.filter(early)) {
  ok(`${d.name}: no brick roof tiles`, !brickTiled(d));
}
ok('the workshop is roofed in slate', STARTER_DESIGNS.filter((d) => d.structure === 'workshop').every((d) => d.blocks.some((b) => roofPart(b.type)?.mat === 1)));

process.exit(f ? 1 : 0);
