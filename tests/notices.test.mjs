import { readFileSync } from 'node:fs';
import { Notices, NOTICE_LIMIT, earnedLines, ago, plain } from '../src/duilt/Notices.js';
import { itemName } from '../src/config/items.js';
import { MENU_BY_ID } from '../src/config/menu.js';

/**
 * Asked for directly: "a Notification Centre to show game notifications per
 * world. Accessed via menu and is a pop up with all notifications", and "The
 * notification of resume of what was produced is cropping the text when
 * there's a lot of things".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the list ------------------------------------------------------------------------------------

{
  const n = new Notices();
  n.add({ kind: 'challenge', title: 'Test building finished', body: 'A <b>test</b> body', at: 1000 });
  n.add({ kind: 'xp', title: '+10 XP', body: 'for nothing much', at: 1001 });
  n.add({ kind: 'xp', title: 'Your bag is full', at: 1002 });
  ok('kept as plain text', n.list.length === 1 && n.list[0].body === 'A test body');
  ok('the XP tally and button answers aren\'t kept', !n.list.some((x) => /XP|bag is full/.test(x.title)));
  n.add({ kind: 'xp', title: 'Not saved yet', at: 2000 });
  n.add({ kind: 'xp', title: 'Not saved yet', at: 3000 });
  ok('the same one again counts up instead of stacking', n.list.length === 2 && n.list[1].n === 2 && n.list[1].at === 3000);
  ok('newest first', n.newest()[0].title === 'Not saved yet');
  ok('both unread', n.unread() === 2);
  n.markSeen(5000);
  ok('read once looked at', n.unread() === 0);
  n.add({ kind: 'achievement', title: 'Test goal', at: 6000 });
  ok('a new one is unread', n.unread() === 1);
  for (let i = 0; i < NOTICE_LIMIT + 20; i++) n.add({ title: `Test ${i}`, at: 7000 + i });
  ok(`no more than ${NOTICE_LIMIT} kept, the oldest go`, n.list.length === NOTICE_LIMIT && n.list[0].title === 'Test 20');

  // Kept with the world.
  const back = new Notices();
  back.loadJSON(JSON.parse(JSON.stringify(n.toJSON())));
  ok('saved and loaded with the world', back.list.length === NOTICE_LIMIT && back.seenAt === 5000 && back.newest()[0].title === n.newest()[0].title);
  back.loadJSON({ list: [{ title: 5 }, null, { title: 'ok', at: 1 }] });
  ok('a bad save loads what it can', back.list.length === 1);
  back.clear();
  ok('clear all', back.list.length === 0);
}

ok('plain strips markup and entities', plain('<b>Fish &amp; chips</b>') === 'Fish & chips');
ok('ago reads like a person would', ago(0, 30_000) === 'just now' && ago(0, 5 * 60_000) === '5 min ago' && ago(0, 3 * 3600_000) === '3 h ago' && ago(0, 86400_000) === 'yesterday' && ago(0, 3 * 86400_000) === '3 days ago');

// --- what the buildings made while you were away ------------------------------------------------

{
  const earned = { wood: 12, stone: 9, vegetables: 6, seeds_carrot: 6, brick: 4, glass: 4, fruit: 3, cobblestone: 2 };
  const { short, full } = earnedLines(earned, itemName);
  ok(`the toast: the biggest four, then how many more ("${short}")`, short.startsWith('12 ') && short.includes('and 4 more') && short.split(',').length === 4);
  ok('item names, not ids', !short.includes('seeds_carrot') && !full.includes('seeds_carrot'));
  ok('the whole list goes in Notifications', full.split(', ').length === 8);
  ok('a short list shows all of it', earnedLines({ wood: 2, stone: 1 }, itemName).short === earnedLines({ wood: 2, stone: 1 }, itemName).full);
  ok('the game uses it', /earnedLines\(earned, itemName\)/.test(game) && /body: short, full/.test(game));
}

// --- in the menu ---------------------------------------------------------------------------------

ok('a Notifications card in the menu', MENU_BY_ID.get('menu-notices')?.name === 'Notifications');
ok('every toast is logged for this world, in full', /notices\.add\(\{ kind, title, body: full \?\? body \}\)/.test(ui));
ok('opening it marks them read and shows unread on the card', /notices\?\.markSeen\(\)/.test(ui) && /notice-badge/.test(ui));
ok('and the list is drawn escaped', /escapeHtml\(n\.title\)/.test(ui) && /escapeHtml\(n\.body\)/.test(ui));

process.exit(f ? 1 : 0);
