// IMP-1: "we need explorers to give saplings and other materials when
// approaches". Decided 29 October: "Each explorer should have 2 gifts
// available, that can be taken."
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { EXPLORER_PACK, rollExplorerGifts } from '../src/config/wanderers.js';
import { ITEMS_BY_ID } from '../src/config/items.js';

let failed = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) failed++; };

// Two gifts: saplings, then one thing from the pack.
{
  const gifts = rollExplorerGifts(() => 0);
  ok('an explorer carries two gifts', gifts.length === 2);
  ok('the first is a pair of saplings', gifts[0].give.sapling === 2);
  ok('the second comes from their pack', JSON.stringify(gifts[1].give) === JSON.stringify(EXPLORER_PACK[0]));
  ok('every pack item is a real item', EXPLORER_PACK.every((p) => Object.keys(p).every((id) => ITEMS_BY_ID.has(id))));
  const a = rollExplorerGifts(() => 0.99), b = rollExplorerGifts(() => 0.99);
  a[1].give.clay = 99;
  ok('gifts are copies, so taking one never edits the shared pack', !('clay' in b[1].give) || b[1].give.clay !== 99);
}

// A sent explorer has them.
{
  const world = new World({ sizeX: 256, sizeZ: 256, height: 32 });
  for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) world.setBlock(x, 0, z, 3);
  const w = new Wanderers({ world, rand: () => 0.3 });
  const p = w.sendExplorer({ x: 128, y: 1, z: 128 });
  ok('an explorer sent over the country carries two gifts', p?.kind === 'explorer' && p.gifts?.length === 2);
}

// Handing them over, through the game's own method.
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const body = game.slice(game.indexOf('  explorerGift(person) {'), game.indexOf('  /** The goblin traders'));
const explorerGift = new Function('itemName', `return function ${body.trim().replace(/^explorerGift/, 'explorerGift')}`)((id) => ITEMS_BY_ID.get(id).name);
const bag = {};
const duilt = { sandbox: false, collect: (give) => { const got = {}; for (const [id, n] of Object.entries(give)) { got[id] = n; bag[id] = (bag[id] ?? 0) + n; } return got; } };
const me = { duilt, explorerGift };
{
  const person = { gifts: rollExplorerGifts(() => 0) };
  const first = me.explorerGift(person);
  ok('the first talk gives two saplings', bag.sapling === 2 && /sapling/.test(first) && /one more thing/.test(first));
  ok('and one gift is left', person.gifts.length === 1);
  const second = me.explorerGift(person);
  ok('the second talk gives the pack item', bag.dark_wood === 3 && /dark log/.test(second) && !/one more/.test(second));
  ok('after that they have nothing more', person.gifts.length === 0 && me.explorerGift(person) === null && bag.sapling === 2);
}
{
  const full = { sandbox: false, collect: () => ({}) };
  const person = { gifts: rollExplorerGifts(() => 0) };
  const line = { duilt: full, explorerGift }.explorerGift(person);
  ok('with a full bag the gift stays with them', /bag is full/.test(line) && person.gifts.length === 2);
  const creative = { duilt: { sandbox: true, collect: duilt.collect }, explorerGift };
  ok('in Creative nothing is handed over', creative.explorerGift({ gifts: rollExplorerGifts(() => 0) }) === null);
}
ok('talking to an explorer gives the gift', /gift = this\.explorerGift\(person\)/.test(game));

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
