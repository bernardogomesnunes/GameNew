import { readFileSync } from 'node:fs';
import { Game } from '../src/Game.js';
import { setBusy } from '../src/ui/UIManager.js';

/**
 * Asked for directly: "when saving the button should have a loading
 * indication, loading spinner, in style". Save and leave waits for the save
 * to land, and says so, before taking you to the worlds screen.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- the button ----------------------------------------------------------------------------------

{
  const classes = new Set();
  const attrs = {};
  const btn = {
    innerHTML: 'Save and leave', disabled: false, dataset: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
  };
  setBusy(btn, 'Saving…');
  ok('saving: a spinner and "Saving…", and it can\'t be pressed again', btn.innerHTML.includes('px-spinner') && btn.innerHTML.includes('Saving…') && btn.disabled && classes.has('busy') && attrs['aria-busy'] === 'true');
  setBusy(btn, null);
  ok('done: back as it was', btn.innerHTML === 'Save and leave' && !btn.disabled && !classes.has('busy') && !attrs['aria-busy']);
}
ok('Save and leave shows it while it saves, and only then leaves',
  /#btn-leave'\)\.addEventListener\('click', async[\s\S]{0,200}setBusy\(btn, 'Saving…'\);[\s\S]{0,400}const saved = await this\.cb\.onLeaveWorld\?\.\(true\);[\s\S]*?this\.openHome\(\);/.test(ui));
ok('the spinner is pixel-style: a square turning a quarter at a time', /\.px-spinner \{[\s\S]*steps\(4\)/.test(css) && /@keyframes px-spin/.test(css));

// --- the wait ------------------------------------------------------------------------------------

{
  // A cloud save that takes a moment: leaving waits for it.
  let landed = false;
  const fake = {
    saving: null, saveAndWait: Game.prototype.saveAndWait,
    saveNow() { this.saving = new Promise((r) => setTimeout(() => { landed = true; r(true); }, 50)); return true; },
  };
  const t0 = Date.now();
  await Game.prototype.leaveWorld.call(fake, true);
  ok(`leaving waits for the save to land (${Date.now() - t0} ms)`, landed);

  // One that never answers: the wait ends, but leaving is refused.
  const stuck = { saving: null, saveAndWait: Game.prototype.saveAndWait, saveNow() { this.saving = new Promise(() => {}); return true; } };
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0); // the cap, without waiting out its seconds
  const left = await Promise.race([Game.prototype.leaveWorld.call(stuck, true).then((saved) => saved ? 'left' : 'unsaved'), new Promise((r) => realTimeout(() => r('stuck'), 500))]);
  globalThis.setTimeout = realTimeout;
  ok('a save that never answers refuses to leave after the wait', left === 'unsaved');

  // Leave without saving: no wait, and nothing saved.
  const nosave = { saveNow() { throw new Error('saved'); } };
  ok('leave without saving saves nothing', (await Game.prototype.leaveWorld.call(nosave, false)) === false && nosave.discarded === true);
}

// --- Save, and stay ----------------------------------------------------------------------------
// Reported directly: "Saving loads the button and then shows the loading of
// the beginning of the game" — the only Save took you out of the world.

ok('the menu has a Save that keeps you in the world', ui.includes('id="btn-save"') && /#btn-save'\)\.addEventListener\('click', async[\s\S]{0,200}setBusy\(btn, 'Saving…'\);[\s\S]{0,300}await this\.cb\.onSaveWorld\?\.\(\);/.test(ui));
{
  const save = ui.match(/#btn-save'\)\.addEventListener[\s\S]*?\n    \}\);/)[0];
  ok('and it neither leaves nor shows the loading screen', !/openHome|onLeaveWorld|withLoading/.test(save));
  ok('it says "Saved" once it has', /'Saved'/.test(save));
  let landed = false;
  const fake = { saving: null, saveNow() { this.saving = new Promise((r) => setTimeout(() => { landed = true; r(true); }, 50)); return true; } };
  const saved = await Game.prototype.saveAndWait.call(fake);
  ok('Save waits for the save to land, and says it did', landed && saved === true && !fake.discarded);
  const failed = { saveNow() { this.saveError = 'full'; return true; } };
  ok('a save that failed says so', (await Game.prototype.saveAndWait.call(failed)) === false);
}

process.exit(f ? 1 : 0);
