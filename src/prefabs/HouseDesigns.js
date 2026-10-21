import { room, TEAL, MINT, LILAC, DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { ITEM_FOR_BLOCK } from '../config/items.js';
import { BED, BED_HEAD, HANGING_VINES, CURL, roofBlock, roofPart } from '../config/blocks.js';
import { workerDesigns } from './WorkerDesigns.js';

// Alternative shells retain the existing house/townhouse claims and capacity.
// They are designs, never new building types or save-format identifiers.
function furnished(shell, beds = 1) {
  const blocks = [...shell];
  for (let i = 0; i < beds; i++) {
    blocks.push({ dx: 2 + i * 3, dy: 1, dz: 3, type: BED + 2 },
      { dx: 2 + i * 3, dy: 1, dz: 4, type: BED_HEAD + 2 });
  }
  blocks.push({ dx: 3, dy: 1, dz: 2, type: 31 }, { dx: 4, dy: 1, dz: 2, type: 33 });
  return blocks;
}

function finish(id, structure, name, description, blocks) {
  const cells = new Map(blocks.map(b => [`${b.dx},${b.dy},${b.dz}`, b]));
  const unique = [...cells.values()];
  const extent = { x: 0, y: 0, z: 0 }, cost = {};
  for (const b of unique) {
    extent.x = Math.max(extent.x, b.dx); extent.y = Math.max(extent.y, b.dy); extent.z = Math.max(extent.z, b.dz);
    const item = ITEM_FOR_BLOCK.get(b.type);
    if (item) cost[item] = (cost[item] ?? 0) + 1;
  }
  return { id, structure, name, description, blocks: unique, extent, size: extent.x + 1,
    footprint: `${extent.x + 1} × ${extent.z + 1}`, cost };
}

const gable = furnished(room({ w: 5, h: 3, wall: 4, floor: 7, tiles: MINT,
  chimney: { h: 2, type: 3 }, shutters: true, hood: true }));
// The two ridge-end finials and climbing eaves make a readable little cottage.
const ridgeY = Math.max(...gable.filter(b => roofPart(b.type)).map(b => b.dy));
gable.push({ dx: 3, dy: ridgeY + 1, dz: 1, type: CURL },
  { dx: 3, dy: ridgeY + 1, dz: 5, type: CURL }, { dx: 0, dy: 3, dz: 3, type: HANGING_VINES });

const porch = furnished(room({ w: 6, h: 3, wall: 4, floor: 7, tiles: TEAL, shape: 'hip', chimney: { h: 3, type: 3 } }));
// Extend the front into a covered veranda; shift the house back so the
// porch lives inside the actual footprint and the doorway stays clear.
const veranda = porch.map(b => ({ ...b, dz: b.dz + 2 }));
for (let x = 2; x <= 5; x++) for (let z = 0; z <= 2; z++) veranda.push({ dx: x, dy: 0, dz: z, type: 7 });
for (const x of [2, 5]) for (let y = 1; y <= 3; y++) veranda.push({ dx: x, dy: y, dz: 0, type: 4 });
for (let x = 1; x <= 6; x++) for (let z = 0; z <= 2; z++) veranda.push({ dx: x, dy: 4, dz: z, type: roofBlock({ mat: 3, kind: 'lo', facing: 2 }) });

// The tall shared home has two window courses and a hipped roof, in contrast
// to the broad, low gable of the original townhouse.
const tall = furnished(room({ w: 7, h: 5, wall: 7, floor: 3, tiles: LILAC, shape: 'hip',
  chimney: { h: 3 }, shutters: true, hood: true }), 2);
export const houseDesigns = [
  finish('house_gable_cottage', 'house', 'Willow cottage', 'A steep mint gable, curled ridge ends and shuttered windows.', gable),
  finish('house_veranda', 'house', 'Porch cottage', 'A low teal hip roof and a sheltered timber veranda.', veranda),
  finish('townhouse_lantern', 'townhouse', 'Lantern townhouse', 'A tall shared home with two window courses and a lilac crown.', tall),
];
export function designsForStructure(structure) {
  const original = DESIGN_FOR_STRUCTURE.get(structure);
  return original ? [original, ...houseDesigns.filter(d => d.structure === structure), ...workerDesigns.filter(d => d.structure === structure)] : [];
}
export function starterDesign(structure, designId = null) {
  if (!designId) return DESIGN_FOR_STRUCTURE.get(structure) ?? null;
  return designsForStructure(structure).find(d => d.id === designId) ?? null;
}
