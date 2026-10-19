import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { BLOCKS } from '../src/config/blocks.js';

/**
 * Reported directly: "Clicking on a market man does not open the menu to
 * trade". A tap went where the crosshair was — the floor, the stall — not to
 * the trader under the finger; and a rug, a lantern or hanging vines in front
 * of a trader counted as a wall.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

// --- what's in the way --------------------------------------------------------------
const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
const g = { world };
const inTheWay = (block, eyeY, aimY) => {
  world.setBlock(5, 4, 5, block);
  // From x = 8 towards a trader standing at x = 3.5, past the block at x = 5.
  const eye = new THREE.Vector3(8.5, eyeY, 5.5), to = new THREE.Vector3(3.5, aimY, 5.5);
  const dir = to.clone().sub(eye).normalize();
  return Game.prototype.inTheWay.call(g, { x: 5, y: 4, z: 5 }, eye, dir, eye.distanceTo(to));
};
ok('a wall hides them', inTheWay(1, 5.6, 4.6));
ok('a rug does not', !inTheWay(35, 5.6, 4.2));
ok('nor vines hanging in front', !inTheWay(PROP('vines'), 5.6, 4.6));
ok('a lantern hides only its own low half', !inTheWay(26, 5.6, 5.0) && inTheWay(26, 4.2, 4.2));

function PROP(shape) {
  return BLOCKS.find((b) => b.shape === shape).id;
}

// --- a tap aims at the finger ------------------------------------------------------
{
  const player = { eyePosition: () => 'eye', lookDirection: () => 'look' };
  const own = player.eyePosition;
  const seen = Game.prototype.aimedAlong.call({ player }, { eye: new THREE.Vector3(1, 2, 3), dir: new THREE.Vector3(0, 0, -1) },
    () => [player.eyePosition().x, player.lookDirection().z]);
  ok('aimed along the finger, everything reads its line', seen[0] === 1 && seen[1] === -1);
  ok('and after, your own eyes again', player.eyePosition === own && player.eyePosition() === 'eye');
}
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('a tap hands on where the finger was', /else if \(!moved && e\.type === 'touchend'\) tap\(start\);/.test(ui) && /onTap: \(at\) => this\.tapAction\(at\)/.test(game));
ok('someone under the finger is who it acts on: the King, the hermit, a trader, anyone who talks',
  /return this\.kingTarget\(hit\) \|\| this\.hermitTarget\(hit\) \|\| this\.traderTarget\(hit\) \|\| this\.talkTarget\(hit\);\s*\}\);\s*if \(someone\) return this\.aimedAlong\(ray, places\);/.test(game));
ok('traders and talkers only hidden by what you would bump into',
  (game.match(/if \(hit && this\.inTheWay\(hit, eye, dir, (found|best)\.t\)\) return null;/g) ?? []).length === 2);

process.exit(f ? 1 : 0);
