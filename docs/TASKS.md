# Duilt: every task in one place

Asked for directly: "We need to be better at keeping our house organised …
a complete task document, with every idea and thing we discussed to do
there listed. This way we can divide the work through different ways. Make
sure we don't forget anything from the past."

This is the one list to plan from. It was put together on 20 October 2026
from every planning doc in `docs/`, every message in the chat since
6 October, and the owner's "Adding changes" list. The older docs stay as
the history and the detailed briefs (see the end), but **this** is where
something is added, given to someone, or ticked off.

## How to read it

- **ID**: use it to talk about a task, in the chat, a commit or a PR.
- **Who**: who it suits best.
  - **Claude**: needs the whole codebase, a design, or a browser check.
  - **Cline**: small, self-contained, a brief already written
    (`docs/cline-tasks.md`), under about 30 minutes.
  - **Owner**: a decision, a test on the phone, or something only you can
    reach (Neon, Vercel, Cline's settings).
- **Size**: S (under an hour), M (a session), L (several sessions or PRs).
- **Status**: *to do*, *in progress*, *waiting* (on a decision or a test),
  or *done* with its PR number.

When something lands: change its status here, with the PR. When something
new is asked for: add it to the right section with the owner's words
quoted.

---

## 1. Urgent: saving

Lost progress is the one thing that can't be undone, so this comes first.

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| SAVE-1 | **Find why the testing world lost progress** (reported: "Was not able to save my testing world it lost a lot of progress"). | Claude + Owner | M | waiting |
| SAVE-2 | **A world missing from the account list is treated as deleted.** See below. | Claude | M | to do |
| SAVE-3 | **Save and leave leaves even when the save failed**, and says nothing. | Claude | S | to do |
| SAVE-4 | **Failed uploads retry silently.** | Claude | S | to do |
| SAVE-5 | **The backup copy may not fit.** | Claude | S | to do |

**SAVE-1, the save loss.** Every failed upload is written to the
`save_failures` table in Neon with its reason. Claude can't reach the
database: the Neon connection in Claude's sessions signs in to an account
with no projects. **Owner:** reconnect Neon in claude.ai (Settings →
Connectors → Neon), sign in with the account that owns the game's
database, and pick "All projects you can access". Then Claude reads
`save_failures` and the testing world's last save time, read-only.

**SAVE-2, the likeliest suspect, not yet proven.** While saving
(`Game.flush`), the game asks the account for its list of worlds. If this
world isn't in the list but was saved before, it decides the world was
deleted: it stops saving for the rest of the session (`discarded`) and
throws away the backup copy. But a sign-in that has quietly expired gets an
*empty* list back, not an error, because the database shows nothing to
someone not signed in. So an expired session would look exactly like
"deleted", and every save after it would silently not happen. The commit
"Explain failed world saves" (on main) now names this case when you press
Save, but it still stops saving. **Fix:** treat an empty or failed list as
"don't know", never as "deleted"; check the sign-in before believing a
world is gone; never drop the backup copy on that guess.

**SAVE-3.** "Save and leave" waits up to 15 seconds and then takes you to
the worlds screen whether or not the save landed, without a word. The plain
Save button now says "Not saved — try again" and why. Save and leave should
too, and offer to stay.

**SAVE-4.** When an upload fails, the game tries again later without
telling you (a choice from batch 2, to cut noise). Keep it quiet for one
failure, but say so if saves keep failing for more than a few minutes.

**SAVE-5.** The backup copy for an upload that hasn't landed goes into the
browser's small local storage (about 5 MB). A big world may not fit, and
then there is no backup at all. Check the size of a real world, and keep
the copy somewhere bigger (IndexedDB) if it doesn't fit.

---

## 2. Just done: try it on your phone

Merged or about to be. Each has been checked by tests, most in a test
browser, none on a real iPhone.

| ID | What | PR |
|---|---|---|
| NOW-1 | **Storage controller takes things too**: your bag is in its pop-up; tap a stack to put it away. On desktop: the storehouse and controller pop-ups in two columns, each scrolling on its own; pop-ups you drag by the title bar; the bag (I) opens beside them; drag stacks between them. | in progress (pushed, tests running) |
| NOW-2 | Forging the ring moves you to Age 8 at once; a world stuck at the end of an age moves on as it opens. | #221 |
| NOW-3 | Placing a mine puts it 91 blocks down, dug out, with a spiral stair up to the surface. | #220 |
| NOW-4 | Tap a trader (or anyone who talks) where they are on screen, not only with the crosshair. | #219 |
| NOW-5 | The mine's fifth level brings up nightstone as well as sunstone. | #218 |
| NOW-6 | Only the Helix flies (Fly appears inside it); the Plainer glides. | #217 |
| NOW-7 | Roof edges show over the walls too. | #216 |
| NOW-8 | Sunstone at mine level 5; a crop slot more per farm level; meat from every pen; Sort in storehouses. | #215 |
| NOW-9 | Faster start-up. | #214 |
| NOW-10 | Buildings make things only while the game is open; forests you can run through. | #213 |
| NOW-11 | Granary keeps the harvest; hungry villagers named, with Give food. | #208 |
| NOW-12 | Mine building with five levels of ore. | #207 |
| NOW-13 | Plain Save that keeps you in the world; Auto jump in Controls. | #206 |
| NOW-14 | Jump that forgives a slightly early or late tap; Marble Table at Age 4. | #205 |
| NOW-15 | Storybook house, storehouse and market. | #209 |

Older things still waiting for a first try are in section 9.

---

## 3. New: the "Adding changes" list (20 October)

The owner's newest list, in full. None of it is started. Each needs a short
design agreed before it's built, so each starts as *waiting*.

### 3.1 Making blocks, not just gathering them

> "Building stuff is only blocks and gathering them is just a crafting
> mechanics. I'd like to change that. I want blocks like stone to have a
> mechanic to craft."

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| CRAFT-1 | **The quarry gives stone only.** "Quarry will give stone only." Today it gives stone, cobblestone, white stone, dark stone and clay (clay was added in #193 because it was hard to find; it needs a new home, see CRAFT-8). | Claude | S | waiting |
| CRAFT-2 | **Processing the rock.** "stone marble cobble, coloured stone except turquoise should be obtained by processing the rock." A machine (or the stone mill, grown up) turns stone into marble, cobble and the coloured stones. Turquoise stays as it is found. | Claude | M | waiting |
| CRAFT-3 | **A forge to darken.** "To darken we need some kind of forge": dark stone, dark brick and the like are made by burning their light version. | Claude | M | waiting |
| CRAFT-4 | **A bleach bucket to lighten.** "to lighten we should have some bleach bucket to place them": white stone and pale versions by soaking. | Claude | M | waiting |
| CRAFT-5 | **A full carpentry set for furniture.** "For wood we should have a full carpentry set of tools to do the diff kinds of furniture as a wooden mill is not enough." Saw, plane, chisel and the like; each kind of furniture needs its tool. | Claude | M | waiting |
| CRAFT-6 | **A more interactive crafting pop-up.** "The crafting experience here in the pop up should be slightly different and more interactive." For example: place the inputs, pick the tool, watch it made, not only a Make button. | Claude | L | waiting |
| CRAFT-7 | **Weapons by molding and forging.** "To mold and forge weapons we can have the same logic." | Claude | M | waiting |
| CRAFT-8 | **Where everything comes from afterwards.** Every block must still be obtainable (a test already checks it). Decide where clay, marble and the coloured stones come from once the quarry stops giving them, and update the ages so nobody is soft-blocked (as with stone and gravel in October). | Claude + Owner | S | waiting |

**Decide first:** which machines exist (one "stone works" with modes, or
separate forge, bleach vat, mill), at what age each opens, and what the
interactive pop-up looks like. Claude drafts it, the owner agrees.

### 3.2 A storage interface

> "Buildings need a lot of blocks to do. And food and all take a lot of
> space. We need a third storage item which is called a storage interface.
> Which is a block that should be placed on top of the storage manager and
> it allows me to see the list of storages and what they have, and clicking
> shows me all the items."

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| STORE-1 | **Storage interface block**, set on top of the storage controller. Opens a list of every storehouse (and granary): name, how full, where it is. Tap one to see everything in it, and take or put things there. | Claude | M | to do |
| STORE-2 | **Room for building in bulk.** Make sure a big build can draw on the stores without filling the bag (ties in with JOBS-2). | Claude | M | waiting |

### 3.3 Villagers with jobs

> "To make everything more interesting we should have villagers doing
> chores like building, and storing stuff. My idea is to have another
> building right in the beginning that allows to give jobs to villagers.
> This way we can make buildings way bigger."

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| JOBS-1 | **A job board building**, from the first ages, where you give villagers jobs. | Claude | M | waiting |
| JOBS-2 | **Villagers who build**: they carry blocks from the stores and put up a design (or a big one) for you, block by block. | Claude | L | waiting |
| JOBS-3 | **Villagers who haul**: they carry what buildings make to the storehouses, and from storehouses to where it's needed. | Claude | L | waiting |
| JOBS-4 | **Bigger buildings** once villagers build them. | Claude | M | waiting |

Today each settler is tied to one building for its +50% and walks between
home and work; nobody carries anything.

### 3.4 A world at a bigger scale

> "We need to step up our world generation. With big trees, and some big
> mountains we need to reinforce the scale. We need wider and bigger
> mountains and I mean a Kilimanjaro exists from time to time. 1 block is
> 1 meter remember. Plains bigger and deserts flatter."

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| WORLD-1 | **Wider, taller mountains**, and now and then a giant one, Kilimanjaro-sized: about 4,900 m high is far above the world's 200-block height, so decide the real top (the world may have to grow taller). | Claude | L | waiting |
| WORLD-2 | **Bigger trees** at scale (giant trees exist; more of them, and bigger). | Claude | M | to do |
| WORLD-3 | **Bigger plains, flatter deserts.** | Claude | M | to do |
| WORLD-4 | **Big deep caves**: "go deep like mine deep, and have big galleries, with ruins." Caves today are tunnels with ring ores and a few chests below y 30. | Claude | L | to do |

Land you've built on is saved whole and doesn't change. Land you've only
walked through regrows with the new rules, as with the roomier forests.
Phone frame rate is the limit to watch.

### 3.5 Creatures that move naturally

> "Mobs have weird behaviours, let's make them more natural. Villagers are
> going on roofs from the ground without even jumping."

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| MOBS-1 | **Villagers climbing onto roofs.** Found: a villager steps straight up as much as **4 blocks** (`STEP_UP` in `src/duilt/Settlers.js`). Make it one block, with a hop. | Claude | S | to do |
| MOBS-2 | **Natural movement for everyone else**: animals, bandits, guards, dinosaurs. List what looks wrong, then fix each. (Main now has "Polish idle and roaming creatures", which may cover part of this: check it first.) | Claude + Owner | M | waiting |

---

## 4. The look of buildings

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| LOOK-1 | **Organic shapes and mixed walls** (asked: "the houses look squares … the ones I sent have this organic form. also they diversify the textures by using multiple blocks on the walls"). Upper floors jutting out, roofs at different heights, turrets, crooked chimneys, porches; stone, timber, plaster, moss mixed in one wall. Brief: `docs/claude-tasks.md`, item 10. | Claude | L | to do |
| LOOK-2 | **House types to pick from** (a cottage, a mushroom house, a tower house), the suggested first step of LOOK-1: a building may have several designs and you choose one. | Claude | M | to do |
| LOOK-3 | **Houses that grow by level**, later, using the designs from LOOK-2 as the steps. | Claude | M | waiting |
| LOOK-4 | **New wall blocks to mix**: plaster, mossy cobble, timber framing in the storybook colours. | Claude | S | to do |
| LOOK-5 | **The storybook look for the other ready-made buildings** (on hold since #209; the house, storehouse and market are done). | Claude | L | waiting |

---

## 5. Open from earlier lists

| ID | What | From | Who | Size | Status |
|---|---|---|---|---|---|
| OLD-1 | **Two or three new peoples to raid**, past the old border. | Batch 4, D1 | Claude | L | to do |
| OLD-2 | **Places you've taken marked on the map**, and new ones appearing over time. | Batch 4, D1 | Claude | M | to do |
| OLD-3 | **Battle mode, step 2**: AI rivals through an API key, kept on our server, never in the page. The owner offered their own model server: it needs HTTPS, and its key goes in an environment secret, not the chat. | Batch 4, E | Claude + Owner | L | waiting |
| OLD-4 | **Battle mode, step 3**: real multiplayer. Needs a game server; plan it on its own. | Batch 4, E | Claude | L | waiting |
| OLD-5 | **Battle balance**: how strong rivals feel and how often they come (guesses today). | Batch 4, E | Owner | S | waiting |
| OLD-6 | **Composting**: a bin takes seeds and leaves and makes compost; compost speeds a farm or raises its yield. Agreed: last. | Batch 3, #9 | Claude | M | to do |
| OLD-7 | **Look and sound, the one piece not found in the code**: mist round the floating island, and cloud below it. Everything else in that plan is in (shadows, 32×32 textures, low mist, stars, sun rays, wind, new models, sound and music). | Look and sound plan | Claude | S | to do |

---

## 6. Cline's queue

Each has a full brief in `docs/cline-tasks.md`. One branch and one PR
each; Claude reviews and the owner merges.

| ID | What | Size | Status |
|---|---|---|---|
| CL-1 | Two secrets for time travel | S | done, #212 |
| CL-8 | **Bigger buttons on the phone (+8 px).** Left to Cline as a test. | S | to do |
| CL-9 | Recipe names say what you get ("Dress planks" → Planks, "Split stone" → Cobblestone). | S | to do |
| CL-10 | The mills open the bench with an empty search box. | S | to do |
| CL-11 | University studies say "game days" (about 15 minutes each). | S | to do |
| CL-2 | Futurians stop pointing you to the Archive once you've read it. | S | to do |
| CL-3 | The Age 12 "Travel to the Past" card says "To the Past". | S | to do |
| CL-4 | Secrets show up the moment you earn them. | S | to do |
| CL-5 | "Know the woods" counts only present-day animals (owner: skip it if the Past's creatures should count). | S | waiting |
| CL-6 | Say what tapping a special block does: Travel, Read, Take, Leave. | S | to do |
| CL-7 | The War Standard drawn as a flag on a pole. | S | to do |
| CL-12 | Tap the people counter to feed the hungry. | S | to do |
| CL-13 | Say "granary" where a granary is meant. | S | to do |
| CL-14 | "Put it all in" in a granary says why things stayed out. | S | to do |

New small tasks from the lists above that would suit Cline: COPY items in
section 7, once the wording rules are agreed, and MOBS-1.

---

## 7. The wiki and the game's words

> "Including the wiki … that is not good today, and copy overall that has
> a lot of weird descriptions of elements."

### The wiki (`docs/wiki/`)

Fifteen pages, written on 14 October and not touched since, except one
line about the garrison. Since then the game has changed under it: time
travel, Battle mode, the Plainer and Helix, the mine at Age 5 with five
levels, the granary as a store, buildings working only while you play,
the stone and wood mills, the storybook buildings, new blocks, Auto jump,
the plain Save, and more.

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| WIKI-1 | **Bring every page up to date** with the game as it is, one page at a time, each checked against the config it describes (`structures.js`, `items.js`, `recipes.js`, `ages.js`, `traders.js`, `mobs.js`). | Claude | L | to do |
| WIKI-2 | **Generate the lists from the game's own config** (buildings, recipes, items, traders, goals), so the wiki can't drift again; keep the hand-written parts (story, how-tos) by hand. A test fails if a generated page is out of date. | Claude | M | to do |
| WIKI-3 | **Decide what the wiki is for and who reads it**: players (then in plain language, by task: "how do I get iron?"), or us (then as reference). Today it's neither quite. | Owner | S | waiting |
| WIKI-4 | **A wiki in the game**, if wanted: the same pages from a menu, searchable. | Claude | M | waiting |

### The words in the game

Every item has a "how you get it" line (`madeBy` in `src/config/items.js`,
312 items), buildings have blurbs, levels have blurbs, recipes have names.
Many were written one at a time and don't agree. Some examples, as they
read today:

- **Stone**: "Mined from rock", but rock gives marble, white stone or
  cobble; stone comes from a quarry or from those at the bench.
- **Marble**: "Cut and dressed at a workshop", but it's also dug.
- **Gravel**: "Scraped off the mountainside", but most comes from
  underground and the stone mill.
- **Raw meat**: "Hunted", but every pen gives it now.
- **Recipes** named for the action, not the thing: "Dress planks", "Split
  stone" (CL-9).

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| COPY-1 | **Rules for the game's words**: one short page. For example: every "how you get it" lists every way, most common first, in the same order of parts; present tense; no jokes in the facts; names of buildings as the building list says them. | Claude, Owner agrees | S | to do |
| COPY-2 | **Every item's description** rewritten to the rules, checked against where it really comes from. A test checks every item named as made at a building really is made there, and every way to get it is listed. | Claude, or Cline in batches | M | to do |
| COPY-3 | **Buildings, levels, goals, notices and pop-ups**: the same pass. | Claude, or Cline in batches | M | to do |
| COPY-4 | **Strange descriptions the owner has seen**: list them here as they're found. | Owner | S | to do |

---

## 8. Housekeeping

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| HOUSE-1 | **Old branches to delete**: `cline-test` (merged as #212), `claude/backlog-batch-3-update`, `claude/debug-overlay`, `claude/mob-models-blender`, `claude/stoic-dirac-yky1hi`. Check each has nothing unmerged first. | Claude, Owner agrees | S | waiting |
| HOUSE-2 | **Retire the old planning docs** into a `docs/history/` folder, leaving this file and the Cline briefs at the top. | Claude | S | to do |
| HOUSE-3 | **Cline's settings** (on the owner's computer): auto-approve with a cap, Plan then Act, a strong model, the custom instructions. See the top of `docs/cline-tasks.md`. LM Studio wasn't working: set it up together if still wanted. | Owner | S | waiting |
| HOUSE-4 | **The full test suite takes about 10 minutes now** (7,200 checks). Find the slowest files and speed them up, so a PR waits less. Some timing checks fail now and then on a busy machine; make them steadier. | Claude | M | to do |

---

## 9. To try on the phone

Things that exist but you haven't told us you've tried. Some were seen
working in a test browser, some only by the automated tests; the longer
version, saying which, is in `docs/status-and-testing.md`.

**Recent (section 2):** NOW-1 to NOW-15.

**Early and middle game:** people talking (settler and trader), rare goods
at the market, the collection book past 10%, the bow's hemp chain,
university studies and what their skill then does, barracks and hungry
soldiers.

**Vehicles:** train passengers getting off and on.

**Late game, your god and the war (Ages 7 to 10):** the temple and
devotion; the rings; the sanctuary's guardian healing, scaring, coming
back; the Ten Rounds past round 1 and the Warlord; the oath on the dark
path and its 1,000 warriors; the march and the expedition; cutting the
chains; the disguise; the palace and the Sky King; taxes after a lost
attack; both endings.

**After the war:** stealing in a city; city lanterns at night; robbing a
tree tribe; an outpost's armoury; diamond and ruby gear; killing the god in
his cube.

**Time travel:** the machine, the Past, raptors, triceratops and
long-necks, taming and eggs, the whistle and the dinosaur army, the
Basilisk, the Future, the Archive, futurians, the frame rate in the city.

**Battle mode:** create one; the barracks starts the attacks; beat an
army; take a city's standard; come back to it; balance.

**Fixes:** old lanterns in an account world; search pop-ups with the
keyboard up; the loading screens.

---

## 10. Decisions waiting on the owner

| ID | Question | For |
|---|---|---|
| ASK-1 | Reconnect Neon so Claude can read the save failures. | SAVE-1 |
| ASK-2 | Block making (3.1): which machines, which ages, how interactive. Claude drafts first. | CRAFT-* |
| ASK-3 | The job board (3.3): what jobs, from which age, how many villagers per job. | JOBS-* |
| ASK-4 | How high the giant mountain goes, and whether the world gets taller. | WORLD-1 |
| ASK-5 | Who the wiki is for. | WIKI-3 |
| ASK-6 | "Know the woods": should the Past's creatures count? | CL-5 |
| ASK-7 | The model server for Battle mode's AI rivals (HTTPS, key in an environment secret). | OLD-3 |
| ASK-8 | Delete the old branches? | HOUSE-1 |

---

## Suggested order

1. **Saving** (section 1). Nothing else matters if progress is lost.
2. **Cline's queue** (section 6), in the background, a task at a time.
3. **Quick fixes Claude can do now**: MOBS-1 (roof climbing), STORE-1
   (storage interface), SAVE-3 and SAVE-4.
4. **The words**: COPY-1 rules, then the wiki's generated lists (WIKI-2),
   then the rest of the pages and the item descriptions, part by part, with
   Cline helping.
5. **The big new systems, one at a time, each designed first**: block
   making (3.1), then villagers with jobs (3.3), then the bigger world
   (3.4).
6. **Buildings' looks** (section 4), between the big pieces.
7. **Later**: new peoples, map marks, Battle steps 2 and 3, composting.

## Where the older docs are

They're the history and the detailed briefs. Nothing in them is open that
isn't listed above.

| Doc | What it holds |
|---|---|
| `docs/claude-tasks.md` | The October batch, item by item, with what was done. |
| `docs/cline-tasks.md` | Cline's briefs, CL-1 to CL-14, and its rules. |
| `docs/status-and-testing.md` | Everything asked since batch 4, and the full testing list. |
| `docs/backlog-batch-2.md`, `-3.md`, `-4.md` | The second, third and fourth batches, all done except what's in section 5. |
| `docs/plan-look-and-sound.md` | The look and sound revamp. |
| `docs/plan-phase7-lore.md` | The story, both paths: done. |
| `docs/plan-playtest-improvements.md` | P1 to P9 from the first playtest: done. |
| `docs/next-session.md` | Notes from the phase 6 and 7 work: done. |
