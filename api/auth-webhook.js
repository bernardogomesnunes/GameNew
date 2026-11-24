// Neon Auth webhook receiver. Subscribe to user.created only (never user.before_create:
// that event is fail-closed and a broken endpoint would block every sign-up).
// Auth URL: NEON_AUTH_URL if set, else derived from VITE_NEON_URL (already set on Vercel for the game).
// Writes nothing to the database.
import { handle } from './_neon-webhook.js';
import { deriveUrls } from '../src/net/cloudConfig.js';

export function authUrlFromEnv(env = process.env) {
  if (env.NEON_AUTH_URL) return env.NEON_AUTH_URL;
  return env.VITE_NEON_URL ? deriveUrls(env.VITE_NEON_URL.replace(/\/$/, '')).auth : '';
}

export async function POST(request) {
  return handle(request, { authUrl: authUrlFromEnv() });
}

export async function GET() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
