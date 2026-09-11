import { AIR } from '../config/blocks.js';

/**
 * 3D DDA voxel traversal (Amanatides & Woo). Returns the first solid block
 * hit along the ray, the face normal, and the empty cell just before it
 * (where a new block would be placed), or null if nothing is within range.
 */
export function castVoxelRay(world, origin, direction, maxDistance = 7) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x) || 0;
  const stepY = Math.sign(direction.y) || 0;
  const stepZ = Math.sign(direction.z) || 0;

  const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

  function initialTMax(originComp, step, cell, delta) {
    if (step === 0) return Infinity;
    const boundary = step > 0 ? cell + 1 : cell;
    return (boundary - originComp) * delta * step;
  }

  let tMaxX = initialTMax(origin.x, stepX, x, tDeltaX);
  let tMaxY = initialTMax(origin.y, stepY, y, tDeltaY);
  let tMaxZ = initialTMax(origin.z, stepZ, z, tDeltaZ);

  let normal = { x: 0, y: 0, z: 0 };
  let traveled = 0;
  let iterations = 0;

  while (traveled <= maxDistance && iterations < 256) {
    iterations++;
    const block = world.getBlock(x, y, z);
    if (block !== AIR) {
      return {
        x, y, z,
        block,
        normal,
        placeX: x + normal.x,
        placeY: y + normal.y,
        placeZ: z + normal.z,
      };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      traveled = tMaxX;
      tMaxX += tDeltaX;
      normal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      traveled = tMaxY;
      tMaxY += tDeltaY;
      normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ;
      traveled = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = { x: 0, y: 0, z: -stepZ };
    }
  }
  return null;
}
