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
 * The Stack Auth SDK is loaded lazily. A player who never signs in never pays
 * for it, which matters more here than in a typical app because the first thing
 * this page has to do is render a world.
 */
export class CloudAuth {
  constructor(bus) {
    this.bus = bus;
    this.app = null;
    this.user = null;
    this.ready = false;
  }

  get configured() {
    return isCloudConfigured();
  }

  async load() {
    if (this.app) return this.app;
    if (!this.configured) throw new Error('Cloud sync is not configured for this build.');
    const { StackClientApp } = await import('@stackframe/js');
    this.app = new StackClientApp({
      projectId: CLOUD.stackProjectId,
      publishableClientKey: CLOUD.stackPublishableKey,
      tokenStore: 'cookie',
      // This is a single-page canvas with no routes to redirect to; every auth
      // step is resolved in place and reported through the menu panel.
      redirectMethod: 'none',
      devTool: false,           // keeps the SDK's dev overlay out of the bundle
      noAutomaticPrefetch: true, // nothing should reach the network until asked
    });
    return this.app;
  }

  /**
   * Picks up an existing session. Deferred until the menu is first opened, so a
   * player who never signs in never downloads the auth SDK at all — the first
   * thing this page has to do is render a world, not negotiate a login.
   *
   * Never throws: being offline is not an error here.
   */
  async restore() {
    if (this.ready) return this.user;
    if (!this.configured) return null;
    try {
      const app = await this.load();
      this.user = await app.getUser();
    } catch {
      this.user = null;
    }
    this.ready = true;
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signIn(email, password) {
    const app = await this.load();
    const result = await app.signInWithCredential({ email, password, noRedirect: true });
    if (result.status === 'error') throw new Error(readableAuthError(result.error));
    this.user = await app.getUser();
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signUp(email, password) {
    const app = await this.load();
    const result = await app.signUpWithCredential({ email, password, noRedirect: true, noVerificationCallback: true });
    if (result.status === 'error') throw new Error(readableAuthError(result.error));
    this.user = await app.getUser();
    this.bus?.emit('cloud:auth', { user: this.summary() });
    return this.user;
  }

  async signOut() {
    if (this.user) await this.user.signOut();
    this.user = null;
    this.bus?.emit('cloud:auth', { user: null });
  }

  /** Short-lived JWT for the Data API. The SDK refreshes it as needed. */
  async accessToken() {
    if (!this.user) return null;
    return this.user.getAccessToken();
  }

  summary() {
    if (!this.user) return null;
    return { id: this.user.id, email: this.user.primaryEmail, name: this.user.displayName };
  }
}

function readableAuthError(error) {
  const code = error?.errorCode || error?.code || '';
  if (code.includes('EmailPasswordMismatch')) return 'That email and password do not match.';
  if (code.includes('UserWithEmailAlreadyExists')) return 'There is already an account with that email — sign in instead.';
  if (code.includes('PasswordRequirementsNotMet')) return 'Pick a longer password (at least 8 characters).';
  return error?.message || 'Could not sign in. Try again.';
}
