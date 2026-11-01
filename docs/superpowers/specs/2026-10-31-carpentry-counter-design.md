# Carpentry counter: furniture made by hand, in 3D

IMP-6 phases 2 and 3, reshaped by the owner on 31 October. Written for review
before any code. It is also the pattern for later crafts ("Which is what I
envision for the whole crafting experience of the game. Having big machines
and buildings that are able to do complex stuff.")

## What the owner asked for

- "the whole carpentry flow would work as a workshop ... I'll place a planer,
  a wood mill, and a counter, and on the counter I could use stuff like a saw
  or a chisel to work on pieces of wood ... make furniture. The interactions
  should be dedicated to this ... a minigame for creating furniture."
- The minigame: assemble the parts. The saw cuts the plank into parts (legs,
  top, back); you fit them onto a pale outline of the piece.
- All of it happens at the counter. No placed template, no toolbox.
- Furniture is made only this way. The workbench and wood mill furniture
  recipes go.
- The stations do not need each other nearby. A Workshop building's panel
  lists the stations placed inside it and opens them.
- "would be nice to see the block in 3d and when using the saw we could cut
  the piece in a standard animation, and see the pieces there to assemble":
  the camera zooms in on the real counter in the world.

## What it is

1. **The Counter**, a new placeable station block (id 530, station
   `counter`). Made at the Workbench (Age 3): 6 planks and 2 logs.
2. **Using it** (Place on the block) starts the counter view: the camera moves
   to a fixed close-up over the counter's top, the player stops moving, and a
   small bar of buttons replaces the usual controls. Escape, the close button
   or walking off ends it.
3. **Pick** a piece from a strip of tiles: every furniture piece in every wood
   (table, chair, red chair, cabinet, wardrobe, bedside table, bed, painting,
   the plain, patterned and two-tone panels). Each tile shows its planks.
   Greyed with the reason when the planks or the saw (and, for patterned
   pieces, the chisel) are missing from the bag.
4. **Cut.** A plank appears lying on the counter. Each tap on Saw plays the
   standard saw animation (the held saw moves back and forth across the plank
   for 0.8 s, sawdust puffs) and one part drops off onto the counter. One tap
   per part. The planks are paid at the first cut.
5. **Assemble.** A pale, see-through outline of the finished piece stands on
   the counter. The cut parts lie beside it. Drag a part (finger or mouse): it
   follows the pointer over the counter top; dropped near its place in the
   outline it snaps in, anywhere else it slides back. No timer and no failure.
6. **Carve** (patterned panels only): marked spots glow on the fitted piece;
   tap each with the chisel.
7. **Done.** The finished piece turns solid, lifts, and goes to the bag (or
   a storehouse if the bag is full, as building payouts do). The view stays
   for the next piece.
8. **Leaving halfway** keeps the cut parts and the fitted ones on that
   counter (saved with the world) for next time. Breaking the counter gives
   back the planks for the parts not yet fitted, and drops nothing else.

## The parts come from the furniture's own shape

Every furniture block already has its boxes in `world/propShapes.js`
(`PROP_SHAPES.table`: a top and four legs). A part is one box, named by its
role where the shape gives it (top, seat, back, leg). The outline is the same
boxes drawn pale. So every piece, including future ones, is cuttable and
assemblable with no extra data. Pieces whose shape has more than 8 boxes
merge the smallest touching boxes until 8 are left, so a minigame is never
longer than 8 cuts and 8 drops.

## Units

| Unit | File | Does | Depends on |
|---|---|---|---|
| Counter rules | `src/duilt/Counter.js` | Per-counter state (piece, parts cut, parts fitted), paying, finishing, save and load, giving back on break. No rendering. | recipes, inventory |
| Parts | `src/config/furnitureParts.js` | `partsFor(itemId)`: the boxes of the piece's shape, named and capped at 8. | propShapes |
| Counter view | `src/render/CounterView.js` | Camera close-up, plank, parts, outline, saw animation, drag and snap, carve spots. Calls Counter rules for every change. | three, Counter rules |
| Counter bar | `src/ui/CounterBar.js` | The button bar: piece strip, Saw, Carve, Leave, and what is missing. | Counter rules |
| Workshop panel | `src/ui/DuiltUI.js` | Lists stations inside a Workshop's region with their state; opens any of them. | world, stations |

`Game.js` gains only the hook: Place on a counter starts the view, and the
view's end gives the controls back. TECH-10 asks for Game.js to shrink, so
none of the counter's logic goes there.

## What changes elsewhere

- The 26 furniture recipes (station `hand`, `workbench`, `wood_mill` or
  `workshop` with the saw) are removed. The items stay; old bags keep them.
- The bench, wood mill and workbench no longer list furniture. Their panels
  say furniture is made at a Counter.
- `docs/wiki/crafting.md` explains the counter.
- IMP-6's earlier toolbox and placed-template idea is dropped (owner's
  choice, 31 October). The Planing Bench (phase 1) stays.

## Phones and speed

One 3D view: the counter view draws into the game's own scene and camera,
with at most 9 extra meshes (8 parts and the outline group). Nothing is
created per frame. Dragging uses the same pointer events as the game's look
surface. The bar's buttons are at least 44 px. The performance budget job
must still pass.

## Testing

- Unit: `partsFor` for every furniture item (1 to 8 parts, each inside the
  cell); Counter rules (pay once at the first cut, refuse with missing tools
  or planks, finish only when every part is fitted, carve only patterned
  pieces, save and load mid-piece, give back on break).
- Recipes: no furniture recipe left at any station; every furniture item is
  makeable at a counter.
- Browser (isolated Chromium, phone size): place a counter, open the view,
  make a table by tapping Saw five times and dragging five parts, see it in
  the bag; leave halfway and come back to the same parts; a screenshot of
  each stage for review.

## Out of scope

- Quality grades, timers, or failing a piece.
- Other crafts on this pattern (forge, kiln); this spec is the example they
  follow later.
- New furniture pieces.
