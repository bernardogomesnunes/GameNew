# Duilt: every task in one place

Asked for directly: "We need to be better at keeping our house organised …
a complete task document, with every idea and thing we discussed to do
there listed. This way we can divide the work through different ways. Make
sure we don't forget anything from the past." Then: "I'd like to have one
and only tasks file, and then inside you can divide which ones are for you
or not", and "your work is to document everything that we discussed to do
in that document no more".

**This is the one and only tasks file.** It lists what was asked for or
agreed: in the chat since 6 October, in the owner's lists, and in the old
planning docs. Nothing is added that wasn't discussed. The old planning
docs are in `docs/history/`, for reference only.

## How to read it

- **ID**: use it to talk about a task, in the chat, a commit or a PR.
- **Who**: Claude, Cline (briefs in section 12), or the owner.
- **Status**: *to do*, *waiting* (on the owner), or *done* with its PR.

When something lands: change its status here, with the PR. When something
new is asked for: add it with the owner's words quoted.

---

## Who's on what

**Claude**
- Saving: SAVE-4 to SAVE-6.
- The "Adding changes" list: CRAFT-1 to CRAFT-7, STORE-1, JOBS-1 to
  JOBS-4 and MOBS-2.
- Buildings: LOOK-2.
- From earlier lists: OLD-2 (the rest of it), OLD-3, OLD-4, OLD-7, OLD-8.
- The wiki and the game's words: WIKI-1, COPY-1.
- Under the hood: TECH-1 to TECH-15 (section 11).
- Housekeeping: HOUSE-1, once the owner agrees.
- Reviewing Cline's work when asked.

**Cline** (briefs in section 12)
- Nothing open: CL-1 to CL-14 are done.

**Owner**
- Try things on the phone: section 2 and section 9.
- Answer ASK-1, ASK-3 to ASK-5 (section 10); Battle balance (OLD-5).
- Cline's settings on your computer (HOUSE-3).
- Once there are players: keep the database awake (TECH-16).

---

## 1. Saving

| ID | What | Who | Status |
|---|---|---|---|
| SAVE-1 | **The testing world lost progress** ("Was not able to save my testing world it lost a lot of progress"). Saving works again, tested by the owner on 20 October; before, Save showed "Not saved — try again". | Owner | done |
| SAVE-2 | **A world missing from the account's list is treated as deleted**: saving stops for that session and the backup copy is thrown away. Now the backup is kept, Save says the world wasn't found and can be tried again, and the world is never made again on its own. Deleting a world on purpose still throws its backup away. | ChatGPT | done, #231 |
| SAVE-3 | **"Save and leave" leaves even when the save failed**, without saying so. Now it stays in the world and says why; only a save that went through takes you to your worlds. | ChatGPT | done, #231 |
| SAVE-4 | **Failed uploads retry without telling you.** | Claude | to do |
| SAVE-5 | **The backup copy may not fit** in the browser's small local storage (about 5 MB) for a big world. | Claude | to do |
| SAVE-6 | **The "world too big for the account" message** is on the unmerged branch `claude/backlog-batch-3-update`; the size limits it explains are live in the database since 6 October. | Claude | to do |

---

## 2. Just done: try it on your phone

Checked by tests, most in a test browser, none on a real iPhone.

| ID | What | PR |
|---|---|---|
| NOW-19 | The new mountains, plains and giant trees in old worlds too; the rounder starter house, townhouse and cottages. | #232 |
| NOW-18 | ChatGPT's second round, checked and merged: saving keeps your backup when a world goes missing from the list, Save and leave stays put if the save failed, villagers no longer climb onto roofs, compost into a farm, raiders don't vanish at a pond, huge mountains, broader plains, flatter deserts and three shapes of giant tree. | #231 |
| NOW-16 | ChatGPT's work, finished and merged: deep caves with ruins, caravan camps and mossfolk villages to raid, raided places marked on the map, composting, the Garrison training spear guards, new roof colours for the other buildings, cleaner stone, pink leaves on some birches, more detailed villagers, and Cline's thirteen small tasks. | #230 |
| NOW-17 | A big world opens again: it's fetched and saved a part at a time. | #229 |
| NOW-1 | Storage controller takes things too; on desktop, two-column store pop-ups, pop-ups you can drag, the bag beside them, dragging stacks between them. | #222 |
| NOW-2 | Forging the ring moves you to Age 8 at once; a world stuck at the end of an age moves on as it opens. | #221 |
| NOW-3 | Placing a mine puts it 91 blocks down, with a stair up to the surface. | #220 |
| NOW-4 | Tap a trader (or anyone who talks) where they are on screen. | #219 |
| NOW-5 | The mine's fifth level brings up nightstone as well as sunstone. | #218 |
| NOW-6 | Only the Helix flies; the Plainer glides. | #217 |
| NOW-7 | Roof edges show over the walls too. | #216 |
| NOW-8 | Sunstone at mine level 5; a crop slot more per farm level; meat from every pen; Sort in storehouses. | #215 |
| NOW-9 | Faster start-up. | #214 |
| NOW-10 | Buildings make things only while the game is open; forests you can run through. | #213 |
| NOW-11 | Granary keeps the harvest; hungry villagers named, with Give food. | #208 |
| NOW-12 | Mine building with five levels of ore. | #207 |
| NOW-13 | Plain Save that keeps you in the world; Auto jump in Controls. | #206 |
| NOW-14 | Jump that forgives a slightly early or late tap; Marble Table at Age 4. | #205 |
| NOW-15 | Storybook house, storehouse and market. | #209 |

---

## 3. The "Adding changes" list (20 October)

The owner's list, item by item. None of it is started.

### 3.1 Making blocks

> "Building stuff is only blocks and gathering them is just a crafting
> mechanics. I'd like to change that. I want blocks like stone to have a
> mechanic to craft."

| ID | What | Who | Status |
|---|---|---|---|
| CRAFT-1 | "Quarry will give stone only." (Today it also gives cobblestone, white stone, dark stone and clay.) | Claude | to do |
| CRAFT-2 | "stone marble cobble, coloured stone except turquoise should be obtained by processing the rock." | Claude | to do |
| CRAFT-3 | "To darken we need some kind of forge." | Claude | to do |
| CRAFT-4 | "to lighten we should have some bleach bucket to place them." | Claude | to do |
| CRAFT-5 | "For wood we should have a full carpentry set of tools to do the diff kinds of furniture as a wooden mill is not enough." | Claude | to do |
| CRAFT-6 | "The crafting experience here in the pop up should be slightly different and more interactive." | Claude | to do |
| CRAFT-7 | "To mold and forge weapons we can have the same logic." | Claude | to do |

### 3.2 A storage interface

| ID | What | Who | Status |
|---|---|---|---|
| STORE-1 | "Buildings need a lot of blocks to do. And food and all take a lot of space. We need a third storage item which is called a storage interface. Which is a block that should be placed on top of the storage manager and it allows me to see the list of storages and what they have, and clicking shows me all the items." | Claude | to do |

### 3.3 Villagers who work

> "To make everything more interesting we should have villagers doing
> chores like building, and storing stuff. My idea is to have another
> building right in the beginning that allows to give jobs to villagers.
> This way we can make buildings way bigger."

Today each villager is sent to the nearest building by the game and makes
it produce 50% more; none of them carries or builds anything.

| ID | What | Who | Status |
|---|---|---|---|
| JOBS-1 | A building, right in the beginning, that gives jobs to villagers. | Claude | to do |
| JOBS-2 | Villagers who build. | Claude | to do |
| JOBS-3 | Villagers who store stuff. | Claude | to do |
| JOBS-4 | With villagers building, buildings way bigger. | Claude | to do |

### 3.4 A world at a bigger scale

> "We need to step up our world generation. With big trees, and some big
> mountains we need to reinforce the scale. We need wider and bigger
> mountains and I mean a Kilimanjaro exists from time to time. 1 block is
> 1 meter remember. Plains bigger and deserts flatter. We should add big
> caves, that go deep like mine deep, and have big galleries, with ruins."

| ID | What | Who | Status |
|---|---|---|---|
| WORLD-1 | Wider and bigger mountains, and now and then a Kilimanjaro. (The world is 200 blocks tall.) Wider ranges; in about 4 of every 10 areas of 1,024 blocks, a huge peak 420 to 560 blocks across rising to 174–186 high, never near the start or under the floating island. In every world, old ones too (the owner said yes). | ChatGPT, Claude | done, #231, #232 |
| WORLD-2 | Big trees. Giant trees now come in three shapes, spreading, spire and tiered, up to about 40 blocks of trunk. | ChatGPT, Claude | done, #231, #232 |
| WORLD-3 | Bigger plains, flatter deserts. Plains and deserts about 28% wider, with gentler rises and bigger flat stretches. | ChatGPT, Claude | done, #231, #232 |

In old worlds too: a saved world keeps the chunks you changed and your
claimed land, and makes the rest again from its seed, so the land away from
your builds takes the new shape. Where a kept chunk meets a remade one there
can be a step.
| WORLD-4 | Big caves, as deep as the mine, with big galleries and ruins. One in every 512-block area: a 100-block main hall, an upper hall, a walkable slope down from the surface, and a ruin with pillars and a chest. | ChatGPT, Claude | done, #230 |

### 3.5 Creatures

> "Mobs have weird behaviours, let's make them more natural. Villagers are
> going on roofs from the ground without even jumping."

| ID | What | Who | Status |
|---|---|---|---|
| MOBS-1 | Villagers going onto roofs without jumping. (Found: a villager could step straight up 4 blocks.) Now they step up one block at a time and walk round a wall or house in the way; where there's no way, they give up and stand. | ChatGPT | done, #231 |
| MOBS-2 | More natural behaviour for mobs. In part: "Polish idle and roaming creatures" (ChatGPT, on main since 20 October). | Claude | to do |

---

## 4. Buildings

| ID | What | Who | Status |
|---|---|---|---|
| LOOK-1 | "the houses look squares … the ones I sent have this organic form. also they diversify the textures by using multiple blocks on the walls." Keep the current designs as templates and improve them. The starter house has clipped corners and a hip roof; the townhouse and village cottages have stepped corners (the owner said yes). Already-built houses stay as they are. | ChatGPT | done, #232 |
| LOOK-2 | The two ways the owner suggested for it: "not sure if by level would be feasible, or to have different house types available to build on our building list." | Claude | to do |
| LOOK-3 | "Buildings need rebuilding, they need to fit more the mood and vibe of the mobs whimsical and mystical": the house, market and storehouse (#209); the other ready-made buildings with two-colour roofs and timber trim, the workshop teal and mint instead of slate (approved 20 October). | ChatGPT | done, #230 |
| LOOK-4 | Cleaner stone textures: Stone, White Stone, Dark Stone, Stone Brick. | ChatGPT | done, #230 |
| LOOK-5 | White leaves white, and pink leaves on about 40% of birch trees (approved 20 October). | ChatGPT | done, #230 |
| LOOK-6 | More detailed villagers: collars, cuffs, pockets, boots, hair, aprons and packs on all six settlers and four citizens. | ChatGPT | done, #230 |
| GARRISON-1 | The Garrison trains spear guards instead of making stone and planks (approved 20 October). | ChatGPT | done, #230 |

---

## 5. Open from earlier lists

| ID | What | From | Who | Status |
|---|---|---|---|---|
| OLD-1 | Two or three new peoples to raid. Two: dune caravan camps and mossfolk forest villages, each with guards, a chest and talk. | Batch 4 | ChatGPT | done, #230 |
| OLD-2 | Places you've taken marked on the map; new ones appearing over time. In part (#230): raided places are marked. New ones appearing over time is still to do. | Batch 4 | Claude | to do |
| OLD-3 | Battle mode with AI rivals through an API key, kept on our server. The owner offered their own model server (needs HTTPS, key in an environment secret). | Batch 4 | Claude + Owner | waiting |
| OLD-4 | Battle mode with real multiplayer, inviting friends. | Batch 4 | Claude | to do |
| OLD-5 | Battle balance: how strong rivals feel and how often they come. | Batch 4 | Owner | waiting |
| OLD-6 | Composting: a bin turns seeds and leaves into compost, which speeds a farm or raises its yield. The compost bin, and compost on a growing crop moves it on one stage (#230); "Add compost" in a farm's panel moves all its growing crops on one stage (#231). | Batch 3 | ChatGPT | done, #231 |
| OLD-7 | Mist round the floating island and cloud below it: the one part of the look and sound plan not in the game. | Look and sound plan | Claude | to do |
| OLD-8 | Battle worlds show as "Duilt" in the account's world list. | Batch 4 | Claude | to do |

---

## 6. Cline's queue

Briefs in section 12. One branch and one PR each.

| ID | What | Status |
|---|---|---|
| CL-1 | Two secrets for time travel | done, #212 |
| CL-8 | Bigger buttons on the phone (+8 px) ("button size is too small increase buttons 8 px in size"). Left to Cline as a test. | done, #230 (ChatGPT) |
| CL-9 | "Dress planks" should be Planks; "Split stone" should be Cobblestone. | done, #230 (ChatGPT) |
| CL-10 | The mills open the bench with their name in the search box. | done, #230 (ChatGPT) |
| CL-11 | University studies should say game days. | done, #230 (ChatGPT) |
| CL-2 | Futurians stop pointing you to the Archive once you've read it. | done, #230 (ChatGPT) |
| CL-3 | The Age 12 "Travel to the Past" card says "To the Past". | done, #230 (ChatGPT) |
| CL-4 | Secrets show up the moment you earn them. | done, #230 (ChatGPT) |
| CL-5 | "Know the woods" counts every animal, the Past's dinosaurs too (the owner asked for this). | done, #231 (ChatGPT) |
| CL-6 | Say what tapping a special block does: Travel, Read, Take, Leave. | done, #230 (ChatGPT) |
| CL-7 | The War Standard drawn as a flag on a pole. | done, #230 (ChatGPT) |
| CL-12 | Tap the people counter to feed the hungry. | done, #230 (ChatGPT) |
| CL-13 | Say "granary" where a granary is meant. | done, #230 (ChatGPT) |
| CL-14 | "Put it all in" in a granary says why things stayed out. | done, #230 (ChatGPT) |

---

## 7. The wiki and the game's words

> "Including the wiki … that is not good today, and copy overall that has
> a lot of weird descriptions of elements."

| ID | What | Who | Status |
|---|---|---|---|
| WIKI-1 | The wiki (`docs/wiki/`) brought up to date. It was written on 14 October; time travel, Battle mode, the Plainer and Helix, the mine, the granary and more came after. | Claude | to do |
| COPY-1 | The weird descriptions in the game fixed. Examples as they read today: Stone "Mined from rock"; Marble "Cut and dressed at a workshop"; Gravel "Scraped off the mountainside"; Raw meat "Hunted". | Claude | to do |

---

## 8. Housekeeping

| ID | What | Who | Status |
|---|---|---|---|
| HOUSE-1 | Old branches to delete: `cline-test`, `claude/backlog-batch-3-update` (holds SAVE-6), `claude/debug-overlay` (holds TECH-9), `claude/mob-models-blender`, `claude/stoic-dirac-yky1hi`. | Claude, once the owner agrees (ASK-4) | waiting |
| HOUSE-2 | One tasks file. | Claude | done |
| HOUSE-3 | Cline's settings on the owner's computer (section 12); LM Studio wasn't working. | Owner | waiting |

---

## 9. To try on the phone

Things that exist but haven't been confirmed in a real game. The longer
version is in `docs/history/status-and-testing.md`.

- **Recent:** section 2.
- **Early and middle game:** people talking (settler and trader), rare
  goods at the market, the collection book past 10%, the bow's hemp chain,
  university studies and their skills, barracks and hungry soldiers.
- **Vehicles:** train passengers getting off and on.
- **Late game (Ages 7 to 10):** the temple and devotion; the rings; the
  guardian; the Ten Rounds and the Warlord; the oath and the 1,000
  warriors; the march and the expedition; cutting the chains; the
  disguise; the palace and the Sky King; taxes after a lost attack; both
  endings.
- **After the war:** stealing in a city; city lanterns at night; robbing a
  tree tribe; an outpost's armoury; diamond and ruby gear; killing the god.
- **Time travel:** the machine, the Past, its dinosaurs, taming and eggs,
  the whistle, the Basilisk, the Future, the Archive, futurians, the frame
  rate in the city.
- **Battle mode:** create one; the barracks starts the attacks; beat an
  army; take a city's standard; come back to it.
- **Fixes:** old lanterns in an account world; search pop-ups with the
  keyboard up; the loading screens.
- **ChatGPT's work (NOW-16):** find a cave's mouth, walk down to the big
  hall, open the ruin's chest, climb to the upper hall; a caravan camp and
  a mossfolk village, and robbing them; compost on a crop; training spear
  guards at the Garrison; the bigger buttons.
- **ChatGPT's second round (NOW-18, NOW-19):** find a huge peak and
  the three giant tree shapes; watch villagers walk round houses; Add
  compost at a farm; Save and leave with no signal; build the new
  starter house; look for steps where your old world's land meets the new.

---

## 10. Waiting on the owner

| ID | Question | For |
|---|---|---|
| ASK-1 | Saving works again (20 October). Only if it fails again: reconnect Neon so Claude can read the save failures. | SAVE-1 |
| ASK-3 | The model server for Battle mode's AI rivals. | OLD-3 |
| ASK-4 | Delete the old branches? | HOUSE-1 |
| ASK-5 | Any change to the database itself waits for the owner's yes. | TECH-14 |

---

## 11. Under the hood (the code review of 6 October)

A review of the code, its speed, its safety and how it would cope with many
players was written on 6 October, on a branch that never reached main. Its
first point (size limits on cloud saves) was done that day. None of the rest
was. The review itself is now in `docs/history/analysis-scaling.md`;
re-checked against today's code on 20 October.

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| TECH-1 | **Two devices overwrite each other.** Saving the same world from two devices: the last one wins, chunk by chunk, with no check. Matters as soon as you play one world on phone and computer. | Claude | M | to do |
| TECH-2 | **A world file you import is trusted as it is.** A broken or crafted file could freeze the game. Check its size and contents before loading it. | Claude | S | to do |
| TECH-3 | **A security header for the site** (Content-Security-Policy, set in Vercel's config): only our own scripts and Neon may run or be called. | Claude | S | to do |
| TECH-4 | **Text put on screen escaped by default.** About 70 places write HTML; the ones that show your text are escaped by hand. One helper that always escapes, so a future change can't slip. | Claude | M | to do |
| TECH-5 | **Limit how often a client can write to the database.** | Claude | S | to do |
| TECH-6 | **Make land in the background** (a Web Worker): generating and drawing chunks happens on the same thread as the game, so a slow phone stutters as land streams in. The biggest single gain for phones. | Claude | L | to do |
| TECH-7 | **Smaller first download**: the game loads as one large file (1.4 MB on 6 October, more now). Load the war, story, Sky Kingdom and map code only when needed. Faster start-up. | Claude | M | to do |
| TECH-8 | **Profile a long session and a war round** (30 minutes, a big settlement), fix the top three slowdowns or memory leaks. | Claude | M | to do |
| TECH-9 | **The phone memory overlay** (a counter shown with `?debug`, for finding memory growth on a phone): one commit on the unmerged branch `claude/debug-overlay`. Merge it or drop it. | Claude, Owner agrees | S | waiting |
| TECH-10 | **Split `src/Game.js`** (7,962 lines, from 6,488 on 6 October) by system (war, vehicles, building, input, saving), one part per PR, alongside other work. | Claude | L | to do |
| TECH-11 | **Type checks on the save format and the block list**, to catch the kind of mismatch that once broke saved worlds' mode. | Claude | M | to do |
| TECH-12 | **Automatic browser checks**: load the game, place a block, save, reload, see it's there. The tests today never open a browser. | Claude | M | to do |
| TECH-13 | **Checks on every pull request** (GitHub Actions: the tests and a build), so nothing merges red. There are none today. | Claude | S | to do |
| TECH-14 | **The database at scale**: a player column and index on saved chunks so the security check stays fast with millions of them; a small runner for migrations, and a check the live database matches the code. Needs the owner's yes (ASK-5). | Claude + Owner | M | waiting |
| TECH-15 | **Crash and frame-rate reports** from players' devices, before any public launch. | Claude | M | to do |
| TECH-16 | **Keep the database awake** once there are players (a paid compute that doesn't sleep), or the first save after a quiet spell waits seconds. | Owner | S | waiting |

---

## 12. For Cline: how to work, and the briefs

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

### CL-5: "Know the woods" counts every animal

Done (#231): the owner asked for the Past's dinosaurs to count too, so the secret asks for one of every animal in `MOBS`.

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

## The old planning docs (history)

Moved to `docs/history/`. They're the record of what was asked and how it
was done; nothing in them is open that isn't listed above.

| Doc | What it holds |
|---|---|
| `claude-tasks.md` | The October batch, item by item, with what was done. |
| `cline-tasks.md` | Cline's briefs as first written (now section 12 here). |
| `status-and-testing.md` | Everything asked since batch 4, and the full testing list. |
| `backlog-batch-2.md`, `-3.md`, `-4.md` | The second, third and fourth batches, all done except what's in section 5. |
| `plan-look-and-sound.md` | The look and sound revamp. |
| `plan-phase7-lore.md` | The story, both paths: done. |
| `plan-playtest-improvements.md` | P1 to P9 from the first playtest: done. |
| `next-session.md` | Notes from the phase 6 and 7 work: done. |
| `analysis-scaling.md` | The code, speed, safety and scaling review of 6 October (section 11). |
| `plan-visuals-and-caves.md` | ChatGPT's plan and notes for the caves, stone, leaves and villagers (#230). |
| `plan-world-scale-and-villagers.md` | ChatGPT's plan for the bigger mountains, plains, giant trees and villagers' walking (#231). |

---
