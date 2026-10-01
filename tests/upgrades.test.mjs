import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { UPGRADES, SWIFT_SPEED, STUN_SECONDS, BURN_SECONDS, FREEZE_SECONDS, upgradedId } from '../src/config/upgrades.js';
import { WEAR_SLOTS, ARMOUR_PIECES } from '../src/config/armour.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { LOOT } from '../src/duilt/Loot.js';
import { itemIcon } from '../src/config/cubes.js';
import { NIGHT_SIGHT_AMBIENT, daylightAt } from '../src/render/DayCycle.js';

/**
 * Playtest, P6. Asked for directly: "Special effects on armour that do
 * simple stuff: speed on boots, extra defence on chest plate and pants, and
 * night vision on the helmet; and special attacks on the sword, like
 * thunder, fire and ice: paralysing, burning and freezing."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

const flat = () => {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  return world;
};

// --- boots ------------------------------------------------------------------------------------

ok('a slot for your feet', WEAR_SLOTS.includes('feet'));
ok('and boots in every set', ['leather', 'sky', 'stone'].every((set) => ARMOUR_PIECES.some((p) => p.set === set && p.slot === 'feet')));
ok('worn on the feet', ITEMS_BY_ID.get('armour_leather_feet')?.wears === 'feet' && (itemIcon(ITEMS_BY_ID.get('armour_leather_feet')) ?? '').includes('<svg'));

// --- the upgrades ------------------------------------------------------------------------------

ok('Swift goes on boots, Warded on the cuirass and greaves, Night Sight on the helm',
  UPGRADES.swift.slots.join() === 'feet' && UPGRADES.warded.slots.join() === 'body,legs' && UPGRADES.night.slots.join() === 'head');
ok('thunder, fire and ice go on swords', ['thunder', 'fire', 'ice'].every((k) => UPGRADES[k].weapon && UPGRADES[k].element === k));
{
  const swift = ITEMS_BY_ID.get(upgradedId('armour_sky_feet', 'swift'));
  ok(`an upgraded piece is a thing of its own: "${swift?.name}"`, swift?.wears === 'feet' && swift.upgrade === 'swift');
  const warded = ITEMS_BY_ID.get(upgradedId('armour_stone_body', 'warded'));
  ok(`Warded adds two armour (${warded?.armour})`, warded?.armour === ITEMS_BY_ID.get('armour_stone_body').armour + 2);
  const fire = ITEMS_BY_ID.get(upgradedId('sword_iron', 'fire'));
  ok(`"${fire?.name}" hits as hard as the plain one, and burns`, fire?.damage === 9 && fire.element === 'fire' && fire.weapon);
  ok('it glints in its colour in the bag', (itemIcon(fire) ?? '').includes('class="glint"') && (itemIcon(fire) ?? '').includes(UPGRADES.fire.colour)
    && /\.glint \{/.test(css) && !(itemIcon(ITEMS_BY_ID.get('sword_iron')) ?? '').includes('glint'));
}
{
  const upgrading = RECIPES.filter((r) => r.name.startsWith('Upgrade'));
  ok('called upgrades, not enchantments', upgrading.every((r) => r.name.startsWith('Upgrade: ')) && !/[Ee]nchant/.test(JSON.stringify(ITEMS_BY_ID.get('sword_iron_fire'))));
  ok(`laid on at the Temple, chapel or better (${upgrading.length} recipes)`, upgrading.length >= 15
    && upgrading.every((r) => r.station === 'temple' && r.tier === 2 && r.inputs.devotion > 0));
  ok('the piece itself goes in, with something that suits it', upgrading.every((r) => Object.keys(r.inputs).length >= 3));
  ok('and the richer chests can hold one', Object.values(LOOT).some((t) => t.items.some(([id]) => ITEMS_BY_ID.get(id)?.upgrade)));
}

// --- armour effects -----------------------------------------------------------------------------

{
  const world = flat();
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  for (const id of ['armour_leather_feet_swift', 'armour_leather_head_night', 'armour_leather_body_warded']) {
    g.inventory.add(id, 1);
    g.wear(g.inventory.slots.findIndex((s) => s?.id === id));
  }
  ok('worn: swift, night sight and warded', g.wearing('swift') && g.wearing('night') && g.wearing('warded') && !g.wearing('fire'));
  ok(`Warded counts in your armour (${g.armour()})`, g.armour() === 1 + 1 + 2 + 2);
}
ok(`swift boots: ×${SWIFT_SPEED} on your feet`, SWIFT_SPEED > 1 && /this\.duilt\.wearing\('swift'\) \? SWIFT_SPEED : 1/.test(game));
ok('night sight: the dark never gets dark', /this\.dayCycle\.nightSight = this\.duilt\.wearing\('night'\)/.test(game)
  && NIGHT_SIGHT_AMBIENT > daylightAt(0).ambient * 2);

// --- elemental swords --------------------------------------------------------------------------------

{
  const world = flat();
  const w = new Wanderers({ world, hostile: () => true });
  const player = { x: 20.5, y: 1, z: 20.5 };
  const bandit = () => { const p = w.person('bandit', 22.5, 1, 20.5, { home: { x: 40.5, z: 40.5 }, angry: true }); p.angry = true; w.list.push(p); return p; };

  // Thunder.
  const a = bandit();
  w.afflict(a, 'thunder');
  const at = { x: a.x, z: a.z };
  for (let i = 0; i < Math.round(STUN_SECONDS * 30) - 3; i++) w.tick(1 / 30, player);
  ok(`thunder: stunned for ${STUN_SECONDS}s, it can't move`, Math.hypot(a.x - at.x, a.z - at.z) < 0.01 && a.stunned > 0);
  for (let i = 0; i < 10; i++) w.tick(1 / 30, player);
  ok('  and then it can again', !(a.stunned > 0));
  w.list = [];

  // Fire.
  const b = bandit();
  const hp = b.hp;
  w.afflict(b, 'fire');
  for (let i = 0; i < BURN_SECONDS * 30 + 5; i++) w.tick(1 / 30, { x: 60, y: 1, z: 60 });
  ok(`fire: it burns for ${BURN_SECONDS}s, a point a second (${hp} → ${b.hp})`, b.hp === hp - BURN_SECONDS && !(b.burning > 0));
  b.hp = 1;
  w.afflict(b, 'fire');
  for (let i = 0; i < 40; i++) w.tick(1 / 30, { x: 60, y: 1, z: 60 });
  ok('  burnt down, what it carried is left to pick up', b.dead && w.fallen.length === 1 && w.fallen[0].p === b);
  ok('  and Game picks it up', /this\.collectFallen\(\)/.test(game) && /this\.wanderers\.fallen\.splice\(0\)/.test(game));
  w.list = [];

  // Ice.
  const c = bandit(), d = bandit();
  d.z = c.z + 4;
  c.target = { x: c.x + 10, z: c.z }; c.speed = 2; d.target = { x: d.x + 10, z: d.z }; d.speed = 2;
  w.afflict(c, 'ice');
  const c0 = c.x, d0 = d.x;
  w.move(c, c.frozen > 0 ? 0.1 * 0.3 : 0.1); w.move(d, 0.1);
  ok(`ice: frozen for ${FREEZE_SECONDS}s, it moves at a crawl`, c.frozen === FREEZE_SECONDS && (c.x - c0) < (d.x - d0) * 0.5
    && /const t = p\.frozen > 0 \? dt \* FREEZE_SLOW : dt;/.test(readFileSync(new URL('../src/world/Wanderers.js', import.meta.url), 'utf8')));
  ok('only on those that can be hurt — not the Stone King', (() => { const m = w.person('king', 5, 1, 5, {}); w.afflict(m, 'thunder'); return !m.stunned; })());
  ok('the strike lays it on', /if \(tool\?\.element && !res\.killed\) this\.wanderers\.afflict\(p, tool\.element\)/.test(game));
  ok('and you can see it: frost, embers, sparks', /p\.frozen > 0/.test(view) && /p\.burning > 0/.test(view) && /p\.stunned > 0/.test(view));
  ok('a bandit has hp to lose', WANDERERS.bandit.hp > 0);
}

process.exit(f ? 1 : 0);
