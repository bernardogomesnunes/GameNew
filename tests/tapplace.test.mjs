/**
 * Played on a phone, after trying a few other games: "I'd like to add place
 * to tap in the screen like the break ... place should be tap, break should
 * be a hold". A tap on the picture asks Game.tapAction what it is.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

/** A game with nothing going on, pointed at plain ground, that records which action a tap ran. */
const game = (over = {}) => {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    moving: null, manning: null, pendingClaim: null, pendingClaimColumn: null, pendingClear: null,
    pendingRoof: null, pendingTemplate: null, selectedItemId: null, did: [],
    raycast: () => ({ x: 0, y: 0, z: 0, block: 1 }),
    banditTarget: () => null, mobTarget: () => null, fireflyTarget: () => null,
    kingTarget: () => null, hermitTarget: () => null, guardianTarget: () => null, isAltar: () => false,
    primaryAction() { this.did.push('break'); }, secondaryAction() { this.did.push('place'); },
  }, over);
  return g;
};
const tap = (over) => { const g = game(over); const said = g.tapAction(); return `${said}/${g.did.join()}`; };

ok('holding a block, a tap places it', tap() === 'place/place');
ok('carrying something, a tap puts it down', tap({ moving: {} }) === 'place/place');
ok('at an animal, a tap strikes', tap({ mobTarget: () => ({}) }) === 'break/break');
ok('at a bandit, a tap strikes — even holding a block', tap({ banditTarget: () => ({}) }) === 'break/break');
ok('at fireflies, a tap catches them', tap({ fireflyTarget: () => ({}) }) === 'break/break');
ok('at the King, a tap speaks to him', tap({ kingTarget: () => ({}), selectedItemId: 'stone_sword' }) === 'place/place');
ok('holding a tool, a tap digs (nothing to put down)', tap({ selectedItemId: 'stone_pickaxe' }) === 'break/break');
ok('bare hands, a tap digs', tap({ selectedItemId: 'hands' }) === 'break/break');
ok('holding fruit, a tap eats it', tap({ selectedItemId: 'fruit' }) === 'break/break');
ok('an empty bucket fills', tap({ selectedItemId: 'bucket' }) === 'break/break');
ok('a full bucket pours', tap({ selectedItemId: 'bucket_water' }) === 'place/place');
ok('a queued tool takes the tap for its corner or stamp', tap({ pendingClaim: {} }) === 'break/break' && tap({ pendingTemplate: {} }) === 'break/break');
ok('manning a catapult, a tap throws', tap({ manning: {} }) === 'break/break');

const { readFileSync } = await import('node:fs');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('holding the picture still breaks, and keeps breaking',
  /holding = true;\s*this\.cb\.onBreakTap\(\);\s*this\.cb\.onBreakHold\?\.\(true\);/.test(ui));
ok('only a tap that dug carries on to finish the block', /if \(did !== 'break' \|\| !this\.cb\.isDigging\?\.\(\)\) return;/.test(ui));

process.exit(f ? 1 : 0);
