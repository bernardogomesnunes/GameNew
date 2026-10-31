// Owner, 29 October: the Work Hall "has some drop-downs that are off styling",
// and "weird stuff there". IMP-10, Work Hall part.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const hall = ui.slice(ui.indexOf('  renderWorkHall(hall) {'), ui.indexOf('   * Everything on every shelf, as tiles'));

assert.ok(/class="job-select" data-job-person=/.test(hall), 'each villager has a styled job picker');
assert.ok(/appearance: none/.test(css) && /\.work-hall \.job-select/.test(css), 'the pickers are drawn by the game, not the phone');
assert.ok(/font-size: 16px/.test(css.slice(css.indexOf('.work-hall .job-select'))), 'big enough that a phone does not zoom in on it');
console.log('PASS the Work Hall pickers are styled like the rest of the game');

assert.equal((hall.match(/data-job-deposit="/g) ?? []).length, 1, 'one Put in button, not one per item in the bag');
assert.ok(/data-job-deposit-item/.test(hall), 'an item picker chooses what goes in');
console.log('PASS supplies go in with one picker and one button');

assert.ok(/structure\.type === 'work_hall'\) out\.push\('Give villagers building and carrying jobs/.test(ui), 'the panel says what the hall does');
console.log('PASS the Work Hall says what it is for');
