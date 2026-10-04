import { readFileSync } from 'node:fs';

/**
 * Reported directly: "The goals to break items, place them and place 40
 * blocks are not working it does not count." They did count — the account's
 * own progression had all three — but a finished card looked like an
 * unfinished one, and the counting goals said nothing while they counted.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { ACHIEVEMENTS_BY_ID } = await import('../src/config/achievements.js');
const { progressionAhead } = await import('../src/Game.js');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

const walls = ACHIEVEMENTS_BY_ID.get('first_walls');
ok('"Four walls" shows how far along you are', walls.progress({ stats: { totalBlocksPlaced: 12 } }) === '12/40');
ok('and stops at 40', walls.progress({ stats: { totalBlocksPlaced: 589 } }) === '40/40');
ok('the roof goal counts too', ACHIEVEMENTS_BY_ID.get('first_roof').progress({ stats: { totalBlocksPlaced: 30 } }) === '30/100');
ok('a done goal is marked done, with a tick', /class="ach-card \$\{isDone \? 'done' : 'locked'\}/.test(ui) && /<span class="ach-done" aria-label="Done">✓<\/span>/.test(ui));
ok('and looks it', /\.ach-card\.done \{ background: rgba\(41, 158, 138/.test(css) && /\.ach-done \{/.test(css));

// Saved progression merges by level, then xp within it.
ok('level 9 with 23 xp is ahead of level 1 with 40', progressionAhead({ level: 9, xp: 23 }, { level: 1, xp: 40 }));
ok('and not the other way round', !progressionAhead({ level: 1, xp: 40 }, { level: 9, xp: 23 }));
ok('the same level goes by xp', progressionAhead({ level: 3, xp: 50 }, { level: 3, xp: 10 }));
ok('a fresh start is never ahead of anything', !progressionAhead({ level: 1, xp: 0 }, { level: 1, xp: 0 }));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('both the cloud and this browser merge that way', (game.match(/progressionAhead\((remote|local), this\.gamification\.toJSON\(\)\)/g) ?? []).length === 2);

process.exit(f ? 1 : 0);
