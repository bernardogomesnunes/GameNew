import { CLOUD, isCloudConfigured } from './cloudConfig.js';

/**
 * Sign-in, and nothing else.
 *
 * The reason this exists at all: a browser cannot safely talk to Postgres
 * without a verifiable identity. Row-level security has to key off *something*,
 * and a device id the client makes up is not a something — anyone who guessed
 * or copied one would read another player's worlds, with no way to revoke it.
 * So cloud sync is gated on a real account, and playing without one stays
 * entirely local.
 *
 * Built on Neon's Managed Better Auth. The JWT that authorises Data API calls
 * comes from `getToken()`; the session behind it is a cookie the SDK manages.
 *
 * The SDK is loaded lazily, on first sight of the menu. A player who never
 * signs in never downloads it, which matters more here than in a typical app
 * because the first thing this page has to do is render a world.
 */
export class CloudAuth {
  constructor(bus) {
    this.bus = bus;
    this.client = null;
    this.user = null;
    this.ready = false;
  }

  get configured() {
    return isCloudConfigured();
  }

  async load() {
    if (this.client) return this.client;
    if (!this.configured) throw new Error('Cloud sync is not configured for this build.');
    const { createClient } = await import('@neondatabase/neon-js');
    // One URL derives both the auth service and the Data API.
    this.client = createClient(CLOUD.neonUrl);
    return this.client;
  }

  /**
   * Picks up an existing session. Deferred until the menu is first opened.
   * Never throws: being offline is not an error here.
   */
  async restore() {
    if (this.ready) return this.user;
    if (!this.configured) return null;
    try {
      const client = await this.load();
      this.user = userFrom(await client.auth.getSession());
    } catch {
      this.user = null;
    }
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signIn(email, password) {
    const client = await this.load();
    const result = await client.auth.signIn.email({ email, password });
    this.user = unwrapUser(result);
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signUp(email, password) {
    const client = await this.load();
    // Better Auth wants a display name; the local part of the email is a
    // reasonable default and keeps the form to two fields.
    const name = email.split('@')[0] || 'Builder';
    const result = await client.auth.signUp.email({ email, password, name });
    this.user = unwrapUser(result);
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signOut() {
    if (this.client) await this.client.auth.signOut().catch(() => {});
    this.user = null;
    this.bus?.emit('cloud:auth', { user: null });
  }

  /** Short-lived JWT for the Data API. The SDK refreshes it as needed. */
  async accessToken() {
    if (!this.client || !this.user) return null;
    const result = await this.client.auth.getToken();
    return result?.data?.token ?? result?.token ?? null;
  }

  summary() {
    if (!this.user) return null;
    return { id: this.user.id, email: this.user.email, name: this.user.name };
  }
}

/**
 * Better Auth reports failures in the payload rather than by throwing, and
 * nests the user differently across calls, so both shapes are normalised here
 * instead of at every call site.
 */
function unwrapUser(result) {
  if (result?.error) throw new Error(readableAuthError(result.error));
  const user = userFrom(result);
  if (!user) throw new Error('Signed in, but no account came back. Try again.');
  return user;
}

function userFrom(result) {
  const data = result?.data ?? result;
  const user = data?.user ?? (data?.id ? data : null);
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null, name: user.name ?? null };
}

function readableAuthError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const hay = `${code} ${message}`.toUpperCase();
  if (hay.includes('INVALID_EMAIL_OR_PASSWORD') || hay.includes('INVALID_PASSWORD')) {
    return 'That email and password do not match.';
  }
  if (hay.includes('USER_ALREADY_EXISTS') || hay.includes('EXISTING')) {
    return 'There is already an account with that email — sign in instead.';
  }
  if (hay.includes('PASSWORD_TOO_SHORT') || hay.includes('PASSWORD')) {
    return 'Pick a longer password (at least 8 characters).';
  }
  if (hay.includes('INVALID_EMAIL')) return 'That does not look like an email address.';
  return message || 'Could not sign in. Try again.';
}
