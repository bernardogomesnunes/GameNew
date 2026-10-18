# Tasks for Cline

Small, self-contained tasks for a new coding agent to try. Task 1 is done
(on the branch `cline-test`, waiting for review). Do **Task 2** next, then
Tasks 3 to 11 in order. Tasks 8 to 11 are quick wins from the owner's
latest list. Each is its own branch and its own pull request.

Each one should take **under 30 minutes**. Task 1 took about 8½ hours,
which is what `.clinerules` now guards against: run only the one test file
while you work, read big files by searching them, and stop to ask rather
than retrying the same thing.

## Cline's settings (for the owner, not the agent)

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

## Before you start

- **The game:** Duilt, a voxel sandbox in plain JavaScript and Three.js. No
  framework, no TypeScript. Config lives in `src/config/`, the world in
  `src/world/`, the main loop in `src/Game.js` (big; search it rather than
  read it).
- **Run it:** `npm install`, then `npm run dev:offline` and open
  `http://localhost:5173`. Offline mode needs no account or database.
- **Tests:** while you work, run only the file you changed:
  `node tests/<name>.test.mjs`. It takes under a second. `node tests/run.mjs`
  runs every test (about 6,900 checks, about 5 minutes); run it once, at the
  end. A test file prints
  `PASS`/`FAIL` lines and exits non-zero on a failure. There's no test
  framework; copy the style of the file you're in.
- **Code style:** match the file you're in. Comments explain *why*, in plain
  English, and often quote what the owner asked for ("asked for directly:
  ..."). Use short names and no new dependencies.

## Rules

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

## Task 1 (done, waiting for review): two secret achievements for time travel

**Why:** the game has hidden achievements called *secrets* (Goals tab, at
the bottom). Time travel was just added (the Past and the Future), and no
secret rewards it yet.

**What to add:** two new entries in the `SECRETS` list in
`src/config/secrets.js`.

| id | name | done when | hint (shown while locked) |
|---|---|---|---|
| `s_both_ways` | Both ways | you've been to the Past **and** the Future | "Backwards, and forwards." |
| `s_archive` | Tomorrow's scholar | you've read the Archive in the Future's university | "Someone, someday, wrote it all down." |

- Pick an icon (one emoji) and an `xpReward` close to the others (150–300).
- Write the `description` as the existing ones do: past tense, one
  sentence, saying what you did.

**Where the facts live** (already saved with the world; nothing new to
store):

- `duilt.time.pastVisited`: true once you've been to the Past.
- `duilt.time.futureVisited`: true once you've been to the Future.
- `duilt.time.futureKnown`: true once you've read the Archive.

They're set in `src/duilt/DuiltGame.js` (search `this.time = {`).

**Watch out:** a `check` gets `{ duilt }`, and `duilt` can be `null`, or a
stand-in **without** a `time` field (the test's `blank()` has none). Use
optional chaining, e.g. `!!c.duilt?.time?.futureKnown`. The existing test
`none are done in a fresh world` will fail if you don't.

**Tests:** add to `tests/secrets.test.mjs`, copying the style of the lines
for the other secrets:

- each new secret is done with the right `time` flags;
- `s_both_ways` is **not** done with only one of the two flags set;
- neither is done on `blank()` (that already runs for every secret, so just
  make sure it passes).

**Done when:**

- `node tests/secrets.test.mjs` passes, with your new checks in it;
- `node tests/run.mjs` ends `0 failed`;
- (A browser check was asked for here. It isn't needed for tasks like
  this; the tests cover it.)

**Don't:** add new saved state, change `time` or `DuiltGame`, or make a
secret one of an age's goals.

---

## Task 2 (next): futurians mention the Archive only until you've read it

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

## Task 3: the Age 12 "Travel to the Past" card is out of date

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

## Task 4: secrets show up the moment you earn them

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

## Task 5: "Know the woods" counts only the animals of home

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

## Task 6: say what tapping a special block does

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

## Task 7 (a bit bigger): the War Standard as a flag on a pole

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

## Quick wins from the owner's new batch (Tasks 8 to 11)

From the owner's list of improvements (October). Each is small and
self-contained. Same rules: one branch and one pull request each.

---

## Task 8: bigger buttons on the phone

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

## Task 9: recipe names say what you get

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

## Task 10: the mills open the bench with an empty search box

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

## Task 11: university studies say "game days"

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

## More from building the granary (Tasks 12 to 14)

Small code changes noticed while the granary was built (#208). Each was
checked in the code before it was written down. Same rules: one branch and
one pull request each.

---

## Task 12: tap the people counter to feed the hungry

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

## Task 13: say "granary" where a granary is meant

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

## Task 14: "Put it all in" in a granary says why things stayed out

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

## How to report back

Open a PR titled after the task (e.g. "Secrets: Both ways, and Tomorrow's
scholar"). Its body says:

- what changed, in two or three bullets;
- the test result line from `node tests/run.mjs`;
- what you checked, and what you didn't;
- roughly how long it took.
