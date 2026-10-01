import * as THREE from 'three';
import { MAX_SWARMS, SWARM } from '../world/Fireflies.js';

/**
 * The fireflies, drawn: one set of points for all of them, each a soft
 * round glow added onto whatever is behind it, so they read as neon against
 * a dark sky and a dark wood. Brightness rides in the vertex colour, which
 * is how each one blinks on its own.
 */

const MAX = MAX_SWARMS * SWARM;
const GREEN = new THREE.Color(0xb8ff4f);

/** A soft white dot fading to nothing at its edge — the glow every point is drawn with. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class FireflyView {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setDrawRange(0, 0);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.32,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  update(fireflies) {
    const geo = this.points.geometry;
    if (!fireflies || fireflies.level <= 0) { geo.setDrawRange(0, 0); return; }
    const pos = geo.attributes.position, col = geo.attributes.color;
    let n = 0;
    fireflies.dots((x, y, z, glow) => {
      if (n >= MAX) return;
      pos.setXYZ(n, x, y, z);
      col.setXYZ(n, GREEN.r * glow, GREEN.g * glow, GREEN.b * glow);
      n++;
    });
    geo.setDrawRange(0, n);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.map?.dispose();
    this.points.material.dispose();
  }
}
