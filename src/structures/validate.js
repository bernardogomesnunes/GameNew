import { AIR } from '../config/blocks.js';
import { STRUCTURES_BY_ID } from '../config/structures.js';

/**
 * Deciding whether a region of blocks counts as a building.
 *
 * This is the verb the whole game turns on: you build something your own way,
 * frame it, and the game either agrees or tells you precisely what is missing.
 * "Needs 2 more dirt" is a lesson; "invalid" is an insult.
 *
 * Everything here reads the world and never writes to it.
 */

/**
 * The facts a rule can ask about a region. Built once per check so a rule with
 * three clauses doesn't walk the volume three times.
 */
export function inspect(world, region) {
  const tally = new Map();
  let solids = 0;

  for (let x = region.minX; x <= region.maxX; x++) {
    for (let y = region.minY; y <= region.maxY; y++) {
      for (let z = region.minZ; z <= region.maxZ; z++) {
        const id = world.getBlock(x, y, z);
        tally.set(id, (tally.get(id) ?? 0) + 1);
        if (id !== AIR) solids++;
      }
    }
  }

  return {
    world,
    region,
    tally,
    solids,

    countOf(ids) {
      const list = Array.isArray(ids) ? ids : [ids];
      let n = 0;
      for (const id of list) n += tally.get(id) ?? 0;
      return n;
    },

    /** Any of these blocks within `range` of the region, inside or just outside it. */
    hasWithin(ids, range) {
      const list = Array.isArray(ids) ? ids : [ids];
      for (let x = region.minX - range; x <= region.maxX + range; x++) {
        for (let y = region.minY - range; y <= region.maxY + range; y++) {
          for (let z = region.minZ - range; z <= region.maxZ + range; z++) {
            if (list.includes(world.getBlock(x, y, z))) return true;
          }
        }
      }
      return false;
    },

    /**
     * Air inside the region that cannot reach the region's edge — i.e. a room.
     * A flood fill inward from the boundary marks everything open to the
     * outside; whatever air is left over is enclosed.
     */
    enclosedVolume() {
      if (this._enclosed != null) return this._enclosed;
      const { minX, maxX, minY, maxY, minZ, maxZ } = region;
      const w = maxX - minX + 1, h = maxY - minY + 1, d = maxZ - minZ + 1;
      const outside = new Uint8Array(w * h * d);
      const at = (x, y, z) => (x - minX) + (y - minY) * w + (z - minZ) * w * h;
      const stack = [];

      // Seed from every air cell touching the region's surface.
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const edge = x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ;
            if (!edge || world.getBlock(x, y, z) !== AIR) continue;
            const i = at(x, y, z);
            if (!outside[i]) { outside[i] = 1; stack.push([x, y, z]); }
          }
        }
      }

      const step = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      while (stack.length) {
        const [x, y, z] = stack.pop();
        for (const [dx, dy, dz] of step) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY || nz < minZ || nz > maxZ) continue;
          if (world.getBlock(nx, ny, nz) !== AIR) continue;
          const i = at(nx, ny, nz);
          if (outside[i]) continue;
          outside[i] = 1;
          stack.push([nx, ny, nz]);
        }
      }

      let sealed = 0;
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            if (world.getBlock(x, y, z) === AIR && !outside[at(x, y, z)]) sealed++;
          }
        }
      }
      this._enclosed = sealed;
      return sealed;
    },

    /** Every enclosed cell has something solid somewhere above it. */
    hasRoof() {
      const { minX, maxX, minY, maxY, minZ, maxZ } = region;
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          let sawAir = false;
          for (let y = minY; y <= maxY; y++) {
            if (world.getBlock(x, y, z) === AIR) sawAir = true;
          }
          if (!sawAir) continue;
          // A column that contains room air needs a lid above the highest air.
          let highestAir = -1;
          for (let y = maxY; y >= minY; y--) {
            if (world.getBlock(x, y, z) === AIR) { highestAir = y; break; }
          }
          if (highestAir === -1) continue;
          let covered = false;
          for (let y = highestAir + 1; y <= maxY; y++) {
            if (world.getBlock(x, y, z) !== AIR) { covered = true; break; }
          }
          // Columns with no solid anywhere are outside the room, not holes in it.
          const anySolid = this.columnHasSolid(x, z);
          if (!covered && anySolid) return false;
        }
      }
      return true;
    },

    columnHasSolid(x, z) {
      for (let y = region.minY; y <= region.maxY; y++) {
        if (world.getBlock(x, y, z) !== AIR) return true;
      }
      return false;
    },
  };
}

/**
 * Checks a region against a structure definition.
 * Returns { ok, reason, failed } — `reason` is written for the player.
 */
export function validateStructure(world, region, structureId) {
  const spec = STRUCTURES_BY_ID.get(structureId);
  if (!spec) return { ok: false, reason: 'Unknown building type.', failed: 'unknown' };

  const side = region.maxX - region.minX + 1;
  if (side < spec.minSize) {
    return { ok: false, reason: `A ${spec.name.toLowerCase()} needs at least a ${spec.minSize}×${spec.minSize} area`, failed: 'too-small' };
  }
  if (side > spec.maxSize) {
    return { ok: false, reason: `A ${spec.name.toLowerCase()} can't be larger than ${spec.maxSize}×${spec.maxSize}`, failed: 'too-big' };
  }

  const ctx = inspect(world, region);
  for (const rule of spec.requires) {
    if (!rule.test(ctx)) {
      return { ok: false, reason: rule.say(ctx), failed: rule.id };
    }
  }
  return { ok: true, reason: `That's a ${spec.name.toLowerCase()}.`, failed: null };
}

/**
 * Every structure type this region would satisfy — so the claim menu can grey
 * out what won't work and say why, rather than letting the player guess.
 */
export function candidatesFor(world, region, ids) {
  return ids.map((id) => ({ id, ...validateStructure(world, region, id) }));
}
