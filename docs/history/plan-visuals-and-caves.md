# Visual finishing and caves implementation plan

**Goal:** Finish the approved villager/stone/foliage pass, then implement WORLD-4 from docs/TASKS.md.
**Architecture:** Keep procedural 32px block textures and the existing Blender box/bone pipeline. Add deterministic underground galleries and ruins to ChunkGen without changing existing saved chunks.
**Tech stack:** Three.js, JavaScript, Blender Python, Node tests.
**Spec:** Owner approval in chat: improve villagers with collars/cuffs/pockets/layered clothing/hair/accessories; cleaner stone textures; distinct white and pink leaves; then big deep caves, galleries and ruins.

## Constraints and review focus
- Preserve unrelated working-tree changes, approved explorer/cow/dinosaur/chicken assets, and scene lighting.
- Stable block IDs and item mappings; foliage variants must gather, sway, and decay.
- Cave features must be seeded, order-independent, continuous across negative/positive chunk boundaries, and protected by bedrock and a surface roof.
- Keep the settlement and Future foundations intact; ruins must have supported floors and accessible loot.
- Rebuild actual villager GLBs, retain bone names/animations, inspect exported renders, and check mobile-sized geometry.

## Execution
- [x] Verify existing targeted tests and add failing leaf integration assertions.
- [x] Add white/pink foliage, natural tree variants, and quieter structured stone textures; inspect a rendered contact sheet.
- [x] Detail all six settlers and four citizens in the Blender source, export only those GLBs, inspect renders and verify assets.
- [x] Add failing deterministic gallery/ruin/bedrock/surface tests, implement regional galleries with descending connections and ruins, verify generated chunks.
- [x] Run relevant tests, full suite and production build. Review the diff and update only corresponding task statuses; leave direct device checks open.

## Execution ledger
- Working in place: the task list and game have existing edits required by this request; no unrelated changes will be committed or reset.
- Portable official Blender 4.5.3 used because this machine has no callable Blender MCP server or bpy package. Existing builder/exporter functions were reused; only ten approved villager GLBs were regenerated. Models retain animation bones, 300–336 triangles, and stay below 100KB each.
- Review found an upper-hall floor blocking the connector; reproduced with a failing real-terrain test, fixed floor overlap, and checked both ramps continuously. Visual inspection then moved the passages to the gallery edges to leave the ruined nave open.
- Added a compost pile model to finish the remaining generic held-item/icon fallback.
- Browser loaded all ten GLBs with textures and game bone conversion, and rendered the actual cave mesher without JavaScript errors. Preview: art/review/visuals-and-caves.png.
- Full-suite baseline includes unrelated failures and an existing compost/curled-trim ID collision (513–515); those are outside this batch. New Pink Leaves uses unique ID 517. Existing work is changing concurrently, so only task-specific hunks are edited.
- Final focused review verified connector treads/headroom for five seeds with no remaining findings. Full-suite run: 7,128 passed / 18 failed across 251 files. Its newly exposed pink-foliage border failure was fixed in Territory and the ground-height classifier, and bordercurtain passed all eight checks afterward; remaining failures are outside this batch. Relevant foliage, cave, GLB, texture, icon, forest, leaf, sapling, endless-world, temple and mesh checks pass. Production build passes. Phone playtest remains open in docs/TASKS.md.
