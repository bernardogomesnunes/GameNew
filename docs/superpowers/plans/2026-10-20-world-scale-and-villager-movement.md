# World scale and villager movement

**Goal / approved scope:** WORLD-1 broader ranges and rare huge peaks, WORLD-3 larger plains/flatter deserts, WORLD-2 distinct giant tree silhouettes, MOBS-1 stop villagers snapping onto roofs. Owner approved all four in chat.
**Approach:** Retain 200-block world height and deterministic coordinate-based generation. Broaden climate/range wavelengths, introduce rare seeded massifs with blended mountain biomes, flatten open-country relief, vary giant crowns inside the existing feature margin. Use existing creature collision helpers plus bounded local routes for settlers.
**Constraints:** Preserve unrelated local work, save IDs, starting plot, Past/Future geography, water access, and existing cave generation. Reuse ground height for distant rendering. No lighting/material changes.

## Tasks
- [ ] MOBS-1: reproduce crossing a four-block wall, retain real one-block steps, prevent large-dt tunnelling, route around a closed house, stop safely at unreachable or unloaded destinations. Keep stationary-floor recovery distinct from traversal.
- [ ] WORLD-1/3: test rare massif footprint/height, smooth borders, starting-area/era protection, plains/desert relief and deterministic chunks; implement in biomeMap, biomes, ChunkGen with focused massif module.
- [ ] WORLD-2: test three giant forms, crown coverage inside FEATURE_MARGIN, headroom, world ceiling and chunk order; implement in ChunkGen with seeded proportions and crowns.
- [ ] Run related tests and build, capture browser terrain/tree previews, request independent scoped review, fix findings, update docs/TASKS.md. Run full suite once and distinguish unrelated existing failures.

## Review focus
- Roofs, walls, low ceilings, one-block terraces, corners, large frame deltas and unreachable targets.
- New terrain crosses positive/negative chunk seams consistently and does not alter stored player-edited blocks.
- Massifs leave actual oceans, home foundations and special eras intact, with room above their summits.
- Giant branches/crowns never exceed the feature margin or block woodland paths.
- Changes in the working tree outside these four tasks are preserved.

## Ledger
- Working in the existing checkout to preserve the active local changes. No staging/reset/commit of unrelated work.
