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

Names in **Who** record previous responsibility, not an exclusive reservation.
Any agent can take an open task after checking current main, open PRs and other
active work. A feature marked done may still need a physical-device playtest;
that does not mean its implementation should be repeated.

When something lands: change its status here, with the PR. When something
new is asked for: add it with the owner's words quoted.

---

## Agent handoff — checked 23 October 2026

The owner is taking a break from this project to focus on others and may use
other agents. This is the handoff index into the tasks below, not a second
backlog. **Performance and stability remain the owner's first priority.**
No engine migration, native app port or reduction in world detail has been
chosen. This chat is handing off its remaining work rather than reserving it.

**Verified baseline:** main includes [PR #239](https://github.com/bernardogomesnunes/GameNew/pull/239)
(merge `730c5c3`), Storage Remote #235, inventory search #236 and the performance
gate hardening #234. No open PRs were found at this audit. PR #239 passed both
CI jobs and local verification: **7,550 tests, 0 failures / 292 files**, build,
performance budgets and browser checks. These are dated results, not a promise
that an agent's later checkout has passed them. Re-fetch/recheck before work.

| Priority / state | Existing IDs | What the next agent should do |
|---|---|---|
| First: unresolved lag / Reload | TECH-18 | #242 fixes the measured normal-autosave stall and localStorage capacity path with background binary IndexedDB saves. Profile remaining render-submission/meshing spikes. Reproduce the owner's actual Reload using diagnostics or a saved world; the original crash is unresolved. |
| First: sustained performance | TECH-8; playtests under TECH-17 and TECH-9 | #241 records the 30-minute baseline with failed persistence; #242's 11-minute hardware follow-up confirms two actual autosaves and restore with 4–15 ms game-thread save work. Repeat a full 30 minutes on the new pipeline and profile physical iPhone hardware. Remaining render/mesh stalls prevent an overall performance sign-off. |
| Follow-up implementation | TECH-7 | Finish lazy loading war/Sky modules; map/story already load lazily. Check the download/bundle change and exercise late-game routes, saves and cancelled loads. |
| Follow-up maintenance | TECH-10 | Extract one Game.js subsystem per PR with existing behavior preserved. Coordinate files with other agents; a refactor alone is not an FPS improvement. |
| Discussed crafting follow-up | CRAFT-8 | Define the timing/dragging/animation interaction before implementing it. Current crafting is a sequence of action buttons; the richer interaction is not delivered. Keep this behind the performance priority. |
| Partial: model-backed Battle | OLD-3; ASK-3 | Local LM Studio strategies work. Finish a separately configured authenticated hosted/mobile connection only after the owner supplies/chooses the endpoint arrangement; see `docs/local-ai.md`. |
| Partial: multiplayer Battle | OLD-4 | Direct/LAN building and positions work. Remaining scope is combat/game-state synchronization and internet connectivity/relay. Do not present current co-op as complete Battle multiplayer. |
| Blocked on database approval | TECH-1, TECH-5, TECH-14; ASK-5 | Review the prepared atomic-save/server-enforcement rollout and scaling work. Migration 0006 is not applied; atomic saves default off. Do not run migrations or activate production features without the owner's explicit approval. |
| Owner / playtest decisions | OLD-5, TECH-16, HOUSE-1, HOUSE-3; sections 9–10 | Battle balance, any paid always-on database choice, optional Cline setup and approved branch cleanup remain. Physical-device checks include crafting, mobile world creation, inventory search and Storage Remote. ASK-1 is conditional on another save failure, not a current authentication blocker. |

**Start safely:** read `AGENTS.md`, fetch main, check worktrees/status and open
PRs, and preserve other agents' changes. Claim a task by ID with its actual
scope. Use one coherent branch/PR and update this file when integrated. Old
branch names and completed briefs are history, not evidence of missing work.
This documentation request does not authorize starting those implementations.

**Validation:** use `npm ci`, then `npm run dev`. In PowerShell, local offline
development can use `$env:VITE_NEON_URL=''; npm run dev`. Run focused tests,
then the checks relevant to the change. Performance work uses `npm run test:performance`,
`npm run test:performance:browser` and
`node tests/full-game-rendering-browser.mjs`; failure recovery uses
`node tests/crash-diagnostics-browser.mjs`. Full regression/build commands are
`npm test` and `npm run build`. CI definitions are in `.github/workflows/`.
Never raise a performance cap simply to make new content pass. Keep measured
CPU geometry bytes separate from total GPU memory and rendering counts
separate from frame-rate guarantees.

---

## Who's on what

**ChatGPT**
- Gameplay batch integrated into main: crafting, the storage interface, Work Hall
  builder/hauler jobs, larger building designs, house variants, natural mob
  movement, emerging raid sites, connected mountain ranges and distant scenery.
- LM Studio strategies work through a local development-server bridge. Direct
  one-guest co-op supports shared building edits and positions; internet relay
  and full Battle combat/state synchronization remain separate work.
- Save/import guards, browser checks, CI, worker generation, lazy map/story,
  metadata checks, local diagnostic exports and wiki updates are implemented.
- Repository reconciliation on 21 October included every local and fetched remote
  branch, the uncommitted mobile world-selection changes, cloud-limit contracts,
  the optional debug overlay and world secrets. No stashes or additional worktrees
  held additional unfinished work at that reconciliation. A retained external
  checkout may still exist; inspect worktrees before cleanup. The atomic-save
  migration remains disabled and **not applied**.
- Future tasks follow `AGENTS.md`: regular commits, pushed branches and a PR at
  task completion. GitHub CLI authentication is working; PRs can be created.
- GitHub's default branch is `main` (set and verified through GitHub on
  23 October). GitHub CLI authentication is working.
- First GPU-work reduction, crash recovery diagnostics/download and the
  full-game rendering gate are integrated in #239. TECH-18 and TECH-8 remain
  open. #241 adds three measured streaming/minimap optimizations and a
  completed 30-minute desktop profile with failed local persistence; the
  owner's original Reload is not yet reproduced. #242 adds background local
  persistence and an 11-minute desktop run with two confirmed autosaves and
  restore. Remaining submission/meshing stalls and physical-device testing
  are the immediate follow-up; visuals and performance caps are unchanged.
- Remaining work is explicitly marked in the tables; phone playtests, production
  database rollout and branch deletion still require the owner's action.

**Cline** (briefs in section 12)
- Nothing open: CL-1 to CL-14 are done.

**Owner**
- Try things on the phone: section 2 and section 9.
- Answer ASK-3 to ASK-5 (section 10); ASK-1 only if saving fails again;
  Battle balance (OLD-5).
- Cline's settings on your computer (HOUSE-3).
- Once there are players: keep the database awake (TECH-16).

---

## 1. Saving

| ID | What | Who | Status |
|---|---|---|---|
| SAVE-1 | **The testing world lost progress** ("Was not able to save my testing world it lost a lot of progress"). Saving works again, tested by the owner on 20 October; before, Save showed "Not saved — try again". | Owner | done |
| SAVE-2 | **A world missing from the account's list is treated as deleted**: saving stops for that session and the backup copy is thrown away. Now the backup is kept, Save says the world wasn't found and can be tried again, and the world is never made again on its own. Deleting a world on purpose still throws its backup away. | ChatGPT | done, #231 |
| SAVE-3 | **"Save and leave" leaves even when the save failed**, without saying so. Now it stays in the world and says why; only a save that went through takes you to your worlds. | ChatGPT | done, #231 |
| SAVE-4 | **Failed uploads retry without telling you.** Now one message when uploads start failing ("Not saved to your account yet", why, and that it's kept on this device), tries again on its own after half a minute, then 1, 2, 4 and 5 minutes, at once when the connection comes back, and one message when it lands. | Claude | done, #233 |
| SAVE-5 | **The backup copy may not fit** in the browser's small local storage (about 5 MB) for a big world. Now a copy too big for it goes to the browser's bigger store (IndexedDB; a 12 MB copy checked in Chromium); if it fits nowhere, you're told once. | Claude | done, #233 |
| SAVE-6 | Explain account size-limit errors and suggest exporting a copy. The database limits have been live since 6 October; no database changes needed. Transport and retry/error handling checked. | ChatGPT | done; integrated into main 21 October |

---

## 2. Just done: try it on your phone

Checked by tests, most in a test browser, none on a real iPhone.

| ID | What | PR |
|---|---|---|
| TECH-18 / #239 | Download diagnostics is now available on the game's Reload screen. Play on iPhone and Windows PC; if it stops, retain the report and note the world/mode and action just before failure. Reduced covered far-terrain submissions keep detail/view distance; the original crash remains unresolved. | done implementation, #239; real-device verification open |
| STORE-2 | Hold the Storage Remote and tap/right-click to open the current world's storage directory, then open actual shelves; check this away from the placed controller too. | done, #235; real-phone check remains |
| INV-1 | "Can you add search to inventory? Keep the height of the panel fixed while giving results" — searches bag and equipped items by name, keeps original slot actions, and retains the panel height for many, few or no matches. Equipment rows collapse while filtering and return when cleared. | done, #236; merged into main 21 October; real-phone check remains |
| NOW-21 | The game was breaking with the new land: far fewer triangles to draw everywhere (about half at home, a tenth at a huge peak); huge peaks less blobby, with an uneven outline, ridges and valleys, and a second summit. | #234 |
| NOW-20 | Saving: a failed upload says so once, tries again by itself, and says when it's up; a big world's backup copy fits now. | #233 |
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

The owner's list, item by item; implementation status is recorded below.

### 3.1 Making blocks

> "Building stuff is only blocks and gathering them is just a crafting
> mechanics. I'd like to change that. I want blocks like stone to have a
> mechanic to craft."

| ID | What | Who | Status |
|---|---|---|---|
| CRAFT-1 | "Quarry will give stone only." | ChatGPT | done; integrated into main 21 October |
| CRAFT-2 | "stone marble cobble, coloured stone except turquoise should be obtained by processing the rock." | ChatGPT | done; integrated into main 21 October |
| CRAFT-3 | "To darken we need some kind of forge." | ChatGPT | done; integrated into main 21 October |
| CRAFT-4 | "to lighten we should have some bleach bucket to place them." | ChatGPT | done; integrated into main 21 October |
| CRAFT-5 | "For wood we should have a full carpentry set of tools to do the diff kinds of furniture as a wooden mill is not enough." | ChatGPT | done; integrated into main 21 October |
| CRAFT-6 | "The crafting experience here in the pop up should be slightly different and more interactive." Ordered action-button work steps, batch quantity, bill and cancellation. | ChatGPT | done for step-based workflow; integrated into main 21 October; richer interaction is CRAFT-8 |
| CRAFT-7 | "To mold and forge weapons we can have the same logic." | ChatGPT | done; integrated into main 21 October |
| CRAFT-8 | "Ok they will have timing challenges dragging or crafting animations ? Is that documented as a task?" Record and define this richer crafting interaction; the delivered action-button steps do not include timing challenges, dragging or crafting animations. Choose the interaction, touch/keyboard controls and cancellation/material rules before implementation; preserve the existing recipe/station/tool and performance safeguards. | Any agent + Owner for interaction choice | discussed follow-up; not implemented; lower priority than TECH-18/TECH-8 |

Crafting verification (21 October): finite-inventory touch browser at 390×780
checks processing, furniture and weapon routes, batches, cancellation, station
and tool changes, shortages, full bags, stale popups and repeated taps. Active
work shows its full bill and spends only on the last step. Nearby station and
water checks do not generate terrain; each action checks only its recipe.
The full regression run passed 7,448 checks; the extended crafting checks also
pass. Performance budgets and production build pass. Physical-phone playtesting
remains with the owner. Existing natural rock deposits remain mineable; the
processing routes provide their crafted supply and turquoise stays natural.
The carpentry delivery includes reusable Saw, Chisel, Plane and Mallet
items/requirements plus work steps. These four tools and the Weapon Mold
already have dedicated 3D box models in `src/config/itemModels.js`, consumed
by the held-item renderer (`src/render/heldModel.js`); do not list those models
as missing. Crafting's bounded station/water checks are already delivered,
not an open terrain-generation task.

### 3.2 A storage interface

| ID | What | Who | Status |
|---|---|---|---|
| STORE-1 | "Buildings need a lot of blocks to do. And food and all take a lot of space. We need a third storage item which is called a storage interface. Which is a block that should be placed on top of the storage manager and it allows me to see the list of storages and what they have, and clicking shows me all the items." | Claude | done; integrated into main 21 October; handheld follow-up in STORE-2 |

**STORE-2 — Storage Remote:** "for store 1, finish it with a new item that the
user can hold which allows him to see the storage interface remotely anywhere
in the game." Implemented in **PR #235**, with a reusable Age 3 recipe, held 3D
model, mobile tap/right-click access to the current world's storage directory
and existing shelves. Age 3 hand recipe: 4 planks, 1 glass, 2 copper ingots.
**Done with PR #235**, integrated with inventory search and current main on
23 October. No background storage scanning is added.

### 3.3 Villagers who work

> "To make everything more interesting we should have villagers doing
> chores like building, and storing stuff. My idea is to have another
> building right in the beginning that allows to give jobs to villagers.
> This way we can make buildings way bigger."

The Work Hall now assigns builder and hauler jobs, including construction and
storage deliveries. The old nearest-building production boost is not the
whole implemented jobs system; JOBS-1 through JOBS-4 are already integrated.

| ID | What | Who | Status |
|---|---|---|---|
| JOBS-1 | A building, right in the beginning, that gives jobs to villagers. | Claude | done; integrated into main 21 October |
| JOBS-2 | Villagers who build. | Claude | done; integrated into main 21 October |
| JOBS-3 | Villagers who store stuff. | Claude | done; integrated into main 21 October |
| JOBS-4 | With villagers building, buildings way bigger. | Claude | done; integrated into main 21 October |

### 3.4 A world at a bigger scale

> "We need to step up our world generation. With big trees, and some big
> mountains we need to reinforce the scale. We need wider and bigger
> mountains and I mean a Kilimanjaro exists from time to time. 1 block is
> 1 meter remember. Plains bigger and deserts flatter. We should add big
> caves, that go deep like mine deep, and have big galleries, with ruins."

| ID | What | Who | Status |
|---|---|---|---|
| WORLD-1 | Wider and bigger mountains, and now and then a Kilimanjaro. (The world is 200 blocks tall.) Wider ranges; in about 4 of every 10 areas of 1,024 blocks, a huge peak 420 to 560 blocks across rising to 174–186 high, never near the start or under the floating island; an uneven outline, ridges and valleys, and a lower second summit ("mountains look too blobby", #234). In every world, old ones too (the owner said yes). | ChatGPT, Claude | done, #231, #232 |
| WORLD-2 | Big trees. Giant trees now come in three shapes, spreading, spire and tiered, up to about 40 blocks of trunk. | ChatGPT, Claude | done, #231, #232 |
| WORLD-3 | Bigger plains, flatter deserts. Plains and deserts about 28% wider, with gentler rises and bigger flat stretches. | ChatGPT, Claude | done, #231, #232 |

In old worlds too: a saved world keeps the chunks you changed and your
claimed land, and makes the rest again from its seed, so the land away from
your builds takes the new shape. Where a kept chunk meets a remade one there
can be a step.
| WORLD-4 | Big caves, as deep as the mine, with big galleries and ruins. One in every 512-block area: a 100-block main hall, an upper hall, a walkable slope down from the surface, and a ruin with pillars and a chest. | ChatGPT, Claude | done, #230 |

Terrain follow-up (21 October, integrated into main): the owner asked for
"cordilheiras, and not just a blob" with a gradual transition into plains.
Connected backbones, branching ridges, peaks/saddles and broad foothills now
replace isolated oval uplift and climate-driven mountain bumps. Existing
claimed/changed chunks stay saved; regenerated unclaimed land takes the new
shape. This is an analytic landform system inspired by TerraForged/Tectonic,
not hydraulic erosion or a downstream river-network simulation. Same-seed
browser comparisons are in `art/review/terrain-ranges-*.png`.

### 3.5 Creatures

> "Mobs have weird behaviours, let's make them more natural. Villagers are
> going on roofs from the ground without even jumping."

| ID | What | Who | Status |
|---|---|---|---|
| MOBS-1 | Villagers going onto roofs without jumping. (Found: a villager could step straight up 4 blocks.) Now they step up one block at a time and walk round a wall or house in the way; where there's no way, they give up and stand. | ChatGPT | done, #231 |
| MOBS-2 | More natural behaviour for mobs. In part: "Polish idle and roaming creatures" (ChatGPT, on main since 20 October). | Claude | done; integrated into main 21 October |

### 3.6 World creation

| ID | What | Who | Status |
|---|---|---|---|
| HOME-1 | "the amount of text we have on the selection of world type when creating a new world" — "show all cards and buttons in mobile instead of having scroll". Short descriptions and a compact layout keep Duilt, Battle, Creative, Back and Next visible; short wide screens use three columns. Verified in a touch browser at 11 phone/desktop sizes, down to 320×480, with mode selection and navigation preserved. | ChatGPT | done; integrated into main 21 October; physical-phone check remains |

---

## 4. Buildings

| ID | What | Who | Status |
|---|---|---|---|
| LOOK-1 | "the houses look squares … the ones I sent have this organic form. also they diversify the textures by using multiple blocks on the walls." Keep the current designs as templates and improve them. The starter house has clipped corners and a hip roof; the townhouse and village cottages have stepped corners (the owner said yes). Already-built houses stay as they are. | ChatGPT | done, #232 |
| LOOK-2 | The two ways the owner suggested for it: "not sure if by level would be feasible, or to have different house types available to build on our building list." | Claude | done; integrated into main 21 October |
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
| OLD-2 | Places you've taken marked on the map; new ones appearing over time. Raided places are marked, and bounded emerging-site generation adds new places over game days with saved progress. | Batch 4 | Claude | done; integrated into main 21 October |
| OLD-3 | Battle mode with AI rivals through an API key, kept on our server. The owner offered their own model server (needs HTTPS, key in an environment secret). | Batch 4 | Claude + Owner | local LM Studio integration verified; hosted/mobile reachability remains separate |
| OLD-4 | Battle mode with real multiplayer, inviting friends. | Batch 4 | Claude | direct/LAN co-op building and positions verified; full combat/state sync and internet relays remain |
| OLD-5 | Battle balance: how strong rivals feel and how often they come. | Batch 4 | Owner | waiting |
| OLD-6 | Composting: a bin turns seeds and leaves into compost, which speeds a farm or raises its yield. The compost bin, and compost on a growing crop moves it on one stage (#230); "Add compost" in a farm's panel moves all its growing crops on one stage (#231). | Batch 3 | ChatGPT | done, #231 |
| OLD-7 | Mist round the floating island and cloud below it: the one part of the look and sound plan not in the game. | Look and sound plan | Claude | done; integrated into main 21 October |
| OLD-8 | Battle worlds show as "Duilt" in the account's world list. Fetch, retain and render Battle metadata in live and remembered lists. Verified actual row rendering; the UI no longer drops the flag. | Batch 4 | ChatGPT | done; integrated into main 21 October |

---

## 5a. The 29 October list ("Improvements")

The owner's words, in order. Their note on the list: "This is a batch of
changes, some are more direct and specific and some are more broad. Please
review it and ask me stuff to refine how you plan this work." The sketch the
list mentions (`Attachments/…pdf`) did not arrive with the file; ask for it
again if a task below needs it. The questions in **Open question** are for the
owner and block the task until answered.

| ID | What | Who | Status |
|---|---|---|---|
| IMP-1 | **Explorers give saplings and other materials.** "Dark logs reminded me of something, we need explorers to give saplings and other materials when approaches, saplings should grow to trees." Saplings already grow into trees in 10 game days (`duilt/Saplings.js`) and leaves drop them; explorers already speak (`EXPLORER_TALK`) but give nothing. Add a gift when you approach and talk to one: saplings first, then a few raw materials the explorer carries from where they came. **Decided 29 October:** "Each explorer should have 2 gifts available, that can be taken. since we have them passing by this should work." So each explorer carries two gifts, taken one at a time, and is empty after both. Saplings first; the second is a raw material. Still to choose when building: which materials (dark and white logs, seeds, clay). | Any agent | to do |
| IMP-2 | **Barracks: upgrade it and train more, no bed count.** "would be nice to update the building and allow to create more, remove the number of beds logic." Today the barracks needs 4 beds, 2 weapon racks, 2 training pieces and a 30-block hall, and holds a soldier a bunk. Replace the bed rule with the building's level: each upgrade (the same Evolve path other buildings use) raises how many soldiers it can train and hold. **Decided 29 October:** 10, 20 and 40 soldiers for levels 1 to 3 ("Im ok with those numbers"). Beds become decoration only and drop out of the requirements. | Any agent | to do |
| IMP-3 | **Garrison follows the same rule.** "Garrison with the building from the user to activate It is pretty cool, but it's better if we have the same rule here, to update the building and allow to create more too." The garrison (`id: military`, Age 8) is built from your own walls, then trains soldiers on request. Give it levels like IMP-2, with the same cap-by-level rule, so both military buildings work alike. Do after IMP-2 so they share one implementation. | Any agent | to do, after IMP-2 |
| IMP-4 | **Building emojis out, text only.** "Buildings emojis look disgusting, can we remove them and leave only text here?" Every building spec in `config/structures.js` carries an `icon` emoji, shown by `ui/DuiltUI.js` in the building panel, the finish list and the claim list. Remove the emoji from those places and show the name alone. Check the layout on a phone, since the icon column gives the row its shape. Skills and goals use their own icons; leave them unless the owner says. | Any agent | to do |
| IMP-5 | **Aurelion kills what you attack.** "Aurelion should kill the mobs the user attacks." In hunt mode Aurelion picks the nearest enemy (`world/Guardian.js`). Make it choose the creature you last hit instead, in every mode, and finish it quickly. **Decided 29 October:** "ONLY ENEMIES YES": bandits, raiders and war soldiers, never farm animals. | Any agent | to do |
| IMP-6 | **Carpentry rebuilt around tools used on things, not carried.** "We should not have the carpentry tools all of them in bag to craft stuff, one thing usually per items. So carpenter planer should be placed and give more planks. Saw should be held, chisel can break blocks and turn them into decorative blocks, saw could turn planks into a template for furniture, and then placing that template and using an item called toolbox on it will make it a piece of furniture." This replaces the interim rule in PR #243 (furniture needs only the saw in the bag). Parts: (a) the **plane** is a placed station that turns logs into more planks; (b) the **saw** is held, and used on planks makes a furniture template; (c) the **chisel** breaks a block into its decorative version; (d) a **toolbox** item, used on a placed template, finishes it into the furniture piece. Big and touches recipes, items, placement and the crafting panel. **Decided 29 October:** build in phases ("yes"): the placed plane first, then saw templates and the toolbox. Still to choose when building phase 1: does the plane replace the wood mill's plank bonus or sit beside it, and what a placed template looks like. | Any agent | to do, phase 1 first; supersedes PR #243's interim rule once built |
| IMP-10 | **BIG PRIORITY: review every crafting interaction, one interface each.** "Let's add as a big priority to review all interactions with buildings foundry kiln and the items forge bleach mill carpenter items and stone mill. Each one needs its own interface. Only saw should be held to craft stuff, the rest should be placed." Also: "Forge should be placed like the bucket and there should be an interface to make stuff there." Decided 29 October: **held** tools are the saw (furniture, beds, paintings), the chisel ("held, breaks blocks into decorative ones") and the weapon mold ("Weapon mold held"); **placed** are the plane (a Planing Bench since #249) and the mallet ("plane mallet should be placed"). Placed blocks: forge, bleach bucket, wood mill, stone mill, planing bench, mallet. Buildings: workshop, foundry, kiln, engineering centre, university, temple. Steps: (1) PR #253 gives every placed block its own list of recipes instead of the whole workbench; (2) audit each one on a phone: what opens, what it lists, what it needs in the bag; (3) the mallet as a placed bench, and drop the plane and mallet from the bag rules (bows still ask for the plane tool); (4) the chisel as a held tool that breaks a block into its decorative form; (5) check the kiln and foundry panels one by one. Do not merge steps; one PR each. | Any agent | in progress: step 1 is PR #253; the rest to do |
| IMP-11 | **Dark and white logs by name.** "Dark log does not appear to me." The item was called "Dark Wood" and the recipe "Char Dark Wood", so searching for a log found nothing. Renamed the items to White Log and Dark Log and the recipes to Bleach White Log and Char Dark Log (the block names stay, since textures key on them). | Any agent | done in the PR that adds this line |
| IMP-7 | **The map works in the past and the future.** "Map should work on past and future." What the map does today in the Past (dinosaurs) and the Future (futurians, the Archive) has not been checked; the owner says it does not work there. First reproduce it. Then make the map and minimap read the world you are in: terrain, your position and the markers that exist there. **Owner's answer 29 October:** "not getting this one". Needs the owner's description in plain words first: when you travel to the Past or the Future and open the map, what do you see (nothing, the home world, the wrong place)? Reproduce it in the game before building. | Any agent | waiting on the owner |
| IMP-8 | **Explain the showcase.** "What the hell is the showcase? It broke my game, explain me what it is." Answered in the chat on 29 October: it is a workshop tool in the menu behind the developer switch (`config/menu.js`, `dev: true`). It builds one Creative world with every building, animal and person at once, for taking before and after pictures of the game's look; it is never saved. It is heavy because everything is built together. Add a plain description and a warning to its menu entry so nobody opens it by accident, and say whether it replaces the world you are in. Do not treat it as a bug until the owner says what broke. | Any agent | to do (copy); see IMP-9 |
| IMP-9 | **What broke when the showcase opened.** The owner says it "broke my game". Find out which: a crash, a freeze, a lost world, or a bad save. If opening it can overwrite or lose the world you were in, that is a bug to fix. If it only is heavy, cap what it builds on phones. **Owner's answer 29 October:** "I dont know what this is either". So the showcase was probably not what broke the game. Do not spend time on it until the owner sees the break again; then record the device, the world and the last action (the Reload screen's Download diagnostics does this). | Any agent | on hold, no repro |

---

## 6. Cline's queue

All CL tasks below are complete. Section 12 retains their historical briefs
for context; do not take one as new work without a newly reported regression.

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
| WIKI-1 | The wiki (`docs/wiki/`) brought up to date. It was written on 14 October; time travel, Battle mode, the Plainer and Helix, the mine, the granary and more came after. | Claude | done; integrated into main 21 October |
| COPY-1 | The weird descriptions in the game fixed. Examples as they read today: Stone "Mined from rock"; Marble "Cut and dressed at a workshop"; Gravel "Scraped off the mountainside"; Raw meat "Hunted". | Claude | done; integrated into main 21 October |

---

## 8. Housekeeping

| ID | What | Who | Status |
|---|---|---|---|
| HOUSE-1 | Optional cleanup of old branches such as `cline-test`, `claude/backlog-batch-3-update`, `claude/debug-overlay`, `claude/mob-models-blender` and `claude/stoic-dirac-yky1hi`. Their retained work, including SAVE-6 and TECH-9, is already integrated. Recheck ancestry/worktree use before deleting any branch; do not delete another agent's checkout. | Any agent, once the owner agrees (ASK-4) | waiting for cleanup approval; not missing implementation |
| HOUSE-2 | One tasks file. | Claude | done |
| HOUSE-3 | Optional Cline settings on the owner's computer (section 12), if still using Cline. Local LM Studio was subsequently verified; hosted/mobile access is OLD-3, not an unresolved local setup failure. | Owner | optional owner setup; local model issue resolved |

---

## 9. To try on the phone

Things that exist but haven't been confirmed in a real game. The longer
version is in `docs/history/status-and-testing.md`.

- **Recent:** section 2.
- **Stability (TECH-18):** test the owner's saved worlds on both iPhone and
  Windows PC, including caves/biomes and travel. If the game's Reload screen
  appears, use **Download diagnostics** there and retain the report plus the
  mode/world/action leading up to it. A powerful PC failing is not proof that
  the phone and PC share a GPU-memory cause.
- **Crafting / UI:** processing, furniture and weapons with a finite bag;
  cancel, batches, missing tools and full bags; all world-type cards/buttons
  on a small phone; inventory filtering with a fixed panel height; Storage
  Remote held use far from the controller and opening the selected shelves.
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
- **The new land (NOW-21):** play near a huge peak and in a giant forest;
  check the game doesn't break and the peaks look less like blobs.
- **Saving (NOW-20):** play with no signal for a minute, see the message,
  then turn it back on and see "Saved to your account".

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

A review of the code, speed, safety and scaling was written on 6 October;
the original is in `docs/history/analysis-scaling.md`. Many findings have since
been implemented. The statuses below, audited on 23 October against main,
supersede that historical review; do not repeat its already completed work.

| ID | What | Who | Size | Status |
|---|---|---|---|---|
| TECH-1 | **Two devices overwrite each other.** Saving the same world from two devices: the last one wins, chunk by chunk, with no check. Matters as soon as you play one world on phone and computer. | Claude | M | migration 0006 and gated transport tested; waiting for approved database rollout |
| TECH-2 | **Check imported world files before loading.** Bound file size (128 MB), expanded terrain, light/smoke records, building footprints, inventories and designs. Reject malformed loader records and excessive stack expansion before replacing the open world. Keep valid version 1/2 exports, null train loads, omitted wear and large Granary crop counts compatible. Verified rejected imports preserve the world and real exports import via Chromium. | ChatGPT | S | done; integrated into main 21 October |
| TECH-3 | **A security header for the site** (Content-Security-Policy, set in Vercel's config): only our own scripts and Neon may run or be called. | Claude | S | done; integrated into main 21 October |
| TECH-4 | **Text put on screen escaped by default.** About 70 places write HTML; the ones that show your text are escaped by hand. One helper that always escapes, so a future change can't slip. | Claude | M | done; integrated into main 21 October |
| TECH-5 | **Limit how often a client can write to the database.** | Claude | S | bounded client queue implemented; server enforcement prepared in 0006, not activated |
| TECH-6 | **Make land in the background** (a Web Worker): background terrain generation and a bounded main-thread fallback are implemented. Meshing, uploads and rendering still require profiling; the worker does not establish that all streaming stutter is solved. | Claude | L | done for worker generation; integrated into main 21 October; remaining stalls are TECH-18/TECH-8 |
| TECH-7 | **Smaller first download**: the game loads as one large file (1.4 MB on 6 October, more now). Load the war, story, Sky Kingdom and map code only when needed. Faster start-up. | Claude | M | map/story artwork load lazily; war/Sky module split remains |
| TECH-8 | **Profile a long session and a war round** (30 minutes, a big settlement), fix the top three slowdowns or memory leaks. | Any agent; desktop measurements by ChatGPT in #241/#242 | M | partial: 30-minute baseline and three hot-path fixes #241; background local persistence #242 passes an 11-minute hardware run with two confirmed autosaves/restore. Repeat full 30 minutes on the new pipeline; remaining submission/meshing spikes and physical-iPhone profiling remain |
| TECH-9 | **The phone memory overlay**: optional counter shown with `?debug`, for finding memory growth on a phone. | ChatGPT | S | done; integrated into main 21 October; phone profiling remains |
| TECH-10 | **Split `src/Game.js`** (over 8,000 lines as of this audit; measure again before work) by system (war, vehicles, building, input, saving), one part per PR, alongside other work. | Claude | L | to do in separate subsystem PRs; new workers/jobs/peer helpers are outside Game.js |
| TECH-11 | **Type checks on the save format and the block list**, to catch the kind of mismatch that once broke saved worlds' mode. | Claude | M | done; integrated into main 21 October |
| TECH-12 | **Automatic browser checks**: isolated Chromium loads the game, verifies deferred assets, places a block, saves/reloads/reopens, rejects malformed imports without replacing the world, and imports a real export. Story's eager import fixed. | ChatGPT | M | done; integrated into main 21 October |
| TECH-13 | **Checks on every pull request**: GitHub Actions tests/build and browser checks exist; a separate Performance budgets job is required on main. Respect checks before integration. | Claude | S | done; integrated into main 21 October; full-game/recovery checks added in #239 |
| TECH-14 | **The database at scale**: a player column and index on saved chunks so the security check stays fast with millions of them; a small runner for migrations, and a check the live database matches the code. Needs the owner's yes (ASK-5). | Claude + Owner | M | waiting |
| TECH-15 | **Crash and frame-rate reports** from players' devices, before any public launch. | Claude | M | done; integrated into main 21 October |
| TECH-16 | **Keep the database awake** once there are players (a paid compute that doesn't sleep), or the first save after a quiet spell waits seconds. | Owner | S | waiting |
| TECH-17 | **Performance safeguards for future additions**: fixed-seed crest/slope/forest/cave/settlement budgets, 24-animal simulation, isolated browser GPU-resource/disposal checks, shared streaming allowance and a required PR performance workflow. #239 adds an actual 802-chunk forest rendering comparison/cost gate; existing budgets are unchanged. Commands and limits in `docs/performance.md`. | ChatGPT | M | implementation integrated (#234, included with #236; full-game gate #239); real-phone check pending |
| TECH-18 | GPU stability before new features: the owner reports the game's Reload screen and substantial lag on a weak-GPU iPhone and a Windows PC with a 16 GB dedicated GPU. Diagnose the actual failure, reduce demonstrated rendering waste and evaluate an engine/app move using comparable workloads. | Any agent; #239/#241/#242 implemented by ChatGPT | M | partial: diagnostics/render reduction #239; streaming/minimap fixes #241; measured normal-autosave stall/capacity fix #242. Original Reload, rendering spikes and physical-iPhone verification remain; no engine migration approved |

### TECH-18 implementation plan, 23 October

**Goal:** make actual game failures diagnosable and remove proven redundant GPU work without reducing world detail or viewing distance.
**Architecture:** reuse bounded local diagnostics and the existing far-terrain chunk mask; no account changes, telemetry uploads or per-frame reporting allocations.
**Tech stack:** current JavaScript/Three.js/WebGL2, Node tests and isolated Playwright Chrome. The owner's Reload/lag reports above are the specification.

- [x] Reproduce a diagnostics defect: three caught frame errors trigger Reload but record zero diagnostic errors. Full-game experiment on the Radeon RX 7900 GRE reaches about 2.5 million submitted triangles in a forest and observes a 420 ms render submission stall during travel; no Reload reproduced in that bounded run. Evidence is local under `artifacts/performance/fullgame-stress.*`.
- [x] **Crash reporting** — `src/core/Diagnostics.js`, `src/Game.js`: failing-first regressions cover caught-frame errors, failures before the first successful frame, bounded/redacted stacks and distinguishable context loss. Reports include cause/resource counters and cached graphics-backend details, downloadable directly on Reload. Actual browser checks pass for frame errors, real context loss and diagnostic collection failure; each still stops and saves. Collection cannot block recovery.
- [x] **Covered far terrain** — `src/render/FarTerrain.js`: failing-first coverage tests include outer walls, negative coordinates, mask moves/resizes, restoring visibility and tiles created after the mask. Full-game 802-chunk forest comparisons on Radeon and SwiftShader preserve every pixel and skip 143,012 submitted triangles (about 5.7%). View distance/detail are unchanged; buffers remain resident, so this does not establish a memory reduction.
- [x] **Verification and delivery** — focused regressions, full-game comparison, browser resource budgets, smoke/inventory/storage/crash checks and build pass; full suite: **7,550 passed, 0 failed / 292 files**. Smoke's file picker timed out once while other browsers ran, then passed on an isolated rerun. Independent review has no remaining blockers after the diagnostic-isolation fix. Both PR CI jobs passed; #239 merged into main on 23 October (`730c5c3`). Measured gains/limits are in `docs/performance.md`. The owner's crash is not claimed fixed.

**Additional evidence saved for handoff:** a separate local Radeon RX 7900 GRE
run at 1920×1080, ratio 1, collected 100 samples over about 6 minutes 40 seconds
in a fresh Creative world. It crossed the five-minute autosave and included
settlement, mountain, forest and cave locations plus 960 blocks of travel.
No Reload, uncaught game error or context loss occurred. Autosave took 26.5 ms;
maximum CPU render submission was 353.7 ms, with separate grass/streaming update
spikes of 98.4/79.1 ms during transitions. Geometry source buffers peaked at
264,884,478 bytes; that is not total VRAM. These are profiling leads, not proof
of a driver cause, an absent leak or sustained iPhone performance. Results are
summarized in PR #239; local `artifacts/performance/fullgame-longrun.*` files are
ignored and will not be present in another clone. Reproduction scripts for
the maintained checks are committed under `tests/` and `tools/performance/`.

Remaining TECH-18 / TECH-8 work:

- [ ] Reproduce and classify the owner's actual Reload failure, preferably
  with its new diagnostic report and the affected saved world/mode.
- [ ] Profile and reduce demonstrated streaming/CPU/render submission stalls
  with before/after measurements; preserve save recovery and chosen detail.
- [ ] Complete the 30-minute large-settlement/war profile and physical-iPhone
  checks. Include account/network conditions where relevant; the local
  Creative test blocked external requests and did not exercise those paths.
- [ ] Compare an engine or native-app proposal only against an identified
  bottleneck and equivalent content/device measurements. No migration or
  wrapper application is authorized merely by this discussion.

Review focus: first-frame failures; reporting while the graphics context is lost; reports containing no account/world identifiers; mask edges and negative coordinates; restoring coarse terrain while real chunks stream or unload. Real iPhone failure reproduction remains necessary.

### TECH-18 / TECH-8 follow-up plan, 24 October

**Spec:** the owner's request to take the performance TECH tasks, with the
existing detail/view-distance/save-recovery constraints above. Work in the
current clean checkout on a task branch, as `docs/performance.md` specifies.
**Architecture:** keep the current JavaScript/Three.js stack; fix demonstrated
main-thread work at its source and keep profiling instrumentation in tools,
not the normal game loop. This is native execution of the plan in this chat.

- [x] Reproduce a concrete budget bypass before proposing a fix: one actual
  GrassView update over unloaded mountain terrain synchronously generates
  12 chunks, takes about 342 ms and produces zero visible tufts on this run.
- [x] Add failing-first grass regressions: unloaded endless terrain must not
  generate, partially loaded/negative-coordinate terrain still works, tufts
  appear after normal loading, and fully loaded output remains unchanged.
  Implement the smallest guard in `src/render/GrassView.js`; preserve density,
  radius, wind, user settings and the finite-world behavior. Commit.
- [x] Inspect/profile other measured streaming/minimap/submission costs;
  change a hot path only when a reproducible test demonstrates its cause.
- [x] Add a repeatable local-only full-game long-session profiler under
  `tools/performance/`, with a fixed-seed populated settlement, actual war
  activity, exploration/return travel and autosaves. Reports must distinguish
  CPU submission/source-buffer bytes from GPU time/VRAM, reject incomplete
  runs, and record backend, configuration and the tested revision.
- [x] Run the 30-minute profile on actual desktop hardware and report frame
  stalls and retained-resource trends. Record whether war/settlement/autosave
  paths actually ran. Physical-iPhone and owner saved-world reproduction stay
  open unless evidence is supplied; a clean synthetic run does not close them.
- [x] Run focused regressions, performance/browser budgets, relevant gameplay
  smoke checks, build and full suite. Review the complete branch, commit/push,
  open a PR, reconcile main and integrate under the standing authorization.

Review focus: no visual query may generate an unloaded chunk; negative chunk
coordinates; restoring details after worker arrival; unchanged loaded-world
output; profile evidence that actually includes populated/war/autosave work;
no production telemetry or account/database side effects.

Delivered by PR #241: three measured hot paths are fixed
with regression coverage. On focused actual-module comparisons, grass sampling
over unloaded mountain terrain generated **12 → 0 chunks**, taking roughly
**300 → 0.5 ms** with zero visible tufts in either case; dropping the same
612 chunks and preserving the same retained light records took **67.2 →
0.78 ms**; ten stationary minimap updates sampled **40,960 → 4,096 cells**
and took **113.8 → 13.1 ms** in aggregate. These probes isolate work; they do
not establish sustained FPS. Detail, radius, density and view distance remain
unchanged. Worker-arrival and canvas-resize regressions pass.

The corrected **1,800.059-second** desktop run on revision `77f2ca2` used
Chrome/Radeon RX 7900 GRE, 1920×1080, pixel ratio 1 and automatic graphics
(render distance 234). All six phases ran, with 55 villagers throughout,
eight live war attackers, verified underground air and actual deep-mesh draws.
There was no Reload, page error or context loss. Of 107,349 frame intervals,
99% were below the histogram's 20 ms upper bound, but the worst was **2.308
seconds**. These results do not reproduce the owner's failure or certify a
physical iPhone.

**Persistence failed, so the profile did not pass:** the initial local
payload contained **14,034,781 characters** and threw `QuotaExceededError`;
all six scheduled saves also failed, with no restored persisted world.
The slowest save took **2.301 seconds** while away from home. `World.serialize`
can synchronously generate missing claimed chunks through `getChunk` before
writing; this bypasses streaming's allowance. Renderer submission remained
the largest cumulative measured CPU cost, with a **742 ms** maximum; remesh
draining reached **21.7 ms**. Method times overlap. See `docs/performance.md`
for resource trends and limitations.

Follow-up to this baseline within TECH-18 / TECH-8:
- Delivered in #242: background binary local persistence, actual commit/restore
  confirmation, Save and leave/failure guards and legacy compatibility. Normal
  playing saves no longer prepare missing terrain or whole-world RLE/JSON on
  the game thread; the synchronous emergency lifecycle fallback still remains.
- Profile remaining submission/upload and single-chunk remesh stalls; verify
  any change against rendering equivalence and unchanged performance budgets.
- Reproduce the owner's Reload and run on physical iPhone hardware.

Verification on the exact runtime/tool/test revision `77f2ca2`: **7,583
passed, 0 failed across 297 files** in CI, build, gameplay browser checks,
inventory search, Storage Remote, crash recovery and both performance gates
passed. The build retains the existing large-bundle warning. Independent
review found no production optimization defects; cave/save-evidence findings
were fixed with regressions. Later changes on this branch only document the
measured results. TECH-18 and TECH-8 remain partial for the work listed above.

### TECH-18 / TECH-8 background local saves, 24 October

**Spec:** "keep going ... best performance ... without compromising the game
visuals"; continue the measured autosave/quota findings from #241. Claimed
terrain, edited blocks, finite/legacy worlds, all graphics settings and save
confirmation/recovery must survive. Implement natively on
`codex/background-local-saves` in the current checkout; one final independent
review. No dependencies or production database changes.

**Design choice:** capture an owned binary snapshot of loaded edited/claimed
chunks and metadata, then prepare missing claimed terrain in a dedicated
worker and commit binary world data plus directory metadata atomically to a
separate local IndexedDB database. This avoids whole-world RLE/JSON during
play and localStorage's observed quota. Confirm only committed writes;
preserve readable legacy records until replacement commits. Use serialized,
bounded save requests; retain a working fallback and report storage failures.
Keep exports/cloud formats unchanged. New local snapshots restore directly
without generating terrain just to overwrite it. Measure snapshot-copy cost
and additional retained buffers as well as worker time.

- [x] Reproduce capture/preparation/persistence boundaries with real-world
  fixtures. Add failing-first snapshot tests for zero live-world generation,
  owned buffers, claimed/edited preservation, negative coordinates, finite
  worlds and exact restore including surfaces/biomes/placed lights.
- [x] Implement binary snapshot capture/completion/restore in
  `src/storage/WorldSnapshot.js`; prove old exported data remains compatible.
- [x] Add real-browser failing checks for large local persistence, atomic
  metadata, fresh-page restore, legacy coexistence/migration, failed commits,
  overlapping saves/deletes, and worker failure. Implement the worker/backend
  and `LocalWorlds` integration with bounded pending work.
- [x] Connect committed local-save promises to Game's existing Save and leave,
  crash recovery, world switches, sign-in migration and deletion. Preserve
  synchronous legacy fallback; do not present queued work as persisted.
- [x] Update profiling to await actual persistence and record preparation and
  completion separately. Compare the developed fixture at home/away against
  #241; keep resource and pixel-equivalence checks unchanged.
- [x] Run full regression/build/browser/performance checks and a sustained
  session crossing saves. Review, commit/push, PR and merge under standing
  authorization, then update this single task list with measured results.

Review focus: failed transactions retain the previous save; late completion
cannot resurrect deleted worlds or update another world's UI; rapid requests
remain bounded; worker-disabled/private-storage cases; typed-array ownership;
Save and leave/crash Reload wait for actual persistence. Physical-iPhone and
the original owner Reload remain separate verification work.

Implementation on PR #242 (25 October): owned binary snapshots, atomic local
IndexedDB payload/directory commits, bounded worker requests, committed-terrain
reuse, direct binary restore and legacy compatibility are implemented. Cache
reuse checks the complete terrain configuration so explicit Sky/other gameplay
changes still take effect. Actual browser tests cover 256 claimed chunks,
fresh-page restore, atomic abort, forty overlapping saves, deletion ordering,
newer competing legacy records, conditional migration cleanup, worker-disabled
fallback and denied IndexedDB. The real-game smoke also checks an edit made
after the last confirmed save survives immediate reload.

Review repairs preserve emergency checkpoints and shared progression, retain
new local edits made during cloud uploads, keep cloud access working when
local storage fails, and reject deletion when the modern record cannot be
removed. These repairs have failing-first regressions. On hidden/pagehide/
beforeunload, the existing synchronous best-effort legacy checkpoint remains;
normal playing saves use the worker. This fallback can still be expensive
and quota-limited. Forced termination of an uncommitted large save cannot be
guaranteed; physical-device suspension testing remains necessary.

Delivery verification for #242 (26 October): exact runtime/tool/test revision
`9ec1d92` passed **7,606 tests, 0 failures across 299 files**, build, gameplay
browser checks and both performance gates. Rendering equivalence retained
identical pixels (751 to 736 calls in the local comparison); caps were not
raised. Final documentation is the only change after that runtime revision.
The completed **660.01-second** Radeon RX 7900 GRE run kept 56 buildings and
55 villagers across settlement, war, travel, return, caves and recovery:
39,401 frames, two successful autosaves, fresh persisted restore, no Reload,
page errors or context loss, and zero validation failures. Save dispatch cost
was **3.9 / 15.2 ms**, with commits completing in **155.3 / 106.4 ms**.
Remaining work: the original owner Reload, physical-iPhone rendering/lifecycle
checks, a full 30-minute repeat on this pipeline and remaining rendering/mesh
spikes (the new run still had a 747.4 ms maximum frame). TECH-8 and TECH-18
remain partial; this completed batch is not a claim that all lag is solved.

---

Diagnostics: Settings > Graphics or the **Reload screen > Download diagnostics**
exports bounded local errors, recent frame-time summaries and a failure/backend
snapshot; no automatic uploads or account identifiers. Multiplayer:
Settings > World > **Invite a friend to Battle**.
Local model setup and limitations are in [local-ai.md](local-ai.md).

## 12. For Cline: how to work, and the briefs

**Historical briefs — all CL-1 through CL-14 are complete** (see section 6).
The old "What to do" wording below is retained as implementation history,
not an active assignment. Pick remaining work from the handoff index and
current status tables. Follow `AGENTS.md` and current owner instructions;
completed briefs do not override them.

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
  runs every test (7,550 checks / 292 files at the 23 October baseline;
  runtime varies); run it once, at the
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
