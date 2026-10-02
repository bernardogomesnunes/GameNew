# Phase 7 — The Sky Kingdom, the Stone Kingdom, and the choice

The big one, after everything already on the list: the open tasks (#129–#133) and **Phase 6 (combat)**. Most of this depends on Phase 6, which adds:
- health, death and respawn;
- a sword, and hostile bandits;
- catapults with real projectile physics.

Source: the lore note "Duild new idea for lore", and the follow-up that set the two kingdoms and the two paths.

---

## The story

- **The Sky Kingdom** is where you come from. It is a mystical floating island lit by fireflies, and its people follow the **white god**, who has no name.
- **The Stone Kingdom** is a hard realm of dark stone that follows the **dark god**. Its army is the reason you are far from home, starting again in the wilds.
- **The Temple is where you choose.** At the Temple's height you choose a god by forging its ring. That choice decides how the game ends.

| | **White: stay true to the sky** | **Dark: turn to stone** |
|---|---|---|
| Ring | White Ring: speed and a higher jump | Black Ring: a spark that hurts whoever hits you |
| Guardian | The white guardian, from the White Sanctuary | The black guardian, from the Black Sanctuary |
| The Stone Kingdom | Your enemy | Your ally |
| The Sky Kingdom | Never appears; you never see it | Your target, 5,000 blocks away |
| How you win | Defeat the dark army: **10 rounds** of raiders at your walls | March with **1,000 Stone warriors** and conquer the Sky Kingdom |

- **The choice is final** for that world. You find out what the other path is like in another world.

---

## Decisions (confirmed)

1. **Losing a round (white path):**
   - the raiders loot your storehouses: a share of what's in them;
   - that round comes again after a pause;
   - no game over, and no taxes.
2. **Losing the conquest (dark path):** you're driven back to your castle. The Sky Kingdom takes **a quarter of what your buildings make** as taxes until you conquer it. Each failed attempt raises the tax a step.
3. **1,000 warriors on a phone:** the army is a **count** of 1,000. About 30–40 fight on screen at once, and fresh ones march in as others fall. The banner shows how many are left. A thousand live soldiers would stop any phone.
4. **Reaching a floating island:**
   - the Sky Kingdom hangs on great chains from **anchor towers** on the ground;
   - take an anchor tower and its lift or rope bridge carries your army up;
   - or build your own **siege tower** to the island's edge.
5. **The Stone Kingdom is a real place in both paths:**
   - a walled city of dark stone, built with the new decorative blocks;
   - white path: the rounds of raiders march from it, and you can visit it, but it's hostile;
   - dark path: you go there to swear to the dark god and gather your 1,000 warriors.
6. **When the choice comes:** the Temple's top level, around **Age 5**. The rounds (white) or the alliance (dark) start after you choose.

---

## Shared by both paths

### 7a. Decorative block pack (no dependencies, can come first)
- **Stone walls** that join up like fences. In cobble, stone, brick and dark stone.
- **Pillars that stack:** base, shaft and capital are chosen by what's above and below.
- **Trapdoors** that open and close with Place, like gates.
- **Framed windows** with crossbars.
- **Timber-framed walls:** plaster between wood beams.
- **Vases and urns.**
- **Banners:** white for the sky, black for the stone.
- **Dark stone and dark bricks** for the Stone Kingdom.
- **Sky-marble, gold trim and firefly lanterns** for the Sky Kingdom.
- **Each piece needs:**
  - a shape and collision;
  - a bag icon;
  - a bench recipe;
  - tests.

### 7b. Armour and rings
- **Slots:** new bag slots for armour (head, body and legs) and one ring.
- **Armour sets, one per realm:**
  - leather;
  - **Sky** armour: white steel and gold;
  - **Stone** armour: blackened iron.
- **What armour does:** it takes damage off each hit (it needs Phase 6 health).
- **Disguise (dark path):** you were born in the sky, so Sky armour lets you walk among its people.

### 7c. The Temple and the choice
- **The Temple** is a new building from Age 3, with levels on the existing level ladder: Shrine → Chapel → Temple → Great Temple → High Temple.
- **Devotion:** a new resource the Temple makes from offerings (food, gold and candles) and from settlers who worship there. Levels need devotion.
- **Blessings along the way:**
  - a short buff on crops or walls;
  - holy water, which heals.
- **At the top level the Temple asks you to choose:**
  - **White Ring:** gold and **Sunstone**. Faster movement and a higher jump.
  - **Black Ring:** obsidian and **Nightstone**. A dark spark hurts whoever strikes you.
- **You forge one ring.** The Temple takes on its colour and the other ring is closed to you.
- **Ring ores** (decided with the user): each ring needs an ore of its own. Devotion alone isn't enough.
  - **Sunstone:** a pale gold crystal with a faint glow. It's for the White Ring.
  - **Nightstone:** black stone with violet glints. It's for the Black Ring.
  - **Very rare.** Single blocks deep in the caves, near the bottom of the world (well below the ordinary ores), a handful per large area. They glow faintly, so you can spot one in the dark.
  - **In chests too:** loot chests are a new thing in the world. They're buried in deep caves and found at bandit camps and the hermit's hut, and now and then one holds a piece.
  - **Forging cost:** a ring needs a few pieces of its ore, gold or obsidian, and devotion. The ore is the hunt, and devotion is the faith.
- **Devotion stays**, but it's open to change once it's been played (the user isn't sure about it yet).

### 7d. The Sanctuary and the guardian
- **Only your god's Sanctuary can be built:** the White Sanctuary (open marble and light) or the Black Sanctuary (obsidian and a pit).
- **Building it summons the guardian**, tamed to whoever called it:
  - **White guardian:** a great winged stag of light. It is fast and heals your soldiers near it.
  - **Black guardian:** a shadow beast. Enemies near it lose their nerve and break ranks.
- **How it behaves:**
  - it follows you, holds position or attacks, from the same command wheel as soldiers;
  - it can be downed, and comes back to its Sanctuary after a day.

### 7e. The Stone Kingdom (a place in both paths)
**Done.** `world/kingdom.js` (`tests/kingdom.test.mjs`).
- **Where:** one city per world, 1000–1400 blocks from home. It goes on the flattest stretch found in a ring of 24 tries, never in the ocean or Mountains 2.
- **How it's built:** the whole city (about 40,000 blocks) is planned once from the seed, bucketed by chunk. Each chunk levels its ground to the city floor, eases it back to the land outside the walls, and lays its share of the blocks.
- **What's in it:**
  - walls ten high with seven towers, and a gatehouse with black banners and a gold lintel;
  - calçada streets with lamp posts;
  - the keep, with pillars, a red carpet and the throne;
  - the dark god's temple, with a Nightstone altar;
  - the armoury, with chests and weapon racks; barracks with beds; a market of calçada waves with stalls;
  - about 20 dark houses.
- **Its people:**
  - the Stone King stands on his dais and speaks by your ring when you tap him;
  - guards at nine posts are hostile to the White Ring, or to anyone who strikes one, and never run;
  - the dark path's oath will come with the dark path.
- **Reaching it:** an old road always leads to its gate, and no road runs through its walls. Messengers talk of it, and it goes on the map when found.
- **Seen from afar (#130):** its walls and towers stand up out of the far terrain. Anything you've built or dug in a changed chunk also shows there as it really is, and the far tiles over a chunk are remade when it changes.

- **Generation:**
  - a walled city of dark stone, placed by the world seed away from home;
  - built chunk by chunk, so each chunk can be made on its own and it looks the same every time;
  - it spans many chunks, so it needs a new "big site" generator that plans the whole city once.
- **What's in it:**
  - walls with towers and a gatehouse;
  - streets;
  - houses, a market, an armoury and barracks, in the new dark style;
  - a keep with the Stone King.
- **Seen from afar:** its walls and towers show on the horizon (this needs far terrain to draw buildings, #130).
- **White path:** it's hostile, and the raiders march from here.
- **Dark path:** the gates open to you. Swear to the dark god in its temple, and the King grants you your 1,000 warriors.

---

## White path — Defend: the Ten Rounds

- **When the war starts (changed in the playtest):** not when you forge the White Ring, but **when your land reaches the last age**. Asked for directly: "let's keep blocking leaving the area until age 6, and increase just a little bit the range, starting on 32 but going higher than 256, and when we hit it we get attacked, even if we didn't craft the ring — it will be harder to beat because you need to craft it while you are being attacked."
  - The border is a wall until Age 6: 32 → 64 → 128 → 192 → 256 → **320**.
  - At Age 6 the wall comes down (you can walk anywhere; building still stops at your border) and the Stone Kingdom **declares war**, whatever ring you bear.
  - Forge the **Black Ring** — before or during the war — and the King calls his army home: you're his ally (the dark path).
  - The game can't be finished while the war is on.
- **The rounds:** the dark army comes for your settlement in **10 rounds of raiders**, from the Stone Kingdom's side of the map, gathering just past your border.
  - There's a warning before each round: war horns, saying how many are coming and from where — about a minute of play before they arrive.
  - The first comes half a game day after war is declared; then a day and a half between rounds. A round only comes while you're near home.
  - You can sound your own **war horn** (made at the bench in Age 6) to call the next round early when you're ready.
- **The rounds get harder:**

  | Rounds | Who comes |
  |---|---|
  | 1–3 | Bandits on foot |
  | 4–6 | Archers, and a battering ram against your gate |
  | 7–9 | Stone soldiers in armour, and catapults against your walls |
  | 10 | The dark army's warlord, riding with a black beast of its own |

- **Raiders break blocks for real:** rams batter whatever stands in their way inside your land, and siege catapults lob stones at your buildings from 26 blocks off, using Phase 6 projectile physics. A claimed building that loses blocks stops working until you put them back.
- **Who's in each round** (config/war.js): 3, 4, 5 bandits; then bandits and archers with a ram; Stone soldiers with archers, catapults and a ram; and last the Warlord, Vorhak, on his black beast, with soldiers, archers and a catapult. Archers keep their distance and shoot; soldiers never run; the beast and the Warlord hunt *you*.
- **Defence buildings** (done — from Age 5, so they stand before the war; asked for "detailed"):
  - **Stone Wall:** a 16-long section — cobble plinth, dressed faces, a dark string course and quoins, a rubble core, a walk along the top behind a parapet with merlons and arrow slits, a stair up. Claimed, each block takes **three blows** of a ram or a siege stone to break.
  - **Gatehouse:** two towers with guardrooms and upper rooms, a vaulted passage with a calçada road, a gate of three doors in a dark-brick frame, the walk across the top behind battlements, a stair inside, lanterns and banners. Reinforced like the wall, and it **shuts its gate** when a round is warned.
  - **Watchtower:** a stone shaft on a plinth with a stair winding round a central pillar to an overhanging lookout with battlements, corbels, a signal lantern and a slate roof on posts. **Two archers** keep the lookout and shoot at anything of the enemy's within 26 blocks.
  - **Barracks:** a timber-framed hall with six bunks, racks of arms, a mess table under a chandelier, windows, and a fenced yard with training dummies, archery targets and banners. It **trains a soldier for every bunk** (up to six), who march out to fight raiders near it; raiders fight them back, and a fallen soldier is trained again.
  - New furnishings for them: **weapon rack, training dummy, archery target**.
  - **Catapults:** from Phase 6.
  - **The white guardian** fights beside you.
- **Winning a round:** every raider in that round is down or fled empty-handed. Each round won pays gold.
- **Losing a round:** a raider gets away with your things, or they beat you. They go home with it and the round comes again a day later (Decision 1).
- **Victory after round 10:**
  - the dark army is broken and the raids end for good;
  - the white god's light settles on your land, with fireflies across your settlement at night;
  - the victory screen tells the end of the story.
- **The Sky Kingdom never appears** on this path. It isn't generated, it isn't on the map and it isn't on the horizon.

---

## Dark path — Conquer: the Sky Kingdom

- **Built so far (part 1):**
  - **The oath:** Place on the Nightstone heart of the altar in the Stone Kingdom's dark temple, with the Black Ring on your hand, and the King grants you **1,000 warriors**. The King speaks to you as his sworn after.
  - **The army is a count** (Decision 3): up to **30 on the ground** at once; when one falls the count drops and a fresh one marches in from behind.
  - **The ⚔ banner** in the HUD shows how many you have and what they're doing; tap it for the **command wheel**: follow (ranks behind you), hold here, attack (anything hostile near you), form a line (abreast, ahead of you). Whatever the order, they fight what comes close, and raiders fight them back.
  - **Rations:** every game day, a meal for every hundred warriors, from your bag then your storehouses. Short of food, 3% desert each day.
  - **The camp:** a **War Tent** (Place on it: you wake there, and the army holds round it) and a **Campfire** that burns with a light of its own.
- **Built so far (part 2 — the Sky Kingdom, `world/skyKingdom.js`, `sky.test`):**
  - **The island** hangs 5,000 blocks from home, about 220 across, its floor at y 172: rock underneath (deepest in the middle), three waterfalls off the rim, white trees.
  - **A walled city on it** (asked for: "way bigger — houses, military houses and walls too"):
    - a white **city wall** with a gold band and battlements round the whole island, eight towers along it, and a **gatehouse** on each of the four avenues;
    - four broad **calçada avenues** from the gates to the citadel, lamps down both sides, paved lanes between the plots;
    - three **districts of houses**: cottages under slate gables, two-storey townhouses with a stair and gold roofs, villas with porticos; gardens and fountain squares among them;
    - a **military quarter**: barracks (six bunks, racks of arms, a mess table), armouries, and fenced training yards with dummies and archery targets;
    - the **citadel** in the middle: its own wall with gates and corner towers, a courtyard with trees and fountains, round the palace.
  - **The palace:** pillars and two rows of windows, a portico, a stepped gold roof with a spire.
  - **The throne room:** a blue rug up the aisle, firefly lamps on marble pillars, the gold throne on its dais, and the **Sky King** in front of it.
  - **Four anchor towers** on the ground round it. Each is sky marble with gold corners, a door at its foot, a stair winding up round a pillar inside, a platform with a gold rail and lamps, and a **chain** up to the island's rim.
  - **Sky lifts:** Place on the lift on a tower's platform to ride up the chain to the island; the lift at that path's landing takes you back down. Warriors following you come too.
  - **Its people:** about thirty guards in white and gold at every gate (the city's and the citadel's), on patrol down the avenues, at the palace door and in the training yards, and the Sky King (70 strength). They fight the bearer of the Black Ring on sight; your army fights them back.
  - **Its fall:** bring the Sky King down and the Sky Kingdom falls. That's saved with the world, and on the dark path it's the end: the game finishes once it has fallen and the last age is done.
  - **Its light:** from anywhere too far off to see the island itself, a small island with a gold glow hangs low in the sky the way it lies, brighter at night. The sworn Stone King tells you which way to go.
  - **Only on this path:** the generator lays it only when you bear the Black Ring, and in Creative to look at. On the white path there's no trace of it.
  - **Blocks:** Chain (iron links, made from an iron ingot; walked through) and Sky Lift (gold winch; only the towers' lifts go anywhere).
  - **Losing an attack** (`duilt/SkyWar.js`, `skywar.test`):
    - an attack begins when you reach the island or its towers with the Black Ring, and ends if you leave alive;
    - you lose it if you fall there, or your whole army does;
    - you're driven back home, waking there rather than at a painting or camp, and what you carried is left in a chest where you fell;
    - the Sky Kingdom then takes 25% of what your buildings make, then 35%, 45% and at most 50% after each lost attack, until it falls; every building that makes something shows a **Taxes** line;
    - the Stone King makes up 75% of the warriors lost, then 50%, then 25%, then none.
  - **Winning:**
    - when the Sky King falls, its guards lay down their arms;
    - the island becomes your land: you can build anywhere on it, held beyond your border;
    - the Stone King names you Lord of the Sky, sends 64 gold, and speaks to you as such;
    - the ending screen tells the dark path's end, at whatever age you're at, and says if there are still ages to finish. The white path's ending tells its own.
  - Still to come: the expedition on the map, going home in disguise, and cutting the chains.
- **The alliance:**
  - after you forge the Black Ring the Stone Kingdom becomes your ally;
  - its people are friendly, its gates open, and you can trade there;
  - swear in its temple and the Stone King gives you **1,000 warriors** (Decision 3).
- **The Sky Kingdom** only exists on this path.
  - It's a **floating island** 5,000 blocks away.
  - Its underside is rock, with waterfalls pouring off its edge.
  - On top are white marble halls and gold roofs, with **fireflies** drifting over it and lighting it all night.
  - Its great chains run down to anchor towers on the ground (Decision 4).
  - Seen from afar, it's a light in the sky on the horizon, which pulls you towards it.
- **The march:**
  - 5,000 blocks is about 15–20 minutes of walking;
  - the army marches with you in formation, and you can pitch a **camp** that saves where you are and feeds the troops;
  - or send the army ahead as an **expedition** on the map. It costs food per warrior per day, and you join it at its camp.
- **Commanding the army:** a command wheel on the same thumb buttons: follow, hold here, attack that, form a line.
- **Ways to take the Sky Kingdom:**
  1. **Storm it:**
     - take an anchor tower and ride its lift up, or build a siege tower to the island's edge;
     - fight across the island with warriors, catapults, archers and the black guardian;
     - take the palace.
  2. **Go home in disguise:**
     - you were born there; in Sky armour, with a few picked warriors, you walk in as one of them;
     - reach the throne room and take the Sky King;
     - guards grow suspicious if you run, carry dark weapons, or linger, shown by a suspicion meter;
     - if you're caught, it becomes open battle.
  3. **Cut the chains:**
     - take every anchor tower and break its chain;
     - the island sinks lower each day until it has to yield.
- **Victory:**
  - the Sky Kingdom falls and its island joins your land;
  - the Stone King honours you;
  - the victory screen tells the end of the story.
- **Losing:** you're driven back to your castle and the Sky Kingdom **taxes you** until you conquer it (Decision 2).
  - A "Taxes" line shows on each building's panel.
  - Rally again whenever you're ready.
  - Warriors lost are replaced by the Stone King, in fewer numbers each time.

---

## Telling the story (7j)

- **Opening:** a short illustrated intro on a new world.
  - The Sky Kingdom glowing among its fireflies.
  - The Stone army at its chains.
  - The fall, and the flight down to the ground.
  - Arriving somewhere far from anywhere.
- **Messengers and the hermit** carry the story, with lines tied to your age, your Temple and your path.
- **A lore book** in the Goals panel fills in as you learn: the two gods, the two kingdoms, and your guardian.
- **The ages get new names** to fit the story, for example "Exile" … "Reckoning".
- **Each path has its own ending.**

---

## What has to exist first

| Needed | Comes from |
|---|---|
| Health, damage, death, respawn | Phase 6 |
| Hostile AI that walks, finds a way round walls and attacks | Phase 6, extended to squads here |
| Projectile physics: catapults, archers, rams | Phase 6 |
| Far terrain drawing buildings, the city, and the island in the sky | Task #130 |
| Big multi-chunk sites (city, floating island) from the seed | New in 7e; landmarks.js is the small version |
| Groups of NPCs moving together and taking commands | New; settlers and tamed animals are the start |
| Fireflies (lit particles) | New, for the Sky Kingdom and the white victory |
| Saving the path, rounds, army, kingdoms and taxes | Extends the Duilt save, with a migration |

---

## Order

1. **7a** Decorative blocks. Independent, useful straight away.
2. **7b** Armour and rings (needs Phase 6).
3. **7c** Temple and the choice.
4. **7d** Sanctuary and guardian.
5. **7e** The Stone Kingdom.
6. **White path:** the Ten Rounds — **done** (war at Age 6, the rounds, siege, war horn, victory). The defence buildings — **done** too.
7. **Dark path:**
   1. the alliance, the army and the march — **done** (oath, army, command wheel, rations, camp; the map expedition still to come);
   2. the Sky Kingdom and its anchor towers;
   3. the three ways to take it;
   4. taxes if you lose.
8. **7j** Story, woven in along the way and finished last.

Each step ships the same way as before: tests, a check at phone size in the browser, a PR, merge.
