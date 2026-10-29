# Buildings

Build a design from the Buildings panel, or build by hand and claim its region. A claim only works when its room, materials and location meet the checks shown in the game. The claim fee below is separate from the blocks in a ready-made design. Use the panel's material preview for the design you selected.

A building must be valid to work. Use Change it to repair or enlarge it. Evolve lists the next level's costs and work. Some requirements are met by adding actual blocks; others can be paid through Evolve. Quarry and mine levels follow the excavation. Saved houses keep their existing design.

## Work Hall and larger designs

The Work Hall unlocks at Age 1. Assign villagers as Builders or Haulers, and deposit supplies for them. Builders walk to queued designs and place paid blocks over time; haulers carry actual stacks to stores with space. Hunger, an obstructed route or a changed site pauses work. Work orders, reserved materials, hall supplies and carried goods save with the world.

The Timber homestead, Goods hall and Great workshop offer larger projects under the same claim types as their smaller counterparts. Cancel a queued build to recover its unspent materials. If your bag is full, the remainder stays available to collect later.

## Production and storage

Buildings produce while you play. Average output below is per **game day**, before settlers, skills, taxes and rounding. A game day lasts about fifteen minutes. Farms grow the crops planted in their panel; pens produce according to their animals. A granary stores harvest rather than growing it. A garrison trains spear guards on request rather than producing building materials.

Quarries supply plain Stone at every level. Use [processing stations](crafting.md) to make finished stone. The Mine has five levels: copper, iron, gold, faster deep workings, then diamonds with Sunstone and Nightstone. Place a ready-made mine to get its deep shaft and staircase.

The Granary accepts farm produce and seeds with one growing stack per item kind and no fixed stack limit. Put it all in reports items it cannot accept. The Storage Controller combines storehouse access; place a Storage Interface directly on top of it for a directory of the individual stores and their contents.

## Building reference

Generated from current building definitions by `node scripts/update-wiki.mjs`. Level numbers here start at 1. The in-game panel gives the remaining geometry and material requirements for your actual building.

### Work Hall

Give villagers building and hauling jobs, and leave supplies for them to carry.

- Available from Age 1; claim region 4–16 blocks on a side.
- Claim fee: None.

See the building panel for its purpose and claim requirements.

### Forest

Standing trees that keep giving, instead of a stump you cut once.

- Available from Age 1; claim region 4–16 blocks on a side.
- Claim fee: None.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Forest | 4 Wood, 0.8 Leaves, 0.8 Fruit | — | None |
| 2 | Tended Forest | 6.4 Wood, 1.6 Leaves, 1.6 Fruit | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Forest | 10.4 Wood, 2.4 Leaves, 2.4 Fruit | — | 20 Planks, 15 Coins |
| 4 | Renowned Forest | 14.4 Wood, 3.2 Leaves, 3.2 Fruit | — | 4 Iron Ingot, 40 Coins |

### Farm

Turned soil beside fresh water. Put a seed in for each crop you want — up to four — and it grows them.

- Available from Age 1; claim region 2–16 blocks on a side.
- Claim fee: None.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Farm | Planted crops; ×1 yield | — | None |
| 2 | Tended Farm | Planted crops; ×1.5 yield | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Farm | Planted crops; ×2.5 yield | — | 20 Planks, 15 Coins |
| 4 | Renowned Farm | Planted crops; ×3.5 yield | — | 4 Iron Ingot, 40 Coins |

### House

Somewhere to sleep. Later, somewhere for a settler to sleep.

- Available from Age 1; claim region 4–16 blocks on a side.
- Claim fee: None.
- Adds housing capacity: 1.

See the building panel for its purpose and claim requirements.

### Quarry

A hole you dig into rock, open to the sky.

- Available from Age 3; claim region 4–16 blocks on a side.
- Claim fee: None.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | A Scrape | 2.4 Stone | — | None |
| 2 | A Working Face | 2.5 Stone | — | None |
| 3 | A Deep Dig | 2.62 Stone | — | None |
| 4 | A Quarry Face | 2.74 Stone | — | None |
| 5 | An Open Pit | 2.88 Stone | — | None |

### Pen

A fence with a gate, and animals inside it. Lead them in with food in your hand, then shut the gate.

- Available from Age 3; claim region 3–16 blocks on a side.
- Claim fee: None.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Pen | Animals in the pen; ×1 yield | — | None |
| 2 | Tended Pen | Animals in the pen; ×1.5 yield | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Pen | Animals in the pen; ×2.5 yield | — | 20 Planks, 15 Coins |
| 4 | Renowned Pen | Animals in the pen; ×3.5 yield | — | 4 Iron Ingot, 40 Coins |

### Storehouse

Shelves that are not your back. Build it bigger and it holds more.

- Available from Age 3; claim region 3–16 blocks on a side.
- Claim fee: None.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Shelves | — | 200 | None |
| 2 | Loft | — | 240 | None |
| 3 | Warehouse | — | 280 | None |

### Workshop

A room with a bench in it. Stand here and you can make what your hands cannot.

- Available from Age 4; claim region 4–16 blocks on a side.
- Claim fee: None.
- Crafting station: Workshop.

Craft recipes here.

### University

Desks under a roof. Study here to get better at what you do — and to learn engineering.

- Available from Age 4; claim region 4–16 blocks on a side.
- Claim fee: None.
- Crafting station: University.

Craft recipes here.

### Engineering Centre

A long hall with a wide door. Where carts, flying machines and trains will be worked out.

- Available from Age 4; claim region 5–20 blocks on a side.
- Claim fee: None.
- Crafting station: Engineering.

Craft recipes here.

### Kiln

Earth and sand go in. Brick and glass come out.

- Available from Age 4; claim region 3–8 blocks on a side.
- Claim fee: 6 Cobblestone.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Kiln | 1.2 Brick, 1.2 Glass | — | None |
| 2 | Tended Kiln | 2.4 Brick, 2.4 Glass | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Kiln | 3.6 Brick, 3.6 Glass | — | 20 Planks, 15 Coins |
| 4 | Renowned Kiln | 4.8 Brick, 4.8 Glass | — | 4 Iron Ingot, 40 Coins |

### Market

Somewhere the things your buildings make change hands.

- Available from Age 5; claim region 6–20 blocks on a side.
- Claim fee: 10 Planks.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Market | 2.4 Carrots, 2.4 Fruit, 2.4 Planks | — | None |
| 2 | Tended Market | 4.8 Carrots, 4.8 Fruit, 4.8 Planks | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Market | 7.2 Carrots, 7.2 Fruit, 7.2 Planks | — | 20 Planks, 15 Coins |
| 4 | Renowned Market | 9.6 Carrots, 9.6 Fruit, 9.6 Planks | — | 4 Iron Ingot, 40 Coins |

### Town Hall

Where the town keeps its accounts. Comes with a storage controller that reaches every storehouse.

- Available from Age 5; claim region 7–20 blocks on a side.
- Claim fee: 8 Planks, 2 Glass, 4 Brick.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Town Hall | 2.4 Coins | — | None |
| 2 | Tended Town Hall | 4.8 Coins | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Town Hall | 7.2 Coins | — | 20 Planks, 15 Coins |
| 4 | Renowned Town Hall | 9.6 Coins | — | 4 Iron Ingot, 40 Coins |

### Townhouse

More roof than one family needs, so more than one family lives under it.

- Available from Age 5; claim region 6–16 blocks on a side.
- Claim fee: 16 Planks.
- Adds housing capacity: 3.

See the building panel for its purpose and claim requirements.

### Tavern

Somewhere to eat, drink and hear the news. Small coin changes hands too.

- Available from Age 5; claim region 5–14 blocks on a side.
- Claim fee: 8 Planks, 4 Brick.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Tavern | 2 Gold | — | None |
| 2 | Tended Tavern | 4 Gold | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Tavern | 6 Gold | — | 20 Planks, 15 Coins |
| 4 | Renowned Tavern | 8 Gold | — | 4 Iron Ingot, 40 Coins |

### Foundry

A hotter fire than the kiln keeps — hot enough to run ore.

- Available from Age 5; claim region 4–12 blocks on a side.
- Claim fee: 8 Cobblestone.
- Crafting station: Foundry.

Craft recipes here.

### Mine

Everything easy is above ground. This is not above ground.

- Available from Age 5; claim region 4–16 blocks on a side.
- Claim fee: 8 Planks.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | A Shaft | 2 Copper Ore, 2 Stone, 2 Coal | — | None |
| 2 | A Drift | 2 Copper Ore, 2 Iron Ore, 2 Stone, 2 Coal | — | None |
| 3 | A Gold Gallery | 2 Copper Ore, 2 Iron Ore, 2 Gold Ore, 2 Stone, 2 Coal | — | None |
| 4 | Deep Workings | 2.4 Copper Ore, 2.4 Iron Ore, 2.4 Gold Ore, 2.4 Stone, 2.4 Coal | — | None |
| 5 | A Diamond Seam | 2.4 Copper Ore, 2.4 Iron Ore, 2.4 Gold Ore, 2.4 Diamond, 2.4 Sunstone, 2.4 Nightstone, 2.4 Stone, 2.4 Coal | — | None |

### Granary

A dry room full of what the farms grew, so a bad season is not a crisis.

- Available from Age 7; claim region 4–12 blocks on a side.
- Claim fee: 8 Carrots.

Harvest storage.

### Garrison

Walls with people behind them. Nothing has tested them yet, and that is rather the point.

- Available from Age 8; claim region 6–18 blocks on a side.
- Claim fee: 20 Stone, 10 Planks.

Train guards in the building panel.

### Stone Wall

A length of wall with a walk along the top and battlements to fight from. Claimed, it takes three blows a block to break.

- Available from Age 8; claim region 2–32 blocks on a side.
- Claim fee: None.

See the building panel for its purpose and claim requirements.

### Gatehouse

Two towers and a gate between them, with a walk across the top. It shuts its gate when a round of the war is coming.

- Available from Age 8; claim region 7–16 blocks on a side.
- Claim fee: 2 Iron Ingot.

See the building panel for its purpose and claim requirements.

### Watchtower

A tall tower with a lookout on top. Two archers keep watch from it and shoot at anything of the Stone Kingdom's that comes in range.

- Available from Age 8; claim region 5–9 blocks on a side.
- Claim fee: 6 Planks.

See the building panel for its purpose and claim requirements.

### Barracks

A hall with arms on the walls and a yard to train in. Train warriors, swordsmen, archers and catapult crews here for food and gear — they go out to meet the Stone Kingdom's army. It holds 10 soldiers; evolve it to a Drill Hall for 20 (4 weapon racks, 4 dummies or targets, 6 iron ingots and 20 planks) and a Fortress Barracks for 40 (8 and 8, 12 iron ingots, 40 planks). Beds are only furniture.

- Available from Age 8; claim region 7–18 blocks on a side.
- Claim fee: 4 Iron Ingot, 10 Planks.

See the building panel for its purpose and claim requirements.

### Village

A forest, a farm, housing and a shed, folded into one claim — everything a start needs, raised at once.

- Available from Age 10; claim region 14–28 blocks on a side.
- Claim fee: 20 Wood, 4 Carrot Seeds, 4 Potato Seeds.
- Adds housing capacity: 3.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | Humble Village | 3 Wood, 1 Leaves, 1 Carrots, 1 Carrot Seeds | — | None |
| 2 | Tended Village | 5 Wood, 2 Leaves, 2 Carrots, 2 Carrot Seeds | — | 12 Planks, 8 Cobblestone |
| 3 | Thriving Village | 8 Wood, 3 Leaves, 3 Carrots, 3 Carrot Seeds | — | 20 Planks, 15 Coins |
| 4 | Renowned Village | 11 Wood, 4 Leaves, 4 Carrots, 4 Carrot Seeds | — | 4 Iron Ingot, 40 Coins |

### Monument

Nothing useful. That is the point of it.

- Available from Age 10; claim region 7–24 blocks on a side.
- Claim fee: 4 Gold.

See the building panel for its purpose and claim requirements.

### Temple

Somewhere to pray. Offerings and worshippers turn into devotion, and devotion into blessings.

- Available from Age 4; claim region 4–20 blocks on a side.
- Claim fee: 1 Gold.
- Crafting station: Temple.

| Level | Name | Average output / game day | Storage slots | Level fee |
| --- | --- | --- | --- | --- |
| 1 | A Shrine | 0.8 Devotion | — | None |
| 2 | A Chapel | 1.2 Devotion | — | 3 Devotion |
| 3 | A Temple | 1.6 Devotion | — | 8 Devotion |
| 4 | A Great Temple | 2.4 Devotion | — | 15 Devotion |
| 5 | The High Temple | 3.2 Devotion | — | 25 Devotion |

### White Sanctuary

Open marble and light, under the sky. Raising it calls the white guardian — a great stag of light.

- Available from Age 4; claim region 5–16 blocks on a side.
- Claim fee: 10 Devotion.

See the building panel for its purpose and claim requirements.

### Black Sanctuary

Obsidian round a pit. Raising it calls the black guardian — a beast of shadow.

- Available from Age 4; claim region 5–16 blocks on a side.
- Claim fee: 10 Devotion.

See the building panel for its purpose and claim requirements.
