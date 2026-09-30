import { readFileSync } from 'node:fs';
import { mirrored, turned, facingOf, doorBlock, doorPart, roofBlock, roofPart } from '../src/config/blocks.js';
import { SymmetryTool } from '../src/tools/SymmetryTool.js';

/**
 * The mirror tool turns what it copies. Requested directly: the symmetry
 * tool "mirrors stairs/doors/roof facing" — before this it copied them
 * as they were, so the mirrored half of a house had its stairs climbing and
 * its roof sloping the same way as the original rather than the opposite.
 *
 * Facing counts quarter-turns from -z: 0 is -z, 1 +x, 2 +z, 3 -x.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const STAIR = 29, STONE = 3;
const stair = (facing) => turned(STAIR, facing);

// Across x: +x and -x trade places; -z and +z stay.
ok('a stair climbing +x, mirrored across x, climbs -x', facingOf(mirrored(stair(1), { flipX: true })) === 3);
ok('and one climbing -x climbs +x', facingOf(mirrored(stair(3), { flipX: true })) === 1);
ok('one climbing along z is unchanged by a mirror across x',
  mirrored(stair(0), { flipX: true }) === stair(0) && mirrored(stair(2), { flipX: true }) === stair(2));

// Across z: -z and +z trade places.
ok('a stair climbing -z, mirrored across z, climbs +z', facingOf(mirrored(stair(0), { flipZ: true })) === 2);
ok('one climbing along x is unchanged by a mirror across z', mirrored(stair(1), { flipZ: true }) === stair(1));

// Both: a half turn.
ok('mirrored both ways it turns right round', [0, 1, 2, 3].every((d) => facingOf(mirrored(stair(d), { flipX: true, flipZ: true })) === ((d + 2) & 3)));
ok('mirroring twice puts it back', [0, 1, 2, 3].every((d) => mirrored(mirrored(stair(d), { flipX: true }), { flipX: true }) === stair(d)));

ok('a block that faces no way is its own reflection', mirrored(STONE, { flipX: true, flipZ: true }) === STONE);
ok('and nothing changes with no flip at all', mirrored(stair(1), {}) === stair(1));

{
  const door = doorBlock({ facing: 1 });
  const m = doorPart(mirrored(door, { flipX: true }));
  ok('a door is turned by the mirror too', m.facing === 3 && !m.top && !m.open);
  const roof = roofBlock({ mat: 1, kind: 'lo', facing: 0 });
  const r = roofPart(mirrored(roof, { flipZ: true }));
  ok('and a roof tile, keeping its material and kind', r.facing === 2 && r.mat === 1 && r.kind === 'lo');
}

{
  const tool = new SymmetryTool({ centreX: 10, centreZ: 10 });
  tool.modeIndex = 3; // both
  const pts = tool.reflect(12, 5, 13);
  ok('the tool says which way each copy was flipped',
    pts.length === 4
    && pts.some((p) => p.x === 12 && !p.flipX && !p.flipZ)
    && pts.some((p) => p.x === 7 && p.flipX && !p.flipZ)
    && pts.some((p) => p.z === 6 && !p.flipX && p.flipZ)
    && pts.some((p) => p.x === 7 && p.z === 6 && p.flipX && p.flipZ));
}

ok('placing turns each mirrored copy', /const next = mirrored\(held, t\);/.test(game));
ok("and a door's top half follows its own copy", /doorBlock\(\{ \.\.\.doorPart\(next\), top: true \}\)/.test(game));

process.exit(f ? 1 : 0);
