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

## Next
- **Phase 7:** the plan is in `docs/plan-phase7-lore.md`. Start with 7a, the decorative block pack.
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
