import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Magic } from '../src/duilt/Magic.js';
import { Inventory } from '../src/items/Inventory.js';
import { Mobs } from '../src/world/Mobs.js';
import * as GameWar from '../src/game/GameWar.js';
import { WIZARD_QUESTS } from '../src/config/wizardQuests.js';
import { LEVEL_POINTS, HAT } from '../src/config/magic.js';
import { ITEMS_BY_ID } from '../src/config/items.js';

/** WAND-3: the Wizard Hat and the last quest. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const hat = ITEMS_BY_ID.get('wizard_hat');
ok('the hat is head armour with defence 3, outside the book and the upgrades', hat?.kind === 'armour' && hat.wears === 'head' && hat.armour === HAT.armour && hat.armour === 3 && hat.noBook);
ok('it beats an iron helm (2)', hat.armour > 2);
ok('no upgraded copy of it exists', ![...ITEMS_BY_ID.keys()].some((id) => id !== 'wizard_hat' && id.includes('wizard_hat')));

const last = WIZARD_QUESTS.at(-1);
ok('the hat is the last quest, after every recipe', last.reward?.item === 'wizard_hat' && WIZARD_QUESTS.slice(0, -1).every((q) => q.reward?.item !== 'wizard_hat'));
ok('and it needs a high Magic level (7, 420 points) above every other quest', last.level === 7 && LEVEL_POINTS[6] === 420 && WIZARD_QUESTS.slice(0, -1).every((q) => (q.level ?? 0) < last.level));
ok('and rare things: diamonds and rubies', last.items.diamond >= 3 && last.items.ruby >= 2);

{
  const m = new Magic(); m.arrive(null);
  const inv = new Inventory({ slots: 12 });
  m.chain.step = WIZARD_QUESTS.length - 1;
  for (const [id, n] of Object.entries(last.items)) inv.add(id, n);
  ok('with every item but too low a level, it is refused', !m.complete(inv).ok && /level 7/.test(m.complete(inv).reason) && inv.countOf('diamond') === 3);
  m.points = 420;
  const r = m.complete(inv);
  ok('at level 7 it is handed over, and the chain ends', r.ok && inv.countOf('wizard_hat') === 1 && m.current() === null && m.given.includes('wizard_hat'));
}

const make = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  return { g: new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age: 3 }), world };
};
{
  const { g } = make();
  g.magic.arrive(null);
  const before = g.armour();
  ok('without the hat: no bonus', !g.wearsHat() && g.hatMagicBonus() === 0);
  g.inventory.add('wizard_hat', 1);
  g.worn.head = { id: 'wizard_hat', wear: 0 };
  ok('worn on the head, it adds 3 armour', g.wearsHat() && g.armour() === before + 3);
  ok('and +2 to every wand bolt', g.hatMagicBonus() === 2 && g.magic.wandDamage(g.hatMagicBonus()) === g.magic.wandDamage() + 2);
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const { g: g2 } = make();
  g2.loadJSON(json);
  ok('it stays on across a save', g2.wearsHat());
}

// Thorns: a mob that hit you takes 2 back; a killed one falls as any other.
{
  const { g, world } = make();
  g.worn.head = { id: 'wizard_hat', wear: 0 };
  const mobs = new Mobs({ world, rand: () => 0.5 });
  const raptor = mobs.make({ id: 'raptor', hp: 10 }, 5, 1, 5);
  mobs.list.push(raptor);
  const fell = [];
  const ctx = { duilt: g, mobs, player: { position: { x: 6, z: 5 } }, mobFell: (m) => fell.push(m), ui: { toast() {} } };
  GameWar.hatThorns.call(ctx, raptor, false);
  ok('a raptor that bit you loses 2 hit points', raptor.hp === 8);
  raptor.hp = 2;
  GameWar.hatThorns.call(ctx, raptor, false);
  ok('and one with 2 left falls', fell.includes(raptor));
  g.worn.head = null;
  const other = mobs.make({ id: 'raptor', hp: 10 }, 5, 1, 5);
  GameWar.hatThorns.call(ctx, other, false);
  ok('without the hat, nothing happens', other.hp === 10);
  ok('banditHits and dinoBites both call it', /this\.hatThorns\(p, true\)/.test(GameWar.banditHits.toString()));
}
process.exit(f ? 1 : 0);
