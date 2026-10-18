# Claude's tasks: the owner's October batch

From the owner's list "New batch Duilt". The quick wins (bigger buttons,
recipe names, the mills' search box, "game days" wording) went to Cline as
Tasks 8 to 11 in `docs/cline-tasks.md`. These are the rest, blockers to
finishing the game first.

Each one was checked against the code before it was written down. What
was found is under **Now**.

---

## Blocking the playthrough

### 1. Saving breaks the game

> "When saving the game breaks"

**Now:** a new world, signed out, saves cleanly in the browser: three
saves, then Save and leave, with no errors. So it depends on something in
the owner's world, or on being signed in.

**Need from the owner:**
- what "breaks" looks like (it freezes, shows an error, loses progress,
  goes back to the home screen?);
- whether you're signed in;
- which world, and roughly how big;
- the phone and browser.

**Then:** reproduce it with a world that size, fix it, and add a test that
saves that kind of world.

### 2. The Marble Table can't be made in time for the temple

> "Marble table is needed for the temple but I can't build it from the bench"

**Now:** the temple (Age 4) needs an altar: a Marble Table, a vase, an urn
or a block of gold. The Marble Table recipe opens only at **Age 8**. The
oak table, the same shape, opens at Age 4.

**Done (#205):** the Marble Table, and the dressed marble it's made from,
open at Age 4, at the workshop like the oak table. A test checks the table
can be made by the temple's age.

---

## How it plays

### 3. Jumping next to blocks needs several taps

> "Jump is not working properly, I have to click multiple times to jump
> when I'm next to blocks"

**Now:** to be reproduced. The likely cause is that you count as "on the
ground" only when standing squarely on it, so pressed against a wall the
jump is dropped. The fix may be to accept a jump pressed just before
landing, or just after leaving an edge.

**Done (#205):** a simulation of walking into walls, steps and corners
jumped almost every time, so no single broken spot was found. Jumping now
forgives instead: a tap counts for a fifth of a second, so one that comes
just before you land, or in a moment a step or a wall leaves you off the
ground, still jumps; you can still jump just after walking off an edge; and
holding Jump keeps jumping each time you land. Tested in code, not yet on a
phone.

### 4. Buildings produce only while you play

> "Let's put progress items only in game time not all the time or it's
> gonna fill any storage"

**Now:** buildings are paid by the real clock. Away from the game, they keep
producing for up to 8 hours, which fills the storehouses.

**Fix:** pay them by time played, not time away. Closing the game pauses
them. Question for the owner: should anything still trickle in while away
(say an hour's worth), or nothing at all?

### 5. Throw things away from a storehouse

> "I should be able to delete shit from storehouses"

**Fix:** in a storehouse's pop-up, a way to throw a stack away, with a
"Sure?" step so nothing goes by accident. The same in the bag, if it isn't
there already.

### 6. Forests you can run through

> "It's impossible to run inside forests, I want them with leaves taller
> and space between logs"

**Fix:** trees spaced further apart, and taller trunks so the canopy starts
above your head. This changes only land you haven't been to yet; what's
already made stays. Check it in the browser by walking through a forest.

---

## Bigger pieces

### 7. The granary as the food store

> "Granary should not produce vegetables it should store them efficiently
> and free the storage rooms. This means a slot per item, that grows. It
> should be the place that villagers go for food, too before they should go
> to the storehouse. We need a way to alert the user a villager is hungry
> which and a button in the notification to give it food"

**Now:** the granary (Age 7) produces vegetables and potato seeds.

**Fix, in steps:**
1. The granary stops producing. It becomes a store for food only, with one
   slot per kind of food that holds as much as you put in.
2. Hungry villagers eat from a granary first, then a storehouse.
3. A notice when a villager is hungry, naming who, with a **Give food**
   button that feeds them from the granary or your bag.

Questions for the owner: what counts as food (fruit, vegetables, meat,
bread, drinks?), and is there a limit per kind?

### 8. Buildings that produce ore

> "We need buildings to produce ores, the one that smelts is cool, but we
> need passive generation too"

**Now:** the mine (Age 8) produces stone, gold and coal, with no iron or
copper. The foundry smelts, but produces nothing by itself.

**Fix:** the mine also brings up iron ore and copper ore, opened at an
earlier age so iron isn't only from digging. Or a separate ore building, if
the owner prefers. Questions: which ages, and how much a day?

### 9. Buildings that fit the whimsical, mystical look

> "Buildings need rebuilding, they need to fit more the mood and vibe of the
> mobs whimsical and mystical this might require new blocks and lights - ask
> me for references"

**Need from the owner:** pictures or links of the look you want, before
starting.

**Then:** redesign the ready-made buildings, with new blocks and lights
where they're needed, one building at a time, starting with the house.
Screenshots of each for the owner to approve.

---

## Order

1 and 2 first (blocking). Then 3 and 4 (felt every minute of play). Then
5, 6, 8. Then 7 and 9, which need answers from the owner first.
