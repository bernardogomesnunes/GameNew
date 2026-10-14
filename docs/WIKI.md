# Duilt Wiki

The full guide to the game in this repository: what you can build, craft and use, how each system works, and how the game came to be.

The game is a browser voxel sandbox built with Three.js. It started as a creative building toy (the repository is still named after it, and the README still describes that first version). It is now a settlement game called **Duilt**, with a free-build mode called **Creative** kept inside it.

## About this wiki

- It was written by reading the game's code and design notes at commit `bb1e91a` (13 October 2026, after pull request #175).
- Recipe, item, building and armour tables are read straight from the config files in `src/config/`, so the numbers are the ones the game uses.
- Where the design notes and the code disagree, this wiki follows the code and says so.
- Things seen only in code, never played, are written as "the code does X". Nothing here was tested in a running game.
- The game is still growing. Sections on the future are marked **Planned**.

## Contents

1. [Quick start](#1-quick-start)
2. [Game modes](#2-game-modes)
3. [Controls and screens](#3-controls-and-screens)
4. [Core mechanics](#4-core-mechanics)
5. [The twelve ages](#5-the-twelve-ages)
6. [Buildings](#6-buildings)
7. [Crafting](#7-crafting)
8. [Items, tools, armour and food](#8-items-tools-armour-and-food)
9. [Getting around: horses, flight, trains](#9-getting-around-horses-flight-trains)
10. [The world](#10-the-world)
11. [People, animals and trading](#11-people-animals-and-trading)
12. [Combat and the war](#12-combat-and-the-war)
13. [The story and the two paths](#13-the-story-and-the-two-paths)
14. [History of the game](#14-history-of-the-game)
15. [What is planned](#15-what-is-planned)
16. [Glossary and file map](#16-glossary-and-file-map)

---

## 1. Quick start

You are an exile from the Sky Kingdom, thrown down to the ground with an axe, a bucket, four fruit, four carrot seeds and four potato seeds. You start on a plot of land 32 blocks wide. You cannot walk past its edge until Age 10.

The first three goals teach the game:

1. **Break a tree for wood.** Aim at a trunk and hold Break (left click).
2. **Fill your bucket with water.** Hold the bucket and tap water.
3. **Make a pickaxe.** Open the Workbench (E). A Stone Pickaxe needs 3 Wood and 4 Stone. Stone comes from boulders on the surface, or from cobblestone, white stone or marble by hand (the "Stone from ..." recipes).

Finish all three and the border moves out (age 2, 64 blocks). Then claim a **forest**, a **farm** and a **house**. After that the loop repeats: each age asks for three or four buildings, and finishing them widens your land and unlocks more to build.

Things worth knowing early:

- Eat before your hunger bar runs low. At 35 of 100 you start to slow down.
- Hunt deer, rabbits, boar and goats. Cook raw meat at the Workbench for six times the food.
- Settlers move in once you have a second house. They work your buildings and eat from your storehouses.
- Hang a **Painting** in your house and Place on it. That is where you wake after a fall. A War Tent does the same.
- Buildings send what they make to your storehouses first, and to your bag only if no storehouse has room.

---

## 2. Game modes

The home screen offers two kinds of world.

| | Duilt | Creative |
|---|---|---|
| Tagline | "The game" (recommended) | "Free build" |
| Start | 32 blocks of land, an axe, a bucket, seeds | Generated terrain, every block from the start |
| Progress | Twelve ages, goals, quests | None |
| Border | Walls you in until Age 10 | None |
| Costs | Placing and claiming cost items | Free |
| Bag | 40 slots, items run out | One of everything, never runs out |
| Hunger and damage | Yes | Never hungry, never hurt |
| Buildings | Must be built and claimed | "Just work" (no cost to claim) |
| Recipes | Gated by age | All open |
| Story | Intro, tales, lore, war, two paths | Skipped. The Sky Kingdom is generated "to look at" |

In the code, Creative is a flag (`sandbox`) on the same engine, not a second game. It turns off the parts that make Duilt a game, one at a time.

Worlds can be kept in your browser's storage, exported to a `.voxworld.json` file, or synced to the cloud when you sign in. Details are in the README.

---

## 3. Controls and screens

### Keyboard and mouse

These are the default keys from `src/config/controls.js` and `src/config/panels.js`. Every movement key can be rebound in Settings, Controls and sound.

| Action | Default |
|---|---|
| Walk | W, A, S, D |
| Jump, swim up, fly up | Space |
| Run, or fly faster | Left Ctrl (or double-tap forward) |
| Sneak, swim down, fly down | Left Shift |
| Fly on and off | F |
| Turn a roof or saved design | R |
| Change view (first person, behind, in front) | F5 |
| Break, attack, shoot | Left click |
| Place, open, use, ride, drive | Right click |
| Hotbar slot | 1 to 9 |

### Panels

| Panel | Key | What it does |
|---|---|---|
| Goals (and Lore, Today, Quests) | G | The current age's goals, the lore book, secrets |
| Map | M | World map with places you have found |
| Bag | I | 40 slots plus worn gear |
| Workbench | E | Everything you can make, with a search box |
| Skills | K | The four skills |
| Claim ("What is this?") | C | Point at something you built and name it |
| Buildings | B | Place a ready-made building, or build and claim your own |

Other screens: Settings (notifications, world name, graphics, controls and sound, files), Designs (save and stamp builds), Roofs, Clear (take many blocks away at once), and a trader's stall.

### Phones

The left thumb drives a joystick. Drag the picture to look. A tap on the world breaks, attacks or fills a bucket. Place and Jump sit on the right. Settings let you swap which side walks and which thumb holds the action buttons.

### The hotbar and bag

- The first nine bag slots are the hotbar.
- The bag has a "Wearing" row: head, body, legs, feet, back (backpacks) and ring.
- Tap an item to lift it, tap a slot to put it down, hold to split a stack.
- A tool shows a durability bar on the hotbar: green, then amber, then red.

---

## 4. Core mechanics

### Time

- A game day is 15 real minutes: 10 minutes of daylight, then 5 of night (night runs twice as fast).
- A new world starts in mid-morning.
- Buildings, settlers and wars count in game days.

### Hunger

- Hunger runs from 100 down to 0. It drains about 1.4 a minute while idle (about 70 minutes from full), and 2.2 times faster while you move and mine.
- Below 35 you are hungry and slow down. At 0 you move at 55% speed. You cannot run when hungry.
- Starving never kills you. It only slows you down.
- Eat from the bag. Cooked meat feeds 32, carrots 22, potatoes 20, fruit 12 (full table in section 8).

### Health, death and waking up

- You have ten hearts, counted in halves.
- Falls of more than 3 blocks hurt. Lava takes 4 half-hearts a second, so about five seconds from full.
- You heal while fed (about every 4 seconds when hunger is above 60%), twice as fast resting in a house.
- Dying leaves a chest where you fell with what you carried. Tools stay with you (per the design notes). You wake at your painting or war tent, or at home (the middle of your land) if you have neither. If the painting is broken, the promise is gone.
- Creative takes no damage at all.

### Claiming buildings

A **structure** is a region of the world the game agrees to call something. There are two ways to get one:

1. **Build and claim it.** Build the thing yourself, point at it, and press C. Pick what it is. If something is missing, the panel says exactly what ("Needs 12 wood", "Needs a gate").
2. **Place a ready-made one.** Press B and pick a starter design. It costs the materials and builds in front of you.

Once claimed, a building is **locked**. You can unlock it to edit the blocks, or release the claim.

A claimed building then:

- pays out its products every cycle (see section 6 for amounts and cycle times);
- gets a +50% bonus when a settler works in it;
- can be **evolved** through levels (Humble, Tended, Thriving, Renowned) by meeting each level's needs and paying its cost.

### Evolving and "Craft what's missing"

The building's pop-up has an Evolve button. Next to it, **Craft what's missing** makes whatever the next level still lacks from your bag, by hand or at any station you own, one or two steps down the chain. Nothing is half-made.

You can also meet a level's needs by building them in (more lamps, a chest), or have Evolve take the items from your bag instead.

### Production pace

Production numbers in the config are written as so much per "building day". The game runs a building day as five game days, so everything makes one fifth of the written rate per game day. The cycle times in section 6 already include that.

### Storage

- Your bag has 40 slots, plus 10 with a Leather Backpack and 20 with a Reinforced one.
- A **Storehouse** has 200 slots (240 as a Loft, 280 as a Warehouse). Settlers eat from it first.
- A **Chest** has 27 slots. A **Cart** carries 40. A **train car** carries 1,000.
- The **Storage Controller** lists everything in every storehouse with a search. A Town Hall and a Village each come with one.
- A storehouse can be set to leave certain items out.

### Settlers

- Each house past the first brings one household. A Townhouse holds three. A Village holds three.
- New settlers arrive about every 8 seconds when there is a free house.
- They walk up to 40 blocks to a workplace. Where you build matters.
- Once a game day each settler eats one food, cheapest first, from your storehouses before your bag.
- Hungry settlers do not give their building the +50%. Nobody starves or leaves.
- Soldiers trained at a barracks live in town and eat the same way.

### Skills

Four skills rise by milestones, not by grinding. Counts of 1, 10, 30, 75, 150, 300, 600, 1,200, 2,500 and 5,000 actions each give a level, up to level 10.

| Skill | Each level gives |
|---|---|
| Foraging | +12% from everything you gather |
| Building | Buildings cost 5% less to raise |
| Athletics | +4% speed and 4% slower hunger |
| Politics | Room to govern 1 more settler |

A **University** lets you study each skill faster (recipes `study_*` use planks, stone and, from level 5, gold). It also holds the one-off study of **engineering**, which unlocks the Engineering Centre.

### Quests and secrets

- **Quests** are optional errands from the hermit, messengers, settlers and Grub the trader. None blocks progress, and none needs another. They are handed in from the Goals panel, wherever you are.
- **Secrets** are hidden achievements (Cartographer, Every last stone, Keeper of lights, Every stall, Know the woods, Everyone's errand, The whole story).
- **Story moments** are one-off lines for firsts: the first night, the first hunt, the first settler, the first temple, and so on.

### Tools wear

Every tool and armour piece has durability. Armour wears with every blow it takes. Make a spare.

### Drinks

One of each can run at once. Each lasts 3 minutes, and drinking another of the same only tops it up.

| Drink | Effect |
|---|---|
| Beer | Blows come in 0.55 of the usual time |
| Kombucha | +2 on every hit |
| Coffee | 1.3 times faster |

### Coins

Coins are struck at a **Foundry** (1 gold makes 10 coins, 1 copper ingot makes 3 copper coins, 1 ruby makes 25). They are also found in chests and earned by running a Town Hall. Traders take only coins.

---

## 5. The twelve ages

An **age** is a ring of land and a list of goals. Finish every goal and the border grows. The list comes from `src/config/ages.js`. The first five ages have three goals, the rest four.

| Age | Name | Land (blocks) | Goals |
|---|---|---|---|
| 1 | Exile | 32 | Break a tree. Fill your bucket. Make a pickaxe. |
| 2 | Roots | 64 | Claim a forest. Claim a farm. Claim a house. |
| 3 | Settle | 96 | Open a quarry. Raise a storehouse. Build a second house (a settler moves in). |
| 4 | Forge | 128 | Build a workshop. Fire up a kiln. Keep animals in a pen. |
| 5 | Hearth | 160 | Raise a market, a tavern and a foundry. |
| 6 | Town | 192 | Raise a townhouse, a university and a town hall. Evolve any building one level. |
| 7 | Faith | 224 | Raise a temple (shrine), an engineering centre and a granary. Forge a ring. |
| 8 | Bastion | 256 | Drive a mine, raise a garrison and a barracks, and build your Sanctuary. |
| 9 | Walls | 320 | Raise a stone wall, a gatehouse and a watchtower. Have fifteen buildings standing. |
| 10 | Reckoning | 384 (open) | End the war (or bring down the Sky Kingdom). Raise a village and a monument. Take a building to Renowned. |
| 11 | Renown | 448 (open) | Find a ruin, a forgotten temple, an abandoned mine and a monument. |
| 12 | Legend | 512 (open) | All four traders in a market. Hold 100 coins. Twenty-five buildings. Armour on head, body, legs and feet. |

How ages behave:

- Every goal counts. Later ages' goals stay locked until you reach them.
- "Open" means the border stops blocking you. You can walk anywhere, but you can only build inside your land.
- Reaching **Age 10** is the turning point. The wall comes down and the Stone Kingdom declares war, whatever ring you bear (see section 12).
- Finishing Age 12 finishes the game, unless the war is still on or, on the dark path, the Sky Kingdom still stands.
- Each age has a one-line intro told as a story. On the dark path, Age 10 reads differently.
- Older saves were moved to the new numbering so nothing already built ends up outside the border.

What each building needs at each age is listed under its entry in section 6. Note that buildings often appear earlier than the age that asks for them (for example the Temple unlocks at age 4 but the goal is in age 7).

---
## 6. Buildings

There are 27 building types. Each unlocks at an age and has a footprint limit. To claim one, the region you point at must pass its checks. The panel tells you the first check that fails.

### Overview

| Building | From age | Gives you |
|---|---|---|
| Forest | 1 | Wood, leaves, fruit |
| Farm | 1 | Crops and seeds |
| House | 1 | A home, and room for one household |
| Quarry | 3 | Stone, cobblestone, white stone, dark stone |
| Pen | 3 | Eggs, milk, wool from kept animals |
| Storehouse | 3 | 200 to 280 slots of shared storage |
| Workshop | 4 | Crafting station for finer goods |
| University | 4 | Study skills and engineering |
| Engineering Centre | 4 | Crafting station for rail and trains (needs engineering researched) |
| Kiln | 4 | Brick and glass |
| Temple | 4 | Devotion, blessings, rings, upgrades |
| White Sanctuary / Black Sanctuary | 4 | Your god's guardian (needs the matching ring) |
| Market | 5 | Vegetables, fruit, planks, and a trader |
| Town Hall | 5 | Coins, and a Storage Controller |
| Townhouse | 5 | Room for three households |
| Tavern | 5 | Gold |
| Foundry | 5 | Crafting station: smelting, coins, charcoal |
| Granary | 7 | Vegetables and potato seeds |
| Mine | 8 | Stone, gold, coal |
| Garrison | 8 | Stone and planks |
| Stone Wall | 8 | Defence |
| Gatehouse | 8 | Defence, shuts its gate before a war round |
| Watchtower | 8 | Defence, two archers |
| Barracks | 8 | Trains soldiers |
| Village | 10 | A forest, farm and housing folded into one claim |
| Monument | 10 | Nothing useful, which is the point |

The age column is where the building unlocks in `src/config/structures.js`. Age goals (section 5) can ask for them later.

### Levels

Most producers share one ladder:

| Level | Name | Costs | Also needs |
|---|---|---|---|
| 0 | Humble | nothing | nothing |
| 1 | Tended | 12 Planks, 8 Cobblestone | 1 lamp |
| 2 | Thriving | 20 Planks, 15 Coins | 2 lamps, 1 chest |
| 3 | Renowned | 4 Iron Ingot, 40 Coins | 4 lamps, 2 chests |

Output multiplies by 1, 1.5, 2.5 and 3.5. Other ladders:

- **Quarry:** A Scrape, A Working Face, A Deep Dig, A Quarry Face, An Open Pit (rises as you dig more of the rock out).
- **Storehouse:** Shelves (200 slots), Loft (240), Warehouse (280).
- **Temple:** Shrine, Chapel, Temple, Great Temple, High Temple, paid for in devotion.

A market gains one trader per level, so a Renowned market has all four.

### Reference

The entries below come straight from the config. "Needs N X" means the region must contain at least that many.


#### Forest

Standing trees that keep giving, instead of a stump you cut once.

- Available from age 1 (Exile).
- Footprint: 4 to 16 blocks on a side.
- Makes: 5 Wood, 1 Leaves, 1 Fruit every 18.8 minutes at the first level.

To claim it, the builder must show:

- Needs 12 wood, grow or plant more trees
- Needs 20 leaves, the trees are too bare
- Needs more open soil between the trees

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Forest | - | - | ×1 of the first level |
| 1 | Tended Forest | 12 Planks, 8 Cobblestone | 1 light | 8 Wood, 2 Leaves, 2 Fruit |
| 2 | Thriving Forest | 20 Planks, 15 Coins | 2 lights; 1 chest | 13 Wood, 3 Leaves, 3 Fruit |
| 3 | Renowned Forest | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 18 Wood, 4 Leaves, 4 Fruit |

#### Farm

Turned soil beside fresh water. Put a seed in for each crop you want, up to four, and it grows them.

- Available from age 1 (Exile).
- Footprint: 2 to 16 blocks on a side.
- Makes: whatever crops you put in as seeds (up to four kinds), plus seeds of them.

To claim it, the builder must show:

- Needs 4 tilled soil, place farmland
- Needs fresh water within 6 blocks, build nearer the river

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Farm | - | - | ×1 of the first level |
| 1 | Tended Farm | 12 Planks, 8 Cobblestone | 1 light | ×1.5 of the first level |
| 2 | Thriving Farm | 20 Planks, 15 Coins | 2 lights; 1 chest | ×2.5 of the first level |
| 3 | Renowned Farm | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | ×3.5 of the first level |

#### House

Somewhere to sleep. Later, somewhere for a settler to sleep.

- Available from age 1 (Exile).
- Footprint: 4 to 16 blocks on a side.
- Houses 1 household of settlers.

To claim it, the builder must show:

- Needs 20 wood in the walls
- Needs a room inside, walls all round and a roof over the top

#### Quarry

A hole you dig into rock, open to the sky.

- Available from age 3 (Settle).
- Footprint: 4 to 16 blocks on a side.
- Makes: 2 Stone, 1 Cobblestone, 1 White Stone, 1 Dark Stone every 12.5 minutes at the first level.

To claim it, the builder must show:

- Dig down until 24 stone blocks show inside it
- Dig out 8 blocks from inside it
- Open it to the sky, it can’t be underground

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | A Scrape | - | - | - |
| 1 | A Working Face | - | Uncover 40 stone blocks in it; Dig out 16 blocks from it | 2 Stone, 2 Cobblestone, 1 White Stone, 1 Dark Stone |
| 2 | A Deep Dig | - | Uncover 60 stone blocks in it; Dig out 28 blocks from it | 2 Stone, 2 Cobblestone, 2 White Stone, 1 Dark Stone |
| 3 | A Quarry Face | - | Uncover 90 stone blocks in it; Dig out 44 blocks from it | 2 Stone, 2 Cobblestone, 2 White Stone, 2 Dark Stone |
| 4 | An Open Pit | - | Uncover 130 stone blocks in it; Dig out 64 blocks from it | 2 Stone, 2 Cobblestone, 2 White Stone, 2 Dark Stone |

#### Pen

A fence with a gate, and animals inside it. Lead them in with food in your hand, then shut the gate.

- Available from age 3 (Settle).
- Footprint: 3 to 16 blocks on a side.
- Makes: eggs, milk, wool and the like, from the animals you keep inside.

To claim it, the builder must show:

- Needs 8 fence round it, it has to hold them
- Needs a gate, a way in that you can shut behind them

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Pen | - | - | ×1 of the first level |
| 1 | Tended Pen | 12 Planks, 8 Cobblestone | 1 light | ×1.5 of the first level |
| 2 | Thriving Pen | 20 Planks, 15 Coins | 2 lights; 1 chest | ×2.5 of the first level |
| 3 | Renowned Pen | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | ×3.5 of the first level |

#### Storehouse

Shelves that are not your back. Build it bigger and it holds more.

- Available from age 3 (Settle).
- Footprint: 3 to 16 blocks on a side.

To claim it, the builder must show:

- Needs 20 planks or wood, it has to keep the rain off
- Needs a room inside, walls all round and a roof over the top

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Shelves | - | - | - |
| 1 | Loft | - | 60 planks or wood; A room inside of at least 18 blocks of space under the roof | - |
| 2 | Warehouse | - | 140 planks, wood or brick; 25 stone or brick, for a floor that will take the weight; A room inside of at least 40 blocks of space under the roof | - |

#### Workshop

A room with a bench in it. Stand here and you can make what your hands cannot.

- Available from age 4 (Forge).
- Footprint: 4 to 16 blocks on a side.
- Works as a crafting station: workshop.

To claim it, the builder must show:

- Needs 28 planks or wood in it
- Needs 9 stone for a floor that will take a spark
- Needs a proper room, walls all round and a roof over it

#### University

Desks under a roof. Study here to get better at what you do, and to learn engineering.

- Available from age 4 (Forge).
- Footprint: 4 to 16 blocks on a side.
- Works as a crafting station: university.

To claim it, the builder must show:

- Needs 24 planks or wood in it
- Needs 2 tables to study at
- Needs a proper room, walls all round and a roof over it

#### Engineering Centre

A long hall with a wide door. Where carts, flying machines and trains will be worked out.

- Available from age 4 (Forge).
- Footprint: 5 to 20 blocks on a side.
- Needs research: engineering (study it at a University).
- Works as a crafting station: engineering.

To claim it, the builder must show:

- Needs 20 planks or wood in it
- Needs 16 stone for a floor that takes the weight
- Needs a hall, walls all round and a roof over it

#### Kiln

Earth and sand go in. Brick and glass come out.

- Available from age 4 (Forge).
- Footprint: 3 to 8 blocks on a side.
- Claim cost: 6 Cobblestone.
- Makes: 1 Brick, 1 Glass every 12.5 minutes at the first level.

To claim it, the builder must show:

- Needs 18 stone or brick in the shell
- Needs a sealed chamber inside to hold the heat
- Needs sand or earth within 6 blocks to feed it

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Kiln | - | - | ×1 of the first level |
| 1 | Tended Kiln | 12 Planks, 8 Cobblestone | 1 light | 2 Brick, 2 Glass |
| 2 | Thriving Kiln | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Brick, 3 Glass |
| 3 | Renowned Kiln | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Brick, 4 Glass |

#### Market

Somewhere the things your buildings make change hands.

- Available from age 5 (Hearth).
- Footprint: 6 to 20 blocks on a side.
- Claim cost: 10 Planks.
- Makes: 1 Carrots, 1 Fruit, 1 Planks every 6.3 minutes at the first level.

To claim it, the builder must show:

- Needs 36 laid floor
- Needs stalls with something over them, a roof on posts is enough
- Build it among your town, not out in a field

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Market | - | - | ×1 of the first level |
| 1 | Tended Market | 12 Planks, 8 Cobblestone | 1 light | 2 Carrots, 2 Fruit, 2 Planks |
| 2 | Thriving Market | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Carrots, 3 Fruit, 3 Planks |
| 3 | Renowned Market | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Carrots, 4 Fruit, 4 Planks |

#### Town Hall

Where the town keeps its accounts. Comes with a storage controller that reaches every storehouse.

- Available from age 5 (Hearth).
- Footprint: 7 to 20 blocks on a side.
- Claim cost: 8 Planks, 2 Glass, 4 Brick.
- Comes with a Storage Controller.
- Makes: 1 Coins every 6.3 minutes at the first level.

To claim it, the builder must show:

- Needs 30 stone, brick or calçada, a hall has a floor that takes boots
- Needs a hall inside, walls all round and a roof over the top
- Needs 4 windows, accounts are kept in daylight
- Needs to stand 8 blocks tall, for a bell tower, yours is 4
- Build it among your town, not out in a field

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Town Hall | - | - | ×1 of the first level |
| 1 | Tended Town Hall | 12 Planks, 8 Cobblestone | 1 light | 2 Coins |
| 2 | Thriving Town Hall | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Coins |
| 3 | Renowned Town Hall | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Coins |

#### Townhouse

More roof than one family needs, so more than one family lives under it.

- Available from age 5 (Hearth).
- Footprint: 6 to 16 blocks on a side.
- Claim cost: 16 Planks.
- Houses 3 households of settlers.

To claim it, the builder must show:

- Needs 44 planks or brick in the walls
- Needs 14 stone, cobble or brick, more feet than one family's worth
- Needs rooms inside, walls all round and a roof over the top

#### Tavern

Somewhere to eat, drink and hear the news. Small coin changes hands too.

- Available from age 5 (Hearth).
- Footprint: 5 to 14 blocks on a side.
- Claim cost: 8 Planks, 4 Brick.
- Makes: 1 Gold every 7.5 minutes at the first level.

To claim it, the builder must show:

- Needs 30 planks, wood or brick in it
- Needs 10 stone, cobble or brick for a hearth
- Needs a proper room, walls all round and a roof over it
- Build it among your town, not out in a field

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Tavern | - | - | ×1 of the first level |
| 1 | Tended Tavern | 12 Planks, 8 Cobblestone | 1 light | 2 Gold |
| 2 | Thriving Tavern | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Gold |
| 3 | Renowned Tavern | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Gold |

#### Foundry

A hotter fire than the kiln keeps, hot enough to run ore.

- Available from age 5 (Hearth).
- Footprint: 4 to 12 blocks on a side.
- Claim cost: 8 Cobblestone.
- Works as a crafting station: foundry.

To claim it, the builder must show:

- Needs 26 stone or brick in the shell, the fire has to hold
- Needs a bigger sealed chamber than the kiln's, this fire runs hotter
- Build it among your town, not out at the ore face

#### Mine

Everything easy is above ground. This is not above ground.

- Available from age 8 (Bastion).
- Footprint: 4 to 16 blocks on a side.
- Claim cost: 8 Planks.
- Makes: 1 Stone, 1 Gold, 1 Coal every 7.5 minutes at the first level.

To claim it, the builder must show:

- Its lowest block must be at height 12 or lower, deep under ground
- Needs 40 rock around the workings
- Dig out more of the rock inside it
- Needs 8 timber to hold the roof up

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Mine | - | - | ×1 of the first level |
| 1 | Tended Mine | 12 Planks, 8 Cobblestone | 1 light | 2 Stone, 2 Gold, 2 Coal |
| 2 | Thriving Mine | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Stone, 3 Gold, 3 Coal |
| 3 | Renowned Mine | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Stone, 4 Gold, 4 Coal |

#### Granary

A dry room full of what the farms grew, so a bad season is not a crisis.

- Available from age 7 (Faith).
- Footprint: 4 to 12 blocks on a side.
- Claim cost: 8 Carrots.
- Makes: 1 Carrots, 1 Potato Seeds every 6.3 minutes at the first level.

To claim it, the builder must show:

- Needs 30 planks or brick, it has to stay dry
- The room inside is too small to hold a season
- Build it near the fields it is meant to serve

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Granary | - | - | ×1 of the first level |
| 1 | Tended Granary | 12 Planks, 8 Cobblestone | 1 light | 2 Carrots, 2 Potato Seeds |
| 2 | Thriving Granary | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Carrots, 3 Potato Seeds |
| 3 | Renowned Granary | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Carrots, 4 Potato Seeds |

#### Garrison

Walls with people behind them. Nothing has tested them yet, and that is rather the point.

- Available from age 8 (Bastion).
- Footprint: 6 to 18 blocks on a side.
- Claim cost: 20 Stone, 10 Planks.
- Makes: 1 Stone, 1 Planks every 6.3 minutes at the first level.

To claim it, the builder must show:

- Needs 50 stone, cobble or brick in the walls, this has to hold
- Needs to stand at least 5 blocks tall to see anything coming, yours is 4
- Needs a barracks inside, walls all round and a roof over it
- The watch needs open sky above it, nothing built over the top

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Garrison | - | - | ×1 of the first level |
| 1 | Tended Garrison | 12 Planks, 8 Cobblestone | 1 light | 2 Stone, 2 Planks |
| 2 | Thriving Garrison | 20 Planks, 15 Coins | 2 lights; 1 chest | 3 Stone, 3 Planks |
| 3 | Renowned Garrison | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 4 Stone, 4 Planks |

#### Stone Wall

A length of wall with a walk along the top and battlements to fight from. Claimed, it takes three blows a block to break.

- Available from age 8 (Bastion).
- Footprint: 2 to 32 blocks on a side.
- A defence building: the war's raiders can break it, and it fights back.

To claim it, the builder must show:

- A wall needs to run at least 8 blocks, this one is 6
- A wall is long and narrow, no more than 4 blocks thick. Claim it along its length.
- Needs to stand at least 4 blocks tall, yours is 4
- Needs 30 stone, cobble, brick or dark stone, a wall has to be solid
- Needs battlements along the top, stones with gaps between them, to fight from behind

#### Gatehouse

Two towers and a gate between them, with a walk across the top. It shuts its gate when a round of the war is coming.

- Available from age 8 (Bastion).
- Footprint: 7 to 16 blocks on a side.
- Claim cost: 2 Iron Ingot.
- A defence building: the war's raiders can break it, and it fights back.

To claim it, the builder must show:

- Needs 120 stone, cobble, brick or dark stone, a gatehouse is the strongest part of a wall
- Its towers need to stand at least 8 blocks tall, yours is 4
- Needs a gate, at least two doors side by side (0 so far)
- Needs a guardroom in its towers, walls all round and a floor over it
- Needs battlements along the top, to fight from

#### Watchtower

A tall tower with a lookout on top. Two archers keep watch from it and shoot at anything of the Stone Kingdom's that comes in range.

- Available from age 8 (Bastion).
- Footprint: 5 to 9 blocks on a side.
- Claim cost: 6 Planks.
- A defence building: the war's raiders can break it, and it fights back.

To claim it, the builder must show:

- Needs to stand at least 11 blocks tall to see over the land, yours is 4
- Needs 70 stone, cobble, brick or dark stone
- Needs a stair up inside it, 6 stairs
- Needs a lantern on top, a signal light for the watch
- Needs battlements round the top, for the archers to shoot from behind

#### Barracks

A hall of bunks with arms on the walls and a yard to train in. Train warriors, swordsmen, archers and catapult crews here, a soldier a bunk, for food and gear, they go out to meet the Stone Kingdom's army.

- Available from age 8 (Bastion).
- Footprint: 7 to 18 blocks on a side.
- Claim cost: 4 Iron Ingot, 10 Planks.

To claim it, the builder must show:

- Needs bunks for its soldiers, 4 beds
- Needs arms on the walls, 2 weapon racks
- Needs something to train on, 2 training dummy or archery targets
- Needs a hall for them to sleep in, walls all round and a roof over it, bigger than a house

#### Village

A forest, a farm, housing and a shed, folded into one claim, everything a start needs, raised at once.

- Available from age 10 (Reckoning).
- Footprint: 14 to 28 blocks on a side.
- Claim cost: 20 Wood, 4 Carrot Seeds, 4 Potato Seeds.
- Houses 3 households of settlers.
- Comes with a Storage Controller.
- Makes: 3 Wood, 1 Leaves, 1 Carrots, 1 Carrot Seeds every 15.0 minutes at the first level.

To claim it, the builder must show:

- Needs 24 wood, a village needs a woodlot, not a tree
- Needs 30 leaves in the canopy
- Needs 8 tilled soil, the fields are too small
- Needs fresh water within 8 blocks, build nearer the river
- Needs 60 wood or planks, three households' worth of walls
- Needs real rooms inside, walls all round and roofs over them
- Needs more open soil between the trees and the fields

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | Humble Village | - | - | ×1 of the first level |
| 1 | Tended Village | 12 Planks, 8 Cobblestone | 1 light | 5 Wood, 2 Leaves, 2 Carrots, 2 Carrot Seeds |
| 2 | Thriving Village | 20 Planks, 15 Coins | 2 lights; 1 chest | 8 Wood, 3 Leaves, 3 Carrots, 3 Carrot Seeds |
| 3 | Renowned Village | 4 Iron Ingot, 40 Coins | 4 lights; 2 chests | 11 Wood, 4 Leaves, 4 Carrots, 4 Carrot Seeds |

#### Monument

Nothing useful. That is the point of it.

- Available from age 10 (Reckoning).
- Footprint: 7 to 24 blocks on a side.
- Claim cost: 4 Gold.

To claim it, the builder must show:

- Needs 60 marble, gold or brick, this one is meant to be expensive
- Needs to stand at least 8 blocks tall, yours is 4
- It has to be seen, nothing built over the top of it

#### Temple

Somewhere to pray. Offerings and worshippers turn into devotion, and devotion into blessings.

- Available from age 4 (Forge).
- Footprint: 4 to 20 blocks on a side.
- Claim cost: 1 Gold.
- Works as a crafting station: temple.
- Makes: 1 Devotion every 18.8 minutes at the first level.

To claim it, the builder must show:

- Needs 16 stone, marble or brick, a temple is built to last
- Needs an altar, a marble table, a vase, an urn or a block of gold
- Needs a light to keep, a lantern or a chandelier
- Needs a covered room round the altar

Levels (Evolve in the building's pop-up):

| Level | Name | Costs | Also needs | Output |
|---|---|---|---|---|
| 0 | A Shrine | - | - | - |
| 1 | A Chapel | 3 Devotion | 2 windows; 2 lights | 1 Devotion |
| 2 | A Temple | 8 Devotion | 4 pillars; 60 stonework | 2 Devotion |
| 3 | A Great Temple | 15 Devotion | 8 pillars; 4 gold trim or gold; 4 lights | 2 Devotion |
| 4 | The High Temple | 25 Devotion | 2 banners; 8 gold trim or gold; 12 pillars | 4 Devotion |

#### White Sanctuary

Open marble and light, under the sky. Raising it calls the white guardian, a great stag of light.

- Available from age 4 (Forge).
- Footprint: 5 to 16 blocks on a side.
- Claim cost: 10 Devotion.
- Only the white ring's bearer can raise it.

To claim it, the builder must show:

- Needs 30 marble, sky marble or gold trim
- Needs 4 lights, it is a place of light
- It has to stand open to the sky, nothing built over it

#### Black Sanctuary

Obsidian round a pit. Raising it calls the black guardian, a beast of shadow.

- Available from age 4 (Forge).
- Footprint: 5 to 16 blocks on a side.
- Claim cost: 10 Devotion.
- Only the black ring's bearer can raise it.

To claim it, the builder must show:

- Needs 30 obsidian, dark stone or dark brick
- Needs a pit at its heart, dig out at least nine blocks of it


---

## 7. Crafting

### How it works

- Open the Workbench with **E**. It lists recipes, with a search box.
- A recipe is greyed out when you lack an ingredient or stand in the wrong place. The panel says which.
- Recipes you use constantly craft in batches ("Planks ×2").
- Most recipes unlock with the age shown. In Creative they are all open.
- Recipes come from stations. By hand works anywhere. The others need you near a building or block:

| Station | How to reach it |
|---|---|
| By hand | Anywhere |
| Workshop | A claimed Workshop |
| Foundry | A claimed Foundry |
| Wood mill | The Wood Mill block (made by hand, age 3), within 4 blocks |
| Stone mill | The Stone Mill block (made by hand, age 3), within 4 blocks |
| Engineering centre | A claimed Engineering Centre, after you study engineering at a University |
| Temple | A claimed Temple; rings and upgrades need higher levels |
| University | A claimed University; these are studies, not items |

- Where something can be made by hand and at a mill, the bench shows only one tile: the cheaper mill recipe when you stand at the mill, the hand recipe elsewhere.
- Tool tiers: stone tools are the plain Axe, Pickaxe, Shovel and Sword. Iron, Gold, Sky, Dark and Diamond are full sets (axe, pickaxe, shovel, sword) made by hand from wood and the tier's metal.
- The Pry bar (clears many blocks) and Chalk line (mirrors what you place) are no longer made. A Creative world has one of each.

### The mills

- **Wood mill:** three planks to a log (instead of two), doors, trapdoors and stairs cheaper, stripped logs, cabinets, wardrobes, bedside tables and wall panels.
- **Stone mill:** every stone block cut here comes out half as much again for the same stone. It also grinds cobblestone or stone into gravel (1 makes 2) and gravel into sand (1 makes 2). Slabs are not milled.

### Studies (University)

Each skill has ten studies (Foraging, Building, Athletics, Politics). Level 1 costs 3 Planks and 2 Stone. Each level adds 3 planks and 2 stone, and from level 5 adds gold (1 at level 5, up to 6 at level 10). **Engineering** is one study: 16 Planks and 16 Stone. Studying takes time and raises the skill faster than just playing.

### Temple upgrades

At a Temple of level 2 or higher, you can lay an upgrade on a piece you own. It costs the piece, devotion and one more thing, and the result is the same piece with the upgrade's name in front.

| Upgrade | Fits | Devotion | Also | Effect |
|---|---|---|---|---|
| Swift | Boots | 3 | 3 Coffee Beans | 1.2 times faster |
| Warded | Body, legs | 4 | 2 Iron Ingot | +2 armour |
| Night Sight | Helm | 4 | 3 Jar of Fireflies | See in the dark |
| Thunder | Stone or Iron Sword | 5 | 3 Copper Ingot | Stuns for 2 seconds |
| Fire | Stone or Iron Sword | 5 | 2 Lantern | Burns for 4 seconds, 1 damage a second |
| Ice | Stone or Iron Sword | 5 | 3 Glass | Freezes for 4 seconds, slowed to 30% |

Other Temple recipes: Light a candle, Offer fruit, Offer a harvest, Offer a meal, Offer gold, Holy Water (heals four hearts, needs a Chapel), and the two rings (section 13).

### Recipe tables

Ages here are the game's own numbers (section 5). "×N" is how many you get.


#### By hand (138 recipes)

No building needed. Open the Workbench (E) anywhere.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Arrows ×4 | 1 | 1 Planks, 1 String | For the bow. They fly far and drop a little as they go. |
| Bed | 1 | 4 Planks, 3 Leaves | A frame, a mattress stuffed with leaves, a blanket. Two blocks long. |
| Bow | 1 | 3 Planks, 3 String | Hold it and press Break to shoot. It needs arrows. |
| Bucket | 1 | 4 Wood | Carries water to wherever you need it. |
| Chest | 1 | 6 Planks | Twenty-seven slots in a box you can put anywhere. Place opens it. |
| Cook meat ×2 | 1 | 2 Raw Meat, 1 Wood | A log on a fire. Six times the meal raw meat is. |
| Dark Door | 1 | 4 Dark Planks | Two blocks tall and hung the way you face. Place opens and shuts it. |
| Dark Planks ×2 | 1 | 1 Dark Wood | Two planks from one log of dark wood. |
| Dark Trapdoor ×2 | 1 | 3 Dark Planks | A door in the floor, or on a wall. Place opens and shuts it. |
| Door | 1 | 4 Planks | Two blocks tall and hung the way you face. Place opens and shuts it. |
| Empty the bucket | 1 | 1 Bucket of Water | Pour it out and get the bucket back. |
| Fill the bucket | 1 | 1 Bucket | near water |
| Framed Window | 1 | 2 Planks, 2 Sand | A pane in a wooden frame, with a cross of glazing bars. For a house's walls. |
| Leather Backpack | 1 | 4 Hide, 2 String | Worn on your back: 10 more slots in your bag. Hide and string, stitched at the bench. |
| Leather Boots | 1 | 2 Hide | 1 armour, worn on the feet. Stitched from hides. |
| Leather Cap | 1 | 3 Hide | 1 armour, worn on the head. Stitched from hides. |
| Leather Leggings | 1 | 4 Hide | 1 armour, worn on the legs. Stitched from hides. |
| Leather Tunic | 1 | 5 Hide | 2 armour, worn on the body. Stitched from hides. |
| Painting | 1 | 2 Planks, 1 Dirt, 1 Leaves | Earth and leaves for paint. Hang it in your house, Place on it, and that is where you wake after a fall. |
| Plank Slab ×2 | 1 | 1 Planks | One plank, cut thin, makes two, a slab is half a block either way. |
| Plank Stairs | 1 | 1 Planks | Cut into a step instead of a slab. |
| Planks ×2 | 1 | 1 Wood | Two planks from one log, more wall for the same tree. |
| Sand Path ×2 | 1 | 2 Sand | A track to walk on. Its corners round off wherever it stops. |
| Sandstone | 1 | 4 Sand | Sand pressed hard. There is plenty more under any desert. |
| Sapling | 1 | 4 Leaves | Plant these to grow the forest you will claim. |
| Stone Axe | 1 | 2 Wood, 3 Stone | Cuts trees far faster than bare hands. Wears out; make a spare. |
| Stone from cobblestone | 1 | 2 Cobblestone | Two rough blocks knocked into one cut one. |
| Stone from marble | 1 | 1 Marble | Rough marble out of the ground, broken down for plain stone. |
| Stone from white stone | 1 | 1 White Stone | The pale layers under the soil, trimmed square. |
| Stone Pickaxe | 1 | 3 Wood, 4 Stone | Breaks stone far faster than bare hands. Wears out; make a spare. |
| Stone Roof Tiles ×2 | 1 | 1 Stone | Slates: the same sloped roof in grey stone. |
| Stone Shovel | 1 | 2 Wood, 2 Stone | Digs dirt and sand far faster than bare hands. Wears out; make a spare. |
| String | 1 | 3 Hemp Fibre | Hemp fibre twisted into string. Bows and arrows need it. |
| Trapdoor ×2 | 1 | 3 Planks | A door in the floor. Place opens and shuts it. |
| Turn soil | 1 | 1 Dirt | Breaks dirt into soil a crop will actually grow in. |
| White Door | 1 | 4 White Planks | Two blocks tall and hung the way you face. Place opens and shuts it. |
| White Planks ×2 | 1 | 1 White Wood | Two planks from one log of white wood. |
| White Trapdoor ×2 | 1 | 3 White Planks | A door in the floor, or on a wall. Place opens and shuts it. |
| Wooden Sword | 1 | 2 Wood, 3 Planks | Better than fists. Not by as much as you would like. |
| Calçada ×4 | 3 | 2 Stone | Little white setts, for a road or a square. |
| Calçada Wave ×3 | 3 | 2 Calçada, 1 Dark Calçada | The wave of dark through white, as on a Lisbon square. |
| Campfire | 3 | 2 Planks, 2 Stone | A ring of stones and a fire in it. |
| Cart | 3 | 16 Planks, 4 Wood | Tame a horse (fruit or vegetables in your hand, then Place on it), then use this on it. Forty slots, and you can ride it. |
| Cobblestone Wall ×4 | 3 | 3 Cobblestone | A low stone wall that joins its neighbours, with a post at every turn. |
| Dark Calçada ×4 | 3 | 1 Stone, 1 Dark Stone | Little dark setts, for a pattern in the white. |
| Dark Fence ×2 | 3 | 1 Dark Planks | Too tall to hop and too tall for anything to climb. What a pen is made of. |
| Dark Gate | 3 | 3 Dark Planks | The way into a pen. You walk through it; the animals can't. |
| Dark Grey Stone Wall ×4 | 3 | 3 Dark Grey Stone | A low stone wall that joins its neighbours, with a post at every turn. |
| Fence ×2 | 3 | 1 Planks | Too tall to hop and too tall for anything to climb. What a pen is made of. |
| Gate | 3 | 3 Planks | The way into a pen. You walk through it; the animals can't. |
| Orange Stone Wall ×4 | 3 | 3 Orange Stone | A low stone wall that joins its neighbours, with a post at every turn. |
| Sandstone Brick ×4 | 3 | 4 Sandstone | Sandstone cut into bricks. Counts as stone for a building. |
| Sandstone Wall ×4 | 3 | 3 Sandstone | A low stone wall that joins its neighbours, with a post at every turn. |
| Split stone ×2 | 3 | 1 Stone | Two rough blocks from one cut one. Cheaper walls, uglier walls. |
| Stone Brick ×4 | 3 | 4 Stone | Stone cut into big square blocks. Counts as stone for a building. |
| Stone Brick Chimney ×2 | 3 | 3 Stone Brick | Stack them through the roof. The top one smokes. |
| Stone Brick Wall ×4 | 3 | 3 Stone Brick | A low stone wall that joins its neighbours, with a post at every turn. |
| Stone Mill | 3 | 6 Stone, 4 Cobblestone, 4 Planks | A grindstone on a block of stone. Stand by it and stone goes further, and it grinds gravel. Place on it to use it. |
| Stone Slab ×2 | 3 | 1 Stone | Split thin instead of split rough, two slabs from one block. |
| Stone Stairs | 3 | 1 Stone | Cut into a step instead of a slab. |
| Stone Sword | 3 | 2 Wood, 5 Stone | A stone edge on a wooden grip. Two good blows see off a bandit. |
| Stone Wall ×4 | 3 | 3 Stone | A low stone wall that joins its neighbours, with a post at every turn. |
| Timber Frame ×2 | 3 | 2 Planks, 1 Clay | Clay plaster between dark beams. A house that looks like a house. |
| Turquoise Stone Wall ×4 | 3 | 3 Turquoise Stone | A low stone wall that joins its neighbours, with a post at every turn. |
| Vase | 3 | 2 Clay | A painted vase, for a shelf or a doorstep. |
| White Fence ×2 | 3 | 1 White Planks | Too tall to hop and too tall for anything to climb. What a pen is made of. |
| White Gate | 3 | 3 White Planks | The way into a pen. You walk through it; the animals can't. |
| White Stone Wall ×4 | 3 | 3 White Stone | A low stone wall that joins its neighbours, with a post at every turn. |
| Wood Mill | 3 | 8 Planks, 4 Cobblestone | A saw bench. Stand by it and wood goes further. Place on it to use it. |
| Black Banner | 4 | 3 Wool, 1 Planks, 1 Dark Wood | Black, with the red tower of the Stone Kingdom. |
| Brick Chimney ×2 | 4 | 3 Brick | Stack them through the roof. The top one smokes. |
| Brick Roof Tiles ×2 | 4 | 1 Brick | Telhas: a real sloped roof in rows of tiles. Hold them and use the Roof tool. |
| Brick Wall ×4 | 4 | 3 Brick | A low brick wall that joins its neighbours, with a post at every turn. |
| Catapult | 4 | 10 Planks, 4 Wood, 6 Stone | A stone-thrower on wheels. Look where you want it to land; it does the rest. |
| Dark Brick ×4 | 4 | 4 Brick, 1 Dark Wood | Brick fired the same way. Grim, and very hard to argue with. |
| Dark Brick Wall ×4 | 4 | 3 Dark Brick | A low stone wall that joins its neighbours, with a post at every turn. |
| Dark Pillar ×2 | 4 | 2 Dark Stone | Stack them: a base grows at the bottom and a capital at the top. |
| Dark Stone ×4 | 4 | 4 Stone, 1 Dark Wood | Stone smoked black over a dark-wood fire. What the Stone Kingdom is built of. |
| Dark Stone Wall ×4 | 4 | 3 Dark Stone | A low wall of dark stone, the way the Stone Kingdom builds them. |
| Firefly Lantern | 4 | 1 Jar of Fireflies, 1 Planks | A jar of fireflies you caught, set in a frame. A soft green light, the way the Sky Kingdom lights its paths. |
| Glass jar | 4 | 1 Glass | Empty, with a cork. Take it out at night, to where the fireflies are. |
| Stone Pillar ×2 | 4 | 3 Stone | Stack them: a base grows at the bottom and a capital at the top. |
| White Banner | 4 | 3 Wool, 1 Planks | White, with the gold sun of the Sky Kingdom. |
| Chain ×4 | 5 | 1 Iron Ingot | Iron links, a block of them at a time. Hang a lantern from it. |
| Dark Boots | 5 | 2 Iron Ingot, 1 Dark Stone | 2 armour, worn on the feet. Blackened iron, as the Stone Kingdom wears it. |
| Dark Cuirass | 5 | 4 Iron Ingot, 2 Dark Stone | 5 armour, worn on the body. Blackened iron, as the Stone Kingdom wears it. |
| Dark Greaves | 5 | 3 Iron Ingot, 1 Dark Stone | 3 armour, worn on the legs. Blackened iron, as the Stone Kingdom wears it. |
| Dark Helm | 5 | 2 Iron Ingot, 1 Dark Stone | 3 armour, worn on the head. Blackened iron, as the Stone Kingdom wears it. |
| Gold Trim ×2 | 5 | 1 Gold, 2 Stone | A band of gold set into stone, for the edges of something grand. |
| Iron Axe | 5 | 2 Wood, 3 Iron Ingot | Cuts trees in a stroke. Lasts longer than stone, hits harder. |
| Iron Boots | 5 | 2 Iron Ingot | 1 armour, worn on the feet. Plate from your foundry. |
| Iron Cuirass | 5 | 5 Iron Ingot | 3 armour, worn on the body. Plate from your foundry. |
| Iron Greaves | 5 | 4 Iron Ingot | 2 armour, worn on the legs. Plate from your foundry. |
| Iron Helm | 5 | 3 Iron Ingot | 2 armour, worn on the head. Plate from your foundry. |
| Iron Pickaxe | 5 | 2 Wood, 3 Iron Ingot | Breaks stone in a stroke. Lasts longer than stone, hits harder. |
| Iron Shovel | 5 | 2 Wood, 2 Iron Ingot | Digs dirt and sand in a stroke. Lasts longer than stone, hits harder. |
| Iron Sword | 5 | 2 Wood, 3 Iron Ingot | Foundry iron. Hits hardest and lasts longest. |
| Reinforced Backpack | 5 | 1 Leather Backpack, 2 Iron Ingot, 2 Hide | Worn on your back: 20 more slots in your bag. A leather backpack with iron at the seams. |
| Sky Boots | 5 | 2 Iron Ingot, 1 Gold | 2 armour, worn on the feet. White steel and gold, as the Sky Kingdom wears it. |
| Sky Cuirass | 5 | 4 Iron Ingot, 2 Gold | 5 armour, worn on the body. White steel and gold, as the Sky Kingdom wears it. |
| Sky Greaves | 5 | 3 Iron Ingot, 1 Gold | 3 armour, worn on the legs. White steel and gold, as the Sky Kingdom wears it. |
| Sky Helm | 5 | 2 Iron Ingot, 1 Gold | 3 armour, worn on the head. White steel and gold, as the Sky Kingdom wears it. |
| Storage Controller | 5 | 8 Planks, 2 Glass, 4 Brick | Lists everything in every storehouse, with a search. Place on it to open. |
| Urn | 5 | 2 Copper Ingot | A lidded bronze urn with handles. |
| Archery Target | 8 | 2 Planks, 1 Wool | Rings to aim at, white to gold. |
| Gold Axe | 8 | 2 Wood, 3 Gold | Cuts trees in a stroke. Hits hard, but gold is soft, it wears sooner than iron. |
| Gold Boots | 8 | 2 Gold | 1 armour, worn on the feet. Beaten gold, it turns a blow better than iron, and wears faster. |
| Gold Cuirass | 8 | 5 Gold | 4 armour, worn on the body. Beaten gold, it turns a blow better than iron, and wears faster. |
| Gold Greaves | 8 | 4 Gold | 2 armour, worn on the legs. Beaten gold, it turns a blow better than iron, and wears faster. |
| Gold Helm | 8 | 3 Gold | 2 armour, worn on the head. Beaten gold, it turns a blow better than iron, and wears faster. |
| Gold Pickaxe | 8 | 2 Wood, 3 Gold | Breaks stone in a stroke. Hits hard, but gold is soft, it wears sooner than iron. |
| Gold Shovel | 8 | 2 Wood, 2 Gold | Digs dirt and sand in a stroke. Hits hard, but gold is soft, it wears sooner than iron. |
| Gold Sword | 8 | 2 Wood, 3 Gold | Fighting bandits. Hits hard, but gold is soft, it wears sooner than iron. |
| Marble Pillar ×2 | 8 | 2 Marble | Stack them: a base grows at the bottom and a capital at the top. |
| Marble Wall ×4 | 8 | 3 Marble | A low stone wall that joins its neighbours, with a post at every turn. |
| Sky Marble ×2 | 8 | 2 Marble, 1 Glass | Marble polished until it takes the colour of the sky. |
| Sky Marble Wall ×4 | 8 | 3 Sky Marble | A low stone wall that joins its neighbours, with a post at every turn. |
| Training Dummy | 8 | 2 Planks, 1 Wool, 2 Leaves | Something to hit that doesn't hit back. |
| War Tent | 8 | 4 Wool, 2 Planks | Somewhere to sleep on the march. Place on it to make camp there. |
| Weapon Rack | 8 | 3 Planks, 2 Iron Ingot | Arms on a rack, ready to hand. A barracks needs one. |
| Dark Axe | 10 | 2 Wood, 3 Dark Stone, 1 Iron Ingot | Cuts trees in a stroke. The best there is. |
| Dark Pickaxe | 10 | 2 Wood, 3 Dark Stone, 1 Iron Ingot | Breaks stone in a stroke. The best there is. |
| Dark Shovel | 10 | 2 Wood, 2 Dark Stone, 1 Iron Ingot | Digs dirt and sand in a stroke. The best there is. |
| Dark Sword | 10 | 2 Wood, 3 Dark Stone, 1 Iron Ingot | Fighting bandits. The best there is. |
| Diamond Axe | 10 | 2 Wood, 3 Diamond, 1 Iron Ingot | Cuts trees in a stroke. The best there is. |
| Diamond Boots | 10 | 2 Diamond, 1 Iron Ingot | 3 armour, worn on the feet. Diamond, bound in iron, the best armour there is. |
| Diamond Cuirass | 10 | 5 Diamond, 2 Iron Ingot | 6 armour, worn on the body. Diamond, bound in iron, the best armour there is. |
| Diamond Greaves | 10 | 4 Diamond, 1 Iron Ingot | 4 armour, worn on the legs. Diamond, bound in iron, the best armour there is. |
| Diamond Helm | 10 | 3 Diamond, 1 Iron Ingot | 4 armour, worn on the head. Diamond, bound in iron, the best armour there is. |
| Diamond Pickaxe | 10 | 2 Wood, 3 Diamond, 1 Iron Ingot | Breaks stone in a stroke. The best there is. |
| Diamond Shovel | 10 | 2 Wood, 2 Diamond, 1 Iron Ingot | Digs dirt and sand in a stroke. The best there is. |
| Diamond Sword | 10 | 2 Wood, 3 Diamond, 1 Iron Ingot | Fighting bandits. The best there is. |
| Sky Axe | 10 | 2 Wood, 3 Sky Marble, 1 Gold | Cuts trees in a stroke. The best there is. |
| Sky Lift | 10 | 2 Gold, 2 Chain, 2 Planks | A winch in gold, as the Sky Kingdom makes them. Only the ones at its anchor towers go anywhere. |
| Sky Pickaxe | 10 | 2 Wood, 3 Sky Marble, 1 Gold | Breaks stone in a stroke. The best there is. |
| Sky Shovel | 10 | 2 Wood, 2 Sky Marble, 1 Gold | Digs dirt and sand in a stroke. The best there is. |
| Sky Sword | 10 | 2 Wood, 3 Sky Marble, 1 Gold | Fighting bandits. The best there is. |
| War Horn | 10 | 2 Hide, 1 Gold, 1 Planks | Sound it and the Stone Kingdom's next round comes now, not when it likes. |

#### Workshop (21 recipes)

Stand inside or near a claimed Workshop.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Beer ×2 | 4 | 3 Potatoes | Potatoes, mashed and left to work. Quicker blows for three minutes. |
| Blue Rug | 4 | 3 Leaves, 1 Glass | The same weave, dyed with ground glass. |
| Brick ×2 | 4 | 3 Dirt, 1 Cobblestone | Earth, shaped and fired. Holds a wall up far better than it has any right to. |
| Chandelier | 4 | 1 Iron Ingot, 1 Planks | Hangs from a ceiling and lights the whole room from above. |
| Coffee ×2 | 4 | 3 Coffee Beans | Roasted, ground and brewed. Faster on your feet for three minutes. |
| Dark Chair | 4 | 3 Dark Planks | A seat and a back, sit-height, and it actually collides that way. |
| Dark Table | 4 | 4 Dark Planks | A tabletop on four legs, not just a block that says table. |
| Dress planks ×4 | 4 | 1 Wood | The same log, cut properly. Twice what you get by hand. |
| Flying Machine | 4 | 24 Planks, 12 Wool | Wood and canvas, after Leonardo. Hold it and Place to set it down; Place on it to climb in and fly. Jump climbs, Sneak dives, Fly lands, and on the ground, Sneak gets you out. |
| Glass | 4 | 2 Sand | Sand, taken hot enough to forget it was sand. |
| Green Rug | 4 | 4 Leaves | Woven from stripped leaves. You walk straight over it, it never collides. |
| Kombucha ×2 | 4 | 2 Fruit, 1 Leaves | Fruit and leaf tea, soured. +2 on every hit for three minutes. |
| Lantern | 4 | 2 Planks, 1 Glass | A real light, not a decoration, see it burn from across your land. |
| Oak Chair | 4 | 3 Planks | A seat and a back, sit-height, and it actually collides that way. |
| Oak Table | 4 | 4 Planks | A tabletop on four legs, not just a block that says table. |
| Red Chair | 4 | 2 Planks, 1 Brick | The same chair, finished in brick red. |
| Red Rug | 4 | 3 Leaves, 1 Brick | The same weave, dyed with crushed brick. |
| White Chair | 4 | 3 White Planks | A seat and a back, sit-height, and it actually collides that way. |
| White Table | 4 | 4 White Planks | A tabletop on four legs, not just a block that says table. |
| Dress marble | 8 | 4 Stone | Four rough blocks down to one good one. Nothing else looks like it. |
| Marble Table | 8 | 3 Marble | The same shape as the oak table, cut from marble instead. |

#### Foundry (7 recipes)

Stand at a claimed Foundry.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Burn charcoal | 5 | 4 Wood | Logs burned down slow, with the air kept out. What a steam engine runs on, if there is no seam to dig. |
| Smelt copper | 5 | 2 Copper Ore | The same fire, a softer metal. |
| Smelt gold | 5 | 3 Gold Ore | What the tavern jar has always meant by "brought up from a mine." |
| Smelt iron | 5 | 2 Iron Ore | Ore, taken hot enough to run clean. |
| Strike coins ×10 | 5 | 1 Gold | One lump of gold, cut and stamped into ten. |
| Strike copper coins ×3 | 5 | 1 Copper Ingot | Worth less than gold, but there is more of it. |
| Strike coins from a ruby ×25 | 10 | 1 Ruby | A ruby's worth, in coins, the market takes them. |

#### Wood mill (29 recipes)

Place the Wood Mill block and stand within 4 blocks of it.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Bedside Table | 3 | 3 Planks | A drawer and a top, beside the bed. |
| Cabinet | 3 | 4 Planks | Two doors and a top to set things on. |
| Dark Bedside Table | 3 | 3 Dark Planks | A drawer and a top, beside the bed. |
| Dark Cabinet | 3 | 4 Dark Planks | Two doors and a top to set things on. |
| Dark Door (mill) | 3 | 3 Dark Planks | A door for three planks, not four. |
| Dark Panel ×4 | 3 | 1 Dark Planks | Boards for an inside wall. Goes flat on the face you point at. |
| Dark Patterned Panel ×4 | 3 | 2 Dark Planks | Raised squares for an inside wall. |
| Dark Planks (mill) ×3 | 3 | 1 Dark Wood | Three planks to a log at the mill, not two. |
| Dark Trapdoor (mill) ×2 | 3 | 2 Dark Planks | Two trapdoors for two planks. |
| Dark Wardrobe | 3 | 7 Dark Planks | Taller than you, for the bedroom. |
| Door (mill) | 3 | 3 Planks | A door for three planks, not four. |
| Patterned Panel ×4 | 3 | 2 Planks | Raised squares for an inside wall. |
| Plank Stairs (mill) ×3 | 3 | 2 Planks | Three steps from two planks. |
| Planks (mill) ×3 | 3 | 1 Wood | Three planks to a log at the mill, not two. |
| Stripped Dark Log | 3 | 1 Dark Wood | The bark off and the grain showing. Stands or lies like a log. |
| Stripped Oak Log | 3 | 1 Wood | The bark off and the grain showing. Stands or lies like a log. |
| Stripped White Log | 3 | 1 White Wood | The bark off and the grain showing. Stands or lies like a log. |
| Trapdoor (mill) ×2 | 3 | 2 Planks | Two trapdoors for two planks. |
| Two-tone Panel ×4 | 3 | 1 Planks, 1 Dark Planks | Dark below, light above, a rail between. |
| Wardrobe | 3 | 7 Planks | Taller than you, for the bedroom. |
| White Bedside Table | 3 | 3 White Planks | A drawer and a top, beside the bed. |
| White Cabinet | 3 | 4 White Planks | Two doors and a top to set things on. |
| White Door (mill) | 3 | 3 White Planks | A door for three planks, not four. |
| White Panel ×4 | 3 | 1 White Planks | Boards for an inside wall. Goes flat on the face you point at. |
| White Patterned Panel ×4 | 3 | 2 White Planks | Raised squares for an inside wall. |
| White Planks (mill) ×3 | 3 | 1 White Wood | Three planks to a log at the mill, not two. |
| White Trapdoor (mill) ×2 | 3 | 2 White Planks | Two trapdoors for two planks. |
| White Wardrobe | 3 | 7 White Planks | Taller than you, for the bedroom. |
| Wood Panel ×4 | 3 | 1 Planks | Boards for an inside wall. Goes flat on the face you point at. |

#### Stone mill (29 recipes)

Place the Stone Mill block and stand within 4 blocks of it.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Calçada ×6 | 3 | 2 Stone | Little white setts, for a road or a square. Half as much again at the stone mill. |
| Calçada Wave ×5 | 3 | 2 Calçada, 1 Dark Calçada | The wave of dark through white, as on a Lisbon square. Half as much again at the stone mill. |
| Cobblestone Wall ×6 | 3 | 3 Cobblestone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Dark Calçada ×6 | 3 | 1 Stone, 1 Dark Stone | Little dark setts, for a pattern in the white. Half as much again at the stone mill. |
| Dark Grey Stone Wall ×6 | 3 | 3 Dark Grey Stone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Grind gravel ×2 | 3 | 1 Cobblestone | Cobblestone ground down to gravel, for paths and roads. |
| Grind gravel from stone ×2 | 3 | 1 Stone | Cut stone, ground down to gravel. |
| Grind sand ×2 | 3 | 1 Gravel | Gravel ground finer still, sand, for glass and sandstone, far from any beach. |
| Orange Stone Wall ×6 | 3 | 3 Orange Stone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Sandstone Brick ×6 | 3 | 4 Sandstone | Sandstone cut into bricks. Counts as stone for a building. Half as much again at the stone mill. |
| Sandstone Wall ×6 | 3 | 3 Sandstone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Stone Brick ×6 | 3 | 4 Stone | Stone cut into big square blocks. Counts as stone for a building. Half as much again at the stone mill. |
| Stone Brick Chimney ×3 | 3 | 3 Stone Brick | Stack them through the roof. The top one smokes. Half as much again at the stone mill. |
| Stone Brick Wall ×6 | 3 | 3 Stone Brick | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Stone Roof Tiles ×3 | 3 | 1 Stone | Slates: the same sloped roof in grey stone. Half as much again at the stone mill. |
| Stone Stairs ×2 | 3 | 1 Stone | Cut into a step instead of a slab. Half as much again at the stone mill. |
| Stone Wall ×6 | 3 | 3 Stone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Turquoise Stone Wall ×6 | 3 | 3 Turquoise Stone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| White Stone Wall ×6 | 3 | 3 White Stone | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Brick Chimney ×3 | 4 | 3 Brick | Stack them through the roof. The top one smokes. Half as much again at the stone mill. |
| Brick Roof Tiles ×3 | 4 | 1 Brick | Telhas: a real sloped roof in rows of tiles. Hold them and use the Roof tool. Half as much again at the stone mill. |
| Brick Wall ×6 | 4 | 3 Brick | A low brick wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Dark Brick Wall ×6 | 4 | 3 Dark Brick | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Dark Pillar ×3 | 4 | 2 Dark Stone | Stack them: a base grows at the bottom and a capital at the top. Half as much again at the stone mill. |
| Dark Stone Wall ×6 | 4 | 3 Dark Stone | A low wall of dark stone, the way the Stone Kingdom builds them. Half as much again at the stone mill. |
| Stone Pillar ×3 | 4 | 3 Stone | Stack them: a base grows at the bottom and a capital at the top. Half as much again at the stone mill. |
| Marble Pillar ×3 | 8 | 2 Marble | Stack them: a base grows at the bottom and a capital at the top. Half as much again at the stone mill. |
| Marble Wall ×6 | 8 | 3 Marble | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |
| Sky Marble Wall ×6 | 8 | 3 Sky Marble | A low stone wall that joins its neighbours, with a post at every turn. Half as much again at the stone mill. |

#### Engineering centre (3 recipes)

A claimed Engineering Centre (researched first at a University).

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Rail ×8 | 8 | 1 Iron Ingot, 2 Planks | Two iron rails on wooden sleepers. Lay them in a line; they turn corners and climb a step on their own. |
| Rail Car | 8 | 12 Iron Ingot, 12 Planks | Place it on a train to couple it on behind. An engine pulls five. |
| Steam Engine | 8 | 24 Iron Ingot, 8 Brick, 8 Planks | Eight long, three wide, four high. Set it on a rail, fire it with coal, and Place on it to drive: forward and back, Sneak to get down. |

#### Temple (8 recipes)

A claimed Temple; some recipes need a higher level.

| Makes | Age | Needs | Notes |
|---|---|---|---|
| Forge the Black Ring | 4 | 3 Nightstone, 4 Obsidian, 12 Devotion | temple level 4; black ring, closes the other |
| Forge the White Ring | 4 | 3 Sunstone, 4 Gold, 12 Devotion | temple level 4; white ring, closes the other |
| Holy Water ×2 | 4 | 1 Glass, 1 Devotion | temple level 1 |
| Light a candle | 4 | 1 Lantern | A light left burning at the altar. |
| Offer a harvest | 4 | 4 Carrots | The first of what the farm gave. |
| Offer a meal | 4 | 2 Cooked Meat | A feast for the god, eaten by the priests. |
| Offer fruit | 4 | 6 Fruit | Laid on the altar. |
| Offer gold ×2 | 4 | 1 Gold | Gold buys devotion faster than anything. |


---

## 8. Items, tools, armour and food

### Materials in one glance

- **Woods:** oak ("wood"), white (birch) and dark. Each has planks, fence, gate, door, trapdoor, furniture and panels.
- **Stones:** stone, cobblestone, white stone, dark grey stone, turquoise stone, orange stone, marble, sky marble, dark stone, sandstone, obsidian. Most have a wall that joins like a fence.
- **Metals and gems:** copper, iron, gold, coal, diamond, ruby, amethyst, Sunstone, Nightstone.
- **Made materials:** brick, glass, dark brick, stone brick, sandstone brick, gold trim, calçada (white, dark and wave patterns), roof tiles in stone and brick.

### Every item

The tables below list every item in the game and how you get it, grouped by kind. "Refined goods and blocks" include everything you can place.


#### Raw materials (55)

| Item | How you get it |
|---|---|
| Dirt | Foraged from the ground |
| Wood | Cut from trees |
| Leaves | Stripped from trees |
| Stone | Mined from rock |
| White Stone | Mined from the pale rock layers |
| Turquoise Stone | Mined from a rare blue-green seam |
| Dark Grey Stone | Mined from the dark rock layers |
| Orange Stone | Mined from the rarest seam of all |
| Sand | Dug from the riverbank |
| Turf | Cut from the plains |
| Moss | Lifted from a forest floor |
| Gravel | Scraped off the mountainside |
| Clay | Dug from wet ground |
| White Wood | Cut from birch trees |
| White Leaves | Stripped from birch trees |
| Dark Wood | Cut from the dark forest |
| Dark Leaves | Stripped from the dark forest |
| Lava | Scooped from a cavern |
| Dark Moss | Lifted from the dark forest floor |
| Forest Floor | Raked up in a giant grove |
| Cobblestone | Split from quarried stone |
| Gold | Brought up from a mine |
| Carrot Seeds | Saved from a ripe carrot |
| Potato Seeds | Saved from a ripe potato |
| Cabbage Seeds | Saved from a ripe cabbage |
| Lettuce Seeds | Saved from a ripe lettuce |
| Pepper Seeds | Saved from a ripe pepper |
| Zucchini Seeds | Saved from a ripe zucchini |
| Broccoli Seeds | Saved from a ripe broccoli |
| Coffee Seeds | Saved from a ripe coffee |
| Hemp Seeds | Saved from a ripe hemp |
| Sapling | Grown from seed |
| Hide | Hunted from deer, boar, goats and cows |
| Wool | Hunted from sheep |
| Feather | Hunted from chickens |
| Hemp Fibre | Picked from ripe hemp |
| Jar of Fireflies | Caught at night, an empty jar, and Break on a swarm |
| Diamond | Dug from the deepest rock, near the bottom of the world, rare |
| Ruby | Found in the rock of the high peaks; a foundry strikes coins from it |
| Diamond Ore | Diamonds in the deepest rock, break it for the diamond |
| Ruby Ore | Rubies in the rock of the high peaks, break it for the ruby |
| Coal Ore | A seam of coal in the rock of the high peaks, break it for the coal |
| Coal | Dug from seams in the high peaks, brought up by a mine, or burned from wood at a foundry |
| Sandstone | Dug from under the desert sand, or pressed from sand |
| Water | Scooped from a river |
| Snow | Found on the highest peaks |
| Obsidian | Found deep underground |
| Amethyst | Found deep underground |
| Silt | Dug from the ocean floor |
| Iron Ore | Mined from the Summit |
| Copper Ore | Mined from the Summit |
| Gold Ore | Mined from the Summit |
| Sunstone | Very rare, deep in the caves, or in a chest. For the White Ring |
| Nightstone | Very rare, deep in the caves, or in a chest. For the Black Ring |
| Devotion | Gathered at a temple, from worshippers and offerings |

#### Refined goods and blocks (118)

| Item | How you get it |
|---|---|
| Planks | Sawn from wood |
| Turned Soil | Dirt broken up for planting |
| Brick | Fired from earth in a kiln |
| Glass | Fired from sand in a kiln |
| Marble | Cut and dressed at a workshop |
| String | Hemp fibre, spun at the bench |
| Arrow | Planks and string, at the bench, the bow shoots them |
| Brick Roof Tiles | Fired from brick into curved tiles |
| Stone Roof Tiles | Split from stone into slates |
| Chandelier | Wrought from iron and hung with candles |
| Lantern | Crafted from planks and glass |
| Stone Slab | Split from cut stone |
| Plank Slab | Sawn thin from planks |
| Stone Stairs | Cut into steps from stone |
| Fence | Knocked together from planks |
| Gate | Hung from planks, you pass, animals don't |
| Dark Stone | Stone darkened over a dark-wood fire |
| Dark Brick | Brick darkened over a dark-wood fire |
| Sky Marble | Marble polished with powdered glass |
| Gold Trim | Stone banded with gold |
| Calçada | Limestone knapped into little setts |
| Dark Calçada | Dark stone knapped into little setts |
| Calçada Wave | White and dark setts, laid in a wave |
| Timber Frame | Clay plaster set between planks |
| Cobblestone Wall | Laid from cobblestone, joins up like a fence |
| Stone Wall | Laid from stone, joins up like a fence |
| Brick Wall | Laid from brick, joins up like a fence |
| Dark Stone Wall | Laid from dark stone, joins up like a fence |
| Stone Pillar | Turned from stone, stack them into a column |
| Marble Pillar | Turned from marble, stack them into a column |
| Dark Pillar | Turned from dark stone, stack them into a column |
| Trapdoor | Knocked together from planks, Place opens and shuts it |
| Framed Window | Planks and sand, framed at the bench |
| Vase | Thrown from clay and painted |
| Urn | Beaten from copper |
| White Banner | Woven white, with the gold sun of the sky |
| Black Banner | Woven black, with the red tower of the stone |
| Firefly Lantern | Glass, with fireflies you caught in it |
| Glass Jar | Blown from glass, at the bench |
| Bed | Planks, stuffed with leaves, two blocks long, put down the way you face |
| Painting | A little landscape in a frame, Place on it to wake there when you fall |
| Catapult | Built at the bench, Place mans it, Break throws a stone |
| Storage Controller | Built at the bench, or comes with a town hall, Place on it to reach every storehouse |
| Chest | Knocked together from planks, Place opens it |
| Door | Hung from planks, Place opens and shuts it |
| White Planks | Sawn from white wood |
| White Fence | Knocked together from white planks |
| White Gate | Hung from white planks, you pass, animals don't |
| White Trapdoor | Knocked together from white planks, Place opens and shuts it |
| White Door | Hung from white planks, Place opens and shuts it |
| Dark Planks | Sawn from dark wood |
| Dark Fence | Knocked together from dark planks |
| Dark Gate | Hung from dark planks, you pass, animals don't |
| Dark Trapdoor | Knocked together from dark planks, Place opens and shuts it |
| Dark Door | Hung from dark planks, Place opens and shuts it |
| Dark Brick Wall | Laid from dark brick, joins up like a fence |
| Marble Wall | Laid from marble, joins up like a fence |
| Sky Marble Wall | Laid from sky marble, joins up like a fence |
| White Stone Wall | Laid from white stone, joins up like a fence |
| Dark Grey Stone Wall | Laid from dark grey stone, joins up like a fence |
| Turquoise Stone Wall | Laid from turquoise stone, joins up like a fence |
| Orange Stone Wall | Laid from orange stone, joins up like a fence |
| Wood Mill | Built at the bench, stand by it and wood goes further; Place on it to use it |
| Stripped Oak Log | An oak log with its bark taken off, at the wood mill |
| Stripped White Log | A white log with its bark taken off, at the wood mill |
| Stripped Dark Log | A dark log with its bark taken off, at the wood mill |
| Cabinet | Made at the wood mill |
| Wardrobe | Made at the wood mill, taller than you |
| Bedside Table | Made at the wood mill |
| Wood Panel | Boards for a wall, at the wood mill, goes flat on the face you point at |
| Patterned Panel | Raised squares for a wall, at the wood mill |
| Two-tone Panel | Dark below, light above, a rail between, at the wood mill |
| Stone Mill | Built at the bench, stand by it and stone goes further, and it grinds gravel; Place on it to use it |
| Rail | Iron on wooden sleepers, at an engineering centre, lay it in a line, and it joins up round corners and up a step |
| Steam Engine | Built at an engineering centre, Place it on a rail; Place on it to drive; coal in your hand and Place to fire it |
| Rail Car | Built at an engineering centre, Place it on a train to couple it on the back, five at most |
| Sandstone Brick | Sandstone cut into bricks |
| Sand Path | Sand tamped flat, its corners round off where it stops |
| Sandstone Wall | Laid from sandstone, joins up like a fence |
| Stone Brick | Stone cut square at the bench |
| Stone Brick Wall | Laid from stone brick, joins up like a fence |
| Stone Brick Chimney | Stone brick round a flue, stack them, and the top one smokes |
| Brick Chimney | Brick round a flue, stack them, and the top one smokes |
| Plank Stairs | Cut into steps from planks |
| Oak Table | Built at the workshop |
| Marble Table | Cut and dressed at the workshop |
| Oak Chair | Built at the workshop |
| Red Chair | Built at the workshop, finished in brick red |
| Red Rug | Woven at the workshop, dyed with brick |
| Blue Rug | Woven at the workshop, dyed with glass |
| Green Rug | Woven at the workshop, left undyed |
| Red Glass | Fired from sand, tinted red |
| Blue Glass | Fired from sand, tinted blue |
| Iron Ingot | Smelted at a foundry |
| Copper Ingot | Smelted at a foundry |
| Coins | Struck at a foundry, or found in old chests |
| Weapon Rack | A sword, a spear, an axe and a shield on a rack, a barracks needs one |
| Training Dummy | Straw on a post, for soldiers to practise on |
| Archery Target | Painted rings on a straw boss, for archers to practise on |
| War Tent | Canvas on a pole, pitch it on the march, and Place on it to make camp |
| Campfire | Stones and crossed logs, burning, light for a camp |
| Chain | Iron links, hang a lamp from it, or a kingdom |
| Sky Lift | The Sky Kingdom's own, at its anchor towers, Place on one to ride the chain |
| War Horn | Made at the bench, Break with it in hand calls the Stone Kingdom's next round now |
| White Table | Built at the workshop, in white wood |
| White Chair | Built at the workshop, in white wood |
| White Cabinet | Made at the wood mill, in white wood |
| White Wardrobe | Made at the wood mill, taller than you, in white wood |
| White Bedside Table | Made at the wood mill, in white wood |
| White Panel | Boards for a wall, at the wood mill, goes flat on the face you point at, in white wood |
| White Patterned Panel | Raised squares for a wall, at the wood mill, in white wood |
| Dark Table | Built at the workshop, in dark wood |
| Dark Chair | Built at the workshop, in dark wood |
| Dark Cabinet | Made at the wood mill, in dark wood |
| Dark Wardrobe | Made at the wood mill, taller than you, in dark wood |
| Dark Bedside Table | Made at the wood mill, in dark wood |
| Dark Panel | Boards for a wall, at the wood mill, goes flat on the face you point at, in dark wood |
| Dark Patterned Panel | Raised squares for a wall, at the wood mill, in dark wood |

#### Food (13)

| Item | How you get it |
|---|---|
| Fruit | Picked from a forest |
| Carrots | Harvested from a farm |
| Coffee Beans | Picked from a coffee plant, brew them, or chew them |
| Potatoes | Dug from a farm |
| Cabbage | Cut from a farm |
| Lettuce | Picked from a farm |
| Peppers | Picked from a farm |
| Zucchini | Cut from a farm |
| Broccoli | Cut from a farm |
| Raw Meat | Hunted |
| Cooked Meat | Roasted over a fire |
| Egg | Laid by hens in a pen |
| Milk | From cows in a pen |

#### Drinks (4)

| Item | How you get it |
|---|---|
| Beer | Brewed at a workshop from potatoes, quicker blows for three minutes |
| Kombucha | Brewed at a workshop from fruit and leaves, +2 on every hit for three minutes |
| Coffee | Brewed at a workshop from coffee beans, faster on your feet for three minutes |
| Holy Water | Blessed at a chapel, drink it to heal four hearts |

#### Tools and weapons (38)

| Item | How you get it |
|---|---|
| Stone Axe | Crafted from wood and stone |
| Stone Pickaxe | Crafted from wood and stone |
| Stone Shovel | Crafted from wood and stone |
| Bucket | Crafted from wood |
| Bucket of Water | Filled at a river |
| Wooden Sword | Crafted at the bench |
| Stone Sword | Crafted at the bench |
| Iron Sword | Crafted at the bench from iron |
| Bow | Planks and string, at the bench |
| Pry bar | Crafted at the bench |
| Chalk line | Crafted at the bench |
| Cart | Built from planks and wood |
| Flying Machine | Built at a workshop from planks and wool |
| Iron Axe | Crafted at the bench from iron |
| Iron Pickaxe | Crafted at the bench from iron |
| Iron Shovel | Crafted at the bench from iron |
| Gold Axe | Crafted at the bench from gold |
| Gold Pickaxe | Crafted at the bench from gold |
| Gold Shovel | Crafted at the bench from gold |
| Gold Sword | Crafted at the bench from gold |
| Sky Axe | Crafted at the bench from sky marble and gold |
| Sky Pickaxe | Crafted at the bench from sky marble and gold |
| Sky Shovel | Crafted at the bench from sky marble and gold |
| Sky Sword | Crafted at the bench from sky marble and gold |
| Dark Axe | Crafted at the bench from dark stone and iron |
| Dark Pickaxe | Crafted at the bench from dark stone and iron |
| Dark Shovel | Crafted at the bench from dark stone and iron |
| Dark Sword | Crafted at the bench from dark stone and iron |
| Diamond Axe | Crafted at the bench from diamond and iron |
| Diamond Pickaxe | Crafted at the bench from diamond and iron |
| Diamond Shovel | Crafted at the bench from diamond and iron |
| Diamond Sword | Crafted at the bench from diamond and iron |
| Thunder Stone Sword | Stone Sword upgraded at a temple, stuns what it strikes |
| Thunder Iron Sword | Iron Sword upgraded at a temple, stuns what it strikes |
| Fire Stone Sword | Stone Sword upgraded at a temple, sets what it strikes burning |
| Fire Iron Sword | Iron Sword upgraded at a temple, sets what it strikes burning |
| Ice Stone Sword | Stone Sword upgraded at a temple, freezes what it strikes |
| Ice Iron Sword | Iron Sword upgraded at a temple, freezes what it strikes |

#### Armour (48)

| Item | How you get it |
|---|---|
| Leather Cap | Stitched from hides |
| Leather Tunic | Stitched from hides |
| Leather Leggings | Stitched from hides |
| Leather Boots | Stitched from hides |
| Iron Helm | Plate from your foundry |
| Iron Cuirass | Plate from your foundry |
| Iron Greaves | Plate from your foundry |
| Iron Boots | Plate from your foundry |
| Gold Helm | Beaten gold, it turns a blow better than iron, and wears faster |
| Gold Cuirass | Beaten gold, it turns a blow better than iron, and wears faster |
| Gold Greaves | Beaten gold, it turns a blow better than iron, and wears faster |
| Gold Boots | Beaten gold, it turns a blow better than iron, and wears faster |
| Diamond Helm | Diamond, bound in iron, the best armour there is |
| Diamond Cuirass | Diamond, bound in iron, the best armour there is |
| Diamond Greaves | Diamond, bound in iron, the best armour there is |
| Diamond Boots | Diamond, bound in iron, the best armour there is |
| Sky Helm | White steel and gold, as the Sky Kingdom wears it |
| Sky Cuirass | White steel and gold, as the Sky Kingdom wears it |
| Sky Greaves | White steel and gold, as the Sky Kingdom wears it |
| Sky Boots | White steel and gold, as the Sky Kingdom wears it |
| Dark Helm | Blackened iron, as the Stone Kingdom wears it |
| Dark Cuirass | Blackened iron, as the Stone Kingdom wears it |
| Dark Greaves | Blackened iron, as the Stone Kingdom wears it |
| Dark Boots | Blackened iron, as the Stone Kingdom wears it |
| Swift Leather Boots | Leather Boots upgraded at a temple, faster on your feet |
| Swift Iron Boots | Iron Boots upgraded at a temple, faster on your feet |
| Swift Gold Boots | Gold Boots upgraded at a temple, faster on your feet |
| Swift Diamond Boots | Diamond Boots upgraded at a temple, faster on your feet |
| Swift Sky Boots | Sky Boots upgraded at a temple, faster on your feet |
| Swift Dark Boots | Dark Boots upgraded at a temple, faster on your feet |
| Warded Leather Tunic | Leather Tunic upgraded at a temple, +2 armour |
| Warded Leather Leggings | Leather Leggings upgraded at a temple, +2 armour |
| Warded Iron Cuirass | Iron Cuirass upgraded at a temple, +2 armour |
| Warded Iron Greaves | Iron Greaves upgraded at a temple, +2 armour |
| Warded Gold Cuirass | Gold Cuirass upgraded at a temple, +2 armour |
| Warded Gold Greaves | Gold Greaves upgraded at a temple, +2 armour |
| Warded Diamond Cuirass | Diamond Cuirass upgraded at a temple, +2 armour |
| Warded Diamond Greaves | Diamond Greaves upgraded at a temple, +2 armour |
| Warded Sky Cuirass | Sky Cuirass upgraded at a temple, +2 armour |
| Warded Sky Greaves | Sky Greaves upgraded at a temple, +2 armour |
| Warded Dark Cuirass | Dark Cuirass upgraded at a temple, +2 armour |
| Warded Dark Greaves | Dark Greaves upgraded at a temple, +2 armour |
| Night Sight Leather Cap | Leather Cap upgraded at a temple, see in the dark |
| Night Sight Iron Helm | Iron Helm upgraded at a temple, see in the dark |
| Night Sight Gold Helm | Gold Helm upgraded at a temple, see in the dark |
| Night Sight Diamond Helm | Diamond Helm upgraded at a temple, see in the dark |
| Night Sight Sky Helm | Sky Helm upgraded at a temple, see in the dark |
| Night Sight Dark Helm | Dark Helm upgraded at a temple, see in the dark |

#### Gear (backpacks) (2)

| Item | How you get it |
|---|---|
| Leather Backpack | Hide and string, stitched at the bench, wear it for 10 more bag slots |
| Reinforced Backpack | A leather backpack with iron at the seams, wear it for 20 more bag slots |

#### Rings (2)

| Item | How you get it |
|---|---|
| White Ring | Gold and Sunstone, forged at the High Temple, you move faster and jump higher |
| Black Ring | Obsidian and Nightstone, forged at the High Temple, a dark spark hurts whoever strikes you |


### Tools and weapons

- A better tool is never slower. A stone tool already takes its job near enough at once. A better tier lasts longer, hits harder, and does the wrong job at a normal pace instead of a slow one.
- Bare hands are slower than any tool.
- Tiers and where they unlock (from `src/config/tiers.js`): Iron at age 5, Gold at age 8, Sky, Dark and Diamond at age 10.
- Sword damage by tier: Wooden 4, Stone 6, Iron 9, Gold 10, Sky 12, Dark 13, Diamond 15. Gold is soft and wears sooner than iron.
- Diamond lasts longest at 900 uses (1,080 for the sword).


| Tool or weapon | Damage | Durability | Notes |
|---|---|---|---|
| Stone Axe | 3 | 120 | Crafted from wood and stone |
| Stone Pickaxe | 2 | 120 | Crafted from wood and stone |
| Stone Shovel | 2 | 120 | Crafted from wood and stone |
| Bucket | - | - | Crafted from wood |
| Bucket of Water | - | - | Filled at a river |
| Wooden Sword | 4 | 100 | Crafted at the bench |
| Stone Sword | 6 | 160 | Crafted at the bench |
| Iron Sword | 9 | 300 | Crafted at the bench from iron |
| Bow | - | 200 | Planks and string, at the bench |
| Pry bar | - | - | Clears many blocks at once. No longer made in Duilt; Creative has one |
| Chalk line | - | - | Mirrors what you place. No longer made in Duilt; Creative has one |
| Cart | - | - | Built from planks and wood |
| Flying Machine | - | - | Built at a workshop from planks and wool |
| Iron Axe | 4 | 300 | Crafted at the bench from iron |
| Iron Pickaxe | 3 | 300 | Crafted at the bench from iron |
| Iron Shovel | 3 | 300 | Crafted at the bench from iron |
| Gold Axe | 4 | 200 | Crafted at the bench from gold |
| Gold Pickaxe | 3 | 200 | Crafted at the bench from gold |
| Gold Shovel | 3 | 200 | Crafted at the bench from gold |
| Gold Sword | 10 | 240 | Crafted at the bench from gold |
| Sky Axe | 5 | 500 | Crafted at the bench from sky marble and gold |
| Sky Pickaxe | 4 | 500 | Crafted at the bench from sky marble and gold |
| Sky Shovel | 4 | 500 | Crafted at the bench from sky marble and gold |
| Sky Sword | 12 | 600 | Crafted at the bench from sky marble and gold |
| Dark Axe | 6 | 500 | Crafted at the bench from dark stone and iron |
| Dark Pickaxe | 5 | 500 | Crafted at the bench from dark stone and iron |
| Dark Shovel | 5 | 500 | Crafted at the bench from dark stone and iron |
| Dark Sword | 13 | 600 | Crafted at the bench from dark stone and iron |
| Diamond Axe | 6 | 900 | Crafted at the bench from diamond and iron |
| Diamond Pickaxe | 5 | 900 | Crafted at the bench from diamond and iron |
| Diamond Shovel | 5 | 900 | Crafted at the bench from diamond and iron |
| Diamond Sword | 15 | 1080 | Crafted at the bench from diamond and iron |
| Thunder Stone Sword | 6 | 160 | Stone Sword upgraded at a temple, stuns what it strikes |
| Thunder Iron Sword | 9 | 300 | Iron Sword upgraded at a temple, stuns what it strikes |
| Fire Stone Sword | 6 | 160 | Stone Sword upgraded at a temple, sets what it strikes burning |
| Fire Iron Sword | 9 | 300 | Iron Sword upgraded at a temple, sets what it strikes burning |
| Ice Stone Sword | 6 | 160 | Stone Sword upgraded at a temple, freezes what it strikes |
| Ice Iron Sword | 9 | 300 | Iron Sword upgraded at a temple, freezes what it strikes |



### Armour

You wear head, body, legs, feet, back and ring. Armour points come from the pieces you have on.

- Each point takes 4% off a blow from a bandit, a catapult stone, the Stone Kingdom's army or the Sky Kingdom's guards. A blow never drops below half a heart.
- Armour does nothing against falls or lava.
- Every blow it takes wears it a little.
- A full Sky or Dark set (13 points) takes about half off. A full Diamond set (17 points) takes about two thirds.
- A full Sky set also lets you pass as a Sky Kingdom native (the dark path's disguise).
- **Backpacks** go in the Back slot: the Leather Backpack (4 Hide, 2 String, age 1) adds 10 slots, the Reinforced Backpack (a Leather Backpack, 2 Iron Ingot, 2 Hide, age 5) adds 20. Taking one off moves its contents into the rest of the bag. If there is not room, it stays on and says how much to clear.

Every set has four pieces (Helm, Cuirass, Greaves, Boots; leather is Cap, Tunic, Leggings, Boots):

| Set | Age | Head | Body | Legs | Feet | Total | Durability |
|---|---|---|---|---|---|---|---|
| Leather | 1 | 1 | 2 | 1 | 1 | 5 | 80 |
| Iron | 5 | 2 | 3 | 2 | 1 | 8 | 200 |
| Gold | 8 | 2 | 4 | 2 | 1 | 9 | 160 |
| Diamond | 10 | 4 | 6 | 4 | 3 | 17 | 600 |
| Sky | 5 | 3 | 5 | 3 | 2 | 13 | 300 |
| Dark | 5 | 3 | 5 | 3 | 2 | 13 | 300 |


The Sky and Dark sets are made of iron plus gold (Sky) or dark stone (Dark). Gold armour turns blows better than iron and wears faster. Diamond needs diamonds and a little iron.

### Food and crops

- Eating restores hunger. It refuses if you are not hungry.
- Cooked meat is the best food in the game for its size: a log and 2 raw meat make 2 cooked.
- Settlers and soldiers eat one food a day, cheapest first.

| Food | Feeds | How you get it |
|---|---|---|
| Fruit | 12 | Picked from a forest |
| Carrots | 22 | Harvested from a farm |
| Coffee Beans | 4 | Picked from a coffee plant, brew them, or chew them |
| Potatoes | 20 | Dug from a farm |
| Cabbage | 18 | Cut from a farm |
| Lettuce | 12 | Picked from a farm |
| Peppers | 14 | Picked from a farm |
| Zucchini | 16 | Cut from a farm |
| Broccoli | 18 | Cut from a farm |
| Raw Meat | 5 | Hunted |
| Cooked Meat | 32 | Roasted over a fire |
| Egg | 10 | Laid by hens in a pen |
| Milk | 14 | From cows in a pen |



**Crops** (`src/config/crops.js`). Nine plants grow on farmland, each in four stages of 90 seconds, so ripe in about four and a half minutes:

| Crop | Gives | Notes |
|---|---|---|
| Carrot | Carrots | Your starting seed |
| Potato | Potatoes | Your starting seed. Also brewed into beer |
| Cabbage | Cabbage | |
| Lettuce | Lettuce | |
| Pepper | Peppers | |
| Zucchini | Zucchini | |
| Broccoli | Broccoli | |
| Coffee | Coffee Beans | Seeds come from the hermit's chest or a trader |
| Hemp | Hemp Fibre | Not food. Grows wild on open grass. Fibre makes string, string makes bows |

- Broken ripe, a plant gives its crop and seeds. Broken early, it gives its seed back.
- Breaking grass sometimes drops seeds (about one in five), one kind of crop at a time.
- A farm takes one seed per crop, up to four crops. A carrot seed in means carrots and carrot seeds out.
- You can plant and pick by hand in a farm's soil. What you plant there is yours and the farm leaves it alone.
- Saplings (from leaves) grow into trees in about 10 game days.
- Dirt next to turf turns to turf after 5 to 50 game days.



---

## 9. Getting around: horses, flight, trains

### Horse and cart

- Horses live wild on the plains. They bolt when you come near.
- To tame one, hold fruit or vegetables and Place on it. A tamed horse can be ridden.
- Make a **Cart** by hand (16 Planks, 4 Wood, age 3). Use it on a tamed horse and the horse pulls it.
- A cart carries 40 slots, and you can ride it.

### Flying machine

- Make it at a Workshop: 24 Planks and 12 Wool, age 4. It is a wooden, canvas plane after Leonardo da Vinci.
- Hold it and Place to set it down. Place on it to climb in.
- Flying: Jump climbs, Sneak dives, the Fly key lands. On the ground, Sneak gets you out.
- It stays parked where you leave it.

### Trains

A train runs on a line of **rail** blocks and burns coal. Each part (engine or car) is 8 blocks long, 3 wide and 4 high.

| Part | Made at | Needs |
|---|---|---|
| Rail ×8 | Engineering centre (age 8) | 1 Iron Ingot, 2 Planks |
| Steam Engine | Engineering centre (age 8) | 24 Iron Ingot, 8 Brick, 8 Planks |
| Rail Car | Engineering centre (age 8) | 12 Iron Ingot, 12 Planks |

**Building a line.** Lay rail in a line. It joins its neighbours, turns corners and climbs one step on its own. The engine needs at least 9 rail in a line to be set down.

**Setting the engine down.** Hold the Steam Engine and Place on a rail. It faces the way you look and needs 8 rail behind it.

**Coal.** Hold coal and Place on the engine to fill its bunker (64 at most). One coal carries it 120 blocks, and only while you drive. Coasting is free. Sources:

- Coal ore in the High Peaks (the commonest ore up there).
- A Mine's output (coal).
- The Foundry's "Burn charcoal": 4 Wood makes 1 Coal.

**Driving.** Place on the engine to climb into the cab. Forward and back drive it. Top speed is 12 blocks a second. Let go and it rolls to a stop. Sneak to get down.

**Cars.** Hold a Rail Car and Place on a train to couple it on the back. An engine pulls five cars. Each car holds 1,000 slots of goods (Place on a car to open it, 200 slots to a page) and 10 passengers. A car with goods in it stays coupled until you empty it.

**Taking it apart.** Hit the train to take the last car off, then the engine (with its coal) back into your bag.

**Passengers.** Stations are your settlement ("home") and every living city. Stop the engine within 40 blocks of a station. Whoever was bound there gets off and pays a coin for every 120 blocks they rode. New passengers get on for another station, ten seats a car. They sit in the windows, and pointing at a car shows who is aboard and where they are going.

In Creative, a train needs no engine item and its fire never goes out.

### The Sky Lift

The Sky Lift is a winch in gold: 2 Gold, 2 Chain, 2 Planks by hand at age 10 (chain: 1 Iron Ingot makes 4, age 5). It only carries you where the world generator put one: the lifts at the top of the four anchor towers, and the lifts at the landings by the Sky Kingdom's gates. A Sky Lift placed anywhere else does nothing when you Ride it. See section 13.

---

## 10. The world

### Biomes

The land is made from two slow noise fields (warmth and wetness), so similar country sits together. There are ten biomes.

| Biome | What it is |
|---|---|
| Plains | Open grass with few trees, huge flat patches. Your settlement lands here. Wild hemp grows on it. Horses, sheep, cows, pigs and chickens live here |
| Oak Forest | The everyday wood, on moss. Dense trees |
| Birch Forest | Cooler. Pale trunks and leaves. Grass underfoot |
| Dark Forest | The thickest and darkest wood, on dark moss. Boar live here |
| Giant Grove | Rare. Takes over wooded or wet country. Gigantic trees on a floor of fallen leaves. Tree tribes build here |
| Desert | Sand over sandstone, with outcrops. Rabbits |
| Wetland | Low, flat, clay ground with pools |
| Mountains | A short range, about 20 blocks tall, with streams. Bare gravel above the tree line. Goats |
| High Peaks | Rare and very tall (50 to 70 blocks). Where most ore is |
| Ocean | Deep water ringed by sand beaches |

### Resources underground and on the surface

- **High Peaks ore** (chance per rock cell): Iron 1.8%, Copper 1.4%, Gold 0.8%, Coal 2.4%, Ruby 0.4%.
- **Diamond** is dug from the deepest rock near the bottom of the world.
- **Gravel** sits in pockets through the rock at any depth, about 4 blocks in every 100.
- **Obsidian** and **Amethyst** are found deep underground.
- **Sunstone** and **Nightstone** are very rare crystals on cave walls below height 30, about 0.3 per chunk. They also turn up in chests.
- **Sandstone** lies three blocks under desert sand and breaks through in outcrops.
- **Boulders** near the start are the first stone you can reach without a mine.
- **Berry thickets** grow by the water near the start.
- **Fireflies** come out at night. Make a Glass jar, then Break on a swarm.
- Breaking leaves sometimes drops a sapling (10%) or fruit (6%).

### Places to find

Distances are from the middle of the world. Each place is placed from the world's seed, so the same seed always has the same places.

| Place | How many | How far | What is there |
|---|---|---|---|
| Hermit's hut | 1 | 320 to 420 | The hermit, who tells the story. A chest |
| Bandit camp | 3 | 480 to 720 | Bandits and a chest of takings |
| Ruin | 4 | 300 to 700 | Broken walls and pillars, a chest |
| Abandoned mine | 2 | 300 to 850 | Timber over a hole, a chest |
| Monument | 2 | 380 to 900 | A tall black stone, gold at the top, a chest |
| Forgotten temple | 2 | 450 to 950 | Marble pillars and an altar, a chest |
| Tree tribe | 3 | 380 to 950 | A village in giant trees. People never come down |
| Living city | 2 | 480 to 1,050 | Walls, guards, a plaza, merchants, a dozen houses |
| Abandoned city | 2 | 480 to 1,050 | The same, crumbled and empty, with more and better chests |
| Stone Kingdom outpost | 2 | 600 to 1,150 | A dark-brick fort, four guards, an armoury of two chests |
| The Stone Kingdom | 1 | 1,000 to 1,400 | The walled dark city (section 13) |
| The Sky Kingdom | 1 | about 5,000 | The floating island (section 13) |

- Old roads join every landmark to your home, and always lead to the Stone Kingdom's gate.
- Coming within about 24 blocks of a place finds it. You get a message and a diamond marker on the map.
- Messengers and explorers bring news of places with a direction.
- Anything you build or dig in a distant chunk shows in the far terrain as it really is.
- The Stone Kingdom's walls and towers show on the horizon. The Sky Kingdom shows as a gold light low in the sky, brighter at night.

### Chests and loot

Loot is rolled from the chest's position and the world seed the first time it opens, so the same chest always holds the same things. Each table also has a small chance of a ring ore.

| Chest | Typical contents |
|---|---|
| Old cave chest | Gold, iron, copper, cooked meat, lanterns, coffee, coins |
| Bandits' takings | Gold, meat, iron, wool, beer, kombucha, coins, rarely a stone sword |
| Hermit's chest | Fruit, seeds, eggs, lanterns, gold, kombucha, coffee beans |
| Stone Kingdom chest | Iron, dark stone, gold, iron sword, dark armour, beer, coins |
| Tree people's chest | Fruit, hemp, string, arrows, a bow, seeds, kombucha, coins |
| City house chest | Meat, wool, gold, beer, lanterns, a painting, coins |
| Outpost armoury | Iron, dark stone, gold, dark sword, diamonds, rubies, dark armour, arrows, 20 to 50 coins |
| Abandoned city chest | Gold, gold sword and armour, iron, amethyst, gold trim, a painting, rubies, diamonds, coins |
| Ruin chest | Cooked meat, fruit, a stone sword, leather armour, beer, gold, coins |
| Forgotten temple offering | Gold, holy water, devotion, an iron sword, Sky armour, rarely an upgraded piece |
| Miners' chest (abandoned mine) | Iron, copper, gold, coffee, dark armour, leather boots, meat, coins |
| Monument offering | Gold, iron sword, dark and Sky armour, drinks, fruit, rarely an upgraded piece |

### How the world changes

- Leaves decay when their tree is gone.
- Water flows and can be filled in. A bucket clears a lone water block.
- Turf spreads onto bare dirt over 5 to 50 game days.
- Clouds drift, fireflies fly their own loops, campfire flames flicker.
- Animals and wanderers come and go (section 11).

---

## 11. People, animals and trading

### Animals

| Animal | Lives in | Hit points | Drops | Notes |
|---|---|---|---|---|
| Deer | Forests, plains, groves | 6 | 2 to 3 raw meat, 1 to 2 hide | Skittish |
| Rabbit | Plains, desert, birch forest | 2 | 1 raw meat, 0 to 1 hide | Skittish |
| Boar | Dark and oak forest, groves | 9 | 2 to 4 raw meat, 1 to 2 hide | Runs only once hit |
| Goat | Mountains, High Peaks | 6 | 1 to 2 raw meat, 1 hide | Skittish |
| Sheep | Plains, Mountains | 5 | 1 to 2 raw meat, 1 to 3 wool | Can be kept in a pen |
| Cow | Plains, wetland | 9 | 3 to 4 raw meat, 1 to 2 hide | Can be kept in a pen |
| Pig | Plains, oak forest, wetland | 5 | 2 to 3 raw meat | Can be kept in a pen |
| Chicken | Plains, oak forest, wetland | 2 | 1 raw meat, 1 to 3 feather | Can be kept in a pen |
| Horse | Plains | 12 | 2 to 3 raw meat, 1 to 2 hide | Tame it with fruit or vegetables, then ride it |

**Pens:** fence in an area with a gate. Lead animals in with food in your hand, then shut the gate. A claimed Pen makes eggs, milk and wool. Keeping animals is an Age 4 goal.

### Wanderers and townsfolk

| Who | Hit points | Notes |
|---|---|---|
| Settler | n/a | Lives in your houses, works your buildings |
| Hermit | 10 | Keeps to themself but talks. Gives errands and tells the story |
| Messenger | 8 | Brings news, or a line of the story. Tap for the next line |
| Explorer | 10 | Passes through, tells of places |
| Citizen | 10 | Lives in a city |
| City guard | 24 | Keeps the peace. Hits for 3 |
| Merchant | 10 | A stall in a living city |
| Tree person | 16 | Neutral until robbed or struck, then shoots from the trees |
| Bandit | 12 | Hostile from age 2. Hits for 2 |
| Stone guard | 20 | Stone Kingdom guard |
| Stone King | n/a | On his throne. Speaks to you by your ring |
| Sky guard | 22 | Island guard. Hits for 3 |
| Royal guard | 28 | Beside the Sky King. Two always stand with him |
| Sky King | 70 | On his golden throne. Hits for 4 |

Tapping a person opens a speech bubble with a line or two, chosen by who they are. Tap again for the next.

### Trading

Traders take only coins. A market (Age 5) brings one trader, and each Evolve brings the next, each living in the market as a resident:

| Trader | Sells |
|---|---|
| Grub (stonemonger) | Stone, cobblestone, white and coloured stones, marble, wood, planks, white and dark wood, fruit, vegetables, cooked meat, coffee |
| Snikkit (smith) | Iron, copper and gold ore, iron ingots, swords, axes and pickaxes, bows and arrows, leather and iron armour |
| Mottle (glazier) | Glass, brick, windows, gold trim, lanterns, chandeliers, vases, urns, rugs, paintings, amethyst |
| Bramble (seedwife) | Every crop seed, saplings, eggs, milk, wool, feathers, hide, hemp, string |

Living cities have two more merchants (Ottavio and Mabel), at stalls in the plaza:

| Trader | Sells |
|---|---|
| Ottavio (merchant) | Marble, sky marble, gold, gold trim, amethyst, windows, chandeliers, paintings, firefly lanterns, diamond (45 coins), ruby (30), gold sword and gold armour |
| Mabel (provisioner) | Cooked meat, fruit, vegetables, eggs, milk, beer, kombucha, coffee, wool, rare seeds, hemp seeds |

Most goods cost 2 to 8 coins. Swords and armour cost 4 to 26, a ruby 30 and a diamond 45. Open a stall by pointing at its keeper.



---

## 12. Combat and the war

### Your own fighting

- Break (left click) attacks. Swords hit hardest (damage in section 8). Axes and pickaxes also hurt a little.
- Blows vary: the time between them changes by about 40%, the damage by about a quarter, and about one blow in six is heavy (twice as hard, and it throws the target back). This holds for every fighter.
- Drinks help: Beer for quicker blows, Kombucha for +2 on every hit, Coffee for speed.
- Temple upgrades add Thunder (stun), Fire (burn) and Ice (freeze) to a Stone or Iron Sword.
- Armour cuts damage (section 8). The Black Ring sparks back at whoever hits you.

### Bow and arrows

- Make hemp fibre into string (3 Hemp Fibre makes 1 String), then a Bow (3 Planks, 3 String) and Arrows (1 Planks, 1 String makes 4). Age 1.
- Hold Break to draw, release to shoot. A full draw takes 0.9 seconds. The longer the draw, the faster and harder the arrow.
- A twitch, tabbing away or pausing shoots nothing.
- Arrows drop a little over distance, hit animals and bandits for 5, stick in blocks, and go back into your bag if you walk over them within 60 seconds.
- Arrows hit every unit of the dark army, rams and catapults included.

### Catapult

- Make one at the bench: 10 Planks, 4 Wood, 6 Stone, age 4.
- Place on it to man it. Look where you want the stone to land. An arc and a ring show where it will fall.
- Break throws a stone from your bag. It lobs at 50 degrees, or 70 degrees to clear a wall, with the force set to the distance.
- A stone knocks out a crater and hurts bandits and animals under it. Your claimed buildings, chests and bedrock are spared.

### Bandits and raiders

- Bandits are hostile from age 2. They come at you near their camp, further out at night, hit for a heart, and run when badly hurt.
- Most nights, 2 to 3 raiders walk in from the nearest camp to rob a storehouse, or come for you if you have none.
- Beat a raider and you get back what they took.

### Soldiers

A **Barracks** holds a soldier per bunk, up to six. Choose who to train from the Barracks pop-up. You pay up front from your bag. They join one at a time, about two and a quarter minutes each (0.15 of a game day), and live in town.

| Soldier | Costs | Hit points | Fights |
|---|---|---|---|
| Warrior | 3 food, a Stone Sword | 20 | Melee: 3 per blow, every 1.1 seconds |
| Swordsman | 4 food, an Iron Sword, an Iron Cuirass | 32 | Melee: 5 per blow, every second |
| Archer | 3 food, a Bow, 20 Arrows | 14 | Arrow at up to 20 blocks, 3 damage, every 2 seconds |
| Catapult crew | 5 food, a Catapult, 10 Stone | 16 | Sets up a catapult in front of the barracks, lobs stones out to 38 blocks |

- A fallen soldier is gone. Training another costs the same again.
- Hungry soldiers hit at 60% until fed.
- The HUD shows who is nearest to coming out of training, with a bar.

### Defence buildings (from age 8)

Each is claimed like any building and fights in the war. All are detailed, and are built to be looked at.

- **Stone Wall:** a section 8 to 32 long and up to 4 thick, at least 4 tall, with a walk along the top behind battlements. Claimed, each block takes three blows from a ram or siege stone to break.
- **Gatehouse:** two towers with guardroom floors, a gate of at least two doors side by side, battlements. It shuts its gate when a round is about to come.
- **Watchtower:** at least 11 tall with a stair up inside, a lantern on top and battlements. Two archers keep watch and shoot at anything of the Stone Kingdom's within 26 blocks.
- **Barracks:** 4 beds, 2 weapon racks, 2 training dummies or archery targets, and a hall bigger than a house.

Raiders break blocks for real. A claimed building that loses blocks stops working until you put them back.

### The war: the Ten Rounds

The war begins the moment you reach **Age 10**, whichever ring you bear (or none). The wall comes down and the Stone Kingdom declares war.

- The game cannot be finished while the war is on.
- The first round comes half a game day after the declaration. Rounds come 1.5 game days apart.
- A war horn sounds about a minute of play before each round, and says how many are coming and from where.
- You can sound your own **War Horn** (2 Hide, 1 Gold, 1 Planks, age 10) to call the next round early.
- A round lost comes again a day later. There is no game over and no tax. Raiders loot a share of your storehouses.
- A round won pays gold: 4 plus 2 for each round number, so round 1 pays 6 and round 10 pays 24.
- Forge the **Black Ring** before or during the war and the Stone King calls his army home. You are his ally and the war is off. (That is the dark path.)

| Rounds | Who comes |
|---|---|
| 1 | 3 bandits |
| 2 | 4 bandits |
| 3 | 5 bandits |
| 4 | 3 bandits, 2 archers, a battering ram |
| 5 | 3 bandits, 3 archers, a battering ram |
| 6 | 2 bandits, a soldier, 4 archers, a battering ram |
| 7 | 4 soldiers, 3 archers, a siege catapult |
| 8 | 4 soldiers, 3 archers, a siege catapult, a battering ram |
| 9 | 5 soldiers, 3 archers, 2 siege catapults |
| 10 | The Warlord on his black beast, 4 soldiers, 3 archers, a siege catapult |

| Enemy | Hit points | Notes |
|---|---|---|
| Bandit | 12 | Hits for 2 |
| Archer | 10 | Keeps its distance and shoots |
| Soldier | 28 | In armour, never runs. Hits for 3 |
| Battering ram | 40 | Batters whatever stands in its way. Break it before it breaks your walls |
| Siege catapult | 30 | Lobs stones at your buildings from 26 blocks |
| The Warlord (Vorhak) | 80 | Hits for 5. The beast and the Warlord hunt you |
| Black beast | 50 | Hits for 4 |

Win round 10 and the war ends for good. Fireflies drift across your land at night, and the victory screen tells the end of the story.

---

## 13. The story and the two paths

### The setting

- The **Sky Kingdom** is a floating island lit by fireflies. Its people follow the **white god**, who has no name. You are from there.
- The **Stone Kingdom** is a walled city of dark stone. Its people follow the **dark god**. Its army is why you fell.
- The **Temple** is where you choose. At the High Temple you forge one ring. That choice decides how the game ends, and it is final for that world.

### The Temple, devotion and the rings

- Build a Temple (age 4). It climbs Shrine, Chapel, Temple, Great Temple, High Temple.
- Each level is built (windows, lights, pillars, gold trim, banners) and then paid for in **devotion** when you evolve it (3, 8, 15 and 25 devotion).
- The Temple makes devotion over time, more with worshipping settlers. Offerings add more: fruit, a harvest, a meal, gold (best), a candle.
- Holy water (1 Glass, 1 Devotion) heals four hearts. Needs a Chapel.
- At the High Temple you can forge a ring:

| Ring | Cost | Effect |
|---|---|---|
| White Ring | 3 Sunstone, 4 Gold, 12 Devotion | 1.2 times faster, 1.3 times higher jump |
| Black Ring | 3 Nightstone, 4 Obsidian, 12 Devotion | Sparks back at a bandit who hits you |

Forging one closes the other for good. Sunstone and Nightstone are the hunt: very rare crystals in the deep caves and in chests.

### The Sanctuary and the guardian

Only the bearer of a ring can raise its Sanctuary (10 devotion). Raising it calls your god's guardian.

| | White Sanctuary | Black Sanctuary |
|---|---|---|
| Built from | Marble, sky marble, gold trim, lights, open sky | Obsidian, dark stone, dark brick, a pit |
| Guardian | Aurelion, a stag of light (60 hp) | Umbra, a shadow beast (70 hp) |
| Gift | Heals you while you are near it | Enemies near it lose their nerve and run |

Tap your guardian to cycle its orders: follow, stay, attack. Both fight bandits. If it is downed, it goes back to its Sanctuary and returns after a day.

### The Stone Kingdom

A walled city of dark stone 1,000 to 1,400 blocks from home. An old road always leads to its gate.

- Walls ten high with seven towers, and a gatehouse with black banners and a gold lintel.
- Calçada streets with lamp posts.
- The keep, with pillars, a red carpet and the throne.
- The dark god's temple, with a Nightstone altar.
- The armoury, barracks, a market of calçada waves with stalls, and about twenty dark houses.
- The Stone King stands on his dais and speaks to you according to your ring when you tap him.
- Guards at nine posts are hostile to the White Ring and to anyone who strikes one.

### The white path (defend)

- Forge the White Ring (or neither). At Age 10 the war comes. Win the Ten Rounds.
- Your White Sanctuary and Aurelion fight beside you.
- The Sky Kingdom never appears. It is not generated, not on the map and not on the horizon.
- Win: the dark army is broken, fireflies bless your land, and the white ending plays.

### The dark path (conquer)

Forge the Black Ring and you become the Stone King's ally.

**The oath.** Place on the Nightstone heart of the altar in the Stone Kingdom's dark temple, with the Black Ring on, and the King grants you **1,000 warriors**. About 30 fight on the ground at once. When one falls, the count drops and a fresh one marches in.

**Commanding the army.** The sword banner on the HUD shows your count. Tap it for the command wheel: follow, hold here, attack, form a line.

**Feeding the army.** Every game day it eats a meal for every hundred warriors, from your bag then your storehouses. Short of food, 3% desert each day.

**Making camp.** A **War Tent** (4 Wool, 2 Planks) lets you wake there, and the army holds round it. A **Campfire** (2 Planks, 2 Stone) burns with a light of its own.

**The expedition.** From the map, send the army to the Sky Kingdom. It marches on its own for 2 days, still eating, and makes camp beyond the nearest anchor tower: a cleared patch, three war tents, a campfire and two black banners. Use "Join your army at its camp" to go there. Your first order breaks camp. While it is away nobody is with you on the ground.

### The Sky Kingdom

A floating island about 5,000 blocks from home, 220 blocks across, its floor at height 172. It exists only on the dark path, and in Creative to look at.

- Rock underneath, deepest in the middle, with three waterfalls off the rim and white trees. A hole in the ground below it, as if torn out of the land.
- A white city wall with a gold band, eight towers and a gatehouse on each of four avenues.
- Four calçada avenues to the citadel, lamps down both sides.
- Three districts of houses (cottages, two-storey townhouses, villas with porticos), gardens and fountain squares.
- A military quarter: barracks, armouries and training yards.
- The citadel: its own wall and corner towers, a courtyard, and the palace with a stepped gold roof and spire.
- The throne room: a blue rug, firefly lamps on marble pillars, and the Sky King on his golden throne.
- About thirty guards in white and gold, and two royal guards always at the King's side.
- Four **anchor towers** stand on the ground around it. Each is sky marble with gold corners, a stair inside, a platform with lamps, and a chain up to the island's rim. Two guards stand at the door and one on the platform.
- A **Sky Lift** at the top of each tower rides up the chain to the island. A lift at each landing outside the gates rides back down. Warriors following you come too.

**Three ways to take it:**

1. **Storm it.** Take an anchor tower, ride the lift, fight across the island with warriors, catapults, archers and Umbra, and take the palace.
2. **Go home in disguise.** In the full Sky armour you walk in as one of them. A **suspicion meter** (an eye and a bar) fills while you run, show the Black Ring or Stone Kingdom gear, crowd a guard, linger in the throne room, or bring more than three warriors. It drains while you behave. A ? shows over guards looking you over and a ! over those who have seen through you. When it fills, or you strike, you are discovered and it is open battle. Your first blow while unseen lands three times as hard.
3. **Cut the chains.** Break any link of a tower's chain to cut the whole chain. It drops away and that tower's lift stops working. Cut all four and the island sinks. You are told each day, and two game days later the Sky Kingdom yields and the King comes down without a blow.

**The throne room fight.** The King's blows vary like every fighter's. Before a heavy blow he raises his arms and glows white. Step back and it misses. If a royal guard falls while the King lives, another comes from the palace door 18 seconds later.

**Losing an attack.** An attack begins when you reach the island or its towers with the Black Ring and ends if you leave alive. You lose it if you fall there or your whole army does. You wake at home, what you carried is left in a chest where you fell, and the Sky Kingdom taxes you 25% of what your buildings make, then 35%, 45% and at most 50% after each lost attack, until it falls. Each building that makes something shows a Taxes line. The Stone King makes up 75% of the warriors lost, then 50%, then 25%, then none.

**Winning.** When the Sky King falls, its guards lay down their arms. The island becomes your land (build anywhere on it). The Stone King names you **Lord of the Sky** and sends 64 gold. The dark ending plays, and the game finishes once the last age is done.

### Tales and the lore book

- Messengers bring a line of the story about half the time, and the hermit tells the rest, by your age, Temple and path.
- The **Lore** tab in the Goals panel fills in as you learn. It has eleven pages: the fall, the Sky Kingdom, the Stone Kingdom, the two gods, the white god, the dark god, the two kings, the hermit, your guardian, the four chains, and how it ended. A page unlocks from what you have heard, the places you found, or what you did.
- A new Duilt world starts with an illustrated four-page intro. Each path has its own illustrated ending.

---


## 14. History of the game

### How to read this chapter

This repository's git history is a shallow copy. It starts at pull request #125 on 5 October 2026 and has 109 commits to #175 on 13 October 2026. What came before is reconstructed from the design notes in `docs/`, which record what was asked for and what shipped. Where a pull request number is known, it is given.

The notes show a pattern: the game was built from the player's own messages. Many entries quote a request almost word for word ("asked for directly") and then record what was built.

### Chapter 1: a creative sandbox

The first version was a browser voxel builder in the style of Minecraft's creative mode, made with Three.js and plain JavaScript. It ran with no server.

- Move, fly, break and place blocks with a raycaster, on a chunked world with a mesher that skips hidden faces.
- Undo and redo, a box selection with copy and paste, and mirror (symmetry) building.
- A gamification layer: XP, levels, achievements, daily challenges, streaks, and unlockable blocks. XP rewarded variety, so using many block types paid more than repeating one.
- Saving three ways: local saves in the browser, export to `.voxworld.json` or MagicaVoxel `.vox`, and optional cloud sync.
- Cloud sync uses Neon: first Stack Auth (which turned out to be closed to new projects, with password sign-in switched off), then Neon Managed Better Auth with the Data API and row-level security. Only changed chunks upload. The database schema now lives in numbered migration files.
- Phones were supported from the start: a joystick, drag to look, and on-screen buttons.

### Chapter 2: Duilt

The sandbox grew a game inside it, called **Duilt**. The idea in `src/config/structures.js`: a building is a region the game agrees to call something, so a farm is a handful of tilled soil by water, not a fenced enterprise. Cheap buildings mean you make many of them, and the interest lives in chaining them.

- Land is the reward: a small plot that grows with each age, drawn as a wall you can see.
- Hunger "tuned to nag, never to kill".
- Four skills levelled by milestones, not grinding.
- Settlers who move into houses, work buildings, and eat.
- A bag instead of a wallet, then storehouses, then a storage controller.
- A bench of recipes gated by age.

The Creative mode survived by becoming a flag on the same engine: everything free, nothing to lose.

At this stage the game had six ages. They were renamed to fit the story (Exile, Roots, Forge, Hearth, Bastion, Reckoning) and later expanded to twelve (chapter 9).

### Chapter 3: combat (Phase 6)

- **6a:** ten hearts, fall and lava damage, healing (faster in a house), dying leaves a chest, and the 27-slot Chest.
- **6b:** wood, stone and iron swords (damage 4, 6, 9). Bandits hostile from age 2. Night raids on storehouses.
- **6c:** the catapult, man it with Place, aim by looking, throw stones that make craters.

### Chapter 4: the story (Phase 7)

The lore note "Duild new idea for lore" set two kingdoms and two paths. It was built in lettered steps:

- **7a** the decorative block pack: dark stone and brick, sky marble, gold trim, firefly lanterns, timber framing, stackable pillars, walls that join like fences, trapdoors, framed windows, vases, urns and banners.
- **7b** armour and the ring slot. Leather, Sky and Stone (now Dark) sets.
- **7c** the Temple, devotion, loot chests, Sunstone and Nightstone, the two rings.
- **7d** the Sanctuaries and their guardians.
- **7e** the Stone Kingdom, a whole walled city planned once from the seed.
- **The white path:** the war and the Ten Rounds, plus the defence buildings (wall, gatehouse, watchtower, barracks). The wall coming down was moved from forging the ring to reaching the last age, so the war must be fought while you scramble to forge a ring.
- **The dark path, part 1:** the oath, a 1,000-strong army, command wheel, rations, war tent and campfire.
- **The dark path, part 2:** the floating Sky Kingdom with its city, palace, anchor towers and lifts, then losing an attack and taxes, the throne room fight, cutting the chains, the disguise and suspicion meter, and the expedition.
- **7j** the story told: an illustrated intro, an ending for each path, messengers' and the hermit's tales, and a lore book.

### Chapter 5: the playtest list (PR #29)

After playing the game, the author wrote a list of nine improvements. Each shipped with its own test file.

| Id | What |
|---|---|
| P1 | Homes: beds, a painting that sets where you wake, furnished houses |
| P2 | Forests: leaves with their own tones, light and shade |
| P3 | Mobs and a third-person avatar you can dress; F5 changes view |
| P4 | Places to find: ruins, forgotten temples, abandoned mines, monuments, each with a chest |
| P5 | Drinks: beer, kombucha, coffee |
| P6 | Upgrades: boots, Swift, Warded, Night Sight; Thunder, Fire, Ice swords |
| P7 | Held items drawn in 3D in your hands |
| P8 | Saplings that grow into trees in 10 game days |
| P9 | Roads: calçada blocks, old roads joining every landmark |

### Chapter 6: look, feel and sound

After the Sky city landed, the author felt the buildings were great but the game as a whole looked dull and old, and the sounds were too high-pitched. A revamp was planned (`docs/plan-look-and-sound.md`):

- A **showcase world**, a fixed Creative world with every building, animal and person laid out, camera spots, and a script that takes before-and-after screenshots at phone size. Done.
- **Colour and light:** soft shadows where blocks meet (ambient occlusion baked into the mesh) are marked done in the plan. The code also has tone mapping with a small saturation lift (`src/render/atmosphere.js`).
- **Textures** at 32 by 32 from photos, **atmosphere** (valley fog, island mist, light shafts), **animals and people** remodelled, **items** reviewed.
- **Sound** moved from tones made in code to recordings, with ambience by place and time, music, and sliders for master, effects, ambience and music. The sliders and sound code exist.

### Chapter 7: backlog batch 2 ("Another batch for Duilt")

The second list. Most important was **mobile fighting controls**: drag to look, tap to break, Jump and Place on the right. Then a long set of fixes and systems, many shipped in later pull requests:

- Worlds list loads at once. Own confirm pop-ups instead of the browser's. Fewer system messages.
- Farm seeds reworked: one seed per crop, up to four.
- Tool and armour tiers (stone, iron, gold, sky, dark; later diamond).
- Skills back, with the University raising them and unlocking engineering.
- 3D icons in the bag.
- **Ways to travel and haul**, researched at an Engineering Centre: horse and cart, a flying machine, a train.
- **More places in the wild:** abandoned and living cities, tree tribes, Stone Kingdom outposts.
- The Storage Controller and the Town Hall that comes with one.

### Chapter 8: backlog batch 3 ("Quick improvements"), 5 to 7 October 2026

Pull requests #127 to #166. A sample:

| PR | What |
|---|---|
| #125 | Flying machine becomes a vehicle you park |
| #126 | The ground is mostly grass, not sand; beaches only by the sea |
| #127, #128 | Loading screen with real progress; autosave bug fixed (it saved every frame after five minutes) |
| #130 | Quick wins: tool wear bar, swimming out of water, lighter stone, logs, water, a block goes into water |
| #131 | Clouds drift; fireflies fly real loops |
| #132 | Campfire flames, turf spreads, logs lie in three directions, trapdoors on any face |
| #133 | Room for 4,096 block ids |
| #134 | Every wood its own fence, gate, door and trapdoor; a wall for every stone |
| #135, #136, #137 | Slabs in the top or bottom half; stone brick and chimneys that smoke; desert blocks |
| #139 | Grass tufts |
| #140 | Bow and arrows, from hemp that grows wild |
| #142 | Wood mill |
| #143 | Settlers eat once a game day |
| #145, #146 | Buildings with their own outlines; University and Engineering moved earlier |
| #147 | Backpacks |
| #148 | Farms show their crops |
| #149 to #151, #153 | Barracks train warriors, swordsmen, archers and catapult crews; progress on the HUD; soldiers live in town |
| #152, #153 | Saved builds turn; path corners; bow: hold to draw, let go to shoot |
| #155 | Stone from cobblestone, white stone and marble |
| #157 | Furniture in every wood |
| #159, #161, #162 | **Trains:** rail, a steam engine, cars with 1,000 slots, coal and charcoal |
| #163 | Desktop controls: Ctrl runs, Shift sneaks, double-tap forward to run |
| #164 | Stone mill: cheaper stone variations, gravel and sand |
| #165 | Gravel in pockets underground |
| #166 | Buildings deliver to storehouses first; a spinner while saving |

Items 12 and 27 were dropped at the author's request. Composting (#9) was left for last and is still open.

### Chapter 9: backlog batch 4, "an endless game", 11 to 13 October 2026

The author's goal: "This game should feel like infinite. After beating whatever army we should have lots of more stories." The batch was planned on 11 October.

| PR | What |
|---|---|
| #167 | Notification centre, shorter away toast, farms make half as much, a bigger storage list, a quarry gives four stones, people talk |
| #168 | **Twelve ages**, three goals each to age 5 and four after, every goal counts |
| #169 | **Tree tribes:** villages in giant trees, neutral until robbed or struck |
| #170 | **Craft what's missing:** one button by Evolve |
| #171 | Lanterns: lights close together share one |
| #172 | **Cities:** two living, two abandoned, in every world |
| #173 | **Gems:** diamonds deep down, rubies in the peaks, diamond tools and armour |
| #174 | **Stone Kingdom outposts:** rare dark forts with a guarded armoury |
| #175 | **Train passengers:** stations at home and every living city, fares in coins |

### Timeline at a glance

| Date | What happened |
|---|---|
| Before 5 October 2026 | The sandbox, Duilt, combat, Phase 7 lore, the playtest list, the first ages (reconstructed from notes) |
| 5 October | Flying machine, grassy ground, loading screen, autosave fix (#125 to #128) |
| 6 October | Batch 3 quick wins, mills, barracks, backpacks, bows (#129 to #155) |
| 7 October | Furniture, trains, controls, stone mill, gravel, storehouse delivery (#157 to #166) |
| 11 October | Batch 4 planned. Notification centre. Twelve ages. Tree tribes (#167 to #169) |
| 12 October | Craft what's missing (#170) |
| 13 October | Lanterns, cities, gems, outposts, train passengers (#171 to #175) |

---

## 15. What is planned

From `docs/backlog-batch-4.md` and `docs/backlog-batch-3.md`, in the author's suggested order. None of this exists yet.

**C. The gods' resolution (the end of the main story).** After the big wars, Place on your Sanctuary's heart to step into the **god's cube**: a closed, unbreakable 100 by 100 by 100 room with the other god inside. On the white path you face the dark god, on the dark path the white one. Two ways out:

1. Kill the god, a boss fight in phases with waves of creatures.
2. Steal his stash (thousands of coins and the **wand**) and reach the exit alive.

The wand picks a block, then beams copies of it wherever you point, and also does damage. Open question: does copying cost anything?

**D1. More civilisations to raid.** Done so far: tree tribes, cities, gems, outposts. Still to come: two or three new peoples. Each one you take is marked on the map, and a few new ones appear over time.

**D2. The market: every item, and a reward for all of them.** Every item in the game will be obtainable somehow (crafted, dug, dropped, found or bought), checked by a test. Traders stock hard items on a rotating basis. A **collection book** ticks off every item you have held, with milestone rewards and a big one for the full set. Open question: what is the full-collection reward?

**D3. Side story: time travel.** Unlocked after the first end game. A craftable **time machine** to sit in and pick:

- **Past:** a world of dinosaurs and mythological creatures. Dinosaurs hit hard, so you need new gear first. Feed one to tame it, then ride it or have it fight beside you. Take eggs home, hatch them, and build an army of dinosaurs.
- **Future:** a huge city with flying cars and automated trams, built from glass towers, neon, metal and screens. Find their university to bring the knowledge home, which unlocks the future blocks and tech in the present.

Each era is its own world, saved apart from your home world.

**E. A third mode: Battle.** "Some kind of age of empires." You start alone with rivals about 5,000 blocks apart, with the dark and white kingdoms as factions. Built in steps: scripted computer players first, then AI players using an API key through a server, then real multiplayer with friends (the biggest piece).

**Smaller open items:** composting (a compost bin that makes compost from seeds and leaves, which speeds growth on farmland), and the rest of the look and sound plan.

---

## 16. Glossary and file map

### Glossary

| Term | Meaning |
|---|---|
| Age | One of twelve steps. Each has a land size and goals |
| Anchor tower | One of four towers on the ground that hold the Sky Kingdom's chains |
| Claim | Telling the game "this is a farm". Needs the right blocks |
| Cell | One block position in the world |
| Devotion | Resource made at a Temple from worshippers and offerings |
| Evolve | Raise a building a level |
| Landmark | A place made by the world generator (hut, camp, ruin, city) |
| Lord of the Sky | Your title when you take the Sky Kingdom |
| Place | The right-click action. Sets blocks, and also opens, uses, rides, drives |
| Ring | The White or Black Ring, forged once per world |
| Round | One wave of the Stone Kingdom's attack (ten in all) |
| Sandbox | The code's name for Creative mode |
| Station | A place where a group of recipes can be made |
| Structure | A building the game recognises |
| Tier | A level of a building, or a material grade of a tool |
| Warrior | One of the 1,000 given by the Stone King (or the cheap barracks soldier) |

### Where things live in the code

| Folder or file | What it holds |
|---|---|
| `src/config/` | All the content: blocks, items, recipes, structures, ages, quests, traders, armour, tiers, biomes, controls, war, lore, tales |
| `src/world/` | Terrain, chunks, mobs, wanderers, kingdoms, trains, army, defenders, projectiles |
| `src/duilt/` | The rules: DuiltGame, crafting, crops, war, sky war, suspicion, loot, settlers |
| `src/structures/` | Claim checking (`validate.js`) and the building registry |
| `src/survival/` | Hunger and health |
| `src/progression/` | Skills |
| `src/player/` | First-person controller |
| `src/render/` | Meshing, textures, sky, day cycle, avatar, all views |
| `src/ui/` | Panels, home screen, story screens, styles |
| `src/audio/` | Sound |
| `src/storage/`, `src/net/` | Saves, export, cloud |
| `src/tools/` | Selection, symmetry, roof and clear tools, saved designs |
| `docs/` | The design notes this wiki draws on |
| `tests/` | More than 220 test files, one or more per feature |
| `migrations/`, `db/` | The cloud database schema |

To add content, the codebase's rule is to add an entry to a config file, not to touch engine logic.
