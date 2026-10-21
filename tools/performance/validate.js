/** Pure report validation: missing counters must fail just like expensive ones. */
export function validateBrowserReport(report, budgets) {
  const failures = [];
  const limits = budgets.browser;
  const counter = (value, path) => {
    if (Number.isSafeInteger(value) && value >= 0) return true;
    failures.push(`${path}: missing or invalid counter`);
    return false;
  };
  const limit = (value, maximum, path) => {
    if (!Number.isFinite(maximum) || maximum < 0) failures.push(`${path}: invalid budget`);
    else if (counter(value, path) && value > maximum) failures.push(`${path}: ${value} > ${maximum}`);
  };
  const growth = (name, cycles) => {
    if (!Array.isArray(cycles) || cycles.length < 3) {
      failures.push(`${name}: incomplete disposal cycles`);
      return;
    }
    for (const [metric, budget] of [['geometries','geometryGrowth'], ['textures','textureGrowth'], ['buffers','bufferGrowth']]) {
      const baseline = cycles[0]?.[metric];
      const valid = counter(baseline, `${name}.cycles[0].${metric}`);
      if (!Number.isFinite(limits[budget]) || limits[budget] < 0) failures.push(`${name}.${metric}: invalid growth budget`);
      for (let i=1; i<cycles.length; i++) {
        const value = cycles[i]?.[metric];
        if (counter(value, `${name}.cycles[${i}].${metric}`) && valid && value-baseline > limits[budget]) {
          failures.push(`${name}.cycles[${i}].${metric}: grew after disposal`);
        }
      }
    }
  };
  for (const name of Object.keys(budgets.scenes)) {
    const scene = report?.scenes?.[name];
    for (const view of ['surface','underground']) for (const metric of ['drawCalls','triangles']) {
      limit(scene?.[view]?.[metric], limits[metric], `${name}.${view}.${metric}`);
    }
    growth(name, scene?.cycles);
  }
  for (const name of Object.keys(report?.scenes ?? {})) {
    if (!Object.hasOwn(budgets.scenes,name)) failures.push(`${name}: scene has no budget`);
  }
  for (const metric of ['drawCalls','triangles']) limit(report?.crowd?.[metric],limits[metric],`crowd.${metric}`);
  growth('crowd',report?.crowd?.cycles);
  if (report?.contextLosses !== 0) failures.push('WebGL context lost or context-loss measurement missing');
  if (report?.error) failures.push(String(report.error));
  return failures;
}
