import { Hunger, MAX_HUNGER } from '../src/survival/Hunger.js';
import { Skills } from '../src/progression/Skills.js';
import { Inventory } from '../src/items/Inventory.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};

// --- hunger --------------------------------------------------------------
const h = new Hunger(null);
ok('starts full', h.value === MAX_HUNGER && h.speedFactor === 1);
h.tick(60 * 35);
ok(`idles down slowly (${h.value.toFixed(0)} after 35 min)`, h.value > 45 && h.value < 60);
h.tick(60 * 40);
ok('gets hungry eventually', h.isHungry);
ok('hunger slows you but never stops you', h.speedFactor < 1 && h.speedFactor >= 0.55);
ok('and blocks sprinting', h.canSprint === false);

const inv = new Inventory();
inv.add('fruit', 3); inv.add('vegetables', 2);
const before = h.value;
let r = h.eat(inv, 'vegetables');
ok('eating restores and consumes', r.ok && h.value > before && inv.countOf('vegetables') === 1);
ok('cannot eat wood', h.eat(inv, 'wood').ok === false);
ok('cannot eat what you lack', h.eat(new Inventory(), 'fruit').ok === false);

// picks the food that wastes least
const h2 = new Hunger(null);
h2.value = MAX_HUNGER - 13;       // room for 13
const inv2 = new Inventory();
inv2.add('fruit', 1); inv2.add('vegetables', 1);   // fruit feeds 12, veg 22
ok('eat button picks the least wasteful food', h2.bestFoodIn(inv2) === 'fruit');
const full = new Hunger(null);
ok('refuses to waste food on a full stomach', full.eat(inv2, 'fruit').ok === false);

// exertion burns faster
const a = new Hunger(null), b = new Hunger(null);
a.exertion = 0; b.exertion = 1;
a.tick(600); b.tick(600);
ok('working burns faster than standing', b.value < a.value);

// --- skills --------------------------------------------------------------
const s = new Skills(null);
ok('everyone starts at zero', s.levelOf('foraging') === 0);
ok('first action is a level', s.record('foraging', 1) === 1);
ok('but the second is not', s.record('foraging', 1) === null);
s.record('foraging', 8);
ok('tenth reaches level 2', s.levelOf('foraging') === 2);
s.record('foraging', 5000);
ok('caps at the top of the ladder', s.levelOf('foraging') === 10);
ok('unknown skills are ignored', s.record('cooking', 5) === null);

const s2 = new Skills(null);
s2.record('foraging', 30);
ok('foraging raises yield', s2.gatherYield() > 1);
s2.record('athletics', 30);
ok('athletics raises speed and eases hunger', s2.moveSpeed() > 1 && s2.hungerRelief() < 1);
s2.record('politics', 10);
ok('politics allows settlers', s2.settlerAllowance() >= 1);

const p = s2.progress('foraging');
ok('progress reports a sane bar', p.ratio >= 0 && p.ratio <= 1 && p.next > p.count);
ok('summary covers all four skills', s2.summary().length === 4);

const s3 = new Skills(null);
s3.loadJSON(JSON.parse(JSON.stringify(s2.toJSON())));
ok('skills survive a save', s3.levelOf('foraging') === s2.levelOf('foraging'));

process.exit(f?1:0);
