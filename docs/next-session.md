# Where to pick up — Phase 6b (swords and hostile bandits)

Phase 6a is finished:
- ten hearts;
- fall and lava damage;
- healing, faster when resting in a house;
- dying: you respawn at home, and a chest with everything except your tools is left where you fell;
- the craftable 3D chest with 27 slots.

## Decided with the user
- **Swords:** wood, stone and iron, crafted at the bench, each hitting harder than the last. Tools also hit, but weakly.
- **Bandits:**
  - they turn hostile from Age 2;
  - they come out of their camps at night and go for you or your storehouses;
  - they flee when badly hurt.
- **Catapults (6c):** a buildable siege engine you aim and fire. Stones fly on real arcs and break blocks where they land.

## Where things are
- **Health:** `src/survival/Health.js`. Damage goes through `DuiltGame.hurt(amount, cause, opts)`, which does nothing in Creative.
- **Death:** `Game.die()` handles it, triggered by `health:died`.
- **Mobs:** `src/world/Mobs.js`, already hunted with `rayBox`.
- **Bandits:** wanderers in `src/world/Wanderers.js` and `src/config/wanderers.js`. Their camps come from `world/landmarks.js`.
- **Breaking:** strikes go through `Game.breakBlock` / `tickBreaking`, with `STRIKE_COOLDOWN_MS`.
