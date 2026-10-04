import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { BARE_HANDS, isTool, toolEffectiveness } from '../src/config/items.js';
import { CRACK_STAGES, crackTile, crackPath } from '../src/render/CrackView.js';
import { LOGS, LEAVES, leafHeld, orphanLeaves } from '../src/world/leafDecay.js';

/**
 * Backlog batch 2, the last quick fixes: bare hands a bit slower, cracks
 * spreading over the block you dig, an empty hotbar slot that is bare
 * hands, and leaves that fall when their tree is gone.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

// --- bare hands ----------------------------------------------------------------

{
  const hands = Object.fromEntries([...game.match(/const BARE_HAND_MS = \{([^}]*)\}/)[1].matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], +m[2]]));
  const normal = +game.match(/const NORMAL_BREAK_MS = (\d+);/)[1];
  ok('by hand, everything is slower than a tool that is not wrong for it', Object.values(hands).every((ms) => ms > normal));
  ok('soft things least, stone most', hands.plant < hands.dirt && hands.dirt < hands.wood && hands.wood < hands.stone);
  ok('but still breakable — slower than the wrong tool is never the point', hands.stone <= +game.match(/const SLOW_BREAK_MS = (\d+);/)[1]);
  ok('anything that is not a tool digs by hand', /if \(!isTool\(this\.selectedItemId\)\) return \{ ms: BARE_HAND_MS\[material\]/.test(game));
  ok('bare hands is not a tool, and no tool table knows it', !isTool(BARE_HANDS) && toolEffectiveness(BARE_HANDS, 'stone') === 'normal');
}

// --- an empty slot is bare hands ------------------------------------------------

ok('an empty hotbar slot can be picked, and is bare hands',
  /if \(slot\.dataset\.hands\) \{ this\.selectHands\(Number\(slot\.dataset\.slot\)\); return; \}/.test(ui)
  && /selectHands\(i\) \{\s*this\.selectedItemId = BARE_HANDS;/.test(ui) && /data-name="Bare hands"/.test(ui));
ok('by number key too', /if \(slot\?\.dataset\.hands\) return void this\.selectHands\(n - 1\);/.test(ui));
ok('with nothing equipped at all, you are empty-handed', /if \(this\.selectedItemId !== BARE_HANDS\) this\.selectHands\(0\);/.test(ui));
ok('empty-handed, Place builds nothing', /placeBlock\(\) \{[\s\S]{0,120}if \(this\.selectedItemId === BARE_HANDS\) return;/.test(game));
ok('and nothing shows in your hand', /this\.selectedItemId === BARE_HANDS \? \{\}/.test(game));

// --- a tap digs until the block is through ------------------------------------------

ok('a tap keeps digging until its block breaks, then stops', /onBreakHold\?\.\(true, \{ once: true \}\)/.test(ui)
  && /if \(this\.breakOnce\) this\.setBreaking\(false\);/.test(game));

// --- cracks ----------------------------------------------------------------------

{
  const cracked = (k) => { const t = crackTile(k); let n = 0; for (let i = 3; i < t.length; i += 4) if (t[i]) n++; return n; };
  ok(`${CRACK_STAGES} stages, each more cracked than the last`, Array.from({ length: CRACK_STAGES - 1 }, (_, k) => cracked(k + 1) > cracked(k)).every(Boolean));
  ok('the first is a hairline, the last runs across the block', cracked(0) > 0 && cracked(0) < 10 && cracked(CRACK_STAGES - 1) > 30);
  ok('and the cracks stay on the tile', crackPath().every(([x, y]) => x >= 0 && y >= 0 && x < 16 && y < 16));
  ok('the dig remembers where and how long it takes', /this\.digTarget = \{ key, x: hit\.x, y: hit\.y, z: hit\.z, ms, startedAt/.test(game));
  ok('and the cracks follow it, only while you are at it',
    /updateCracks\(\) \{[\s\S]{0,300}now - d\.lastHitAt < CRACK_LINGER_MS[\s\S]{0,200}\(now - d\.startedAt\) \/ d\.ms/.test(game));
}

// --- leaves fall when their tree is gone ------------------------------------------------

{
  const w = new World({ sizeX: 16, sizeZ: 16, height: 24 });
  // A trunk four high, a crown round its top.
  for (let y = 1; y <= 4; y++) w.setBlock(8, y, 8, 4);
  const crown = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 4; y <= 6; y++) {
    if (dx === 0 && dz === 0 && y === 4) continue;
    w.setBlock(8 + dx, y, 8 + dz, 5); crown.push([8 + dx, y, 8 + dz]);
  }
  // A hedge someone planted, away from any tree.
  w.setBlock(1, 1, 1, 5); w.setBlock(2, 1, 1, 5);

  ok('with its trunk, the whole crown holds', crown.every(([x, y, z]) => leafHeld(w, x, y, z)));
  ok('cutting the bottom of the trunk leaves the rest holding it', (w.setBlock(8, 1, 8, 0), orphanLeaves(w, 8, 1, 8).length === 0));
  for (let y = 2; y <= 4; y++) w.setBlock(8, y, 8, 0);
  const fallen = orphanLeaves(w, 8, 4, 8);
  ok(`with the trunk gone, the crown has nothing (${fallen.length} of ${crown.length} leaves)`, fallen.length === crown.length);
  ok('a leaf hedge with no tree is never looked at', !fallen.some((l) => l.x < 4));
  ok('wood of any kind holds leaves of any kind', [4, 41, 43].every((id) => LOGS.has(id)) && [5, 42, 44].every((id) => LEAVES.has(id)));
  ok('the game looks when a trunk block goes', /if \(LOGS\.has\(c\.prev\) && !LOGS\.has\(c\.next\)\) this\.queueLeafDecay\(c\);/.test(game));
  ok('and each leaf goes on its own, checked again before it does',
    /tickLeafDecay\(\) \{[\s\S]{0,600}this\.woodPlacedAt > l\.queuedAt && leafHeld\(this\.world, l\.x, l\.y, l\.z\)\) continue;\s*this\.world\.setBlock\(l\.x, l\.y, l\.z, AIR\);/.test(game));
}

process.exit(f ? 1 : 0);
