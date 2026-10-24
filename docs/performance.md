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
