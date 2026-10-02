import { readFileSync } from 'node:fs';

/**
 * Reported: on a phone, opening a chest showed "What is this?" — the claim
 * panel. The strip by the crosshair said "Chest — tap Open", and tapping the
 * strip itself always opened a claim. Now tapping it does what it says.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('tapping the strip asks the game what it means', /else if \(this\.cb\.onHintTap\) this\.cb\.onHintTap\(\);/.test(ui));
ok('at a chest, door, gate, trapdoor, catapult or painting: what Place does', /this\.hintUses = !!swing && !onBuilding;/.test(game)
  && /onHintTap: \(\) => \(this\.hintUses \? this\.secondaryAction\(\) : this\.openClaim\(\)\)/.test(game));
ok('anywhere else, the claim panel as before', /this\.hintUses \? this\.secondaryAction\(\) : this\.openClaim\(\)/.test(game));
ok('and it never carries over from the last thing you looked at', /this\.hoverHit = hit;\s*this\.hintUses = false;/.test(game));
ok('the chest is one of them', /const swing = \(gate \|\| door \|\| chest \|\| catapult \|\| trapdoor \|\| painting\b/.test(game));

process.exit(f ? 1 : 0);
