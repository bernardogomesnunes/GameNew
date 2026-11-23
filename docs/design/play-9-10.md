# PLAY-9 and PLAY-10: leather and string

Owner's notes, 22 November:

- PLAY-9: "We should add a mechanic to do leather, instead of using the animal skins."
- PLAY-10: "We should introduce the machine to do string, which uses wool, or cotton that should be an item with seeds to farm."

Summary. Hides become leather at a new placed Tanning Vat (block 544). Seven recipes switch from hide to leather. String gets two new inputs, wool and cotton, at the Spinning Wheel that already exists (block 534). Cotton is a new field crop (blocks 548-551) whose seeds come up in turf.

## What exists on this branch already

Commit `bcb6400` on `claude/play-9-10-design` adds the definitions. Coders add mechanics, recipe changes and tests only.

| File | What is there |
|---|---|
| `src/config/items.js` | `leather`, `tanning_vat`, `cotton`, in blocks marked `PLAY-9` and `PLAY-10` at the end of `ITEMS`. `seeds_cotton` comes from `CROPS`. |
| `src/config/crops.js` | `cotton` entry in `CROPS` (base 548, `fibre: true`) and its ripe look in `cropBoxes`. |
| `src/config/blocks.js` | `TANNING_VAT = 544`, after the Kiln Oven. Cotton blocks 548-551 come from the `CROPS` loop. |
| `src/world/propShapes.js` | `PROP_SHAPES.tanning_vat`, after `kiln_oven`. Cotton shapes come from the crop loop. |
| `src/config/itemModels.js` | `ITEM_MODELS.leather` and `ITEM_MODELS.cotton`, after `wool`. |
| `src/config/recipes.js` | PLAY-9 block at the end: `tanning_vat` (hand) and `leather` (at the vat). An empty PLAY-10 block below it. |
| `tests/farmseeds.test.mjs` | Turf seeds now count 9, cotton included. |

The `leather` and `tanning_vat` recipes are on the branch because `tests/collection.test.mjs` (every item has a source) and `tests/shapes.test.mjs` (every placeable item is craftable) fail without them.

Missing: the vat has no close-up yet (no `BENCH_MACHINES` entry), so tapping it does nothing. No recipe uses leather yet. The wheel spins only hemp.

## Block ids

Free on `origin/main` at `25a1601`: 544 and up (Tool Rack takes 540-543).

| Ids | Owner | Use |
|---|---|---|
| 544 | PLAY-9 | Tanning Vat (taken) |
| 545-547 | PLAY-9 | spare |
| 548-551 | PLAY-10 | Cotton crop stages 0-3 (taken) |
| 552-555 | PLAY-10 | spare |

## New items

| id | name | kind | stackTo | colour | glyph | block | age | madeBy |
|---|---|---|---|---|---|---|---|---|
| `leather` | Leather | refined | 100 (`STACK_GOODS`) | `0x9a6b45` | `hide` | none | 1 | Hides soaked with oak bark in a placed Tanning Vat |
| `tanning_vat` | Tanning Vat | refined | 10 | `0x8a6440` | `bucket` | 544 | 1 | Made by hand from oak planks and stone. Place it and tan hides into leather |
| `cotton` | Cotton | raw | 500 (`STACK_BULK`) | `0xf4f1ea` | `wool` | none | 1 | Picked from ripe cotton. Spin it into string at a Spinning Wheel |
| `seeds_cotton` | Cotton Seeds | raw | 100 | `0xf4f1ea` (crop colour) | `seeds` | 548 | 1 | Saved from a ripe cotton (generated) |

Leather's colour is the leather armour set's `main` (`0x9a6b45`), so the sheet and the armour read as one material. Hide stays `0xb99372`, lighter and rawer.

## PLAY-9: leather

### Skins today

One skin item exists: `hide`. Its sources:

- Hunted: deer 1-2, rabbit 0-1, boar 1-2, goat 1, cow 1-2, horse 1-2, raptor 1, trike 2-4, long-neck 3-5, the four dragons 3-12 (`src/config/mobs.js`), and the Warlord's beast 1-3 (`src/config/wanderers.js`).
- A pen with cows: 1 a cycle, 6 a day (`HIDE_PER_CYCLE`, `src/duilt/Ranch.js`).
- Bramble the seedwife sells 2 for 3 coins (`src/config/traders.js`).

These stay as they are. Nobody sells leather: the vat is the one way to make it (PLAY-11 asks for one way per item).

### The machine

- Block 544 `Tanning Vat`, station `tanning_vat`, material wood, one block, no facing variants (the Spinning Wheel and Kiln Oven are single blocks too).
- Close-up: the bench machine pattern (`BenchBar`, `render/BenchMachine.js`, `duilt/BenchWork.js`). Add one line to `BENCH_MACHINES`:

  ```js
  tanning_vat: { verb: 'Soak', tool: 'dip', seconds: 1.6 },
  ```

  `tool: 'dip'` is the Wash Tub's ladle of water, already drawn by `BenchView.makeTool`'s last branch and moved by `update`'s last branch. No render code is needed. Game.js opens any station in `BENCH_MACHINES` on tap (`Game.js:3103`).
- The Crucible/Kiln pattern (load, wait `seconds`, draw out) was the other choice. It needs a new kind in `CrucibleView` and `CrucibleBar`. Tanning is a liquid treatment like the Wash Tub's, so the dip stroke fits and costs no new code.

### Recipes on the branch

| id | station | age | inputs | output | batch | notes |
|---|---|---|---|---|---|---|
| `tanning_vat` | hand | 1 | planks 6, stone 2 | tanning_vat 1 | | the Spinning Wheel costs planks 4, log 1 |
| `leather` | tanning_vat | 1 | hide 2, wood 1 | leather 2 | 4 | the oak log is the bark. No `seconds`: the stroke time is in `BENCH_MACHINES` |

One hide makes one leather, so every switched recipe keeps its count. The log is the added cost.

### Recipes that switch from hide to leather

| Recipe | File | Before | After |
|---|---|---|---|
| `armour_leather_head` Leather Cap | `src/config/armour.js:75` | hide 3 | leather 3 |
| `armour_leather_body` Leather Tunic | `src/config/armour.js:76` | hide 5 | leather 5 |
| `armour_leather_legs` Leather Leggings | `src/config/armour.js:77` | hide 4 | leather 4 |
| `armour_leather_feet` Leather Boots | `src/config/armour.js:78` | hide 2 | leather 2 |
| `backpack_leather` Leather Backpack | `src/config/armour.js:58` | hide 4, string 2 | leather 4, string 2 |
| `backpack_reinforced` Reinforced Backpack | `src/config/armour.js:60` | backpack_leather 1, iron_ingot 2, hide 2 | backpack_leather 1, iron_ingot 2, leather 2 |
| `shield_wood` Wooden Shield | `src/config/armour.js:40` | planks 6, hide 1 | planks 6, leather 1 |

Text to change with them:

- `armour.js:80` set `madeBy`: "Stitched from hides" becomes "Stitched from leather".
- `armour.js:13` header comment: "what anyone can make from hides" becomes "from leather, tanned from hides".
- `armour.js:41` shield `madeBy`: "Planks under a leather face, bound with a leather rim".
- `armour.js:59` backpack `madeBy`: "Leather and string, stitched at the bench".
- `items.js:133` hide `madeBy`: append " — tan it into leather at a Tanning Vat".

### Recipes that keep raw hide

| Recipe | Inputs | Why it stays |
|---|---|---|
| `dino_whistle` (`recipes.js:233`, age 11) | hide 2, string 2 | Carved from the animal: the hide stands for horn and bone, which tanning would not give. |
| `war_horn` (`recipes.js:1512`, age 10) | hide 2, gold 1, planks 1 | A horn. Same reason. |

## PLAY-10: string

### The machine

The Spinning Wheel already exists: block 534, station `spinning_wheel`, made by hand at Age 1 from planks 4 and log 1, with a close-up (`BENCH_MACHINES.spinning_wheel`, verb Spin, tool wheel, 1.5 s). It spins hemp only. PLAY-10 adds wool and cotton to it. A second spinning machine is not added: two machines for one item is the duplicate PLAY-11 asks to remove. No new block id is used for the machine.

### Wool today

- Sheep drop 1-3 when hunted (`mobs.js`).
- A pen with sheep gives 1 a sheep a cycle, 2 at most: 12 a day (`Ranch.js`, pen cycle 4 hours).
- Bramble and Mabel sell 4 for 3 coins.
- Used by: Plainer (wool 12), White and Black Banner (wool 3 each), Training Dummy (1), Archery Target (1), War Tent (4). None of these change.

### Cotton, the crop

- `CROPS` entry: `{ kind: 'cotton', name: 'Cotton', produce: 'cotton', leaf: 0x6f9a4a, crop: 0xf4f1ea, base: 548, fibre: true }`.
- Blocks 548 "Cotton Plant" (stage 0) to 551 "Ripe Cotton" (stage 3), shapes `crop_cotton_0` to `crop_cotton_3`. Growth is `STAGE_SECONDS` 90 a stage, as every crop.
- Seeds: turf. `FIELD_CROPS` includes every crop but coffee, so `WILD_SEEDS` now holds 9 seeds and breaking turf gives one of them 20% of the time (`GRASS_DROPS`). This is how every field crop's seed is found. Each turf break now gives a given seed 2.2% of the time (was 2.5%).
- Seeds: traders. PLAY-10 adds `['seeds_cotton', 4, 2]` to Bramble (`traders.js:87`, after `seeds_hemp`) and to Mabel (`traders.js:123`, after `seeds_hemp`), the same price as hemp seed.
- No wild scatter. Hemp is the one wild crop (`biomes.js`); a second scatter costs a chunk-gen pass and adds nothing the turf drop does not.
- Harvest: a ripe plant broken by hand gives cotton 2 and seeds_cotton 2 (`harvestOf`, generic). A farm with cotton in one of its 4 seed slots gives cotton 1 and seeds_cotton 1 a cycle: 6 and 6 a day (`farmProduce`, generic). The granary keeps both (`FARM_ITEMS`, generic).

### Spinning recipes

Add in the PLAY-10 block at the end of `src/config/recipes.js`:

| id | name | station | age | inputs | output | batch | blurb |
|---|---|---|---|---|---|---|---|
| `string_wool` | String | spinning_wheel | 1 | wool 1 | string 1 | 4 | Wool spun fine on the wheel. |
| `string_cotton` | String | spinning_wheel | 1 | cotton 1 | string 1 | 4 | Cotton spun on the wheel: the finest string from a field. |

Unchanged: `string_spun` (hemp_fibre 3 to string 2, at the wheel) and the hand recipe `string` (hemp_fibre 3 to string 1). The hand recipe stays because `tests/bow.test.mjs:64` asks for string by hand at Age 1, and removing a way is PLAY-11's call. The wheel's three tiles all show String; each tile's sub-line names its input (`BenchBar.render`), so they read apart.

Text to change:

- `items.js:208` spinning_wheel `madeBy`: "... Place it and spin hemp, wool or cotton into string".
- `items.js:217` string `madeBy`: "Hemp, wool or cotton, spun at a Spinning Wheel".
- `recipes.js:1543` spinning_wheel blurb: "Place it, then spin hemp fibre, wool or cotton into string on it."
- `blocks.js:963` comment: "where hemp fibre, wool and cotton are spun into string".

### Current uses of string

Bow (string 3), Arrows (string 1 for 4), Fairy Lights (string 1 with glass 1), Dinosaur Whistle (string 2), Leather Backpack (string 2). None change.

## The look

All shapes are boxes in the unit cell, `{ minX, maxX, minY, maxY, minZ, maxZ, color }`, as in `propShapes.js`. Front is -z.

Tanning Vat (`PROP_SHAPES.tanning_vat`, 11 boxes; the Kiln Oven has 12):

| Part | x | y | z | Colour |
|---|---|---|---|---|
| Tub | 0.12-0.88 | 0-0.58 | 0.12-0.88 | `0x8a6440` oak |
| Lower hoop | 0.1-0.9 | 0.1-0.14 | 0.1-0.9 | `IRON` `0x4a4340` |
| Upper hoop | 0.1-0.9 | 0.44-0.48 | 0.1-0.9 | `IRON` |
| Liquor | 0.18-0.82 | 0.58-0.6 | 0.18-0.82 | `0x5a3a22` bark brown |
| Rim, 4 staves | 0.06 thick round the liquor | 0.58-0.66 | | `0x9c7348` |
| Hide flap on rim | 0.3-0.7 | 0.66-0.69 | 0.08-0.3 | `0xb99372` hide |
| Hide hanging down front | 0.3-0.7 | 0.32-0.69 | 0.08-0.11 | `0xb99372` |
| Paddle handle | 0.64-0.68 | 0.6-1.0 | 0.6-0.64 | `0x8a6238` |

No glow and no light: it is a tub, and lights cost the per-frame light budget.

Cotton crop: stages 0-2 are the shared sprout and tufts in `cropBoxes`, in leaf `0x6f9a4a`. Ripe (8 boxes): a woody stalk 0.46-0.54 wide, 0.72 tall, `0x6b5a3a`; two crossed leaf bars at y 0.3 and 0.42; five white bolls of 0.14 to 0.2 across at y 0.44 to 0.88, `0xf4f1ea`. Hemp's ripe plant has 6 boxes.

Item icons (`ITEM_MODELS`):

- Leather: a sheet 0.68 x 0.56 at `0x8a5a36`, its top two thirds folded over in `0x9a6b45`, a dark strap `0x5e4128` across it. 3 boxes. The hide icon is a flat skin with four legs, so the two read apart.
- Cotton: a 4-layer stack, a brown husk `0x6b5a3a` under white fluff `0xece6da` and `0xf7f4ec`. Wool's ball has a loose end; cotton has the husk.
- Cotton seeds: the generated seed packet, green leaf over a white patch.
- Tanning Vat: drawn from its prop shape by `blockIcon`.

## Balance

House rule (`structures.js`): no building hands out more than 10-15 of anything a day.

| Source | A day | Turns into |
|---|---|---|
| Pen with cows | 6 hide | 6 leather, using 3 oak logs |
| Pen with 2 sheep | 12 wool | 12 string |
| Farm with cotton in 1 of 4 slots | 6 cotton, 6 seeds | 6 string |
| Farm with hemp in 1 slot | 6 hemp fibre | 4 string at the wheel |

The vat and the wheel are conversions, not buildings, so the rule bounds their inputs. Every row stays at or under 12.

What the leather goods cost: the full leather armour set is 14 leather (7 hides' worth of tanning, 7 logs). At one cow pen that is 2.3 days; hunting a deer gives 1-2 hides. A Leather Backpack is 4 leather and 2 string.

Cotton is the best plant fibre (1 cotton to 1 string, against 3 hemp to 2). Hemp keeps its place as the wild fibre you can pick before you have found a single cotton seed.

## Progression

- Age 1 (Exile): hunt deer, boar and goats for hide. Make a Tanning Vat by hand (planks 6, stone 2). Tan hides into leather; make leather armour, the Wooden Shield and the Leather Backpack. Make a Spinning Wheel; spin wild hemp, or wool from hunted sheep. Find cotton seeds in turf and plant them on farmland or in a farm (the farm is Age 1).
- Age 3 (Settle): the pen gives a steady 6 hide and 12 wool a day.
- Age 5 (Hearth): the Reinforced Backpack takes 2 more leather.
- Ages 10-11: the War Horn and the Dinosaur Whistle still take raw hide.

## Split of work

The two agents touch no common line. `docs/TASKS.md` is updated by whoever integrates, because rows PLAY-9 and PLAY-10 are adjacent lines and would conflict.

### PLAY-9 agent

| File | Lines |
|---|---|
| `src/duilt/BenchWork.js` | one line `tanning_vat: ...` after `spinning_wheel` in `BENCH_MACHINES` |
| `src/config/armour.js` | lines 13, 40-41, 58-61, 75-80 |
| `src/config/items.js` | line 133 (hide `madeBy`) only |
| `src/config/recipes.js` | the PLAY-9 block at the end only, if the vat or leather recipe needs a change |
| `tests/armour.test.mjs` | line 43: leather set from leather |
| `tests/backpack.test.mjs` | lines 26-27: from leather and string |
| `tests/leather.test.mjs` | new |

### PLAY-10 agent

| File | Lines |
|---|---|
| `src/config/recipes.js` | the PLAY-10 block at the end; line 1543 (spinning_wheel blurb) |
| `src/config/items.js` | lines 208 and 217 only (not 133 or 134) |
| `src/config/traders.js` | lines 87 and 123 |
| `src/config/blocks.js` | line 963 comment |
| `tests/cotton-string.test.mjs` | new |

Neither agent edits `crops.js`, `propShapes.js`, `itemModels.js` or the PLAY blocks in `items.js` and `blocks.js`; those are done.

## Tests each agent writes

### `tests/leather.test.mjs` (PLAY-9)

1. `leather` is refined, stacks to 100, and has an svg icon; `tanning_vat` places block 544, named Tanning Vat on both, station `tanning_vat`, shape with at most 12 boxes.
2. Only one recipe outputs leather: `leather` at `tanning_vat`, Age 1, hide 2 and wood 1 for 2.
3. `BENCH_MACHINES.tanning_vat` is `{ verb: 'Soak', tool: 'dip' }` with `seconds` over 0.
4. `benchStroke` at the vat: short spends nothing; in the window spends hide 2 and wood 1 and adds leather 2; over the window spends and adds nothing; with no vat in `atStations`, result `none`.
5. The 7 switched recipes take leather in the counts in the table above and no hide.
6. `war_horn` and `dino_whistle` still take hide 2.
7. No recipe other than `leather`, `war_horn` and `dino_whistle` takes hide.
8. `recipeChain('leather').text` is `Hide > Tanning Vat > Leather`.

### `tests/cotton-string.test.mjs` (PLAY-10)

1. Cotton is in `CROPS` with base 548; blocks 548-551 exist; 551 is named Ripe Cotton; `seeds_cotton` places 548.
2. `harvestOf(551)` is cotton 2 and seeds_cotton 2; `harvestOf(548)` is seeds_cotton 1.
3. `WILD_SEEDS` includes `seeds_cotton` and not `seeds_coffee`.
4. `farmProduce({ seeds: ['cotton'] })` is cotton 1 and seeds_cotton 1; at 6 cycles a day that is 6 of each, under 15.
5. `string_wool` (wool 1 for string 1) and `string_cotton` (cotton 1 for string 1) are at `spinning_wheel`, Age 1, batch 4.
6. `benchStroke` at the wheel makes 1 string from 1 wool, and 1 from 1 cotton.
7. The wheel offers 3 string recipes at Age 1, each with a different input.
8. Bramble and Mabel sell `seeds_cotton`.
9. Cotton and Cotton Seeds have svg icons, and the cotton icon differs from the wool icon.
10. The recipes that use string (bow, arrow, fairy_lights, dino_whistle, backpack_leather) are unchanged in their string count.

Checks run on the definitions: `one-name-per-item`, `itemchips`, `blockjoins`, `shapes`, `crops`, `farmseeds`, `collection`, `bow`, `bench-work`, `armour`, `backpack`, `recipe-chain`, `station-own-recipes`, and every test that imports `ITEMS_BY_ID`, `BLOCKS_BY_ID`, `PROP_SHAPES` or `ITEM_MODELS`, all passing; `npm run build` passes.
