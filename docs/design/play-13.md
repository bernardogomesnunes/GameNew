# PLAY-13: politics, angry villagers

Owner's note, 22 November (More improvements list): "We are forgetting about politics, and villagers getting pissed off for not having jobs or food."

TASKS.md row: "Politics: villagers get angry without jobs or food, with consequences. Builds on JOBS and the hunger counter (CL-12)."

Summary. Each villager gets a mood from 0 to 100. Food and a job raise it each game day; hunger and no job lower it. Four bands (Content, Grumbling, Angry, Furious) give, in order: slower work, refusing work, leaving town. A later version adds protests and riots when half the town is angry. A town that feeds everyone once a day and gives everyone a job stays at 100 and never sees any of it.

Design only. No game code changes on this branch.

## What exists on `origin/main`

| Part | Where | What it does today |
|---|---|---|
| Population | `src/duilt/Settlers.js` | One settler per house past the first, plus `skills.settlerAllowance()` (Politics level). A missing settler is replaced 8 s later (`arriveEverySeconds`). |
| Meals | `Settlers.eat()` | Once a game day (`eatEverySeconds` 900 = `GAME_DAY_SECONDS`). 1 food each, granary and storehouses first, then your bag, least nourishing first (`FOODS` sorted by `feeds`). Retry every 60 s for the hungry. Soldiers eat after settlers. |
| Hunger effect | `Settlers.staffedIds()`, `walk()` | A hungry settler keeps the job but stays home: the building loses the +50% `workBonus`. Nothing else. |
| Hunger signals | `src/ui/DuiltUI.js` | Toast "Ana is hungry" with **Give food** (`settler:hungry`). The people counter `#vital-people` pulses (`.hungry`). CL-12: tapping it calls `giveFood()`. |
| Jobs | `Settlers.assignWork()`, `src/duilt/VillagerJobs.js` | No jobs until a valid Work Hall stands (`jobsOpen`). Then each settler takes the nearest unstaffed producing building within 40 blocks of home, or is set to builder or hauler in the Work Hall pop-up (`renderWorkHall`). `p.job` is the job name for outfits (IMP-21, `JOB_FOR_BUILDING`). |
| No job | `SETTLER_TALK.jobless` in `src/config/talk.js` | Three lines of talk. No other effect. |
| Leaving | `Settlers.revalidate()` | Only when a house is pulled down (`settler:left`). |
| Deaths | `Settlers.hurt()` | Raid attackers kill villagers (10 hp). |
| Closed game | `DuiltGame.loadJSON` | "Game closed no production": buildings skip the time away. Villager builds are paid for while closed (`jobs.owe`). `Settlers.tick` runs on `dtSeconds`, so nothing about settlers moves while closed. |
| Save | `Settlers.toJSON()` | `nextId`, and per person `id, name, colour, homeId, workId, hungry, x, y, z`. |
| Drawing | `src/render/SettlerView.js` | Two instanced meshes plus one parts mesh (19 slots a person), `MAX` 64. No icons over heads. |
| Talk | `Game.talkTo` | A `talk` toast with one line picked by `SETTLER_TALK` (hungry first, then jobless, then working). |

The comment in `src/config/settlers.js` says "Nobody starves and nobody leaves". PLAY-13 reverses the second half on purpose. That comment and the `eat()` docstring change with chunk 2.

## The mood model

One number per villager, `mood`, 0 to 100. Soldiers have none in version 1.

### Inputs

Mood changes every tick by a daily rate times `dt / GAME_DAY_SECONDS` (900 s). Two terms add up:

| Term | Condition | Per game day |
|---|---|---|
| Food | fed at the last meal (`p.hungry` false) | +5 |
| Food | hungry (`p.hungry` true) | -25 |
| Work | has a job: a staffed building (`workId`), or builder or hauler at a valid Work Hall | +5 |
| Work | no job, and past the grace period | -15 |
| Work | no job, inside the grace period | 0 |

Totals:

| State | Per day |
|---|---|
| Fed, working | +10 |
| Fed, no job | -10 |
| Hungry, working | -20 |
| Hungry, no job | -40 |

Grace period: 3 game days (45 real minutes) without a job count as 0. The counter `idleFor` runs while jobless and resets to 0 when a job starts. A new settler arriving at Age 1 before any Work Hall is not punished during their first 45 minutes. Grace only applies to the job term. Hunger counts from the first missed meal.

One-off bumps, so a fix shows at once:

| Event | Bump |
|---|---|
| Fed after being hungry | +10 |
| Gets a job after being jobless past grace | +10 |

Start values: a new arrival starts at 70. A settler in a save from before PLAY-13 starts at 80 with `idleFor` 0, so an update never sets off an exodus on load.

Mood is clamped to 0 to 100. It does not move while the game is closed or hidden, because `Settlers.tick` gets no `dt` then. This matches "game closed no production".

Later version (chunk 6): each Politics level cuts negative rates by 5% (level 10 halves them). The skill already says "room to govern 1 more settler"; this gives it a second job that fits its name.

### Bands

| Band | Mood | Colour | Effect |
|---|---|---|---|
| Content | 60 to 100 | none shown | none |
| Grumbling | 40 to 59 | yellow `#e0b43a` | work bonus +25% (was +50%); builders take 1.5 times as long a block |
| Angry | 20 to 39 | orange `#e07a2e` | refuses work: no bonus, builders and haulers stop, they stay near home |
| Furious | 0 to 19 | red `#d23a2a` | as Angry; after 1 game day at Furious, they leave |

Hysteresis of 5 points: a settler drops into a band at its lower edge and climbs out of it only 5 points above. A settler at 39.9 who eats does not flip between Angry and Grumbling every frame.

### Timings this gives

| Case | Start | Grumbling | Angry | Furious | Leaves |
|---|---|---|---|---|---|
| No food, has job | 100 | day 2 | day 3 | day 4 | day 5 |
| No food, has job or in grace | 70 | day 0.5 | day 1.5 | day 2.5 | day 3.5 |
| Fed, no job, newcomer (3-day grace first) | 70 | day 4 | day 6 | day 8 | day 9 |
| No food, no job, grace long over | 100 | day 1 | day 1.5 | day 2 | day 3 |

One game day is 15 real minutes. A newcomer who is never fed leaves after 3.5 days, 52 real minutes. A settled villager with neither food nor work leaves after 3 days, 45 minutes.

### Leaving

A settler who has spent 1 game day Furious moves out. They walk to the edge of your land and are removed (`settler:left` with `reason: 'angry'`). Their house then stands empty for 2 game days (`emptyHouses`, seconds left per house id). `hasRoom` ignores those houses, so the 8-second refill does not undo the consequence. With today's code a leaver would be replaced in 8 s by a newcomer at 70, which makes leaving cost nothing.

While the town's average mood is under 40, nobody new arrives at all ("word gets round"). Arrivals resume once the average is 45 or more.

A settler carrying goods for the Work Hall drops them into the hall's supplies before leaving (`VillagerJobs.returnCargo`). Nothing is lost.

## Visible signals

1. A thought bubble over the head, only at Grumbling or worse. Icon by the main reason: a bowl (hungry), a crossed hammer (no job). Bubble colour is the band colour. Content villagers show nothing, so a well-run town looks as it does today. Drawing: one extra instanced plane mesh in `SettlerView.js` with a 2x3 icon atlas on a canvas texture, billboarded, `MAX` 64. One draw call for all bubbles.
2. Talk lines. New pools in `SETTLER_TALK`: `grumbling`, `angry`, `leaving`, each split by reason (`food`, `work`). Talk picks by band first, then today's order. Example Angry, work: "Four days with nothing to do. I didn't come here to stand about." Example Furious: "One more day like this and I'm gone."
3. Toasts, once per settler per band on the way down:
   - Grumbling: none (the bubble is enough; toasts at this level would be noise).
   - Angry: "Bram is angry: no work for 4 days" with body "Build a farm, forest or quarry within 40 blocks of his house, or make him a carrier at the Work Hall." Button **Show** opens the Town panel at his row. For food the button is **Give food** (today's `giveFood`).
   - Furious: "Bram will leave tomorrow" with the same buttons.
   - Left: "Bram left: no food. His house stands empty for 2 days."
   All go into the Notification Centre (`Notices.js`) like other toasts.
4. People counter `#vital-people`. A coloured dot beside the count shows the worst band present (none when all are Content). Hungry keeps its pulse. The tooltip names the worst case: "Bram is angry: no work. Tap to see your people."
5. Town panel (new `panel-town` in `src/config/panels.js`). One row a villager: name, job (or "No job"), a mood bar 0 to 100 in the band colour, the reason ("Hungry since yesterday", "No job for 4 days"), and "Leaves in 0.6 days" when Furious. A header line: "Town mood 82. 1 angry, 0 leaving." Rows sorted worst first. Buttons in a row: **Give food** when hungry, **Find work** when jobless (opens the Work Hall pop-up if one stands, otherwise a toast saying to build one).
6. Work Hall pop-up rows (`renderWorkHall`) get the same mood dot before the name.

## Consequences, by version

| Step | Trigger | What happens | Version |
|---|---|---|---|
| Slower work | one settler Grumbling | their building gets +25%, their builds go 1.5 times slower | 1 |
| Refuses work | one settler Angry | no bonus, builder or hauler stops; also skipped by `jobs.owe` while closed | 1 |
| Leaves | 1 game day Furious | moves out, house empty 2 days, no arrivals while average < 40 | 1 |
| Protest | 3 or more settlers and at least half Angry or worse | the angry ones gather at the Town Hall, else the Work Hall, else your house; everyone else loses 5 a day ("unrest spreads"); traders at the market will not buy or sell (PLAY-22) | 2 |
| Riot | 4 or more settlers and at least half Furious, or a protest lasting 2 game days | no building produces anything that day; rioters take 10% of each non-food stack from one storehouse (at most 20 a stack), gone; one rioter leaves each game day | 2 |

Riots never break blocks. Breaking blocks would damage builds the player spent hours on and would need its own undo and save rules.

## How the player fixes it

| Cause | Fix | Already in the game |
|---|---|---|
| Hungry | **Give food** on the toast, tap the people counter (CL-12), or fill a granary or storehouse | yes |
| Hungry, no food at all | buy food from Bramble or Mabel at the market | yes (Age 5) |
| No job, no Work Hall | build a Work Hall (Age 1) | yes |
| No job, Work Hall stands | build a producing building within 40 blocks of their house, or set them to Builder or Carry supplies | yes |
| Anything, fast | hold a feast at the Tavern: 2 food each with `feeds` 20 or more, +20 to everyone, once a game day | version 2 |

Every fix in version 1 uses buttons that exist now. The new part is that the game tells you which one and for whom.

## Interaction with other tasks

### PLAY-20, food values

Version 1 ignores meal quality: any food counts as fed. This keeps PLAY-13 independent of PLAY-20.

Version 2, after PLAY-20 lands: the food term depends on what was eaten.

| Meal | `feeds` | Food term per day |
|---|---|---|
| Poor (raw meat 5, coffee beans 4) | under 10 | +0 |
| Plain (fruit, most vegetables) | 10 to 24 | +5 |
| Good (cooked meat 32, Cauldron meals) | 25 or more | +10 |

Today settlers eat least nourishing first (`FOODS` order). With quality counting, that order would always serve raw meat. Version 2 changes the order to skip foods under 10 while anything else is in store. Whether to go further (best first from the granary) is open question 3.

### PLAY-22 and PLAY-23, selling at the market

1. Selling food: the sell panel warns when a sale leaves less than 2 days of meals in the granary and storehouses (`residents x 2`).
2. A recurring food sale (PLAY-23) skips its day when the stock is under that reserve, the same as its "skips a day when stock runs short" rule.
3. During a protest (version 2), traders refuse to trade. This gives the market a stake in town mood.
4. Buying food at the market is a fix for hunger. Nothing changes there.

### Military

Soldiers already eat with the settlers and hit softer when hungry (`soldiersHungry`, `Game.js:5756`). Version 1 gives them no mood. Version 2 option: a soldier hungry for 2 game days deserts, one a day (open question 5).

## Balance: a well-run town never triggers it

A well-run town here means: food in a storehouse at each meal, and every settler with a job or a Work Hall role.

1. Fed and working is +10 a day. Mood climbs to 100 and stays there.
2. One missed meal, fed again 10 minutes later: -20 x 10/15 = -13, then the +10 bump. From 100 that is 97, Content.
3. A whole game day without food from 100: 80, Content. Back to 100 in 1 day (bump plus +10).
4. Two and a half days without food from 100: 50, Grumbling. Work at +25% for about a day after feeding; no toast.
5. A new settler waits up to 3 game days for a job at no cost. Building one producing building, or setting them to Carry supplies, ends it.
6. More settlers than buildings in range: the Work Hall's Builder and Carry supplies roles count as jobs and have no limit, so a job is always available once a Work Hall stands.
7. Raids, deaths and doubled-up Politics settlers do not affect mood in version 1.

Check numbers to test against (chunk 2 test): a town of 6, fed every day and all employed, reaches 100 by day 3 (arrivals start at 70) and stays at 100 over 30 game days. The same town missing every third meal by a full day never goes below 75.

## Save format

Per person in `settlers.people`, new fields:

```js
{ ..., mood: 82.4, idleFor: 1200, furiousFor: 0, said: 'angry' }
```

- `mood`: number, 1 decimal. Missing means a save from before PLAY-13: load as 80.
- `idleFor`: seconds without a job, for the grace period. Missing loads as 0.
- `furiousFor`: seconds spent Furious, for leaving. Missing loads as 0.
- `said`: the lowest band already announced by toast, so a reload does not repeat it. Missing loads as `null`.
- The band is not saved. It is derived from `mood` on load, with hysteresis starting from the plain thresholds.

On `settlers`:

```js
{ nextId, people, emptyHouses: [[houseId, secondsLeft], ...] }
```

Version 2 adds `unrest: { kind: 'protest' | 'riot', since: seconds, at: structureId }` or `null`.

No save version bump: every field has a default, and old builds ignore unknown fields.

## Phone and desktop UI

- Phone (390 px wide): the Town panel is the same full-height sheet as `panel-stores`. Rows are 44 px tall with the mood bar under the name. The two buttons wrap under the bar. The people counter keeps its 30 px tap target; the dot is 8 px inside it, not beside it, so the HUD band does not widen.
- Desktop: the Town panel opens as a window (`PanelWindows.js`) beside the building panel, so the Work Hall pop-up and the Town panel can be open together while assigning jobs.
- Tapping the people counter: when someone is hungry it feeds them (CL-12, unchanged). The toast it shows gets a **See people** button. When nobody is hungry, the tap opens the Town panel; today it shows a toast.
- Bubbles have no tap target. Tapping a villager talks to them, as today (`Game.talkTo`).

## Version 1 (minimal) and later

Version 1, chunks 1 to 4: mood, bands, slower work, refusing work, leaving with the empty-house cooldown, bubbles, talk lines, toasts, the Town panel, the counter dot, save fields.

Later, chunks 5 to 8: protest and riot, the Tavern feast, Politics softening, meal quality (needs PLAY-20), market reserve and protest effects (needs PLAY-22 and PLAY-23), soldier desertion, grief after a raid death, a crowding penalty for doubled-up houses.

## Implementation chunks

| # | What | Files | Tests |
|---|---|---|---|
| 1 | Mood rules, no wiring | new `src/config/mood.js` (rates, bands, grace, bumps), new `src/duilt/Mood.js` (pure: `dailyRate(person, ctx)`, `step(person, dt, ctx)`, `bandOf(mood, previous)` with hysteresis) | new `tests/mood.test.mjs`: the four rate totals; grace 3 days; bumps; clamp; hysteresis at 40 and 45; the timings table rows to 0.1 day |
| 2 | Settlers use it | `src/duilt/Settlers.js` (mood in `tick`, `arrive` at 70, `staffedIds` and `bonusFor` by band, `leave()`, `emptyHouses`, `hasRoom`, `toJSON`/`loadJSON` defaults), `src/duilt/VillagerJobs.js` (Grumbling builders 1.5x, Angry stop, `owe` skips Angry), `src/config/settlers.js` comment | new `tests/settlers-mood.test.mjs`: 30-day well-run town at 100 from day 3; missing every third meal stays at 75 or more; unfed newcomer leaves at day 3.5; house stays empty 2 days; no arrivals while average under 40; an old save loads at 80 with `idleFor` 0; cargo returned on leaving. Run `settlers`, `villagerseat`, `villager-jobs`, `granary`, `villagers-die` unchanged |
| 3 | Words and panels | `src/config/talk.js` (new pools), `src/ui/DuiltUI.js` (toasts on band change, counter dot and tooltip, `sayPeople` opens the panel, Work Hall dot), `src/config/panels.js` (`panel-town`), `src/ui/styles.css` | `tests/granary.test.mjs` stays green (CL-12 tap still feeds); new `tests/mood-ui.test.mjs` (source and DOM checks: one toast per band, panel rows sorted worst first); new `tests/town-panel-browser.mjs` at 390 px and 1280 px: no horizontal scroll, buttons work |
| 4 | Bubbles | `src/render/SettlerView.js` (one instanced plane, canvas atlas) | `tests/mood-bubbles.test.mjs`: bubble count equals settlers below Content; `tests/performance-safety.test.mjs` draw-call budget still passes |
| 5 | Protest and riot | `Settlers.js` (`unrest`), `DuiltGame.js` (production off on riot, storehouse loss), `Game.js` (trade refused during protest) | protest at 3 of 6 Angry; riot after 2 days; no block changes during a riot |
| 6 | Feast and Politics | `src/config/structures.js` (tavern action), `DuiltUI.js` building panel button, `Mood.js` multiplier from `skills.levelOf('politics')` | feast spends 2 food of 20 or more each, once a day; level 10 halves negative rates |
| 7 | Meal quality | `Settlers.eat` order, `Mood.js` food term | after PLAY-20 values; raw meat skipped while plain food is in store |
| 8 | Market reserve | PLAY-22/23 sell code | warn and skip under 2 days of meals |

Each chunk is one PR. Chunks 1 and 2 can be one PR if small. Every chunk ends with `npm test` and `npm run build`.

## Open questions for the owner

1. Is leaving the right worst case for version 1, with protests and riots later? Or do you want protests in the first version?
2. Grace period: 3 game days (45 minutes) before no-job anger starts. Shorter or longer?
3. Food quality (after PLAY-20): should settlers eat the best food first so cooked meals raise mood, or keep worst first so your good food is saved for you?
4. Does a builder with no building orders, or a carrier with nothing to carry, count as having a job? Version 1 says yes, so the Work Hall roles are always a fix.
5. Soldiers: should hungry soldiers desert, or stay out of politics?
6. A raid death: should it lower everyone's mood (grief, -10)?
7. Riots: is losing 10% of one storehouse's goods acceptable, or should riots only stop production?
8. Politics skill: should its levels soften anger (5% a level), as well as giving room for one more settler?
