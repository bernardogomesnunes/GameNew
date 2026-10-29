let behaviors;
export const warBehaviorsReady = () => !!behaviors;
export function registerWarBehaviors(methods) { behaviors = methods; }
export function warBehavior(name, actor, args) {
  if (!behaviors) throw new Error('War simulation is not ready.');
  return behaviors[name].apply(actor, args);
}
