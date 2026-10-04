import * as THREE from 'three';
import { GuardianView } from './GuardianView.js';

/**
 * What the showcase (world/showcase.js) draws that the rest of the game
 * doesn't: a name in front of every building and at the feet of every
 * figure, so a picture says what's in it; and the two guardians, side by
 * side — the game only ever has one, so it only has one GuardianView.
 *
 * Everyone else in the showcase is drawn by the views the game already
 * has for them (Game.openShowcase puts them in the same lists), so a new
 * look for a settler or a sheep shows up here without anything changing
 * in this file.
 *
 * Built only while a showcase is open, and gone again when it isn't.
 */

/** How many pixels of label texture per block of label height. */
const PX = 96;

function labelTexture(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `600 ${Math.round(PX * 0.62)}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width + PX * 0.6);
  c.width = w;
  c.height = PX;
  ctx.font = font;
  ctx.fillStyle = 'rgba(20, 22, 28, 0.72)';
  ctx.beginPath();
  ctx.roundRect?.(0, 0, w, PX, PX * 0.22) ?? ctx.rect(0, 0, w, PX);
  ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PX * 0.3, PX * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / PX };
}

export class ShowcaseView {
  constructor(scene) {
    this.scene = scene;
    this.shownFor = null;
    this.labels = [];
    this.guardians = [];
  }

  /** Called every frame with Game.showcase, or null when there's none. */
  update(showcase, dt) {
    if (showcase !== this.shownFor) this.rebuild(showcase);
    if (!showcase) return;
    const on = showcase.labels !== false;
    for (const s of this.labels) s.visible = on;
    showcase.figures.guardians.forEach((g, i) => this.guardians[i]?.update(g, dt));
  }

  rebuild(showcase) {
    this.clear();
    this.shownFor = showcase;
    if (!showcase) return;
    for (const l of showcase.labelSpots) {
      const { tex, aspect } = labelTexture(l.text);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(l.size * aspect, l.size, 1);
      s.position.set(l.x, l.y + l.size / 2, l.z);
      this.scene.add(s);
      this.labels.push(s);
    }
    this.guardians = showcase.figures.guardians.map(() => new GuardianView(this.scene));
  }

  clear() {
    for (const s of this.labels) {
      this.scene.remove(s);
      s.material.map.dispose();
      s.material.dispose();
    }
    this.labels = [];
    for (const g of this.guardians) g.dispose();
    this.guardians = [];
  }
}
