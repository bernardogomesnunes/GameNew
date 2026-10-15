import * as THREE from 'three';
import { readFileSync, existsSync } from 'node:fs';
import { addKit, modelKit, Crowd, dress, poseBone } from '../src/render/Models.js';
import { MobView } from '../src/render/MobView.js';
import { SettlerView, personModel } from '../src/render/SettlerView.js';
import { MOBS } from '../src/config/mobs.js';
import { OUTFITS } from '../src/config/outfits.js';

/**
 * Asked for directly: "put them in the game" — the animals, people and
 * vehicles rebuilt in Blender (tools/mobs, art/mobs), shipped as .glb files in
 * public/models/ and drawn by render/Models.js in place of the old boxes.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- every one is shipped ------------------------------------------------------------
const index = JSON.parse(readFileSync(new URL('../public/models/index.json', import.meta.url), 'utf8'));
const shipped = (id) => index.includes(id) && existsSync(new URL(`../public/models/${id}.glb`, import.meta.url));
ok('every animal has a model', MOBS.every((m) => shipped(m.id)));
ok('every kind of person in the outfits has one', Object.keys(OUTFITS).every((k) => shipped(k)));
ok('settlers and citizens come in several looks',
  ['settler', 'settler_1', 'settler_5', 'citizen', 'citizen_3'].every(shipped));
ok('the vehicles, siege engines and guardians have theirs',
  ['cart', 'glider', 'helix', 'train_engine', 'rail_car', 'flying_car', 'tram', 'battering_ram', 'catapult', 'warbeast', 'aurelion', 'umbra'].every(shipped));

// --- who is drawn as what ------------------------------------------------------------
ok('a settler is one of six looks, the same one every frame',
  personModel({ name: 'Ada' }, 'settlers') === personModel({ name: 'Ada' }, 'settlers') && /^settler(_\d)?$/.test(personModel({ name: 'Ada' }, 'settlers')));
ok('among strangers, a soldier is the Stone Kingdom\'s', personModel({ kind: 'soldier' }, 'wanderers') === 'warrior');
ok('and an archer is a Stone archer', personModel({ kind: 'archer' }, 'wanderers') === 'stone_archer');
ok('but your own soldier is yours', personModel({ kind: 'soldier' }, 'defenders') === 'soldier');
ok('anyone else is drawn as their kind', personModel({ kind: 'sky_king' }, 'wanderers') === 'sky_king');

// --- no browser, no models: the views draw what they drew before -----------------------
ok('nothing loads without a browser', modelKit('cow') === null);
const scene = new THREE.Scene();
const mobs = new MobView(scene);
const cow = { type: 'cow', x: 0, y: 0, z: 0, facing: 0, speed: 0, stride: 0, hurt: 0 };
mobs.update([cow]);
const e = new THREE.Matrix4();
mobs.bodies.getMatrixAt(0, e);
ok('so a cow is still its boxes', e.determinant() !== 0);

// --- a model, by hand: two bones, a body and a leg under it --------------------------
const geo = new THREE.BoxGeometry(1, 1, 1);
const kit = {
  id: 'cow', material: new THREE.MeshLambertMaterial(),
  root: new THREE.Group(),
  bones: [
    { name: 'root', parent: -1, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry: null },
    { name: 'body', parent: 0, position: new THREE.Vector3(0, 1, 0), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry: geo },
    { name: 'leg_fl', parent: 1, position: new THREE.Vector3(0, -0.5, -0.5), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry: geo },
  ],
};
const crowd = new Crowd(scene, kit, 4);
crowd.begin();
crowd.add(new THREE.Matrix4().makeTranslation(5, 0, 0), { leg_fl: [0.5, 0, 0] });
crowd.add(new THREE.Matrix4().makeTranslation(-5, 0, 0));
crowd.end();
ok('a crowd draws each bone once per animal', crowd.meshes[1].count === 2 && crowd.meshes[2].count === 2 && crowd.meshes[0] === null);
const m = new THREE.Matrix4(), p = new THREE.Vector3();
crowd.meshes[2].getMatrixAt(0, m);
p.setFromMatrixPosition(m);
ok('a bone hangs from its parent, where the animal is', Math.abs(p.x - 5) < 1e-6 && Math.abs(p.y - 0.5) < 1e-6 && Math.abs(p.z + 0.5) < 1e-6);
const q = new THREE.Quaternion().setFromRotationMatrix(m);
ok('and is turned by its pose', Math.abs(q.angleTo(new THREE.Quaternion()) - 0.5) < 1e-6);

// Once a cow's model is in, MobView draws it and puts its boxes away.
addKit('cow', kit);
mobs.update([cow]);
mobs.bodies.getMatrixAt(0, e);
ok('with the model in, the cow is drawn by it', [...mobs.crowds.byId.values()][0]?.n === 1 && e.determinant() === 0);

// --- a few of a thing: a copy of the model in the view's own group -------------------
const body = new THREE.Group(); body.name = 'cow_body';
kit.root.add(body);
const group = new THREE.Group();
const old = new THREE.Mesh(geo);
const light = new THREE.PointLight();
group.add(old, light);
const d = dress(group, 'cow');
ok('dressing a group hides what it drew, but not its light', d && !old.visible && light.visible && group.children.includes(d.root));
ok('dressing it again changes nothing', dress(group, 'cow') === d && group.children.length === 3);
poseBone(d.bones.body, 0.3, 0, 0);
ok('its bones turn from their rest pose', Math.abs(d.bones.body.quaternion.angleTo(d.bones.body.userData.rest.quaternion) - 0.3) < 1e-6);

// --- people ---------------------------------------------------------------------------
addKit('settler', kit);
const people = new SettlerView(scene, 'settlers');
const who = Array.from({ length: 40 }, (_, i) => ({ name: `n${i}`, x: i, y: 0, z: 0, colour: 0x888888 }));
people.update(who);
const drawn = [...people.crowds.byId.values()].reduce((s, c) => s + c.n, 0);
ok('settlers whose look has loaded are drawn by it; the rest keep their boxes',
  drawn > 0 && drawn < 40 && drawn === who.filter((p) => personModel(p, 'settlers') === 'settler').length);

ok('the game starts loading them', /this\.modelsLoaded = loadModels\(\)/.test(readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8')));

console.log(f ? `${f} FAILED` : 'all passed');
process.exit(f ? 1 : 0);
