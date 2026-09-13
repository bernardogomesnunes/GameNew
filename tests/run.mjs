/**
 * Runs every test file and reports one number.
 *
 * The suite mixes two styles: the Duilt tests print `PASS`/`FAIL` lines because
 * they walk generated worlds and the output is worth reading when one breaks,
 * while the persistence tests use node:test. This runs both and fails the
 * process if anything did.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();

let pass = 0, fail = 0;
for (const f of files) {
  const nodeTest = f === 'persistence.test.mjs';
  const args = nodeTest ? ['--test', join(here, f)] : [join(here, f)];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const p = (out.match(/^PASS /gm) || []).length + (out.match(/^ok \d+ /gm) || []).length;
  const q = (out.match(/^FAIL /gm) || []).length + (out.match(/^not ok \d+ /gm) || []).length;
  pass += p; fail += q;
  if (q || r.status !== 0) {
    console.log(`\n--- ${f} (${p} passed, ${q} failed)`);
    console.log(out.split('\n').filter((l) => /^(FAIL|not ok)/.test(l)).join('\n') || out.slice(-1500));
  } else {
    console.log(`ok  ${f.padEnd(26)} ${p} passed`);
  }
}
console.log(`\n${pass} passed, ${fail} failed across ${files.length} files`);
process.exit(fail ? 1 : 0);
