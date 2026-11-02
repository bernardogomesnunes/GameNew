# Foundry Crucible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Crucible block inside a Foundry melts ore (and burns logs) on its own, and the player pours each molten batch into an ingot or coin mould by holding Pour and letting go at the right level, in a 3D close-up of the real block.

**Architecture:** The close-up machinery the Counter put in `Game.js` (camera over a block, world paused, HUD hidden, pointer lock off, Escape, Leave) moves to `src/render/CloseUp.js`, used by both machines. Crucible rules (`duilt/Crucible.js`) are pure and saved with the world; `render/CrucibleView.js` draws the pot, fire, moulds and the pour; `ui/CrucibleBar.js` is its bar.

**Tech Stack:** Vanilla JS modules, three.js 0.186, Vite, node test files run by `npm test`, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-11-01-foundry-crucible-design.md`

## Global Constraints

- Crucible block id **531**, station `crucible`, item `crucible`, recipe at station `workbench`, **Age 5**, inputs `{ stone: 8, clay: 2 }`.
- Works only inside a valid Foundry building; elsewhere: "A crucible needs a foundry's heat: place it inside one."
- The 7 foundry recipes (`smelt_iron`, `smelt_copper`, `smelt_gold`, `charcoal`, `strike_coins`, `strike_copper_coins`, `strike_ruby_coins`) move to station `crucible`.
- Load up to **16** batches, one recipe at a time.
- Melt times: smelting **45 s**, coins **25 s**, charcoal **30 s**; melting ticks while away in the world, not while the game is closed.
- Pour: fill **1.5 s** from empty to full; release in **[0.90, 1.05]** makes the output; **< 0.90** nothing made, metal back to the pot; **> 1.05** batch spilt and lost.
- Charcoal is taken, never poured.
- Break: unmelted batches' inputs and waiting outputs back (bag, else storehouse, else kept owed); molten batches lost.
- At most **6** extra meshes; nothing allocated per frame; buttons ≥ **44 px**.

## Review Focus

1. Pour held while leaving (Escape, Leave, a panel key) → no half pour is applied; the fill resets. (Task 4 test `leaving mid-pour pours nothing`.)
2. The foundry around a crucible breaks or is unclaimed → melting stops (no heat), resumes when valid again; nothing lost. (Task 3 test `no foundry, no melting`.)
3. Output with a full bag and full storehouses → it waits in the mould; Take later. (Task 3 test `a poured ingot waits when there is no room`.)
4. A save from before, with foundry spots in progress (IMP-15) → their items return to the bag once on load. (Task 2 test `old foundry spots give their items back`.)
5. Creative (endless bag) → loading never runs out and pour still needs the window. (Task 3 test `creative loads 16 and still pours by hand`.)

---

### Task 1: The shared close-up

**Files:**
- Create: `src/render/CloseUp.js`
- Modify: `src/Game.js` (`startCounter`, `endCounter`, `bindCounterPointer`, `phase`, `requestPointerLock`, Escape: route through `this.closeUp`)
- Test: `tests/close-up.test.mjs`; existing `tests/counter-view.test.mjs`, `tests/counter-browser.mjs` must still pass unchanged.

**Interfaces:**
- Produces: `class CloseUp { constructor({ uiRoot, onEnd }); open(machine); close(); get active(); get machine(); }` where a machine is `{ start(key, at), end(), update(dt), pointerDown?(ndcX, ndcY), pointerMove?(ndcX, ndcY), pointerUp?(), barEl }`. `open` adds `at-counter` (rename **`at-machine`**) to `uiRoot`, `close` removes it and calls `onEnd`. `Game.closeUp` is the one instance; `phase` is `'paused'` while `closeUp.active`; pointer lock refused while active; Escape closes it; window pointer listeners forward to `closeUp.machine` and ignore events inside any `barEl`.

- [ ] **Step 1: Failing test** `tests/close-up.test.mjs`: `open` sets `active`, adds class `at-machine`; `close` removes it, calls `onEnd` once, calls the machine's `end`; a second `open` closes the first machine first.
- [ ] **Step 2: Run** — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `CloseUp`; move the Counter onto it (`CounterView` gains `pointerDown/Move/Up` wrapping today's `partAt/pointOnTop/dragTo/drop`); CSS selector `#ui-root.at-counter` → `#ui-root.at-machine`.
- [ ] **Step 4: Run** `node tests/close-up.test.mjs`, `node tests/counter-view.test.mjs`, `node tests/counter-browser.mjs` — Expected: all PASS.
- [ ] **Step 5: Commit** "Close-up: one shared machine view for the Counter and what follows".

### Task 2: The Crucible block, and the foundry's recipes move to it

**Files:**
- Modify: `src/config/blocks.js` (`CRUCIBLE = 531`), `src/config/items.js`, `src/config/recipes.js`, `src/ui/DuiltUI.js` (foundry panel: no recipe tiles; line "Place a Crucible inside to melt and pour."; its stations list shows crucibles), `src/duilt/DuiltGame.js` (`loadJSON`: foundry spots `s:<id>` with station `foundry` give their items back once), `docs/wiki/crafting.md`
- Test: `tests/crucible-block.test.mjs`; update tests asserting foundry recipes at station `foundry` (`coinsstations`, `kiln-foundry-panel`, `station-work`, any found by `npm test`).

**Interfaces:**
- Produces: `CRUCIBLE = 531`; `stationOf(531) === 'crucible'`; the 7 recipe ids keep their ids with `station: 'crucible'`.

- [ ] **Step 1: Failing test**: block, item, recipe per Global Constraints; all 7 ids have `station === 'crucible'`; none has `station === 'foundry'`; `old foundry spots give their items back` (a save with `stationWork: [{ key: 's:4', station: 'foundry', recipeId: 'smelt_iron', batches: 2, progress: 0.5, out: 1 }]` loads into 4 iron ore and 1 iron ingot in the bag).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**; `usesSpots` no longer matches `foundry` (its set loses `'foundry'`).
- [ ] **Step 4: Run** `npm test` — Expected: 0 failed after the test updates.
- [ ] **Step 5: Commit** "Crucible: the block; the foundry's recipes move to it".

### Task 3: Crucible rules

**Files:**
- Create: `src/duilt/Crucible.js`
- Modify: `src/duilt/DuiltGame.js` (construct `this.crucibles`, tick with `dtSeconds`, save as `crucibles`, prune every 2 s with `spotStands(key, 'crucible')`)
- Test: `tests/crucible-rules.test.mjs`

**Interfaces:**
- Consumes: `RECIPES_BY_ID`; Task 2's recipe stations.
- Produces: `class Crucibles { constructor({ bag, deliver, heated: (key) => boolean }); state(key) -> { recipeId, waiting, progress, molten, mould: 'ingot'|'coin', out } | null; load(key, recipeId, batches) -> { ok, batches?, reason? }; tick(dt); setMould(key, mould); pour(key, level: number) -> { result: 'made'|'short'|'spilt'|'none', made?: { id, count } }; take(key) -> number; prune(stands); toJSON(); loadJSON(list) }`. `MELT_SECONDS(recipe)`, `POUR_MIN = 0.90`, `POUR_MAX = 1.05`, `MAX_BATCHES = 16` exported. Mould needed: coins `'coin'`, others `'ingot'`; wrong mould → `{ result: 'none' }` with no change. Charcoal: `pour` returns `'none'`; finished charcoal goes straight to `out`.

- [ ] **Step 1: Failing tests** (one each): `loads as many as the bag pays, up to 16`; `one recipe at a time`; `melts only through tick, 45 s for iron`; `no foundry, no melting` (`heated` false: `tick(100)` leaves `molten` 0); `pour 0.89 is short and keeps the metal`; `pour 0.90 and 1.05 make an ingot`; `pour 1.06 spills the batch`; `the wrong mould pours nothing`; `charcoal is taken, not poured`; `a poured ingot waits when there is no room`; `saves and loads mid-melt`; `breaking gives back the unmelted and the waiting, not the molten`; `creative loads 16 and still pours by hand`.
- [ ] **Step 2: Run** — Expected: FAIL, module not found.
- [ ] **Step 3: Implement**; `heated(key)` in `DuiltGame` is true when the block sits inside a valid structure of type `foundry`.
- [ ] **Step 4: Run** the test and `npm test` — Expected: PASS, 0 failed.
- [ ] **Step 5: Commit** "Crucible: the rules, saved with the world".

### Task 4: The crucible close-up

**Files:**
- Create: `src/render/CrucibleView.js`, `src/ui/CrucibleBar.js`
- Modify: `src/Game.js` (Place on a crucible: if `heated`, `this.closeUp.open(crucibleMachine)`, else the toast in Global Constraints), `src/ui/styles.css`
- Test: `tests/crucible-view.test.mjs`, `tests/crucible-browser.mjs`

**Interfaces:**
- Consumes: `CloseUp` (Task 1), `Crucibles` (Task 3).
- Produces: `class CrucibleView { constructor({ scene, camera, crucibles, bus }); start(key, at); end(); update(dt); holdPour(on: boolean); get level() }` — while held, `level` rises 1/1.5 per second and the pot tilts up to 60°; on release it calls `crucibles.pour(key, level)` and resets `level` to 0; the pot's emissive grows with `progress`.

- [ ] **Step 1: Failing tests**: view — camera over the block as the Counter's; `holdPour(true)` then `update(1.5)` gives `level` 1.0 ± 0.01; releasing calls `pour` once with that level; `leaving mid-pour pours nothing` (`end()` while held: `pour` not called, `level` 0); at most 6 meshes added, all removed on `end`. Browser — a foundry region with a crucible inside, load 2 iron ore, `duilt.crucibles.tick(45)`, hold Pour until `level` is in the window, release, 1 iron ingot in the bag; screenshots `artifacts/crafting/crucible-{load,molten,pour,done}.png`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**: pot = a box with a darker rim; fire = a flat emissive box under it; moulds = two shallow boxes to the right; molten metal = one box inside the mould whose height follows `level`. Bar: recipe list (greyed with reasons), mould toggle (Ingot / Coin), Pour (pointerdown → `holdPour(true)`, pointerup/leave → `false`), Take (when `out` > 0), Leave; the line shows waiting, molten and what to do next.
- [ ] **Step 4: Run** both tests, `npm test`, `npm run test:browser`, `npm run test:performance` — Expected: all PASS.
- [ ] **Step 5: Commit** "Crucible: the 3D close-up, melt glow and the pour"; update `docs/TASKS.md` CRAFT3D-3 row (built, this PR).
