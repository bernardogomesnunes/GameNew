import { readFileSync } from 'node:fs';
import { talkLine, SETTLER_TALK, EXPLORER_TALK, JOB_TALK } from '../src/config/talk.js';

/**
 * Asked for directly: "When I click npcs in the game they should throw a
 * message, but conversation like. For example the messenger would give a
 * message, explorer tell stories".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- settlers ------------------------------------------------------------------------------------

{
  const p = { id: 2, name: 'Test settler' };
  const lines = Array.from({ length: 6 }, () => talkLine({ who: 'settler', person: p, job: 'farm', jobId: 'farm' }));
  ok('each tap is the next line, never the same twice running', lines.every((l, i) => !i || l !== lines[i - 1]));
  ok('a farmer talks about the farm', lines.some((l) => JOB_TALK.farm.includes(l) || /the farm/.test(l)));
  ok('no placeholder left in what they say', lines.every((l) => !/\{\w+\}/.test(l)));
  const hungry = { id: 2, name: 'Test settler', hungry: true };
  ok('hungry, they ask for food', SETTLER_TALK.hungry.includes(talkLine({ who: 'settler', person: hungry, job: 'farm', jobId: 'farm' })));
  const idle = { id: 4, name: 'Test settler' };
  ok('out of work, they say so', SETTLER_TALK.jobless.includes(talkLine({ who: 'settler', person: idle })));
  const a = { id: 1, name: 'Test one' }, b = { id: 2, name: 'Test two' };
  ok('two people don\'t start on the same line', talkLine({ who: 'settler', person: a, job: 'farm', jobId: 'farm' }) !== talkLine({ who: 'settler', person: b, job: 'farm', jobId: 'farm' }));
}

// --- explorers tell stories ---------------------------------------------------------------------

{
  const p = { id: 1, name: 'Test explorer' };
  const at = { x: 0, z: 0 };
  const landmarks = [{ kind: 'mine', x: 200, z: 0 }];
  const lines = Array.from({ length: 8 }, () => talkLine({ who: 'explorer', person: p, at, landmarks, rand: () => 0 }));
  ok('first, who they are', EXPLORER_TALK.hello.includes(lines[0]));
  ok('then a story pointing at a real place, the right way', lines.some((l) => /mine to the east/.test(l)));
  ok('and stories of the far country', lines.some((l) => EXPLORER_TALK.stories.includes(l)));
  ok('and they say goodbye now and then', lines.some((l) => EXPLORER_TALK.bye.includes(l)));
  const none = { id: 1, name: 'Test explorer' };
  const lonely = Array.from({ length: 6 }, () => talkLine({ who: 'explorer', person: none, at, landmarks: [] }));
  ok('with nowhere to point at, still stories', lonely.every((l) => !/\{\w+\}/.test(l)));
}

ok('soldiers and the army have something to say', !!talkLine({ who: 'soldier', person: { id: 1 } }) && !!talkLine({ who: 'warrior', person: { id: 1 } }));

// --- in the game ---------------------------------------------------------------------------------

ok('Place on someone talks to them', /const talker = this\.talkTarget\(\);\s*if \(talker\) return void this\.talkTo\(talker\);/.test(game));
ok('a tap on a phone does too — a word, not a blow', /if \(this\.talkTarget\(aimed\) \|\| this\.traderTarget\(aimed\)\) return places\(\);[\s\S]{0,600}if \(this\.banditTarget\(aimed\)/.test(game));
ok('a messenger gives the news (or the story)', /who === 'messenger'[\s\S]{0,200}this\.messengerTale\(\) \?\? this\.wanderers\.newsFrom/.test(game));
ok('settlers stop and turn to you', /person\.facing = Math\.atan2\(me\.x - person\.x, me\.z - person\.z\)/.test(game));
ok('pointing at them says you can', /looking for work'\} · \$\{this\.ui\?\.isTouch \? 'tap' : 'right click'\} to talk/.test(game));
ok('a block in the way stops it', /talkTarget[\s\S]{0,1200}if \(hit && this\.inTheWay\(hit, eye, dir, best\.t\)\) return null/.test(game));

process.exit(f ? 1 : 0);
