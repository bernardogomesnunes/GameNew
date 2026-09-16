import { CLOUD, isCloudConfigured } from './cloudConfig.js';
import { isOurBug, keepTrying } from './retry.js';

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
    try {
      // Called as a method and never detached, which matters more than it
      // looks. `auth` is a Proxy that turns *every* property access into a
      // route, `.bind` included — so `auth.getJWTToken.bind(auth)` is not
      // Function.prototype.bind. It asks the server for
      // /auth/get-jwt-token/bind, fires that request immediately, and hands
      // back a Promise. `typeof` says "function" both before and after,
      // because a callable proxy is a function and so is the thing it returns
      // for `.bind`, so nothing about it reads as wrong.
      //
      // Then calling that Promise threw "e is not a function", which has no
      // HTTP status, which this file classified as "could not reach your
      // account". Every signed-in player got that, on every device, from the
      // day the method name was fixed — which is exactly why one account
      // showed different worlds on a phone and a desktop: the token never
      // arrived, so nothing ever synced.
      const result = await keepTrying(() => auth.getJWTToken());
      return result?.data?.token ?? result?.token ?? null;
    } catch (err) {
      // SDK drift, not the bug above: if a later version renames this, a
      // working sync should not turn into a 404. Only a missing route is
      // worth a second name — anything else means the route is there and
      // something else is wrong with it.
      if (err?.status === 404) {
        try {
          const result = await keepTrying(() => auth.getToken());
          return result?.data?.token ?? result?.token ?? null;
        } catch (drift) {
          err = drift;
        }
      }
      // Logged as well as shown: on a desktop the console has the stack, and
      // on a phone the folded Details line is the only way this ever gets out.
      console.error('[duilt] token request failed', err);
      throw failure(err, '/auth/get-jwt-token');
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
/**
 * The technical version, kept alongside the readable one.
 *
 * A player does not want this and should never have to read it. But when the
 * only report anybody can make is a photograph of a phone, "could not reach
 * your account" is the end of the investigation: it is the same sentence for a
 * sleeping database, a route that answers 500, and a reply the browser threw
 * away. Those need completely different fixes, and one line on the screen is
 * the difference between knowing which and guessing.
 *
 * Folded away behind a tap, so it costs nothing to anybody who is not chasing
 * a bug.
 */
export function describeFailure(err, route = null) {
  const status = err?.status ?? err?.body?.status;
  const name = err?.name || 'Error';
  const message = redact(String(err?.message ?? '')).slice(0, 200);
  const where = route ? ` ${route}` : '';
  // Our own bug reads exactly like a dead network — no status, a TypeError —
  // and saying "no reply" about it cost days of looking at the wrong end of
  // the wire. Name it for what it is.
  if (isOurBug(err)) return `${name}${where} — a bug in the game (${message})`;
  // Otherwise no status means the browser never got a usable reply: refused,
  // cut off, or an answer it would not let the page see.
  if (status == null) return `${name}${where} — no reply (${message || 'request did not complete'})`;
  return `${name} ${status}${where} — ${message}`;
}

/**
 * Takes anything token-shaped out of a message before it goes on the screen.
 *
 * The whole point of this line is that somebody photographs it and sends it to
 * somebody else. A JWT that wandered into an error message would ride along,
 * and a JWT is a key to the account — so the one place it must never appear is
 * the one place this text is designed to end up.
 */
function redact(text) {
  return text
    // A JWT, which is what the failing call is asking for in the first place.
    .replace(/\beyJ[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+){1,2}/g, '[token]')
    // A password is never diagnostic, so the value goes whatever it looks like.
    .replace(/\b(password)\b\s*[=:]?\s*\S+/gi, '$1 [hidden]')
    // Anything else long and opaque — a session id, a key. No English word runs
    // to 24 characters, so this leaves real sentences alone.
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[redacted]');
}

/** Ties the technical line to the readable one, so both travel together. */
export function failure(err, route) {
  const readable = new Error(readableTokenError(err));
  readable.detail = describeFailure(err, route);
  readable.cause = err;
  return readable;
}

export function readableTokenError(err) {
  const status = err?.status ?? err?.body?.status;
  // Ours, not the network's. Saying "could not reach your account" for a bug
  // in this code sends the player to check their wifi over and over while the
  // account sits there answering perfectly — which is what happened, for days.
  if (isOurBug(err)) {
    return 'Something in the game itself went wrong, not your connection.'
      + ' Nothing is lost — this one is ours to fix.';
  }
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
