import { readFileSync } from 'node:fs';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { BIOMES } from '../src/config/biomes.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import {
  TITLE_SEED, TITLE_SITE, TITLE_HERDS, ORBIT, titlePlaceBlocks, orbitPose, orbitHeight, messengerPath,
} from '../src/world/titleScene.js';

/**
 * Asked for directly: "When a player opens the game it should show a
 * beautiful generated landscape, with animals roaming around and messengers,
 * maybe one mine and a bandit hut showing."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { world } = generateEndlessWorld({ seed: TITLE_SEED });
const gen = world.gen;
const site = { ...TITLE_SITE, y: gen.heightAt(TITLE_SITE.x, TITLE_SITE.z) };

// --- the meadow -----------------------------------------------------------------
// TITLE_SITE is findTitleSite's answer written down (the search is a second
// or two of generator reads); these are the things it was chosen for.
ok('it is in the plains', BIOMES[gen.biomeIndexAt(site.x, site.z)]?.id === 'plains');
ok('on dry ground', !gen.waterLevelAt(site.x, site.z));
let grass = 0, n = 0;
for (let a = -20; a <= 20; a += 5) {
  for (let b = -20; b <= 20; b += 5) {
    n++;
    if (world.getBlock(site.x + a, gen.heightAt(site.x + a, site.z + b) - 1, site.z + b) === 1) grass++;
  }
}
ok(`grass underfoot, not sand (${grass}/${n})`, grass >= n * 0.6);

// --- a mine and a bandit camp ---------------------------------------------------
const { blocks, places } = titlePlaceBlocks(site, (x, z) => gen.heightAt(x, z));
ok('an old mine and a bandit camp are laid', places.map((p) => p.kind).sort().join() === 'camp,mine');
ok('both close enough to be in the picture', places.every((p) => Math.hypot(p.x - site.x, p.z - site.z) < ORBIT.radius - 8));
ok('and they come with their blocks', blocks.length > 300);

// --- animals, and who they are ------------------------------------------------
ok('herds of real animals graze it', TITLE_HERDS.every((h) => MOBS_BY_ID.has(h.type)) && TITLE_HERDS.reduce((s, h) => s + h.n, 0) >= 10);

// --- the camera -----------------------------------------------------------------
const topAt = (x, z) => { for (let y = world.height - 1; y > 0; y--) if (world.getBlock(x, y, z) !== 0) return y; return 0; };
const eyeY = orbitHeight(site, topAt);
ok('it flies over every treetop on its circle', eyeY >= site.y + ORBIT.height);
for (const t of [0, 60, 120, 180]) {
  const p = orbitPose(site, t, eyeY);
  // Its look direction (PlayerController: yaw 0 looks along -z).
  const dir = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
  const to = { x: site.x - p.eye.x, z: site.z - p.eye.z };
  const facing = (dir.x * to.x + dir.z * to.z) / Math.hypot(to.x, to.z);
  ok(`at ${t}s it looks in across the meadow, a little down`, facing > 0.95 && p.pitch < 0 && p.pitch > -0.8);
}
ok('it goes round', Math.hypot(orbitPose(site, 0).eye.x - orbitPose(site, 60).eye.x, orbitPose(site, 0).eye.z - orbitPose(site, 60).eye.z) > 10);

// --- messengers cross it ------------------------------------------------------
const m = messengerPath(site, 0), m2 = messengerPath(site, 1);
ok('a messenger walks in from one side and out past the other', Math.hypot(m.from.x - site.x, m.from.z - site.z) > ORBIT.radius
  && Math.hypot(m.to.x - m.from.x, m.to.z - m.from.z) > 2 * ORBIT.radius);
ok('the next comes another way', Math.hypot(m.from.x - m2.from.x, m.from.z - m2.from.z) > 20);

// --- wired in ---------------------------------------------------------------------
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const uim = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
ok('the game opens on it', /this\.openTitle\(\);\s*this\.renderer\.setAnimationLoop/.test(game));
ok('it keeps going behind the worlds screen', /if \(!playing && this\.title\) this\.tickTitle\(dt\);/.test(game));
ok('and comes back when you leave a world', /openHome\(\) \{\s*\/\/[^\n]*\n\s*this\.cb\.onGoHome\?\.\(\);/.test(uim) && /onGoHome: \(\) => this\.openTitle\(\)/.test(game));
ok('the clock holds still on it', /if \(\(playing \|\| watchingBarracks\) && !this\.showcase && !this\.title\) this\.dayCycle\.advance\(dt\);/.test(game));
ok('no game controls over it', /body\.at-home #hotbar-wrap/.test(css) && /toggle\('at-home', this\.panels\.isOpen\('blocker'\)\)/.test(uim));

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
