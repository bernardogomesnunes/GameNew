# Analysis: code, performance, security and scaling

Read from the code at commit 1c77776 (PR #131). Numbers marked "measured" were run in this session. The rest comes from reading the code. No frame-time profile was taken, because a headless container has no GPU.

## Verdict

The game is a client-only app with a small, well-guarded cloud layer. Cloud cost and security scale well. The limits are in three places: one 6,488-line `Game.js`, meshing and simulation on the main thread, and a 1.4 MB single JS bundle.

## What it is

- 47,164 lines of JS in `src/`, 188 test files, 2 runtime dependencies that matter (`three`, `simplex-noise`) plus the Neon SDK.
- No server of ours. The browser talks to Neon Auth and the Neon Data API (PostgREST) with the user's JWT.
- Worlds are endless and generated from a seed. Only chunks a player touched are saved (`Chunk.touched`).
- Sync uploads only changed chunks (FNV-1a hash per chunk, run-length encoded, `SyncEngine.js`).

## Security

Strong points:
- No service key in the bundle. `VITE_NEON_URL` is a public URL and grants nothing alone.
- Row-level security on every table (`players`, `worlds`, `world_chunks`, `progression`, `templates`, `save_failures`), keyed on `current_player_id()`. A stolen bundle can only ask questions the database refuses.
- User text is escaped in the home screen (`escapeHtml`, `escapeAttr`). No `eval` or `new Function` in `src/`.
- Schema changes are numbered files in `migrations/`, with a test (`schema-contract.test.mjs`) that checks the app against them.

Gaps, most serious first:
1. **No size limits on cloud rows.** `world_chunks.rle` is `bytea` and `worlds.duilt`, `economy` and `progression.stats` are `jsonb`, all unbounded. One account can write gigabytes. Fix: `check (octet_length(rle) <= 262144)` (worst case is 153,600 bytes: 51,200 cells at 3 bytes a run, height 200) and `pg_column_size` checks on the jsonb columns, plus a per-player world cap (for example 20) through an insert policy.
2. **No rate limiting.** The Data API accepts as many writes as a client sends. Fix: Neon plan limits plus a per-player row cap, and a debounce check in `SyncEngine` (autosave already throttled in PR #129).
3. **World import trusts the file.** `parseWorldPayload` checks only a format string, then `World.deserialize` runs on the rest. A crafted `.voxworld.json` can allocate huge arrays or load unknown block ids. Fix: validate sizes, chunk counts and ids before allocating, and cap file size.
4. **No Content-Security-Policy.** `index.html` has none. Fix: a CSP header on Vercel allowing only self, the Neon hosts and `data:` images. This limits the damage of any future XSS.
5. **70 `innerHTML` sites.** The ones read are escaped. Spots like `HomeScreen.js:356` and `:387` interpolate `k.name` and `kind.name` from config, which is safe today. Any later change that feeds user text there is an XSS. Fix: one lint rule or a `html` tagged-template helper that escapes by default.
6. **Cheating is possible and does not matter.** XP, achievements and inventory are client-written. This is fine while worlds are private. It becomes a real problem the day there is a leaderboard or shared world, which needs server-side checks first.
7. **`players.device_key` and local saves** hold no secrets, but `localStorage` saves are readable by any script on the origin. Another reason for the CSP.

## Performance

Measured:
- `vite build` takes 1.95 s. Main chunk `index-*.js` is 1,423 kB (430 kB gzip), plus a 352 kB `three` chunk (88 kB gzip). Vite warns above 500 kB.

From the code:
- **Meshing runs on the main thread**, budgeted per frame (`drainRemeshQueue(6 ms)`, raised to 9 ms when 60 chunks wait, `generateQueued(4 ms)`). It avoids long frames but caps how fast the world streams in, and any slow phone drops frames before the budget helps. No Web Workers exist in `src/`. A worker for generation and meshing is the biggest single gain.
- Chunk meshing is already tuned: per-id lookup tables, a padded copy per chunk, baked vertex shading and ambient occlusion, geometry freed on dispose.
- Adaptive resolution (1 to 2) and fog distance (120 or 260) exist in `graphics.js`. Good for weak phones.
- Per-frame simulation (mobs, settlers, war, fireflies, clouds) all runs in `Game.js`'s loop on one thread. At war scale (1,000 warriors, 30 on the ground) this is the likeliest frame-time spike. Needs a profile.
- Far terrain and the loading screen were reworked in PRs #127 to #131, so start-up cost is already improved.
- Memory: a white-screen crash from graphics memory was fixed in PR #125 by cutting use to a third. Chunk eviction exists (`World.js:363`), but whether every mesh, texture and view object is released on eviction and on leaving a world needs a heap-snapshot test over a long session.

Fixes, by payoff:
1. Move chunk generation and meshing to a Web Worker, transfer typed arrays.
2. Code-split: load the war, sky kingdom, story, lore and world-map code on demand with `import()`. Target a first-load JS under 500 kB.
3. Profile a 30-minute session in Chrome (Performance and Memory tabs) at a large settlement and during a war round, then fix what shows up.
4. Batch the many small `InstancedMesh` and view objects where draw calls pass about 300.

## Code health

- `Game.js` is 6,488 lines and `UIManager.js` 2,582. They wire everything together, so every feature touches them, merge conflicts are likely, and the test files cannot load them without the whole game. Split `Game.js` by system (war, vehicles, building edit, input, save) behind the existing `EventBus`.
- `DuiltUI.js` (1,783), `DuiltGame.js` (1,700) and `config/structures.js` (1,501) are the next-largest.
- Plain JS, no types. A `// @ts-check` pass with JSDoc on the save format and the block registry would catch the drift that already broke `worlds.mode` once.
- Tests: 188 files cover logic well (combat, saves, sync, crops, war). None cover rendering, input or the browser. Add a few Playwright smoke tests (the dependency is already installed): load the game, place a block, save, reload, confirm.
- Test suite (measured): 5,194 checks pass, 0 fail, across 187 files. The run takes over 5 minutes in this container, so parallelising `tests/run.mjs` would shorten CI.
- No CI file in the repo (`.github/workflows` absent). Add one: install, `npm test`, `vite build`, on every PR.

## Scaling the cloud side

- Cost per player is low: a few dozen touched chunks of a few KB each, one `worlds` row per world.
- `world_chunks` has a composite primary key (`world_id, cx, cz`) and the RLS policy runs `exists (select ... from worlds)` on every row. At millions of chunks this subquery is the first thing to slow. Fix: add `player_id` to `world_chunks`, index it, and check it directly.
- Neon cold starts are already handled by `keepTrying`. Keep a paid compute with no scale-to-zero once players exist, or the first save after idle waits seconds.
- Migrations are applied by hand. Add a small runner and a CI check that the live schema matches `db/schema.mjs`.
- Conflict handling: `revision` columns exist. Two devices editing one world at once would overwrite each other's chunks unless the push checks the revision. `SyncEngine` sets `revision: Date.now()` and `NeonTransport` writes it back without a condition, so the last writer wins. Add a conditional update (`revision=eq.<seen>`) before shared or multi-device play.
- No telemetry beyond `save_failures`. Add crash and frame-time reporting (an error boundary report, and a p95 frame-time sample per session) before a public launch.

## Suggested order

1. Cloud limits (security gaps 1 to 3), one migration and one validator, small and urgent.
2. CI with tests and build, plus a Playwright smoke test.
3. Profile a long session and a war round, fix the top three findings.
4. Web Worker for generation and meshing.
5. Code-splitting.
6. Split `Game.js` gradually, one system per PR, alongside feature work.
7. `world_chunks.player_id` and revision checks, before multi-device or shared worlds.
