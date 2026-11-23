/**
 * ACCT-5, "Download my data": everything this account holds, as one JSON file.
 *
 * Built in the browser from the same reads the game already uses to open a
 * world (NeonTransport.listWorlds and pullWorld), so it needs no new database
 * function and works before and after any migration. The file holds, for the
 * signed-in player: the account's email and name, the chosen player name when
 * there is one, progression, saved designs, and every world with its metadata
 * and every chunk (run-length bytes, base64). Nothing here reads another
 * player's rows; row-level security decides what comes back.
 *
 * Worlds are written one at a time into a list of string parts that goes
 * straight into a Blob, so a large account is never one giant string in memory.
 */

export const ACCOUNT_EXPORT_FORMAT = 'duilt-account-export';
export const ACCOUNT_EXPORT_VERSION = 1;

/** Standard base64 of a byte array, in slices so a big chunk does not overflow the call stack. */
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBytes(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param transport  a NeonTransport (listWorlds, pullWorld, pullProgression, pullTemplates)
 * @param user       { id, email, name } from CloudAuth.summary()
 * @param playerName the chosen name, or null
 * @param onProgress ({ done, total, name }) called before each world
 * @returns { blob, worlds, chunks, failed: [{ id, name, message }] }
 */
export async function buildAccountExport({ transport, user, playerName = null, onProgress = () => {}, now = () => new Date() }) {
  const list = await transport.listWorlds();
  const progression = await transport.pullProgression().catch(() => null);
  const templates = await transport.pullTemplates?.().catch(() => []) ?? [];
  const parts = [];
  parts.push(`{"format":${JSON.stringify(ACCOUNT_EXPORT_FORMAT)},"version":${ACCOUNT_EXPORT_VERSION},"exportedAt":${JSON.stringify(now().toISOString())},`);
  parts.push(`"account":${JSON.stringify({ id: user?.id ?? null, email: user?.email ?? null, name: user?.name ?? null })},`);
  parts.push(`"playerName":${JSON.stringify(playerName ?? null)},`);
  parts.push(`"progression":${JSON.stringify(progression ?? null)},`);
  parts.push(`"templates":${JSON.stringify(templates)},`);
  parts.push('"chunkEncoding":"rle-base64","worlds":[');

  const failed = [];
  let chunks = 0;
  let written = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    onProgress({ done: i, total: list.length, name: w.name });
    let payload;
    try { payload = await transport.pullWorld(w.id); } catch (err) {
      failed.push({ id: w.id, name: w.name, message: err?.message ?? String(err) });
      continue;
    }
    if (!payload) { failed.push({ id: w.id, name: w.name, message: 'not found' }); continue; }
    const rows = payload.chunks.map((c) => ({ cx: c.cx, cz: c.cz, rle: bytesToBase64(c.bytes) }));
    chunks += rows.length;
    parts.push(`${written ? ',' : ''}${JSON.stringify({
      id: w.id, name: w.name, mode: w.mode, updatedAt: new Date(w.updatedAt).toISOString(), meta: payload.meta, chunks: rows,
    })}`);
    written++;
  }
  onProgress({ done: list.length, total: list.length, name: '' });
  parts.push(`],"failed":${JSON.stringify(failed)}}`);
  return { blob: new Blob(parts, { type: 'application/json' }), worlds: written, chunks, failed };
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function accountExportFilename(now = new Date()) {
  return `duilt-my-data-${now.toISOString().slice(0, 10)}.json`;
}
