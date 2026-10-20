# Duilt: every task in one place

Asked for directly: "We need to be better at keeping our house organised …
a complete task document, with every idea and thing we discussed to do
there listed. This way we can divide the work through different ways. Make
sure we don't forget anything from the past."

**This is the one and only tasks file** (asked for directly: "I'd like to
have one and only tasks file, and then inside you can divide which ones are
for you or not"). It was put together on 20 October 2026 from every
planning doc, every message in the chat since 6 October, and the owner's
"Adding changes" list. Everything to do, for everyone, is here, Cline's
full briefs included (section 11). The old planning docs are in
`docs/history/`, for reference only: nothing is added or ticked off there.

## How to read it

- **ID**: use it to talk about a task, in the chat, a commit or a PR.
- **Who**: who it suits best.
  - **Claude**: needs the whole codebase, a design, or a browser check.
  - **Cline**: small, self-contained, a brief already written (section
    11), under about 30 minutes.
  - **Owner**: a decision, a test on the phone, or something only you can
    reach (Neon, Vercel, Cline's settings).
- **Size**: S (under an hour), M (a session), L (several sessions or PRs).
- **Status**: *to do*, *in progress*, *waiting* (on a decision or a test),
  or *done* with its PR number.

When something lands: change its status here, with the PR. When something
new is asked for: add it to the right section with the owner's words
quoted.

---

## Who's on what

Open tasks only, by who takes them. The sections below have the details.

**Claude**
- Saving: SAVE-2, SAVE-3, SAVE-4, SAVE-5.
- The new list, each designed first and agreed with the owner: block
  making CRAFT-1 to CRAFT-8, the storage interface STORE-1 and STORE-2,
  villagers with jobs JOBS-1 to JOBS-4, the bigger world WORLD-1 to
  WORLD-4, creatures MOBS-1 and MOBS-2.
- Buildings' looks: LOOK-1 to LOOK-5.
- From earlier lists: OLD-1 to OLD-4, OLD-6, OLD-7.
- The wiki and the words: WIKI-1, WIKI-2, WIKI-4, COPY-1 to COPY-3.
- Housekeeping: HOUSE-1 (once the owner agrees), HOUSE-4.
- Reviewing each of Cline's pull requests before the owner merges it.

**Cline** (briefs in section 11)
- CL-8 first (the test task), then CL-9, CL-10, CL-11, CL-2, CL-3, CL-4,
  CL-6, CL-7, CL-12, CL-13, CL-14. CL-5 waits on the owner.
- Later, once their briefs are written: COPY-2 and COPY-3 in small batches.

**Owner**
- Try things on the phone: section 2 (NOW-1 to NOW-15) and section 9.
- Decide: ASK-1 to ASK-8 (section 10), Battle balance (OLD-5), who the
  wiki is for (WIKI-3).
- Note strange descriptions as you find them (COPY-4).
- Cline's settings on your computer (HOUSE-3).

---

## 1. Urgent: saving

Lost progress is the one thing that can't be undone, so this comes first.

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| SAVE-1 | **Find why the testing world lost progress** (reported: "Was not able to save my testing world it lost a lot of progress"). Saving works again, tested by the owner on 20 October (before, Save showed "Not saved — try again"). Watch for it coming back: a failure now says why. | Owner | S | done |
| SAVE-2 | **A world missing from the account list is treated as deleted**, and its backup thrown away. Now explained on Save (ChatGPT's commit); the backup is still lost. See below. | Claude | S | to do |
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

**SAVE-2.** While saving (`Game.flush`), the game asks the account for its
list of worlds. If this world isn't in the list but was saved before, it
decides the world was deleted (here or on another device): it stops saving
for the rest of the session and throws away the backup copy. An expired
sign-in does **not** trigger this: checked in the code, a missing or
expired token is an error, retried once with a fresh one, and an error
keeps the backup. It fires only when the list comes back fine without the
world, such as after deleting it, or a copy of it, elsewhere. "Explain failed
world saves" (ChatGPT, on main since 19 October) now says so when you press
Save: "This world is no longer in your account…". Left to decide: is
stopping right when the world is still open here? Safer: keep the backup
copy and offer to save it as a new world, rather than dropping it.

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
| NOW-1 | **Storage controller takes things too**: your bag is in its pop-up; tap a stack to put it away. On desktop: the storehouse and controller pop-ups in two columns, each scrolling on its own; pop-ups you drag by the title bar; the bag (I) opens beside them; drag stacks between them. | #222 |
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

Each has a full brief in section 11. One branch and one PR each; Claude
reviews and the owner merges.

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
| HOUSE-2 | **One tasks file**: the old planning docs moved to `docs/history/`, Cline's briefs folded into section 11. | Claude | S | done |
| HOUSE-3 | **Cline's settings** (on the owner's computer): auto-approve with a cap, Plan then Act, a strong model, the custom instructions. See section 11. LM Studio wasn't working: set it up together if still wanted. | Owner | S | waiting |
| HOUSE-4 | **The full test suite takes about 10 minutes now** (7,200 checks). Find the slowest files and speed them up, so a PR waits less. Some timing checks fail now and then on a busy machine; make them steadier. | Claude | M | to do |

---

## 9. To try on the phone

Things that exist but you haven't told us you've tried. Some were seen
working in a test browser, some only by the automated tests; the longer
version, saying which, is in `docs/history/status-and-testing.md`.

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
| ASK-1 | Saving works again (20 October). Only if it fails again: reconnect Neon so Claude can read the save failures. | SAVE-1 |
| ASK-2 | Block making (3.1): which machines, which ages, how interactive. Claude drafts first. | CRAFT-* |
| ASK-3 | The job board (3.3): what jobs, from which age, how many villagers per job. | JOBS-* |
| ASK-4 | How high the giant mountain goes, and whether the world gets taller. | WORLD-1 |
| ASK-5 | Who the wiki is for. | WIKI-3 |
| ASK-6 | "Know the woods": should the Past's creatures count? | CL-5 |
| ASK-7 | The model server for Battle mode's AI rivals (HTTPS, key in an environment secret). | OLD-3 |
| ASK-8 | Delete the old branches? | HOUSE-1 |

---

## 11. For Cline: how to work, and the briefs

Cline: your tasks are the CL ones in "Who's on what" at the top, in that
order. Do **one** at a time: its own branch and its own pull request. When
it's merged, the owner (or Claude) marks it done in section 6. CL-1 is done
(#212).

### Cline's settings (for the owner, not the agent)

Things to set in Cline on your computer. They can't live in the repo.

1. **Auto-approve:** turn it on for reading files, editing files and safe
   commands, with a request cap of about 50. Without it, Cline stops before
   every step and waits for a click, so a task left running overnight
   mostly sits idle.
2. **Plan, then Act:** start each task in Plan mode, approve the plan, then
   switch to Act. A wrong approach is caught before it costs hours.
3. **Model:** pick a strong one. A small or local model loops and redoes
   work, which is slower overall.
4. **Custom instructions:** paste this into Cline's settings:

   > Be fast and minimal. Follow .clinerules exactly. Plan in three lines
   > before editing. Run only the test file you changed until the end. If
   > you're stuck for two attempts or 45 minutes, stop and tell me what's
   > blocking. Never read files over 1,000 lines whole.

### Before you start

- **The game:** Duilt, a voxel sandbox in plain JavaScript and Three.js. No
  framework, no TypeScript. Config lives in `src/config/`, the world in
  `src/world/`, the main loop in `src/Game.js` (big; search it rather than
  read it).
- **Run it:** `npm install`, then `npm run dev:offline` and open
  `http://localhost:5173`. Offline mode needs no account or database.
- **Tests:** while you work, run only the file you changed:
  `node tests/<name>.test.mjs`. It takes under a second. `node tests/run.mjs`
  runs every test (about 7,200 checks, about 10 minutes); run it once, at the
  end. A test file prints
  `PASS`/`FAIL` lines and exits non-zero on a failure. There's no test
  framework; copy the style of the file you're in.
- **Code style:** match the file you're in. Comments explain *why*, in plain
  English, and often quote what the owner asked for ("asked for directly:
  ..."). Use short names and no new dependencies.

### Rules

- Work on a new branch and open a pull request. **Don't merge it**; the owner
  reviews and merges. Merging to `main` deploys the live game.
- **Never touch the database** (Neon). Don't run queries or migrations, and
  don't change `src/net/` (accounts and cloud saves), `db/` or `migrations/`.
- **Never commit `.env`** or any key, token or password.
- **Never use real people's or real worlds' names** in tests or sample
  data. Use labels like "Test world 1".
- Run the whole suite once before you open the PR. It must end
  `... passed, 0 failed`.
- No browser check unless the task asks for one.
- In the PR description, say what you checked and what you didn't. Don't
  claim something works if you didn't see it work.

---

### CL-2: futurians mention the Archive only until you've read it

**Why:** the Future's people say a fixed set of lines (`FUTURIAN_TALK` in
`src/config/talk.js`). One of them points you to the Archive, and they keep
saying it after you've read it.

**What to do:**

- Pass whether the Archive has been read into `talkLine` (the one call is in
  `src/Game.js`; search `talkLine({`).
- Once it's read, futurians use a second, short list instead of the
  "go to the Archive" line, e.g. "So you've read the Archive? Then you know
  more than most of us."
- Keep `talkLine` pure: it takes what it needs as arguments and reads no
  globals.

**Tests:** extend `tests/future.test.mjs` (there's already a futurian talk
check). Before reading, some line mentions the Archive. After reading, none
of the "go to it" lines comes up over several turns.

**Done when:** `node tests/future.test.mjs` and `node tests/talk.test.mjs`
pass, then the full suite once. No browser check needed.

---

### CL-3: the Age 12 "Travel to the Past" card is out of date

**Why:** the card's description in `src/config/achievements.js`
(`GOAL_WORDS.past`) says "set it down and Place on it". The machine's pop-up
now offers **To the Past** and **To the Future**, so the card should say to
pick the Past.

**What to do:**

- Reword that one description.
- Search `src/` and `tests/` for anything else that says the same thing.
  Today no test checks this wording.
- Add one check to `tests/twelveages.test.mjs` that the card mentions
  **To the Past**.

It's a one-line change; what it tests is whether the agent looks before it
edits and leaves a test behind.

**Done when:** `node tests/twelveages.test.mjs` passes, then the full suite
once. No browser check needed.
---

### CL-4: secrets show up the moment you earn them

**Why:** achievements, secrets included, are only checked when something
happens: a block placed or broken, a building claimed, a place found
(`src/gamification/GamificationEngine.js`, `checkAchievements`). Travelling
in time, reading the Archive or hatching an egg isn't one of those
moments, so "Both ways" and "Tomorrow's scholar" only pop up after your
next block.

**What to do:** in `src/Game.js`, call `this.gamification?.checkAchievements(null)`
at the end of `travelPast`, `travelFuture`, `readArchive` and `hatchEggs`
(the last only when an egg actually hatched). Search for each name; don't
read the file whole.

**Tests:** in `tests/future.test.mjs` (it already reads `Game.js` as text),
check each of those four functions calls it. Copy the style of the regex
checks already there.

**Done when:** `node tests/future.test.mjs` and `node tests/past.test.mjs`
pass, then the full suite once. About 20 minutes.

---

### CL-5: "Know the woods" counts only the animals of home

**Why:** the secret "Know the woods" (`s_woods` in `src/config/secrets.js`)
asks for one of every animal in `MOBS`. Since time travel, `MOBS` includes
the raptor, triceratops, long-neck and the Basilisk, so the secret now
quietly needs a trip to the Past. Its hint says "Every creature that walks
these lands".

**Owner's call:** if you'd rather the Past's creatures count, skip this
task.

**What to do:** count only animals whose `biomes` are all present-day ones.
A biome belongs to another time when its entry in `src/config/biomes.js`
has an `era` (look up `BIOMES_BY_ID`). Don't list the animal ids by hand:
new ones should be picked up by themselves.

**Tests:** `tests/secrets.test.mjs` has "Know the woods: every animal".
Make it hunt only the present-day ones, and add a check that hunting the
dinosaurs isn't needed.

**Done when:** `node tests/secrets.test.mjs` passes, then the full suite
once. About 20 minutes.

---

### CL-6: say what tapping a special block does

**Why:** aim at a door and the Place button says **Open**; at a sky lift,
**Ride**. That's `swingLabel(id)` near the top of `src/Game.js`. The newer
blocks you tap say nothing.

**What to do:** in `swingLabel`, return:

| Block | Label |
|---|---|
| `TIME_MACHINE` | Travel |
| `ARCHIVE` | Read |
| `WAR_STANDARD` | Take |
| `WAY_OUT` | Leave |

Each is already imported at the top of `Game.js`. Then check the second
place that decides whether to show the label (search `swingLabel(hit.block)`):
it only shows for some blocks, so add these four there too.

**Tests:** `tests/doorlabel.test.mjs` tests `swingLabel`. Add one check for
each new label.

**Done when:** `node tests/doorlabel.test.mjs` passes, then the full suite
once. About 30 minutes.

---

### CL-7: the War Standard as a flag on a pole

**Why:** a Battle rival's standard (`WAR_STANDARD`, block 458 in
`src/config/blocks.js`) is drawn as a plain glowing gold cube. It should
look like a standard: a pole with a flag on it.

**What to do:**

- In `src/world/propShapes.js`, add `PROP_SHAPES.banner_war`, built the way
  `banner_white` and `banner_black` are (search `bannerFrame`). Gold cloth,
  dark pole, and the cloth's boxes marked `glow: true` so it shines at
  night (search `glow: true` in that file for examples).
- Give `WAR_STANDARD` `shape: 'banner_war'` in `blocks.js`. Keep it
  `system: true` and keep its `light`.

**Watch out:** it must still be tappable. `tests/battle.test.mjs` checks the
standard is in a rival city. After your change, check the raycast still
finds it: other banners can be pointed at, so it should be fine, but make
sure.

**Tests:** add to `tests/battle.test.mjs`: the standard's shape is
`banner_war`, and that shape exists in `PROP_SHAPES`.

**Done when:** `node tests/battle.test.mjs`, `node tests/shapes.test.mjs`
and `node tests/textures32.test.mjs` pass, then the full suite once. One
screenshot in the pull request would help, but it's optional. About 45
minutes.



---

### CL-8: bigger buttons on the phone

**Why:** asked for directly: "button size is too small, increase buttons
8 px in size".

**What to do:** in `src/ui/styles.css`, make the on-screen buttons 8 pixels
bigger, in width and height: the touch buttons (search `.touch-btn`) and the
small side ones (Jump, Sneak, Break), which take their size from
`--side-btn`. Leave the hotbar slots and the pop-ups' buttons alone. Check
nothing overlaps at a 390 × 780 phone screen.

**Tests:** none to add (it's styling). Run the full suite once.

**Done when:** the full suite passes. A screenshot at phone size in the
pull request, if you can. About 20 minutes.

---

### CL-9: recipe names say what you get

**Why:** asked for directly: "I've seen Dress planks name on one menu it
should be planks and in the stone mill split stone should be cobblestone".

**What to do:** in `src/config/recipes.js`, rename the recipes the player
sees:

| Now | Should say |
|---|---|
| Dress planks | Planks |
| Split stone | Cobblestone |
| Dress marble | Marble |

Search for any other recipe whose name isn't the thing it makes (look for
names starting "Dress", "Split" or "Cut"), and list them in the pull request
rather than changing them.

**Tests:** search `tests/` for the old names first and update any test that
checks them. Run `node tests/stonemill.test.mjs` and
`node tests/woodmill.test.mjs`, then the full suite once.

**Done when:** the three names are changed and the full suite passes.
About 15 minutes.

---

### CL-10: the mills open the bench with an empty search box

**Why:** asked for directly: "When opening the stone mill and wood mill the
search has its names written". Tapping a mill opens the crafting pop-up
with "Stone Mill" or "Wood Mill" typed into its search box.

**What to do:** in `src/Game.js`, search `openBench(stationName(`. Open the
bench with no search text instead. The mill's own recipes still show,
because you're standing by it.

**Tests:** add a check to `tests/stonemill.test.mjs` (or the wood mill's
test, whichever already reads `Game.js`) that tapping a mill opens the
bench without a search text.

**Done when:** that test passes, then the full suite once. About 15
minutes.

---

### CL-11: university studies say "game days"

**Why:** asked for directly: "University learnings should take in game days
to complete and not real days". They already count game days. A game day is
15 minutes of play (`GAME_DAY_SECONDS` in `src/render/DayCycle.js`), but the
pop-ups just say "Takes 2 days", which reads like real days.

**What to do:** wherever a study's length is shown, say game days and
roughly how long that is to play, for example "Takes 2 game days (about 30
minutes of play)". Three places:

- the toast when a study starts: `src/Game.js`, search `Researching ${name}`;
- the recipe card: `src/ui/DuiltUI.js`, search `research-takes`;
- the time left: `src/duilt/DuiltGame.js`, `researchLeftText`.

Work the minutes out from `GAME_DAY_SECONDS`, not a typed-in number.

**Tests:** search `tests/` for "days" next to research or study, and update
any test that checks the old wording. Add one check that the start message
says "game days".

**Done when:** those tests pass, then the full suite once. About 25
minutes.
---

### CL-12: tap the people counter to feed the hungry

**Why:** the hungry notice has a **Give food** button, but it goes after
12 seconds. After that the only sign is the people counter at the top
turning to "hungry", and tapping it only explains the numbers.

**What to do:** in `src/ui/DuiltUI.js`, `sayPeople()` runs when the people
counter is tapped. When somebody is hungry (`this.duilt.settlers.hungry` is
more than 0), make the tap call `this.giveFood()` instead, the same thing
the notice's button does. Also in `renderPeople()`, change the hungry
tooltip from "put some food in a storehouse" to "tap to feed them, or fill
the granary".

**Tests:** in `tests/granary.test.mjs`, add a check that `sayPeople`
calls `giveFood` when someone is hungry (reading the source, like the other
checks in that file do), and one for the new tooltip words.

**Done when:** `node tests/granary.test.mjs` passes, then the full suite.
About 20 minutes.

---

### CL-13: say "granary" where a granary is meant

**Why:** granaries now count as stores, but some messages still say
"storehouse" for them.

**What to do:**
- In `src/ui/DuiltUI.js`, `renderStores()` (the "Every storehouse" list)
  says "N things in N storehouses" and "Across N storehouses". With a
  granary among them, say "stores" instead: "N things in 3 stores".
- In `src/Game.js`, `deleteBuilding()` refuses to take down a store with
  things in it, saying "Empty the storehouse first". Use the building's own
  name (`STRUCTURES_BY_ID.get(structure.type).name`), so a granary says
  "Empty the granary first".

**Tests:** add checks to `tests/storediscard.test.mjs` that both messages
use the new words.

**Done when:** that test file passes, then the full suite. About 20 minutes.

---

### CL-14: "Put it all in" in a granary says why things stayed out

**Why:** a granary only takes what farms grow. Pressing **Put it all in**
in a granary with stone in your bag says "The shelves filled up before the
rest", or "The shelves are full", which isn't true: it has no limit.

**What to do:** in `src/ui/DuiltUI.js`, `storeEverything()`. When the
store is a granary (`store instanceof Granary`; `Granary` is already
imported there), say "The granary only takes what farms grow" for whatever
stayed in the bag, instead of the shelves wording.

**Tests:** add a check to `tests/storediscard.test.mjs` for the new words.

**Done when:** that test file passes, then the full suite. About 15 minutes.

---

---

### How to report back

Open a PR titled after the task (e.g. "Secrets: Both ways, and Tomorrow's
scholar"). Its body says:

- what changed, in two or three bullets;
- the test result line from `node tests/run.mjs`;
- what you checked, and what you didn't;
- roughly how long it took.

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

## The old planning docs (history)

Moved to `docs/history/`. They're the record of what was asked and how it
was done; nothing in them is open that isn't listed above.

| Doc | What it holds |
|---|---|
| `claude-tasks.md` | The October batch, item by item, with what was done. |
| `cline-tasks.md` | Cline's briefs as first written (now section 11 here). |
| `status-and-testing.md` | Everything asked since batch 4, and the full testing list. |
| `backlog-batch-2.md`, `-3.md`, `-4.md` | The second, third and fourth batches, all done except what's in section 5. |
| `plan-look-and-sound.md` | The look and sound revamp. |
| `plan-phase7-lore.md` | The story, both paths: done. |
| `plan-playtest-improvements.md` | P1 to P9 from the first playtest: done. |
| `next-session.md` | Notes from the phase 6 and 7 work: done. |

---
