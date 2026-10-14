import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { cubeDesign, cubeSite, GODSTONE, WAY_OUT, CUBE_SIZE, CUBE_TALL, CUBE_FLOOR } from '../src/world/godCube.js';
import { BLOCKS_BY_ID, isChest, isSystemBlock } from '../src/config/blocks.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { LOOT } from '../src/duilt/Loot.js';
import { MOMENTS } from '../src/config/moments.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { World } from '../src/world/World.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Backlog batch 4, C — asked for directly: "after all the big wars, the user
 * can come back to the sanctuary and travel to a new dimension ... an
 * unbreakable cube of blocks with 100 blocks width. Inside there's the other
 * god, and lots of creatures that help him fight you. You need to kill it to
 * leave his cube basically. Or stole his stash which consists in thousands of
 * coins and a wand."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- the cube ---------------------------------------------------------------------------------------

for (const god of ['dark', 'white']) {
  const plan = cubeDesign(god);
  const at = new Map(plan.blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  const get = (x, y, z) => at.get(`${x},${y},${z}`) ?? 0;
  let shell = true;
  for (let i = 0; i < CUBE_SIZE; i += 9) for (let y = 1; y < CUBE_TALL; y += 7) {
    if (get(0, y, i) !== GODSTONE || get(CUBE_SIZE - 1, y, i) !== GODSTONE || (get(i, y, 0) !== GODSTONE)) shell = false;
  }
  ok(`${god}: a hundred across, walled in Godstone that nothing breaks`, shell && isSystemBlock(GODSTONE) && get(50, CUBE_TALL, 50) === GODSTONE && get(50, -1, 50) === GODSTONE);
  ok(`${god}: the way out, in the south wall, lit`, get(plan.exit.x, plan.exit.y, plan.exit.z) === WAY_OUT && BLOCKS_BY_ID.get(WAY_OUT).light && isSystemBlock(WAY_OUT));
  ok(`${god}: the stash on the altar at the far end`, isChest(get(plan.stash.x, plan.stash.y, plan.stash.z)) && plan.stash.z < 20 && plan.entry.z > CUBE_SIZE - 10);
  ok(`${god}: the god before it, his creatures' spots round the hall`, plan.throne.z > plan.stash.z && plan.spawns.length >= 4 && plan.spawns.every((s) => s.x > 1 && s.x < CUBE_SIZE - 1 && s.z > 1 && s.z < CUBE_SIZE - 1));
}
ok('dressed for its god: obsidian for the dark, marble for the white', cubeDesign('dark').blocks.some((b) => b[3] === 14) && cubeDesign('white').blocks.some((b) => b[3] === 17));
{
  const gen = new ChunkGen({ seed: 41 });
  const site = cubeSite(gen, { x: 0, z: 0 });
  let top = 0;
  for (let dx = 0; dx <= CUBE_SIZE; dx += 10) for (let dz = 0; dz <= CUBE_SIZE; dz += 10) top = Math.max(top, gen.heightAt(site.x + dx, site.z + dz));
  ok(`it hangs far out over the world, above its ground (${top} under a floor at ${site.y})`, Math.abs(site.x) >= 30000 && site.y === CUBE_FLOOR && top < site.y && CUBE_FLOOR + CUBE_TALL < 200);
}

// --- the god and his creatures --------------------------------------------------------------------------

ok('the gods: huge, slow, heavy blows you can see coming', ['dark_god', 'white_god'].every((k) => WANDERERS[k].hp >= 500 && WANDERERS[k].windup && WANDERERS[k].god && WANDERERS[k].noKnock));
ok('their creatures: shades for the dark god, seraphs for the white', WANDERERS.dark_god.minion === 'shade' && WANDERERS.white_god.minion === 'seraph' && WANDERERS.shade.hp && WANDERERS.seraph.hp);
{
  const world = new World({ sizeX: 128, sizeZ: 128, height: 40 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) world.setBlock(x, 0, z, 3);
  const hits = [];
  const w = new Wanderers({ world, rand: rng(2), onAttack: (p, n) => hits.push(n) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const lm = { kind: 'cube', x: 64, z: 64, y: 1, half: 50, leave: 400, spawns: [{ x: 40.5, y: 1, z: 40.5 }, { x: 88.5, y: 1, z: 40.5 }, { x: 64.5, y: 1, z: 90.5 }] };
  const god = w.person('dark_god', 64.5, 1, 30.5, { landmark: lm, home: { x: 64.5, z: 30.5 }, angry: true });
  w.list.push(god);
  // Out of his reach first (you come in at the far wall): he waits, and nothing falls over.
  const far = { x: 64.5, y: 1, z: 125 };
  let threw = null;
  try { for (let i = 0; i < 200; i++) w.tick(0.05, far); } catch (err) { threw = err; }
  ok(`out of his reach he waits, and nothing falls over (${threw?.message ?? 'no error'})`, !threw);
  const player = { x: 64.5, y: 1, z: 100 };
  for (let i = 0; i < 1200; i++) w.tick(0.05, player);
  const shades = w.list.filter((p) => p.kind === 'shade');
  ok(`he calls his creatures (${shades.length}), never more than eight at once`, shades.length > 0 && shades.length <= 8);
  ok('and they and he come for you', hits.length > 0 && w.hostileOf(god) && shades.every((s) => w.hostileOf(s)));
  const hp = god.hp;
  const res = w.hit(god, 10, player.x, player.z);
  ok('a blow doesn\'t knock him back', !res.killed && god.hp === hp - 10);
}

// --- getting in, and out ----------------------------------------------------------------------------------

{
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  ok('no way in without a ring', /ring/i.test(g.cubeRefuses()));
  g.ring = 'white';
  ok('the white path: not till the war\'s won', /war/i.test(g.cubeRefuses()));
  g.war.stage = 'won';
  ok('then the way is open — to the dark god', g.cubeRefuses() === null && g.otherGod === 'dark');
  const b = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  b.ring = 'black';
  ok('the dark path: not till the Sky Kingdom\'s down', /Sky Kingdom/.test(b.cubeRefuses()));
  b.skyFallen = true;
  ok('then to the white god', b.cubeRefuses() === null && b.otherGod === 'white');
  b.cube.beaten = true;
  ok('and not once he\'s beaten', /beaten/.test(b.cubeRefuses()));
  const back = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify({ ...b.toJSON(), cube: { beaten: true, stash: true, inside: true, back: { x: 1, y: 2, z: 3 } } })));
  ok('kept with the world — and saved inside, you come back out where you went in', back.cube.beaten && back.cube.stash && back.cube.back?.y === 2
    && /if \(this\.duilt\.cube\?\.back\)/.test(game));
}

ok('from the Sanctuary\'s pop-up, saying why not till it\'s open', /structure\.type === 'sanctuary_white' \|\| structure\.type === 'sanctuary_black' \? this\.cubeHtml\(\)/.test(ui) && /Step through to his cube/.test(ui));
ok('the way out lets you go only once he\'s beaten, or his stash is yours', /if \(!d\.cube\.beaten && !d\.cube\.stash\)/.test(game) && /aimed\.block === WAY_OUT\) return void this\.leaveCube\(\)/.test(game));
ok('taking from the stash is noticed', /The god\\'s stash is yours/.test(game));
ok('his fall is noticed, his creatures go with him', /c\.god\.dead && !d\.cube\.beaten/.test(game));
ok('the stash: the wand, diamonds, thousands of coins', LOOT.god_stash.items.some(([id]) => id === 'god_wand') && LOOT.god_stash.items.find(([id]) => id === 'coin')[2] >= 2000);
ok('a moment going in and coming out the victor', ['cube_dark', 'cube_white', 'god_dark_beaten', 'god_white_beaten'].every((m) => MOMENTS[m]));

// --- the wand ------------------------------------------------------------------------------------------------

ok('the wand is a tool, with a model', ITEMS_BY_ID.get('god_wand')?.kind === 'tool');
ok('Break picks a block to copy, or looses a beam at anything further off', /god_wand: 'useWand'/.test(game) && /this\.wandBlock = hit\.block/.test(game) && /WAND_BEAM_DAMAGE/.test(game));
ok('Place puts down a copy, a coin each, in your own land', /god_wand: 'wandPlace'/.test(game) && /chargeResources: false/.test(game) && /d\.inventory\.remove\('coin', 1\)/.test(game));
ok('on a phone, a tap puts down the copy once one\'s picked', /if \(item === 'god_wand'\) return this\.wandBlock && aimed \? places\(\) : breaks\(\);/.test(game));

process.exit(f ? 1 : 0);
