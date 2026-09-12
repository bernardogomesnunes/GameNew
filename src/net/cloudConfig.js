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
