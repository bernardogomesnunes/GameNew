# Plan: stone working and wood working as chains of steps

Owner, 16 November: "Stone processing and wood processing are confusing. I would expect it to have items that go through a process to be made."

The plan gives each machine one job. An item is made at one machine. A hand recipe with a lower yield stays for Ages 1 and 2 only. This is a plan. No game code changes in this PR.

## 1. Today

| What is confusing | The numbers |
|---|---|
| The stone mill does everything | 33 recipes: it crushes gravel, cuts stone brick, shapes 13 walls, 3 pillars and 2 chimneys, and shapes 4 brick pieces |
| Every shaped stone piece exists twice | 24 workbench recipes have a stone mill copy that gives 50% more (wall: 4 at the workbench, 6 at the mill) |
| Brick has no fitting machine | The item says "Fired from earth in a kiln". The recipe is 3 dirt and 1 cobblestone at the workshop. The kiln building only gives 1 brick every 4 hours |
| Stone slabs have no machine | Made at the workbench only |
| Oak planks are made 4 ways | By hand (2 a log), planing bench (3), wood mill (3), workshop (4) |
| The planing bench planes oak only | White and dark planks come from the hand (2) or the wood mill (3) |
| Doors, fences and chests are made twice | Door: hand 4 planks, wood mill 3. Fence: workbench 2, joinery bench 3. Chest: hand 6 planks, joinery bench 4 |
| The bow is made at the planing bench | It is not planed |
| The Counter is a plain cube | A piece takes 3 to 8 saw cuts, then 3 to 8 drags. A part snaps only within 0.15 of a block |

## 2. The stone chain

Raw stone, then cut blocks, then shaped pieces. Clay goes to the fire.

| Step | Machine | Age | Job |
|---|---|---|---|
| 1. Cut and crush | Stone Mill (exists) | 3 | Turns raw rock into cut blocks, gravel and sand |
| 2. Shape | Mason's Bench (new: 6 stone, 4 planks) | 3 | Turns cut blocks into walls, slabs, stairs, pillars and roofs |
| 3. Fire | Kiln Oven (new block, placed inside a kiln) | 4 | Fires clay into brick and sand into glass |
| Colour | Wash Tub (the bleach bucket, renamed) and Forge | 3, 4 | Soaks or burns a colour into stone |

**Stone Mill**

| In | Out |
|---|---|
| 1 stone | 2 cobblestone |
| 4 stone | 6 stone brick |
| 4 sandstone | 6 sandstone brick |
| 1 stone or 1 cobblestone | 2 gravel |
| 1 gravel | 2 sand |
| 2 stone | 6 calçada |
| 1 stone, 1 dark stone | 6 dark calçada |

**Mason's Bench**

| In | Out |
|---|---|
| 3 of any of the 13 wall stones | 6 walls of that stone (marble and sky marble at Age 8) |
| 1 stone | 2 slabs, or 2 stairs, or 3 roof slates |
| 3 stone, 2 dark stone or 2 marble | 3 pillars (Age 4, marble Age 8) |
| 3 stone brick or 3 brick | 3 chimney blocks |
| 1 brick | 3 brick roof tiles |
| 2 calçada, 1 dark calçada | 5 wave calçada |
| 4 stone | 1 marble (polished) |

**Kiln Oven**

| In | Out |
|---|---|
| 1 clay | 2 brick |
| 2 sand | 1 glass |
| 2 clay | 1 vase |

Clay is 3 dirt washed by water, as today. So 3 dirt give 2 brick, the same as now. The kiln building keeps its 1 brick and 1 glass every 4 hours.

The Wash Tub makes white stone (2 for 2) and takes orange stone from the mill (4 stone and 1 clay give 4). The Forge keeps grey stone, dark stone and dark brick.

The three hand recipes that knock cobblestone, white stone and marble back to stone stay. They are the Age 1 route to tools.

## 3. The wood chain

Logs, then planks, then sawn or joined pieces, then furniture.

| Step | Machine | Age | Job |
|---|---|---|---|
| Colour | Wash Tub, Forge | 3 | White logs (2 for 2), dark logs (5 for 4), as today |
| 1. Plane | Planing Bench | 1 | Every plank: oak, white and dark |
| 2. Saw | Wood Mill | 3 | One board cut to a shape |
| 3. Join | Joinery Bench | 2 | Several boards made into one piece |
| 4. Build | Carpenter's Table (the Counter) | 1 | Furniture |

| Machine | In | Out |
|---|---|---|
| Planing Bench | 1 log of any wood | 3 planks of that wood, 4 on a clean stroke |
| Wood Mill | 1 log | 1 stripped log |
| Wood Mill | 2 planks | 3 stairs |
| Wood Mill | 1 plank | 3 slabs, or 3 curled trims |
| Joinery Bench | 3 planks | 1 door (3 woods) |
| Joinery Bench | 2 planks | 2 trapdoors, or 1 gate (3 woods) |
| Joinery Bench | 1 plank | 3 fences (3 woods) |
| Joinery Bench | 4 planks | 1 chest |
| Carpenter's Table | Today's cost (table 4 planks, chair 3, wardrobe 7) | The 25 furniture pieces |

By hand in Ages 1 and 2: 2 planks a log, door, trapdoor, slab, stairs, chest, bow. Each gives less than its machine.

**The Counter becomes a table.** The block is drawn as a table: a thick top on four legs, a saw hanging on its side. Its name becomes Carpenter's Table. Item id `counter` and block 530 stay.

**Planks to parts to furniture, on a phone:**

1. Pick a piece. Its pale outline stands on the table top.
2. One saw stroke cuts every part (hold Saw, let go in the window). Today it is one stroke per part, up to 8.
3. A piece has at most 4 parts (today 8). Matching parts count as one: the 4 legs of a table fit with one tap.
4. Tap a part and it flies to its place. Drag still works. The next part glows and its place lights up.
5. A dragged part snaps within 0.4 of a block (today 0.15). A miss sends it back to the row. Nothing is lost.
6. After the first one, "Make another" builds the same piece with one saw stroke and one tap.

A chair goes from 12 touches (6 cuts, 6 drags) to 5 at most the first time, and 2 after that.

## 4. The hands-on action at each machine

| Machine | Action | Reuses |
|---|---|---|
| Stone Mill | Hold Grind, let go in the window | The gauge (BenchWork), unchanged |
| Mason's Bench | Three chalk marks appear on the block. Tap each. The third tap finishes the batch. Nothing spoils | The chisel taps from the Counter |
| Kiln Oven | Load it. It fires alone, with a bar and the seconds left. Hold Draw, let go in the window | The crucible: load, melt, pour |
| Wash Tub, Forge | Hold Dip, hold Hammer | The gauge, unchanged |
| Planing Bench | Hold Plane. New: a let-go between 95% and 100% is a clean stroke and gives 4 planks | The gauge, plus the clean stroke |
| Wood Mill, Joinery Bench | Hold Saw, hold Join | The gauge, unchanged |
| Carpenter's Table | One saw stroke, then tap or drag to fit | The gauge and the counter drag. New: tap to fit |

Every action button sits at the bottom centre, 56 px tall, under the thumb. On a desktop Space holds, a click taps, and keys 1 to 4 pick a part.

Each close-up shows the chain in one line, for example "Stone > Stone Mill > Mason's Bench > Wall". The step the player is on is lit.

## 5. What moves, what goes, old worlds

| Change | Recipes |
|---|---|
| Go | 43: the 24 workbench stone copies, 6 workbench fences and gates, 9 wood mill planks, doors and trapdoors, 3 at the workshop (brick, glass, fine planks), 1 double stone brick |
| Move | 25: 22 shaping recipes from the mill to the Mason's Bench, marble to the Mason's Bench, orange stone to the Wash Tub, the bow to the hand |
| New | 8: white and dark planks at the planing bench, stone slab at the Mason's Bench, plank slab and trim at the wood mill, brick, glass and vase at the Kiln Oven |

Migration:

- No item id and no block id is removed. Every item in a bag or chest keeps working and can still be placed.
- Recipes live in config. A save does not store them, so removing one needs no save change.
- A station with work in progress on a removed recipe gives its inputs back on load.
- A Counter with a half-built piece keeps what was paid. Its parts go back to the row, because the part count changes from 8 to 4.
- Placed stone mills, wood mills, benches and Counters stay where they are. The Counter is drawn as a table from the first load.
- The Bleach Bucket keeps id `bleach_bucket`. Only its name changes.
- A world at Age 3 or later gets one Mason's Bench in the bag on first load, so no wall recipe is out of reach.
- Each PR searches quests, achievements and the recipe book for the recipe ids it removes.

## 6. Build order

Each PR is playable alone and updates `docs/TASKS.md`.

| PR | What | Touches |
|---|---|---|
| 1 | Planing Bench planes oak, white and dark from Age 1, with the clean stroke. Mill and workshop planks go. Bow to the hand | Config, 1 rule in BenchWork |
| 2 | Wood Mill saws, Joinery Bench joins. Doors and trapdoors move. Fences and gates leave the workbench | Config |
| 3 | Carpenter's Table: table shape, new name, one saw stroke, 4 parts, tap to fit, wider snap, "Make another" | Counter.js, CounterView.js, furnitureParts.js |
| 4 | Mason's Bench: block, item, recipe, chisel-tap close-up. Shaping moves there. The 24 workbench copies go. One bench given to old worlds | New block, BenchWork, config |
| 5 | Stone Mill trimmed to cut and crush. Wash Tub renamed, takes orange stone | Config |
| 6 | Kiln Oven: block, load, fire, draw. Brick, glass and vase leave the workshop | New block, reuses CrucibleView |
| 7 | The chain line in every close-up and in the recipe book | UI |

## 7. Open questions for the owner

1. Parts: do they stay on the table (this plan), or become bag items sawn at the Wood Mill (legs, boards) and carried to the table? Bag items add 6 items and one more trip.
   **Owner, 16 November:** "it depends, like planks to do slabs, yes, the saw we already have it, let's keep it simple, chisel exists too if needed. So would be nice to keep 2 3 max items to help craft stuff besides the placed block." Decided: furniture parts stay on the table, no new part items. Bag items are only real materials, like planks into slabs. A machine needs at most 2 or 3 things besides its placed block: the existing Carpentry Saw and Chisel, and the material itself. No new tools.
2. Hand recipes: do the Age 1 and 2 hand copies (planks, door, chest) stay for good, or disappear once the machine is placed?
3. The clean stroke: planing bench only, or every hold-and-release machine (1 extra per batch on a let-go between 95% and 100%)?
