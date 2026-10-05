import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES, PRODUCTION_PACE, producesAt, intervalAt, yieldAt } from '../src/config/structures.js';
import { tierStatus } from '../src/structures/validate.js';
import { ITEMS } from '../src/config/items.js';

/**
 * Asked for directly: "I don't want to evolve a game but building it only.
 * It's like the claim. There should be both options, if I edit the building
 * and increase the blocks needed it should evolve, or else I can just click
 * evolve and it will use them from my inventory ... making sure all
 * buildings with evolution can be evolved properly, and no problems with
 * what they give me."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const LEVELLED = STRUCTURES.filter((s) => s.tiers?.length);

// --- every level gives more than the one before ---------------------------------
const perDay = (spec, t) => {
  const p = producesAt(spec, t), every = intervalAt(spec, t);
  return Object.values(p).reduce((a, v) => a + v * PRODUCTION_PACE * 86400 / every, 0);
};
for (const spec of LEVELLED) {
  let better = true;
  for (let t = 1; t < spec.tiers.length; t++) {
    const a = spec.tiers[t - 1], b = spec.tiers[t];
    const gain = spec.fromCrops || spec.fromAnimals ? yieldAt(spec, t) > yieldAt(spec, t - 1)
      : b.slots != null ? b.slots > a.slots
      : perDay(spec, t) > perDay(spec, t - 1);
    if (!gain) better = false;
  }
  ok(`${spec.id}: every level gives more than the one before`, better);
}

// --- Evolve from the bag, all the way up, for every one -----------------------------
// Each is stood up from its own design on cleared ground and taken from its
// first level to its last by pressing Evolve only — nothing built in by hand.
const { world, origin } = generateDuiltWorld({ sizeX: 256, sizeZ: 256, seed: 11 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
// What levels ask for — the bag has room for these, not for one of everything.
const topUp = () => { for (const id of ['planks', 'cobblestone', 'coin', 'iron_ingot', 'lantern', 'chest', 'stone', 'window', 'pillar_stone', 'gold_trim', 'banner_white', 'devotion']) g.inventory.add(id, Math.max(0, 300 - g.inventory.countOf(id))); };
const gy = 40;
let slot = 0;
for (const spec of LEVELLED) {
  topUp();
  const design = DESIGN_FOR_STRUCTURE.get(spec.id);
  const ox = origin.minX + 4 + (slot % 6) * 30, oz = origin.minZ + 4 + Math.floor(slot / 6) * 30;
  slot++;
  for (let x = ox - 2; x < ox + design.extent.x + 3; x++) for (let z = oz - 2; z < oz + design.extent.z + 3; z++) {
    for (let y = gy - 4; y < gy + 30; y++) world.setBlock(x, y, z, y < gy ? 3 : 0);
  }
  for (const b of design.blocks) world.setBlock(ox + b.dx, gy + b.dy, oz + b.dz, b.type);
  const region = { minX: ox, maxX: ox + design.extent.x, minY: gy - 1, maxY: gy + design.extent.y, minZ: oz, maxZ: oz + design.extent.z };
  // Stood in directly: what's tested here is levelling, not each building's site rules.
  const s = { id: 1000 + slot, type: spec.id, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, excludes: [], tier: 0 };
  g.structures.structures.push(s);
  let presses = 0;
  while ((s.tier ?? 0) < spec.tiers.length - 1 && presses < 10) {
    presses++;
    const plan = g.evolvePlan(s);
    if (!plan.ok) { console.log(`  ${spec.id} stuck at ${s.tier}: ${plan.reason}`); break; }
    for (const c of plan.changes) world.setBlock(c.x, c.y, c.z, c.next);
    if (Object.keys(plan.pay).length) g.inventory.spend(plan.pay);
    g.structures.addCredit(s.id, plan.credit);
    const r = g.structures.evolve(s.id);
    if (!r.ok) { console.log(`  ${spec.id} refused at ${s.tier}: ${r.reason}`); break; }
  }
  ok(`${spec.id}: Evolve alone takes it to its top level (${spec.tiers.length - 1})`, s.tier === spec.tiers.length - 1);
}

// --- what was bought stays bought ----------------------------------------------------
const store = g.structures.structures.find((s) => s.type === 'storehouse');
ok('a storehouse bought up its levels keeps them through a re-check', (() => { g.structures.recheck(store); return store.tier === 2; })());
const saved = JSON.parse(JSON.stringify(g.structures.toJSON()));
ok('and through a save', Object.keys(saved.structures.find((s) => s.id === store.id)?.credit ?? {}).length > 0);

// --- or build it yourself, and it levels up by itself ---------------------------------
const tav = g.structures.structures.find((s) => s.type === 'tavern');
topUp();
const t0 = { ...tav, id: 9001, tier: 0, credit: undefined, paidTo: 0 };
const design = DESIGN_FOR_STRUCTURE.get('tavern');
const ox = origin.minX + 4, oz = origin.minZ + 4 + 4 * 30;
for (let x = ox - 2; x < ox + design.extent.x + 3; x++) for (let z = oz - 2; z < oz + design.extent.z + 3; z++) {
  for (let y = gy - 4; y < gy + 30; y++) world.setBlock(x, y, z, y < gy ? 3 : 0);
}
for (const b of design.blocks) world.setBlock(ox + b.dx, gy + b.dy, oz + b.dz, b.type);
t0.region = { minX: ox, maxX: ox + design.extent.x, minY: gy - 1, maxY: gy + design.extent.y, minZ: oz, maxZ: oz + design.extent.z };
g.structures.structures.push(t0);
ok('a fresh tavern is at its first level', g.structures.climb(t0.id) === 0 && t0.tier === 0);
const spot = g.fitSpots(t0.region, 'light')[0];
world.setBlock(spot.x, spot.y, spot.z, ITEMS.find((i) => i.id === 'lantern').block);
const planks = g.inventory.countOf('planks');
ok('hang a lantern in it yourself and it levels up by itself', g.structures.climb(t0.id) === 1 && t0.tier === 1);
ok('paying that level\'s bill from the bag', g.inventory.countOf('planks') === planks - 12);
world.setBlock(spot.x, spot.y, spot.z, 0);
g.structures.retier(t0);
ok('take the lantern down and it drops back', t0.tier === 0);
world.setBlock(spot.x, spot.y, spot.z, ITEMS.find((i) => i.id === 'lantern').block);
ok('put it back and the level returns — not paid for twice', g.structures.climb(t0.id) === 1 && g.inventory.countOf('planks') === planks - 12);

// --- what the panel shows ----------------------------------------------------------------
const st = tierStatus(world, t0.region, 'tavern', t0.tier, { credit: t0.credit });
ok('each need says what Evolve takes instead', st.next.wants.every((w) => w.fit || w.price));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('editing a building climbs it after each change', (game.match(/this\.climbEditing\(\);/g) ?? []).length === 2);
ok('but not halfway through an Evolve press', /if \(!s \|\| !this\.duilt \|\| this\.evolvingNow\) return;/.test(game));

process.exit(f ? 1 : 0);
