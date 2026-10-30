# Performance checks

The goal is to catch content whose rendering, streaming or resource cost grows
unexpectedly before it ships. Keep gameplay, saved chunks and player settings
intact. Automated desktop/SwiftShader results do not certify phone performance.

Implementation plan (approved scope from the performance discussion):

- [x] Reproduce the sealed-cave corner classification bug and check chunk/crowd
  resource disposal; fix only demonstrated failures.
- [x] Add deterministic terrain, cave, forest, settlement and crowd fixtures.
  Measure visible triangles, geometry buffers, draw calls and generation/mesh
  timings. Gate structural costs; report hardware-dependent timing separately.
- [x] Give streaming generation, remeshing and distant terrain a shared work
  allowance during play. Keep loading-screen throughput and worker fallback.
- [x] Exercise real WebGL uploads, rebuilds and repeated scene disposal in an
  isolated browser. Record context losses and resource counts.
- [x] Add commands and CI checks, save reports, run relevant tests and build,
  then review. Keep the full suite's unrelated failures visible.

Review focus: sealed caves on chunk boundaries; edits made during worker jobs;
long sessions and world changes; expensive single chunks that cannot be
preempted; hardware differences and explicitly chosen graphics settings.

No dependencies, production telemetry, per-frame logging or automatic uploads
are needed. Use existing Three.js, Node and Playwright. Work in the current
checkout and preserve other sessions' changes. Physical-phone verification
remains a release check: explore peaks/caves/forests, build, save/reopen, then
travel for 15 minutes and confirm no sustained slowdown or Reload screen.

## Running and reading the checks

Run `npm run test:performance` for fixed-seed terrain costs and a 24-animal
simulation. Run `npm run test:performance:browser` after installing the project's
Playwright Chromium (`npx playwright install chromium`). An installed Chrome can
also be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The browser server
ignores environment files and blocks requests to external hosts.

Reports go to `artifacts/performance/node.json` and `browser.json`. The browser
test draws actual terrain and the cow GLB, including an underground viewpoint,
then repeatedly rebuilds and disposes meshes. A context loss or growth in
geometry/texture/live WebGL-buffer counts after disposal fails the check.
Every disposal cycle is checked against the warmed baseline, including
intermediate cycles. Missing scenes, incomplete cycles and invalid or missing
counters fail validation; an incomplete browser report cannot produce a pass.
Buffer creation/deletion is instrumented only in the test, since geometry
counts alone cannot detect leaked instance buffers. These are allocation
counts, not a measurement of available GPU bytes. CPU geometry buffer sizes are
recorded separately; GPU/driver overhead is not included in them.

`tools/performance/budgets.json` gates geometry counts/bytes and draw calls. The
terrain caps allow roughly 25% headroom over this reference run:

| Scene (seed 4242; 9 meshed chunks + neighbour ring) | Surface triangles | All geometry bytes | Meshes |
|---|---:|---:|---:|
| Peak (-2521, -2720; height 181) | 5,318 | 20,815,392 | 34 |
| Range slope (-2521, -2584; height 134) | 10,774 | 9,150,336 | 36 |
| Giant forest (-744, 600) | 48,032 | 13,906,308 | 27 |
| Gallery (340, 781) | 20,384 | 8,325,408 | 36 |
| Starter settlement | 9,942 | 7,884,552 | 29 |

The connected-range terrain update changed the original peak coordinate into
a slope. Keep that original window as `range_slope` and add a fixed high crest
as `peak`; the crest fixture fails if its height falls below 170. The updated
peak surface cap is 6,700 triangles; its 26.5 MB geometry and 40-mesh caps stay
unchanged. The added slope caps are 13,500 surface triangles, 11.5 MB and 45
meshes. Forest, cave, settlement and browser caps remain unchanged. This
rebaseline accounts for intentional terrain changes and retains both windows.

These are small representative windows, not whole-view-distance guarantees.
The Node report includes all deep geometry; the browser also checks how much is
actually submitted from its two camera positions. Times are reported rather
than used as universal pass/fail values: CI hardware and software-rendered
Chromium cannot establish iPhone FPS. `renderSubmitP95Ms` measures CPU render
submission, not completed GPU time or full-game frame time. Compare timings on
the same device, using several runs.

Do not raise a budget just to make a failing change pass. Explain the content
cost, check the affected scenes on a phone, and review the new limit. The
workflow runs independently of the unit-test job so unrelated unit failures do
not prevent performance measurements. Its stable job name is `Performance
budgets`; it also supports manual dispatch. Main's branch protection requires
that GitHub Actions check and an up-to-date branch, including for administrators
(verified through the repository API on 21 October 2026).

## Runtime changes and limits

The sealed-cave corner fix and height-120 ordinary-cave limit come from Claude's
956e201 fix. Saved chunks retain their blocks. Newly generated high mountain
rock has fewer ordinary caves; the deep-gallery path is checked before the
limit. Cached model kits retain shared geometry/materials, while discarded
crowds now release their own instance buffers.

During play, generation, remeshing and the distant landscape share up to 8ms of
scheduled work, further limited by elapsed time against a 60Hz frame target.
They rotate priority to keep progressing under load. An individual chunk/tile
cannot be interrupted: the allowance is a soft limit, and at most one stage
gets minimum-progress permission after the allowance is exhausted. Loading
screens retain their existing higher throughput. Initial far tiles respect an
explicit play budget instead of silently building the entire horizon at once.
Existing graphics settings and automatic resolution control remain available.
This change does not automatically lower player-selected detail settings.

## Measured comparison

In the original nine peak chunks, comparing the terrain/mesher before the cave
fix against that fix (before the connected-range terrain update), surface
triangles fall from **274,506 to 2,012**. Deep
triangles change from 122,006 to 267,566: the classifier correctly moves sealed
caves out of the distant surface mesh. Total triangles also decrease, from
396,512 to 269,578, because new high rock is no longer carved throughout.
This is a geometry comparison, not a claim about full-game FPS. Reproduction
results are in the local `artifacts/performance/comparison.json` report.

The browser smoke test passes its full path: deferred assets, load, place,
save, reload, reopen, rejected imports preserving the open world, and a valid
real-world export/import. Story text is imported separately from its deferred
illustrations, resolving the earlier eager-import failure.

## Verification, 21 October 2026

- `npm run test:performance`: passes (safety regressions, actual streaming
  methods, fixed terrain budgets, 24-animal simulation).
- `npm run test:performance:browser`: passes (surface/underground terrain,
  actual cow GLB, repeated rebuild/disposal, no context loss or resource growth).
  Deliberately omitting instance cleanup in the test harness makes this check
  fail on WebGL-buffer growth; restoring the harness passes again.
- Production build: passes; the existing large-bundle warning remains.
- Latest full suite on the integrated main plus gate hardening: **7,516 passed /
  0 failed across 288 files**. Full output:
  `artifacts/performance/gate-full-suite.log`.
- GitHub Actions: `Performance budgets` passed on PR #234; main's required
  status check is configured with the GitHub Actions app identity.
- Focused independent review: no remaining actionable findings after fixing
  the long-queue allowance override, zero-budget far-tile starvation, and
  incomplete instance-buffer accounting in the initial harness.

Runtime safeguards and the report-validation/terrain-fixture follow-up are
integrated into main. Physical-phone testing
and the separate 30-minute settlement/war profiling task remain open; these
automated checks cannot guarantee that future content will never cause a
performance problem.

## Full-game rendering and failure diagnosis, 23 October 2026

The owner reports substantial lag and the game's Reload screen on both an
iPhone and a Windows PC with a 16 GB dedicated GPU. A weak phone GPU does not
explain both reports. A bounded two-minute full-game experiment used Chrome's
actual Radeon RX 7900 GRE backend at 1280×720, pixel ratio 1 and antialiasing.
It visited settlement, mountain, forest and cave locations, then travelled.
The forest submitted about 2.5 million triangles per frame. Travel included a
420 ms frame, almost entirely in renderer submission; this is CPU submission
time, not completed GPU time. No Reload, game error or context loss occurred.
The original failure's cause remains unconfirmed; this run does not cover
long-session growth or certify iPhone performance.

Covered far-terrain tiles now skip draw submission when every part, including
their outer walls, is already discarded by the real-chunk shader mask. Tiles
remain reusable and become visible as coverage is lost. This preserves viewing
distance and detail. Geometry buffers remain resident, so this change reduces
draw/vertex work rather than the memory occupied by those buffers.

Run `node tests/full-game-rendering-browser.mjs` for the full-game comparison.
It constructs the actual 802-chunk forest scene using the game's streaming
methods, then compares the old and optimized rendering of one frozen frame.
The default SwiftShader reference is **759 → 744 draw calls**, **2,494,218 →
2,351,206 triangles** (143,012 fewer, about 5.7%), and **zero changed pixel
channels**. A Radeon comparison also produced identical pixels and the same
triangle reduction. Set `PERFORMANCE_USE_HARDWARE=1` to use Chrome's default
graphics backend. These are rendering-equivalence checks, not sustained FPS
measurements or a replay of the owner's failure.

The required Performance budgets workflow now includes this check and writes
`artifacts/performance/full-game-rendering.json`. Its separate `fullGame` caps
are 1,000 draw calls, 3,100,000 triangles and 280,000,000 CPU geometry-buffer
bytes, roughly 25% above the reference scene (223,929,318 bytes). Existing
small-scene budgets remain unchanged. These CPU buffer sizes exclude textures,
driver copies and other GPU allocations; they do not measure total VRAM.

Caught frame failures now enter bounded local diagnostics with redacted stacks,
including failures before the first successful frame. A fatal snapshot records
the failure kind, cached graphics backend, pixel ratio, chunk/queue counts and
renderer counters. Context loss is identified separately and no longer claims
that a phone ran out of memory. The Reload screen offers **Download diagnostics**
so the report remains accessible after a stop. Collection is best effort and
cannot prevent the existing stop/save recovery; reports are downloaded locally
and are not uploaded automatically. Run `node tests/crash-diagnostics-browser.mjs`
to verify actual caught errors, graphics-context loss and a failure inside
diagnostic collection, including saving the world.

Next evidence needed: a diagnostic report from the owner's actual failure,
physical-iPhone testing and longer sessions crossing autosave. An engine or
native-app migration has not been chosen; these measurements do not establish
that a migration would remove the underlying failure.

Local verification on the PR #239 implementation: **7,550 passed, 0 failed
across 292 test files**, production build, Node performance budgets, browser
resource budgets, full-game comparison, crash recovery, inventory search and
Storage Remote all pass. The existing browser smoke test timed out once at its
file picker while other browser checks ran, then passed on an isolated rerun.
The production build retains its existing large-bundle warning. Independent
review has no remaining blockers after adding diagnostic-failure isolation.

## Streaming hot paths and sustained profiling, 24 October 2026

PR #241 keeps grass decoration inside normal terrain streaming. Sampling an
unloaded mountain must not call the world's generating accessors; the next
regular grass scan picks up chunks after worker arrival. Loaded-world tuft
transforms/colours and finite-world behaviour remain unchanged. Bulk unload
now sweeps sparse light/smoke records once instead of scanning every block in
each dropped chunk. The minimap keeps one terrain grid for the current
generator, position and sampling settings; turning or resizing still repaints.
These changes preserve detail, density, radius and view distance.

Focused comparisons imported the actual modules from baseline `838fd99` and
the implementation on this branch in the same process:

| Workload | Before | After | Preserved result |
|---|---:|---:|---|
| Unloaded mountain grass scan | 298.38 ms; 12 generated chunks | 0.43 ms; 0 generated chunks | 0 visible tufts |
| Drop 612 chunks | 67.19 ms | 0.78 ms | Same chunks dropped; same 13 retained lights |
| 10 stationary minimap updates | 113.78 ms; 40,960 samples | 13.13 ms; 4,096 samples | Same terrain pixels; heading repainted |

These are individual probes, not sustained FPS guarantees. Regression tests
cover terrain arriving normally, negative coordinates, touched chunks,
world/position/settings invalidation and canvas resize. The browser rendering
comparison still produces identical pixels.

Run `node tools/performance/profile.mjs` for a **30-minute** offline full-game
profile. It ignores environment files, blocks external requests and builds a
fixed-seed fixture through the actual design/claim/population systems: 56
validated buildings, 55 villagers and eight hauler assignments. Six phases
exercise settlement, live war actors, travel, return, verified underground
air with actual deep draws, and recovery. The observer flies and is healed/fed
between samples; normal simulation systems remain enabled. This is a
repeatable stress workload, not a replay of the owner's saved world.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an installed Chrome. The default
requires a hardware backend. `PROFILE_ALLOW_SOFTWARE=1` explicitly selects
SwiftShader for debugging; it cannot establish device performance.
`PROFILE_DURATION_SECONDS` (30–3600) and `PROFILE_SAMPLE_MS` (at least 1000)
allow shorter harness checks. Short runs do not certify the 30-minute task.
`PROFILE_REPORT` changes the JSON output path; the default is
`artifacts/performance/long-session.json`. Reports include revision, browser,
effective graphics settings, frame histogram, method CPU costs, resources,
actual population/war activity and persistence results. Source geometry bytes
are not VRAM, and renderer method duration is CPU submission time, not GPU
completion time. Nested method times overlap and must not be added together.

Validation rejects incomplete runs, missing workload/configuration evidence,
stops, context loss, invalid counters and failed persistence. A save attempt
returning false or throwing is a failure. Runs of at least ten minutes must
also restore a newer persisted timestamp after a successful autosave. A failed
initial save is retained in the report while the workload continues, then the
process exits unsuccessfully; a completed duration is not a clean pass.

The developed local fixture exposes `QuotaExceededError`: its first payload
contains roughly **14 million characters**. The existing cloud-backup spill
to IndexedDB (SAVE-5) does not cover `LocalWorlds`, which still saves its whole
world synchronously to localStorage. No quota override or reduced fixture is
used to hide this. Save capacity and synchronous autosave work remain part of
the TECH-18/TECH-8 investigation; this finding does not identify the cause of
the owner's Reload screen.

The corrected run on `77f2ca2db90da67f5dced777694578e6fdf6ffcc` completed
**1,800.059 seconds** in Chrome **155.0.8059.80** on the actual Radeon RX
7900 GRE / ANGLE D3D11 backend, WebGL 2 with antialiasing. Viewport was
1920×1080, pixel ratio 1; all graphics options were enabled/automatic, with
effective render distance 234. Setup/warmup preceded the timed workload.
All 180 ten-second samples retained 56 buildings and 55 villagers in actual
playing state. Eight live war attackers were observed; the cave viewpoint was
at (324.5, 12, 789.5), below surface height 103, with verified air/headroom and
deep-mesh submissions. No page error, context loss or Reload occurred.

The run **failed persistence validation**. Its initial save hit the native
quota with 14,034,781 characters, and all six subsequent scheduled saves
returned failure. Successful saves: **0**; restored final world: **none**.
The profiler exited with status 1 for those persistence failures. This is a
completed duration with a failed result, not a clean performance sign-off.

| Measurement | Observed |
|---|---:|
| Frame intervals | 107,349 |
| Histogram upper bounds, p50 / p95 / p99 | 17 / 17 / 20 ms |
| Maximum frame interval | 2,308.3 ms |
| Intervals at least 50 / 100 / 250 ms | 15 / 9 / 5 |
| Largest synchronous save | 2,301.3 ms |
| Renderer CPU submission, cumulative / maximum call | 405.35 s / 741.8 ms |
| Simulation tick, cumulative / maximum call | 38.06 s / 36.8 ms |
| Remesh queue draining, cumulative / maximum call | 27.38 s / 21.7 ms |
| Maximum sampled draw calls / triangles | 954 / 2,746,396 |
| Maximum sampled CPU geometry buffers | 252,963,126 bytes |

Histogram values have 1 ms bins, with intervals of 2,000 ms or longer in the
final bin; the separately recorded maximum retains their actual duration.
The shader/model setup, operating system, garbage collection and profiler
instrumentation affect timings; these numbers are one desktop run, not an
FPS promise or evidence of GPU completion times. Cumulative method times are
nested; simulation includes settlers and the frame includes rendering.

| Phase end | Loaded chunks | CPU geometry MB (decimal) | Textures |
|---|---:|---:|---:|
| Initial settlement sample | 822 | 214.19 | 29 |
| Settlement | 822 | 214.21 | 33 |
| War | 822 | 214.25 | 37 |
| Travel | 1,505 | 206.02 | 45 |
| Return home | 847 | 222.11 | 45 |
| Underground | 1,238 | 197.27 | 47 |
| Final recovery at home | 797 | 220.38 | 47 |

The home views settled rather than continuing to grow during their stationary
windows. The final home geometry allocation was about 6.2 MB above the initial
one; different assets were loaded during travel/war. This single cycle cannot
establish that every retained resource is necessary or rule out longer-term
growth. CPU voxel buffers, textures and driver allocations are outside the
geometry-byte measurement. Raw local evidence is in
`artifacts/performance/long-session-reviewed.json`, with the console log and
`long-session-reviewed-summary.json` alongside it.

The two away-from-home saves took **2,230.4 ms** and **2,301.3 ms**; home saves
took roughly 162–186 ms. Source inspection shows that
`LocalWorlds.save → World.serialize({keepBounds}) → getChunk` can generate
missing claimed terrain synchronously before RLE/JSON/storage work. Chunk
counts jumped on the away saves. The next investigation should count those
fills and split snapshot/encoding/write durations, then bound preparation and
provide reliable large-local-world persistence while preserving claimed land
and existing save compatibility. Rendering submission/upload and individual
remesh spikes remain separate follow-ups; the original owner Reload and
physical-iPhone performance remain unverified.

On this exact runtime/tool/test revision, CI reports **7,583 passed, 0 failed
across 297 files**; build, gameplay/browser recovery, inventory search,
Storage Remote and both performance gates pass. Local browser resource budgets
and the full-game comparison also pass (**761 → 746 calls**, **2,494,710 →
2,351,698 triangles**, identical pixels). Existing budget caps are unchanged.
Only documentation changed after the measured/CI-tested revision.

## Background local saves, 25 October 2026

PR #242 addresses #241's observed local-storage quota failure and 2.3-second
autosave stalls. The game captures owned binary copies of loaded edited and
claimed chunks, then transfers those copies to a dedicated worker. Missing
claimed terrain is prepared there, reusing previously committed terrain while
the generation settings match. Whole-world RLE and JSON are absent from the
normal gameplay save path. IndexedDB commits the binary payload and its small
directory row in one transaction. Rendering settings, terrain detail, draw
distance, exports and cloud formats are unchanged.

The worker processes one operation at a time and retains at most one pending
save snapshot; repeated same-world saves replace that pending snapshot and
wait for its newer commit. Deletes and loads remain ordered. Failed writes
retain the previous payload and directory. Legacy localStorage records remain
readable, with newer records winning over an older background commit; an
IndexedDB replacement removes only the legacy version it supersedes.
Migration cleanup checks that the uploaded local version has not changed.

`saveNow()` retains its accepted-work boolean. `Game.saving` confirms the
actual commit, and Save and leave, crash recovery and world switches wait for
that confirmation. A pending write is not reported as saved. New binary
records restore blocks, surfaces, biomes and lights directly; old RLE worlds
and finite maps still load. Worker-disabled browsers use the same database
through a yielding fallback; browsers without IndexedDB retain the existing
synchronous legacy path. Denied storage is reported without blocking healthy
cloud worlds or pretending a modern world was deleted.

Browsers may stop workers during navigation or mobile suspension. The
existing synchronous best-effort legacy checkpoint, including shared XP and
achievements, therefore remains on hidden/pagehide/beforeunload. That path can
still stall during departure and is still limited by localStorage quota.
The last committed IndexedDB world remains intact when it cannot fit.
Immediate termination of a large, uncommitted save cannot be guaranteed;
physical-iPhone lifecycle verification remains open. Background-save gains
reported below apply to normal playing/autosave work.

Run `node tests/local-save-browser.mjs` for real storage checks. The test
covers a 256-chunk claimed world, continued main-thread task processing,
fresh-page discovery/restore, legacy migration, competing versions, atomic
abort, bounded rapid saves, delete ordering, denied storage and worker-disabled
fallback. The required Performance budgets workflow runs it alongside the
existing unchanged terrain/rendering budgets. Interval heartbeats are reported
as diagnostics; task ordering verifies responsiveness without relying on
background-tab timer scheduling. The ordinary game smoke checks an edit made
after the previous committed save survives immediate navigation.

### Measured follow-up and remaining limits, 26 October

Exact runtime/tool/test revision `9ec1d92` passed **7,606 tests, 0 failures
across 299 files**, the production build, gameplay browser checks and the
required Performance budgets workflow. Final changes after that revision
only document results. The existing large-bundle build warning remains.
The local full-game comparison produced identical pixels with 751 → 736 draw
calls and 2,494,026 → 2,351,014 triangles; no performance caps were raised.

`artifacts/performance/background-save-session-final.json` records a completed
**660.01-second** hardware run on a Radeon RX 7900 GRE, WebGL 2/ANGLE D3D11,
1920 × 1080, pixel ratio 1, automatic graphics and render distance 234. It
retained 56 buildings and 55 villagers through settlement, live war (up to
eight attackers), travel, return, underground caves and recovery. It measured
39,401 frames, including 32,840 war frames, with no game stop, page errors,
context losses or validation failures. Both scheduled autosaves committed;
the newer persisted world restored successfully.

| Measurement | #241 baseline | #242 follow-up |
|---|---|---|
| Normal autosave game-thread work | Up to 2,301.3 ms; saves failed | 3.9 / 15.2 ms; both committed |
| Asynchronous commit latency | No successful local persistence | 155.3 / 106.4 ms |
| Longest frame | 2,308.3 ms | 747.4 ms |
| Session length | 30 minutes | 11 minutes |

These are dated runs, not a controlled claim about every future world or
device. The final run had five frames above 50 ms, three above 250 ms; frame
histogram p95 was at most 17 ms and p99 at most 21 ms. Renderer submission
still reached 709.7 ms, and remesh draining 30.1 ms. Loaded chunks ranged from
797 to 1,146; sampled terrain geometry reached 243.31 MB (CPU buffer bytes,
not total GPU memory), returning to 797 chunks and 220.39 MB. Textures reached
49. Submission/upload/meshing costs still require investigation. Repeat the
full 30-minute scenario on this pipeline and test real iPhone suspension and
rendering. The owner's original Reload has not been reproduced or certified
fixed, and forced termination of an uncommitted large save remains limited
by the best-effort lifecycle fallback described above.

## Render scheduling and recovery, 30 October 2026

PR #256 repairs a regression in #251's shader warm-up guard. Three.js updates
transparent DoubleSide material versions during its own back/front passes.
The guard interpreted those updates as new shader work and repeatedly withheld
rendering, even though the simulation continued. A fixed-scene FlameView
regression reproduces this without changing gameplay, lights or geometry.

Warm-up now gates only the initial draw of a graphics context, for at most
500 ms; completion, rejection or that deadline opens the ordinary render path.
New materials, lighting changes, disposal and streaming cannot close it again.
Context restoration gets a new bounded pass and ignores stale completions.
The per-frame scene traversal, signatures and material listeners are removed.
Material sides, transparency, lighting, view distance and shader diagnostics
are preserved. The deadline bounds this scheduling guard, not time spent
inside a driver call; later first-use shader stalls can still occur.

The local one-minute diagnostic comparison used the same fixed-seed workload,
Radeon RX 7900 GRE, ANGLE D3D11/WebGL 2, 1920 × 1080 and automatic graphics.
The before run used main `48e6379` game code; the repair was subsequently
committed as `c76a5b3`. Both runs include settlement, live war, travel, return,
caves and recovery. They are short diagnostics, not sustained certification.

| Measurement | Before | Bounded initial warm-up |
|---|---|---|
| Actual renderer calls | 1,364 | 3,485 |
| Maximum gap between renderer calls | 8,115.6 ms | 715.8 ms |
| Maximum game-loop frame interval | 122.4 ms | 750.9 ms |

The old loop interval hid seconds without a new image. The repaired renderer
delivers frames again, while its ordinary first-use driver stall is visible
in the measurements. Neither counter measures physical monitor scanout or
GPU execution time. The final long-session profiler therefore records actual
draws in every phase and samples time since the last draw, including a freeze
that never resumes. It rejects missing drawing evidence and gaps above one
second. This is a freeze guard, not an FPS target. Historical reports without
these counters do not establish that presentation was continuous.

Two related recovery defects are fixed: Sky anchor-chain hover used an
unqualified function after its module became deferred, and optional-feature
Reload proceeded even when saving failed. Hover is safe before and after
Sky readiness. A playable world now reloads only after confirmed persistence;
false/rejected saves keep its live edits open. Title/showcase/scenery and
deliberately discarded sessions remain reloadable without inventing a save.

Failing-first Node checks cover material-version churn, deadlines, restoration,
stale completions, failure fallbacks, actual Game hover, save confirmation and
unfinished render gaps. Browser checks cover 30 real renderer draws with
FlameView, world placement/save/reopen/import, delayed/failed optional loading,
and a failed save followed by an actual successful reload/reopen retaining
the latest edit. The new renderer and recovery browser checks run in CI.
Local full regression passed **7,699 checks across 315 files**, build and
unchanged performance/resource budgets. The full-game comparison retained
identical pixels (761 → 746 calls; 2,494,578 → 2,351,566 triangles).

### Completed sustained desktop run

`artifacts/performance/30-oct-sustained-final.json` records **1,800.016 seconds**
on exact runtime/profiler revision `8d1d3a3`, Chrome 156.0.8078.49, Radeon
RX 7900 GRE through ANGLE D3D11/WebGL 2, 1920 × 1080. Pixel ratio stayed 1;
automatic graphics, render distance 234, antialiasing, smoothing, lights, AO,
atmosphere and grass were retained. Later changes only adjust the CI fixture
and document results; the game and profiler are identical to that revision.

The workload retained **56 validated buildings and 55 villagers** through six
five-minute phases: settlement, live war (up to eight attackers), travel,
return, verified underground caves and recovery. It recorded **107,747 loop
intervals and 107,748 renderer calls**, about 59.86 draws/second overall, with
actual drawing in every phase. There were **zero validation failures, page
errors, game stops or context losses**. Maximum render gap was **717.6 ms**;
maximum loop interval 750.0 ms, histogram p95 at most 17 ms and p99 at most
18 ms. Twelve intervals exceeded 50 ms; three exceeded 250 ms. These remaining
stalls are visible evidence, not a claim of perfectly smooth performance.

All **six scheduled autosaves committed**, with zero failed attempts, and a
newer persisted payload restored. Game-thread dispatch cost ranged from
**4.6 to 16.0 ms**, and asynchronous completion from **87.4 to 170.5 ms**.
Fresh-page save/reopen and failed-save/confirmed-reload are separately verified
by the browser tests; the long-session end check restores the persisted payload.

Loaded chunks peaked at **1,147** during travel and returned to **797** in
recovery. Sampled CPU geometry buffers peaked at **252.96 MB** and settled at
**220.38 MB**; these counters exclude total GPU memory. Textures reached **47**
and stayed there across return, caves and recovery. Sampled JS heap peaked at
617.49 MB and ended at 419.20 MB; this is not total process/worker memory or
proof against leaks over longer or different workloads.

Renderer submission remained the largest measured cumulative CPU component,
with a **712.1 ms** maximum call. Remesh draining reached **31.3 ms**, far-terrain
updates 30.1 ms and settler updates 54.4 ms. Method times overlap. Further work
should measure these paths and cold shader variants on representative devices,
preserving frame delivery and visual equivalence. Physical-iPhone behavior
and the owner's original saved-world/Reload problem are still unverified.

CI passed **7,718 checks across 315 files**, build and browser recovery checks
on the same game code. The software-WebGL CI fixture checks thirty continuous
draws and one preparation; it reports driver timings instead of imposing an
uncalibrated fifteen-second performance cap. Its hang watchdog does not replace
or weaken the hardware profiler's one-second display-freeze guard or any
existing geometry/resource budget.
