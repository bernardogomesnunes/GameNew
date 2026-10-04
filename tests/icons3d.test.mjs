import { ITEMS } from '../src/config/items.js';
import { itemIcon } from '../src/config/cubes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { heldBoxes } from '../src/render/heldModel.js';

/**
 * Backlog batch 2: "3D icons in the bag for weapons and other items
 * (feathers, bucket, chalk line)". Nothing in the bag is a flat drawing on a
 * tile any more: every item is either a little model of itself or the block
 * it places.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const flat = ITEMS.filter((i) => !itemIcon(i, { size: 22 }));
ok(`every item has a 3D icon (${flat.map((i) => i.id).join(', ') || 'none flat'})`, flat.length === 0);
ok('the ones named: feather, bucket, chalk line, and the tools', ['feather', 'bucket', 'bucket_water', 'chalk_line', 'axe', 'pickaxe', 'shovel'].every((id) => ITEM_MODELS[id]));
ok('every tier of tool too', ['iron', 'gold', 'sky', 'dark'].every((t) => ['axe', 'pickaxe', 'shovel'].every((k) => ITEM_MODELS[`${k}_${t}`])));
ok('and the hand holds the same model', heldBoxes({ itemId: 'axe_gold' }) === ITEM_MODELS.axe_gold && heldBoxes({ itemId: 'bucket' }) === ITEM_MODELS.bucket);

process.exit(f ? 1 : 0);
