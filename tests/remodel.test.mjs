import { readFileSync } from 'node:fs';
import { OUTFITS, outfitOf } from '../src/config/outfits.js';
import { WANDERERS } from '../src/config/wanderers.js';

/**
 * The look revamp, section 5 (docs/plan-look-and-sound.md): animals rounder
 * and with more to them; people with faces, hands and boots, and outfits
 * that say who they are, with something in hand. Asked for directly: "we need
 * to improve the visuals, it's imperative".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const people = readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8');
const animals = readFileSync(new URL('../src/render/MobView.js', import.meta.url), 'utf8');

// People.
ok('everybody has a face: two eyes and a mouth', /put\(EYE_L,/.test(people) && /put\(EYE_R,/.test(people) && /put\(MOUTH,/.test(people));
ok('hands and boots, on the limbs they swing with', /onLimb\(HAND_L,/.test(people) && /onLimb\(BOOT_R,/.test(people));
ok('the small parts are one instanced mesh, not a draw call each', /new THREE\.InstancedMesh\(box\(1, 1, 1\), mat\(\), MAX \* SLOTS\)/.test(people));
ok('kings wear crowns and capes', ['king', 'sky_king'].every((k) => OUTFITS[k].hat === 'crown' && OUTFITS[k].cape));
ok('Stone guards in dark helms with visors, Sky guards with plumes',
  OUTFITS.guard.hat === 'helm' && OUTFITS.guard.visor && OUTFITS.sky_guard.plume && OUTFITS.royal_guard.plume);
ok('bandits in hoods, the hermit with a beard and a staff', OUTFITS.bandit.hat === 'hood' && OUTFITS.hermit.beard && OUTFITS.hermit.gear === 'staff');
ok('your soldiers carry swords, your archers bows', OUTFITS.soldier.gear === 'sword' && OUTFITS.archer.gear === 'bow');
ok('every kind of person out in the world has an outfit',
  Object.entries(WANDERERS).filter(([, w]) => !w.siege && !w.beast).every(([k]) => outfitOf({ kind: k })));
ok('a settler wears their own hair', outfitOf({ kind: undefined }) === null);
ok('what\'s in the hand swings with the arm', /if \(o\.gear === 'sword'\) \{\s*onLimb\(GEAR, limbArm\[1\], armTop, armR/.test(people));

// Animals.
ok('animals are rounder: a second box on the body and the head', /out\.push\(\[0, 0, 0, w \* 0\.86, h \* 1\.12, l \* 0\.9, spec\.colour, 0, false\]\)/.test(animals));
ok('eyes with whites', /EYE_WHITE, 0, true\]\)/.test(animals));
ok('sheep in lumpy wool, cows with patches and an udder, pigs with nostrils, chickens with wings',
  /WOOL_SHADE/.test(animals) && /PATCH, 0, false/.test(animals) && /0x8a4a48, 0, true/.test(animals) && /0xe8e2d6, 0, false\]\]/.test(animals));
ok('room for all of it', Number(animals.match(/const DETAIL_CAP = (\d+);/)[1]) >= 20);

process.exit(f ? 1 : 0);
