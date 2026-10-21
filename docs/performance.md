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
budgets`; it also supports manual dispatch. Requiring that check in main's
branch protection is a separate repository setting.

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
- Full suite after completing the pending fixes: **7,445 passed / 0 failed
  across 271 files**. The nine earlier failing assertions are resolved:
  missing tool models and block textures added; crafting/quarry expectations
  updated to requested rules; storage-controller interaction tested directly.
  Full output: `artifacts/performance/completion-suite-final.txt`.
- Focused independent review: no remaining actionable findings after fixing
  the long-queue allowance override, zero-budget far-tile starvation, and
  incomplete instance-buffer accounting in the initial harness.

Runtime safeguards are integrated into main. The report-validation and terrain
fixture follow-up is being delivered as a separate PR. Physical-phone testing
and the separate 30-minute settlement/war profiling task remain open; these
automated checks cannot guarantee that future content will never cause a
performance problem.
