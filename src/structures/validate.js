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

    /**
     * Air that is roofed and walled on all four sides within the region.
     *
     * This replaces a strict flood-fill seal, which counted any doorway as a
     * hole and so rejected every house anyone would actually build — including
     * the starter design shipped with the game. Cells in line with a doorway
     * fail, the rest of the room passes, and an unroofed frame or a solid lump
     * still scores zero.
     */
    shelteredVolume() {
      if (this._sheltered != null) return this._sheltered;
      const { minX, maxX, minY, maxY, minZ, maxZ } = region;
      let sheltered = 0;

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            if (world.getBlock(x, y, z) !== AIR) continue;

            let roofed = false;
            for (let ry = y + 1; ry <= maxY; ry++) {
              if (world.getBlock(x, ry, z) !== AIR) { roofed = true; break; }
            }
            if (!roofed) continue;

            let walls = 0;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              for (let k = 1; k <= Math.max(maxX - minX, maxZ - minZ) + 1; k++) {
                const wx = x + dx * k, wz = z + dz * k;
                if (wx < minX || wx > maxX || wz < minZ || wz > maxZ) break;
                if (world.getBlock(wx, y, wz) !== AIR) { walls++; break; }
              }
            }
            if (walls === 4) sheltered++;
          }
        }
      }
      this._sheltered = sheltered;
      return sheltered;
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

    /**
     * Any of these blocks within `range` of the region but *not inside it*.
     *
     * `hasWithin` searches the region too, which is right for "is there water
     * near this farm" and wrong for "is this market among your town": a market
     * made of planks satisfied a plank rule by existing. This one only counts
     * what somebody else built.
     */
    hasNeighbour(ids, range) {
      const list = Array.isArray(ids) ? ids : [ids];
      for (let x = region.minX - range; x <= region.maxX + range; x++) {
        for (let y = region.minY - range; y <= region.maxY + range; y++) {
          for (let z = region.minZ - range; z <= region.maxZ + range; z++) {
            const inside = x >= region.minX && x <= region.maxX
              && y >= region.minY && y <= region.maxY
              && z >= region.minZ && z <= region.maxZ;
            if (inside) continue;
            if (list.includes(world.getBlock(x, y, z))) return true;
          }
        }
      }
      return false;
    },

    /**
     * Columns of the region with nothing built over them.
     *
     * A quarry has to be a hole in the ground rather than a cellar, and a
     * monument has to be seen. Both are the same question: is the sky above
     * this, or is it somebody's floor?
     */
    openSkyColumns() {
      if (this._sky != null) return this._sky;
      let open = 0;
      for (let x = region.minX; x <= region.maxX; x++) {
        for (let z = region.minZ; z <= region.maxZ; z++) {
          let blocked = false;
          for (let y = region.maxY + 1; y < world.height; y++) {
            if (world.getBlock(x, y, z) !== AIR) { blocked = true; break; }
          }
          if (!blocked) open++;
        }
      }
      this._sky = open;
      return open;
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
 * What a storehouse has been built into, and what the next rung would need.
 *
 * Read off the blocks the same way everything else here is, so a storehouse
 * upgrades by being built up rather than by a button. Returns null for a
 * building that holds nothing.
 *
 * The tiers are a ladder, not a menu: failing one stops the climb instead of
 * skipping past it, so a shed lined with brick but still the size of a shed
 * does not land on the top rung by accident.
 */
export function tierStatus(world, region, structureId) {
  const spec = STRUCTURES_BY_ID.get(structureId);
  if (!spec?.tiers?.length) return null;

  const ctx = inspect(world, region);
  let tier = 0;
  for (let i = 1; i < spec.tiers.length; i++) {
    if (!(spec.tiers[i].needs ?? []).every((n) => n.test(ctx))) break;
    tier = i;
  }

  const here = spec.tiers[tier];
  const next = spec.tiers[tier + 1] ?? null;
  return {
    tier,
    id: here.id,
    name: here.name,
    slots: here.slots,
    blurb: here.blurb,
    next: next && {
      name: next.name,
      slots: next.slots,
      // Only what is actually missing, in the order the rules are written.
      missing: (next.needs ?? []).filter((n) => !n.test(ctx)).map((n) => n.say(ctx)),
    },
  };
}

/**
 * Every structure type this region would satisfy — so the claim menu can grey
 * out what won't work and say why, rather than letting the player guess.
 */
export function candidatesFor(world, region, ids) {
  return ids.map((id) => ({ id, ...validateStructure(world, region, id) }));
}
