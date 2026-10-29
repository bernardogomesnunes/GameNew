/** Ignore work requested for a world that has since been replaced. */
export class FeatureScope {
  revision = 0;
  cancel() { this.revision++; }
  async run(load, apply) {
    const revision = this.revision;
    const result = await load();
    if (revision !== this.revision) return false;
    return apply(result);
  }
}
