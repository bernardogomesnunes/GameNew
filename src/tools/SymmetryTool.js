const MODES = ['off', 'x', 'z', 'both'];

export class SymmetryTool {
  constructor(world) {
    this.world = world;
    this.modeIndex = 0;
    this.originX = Math.floor(world.sizeX / 2);
    this.originZ = Math.floor(world.sizeZ / 2);
  }

  get mode() {
    return MODES[this.modeIndex];
  }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    return this.mode;
  }

  mirrorX(x) {
    return this.originX * 2 - 1 - x;
  }

  mirrorZ(z) {
    return this.originZ * 2 - 1 - z;
  }

  /** Returns an array of world positions symmetric to (x,y,z) under the active mode, including the original. */
  reflect(x, y, z) {
    const points = [{ x, y, z }];
    const mode = this.mode;
    if (mode === 'off') return points;
    if (mode === 'x' || mode === 'both') points.push({ x: this.mirrorX(x), y, z });
    if (mode === 'z' || mode === 'both') points.push({ x, y, z: this.mirrorZ(z) });
    if (mode === 'both') points.push({ x: this.mirrorX(x), y, z: this.mirrorZ(z) });
    const seen = new Set();
    return points.filter((p) => {
      const key = `${p.x},${p.y},${p.z}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
