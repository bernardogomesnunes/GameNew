import { TRADERS, CITY_TRADERS, PURSE, NEVER_BOUGHT, BULK_GOODS, sellPrice, buysFor, orderSlots, wornCoins } from '../src/config/traders.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';

/**
 * PLAY-22: what each trader buys, and for how much (docs/design/play-22-23.md,
 * chunk A, with the owner's decisions of 23 November: no trader sells gold,
 * bulk goods pay more than half).
 */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ALL = [...TRADERS, ...CITY_TRADERS];
const offersOf = (t) => [...(t.goods ?? []), ...(t.rare ?? [])];
const cheapest = new Map();
for (const t of ALL) for (const [id, lot, price] of offersOf(t)) {
  if (!cheapest.has(id) || price / lot < cheapest.get(id).price / cheapest.get(id).lot) cheapest.set(id, { lot, price });
}
const isBulk = (id) => BULK_GOODS.has(id) || ITEMS_BY_ID.get(id)?.kind === 'food';

// 1. The rule.
{
  let good = true;
  for (const [id, o] of cheapest) {
    const p = sellPrice(id);
    if (!p) { good = false; console.log('  no price for', id); continue; }
    const rule = isBulk(id) ? { lot: o.lot * 2, coins: 2 * o.price - 1 } : { lot: o.lot, coins: Math.max(1, Math.floor(o.price / 2)) };
    // Either the rule, or a recipe cap that pays less per unit.
    const same = p.lot === rule.lot && p.coins === rule.coins;
    const capped = p.coins / p.lot <= rule.coins / rule.lot;
    if (!same && !capped) { good = false; console.log('  off the rule:', id, p, rule); }
  }
  ok('every item a trader sells has a price: the rule, or a lower recipe cap', good);
  ok('Gold Helm pays 9 now that gold is off the stalls (nothing to buy its inputs from)', sellPrice('armour_gold_head').coins === 9);
  ok('Iron Sword pays 4, capped by its inputs', sellPrice('sword_iron').coins === 4 && sellPrice('sword_iron').lot === 1);
  ok('plain items pay half rounded down: Iron Ore 4 for 2, Diamond 22, Ruby 15', sellPrice('iron_ore').coins === 2 && sellPrice('diamond').coins === 22 && sellPrice('ruby').coins === 15);
  ok('bulk: 32 stone pay 3, 32 wood pay 3', sellPrice('stone').lot === 32 && sellPrice('stone').coins === 3 && sellPrice('wood').coins === 3);
  ok('1,000 stone pay clearly more than the old 62 coins', Math.floor(1000 / sellPrice('stone').lot) * sellPrice('stone').coins >= 90);
}

// 2. A sale always pays under the buy price per unit.
{
  let good = true;
  for (const t of ALL) for (const [id, lot, price] of offersOf(t)) {
    const p = sellPrice(id);
    if (!(p.coins / p.lot < price / lot)) { good = false; console.log('  sell >= buy:', t.id, id, p, price, lot); }
  }
  ok('every offer: sell coins per unit are below buy coins per unit', good);
}

// 3. Buys what it sells.
ok('each trader buys every item of its goods and rare shelf', ALL.every((t) => {
  const bought = new Set(buysFor(t).map((r) => r[0]));
  return offersOf(t).every(([id]) => NEVER_BOUGHT.has(id) || bought.has(id));
}));

// 4. buys rows.
{
  const rows = ALL.flatMap((t) => (t.buys ?? []).map((r) => ({ t, r })));
  ok('there are buys rows', rows.length > 15);
  ok('every row is a real item with lot and coins of 1 or more', rows.every(({ r: [id, lot, c] }) => ITEMS_BY_ID.has(id) && lot >= 1 && c >= 1));
  ok('a row for an item no trader sells is the price paid', rows.filter(({ r }) => !cheapest.has(r[0])).every(({ r: [id, lot, c] }) => sellPrice(id).lot === lot && sellPrice(id).coins === c));
  ok('a row for an item another trader sells matches sellPrice', rows.filter(({ r }) => cheapest.has(r[0])).every(({ r: [id, lot, c] }) => sellPrice(id).lot === lot && sellPrice(id).coins === c));
}

// 5. Never bought.
ok('no NEVER_BOUGHT item is bought, and coin is in the set',
  NEVER_BOUGHT.has('coin') && ALL.every((t) => buysFor(t).every(([id]) => !NEVER_BOUGHT.has(id))) && !sellPrice('coin') && !sellPrice('sunstone'));

// 6. No loop: buying and making never beats selling, coins included.
{
  // Cheapest cost per unit to get an item, by buying or by crafting from bought things.
  const cost = new Map([...cheapest].map(([id, o]) => [id, o.price / o.lot]));
  for (let pass = 0; pass < 12; pass++) {
    for (const r of RECIPES) {
      if (r.study || r.output.id === 'coin') continue;
      let c = 0;
      for (const [id, n] of Object.entries(r.inputs)) { if (!cost.has(id)) { c = null; break; } c += cost.get(id) * n; }
      if (c == null) continue;
      c /= r.output.count || 1;
      if (!cost.has(r.output.id) || c < cost.get(r.output.id)) cost.set(r.output.id, c);
    }
  }
  let direct = true, chain = true, coins = true;
  for (const r of RECIPES) {
    const out = r.output.id;
    let inCost = 0, buyable = true;
    for (const [id, n] of Object.entries(r.inputs)) { if (!cheapest.has(id)) { buyable = false; break; } inCost += (cheapest.get(id).price / cheapest.get(id).lot) * n; }
    const p = sellPrice(out);
    if (out === 'coin') {
      const viaChain = Object.entries(r.inputs).every(([id]) => cost.has(id));
      if (viaChain) {
        const c = Object.entries(r.inputs).reduce((s, [id, n]) => s + cost.get(id) * n, 0);
        if (!(c > r.output.count)) { coins = false; console.log('  coin loop:', r.id, c, '->', r.output.count); }
      }
      continue;
    }
    if (!p) continue;
    const value = (p.coins / p.lot) * r.output.count;
    if (buyable && !(value < inCost)) { direct = false; console.log('  direct loop:', r.id, value, inCost); }
    if (!buyable && Object.keys(r.inputs).every((id) => cost.has(id))) {
      const c = Object.entries(r.inputs).reduce((s, [id, n]) => s + cost.get(id) * n, 0);
      if (!(value < c)) { chain = false; console.log('  chain loop:', r.id, value, c); }
    }
  }
  for (const [id, c] of cost) {
    const p = sellPrice(id);
    if (p && !(p.coins / p.lot < c)) { chain = false; console.log('  acquire then sell:', id, p, c); }
  }
  ok('every recipe with bought inputs sells for less than its inputs cost', direct);
  ok('and so does every recipe reached through crafted inputs, and every item by its cheapest route', chain);
  ok('no recipe turns coins into more coins: coin recipes cost more than the coins they strike', coins);
}

// 7. Gold.
{
  const sold = ALL.flatMap((t) => offersOf(t).map((g) => g[0]));
  ok('no trader offers gold or gold ore, on goods or rare shelf', !sold.includes('gold') && !sold.includes('gold_ore'));
  ok('traders still buy gold and gold ore', buysFor(TRADERS[1]).some((r) => r[0] === 'gold') && buysFor(TRADERS[1]).some((r) => r[0] === 'gold_ore') && buysFor(CITY_TRADERS[0]).some((r) => r[0] === 'gold'));
  ok('gold sells for less than the foundry strikes (10 coins)', sellPrice('gold').coins / sellPrice('gold').lot < 10);
}

// 8. Slots and purse.
ok('order slots 2, 4, 6, 8 and the purse is 20', [0, 1, 2, 3].map(orderSlots).join() === '2,4,6,8' && PURSE === 20);

// 9. Who buys what.
{
  const names = (t) => new Set(buysFor(t).map((r) => r[0]));
  const grub = names(TRADERS[0]), smith = names(TRADERS[1]), bramble = names(TRADERS[3]);
  ok('Grub buys stone, wood, planks, fruit and vegetables', ['stone', 'wood', 'planks', 'fruit', 'vegetables'].every((i) => grub.has(i)));
  ok('Snikkit buys iron ore and copper ore', smith.has('iron_ore') && smith.has('copper_ore'));
  ok('Bramble buys leather and cotton', bramble.has('leather') && bramble.has('cotton'));
  ok('buysFor is in name order', buysFor(TRADERS[0]).map((r) => ITEMS_BY_ID.get(r[0]).name).join('|') === buysFor(TRADERS[0]).map((r) => ITEMS_BY_ID.get(r[0]).name).sort((a, b) => a.localeCompare(b)).join('|'));
}

// 10. Worn goods.
ok('wear lowers the pay: a cuirass at half wear pays 3, at 90% it pays 0',
  wornCoins('armour_iron_body', 7, 0) === 7 && wornCoins('armour_iron_body', 7, 100) === 3 && wornCoins('armour_iron_body', 7, 180) === 0);

process.exit(f ? 1 : 0);
