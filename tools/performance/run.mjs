import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SCENARIOS, createScenario, meshMetrics, crowdMetrics } from './scenarios.js';

const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'));
const report = { version: 1, runtime: process.version, at: new Date().toISOString(), scenes: {}, failures: [] };
for (const spec of SCENARIOS) {
  const fixture = createScenario(spec);
  try {
    // Warm mesher/JIT before measuring the second build.
    meshMetrics(fixture);
    const measured = report.scenes[spec.id] = meshMetrics(fixture);
    for (const [metric, limit] of Object.entries(budgets.scenes[spec.id])) {
      if (!Number.isFinite(measured[metric]) || measured[metric] > limit) report.failures.push(`${spec.id}.${metric}: ${measured[metric]} > ${limit}`);
    }
    console.log(`${spec.id}: ${JSON.stringify(measured)}`);
  } finally { fixture.mesher.clearAll(); }
}
report.crowd = crowdMetrics();
if (report.crowd.generatedChunks !== 0 || report.crowd.animals !== 24) report.failures.push('Crowd simulation generated terrain or lost animals');
console.log(`crowd: ${JSON.stringify(report.crowd)}`);
mkdirSync('artifacts/performance', { recursive: true });
writeFileSync('artifacts/performance/node.json', JSON.stringify(report, null, 2) + '\n');
for (const failure of report.failures) console.error('FAIL ' + failure);
console.log(`${report.failures.length ? 'FAIL' : 'PASS'} performance budgets (${SCENARIOS.length} terrain scenes and 24 animals)`);
process.exitCode = report.failures.length ? 1 : 0;
