/** Prepare GPU programs without synchronously waiting for their first draw. */
export class ShaderWarmup {
  constructor(renderer) {
    this.renderer = renderer;
    this.supported = !!(renderer.compileAsync && renderer.extensions?.has('KHR_parallel_shader_compile'));
    this.geometryKeys = new WeakMap();
    this.materials = new WeakSet();
    renderer.domElement?.addEventListener('webglcontextrestored', () => {
      this.readyKey = null; this.pending = null;
    });
  }

  signature(scene, camera) {
    const variants = new Set(), lights = [];
    scene.traverseVisible(object => {
      if (!object.layers.test(camera.layers)) return;
      if (object.isLight) {
        lights.push(`${object.type}:${!!object.castShadow}:${!!object.map}`);
        return;
      }
      if (!object.material) return;
      const geo = object.geometry;
      let geometryKey = this.geometryKeys.get(geo);
      if (!geometryKey) {
        geometryKey = Object.entries(geo?.attributes ?? {}).map(([name,a]) => `${name}:${a.itemSize}`).sort().join(',')
          + ':' + Object.entries(geo?.morphAttributes ?? {}).map(([name,a]) => `${name}:${a.length}`).sort().join(',')
          + ':' + !!geo?.morphTargetsRelative;
        if (geo) this.geometryKeys.set(geo,geometryKey);
      }
      for (const material of [scene.overrideMaterial ?? object.material].flat()) {
        if (!material.visible) continue;
        if (!this.materials.has(material)) {
          this.materials.add(material);
          material.addEventListener('dispose',()=>{this.readyKey=null;});
        }
        variants.add(`${material.uuid}:${material.version}:${object.type}:${!!object.isInstancedMesh}:${!!object.instanceColor}:${!!object.isSkinnedMesh}:${geometryKey}`);
      }
    });
    return `${this.renderer.toneMapping}:${this.renderer.outputColorSpace}:${!!this.renderer.shadowMap?.enabled}:${this.renderer.shadowMap?.type}:${scene.fog ? scene.fog.isFogExp2 ? 'exp2' : 'linear' : 'none'}:${scene.environment?.uuid ?? ''}:${camera.layers.mask}|`
      + lights.sort().join(',') + '|' + [...variants].sort().join('|');
  }

  ready(scene, camera) {
    if (!this.supported) return true;
    const key = this.signature(scene,camera);
    if (this.pending) return false;
    if (key === this.readyKey) return true;
    const job = {};
    this.pending = job;
    try {
      Promise.resolve(this.renderer.compileAsync(scene,camera)).then(() => {
        if (this.pending === job) { this.readyKey = key; this.pending = null; }
      }, () => {
        // Keep the normal renderer/diagnostics path if preparation fails.
        if (this.pending === job) { this.supported = false; this.pending = null; }
      });
    } catch {
      this.pending = null; this.supported = false; return true;
    }
    return false;
  }
}
