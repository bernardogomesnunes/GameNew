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

**What it was:** "Saving loads the button and then shows the loading of the
beginning of the game". The menu's only Save was **Save and leave**: it
saved, then took you back to the worlds screen, which rebuilds the scenery
behind it under a loading screen.

**Done (#206):** a plain **Save** in the menu, beside Save and leave. It
shows it's saving, then says "Saved" (or "Not saved — try again"), and keeps
you in the world. Checked in the browser, signed out.

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

The owner then said the misses come while running: the small buttons, the
timing, and going into a block together. **Done (#206):** an **Auto jump**
setting in Controls (off to begin with). With it on, walking into a block
one high hops you onto it with no button; a wall two high is left alone.
The bigger buttons are Cline's Task 8.

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

**Done (#208):** each stack in a storehouse's pop-up (and a granary's,
cart's or chest's) has the bag's red cross. Tapping it asks "Throw away 64
stone? They're gone for good." first. The bag already had it.

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

**The owner's answers:** the granary keeps everything a farm produces. You
can take things out and put more in. No hard limit: farms produce a lot.

**Done (#208):**
- The granary no longer produces anything. It keeps everything a farm
  grows (each crop and its seeds), one slot for each kind, with no limit.
- Farm produce goes to it before any storehouse, and farm produce already
  on storehouse shelves is moved over to it, freeing them.
- You can take things out, or put more in, from its pop-up. Anything a farm
  doesn't grow is turned away with a message.
- Villagers eat from it first, then the storehouses, then your bag.
- When villagers go hungry, the notice names them ("Ana and Bo are
  hungry") and has a **Give food** button that feeds them at once.

### 8. Buildings that produce ore

> "We need buildings to produce ores, the one that smelts is cool, but we
> need passive generation too"

**Now:** the mine (Age 8) produces stone, gold and coal, with no iron or
copper. The foundry smelts, but produces nothing by itself.

**The owner's answer:** a mine building that produces ore, with 5 levels.
It starts with copper, then iron, gold from level 3, and diamonds at
level 5.

**Done (#207):** the Mine now opens at Age 5, with the foundry that smelts
its ore, and climbs five levels by digging it out further and propping the
roof:

| Level | Brings up |
|---|---|
| 1, A Shaft | copper ore, stone, coal |
| 2, A Drift | adds iron ore |
| 3, A Gold Gallery | adds gold ore |
| 4, Deep Workings | the same, more often |
| 5, A Diamond Seam | adds diamonds |

Digging inside it is never refused, as in a quarry. Age 6's "evolve a
building" goal is now "Dig your mine down to iron", and Age 8's mine goal is
"Dig your mine down to gold". Gold comes up as ore for the foundry now,
like copper and iron.

### 9. Buildings that fit the whimsical, mystical look

> "Buildings need rebuilding, they need to fit more the mood and vibe of the
> mobs whimsical and mystical this might require new blocks and lights - ask
> me for references"

**The owner's references** (four screenshots of Minecraft builds, sent in
the chat; described here, not copied in, as they're other people's work):

1. *Mistamber* cottage: a steep, crooked roof in mint and teal tiles with
   moss growing over it; oak beams framing it; curled wooden flourishes on
   the eaves and gable tips; leaning brick and stone chimneys with smoke; a
   stained-glass window; a red door on a mossy stone base; lanterns by the
   door; red-capped mushrooms and blue flowers along the path.
2. *Fantasy house*: dark wood framing with a steep teal roof whose tips
   curl up; a slim tower with a pointed teal spire and lit windows; warm
   lanterns; stone steps.
3. *Mushroom house*: a giant mushroom cap for a roof, purple, pink and
   pale green, with purple flowers hanging from its rim like wisteria; a
   tree-trunk body with a round door and little balconies; amethyst
   crystals and small warm lights all round.
4. *Whimsical mushroom hut*: a timber cottage with a grassy, mossy roof,
   red-and-white spotted mushroom caps growing out of it, a cobbled path
   and flowers.

**What they share:** steep, crooked roofs in teal, mint or purple; curled
tips; moss, vines and hanging flowers; mushrooms; warm small lights;
stained glass and crystals; leaning chimneys.

**Already in the game:** moss, dark moss, amethyst, lanterns, firefly
lanterns, brick and stone chimneys, brick and stone roof tiles, red, blue
and tinted glass, clay.

**New blocks needed:** teal roof tiles and mint roof tiles (and mossy
versions); a red spotted mushroom cap, a purple mushroom cap and a pale
mushroom stem; hanging vines and hanging purple flowers; stained glass in
a few colours; curled wooden trim; little fairy lights.

**Then:** redesign the ready-made buildings, with new blocks and lights
where they're needed, one building at a time, starting with the house.
Screenshots of each for the owner to approve.

---

## Order

1 and 2 first (blocking). Then 3 and 4 (felt every minute of play). Then
5, 6, 8. Then 7 and 9.
