import { readFileSync } from 'node:fs';
import { pixelIcon, PIXEL_ICONS } from '../src/ui/pixelIcons.js';

/**
 * Asked for directly: "a panel opens up with the buttons create new world or
 * open world, the account and settings. Let's give it a pixel art kinda look
 * and feel instead of the plain ui we have now. Then create a new world shows
 * the flow we have today, but clearly in the new ui. And open world shows the
 * list of the worlds. Delete should be a trash bin instead of a cross."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

// --- the menu ---------------------------------------------------------------------
ok('the front door is a menu', /return this\.renderMenu\(\);/.test(home));
ok('with Create new world', /data-new="1">\$\{pixelIcon\('plus', 20\)\}<span>Create new world<\/span>/.test(home));
ok('Open world, saying how many', /data-worlds="1">[\s\S]{0,120}Open world[\s\S]{0,120}px-count/.test(home));
ok('Account', /id="home-account"/.test(home));
ok('and Settings', /id="home-settings">\$\{pixelIcon\('gear', 16\)\}<span>Settings<\/span>/.test(home));

// --- the steps --------------------------------------------------------------------
ok('Open world is the list, on its own step', /if \(this\.step === 'worlds'\) return this\.renderWorlds\(\);/.test(home));
ok('Create is the same two steps as before', /this\.step = 'kind'/.test(home) && /this\.step = 'name'/.test(home));
ok('every step has a way back', (home.match(/px-back" data-back="1"/g) ?? []).length === 3);
ok('back from the list and from the kind goes to the menu, from the name to the kind',
  (home.match(/data-back\]'\)\.addEventListener\('click', \(\) => \{ this\.step = 'home'/g) ?? []).length === 2
  && /data-back\]'\)\.addEventListener\('click', \(\) => \{ this\.step = 'kind'/.test(home));

// --- delete is a bin ------------------------------------------------------------
ok('delete is a trash bin', /class="world-remove"[^\n]*\$\{pixelIcon\('trash', 18\)\}/.test(home));
ok('not a cross', !/icon\('close'/.test(home));

// --- pixel art ------------------------------------------------------------------
ok('the pixel icons are all there', ['trash', 'plus', 'open', 'person', 'gear', 'back', 'play'].every((n) => PIXEL_ICONS.includes(n)));
const bin = pixelIcon('trash', 18);
ok('drawn as crisp squares', /shape-rendering="crispEdges"/.test(bin) && /<rect /.test(bin) && !/<path/.test(bin));
ok('in the colour of the text round them', /fill="currentColor"/.test(bin));
ok('corners are stepped, not rounded', /clip-path: polygon\(/.test(css) && /--px-cut/.test(css));
ok('buttons press down', /\.px-btn:active \{ transform: translateY\(2px\)/.test(css));
ok('the pixel font is bundled with the game, not fetched', /import '@fontsource\/pixelify-sans\/400\.css';/.test(main) && /--px-font: 'Pixelify Sans'/.test(css));
ok('the name is a pixel logo in the sky', /<h1 class="px-logo">Duilt<\/h1>/.test(home) && /#blocker \.px-logo \{/.test(css));

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
