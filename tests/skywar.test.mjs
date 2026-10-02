import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { SkyWar, TAX_RATES, REPLACED } from '../src/duilt/SkyWar.js';
import { HIT_CAUSES } from '../src/config/armour.js';

/**
 * The dark path, losing (docs/plan-phase7-lore.md, Decision 2): "you're
 * driven back to your castle. The Sky Kingdom takes a quarter of what your
 * buildings make as taxes until you conquer it. Each failed attempt raises
 * the tax a step ... Warriors lost are replaced by the Stone King, in fewer
 * numbers each time."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- the attacks, and what losing one costs ---------------------------------------------------------

{
  const w = new SkyWar();
  ok('no tax before an attack is lost', w.taxRate() === 0 && !w.lose(500));
  ok('an attack begins once', w.begin(3, 1000) && !w.begin(3.1, 1000) && w.attack.army === 1000);
  w.withdraw();
  ok('leave alive and it\'s over, nothing lost', w.attack === null && w.failures === 0 && w.taxRate() === 0);
  w.begin(4, 1000);
  const first = w.lose(600);
  ok(`lost: a quarter taken (${first.rate * 100}%), and the Stone King makes up ${first.replaced} of the ${first.lost} lost`,
    first.rate === 0.25 && first.lost === 400 && first.replaced === Math.round(400 * REPLACED[0]) && w.attack === null);
  const rates = [first.rate];
  for (let i = 0; i < 4; i++) { w.begin(5 + i, 500); rates.push(w.lose(300).rate); }
  ok(`each lost attack raises it a step: ${rates.map((r) => `${Math.round(r * 100)}%`).join(' → ')}, no further`, rates.every((r, i) => i === 0 || r >= rates[i - 1]) && rates[1] > rates[0] && Math.max(...rates) === TAX_RATES[TAX_RATES.length - 1] && Math.max(...rates) <= 0.5);
  w.begin(9, 500);
  ok('and fewer warriors replaced each time, until none', w.lose(0).replaced === 0 && REPLACED.every((r, i) => i === 0 || r < REPLACED[i - 1]));
  ok('none once it has fallen', w.taxRate(true) === 0);
  const back = new SkyWar();
  back.loadJSON(JSON.parse(JSON.stringify(w.toJSON())));
  ok('saved with the world', back.failures === w.failures && back.taxRate() === w.taxRate());
}

// --- the tax, taken off what your buildings make -------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  // A building that makes one of something an hour: added straight in, as a save would bring it.
  reg.structures.push({ id: 1, type: 'tavern', region: { minX: 0, maxX: 5, minY: 1, maxY: 4, minZ: 0, maxZ: 5 }, valid: true, lastPaidAt: 0 });
  let paid = 0, taken = 0;
  const hour = 3_600_000;
  for (let h = 1; h <= 40; h++) {
    const got = reg.collect({ now: h * hour * 24, taxRate: 0.25 });
    paid += Object.values(got).reduce((a, b) => a + b, 0);
    taken += Object.values(reg.lastTaxed).reduce((a, b) => a + b, 0);
  }
  const share = taken / (paid + taken);
  ok(`a quarter of what a building makes goes to the Sky Kingdom (${taken} of ${paid + taken})`, paid + taken > 0 && Math.abs(share - 0.25) < 0.05);
  const before = paid;
  reg.collect({ now: 41 * hour * 24, taxRate: 0 });
  ok('and nothing once the tax is lifted', Object.values(reg.lastTaxed).length === 0 && before > 0);
}

// --- in DuiltGame -------------------------------------------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const bus = { emit() {}, on() {} };
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  ok('no taxes on the white path, or before a lost attack', g.skyTaxRate() === 0);
  g.ring = 'black';
  g.army.swear(0);
  g.skyWar.begin(1, g.army.total);
  g.army.total = 700;
  const r = g.loseSkyAttack();
  ok(`a lost attack: taxed at ${r.rate * 100}%, and ${r.replaced} warriors sent to make up the 300 lost`, g.skyTaxRate() === 0.25 && g.army.total === 700 + r.replaced && r.replaced > 0);
  g.skyFallen = true;
  ok('until the Sky Kingdom falls', g.skyTaxRate() === 0);
  g.skyFallen = false;
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('saved with the world', back.skyTaxRate() === 0.25 && back.skyWar.failures === 1);
  ok('Creative never pays', (() => { const c = new DuiltGame({ world, scene: new THREE.Scene(), bus, sandbox: true }); c.ring = 'black'; c.skyWar.failures = 2; return c.skyTaxRate() === 0; })());
}

// --- in the game -----------------------------------------------------------------------------------------------

ok('an attack begins when you reach the island or its towers with the Black Ring', /this\.tickSkyAttack\(\);/.test(game) && /war\.begin\(d\.days, d\.army\.active \? d\.army\.total : 0\)/.test(game) && /if \(!d \|\| d\.sandbox \|\| d\.ring !== 'black' \|\| d\.skyFallen \|\| !gen\) return;/.test(game));
ok('it\'s over if you leave alive', /if \(far > SKY_ATTACK_OUT\) \{ war\.withdraw\(\); return; \}/.test(game));
ok('lost if your army is wiped out there — and you\'re driven home', /if \(war\.attack\.army > 0 && d\.army\.total === 0\) this\.skyAttackLost\('army'\)/.test(game) && /if \(how === 'army'\) \{\s*const home = this\.homeSpawn\(\);/.test(game));
ok('lost if you fall there: you wake at home, not at your camp', /const routed = !!this\.duilt\.skyWar\.attack && !this\.duilt\.sandbox;\s*const home = routed \? this\.homeSpawn\(\) : this\.respawnPoint\(\);/.test(game) && /if \(routed\) this\.skyAttackLost\('fell'\);/.test(game));
ok('its guards\' blows are armoured against, and named when they beat you', HIT_CAUSES.has('sky') && /WANDERERS\[p\.kind\]\?\.sky \? 'sky' : 'bandit'/.test(game) && /sky: 'The Sky Kingdom\\'s guards beat you'/.test(game));
ok('a Taxes line on every building that makes something', /Taxes: the Sky Kingdom takes \$\{Math\.round\(tax \* 100\)\}% of what it makes, until it falls/.test(ui));
ok('and when it falls, its taxes end', /Its taxes end\./.test(game));

process.exit(f ? 1 : 0);
