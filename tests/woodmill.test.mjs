import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import {
  WOOD_MILL, STRIPPED_LOGS, CABINET, WARDROBE, BEDSIDE_TABLE, PANELS, BLOCKS_BY_ID, PLACEABLE_BLOCKS,
  stationOf, logOnFace, quarterTurned, panelOnFace, facingOf, countsAs, endAxisOf,
} from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { boxesFor } from '../src/world/propShapes.js';
import { layerFor, topLayerFor } from '../src/render/BlockTextures.js';

/**
 * Backlog batch 3, #32: "The wood mill is the first 'machine': a placeable
 * block you use. It turns logs into planks, stairs, doors and trapdoors for
 * less wood. It makes stripped logs. It makes a full furniture set: cabinets,
 * wardrobes, bedside tables. It makes wooden wall panels you put on one face
 * of a block for interiors, in plain, patterned and two-tone wood."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const recipe = (id) => RECIPES.find((r) => r.id === id);

// --- the mill itself ---------------------------------------------------------------------

ok('the wood mill is a block you put down, made at the bench in Age 2',
  PLACEABLE_BLOCKS.some((b) => b.id === WOOD_MILL) && recipe('wood_mill')?.station === 'hand' && recipe('wood_mill').age === 2);
ok('it is a station, whichever way it faces', [0, 1, 2, 3].every((k) => stationOf(WOOD_MILL + k) === 'wood_mill'));
ok('it is modelled: a bench, a blade, a log', boxesFor('wood_mill').length >= 10);
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  ok('away from one, you are not at it', !g.stationsNear({ x: 16, y: 2, z: 16 }).includes('wood_mill'));
  world.setBlock(18, 1, 17, WOOD_MILL + 2);
  ok('beside one, you are', g.stationsNear({ x: 16.5, y: 1, z: 16.5 }).includes('wood_mill'));
  ok('a few blocks off, still', g.stationsNear({ x: 21.5, y: 1, z: 20.5 }).includes('wood_mill'));
  ok('across the room, not', !g.stationsNear({ x: 26.5, y: 1, z: 16.5 }).includes('wood_mill'));
  const at = g.crafting.available(2, { station: null, atStations: g.stationsNear({ x: 16.5, y: 1, z: 16.5 }) });
  const away = g.crafting.available(2, { station: null, atStations: [] });
  ok('by it, its recipes can be made; away, they say where to go',
    at.find((r) => r.id === 'cabinet').atStation && /Stand at your wood mill/.test(away.find((r) => r.id === 'cabinet').reason));
}
ok('Place on it opens the bench, on what is made there', /stationOf\(aimed\.block\)\) return void this\.ui\.openBench\(stationName\(stationOf\(aimed\.block\)\)\)/.test(game)
  && /if \(stationOf\(id\)\) return 'Use';/.test(game));

// --- wood goes further ---------------------------------------------------------------------

ok('three planks to a log, not two — every wood', [['mill_planks', 'planks'], ['mill_planks_white', 'white_planks'], ['mill_planks_dark', 'dark_planks']]
  .every(([id, out]) => recipe(id)?.output.id === out && recipe(id).output.count === 3 && recipe('planks').output.count === 2));
const perPlank = (r) => Object.values(r.inputs).reduce((a, b) => a + b, 0) / r.output.count;
for (const [mill, hand] of [['mill_door', 'door'], ['mill_trapdoor', 'trapdoor'], ['mill_stairs_plank', 'stairs_plank'],
  ['mill_door_white', 'door_white'], ['mill_trapdoor_dark', 'trapdoor_dark']]) {
  ok(`${recipe(mill).output.id} for less at the mill (${perPlank(recipe(mill))} a piece, not ${perPlank(recipe(hand))})`,
    recipe(mill).station === 'wood_mill' && recipe(mill).output.id === recipe(hand).output.id && perPlank(recipe(mill)) < perPlank(recipe(hand)));
}

// --- stripped logs -------------------------------------------------------------------------

{
  const items = STRIPPED_LOGS.map((id) => ITEM_FOR_BLOCK.get(id));
  ok(`stripped logs in every wood: ${items.join(', ')}`, items.every((id) => ITEMS_BY_ID.has(id) && recipe(id)?.station === 'wood_mill'));
  ok('they stand, or lie along the face you put them on, like logs',
    STRIPPED_LOGS.every((id) => endAxisOf(logOnFace(id, { x: 1 })) === 0 && endAxisOf(logOnFace(id, { z: -1 })) === 2 && logOnFace(id, { y: 1 }) === id));
  ok('turning a building turns them', quarterTurned(logOnFace(345, { x: 1 })) === logOnFace(345, { z: 1 }));
  ok('lying, they pick up as themselves', ITEM_FOR_BLOCK.get(logOnFace(346, { x: 1 })) === 'stripped_log_white');
  ok('and count as the log they were for a building', countsAs(345) === 4 && countsAs(logOnFace(347, { z: 1 })) === 43);
  ok('pale grain on the sides, rings on the ends', STRIPPED_LOGS.every((id) => layerFor(id) >= 0 && topLayerFor(id) !== layerFor(id)));
}

// --- furniture -------------------------------------------------------------------------------

{
  const kinds = [[CABINET, 'cabinet'], [WARDROBE, 'wardrobe'], [BEDSIDE_TABLE, 'bedside_table']];
  ok('a cabinet, a wardrobe and a bedside table, made at the mill',
    kinds.every(([id, item]) => ITEM_FOR_BLOCK.get(id) === item && recipe(item)?.station === 'wood_mill'));
  ok('each modelled, each with an icon', kinds.every(([id, item]) => boxesFor(BLOCKS_BY_ID.get(id).shape).length >= 4 && (itemIcon(ITEMS_BY_ID.get(item)) ?? '').startsWith('<svg')));
  ok('they face you, like a chest', kinds.every(([id]) => BLOCKS_BY_ID.get(id).facesYou) && /\|\| BLOCKS_BY_ID\.get\(type\)\?\.facesYou \? look \+ 2 : look/.test(game));
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(2, 1, 2, WARDROBE); w.setBlock(4, 1, 2, BEDSIDE_TABLE); w.setBlock(6, 1, 2, CABINET);
  ok('a wardrobe stands taller than you; a bedside table is low', w.collisionBoxAt(2, 1, 2).maxY === 2.9 && w.collisionBoxAt(4, 1, 2).maxY === 1.5);
  ok('and the wardrobe is drawn taller than its block', Math.max(...boxesFor('wardrobe').map((b) => b.maxY)) > 1.8);
}

// --- wall panels ------------------------------------------------------------------------------

{
  ok('panels: plain, patterned and two-tone', PANELS.map((id) => ITEM_FOR_BLOCK.get(id)).join() === 'panel_plain,panel_pattern,panel_twotone'
    && PANELS.every((id) => recipe(ITEM_FOR_BLOCK.get(id))?.station === 'wood_mill'));
  ok('the two-tone one is two woods', recipe('panel_twotone').inputs.planks > 0 && recipe('panel_twotone').inputs.dark_planks > 0
    && new Set(boxesFor('panel_twotone').map((b) => b.color)).size >= 2);
  ok('each a sixteenth thick, flat on its back face', PANELS.every((id) => boxesFor(BLOCKS_BY_ID.get(id).shape).every((b) => b.minZ >= 0 && b.maxZ <= 0.1)));
  // On the face pointed at: its back against the block behind it.
  const faces = [[{ x: 0, y: 0, z: 1 }, 0], [{ x: -1, y: 0, z: 0 }, 1], [{ x: 0, y: 0, z: -1 }, 2], [{ x: 1, y: 0, z: 0 }, 3]];
  ok('it goes flat on whichever face you point at', faces.every(([n, f]) => facingOf(panelOnFace(366, n)) === f));
  ok('the game puts it there', /panelOnFace\(slabOnFace\(/.test(game));
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(3, 1, 3, 370);
  ok('you walk past one, the way you do a painting', w.collisionBoxAt(3, 1, 3) == null);
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  ok('and it is drawn', c.propMesh.geometry.attributes.position.count >= 24 * 5);
}

process.exit(f ? 1 : 0);
