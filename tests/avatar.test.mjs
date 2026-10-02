import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { VIEWS, nextView, lookColours, DEFAULT_LOOK, SKINS, HAIRS, CLOTHES, VIEW_DISTANCE } from '../src/config/avatar.js';
import { ACTIONS, DEFAULT_CONTROLS } from '../src/config/controls.js';
import { heldBoxes, heldGeometryFor, HELD_MODELS } from '../src/render/heldModel.js';
import { AvatarView } from '../src/render/AvatarView.js';
import { ITEMS } from '../src/config/items.js';

/**
 * Playtest, P3 and P7. Asked for directly: "user needs an avatar that can be
 * seen in 3rd person, which can be changed in settings, especially for
 * mobile; in desktop there should be a key" — and "Weapons need 3D versions
 * of them and they need to be shown on the UI when the avatar is moving, in
 * their hands, plus fruit, buckets and all holding items."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

// --- the views ---------------------------------------------------------------------------------

ok('three views, round in turn: your eyes, behind, in front', VIEWS.join() === 'first,behind,front' && nextView('first') === 'behind' && nextView('front') === 'first');
ok('a key on desktop: F5, and it can be changed', ACTIONS.find((a) => a.id === 'view')?.key === 'F5');
ok('  pressing it doesn\'t reload the page', /if \(e\.code === this\.controls\.keys\.view\) \{ e\.preventDefault\(\); this\.cycleView\(\); return; \}/.test(game));
ok('a button for it on a phone', /id="t-view"/.test(ui) && /\['#t-view', \(\) => this\.game\.cycleView\?\.\(\)\]/.test(ui));
ok('and Settings remembers which', DEFAULT_CONTROLS.view === 'first' && /this\.applyControls\(\{ view \}\)/.test(game) && /this\.player\.view = this\.controls\.view/.test(game));

{
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const camera = new THREE.PerspectiveCamera(75, 0.5, 0.2, 500);
  const player = new PlayerController(world, camera, { x: 16.5, y: 1, z: 16.5 });
  player.yaw = 0; player.pitch = 0;
  player.syncCamera();
  ok('in first person the camera is your eyes', Math.abs(camera.position.z - 16.5) < 0.01);
  const look = player.lookDirection();
  player.view = 'behind';
  player.syncCamera();
  ok(`behind: the camera stands back over your shoulder (${(camera.position.z - 16.5).toFixed(1)} behind)`, camera.position.z - 16.5 > VIEW_DISTANCE * 0.9);
  ok('  and you still aim where you look, not where the camera does', player.lookDirection().distanceTo(look) < 1e-6);
  player.view = 'front';
  player.syncCamera();
  ok('in front: it looks back at you', camera.position.z < 16.5 - 3);
  // A wall behind you: the camera comes in short of it.
  for (let y = 1; y < 6; y++) for (let x = 12; x < 21; x++) world.setBlock(x, y, 18, 3);
  player.view = 'behind';
  player.syncCamera();
  ok(`a wall behind you pulls the camera in front of it (${(camera.position.z - 16.5).toFixed(2)})`, camera.position.z < 18 && camera.position.z > 16.5);
}

// --- your look ----------------------------------------------------------------------------------

ok('skin, hair and clothes to choose from', SKINS.length >= 4 && HAIRS.length >= 4 && CLOTHES.length >= 4);
ok('chosen in Settings', /data-look="\$\{key\}"/.test(ui) && /swatches\('skin', SKINS\)/.test(ui) && /swatches\('hair', HAIRS\)/.test(ui));
ok('and a broken choice falls back to something real', lookColours({ skin: 99, hair: -3, clothes: 'x' }).skin === SKINS.at(-1) && lookColours().shirt === CLOTHES[DEFAULT_LOOK.clothes].shirt);
{
  const scene = new THREE.Scene();
  const view = new AvatarView(scene);
  const player = { position: { x: 1, y: 2, z: 3 }, yaw: 1, pitch: 0, velocity: { x: 4, z: 0 } };
  view.update(0.1, player, { look: { skin: 0, hair: 2, clothes: 1 }, worn: { head: { id: 'armour_sky_head' }, feet: null }, held: { itemId: 'sword_iron' }, visible: true });
  ok('the avatar stands where you are, facing your way', view.group.visible && view.group.position.x === 1 && view.group.rotation.y === 1);
  ok('in the colours you chose', view.mats.hair.color.getHex() === HAIRS[2] && view.mats.shirt.color.getHex() === CLOTHES[1].shirt);
  ok('wearing your armour — a helm, no boots', view.helm.visible && !view.legs[0].boot.visible);
  for (let i = 0; i < 5; i++) view.update(0.1, player, { look: DEFAULT_LOOK, worn: {}, held: { itemId: 'sword_iron' }, visible: true });
  ok('walking, its legs swing opposite', Math.sign(view.legs[0].hip.rotation.x) === -Math.sign(view.legs[1].hip.rotation.x) && view.legs[0].hip.rotation.x !== 0);
  ok('with the sword in its hand', view.held.visible && view.held.geometry.attributes.position.count > 0);
  view.update(0.1, player, { look: DEFAULT_LOOK, worn: {}, held: {}, visible: false });
  ok('and not there at all in first person', !view.group.visible);
}

// --- held things in 3D ------------------------------------------------------------------------------

ok('a sword is held as its model', heldBoxes({ itemId: 'sword_iron' }).length >= 4);
ok('an axe is held with its blade the way you swing it, not out to the side',
  HELD_MODELS.axe.filter((b) => b.minY > 0.5).every((b) => b.maxX <= 0.46));
ok('in first person a tool is held as in third person: turned a quarter round, its blade ahead',
  /if \(pointing\) this\.item\.rotation\.set\(HOLD_TIP, -Math\.PI \/ 2 \+ HOLD_TURN, 0\)/.test(readFileSync(new URL('../src/render/HandView.js', import.meta.url), 'utf8')));
ok('so are the tools and the bucket', ['axe', 'pickaxe', 'shovel', 'bucket', 'bucket_water'].every((id) => HELD_MODELS[id]?.length >= 2));
ok('fruit too', heldBoxes({ itemId: 'fruit' }).length >= 2);
ok('a block, as itself', heldBoxes({ blockId: 1 }).length === 1 && heldBoxes({ blockId: 33 }).length > 1);
ok(`and everything you can hold has something to show (${ITEMS.length} items)`, ITEMS.every((i) => heldGeometryFor({ itemId: i.id })));
ok('in first person, in your hand at the bottom right; it swings when you strike or place',
  /this\.handView\?\.strike\(\)/.test(game) && /this\.avatarView\?\.strike\(\)/.test(game) && /new HandView\(this\.scene, this\.camera\)/.test(game));

process.exit(f ? 1 : 0);
