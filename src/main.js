import './ui/styles.css';
import { Game } from './Game.js';

const app = document.getElementById('app');
const game = new Game(app);
if (import.meta.env.DEV) window.__game = game;
