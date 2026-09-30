# Phase 7 — The Exile, the Two Faiths and the Dark Kingdom

The big one, after everything already on the list: the open tasks (#129–#133) and **Phase 6 (combat)**. Most of this depends on Phase 6, which adds:
- health, death and respawn;
- a sword, and hostile bandits;
- catapults with real projectile physics.

Source: the lore note, "Duild new idea for lore".

---

## The story, as the game will tell it

- **Where you came from.** You come from a people who pray to a god with no name. A great army came under the banner of another god, a dark one, and burned your home. You fled with what you could carry, far from anywhere, and started again.
- **What's coming.** The army hasn't stopped. It is on its way, starting about 1,000 blocks from your settlement, and every day it comes closer. You have that long to build walls, raise soldiers and get ready.
- **Two gods.** Behind it all are the two gods: the Nameless, who is white, and the dark one. Both can be called on through a **Temple**. At the Temple's height you can forge two rings, a white one and a black one. Build a matching **Sanctuary**, and that faith's guardian creature comes to you and serves whoever called it.
- **Where the army comes from.** The **Dark Kingdom** lies about 5,000 blocks away: a walled city with a castle, a king and a massive army. There are several ways to take it:
  - an open war, with your army, your guardian, catapults and archers;
  - a small band slipping in disguised to take the king;
  - any other strategy that works.
- **If you lose.** You go back to your castle and pay the Kingdom taxes until you are strong enough to try again.

---

## Assumptions to confirm

Each of these changes what gets built, so I've written down what I'd do. Say if any is wrong.

1. **"The black ring damages other players."** Duilt is single-player. Real multiplayer would be a whole separate project.
   - **Proposed:** the black ring's spark hurts anyone who strikes you: soldiers, bandits, the guardian of the other faith.
2. **"Until 1000 blocks."**
   - **Proposed:** the Host (the army that burned your home) starts 1,000 blocks from your settlement and advances a set distance each in-game day. You see it coming on the map, and when it arrives it lays siege.
   - **Pacing:** it only starts moving at **Age 3**, so a new world isn't under a clock from minute one, and it arrives at about **Age 5**.
3. **The Host and the Kingdom are the same enemy.** The Host is the Kingdom's vanguard.
   - Beating it at your walls buys time, and it re-forms and comes again later.
   - Taking the Kingdom ends the war for good.
4. **"The black makes the enemy friendly."**
   - **Proposed:** the Kingdom worships the dark god. If you summon the **black** guardian, they treat you as one of their own. Guards let you through the gates, you can trade in the city, and the Host stops marching. That opens the quiet ways in: infiltration, diplomacy, a coup.
   - The **white** guardian is the war path. It's stronger in battle, and strongest against the dark army.
5. **One guardian per world.** Both rings can be forged, but only one Sanctuary can call its guardian, so choosing one is choosing your path.
6. **Taxes on defeat.**
   - **Proposed:** a quarter of everything your buildings produce goes to the Kingdom as tribute, collected at the market.
   - Nothing of yours is destroyed.
   - You can rise again whenever you're ready, and each failed rising raises the tribute.

---

## The parts, in the order they'd be built

### 7a. Decorative block pack (no dependencies, so it can come first)
The Kingdom needs these to look like a real city, and players get them too.
- **Stone wall:**
  - joins up like a fence, and wraps round the corners of stairs and walls;
  - comes in cobble, stone, brick and dark stone.
- **Pillars that stack:** base, shaft and capital are chosen by what's above and below, worked out when drawn, the way corner stairs are. In stone, marble and dark stone.
- **Trapdoors:** they open and close with Place, like gates, and can go flat on a floor or up against a wall.
- **Windows:** a framed glass pane in wood or iron, with crossbars. It joins along a wall like a fence does.
- **Timber-framed walls:** plaster panels with wood beams. The pattern of the beams (straight, cross, diagonal) is chosen by position, so a wall doesn't repeat.
- **Vases and urns:** clay and painted, as props.
- **Banners:**
  - hang on walls;
  - come in white (the Nameless) and black (the dark god);
  - carry a symbol for each faith.
- **Dark stone and dark bricks:** the Kingdom's own building materials.
- Each piece needs:
  - a shape and collision;
  - its icon in the bag;
  - a recipe at the bench;
  - tests like the ones stairs and doors already have.

### 7b. Equipment: armour and rings
- **Slots:** new slots in the bag for **armour** (head, body, legs) and a **ring**.
- **Armour sets, each themed to its realm:**
  - **Leather:** simple, from hide.
  - **Your people's:** pale steel with the Nameless's sun mark, from iron and silver.
  - **The Kingdom's:** blackened iron with the dark sigil. This set comes from their soldiers and armouries; it can't be crafted at first.
- **What armour does:** it takes damage off each hit (it needs Phase 6 health).
- **Wearing the Kingdom's armour** is a **disguise**: its guards take you for one of their own (see 7h).
- **Seeing it:**
  - settlers and soldiers are drawn wearing their armour;
  - you see yours on your arms in first person, and on the body in third person.

### 7c. The Temple and the faith
- **Temple** is a new building, from Age 3.
  - **To qualify:** an altar block, sitting space (pews), and a floor that's a good share stone or marble.
- **Levels**, using the same level ladder buildings already have: Shrine → Chapel → Temple → Great Temple → High Temple.
  - Each level asks for more of the building (bells, windows, pillars, banners) and more **devotion**.
- **Devotion** is a new resource.
  - The Temple makes it from offerings of food, gold and candles.
  - More settlers who worship there means more devotion.
- **What each level unlocks along the way:**
  - blessings, such as a short-lived buff on crops or on your walls;
  - the white and black banners;
  - holy water, which heals.
- **At the top level, the Temple forges the two rings:**
  - **White Ring:** faster movement and a higher jump.
  - **Black Ring:** a dark spark that hurts whoever hits you.
  - Rings cost devotion plus rare materials: gold and amethyst for white, obsidian for black.

### 7d. Sanctuaries and the guardians
- **White Sanctuary and Black Sanctuary:** two new buildings, each with its own style and rules (open marble and light for white, obsidian and a pit for black).
- **Building one summons its guardian,** with an event and a sound. The guardian is **tamed to you.**
  - **White guardian:** a great winged stag of light. It's fast, heals your soldiers near it, and is strongest against dark troops.
  - **Black guardian:** a shadow beast. It's heavy and frightening: enemies near it lose their nerve and break formation. It also makes the Kingdom friendly (Assumption 4).
- **Guardian behaviour:**
  - it follows you, holds position or attacks, from the same command wheel as the army;
  - it has health and can be downed;
  - if downed, it returns to its Sanctuary after a day.
- **One per world** (Assumption 5). Building the second Sanctuary is refused, with a message saying why.

### 7e. The Host and the defence of home
- **The Host:**
  - it is tracked as a position on the world map, not as live soldiers far away;
  - it moves each day from Age 3;
  - messengers (the wanderers that already exist) bring news: "The Host is 600 blocks east".
- **When it's close,** real soldiers come into being at the edge of view and march on your settlement: waves of infantry, archers, and later a battering ram.
- **Defence buildings:**
  - **Stone walls and a gatehouse:** a new "Walls" building that counts a closed ring of wall round your land.
  - **Watchtower:** archers from your Military building shoot from it.
  - **Barracks:** the Military building upgraded. It trains soldiers from settlers.
  - **Catapult:** from Phase 6. Crewed by soldiers, it fires on siege engines.
- **Siege rules:**
  - enemy soldiers break blocks with real projectile physics: rams on gates, catapults on walls;
  - your claimed buildings take damage and have to be repaired.
- **Outcome:**
  - Win, and the Host retreats and takes days to re-form.
  - Lose, and you fall under **tribute** (7i).

### 7f. The Dark Kingdom, generated
- **Where it is:** about 5,000 blocks from home, in a direction fixed by the world seed, and always on flat, open land.
- **How it's built:**
  - from the seed, chunk by chunk, the way trees and landmarks already are, so any chunk can be made on its own and it looks the same every time;
  - it spans many chunks, so it needs a "big site" generator that decides the whole plan once and lets each chunk fill in its own part.
- **What's in it:**
  - an outer ring of stone walls with towers and a gatehouse;
  - streets;
  - houses, markets, a tavern, a granary, barracks and an armoury, all in the new dark style (dark stone, timber frames, black banners, windows, pillars);
  - in the middle, a castle keep with a **throne room and the King**.
- **Seen from afar:** its walls and towers draw on the horizon, which needs far terrain to draw buildings (#130). You see it long before you reach it.
- **Its people:**
  - guards on the walls and gates, patrols in the streets, citizens, and the King with his guard;
  - only the people near you are simulated;
  - the size of its army is a number, drawn down by losses.
- **Found or not:** it's marked on the map once a messenger tells you where, or once you see it.

### 7g. Your army and the march
- **Recruiting:** the Barracks turns settlers into soldiers when they have weapons and armour (swordsmen, archers, and catapult crews).
- **Commanding:** a command wheel, using the same Break/Place thumb buttons.
  - Commands: follow, hold here, attack that, form a line.
  - Soldiers keep formation round you as you walk.
- **The march:** 5,000 blocks is about 15–20 minutes of real walking.
  - **Proposed:** the army marches with you in real time, and you can pitch a **camp** (a portable building) that saves where you are and feeds the soldiers.
  - Or an **expedition**: send the army ahead on the map. It costs food per soldier per day and arrives after a set number of in-game days, and you join it at its camp.
- **Supply:** soldiers eat. With no food, morale drops and soldiers go home.
- **Phones:** a cap on how many soldiers are live at once (around 30–40). Anything beyond that is a count shown on the banner.

### 7h. Ways to take the Kingdom
Each one is a real way to win, not a cutscene.
1. **Open war:** army, guardian, catapults and archers against the walls.
   - Breach a wall or break the gate.
   - Fight through the streets, take the keep and defeat the King's guard.
2. **Take the King in secret:**
   - put on the Kingdom's armour and walk in with a small band;
   - reach the throne room and seize the King.
   - Guards grow suspicious if you run, carry the wrong weapons, or stand close to them too long, shown by a suspicion meter.
   - If you're caught, the alarm is raised and it becomes open war inside the walls.
3. **Starve it:**
   - the Kingdom's granary and roads are real;
   - burn the granary or hold the roads, and its army dwindles day by day until it has to yield.
4. **Turn it (black path only):**
   - with the dark guardian at your side they call you kin;
   - build enough standing with them (trade, gifts to their temple) and you can take the throne without a fight, or turn the court against the King.
- **Victory:**
  - the Kingdom becomes yours as a vassal;
  - its land joins your territory, as a separate claim on the map;
  - it sends you tribute;
  - the Host is disbanded for good.

### 7i. Defeat and tribute
- **What counts as a defeat:** your army is routed at the Kingdom, you are captured, or the Host takes your settlement.
- **Afterwards:** you wake at your own castle, the Village building from Age 6.
  - The Kingdom takes **tribute**: a quarter of what your buildings make, collected at the market each day (Assumption 6).
  - A "Tribute" line appears on every building's panel so you can see what it costs you.
- **Rising again:** start any of the 7h paths again once you're ready. Each failed rising raises the tribute a step, and a victory ends it.

### 7j. Telling the story
- **Opening:** a short illustrated intro on a new world. The fire, the flight, the long road, and arriving.
- **Messengers and the hermit** carry the story forward with lines tied to your age, the Host's distance and your faith.
- **A lore book in the Goals panel** fills in as you learn things: the two gods, the Kingdom, the King's name, and your guardian.
- **The ages get renamed** to fit the story, for example "Exile", "Settlement" … "Reckoning".

---

## What has to exist first (foundations)

| Needed | Comes from |
|---|---|
| Health, damage, death, respawn | Phase 6 |
| Hostile AI that walks, finds a way round walls and attacks | Phase 6, extended to squads here |
| Projectile physics for catapults, archers and rams | Phase 6 |
| Far terrain drawing buildings | Task #130 |
| Big multi-chunk sites generated from the seed | New in 7f; landmarks.js is the small version |
| Groups of NPCs moving together and taking commands | New in 7g; settlers and tamed animals are the starting point |
| Saving army, Host, Kingdom and faith state | Extends the Duilt save, with a migration |

---

## Size and order

This is about as much work as everything built so far. Suggested order, each shipping on its own:

1. **7a Decorative blocks.** Independent and useful straight away.
2. **7b Armour and rings.** It needs Phase 6 health.
3. **7c Temple and faith.**
4. **7d Sanctuaries and guardians.**
5. **7e The Host and home defence.** This is the first taste of war.
6. **7f The Dark Kingdom.**
7. **7g Army and march.**
8. **7h Ways to win,** one path at a time: war first, then infiltration, starving it out, and turning the court.
9. **7i Defeat and tribute.**
10. **7j Story presentation,** woven in along the way and finished last.

Each step ships the same way as before: tests, a check at phone size in the browser, a PR, merge.
