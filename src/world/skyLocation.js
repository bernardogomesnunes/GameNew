import { hash01 } from './hash.js';

// Location and bounds stay cheap: terrain protects this site and its distant
// beacon is visible before the city itself needs to be generated.
export const SKY_AT = 5000;
export const FLOOR = 172;
export const ISLAND_R = 112;
export const TOWER_OUT = ISLAND_R + 30;
export const SKY_REACH = TOWER_OUT + 6;

export function skyAt(gen) {
  const seed = gen.seed ?? 0;
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  const a = hash01(seed, 91, 0x5c01) * Math.PI * 2;
  return { x: Math.round(home.x + Math.cos(a) * SKY_AT), y: FLOOR, z: Math.round(home.z + Math.sin(a) * SKY_AT) };
}
