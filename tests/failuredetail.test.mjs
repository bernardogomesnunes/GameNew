/**
 * Saying what actually broke, not just that something did.
 *
 * A second screenshot of the same worlds screen, an hour after the retry
 * shipped and with the retry's own new wording on it. The database was awake
 * that minute — Neon's log has the compute starting at 19:22 and still active
 * at 19:27 — so the cold start was not it, and four tries over three seconds
 * had nothing to wait for.
 *
 * At which point the investigation stopped, because every one of those causes
 * produces the same sentence on the screen and there was no way to tell them
 * apart from a photograph of a phone. Hence a folded line with the real
 * failure in it: which call, what kind of error, and the status if there was
 * one — because "no reply at all" and "the route answered 500" need opposite
 * repairs and read identically to a player.
 */
import { describeFailure, failure, readableTokenError } from '../src/net/CloudAuth.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const err = (name, message, status) => Object.assign(new Error(message), { name, status });

// --- the three failures that look the same on screen --------------------------
{
  const noReply = describeFailure(new TypeError('Load failed'), '/auth/get-jwt-token');
  const serverErr = describeFailure(err('AuthError', 'Service Unavailable', 503), '/auth/get-jwt-token');
  const missing = describeFailure(err('AuthApiError', 'Not Found', 404), '/auth/get-jwt-token');

  ok(`a reply that never came says so: ${noReply}`, /no reply/i.test(noReply));
  ok('and names the kind of error', /TypeError/.test(noReply));
  ok(`a 503 shows its status: ${serverErr}`, /\b503\b/.test(serverErr));
  ok(`so does a 404: ${missing}`, /\b404\b/.test(missing));
  ok('all three name the call that failed',
    [noReply, serverErr, missing].every((d) => d.includes('/auth/get-jwt-token')));
  ok('and they are genuinely different lines',
    new Set([noReply, serverErr, missing]).size === 3);
}

// --- the readable sentence is unchanged, the detail rides alongside -----------
{
  const original = new TypeError('Load failed');
  const wrapped = failure(original, '/auth/get-jwt-token');
  ok('the player still gets the readable sentence',
    wrapped.message === readableTokenError(original));
  ok('the technical line is attached, not substituted', /no reply/.test(wrapped.detail));
  ok('and the original error is kept as the cause', wrapped.cause === original);
}

// --- it must not become a place to leak something ----------------------------
{
  const long = describeFailure(err('AuthError', 'x'.repeat(5000), 500), '/auth/get-jwt-token');
  ok(`a runaway message is cut short (${long.length} chars)`, long.length < 300);

  // The whole point of this line is that it gets photographed and sent to
  // somebody. A JWT is a key to the account, so it is the one thing that must
  // never appear in the one place designed to be shared.
  const withToken = describeFailure(
    err('AuthError', 'failed for Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig', 500), '/auth/get-jwt-token');
  ok(`a JWT is taken out: ${withToken}`, !/eyJ[A-Za-z0-9_-]+\./.test(withToken) && /\[token\]/.test(withToken));

  const withPassword = describeFailure(err('AuthError', 'password: hunter2 rejected', 500));
  ok(`so is a password: ${withPassword}`, !/hunter2/.test(withPassword));

  const withSession = describeFailure(err('AuthError', 'session sess_9fj20dkAlsjd83nRk2mQp7xZ gone', 500));
  ok(`and anything else long and opaque: ${withSession}`, !/9fj20dk/.test(withSession));

  // But it must still read as a sentence, or it is no use to anybody.
  const plain = describeFailure(err('AuthError', 'Service Unavailable at the upstream gateway', 503));
  ok(`ordinary words survive: ${plain}`, /Service Unavailable at the upstream gateway/.test(plain));
  ok('and so does a short one-word clue',
    /token expired/.test(describeFailure(err('AuthError', 'token expired', 401))));
}

// --- nothing is lost when there is no detail to give -------------------------
{
  ok('a bare error still describes itself', describeFailure({}).length > 0);
  ok('and works with no route named', !describeFailure(new TypeError('Load failed')).includes('undefined'));
}

process.exit(f ? 1 : 0);
