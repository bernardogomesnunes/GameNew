/** Keep the illustrated canvas code out of the title-screen download. */
export class LazyStoryView {
  constructor(root, panels, { world, onError = () => {} } = {}) {
    this.root = root;
    this.panels = panels;
    this.world = world;
    this.onError = onError;
    this.version = 0;
    this.placeholder = document.createElement('div');
    this.placeholder.id = 'story';
    this.placeholder.className = 'overlay story';
    this.placeholder.hidden = true;
    this.placeholder.innerHTML = '<div class="story-card"><p>Loading the story…</p><button class="secondary">Skip</button></div>';
    this.placeholder.querySelector('button').addEventListener('click', () => panels.close('story'));
    root.appendChild(this.placeholder);
    panels.onClose((id) => {
      if (id !== 'story' || !this.pending) return;
      const pending = this.pending;
      this.pending = null;
      this.version++;
      if (this.world() === pending.world) pending.options.onDone?.();
    });
  }

  get open() { return this.panels.isOpen('story'); }

  async play(scenes, options = {}) {
    if (!scenes?.length) { options.onDone?.(); return; }
    const world = this.world();
    const onDone = options.onDone;
    options = { ...options, onDone: () => { if (this.world() === world) onDone?.(); } };
    if (this.view) return this.view.play(scenes, options);
    const version = ++this.version;
    this.pending = { world, options };
    this.panels.open('story');
    try {
      const { StoryView } = await import('./Story.js');
      if (version !== this.version || !this.open) return;
      if (world !== this.world()) {
        this.pending = null;
        this.panels.close('story');
        return;
      }
      this.pending = null;
      this.placeholder.remove();
      this.view = new StoryView(this.root, this.panels);
      this.view.play(scenes, options);
    } catch (error) {
      if (version !== this.version || world !== this.world()) return;
      this.onError(error);
      // A failed optional illustration must never trap a new world at entry.
      this.panels.close('story');
    }
  }
}
