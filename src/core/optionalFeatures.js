import { skyAt, SKY_REACH } from '../world/skyLocation.js';

/** One import per feature, shared by concurrent callers; failures can be retried. */
export function createFeatureLoader(importFeature) {
  let pending;
  return () => {
    if (!pending) pending = Promise.resolve().then(importFeature).catch(error => { pending = null; throw error; });
    return pending;
  };
}

let skyStamper, skyPlanner;
export const ensureSkyTerrain = createFeatureLoader(() => import('../world/skyKingdom.js'));
export const skyTerrainReady = () => !!skyStamper;
export function registerSkyTerrain(stamp, plan) { skyStamper = stamp; skyPlanner = plan; }
export function skyPlan(gen) {
  if (!skyPlanner) throw new Error('Sky terrain is not ready.');
  return skyPlanner(gen);
}

/** Synchronous collision/generation callers must never cache an unstamped island. */
export function stampSkyTerrain(gen, chunk, size) {
  if (!gen.sky) return;
  const at = skyAt(gen), half = size / 2;
  if (Math.abs(chunk.cx * size + half - at.x) > SKY_REACH + size || Math.abs(chunk.cz * size + half - at.z) > SKY_REACH + size) return;
  if (!skyStamper) throw new Error('Sky terrain is not ready. Load the Sky Kingdom before generating its chunks.');
  skyStamper(gen, chunk, size);
}
