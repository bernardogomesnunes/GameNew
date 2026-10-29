import { createFeatureLoader } from './optionalFeatures.js';

const modules = {};
const loaders = {
  war: createFeatureLoader(() => import('../runtime/WarRuntime.js').then(module => modules.war = module)),
  sky: createFeatureLoader(() => import('../runtime/SkyRuntime.js').then(module => modules.sky = module)),
  showcase: createFeatureLoader(() => import('../runtime/ShowcaseRuntime.js').then(module => modules.showcase = module)),
};
export const gameFeature = name => modules[name];
export const loadGameFeature = name => loaders[name]();
