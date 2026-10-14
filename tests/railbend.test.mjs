import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { railCurve, railBoxes } from '../src/world/propShapes.js';
import { RAIL } from '../src/config/blocks.js';

/**
 * Asked for directly, of a line of rail turning a corner: "Rails need to
 * curve in this scenario like rounded iron bars."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the shape ---------------------------------------------------------------------------------------------------

ok('a straight run, a lone rail and a junction don\'t bend',
  railCurve({ pz: 1, nz: 1 }) === null && railCurve({}) === null && railCurve({ px: 1, nx: 1, pz: 1 }) === null && railCurve({ px: 1 }) === null);

for (const joins of [{ nz: 1, px: 1 }, { nz: 1, nx: 1 }, { pz: 1, px: 1 }, { pz: 1, nx: 1 }]) {
  const bend = railCurve(joins);
  const name = Object.keys(joins).join('+');
  const cx = joins.px ? 1 : 0, cz = joins.pz ? 1 : 0;
  const bars = bend.filter((p) => p.color == null), sleepers = bend.filter((p) => p.color != null);
  ok(`${name}: it bends — two iron bars in many short pieces (${bars.length}), four sleepers`, bars.length >= 16 && sleepers.length === 4);
  ok(`${name}:   every piece inside its cell`, bend.every((p) => p.pts.every(([x, z]) => x >= -1e-9 && x <= 1 + 1e-9 && z >= -1e-9 && z <= 1 + 1e-9)));
  // Each bar keeps its distance from the corner it turns about: an arc.
  const radii = bars.flatMap((p) => p.pts.map(([x, z]) => Math.hypot(x - cx, z - cz)));
  ok(`${name}:   the bars are arcs round the corner between the two sides it joins`, radii.every((r) => [0.22, 0.28, 0.72, 0.78].some((R) => Math.abs(r - R) < 1e-9)));
  // And they meet the straight rail beside it with no step: at the z side's
  // edge the bars sit where a run along z has them, and the same at the x side.
  const zRun = railBoxes({ pz: 1, nz: 1 }).filter((b) => b.color == null).map((b) => [b.minX, b.maxX]);
  const xRun = railBoxes({ px: 1, nx: 1 }).filter((b) => b.color == null).map((b) => [b.minZ, b.maxZ]);
  const onZEdge = bars.flatMap((p) => p.pts).filter(([, z]) => Math.abs(z - cz) < 1e-9).map(([x]) => x);
  const onXEdge = bars.flatMap((p) => p.pts).filter(([x]) => Math.abs(x - cx) < 1e-9).map(([, z]) => z);
  const meets = (edge, run) => run.every(([a, b]) => edge.some((v) => Math.abs(v - a) < 1e-9) && edge.some((v) => Math.abs(v - b) < 1e-9));
  ok(`${name}:   and run on into the straight rail either side with no step`, meets(onZEdge, zRun) && meets(onXEdge, xRun));
  ok(`${name}:   bars on the sleepers, as on a straight run`, bars.every((p) => p.minY === 0.05 && p.maxY === 0.13) && sleepers.every((p) => p.minY === 0 && p.maxY === 0.05));
}

// --- drawn ----------------------------------------------------------------------------------------------------------

const draw = (cells) => {
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 0, z, 3);
  for (const [x, z] of cells) w.setBlock(x, 1, z, RAIL);
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  return c.propMesh.geometry;
};
{
  // A line down z that turns off along x at (4, 6) — the case it was asked about.
  const L = draw([[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [5, 6], [6, 6], [7, 6]]);
  const straight = draw([[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9]]);
  const pos = L.attributes.position;
  let diagonal = 0;
  const nrm = L.attributes.normal;
  for (let i = 0; i < nrm.count; i++) if (Math.abs(nrm.getX(i)) > 0.05 && Math.abs(nrm.getZ(i)) > 0.05) diagonal++;
  ok(`the corner is drawn bent: faces turned between x and z (${diagonal / 4})`, diagonal > 0);
  let inCorner = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (x > 4 && x < 5 && z > 6 && z < 7 && Math.abs(x - 4.5) > 0.05 && Math.abs(z - 6.5) > 0.05) inCorner++;
  }
  ok('  in the corner cell', inCorner > 0);
  let straightDiag = 0;
  const sn = straight.attributes.normal;
  for (let i = 0; i < sn.count; i++) if (Math.abs(sn.getX(i)) > 0.05 && Math.abs(sn.getZ(i)) > 0.05) straightDiag++;
  ok('a straight line is drawn as before, nothing bent', straightDiag === 0);
  // Faces point the way their normals say: every triangle wound outward.
  let wrong = 0;
  const idx = L.index.array;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const v = (k) => [pos.getX(k), pos.getY(k), pos.getZ(k)];
    const A = v(a), B = v(b), C = v(c);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (cr[0] * nrm.getX(a) + cr[1] * nrm.getY(a) + cr[2] * nrm.getZ(a) < -1e-12) wrong++;
  }
  ok(`every face wound the way it faces (${wrong} the wrong way)`, wrong === 0);
}

process.exit(f ? 1 : 0);
