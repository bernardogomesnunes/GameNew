// Verifies a Neon Auth (Managed Better Auth) webhook and builds one log line.
// Files starting with "_" in api/ are not routed by Vercel; this is a helper.
// Signature scheme (neon.com/docs/auth/guides/webhooks, read 24 Nov 2026):
// Ed25519 detached JWS, key found by X-Neon-Signature-Kid in <NEON_AUTH_URL>/.well-known/jwks.json.
import crypto from 'node:crypto';

export const MAX_AGE_MS = 5 * 60 * 1000;
export const MAX_BODY_BYTES = 64 * 1024;

let jwksCache = { url: '', keys: [] };
let lastRefresh = 0;

/** Public key for a kid. Cached; refreshed at most once a minute when the kid is unknown. */
export async function findKey(authUrl, kid, fetchImpl = globalThis.fetch, now = Date.now()) {
  const url = `${String(authUrl).replace(/\/+$/, '')}/.well-known/jwks.json`;
  const hit = () => (jwksCache.url === url ? jwksCache.keys.find((k) => k.kid === kid) : undefined);
  if (hit()) return hit();
  if (jwksCache.url === url && jwksCache.keys.length && now - lastRefresh < 60_000) return null;
  lastRefresh = now;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`JWKS answered ${res.status}`);
  const body = await res.json();
  jwksCache = { url, keys: Array.isArray(body.keys) ? body.keys : [] };
  return hit() || null;
}

export function resetKeyCache() { jwksCache = { url: '', keys: [] }; lastRefresh = 0; }

/** Throws on any failure. Returns the parsed payload. */
export async function verifyWebhook(rawBody, headers, { authUrl, fetchImpl, now = Date.now() } = {}) {
  if (!authUrl) throw new Error('NEON_AUTH_URL is not set');
  const get = (n) => (typeof headers.get === 'function' ? headers.get(n) : headers[n]);
  const signature = get('x-neon-signature');
  const kid = get('x-neon-signature-kid');
  const timestamp = get('x-neon-timestamp');
  if (!signature || !kid || !timestamp) throw new Error('Missing signature headers');
  const parts = signature.split('.');
  if (parts.length !== 3 || parts[1] !== '') throw new Error('Expected detached JWS');
  const age = now - Number(timestamp);
  if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -MAX_AGE_MS) throw new Error('Timestamp out of range');
  const jwk = await findKey(authUrl, kid, fetchImpl, now);
  if (!jwk) throw new Error('Unknown signing key');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const payloadB64 = Buffer.from(rawBody, 'utf8').toString('base64url');
  const sigPayloadB64 = Buffer.from(`${timestamp}.${payloadB64}`, 'utf8').toString('base64url');
  const input = Buffer.from(`${parts[0]}.${sigPayloadB64}`);
  if (!crypto.verify(null, input, publicKey, Buffer.from(parts[2], 'base64url'))) throw new Error('Bad signature');
  return JSON.parse(rawBody);
}

/** One structured line for a user.created event. No email address, only its domain. */
export function logLine(event, eventId) {
  const email = String(event?.user?.email || '');
  return JSON.stringify({
    tag: 'neon-auth-webhook',
    event: event?.event_type,
    event_id: eventId || event?.event_id,
    at: event?.timestamp,
    user_id: event?.user?.id,
    email_domain: email.includes('@') ? email.split('@').pop().toLowerCase() : undefined,
    email_verified: event?.user?.email_verified,
    provider: event?.event_data?.auth_provider,
  });
}

/** Whole handler on web Request/Response, so tests need no server. */
export async function handle(request, { authUrl, fetchImpl, now, log = console.log } = {}) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
  let event;
  try {
    event = await verifyWebhook(raw, request.headers, { authUrl, fetchImpl, now });
  } catch (err) {
    log(JSON.stringify({ tag: 'neon-auth-webhook', rejected: String(err.message).slice(0, 80) }));
    // 401 is not retried by Neon. A config or JWKS failure is 500 so it is retried and noticed.
    return new Response('Unauthorized', { status: /NEON_AUTH_URL|JWKS/.test(err.message) ? 500 : 401 });
  }
  if (event.event_type === 'user.created') log(logLine(event, request.headers.get('x-neon-event-id')));
  return new Response(null, { status: 200 });
}
