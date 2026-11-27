# Smoke test of the 27 November features

Run in headless Chromium against the dev server, seed 71823, Duilt mode, on
origin/main with PR #390 and #392 merged. Console errors and uncaught errors were
captured on every run. The repeatable version is `tests/smoke-5c-browser.mjs`
(390 x 844 phone viewport). Software rendering runs at about 1 frame a second, so
the test fast-forwards with `game.tick()` at a fixed 0.1 s step and no drawing.

Result: 8 of 8 checks pass. No game bug found, so no game code changed.

| # | Check | Result |
|---|-------|--------|
| 1 | Loads, new world, 60 s of walking, no console errors | Pass. One console error came from the sandbox blocking the Google Fonts request (no internet), not from the game. |
| 2 | Mushroom patches and fallen logs in forests | Pass. 192 mushroom blocks and 30 log blocks within 80 blocks of a forest spawn. |
| 3 | VIL-1 sleep, VIL-2 ask bubble, Town "Wants X", Give | Pass. Villager walks to the bed and lies down at night (0.6 day = 40 s), is up at dawn. Natural ask shows 1 bubble. Give raised mood 70 to 78 (apple) and 70 to 85 (iron sword), removed the item, ended the ask. Phone panel fits. |
| 4 | EXP-1 explorer gift with region | Pass. "They give you 2 saplings" then "From the orchard country: 4 apples." |
| 5 | Fruits, acorns, roots, Plant Pot, growth, picking | Pass. 39 acorns from 600 oak leaves (6 percent). 1 root from each of carrot, lettuce, broccoli. Pot and apple seed placed through `placeBlock`, plant is 4 blocks high at day 6, picking gave 3 apples, `Apple Tree: fruit by tomorrow` hint shown. |
| 6 | Wizard's Hut, wizard, panel tabs, shop, wand, target, cauldron, potion, hat | Pass. Hut claimed, wizard arrives with a toast, tabs Talk, Shop, Quests, Recipes. Shop sells 4 fruit seeds, buying took 12 coins. First quest gave the wand. Cast fired 1 bolt and scored points, a bolt at a training target scored. Moonwater brewed at the Magic Cauldron panel in 30 s, Speed Potion brewed. Drinking shows `2:58` in the HUD. Hat equips, bonus 2. Phone layout checked. |
| 7 | WORK-1, WORK-3 staffed buildings, old-world grace | Pass. Farm panel says "Makes nothing until a villager works here" and, once a farmer is assigned, "Ana works here as a farmer. A villager works here, so it makes goods." A save without the staffed mark gets grace to day 3 and one notice, panel says "Works on its own for a few more days". |
| 8 | #390 mini game, #392 villager level and Give weapon | Pass. Hand-work panel (Chop wood) fits at 390 px, Start then 3 swings gave "Made 1 oak log, 1 of 3 swings landed", then "Resting. 1:34 left". Town row shows "Level 1 of 10 (0% to level 2). Strength 10, intelligence 10 ...". Give Iron Sword armed the villager (9 damage a blow), Take weapon back returned it. |

## Notes

- `sendExplorer` returns null when the ground 70 blocks away is not loaded. Callers
  that ignore the result are fine, the next try runs later.
- A crop broken inside a claimed building region drops nothing. This is protection, not a bug.
- The grace-end notice and the arrival grace notice fire only while the game is
  playing. With a panel open the clock is paused, so they wait.

## Could not test

- Real pointer-lock aiming and touch controls: headless Chromium has no pointer lock,
  so placement and the wand used the game's own methods with a stubbed raycast.
- Sound, and real-time frame rates: software rendering is about 1 frame a second.
- Cloud saves (Neon), no network.
