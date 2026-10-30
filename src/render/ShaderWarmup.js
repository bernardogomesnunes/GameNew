/** Allow one bounded preparation before this graphics context's first draw.
 * Later variants use the ordinary renderer. Scene/material churn must never
 * suspend gameplay presentation, even if shader preparation has not settled.
 */
export class ShaderWarmup {
  constructor(renderer, { now = () => performance.now() } = {}) {
    this.renderer = renderer;
    this.now = now;
    this.supported = !!(renderer.compileAsync && renderer.extensions?.has('KHR_parallel_shader_compile'));
    this.open = !this.supported;
    this.pending = null;
    renderer.domElement?.addEventListener('webglcontextrestored', () => {
      this.open = !this.supported;
      this.pending = null;
    });
  }

  ready(scene, camera) {
    if (this.open) return true;
    if (!this.pending) {
      const job = { started: this.now() };
      this.pending = job;
      const finish = () => {
        // A restored context owns a different job; old completions are stale.
        if (this.pending === job) { this.pending = null; this.open = true; }
      };
      try {
        Promise.resolve(this.renderer.compileAsync(scene, camera)).then(finish, finish);
      } catch {
        finish();
      }
    }
    // compileAsync starts compilation synchronously, so that time counts too.
    // The deadline never moves when streamed objects or materials change.
    if (this.pending && this.now() - this.pending.started >= 500) {
      this.pending = null;
      this.open = true;
    }
    return this.open;
  }
}
