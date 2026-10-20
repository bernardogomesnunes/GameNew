# Backlog — batch 2 ("Another batch for Duild")

The user's second list of changes, sorted by priority. Each line names the
original point. Priority 0 is what the user marked **most important**.

## Priority 0 — most important

- **Mobile controls for fighting.** Desktop is close to perfect; this is mobile only.
  - Left: the move joystick, as now.
  - Right: Place stays where it is; Jump takes Break's place.
  - Camera: no look joystick. Drag the picture to look, as other games do.
  - A tap on the world breaks, attacks or fills a bucket; Place empties it.
- **Worlds list.** It shows old-style saves first and the recent worlds a few seconds later, like a sync problem.
  - The page should load with every world listed at once.
  - Deleting a world sometimes empties the whole list until a reload.

## Priority 1 — quick wins and annoyances

- **Our own confirm pop-ups.** Delete, and leave without saving, use the browser's native dialog on iOS; show our own instead.
- **Fewer system messages.** Drop the opening and saving toasts. The user doesn't need to know we're saving, and keeps seeing "can't save this world" and similar.
- **Remove session achievements.** They aren't logged or shown anywhere.
- **Remove Clear and Mirror from the menu.** They're for building the game, not for players.
- **The bag's fixed top section** (equipped and armour) scrolls wrongly at the end of the list; it should stay fixed.
- **Tents** two blocks long.
- **Gold trim and gold ore** look like wood: make them shine and more yellow.
- **Walls stacked on walls** join into one wall, with no gap between them.
- **A fence meeting a wall:** the wall keeps its pillar instead of both joining through their connecting parts.
- **Window frames stacked vertically** connect (not horizontally).
- **Bare hands slower.** Tools already break faster than bare hands, but bare hands should take a bit longer.
- **A break animation:** cracks spreading on the block while you break it.
- **An empty hotbar slot is bare hands** (check what it does now).
- **Leaves decay** when their tree is gone.
- **Wood farm** makes 20 blocks a day.

## Priority 2 — systems to rework

- **Farm seeds.**
  - No mixed seeds.
  - A farm needs no seeds to build.
  - Put in one seed per crop you want, up to 4 crops.
  - A carrot seed in means carrots and carrot seeds come out.
- **Crafting.**
  - Name tools by material, e.g. "Stone axe", not "Axe"; drop the wood axe.
  - Add a search to the crafting panel.
- **Buildings pop-up.** Add a search, and show the cost as item icon + number, with no text under the Place button.
- **Tools reveal as you progress,** the way buildings already do.
- **Tiers for tools, weapons and armour:** stone, iron, gold, sky and dark, for swords, axes, shovels and armour.
- **3D icons** in the bag for weapons and other items (feathers, bucket, chalk line).
- **The university and your stats.**
  - Bring the skills back (foraging and the rest seem to have disappeared from view).
  - University research raises them.
  - Research also unlocks the engineering centre.
- **The Sky Kingdom island:** a hole in the ground below it, as if it had been torn out of the land.

## Priority 3 — big new content

- **Ways to travel and haul**, researched at an **engineering centre**:
  - **Age 2: horse and wooden cart.** You need a horse; build the cart and hitch it. Carries 40 slots of items.
  - **Age 3: a flying machine.** A wooden da Vinci-style plane: forward to fly, space to climb, left and right to steer.
  - **Age 5: a train on a one-block rail down the middle.**
    - Each part 8 long, 3 wide and 4 high, built from iron.
    - An engine plus up to 5 cars, each carrying 10 people and 1,000 slots of items.
    - Runs on coal, which comes from the mine as passive output and is found in the big mountains.
- **More places in the wild:**
  - abandoned cities, and cities with people living in them;
  - **tree tribes** in the tallest trees:
    - mystical tree houses full of vibrant greens, with wooden bridges between trees;
    - huts inside the leaves, and watchtowers on top of the canopy with stairs around them;
    - neutral, but hostile if you steal from their chests or attack them;
    - they never come down from the trees.
- **Stone Kingdom outposts:** generated rarely, with very good loot.

## Added later — systems

- **Storage controller** (asked for directly): a new block that controls every storehouse at once.
  - Can be placed anywhere. Opening it lists every item held across all your storehouses, with a search.
  - Comes built into a **town hall**: building the town hall gives you one, out of the box.
  - The town hall's requirement is the blocks needed to craft a controller (its ingredients), not the controller item itself.
  - Open question: there is no Town Hall building yet — a new building, or the existing Village?
