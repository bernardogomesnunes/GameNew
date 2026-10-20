import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/Game.js';

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const body = ui.match(/this\.q\('#btn-leave'\)\.addEventListener\('click', async \(e\) => \{([\s\S]*?)\n    \}\);/)[1];
const handler = new Function('setBusy', 'nextPaint', 'SAVE_SPIN_MS', `return async function(e) {${body}}`)(
  (btn, label) => { btn.busy = !!label; }, async () => {}, 0);
let failures = 0;
async function check(name, run) {
  try { await run(); console.log('PASS ' + name); }
  catch (err) { failures++; console.log('FAIL ' + name + ': ' + err.message); }
}
for (const outcome of [false, true, new Error('Connection lost')]) {
  await check(`Save and leave handles ${String(outcome)}`, async () => {
    const events = [];
    const btn = { classList: { contains: () => false }, removeAttribute() {} };
    const context = {
      cb: { onLeaveWorld: async () => { if (outcome instanceof Error) throw outcome; return outcome; } },
      game: { saveError: 'Account full', ui: { toast: (message) => events.push(message) } },
      closePanel: () => events.push('closed'), openHome: () => events.push('home'),
    };
    await handler.call(context, { currentTarget: btn });
    assert.equal(btn.busy, false);
    assert.equal(events.includes('home'), outcome === true);
    assert.equal(events.includes('closed'), outcome === true);
    if (outcome !== true) {
      assert.ok(events.some((event) => event.body?.includes(outcome instanceof Error ? 'Connection lost' : 'Account full')));
    }
  });
}
for (const result of [true, false, 'reject', 'timeout']) {
  await check(`saveAndWait requires confirmation: ${result}`, async () => {
    const originalTimeout = globalThis.setTimeout;
    const originalClear = globalThis.clearTimeout;
    let cleared = false;
    globalThis.setTimeout = (fn) => originalTimeout(fn, 0);
    globalThis.clearTimeout = (id) => { cleared = true; originalClear(id); };
    const game = { saveNow() {
      this.saving = result === 'timeout' ? new Promise(() => {}) : result === 'reject' ? Promise.reject(new Error('Offline')) : Promise.resolve(result);
      return true;
    } };
    try {
      assert.equal(await Game.prototype.saveAndWait.call(game), result === true);
      assert.ok(cleared, 'wait timer is cleaned up');
    } finally { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; }
  });
}
process.exitCode = failures ? 1 : 0;
