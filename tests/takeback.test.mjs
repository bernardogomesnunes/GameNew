import { ToolHistory } from '../src/tools/ToolHistory.js';
import { readFileSync } from 'node:fs';

/**
 * Taking something back.
 *
 * There was a general undo: two buttons in the corner of the toolbar, Ctrl+Z,
 * a two-hundred-deep stack, every block you placed on it. Wrong for this game.
 * Breaking a block is how you take a block back — that is the loop, and the
 * block goes in your bag when you do — so a Ctrl+Z beside it was a second,
 * parallel way to reverse things borrowed from a text editor, sitting in the
 * corner where the things you actually use live.
 *
 * What breaking does not answer is a tool. A roof lays sixty-odd blocks in one
 * press and a stamped design a couple of hundred, and "just break it" is not a
 * reasonable answer to sixty-seven blocks. So that is the only thing kept, and
 * the way back is offered on the message the tool leaves rather than parked on
 * screen forever — which also means it works under a thumb, where a Ctrl+Z
 * never did.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../src/config/guide.js', import.meta.url), 'utf8');

const change = (x) => ({ x, y: 1, z: 1, prev: 0, next: 7 });

// --- what is remembered -------------------------------------------------------

{
  const h = new ToolHistory();
  ok('nothing is remembered to begin with', h.pop() === null && h.last === null);
  h.push('Gable roof', [change(1), change(2)]);
  ok('a tool action is remembered by name', h.last.label === 'Gable roof');
  ok('with every block it changed', h.last.changes.length === 2);
  ok('and comes back off', h.pop().label === 'Gable roof' && h.pop() === null);
}

{
  const h = new ToolHistory();
  h.push('Nothing', []);
  ok('an action that changed nothing is not worth remembering', h.last === null);
}

// Short on purpose: this is "that was not what I wanted", not a revision
// history. The world keeps real versions every few minutes for going further
// back, and a deep stack of block edits is exactly what was wrong before.
{
  const h = new ToolHistory();
  ok(`it keeps ${h.limit} at most`, h.limit >= 4 && h.limit <= 20);
  for (let i = 0; i < h.limit + 5; i++) h.push(`Roof ${i}`, [change(i)]);
  ok('and drops the oldest rather than growing', h.stack.length === h.limit);
  ok('newest still on top', h.last.label === `Roof ${h.limit + 4}`);
}

// --- only tools ---------------------------------------------------------------

ok('only a named batch is remembered', /if \(tool\) this\.toolHistory\.push\(tool, changes\)/.test(game));
ok('and the tool is named by the caller', /applyChanges\(changes, \{ viaSymmetry = false, chargeResources = true, tool = null \} = \{\}\)/.test(game));
// Two callers pass one, and they are the two that lay a building's worth of
// blocks in a single press.
ok('a roof names itself', /this\.applyChanges\(changes, \{ tool: label \}\)/.test(game));
ok('and so does a stamped design', /this\.applyChanges\(changes, \{ viaSymmetry: false, tool: name \}\)/.test(game));
ok('breaking and placing do not', !/applyChanges\(changes, \{ viaSymmetry: this\.symmetryTool[^}]*tool/.test(game));
// Stamping a starter, moving a building and taking one down each also change a
// register. Putting their blocks back without touching it would leave a
// building claimed over empty air.
ok('and neither do the building actions, which also change a claim',
  (game.match(/tool: (label|name)/g) ?? []).length === 2);

// --- what taking back actually does -------------------------------------------

// The old one wrote blocks straight back into the world, which is why undoing
// a roof in a Duilt world cost you sixty-seven planks and gave you nothing.
ok('it goes the normal way, so the bag is credited',
  /undoTool\(\)[\s\S]{0,900}this\.applyChanges\(inverse, \{ chargeResources: false \}\)/.test(game));
ok('by turning each change round', /prev: c\.next, next: c\.prev/.test(game));
// Put a roof up, knock a hole in it and build a chimney through it, and taking
// the roof off must not take the chimney.
ok('and only touching what the tool still owns',
  /\.filter\(\(c\) => this\.world\.getBlock\(c\.x, c\.y, c\.z\) === c\.next\)/.test(game));
ok('an action already gone says so rather than writing over what replaced it',
  /if \(!inverse\.length\)/.test(game));
ok('nothing to take back says what to do instead',
  /Break blocks to undo them by hand/.test(game));

// --- how you reach it ---------------------------------------------------------

ok('there is no undo button', !/btn-undo/.test(ui) && !/id="btn-redo"/.test(ui));
ok('and no redo at all — a tool you can just use again does not need one',
  !/doRedo|onRedo|canRedo/.test(game));
ok('Ctrl+Z still works for a keyboard', /e\.code === 'KeyZ'\) \{ e\.preventDefault\(\); this\.undoTool\(\)/.test(game));
ok('but the way back rides on the message the tool leaves',
  /action: \{ label: 'Take it off', onClick: \(\) => this\.undoTool\(\) \}/.test(game)
  && /action: \{ label: 'Take it back', onClick: \(\) => this\.undoTool\(\) \}/.test(game));
ok('which is what gives a phone one at all', /toast\(\{ kind, title, body, action = null \}\)/.test(ui));
ok('it takes a tap as well as a click', /btn\.addEventListener\('touchstart'/.test(ui));
// A toast with a decision on it has to outlast the glance that spots it.
ok('and stays up longer than a plain one', /\}, action \? 7000 : 3400\);/.test(ui));
// The stack is pointer-events: none so it never eats a tap meant for the world.
ok('only the button itself is touchable', /\.toast-action \{[\s\S]{0,60}pointer-events: auto/.test(css));

// Swapping one tool for another announced "Put it away" and then "Ready:
// Gable roof" in the same breath, which reads as the game arguing with itself.
ok('swapping one tool for another does not announce putting the first away',
  /clearPending\(\{ quiet: true \}\)/.test(game)
  && /const had = this\.armed && !quiet;/.test(game));
ok('but cancelling one still says so', /if \(this\.armed\) return void this\.clearPending\(\);/.test(game));

ok('the guide says breaking is the undo', /breaking is the undo/.test(guide));
ok('and where the other one lives', /the message it leaves/.test(guide));

process.exit(f ? 1 : 0);
