import * as THREE from 'three';

/**
 * IMP-26 (owner, 8 November: "when placing for them to build it should add
 * the boundaries of the building"): the footprint of every building waiting
 * for or under construction, as an outline on the site, gone when it is done.
 * One line box per site, made when the list of sites changes, never per frame.
 */
const COLOR = 0xffb347;

export class BuildSitesView {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];
    this.key = '';
    this.material = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.9 });
  }

  /** `builds`: VillagerJobs.builds. Only queued ones with a region are drawn. */
  update(builds = []) {
    const sites = builds.filter((j) => j.state === 'queued' && j.region);
    const key = sites.map((j) => `${j.id}:${j.region.minX},${j.region.minY},${j.region.minZ},${j.region.maxX},${j.region.maxY},${j.region.maxZ}`).join('|');
    if (key === this.key) return;
    this.key = key;
    this.clear();
    for (const j of sites) {
      const r = j.region;
      const w = r.maxX - r.minX + 1, h = r.maxY - r.minY + 1, d = r.maxZ - r.minZ + 1;
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.04, h + 0.04, d + 0.04));
      const box = new THREE.LineSegments(geo, this.material);
      box.position.set(r.minX + w / 2, r.minY + h / 2, r.minZ + d / 2);
      this.scene.add(box);
      this.boxes.push(box);
    }
  }

  get count() {
    return this.boxes.length;
  }

  clear() {
    for (const b of this.boxes) { this.scene.remove(b); b.geometry.dispose(); }
    this.boxes = [];
  }

  dispose() {
    this.clear();
    this.material.dispose();
  }
}
