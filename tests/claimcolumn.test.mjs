import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { pickBuild, wallFootprintAt } from '../src/tools/PointerPick.js';

/**
 * Reported as: "I point, click designs, and save, nothing happens... so I
 * can't claim what I framed." Traced to pickBuild (what "Claim what I
 * framed" and the Designs "Save" button both used to find your build):
 * every block it walks has to sit *above* the terrain's own recorded
 * surface height. That's fine for the middle of a wall, and wrong for its
 * lowest course — which is exactly where a wall starts, because that's
 * where the ground is when you build it. Point at that course and pickBuild
 * silently returned null, no matter how much of a real building was right
 * there.
 *
 * wallFootprintAt (PointerPick.js) fixes it: same connected walk as
 * pickBuild, same surface-height check on every other block (so it still
 * can't leak sideways through untouched terrain), but the block you actually
 * clicked no longer has to clear that bar itself. See Game.js's
 * beginClaimColumn for the new one-point, scroll-for-height claim tool built
 * on it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 7 });
const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
d.inventory.add('wood', 200);

// A wall built the way a player actually builds one: standing on the
// ground, four courses up from your feet — not floating one block above
// the recorded terrain height.
const x0 = origin.minX + 2, x1 = origin.minX + 7, z0 = origin.minZ + 2, z1 = origin.minZ + 7;
const changes = [];
for (let x = x0; x <= x1; x++) {
  for (let z = z0; z <= z1; z++) {
    if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue; // walls only
    const base = world.surfaceHeight(x, z);
    for (let dy = 0; dy < 5; dy++) changes.push({ x, y: base + dy, z, prev: 0, next: 4 });
  }
}
// A roof, so this is an actual claimable house (sheltered volume, not just
// four walls) rather than a scenario the claim is *supposed* to refuse.
const roofY = Math.max(...changes.map((c) => c.y)) + 1;
for (let x = x0; x <= x1; x++) {
  for (let z = z0; z <= z1; z++) changes.push({ x, y: roofY, z, prev: 0, next: 4 });
}
for (const c of changes) world.setBlock(c.x, c.y, c.z, c.next);

const baseBlock = changes.find((c) => c.x === x0 && c.z === (z0 + z1) >> 1 && c.y === world.surfaceHeight(x0, (z0 + z1) >> 1));
const oldPick = pickBuild(world, baseBlock);
ok('reproduces the reported bug: the old flood fill finds nothing at the base of a real wall',
  oldPick === null);

const footprint = wallFootprintAt(world, baseBlock);
ok('the new footprint finder does not need the block to be "above" anything',
  !!footprint);
ok('and gets the wall\'s actual footprint',
  footprint.minX === x0 && footprint.maxX === x1 && footprint.minZ === z0 && footprint.maxZ === z1);

const region = { ...footprint, minY: baseBlock.y, maxY: roofY };
const claimed = d.claim(region, 'house');
ok(`and a claim built on it actually succeeds${claimed.ok ? '' : ` (${claimed.reason})`}`, claimed.ok);

// The same fix applies a couple of courses up the same wall, which the old
// path also happened to get right — so this isn't a regression there.
const higherBlock = { ...baseBlock, y: baseBlock.y + 2 };
const higherFootprint = wallFootprintAt(world, higherBlock);
ok('still works higher up the same wall', !!higherFootprint
  && higherFootprint.minX === footprint.minX && higherFootprint.maxX === footprint.maxX);

// --- wired into Game.js as a real tool, not just a helper function --------

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('beginClaimColumn arms the tool with a default height',
  /beginClaimColumn\(\)[\s\S]{0,400}pendingClaimColumn = \{ height: CLAIM_COLUMN_DEFAULT_HEIGHT \}/.test(game));
ok('the height always grows upward from the block you pointed at, never down',
  /maxY: hit\.y \+ (?:height|this\.pendingClaimColumn\.height) - 1/.test(game));
ok('scrolling while it is armed changes height instead of the hotbar',
  /if \(this\.pendingClaimColumn\) return void this\.adjustClaimColumnHeight/.test(game));
ok('height is clamped, not unbounded',
  /Math\.max\(CLAIM_COLUMN_MIN_HEIGHT, Math\.min\(CLAIM_COLUMN_MAX_HEIGHT, h\)\)/.test(game));
ok('Break confirms it and hands off to the same type-picker as the other claim tool',
  /confirmClaimColumn\(\)[\s\S]{0,600}this\.ui\.openClaim\(region/.test(game));
ok('the Buildings panel offers it as its own button',
  /id="btn-claim-column"/.test(duiltUi) && /beginClaimColumn\(\)/.test(duiltUi));
ok('the old per-type "Claim what I framed" button is gone, not just broken quietly',
  !duiltUi.includes('data-claim-here'));

process.exit(f ? 1 : 0);
