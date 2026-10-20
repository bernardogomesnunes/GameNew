import { readFileSync } from 'node:fs';

/**
 * Reported directly: worlds called "My settlement" kept turning up in the
 * list that the player hadn't made. They had made them once, and deleted
 * them — and a later save put each one back. A save sent deleted_at: null,
 * so any upload of a deleted world (the unsent copy from a dropped
 * connection, sent on the next startup; another tab still open) undid the
 * delete and showed the world as "just now".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const neon = readFileSync(new URL('../src/net/NeonTransport.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('a save never clears deleted_at', !/deleted_at:\s*null/.test(neon));
ok('deleting is still a soft delete', /body: \{ deleted_at: new Date\(\)\.toISOString\(\) \}/.test(neon));

const del = game.slice(game.indexOf('onDeleteWorld:'), game.indexOf('onLeaveWorld:'));
ok('deleting a world drops its unsent copy', /this\.dropSafeCopy\(id\)/.test(del));
ok('deleting the open world stops its pending save', /this\.pendingSave = false/.test(del));
ok('the unsent copy is only dropped if it is that world', /dropSafeCopy\(id = null\)[\s\S]{0,200}worldId !== id\) return;/.test(game));

// Missing-list handling is exercised behaviorally in missingworld-save.test.mjs.
// A missing row must block recreation without destroying pending progress.

process.exit(f ? 1 : 0);
