/**
 * Trying again while the database wakes up.
 *
 * Neon suspends a compute after a few minutes of nobody using it, and wakes it
 * on the next request. The waking takes somewhere between a third of a second
 * and a couple of seconds — the project's own operation log for one ordinary
 * day shows six sleep/wake cycles, at 426ms, 433ms, 440ms, 434ms, 1540ms and
 * 403ms. That is fine. What was not fine is that the game made exactly one
 * request, and a request that lands in the middle of a wake gets an error.
 *
 * So one cold database looked identical to a broken account: "Could not reach
 * your account", on a screen where every world lives on that account. The
 * player has done nothing wrong and there is nothing for them to fix — they
 * arrived a second early.
 *
 * Hence: ask again. Only for the failures that a second ago might have
 * answered differently — no reply at all, or the far end saying it is not
 * ready. A 401 is not going to become a 200 by asking twice, and retrying it
 * only makes a wrong password take four seconds to say so.
 */

/** Gaps between tries, in milliseconds. Four tries, spread over ~3.3 seconds. */
export const BACKOFF = [400, 900, 2000];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True for a failure that is worth asking about again.
 *
 * A thrown fetch carries no status at all — that is the browser saying it
 * never got a reply, which is exactly the cold-start case. Anything the server
 * answered with a 4xx it will answer the same way next time, with the two
 * exceptions that mean "not now": timed out, and too many.
 */
export function worthRetrying(err) {
  const status = err?.status ?? err?.body?.status ?? err?.statusCode;
  if (status == null) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

/**
 * Runs `fn`, and runs it again if it fails in a way that might not fail twice.
 * Throws whatever the last attempt threw, so the caller still gets the real
 * error to turn into something a player can read.
 */
export async function keepTrying(fn, { backoff = BACKOFF, sleep = wait } = {}) {
  let last;
  for (let i = 0; i <= backoff.length; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!worthRetrying(err)) throw err;
      last = err;
      if (i < backoff.length) await sleep(backoff[i]);
    }
  }
  throw last;
}
