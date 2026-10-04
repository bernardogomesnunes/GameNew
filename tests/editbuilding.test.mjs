import { readFileSync } from 'node:fs';

/**
 * Reported directly: "The buildings should have an edit which is move and
 * change, I shouldn't need to click the building again to finish, something
 * in the UI must explicit that. Also the progress should be a button there."
 *
 * Two real bugs behind that, not one:
 *
 * 1. Pressing "Change it" unlocked the building but never closed the panel —
 *    it just redrew panel-building in place. A claimed building's blocks are
 *    unbreakable while any panel is open (Game.js's phase() reads
 *    ui.isAnyPanelOpen and returns 'paused'), so there was no way to actually
 *    touch a block until you closed the panel yourself — at which point
 *    there was nothing on screen saying you were mid-edit, or how to finish.
 *
 * 2. Finishing meant walking back to a wall of the building and aiming
 *    precisely enough to reopen panel-building, which is exactly the "click
 *    the building again" the report is about — worse once you had broken
 *    the wall you'd have aimed at. #building-hint, the strip that already
 *    names whatever's under the crosshair, is pinned to "editing this
 *    building" for the whole time it's unlocked instead (setEditingBanner),
 *    so finishing is one tap from wherever you are.
 *
 * DuiltUI/UIManager/Game.js need a DOM and a renderer this suite doesn't
 * have, so — same as buildingcost.test.mjs and hudvisibility.test.mjs — the
 * wiring is checked against the source rather than run.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- starting an edit actually lets you edit ---------------------------

ok('changing an unlocked building routes to finishing, a locked one to starting',
  /onChange: \(\) => \{\s*if \(structure\.locked === false\) this\.finishEditing\(\);\s*else this\.startEditing\(structure\);/.test(game));
ok('starting an edit closes the panel so the world is not paused under it',
  /startEditing\(structure\) \{[\s\S]{0,200}this\.ui\.closePanel\('panel-building'\)/.test(game));
ok('and unlocks the actual structure, not just the UI state',
  /startEditing\(structure\) \{[\s\S]{0,200}this\.duilt\.structures\.setLocked\(structure\.id, false\)/.test(game));

// --- finishing does not require finding the building again -------------

ok('the crosshair strip is pinned to this building the whole time it is open',
  /this\.ui\.setEditingBanner\(STRUCTURES_BY_ID\.get\(structure\.type\)\?\.name/.test(game));
ok('finishing is its own callback the UI can reach without a structure reference',
  /onFinishEditing: \(\) => this\.finishEditing\(\)/.test(game));
ok('finishing reads which building from state kept on the game, not a fresh aim check',
  /finishEditing\(\) \{\s*const structure = this\.editingStructure;/.test(game));
ok('and locks it back up for real',
  /finishEditing\(\)[\s\S]{0,200}this\.duilt\.structures\.setLocked\(structure\.id, true\)/.test(game));

// --- tidy-up: deleting or moving a building you were mid-edit on clears it --

ok('deleting the building you were editing drops the edit state instead of pinning a ghost',
  /deleteBuilding\(structure\) \{[\s\S]{0,300}this\.editingStructure\?\.id === structure\.id[\s\S]{0,100}this\.editingStructure = null/.test(game));
ok('so does picking it up to move it',
  /beginMove\(structure\) \{[\s\S]{0,300}this\.editingStructure\?\.id === structure\.id[\s\S]{0,100}this\.editingStructure = null/.test(game));

// --- the strip itself becomes a real button, not a passive readout -----

ok('setEditingBanner exists and takes over the strip regardless of aim',
  /setEditingBanner\(name\) \{\s*this\.editingBanner = true;/.test(ui));
ok('clearEditingBanner hands the strip back',
  /clearEditingBanner\(\) \{\s*this\.editingBanner = false;/.test(ui));
ok('a tap on the strip finishes editing instead of opening the claim menu, while editing',
  /if \(this\.editingBanner\) this\.cb\.onFinishEditing\?\.\(\);[\s\S]{0,200}else if \(this\.cb\.onHintTap\) this\.cb\.onHintTap\(\);\s*else this\.cb\.onOpenClaim\(\);/.test(ui));
ok('the ordinary per-frame aim hint does not clobber it',
  /setBuildingHint\(text(, \{ manage = true \} = \{\})?\) \{\s*if \(this\.editingBanner\) return;/.test(ui));

// It only reads as clickable on desktop where the CSS turns pointer-events
// back on for it — the label without that would promise a click that never
// lands, the same failure mode "should be a button" was reported over.
ok('the CSS actually makes it clickable on desktop too, not just touch',
  /body\.editing-building #building-hint \{[\s\S]{0,80}pointer-events: auto/.test(css));

// --- the cluttered building card ----------------------------------------

/**
 * Reported alongside the above: "uis are a bit cluttered on the pop up
 * cards for build for example." Every card carried a "Needs: trunks ·
 * canopy · soil" line of raw internal requirement ids that nothing else in
 * the game ever explains — building by hand already gets the readable
 * version of each one the moment it's tried (openClaim's own messages) — and
 * a second, usually-empty note div stacked under the first. Cut to one note
 * block, shown only for buildings with a stampable design at all.
 */
const duiltUI = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the raw "Needs: ..." requirement-id line is gone from the building card',
  !/<span>Needs: \$\{needs\}<\/span>/.test(duiltUI));
ok('no note under the Place button at all now (backlog batch 2) — the cost chips say what is short',
  (duiltUI.match(/renderBuildings\(\) \{[\s\S]*?<\/div>`;\s*\}\)\.join/)[0]
    .match(/class="building-note"/g) ?? []).length === 0);

process.exit(f ? 1 : 0);
