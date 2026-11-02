# Foundry crucible: melt and pour in 3D

CRAFT3D-3, the second machine in the pattern the carpentry counter set
(`2026-10-31-carpentry-counter-design.md`). Written for the owner's review
before any code.

## What the owner asked for

- 31 October: "the foundry showing the blocks being melted and poured into a
  molde."
- 1 November: "Let's try the foundry to melt stuff." Then, chosen:
  - a **Crucible** block placed inside the foundry; using it zooms in on it;
  - **hold to tilt and pour**: let go when the mould is full; a little over
    spills and is lost, too little makes no ingot;
  - the **moulds are built into the crucible**: pick the ingot or coin mould
    before pouring;
  - **all the foundry's recipes** move here: ores to ingots, gold, copper or
    rubies to coins, and logs to charcoal (burnt, not poured).
- The foundry's recipes stop being plain pop-up recipes (owner, 1 November:
  "all of these are specific crafting tools").

## What it is

1. **The Crucible**, a new placeable block (id 531, station `crucible`), made
   at the Workbench in Age 5 from 8 stone and 2 clay. It works only when it
   stands inside a valid Foundry building; elsewhere using it says "A crucible
   needs a foundry's heat: place it inside one."
2. **Using it** zooms the camera in on the real block, as the Counter does:
   the world waits, the HUD and pointer lock go, a bar takes the controls.
   On the block: the crucible pot over a fire, and beside it two moulds (an
   ingot mould and a coin mould).
3. **Load.** The bar lists what this crucible makes (the 7 foundry recipes).
   Tapping one puts in as many batches as the bag pays for, up to 16. One
   recipe at a time, as at the station spots (IMP-15).
4. **Melt.** Each batch melts on its own over its time (smelting 45 s, coins
   25 s, charcoal 30 s), one at a time, also while you are away from it in the
   world, and not while the game is closed. The pot glows brighter as a batch
   melts; a counter shows how many are molten and ready to pour.
5. **Pour** (ingots and coins). Pick the mould. Hold Pour (the button, or
   press and hold on the picture): the pot tilts and the mould fills, a bar
   beside it shows the level. Let go:
   - between 90% and 105%: the batch becomes its output (an ingot, gold, or
     the coins), in the bag, else a storehouse, else it waits in the mould;
   - under 90%: nothing is made; the metal runs back into the pot (no loss);
   - over 105%: the batch spills and is lost.
   Filling takes 1.5 s from empty to full, so the window is about 0.22 s.
6. **Charcoal** is not poured: once a batch has burnt, "Take" moves the coal
   to the bag.
7. **Leaving** keeps everything in the pot, saved with the world. Breaking the
   crucible gives back the ore for batches not yet melted and the outputs
   waiting in the moulds; molten metal is lost (the spill of a broken pot).
8. **The foundry building's panel** loses its recipe tiles and says: "Place a
   Crucible inside to melt and pour." Its Workshop-style list (CRAFT3D-1)
   shows the crucibles inside with their state.

## Units

| Unit | File | Does | Depends on |
|---|---|---|---|
| Crucible rules | `src/duilt/Crucible.js` | Per-crucible state (recipe, batches waiting, melt progress, molten count, mould, waiting outputs), load, tick, pour result, take, break, save and load. No rendering. | recipes, inventory |
| Crucible view | `src/render/CrucibleView.js` | Close-up camera, pot, fire glow, moulds, tilt and fill animation; turns a hold into a fill level. | three, Crucible rules |
| Crucible bar | `src/ui/CrucibleBar.js` | Recipe list, mould pick, Pour (hold), Take, Leave, and what is missing. | Crucible rules |
| Shared close-up | `src/render/CloseUp.js` | What the Counter and the Crucible share: camera over a block, HUD hidden, pointer lock off, Escape and Leave. The Counter moves onto it. | three |

`Game.js` only routes Place on a crucible to it, as for the Counter.

## What changes elsewhere

- The 7 foundry recipes move to station `crucible`; the foundry panel no
  longer lists them. The `forge` recipes made "at a foundry" are unchanged.
- Saves with foundry spots in progress (IMP-15) give their items back on
  load, once.
- `docs/wiki/crafting.md` explains the crucible.

## Phones and speed

One 3D view (the game's own). At most 6 extra meshes. Pour is one button held
with a finger; the level bar is at least 44 px tall. No per-frame allocation.

## Testing

- Rules: load pays once per batch; melting advances only through `tick`; pour
  results at 89%, 90%, 105% and 106%; charcoal is taken, not poured; one
  recipe at a time; save and load mid-melt; break gives back the unmelted ore
  and the waiting outputs; works only inside a valid foundry.
- View: camera over the block; a 1.5 s hold fills to 100%; letting go
  calls the rules' pour with the level.
- Browser: place a foundry region and a crucible in it, load iron ore, tick
  45 s, hold Pour for the window, an iron ingot in the bag; a screenshot of
  each stage.

## Out of scope

- The forge (CRAFT3D-4) and the rings (CRAFT3D-5).
- Quality grades for ingots.
