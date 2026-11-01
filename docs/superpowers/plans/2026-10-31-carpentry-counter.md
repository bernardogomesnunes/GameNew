# Carpentry Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Furniture is made only at a placed Counter: the camera zooms in on the real counter, the saw cuts a plank into the piece's parts with an animation, and the player drags the parts onto a pale outline (and carves patterned pieces with the chisel).

**Architecture:** Pure rules (`duilt/Counter.js`) hold each counter's work and are saved with the world; `config/furnitureParts.js` derives parts from the existing `PROP_SHAPES` boxes; `render/CounterView.js` draws the close-up in the game's own scene and camera; `ui/CounterBar.js` is the button bar. `Game.js` only starts and ends the view.

**Tech Stack:** Vanilla JS modules, three.js 0.186, Vite, node test files (`tests/*.test.mjs` run by `npm test`), Playwright Chromium for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-31-carpentry-counter-design.md`

## Global Constraints

- Counter block id **530**, station `counter`, item `counter`, recipe at station `workbench`, **Age 3**, inputs **6 planks and 2 logs** (`{ planks: 6, wood: 2 }`).
- At most **8 parts** per piece; smallest touching boxes merge until 8 remain.
- Saw animation **0.8 s** per cut; planks paid **at the first cut**.
- Saw always required in the bag; chisel also required for **patterned** pieces (`panel_pattern`, `panel_pattern_white`, `panel_pattern_dark`).
- No timer, no failure, no quality grades.
- One WebGL context: the view draws into the game's scene and camera; **at most 9 extra meshes**; nothing allocated per frame.
- Buttons at least **44 px**. `npm run test:performance` must still pass.
- All 26 furniture recipes removed from every station; the items stay (old bags keep them).
- Commits end with the session's Co-Authored-By / Claude-Session lines.

## Review Focus

1. Bag fills up at "Done" → the piece goes to a storehouse via `structures.deliver`, else stays on the counter as finished and is taken next time; never lost. (Task 3 test `finished piece waits when bag and stores are full`.)
2. Counter broken mid-piece (by the player or a villager build) → planks for unfitted parts back to the bag, finished-but-untaken piece back too. (Task 3 test `breaking gives back what was not used`.)
3. Saw or chisel leaves the bag between cuts → the next Saw/Carve tap refuses with the reason; fitting parts still allowed. (Task 3 test `a missing tool stops cutting, not fitting`.)
4. Two counters side by side → each keeps its own work by key `"x,y,z"`. (Task 3 test `two counters keep their own work`.)
5. View open and the player is hurt, a raid starts, or the world changes → Escape and walking off end the view; any damage ends it too. (Task 4 test `damage ends the counter view`.)

---

### Task 1: Parts from the furniture's shape

**Files:**
- Create: `src/config/furnitureParts.js`
- Test: `tests/furniture-parts.test.mjs`

**Interfaces:**
- Consumes: `PROP_SHAPES`, `boxesFor` from `src/world/propShapes.js`; `ITEMS_BY_ID`, `BLOCKS_BY_ID` (item → block → `shape`).
- Produces: `FURNITURE` — array of item ids makeable at a counter (every `FURNITURE_ITEM` value plus `bed`, `painting`, `chair_red`, `panel_twotone`); `partsFor(itemId) -> Array<{ name: string, box: {minX,maxX,minY,maxY,minZ,maxZ}, tone?: number }>`; `isPatterned(itemId) -> boolean`.

- [ ] **Step 1: Write the failing test** — `tests/furniture-parts.test.mjs`:
  - `partsFor('table_oak')` has 5 parts, names `['top','leg','leg','leg','leg']`.
  - for every id in `FURNITURE`: `1 <= parts.length <= 8`, every box inside `[0,1]` on each axis (bed may span `z` in `[0,2]`: the foot and head cells side by side).
  - `isPatterned('panel_pattern_dark') === true`, `isPatterned('table_oak') === false`.
- [ ] **Step 2: Run** `node tests/furniture-parts.test.mjs` — Expected: fails, module not found.
- [ ] **Step 3: Implement** in `src/config/furnitureParts.js`. Shape comes from the item's block (`BLOCKS_BY_ID.get(ITEMS_BY_ID.get(id).block).shape`); `bed` uses `bed_foot` then `bed_head` shifted `+1` in z. Names: a box whose `maxY - minY` is largest and touches `y = 0` is `leg` when narrow (`< 0.3` wide), the widest box above `y = 0.3` is `top` (`seat` for chair shapes), a tall thin box at the back is `back`, else `panel`. Merge rule when over 8: repeatedly merge the two touching boxes with the smallest combined volume into their bounding box.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/config/furnitureParts.js tests/furniture-parts.test.mjs && git commit -m "Counter: furniture parts from each piece's shape"`

### Task 2: The Counter block, and furniture leaves the benches

**Files:**
- Modify: `src/config/blocks.js` (next to `WORKBENCH = 529`), `src/config/items.js` (next to `workbench`), `src/config/recipes.js` (the furniture loop near `const furniture = new Set(`), `docs/wiki/crafting.md`
- Test: `tests/counter-block.test.mjs`; update tests that assert furniture recipes exist (`woodfurniture`, `woodsets`, `crafting-processing`, `crafting-browser`, `joinery-bench`, `workbench`): they assert those recipes are gone and the items are made at a counter.

**Interfaces:**
- Consumes: `FURNITURE` (Task 1).
- Produces: `COUNTER = 530` from `blocks.js`; `stationOf(530) === 'counter'`; item `counter` with `block: 530`; recipe id `counter`; `COST: Map<itemId, {[itemId]: n}>` exported from `src/config/furnitureParts.js`, holding each removed furniture recipe's `inputs` (captured before removal).

- [ ] **Step 1: Write the failing test** — `tests/counter-block.test.mjs`: the block, item and recipe exist with the Global Constraints values; `RECIPES.filter(r => FURNITURE.includes(r.output.id)).length === 0`; every `FURNITURE` id is in `ITEMS_BY_ID`.
- [ ] **Step 2: Run** it — Expected: FAIL.
- [ ] **Step 3: Implement**: add block, item (`madeBy`: "Made at a Workbench. Place it and make furniture on it: saw the parts, fit them together"), recipe; in `recipes.js` remove every recipe whose output is in `FURNITURE` (filter `RECIPES` in place after the furniture loop). Bench, mill and workbench panels show one line "Furniture is made at a Counter" via `buildingDoes`/`renderBench` when the station is `wood_mill`, `workbench` or the menu bench. Wiki: a Counter section.
- [ ] **Step 4: Run** `npm test` — Expected: 0 failed after the listed test updates.
- [ ] **Step 5: Commit** "Counter: the block, and furniture leaves the benches".

### Task 3: Counter rules

**Files:**
- Create: `src/duilt/Counter.js`
- Modify: `src/duilt/DuiltGame.js` (construct, `toJSON`/`loadJSON` as `counters`, prune every 2 s like `stationWork`)
- Test: `tests/counter-rules.test.mjs`

**Interfaces:**
- Consumes: `partsFor`, `isPatterned`, `FURNITURE` (Task 1); the furniture's planks cost: the removed recipe's `inputs`, kept in `furnitureParts.js` as `COST.get(itemId) -> { [itemId]: n }` (moved there in Task 2).
- Produces (class `Counters`, constructed `new Counters({ bag: () => Inventory, deliver: (payload) => boolean })`):
  - `work(key) -> { item, cut: number, fitted: boolean[], carved: boolean, done: boolean } | null`
  - `choose(key, itemId) -> { ok, reason? }` — refused while a piece is in progress there.
  - `canCut(key) -> { ok, reason? }`; `cut(key) -> { ok, part?: number, reason? }` — pays `COST` on the first cut; needs saw (and chisel if patterned).
  - `fit(key, part) -> { ok, done }`; `carve(key) -> { ok, reason? }` — chisel needed; only patterned and only when all fitted.
  - `take(key) -> boolean` — finished piece to bag, else `deliver`, else stays.
  - `prune(stands: (key) => boolean)`; `toJSON() -> array`; `loadJSON(array)`.

- [ ] **Step 1: Write the failing tests** — `tests/counter-rules.test.mjs`, one `check` each:
  - `pays once at the first cut` (bag planks drop by `COST` once across all cuts).
  - `refuses without saw or planks` (reasons name what is missing).
  - `finishes only when every part is fitted` (`done` false until the last `fit`).
  - `carves only patterned pieces` (table: `carve` refused; `panel_pattern`: needed before `done`).
  - `saves and loads mid-piece` (2 cut, 1 fitted survive `toJSON`/`loadJSON`).
  - Review Focus 1–4 tests named exactly as listed above.
- [ ] **Step 2: Run** — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `Counters` in `src/duilt/Counter.js`; wire into `DuiltGame` (`this.counters`, save key `counters`, prune with `stationOf(world.getBlock(x,y,z)) === 'counter'`, unloaded chunk counts as standing — same rule as `spotStands`).
- [ ] **Step 4: Run** the test and `npm test` — Expected: PASS, 0 failed.
- [ ] **Step 5: Commit** "Counter: the rules, saved with the world".

### Task 4: The counter view and its bar

**Files:**
- Create: `src/render/CounterView.js`, `src/ui/CounterBar.js`
- Modify: `src/Game.js` (Place on a counter → `this.startCounter(aimed)`; while `this.counterView.active`: skip `player.update` input, call `counterView.update(dt)` after `player.syncCamera`, end on Escape, damage, leaving the world), `src/ui/styles.css` (bar)
- Test: `tests/counter-view.test.mjs` (node, with a fake scene), `tests/counter-browser.mjs` (Chromium)

**Interfaces:**
- Consumes: `Counters` (Task 3), `partsFor` (Task 1), `camera`, `scene`, the held saw model (`heldGeometryFor({ itemId: 'carpentry_saw' })` from `src/render/heldModel.js`).
- Produces: `class CounterView { constructor({ scene, camera, counters, bus }); start(key, at: {x,y,z}); end(); get active(); update(dt); pointerDown(x,y), pointerMove(x,y), pointerUp(); }`; `class CounterBar { constructor({ root, counters, view }); show(key); hide(); }`.

- [ ] **Step 1: Write the failing tests**:
  - `tests/counter-view.test.mjs`: `start` sets the camera to a fixed pose 1.6 blocks above and 1.2 behind the counter centre looking at its top; the scene gains at most 9 meshes; `update(0.8)` after a `cut` moves the part from the plank to the counter; dropping a part within 0.15 of its slot calls `fit`, elsewhere returns it; `end` removes every mesh it added; `damage ends the counter view` (emitting `player:hurt` on the bus ends it).
  - `tests/counter-browser.mjs`: place a counter in a Creative world with a finite bag holding 4 planks and a saw; open it; pick Oak Table; tap Saw 5 times (wait 0.8 s each); drag each part onto its slot; `bag.countOf('table_oak') === 1`; leave after 2 cuts and reopen: 2 parts still there; screenshots `artifacts/crafting/counter-{pick,cut,assemble,done}.png`.
- [ ] **Step 2: Run** both — Expected: FAIL.
- [ ] **Step 3: Implement**: outline = the piece's boxes as one group with `MeshBasicMaterial({ transparent: true, opacity: 0.25 })`; parts = one mesh each, wood colour by `boxColor`; plank = a box `1 × 0.1 × 0.3` on the counter top; saw animation moves the saw mesh ±0.25 in x at 5 Hz for 0.8 s, sawdust as 6 small boxes reused; drag by raycasting the pointer onto the counter-top plane (`THREE.Plane` at the top's y). Bar: piece strip (tiles greyed with `canCut` reason), Saw, Carve (only patterned), Leave; buttons ≥ 44 px.
- [ ] **Step 4: Run** both tests, `npm test`, `npm run test:browser`, `npm run test:performance` — Expected: all PASS.
- [ ] **Step 5: Commit** "Counter: the 3D close-up, saw animation and assembly".

### Task 5: The Workshop lists its stations

**Files:**
- Modify: `src/ui/DuiltUI.js` (`buildingBodyHtml`: for `structure.type === 'workshop'`, a section listing station blocks inside `structure.region` with name and state — Counter: piece in progress, spots: batches left — each with an Open button calling `this.game.ui.openBench('', station, at)` or `this.game.startCounter(at)`)
- Test: `tests/workshop-stations.test.mjs`

**Interfaces:**
- Consumes: `stationOf`, `Counters.work` (Task 3), `StationWork.spot`, `Game.startCounter(at)` (Task 4).
- Produces: `DuiltUI.workshopStations(structure) -> Array<{ station, at: {x,y,z}, state: string }>`.

- [ ] **Step 1: Write the failing test**: a workshop region containing a counter (with a table 2 parts cut) and a forge (2 batches waiting) lists both, in that order of position, with states `"Table: 2 of 5 cut"` and `"2 waiting"`; stations outside the region are not listed.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `workshopStations` (scan only the region's cells; skip if over 4,096 cells) and the panel section with Open buttons.
- [ ] **Step 4: Run** the test and `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** "Workshop: its panel lists and opens the stations inside it"; update `docs/TASKS.md` IMP-6 row: phases 2 and 3 replaced by the Counter (this PR).
