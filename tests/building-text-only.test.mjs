// IMP-4: "Buildings emojis look disgusting, can we remove them and leave only
// text here?" The building list, the claim list and the finished-buildings
// list show the building's name alone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

for (const marker of ['building-icon', 'claim-icon', 'finish-icon']) {
  assert.ok(!ui.includes(marker), `${marker} is no longer written into the building lists`);
  assert.ok(!css.includes(marker), `${marker} has no leftover style`);
}
assert.ok(!/\$\{(spec|o|r\.spec)\.icon\}/.test(ui), 'no building emoji is interpolated into the panels');
console.log('PASS building lists show names only, no emoji');
