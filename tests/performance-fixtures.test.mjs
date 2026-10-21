import assert from 'node:assert/strict';
import { SCENARIOS, createScenario } from '../tools/performance/scenarios.js';
const fixture = createScenario(SCENARIOS.find(spec => spec.id === 'peak'));
try {
  assert.ok(fixture.y >= 170, `The peak benchmark became foothills at height ${fixture.y}`);
} finally { fixture.mesher.clearAll(); }
console.log('PASS the fixed mountain benchmark still measures a high crest');
assert.throws(() => createScenario({ id:'peak', x:-2521, z:-2584, minHeight:170 }), /height|crest/i);
console.log('PASS terrain changes cannot silently turn the crest fixture into cheap lowland');
