/**
 * Cloud configuration.
 *
 * One URL. Neon derives both the auth service and the Data API from a project's
 * base endpoint, so there is a single thing to set here and a single thing to
 * set on Vercel — no project ids or publishable keys to keep in step.
 *
 * It is public by design: a URL grants nothing on its own. Every row is behind
 * row-level security keyed on the signed-in user, so an unauthenticated request
 * reads nothing.
 *
 * Leave it unset and the game runs local-only: saves, exports and imports all
 * still work, there is just no sync.
 */

// `import.meta.env` only exists under Vite; reading it bare breaks plain-Node
// imports, which is how these modules get unit-tested.
const env = import.meta.env ?? {};

export const CLOUD = {
  neonUrl: (env.VITE_NEON_URL || '').replace(/\/$/, ''),
  // Enable only after the reviewed 0006 migration has been applied.
  atomicSaves: env.VITE_ATOMIC_SAVES === 'true',
};

export function isCloudConfigured() {
  return Boolean(CLOUD.neonUrl);
}

/**
 * Mirrors Neon's own derivation: `<endpoint>/<db>` becomes the auth host and the
 * Data API host by inserting a subdomain. Kept here rather than imported so the
 * Data API URL is available without pulling in the auth SDK.
 */
export function deriveUrls(neonUrl = CLOUD.neonUrl) {
  if (!neonUrl) return { auth: '', dataApi: '' };
  const url = new URL(neonUrl);
  const [host, ...rest] = url.hostname.split('.');
  const path = url.pathname.replace(/\/$/, '');
  const sub = (label) => `${url.protocol}//${[`${host}.${label}`, ...rest].join('.')}`;
  return {
    auth: `${sub('neonauth')}${path}/auth`,
    dataApi: `${sub('apirest')}${path}/rest/v1`,
  };
}

/**
 * Where the game reaches the sign-in service.
 *
 * PLAY-1 (owner, 22 November): on iPhone the sign-in was lost between visits
 * and once mid-game. The session cookie lived on Neon's domain, a third party
 * to the game's page, and iPhone browsers (Safari and Chrome both run WebKit)
 * block or purge third-party cookies. So on a deployed page the sign-in goes
 * through the page's own address: `/neonauth` on the same site, which
 * vercel.json (and vite.config.js in development) pass on to Neon. The cookie
 * is then the game's own. `VITE_AUTH_DIRECT=true` goes straight to Neon, as
 * before.
 */
export const AUTH_PATH = '/neonauth';

export function authUrl(loc = globalThis.location, neonUrl = CLOUD.neonUrl) {
  const direct = deriveUrls(neonUrl).auth;
  if (!direct || env.VITE_AUTH_DIRECT === 'true' || authDirectChosen()) return direct;
  if (!loc || !/^https?:$/.test(loc.protocol ?? '')) return direct;
  return `${loc.origin}${AUTH_PATH}`;
}


/** Set once a sign-in through the page's own address did not keep its cookie. */
export const AUTH_DIRECT_KEY = 'duilt:auth-direct';

function authDirectChosen() {
  try { return globalThis.localStorage?.getItem(AUTH_DIRECT_KEY) === '1'; } catch { return false; }
}

export function chooseAuthDirect() {
  try { globalThis.localStorage?.setItem(AUTH_DIRECT_KEY, '1'); } catch { /* stays for this tab only */ }
}
