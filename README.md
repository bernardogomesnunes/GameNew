# Voxel Sandbox

A browser-based voxel building sandbox (Minecraft-creative-mode-style) built with Three.js and vanilla JavaScript. Runs entirely client-side — no backend, no build-time asset pipeline beyond Vite. Works on desktop (mouse + keyboard, pointer lock) and mobile (touch joystick, drag-to-look, on-screen action buttons).

## Running locally

```bash
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Controls

- **Move**: WASD · **Jump**: Space · **Fly toggle**: F (Space/Shift move up/down while flying)
- **Break**: Left click · **Place**: Right click · **Hotbar**: 1-9 or click a slot
- **Undo/Redo**: Ctrl+Z / Ctrl+Y (or the toolbar icons)
- **Selection tool**: B, then click two corners · **Symmetry**: M to cycle Off/X/Z/Both
- **Menu**: Esc · **Fullscreen**: entered automatically on Play, toggled with the ⛶ button

On touch devices the left thumb drives a virtual joystick, the right side of the screen drags to look, and on-screen buttons handle break/place/fly/jump/down/symmetry.

## Architecture

- `src/world/` — chunked voxel data (`World.js`), terrain generation (`TerrainGenerator.js`), and an instanced-mesh renderer with exposed-face culling (`ChunkMesher.js`). No gamification or UI code lives here.
- `src/player/` — first-person controller: WASD/mouse-look/touch input, gravity, AABB collision, fly mode.
- `src/interaction/` — a 3D DDA voxel raycaster used for break/place targeting.
- `src/tools/` — undo/redo stack, box selection + copy/paste, symmetry/mirror mode.
- `src/gamification/GamificationEngine.js` — XP/levels, achievements, daily challenges, streaks, unlockable blocks, and the end-of-session build score. Entirely decoupled from rendering; it only reads the world through its public query API.
- `src/config/` — `blocks.js`, `achievements.js`, `challenges.js`: plain arrays of config objects. Add a new block/achievement/challenge by adding an entry, not by touching engine logic.
- `src/storage/SaveManager.js` — localStorage persistence (RLE-compressed chunk data) with named saves + autosave.
- `src/ui/UIManager.js` — hotbar, XP bar, toasts, stats/achievements panel, save/load menu, and touch controls, all DOM-based and driven by an event bus.
- `src/Game.js` — wires everything together: scene/camera/renderer, the game loop, and the block-edit pipeline (apply → undo stack → chunk remesh → gamification hooks).

## Design notes on the gamification system

- XP per block placed is weighted, not flat: a first-ever use of a block type gives a one-time bonus, using more distinct types in a session raises a variety multiplier, and hammering the same block type past a soft cap tapers its XP off. This rewards varied, structured building over spamming one block.
- A "build session" is a period of continuous activity; a session auto-ends after 2 minutes of no block edits and pays out a completion bonus plus a build score (size/variety/height breakdown) shown to the player.
- Achievements cover milestones (first block, 100 blocks, using every block type), spatial heuristics (digging underground, bridging a gap, fully enclosing a space via flood fill), and meta-progression (level thresholds, streaks, challenges completed).
- Two daily challenges are picked deterministically from the calendar date, so every player sees the same rotation without a backend.
- Some blocks are gated behind level or achievement unlocks; a challenge can also grant early access to a gated block as its reward.

## Saving, exporting, and the cloud

Three tiers, deliberately, in increasing order of commitment:

1. **Local saves.** Named saves and a rolling autosave in `localStorage`. No
   account, no network. This is the default and it always works.
2. **Export.** `Export world` writes a `.voxworld.json` carrying the blocks,
   your progression, economy and every saved design — enough to restore the
   world exactly, on any device. `Export .vox` writes MagicaVoxel format, which
   opens in MagicaVoxel and Blender. Exports are the real backup: `localStorage`
   is per-browser and a cleared cache takes it with it.
3. **Cloud sync.** Optional, and behind a real account.

### Why cloud sync needs an account

A browser cannot safely talk to Postgres without a *verifiable* identity. Row
level security has to key off something, and a device id the client makes up is
not a something: anyone who guessed or copied one would read another player's
worlds, with no way to revoke it and no way to recover it when the device dies.
So sync is gated on signing in, and anonymous play stays entirely local. That is
a deliberate trade, not an oversight.

### How it is wired

- **Neon Auth** (Stack Auth) issues the JWT. The auth SDK is dynamically
  imported and only when the menu is first opened, so a player who never signs in
  never downloads it.
- **Neon Data API** (PostgREST) is the only endpoint. There is no server of ours
  in the path, which is the point: nothing to keep patched, and no Node runtime
  to age out from under the deploy.
- **Row level security** decides everything. The `authenticated` role can reach
  only rows that resolve to its own `players` row; the anonymous role has no
  grants on any game table at all. Verified: querying as `authenticated`
  without a matching identity returns zero rows from every table.
- **`SyncEngine`** hashes each chunk and uploads only the ones that changed, so
  save cost tracks what you edited rather than how big the world is.

The three `VITE_` values in `.env` are public by design — a publishable key and
a URL, both meant to ship in a browser bundle. Neither grants access on its own.
On Vercel, set the same three as Environment Variables.

Deleting a world from the cloud soft-deletes the row (a mistaken tap is
recoverable) and drops its chunks immediately, since those are the bulk of it.
Your local copy is never touched by a cloud delete.

## Notes on the selector

The box snaps to a grid of its own size on **all three axes**. That means the
block under your crosshair is always inside the box, the box does not slide
around as your aim drifts within a cell, and captured regions tile against each
other and against chunks — which is what lets achievements reason about a
template's dimensions at all. Its edges are drawn with depth testing off so the
cage stays legible from inside a build, and the blocks it contains get a skin
over their exposed faces, so what you see highlighted is exactly what a save
would capture.
