import assert from 'node:assert/strict';
import { validateBrowserReport } from '../tools/performance/validate.js';
const limits = { scenes:{peak:{}}, browser:{drawCalls:160,triangles:350000,geometryGrowth:0,textureGrowth:0,bufferGrowth:0} };
const valid = () => ({ contextLosses:0, scenes:{peak:{surface:{drawCalls:2,triangles:20},underground:{drawCalls:3,triangles:30},
  cycles:Array.from({length:3},()=>({geometries:0,textures:0,buffers:0}))}},
  crowd:{drawCalls:2,triangles:20,cycles:Array.from({length:4},()=>({geometries:0,textures:1,buffers:0}))} });
assert.deepEqual(validateBrowserReport(valid(),limits),[]);
console.log('PASS complete finite browser measurements stay within budget');
for (const metric of ['drawCalls','triangles']) for(const bad of [NaN,Infinity,undefined,-1]) {
  const report=valid(); report.scenes.peak.surface[metric]=bad;
  assert.ok(validateBrowserReport(report,limits).length, `${metric}=${bad} must fail`);
}
for (const metric of ['geometries','textures','buffers']) for(const bad of [NaN,Infinity,undefined,-1]) {
  const report=valid(); report.crowd.cycles[1][metric]=bad;
  assert.ok(validateBrowserReport(report,limits).length, `${metric}=${bad} must fail`);
}
console.log('PASS missing, invalid and negative render/resource counters cannot pass');
for(const mutate of [r=>delete r.scenes.peak,r=>delete r.crowd,r=>r.scenes.peak.cycles.pop(),r=>delete r.contextLosses,
  r=>r.contextLosses=1,r=>r.scenes.peak.surface.triangles=350001,r=>r.crowd.drawCalls=161,
  r=>r.scenes.peak.cycles[1].buffers=1,r=>r.scenes.peak.cycles[1].textures=1,r=>r.scenes.peak.cycles[1].geometries=1]) {
  const report=valid();mutate(report);
  assert.ok(validateBrowserReport(report,limits).length);
}
console.log('PASS missing scenes, context loss, excessive geometry and any disposal-cycle growth fail');
