import { readFileSync } from 'node:fs';
import { Inventory } from '../src/items/Inventory.js';
import { Granary } from '../src/items/Granary.js';

/**
 * Reported directly: "Storehouses now don't allow me to delete one item they
 * should", and the hungry villager's notice "is cropped".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

ok('a storehouse\'s slots have the bag\'s throw-away cross', /discardAttr: bin \}\)\)/.test(ui) && /const bin = summary\.grave \? null : 'data-store-discard';/.test(ui));
ok('it asks first, and says it\'s for good', /async discardFromStore\(i\)[\s\S]{0,500}this\.confirm\(\{ title: `Throw away \$\{what\}\?`, body: 'They\\'re gone for good\.'/.test(ui));
ok('and only throws away the stack it asked about', /if \(store\.slots\[i\] !== slot\) return;/.test(ui));

{
  const shed = new Inventory({ slots: 4 });
  shed.add('stone', 40);
  shed.add('wood', 3);
  const gone = shed.discard(0);
  ok('thrown away from a storehouse: the stack is gone, the rest stays', gone.count === 40 && shed.countOf('stone') === 0 && shed.countOf('wood') === 3);
  const g = new Granary();
  g.add('vegetables', 900);
  g.add('potato', 5);
  g.discard(0);
  ok('from a granary too, and its slot goes with it', g.countOf('vegetables') === 0 && g.slots.length === 1 && g.slots[0].id === 'potato');
}

ok('on a phone, a notice with a button gets the taller band, so the button shows',
  /#toast-stack:has\(\.toast\.story\), #toast-stack:has\(\.toast-action\) \{ max-height: 230px; \}/.test(css)
  && /body\.touch #toast-stack:has\(\.toast\.story\), body\.touch #toast-stack:has\(\.toast-action\) \{ max-height: 150px; \}/.test(css));

process.exit(f ? 1 : 0);
