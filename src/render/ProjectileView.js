import * as THREE from 'three';

/**
 * Catapult stones in flight, and — while you're manning one — the arc a
 * throw would take and a ring where it would come down. On a phone there's
 * no other way to judge a throw before you spend the stone on it.
 */

const MAX_STONES = 16;
const ARC_POINTS = 160;

export class ProjectileView {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.stones = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x9a9aa2 }), MAX_STONES);
    this.stones.count = 0;
    this.stones.frustumCulled = false;
    scene.add(this.stones);

    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
    this.arc = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({
      color: 0xfff1c9, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.9, depthTest: false,
    }));
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 10;
    this.arc.visible = false;
    scene.add(this.arc);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    scene.add(this.marker);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  /** Redraws the stones in flight. Called each frame. */
  update(stones) {
    const n = Math.min(stones.length, MAX_STONES);
    this.stones.count = n;
    for (let i = 0; i < n; i++) {
      const s = stones[i];
      this._e.set(s.age * 7, s.age * 5, 0); // tumbling
      this._q.setFromEuler(this._e);
      this._p.set(s.x, s.y, s.z);
      this._m.compose(this._p, this._q, this._s);
      this.stones.setMatrixAt(i, this._m);
    }
    this.stones.instanceMatrix.needsUpdate = true;
  }

  /**
   * The aim: `points` along the arc and where it lands, or null to hide it.
   * `inRange` false draws it red — that's as far as it throws.
   */
  setAim(aim) {
    if (!aim) {
      this.arc.visible = false;
      this.marker.visible = false;
      return;
    }
    const pos = this.arc.geometry.attributes.position;
    const n = Math.min(aim.points.length, ARC_POINTS);
    for (let i = 0; i < n; i++) pos.setXYZ(i, aim.points[i].x, aim.points[i].y, aim.points[i].z);
    pos.needsUpdate = true;
    this.arc.geometry.setDrawRange(0, n);
    this.arc.computeLineDistances();
    this.arc.material.color.setHex(aim.inRange ? 0xfff1c9 : 0xff7a6b);
    this.arc.visible = true;
    if (aim.landed) {
      this.marker.position.set(aim.landed.x, aim.landed.y + 0.06, aim.landed.z);
      this.marker.material.color.setHex(aim.inRange ? 0xffb35c : 0xff7a6b);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
  }

  dispose() {
    for (const o of [this.stones, this.arc, this.marker]) {
      this.scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}
