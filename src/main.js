// The pixel font (asked for: "a pixel art kinda look and feel"), bundled
// with the game rather than fetched from a font service: it's the face of
// every screen, and it shouldn't arrive a second late, or not at all offline.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/styles.css';
import { Game } from './Game.js';
import { loadingProgress, loadingDone, nextPaint, followDrawing } from './ui/loading.js';

// The game's code is here: on to making the world (see ui/loading.js).
loadingProgress(35, 'Building the world…');

(async () => {
  // Let that be drawn first: making the world holds everything else up.
  await nextPaint();
  const app = document.getElementById('app');
  const game = new Game(app);
  if (import.meta.env.DEV) window.__game = game;
  loadingProgress(60, 'Drawing the land…');
  // The land around the title scene, chunk by chunk — made faster while
  // this covers it (Game.booting).
  game.booting = true;
  await followDrawing(() => game.titleProgress(), { from: 60 });
  game.booting = false;
  loadingDone();
})().catch((err) => {
  console.error(err);
  loadingProgress(100, 'Something went wrong. Reload the page to try again.');
});
