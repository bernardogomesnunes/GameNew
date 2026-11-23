# PLAY-11: crafting review and the Factory

Owner's note, `docs/TASKS.md` PLAY-11: "Some items can be crafted two ways. List every duplicate and keep one way. After the first ending (dark or light warriors), a factory building with many machines automates all crafting and only needs materials."

Summary. 29 items are made by more than one recipe. 3 recipes go: the workbench Stone Slab, the workshop Workbench and the workshop glass Lantern. 2 pairs are the owner's call: the White and Black Ring, forged at the temple and at the forge. The other 24 stay, each with its reason. The Factory is a claimed building from Age 10, open once a world has an ending. It runs one recipe per machine kind placed inside it, takes the inputs from your storehouses and makes up to 12 of an item a day per line.

This is a design. No game code changes on this branch. `tools/recipe-duplicates.mjs` is new: it prints the tables below.

## The rule this review uses

The owner settled hand copies on 16 November (`docs/plan-crafting-processes.md` §7, question 2): "no, it should be less expensive in these machines." So a hand recipe of Ages 1 and 2 stays next to its machine recipe, and the machine always costs less for the same thing. A duplicate is removed when:

1. two recipes take the same inputs for the same output (no machine is cheaper), or
2. the second recipe costs more than the first for the same item at a later age.

Variants stay. A variant is the same item from different inputs: three metals for coins, ten seeds for compost, four fibres for string, an ingot back out of its block.

## The script

`node tools/recipe-duplicates.mjs` imports `src/config/recipes.js`, `src/config/structures.js` and `src/config/crops.js` and prints three tables. Run on `origin/main` at `f5628c3`.

"By hand" in table 2 means station `hand` or `workbench`: IMP-19 moves every hand recipe past Age 2 to the placed Workbench (`MENU_MAX_AGE`, `recipes.js:1766`). Table 3 lists the first level and the top level of each building; the 41 University studies have no output item and are left out.

### Script output

Recipes: 335. Output items: 250. Recipes with no output item (studies): 41.
Items made by more than one recipe: 29.

#### 1. Items made by more than one recipe

| # | item | recipe | station | age | inputs | out |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `stone` | `stone_from_cobblestone` | hand | 1 | cobblestone 2 | 1 |
|  |  | `stone_from_white` | hand | 1 | stone_white 1 | 1 |
|  |  | `stone_from_marble` | hand | 1 | marble 1 | 1 |
| 2 | `bucket` | `bucket` | hand | 1 | wood 4 | 1 |
|  |  | `empty_bucket` | hand | 1 | bucket_water 1 | 1 |
| 3 | `planks` | `planks` | hand | 1 | wood 1 | 2 |
|  |  | `bench_planks` | planing_bench | 1 | wood 1 | 3 |
| 4 | `iron_ingot` | `smelt_iron` | crucible | 5 | iron_ore 2 | 1 |
|  |  | `iron_from_block` | workbench | 5 | iron_block 1 | 4 |
| 5 | `gold` | `smelt_gold` | crucible | 5 | gold_ore 3 | 1 |
|  |  | `gold_from_block` | workbench | 5 | gold_block 1 | 4 |
| 6 | `coin` | `strike_coins` | crucible | 5 | gold 1 | 10 |
|  |  | `strike_copper_coins` | crucible | 5 | copper_ingot 1 | 3 |
|  |  | `strike_ruby_coins` | crucible | 10 | ruby 1 | 25 |
| 7 | `slab_plank` | `slab_plank` | hand | 1 | planks 1 | 2 |
|  |  | `mill_slab_plank` | wood_mill | 3 | planks 1 | 3 |
| 8 | `stairs_plank` | `stairs_plank` | hand | 1 | planks 1 | 1 |
|  |  | `mill_stairs_plank` | wood_mill | 3 | planks 2 | 3 |
| 9 | `chest` | `chest` | hand | 1 | planks 6 | 1 |
|  |  | `joinery_chest` | joinery_bench | 2 | planks 4 | 1 |
| 10 | `door` | `door` | hand | 1 | planks 4 | 1 |
|  |  | `joinery_door` | joinery_bench | 2 | planks 3 | 1 |
| 11 | `white_planks` | `white_planks` | hand | 1 | white_wood 1 | 2 |
|  |  | `bench_planks_white` | planing_bench | 1 | white_wood 1 | 3 |
| 12 | `door_white` | `door_white` | hand | 1 | white_planks 4 | 1 |
|  |  | `joinery_door_white` | joinery_bench | 2 | white_planks 3 | 1 |
| 13 | `trapdoor_white` | `trapdoor_white` | hand | 1 | white_planks 3 | 2 |
|  |  | `joinery_trapdoor_white` | joinery_bench | 2 | white_planks 2 | 2 |
| 14 | `dark_planks` | `dark_planks` | hand | 1 | dark_wood 1 | 2 |
|  |  | `bench_planks_dark` | planing_bench | 1 | dark_wood 1 | 3 |
| 15 | `door_dark` | `door_dark` | hand | 1 | dark_planks 4 | 1 |
|  |  | `joinery_door_dark` | joinery_bench | 2 | dark_planks 3 | 1 |
| 16 | `trapdoor_dark` | `trapdoor_dark` | hand | 1 | dark_planks 3 | 2 |
|  |  | `joinery_trapdoor_dark` | joinery_bench | 2 | dark_planks 2 | 2 |
| 17 | `string` | `string` | hand | 1 | hemp_fibre 3 | 1 |
|  |  | `string_spun` | spinning_wheel | 1 | hemp_fibre 3 | 2 |
|  |  | `string_wool` | spinning_wheel | 1 | wool 1 | 1 |
|  |  | `string_cotton` | spinning_wheel | 1 | cotton 1 | 1 |
| 18 | `gravel` | `mill_gravel` | stone_mill | 3 | cobblestone 1 | 2 |
|  |  | `mill_gravel_stone` | stone_mill | 3 | stone 1 | 2 |
| 19 | `slab_stone` | `slab_stone` | workbench | 3 | stone 1 | 2 |
|  |  | `mason_slab_stone` | masons_bench | 3 | stone 1 | 2 |
| 20 | `roof_stone` | `roof_stone` | hand | 1 | stone 1 | 2 |
|  |  | `mason_roof_stone` | masons_bench | 3 | stone 1 | 3 |
| 21 | `trim_curl` | `trim_curl` | hand | 1 | planks 1 | 2 |
|  |  | `mill_trim_curl` | wood_mill | 3 | planks 1 | 3 |
| 22 | `lantern` | `lantern` | workshop | 4 | planks 2, glass 1 | 1 |
|  |  | `lantern_workbench` | hand | 1 | planks 2, stone 2 | 1 |
| 23 | `trapdoor` | `trapdoor` | hand | 1 | planks 3 | 2 |
|  |  | `joinery_trapdoor` | joinery_bench | 2 | planks 2 | 2 |
| 24 | `vase` | `vase` | workbench | 3 | clay 2 | 1 |
|  |  | `kiln_vase` | kiln_oven | 4 | clay 1 | 1 |
| 25 | `compost` | `compost_carrot` | compost | 2 | leaves 4, seeds_carrot 1 | 1 |
|  |  | `compost_potato` | compost | 2 | leaves 4, seeds_potato 1 | 1 |
|  |  | `compost_cabbage` | compost | 2 | leaves 4, seeds_cabbage 1 | 1 |
|  |  | `compost_lettuce` | compost | 2 | leaves 4, seeds_lettuce 1 | 1 |
|  |  | `compost_pepper` | compost | 2 | leaves 4, seeds_pepper 1 | 1 |
|  |  | `compost_zucchini` | compost | 2 | leaves 4, seeds_zucchini 1 | 1 |
|  |  | `compost_broccoli` | compost | 2 | leaves 4, seeds_broccoli 1 | 1 |
|  |  | `compost_coffee` | compost | 2 | leaves 4, seeds_coffee 1 | 1 |
|  |  | `compost_hemp` | compost | 2 | leaves 4, seeds_hemp 1 | 1 |
|  |  | `compost_cotton` | compost | 2 | leaves 4, seeds_cotton 1 | 1 |
| 26 | `devotion` | `offer_fruit` | temple | 4 | fruit 6 | 1 |
|  |  | `offer_harvest` | temple | 4 | vegetables 4 | 1 |
|  |  | `offer_meat` | temple | 4 | cooked_meat 2 | 1 |
|  |  | `offer_gold` | temple | 4 | gold 1 | 2 |
|  |  | `offer_candle` | temple | 4 | lantern 1 | 1 |
| 27 | `ring_white` | `ring_white` | temple | 4 | sunstone 3, gold 4, devotion 12 | 1 |
|  |  | `ring_white_forge` | forge | 4 | sunstone 3, gold 4, devotion 12 | 1 |
| 28 | `ring_black` | `ring_black` | temple | 4 | nightstone 3, obsidian 4, devotion 12 | 1 |
|  |  | `ring_black_forge` | forge | 4 | nightstone 3, obsidian 4, devotion 12 | 1 |
| 29 | `workbench` | `workbench` | hand | 1 | planks 8, wood 2, stone 2 | 1 |
|  |  | `workshop_workbench` | workshop | 4 | planks 8, wood 2, stone 2 | 1 |

#### 2. Items made both by hand (hand or workbench) and at a station

| item | by hand | at a station |
| --- | --- | --- |
| `planks` | `planks` (hand, age 1: wood 1 > 2) | `bench_planks` (planing_bench, age 1: wood 1 > 3) |
| `iron_ingot` | `iron_from_block` (workbench, age 5: iron_block 1 > 4) | `smelt_iron` (crucible, age 5: iron_ore 2 > 1) |
| `gold` | `gold_from_block` (workbench, age 5: gold_block 1 > 4) | `smelt_gold` (crucible, age 5: gold_ore 3 > 1) |
| `slab_plank` | `slab_plank` (hand, age 1: planks 1 > 2) | `mill_slab_plank` (wood_mill, age 3: planks 1 > 3) |
| `stairs_plank` | `stairs_plank` (hand, age 1: planks 1 > 1) | `mill_stairs_plank` (wood_mill, age 3: planks 2 > 3) |
| `chest` | `chest` (hand, age 1: planks 6 > 1) | `joinery_chest` (joinery_bench, age 2: planks 4 > 1) |
| `door` | `door` (hand, age 1: planks 4 > 1) | `joinery_door` (joinery_bench, age 2: planks 3 > 1) |
| `white_planks` | `white_planks` (hand, age 1: white_wood 1 > 2) | `bench_planks_white` (planing_bench, age 1: white_wood 1 > 3) |
| `door_white` | `door_white` (hand, age 1: white_planks 4 > 1) | `joinery_door_white` (joinery_bench, age 2: white_planks 3 > 1) |
| `trapdoor_white` | `trapdoor_white` (hand, age 1: white_planks 3 > 2) | `joinery_trapdoor_white` (joinery_bench, age 2: white_planks 2 > 2) |
| `dark_planks` | `dark_planks` (hand, age 1: dark_wood 1 > 2) | `bench_planks_dark` (planing_bench, age 1: dark_wood 1 > 3) |
| `door_dark` | `door_dark` (hand, age 1: dark_planks 4 > 1) | `joinery_door_dark` (joinery_bench, age 2: dark_planks 3 > 1) |
| `trapdoor_dark` | `trapdoor_dark` (hand, age 1: dark_planks 3 > 2) | `joinery_trapdoor_dark` (joinery_bench, age 2: dark_planks 2 > 2) |
| `string` | `string` (hand, age 1: hemp_fibre 3 > 1) | `string_spun` (spinning_wheel, age 1: hemp_fibre 3 > 2); `string_wool` (spinning_wheel, age 1: wool 1 > 1); `string_cotton` (spinning_wheel, age 1: cotton 1 > 1) |
| `slab_stone` | `slab_stone` (workbench, age 3: stone 1 > 2) | `mason_slab_stone` (masons_bench, age 3: stone 1 > 2) |
| `roof_stone` | `roof_stone` (hand, age 1: stone 1 > 2) | `mason_roof_stone` (masons_bench, age 3: stone 1 > 3) |
| `trim_curl` | `trim_curl` (hand, age 1: planks 1 > 2) | `mill_trim_curl` (wood_mill, age 3: planks 1 > 3) |
| `lantern` | `lantern_workbench` (hand, age 1: planks 2, stone 2 > 1) | `lantern` (workshop, age 4: planks 2, glass 1 > 1) |
| `trapdoor` | `trapdoor` (hand, age 1: planks 3 > 2) | `joinery_trapdoor` (joinery_bench, age 2: planks 2 > 2) |
| `vase` | `vase` (workbench, age 3: clay 2 > 1) | `kiln_vase` (kiln_oven, age 4: clay 1 > 1) |
| `workbench` | `workbench` (hand, age 1: planks 8, wood 2, stone 2 > 1) | `workshop_workbench` (workshop, age 4: planks 8, wood 2, stone 2 > 1) |

Items made both ways: 21.

#### 3. Buildings whose output is also crafted

One row per building and item: the first level, and the top level of its ladder.

| item | building | first level a day | top level | top level a day | recipes that make it |
| --- | --- | --- | --- | --- | --- |
| `stone` | quarry | 13.3 | openpit | 15 | `stone_from_cobblestone` (hand), `stone_from_white` (hand), `stone_from_marble` (hand) |
| `stone_white` | quarry | 3.3 | openpit | 3.8 | `stone_white` (bleach_bucket) |
| `stone_grey` | quarry | 3.3 | openpit | 3.8 | `stone_grey` (forge) |
| `stone_orange` | quarry | 3.3 | openpit | 3.8 | `stone_orange` (bleach_bucket) |
| `coal` | quarry | 6.7 | openpit | 7.5 | `charcoal` (crucible) |
| `brick` | kiln | 6 | renowned | 24 | `brick` (kiln_oven) |
| `glass` | kiln | 6 | renowned | 24 | `glass` (kiln_oven) |
| `planks` | market | 12 | renowned | 48 | `planks` (hand), `bench_planks` (planing_bench) |
| `coin` | townhall | 12 | renowned | 48 | `strike_coins` (crucible), `strike_copper_coins` (crucible), `strike_ruby_coins` (crucible) |
| `gold` | tavern | 10 | renowned | 40 | `smelt_gold` (crucible), `gold_from_block` (workbench) |
| `stone` | mine | 10 | diamonds | 12 | `stone_from_cobblestone` (hand), `stone_from_white` (hand), `stone_from_marble` (hand) |
| `coal` | mine | 10 | diamonds | 12 | `charcoal` (crucible) |
| `devotion` | temple | 4 | high | 16 | `offer_fruit` (temple), `offer_harvest` (temple), `offer_meat` (temple), `offer_gold` (temple), `offer_candle` (temple) |

Building outputs that are also crafted: 13.

## What to keep

| # | Item | Keep | Mark | Why |
|---|---|---|---|---|
| 1 | `stone` | all 3 | keep both (variants) | Cobblestone, white stone and marble each knock back to stone by hand. Plan §2 keeps them as the Age 1 route to tools |
| 2 | `bucket` | both | keep both (emptying) | `empty_bucket` pours a water bucket out. It is the bucket coming back, not a second way to make one |
| 3 | `planks` | both | keep both (owner, 16 Nov) | Hand 2 a log, Planing Bench 3. The machine costs less |
| 4 | `iron_ingot` | both | keep both (unpack) | `iron_from_block` undoes `iron_block` (4 ingots each way). Smelting is the only way to make new iron |
| 5 | `gold` | both | keep both (unpack) | Same as iron |
| 6 | `coin` | all 3 | keep both (variants) | Gold 10, copper 3, ruby 25. `tests/gems.test.mjs:52` and `tests/crucible-block.test.mjs:8` check all three |
| 7 | `slab_plank` | both | keep both (owner, 16 Nov) | Hand 2, Wood Mill 3 |
| 8 | `stairs_plank` | both | keep both (owner, 16 Nov) | Hand 1 a plank, Wood Mill 1.5 a plank |
| 9 | `chest` | both | keep both (owner, 16 Nov) | Hand 6 planks, Joinery Bench 4 |
| 10 | `door` | both | keep both (owner, 16 Nov) | Hand 4, Joinery Bench 3 |
| 11 | `white_planks` | both | keep both (owner, 16 Nov) | Hand 2, Planing Bench 3 |
| 12 | `door_white` | both | keep both (owner, 16 Nov) | Hand 4, Joinery Bench 3 |
| 13 | `trapdoor_white` | both | keep both (owner, 16 Nov) | Hand 3, Joinery Bench 2 |
| 14 | `dark_planks` | both | keep both (owner, 16 Nov) | Hand 2, Planing Bench 3 |
| 15 | `door_dark` | both | keep both (owner, 16 Nov) | Hand 4, Joinery Bench 3 |
| 16 | `trapdoor_dark` | both | keep both (owner, 16 Nov) | Hand 3, Joinery Bench 2 |
| 17 | `string` | all 4 | keep both (test, variants) | Hand 3 hemp for 1 stays: `tests/bow.test.mjs:64` needs string by hand at Age 1. The wheel spins hemp 3 for 2 (cheaper), wool 1 for 1 and cotton 1 for 1 (PLAY-10) |
| 18 | `gravel` | both | keep both (variants) | Cobblestone or stone, both at the Stone Mill (plan §2 table) |
| 19 | `slab_stone` | `mason_slab_stone` | **remove** `slab_stone` | Same cost (stone 1 for 2), same Age 3. The workbench copy is Age 3, so it is not an Age 1-2 hand route. Plan §2 puts slabs at the Mason's Bench |
| 20 | `roof_stone` | both | keep both (owner, 16 Nov) | Hand 2 from Age 1, Mason's Bench 3 from Age 3 |
| 21 | `trim_curl` | both | keep both (owner, 16 Nov) | Hand 2, Wood Mill 3 |
| 22 | `lantern` | `lantern_workbench` | **remove** `lantern` (workshop) | The workshop one costs glass 1 for the same Lantern the hand makes from stone 2, two ages later. `tests/craft.test.mjs:165` needs the Age 1 hand lantern. Nobody picks the dearer one |
| 23 | `trapdoor` | both | keep both (owner, 16 Nov) | Hand 3, Joinery Bench 2 |
| 24 | `vase` | both | keep both (test, age gap) | Workbench 2 clay at Age 3, Kiln Oven 1 clay at Age 4. `tests/kiln-oven.test.mjs:50` asks for a non-oven vase that costs more |
| 25 | `compost` | all 10 | keep both (variants) | One recipe a seed kind |
| 26 | `devotion` | all 5 | keep both (variants) | Five offerings at the temple |
| 27 | `ring_white` | one | **owner decides** | Temple and Forge take the same inputs. The forge recipe (CRAFT3D-5) has the hammer close-up and needs a level 4 temple anyway. Recommendation: remove the temple copy. Cost: `tests/temple.test.mjs:153-187` forge at the High Temple and change to a forge |
| 28 | `ring_black` | one | **owner decides** | Same as the White Ring |
| 29 | `workbench` | `workbench` (hand) | **remove** `workshop_workbench` | Same inputs, hand from Age 1, workshop from Age 4. The workshop copy adds nothing. `tests/workbench.test.mjs:25` drops its line |

Counts: 29 items, 3 recipes removed, 2 owner calls, 24 kept.

### Buildings whose output is also crafted

All 13 overlaps in table 3 stay. A building pays out without work; a recipe turns one material into another. Neither replaces the other. Two notes:

- The quarry gives coloured stone (white, grey, orange) that the Wash Tub and Forge also make. This is income, not a second recipe.
- The kiln gives brick and glass at 6 a day each; the Kiln Oven fires them on demand. Both stay, as plan §2 says.

### Text that changes with the removals

- `src/config/items.js:43` workbench `madeBy`: "Made by hand. Place it anywhere and make everything from the third age on there".
- `src/config/items.js:290` lantern `madeBy`: "Planks with a stone shade, made by hand".
- `docs/wiki/crafting.md:3`: drop "or at a workshop".
- `docs/wiki/crafting.md:101` (Stone Slab in the Workbench table) and `:260` (Lantern in the Workshop table): delete the rows.
- `docs/wiki/items.md:86`: "Made by hand. Place it anywhere ...".

Old worlds: no item id or block id goes. A save stores no recipes. `StationWork` holds work in progress by recipe id; a removed id gives its inputs back on load (plan §5 rule).

## The Factory

### The two endings

`endingFor(d)` (`src/config/lore.js:24`) returns:

| Value | When | Path |
|---|---|---|
| `white` | `d.war.stage === 'won'`: ten rounds against the Stone Kingdom held | White Ring, "light warriors" |
| `dark` | `d.skyFallen && d.ring === 'black'`, Sky King struck down | Black Ring |
| `yielded` | `d.skyFallen && d.ring === 'black' && d.skyWar.yielded`: four chains cut | Black Ring |
| `null` | anything else, a truce included | |

Both paths end in Age 10, Reckoning (`ages.js:169`). The Factory opens when `endingFor(d)` is not null. A truce passes the Age 10 goal (`ages.js:180`) but gives no ending, so it does not open the Factory (open question 3).

### Building

| Field | Value | Reason |
|---|---|---|
| `id` | `factory` | |
| `name`, `icon` | Factory, 🏭 | |
| `age` | 10 | The endings happen in Age 10 |
| `afterEnding` | `true` | New spec flag. `DuiltGame.storyRefuses(spec)`, called next to `ringRefuses` and `researchRefuses` in `claimOptionsFor` (`DuiltGame.js:557`) and `claim` (`:590`), says "Finish the war first: win it, or bring down the Sky Kingdom". Open in Creative |
| `minSize`, `maxSize` | 8, 24 | Room for 6 machines and walkways. Barracks is 7-18, Market 6-20 |
| `cost` | iron_ingot 8, brick 24, glass 6 | Paid from the bag at the claim, like every building |
| `requires` | `machines`: 3 different machine kinds inside. `hall`: `shelteredVolume() >= 60` | A Barracks hall is 30. A Factory is a big roofed hall |
| `produces`, `everySeconds` | `{}`, 0 | Lines pay out instead (below). The registry's `collect` skips it |
| `skill` | `building` | |

No new block id. The machines are the blocks that exist. Each block has a `station` field, so `stationOf(id)` (`blocks.js:1109`) tells the Factory which machine a block is.

### Machines and lines

A line is one machine kind inside the Factory, running one recipe the player picks. Two Planing Benches are one line. At most 6 lines at the first level.

| Machine | Block | Recipes a line can run |
|---|---|---|
| Workbench | 529 | 132 (`hand` and `workbench` recipes, less the 2 that need water) |
| Planing Bench | 527 | 3 |
| Wood Mill | 341 (4 facings) | 6 |
| Joinery Bench | 528 | 13 |
| Stone Mill | 380-383 | 8 |
| Mason's Bench | 538 | 24 |
| Wash Tub | 524 | 3 |
| Forge | 525 | 10 (rings left out) |
| Spinning Wheel | 534 | 3 |
| Tanning Vat | 544 | 1 |
| Kiln Oven | 539 | 3 |
| Crucible | 531 | 4 (the 3 coin recipes left out) |
| Compost Bin | 520 | 10 |

220 recipes in all, counted on `f5628c3` after the 3 removals. Left out:

- recipes with `ring`, `needs` (water), `needsTemple`, or a temple `tier`; Upgrade recipes,
- the stations that are buildings: workshop 13, engineering 15, temple, university (open question 1),
- coins (open question 4),
- furniture: it has no recipe, only `FURNITURE_COST` at the Carpenter's Table (open question 2).

The Factory ignores `tools` (saw, chisel, mold): its machines carry their own. It ignores the gauge, the chisel taps and the oven's `seconds`. A Crucible or Kiln Oven inside a Factory counts as heated for the Factory's own lines only.

### Rate: the house rule

House rule (`structures.js`): no building hands out more than 10 to 15 of anything a day. A day here is 86,400 s of `everySeconds`, run at `dayScale` and `PRODUCTION_PACE` like every building.

Each line makes up to 12 of its output a day:

- runs a day = `max(1, floor(12 / output.count))`,
- a run every `86400 / runs` seconds,
- each run spends the recipe's inputs once and makes `output.count`.

| Line | Recipe | Runs a day | Made a day | Spent a day |
|---|---|---|---|---|
| Planing Bench | `bench_planks` (log 1 for 3) | 4 | 12 planks | 4 logs |
| Joinery Bench | `joinery_door` (planks 3 for 1) | 12 | 12 doors | 36 planks |
| Stone Mill | `stone_mill_stone_brick` (stone 4 for 6) | 2 | 12 stone brick | 8 stone |
| Workbench | `torch` (planks 1, coal 1 for 4) | 3 | 12 torches | 3 planks, 3 coal |
| Spinning Wheel | `string_cotton` (1 for 1) | 12 | 12 string | 12 cotton |
| Tanning Vat | `leather` (hide 2, log 1 for 2) | 6 | 12 leather | 12 hide, 6 logs |

No two lines may run recipes with the same output item, so one Factory never makes more than 12 of one item a day. A Factory with 6 lines makes up to 72 items a day, 12 of each. An item that makes more than 12 in one run would be the exception; after the coins are left out, the largest output is 6 (stone brick), so no exception is needed.

Levels: the Factory climbs `STANDARD_LEVELS` like the kiln and market. Each level raises the line cap by its `mult`: 12, 18, 30, 42 a day, and the line count by one: 6, 7, 8, 9. The market and town hall already reach 48 a day at Renowned, so the ladder breaks the house rule the same way every building does (open question 5).

### Materials: from the storehouses

- A run takes all its inputs from valid storehouses (`structures.stores()`), all or none. A new `takeAllFromStores(inputs)` next to `takeFromStores` (`DuiltGame.js:1162`) spends them. The bag is never touched: "only needs materials" in the storehouses.
- The output goes through `structures.deliver` (storehouses first, then the bag), as every building's does.
- Inputs short: the run is skipped, the line's clock moves on, and the line shows "Waiting for 3 logs". No backlog builds up, the same as an empty pen (`StructureRegistry.collect`).
- Output with nowhere to go: the inputs go back to the stores and the run stays owed, the same as a stalled building.
- The Factory runs inside `structures.collect` every 5 s (`DuiltGame.js:1515`), after the other buildings, so a quarry's stone is in the store before a Stone Mill line asks for it.
- Time away is skipped: `skipAway` moves each line's clock too.

### UI

The building panel (`DuiltUI.showBuilding`) gets a Lines section under the level line, one row per machine kind found inside:

```
Planing Bench   [Oak Planks x3      v]   12 a day   Running
Stone Mill      [Stone Brick x6     v]   12 a day   Waiting for 4 stone (1 in stores)
Workbench       [Off                v]
```

- The picker is a `<select>`, as the forest's wood picker (`DuiltUI.forestWoodHtml`, `:732`). Options: Off, then the line's recipes by name and output count, those whose inputs the stores hold first.
- Lines with more than 20 recipes (Workbench 132, Mason's Bench 24) get a search box over the select, reusing the Bench's filter.
- A recipe another line already makes the same item with is greyed, with the reason "The Stone Mill line makes this".
- A row reads its rate a game day, times `PRODUCTION_PACE`, as the other panels do.
- No close-up. The machines inside still work by hand for the player as before.

### Save format

Each Factory structure in `StructureRegistry.toJSON` gets one field:

```js
...(s.lines?.length ? { lines: s.lines } : {}),
// lines: [{ station: 'planing_bench', recipe: 'bench_planks', at: 1764000000000 }]
```

- `station`: the machine kind. `recipe`: a recipe id or `null` (off). `at`: the time the line last ran, in ms, like `lastPaidAt`.
- On load, a line whose recipe id no longer exists, or is not Factory work, loads as off. A line whose machine is gone from the region is dropped by `recheck`.
- Inputs are spent per run, so a load never owes a refund.
- Saves without `lines` load unchanged. No save version bump.

## Split of work

Two chunks. They touch no common line and can run in parallel. `docs/TASKS.md` is updated by whoever integrates.

### Chunk A: remove the 3 duplicates

| File | Lines |
|---|---|
| `src/config/recipes.js` | delete `slab_stone` (`:1039-1048`), `lantern` (`:1140-1148`) and `workshop_workbench` (`:1770`); in `lantern_workbench`'s blurb (`:1167`) drop "The workshop makes a glass one." |
| `src/config/items.js` | lines 43 and 290 (`madeBy`) |
| `docs/wiki/crafting.md` | lines 3, 101, 260 |
| `docs/wiki/items.md` | line 86 |
| `tests/workbench.test.mjs` | line 25 |
| `tests/recipe-duplicates.test.mjs` | new |

If the owner picks the forge for the rings: delete `ring_white` and `ring_black` at the temple (`recipes.js:1514-1523`), keep the `ring` field on the forge copies, and move `tests/temple.test.mjs:153-187` to the forge with `needsTemple: 4`.

### Chunk B: the Factory

| File | What |
|---|---|
| `src/config/structures.js` | the `factory` spec; `FACTORY_STATIONS`; `factoryRecipes(station)`; `lineRuns(recipe)`; the standard ladder for `fromLines` |
| `src/structures/Factory.js` | new: `runLines(structure, { now, stores, deliver, dayScale })`, pure apart from the two callbacks |
| `src/structures/StructureRegistry.js` | call `runLines` from `collect` for factories; `lines` in `toJSON`/`loadJSON`; lines in `skipAway` |
| `src/duilt/DuiltGame.js` | `storyRefuses`; `takeAllFromStores`; `setFactoryLine(id, station, recipeId)` |
| `src/ui/DuiltUI.js` | the Lines section and its pickers |
| `docs/wiki/buildings.md` | a Factory entry |
| `tests/factory.test.mjs`, `tests/factory-browser.mjs` | new |

## Tests each chunk writes

### `tests/recipe-duplicates.test.mjs` (Chunk A)

1. Every item made by more than one recipe is in a `KEEP` list in the test, each with its reason; the list has 26 items (24, plus the 2 rings until the owner decides).
2. `slab_stone`, `lantern` and `workshop_workbench` are not recipe ids.
3. The one Stone Slab recipe is `mason_slab_stone`; `howToGet('slab_stone')` names the mason's bench.
4. The one Lantern recipe is `lantern_workbench`, hand, Age 1.
5. The one Workbench recipe is `workbench`, hand, Age 1.
6. For every hand/machine pair in `KEEP` marked "owner, 16 Nov", the machine gives more output per input than the hand.
7. No quest, achievement or challenge names a removed recipe id.

Checks run: `workbench`, `craft`, `masons-bench`, `kiln-oven`, `bow`, `temple`, `collection`, `shapes`, `recipe-chain`, `station-own-recipes`, the full `npm test`.

### `tests/factory.test.mjs` (Chunk B)

1. `factory` is Age 10, sizes 8 to 24, `afterEnding`; `claimOptionsFor` refuses it with `endingFor` null and with a truce; allows it at `white`, `dark` and `yielded`, and in Creative.
2. A region with 2 machine kinds fails `machines`; with 3, passes.
3. `factoryRecipes('workbench')` has 132 recipes; none has `ring`, `needs` or `needsTemple`; no coin recipe is in any station's list.
4. `lineRuns`: planks (3) 4 runs, door (1) 12, stone brick (6) 2; every eligible recipe makes 10 to 12 a day, and none over 12.
5. A Planing Bench line with 10 logs in a storehouse: after one day, 12 planks in the store and 6 logs left; the bag unchanged.
6. With 2 logs in the store: 2 runs, then "Waiting for 1 log"; the clock moves on; adding logs later gives no backlog.
7. With full storehouses and a full bag: no logs spent, the run stays owed.
8. Two lines cannot pick recipes with the same output item.
9. Save and load keep `lines`; a line with an unknown recipe id loads as off; an old save without `lines` loads.
10. `skipAway` of 6 hours: no runs owed for that time.
11. At Tended the line cap is 18.

### `tests/factory-browser.mjs` (Chunk B)

At 390 and 1440 wide: the Factory panel shows one row per machine kind, the picker sets a recipe, the row reads "12 a day", and the Workbench row has a search box.

## Open questions for the owner

1. Workshop (13 recipes: brews, stained glass, fairy lights, the Plainer) and Engineering (15) are buildings, not machines. Does the Factory run them? This design leaves them out.
2. Furniture: does the Factory build it from `FURNITURE_COST` with a Carpenter's Table inside? This design leaves it out, since the table's close-up is the point of furniture.
3. A truce in the war passes Age 10 but gives no ending. Should a truce open the Factory?
4. Coins: a gold coin run makes 10, a ruby run 25. Leave coins out (this design), or allow one run a day as the exception?
5. "Automates all crafting": is 12 an item a day a line enough, or does the owner want the Factory exempt from the house rule?
6. The rings: temple or forge (table rows 27 and 28)?
