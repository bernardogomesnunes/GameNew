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
 * is read off the `set-auth-jwt` header Managed Better Auth attaches to every
 * successful session check, not fetched by calling a dedicated method — see
 * accessToken for why the method the SDK documents for that
 * (`auth.token()`) turned out not to be safe to call in this app's own flow,
 * after two earlier, wrong method names were tried and fixed in turn.
 *
 * The SDK is loaded lazily, on first sight of the menu. A player who never
 * signs in never downloads it, which matters more here than in a typical app
 * because the first thing this page has to do is render a world.
 */
// Tokens expire in 15 minutes (docs/auth/guides/plugins/jwt.md). Refreshed a
// couple of minutes early rather than exactly at the deadline, so a request
// that starts just before expiry does not lose the race against the clock.
const JWT_LIFETIME_MS = 15 * 60_000;
const JWT_REFRESH_MARGIN_MS = 2 * 60_000;

export class CloudAuth {
  constructor(bus) {
    this.bus = bus;
    this.client = null;
    this.user = null;
    this.ready = false;
    // The Data API JWT, captured off a session response header — see
    // accessToken for why it is not simply fetched fresh each time.
    this.jwt = null;
    this.jwtAt = 0;
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
      this.user = userFrom(await this.checkSession(client));
    } catch {
      this.user = null;
    }
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  /**
   * A session check that also catches the JWT riding along on it.
   *
   * See accessToken for why this is the only place the JWT is captured from.
   * `onSuccess` fires whenever `getSession` actually resolves, which includes
   * a response this SDK version serves from its own local cache rather than
   * the network — that fabricated response carries no headers at all, so the
   * capture here is a no-op on a cache hit rather than wrong; this.jwt just
   * keeps whatever it already had.
   */
  async checkSession(client) {
    return client.auth.getSession({ fetchOptions: { onSuccess: this.captureJwt } });
  }

  async signIn(email, password) {
    const client = await this.load();
    // Caught here too, not only on getSession: signing in is itself a fresh
    // trip to the server, and Managed Better Auth attaches the same header
    // to it — capturing it now means the very first accessToken() call after
    // signing in already has a token, rather than needing a round trip of
    // its own to go and ask for one.
    const result = await client.auth.signIn.email({ email, password }, { onSuccess: this.captureJwt });
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
    const result = await client.auth.signUp.email({ email, password, name }, { onSuccess: this.captureJwt });
    this.user = unwrapUser(result);
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signOut() {
    if (this.client) await this.client.auth.signOut().catch(() => {});
    this.user = null;
    // A JWT left over from whoever was signed in before must never answer
    // for whoever signs in next.
    this.jwt = null;
    this.jwtAt = 0;
    this.bus?.emit('cloud:auth', { user: null });
  }

  /** Bound once so it can be handed to the SDK as a plain callback. */
  captureJwt = (ctx) => {
    const jwt = ctx.response.headers.get('set-auth-jwt');
    if (jwt) { this.jwt = jwt; this.jwtAt = Date.now(); }
  };

  /**
   * Short-lived JWT for the Data API.
   *
   * Three names have lived on this method, and the first two were both wrong
   * in the same way: `auth` is a Proxy that turns *any* property you touch
   * into an HTTP call on the matching route, so `auth.getJWTToken()` — a name
   * that does not appear anywhere in Neon's SDK, its source, or its docs —
   * still "worked" in the sense that it compiled, ran, and asked the server
   * for `/auth/get-jwt-token`. That route does not exist. It 404s, on every
   * request, on every device, which is the entire reason one account ever
   * showed different worlds on a phone and a desktop: signing in succeeded,
   * and every world upload failed on the very next line. Nothing about
   * calling it looked wrong — `typeof` reports "function" whether or not the
   * name means anything to the server, because the proxy manufactures a
   * callable for *any* name — and every test written against this file's own
   * invented stub passed the whole time, because the stub answered to the
   * made-up name too.
   *
   * The documented fix is `auth.token()` (docs/auth/guides/plugins/jwt.md;
   * confirmed against the SDK's own source too — `jwtClient()` is a real
   * entry in the adapter's plugin list, wired to a real route). That part is
   * true and stays true. What is not safe is calling it the way this method
   * needs to: once `getSession()` has run even once — which it always has,
   * `restore()` runs it at boot — this SDK version's own client-side session
   * cache intercepts `auth.token()` before it reaches the network and hands
   * back the *cached session response* instead, silently, with no error and
   * no request. A session response has no `.token` field at the position a
   * JWT would be — only `.session.token`, Better Auth's own opaque session
   * identifier, a completely different and unrelated value that the Data
   * API's JWKS check would simply reject — so reading it back as if it were
   * the JWT resolves to nothing, over and over, for as long as the app stays
   * open. Confirmed by calling `getSession()` then `token()` back to back,
   * against a controlled stand-in server, with nothing else running: the
   * second call never touches the network at all.
   *
   * So the JWT is not fetched by calling a dedicated method here. It is read
   * off the `set-auth-jwt` response header Managed Better Auth attaches to
   * every session check that reaches the network — see checkSession — which
   * is the alternative the same docs page describes for exactly this
   * situation, cached here for its known ~15-minute lifetime, and only
   * refreshed by asking for the session again, never by calling `auth.token()`.
   */
  async accessToken() {
    if (!this.client || !this.user) return null;
    if (this.jwt && Date.now() - this.jwtAt < JWT_LIFETIME_MS - JWT_REFRESH_MARGIN_MS) {
      return this.jwt;
    }
    try {
      // A fresh session check, not `restore()`'s cached one — this only runs
      // when the captured JWT is missing or old enough to need replacing, so
      // it is rare, and the whole point is to reach the network and see the
      // header again.
      await keepTrying(() => this.checkSession(this.client));
    } catch (err) {
      console.error('[duilt] session refresh failed', err);
      throw failure(err, '/auth/get-session');
    }
    if (this.jwt) return this.jwt;
    // The session check succeeded but no header came with it — signed out
    // server-side, most likely, since that is the one case Managed Better
    // Auth would answer 200 to a session check without a token attached.
    throw failure(Object.assign(new Error('No token in the session response'), { status: 401 }), '/auth/get-session');
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
