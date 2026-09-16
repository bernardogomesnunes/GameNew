import { CLOUD, isCloudConfigured } from './cloudConfig.js';
import { keepTrying } from './retry.js';

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
 * comes from `getJWTToken()`; the session behind it is a cookie the SDK
 * manages. See accessToken for why the name matters more than it looks.
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

  /**
   * Short-lived JWT for the Data API. The SDK refreshes it as needed.
   *
   * It must be `getJWTToken`. Better Auth turns any method you name into a
   * call on the matching route, so `getToken()` compiles, runs, and asks for
   * `/auth/get-token` — a route Neon's managed Better Auth does not serve. It
   * answered 404 on every single request, which meant cloud sync had never
   * once worked for a signed-in player: signing in succeeded, and then every
   * world upload failed on the token. The route that exists is
   * `/auth/get-jwt-token`, and it is what the SDK's own Data API client calls.
   *
   * The fallback is for SDK drift, not for that bug — if a later version
   * renames this, a working sync should not turn into a 404 again.
   */
  async accessToken() {
    if (!this.client || !this.user) return null;
    const auth = this.client.auth;
    const get = typeof auth.getJWTToken === 'function'
      ? auth.getJWTToken.bind(auth)
      : auth.getToken.bind(auth);
    try {
      // Through `keepTrying` because this is the call that lands on a sleeping
      // database — it is the first thing the worlds screen asks for. See net/retry.js.
      const result = await keepTrying(get);
      return result?.data?.token ?? result?.token ?? null;
    } catch (err) {
      throw new Error(readableTokenError(err));
    }
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

/**
 * What to say when the sign-in service will not hand out a token.
 *
 * Every line here used to end "your worlds are safe on this device", which was
 * true when the game kept a local copy and became a lie the day worlds moved
 * to the account and local saving was deleted. Telling somebody their work is
 * somewhere it is not is worse than telling them nothing.
 *
 * The truth is the other way round and is still reassuring: what you made is
 * on your account, which is the one place it cannot be lost by this device
 * failing to reach it. The hostname is gone too — it named an internal machine
 * nobody can do anything about, and the raw error is still in the console for
 * whoever can.
 */
export function readableTokenError(err) {
  const status = err?.status ?? err?.body?.status;
  if (status === 401 || status === 403) return 'Your session has expired — sign in again.';
  if (status === 404) {
    return 'The sign-in service does not recognise this app. Nothing you have made is lost,'
      + ' but it cannot be opened until this is fixed.';
  }
  if (status >= 500) {
    return 'The sign-in service is having a moment. Nothing is lost — give it a minute and try again.';
  }
  return 'Could not reach your account just now. Nothing is lost: your worlds are kept on the'
    + ' account, so they are waiting whenever it answers.';
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
