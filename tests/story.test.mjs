import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { INTRO, ENDINGS, ART, ART_W, ART_H, paint, endingFor } from '../src/ui/Story.js';

/**
 * The story in pictures (docs/plan-phase7-lore.md, 7j): "a short
 * illustrated intro on a new world — the Sky Kingdom glowing among its
 * fireflies, the Stone army at its chains, the fall, and the flight down
 * to the ground, arriving somewhere far from anywhere" — and "each path
 * has its own ending", illustrated too.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- what it tells -------------------------------------------------------------------------------

ok('the intro: the Sky Kingdom, the Stone army at its chains, the fall, waking far from anywhere',
  INTRO.map((s) => s.art).join() === 'sky,army,fall,arrival'
  && /fireflies/.test(INTRO[0].text) && /chains/.test(INTRO[1].text) && /fell/.test(INTRO[2].text) && /thirty-two blocks/.test(INTRO[3].text));
ok('an ending for each path: the white, the dark, and the dark by the chains', ['white', 'dark', 'yielded'].every((k) => ENDINGS[k]?.length >= 3));
ok('the white path\'s: the rounds held, the fireflies\' blessing', /Ten times/.test(ENDINGS.white[0].text) && /fireflies/.test(ENDINGS.white[1].text));
ok('the dark path\'s: the King fallen, Lord of the Sky', /Sky King is fallen/.test(ENDINGS.dark[0].text) && /Lord of the Sky/.test(ENDINGS.dark.at(-1).text));
ok('by the chains: it sank, and its King gave it up', /chains/.test(ENDINGS.yielded[0].text) && /gave up the island/.test(ENDINGS.yielded[1].text));
const scenes = [...INTRO, ...Object.values(ENDINGS).flat()];
ok('every page has a picture of its own, and words', scenes.every((s) => typeof ART[s.art] === 'function' && s.text.length > 40));

ok('no path, no ending yet', endingFor({ war: { stage: 'at war' } }) === null && endingFor(null) === null);
ok('the Ten Rounds won: the white ending', endingFor({ war: { stage: 'won' } }) === 'white');
ok('the Sky King struck down: the dark one', endingFor({ ring: 'black', skyFallen: true, skyWar: {} }) === 'dark');
ok('the island yielded to its chains: that one', endingFor({ ring: 'black', skyFallen: true, skyWar: { yielded: true } }) === 'yielded');

// --- the pictures ---------------------------------------------------------------------------------

{
  const bad = [];
  let fills = 0, outside = 0;
  for (const art of Object.keys(ART)) {
    const g = {
      calls: 0,
      set fillStyle(v) { if (!/^#[0-9a-f]{6}$/.test(v)) bad.push(`${art}: ${v}`); },
      set globalAlpha(v) { if (!(v >= 0 && v <= 1)) bad.push(`${art}: alpha ${v}`); },
      fillRect(x, y, w, h) {
        this.calls++;
        if ([x, y, w, h].some((n) => !Number.isFinite(n))) bad.push(`${art}: rect ${x},${y},${w},${h}`);
        if (x > ART_W || y > ART_H || x + w < 0 || y + h < 0) outside++;
      },
    };
    for (const t of [0, 1.7, 12.3, 95]) paint(g, art, t);
    fills += g.calls;
    if (g.calls < 200) bad.push(`${art}: only ${g.calls} strokes`);
  }
  ok(`each picture paints, frame after frame, in plain colours (${fills} strokes)`, bad.length === 0 || console.log(bad.slice(0, 5)));
  ok('mostly on the canvas', outside < fills * 0.05);
}

// --- in the game -----------------------------------------------------------------------------------

ok('a new Duilt world opens on the intro, and the welcome after it', /if \(mode === DUILT\) this\.ui\.story\.play\(INTRO, \{ onDone: welcome \}\);\s*else welcome\(\);/.test(game));
ok('not over the story: pointer lock waits for it', /requestPointerLock\(\) \{\s*\/\/[^\n]*\n\s*if \(this\.ui\.story\?\.open\) return;/.test(game));
ok('a path\'s end plays its ending, then what you built', /this\.bus\.on\('duilt:won', \(\) => \{\s*const which = endingFor\(this\.game\.duilt\);[\s\S]{0,120}this\.story\.play\(ENDINGS\[which\], \{ last: 'Continue', onDone: \(\) => this\.openPanel\('panel-finish'\) \}\);/.test(ui));
ok('the Ten Rounds won ends the white path there and then', /The dark army is broken[\s\S]{0,300}d\.endWhitePath\(\);/.test(game));
ok('pixel art, scaled up blocky', /\.story-art \{[\s\S]{0,200}image-rendering: pixelated/.test(css));

{
  const events = [];
  const bus = { emit: (e, d) => events.push([e, d]), on() {} };
  const g = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus });
  ok('the white path\'s end is told once', g.endWhitePath() && !g.endWhitePath() && g.finished
    && events.filter(([e, d]) => e === 'duilt:won' && d?.path === 'white').length === 1);
  const sandbox = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus, sandbox: true });
  ok('never in Creative', !sandbox.endWhitePath());
}

process.exit(f ? 1 : 0);
