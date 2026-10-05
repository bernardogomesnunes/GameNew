// The pixel font (asked for: "a pixel art kinda look and feel"), bundled
// with the game rather than fetched from a font service: it's the face of
// every screen, and it shouldn't arrive a second late, or not at all offline.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/styles.css';
import { Game } from './Game.js';

const app = document.getElementById('app');
const game = new Game(app);
if (import.meta.env.DEV) window.__game = game;
