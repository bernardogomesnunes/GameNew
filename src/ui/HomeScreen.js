import { pixelIcon } from './pixelIcons.js';

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

/**
 * How long to wait before the error card quietly asks again, and how many
 * times. Growing gaps, four goes, then it leaves you the button.
 *
 * Bounded on purpose: this is a screen that has failed, not a heartbeat. See
 * startHealing for why a real keep-alive would be much worse than the problem.
 */
const HEAL_GAPS = [4000, 10_000, 25_000, 60_000];

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
    // Asked for directly: "a panel opens up with the buttons create new
    // world or open world, the account and settings ... Then create a new
    // world shows the flow we have today ... And open world shows the list
    // of the worlds." So the front door is a menu, and the list is a step.
    this.step = 'home';       // 'home' (the menu) | 'worlds' | 'kind' | 'name'
    this.kind = 'duilt';
    // Derived from whether you are signed in, not chosen — see whereToLive.
    this.where = null;
    // How many times the error card has quietly re-asked — see startHealing.
    this.healAttempt = 0;
    this.healTimer = null;
    this.mount();
  }

  /**
   * The name up in the sky over the title scene (world/titleScene.js), and
   * the card at the bottom that every step is drawn in — pixel art, like
   * the rest of the screens (asked for: "a pixel art kinda look and feel
   * instead of the plain ui we have now").
   */
  mount() {
    this.root.innerHTML = `
      <div class="home px">
        <header class="home-logo">
          <h1 class="px-logo">Duilt</h1>
          <p class="home-tag">Arrive somewhere empty. Leave a civilisation.</p>
        </header>
        <div class="home-card px-panel">
          <div class="home-body" id="home-body"></div>
        </div>
      </div>`;
    this.body = this.root.querySelector('#home-body');
    this.accountLabel = 'Sign in';
  }

  /** Re-reads the worlds and draws whichever step we are on. */
  render() {
    if (this.step === 'kind') return this.renderKind();
    if (this.step === 'name') return this.renderName();
    if (this.step === 'worlds') return this.renderWorlds();
    return this.renderMenu();
  }

  setAccount(label) {
    this.accountLabel = label;
    const el = this.root.querySelector('#home-account-label');
    if (el) el.textContent = label;
  }

  // ---- the menu ----

  /**
   * The four ways on from here. Open world says how many there are, so you
   * know before you tap; and if the account can't be reached that is said
   * here too, with the detail one step in, where the list would be.
   */
  renderMenu() {
    const rows = this.cloudWorlds ?? this.cb.knownWorlds?.() ?? [];
    const cloud = !!this.cb.isCloudConfigured?.();
    this.body.innerHTML = `
      <div class="home-menu">
        <!--
          No new world while the account is out of reach. Worlds are kept on
          the account and nowhere else, so one started now would have nowhere
          to go the moment you left it — offering it is offering to waste an
          evening.
        -->
        ${this.cloudError ? '' : `<button class="px-btn px-big" data-new="1">${pixelIcon('plus', 20)}<span>Create new world</span></button>`}
        <button class="px-btn px-big px-stone" data-worlds="1">${pixelIcon('open', 20)}<span>Open world</span>${rows.length ? `<b class="px-count">${rows.length}</b>` : ''}</button>
        ${this.cloudError ? `<p class="home-warn">${pixelIcon('warn', 14)} Could not reach your account — open your worlds to see why.</p>` : ''}
        <div class="home-row">
          <!--
            A build with no cloud configured at all has nothing this button
            could do — no account to sign in to, only an error to show for
            trying. Hidden rather than left to fail on tap.
          -->
          <button class="px-btn px-small px-wood" id="home-account" ${cloud ? '' : 'hidden'}>${pixelIcon('person', 16)}<span id="home-account-label">${escapeHtml(this.accountLabel)}</span></button>
          <button class="px-btn px-small px-wood" id="home-settings">${pixelIcon('gear', 16)}<span>Settings</span></button>
        </div>
      </div>`;
    this.body.querySelector('[data-new]')?.addEventListener('click', () => { this.step = 'kind'; this.render(); });
    this.body.querySelector('[data-worlds]').addEventListener('click', () => { this.step = 'worlds'; this.render(); });
    this.body.querySelector('#home-account').addEventListener('click', () => this.cb.onAccount?.());
    this.body.querySelector('#home-settings').addEventListener('click', () => this.cb.onSettings?.());
    this.refreshCloudWorlds();
  }

  // ---- the list ----

  renderWorlds() {
    // Until the account has answered, what we knew last time — never an empty
    // list that fills in seconds later (reported directly).
    const rows = this.cloudWorlds ?? this.cb.knownWorlds?.() ?? [];
    const failed = this.cloudError;
    const when = (r) => r.updatedAt ?? 0;
    const line = (r) => describe({ mode: r.mode, timestamp: when(r), age: r.age });

    this.body.innerHTML = `
      <div class="home-steps">
        <button class="px-btn px-small px-wood px-back" data-back="1" aria-label="Back">${pixelIcon('back', 16)}</button>
        <div class="home-label">Your worlds</div>
      </div>
      ${failed ? `
        <div class="home-gate warn">
          <strong>Could not reach your account</strong>
          <p>${escapeHtml(failed)}</p>
          ${this.cloudDetail ? `
            <details class="home-detail">
              <summary>What went wrong</summary>
              <code id="home-detail-text">${escapeHtml(this.cloudDetail)}</code>
              <button class="secondary" data-copy-detail="1">Copy</button>
            </details>` : ''}
          <div class="home-actions"><button class="secondary" data-retry="1">Try again</button></div>
          ${this.healAttempt < HEAL_GAPS.length
            ? '<p class="home-quiet">Still trying on its own — you do not have to wait here.</p>'
            : '<p class="home-quiet">It has stopped trying on its own.</p>'}
        </div>` : ''}

      <!--
        No New world while the account is out of reach. Worlds are kept on the
        account and nowhere else, so one started now would have nowhere to go
        the moment you left it — offering it is offering to waste an evening.
      -->
      ${rows.length ? `
        <div class="world-list">
          ${rows.map((r) => `
            <div class="world-card" data-open="${escapeAttr(r.id)}" role="button" tabindex="0">
              <span class="world-play">${pixelIcon('play', 16)}</span>
              <span class="world-text">
                <strong>${escapeHtml(r.name || 'Untitled world')}</strong>
                <em>${line(r)}</em>
              </span>
              <!-- A bin, not a cross (asked for directly): a cross reads as "close". -->
              <button class="world-remove" data-remove="${escapeAttr(r.id)}" data-remove-name="${escapeAttr(r.name || 'this world')}" title="Delete this world" aria-label="Delete this world">${pixelIcon('trash', 18)}</button>
            </div>`).join('')}
        </div>`
      : (failed ? '' : this.cloudWorlds == null && this.cb.isCloudConfigured?.()
        // Not answered yet, and nothing remembered (the first visit on this
        // device): "no worlds" would be a scare, not a fact.
        ? `<p class="home-note">Loading your worlds…</p>`
        : `<p class="home-note">No worlds yet.</p>
           <button class="px-btn px-big" data-new="1">${pixelIcon('plus', 20)}<span>Create new world</span></button>`)}
    `;

    this.body.querySelector('[data-back]').addEventListener('click', () => { this.step = 'home'; this.render(); });
    this.body.querySelector('[data-new]')?.addEventListener('click', () => { this.step = 'kind'; this.render(); });
    // Selecting a line of text inside a folded panel on a phone is a fight;
    // a button is not.
    this.body.querySelector('[data-copy-detail]')?.addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(this.cloudDetail ?? '');
        e.target.textContent = 'Copied';
      } catch {
        e.target.textContent = 'Select it by hand — copying is blocked here';
      }
    });
    this.body.querySelector('[data-retry]')?.addEventListener('click', () => {
      // A deliberate tap starts the patience over: you have told it you are
      // here and waiting, which is different from a screen left open.
      this.stopHealing();
      this.cloudError = null;
      this.cloudDetail = null;
      this.cloudWorlds = null;
      this.render();
      this.refreshCloudWorlds({ force: true });
    });
    this.body.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;   // the ✕ is its own button
        this.cb.onOpen(el.dataset.open);
      });
    });
    this.body.querySelectorAll('[data-remove]').forEach((el) => {
      el.addEventListener('click', async () => {
        // The rows as they are on screen, taken before deleting: the delete
        // itself marks the list out of date, and filtering that used to leave
        // nothing at all — every world gone until a reload (reported directly).
        const shown = rows;
        if (!await this.cb.onRemove(el.dataset.remove, el.dataset.removeName)) return;
        this.cloudWorlds = shown.filter((w) => w.id !== el.dataset.remove);
        this.render();
      });
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
  async refreshCloudWorlds({ force = false } = {}) {
    if (this.cloudPending) return;
    // Already answered, and nothing has changed since; the game marks it
    // stale after a save or a delete (forgetWorlds).
    if (this.cloudWorlds && !this.stale && !force) return;
    this.stale = false;
    this.cloudPending = true;
    try {
      this.cloudWorlds = (await this.cb.listCloudWorlds?.()) ?? [];
      this.cloudError = null;
      this.cloudDetail = null;
      this.stopHealing();
    } catch (err) {
      // Said out loud, not swallowed — but the local list rides along on the
      // error (see Game.js's listAllWorlds), so losing the account never
      // also means losing sight of the world sitting right here in this
      // browser. "I have no worlds" and "I could not reach the account" are
      // very different sentences and the player has to be able to tell them
      // apart, but neither has to mean an empty screen.
      this.cloudError = err?.message || 'The account did not answer.';
      // And the technical version, folded away under it. Nobody can debug a
      // photograph of the readable sentence — it says the same thing whether
      // the database is asleep, a route is answering 500, or the browser threw
      // the reply away, and those are three different repairs.
      this.cloudDetail = err?.detail ?? null;
      this.cloudWorlds = err?.partial ?? this.cloudWorlds ?? [];
      this.startHealing();
    } finally {
      this.cloudPending = false;
      if (this.step === 'home') this.renderMenu();
      else if (this.step === 'worlds') this.renderWorlds();
    }
  }

  /**
   * While the card is up, quietly ask again. A few times, further apart each
   * time, and then stop.
   *
   * Not a keep-alive, and deliberately not one. Pinging the database on a
   * timer to stop it sleeping would cost the whole monthly compute allowance
   * in about a fortnight and then the database suspends itself until the next
   * billing period — the game would die for two weeks in every four to avoid a
   * one-second wait. This runs only while somebody is looking at an error, on
   * a screen that has nothing else to offer them, and stops the moment it
   * works or the tab goes to the background.
   *
   * What it buys: whatever this turns out to be, if it is the kind of thing
   * that passes, the screen mends itself instead of sitting there dead until
   * somebody thinks to tap a button.
   */
  startHealing() {
    if (this.healTimer || this.healAttempt >= HEAL_GAPS.length) return;
    const gap = HEAL_GAPS[this.healAttempt];
    this.healTimer = setTimeout(() => {
      this.healTimer = null;
      // A backgrounded tab is nobody looking at anything.
      if (document.visibilityState === 'hidden') { this.startHealing(); return; }
      if (!this.cloudError || (this.step !== 'home' && this.step !== 'worlds')) return;
      this.healAttempt++;
      this.refreshCloudWorlds({ force: true });
    }, gap);
  }

  stopHealing() {
    clearTimeout(this.healTimer);
    this.healTimer = null;
    this.healAttempt = 0;
  }

  /** After a save or a delete, the list this screen is holding is out of date. */
  forgetWorlds() {
    // Kept on screen, just asked for again: dropping it showed an empty list
    // until the answer came back, or for good after a delete.
    this.stale = true;
  }

  // ---- the journey ----

  renderKind() {
    this.body.innerHTML = `
      <div class="home-steps">
        <button class="px-btn px-small px-wood px-back" data-back="1" aria-label="Back">${pixelIcon('back', 16)}</button>
        <div class="home-label">What kind of world?</div>
      </div>
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
        <button class="px-btn px-big" data-next="1"><span>Next</span>${pixelIcon('play', 16)}</button>
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
      <div class="home-steps">
        <button class="px-btn px-small px-wood px-back" data-back="1" aria-label="Back">${pixelIcon('back', 16)}</button>
        <div class="home-label">Name your world</div>
      </div>
      <p class="home-note">${kind.name} · ${kind.tagline}</p>
      <input type="text" id="home-world-name" maxlength="40" placeholder="${defaultName(kind)}" />

      ${cloudable ? (signedIn ? `
        <!--
          Not a question any more. It used to ask where the world should live,
          which meant a signed-in player answering "on this device" by accident
          once, on their phone, ended up with an account holding two unrelated
          piles of worlds. Signed in, a world is yours rather than the browser's.
        -->
        <p class="home-note home-where">Saved to your account — open it from anywhere.</p>
      ` : `
        <!--
          Says what signing in buys, not how saving currently works underneath.
          The player never has to learn "local" or "cloud" as concepts; the
          mechanics are ours to change without this sentence going stale.
        -->
        <p class="home-note home-where">Saved right here for now.
          <button class="home-link" data-signin="1">Sign in</button> to keep it safe and
          pick up where you left off on any device.</p>
      `) : ''}

      <div class="home-actions">
        <button class="px-btn px-big" data-create="1">${pixelIcon('plus', 18)}<span>Create world</span></button>
      </div>`;

    const input = this.body.querySelector('#home-world-name');
    const create = () => this.cb.onCreate(this.kind, input.value.trim() || defaultName(kind), {
      cloud: where === 'cloud',
    });
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
 * on. Signed in means the account, with no way to say otherwise: a world that
 * lives in one browser is not something anybody signs in to get, and offering
 * it as a choice is how one account ended up with a separate pile of worlds
 * per device.
 */
export function whereToLive(chosen, signedIn) {
  return signedIn ? 'cloud' : 'local';
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
