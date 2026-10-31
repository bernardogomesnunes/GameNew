# Crafting

Open the Workbench with **E**. It lists every recipe with a search box. A recipe is greyed out when you lack an ingredient or stand in the wrong place, and the panel says which.

- Recipes you use constantly make several at once ("Planks ×2").
- Each recipe unlocks at an age. In Creative they are all open.
- Some recipes need a **station**: a building or block you stand near.

## Stations

| Station | How to reach it |
|---|---|
| Anywhere (Workbench) | Nothing needed |
| Workshop | Stand in a claimed Workshop |
| Foundry | Stand at a claimed Foundry |
| Planing Bench | Make the Planing Bench block (Age 2, 6 planks and 2 stone), place it and stand nearby: a log gives 3 planks instead of 2 |
| Joinery Bench | Make the Joinery Bench block (Age 2, 6 planks, 2 logs and 2 stone), place it and stand nearby: a plank gives 3 fences, a gate takes 2 planks and a chest 4 |
| Wood Mill | Make the Wood Mill block (Age 3) and stand within 4 blocks |
| Stone Mill | Make the Stone Mill block (Age 3) and stand within 4 blocks |
| Engineering Centre | Stand in a claimed Engineering Centre. First study engineering at a University |
| Temple | Stand in a claimed Temple. Some recipes need a higher level |
| University | Stand in a claimed University to study |
| Forge | Place a Forge block and stand nearby; a Foundry can also forge |
| Bleach Bucket | Place the filled Bleach Bucket and stand nearby |
| Compost Bin | Place the bin and mix leaves with spare crop seeds |

Where something can be made two ways (by hand and at a mill), the Workbench shows only one tile: the cheaper mill recipe when you stand at the mill, the hand recipe anywhere else.

## The mills

- **Wood Mill:** three planks from a log (instead of two). Doors, trapdoors and stairs cost less. Also stripped logs, cabinets, wardrobes, bedside tables and wall panels.
- **Stone Mill:** decorative stone recipes offer a larger batch for the same ingredients. It also grinds cobblestone or stone to gravel (1 makes 2) and gravel to sand (1 makes 2). Slabs are not milled.

## Tool tiers

Stone tools are the plain Axe, Pickaxe, Shovel and Sword. Higher axes, pickaxes and shovels are made by hand from 2 Wood and the tier's metal (3 for an axe, pickaxe or sword, 2 for a shovel):

| Tier | Unlocks | Metal | Sword damage | Uses |
|---|---|---|---|---|
| Stone | Age 1 | Stone | 6 | 120 to 160 |
| Iron | Age 5 | Iron Ingot | 9 | 300 |
| Gold | Age 8 | Gold | 10 | 200 (soft) |
| Sky | Age 10 | Sky Marble, 1 Gold | 12 | 500 |
| Dark | Age 10 | Dark Stone, 1 Iron Ingot | 13 | 500 |
| Diamond | Age 10 | Diamond, 1 Iron Ingot | 15 | 900 |

Metal swords are shaped with a reusable Weapon Mold at a Forge or Foundry. Wooden and Stone Swords need a Carpentry Chisel. Bows need a Carpentry Saw and Plane. Existing temple enchantments still use the Temple.

A better tool is never slower. It lasts longer, hits harder, and does the wrong job at normal pace instead of slow.

## Processing and work steps

A Quarry now supplies **Stone only**. Use a Stone Mill for Cobblestone, Marble and Stone Brick, or tint Stone with Clay into Orange Stone. Fire Stone at a Forge for Dark Grey Stone or Dark Stone. Wash Stone in a placed Bleach Bucket for White Stone. Turquoise remains a natural deposit. Existing natural marble and coloured seams remain mineable too. Wood works the same way: wash 2 Wood in the Bleach Bucket for 2 White Log, or fire 5 Wood at a Forge for 4 Dark Log (one log burns as fuel).

A Stone Mill costs 10 Stone and 4 Planks, so you can build one before you have processed cobble. Wash 3 Dirt into 1 Clay by water if you need clay for your first Forge.

Craft a **Carpentry Saw** (2 Wood and 2 Stone) and keep it in your bag: it is the only tool furniture, beds and paintings need, in every wood. The Chisel, Plane and Mallet (same cost) are for swords and bows. A Wood Mill alone is insufficient. Held, the Chisel carves blocks: Break turns stone or cobblestone into stone brick, sandstone into sandstone brick, dark stone into dark brick, a brick into a pillar and marble into a marble pillar. Held, the Chisel carves blocks: Break turns stone or cobblestone into stone brick, sandstone into sandstone brick, dark stone into dark brick, a brick into a pillar and marble into a marble pillar. These tools and the Weapon Mold are reusable.

For processing, furniture and weapons, choose Make to open the work steps. The panel shows the total output and material bill. Select a batch count before the first action, then perform the actions in order, or Cancel. Materials are spent only when the last action succeeds. Closing the popup cancels unfinished work. Walking away from the station, losing a tool or running short of materials blocks the work; a bulk job never silently finishes fewer batches. Cancel and restart to change its quantity.

## Studies (University)

Each skill has ten studies (Foraging, Building, Athletics, Politics). Level 1 costs 3 Planks and 2 Stone. Each level adds 3 planks and 2 stone, and from level 5 adds gold (1 at level 5 up to 6 at level 10). **Engineering** is a single study: 16 Planks and 16 Stone. It unlocks the Engineering Centre. A level-1 study takes 2 game days, then one more game day per study level. Only one study runs at a time; the panel shows its progress.

## Temple upgrades

At a Temple of level 2 or higher you can lay an upgrade on a piece you own. It costs the piece, devotion and one more thing, and gives the same piece with the upgrade's name in front.

| Upgrade | Fits | Devotion | Also needs | Effect |
|---|---|---|---|---|
| Swift | Boots | 3 | 3 Coffee Beans | 1.2 times faster |
| Warded | Body or legs | 4 | 2 Iron Ingot | +2 armour |
| Night Sight | Helm | 4 | 3 Jar of Fireflies | See in the dark |
| Thunder | Stone or Iron Sword | 5 | 3 Copper Ingot | Stuns for 2 seconds |
| Fire | Stone or Iron Sword | 5 | 2 Lantern | Burns for 4 seconds |
| Ice | Stone or Iron Sword | 5 | 3 Glass | Freezes for 4 seconds, slowed to 30% |

A few upgraded pieces also turn up in forgotten temple, monument and mine chests.

## Every recipe

Generated from the current recipe registry by `node scripts/update-wiki.mjs`. Counts are per batch. Reusable tools stay in your bag. The recipe tile checks your age, available space, materials, tools and station. Research and temple recipes may have additional progress conditions.

### Anywhere

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Storage Interface → 1 Storage Interface | 6 Planks, 2 Glass, 2 Copper Ingot | — | 3 | — |
| Compost Bin → 1 Compost Bin | 6 Planks, 4 Leaves | — | 2 | — |
| Stone Axe → 1 Stone Axe | 2 Wood, 3 Stone | — | 1 | — |
| Stone Pickaxe → 1 Stone Pickaxe | 3 Wood, 4 Stone | — | 1 | — |
| Stone Shovel → 1 Stone Shovel | 2 Wood, 2 Stone | — | 1 | — |
| Stone from cobblestone → 1 Stone | 2 Cobblestone | — | 1 | — |
| Stone from white stone → 1 Stone | 1 White Stone | — | 1 | — |
| Stone from marble → 1 Stone | 1 Marble | — | 1 | — |
| Bucket → 1 Bucket | 4 Wood | — | 1 | — |
| Fill the bucket → 1 Bucket of Water | 1 Bucket | — | 1 | Near water |
| Empty the bucket → 1 Bucket | 1 Bucket of Water | — | 1 | — |
| Turn soil → 1 Turned Soil | 1 Dirt | — | 1 | — |
| Sapling → 1 Sapling | 4 Leaves | — | 1 | — |
| Planks → 2 Planks | 1 Wood | — | 1 | — |
| Cook meat → 2 Cooked Meat | 2 Raw Meat, 1 Wood | — | 1 | — |
| Cart → 1 Cart | 16 Planks, 4 Wood | — | 3 | — |
| Dinosaur Whistle → 1 Dinosaur Whistle | 2 Hide, 2 String | — | 11 | — |
| Plank Slab → 2 Plank Slab | 1 Planks | — | 1 | — |
| Plank Stairs → 1 Plank Stairs | 1 Planks | — | 1 | — |
| Chest → 1 Chest | 6 Planks | — | 1 | — |
| Storage Controller → 1 Storage Controller | 8 Planks, 2 Glass, 4 Brick | — | 5 | — |
| Wooden Sword → 1 Wooden Sword | 2 Wood, 3 Planks | Carpentry Chisel | 1 | — |
| Stone Sword → 1 Stone Sword | 2 Wood, 5 Stone | Carpentry Chisel | 3 | — |
| Bed → 1 Bed | 4 Planks, 3 Leaves | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 1 | — |
| Painting → 1 Painting | 2 Planks, 1 Dirt, 1 Leaves | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 1 | — |
| Catapult → 1 Catapult | 10 Planks, 4 Wood, 6 Stone | — | 4 | — |
| Fence → 2 Fence | 1 Planks | — | 3 | — |
| Gate → 1 Gate | 3 Planks | — | 3 | — |
| Door → 1 Door | 4 Planks | — | 1 | — |
| White Planks → 2 White Planks | 1 White Log | — | 1 | — |
| White Fence → 2 White Fence | 1 White Planks | — | 3 | — |
| White Gate → 1 White Gate | 3 White Planks | — | 3 | — |
| White Door → 1 White Door | 4 White Planks | — | 1 | — |
| White Trapdoor → 2 White Trapdoor | 3 White Planks | — | 1 | — |
| Dark Planks → 2 Dark Planks | 1 Dark Log | — | 1 | — |
| Dark Fence → 2 Dark Fence | 1 Dark Planks | — | 3 | — |
| Dark Gate → 1 Dark Gate | 3 Dark Planks | — | 3 | — |
| Dark Door → 1 Dark Door | 4 Dark Planks | — | 1 | — |
| Dark Trapdoor → 2 Dark Trapdoor | 3 Dark Planks | — | 1 | — |
| String → 1 String | 3 Hemp Fibre | — | 1 | — |
| Bow → 1 Bow | 3 Planks, 3 String | Carpentry Saw, Carpentry Plane | 1 | — |
| Arrows → 4 Arrow | 1 Planks, 1 String | — | 1 | — |
| Wood Mill → 1 Wood Mill | 8 Planks, 4 Cobblestone | — | 3 | — |
| Stone Mill → 1 Stone Mill | 10 Stone, 4 Planks | — | 3 | — |
| Sandstone → 1 Sandstone | 4 Sand | — | 1 | — |
| Sandstone Brick → 4 Sandstone Brick | 4 Sandstone | — | 3 | — |
| Sand Path → 2 Sand Path | 2 Sand | — | 1 | — |
| Sandstone Wall → 4 Sandstone Wall | 3 Sandstone | — | 3 | — |
| Stone Brick Wall → 4 Stone Brick Wall | 3 Stone Brick | — | 3 | — |
| Stone Brick Chimney → 2 Stone Brick Chimney | 3 Stone Brick | — | 3 | — |
| Brick Chimney → 2 Brick Chimney | 3 Brick | — | 4 | — |
| Dark Brick Wall → 4 Dark Brick Wall | 3 Dark Brick | — | 4 | — |
| Marble Wall → 4 Marble Wall | 3 Marble | — | 8 | — |
| Sky Marble Wall → 4 Sky Marble Wall | 3 Sky Marble | — | 8 | — |
| White Stone Wall → 4 White Stone Wall | 3 White Stone | — | 3 | — |
| Dark Grey Stone Wall → 4 Dark Grey Stone Wall | 3 Dark Grey Stone | — | 3 | — |
| Turquoise Stone Wall → 4 Turquoise Stone Wall | 3 Turquoise Stone | — | 3 | — |
| Orange Stone Wall → 4 Orange Stone Wall | 3 Orange Stone | — | 3 | — |
| Stone Slab → 2 Stone Slab | 1 Stone | — | 3 | — |
| Brick Roof Tiles → 2 Brick Roof Tiles | 1 Brick | — | 4 | — |
| Stone Roof Tiles → 2 Stone Roof Tiles | 1 Stone | — | 1 | — |
| Teal Roof Tiles → 2 Teal Roof Tiles | 1 Stone, 1 Leaves | — | 1 | — |
| Mint Roof Tiles → 3 Mint Roof Tiles | 1 Stone, 1 Leaves, 1 Sand | — | 1 | — |
| Lilac Roof Tiles → 2 Lilac Roof Tiles | 1 Stone, 1 White Leaves | — | 2 | — |
| Curled Trim → 2 Curled Trim | 1 Planks | — | 1 | — |
| Hanging Vines → 2 Hanging Vines | 2 Leaves | — | 1 | — |
| Wisteria → 2 Wisteria | 2 White Leaves | — | 2 | — |
| Red Mushroom Cap → 2 Red Mushroom Cap | 1 Clay, 1 Leaves | — | 3 | — |
| Lilac Mushroom Cap → 2 Lilac Mushroom Cap | 1 Clay, 1 White Leaves | — | 3 | — |
| Mushroom Stem → 2 Mushroom Stem | 1 Clay, 1 Sand | — | 3 | — |
| Stone Stairs → 1 Stone Stairs | 1 Stone | — | 3 | — |
| Sky Marble → 2 Sky Marble | 2 Marble, 1 Glass | — | 8 | — |
| Gold Trim → 2 Gold Trim | 1 Gold, 2 Stone | — | 5 | — |
| Timber Frame → 2 Timber Frame | 2 Planks, 1 Clay | — | 3 | — |
| Cobblestone Wall → 4 Cobblestone Wall | 3 Cobblestone | — | 3 | — |
| Stone Wall → 4 Stone Wall | 3 Stone | — | 3 | — |
| Brick Wall → 4 Brick Wall | 3 Brick | — | 4 | — |
| Dark Stone Wall → 4 Dark Stone Wall | 3 Dark Stone | — | 4 | — |
| Stone Pillar → 2 Stone Pillar | 3 Stone | — | 4 | — |
| Marble Pillar → 2 Marble Pillar | 2 Marble | — | 8 | — |
| Dark Pillar → 2 Dark Pillar | 2 Dark Stone | — | 4 | — |
| Trapdoor → 2 Trapdoor | 3 Planks | — | 1 | — |
| Framed Window → 1 Framed Window | 2 Planks, 2 Sand | — | 1 | — |
| Vase → 1 Vase | 2 Clay | — | 3 | — |
| Urn → 1 Urn | 2 Copper Ingot | — | 5 | — |
| White Banner → 1 White Banner | 3 Wool, 1 Planks | — | 4 | — |
| Black Banner → 1 Black Banner | 3 Wool, 1 Planks, 1 Dark Log | — | 4 | — |
| Glass jar → 1 Glass Jar | 1 Glass | — | 4 | — |
| Firefly Lantern → 1 Firefly Lantern | 1 Jar of Fireflies, 1 Planks | — | 4 | — |
| Calçada → 4 Calçada | 2 Stone | — | 3 | — |
| Dark Calçada → 4 Dark Calçada | 1 Stone, 1 Dark Stone | — | 3 | — |
| Calçada Wave → 3 Calçada Wave | 2 Calçada, 1 Dark Calçada | — | 3 | — |
| Weapon Rack → 1 Weapon Rack | 3 Planks, 2 Iron Ingot | — | 8 | — |
| Training Dummy → 1 Training Dummy | 2 Planks, 1 Wool, 2 Leaves | — | 8 | — |
| Archery Target → 1 Archery Target | 2 Planks, 1 Wool | — | 8 | — |
| War Tent → 1 War Tent | 4 Wool, 2 Planks | — | 8 | — |
| Campfire → 1 Campfire | 2 Planks, 2 Stone | — | 3 | — |
| Sky Lift → 1 Sky Lift | 2 Gold, 2 Chain, 2 Planks | — | 10 | — |
| Chain → 4 Chain | 1 Iron Ingot | — | 5 | — |
| War Horn → 1 War Horn | 2 Hide, 1 Gold, 1 Planks | — | 10 | — |
| Iron Axe → 1 Iron Axe | 2 Wood, 3 Iron Ingot | — | 5 | — |
| Iron Pickaxe → 1 Iron Pickaxe | 2 Wood, 3 Iron Ingot | — | 5 | — |
| Iron Shovel → 1 Iron Shovel | 2 Wood, 2 Iron Ingot | — | 5 | — |
| Gold Axe → 1 Gold Axe | 2 Wood, 3 Gold | — | 8 | — |
| Gold Pickaxe → 1 Gold Pickaxe | 2 Wood, 3 Gold | — | 8 | — |
| Gold Shovel → 1 Gold Shovel | 2 Wood, 2 Gold | — | 8 | — |
| Sky Axe → 1 Sky Axe | 2 Wood, 3 Sky Marble, 1 Gold | — | 10 | — |
| Sky Pickaxe → 1 Sky Pickaxe | 2 Wood, 3 Sky Marble, 1 Gold | — | 10 | — |
| Sky Shovel → 1 Sky Shovel | 2 Wood, 2 Sky Marble, 1 Gold | — | 10 | — |
| Dark Axe → 1 Dark Axe | 2 Wood, 3 Dark Stone, 1 Iron Ingot | — | 10 | — |
| Dark Pickaxe → 1 Dark Pickaxe | 2 Wood, 3 Dark Stone, 1 Iron Ingot | — | 10 | — |
| Dark Shovel → 1 Dark Shovel | 2 Wood, 2 Dark Stone, 1 Iron Ingot | — | 10 | — |
| Diamond Axe → 1 Diamond Axe | 2 Wood, 3 Diamond, 1 Iron Ingot | — | 10 | — |
| Diamond Pickaxe → 1 Diamond Pickaxe | 2 Wood, 3 Diamond, 1 Iron Ingot | — | 10 | — |
| Diamond Shovel → 1 Diamond Shovel | 2 Wood, 2 Diamond, 1 Iron Ingot | — | 10 | — |
| Leather Cap → 1 Leather Cap | 3 Hide | — | 1 | — |
| Leather Tunic → 1 Leather Tunic | 5 Hide | — | 1 | — |
| Leather Leggings → 1 Leather Leggings | 4 Hide | — | 1 | — |
| Leather Boots → 1 Leather Boots | 2 Hide | — | 1 | — |
| Iron Helm → 1 Iron Helm | 3 Iron Ingot | — | 5 | — |
| Iron Cuirass → 1 Iron Cuirass | 5 Iron Ingot | — | 5 | — |
| Iron Greaves → 1 Iron Greaves | 4 Iron Ingot | — | 5 | — |
| Iron Boots → 1 Iron Boots | 2 Iron Ingot | — | 5 | — |
| Gold Helm → 1 Gold Helm | 3 Gold | — | 8 | — |
| Gold Cuirass → 1 Gold Cuirass | 5 Gold | — | 8 | — |
| Gold Greaves → 1 Gold Greaves | 4 Gold | — | 8 | — |
| Gold Boots → 1 Gold Boots | 2 Gold | — | 8 | — |
| Diamond Helm → 1 Diamond Helm | 3 Diamond, 1 Iron Ingot | — | 10 | — |
| Diamond Cuirass → 1 Diamond Cuirass | 5 Diamond, 2 Iron Ingot | — | 10 | — |
| Diamond Greaves → 1 Diamond Greaves | 4 Diamond, 1 Iron Ingot | — | 10 | — |
| Diamond Boots → 1 Diamond Boots | 2 Diamond, 1 Iron Ingot | — | 10 | — |
| Sky Helm → 1 Sky Helm | 2 Iron Ingot, 1 Gold | — | 5 | — |
| Sky Cuirass → 1 Sky Cuirass | 4 Iron Ingot, 2 Gold | — | 5 | — |
| Sky Greaves → 1 Sky Greaves | 3 Iron Ingot, 1 Gold | — | 5 | — |
| Sky Boots → 1 Sky Boots | 2 Iron Ingot, 1 Gold | — | 5 | — |
| Dark Helm → 1 Dark Helm | 2 Iron Ingot, 1 Dark Stone | — | 5 | — |
| Dark Cuirass → 1 Dark Cuirass | 4 Iron Ingot, 2 Dark Stone | — | 5 | — |
| Dark Greaves → 1 Dark Greaves | 3 Iron Ingot, 1 Dark Stone | — | 5 | — |
| Dark Boots → 1 Dark Boots | 2 Iron Ingot, 1 Dark Stone | — | 5 | — |
| Leather Backpack → 1 Leather Backpack | 4 Hide, 2 String | — | 1 | — |
| Reinforced Backpack → 1 Reinforced Backpack | 1 Leather Backpack, 2 Iron Ingot, 2 Hide | — | 5 | — |
| Forge → 1 Forge | 12 Stone, 4 Clay | — | 3 | — |
| Bleach Bucket → 1 Bleach Bucket | 1 Bucket of Water, 2 Wood | — | 3 | — |
| Wash Clay → 1 Clay | 3 Dirt | — | 1 | Near water |
| Weapon Mold → 1 Weapon Mold | 3 Clay, 1 Stone | — | 3 | — |
| Carpentry Saw → 1 Carpentry Saw | 2 Wood, 2 Stone | — | 1 | — |
| Carpentry Chisel → 1 Carpentry Chisel | 2 Wood, 2 Stone | — | 1 | — |
| Carpentry Plane → 1 Carpentry Plane | 2 Wood, 2 Stone | — | 1 | — |
| Carpentry Mallet → 1 Carpentry Mallet | 2 Wood, 2 Stone | — | 1 | — |

### Stone Mill

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Cobblestone → 2 Cobblestone | 1 Stone | — | 3 | — |
| Marble → 1 Marble | 4 Stone | — | 3 | — |
| Grind gravel → 2 Gravel | 1 Cobblestone | — | 3 | — |
| Grind gravel from stone → 2 Gravel | 1 Stone | — | 3 | — |
| Grind sand → 2 Sand | 1 Gravel | — | 3 | — |
| Stone Brick → 4 Stone Brick | 4 Stone | — | 3 | — |
| Stone Brick → 6 Stone Brick | 4 Stone | — | 3 | — |
| Sandstone Brick → 6 Sandstone Brick | 4 Sandstone | — | 3 | — |
| Stone Stairs → 2 Stone Stairs | 1 Stone | — | 3 | — |
| Stone Roof Tiles → 3 Stone Roof Tiles | 1 Stone | — | 3 | — |
| Brick Roof Tiles → 3 Brick Roof Tiles | 1 Brick | — | 4 | — |
| Stone Wall → 6 Stone Wall | 3 Stone | — | 3 | — |
| Cobblestone Wall → 6 Cobblestone Wall | 3 Cobblestone | — | 3 | — |
| Brick Wall → 6 Brick Wall | 3 Brick | — | 4 | — |
| Dark Stone Wall → 6 Dark Stone Wall | 3 Dark Stone | — | 4 | — |
| Stone Brick Wall → 6 Stone Brick Wall | 3 Stone Brick | — | 3 | — |
| Sandstone Wall → 6 Sandstone Wall | 3 Sandstone | — | 3 | — |
| Dark Brick Wall → 6 Dark Brick Wall | 3 Dark Brick | — | 4 | — |
| Marble Wall → 6 Marble Wall | 3 Marble | — | 8 | — |
| Sky Marble Wall → 6 Sky Marble Wall | 3 Sky Marble | — | 8 | — |
| White Stone Wall → 6 White Stone Wall | 3 White Stone | — | 3 | — |
| Dark Grey Stone Wall → 6 Dark Grey Stone Wall | 3 Dark Grey Stone | — | 3 | — |
| Turquoise Stone Wall → 6 Turquoise Stone Wall | 3 Turquoise Stone | — | 3 | — |
| Orange Stone Wall → 6 Orange Stone Wall | 3 Orange Stone | — | 3 | — |
| Stone Brick Chimney → 3 Stone Brick Chimney | 3 Stone Brick | — | 3 | — |
| Brick Chimney → 3 Brick Chimney | 3 Brick | — | 4 | — |
| Stone Pillar → 3 Stone Pillar | 3 Stone | — | 4 | — |
| Marble Pillar → 3 Marble Pillar | 2 Marble | — | 8 | — |
| Dark Pillar → 3 Dark Pillar | 2 Dark Stone | — | 4 | — |
| Calçada → 6 Calçada | 2 Stone | — | 3 | — |
| Dark Calçada → 6 Dark Calçada | 1 Stone, 1 Dark Stone | — | 3 | — |
| Calçada Wave → 5 Calçada Wave | 2 Calçada, 1 Dark Calçada | — | 3 | — |
| Tint Orange Stone → 4 Orange Stone | 4 Stone, 1 Clay | — | 3 | — |

### Workshop

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Brick → 2 Brick | 3 Dirt, 1 Cobblestone | — | 4 | — |
| Plainer → 1 Plainer | 24 Planks, 12 Wool | — | 4 | — |
| Glass → 1 Glass | 2 Sand | — | 4 | — |
| Planks → 4 Planks | 1 Wood | — | 4 | — |
| Stained Glass → 2 Stained Glass | 2 Glass | — | 4 | — |
| Fairy Lights → 4 Fairy Lights | 1 Glass, 1 String | — | 4 | — |
| Lantern → 1 Lantern | 2 Planks, 1 Glass | — | 4 | — |
| Chandelier → 1 Chandelier | 1 Iron Ingot, 1 Planks | — | 4 | — |
| Oak Table → 1 Oak Table | 4 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Oak Chair → 1 Oak Chair | 3 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Red Chair → 1 Red Chair | 2 Planks, 1 Brick | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Green Rug → 1 Green Rug | 4 Leaves | — | 4 | — |
| Red Rug → 1 Red Rug | 3 Leaves, 1 Brick | — | 4 | — |
| Blue Rug → 1 Blue Rug | 3 Leaves, 1 Glass | — | 4 | — |
| Marble Table → 1 Marble Table | 3 Marble | — | 4 | — |
| White Table → 1 White Table | 4 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| White Chair → 1 White Chair | 3 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Dark Table → 1 Dark Table | 4 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Dark Chair → 1 Dark Chair | 3 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 4 | — |
| Beer → 2 Beer | 3 Potatoes | — | 4 | — |
| Kombucha → 2 Kombucha | 2 Fruit, 1 Leaves | — | 4 | — |
| Coffee → 2 Coffee | 3 Coffee Beans | — | 4 | — |

### Engineering

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Time Machine → 1 Time Machine | 24 Iron Ingot, 8 Gold, 10 Glass, 2 Diamond, 2 Ruby | — | 11 | — |
| Pavement → 4 Pavement | 2 Stone | — | 11 | Read the Future Archive first |
| Asphalt → 4 Asphalt | 3 Gravel, 1 Coal | — | 11 | Read the Future Archive first |
| Tinted Glass → 2 Tinted Glass | 2 Glass, 1 Iron Ingot | — | 11 | Read the Future Archive first |
| Steel Panel → 2 Steel Panel | 2 Iron Ingot, 1 Coal | — | 11 | Read the Future Archive first |
| Neon Pink → 4 Neon Pink | 2 Glass, 1 Ruby | — | 11 | Read the Future Archive first |
| Neon Cyan → 4 Neon Cyan | 2 Glass, 1 Diamond | — | 11 | Read the Future Archive first |
| Screen → 2 Screen | 2 Glass, 2 Copper Ingot, 1 Gold | — | 11 | Read the Future Archive first |
| Maglev Rail → 4 Maglev Rail | 2 Iron Ingot, 1 Copper Ingot | — | 11 | Read the Future Archive first |
| Lit Window → 2 Lit Window | 2 Glass, 1 Gold | — | 11 | Read the Future Archive first |
| Future Lamp → 2 Future Lamp | 1 Glass, 1 Iron Ingot, 1 Gold | — | 11 | Read the Future Archive first |
| Helix → 1 Helix | 20 Iron Ingot, 8 Glass, 6 Planks | — | 8 | — |
| Rail → 8 Rail | 1 Iron Ingot, 2 Planks | — | 8 | — |
| Steam Engine → 1 Steam Engine | 24 Iron Ingot, 8 Brick, 8 Planks | — | 8 | — |
| Rail Car → 1 Rail Car | 12 Iron Ingot, 12 Planks | — | 8 | — |

### Foundry

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Smelt iron → 1 Iron Ingot | 2 Iron Ore | — | 5 | — |
| Smelt copper → 1 Copper Ingot | 2 Copper Ore | — | 5 | — |
| Smelt gold → 1 Gold | 3 Gold Ore | — | 5 | — |
| Burn charcoal → 1 Coal | 4 Wood | — | 5 | — |
| Strike coins → 10 Coins | 1 Gold | — | 5 | — |
| Strike copper coins → 3 Coins | 1 Copper Ingot | — | 5 | — |
| Strike coins from a ruby → 25 Coins | 1 Ruby | — | 10 | — |

### Forge

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Iron Sword → 1 Iron Sword | 2 Wood, 3 Iron Ingot | Weapon Mold | 5 | — |
| Dark Stone → 4 Dark Stone | 4 Stone, 1 Dark Log | — | 4 | — |
| Dark Brick → 4 Dark Brick | 4 Brick, 1 Dark Log | — | 4 | — |
| Gold Sword → 1 Gold Sword | 2 Wood, 3 Gold | Weapon Mold | 8 | — |
| Sky Sword → 1 Sky Sword | 2 Wood, 3 Sky Marble, 1 Gold | Weapon Mold | 10 | — |
| Dark Sword → 1 Dark Sword | 2 Wood, 3 Dark Stone, 1 Iron Ingot | Weapon Mold | 10 | — |
| Diamond Sword → 1 Diamond Sword | 2 Wood, 3 Diamond, 1 Iron Ingot | Weapon Mold | 10 | — |
| Temper Grey Stone → 4 Dark Grey Stone | 4 Stone, 1 Wood | — | 3 | — |

### Wood Mill

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Planks (mill) → 3 Planks | 1 Wood | — | 3 | — |
| White Planks (mill) → 3 White Planks | 1 White Log | — | 3 | — |
| Dark Planks (mill) → 3 Dark Planks | 1 Dark Log | — | 3 | — |
| Door (mill) → 1 Door | 3 Planks | — | 3 | — |
| Trapdoor (mill) → 2 Trapdoor | 2 Planks | — | 3 | — |
| White Door (mill) → 1 White Door | 3 White Planks | — | 3 | — |
| White Trapdoor (mill) → 2 White Trapdoor | 2 White Planks | — | 3 | — |
| Dark Door (mill) → 1 Dark Door | 3 Dark Planks | — | 3 | — |
| Dark Trapdoor (mill) → 2 Dark Trapdoor | 2 Dark Planks | — | 3 | — |
| Plank Stairs (mill) → 3 Plank Stairs | 2 Planks | — | 3 | — |
| Stripped Oak Log → 1 Stripped Oak Log | 1 Wood | — | 3 | — |
| Stripped White Log → 1 Stripped White Log | 1 White Log | — | 3 | — |
| Stripped Dark Log → 1 Stripped Dark Log | 1 Dark Log | — | 3 | — |
| Cabinet → 1 Cabinet | 4 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Wardrobe → 1 Wardrobe | 7 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Bedside Table → 1 Bedside Table | 3 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Wood Panel → 4 Wood Panel | 1 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Patterned Panel → 4 Patterned Panel | 2 Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Two-tone Panel → 4 Two-tone Panel | 1 Planks, 1 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| White Cabinet → 1 White Cabinet | 4 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| White Wardrobe → 1 White Wardrobe | 7 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| White Bedside Table → 1 White Bedside Table | 3 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| White Panel → 4 White Panel | 1 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| White Patterned Panel → 4 White Patterned Panel | 2 White Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Dark Cabinet → 1 Dark Cabinet | 4 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Dark Wardrobe → 1 Dark Wardrobe | 7 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Dark Bedside Table → 1 Dark Bedside Table | 3 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Dark Panel → 4 Dark Panel | 1 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |
| Dark Patterned Panel → 4 Dark Patterned Panel | 2 Dark Planks | Carpentry Saw, Carpentry Chisel, Carpentry Plane, Carpentry Mallet | 3 | — |

### Compost

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Compost — Carrot Seeds → 1 Compost | 4 Leaves, 1 Carrot Seeds | — | 2 | — |
| Compost — Potato Seeds → 1 Compost | 4 Leaves, 1 Potato Seeds | — | 2 | — |
| Compost — Cabbage Seeds → 1 Compost | 4 Leaves, 1 Cabbage Seeds | — | 2 | — |
| Compost — Lettuce Seeds → 1 Compost | 4 Leaves, 1 Lettuce Seeds | — | 2 | — |
| Compost — Pepper Seeds → 1 Compost | 4 Leaves, 1 Pepper Seeds | — | 2 | — |
| Compost — Zucchini Seeds → 1 Compost | 4 Leaves, 1 Zucchini Seeds | — | 2 | — |
| Compost — Broccoli Seeds → 1 Compost | 4 Leaves, 1 Broccoli Seeds | — | 2 | — |
| Compost — Coffee Seeds → 1 Compost | 4 Leaves, 1 Coffee Seeds | — | 2 | — |
| Compost — Hemp Seeds → 1 Compost | 4 Leaves, 1 Hemp Seeds | — | 2 | — |

### Temple

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Offer fruit → 1 Devotion | 6 Fruit | — | 4 | — |
| Offer a harvest → 1 Devotion | 4 Carrots | — | 4 | — |
| Offer a meal → 1 Devotion | 2 Cooked Meat | — | 4 | — |
| Offer gold → 2 Devotion | 1 Gold | — | 4 | — |
| Light a candle → 1 Devotion | 1 Lantern | — | 4 | — |
| Holy Water → 2 Holy Water | 1 Glass, 1 Devotion | — | 4 | Building level 2 |
| Forge the White Ring → 1 White Ring | 3 Sunstone, 4 Gold, 12 Devotion | — | 4 | Building level 5; Choosing one ring closes the other |
| Forge the Black Ring → 1 Black Ring | 3 Nightstone, 4 Obsidian, 12 Devotion | — | 4 | Building level 5; Choosing one ring closes the other |
| Upgrade: Swift → 1 Swift Leather Boots | 1 Leather Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Swift → 1 Swift Iron Boots | 1 Iron Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Swift → 1 Swift Gold Boots | 1 Gold Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Swift → 1 Swift Diamond Boots | 1 Diamond Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Swift → 1 Swift Sky Boots | 1 Sky Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Swift → 1 Swift Dark Boots | 1 Dark Boots, 3 Devotion, 3 Coffee Beans | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Leather Tunic | 1 Leather Tunic, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Leather Leggings | 1 Leather Leggings, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Iron Cuirass | 1 Iron Cuirass, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Iron Greaves | 1 Iron Greaves, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Gold Cuirass | 1 Gold Cuirass, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Gold Greaves | 1 Gold Greaves, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Diamond Cuirass | 1 Diamond Cuirass, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Diamond Greaves | 1 Diamond Greaves, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Sky Cuirass | 1 Sky Cuirass, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Sky Greaves | 1 Sky Greaves, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Dark Cuirass | 1 Dark Cuirass, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Warded → 1 Warded Dark Greaves | 1 Dark Greaves, 4 Devotion, 2 Iron Ingot | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Leather Cap | 1 Leather Cap, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Iron Helm | 1 Iron Helm, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Gold Helm | 1 Gold Helm, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Diamond Helm | 1 Diamond Helm, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Sky Helm | 1 Sky Helm, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Night Sight → 1 Night Sight Dark Helm | 1 Dark Helm, 4 Devotion, 3 Jar of Fireflies | — | 4 | Building level 3 |
| Upgrade: Thunder → 1 Thunder Stone Sword | 1 Stone Sword, 5 Devotion, 3 Copper Ingot | — | 4 | Building level 3 |
| Upgrade: Thunder → 1 Thunder Iron Sword | 1 Iron Sword, 5 Devotion, 3 Copper Ingot | — | 4 | Building level 3 |
| Upgrade: Fire → 1 Fire Stone Sword | 1 Stone Sword, 5 Devotion, 2 Lantern | — | 4 | Building level 3 |
| Upgrade: Fire → 1 Fire Iron Sword | 1 Iron Sword, 5 Devotion, 2 Lantern | — | 4 | Building level 3 |
| Upgrade: Ice → 1 Ice Stone Sword | 1 Stone Sword, 5 Devotion, 3 Glass | — | 4 | Building level 3 |
| Upgrade: Ice → 1 Ice Iron Sword | 1 Iron Sword, 5 Devotion, 3 Glass | — | 4 | Building level 3 |

### University

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Foraging level 1 | 3 Planks, 2 Stone | — | 4 | Research takes game days |
| Foraging level 2 | 6 Planks, 4 Stone | — | 4 | Research takes game days |
| Foraging level 3 | 9 Planks, 6 Stone | — | 4 | Research takes game days |
| Foraging level 4 | 12 Planks, 8 Stone | — | 4 | Research takes game days |
| Foraging level 5 | 15 Planks, 10 Stone, 1 Gold | — | 4 | Research takes game days |
| Foraging level 6 | 18 Planks, 12 Stone, 2 Gold | — | 4 | Research takes game days |
| Foraging level 7 | 21 Planks, 14 Stone, 3 Gold | — | 4 | Research takes game days |
| Foraging level 8 | 24 Planks, 16 Stone, 4 Gold | — | 4 | Research takes game days |
| Foraging level 9 | 27 Planks, 18 Stone, 5 Gold | — | 4 | Research takes game days |
| Foraging level 10 | 30 Planks, 20 Stone, 6 Gold | — | 4 | Research takes game days |
| Building level 1 | 3 Planks, 2 Stone | — | 4 | Research takes game days |
| Building level 2 | 6 Planks, 4 Stone | — | 4 | Research takes game days |
| Building level 3 | 9 Planks, 6 Stone | — | 4 | Research takes game days |
| Building level 4 | 12 Planks, 8 Stone | — | 4 | Research takes game days |
| Building level 5 | 15 Planks, 10 Stone, 1 Gold | — | 4 | Research takes game days |
| Building level 6 | 18 Planks, 12 Stone, 2 Gold | — | 4 | Research takes game days |
| Building level 7 | 21 Planks, 14 Stone, 3 Gold | — | 4 | Research takes game days |
| Building level 8 | 24 Planks, 16 Stone, 4 Gold | — | 4 | Research takes game days |
| Building level 9 | 27 Planks, 18 Stone, 5 Gold | — | 4 | Research takes game days |
| Building level 10 | 30 Planks, 20 Stone, 6 Gold | — | 4 | Research takes game days |
| Athletics level 1 | 3 Planks, 2 Stone | — | 4 | Research takes game days |
| Athletics level 2 | 6 Planks, 4 Stone | — | 4 | Research takes game days |
| Athletics level 3 | 9 Planks, 6 Stone | — | 4 | Research takes game days |
| Athletics level 4 | 12 Planks, 8 Stone | — | 4 | Research takes game days |
| Athletics level 5 | 15 Planks, 10 Stone, 1 Gold | — | 4 | Research takes game days |
| Athletics level 6 | 18 Planks, 12 Stone, 2 Gold | — | 4 | Research takes game days |
| Athletics level 7 | 21 Planks, 14 Stone, 3 Gold | — | 4 | Research takes game days |
| Athletics level 8 | 24 Planks, 16 Stone, 4 Gold | — | 4 | Research takes game days |
| Athletics level 9 | 27 Planks, 18 Stone, 5 Gold | — | 4 | Research takes game days |
| Athletics level 10 | 30 Planks, 20 Stone, 6 Gold | — | 4 | Research takes game days |
| Politics level 1 | 3 Planks, 2 Stone | — | 4 | Research takes game days |
| Politics level 2 | 6 Planks, 4 Stone | — | 4 | Research takes game days |
| Politics level 3 | 9 Planks, 6 Stone | — | 4 | Research takes game days |
| Politics level 4 | 12 Planks, 8 Stone | — | 4 | Research takes game days |
| Politics level 5 | 15 Planks, 10 Stone, 1 Gold | — | 4 | Research takes game days |
| Politics level 6 | 18 Planks, 12 Stone, 2 Gold | — | 4 | Research takes game days |
| Politics level 7 | 21 Planks, 14 Stone, 3 Gold | — | 4 | Research takes game days |
| Politics level 8 | 24 Planks, 16 Stone, 4 Gold | — | 4 | Research takes game days |
| Politics level 9 | 27 Planks, 18 Stone, 5 Gold | — | 4 | Research takes game days |
| Politics level 10 | 30 Planks, 20 Stone, 6 Gold | — | 4 | Research takes game days |
| Engineering | 16 Planks, 16 Stone | — | 4 | Research takes game days |

### Bleach Bucket

| Recipe / result | Ingredients | Reusable tools | Age | Condition |
| --- | --- | --- | --- | --- |
| Wash White Stone → 2 White Stone | 2 Stone | — | 3 | — |
