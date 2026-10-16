# Tasks for Cline

Small, self-contained tasks for a new coding agent to try. Task 1 is done
(on the branch `cline-test`, waiting for review). Do **Task 2** next, then
Task 3.

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

## How to report back

Open a PR titled after the task (e.g. "Secrets: Both ways, and Tomorrow's
scholar"). Its body says:

- what changed, in two or three bullets;
- the test result line from `node tests/run.mjs`;
- what you checked, and what you didn't;
- roughly how long it took.
