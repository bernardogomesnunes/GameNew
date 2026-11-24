// Neon Auth webhook receiver. Subscribe to user.created only (never user.before_create:
// that event is fail-closed and a broken endpoint would block every sign-up).
// Needs the Vercel env var NEON_AUTH_URL. Writes nothing to the database.
import { handle } from './_neon-webhook.js';

export async function POST(request) {
  return handle(request, { authUrl: process.env.NEON_AUTH_URL });
}

export async function GET() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
