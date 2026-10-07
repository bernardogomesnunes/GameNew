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
- **Bow and arrows** (asked for directly). Hemp grows wild on open grass, ripe; picked it gives fibre and seeds to plant on farmland. Its seed also turns up breaking turf. Fibre → string → bow and arrows, by hand from Age 1. Traders sell hemp seeds, fibre, string, bows and arrows. With the bow held, Break shoots: arrows fly fast, drop a little, hit animals and bandits for 5, and stick in blocks. PR #140.
- **#32 Wood mill.** A block you put down (Age 2); within a few blocks of it wood goes further: three planks to a log, doors, trapdoors and stairs for less. It also makes stripped logs (every wood, standing or lying), a cabinet, a wardrobe and a bedside table, and wall panels (plain, patterned, two-tone) that go flat on the face you point at. Place on it opens the bench on what's made there. PR #142.
- **#12 and #27** dropped (asked for directly).
- **#10 Villagers eat.** Once a game day each settler eats one food, the cheapest, from your storehouses first and your bag only after. Fed, they give their building its +50%; hungry, they don't, and a gentle note says to put food in a storehouse. Nobody leaves or starves; anyone hungry tries again every minute. PR #143.
- **#5 Buildings that read from a distance.** The ready-made designs no longer all wear the same gable. PR #145.
  - Pyramid (hipped) roofs: garrison (reads as a tower), granary, university.
  - A lean-to: the storehouse, low at the door, high at the back.
  - Small roofs: a tiled hood over the doors of the workshop, engineering centre, tavern and townhouse.
  - Chimneys stand two blocks clear of the roof now, in the new chimney blocks, smoking.
  - Towers: the university has a stone-brick tower with an open top and its own pyramid.
- **#17 Workshop, engineering centre and university redone.** Stone-brick plinths, open-trapdoor shutters at the windows, stone-brick stacks. The workshop has a log store under a lean-to on stone-brick wall piers; the engineering centre a walled yard with a crane. No brick on any of them (brick comes from the workshop). PR #145.
- **University moves to Age 3** (asked for directly), and the engineering centre with it, since it needs research done at the university. The university's two tables are made at the workshop, an Age 3 building, so in Age 2 it couldn't be built. PR #146.
- **#1 A backpack.** A Back slot in the gear row, between the boots and the ring. Leather backpack (hide and string, by hand, Age 1): +10 bag slots. Reinforced (the leather one with iron, Age 4): +20. Taking it off, or swapping to a smaller one, moves what's in its slots into the rest of the bag; if there isn't room it stays on and says how much to clear. Nothing is ever dropped. PR #147.
- **#13 Farms show their crops.** The seeds put into a farm come up on its bare farmland, taking turns cell by cell, and grow like any crop. When the farm pays out, what was ripe is cut and sown again. A crop taken out of the farm comes up out of its soil. You can plant and pick in a locked farm's soil by hand (only crops — its soil is still locked); what you plant there is yours and the farm leaves it alone. PR #148.
- **#29 Barracks train soldiers.** From the barracks pop-up you choose who to train, a soldier a bunk, paid up front from your bag. They join one at a time (about two and a half minutes each). PR #149.
  - **Warrior:** 3 food and a stone sword.
  - **Swordsman:** 4 food, an iron sword and an iron cuirass. Tougher, and hits harder.
  - **Archer:** 3 food, a bow and 20 arrows. Shoots from range instead of closing in.
  - **Catapult crew:** 5 food, a catapult and 10 stone. When the enemy comes within throw, they set a catapult up in front of the barracks and lob stones that hurt only the enemy. They pack it away once the enemy is gone.
  - A fallen soldier is gone; nobody replaces them for free any more. Soldiers from older saves come back as swordsmen.
  - The pop-up lists who's in training, in order, with a bar and time left for the first; a toast says when each one comes out (asked for directly). PR #150. The world stands still while a pop-up is open, except the barracks' own clock: with its pop-up open the bar moves and soldiers still come out. PR #153.
  - The HUD shows who's nearest out of training, beside the drinks: a bar, the time left, and how many more are in line; tap it for the whole line. PR #151.
  - Trained soldiers live in the town (asked for directly): counted on the people chip and eating their meal with everyone, from the storehouses then the bag. They sleep in the barracks, so they take no house from a settler. PR #151.
  - Soldiers who went without food hit at 60% and don't get their breath back until fed; the barracks pop-up says how many are hungry. PR #153.
- **Saved builds turn** (asked for directly). R, the tool panel, or Place on a phone turns a queued saved build a quarter at a time, stairs and doors facing round with it, and you see it where it would go before you put it down. PR #152.
- **Rounded paths fill their corners** (asked for directly) with the ground beside them, in that block's own texture. PR #152.
- **Bow: hold to draw, let go to shoot** (asked for directly), mouse or finger. The longer the draw (full at 0.9 s), the faster and harder the arrow; a twitch, tabbing away or pausing shoots nothing. A meter under the crosshair, a slight zoom and an arrow on the string while drawn. Arrows stuck in the world stay 60 s and go back in the bag when you walk over them. Arrows hit every unit of the dark army, rams and catapults included. PR #153.
- **Stone from what you dig** (played on: soft-blocked with no stone for a pickaxe). Under the soil the rock comes up as marble, white stone or cobblestone, none of them stone. At the bench, by hand from Age 1: 2 cobblestone, 1 white stone or 1 marble → 1 stone. PR #155.
- **Furniture in every wood** (asked for directly). Table, chair, cabinet, wardrobe, bedside table, plain and patterned panels in white and dark wood as well as oak, each made where the oak one is from that wood's planks, and counting as the oak piece for a building's needs. Accents (a cabinet's top, a panel's squares) are shades of the piece's own wood. PR #157.
- **Stone mill** (asked for directly: "a machine like wood mill to treat stone and make all the variations easier and cheaper and mill it for gravel too"). Made by hand at Age 2 (6 stone, 4 cobblestone, 4 planks), set down like the wood mill. Within reach of it, every block cut from stone — bricks, walls, stairs, roof tiles, pillars, chimneys, calçada — comes out half as much again for the same stone; and it grinds cobblestone or stone into gravel (1 → 2) and gravel into sand (1 → 2). Nothing it makes turns back into raw stone, and slabs aren't milled (two make a whole stone block), so it makes no stone from nothing. Gravel was only on the bare tops of the green mountains before. PR #164.
- **Gravel underground** (asked for directly: "Gravel should appear underground more often to be fair"). Pockets of it all through the rock at any depth, about 4 blocks in every 100 — the workshop, engineering centre and barracks designs all want some, and it was only on the bare tops of the green mountains. PR #165.
- **What buildings make goes to the storehouse first** (asked for directly: "we need the farms to produce their items to the storage if there's one. Or else I'll be full inventory every time I'm back"). Every building's output — farms, pens, quarry, the lot — fills the storehouses first (skipping any set to leave that item out) and comes to your bag only when there's no room. PR #166.
- **One tile per thing at the bench** (reported directly: "two trapdoors that look the same on bench"): where something is made both by hand and at a mill, standing at the mill shows only the mill's cheaper way, anywhere else only the hand's. PR #164.
- **Trains** (backlog batch 2, Age 5), first part. Rail, made at the engineering centre from iron and planks, joins up in a line, turns corners and climbs a step. A steam engine set on a run of rail, Place on it to climb into the cab and drive: forward and back (keys or stick), Sneak to get down. Up to five rail cars couple on behind and follow it round bends. It burns coal — one per 120 blocks driven, 64 in its bunker — dug from seams in the high peaks, brought up by a mine, or burned from wood at a foundry (4 wood → 1 coal, asked for directly; PR #162). Hit it to take the last car (then the engine, with its coal) back into your bag. PR #159. Each car carries 1,000 slots of goods — Place on a car to open it, a page of 200 at a time; a car with goods in it stays coupled until you empty it. PR #161. Still to do: people riding in the cars (with the living cities, so there is somewhere to take them).

## Priority 1 — blocks and placement

All done (see above).

## Priority 2 — the world looking alive

All done (see above).

## Priority 3 — systems


- **#9 Composting.**
  - A compost bin takes seeds and leaves and makes compost.
  - Compost on farmland or put into a farm speeds growth or raises yield.

## Suggested order

1. Priority 3, one system at a time.
