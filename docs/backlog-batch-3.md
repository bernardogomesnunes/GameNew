# Backlog — batch 3 ("Quick improvements")

The user's third list, planned and sorted. Each line keeps the original
point's number (#n, in the order it was written) so it can be traced back.
**Done** items say which PR shipped them.

## Done already

- **#18 Most of the ground is sand.** Beaches only by the sea; birch woods are grass. PR #127.
- **#3 Picked-up blocks go into a free equipped slot.** If what you pick up is only in the bag and an equipped slot is free, its stack moves up into that slot. PR #130.
- **#4 Tool wear.**
  - Durability bar on the hotbar: green, then amber, then red. The bag already had one. PR #130.
  - The pickaxe "coming back new" was most likely two save bugs, both fixed:
    - Leave uploaded the title scene instead of your world (PR #124).
    - After five minutes, the autosave fired every frame (PR #129).
  - Watch for it happening again.
- **#11 Getting out of water.** A swimmer climbs onto a bank level with the water, but not one a block above it. PR #130.
- **#20 Stone is lighter**, close to cobblestone; its slab, stairs and wall match. PR #130.
- **#21 Logs.** PR #130.
  - No round knots, shallower bark, lighter wood.
  - Birch marks are one pixel and grey, not thick and black.
- **#28 Water.** PR #130.
  - Pointing at water, a block goes into it, so ponds can be filled in.
  - A bucket clears a lone water block; water joined to other water stays.
- **#31 Clouds** drift smoothly, never jumping as you move, and are slightly see-through. PR #131.
- **#30 Fireflies** each fly their own wandering closed loop, back exactly to where they started, at their own pace. PR #131.
- **#22 Campfire flames that move.** Three flame tongues that sway and flicker; the fire's light flickers with them. PR #132.
- **#7 Dirt turns to turf.** Open-topped dirt next to turf becomes turf after a random 5 to 50 game days, also while you're away. Not inside buildings. PR #132.
- **#16 Logs in three directions.** Placed against a side, a log lies along x or z. PR #132.
- **#15 Trapdoors on the face you point at.** On a floor it lies low, under a ceiling it sits high, against a wall it stands open. PR #132.
- **#14 Turn a building while moving it.** R on desktop; on a phone, tap the hint. PR #132.
- **Room for more blocks.** Block ids go past 255 now (up to 4096). PR #133.
- **#24–26 Every wood its own set.** White (birch) and dark wood each get planks, fence, gate, door and trapdoor, made like oak's. They count as oak's for what buildings need. PR #134.
- **#23 Walls for every stone.** Seven more: dark brick, marble, sky marble, white, dark grey, turquoise and orange stone. Sandstone comes with #33. PR #134.
- **#6 Slabs.** A slab goes in the top or bottom half of a block, by where you point. A slab on the open half of one of its kind makes the full block, for the one slab. PR #135.
- **#19 Chimneys.** New Stone Brick block (and its wall), and chimneys in stone brick and brick. They stack into one flue with a lip on top, and smoke rises from the top one. PR #136.
- **#33 Desert blocks.** Sandstone lies three blocks under desert sand and breaks through it in outcrops. Sandstone Brick, a Sandstone Wall, and a Sand Path that sits a sixteenth low and rounds its corners where it stops. PR #137.
- **#8 Grass tufts.** Little crossed blades on the turf round you, one batch, swaying, shrinking away at the edge of their reach. A switch in graphics settings. PR #139.
- **Stone slabs looked plain.** Stone and plank slabs and stairs are drawn in their block's texture. PR #138.

## Needs a decision first

- **#12 Day length 30 min, and sleeping.**
  - A day is 15 min now (10 min daylight, nights at double speed).
  - Buildings count production per game day, so a 30-min day halves what they make per real hour unless production is doubled to match. **Which do you want?**
  - Sleeping: use a bed at night. The night passes in about 30 s behind a pixel-art screen with game tips.
- **#27 "Top level granary".** Not sure what this means:
  - a new top level for the granary,
  - or the granary's top level not working?

## Priority 1 — blocks and placement

All done (see above).

## Next — asked for directly

- **Bow and arrows.** Hemp grows in the wild; picking it gives fibre and seeds, and the seeds can be planted for more. Now and then a seed turns up while breaking turf. Fibre is spun into string, string goes into a bow and into arrows. Traders sell hemp, fibre and string.

## Priority 2 — the world looking alive

- **#5 Building designs that read from a distance.** Each building type gets its own silhouette: small roofs, pyramid roofs, chimneys, towers.
- **#17 Workshop, engineering centre and university** redone with the new walls, trapdoors and chimneys.

## Priority 3 — systems

- **#1 A backpack.**
  - Crafted, worn in the boots/ring row (or its own slot).
  - Adds bag slots: e.g. +10 leather, +20 reinforced.
- **#9 Composting.**
  - A compost bin takes seeds and leaves and makes compost.
  - Compost on farmland or put into a farm speeds growth or raises yield.
- **#10 Villagers eat.** Settlers take a little food from your storehouses each day. Fed: they work better. Hungry: a gentle warning, nothing harsh.
- **#13 Farms show their crops.**
  - A farm's crops grow visibly on its farmland, the same as ones you plant yourself.
  - You can plant in the farm's tilled soil by hand.
- **#29 Barracks train soldiers.**
  - Archers, warriors, swordsmen, and a catapult crew who set one up and fire it in a war.
  - Each costs food and gear.
- **#32 Wood mill and furniture.** The wood mill is the first "machine": a placeable block you use.
  - It turns logs into planks, stairs, doors and trapdoors for less wood.
  - It makes stripped logs.
  - It makes a full furniture set: cabinets, wardrobes, bedside tables.
  - It makes wooden wall panels you put on one face of a block for interiors, in plain, patterned and two-tone wood.

## Suggested order

1. The decisions above (#12, #27).
2. Bow and arrows, then the rest of Priority 2.
3. Priority 3, one system at a time: wood mill first, as it feeds furniture and the per-wood sets.
