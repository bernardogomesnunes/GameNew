import { readFileSync } from 'node:fs';
import { EventBus } from '../src/core/EventBus.js';
import { GamificationEngine, killXp } from '../src/gamification/GamificationEngine.js';
import { BLOCKS } from '../src/config/blocks.js';
import { ACHIEVEMENTS } from '../src/config/achievements.js';

/**
 * Asked for directly: "remove the experience by placing and stuff, experience
 * should come from goals, and each one gives some experience. Plus killing
 * players and mobs should give exp too" — and "avoid soft blocking the game".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const fakeWorld = { surfaceHeight: () => 0, getBlock: () => 0 };
const g = new GamificationEngine(new EventBus());
const before = g.state.xp + g.state.level * 1e6;
for (let i = 0; i < 50; i++) g.onBlockPlaced({ world: fakeWorld, x: i, y: 5, z: 0, type: 3 + (i % 5), now: 1000 + i });
// First-block goals can pay; take those out and nothing else is left.
const fromGoals = [...g.state.achievementsUnlocked].reduce((n, id) => n + (ACHIEVEMENTS.find((a) => a.id === id)?.xpReward ?? 0), 0);
const total = (e) => { let xp = e.state.xp; for (let l = 1; l < e.state.level; l++) xp += Math.floor(100 + (l - 1) * 75); return xp; };
ok('placing blocks pays nothing in itself', total(g) - fromGoals === 0 && before >= 0);
ok('every goal pays something', ACHIEVEMENTS.every((a) => a.xpReward > 0));

const k = new GamificationEngine(new EventBus());
const got = k.onKill({ kind: 'mob', hp: 9 });
ok('a hunt pays: twice the animal\'s strength', got === 18 && total(k) === 18);
ok('a fight pays: as much as the person took to beat', killXp('person', 12) === 12 && killXp('person', 80) === 80);
ok('never less than 3', killXp('mob', 1) === 3);
const sand = new GamificationEngine(new EventBus());
sand.setDuilt({ sandbox: true });
ok('and nothing in Creative', sand.onKill({ kind: 'person', hp: 20 }) === 0 && total(sand) === 0);

ok('no block waits on a level or an achievement', BLOCKS.every((b) => !b.unlock));

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('your own kills count: hunting, fighting, a burning sword, the ring, a catapult',
  /if \(!mob\.penId\) this\.gamification\.onKill\(\{ kind: 'mob'/.test(game) && (game.match(/this\.personKilled\(p\);/g) ?? []).length >= 4);
ok('not your own penned animals', !/gamification\.onKill\(\{ kind: 'mob'[^\n]*\n[^\n]*forgetAnimal/.test(game) && /if \(!mob\.penId\)/.test(game));

process.exit(f ? 1 : 0);
