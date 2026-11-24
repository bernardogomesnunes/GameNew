/**
 * ACCT-11: "Choose a player name", in the game's own card (like ui/Confirm.js:
 * drawn over whatever is open, not a panel).
 *
 *   askPlayerName(root, { title, body, initial, save, skip }) → Promise<string | null>
 *
 * `save(name)` is async and throws a sentence on refusal (name taken, not
 * allowed); the card stays open and shows it under the box. Resolves with the
 * saved name, or null when skipped or closed. `skip` is the label of the
 * button that leaves without choosing.
 */
import { cleanPlayerName, playerNameProblem } from '../net/playerName.js';

export function askPlayerName(root, { title = 'Choose a player name', body = '', initial = '', save, skip = 'Skip for now' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'confirm-backdrop';
    el.innerHTML = `
      <div class="confirm-card name-card" role="dialog" aria-modal="true" aria-labelledby="name-title">
        <button class="panel-close confirm-close" data-no aria-label="Close">×</button>
        <strong class="confirm-title" id="name-title"></strong>
        <p class="confirm-body"></p>
        <label for="name-input" class="data-label">Player name</label>
        <input type="text" id="name-input" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <div class="form-error" id="name-error" role="alert" aria-live="assertive" hidden></div>
        <div class="export-note">3 to 20 letters, numbers, spaces or underscores.</div>
        <div class="name-actions">
          <button class="primary" data-yes>Save name</button>
          <button class="secondary" data-skip></button>
        </div>
      </div>`;
    el.querySelector('.confirm-title').textContent = title;
    el.querySelector('.confirm-body').textContent = body;
    el.querySelector('.confirm-body').hidden = !body;
    el.querySelector('[data-skip]').textContent = skip;
    const input = el.querySelector('#name-input');
    const err = el.querySelector('#name-error');
    const yes = el.querySelector('[data-yes]');
    input.value = initial;
    const show = (msg) => { err.textContent = msg || ''; err.hidden = !msg; input.setAttribute('aria-invalid', String(Boolean(msg))); };

    const done = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      el.remove();
      resolve(answer);
    };
    const submit = async () => {
      const name = cleanPlayerName(input.value);
      const problem = playerNameProblem(name);
      if (problem) { show(problem); input.focus(); return; }
      yes.disabled = true;
      const label = yes.textContent;
      yes.textContent = 'Saving…';
      try {
        await save(name);
        done(name);
      } catch (e) {
        show(e.message || 'Could not save the name. Try again.');
        input.focus(); input.select?.();
      } finally { yes.disabled = false; yes.textContent = label; }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); submit(); }
    };
    input.addEventListener('input', () => show(''));
    yes.addEventListener('click', submit);
    el.querySelector('[data-skip]').addEventListener('click', () => done(null));
    el.querySelector('[data-no]').addEventListener('click', () => done(null));
    el.addEventListener('click', (e) => { if (e.target === el) done(null); });
    document.addEventListener('keydown', onKey, true);
    root.appendChild(el);
    input.focus();
    input.select?.();
  });
}
