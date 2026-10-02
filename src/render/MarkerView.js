import * as THREE from 'three';

/**
 * Little marks over people's heads: a ? over a guard looking you over, a !
 * over one who has seen through your disguise (duilt/Suspicion.js). Drawn
 * as sprites from a small pool, always facing you.
 */

const MAX = 48;
/** How high over someone's feet a mark floats. */
const ABOVE = 2.45;

function markTexture(text, colour) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  g.strokeText(text, 32, 35);
  g.fillStyle = colour;
  g.fillText(text, 32, 35);
  return new THREE.CanvasTexture(c);
}

export class MarkerView {
  constructor(scene) {
    this.materials = {
      '?': new THREE.SpriteMaterial({ map: markTexture('?', '#f2c14e'), transparent: true, depthWrite: false, fog: false }),
      '!': new THREE.SpriteMaterial({ map: markTexture('!', '#e5483a'), transparent: true, depthWrite: false, fog: false }),
    };
    this.sprites = [];
    for (let i = 0; i < MAX; i++) {
      const s = new THREE.Sprite(this.materials['?']);
      s.scale.setScalar(0.7);
      s.visible = false;
      s.renderOrder = 6;
      scene.add(s);
      this.sprites.push(s);
    }
  }

  /** @param marks  [{ x, y, z, mark: '?' | '!' }] — everyone to mark this frame */
  update(marks) {
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], m = marks[i];
      s.visible = !!m;
      if (!m) continue;
      s.material = this.materials[m.mark] ?? this.materials['?'];
      s.position.set(m.x, m.y + ABOVE, m.z);
    }
  }
}
