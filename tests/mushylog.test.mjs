import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { MushyLogs, MUSHY_KINDS, MUSHY_GROW_DAYS, mushyOf, mushyYield } from '../src/duilt/MushyLogs.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { boxesFor } from '../src/world/propShapes.js';

/** PLAY-15: the Mushy Log (docs/design/play-14-21.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const flat = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 48 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 1);
  return world;
};

// --- items, blocks, recipes ---------------------------------------------------------
for (const [kind, k] of Object.entries(MUSHY_KINDS)) {
  const it = ITEMS_BY_ID.get(k.log);
  ok(`${k.log} places block ${k.base}`, it?.block === k.base);
  const r = RECIPES_BY_ID.get(k.log);
  ok(`${kind}: hand recipe, Age 2, wood 4 and 2 ${k.item}`, r?.station === 'hand' && r.age === 2 && r.inputs.wood === 4 && r.inputs[k.item] === 2 && r.output.id === k.log);
  const names = [0, 1, 2].map((s) => BLOCKS_BY_ID.get(k.base + s)?.name);
  ok(`${kind}: three stages share the item's name`, names.every((n) => n === it.name));
  ok(`${kind}: later stages are states of stage 0 and give the log back`, [1, 2].every((s) => BLOCKS_BY_ID.get(k.base + s).stateOf === k.base && ITEM_FOR_BLOCK.get(k.base + s) === k.log));
  const counts = [0, 1, 2].map((s) => boxesFor(`mushy_${kind}_${s}`).length);
  ok(`${kind}: 4, 9 and 14 boxes (${counts})`, counts.join() === '4,9,14');
}
ok('mushyOf names kind and stage', mushyOf(557)?.kind === 'red' && mushyOf(557).stage === 1 && mushyOf(564)?.kind === 'pale' && mushyOf(564).stage === 2 && mushyOf(565) === null && mushyOf(555) === null);

// --- the yield ------------------------------------------------------------------------
{
  let sum = 0, n = 0, lo = 99, hi = 0, same = true;
  for (let i = 0; i < 2000; i++) {
    const x = (i * 7) % 200, z = (i * 13) % 190, at = i * 0.37;
    const v = mushyYield(x, 3, z, at, 41);
    if (v !== mushyYield(x, 3, z, at, 41)) same = false;
    sum += v; n++; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  ok(`every yield is 15 to 25 (${lo} to ${hi})`, lo >= 15 && hi <= 25);
  ok(`mean within 0.3 of 20 (${(sum / n).toFixed(2)})`, Math.abs(sum / n - 20) <= 0.3);
  ok('the same inputs give the same value', same);
}

// --- growing ----------------------------------------------------------------------------
{
  const world = flat();
  const m = new MushyLogs();
  world.setBlock(5, 1, 5, 556);
  m.plant(5, 1, 5, 3, 'red');
  ok('daysLeft is 10 on placing', m.daysLeft(5, 1, 5, 3) === 10 && MUSHY_GROW_DAYS === 10);
  ok('stage 0 until day 4', m.grow(world, 6.9).length === 0 && world.getBlock(5, 1, 5) === 556);
  const c1 = m.grow(world, 7);
  ok('stage 1 on day 4', c1.length === 1 && world.getBlock(5, 1, 5) === 557 && c1[0].prev === 556 && c1[0].next === 557);
  ok('still stage 1 on day 9', m.grow(world, 12.9).length === 0 && world.getBlock(5, 1, 5) === 557);
  ok('stage 2 on day 10', m.grow(world, 13).length === 1 && world.getBlock(5, 1, 5) === 558);
  ok('daysLeft is 0 when ready', m.daysLeft(5, 1, 5, 13) === 0);

  // A world that jumps (sleep) skips straight to ready.
  world.setBlock(6, 1, 6, 559); m.plant(6, 1, 6, 0, 'lilac');
  m.grow(world, 99);
  ok('a long sleep goes straight to ready', world.getBlock(6, 1, 6) === 561);

  // An unloaded chunk is untouched.
  const far = new World({ sizeX: 64, sizeZ: 64, height: 48, endless: true });
  const m2 = new MushyLogs();
  m2.plant(500, 1, 500, 0, 'pale');
  ok('an unloaded chunk is left alone', m2.grow(far, 50).length === 0 && m2.planted.size === 1);

  // A record whose block changed is dropped.
  world.setBlock(8, 1, 8, 562); m.plant(8, 1, 8, 0, 'pale');
  world.setBlock(8, 1, 8, 0);
  m.grow(world, 50);
  ok('a record whose block was removed is dropped', !m.get(8, 1, 8));
  world.setBlock(9, 1, 9, 556); m.plant(9, 1, 9, 0, 'pale');
  m.grow(world, 50);
  ok('and one whose block became another kind', !m.get(9, 1, 9));
}

// --- breaking one -------------------------------------------------------------------------
{
  const world = flat();
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.mushyLogs.plant(3, 1, 3, 2.5, 'lilac');
  g.onBlocksBroken([{ x: 3, y: 1, z: 3, prev: 561, next: 0 }]);
  const want = mushyYield(3, 1, 3, 2.5, 0);
  ok(`a ready log gives its yield (${want}) of its kind and no log`, g.inventory.countOf('mushroom_lilac') === want && g.inventory.countOf('mushy_log_lilac') === 0);
  ok('and the record is spent', !g.mushyLogs.get(3, 1, 3));

  g.mushyLogs.plant(4, 1, 4, 0, 'red');
  g.onBlocksBroken([{ x: 4, y: 1, z: 4, prev: 557, next: 0 }]);
  ok('a log still growing gives the log back and no mushrooms', g.inventory.countOf('mushy_log_red') === 1 && g.inventory.countOf('mushroom_red') === 0 && !g.mushyLogs.get(4, 1, 4));

  // saved and loaded
  g.days = 5;
  g.mushyLogs.plant(7, 1, 7, 1.25, 'pale');
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(json);
  const rec = back.mushyLogs.get(7, 1, 7);
  ok('a saved log keeps its day and kind', rec?.at === 1.25 && rec.kind === 'pale');
  const m = new MushyLogs();
  m.loadJSON([{ x: 1, y: 1, z: 1, at: 2, kind: 'red' }, { x: 2, y: 1, z: 1, at: 'soon', kind: 'red' }, { x: 3, y: 1, z: 1, at: 2, kind: 'blue' }, null]);
  ok('bad entries are dropped on load', m.planted.size === 1);
}

process.exit(f ? 1 : 0);
