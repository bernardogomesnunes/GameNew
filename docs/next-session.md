# Where to pick up — after the playtest list

## The whole playtest list is done (PR #29)
Everything in `docs/plan-playtest-improvements.md` (P1–P9) is in, each with its own test file:
- **P1 Homes:** beds, and a painting that sets where you wake; furnished houses (`homes.test`).
- **P8 Saplings:** a 3D sapling that grows into a tree in 10 game days. None are generated; leaves drop them (`saplings.test`).
- **P5 Drinks:** beer, kombucha and coffee, each a timed boost with a countdown chip. Coffee is a new crop (`drinks.test`).
- **P4 Places to find:** ruins, forgotten temples, abandoned mines and monuments, each with a chest. They're found on the map (`places.test`).
- **P6 Upgrades:** a boots slot; Swift, Warded and Night Sight armour; thunder, fire and ice swords; swords are 3D (`upgrades.test`).
- **P9 Roads:** calçada blocks, and old roads joining every landmark to home (`roads.test`).
- **P2 Forests:** leaves with their own tones, light and shade (`forests.test`).
- **P3 + P7:** a third-person view with your own avatar, what you hold drawn in 3D, and detailed animals and people (`avatar.test`).

## 7e, the Stone Kingdom, is done too
A walled city of dark stone, about 1000–1400 blocks from home: a keep with the Stone King, guards, a dark temple, an armoury, barracks, a market, houses and an old road to its gate. It shows on the horizon, and so do your own builds (#130). See `docs/plan-phase7-lore.md`.

**Done:** the war — borders 32 → 320, locked until Age 6; reaching Age 6 opens the wall and the Stone Kingdom declares war (ring or not); ten rounds with archers, rams, siege catapults and the Warlord on his beast; war horn; Black Ring calls it off; victory blesses your land with fireflies.

**Done:** the defence buildings — stone wall, gatehouse, watchtower, barracks, each detailed, from Age 5. Walls take three blows a block; the gate shuts for a round; two archers on every tower; a soldier for every bunk.

**Done:** the dark path, part 1 — the oath at the dark altar, 1,000 warriors (30 on the ground at once), the ⚔ banner and command wheel, daily rations, the war tent and campfire.

**Done:** the dark path, part 2 — the Sky Kingdom: the floating island 5,000 blocks out, a walled city of houses, barracks, armouries and training yards round a citadel (Black Ring and Creative only), its palace and throne room, four anchor towers with chains and lifts, its guards and King, its light low in the sky, and its fall as the dark path's end (`sky.test`).

**Done:** the rest of the dark path — taxes after a lost attack, cutting the chains, the island joining your land, the disguise and its suspicion meter, and the expedition on the map (send the army ahead; join it at its camp).

**Done:** the story told in pictures — an illustrated intro on a new world, and an illustrated ending for each path (`ui/Story.js`).

**Done:** the ages renamed for the story — Exile, Roots, Forge, Hearth, Bastion, Reckoning.

**Next:** the rest of the story (7j) — messengers' and the hermit's lines, and the lore book.

# Before that — Phase 6

Phase 6 (combat) is finished:
- **6a:** ten hearts, fall and lava damage, healing (faster resting in a house), dying leaves a chest with everything but your tools, and the craftable 27-slot chest.
- **6b:**
  - wood, stone and iron swords made at the bench (damage 4 / 6 / 9);
  - bandits hostile from Age 2: they come at you near their camp (further at night), hit for a heart, and run when badly hurt;
  - most nights 2–3 raiders walk in from the nearest camp to rob a storehouse, or come for you if you have none;
  - beat a raider and you get back what they took.
- **6c:**
  - the catapult, built at the bench from Age 3;
  - Place mans it; you aim by looking where the stone should land, and the arc and a ring show where it will;
  - Break throws a stone from your bag. It lobs at 50°, or 70° to clear a wall, with the force set to the distance;
  - where a stone lands it knocks out a crater and hurts bandits and animals under it. Your claimed buildings, chests and bedrock are spared.

## Phase 7a is done too
The decorative pack: dark stone and dark brick; sky-marble, gold trim and firefly lanterns; timber framing; walls that join like fences; pillars that stack into one column; trapdoors that open with Place; framed windows with see-through glass; vases, urns and both banners. All are made at the bench (`tests/decor.test.mjs`).

## Phase 7b is done too
Armour and the ring slot (`config/armour.js`, `tests/armour.test.mjs`):
- **Wearing:** the bag has a Wearing row for head, body, legs and ring. Lift a piece and tap its place to put it on; tap what you're wearing to take it off.
- **Sets:** leather (4 points), Sky (white steel and gold, 9) and Stone (blackened iron, 9).
- **What it does:** each point takes 4% off a blow from a bandit or a catapult stone, never less than half a heart. It does nothing for falls or lava. Every blow wears it.
- **Disguise:** a full Sky set makes `DuiltGame.disguisedAs()` return 'sky', for the dark path later.
- **Ring:** the slot waits for the ring forged at the Temple (7c).

## Phase 7c is done too
The Temple, devotion and the rings (`tests/temple.test.mjs`).
- **Ring ores:** Sunstone and Nightstone are rock with glowing crystals. They only form on cave walls below y 30, about 0.3 per chunk (`ChunkGen.ringOreAt`).
- **Loot chests:**
  - one in the hermit's hut, one in each bandit camp, and about one per 16 chunks on deep cave floors;
  - contents are rolled from position the first time a chest is opened or broken (`duilt/Loot.js`, `Game.unpackFound`);
  - a chest sometimes holds a ring ore.
- **Temple:**
  - Age 3; climbs Shrine → Chapel → Temple → Great Temple → High Temple;
  - each level is built (windows, lights, pillars, gold trim, banners) and then paid for in devotion when you evolve it;
  - it makes devotion, more with worshipping settlers, and offerings at the Temple add more;
  - the starter design is a Shrine on a 9×9 platform, leaving room to grow.
- **Temple recipes:**
  - offerings turn food, gold or a lantern into devotion;
  - holy water needs a Chapel and heals four hearts when you drink it;
  - the rings need the High Temple, and forging one closes the other for good (`DuiltGame.ring`);
  - the White Ring (Sunstone and gold) gives 1.2× speed and 1.3× jump;
  - the Black Ring (Nightstone and obsidian) sparks back at a bandit that hits you.

## Phase 7d is done too
The Sanctuary and the guardian (`tests/sanctuary.test.mjs`).
- **The Sanctuaries:**
  - White: marble, lights, open sky. Black: obsidian or dark stone round a pit.
  - Each can only be raised by the bearer of its ring (`DuiltGame.ringRefuses`), and has a starter design and an achievement.
- **The guardian** comes when your Sanctuary is claimed (`world/Guardian.js`, `render/GuardianView.js`):
  - Aurelion, the white stag: fast, and heals you while you're near it;
  - Umbra, the shadow beast: bandits near it lose their nerve and run (`Wanderers.scare`);
  - both fight bandits and take blows back.
- **Orders:** tap it to cycle follow → stay → hunt. This stands in for the soldiers' command wheel, which comes later.
- **Downed:** it goes back to its Sanctuary and returns after a day of play (900 s). It's saved with the world.

## Next — what's on the plan now
1. **Look, feel and sound** (`docs/plan-look-and-sound.md`), asked for after the Sky city:
   - a showcase world to judge changes by;
   - colour, light and shadow where blocks meet;
   - 32×32 textures from real photos;
   - atmosphere;
   - animals and people remodelled (faces, bodies, outfits, wool);
   - items reviewed;
   - recorded sounds and music.
2. **The rest of the dark path:** done.
3. **The story (7j):** the intro, messengers' lines, the lore book, age names, an ending for each path.

## Earlier notes
- **Phase 7:** the plan is in `docs/plan-phase7-lore.md`. Next up is 7e, the Stone Kingdom, or the white path.
- **Playtest improvements:** from the user's own play session, in `docs/plan-playtest-improvements.md`:
  - P1: bed, painting spawn point, furnished houses;
  - P2: forest lighting;
  - P3: mob models, third-person avatar;
  - P4: ruins, temples, mines and monuments with chests;
  - P5: beer, kombucha and coffee;
  - P6: upgraded armour and elemental swords.
  - These can go in between lore steps; the user picks the order.
- Still open:
  - far terrain should show what the player built (#130);
  - sound: music, ambience and separate volume sliders (#133).

## Where things are
- **Health:** `src/survival/Health.js`. All damage goes through `DuiltGame.hurt(amount, cause, opts)`, which does nothing in Creative.
- **Bandits:**
  - behaviour in `src/world/Wanderers.js` (`fight`, `raids`, `hit`), stats in `src/config/wanderers.js`;
  - wired up in `Game.syncMobs` and `Game.hitBandit`.
- **Catapult:**
  - flight in `src/world/Projectiles.js` (`aimAt`, `bestAim`, `fly`, `craterCells`), drawn by `src/render/ProjectileView.js`;
  - controls in `Game.manCatapult`, `tickCatapult`, `throwStone` and `stoneLands`.
- **Tests:** `tests/health.test.mjs`, `tests/combat.test.mjs`, `tests/catapult.test.mjs`.
