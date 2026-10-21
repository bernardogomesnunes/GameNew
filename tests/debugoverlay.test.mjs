import { readFileSync } from 'node:fs';

/**
 * The debug overlay (ui/DebugOverlay.js) is for finding memory leaks on a
 * phone. It must cost nothing for anyone who did not ask for it.
 */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
ok('main.js loads the overlay only when the address has ?debug',
  /has\('debug'\)\)\s*\{\s*import\('\.\/ui\/DebugOverlay\.js'\)/.test(main));
ok('and has no static import of it', !/^import .*DebugOverlay/m.test(main));

const src = readFileSync(new URL('../src/ui/DebugOverlay.js', import.meta.url), 'utf8');
ok('the overlay takes no pointer input', /pointer-events:none/.test(src));
ok('it starts no frame loop', !/requestAnimationFrame|setAnimationLoop/.test(src));
ok('it polls on one timer', (src.match(/setInterval\(/g) ?? []).length === 1);

process.exit(f ? 1 : 0);
