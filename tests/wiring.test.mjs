import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

/**
 * The joins between the pieces, which is where things go missing quietly.
 *
 * Two of these had been broken for a while and no test noticed, because every
 * other test checks a piece rather than a join:
 *
 *   - Nothing anywhere listened for `toast`. Six messages in DuiltUI — the
 *     loudest being "somebody moved in" — were emitted onto the bus and
 *     dropped. The settlement filled up in silence.
 *   - Game called `ui.setFullscreenIndicator` on every fullscreen change and
 *     the method did not exist. It threw inside a listener, so nothing said so.
 *
 * Both are the same shape: one side of a join talking to a side that is not
 * there. So this checks the joins — every event emitted has somebody
 * listening, and every module at least parses, which the rest of the suite
 * does not do for the UI files it only ever reads as text.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ROOT = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
ok(`there are ${files.length} modules to check`, files.length > 20);

// --- every module parses -----------------------------------------------------

// A stray backtick inside a comment in a template literal ends the template,
// and the file stops being JavaScript. Nothing in the suite imports the UI
// modules, so that lands in the browser rather than here.
{
  // `node --check` is the same parser the browser will use, and the package is
  // type: module, so it reads these as modules. Importing them instead would
  // drag in three.js and a DOM.
  const bad = [];
  for (const p of files) {
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    if (r.status !== 0) {
      const line = (r.stderr || '').split('\n').find((l) => /Error/.test(l)) ?? 'failed';
      bad.push(`${relative(ROOT, p)}: ${line.trim()}`);
    }
  }
  ok('every module parses' + (bad.length ? ` — ${bad.join('; ')}` : ''), bad.length === 0);
}

// --- every event has somebody on the other end -------------------------------

const all = files.map((p) => ({ p: relative(ROOT, p), src: readFileSync(p, 'utf8') }));
const joined = all.map((a) => a.src).join('\n');

const emitted = new Set();
for (const m of joined.matchAll(/\bemit\(\s*['"]([\w:-]+)['"]/g)) emitted.add(m[1]);
const heard = new Set();
for (const m of joined.matchAll(/\bon\(\s*['"]([\w:-]+)['"]/g)) heard.add(m[1]);

ok(`${emitted.size} kinds of message go out`, emitted.size > 10);
// `toast` is the one that was broken, so it gets its own line.
ok('a toast reaches the screen', heard.has('toast'));

/**
 * Messages nothing currently listens for.
 *
 * These are not asserted to be fine — they are written down so the list cannot
 * grow without somebody noticing. `toast` was on this list and was a real bug:
 * if one of these turns out to matter, fix it and take it off. A message that
 * joins the list is a new join that was never connected.
 */
const NOBODY_HEARS = [
  'cloud:auth', 'duilt:bagfull', 'duilt:gathered', 'economy:change', 'economy:tier',
  'game:phase', 'hunger:low', 'session:end', 'session:start', 'skill:levelup', 'structure:locked',
  'structure:removed', 'structure:repaired', 'sync:pulled',
  'sync:pushed', 'template:saved', 'templates:change', 'templates:error',
];

{
  const deaf = [...emitted].filter((e) => !heard.has(e)).sort();
  const known = new Set(NOBODY_HEARS);
  const fresh = deaf.filter((e) => !known.has(e));
  ok('no new message is emitted into thin air' + (fresh.length ? ` — nothing hears ${fresh.join(', ')}` : ''),
    fresh.length === 0);
  const fixed = NOBODY_HEARS.filter((e) => heard.has(e));
  ok('and the list of unheard ones is still accurate'
    + (fixed.length ? ` — ${fixed.join(', ')} now has a listener, take it off the list` : ''),
    fixed.length === 0);
}

// --- the UI has the methods the game calls on it -----------------------------

// Game reaches into the UI by name. A rename or a method that was never
// written is a throw inside whichever listener made the call.
{
  const game = all.find((a) => a.p === 'Game.js').src;
  const ui = all.find((a) => a.p === 'ui/UIManager.js').src;
  const called = new Set([...game.matchAll(/this\.ui\.(\w+)\(/g)].map((m) => m[1]));
  ok(`Game calls ${called.size} things on the UI`, called.size > 5);
  const missing = [...called].filter((name) =>
    !new RegExp(`(^|\\n)\\s*(async\\s+)?${name}\\s*\\(`).test(ui)
    && !new RegExp(`\\b${name}\\s*[=:]`).test(ui)).sort();
  ok('and the UI has all of them' + (missing.length ? ` — missing ${missing.join(', ')}` : ''),
    missing.length === 0);
}

process.exit(f ? 1 : 0);
