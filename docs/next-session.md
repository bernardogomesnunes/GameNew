# Where to pick up — Phase 6c (catapults)

Phase 6a and 6b are finished:
- **6a:** ten hearts, fall and lava damage, healing (faster resting in a house), dying leaves a chest with everything but your tools, and the craftable 27-slot chest.
- **6b:**
  - wood, stone and iron swords made at the bench (damage 4 / 6 / 9);
  - bandits hostile from Age 2: they come at you near their camp (further at night), hit for a heart, and run when badly hurt;
  - most nights 2–3 raiders walk in from the nearest camp's side to rob a storehouse, or come for you if you have none;
  - beat a raider and you get back what they took. Hitting a bandit before Age 2 turns its camp on you.

## Decided with the user
- **Catapults (6c):** a buildable siege engine you aim and fire. Stones fly on real arcs and break blocks where they land.

## Where things are
- **Health:** `src/survival/Health.js`. Damage goes through `DuiltGame.hurt(amount, cause, opts)`, which does nothing in Creative.
- **Bandits:** `src/world/Wanderers.js` (`fight`, `raids`, `hit`) and `src/config/wanderers.js` (stats). Game wires them in `syncMobs` (hostile/night/stores/onAttack/onSteal/onRaid) and `hitBandit`.
- **Swords:** `src/config/items.js` and `src/config/recipes.js`. Strikes go through `Game.breakBlock` → `hitBandit` → `hitMob`, with `STRIKE_COOLDOWN_MS`.
- **Tests:** `tests/health.test.mjs`, `tests/combat.test.mjs`.
