import { companyPower, cityPower, forecast, resolve, survivors, winLosses, MARCH_DAYS, GUARD_POWER, WIN_RATIO, CLOSE_RATIO } from '../src/duilt/marchBattle.js';
import { Rivals } from '../src/duilt/Rivals.js';

/** PLAY-12 chunk 4: the march's battle by numbers (docs/design/play-12.md, "Worked battles"). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const times = (unit, n) => Array(n).fill(unit);
const R = (...ids) => Object.fromEntries(ids.map((i) => [i, true]));

ok('a march takes one game day each way; a guard is worth 60; win at 1.25x, close up to 1.4x', MARCH_DAYS === 1 && GUARD_POWER === 60 && WIN_RATIO === 1.25 && CLOSE_RATIO === 1.4);

// The rivals: strength 4, 8 and 12 have 6, 10 and 14 guards.
const rivals = new Rivals();
const guards = [4, 8, 12].map((s) => { rivals.list[0].strength = s; return rivals.garrison(rivals.list[0]); });
ok('strength 4, 8, 12 keep 6, 10, 14 guards: 360, 600, 840', guards.join() === '6,10,14' && guards.map(cityPower).join() === '360,600,840');

// Each company's power.
const A = times('warrior', 10), B = times('warrior', 10), C = times('swordsman', 10), D = times('swordsman', 20);
const ours = [companyPower(A), companyPower(B, R('arms_iron')), companyPower(C), companyPower(D, R('shield_drill', 'arms_sky'))];
ok('power: 550, 910, 1600, 4800', ours.join() === '550,910,1600,4800');

// The table, exactly: [company, roster, research, then per rival: won, fallen].
const table = [
  ['10 warriors, no research', A, null, [[true, 4], [false, 6], [false, 6]]],
  ['10 warriors, Iron Arms', B, R('arms_iron'), [[true, 2], [true, 4], [false, 6]]],
  ['10 swordsmen', C, null, [[true, 2], [true, 2], [true, 3]]],
  ['20 swordsmen, Shield Drill and Sky Arms', D, R('shield_drill', 'arms_sky'), [[true, 1], [true, 2], [true, 2]]],
];
for (const [name, roster, research, rows] of table) {
  const mine = companyPower(roster, research);
  [360, 600, 840].forEach((theirs, i) => {
    const r = resolve(mine, theirs, roster, research);
    const [won, fell] = rows[i];
    ok(`${name} against ${theirs}: ${won ? `win, ${fell} fall` : `loss, ${fell} fall`}`, r.won === won && r.lost.length === fell);
  });
}
ok('the Iron Arms company wins at 1.52x and loses at 1.08x', (910 / 600).toFixed(2) === '1.52' && (910 / 840).toFixed(2) === '1.08' && resolve(910, 600, B, R('arms_iron')).won && !resolve(910, 840, B, R('arms_iron')).won);

// Forecast words.
ok('forecast: win, about N fall', forecast(1600, 360, 10).text === 'Win, about 2 fall' && forecast(1600, 360, 10).word === 'win');
ok('forecast: one falls', forecast(4800, 360, 20).text === 'Win, about 1 falls');
ok('forecast: a loss is a loss', forecast(550, 600, 10).text === 'Loss' && forecast(550, 600, 10).word === 'loss');
ok('Close from 1.25x up to 1.4x', forecast(750, 600, 10).word === 'close' && forecast(839, 600, 10).word === 'close' && forecast(840, 600, 10).word === 'win' && forecast(749, 600, 10).word === 'loss');
ok('Close still says how many fall', /^Close, about \d+ fall/.test(forecast(800, 600, 10).text));
ok('forecast agrees with resolve', [[550, 360], [910, 600], [910, 840], [1600, 840]].every(([o, t]) => (forecast(o, t, 10).word !== 'loss') === resolve(o, t, A).won));

// Losses.
ok('a win loses at least one, however big the company', winLosses(20, 100000, 360) === 1 && resolve(100000, 60, times('swordsman', 20)).lost.length === 1);
ok('and never more than the company holds', winLosses(1, 1500, 1000) === 1 && winLosses(2, 1260, 1000) <= 2);
ok('a loss takes 60%: 6 of 10, 3 of 5, 2 of 3, 1 of 1', [10, 5, 3, 1].map((n) => resolve(100, 1000, times('warrior', n)).lost.length).join() === '6,3,2,1');
ok('the weakest fall first', (() => {
  const roster = ['swordsman', 'warrior', 'archer', 'swordsman', 'warrior'];
  const r = resolve(100, 1000, roster);   // a loss: 3 fall
  return r.lost.join() === 'archer,warrior,warrior';
})());
ok('survivors remove one entry per fallen unit', survivors(['swordsman', 'warrior', 'archer', 'warrior'], ['warrior', 'archer']).join() === 'swordsman,warrior');
ok('hungry soldiers count at 0.6', companyPower(times('swordsman', 10), null, 10) === 960 && companyPower(times('swordsman', 10), null, 5) === 1280 && companyPower(times('swordsman', 10), null, 0) === 1600);
ok('an empty company has no power', companyPower([]) === 0);

process.exit(f ? 1 : 0);
