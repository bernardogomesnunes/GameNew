/**
 * Where the one unsent copy of a world goes when it's too big for
 * localStorage (SAVE-5: "the backup copy may not fit"). localStorage holds
 * about 5 MB in all, and a big world's copy is more than that; IndexedDB holds
 * hundreds. localStorage is still tried first (see Game.keepSafe): it writes
 * at once, so a copy made as the page is closed is sure to be there, where an
 * IndexedDB write may not finish before the page is gone.
 *
 * One record, the same shape as the localStorage one. Every call is best
 * effort and never throws: no IndexedDB (a private window, the tests) reads
 * as nothing kept.
 */

const DB = 'voxelgame', STORE = 'unsent', KEY = 'world';

let opening = null;

/** The database, opened once. Every call waits on the same one, so they run in the order made. */
function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('No IndexedDB here.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  opening.catch(() => { opening = null; });
  return opening;
}

function run(mode, act) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = act(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Not kept.'));
  }));
}

/** Keeps `record`, in place of any copy before it. Whether it was kept. */
export function putBackup(record) {
  return run('readwrite', (s) => s.put(record, KEY)).then(() => true, () => false);
}

/** The copy kept, or null. */
export function getBackup() {
  return run('readonly', (s) => s.get(KEY)).then((r) => r ?? null, () => null);
}

/** Throws the copy away — only if it is world `id`'s, when one is given. */
export async function dropBackup(id = null) {
  if (id && (await getBackup())?.worldId !== id) return;
  await run('readwrite', (s) => s.delete(KEY)).catch(() => {});
}
