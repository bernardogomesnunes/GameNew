/**
 * ACCT-11: the player-name rules, as the database enforces them
 * (migrations/0010_player_names.sql). The database is the judge; this only
 * lets the game say so before a request, and tests/player-name.test.mjs
 * checks that the pattern here is the same text as the one in the migration.
 *
 * 3 to 20 characters: ASCII letters, digits, spaces and underscores, not
 * starting or ending with a space. Names are unique ignoring case.
 */
export const PLAYER_NAME_PATTERN = '^[A-Za-z0-9_][A-Za-z0-9_ ]{1,18}[A-Za-z0-9_]$';
const RULES = new RegExp(PLAYER_NAME_PATTERN);

/** The name as typed, with the spaces at either end removed. */
export function cleanPlayerName(text) {
  return String(text ?? '').trim();
}

/** A sentence saying what is wrong with `name`, or null when it is allowed. */
export function playerNameProblem(name) {
  const n = String(name ?? '');
  if (n.length < 3) return 'Use at least 3 characters.';
  if (n.length > 20) return 'Use at most 20 characters.';
  if (!/^[A-Za-z0-9_ ]+$/.test(n)) return 'Use letters, numbers, spaces and underscores only.';
  if (!RULES.test(n)) return 'A name cannot start or end with a space.';
  return null;
}

/** Turns the database's answer to a claim into a sentence. `reason` is on the thrown error. */
export function playerNameFailure(err) {
  const hay = `${err?.message ?? ''} ${err?.detail ?? ''}`;
  if (/name_taken/.test(hay) || err?.status === 409) return { reason: 'taken', message: 'That name is taken. Try another.' };
  if (/invalid_name/.test(hay)) return { reason: 'invalid', message: 'That name is not allowed. Use 3 to 20 letters, numbers, spaces or underscores.' };
  if (/sign_in_first/.test(hay) || err?.status === 401 || err?.status === 403) return { reason: 'signin', message: 'Your session expired. Sign in again.' };
  return { reason: 'other', message: err?.message || 'Could not save the name. Try again.' };
}
