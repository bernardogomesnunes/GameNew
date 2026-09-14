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
    // 'local' | 'cloud', or null for "whatever suits": signed in, the cloud is
    // the reason you signed in, so it leads.
    this.where = null;
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
    // What is on the account, from the last time we asked. Drawn from a cache
    // so the list appears instantly; the fetch below refreshes it in place.
    const onAccount = this.cloudWorlds ?? [];
    const upThere = new Set(onAccount.map((w) => w.id));
    const here = new Set(saves.map((s) => s.worldId).filter(Boolean));
    const onlyUpThere = onAccount.filter((w) => !here.has(w.id));
    // Inside the description line rather than a column of its own: as a
    // separate flex item it squeezed the world's name down to "Home settle…"
    // on a phone, which is the one thing on the card that has to be readable.
    const tag = (s) => (s.worldId && upThere.has(s.worldId)
      ? ' <span class="world-tag">Cloud</span>' : '');

    this.body.innerHTML = `
      ${current ? `
        <div class="home-label">Where you left off</div>
        <div class="world-card world-card-primary" data-continue="1" role="button" tabindex="0">
          <span class="world-text">
            <strong>${escapeHtml(current.worldName || 'Your world')}</strong>
            <em>${describe(current)}${tag(current)}</em>
          </span>
          <span class="world-go">Continue</span>
          <button class="world-remove" data-remove-current="1" title="Delete this world" aria-label="Delete this world">${icon('close', 15)}</button>
        </div>` : ''}

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
                <em>${describe(s)}${tag(s)}</em>
              </span>
              <button class="world-remove" data-remove="${escapeAttr(s.name)}" title="Delete this world" aria-label="Delete this world">${icon('close', 15)}</button>
            </div>`).join('')}
        </div>` : ''}

      ${onlyUpThere.length ? `
        <div class="home-label">On your account</div>
        <div class="world-list">
          ${onlyUpThere.map((w) => `
            <div class="world-card" data-cloud="${escapeAttr(w.id)}" role="button" tabindex="0">
              <span class="world-text">
                <strong>${escapeHtml(w.name || 'Untitled world')}</strong>
                <em>${describe({ mode: w.mode, timestamp: w.updatedAt })} · not on this device</em>
              </span>
              <span class="world-go">Get it</span>
            </div>`).join('')}
        </div>` : ''}
    `;

    this.body.querySelector('[data-continue]')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-current]')) return;   // the ✕ is its own button
      this.cb.onContinue();
    });
    this.body.querySelector('[data-remove-current]')?.addEventListener('click', () => {
      if (this.cb.onRemoveCurrent(current?.worldName || 'Your world')) this.render();
    });
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
    this.body.querySelectorAll('[data-cloud]').forEach((el) => {
      el.addEventListener('click', () => this.cb.onOpenCloud?.(el.dataset.cloud));
    });
    this.refreshCloudWorlds();
  }

  /**
   * Asks the account what it is holding, then redraws with the answer.
   *
   * Deliberately after the list is already on screen: the local saves are
   * there instantly and a network round trip must never be the thing standing
   * between you and the world you were playing. Signed out, offline, or the
   * cloud having a bad day all come to the same thing — the list you can see
   * is the list you had, unbadged.
   */
  async refreshCloudWorlds() {
    if (this.cloudPending || !this.cb.getCloudUser?.()) return;
    this.cloudPending = true;
    try {
      const worlds = await this.cb.listCloudWorlds?.();
      if (!worlds) return;
      const changed = JSON.stringify(worlds.map((w) => w.id).sort())
        !== JSON.stringify((this.cloudWorlds ?? []).map((w) => w.id).sort());
      this.cloudWorlds = worlds;
      // Only redraw when the answer is new, and only if the list is still what
      // is on screen — you may have walked into the new-world journey by now.
      if (changed && this.step === 'home') this.renderHome();
    } catch {
      // Nothing to say. The local list is already correct.
    } finally {
      this.cloudPending = false;
    }
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
    // Where it lives is decided here, with the name, rather than being a thing
    // you discover afterwards in an account panel. Signed out, the cloud option
    // is visible but off — knowing it exists is the point of showing it.
    const signedIn = !!this.cb.getCloudUser?.();
    const cloudable = !!this.cb.isCloudConfigured?.();
    const where = whereToLive(this.where, signedIn);

    this.body.innerHTML = `
      <div class="home-label">Name your world</div>
      <p class="home-note">${kind.name} · ${kind.tagline}</p>
      <input type="text" id="home-world-name" maxlength="40" placeholder="${defaultName(kind)}" />

      ${cloudable ? `
        <div class="home-label">Where does it live?</div>
        <div class="where-list">
          <button class="where-card ${where === 'local' ? 'chosen' : ''}" data-where="local">
            <strong>On this device</strong>
            <span>Saved in this browser. Fast, private, and gone if you clear it.</span>
          </button>
          <button class="where-card ${where === 'cloud' ? 'chosen' : ''}" data-where="cloud"
                  ${signedIn ? '' : 'disabled'}>
            <strong>In the cloud</strong>
            <span>${signedIn
              ? 'Saved to your account, so a new phone or a cleared browser keeps it.'
              : 'Sign in to keep worlds on your account.'}</span>
          </button>
        </div>
        ${signedIn ? '' : `<button class="home-link" data-signin="1">Sign in or create an account</button>`}` : ''}

      <div class="home-actions">
        <button class="secondary" data-back="1">Back</button>
        <button class="primary" data-create="1">Create world</button>
      </div>`;

    const input = this.body.querySelector('#home-world-name');
    const create = () => this.cb.onCreate(this.kind, input.value.trim() || defaultName(kind), {
      cloud: where === 'cloud',
    });
    this.body.querySelectorAll('[data-where]').forEach((el) => el.addEventListener('click', () => {
      this.where = el.dataset.where;
      this.render();
    }));
    this.body.querySelector('[data-signin]')?.addEventListener('click', () => this.cb.onAccount?.());
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

/**
 * Where a new world should live, given what was picked and who is signed in.
 *
 * Nobody signed in can only mean this device — there is no account to put it
 * on. Signed in and no preference yet means the cloud, because keeping worlds
 * off the device is the only reason to have signed in at all. An explicit
 * choice always wins.
 */
export function whereToLive(chosen, signedIn) {
  if (!signedIn) return 'local';
  return chosen ?? 'cloud';
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
