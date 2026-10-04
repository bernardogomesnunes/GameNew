# Look, feel and sound — the revamp

Asked for after the Sky city landed: "the buildings look awesome", but the
game as a whole looks dull and old, the sounds are too high-pitched and
don't fit what they're for, and the people and animals need detail.
The buildings themselves stay as they are; what changes is how everything
is coloured, textured, lit and heard.

## Where it stands now

- **Block textures** are 16×16 grey patterns painted in code
  (`config/textures.js`, `render/BlockTextures.js`) and tinted with one
  colour per block. So a material is one hue with shading on it, and
  similar materials collapse together. In the Stone Kingdom, Dark Stone,
  Dark Brick, Obsidian and Dark Calçada all read as the same dark grey.
- **Nothing darkens where blocks meet**: there's no shadow in corners or
  under overhangs, and no edge contrast, so walls look flat.
- **Light** is a soft ambient (0.6) plus a sun (0.85) plus a sky/ground
  fill (0.4), with no tone mapping. Even, but flat and low in contrast.
- **Fog** is one plain colour fading towards the horizon.
- **Sounds** were tones made in code (`audio/Sound.js`), not recordings, and
  pitched too high.
- **People** are two boxes, a coat and a head. **Animals** are blocky and
  plain: a sheep has no wool and no eyes.

## 1. A showcase world, to judge every change by — done

**Done.** `world/showcase.js` lays it out; `Game.openShowcase()` builds it
(in the menu: *Show the workshop tools → Showcase*; in a dev build, from a
script, `window.__game.openShowcase()`). It's a Creative world from one
fixed seed (`SHOWCASE_SEED`), never saved, on a stretch of flattened grass:
every starter design and every place out in the world (hermit's hut,
bandit camp, ruin, forgotten temple, abandoned mine, monument) in labelled
rows, doors to the north; in a yard to the west, every animal and every
kind of person in groups of up to four, standing still (`still`: Mobs and
Wanderers leave them be) and turned to their camera — settlers, your
soldier, archer and warrior, the hermit, bandits, explorers, messengers,
Stone guards, soldiers, archers and King, the Warlord on his beast, the ram
and catapult, Sky guards, royal guard and Sky King, and both guardians.

Camera spots (`SHOWCASE_SPOTS`, `--list` prints them): `overview`, `row-N`
down each row, one per figure group (`animals-1`, `people-stone`, …),
`kingdom-gate`, `kingdom-street`, `kingdom-keep`, `kingdom-air`,
`sky-gate`, `sky-palace`, `sky-below`, `forest` — the `main` group — and
`b-<design>` close up on each building (the `buildings` group).
`game.showcaseSpot(id, { settle: true })` stands you there with everything
in sight made; `game.showcaseTime('day' | 'dusk' | 'night')` sets the hour,
and it holds.

The pictures, before and after a change:

    node tools/showcase-shots.mjs --out /tmp/shots/before            # every spot, day/dusk/night, 390×780
    node tools/showcase-shots.mjs --out /tmp/shots/after --group main --times day,dusk
    node tools/showcase-shots.mjs --out /tmp/shots/x --spots people-stone,b-starter_house

It starts its own Vite dev server (or `--url` one that's running), writes
`<spot>-<time>.png` and an `index.html` contact sheet. `--no-labels`,
`--hud` and `--hand` change what's in the frame. On SwiftShader a shot is
5–20 s, so the whole set is a while; `--group main` is the everyday one.

What it was asked to be:

- A Creative test world laid out for looking at:
  - the Stone Kingdom;
  - the Sky city;
  - every building template in rows;
  - every animal and kind of person standing in a line.
- Fixed camera spots, shot at phone size by day, at dusk and at night.
- Before and after screenshots for every change below, so texture, light,
  contrast and saturation are judged on a big sample of buildings rather
  than one wall.
- The templates get their own look where they need it (trim, detail,
  roofs) without changing what they are.

## 2. Colour and light

- **A fresher palette:** every block's colour revisited, more vibrant, less
  grey.
- **Similar materials told apart:**
  - Dark Stone a cool blue-grey;
  - Dark Brick a warm red-brown with darker mortar;
  - Obsidian a purple-black with a sheen;
  - Dark Calçada a true black.
  
  The castle stays as it is; only its materials change.
- **Shadow where blocks meet** (ambient occlusion): corners, under eaves,
  between a wall and the ground. This is the biggest single fix for "flat".
  - **Done** (`softshadow.test`): baked into the chunk mesh's vertex colours, so it costs nothing to draw; a chunk still builds in about 7 ms. "Soft shadows" in the graphics settings turns it off.
- **Light with contrast:** a warmer sun, cooler shade, tone mapping and a
  small saturation lift, and golden light at dawn and dusk.

## 3. Textures

- **32×32 instead of 16×16**: twice the detail across each block face.
- **Drawn from real photos**, the way the cobblestone was: stone, cobble,
  brick, planks, logs, bark, leaves, grass, dirt, sand, gravel, marble,
  sky marble, gold, dark stone, dark brick, slate and roof tiles, calçada,
  glass.
- **Colour inside the texture**, not one colour on a grey pattern: warm and
  cool flecks in stone, grain in wood, moss in the cracks of cobble.
- **Darker edges and joints**: mortar lines, bevels, plank seams.

## 4. Atmosphere

- Fog that lies low in valleys and over water at dawn, and thins by day.
- Mist round the floating island, and cloud below it.
- Light shafts through the trees and the clouds.
- Drifting motes: pollen by day, fireflies by night (already in for the
  white victory and the island).
- A richer sky: a deeper blue overhead, warm sunsets, stars.
- Everything heavy behind the graphics settings, so phones stay smooth.

## 5. Animals, people and items, remodelled

- **Animals:**
  - rounder, from more parts, with eyes on every one;
  - sheep in lumpy off-white wool with dark faces and ears;
  - cows with patches, horns and udders;
  - pigs with snouts;
  - chickens with combs and wattles.
- **People:**
  - **Faces:** eyes, brows and a mouth, with different skin tones, hair and beards.
  - **Bodies:** torso, arms with hands, and legs. They walk with arms and legs
    swinging, turn their heads to you, and swing when they strike.
  - **Outfits that say who they are:**
    - Stone guards in dark plate with a visor;
    - Sky guards in white and gold with plumes;
    - the Kings with crowns and capes;
    - bandits in hoods;
    - the hermit with a beard and staff;
    - settlers dressed for their job.
  - A weapon or tool in hand.
  
  One model serves everyone: settlers, guards, kings, bandits, soldiers and your army.
- **Items:** every held and placed item model reviewed for detail and colour.

## 6. Sound

- **Recordings, not tones:**
  - each material broken and placed (stone, wood, dirt, grass, sand, glass, metal);
  - footsteps on each;
  - swords, bows and blows;
  - doors and gates;
  - water and lava;
  - quieter, lower UI clicks.
- **Ambience by place and time:** wind, birds, crickets and owls at night,
  running water near rivers, high wind on the island, the hum of the
  Stone Kingdom.
- **Music:** calm and sparse, a little darker on the dark path.
- **Sliders:** master, effects, ambience and music separately.
- All from free-licensed (CC0) libraries, small and compressed.

### Done

**Where the sounds come from.** The plan was CC0 recordings, but no CC0
library could be reached from where this was built (Kenney, Freesound,
OpenGameArt, Pixabay, Wikimedia and the CDNs were all blocked; only the npm
registry answered, and nothing there had per-file CC0 material sounds).
So every sound is made in code, the way a foley artist would build it
rather than as tones: filtered noise bursts, damped resonant modes, showers
of tiny grains, falling low thumps, plucked strings, a stick-slip creak.
There are no audio files and no licences to track — nothing third-party is
in the game's sound. Recordings can still replace any recipe later: Sound.js
only plays buffers.

- `audio/synth.js` — the pieces, pure (sample arrays, seeded, no Web Audio),
  plus a spectral centroid to measure "too high" as a number.
- `audio/recipes.js` — every sound: eleven materials (stone, wood, dirt,
  grass, sand, gravel, snow, plants, cloth, glass, metal, plus water and
  lava), each placed, broken, dug at, walked on and landed on; blows, a
  sword's slash, a swing, being hurt, a bow, a war horn, a gong, a rumble,
  a boom, a catapult, chains, the lift; doors, gates and trapdoors opening
  and shutting, a chest; a splash, filling and pouring a bucket, lava's
  sizzle; eating and drinking; a low, quiet UI tick and an achievement
  chime. Then the ambience beds (wind, the island's gale, a stream, the sea,
  lava, the Stone Kingdom's hum, a cave) as seamless loops, the creatures
  (wood pigeon, cuckoo, blackbird, small birds, crickets, a tawny owl,
  frogs, cave drips) and three instruments (pluck, pad, bell).
- `audio/soundscape.js` — the decisions: what a block sounds like (by its
  glyph first: sand hisses, grass rustles, gold clangs — `material` in
  blocks.js is what a *tool* cuts, too coarse for hearing), which effect
  each action plays, ambience by place and hour, the music's moods, and
  bus gains from the sliders.
- `audio/listen.js` — twice a second, describes where you are (daylight,
  biome, water and lava nearby, the island, the Stone Kingdom, how deep
  underground, the dark path) and hears archers loosing near you.
- `audio/Sound.js` — plays it all: four takes of each effect rendered on
  first use (at 24 kHz) and kept, one picked at random with a nudge of
  speed; effects, ambience and music buses under a master with a soft
  limiter; at most 12 effects and 3 creature calls at once, one sound for
  a 40-block symmetry break; positional effects fade with distance and pan;
  beds fade over 1.6 s, start one per frame, stop after 20 s silent. Still
  starts only on the first tap or key, and in Node does nothing.

**Lower.** Measured with the old graph rendered through a real
OfflineAudioContext against the new buffers (spectral centroid):
placing stone 5.3 kHz → 1.3 kHz, breaking stone 4.8 → 1.1, wood 3.7 →
0.55, breaking dirt 3.2 → 0.45, a step on stone 5.2 → 1.1, on grass 3.6
→ 1.1, on sand 3.7 → 0.5. Leaves and glass are still the brightest
(2.5–2.9 kHz) because that is what they are, but half what they were.
The click went from an 880 Hz beep to a 380–480 Hz tick, a third quieter.

**Ambience.** By day: wind and birds, more birds in forests, more wind on
mountains and desert, waves by the ocean. At night: crickets and owls,
frogs in the wetland, the wind a little calmer. Near water a stream runs;
near lava it bubbles. The Stone Kingdom hums low and thins the birds; the
floating island has a high whistling gale instead of wind. Underground
the outside fades and a cave rumbles and drips. A menu open drops it back.

**Music.** A short phrase every 30–60 seconds, then silence: by day a
plucked D major pentatonic over a soft pad; at night a lower minor
pentatonic, slower; on the dark path (the Black Ring taken) lower still,
a bell on a scale with a half step in it over a low drone.

**Settings.** Controls & sound has Volume (the master; 0 is still Off)
and under it Effects, Ambience and Music, each remembered with the rest of
the controls. Sliders are squared on the way to a gain so their travel
feels even.

Tests: `tests/sound.test.mjs`.

## Suggested order

1. The showcase world, so everything after can be compared.
2. Colour, light and shadow where blocks meet: the biggest change for the least work.
3. Textures at 32×32 from photos.
4. Atmosphere.
5. Animals and people.
6. Items.
7. Sound (it's independent, so it can move earlier if it bothers you most).

Then back to the game plan: the rest of the dark path (disguise, cutting
the chains, the expedition, the island joining your land, taxes) and the
story (7j).
