/**
 * Cloudflare Turnstile, behind a build-time switch.
 *
 * Off unless VITE_TURNSTILE_SITE_KEY is set when the app is built. Off means
 * no script is fetched, no widget is drawn and no header is sent, so sign-in
 * and sign-up behave as they did before this file existed.
 *
 * On, the script loads from challenges.cloudflare.com the first time the
 * account form opens, never at page load. The token goes to the server in the
 * `x-captcha-response` header, which is where Better Auth's captcha plugin
 * reads it. The server only checks it once the owner turns the Neon Auth
 * captcha setting on (docs/analysis-accounts.md, ACCT-7).
 */
const env = import.meta.env ?? {};

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const CAPTCHA_HEADER = 'x-captcha-response';

export function turnstileSiteKey(e = env) {
  return (e.VITE_TURNSTILE_SITE_KEY || '').trim();
}

export function isTurnstileEnabled(e = env) {
  return Boolean(turnstileSiteKey(e));
}

/** Fetch options for the auth client: the captcha header, or nothing. */
export function captchaOptions(token) {
  return token ? { headers: { [CAPTCHA_HEADER]: token } } : {};
}

let scriptPromise = null;

/** Adds the Turnstile script once. Resolves with window.turnstile. */
export function loadTurnstile(win = globalThis.window, doc = globalThis.document) {
  if (win?.turnstile) return Promise.resolve(win.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = doc.createElement('script');
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => (win.turnstile ? resolve(win.turnstile) : reject(new Error('Turnstile did not start.')));
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the human check.')); };
    doc.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Draws the widget into `el`. Returns null when the switch is off.
 * The handle's token() is the current token or '' (none yet, or expired);
 * reset() asks for a new one, because a token works once.
 */
export async function mountTurnstile(el, { env: e = env, win = globalThis.window, doc = globalThis.document, theme = 'light' } = {}) {
  const sitekey = turnstileSiteKey(e);
  if (!sitekey || !el) return null;
  const api = await loadTurnstile(win, doc);
  let token = '';
  const id = api.render(el, {
    sitekey,
    theme,
    size: win?.innerWidth && win.innerWidth < 360 ? 'compact' : 'flexible',
    callback: (t) => { token = t; },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; },
  });
  return {
    token: () => token,
    reset: () => { token = ''; api.reset(id); },
  };
}
