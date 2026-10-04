import { readFileSync } from 'node:fs';

/**
 * Asked for directly, from a phone: "when flying it's good to have the up and
 * down on the left instead of right", and "we need to block the moving left
 * joystick to be still or else I keep picking it up with my right finger".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// The walking stick stays put, and only a touch on it takes it.
ok('the walking stick is fixed', /bindStick\('#stick-left', \(x, y\) => this\.cb\.onMove\(x, y\), \{ deadZone: 0\.10, curve: 1\.1, fixed: true \}\)/.test(ui));
ok('a fixed stick listens on itself, not its half of the screen', /const grab = fixed \? base : zone;/.test(ui) && /grab\.addEventListener\('touchstart'/.test(ui));
ok('and is pushed from its own middle, never moved under the thumb', /if \(fixed\) \{[\s\S]{0,200}origin = \{ x: b\.left \+ b\.width \/ 2, y: b\.top \+ b\.height \/ 2 \};/.test(ui));
ok('the rest of its half lets touches through to the picture', /\.stick-zone\.stick-fixed \{ pointer-events: none; \}/.test(css)
  && /\.stick-zone\.stick-fixed \.stick-base \{ pointer-events: auto;/.test(css));
ok('with a little margin round it for a thumb that lands just off it', /\.stick-zone\.stick-fixed \.stick-base::before \{ content: ''; position: absolute; inset: -18px;/.test(css));

// Up and Down beside the walking stick while flying.
ok('flying marks the page', /document\.body\.classList\.toggle\('flying', !!flying\);/.test(ui));
ok('and Up and Down move beside the walking stick', /body\.flying #side-right \{ right: auto; left: calc\(var\(--stick-edge\) \+ var\(--stick-size\) \+ 10px\); \}/.test(css));
ok('mirrored when the stick is on the right', /body\.flying\.touch-walk-right #side-right \{ left: auto; right: calc\(var\(--stick-edge\) \+ var\(--stick-size\) \+ 10px\); \}/.test(css));

process.exit(f ? 1 : 0);
