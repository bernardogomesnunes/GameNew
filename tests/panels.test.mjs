import { Panels, isTyping } from '../src/ui/Panels.js';

/**
 * The panel registry, and the typing guard.
 *
 * Both exist because of the same bug: three hardcoded lists of panel ids that
 * had drifted apart, so some panels closed on Escape and some did not, and a
 * keyboard shortcut fired for every letter typed into a form.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- a DOM small enough to reason about ------------------------------------

class El {
  constructor(id, cls) { this.id = id; this.className = cls; this.hidden = true; this.tagName = 'DIV'; }
}
class Root {
  constructor(els) { this.els = els; }
  querySelectorAll(sel) {
    // only the one selector the registry uses
    return this.els.filter((e) => e.className.split(' ').includes('overlay') && e.id);
  }
  querySelector(sel) {
    const id = sel.replace(/^#/, '');
    return this.els.find((e) => e.id === id) ?? null;
  }
}
globalThis.CSS ??= { escape: (s) => s };

const make = () => new Root([
  new El('blocker', 'overlay'),
  new El('panel-menu', 'overlay'),
  new El('panel-bag', 'overlay'),
  new El('panel-account', 'overlay'),
  new El('hud-top', 'hud'),          // not a panel
]);

// --- a panel is registered by existing --------------------------------------

{
  const root = make();
  const p = new Panels(root, { exclude: ['blocker'] });
  ok('every overlay with an id is a panel', p.all().length === 3);
  ok('excluded overlays are not panels', !p.all().some((e) => e.id === 'blocker'));
  ok('non-overlays are not panels', !p.all().some((e) => e.id === 'hud-top'));

  // A panel added later needs no registration anywhere.
  root.els.push(new El('panel-later', 'overlay'));
  ok('a panel added later is found without being listed', p.all().length === 4);
  p.open('panel-later');
  ok('and it closes with everything else', p.closeAll() === 1);
}

// --- escape closes one at a time, newest first ------------------------------

{
  const root = make();
  const p = new Panels(root, { exclude: ['blocker'] });
  p.open('panel-menu');
  p.open('panel-bag');
  p.open('panel-account');
  ok('three open', p.openIds().length === 3);
  ok('the newest closes first', p.closeTop() === 'panel-account');
  ok('then the one before it', p.closeTop() === 'panel-bag');
  ok('then the last', p.closeTop() === 'panel-menu');
  ok('and then nothing', p.closeTop() === null);
  ok('nothing is open', !p.anyOpen());
}

// --- the excluded overlay is never touched ----------------------------------

{
  const root = make();
  const p = new Panels(root, { exclude: ['blocker'] });
  root.querySelector('#blocker').hidden = false;
  p.open('panel-menu');
  p.closeAll();
  ok('closing every panel leaves the worlds screen up', !root.querySelector('#blocker').hidden);
  ok('and it cannot be opened as a panel', p.open('blocker') === false);
}

// --- hooks fire so panels can draw and forget -------------------------------

{
  const root = make();
  const p = new Panels(root, { exclude: ['blocker'] });
  const opened = [], closed = [];
  p.onOpen((id) => opened.push(id));
  p.onClose((id) => closed.push(id));
  p.open('panel-bag');
  p.close('panel-bag');
  p.close('panel-bag');   // already shut: no second notification
  ok('opening notifies once', opened.join() === 'panel-bag');
  ok('closing notifies once', closed.join() === 'panel-bag');
}

// --- typing is never a shortcut ---------------------------------------------

for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
  ok(`keys typed into ${tag.toLowerCase()} are not shortcuts`, isTyping({ target: { tagName: tag } }));
}
ok('keys in a contenteditable are not shortcuts', isTyping({ target: { tagName: 'DIV', isContentEditable: true } }));
ok('keys on the page are shortcuts', !isTyping({ target: { tagName: 'DIV' } }));
ok('a key with no target is a shortcut', !isTyping({}));

process.exit(f ? 1 : 0);
