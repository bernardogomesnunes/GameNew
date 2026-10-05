import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame, CART_SLOTS } from '../src/duilt/DuiltGame.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { Mobs } from '../src/world/Mobs.js';
import { CartView } from '../src/render/CartView.js';

/**
 * Asked for directly: "horses with wooden carts, at age 2 — you need to have
 * a horse and build the cart and apply the cart to the horse and it's done.
 * This should take 40 slots of items."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the horse and the cart -----------------------------------------------------------
const horse = MOBS_BY_ID.get('horse');
ok('horses live wild on the plains', horse?.biomes.includes('plains') && horse.rideable && horse.skittish);
ok('they are tamed with fruit or carrots', horse.tameWith.includes('fruit') && horse.tameWith.includes('vegetables'));
ok('there is a cart', ITEMS_BY_ID.get('cart')?.glyph === 'cart' && Array.isArray(ITEM_MODELS.cart));
const r = RECIPES.find((x) => x.output?.id === 'cart');
ok('made by hand in Age 2, from planks and wood', r?.station === 'hand' && r.age === 2 && r.inputs.planks > 0 && r.inputs.wood > 0);
ok('a cart holds forty slots', CART_SLOTS === 40);

// --- taming, hitching, loading ---------------------------------------------------------
const { world, origin } = generateDuiltWorld({ sizeX: 96, sizeZ: 96, seed: 3 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
const mobs = new Mobs({ world });
const m = mobs.make(horse, origin.minX + 4, 40, origin.minZ + 4);
mobs.list.push(m);

g.inventory.add('fruit', 2);
ok('empty-handed, it will not be tamed', !g.tameHorse(m, null).ok && !m.owned);
ok('with fruit in hand it is yours', g.tameHorse(m, 'fruit').ok && m.owned && g.mounts.includes(m));
ok('and that took one fruit', g.inventory.countOf('fruit') === 1);
ok('no cart in the bag, no cart on the horse', !g.hitchCart(m).ok && !m.cart);
g.inventory.add('cart', 1);
ok('with a cart it hitches', g.hitchCart(m).ok && m.cart && m.inventory.size === CART_SLOTS);
ok('and the cart left the bag', g.inventory.countOf('cart') === 0);
ok('only one cart to a horse', !g.hitchCart(m).ok);

g.inventory.add('stone', 30);
const cart = g.containerFor({ mount: m });
ok('the cart is a store like a chest', cart === m.inventory);
const at = g.inventory.slots.findIndex((s) => s?.id === 'stone');
g.inventory.moveTo(cart, at);
const sum = g.storeSummary({ mount: m });
ok('loaded, the panel says what is in it', sum.mount === m && sum.items === 30 && sum.size === 40);

// --- kept with the world ---------------------------------------------------------------
m.x += 5;
const saved = JSON.parse(JSON.stringify(g.toJSON()));
const g2 = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
g2.loadJSON(saved);
const back = g2.mounts[0];
ok('your horse comes back where you left it', back?.type === 'horse' && back.owned && Math.abs(back.x - m.x) < 0.01);
ok('cart, load and all', back.cart && back.inventory.countOf('stone') === 30);
const mobs2 = new Mobs({ world });
mobs2.adopt(g2.mounts);
ok('and stands in the world again', mobs2.list.includes(back) && back.hp > 0);

// --- yours stays put, and never runs off ------------------------------------------------
ok('your horse does not count towards the wild ones', mobs.wild() === 0);
mobs.list.push(mobs.make(horse, m.x + 30, 40, m.z));
ok('a wild one does', mobs.wild() === 1);
const src = readFileSync(new URL('../src/world/Mobs.js', import.meta.url), 'utf8');
ok('it never despawns', /m\.penId \|\| m\.owned \|\| m\.still/.test(src));
ok('never bolts from you', /spec\.skittish && !m\.owned/.test(src));
ok('the one you sit on is never in your sights', /m\.dying > 0 \|\| m\.dead \|\| m\.ridden/.test(src));

// --- riding ------------------------------------------------------------------------------
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('Place on a horse is the horse\'s, before anything else', /const horse = this\.horseTarget\(aimed\);\s*if \(horse\) return void this\.useHorse\(horse\);/.test(game));
ok('on horseback you go faster', /\* \(this\.riding \? RIDE_SPEED : 1\)/.test(game) && /RIDE_SPEED = 1\.9/.test(game));
ok('the horse goes where you go', /this\.player\.update\(dt\);\s*this\.keepApart\(\);\s*this\.tickRide\(dt\);/.test(game));
ok('Sneak gets you off', /if \(this\.player\.sneaking\) return void this\.stopRide\(\);/.test(game));
ok('you never hunt your own horse', /if \(mob\.owned\) return true;/.test(game));
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the cart panel says Cart and has Ride', /summary\.mount \? 'Cart'/.test(ui) && /data-store-ride>Ride the horse</.test(ui));
const pc = readFileSync(new URL('../src/player/PlayerController.js', import.meta.url), 'utf8');
ok('you sit up high', /EYE_HEIGHT \+ this\.seatHeight/.test(pc));

// --- the cart, drawn ---------------------------------------------------------------------
const scene = new THREE.Scene();
const view = new CartView(scene);
view.update(g.mounts);
const drawn = view.carts.get(m);
ok('a hitched horse has a cart drawn behind it', drawn && scene.children.includes(drawn)
  && Math.hypot(drawn.position.x - m.x, drawn.position.z - m.z) > 1);
view.update([]);
ok('and it goes when the horse does', view.carts.size === 0 && !scene.children.includes(drawn));

process.exit(f ? 1 : 0);
