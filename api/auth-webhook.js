// Neon Auth webhook receiver. Subscribe to user.created only (never user.before_create:
// that event is fail-closed and a broken endpoint would block every sign-up).
// Auth URL: NEON_AUTH_URL if set, else derived from VITE_NEON_URL (already set on Vercel for the game).
// Writes nothing to the database.
import { handle } from './_neon-webhook.js';
import { readFileSync } from 'node:fs';
import { deriveUrls } from '../src/net/cloudConfig.js';

// VITE_NEON_URL lives in the committed .env, which Vite reads at build time only.
// A Vercel function does not load it, so read the same file here (vercel.json
// includes it in this function's bundle). Missing or unreadable gives {}.
export function readDotEnv(url = new URL('../.env', import.meta.url)) {
  try {
    const out = {};
    for (const line of readFileSync(url, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

export function authUrlFromEnv(env = process.env, fileEnv = env === process.env ? readDotEnv() : {}) {
  if (env.NEON_AUTH_URL) return env.NEON_AUTH_URL;
  const base = env.VITE_NEON_URL || fileEnv.VITE_NEON_URL;
  return base ? deriveUrls(base.replace(/\/$/, '')).auth : '';
}

export async function POST(request) {
  return handle(request, { authUrl: authUrlFromEnv() });
}

export async function GET() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
