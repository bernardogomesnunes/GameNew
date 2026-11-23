// Draws PLAY-14 to 21's props on a plain background, for the screenshots in docs/screens/play-14-21/.
// Each panel is a scene: a prop shape built from its boxes (the way PropRenderer does), or a
// machine's close-up through the real CrucibleView. Driven by tools/play-14-21-shots.mjs.
import * as THREE from 'three';
import { boxesFor } from '/src/world/propShapes.js';
import { CrucibleView } from '/src/render/CrucibleView.js';
import { Crucibles } from '/src/duilt/Crucible.js';
import { Inventory } from '/src/items/Inventory.js';

const W = 360, H = 320;

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a7a, 1.7));
  const d = new THREE.DirectionalLight(0xffffff, 1.9); d.position.set(3, 6, -4); scene.add(d);
}

/** A prop shape as boxes on a patch of moss, seen from the front (-z side) and a little above. */
function shapePanel(shape) {
  const scene = new THREE.Scene(); lights(scene);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), new THREE.MeshLambertMaterial({ color: 0x6aa04a }));
  ground.position.set(0.5, -0.05, 0.5); scene.add(ground);
  for (const b of boxesFor(shape)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ),
      new THREE.MeshLambertMaterial({ color: b.color ?? 0x8a7a6a, emissive: b.glow ? b.color : 0x000000, emissiveIntensity: b.glow ? 0.9 : 0 }));
    m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    scene.add(m);
  }
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 50);
  cam.position.set(1.7, 1.45, -1.9); cam.lookAt(0.5, 0.38, 0.5);
  return { scene, cam, update() {} };
}

/** A machine's real close-up: a CrucibleView over a loaded pot. */
function closeUp(kind, station, recipeId, items, seconds, level) {
  const scene = new THREE.Scene(); lights(scene);
  const bag = new Inventory();
  for (const [id, n] of Object.entries(items)) bag.add(id, n);
  const crucibles = new Crucibles({ station, bag: () => bag });
  crucibles.load('0,0,0', recipeId, 1);
  crucibles.tick(seconds);
  const cam = new THREE.PerspectiveCamera(65, W / H, 0.05, 50);
  const view = new CrucibleView({ scene, camera: cam, crucibles, kind });
  view.start('0,0,0', { x: 0, y: 0, z: 0 });
  view.level = level;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 6), new THREE.MeshLambertMaterial({ color: 0x8a8f94 }));
  floor.position.set(0.5, 0.95, 0.5); scene.add(floor);
  return { scene, cam, update() { view.update(0.016); } };
}

const PANELS = {
  'mushy-logs': [
    ['Red Mushy Log, stage 0 (day 0)', () => shapePanel('mushy_red_0')],
    ['stage 1 (day 4)', () => shapePanel('mushy_red_1')],
    ['stage 2 (day 10, ready)', () => shapePanel('mushy_red_2')],
    ['Lilac Mushy Log, ready', () => shapePanel('mushy_lilac_2')],
    ['Pale Mushy Log, ready', () => shapePanel('mushy_pale_2')],
  ],
  'wild-mushrooms': [
    ['Red Mushroom', () => shapePanel('mushroom_red')],
    ['Lilac Mushroom', () => shapePanel('mushroom_lilac')],
    ['Pale Mushroom', () => shapePanel('mushroom_pale')],
  ],
  'machines': [
    ['Dehydrator (block 568)', () => shapePanel('dehydrator')],
    ['Dehydrator close-up, tray half out', () => closeUp('dehydrator', 'dehydrator', 'dry_red', { mushroom_red: 4 }, 30, 0.5)],
    ['Cauldron (block 569)', () => shapePanel('cauldron')],
    ['Cauldron close-up, bowl filling', () => closeUp('cauldron', 'cauldron', 'hunters_stew', { raw_meat: 2, vegetables: 1, potato: 1, dried_pale: 1 }, 40, 0.7)],
  ],
};

const name = new URLSearchParams(location.search).get('set') ?? 'mushy-logs';
const list = PANELS[name];
const cols = Math.min(list.length, 3), rows = Math.ceil(list.length / cols);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(cols * W, rows * H);
renderer.setClearColor(0xe8f0ee);
renderer.setScissorTest(true);
document.body.append(renderer.domElement);
renderer.domElement.style.display = 'block';
list.forEach(([label, make], i) => {
  const p = make();
  p.update();
  const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
  renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H);
  renderer.render(p.scene, p.cam);
  const l = document.createElement('div');
  l.className = 'l'; l.textContent = label;
  l.style.left = `${x}px`; l.style.top = `${Math.floor(i / cols) * H}px`;
  document.body.append(l);
});
window.__done = true;
