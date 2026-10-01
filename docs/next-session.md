# Where to pick up — after Phase 6

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

## Next
- **Phase 7:** the plan is in `docs/plan-phase7-lore.md`. Next up is 7d: your god's Sanctuary and its guardian.
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
