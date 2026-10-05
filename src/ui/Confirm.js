/**
 * The game's own "are you sure?" (backlog batch 2: on iOS, deleting a world
 * and leaving without saving showed the browser's own grey dialog). Drawn
 * in the game's style, over whatever is open — deliberately not a panel
 * (not an `.overlay`), because opening a panel closes the others, and this
 * has to sit on top of the panel that asked.
 *
 *   askConfirm(root, { title, body, ok, cancel, danger }) → Promise<boolean>
 *
 * Resolves true on the confirm button, false on the cross, a tap outside
 * the card, or Escape. No Cancel button (asked for directly: "Cancel is the
 * cross so we can remove it") — `cancel` is now the cross's label, for
 * screen readers.
 */
export function askConfirm(root, { title, body = '', ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'confirm-backdrop';
    el.innerHTML = `
      <div class="confirm-card" role="alertdialog" aria-modal="true">
        <button class="panel-close confirm-close" data-no>×</button>
        <strong class="confirm-title"></strong>
        <p class="confirm-body"></p>
        <div class="confirm-actions">
          <button class="primary${danger ? ' danger' : ''}" data-yes></button>
        </div>
      </div>`;
    // Text, not markup: titles carry world names, which are whatever you typed.
    el.querySelector('.confirm-title').textContent = title;
    el.querySelector('.confirm-body').textContent = body;
    el.querySelector('.confirm-body').hidden = !body;
    el.querySelector('[data-no]').setAttribute('aria-label', cancel);
    el.querySelector('[data-yes]').textContent = ok;

    const done = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      el.remove();
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.stopPropagation(); done(true); }
    };
    el.addEventListener('click', (e) => { if (e.target === el) done(false); });
    el.querySelector('[data-no]').addEventListener('click', () => done(false));
    el.querySelector('[data-yes]').addEventListener('click', () => done(true));
    document.addEventListener('keydown', onKey, true);
    root.appendChild(el);
    el.querySelector('[data-yes]').focus();
  });
}
