import { icon } from './icons.js';

/**
 * The front door: where you land before you are in a world.
 *
 * Everything used to live in one in-game panel — saving, loading, exporting,
 * signing in, starting a new world and the graphics settings, stacked in a
 * single scrolling column. That is a lot to meet at once, and it left no
 * moment where the game simply asks which world you want to play.
 *
 * So the things you do *between* worlds happen here: pick one up, start a new
 * one, sign in. The in-game menu keeps only what belongs to the world you are
 * actually in. Starting a world is a short journey rather than one of three
 * unlabelled buttons, which is also the only place with room to say what the
 * kinds of world actually are.
 */

const KINDS = [
  {
    id: 'duilt',
    name: 'Duilt',
    tagline: 'The game',
    blurb: 'Arrive on thirty-two blocks of land with an axe and a bucket. '
      + 'Claim a forest, break ground on a farm, build a house — and the border moves out.',
    recommended: true,
  },
  {
    id: 'creative',
    name: 'Creative',
    tagline: 'Free build',
    blurb: 'Generated terrain and every block available from the start. Nothing to earn, nothing to lose.',
  },
  {
    id: 'campaign',
    name: 'Campaign',
    tagline: 'Build to a budget',
    blurb: 'Empty ground and a pile of wood. Every block costs something, so what you spend it on matters.',
  },
];

/** "2 hours ago", in the smallest number of words that is still true. */
function ago(ts) {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function describe(save) {
  const kind = KINDS.find((k) => k.id === save.mode)?.name ?? 'World';
  const bits = [kind];
  if (save.mode === 'duilt' && save.age) bits.push(`Age ${save.age}`);
  bits.push(ago(save.timestamp));
  return bits.filter(Boolean).join(' · ');
}

export class HomeScreen {
  /**
   * @param root      where to render (the blocker overlay)
   * @param callbacks what the game can do: continue, open, start, remove, sign in
   */
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;
    this.step = 'home';       // 'home' | 'kind' | 'name'
    this.kind = 'duilt';
    this.mount();
  }

  mount() {
    this.root.innerHTML = `
      <div class="home">
        <header class="home-head">
          <div>
            <h1>Duilt</h1>
            <p class="home-tag">Arrive somewhere empty. Leave a civilisation.</p>
          </div>
          <button class="home-account" id="home-account">Sign in</button>
        </header>
        <div class="home-body" id="home-body"></div>
        <footer class="home-foot">
          <button class="home-link" id="home-settings">Settings</button>
          <button class="home-link" id="home-guide">How to play</button>
        </footer>
      </div>`;
    this.body = this.root.querySelector('#home-body');
    this.root.querySelector('#home-settings').addEventListener('click', () => this.cb.onSettings?.());
    this.root.querySelector('#home-guide').addEventListener('click', () => this.cb.onGuide?.());
    this.root.querySelector('#home-account').addEventListener('click', () => this.cb.onAccount?.());
  }

  /** Re-reads the saves and draws whichever step we are on. */
  render() {
    if (this.step === 'kind') return this.renderKind();
    if (this.step === 'name') return this.renderName();
    return this.renderHome();
  }

  setAccount(label) {
    const el = this.root.querySelector('#home-account');
    if (el) el.textContent = label;
  }

  // ---- the list ----

  renderHome() {
    const saves = this.cb.listWorlds();
    const current = saves.find((s) => s.isAutosave);
    const named = saves.filter((s) => !s.isAutosave);

    this.body.innerHTML = `
      ${current ? `
        <div class="home-label">Where you left off</div>
        <button class="world-card world-card-primary" data-continue="1">
          <span class="world-text">
            <strong>${escapeHtml(current.worldName || 'Your world')}</strong>
            <em>${describe(current)}</em>
          </span>
          <span class="world-go">Continue</span>
        </button>` : ''}

      <button class="world-card world-card-new" data-new="1">
        <span class="world-text">
          <strong>New world</strong>
          <em>Start somewhere fresh</em>
        </span>
        <span class="world-go">${icon('plus', 18)}</span>
      </button>

      ${named.length ? `
        <div class="home-label">Saved copies</div>
        <div class="world-list">
          ${named.map((s) => `
            <div class="world-card" data-open="${escapeAttr(s.name)}">
              <span class="world-text">
                <strong>${escapeHtml(s.worldName || s.name)}</strong>
                <em>${describe(s)}</em>
              </span>
              <button class="world-remove" data-remove="${escapeAttr(s.name)}" title="Delete this world">✕</button>
            </div>`).join('')}
        </div>` : ''}
    `;

    this.body.querySelector('[data-continue]')?.addEventListener('click', () => this.cb.onContinue());
    this.body.querySelector('[data-new]')?.addEventListener('click', () => { this.step = 'kind'; this.render(); });
    this.body.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;   // the ✕ is its own button
        this.cb.onOpen(el.dataset.open);
      });
    });
    this.body.querySelectorAll('[data-remove]').forEach((el) => {
      el.addEventListener('click', () => {
        if (this.cb.onRemove(el.dataset.remove)) this.render();
      });
    });
  }

  // ---- the journey ----

  renderKind() {
    this.body.innerHTML = `
      <div class="home-label">What kind of world?</div>
      <div class="kind-list">
        ${KINDS.map((k) => `
          <button class="kind-card ${k.id === this.kind ? 'chosen' : ''}" data-kind="${k.id}">
            <span class="kind-head">
              <strong>${k.name}</strong>
              <em>${k.tagline}</em>
              ${k.recommended ? '<span class="kind-flag">Start here</span>' : ''}
            </span>
            <span class="kind-blurb">${k.blurb}</span>
          </button>`).join('')}
      </div>
      <div class="home-actions">
        <button class="secondary" data-back="1">Back</button>
        <button class="primary" data-next="1">Next</button>
      </div>`;

    this.body.querySelectorAll('[data-kind]').forEach((el) =>
      el.addEventListener('click', () => { this.kind = el.dataset.kind; this.render(); }));
    this.body.querySelector('[data-back]').addEventListener('click', () => { this.step = 'home'; this.render(); });
    this.body.querySelector('[data-next]').addEventListener('click', () => { this.step = 'name'; this.render(); });
  }

  renderName() {
    const kind = KINDS.find((k) => k.id === this.kind);
    this.body.innerHTML = `
      <div class="home-label">Name your world</div>
      <p class="home-note">${kind.name} · ${kind.tagline}</p>
      <input type="text" id="home-world-name" maxlength="40" placeholder="${defaultName(kind)}" />
      <div class="home-actions">
        <button class="secondary" data-back="1">Back</button>
        <button class="primary" data-create="1">Create world</button>
      </div>`;

    const input = this.body.querySelector('#home-world-name');
    const create = () => this.cb.onCreate(this.kind, input.value.trim() || defaultName(kind));
    this.body.querySelector('[data-back]').addEventListener('click', () => { this.step = 'kind'; this.render(); });
    this.body.querySelector('[data-create]').addEventListener('click', create);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    // Not on touch: a keyboard springing up over the button is worse than a tap.
    if (!document.body.classList.contains('touch')) input.focus();
  }

  /** Back to the list, so reopening Home never resumes mid-journey. */
  reset() {
    this.step = 'home';
    this.render();
  }
}

function defaultName(kind) {
  return kind.id === 'duilt' ? 'My settlement' : `${kind.name} world`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}
