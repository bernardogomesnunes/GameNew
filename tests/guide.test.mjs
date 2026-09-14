import { GUIDE, GUIDE_BY_ID, guideFor } from '../src/config/guide.js';
import { AGES } from '../src/config/ages.js';
import { SKILLS } from '../src/config/skills.js';
import { ACHIEVEMENTS } from '../src/config/achievements.js';
import { PANELS_BY_ID } from '../src/config/panels.js';
import { readFileSync } from 'node:fs';

/**
 * How to play, and whether it still describes the game.
 *
 * The old Help panel was hand-written prose a thousand lines from the features
 * it described, so every feature that shipped left it a little more wrong: by
 * the end it had nothing to say about claiming, ages, settlers or food. The
 * fix was to derive the parts that move, and these are the checks that keep it
 * derived — a section that hard-codes the number of ages, or an age nobody
 * mentions, fails here rather than in front of a player.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- the declarations hold together -----------------------------------------

ok(`there are ${GUIDE.length} sections`, GUIDE.length >= 4);
ok('every section has an id and a name', GUIDE.every((g) => g.id && g.name));
ok('every id is unique', new Set(GUIDE.map((g) => g.id)).size === GUIDE.length);
ok('every id is addressable', GUIDE.every((g) => GUIDE_BY_ID.get(g.id) === g));
ok('every mode is one the UI knows',
  GUIDE.every((g) => ['any', 'duilt', 'sandbox'].includes(g.mode)));
// A tab label has to fit on a phone alongside the others.
ok('the names are tab-sized', GUIDE.every((g) => g.name.length <= 14));

// --- every section actually draws something ---------------------------------

const KINDS = ['lead', 'keys', 'defs', 'steps', 'note'];
for (const touch of [false, true]) {
  for (const g of GUIDE) {
    const blocks = g.blocks({ touch });
    ok(`${g.id} has something to say${touch ? ' on a phone' : ''}`, blocks.length > 0);
    ok(`  and every block is a kind the renderer knows`,
      blocks.every((b) => KINDS.includes(b.kind)));
    for (const b of blocks) {
      if (b.kind === 'lead' || b.kind === 'note') {
        ok(`  its ${b.kind} is real prose`, typeof b.text === 'string' && b.text.length > 20);
      } else {
        ok(`  its ${b.kind} has rows`, Array.isArray(b.rows) && b.rows.length > 0);
      }
      if (b.kind === 'keys' || b.kind === 'defs') {
        ok('  and every row is a pair with words in it',
          b.rows.every((r) => Array.isArray(r) && r[0] && r[1]));
      }
      if (b.kind === 'steps') {
        ok('  and every step is a sentence', b.rows.every((t) => typeof t === 'string' && t.length > 5));
      }
    }
  }
}

// --- the renderer knows every kind, and the stylesheet dresses it ------------

for (const kind of KINDS) {
  ok(`the renderer handles "${kind}"`, ui.includes(`case '${kind}':`));
}
for (const cls of ['guide-lead', 'guide-key', 'guide-def', 'guide-steps', 'guide-note', 'guide-head']) {
  ok(`.${cls} is styled`, css.includes(`.${cls}`));
}

// --- it is reachable, and the old name is gone ------------------------------

ok('the panel is declared', !!PANELS_BY_ID.get('panel-guide'));
ok('and something opens it', ui.includes("openPanel('panel-guide')"));
ok('and something fills it in', ui.includes('populateGuide()'));
ok('the old Help panel is gone for good',
  !ui.includes('panel-help') && !ui.includes('populateHelp'));
// Two panels have tabs now. A handler that ran over the whole document would
// hide the other one's bodies, so it has to be given a scope.
ok('tab wiring is scoped to one panel', ui.includes('wireTabs(scope)') || ui.includes('wireTabs('));
ok('and the guide wires its own', ui.includes("wireTabs(this.q('#panel-guide'))"));

// --- the parts that go stale are derived, not typed --------------------------

const prose = JSON.stringify(GUIDE.map((g) => g.blocks({ touch: false })));

// Every age has to be named somewhere, or the guide stops short of the game.
for (const a of AGES) {
  ok(`Age ${a.age} (${a.name}) is described`, prose.includes(a.name));
}
ok('and the number of ages is counted, not typed',
  prose.includes(`${AGES.length} of them`) || prose.includes(`${AGES.length} in all`));

for (const k of SKILLS) ok(`the ${k.name} skill is listed`, prose.includes(k.name));
ok('the achievement count is counted, not typed', prose.includes(`${ACHIEVEMENTS.length} of them`));

// The features that shipped after the old Help was written, and that it never
// mentioned. This is the regression the whole panel exists to prevent.
for (const [what, needle] of [
  ['holding to break', /keeps? going|hold the break/i],
  ['moving a building', /move it|moving carries/i],
  ['settlers', /settler|household/i],
  ['food', /eat|hungry/i],
  ['claiming', /claim/i],
]) {
  ok(`${what} is explained`, needle.test(prose));
}

// --- the right sections for the game you are in ------------------------------

{
  const sandbox = guideFor('sandbox');
  const duilt = guideFor('duilt');
  ok('a sandbox player gets the sections that apply', sandbox.length >= 3);
  ok('and is not told about ages or settlers they do not have',
    sandbox.every((g) => g.mode !== 'duilt'));
  ok('a Duilt player gets more of it', duilt.length > sandbox.length);
  ok('both get the controls', [sandbox, duilt].every((list) => list.some((g) => g.id === 'guide-controls')));
  ok('an unknown mode still gets the common sections', guideFor('nonsense').length >= 3);
}

process.exit(f ? 1 : 0);
