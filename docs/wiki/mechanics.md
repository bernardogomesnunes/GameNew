# Game mechanics

## Time

- A game day is 15 real minutes: 10 minutes of daylight, then 5 of night. Night passes twice as fast as day.
- A new world starts in mid-morning.
- Wars, taxes, saplings and settlers count in game days.

## Hunger

- Your hunger bar runs from 100 to 0.
- It drains about 1.4 a minute when idle (about 70 minutes from full), and 2.2 times faster while moving and mining.
- Under 35 you are hungry: you slow down and cannot run. At 0 you move at 55% speed.
- Starving never kills you. It only slows you.
- You cannot eat when you are not hungry.

| Food | Feeds |
|---|---|
| Cooked Meat | 32 |
| Carrots | 22 |
| Potatoes | 20 |
| Cabbage, Broccoli | 18 |
| Zucchini | 16 |
| Peppers | 14 |
| Milk | 14 |
| Fruit, Lettuce | 12 |
| Egg | 10 |
| Raw Meat | 5 |
| Coffee Beans | 4 |

## Health and death

- You have ten hearts, counted in halves.
- A fall of more than 3 blocks hurts. Lava takes 4 half-hearts a second, so about 5 seconds from full.
- You heal while fed (about every 4 seconds when hunger is above 60%), twice as fast resting in a house.
- Dying leaves a chest where you fell with what you carried. Your tools stay with you.
- You wake at your Painting or War Tent, or at home (the middle of your land) if you have neither. If the Painting is broken, you wake at home.
- In Creative you cannot be hurt.

## Claiming and evolving

See [Buildings](buildings.md). In short: build the thing, point at it, press **C**, pick what it is. Evolve it by giving it what its next level asks for. **Craft what's missing** makes the missing parts from your bag.

## Output of buildings

- Buildings produce only while the world is open. [Buildings](buildings.md) lists average output per game day.
- Many producers use output multipliers 1, 1.5, 2.5 and 3.5. Mines and quarries have their own five-step ladders.
- A settler working there adds 50%.
- Farm harvest goes to a granary when there is one. Other goods go to storehouses that accept them, then your bag.
- You can see each building's Taxes line if the Sky Kingdom is taxing you.

## Storage

| Place | Slots |
|---|---|
| Your bag | 40 (plus 10 Leather Backpack, or 20 Reinforced) |
| Chest | 27 |
| Cart | 40 |
| Storehouse | 200, 240 as a Loft, 280 as a Warehouse |
| Train car | 1,000 |
| Granary | One stack per farm item kind, without a count limit |

- The **Storage Controller** lists combined storehouse goods and accepts deposits. A Town Hall and a Village each come with one. A **Storage Interface** placed directly above it opens a directory of individual stores.
- A storehouse can be set to refuse certain items.
- Settlers eat from available granaries and storehouses before your bag. The population panel names hungry people and offers Give food.

## Settlers

- Your first house is your own. Each house after brings one household (a Townhouse or Village, three).
- A new settler arrives about every 8 seconds while there is a free house.
- Settlers normally find nearby producing buildings themselves. Build a **Work Hall** at Age 1 to assign individual villagers as Builders or Haulers instead. Assigned workers stop providing the automatic production bonus.
- Builders walk to queued designs and place their blocks over time. Queueing reserves the design materials; cancellation returns unspent materials. A full bag keeps the remainder available to collect later.
- Haulers collect supplies deposited at the Work Hall, carry up to 32 items per trip, and walk to a valid store with room. Store exclusions and granary restrictions still apply. Carried items and work queues save with the world.
- Hungry workers pause their jobs until fed; an unreachable path or changed construction site pauses progress.
- Once a game day each settler eats one food, the cheapest first.
- Hungry settlers do not give their building the +50%. Nobody starves or leaves.
- Soldiers live in town, sleep in the barracks and eat the same way.
- Use Compost on a growing crop to move it forward one stage, or Add compost in a Farm panel to advance every growing crop there. Farm seed slots rise from four to seven as it evolves.

## Skills

Four skills rise by milestones, not grinding. You get a level at 1, 10, 30, 75, 150, 300, 600, 1,200, 2,500 and 5,000 actions, up to level 10. A University speeds this up (see [Crafting](crafting.md#studies-university)).

| Skill | Each level gives |
|---|---|
| Foraging | +12% from everything you gather |
| Building | Buildings cost 5% less to raise |
| Athletics | +4% speed and 4% slower hunger |
| Politics | Room to govern 1 more settler |

## Drinks

Three drinks each last 3 minutes and stack with each other. See [Items](items.md#drinks).

## Coins

Struck at a Foundry, earned by a Town Hall, sold to traders, found in chests. See [Trading](trading.md).

## Tool wear

Most mining tools and armour pieces have a number of uses. Carpentry tools, the Weapon Mold and some special tools are reusable. A bar on the hotbar goes from green to amber to red. A wooden or stone tool breaks sooner than iron.

## Your land and the border

- Your land is a square that grows each age (32, 64, 96 ... up to 512 blocks).
- Until Age 10 a visible wall stops you walking out of it. After that you can walk anywhere, but you can only build inside your land.
- On the dark path, the Sky Kingdom's island becomes yours once it falls.

## Saving

- Worlds save in your browser automatically.
- Export a world to a file, or export a block model to a `.vox` file for MagicaVoxel or Blender.
- Sign in to sync your worlds to your account and play on any device.
- **Save** stays in the world. **Save and leave** returns to the worlds screen only after a successful save.
- If account saving fails, your backup stays on this device and the game explains why. Uploads retry while the session is open and when the connection returns.
- Large backups use IndexedDB when they exceed local storage. An account size-limit error suggests exporting a copy. A missing account world is never silently recreated.

## Settings

- **Notifications:** every message the world has shown you, newest first.
- **Graphics:** resolution, view distance, smooth edges, soft shadows, grass tufts. Turn them down if the game stutters.
- **Controls and sound:** rebind keys, field of view, mouse speed, and volume for master, effects, ambience and music.
- **Files:** export or import a world.
- **Avatar:** how you look in third person (F5).
