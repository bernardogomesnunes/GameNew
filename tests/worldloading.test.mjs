import { readFileSync } from 'node:fs';

/**
 * Asked for directly: "Can we add a loading on the create world like a
 * loading as we have in the beginning and on save the loading spinner".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const game = src('Game.js'), ui = src('ui/UIManager.js'), loading = src('ui/loading.js'), html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// --- the loading screen, again ---------------------------------------------------------------------

{
  // A stand-in page, just enough for loading.js.
  const made = [];
  const node = () => {
    const attrs = new Map(), classes = new Set(), parts = new Map();
    const n = {
      id: '', innerHTML: '', style: {}, textContent: '',
      setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => attrs.get(k) ?? null,
      classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) },
      querySelector: (sel) => { if (!parts.has(sel)) parts.set(sel, { style: {}, textContent: '' }); return parts.get(sel); },
      remove: () => { const i = made.indexOf(n); if (i >= 0) made.splice(i, 1); },
    };
    return n;
  };
  globalThis.document = {
    getElementById: (id) => made.find((n) => n.id === id) ?? null,
    createElement: () => node(),
    body: { appendChild: (n) => made.push(n) },
  };
  globalThis.setTimeout = ((t) => (fn) => t(fn, 0))(globalThis.setTimeout);
  const { loadingShow, loadingProgress, loadingDone } = await import('../src/ui/loading.js');
  loadingShow('Building the world…');
  const root = document.getElementById('loading');
  ok('it comes back up when it was gone', !!root && root.querySelector('.ld-label').textContent === 'Building the world…');
  ok('  starting near empty', root.getAttribute('aria-valuenow') === '6');
  loadingProgress(50, 'Drawing the land…');
  ok('  and its bar moves as before', root.querySelector('.ld-fill').style.width === '50%');
  loadingDone();
  ok('  and goes again', root.classList.contains('ld-gone'));
  loadingShow('Opening your world…');
  const again = document.getElementById('loading');
  ok('a second time while the last is fading: a fresh one, from the start', again && again !== root && again.getAttribute('aria-valuenow') === '6' && made.length === 1);
  ok('  with the same look as at the start (its styles live in index.html)', /ld-card/.test(loading) && /#loading \.ld-card/.test(html));
}

// --- where it's used -------------------------------------------------------------------------------

ok('creating a world puts it up', /onNewWorld: \(mode, name\) => this\.withLoading\('Building the world…'/.test(game));
ok('  entered first, inside the tap, then made', /onCreate: \(mode, name\) => \{ this\.enterWorld\(\); this\.cb\.onNewWorld\(mode, name\); \}/.test(ui));
ok('opening one too', /onOpenWorld: \(id\) => this\.withLoading\('Opening your world…'/.test(game));
ok('and going back to your worlds', /onGoHome: \(\) => \(this\.title \? true : this\.withLoading\('Back to your worlds…'/.test(game));
ok('drawn before the work starts, gone after the land round you is drawn', /loadingShow\(label\);\s*await nextPaint\(\);/.test(game)
  && /followDrawing\(\(\) => \(this\.title \? this\.titleProgress\(\) : this\.drawnAround\(this\.player\?\.position\)\)/.test(game) && /finally \{\s*this\.booting = false;\s*loadingDone\(\);/.test(game));

// --- saving ------------------------------------------------------------------------------------------------

ok('Save and leave draws its spinner before saving, not after', /setBusy\(btn, 'Saving…'\);[\s\S]{0,400}await nextPaint\(\);\s*try \{\s*await this\.cb\.onLeaveWorld\?\.\(true\);/.test(ui));
ok('  and holds it a moment, so a quick save is seen', /SAVE_SPIN_MS - \(performance\.now\(\) - shown\)/.test(ui));

process.exit(f ? 1 : 0);
