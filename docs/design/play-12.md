# PLAY-12: weapons research and army organisation

Owner's note, 22 November (`docs/TASKS.md` section 14): "Military buildings: weapons research and army organisation." No longer wording exists in `docs/` or `docs/history/`.

Summary. Two new buildings. The Armoury (Age 8) researches arms, one piece at a time, each piece taking 2 to 4 game days. Research makes your soldiers stronger: better swords, better arrows, sturdier guards, faster catapults. The War Hall (Age 9) shows every company of soldiers in one list and adds one new order, March: a company leaves its barracks, walks to a rival city for a game day, fights its garrison, and comes back. Each barracks or Garrison stays one company. Mixed squads across buildings wait for a later version.

This is a design only. No game code changes on this branch.

## What exists today

| Part | File | What it does |
|---|---|---|
| Garrison (`military`) | `src/config/structures.js:999` | Age 8. Trains spear guards. Holds 10, 20, 40 by level. |
| Barracks | `src/config/structures.js:1188` | Age 8. Trains warriors, swordsmen, archers, catapult crews. Holds 10, 20, 40. Needs 2 weapon racks, 2 dummies or targets, sheltered volume 30. |
| Units | `src/config/soldiers.js` | 5 units with fixed `hp`, `melee`/`ranged`/`siege` stats, and a food and gear price paid at training. |
| Soldiers | `src/world/Defenders.js` | Trained one every `TRAIN_DAYS` 0.15 day. Stay within `leash` 22 blocks of their building. Orders per building: Defend, Patrol, Formation (IMP-37). Saved as `{ trained, orders }`. |
| Research | `src/duilt/DuiltGame.js:217-340` | The University runs one study at a time (`studying`). `research` holds what is learnt; today only `engineering`. `researchDays(r)` is 1 + level. The loader keeps only `engineering` (`DuiltGame.js:2294`). |
| Research UI | `src/ui/DuiltUI.js:2445-2475` | A recipe with `study` draws as a Research tile with "Takes N days" and a progress bar. |
| Rivals | `src/duilt/Rivals.js` | Battle worlds only. 3 rival cities, strength 2 to 12, armies come once your first barracks stands. You take a city's standard on foot after beating its guards (`garrison(r)` = 2 + strength). Tribute 6 + 2 x strength gold. |
| War (White path) | `src/config/war.js` | Ten Rounds at your walls from Age 10. Soldiers defend. |
| Army (dark path) | `src/world/Army.js` | A count of 1,000, 30 on the field, command wheel follow, hold, attack, line. March on the Sky Kingdom in 2 days. |
| Weapon tiers | `src/config/tiers.js` | Sword damage: stone 6, iron 9, gold 10, sky 12, dark 13, diamond 15. Iron Age 5, gold Age 8, sky, dark and diamond Age 10. |

Two facts shape the design:

1. A soldier's strength is fixed by its unit. A warrior hits 3 with a stone sword. A player with a stone sword hits 6. Research is the lever that is missing.
2. Soldiers never leave their building. Taking a rival city is the player's job alone. "Attack" is the order that is missing.

## Decisions

1. Weapons research happens at a new building, the Armoury. The University keeps skills and engineering. Each building has its own slot, so research there never blocks skill study.
2. Research reuses the University machinery: a recipe with `study`, paid at the start, learnt after `researchDays` game days, one at a time per building.
3. Research applies to every soldier of that unit, old and new, from the day it is learnt. Rosters stay a list of unit ids. No soldier needs rearming. (Open question 1.)
4. Arms research changes the unit's gear price and its blow. The blow is half the sword's damage, rounded: stone 6 gives 3 (today's warrior), iron 9 gives 5 (today's swordsman), sky 12 gives 6, dark 13 gives 7, diamond 15 gives 8.
5. Each barracks or Garrison is one company. Its roster, cap and order stay as they are. The War Hall lists all companies and gives orders from one place.
6. One new order, March, sends a whole company to a rival city. The battle there is worked out by numbers when it arrives. The player does not have to be there.
7. One company may be on the march at a time. That keeps tribute under the house rule (see Balance).
8. March exists in Battle worlds only in the first version, because rival cities exist only there. (Open question 3.)
9. No Age goal changes. Both buildings are optional, like the Work Hall (`optional: true`). Age 8 and 9 already have 4 goals each.
10. One new block, the War Table. The Armoury uses blocks that exist: Forge (525), Weapon Rack (212-215), tables (31, 32).

## Weapons research

### The Armoury

| Field | Value |
|---|---|
| id | `armoury` |
| name | Armoury |
| icon | `🗡️` |
| age | 8 (Bastion, with the Garrison and Barracks) |
| optional | true |
| size | min 6, max 14 |
| cost | iron_ingot 4, planks 12 |
| station | `armoury` |
| skill | `politics`, as every defence building |

Requirements, checked in order:

| id | Test | Hint |
|---|---|---|
| `shell` | stone, cobble or brick >= 60 | "Needs N more stone, cobble or brick: arms are kept behind stone" |
| `forge` | Forge block (525) >= 1 | "Needs a forge inside to try the arms" |
| `arms` | weapon racks >= 2 | "Needs N more weapon racks" |
| `plans` | tables (31, 32) >= 1 | "Needs a table to draw the plans on" |
| `room` | sheltered volume >= 20 | "Needs a hall: walls all round and a roof over it" |

Levels (the `tiers` pattern of the barracks):

| Level | Name | Cost | Needs | Gives |
|---|---|---|---|---|
| 1 | An Armoury | | | one research slot |
| 2 | A Master Armoury | iron_ingot 8, planks 20 | 4 weapon racks, 2 lights | research takes 25% less time |

Level 2 is in the later version.

### The research list

Each row is a recipe at station `armoury` with `study: <id>` and `level`. Time is `researchDays(r)` = 1 + level, the University's rule, in game days (a game day is about 20 minutes of play).

First version, 5 pieces:

| id | Name | Age | Level | Days | Cost | Needs | Effect |
|---|---|---|---|---|---|---|---|
| `arms_iron` | Iron Arms | 8 | 1 | 2 | iron_ingot 8, planks 8 | | Warriors train with an iron sword in place of a stone one. Warrior blow 3 to 5. |
| `fletching` | Fletching | 8 | 1 | 2 | planks 12, string 8, feather 8 | | Archers and watchtower archers: damage 3 to 4, range 20 to 24. |
| `shield_drill` | Shield Drill | 9 | 2 | 3 | iron_ingot 6, leather 6, planks 6 | | Swordsmen hp 32 to 40, spear guards hp 30 to 38. |
| `siege_works` | Siege Works | 9 | 2 | 3 | planks 20, stone 20, iron_ingot 4 | `research.engineering` | Catapult crews: a stone every 6 s to 4.5 s, setup 4 s to 2.5 s. |
| `arms_ring` | Sky Arms or Dark Arms | 10 | 3 | 4 | sky_marble 6, gold 4 (White Ring); dark_stone 6, iron_ingot 4 (Black Ring) | a forged ring | Swordsmen train with a sky sword (blow 6) or dark sword (blow 7). Gear price becomes that sword plus the iron cuirass. |

Later version:

| id | Name | Age | Level | Days | Effect |
|---|---|---|---|---|---|
| `arms_diamond` | Diamond Arms | 11 | 4 | 5 | Swordsmen train with a diamond sword, blow 8. |
| `crossbows` | Crossbows | 10 | 3 | 4 | A new unit, the Crossbowman (range 26, damage 6, every 3 s), and two new items, crossbow and bolt. |
| `forced_march` | Forced March | 10 | 3 | 4 | March takes 0.6 day each way, not 1. |
| `cavalry` | Cavalry | 11 | 4 | 5 | A new unit, the Rider, trained with a horse from a pen. |

Rules:

- Only the next piece whose `needs` and age are met is offered; learnt pieces are hidden (`studyHidden`, extended per station).
- `arms_ring` follows the `ring` recipe rule: the other ring's version is locked with the existing message.
- The dark path's 1,000 warriors (`Army.js`) are the Stone King's, so research does not touch them. (Open question 6.)
- Sandbox: done at once, as the University.
- No piece makes an item. PLAY-11 asks for one way per item; research adds none.

### How effects reach the soldiers

A new pure function in `src/config/soldiers.js`:

```js
export function unitStats(unit, research) // -> the unit with hp, melee, ranged, siege and gear adjusted
```

`Defenders` takes `research` in `sync` and calls `unitStats` wherever it now reads `UNITS_BY_ID.get(s.unit)`. `unitCost` and `payForUnit` take the adjusted gear. Watchtower archers read `TOWER_ARCHER` through the same function for `fletching`.

## Army organisation

### Companies

A company is the soldiers of one barracks or Garrison. Its name is the building's name and number: "Barracks 1", "Garrison 2". Roles come from the units it holds: melee (warrior, swordsman, spear guard), ranged (archer), siege (crew).

A company's power, shown as one number in the War Hall:

```
power(unit) = hp x blow / every      (melee)
            = 2 x hp x damage / every (ranged: range doubles it)
            = 60                       (siege crew)
```

| Unit | Power today | With research |
|---|---|---|
| Warrior | 20 x 3 / 1.1 = 55 | 91 (Iron Arms) |
| Swordsman | 32 x 5 / 1 = 160 | 200 (Shield Drill); with Shield Drill, 240 (Sky Arms) or 280 (Dark Arms) |
| Spear guard | 30 x 4 / 1.25 = 96 | 122 (Shield Drill) |
| Archer | 2 x 14 x 3 / 2 = 42 | 56 (Fletching) |
| Catapult crew | 60 | 80 (Siege Works) |
| Rival soldier (`wanderers.js:264`) | 24 x 3 / 1.2 = 60 | |

Hungry soldiers count at `HUNGRY_STRENGTH` 0.6.

### Orders

| Order | Exists | What it does |
|---|---|---|
| Defend | yes | Posts round the building (IMP-37). |
| Patrol | yes | One melee soldier walks the village loop. |
| Formation | yes | Lined up in front of the building. |
| March | new, first version | The whole company walks to a rival city, fights its garrison, and comes back. Needs a War Hall. Battle worlds only. |
| Hold | later | Stand round a map pin inside your border. |

### March

1. In the War Hall, tap March on a company. Pick one of the 3 rivals. Each row shows its strength, its guards (`garrison(r)`), and the forecast: "Win, about 3 fall" or "Loss".
2. The company leaves at once. Its soldiers walk off the field. They still count against the building's cap and still eat (`Settlers` counts `residents`).
3. After `MARCH_DAYS` 1 game day it arrives. The battle resolves:
   - `theirs` = guards x 60 (rival soldier power).
   - Win when `ours >= 1.25 x theirs`. The rival is conquered (`Rivals.conquer`): tribute 6 + 2 x strength gold, city fallen for `FALL_DAYS` 3.
   - Losses on a win: `ceil(roster x 0.5 x theirs / ours)` soldiers, the weakest first, at least 1.
   - A loss: 60% of the company falls, the rest come home. The rival gains `WON` 0.5 strength.
   - A fallen city (already conquered) refuses the march: "Rival 2's city is yours until day N."
4. The survivors walk home for 1 more game day, then take their posts with the building's order.
5. A notice and a toast at each step: "Barracks 1 marched on Ashford", "Barracks 1 took Ashford: 18 gold, 3 fell", "Barracks 1 is home".
6. If the building is broken or unclaimed while they are away, the survivors join the nearest barracks or Garrison with room, or are lost.

The forecast runs the same formula, so it is exact while nothing changes before arrival. Rival strength grows 0.6 a day (`GROWTH`), so a forecast near 1.25x can turn into a loss on the way; the row says "Close" from 1.25x to 1.4x.

The player can still take a standard on foot, as today. March is the second way, for a player who would rather stay home.

Later version: the player standing within 100 blocks of the city when the company arrives fights alongside them live, with up to 30 soldiers on the field (the `Army` field pattern), in place of the numbers.

### The War Hall

| Field | Value |
|---|---|
| id | `war_hall` |
| name | War Hall |
| icon | `🗺️` |
| age | 9 (Walls) |
| optional | true |
| size | min 6, max 14 |
| cost | gold 4, planks 12 |
| skill | `politics` |

Requirements:

| id | Test | Hint |
|---|---|---|
| `shell` | `WALLING` >= 70 | "Needs N more stone, cobble, brick or dark stone" |
| `table` | War Table (block 571) >= 1 | "Needs a war table to plan on" |
| `banners` | `BANNERS` (182-189) >= 2 | "Needs N more banners on the walls" |
| `lights` | `LIGHTS` >= 2 | "Needs N more lights to read the maps by" |
| `room` | sheltered volume >= 24 | "Needs a hall: walls all round and a roof over it" |

One War Hall is enough. A second one adds nothing in the first version.

### The War Table (new block)

| Field | Value |
|---|---|
| block id | 571 (556-570 are taken by the mushroom work; 572 is spare) |
| item | `war_table`, refined, stackTo 10 |
| recipe | hand, Age 9, planks 6, string 2, gold 1 |
| shape | `PROP_SHAPES.war_table`, 9 boxes |

Look, front is -z, unit cell:

| Part | x | y | z | Colour |
|---|---|---|---|---|
| 4 legs | 0.06 thick at the corners | 0-0.7 | | `0x7a5636` |
| Top | 0.04-0.96 | 0.7-0.78 | 0.04-0.96 | `0x8a6440` |
| Map | 0.1-0.9 | 0.78-0.79 | 0.1-0.9 | `0xd9c79a` parchment |
| Your figure | 0.2-0.3 | 0.79-0.9 | 0.6-0.7 | `0x3b5fa8` |
| Rival figure | 0.65-0.75 | 0.79-0.9 | 0.25-0.35 | `0x9a2c2c` |
| Rival figure | 0.45-0.55 | 0.79-0.9 | 0.4-0.5 | `0x9a2c2c` |

No light. Icon: drawn from the prop shape by `blockIcon`.

## The buildings' look (starter designs)

Both get a starter design in `src/config/starterDesigns.js`, as every building has (`starter_barracks` is 13 x 14).

Armoury, `starter_armoury`, 9 x 7, 6 tall:

- Cobblestone walls, brick quoins at the 4 corners, a slate gable roof (`SLATE`) running the long way.
- A Forge (525) at the east end with a brick chimney (331) through the roof.
- An open bay on the front, 3 wide, with 2 weapon racks on its back wall.
- An oak table with a lantern by the west wall.
- A training dummy outside the bay, which is decoration: the Armoury does not need it.
- Note: "Research arms here, one at a time. Each piece takes days."

War Hall, `starter_war_hall`, 9 x 9, 7 tall:

- Stone brick walls, a hip roof in dark tiles, a double door on the front.
- 2 banners either side of the door, in the ring's colour where one is forged (white 182, black 186).
- The War Table in the middle, 2 chandeliers or lanterns over it.
- Note: "Every company in one place. Send one to march from here."

## UI

### Armoury pop-up

The existing building pop-up (`DuiltUI.buildingBodyHtml`). The research list is `stationRecipesHtml` for station `armoury`, which already draws study recipes as Research tiles with cost, "Takes N days", and the progress bar. New: a line above the list, "Learnt: Iron Arms, Fletching", and the effect sentence on each tile from its `blurb`.

| | Phone (under 900 px) | Desktop (`DESKTOP_QUERY`, 900 px and a mouse) |
|---|---|---|
| Layout | One column, tiles 2 to a row (`.train-units` grid) | Movable pop-up (`PanelWindows`), tiles 3 to a row |
| Busy | The running piece pinned on top with its bar | Same |
| Tap a tile | Pays and starts; a toast "Iron Arms: 2 days" | Same, or click |

### War Hall pop-up

One card per company, in building order.

Card contents:

- Name and level: "Barracks 1 · Drill Hall".
- Counts by unit: "6 swordsmen, 4 archers · 10 of 20".
- Power: a number and a bar against the strongest rival's garrison.
- State: "At home: Defend", "Marching to Ashford: arrives in 12 min", "Coming home: 8 min".
- Order buttons: Defend, Patrol, Formation, March. The first three call the existing `Game.setSoldierOrder` path (`Game.js:3489`).

March opens a picker inside the same pop-up: 3 rival rows with name, colour dot, strength, guards, forecast, and a Send button. A fallen or out-of-reach rival row is greyed with its reason.

| | Phone | Desktop |
|---|---|---|
| Cards | Stacked, full width. Order buttons in a 4-column grid, 44 px tall. | 2 cards a row in a pop-up 720 px wide. |
| Picker | Replaces the card list; a Back button on top. | Opens beside the card. |
| Width | No horizontal scroll at 360 px. | |

The barracks pop-up keeps its own order buttons. It gains March only when a War Hall stands, and shows "On the march" while the company is away.

## How it fits what exists

| System | Change |
|---|---|
| Ten Rounds (White path) | Research makes soldiers stronger at home. March does not target the Stone Kingdom. |
| Dark path army | Unchanged. |
| Rivals | `Rivals.conquer` and `Rivals.resolve` are called by the march result. Their armies keep coming while a company is away, so sending one weakens home. |
| Rival city on foot | Unchanged. A conquered city refuses both. |
| Food | Marching soldiers eat as residents. No extra ration. |
| Settler jobs, politics | Unchanged. PLAY-13 (anger) may later count soldiers lost. |
| PLAY-11 factory | Research makes no items, so the factory has nothing to automate here. |

## Save format

All fields are additive. Old saves load with the defaults. No `agesVersion` bump.

| Where | Field | Shape | Default |
|---|---|---|---|
| `DuiltGame.toJSON` | `research` | `{ engineering: true, arms_iron: true, ... }` | `{}` |
| `DuiltGame.toJSON` | `armouryStudy` | `{ id, name, started, days } \| null`, same as `studying` | `null` |
| `Defenders.toJSON` | `marches` | `[{ of, units: ['swordsman', ...], rival, since, arrives, home, result }]` | `[]` |

Loader rules:

- `research`: keep only ids in `RESEARCH_IDS` (engineering plus the armoury list) whose value is `true`. Today's loader keeps engineering alone (`DuiltGame.js:2294`) and must change.
- `armouryStudy`: dropped when its id is unknown.
- `marches`: units filtered with `UNITS_BY_ID`, as rosters are. In a world with no `battle`, a march loads as already home: its units go back to their roster.
- Room at a building counts `roster + queue + away`, so a company on the march never frees bunks.

## Balance

House rule (`structures.js:190`): no building hands out more than 10 to 15 of anything a day.

| Source | Most per day |
|---|---|
| March tribute | 1 company out at a time, 2 days a round trip, tribute at most 6 + 2 x 12 = 30 gold. 15 gold a day at most. |
| Armoury | Makes nothing. |

What research costs against what the player has:

| Piece | Cost | Age it is affordable |
|---|---|---|
| Iron Arms | iron_ingot 8 | Age 8: foundry since Age 5 |
| Fletching | string 8, feather 8 | Age 8: Spinning Wheel, chickens |
| Shield Drill | leather 6, iron_ingot 6 | Age 9: Tanning Vat, PLAY-9 |
| Siege Works | stone 20, planks 20, iron_ingot 4 | Age 9 |
| Sky or Dark Arms | sky_marble 6 or dark_stone 6 | Age 10 |

All 5 pieces take 2 + 2 + 3 + 3 + 4 = 14 game days, about 4.7 hours of play, which spreads them over Ages 8 to 10.

Worked battles:

| Company | Ours | Rival strength 4 (6 guards, 360) | Strength 8 (10 guards, 600) | Strength 12 (14 guards, 840) |
|---|---|---|---|---|
| 10 warriors, no research | 550 | win (1.53x), 4 fall | loss | loss |
| 10 warriors, Iron Arms | 910 | win, 2 fall | win (1.52x), 4 fall | loss (1.08x) |
| 10 swordsmen | 1,600 | win, 2 fall | win, 2 fall | win, 3 fall |
| 20 swordsmen, Shield Drill and Sky Arms | 4,800 | win, 1 falls | win, 1 falls | win, 1 falls |

A first barracks at Age 8 can take a weak rival. A Drill Hall of swordsmen takes any. A swordsman costs 4 food, an iron sword and a cuirass, so 3 losses a march is a real price.

## Implementation chunks

Each chunk is one PR with its tests. Chunks 1 to 4 are the first version.

### 1. Definitions

| File | Change |
|---|---|
| `src/config/blocks.js` | `WAR_TABLE = 571`, prop block, material wood |
| `src/config/items.js` | `war_table` item, PLAY-12 block at the end |
| `src/config/recipes.js` | `war_table` recipe, PLAY-12 block at the end |
| `src/world/propShapes.js` | `PROP_SHAPES.war_table`, 9 boxes |
| `src/config/structures.js` | `armoury` and `war_hall` entries after `barracks` |
| `src/config/starterDesigns.js` | `starter_armoury`, `starter_war_hall` |
| `tests/war-buildings.test.mjs` | new: both structures, requirement order and hints, starter designs pass their own claim |

Checks that must stay green: `shapes`, `collection`, `one-name-per-item`, `itemchips`, `blockjoins`, `station-own-recipes`.

### 2. Armoury research

| File | Change |
|---|---|
| `src/config/research.js` | new: `RESEARCH` list (id, name, age, level, cost, needs, ring, effect words), `RESEARCH_IDS` |
| `src/config/recipes.js` | study recipes at `armoury` generated from `RESEARCH` |
| `src/duilt/DuiltGame.js` | a slot per station (`studying` for the University, `armouryStudy` for the Armoury); `locked`, `studyHidden`, `startStudy`, `finishResearch`, `study` read the station; save and load |
| `src/ui/DuiltUI.js` | "Learnt" line; the busy message names the Armoury |
| `tests/armoury-research.test.mjs` | new: offered order, ages, ring lock, engineering need, days 2/2/3/3/4, University and Armoury run at once, sandbox instant, save round trip, unknown ids dropped, an old save with only engineering loads |

### 3. Research effects

| File | Change |
|---|---|
| `src/config/soldiers.js` | `unitStats(unit, research)`; `unitCost` and `payForUnit` take research |
| `src/world/Defenders.js` | `sync` takes `research`; blows, hp, arrows and catapults read `unitStats`; `TOWER_ARCHER` through `fletching` |
| `src/duilt/DuiltGame.js` | `trainSoldier` passes research |
| `src/ui/DuiltUI.js` | barracks prices from `unitCost` with research |
| `tests/soldier-research.test.mjs` | new: each effect row of the table; a warrior's price is an iron sword after Iron Arms; hp change applies to soldiers already trained; hungry still 0.6 |

### 4. War Hall and March

| File | Change |
|---|---|
| `src/duilt/marchBattle.js` | new, pure: `companyPower(units, research, hungry)`, `forecast(ours, theirs)`, `resolve(ours, theirs, roster)` returning `{ won, lost: [unitIds] }` |
| `src/world/Defenders.js` | `marches`; `march(of, rival, days)`; `tickMarches(days)` returns arrivals and homecomings; away soldiers off the field; room and `residents` count away soldiers, so they keep their bunk and eat |
| `src/duilt/DuiltGame.js` | `marchCompany(structure, rivalId)` with its refusals (no War Hall, not Battle, one already out, empty, fallen city); applies `Rivals.conquer` or `resolve`; gold to the bag |
| `src/Game.js` | per-frame tick, notices and toasts |
| `src/ui/DuiltUI.js` | `warHallHtml`, the rival picker, March in the barracks pop-up |
| `src/ui/styles.css` | `.company-card`, `.rival-pick`, phone and desktop rules |
| `tests/march-battle.test.mjs` | new: the worked battles table exactly; forecast words and the Close band; losses at least 1 on a win; 60% on a loss |
| `tests/war-hall.test.mjs` | new: refusals; one march at a time; arrive after 1 day, home after 2; tribute at most 30; cap counts away soldiers; broken barracks moves survivors; save round trip; non-Battle load sends them home |
| `tests/war-hall-browser.mjs` | new: 360 px and 1280 px widths, no horizontal scroll, 4 order buttons, picker opens and Back returns |

### 5. Later version

Master Armoury level, Diamond Arms, Crossbows, Forced March, Cavalry, the Hold order at a pin, live battles when the player is there, mixed squads across buildings, March on Age 11 outposts and tribes in non-Battle worlds.

### 6. Docs

`docs/wiki/buildings.md`: Armoury and War Hall entries. `docs/TASKS.md`: PLAY-12 row, by whoever integrates.

## First version scope

- Armoury with 5 research pieces: Iron Arms, Fletching, Shield Drill, Siege Works, Sky or Dark Arms.
- Effects on every soldier through `unitStats`.
- War Hall with company cards and the existing 3 orders.
- March to a rival city in Battle worlds, resolved by numbers, one company at a time.
- War Table block 571.
- Chunks 1 to 4, about 9 new test files.

## Open questions for the owner

1. Research upgrades soldiers already trained, free. Or only soldiers trained after it, which needs a tag on each roster entry?
2. Armoury at Age 8 with the barracks, or earlier at Age 5 with the foundry so iron arms come before the rivals?
3. March outside Battle worlds: on Age 11 outposts and tribes, or on the Stone Kingdom during the Ten Rounds?
4. March resolved by numbers while you stay home, or must the player go with the company?
5. Is a company per building enough, or do you want mixed squads picked soldier by soldier?
6. Should research also strengthen the dark path's 1,000 warriors?
7. Are the names Armoury and War Hall right?
8. One company on the march at a time, or one per War Hall level?
