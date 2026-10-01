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

- **The rounds:** after you forge the White Ring, the dark army comes for your settlement in **10 rounds of raiders**.
  - There's a warning before each round: horns, and a messenger saying how many are coming and from where.
  - Rounds come every couple of in-game days.
  - You can sound your own **war horn** to call the next round early when you're ready.
- **The rounds get harder:**

  | Rounds | Who comes |
  |---|---|
  | 1–3 | Bandits on foot |
  | 4–6 | Archers, and a battering ram against your gate |
  | 7–9 | Stone soldiers in armour, and catapults against your walls |
  | 10 | The dark army's warlord, riding with a black beast of its own |

- **Raiders break blocks for real:** rams on gates and catapults on walls, using Phase 6 projectile physics. Your claimed buildings take damage and can be repaired.
- **Defence buildings:**
  - **Stone Walls and gatehouse:** a closed ring of wall round your land.
  - **Watchtower:** archers shoot from it.
  - **Barracks:** your Military building upgraded; it trains soldiers from settlers.
  - **Catapults:** from Phase 6.
  - **The white guardian** fights beside you.
- **Winning a round:** every raider in that round is down or fled.
- **Losing a round:** the raiders loot a share of your storehouses and the round comes again (Decision 1).
- **Victory after round 10:**
  - the dark army is broken and the raids end for good;
  - the white god's light settles on your land, with fireflies across your settlement at night;
  - the victory screen tells the end of the story.
- **The Sky Kingdom never appears** on this path. It isn't generated, it isn't on the map and it isn't on the horizon.

---

## Dark path — Conquer: the Sky Kingdom

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
6. **White path:** defence buildings and the Ten Rounds. This makes the white path complete first: a whole game with an ending.
7. **Dark path:**
   1. the alliance, the army and the march;
   2. the Sky Kingdom and its anchor towers;
   3. the three ways to take it;
   4. taxes if you lose.
8. **7j** Story, woven in along the way and finished last.

Each step ships the same way as before: tests, a check at phone size in the browser, a PR, merge.
