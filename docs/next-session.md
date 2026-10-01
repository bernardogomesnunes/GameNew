# Where to pick up — Phase 6a (health, death, chest)

Branch: `claude/voxel-sandbox-game-heuhyq`. PRs #21–#23 are merged; this work is not in a PR yet.

## Decided with the user
- **Hearts:** 10, counted in half-hearts, so health runs from 0 to 20.
- **Falls:** half a heart per block past 3. Landing in water, or flying, is safe.
- **Lava:** 2 hearts a second, taken in beats.
- **Healing:** half a heart every 4 seconds while hunger is at least 60% full. Twice as fast resting inside a claimed house or townhouse.
- **Death:**
  - you respawn at the settlement, near the territory centre, at a safe spot;
  - everything in the bag (not the 9 equipped slots) goes into a **chest** left where you fell;
  - that chest disappears once it's emptied;
  - a creative world takes no damage at all.
- **The chest:**
  - a 3D modelled block with 27 slots, crafted from 6 planks at the bench;
  - it faces you when you put it down, like a chair;
  - Place opens it, reusing the storehouse panel (panel-store);
  - it can only be broken once it's empty.
- **Later parts:**
  - **6b:** swords (wood, stone, iron) and hostile bandits (from Age 2, raiding at night, fleeing when badly hurt).
  - **6c:** catapults that you aim and fire, with real throw arcs that break blocks.

## Done (committed as work in progress)
- `src/survival/Health.js`: `Health` (hurt / heal / tick / restore / save) and `fallDamage`. Constants: `MAX_HEALTH`, `SAFE_FALL`, `LAVA_PER_SECOND`, `HOUSE_REGEN`.
- `config/blocks.js`:
  - `CHEST` = 148, with facings 149–151 as `stateOf`;
  - `isChest`;
  - `turned()` handles chests.
- `world/propShapes.js`: the `chest` model (body, lid, iron bands, rim, latch on −z).
- `config/items.js` has the `chest` item. `config/recipes.js` has the `chest` recipe (6 planks, hand, age 1). `config/glyphs.js` has a `chest` glyph.
- `duilt/DuiltGame.js`:
  - `health`, and `hurt()`, which does nothing in a sandbox;
  - `tick(dt, { resting })` heals;
  - chests: `chestAt`, `chestEmpty`, `removeChest`, `leaveGrave`, `containerFor`;
  - `storeSummary` handles `{ chest: { x, y, z } }`;
  - health and chests are saved and loaded.

## Still to do
1. **`Game.js`:**
   - `placedBlock`: a chest faces you (`look + 2`, the way a chair does).
   - `swingLabel`: say `Open` for a chest.
   - The crosshair hint says "Chest — tap Open".
   - `secondaryAction`: Place on a chest calls `openChest(hit)`, which runs `ui.openStore({ chest: { x, y, z } })`.
   - **In `applyChanges`:**
     - refuse to break a chest that isn't empty, with the toast "Empty the chest first";
     - after the blocks are set, a placed chest gets `chestAt(create)` and a removed chest gets `removeChest`.
   - **Game loop:**
     - pass `resting` to `duilt.tick`: the player isn't moving and is inside a claimed house or townhouse region;
     - lava: when a block overlapping the player's feet or head is lava or flowing lava, call `duilt.hurt(LAVA_PER_SECOND * 0.5, 'lava', { steady: true })`;
     - falls: take the landing from the player and call `duilt.hurt(fallDamage(blocks), 'fall')`.
   - **`bus.on('health:died')` → `die()`:**
     - put the chest at the first open cell at or above your feet, writing it directly with `world.setBlock` and `remeshDirty` so the border rules don't stop it;
     - call `duilt.leaveGrave(x, y, z)`;
     - respawn at a safe spot near `duilt.territory` centre and restore health;
     - toast where the chest is.
2. **`PlayerController`:**
   - track the highest point reached while falling (not flying or swimming) and hand the drop over on landing (`takeLanding()`);
   - reset it on a respawn or teleport, and when touching water.
3. **`DuiltUI`:**
   - **Hearts on the HUD:** 10 heart icons in `#vitals`, full, half or empty, re-rendered on `health:change`; hidden in a sandbox.
   - **Red flash:** a red flash overlay when hurt.
   - **The chest in the store screen:**
     - `renderStore`, `putInStore`, `takeFromStore` and `storeEverything` go through `d.containerFor(this.store)`;
     - the panel's title reads "Chest";
     - the routing chips and the "next level" box are hidden for a chest;
     - an emptied grave chest is removed from the world.
4. **Tests:** a new `tests/health.test.mjs` covering:
   - damage and healing;
   - falls;
   - nothing in a sandbox;
   - the death chest and that equipped slots are kept;
   - saving and loading;
   - chest facing and model.

   Update `shapes`, `look` and `designs` if anything regresses.
5. **Then:**
   - run the full suite;
   - check at phone size in the browser: the hearts, falling, lava, dying and opening the chest, and placing and opening a chest;
   - commit and open a PR;
   - mark tasks #146 and #129 complete.
