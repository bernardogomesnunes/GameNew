import { readFileSync } from 'node:fs';
import { Arrows, drawShot, ARROW_SPEED, ARROW_DAMAGE, FULL_DRAW_MS, MIN_DRAW_MS, PICKUP_REACH } from '../src/world/Arrows.js';
import { Defenders, blowOf, HUNGRY_STRENGTH } from '../src/world/Defenders.js';
import { World } from '../src/world/World.js';

/**
 * Asked for directly: "make sure I can pull the bow and just release the
 * arrow when I lift the click, both in desktop and mobile", and the gaps
 * left after the bow and the barracks: arrows to pick back up, hungry
 * soldiers, the barracks bar moving while you watch it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const game = src('Game.js'), ui = src('ui/UIManager.js'), hand = src('render/HandView.js'), duilt = src('ui/DuiltUI.js');

// --- how hard you drew it ------------------------------------------------------------------------

{
  const none = drawShot(0), half = drawShot(FULL_DRAW_MS / 2), full = drawShot(FULL_DRAW_MS), over = drawShot(FULL_DRAW_MS * 5);
  ok('a full draw flies at full speed and hits for full', full.power === 1 && full.speed === ARROW_SPEED && full.damage === ARROW_DAMAGE);
  ok('holding it longer adds nothing', over.power === 1 && over.speed === full.speed && over.damage === full.damage);
  ok(`half a draw is slower and softer (${half.speed.toFixed(1)} b/s, ${half.damage})`, half.speed < full.speed && half.damage < full.damage && half.damage >= 1);
  ok('even the weakest still flies and hits for something', none.speed > 0 && none.damage >= 1);
  ok('a twitch is too short to loose anything', MIN_DRAW_MS > 0 && MIN_DRAW_MS < FULL_DRAW_MS);
  ok('Game lets go under MIN_DRAW_MS without shooting', /held >= MIN_DRAW_MS/.test(game) || /held < MIN_DRAW_MS/.test(game));
}

// --- an arrow carries its own damage -------------------------------------------------------------

{
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  const hits = [];
  const arrows = new Arrows({ world: w, hitTest: () => ({ t: 0.01 }), onHit: (a) => hits.push(a.damage) });
  arrows.shoot({ x: 4, y: 4, z: 4 }, { x: 1, y: 0, z: 0 }, 10, 2);
  arrows.tick(0.05);
  ok('a soft shot hits soft', hits[0] === 2);
  ok('and Game uses what the arrow carries', /const damage = arrow\.damage \?\? ARROW_DAMAGE/.test(game));
}

// --- picking arrows back up ----------------------------------------------------------------------

{
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 0, z, 1);
  const arrows = new Arrows({ world: w });
  arrows.shoot({ x: 4, y: 3, z: 4 }, { x: 0, y: -1, z: 0 }, 10);
  for (let i = 0; i < 30; i++) arrows.tick(0.05);
  const stuck = arrows.list[0];
  ok('an arrow shot into the ground sticks there', stuck?.stuck === true);
  arrows.shoot({ x: 4, y: 6, z: 4 }, { x: 1, y: 0, z: 0 }, 1);
  ok('walk up far off: nothing picked up', arrows.collect({ x: stuck.x + PICKUP_REACH + 1, y: stuck.y, z: stuck.z }) === 0);
  ok('stand by it: picked up', arrows.collect({ x: stuck.x + 0.5, y: stuck.y + 0.5, z: stuck.z }) === 1);
  ok('one still flying is not taken out of the air', arrows.list.length === 1 && !arrows.list[0].stuck);
  ok('Game puts picked-up arrows back in the bag', /this\.arrows\.collect\(/.test(game) && /Picked up/.test(game));
}

// --- hold to draw, let go to shoot: mouse and touch ----------------------------------------------

ok('desktop: pressing the mouse with a bow starts the draw', /e\.button === 0 && this\.startDraw\(\)/.test(game));
ok('desktop: lifting the click looses it', /releaseDraw\(\{ cancel: /.test(game) && /mouseup/.test(game));
ok('phone: touching the look side with a bow starts the draw', /drawing = !!this\.cb\.onDrawStart\?\.\(\)/.test(ui));
ok('phone: lifting the finger looses it', /this\.cb\.onDrawEnd\?\.\(\)/.test(ui) && /onDrawStart: \(\) => this\.startDraw\(\),\s*onDrawEnd: \(\) => this\.releaseDraw\(\)/.test(game));
ok('pausing mid-draw lets it down, no shot', /if \(!playing && this\.drawing\) this\.releaseDraw\(\{ cancel: true \}\)/.test(game));
ok('you see how far it is drawn', /setDrawMeter\(/.test(ui) && /id="draw-meter"/.test(ui) && /setDrawMeter\?\.\(/.test(game));
ok('and the bow comes up with an arrow on the string', /draw = 0/.test(hand) && /draw: this\.drawing \? this\.drawPower\(\) : 0/.test(game));

// --- hungry soldiers -----------------------------------------------------------------------------

{
  ok(`hungry, a blow is ${HUNGRY_STRENGTH * 100}% as hard`, blowOf({ hungry: true }, 10) === Math.round(10 * HUNGRY_STRENGTH) && blowOf({ hungry: false }, 10) === 10);
  ok('but never nothing', blowOf({ hungry: true }, 1) === 1);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  const d = new Defenders({ world: w });
  const mk = (i) => ({ id: i, unit: 'swordsman', x: 4, y: 1, z: 4, post: { x: 4, z: 4 }, hp: 5, cooldown: 0, hurt: 0 });
  d.soldiers = [mk(1), mk(2), mk(3)];
  d.hungry = 2;
  d.tick(1, [], {});
  ok('as many as go without are marked hungry', d.soldiers.filter((s) => s.hungry).length === 2);
  ok('a hungry soldier doesn\'t get their breath back; a fed one does', d.soldiers[0].hp === 5 && d.soldiers[2].hp > 5);
  ok('Game tells the barracks how many went without', /d\.defenders\.hungry = Math\.min\(d\.settlers\.soldiersHungry/.test(game));
  ok('and the barracks says so', /are hungry/.test(duilt));
}

// --- the barracks bar moves while you watch it ---------------------------------------------------

ok('with the barracks open, its clock still runs', /watchingBarracks = !playing && .*'barracks'/.test(game) && /\(playing \|\| watchingBarracks\)/.test(game));
ok('and soldiers still come out of it', /if \(watchingBarracks\) this\.syncDefence\(\);/.test(game));

process.exit(f ? 1 : 0);
