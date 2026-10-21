import * as THREE from 'three';

/**
 * The game's models: every animal, person and vehicle, built in Blender out of
 * pixel-textured boxes (tools/mobs, art/mobs) and shipped as .glb files in
 * public/models/, listed in its index.json.
 *
 * Each model is a tree of bones (a body, a head, legs, wheels...) with the
 * boxes on each bone merged into one geometry, and one material: the colour
 * atlas, lit, with its glowing pixels in an emission map so runes, eyes and
 * lamps shine at night. A model faces -z, one unit to a block, feet at y = 0.
 *
 * The views that draw many of one thing (animals, people) use a Crowd: one
 * instanced mesh per bone, so a herd of twenty cows is as many draw calls as
 * one. The views that draw a few (vehicles, guardians, siege engines) put a
 * copy of the model into their own group with dress(). Until the files have
 * loaded, and wherever there's no browser to load them in (the tests), a view
 * keeps drawing what it drew before.
 */

const kits = new Map();   // id → kit
let loading = null;

/** Starts loading every model, once. Resolves when they're all in (or failed). */
export function loadModels(base = 'models/') {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return (loading = Promise.resolve());
  loading = (async () => {
    const [{ GLTFLoader }, { mergeGeometries }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    const url = (f) => new URL(base + f, document.baseURI).href;
    let ids = [];
    try {
      ids = await (await fetch(url('index.json'))).json();
    } catch (e) {
      console.warn('No models to load:', e.message);
      return;
    }
    const loader = new GLTFLoader();
    await Promise.all(ids.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(url(`${id}.glb`));
        kits.set(id, makeKit(id, gltf.scene, mergeGeometries));
      } catch (e) {
        console.warn(`Model ${id} didn't load:`, e.message);
      }
    }));
  })();
  return loading;
}

/** A loaded model, or null while it isn't (yet). */
export function modelKit(id) {
  return kits.get(id) ?? null;
}

/** For tests: put a kit in by hand. */
export function addKit(id, kit) {
  kits.set(id, kit);
}

function pixelated(t) {
  if (!t) return t;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Bones, their merged geometry, and a lit material, from a loaded .glb scene. */
export function makeKit(id, scene, mergeGeometries) {
  const root = scene.getObjectByName(id) ?? scene.children[0] ?? scene;
  let source = null;
  root.traverse((o) => { if (o.isMesh && !source) source = o.material; });
  const material = new THREE.MeshLambertMaterial({
    map: pixelated(source?.map ?? null),
    emissiveMap: pixelated(source?.emissiveMap ?? null),
    emissive: source?.emissiveMap ? 0xffffff : 0x000000,
  });

  const short = (name) => (name.startsWith(id + '_') ? name.slice(id.length + 1) : name);
  const bones = [];
  const index = new Map();
  const walk = (node, parent) => {
    const i = bones.length;
    const bone = {
      name: node === root ? 'root' : short(node.name), parent,
      position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
      geometry: null,
    };
    bones.push(bone);
    index.set(node, i);
    const parts = [];
    for (const child of node.children) {
      if (child.isMesh) {
        child.updateMatrix();
        parts.push(child.geometry.clone().applyMatrix4(child.matrix));
        child.material = material;
      } else {
        walk(child, i);
      }
    }
    if (parts.length) {
      for (const g of parts) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      bone.geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    }
  };
  walk(root, -1);
  return { id, root, bones, material };
}

const WHITE = new THREE.Color(1, 1, 1);

/**
 * Many of one model, drawn instanced: begin(), add() each, end(). A pose is
 * { boneName: [x, y, z] } radians, turned on top of the bone's rest pose in
 * the model's own frame.
 */
export class Crowd {
  constructor(scene, kit, max) {
    this.kit = kit;
    this.max = max;
    this.n = 0;
    this.mats = kit.bones.map(() => new THREE.Matrix4());
    this.meshes = kit.bones.map((b) => {
      if (!b.geometry) return null;
      const m = new THREE.InstancedMesh(b.geometry, kit.material, max);
      m.frustumCulled = false;
      m.count = 0;
      m.setColorAt(0, WHITE);
      scene.add(m);
      return m;
    });
    this._local = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  begin() {
    this.n = 0;
  }

  /** One more of them, its feet at `base` (a world matrix), facing that matrix's -z. */
  add(base, pose = null, tint = null) {
    if (this.n >= this.max) return false;
    const { bones } = this.kit;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const r = pose?.[b.name];
      this._q.copy(b.quaternion);
      if (r) this._q.multiply(this._q2.setFromEuler(this._e.set(r[0], r[1], r[2])));
      this._local.compose(b.position, this._q, b.scale);
      this.mats[i].multiplyMatrices(b.parent < 0 ? base : this.mats[b.parent], this._local);
      const mesh = this.meshes[i];
      if (mesh) {
        mesh.setMatrixAt(this.n, this.mats[i]);
        mesh.setColorAt(this.n, tint ?? WHITE);
      }
    }
    this.n++;
    return true;
  }

  end() {
    for (const m of this.meshes) {
      if (!m) continue;
      m.count = this.n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  setVisible(on) {
    for (const m of this.meshes) if (m) m.visible = on;
  }

  dispose() {
    for (const m of this.meshes) {
      if (!m) continue;
      m.removeFromParent();
      // InstancedMesh owns its instance buffers; geometry/material are shared
      // by the cached kit and must remain usable by other crowds.
      m.dispose();
    }
  }
}

/** A Crowd per model id, made the first time one is wanted. */
export class Crowds {
  constructor(scene, max) {
    this.scene = scene;
    this.max = max;
    this.byId = new Map();
    this.visible = true;
  }

  get(kit) {
    let c = this.byId.get(kit.id);
    if (!c) {
      c = new Crowd(this.scene, kit, this.max);
      c.setVisible(this.visible);
      this.byId.set(kit.id, c);
    }
    return c;
  }

  begin() { for (const c of this.byId.values()) c.begin(); }
  end() { for (const c of this.byId.values()) c.end(); }
  setVisible(on) { this.visible = on; for (const c of this.byId.values()) c.setVisible(on); }
  dispose() { for (const c of this.byId.values()) c.dispose(); this.byId.clear(); }
}

/**
 * Puts a copy of model `id` into `group` in place of what the group drew
 * before (its other children are hidden, all but lights and `keep`). Turned
 * by `turn` about y (a model faces -z; most views' things face +z), scaled,
 * and raised by `y`. Returns { root, bones, material }, or null until the
 * model has loaded. Safe to call every frame.
 */
export function dress(group, id, { turn = Math.PI, scale = 1, y = 0, keep = [], ownMaterial = false } = {}) {
  if (group.userData.dressed) return group.userData.dressed;
  const kit = modelKit(id);
  if (!kit) return null;
  for (const child of group.children) if (!child.isLight && !keep.includes(child)) child.visible = false;
  const root = kit.root.clone(true);
  root.rotation.y += turn;
  root.position.y += y;
  if (Array.isArray(scale)) root.scale.multiply(new THREE.Vector3(...scale));
  else root.scale.multiplyScalar(scale);
  let material = kit.material;
  if (ownMaterial) {
    material = kit.material.clone();
    root.traverse((o) => { if (o.isMesh) o.material = material; });
  }
  const bones = {};
  root.traverse((o) => {
    if (o.isMesh) return;
    const name = o === root ? 'root' : o.name.startsWith(id + '_') ? o.name.slice(id.length + 1) : o.name;
    o.userData.rest = { position: o.position.clone(), quaternion: o.quaternion.clone() };
    bones[name] = o;
  });
  group.add(root);
  return (group.userData.dressed = { root, bones, material });
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion();
/** Turns a dressed bone by [x, y, z] radians from its rest pose. */
export function poseBone(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  bone.quaternion.copy(bone.userData.rest.quaternion).multiply(_q.setFromEuler(_e.set(x, y, z)));
}
