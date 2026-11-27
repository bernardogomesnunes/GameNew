import { daylightAt } from '../render/DayCycle.js';
import { isLoaded } from '../world/Mobs.js';
import { bedPart, FACING_STEP, CAMPFIRE } from '../config/blocks.js';

/**
 * VIL-1: where and when villagers sleep. Pure helpers: the same clock the
 * player's sleep uses (render/DayCycle daylightAt; the player may sleep once
 * `day` is under 0.35), and the beds, fires and floor they lie on.
 */
export const BEDTIME_DAY = 0.35;
export const LIE_SECONDS = 0.8;
/** Height of a bed's sheet above its block floor (world/propShapes bed_foot). */
export const BED_TOP = 0.54;

/** Whether the clock reads dusk-to-dawn (time 0..1). */
export const isBedtime = (time) => Number.isFinite(time) && daylightAt(time).day < BEDTIME_DAY;

export const bedKey = (b) => `${b.x},${b.y},${b.z}`;

/** Every bed (foot block) inside `region`, with the way its head lies. */
export function bedsIn(world, region) {
  const beds = [];
  if (!region) return beds;
  const y0 = region.minY ?? 0, y1 = Math.min(region.maxY ?? world.height - 1, world.height - 1);
  for (let y = y0; y <= y1; y++) for (let x = region.minX; x <= region.maxX; x++) for (let z = region.minZ; z <= region.maxZ; z++) {
    const part = bedPart(world.getBlock(x, y, z));
    if (!part || part.head) continue;
    const [dx, dz] = FACING_STEP[part.facing];
    beds.push({ x, y, z, dir: { x: dx, z: dz } });
  }
  return beds;
}

/** Where a person lies on a bed: feet position, surface height, head direction, and cells to step in from. */
export function bedPlace(bed) {
  const { x, z, dir } = bed;
  const mx = x + 0.5 + dir.x * 0.5, mz = z + 0.5 + dir.z * 0.5;
  const sides = [1, -1].map((s) => ({ x: Math.floor(mx - dir.z * s * 1.2) + 0.5, z: Math.floor(mz + dir.x * s * 1.2) + 0.5 }));
  const foot = { x: Math.floor(x - dir.x) + 0.5, z: Math.floor(z - dir.z) + 0.5 };
  return {
    feet: { x: mx - dir.x * 0.9, y: bed.y + BED_TOP, z: mz - dir.z * 0.9 },
    dir: { x: dir.x, z: dir.z },
    stands: [...sides, foot],
  };
}

/** A campfire within `reach` blocks (square) of (cx, cz) at about height cy, or null. Loaded ground only. */
export function campfireNear(world, cx, cy, cz, reach = 20) {
  const y0 = Math.max(0, Math.floor(cy) - 6), y1 = Math.min(world.height - 1, Math.floor(cy) + 6);
  let best = null, bestD = Infinity;
  for (let x = Math.floor(cx - reach); x <= Math.floor(cx + reach); x++) for (let z = Math.floor(cz - reach); z <= Math.floor(cz + reach); z++) {
    if (!world.inBounds(x, 0, z) || !isLoaded(world, x + 0.5, z + 0.5)) continue;
    for (let y = y0; y <= y1; y++) {
      if (world.getBlock(x, y, z) !== CAMPFIRE) continue;
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d < bestD) { bestD = d; best = { x, y, z }; }
    }
  }
  return best;
}
