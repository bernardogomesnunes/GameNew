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
- **Sounds** are tones made in code (`audio/Sound.js`), not recordings, and
  pitched too high.
- **People** are two boxes, a coat and a head. **Animals** are blocky and
  plain: a sheep has no wool and no eyes.

## 1. A showcase world, to judge every change by

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
