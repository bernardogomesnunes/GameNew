import { readFileSync } from 'node:fs';

/**
 * Reported directly, opening a world: "Cloud request failed 400 - Code
 * message response is too large maxix 10485760 bytes". The Data API won't
 * answer with more than 10 MB at once, and a world was fetched in one
 * request, so a big one couldn't be opened at all. Chunks now come, and go,
 * a page at a time.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { NeonTransport } = await import('../src/net/NeonTransport.js');

/** A stand-in Data API that, like the real one, refuses an answer (or a body) over its cap. */
function backend({ cap }) {
  const chunks = [];
  const calls = { get: 0, post: 0, refused: 0 };
  const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    const path = url.pathname.replace(/^.*\/rest\/v1/, '');
    const method = init.method ?? 'GET';
    if (path.startsWith('/players')) return reply(200, [{ id: 'player-1' }]);
    if (path.startsWith('/worlds')) {
      if (method === 'POST') return reply(204);
      return reply(200, [{ id: 'w1', name: 'Test world 1', mode: 'duilt', size_x: 0, size_z: 0, height: 200, revision: 1, economy: {} }]);
    }
    if (path.startsWith('/world_chunks') && method === 'POST') {
      calls.post++;
      if (init.body.length > cap) { calls.refused++; return reply(413, { message: 'request entity too large' }); }
      for (const row of JSON.parse(init.body)) chunks.push(row);
      return reply(204);
    }
    if (path.startsWith('/world_chunks')) {
      calls.get++;
      const sorted = [...chunks].sort((a, b) => a.cx - b.cx || a.cz - b.cz);
      const limit = Number(url.searchParams.get('limit') ?? Infinity);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const page = sorted.slice(offset, offset + limit).map(({ cx, cz, rle }) => ({ cx, cz, rle }));
      if (JSON.stringify(page).length > cap) {
        calls.refused++;
        return reply(400, { code: null, message: `response is too large, max ${cap} bytes`, details: null, hint: null });
      }
      return reply(200, page);
    }
    return reply(404, { message: 'no route' });
  };
  return { fetchImpl, chunks, calls };
}

const auth = { async accessToken() { return 'test-token'; }, summary() { return { id: 'player-1' }; } };
const withFetch = async (fetchImpl, fn) => { const real = globalThis.fetch; globalThis.fetch = fetchImpl; try { return await fn(); } finally { globalThis.fetch = real; } };

// 450 chunks of 2 KB each: nearly 2 MB of hex, against a cap of 400 KB.
const CAP = 400_000;
const made = [];
for (let i = 0; i < 450; i++) made.push({ cx: i % 30, cz: Math.floor(i / 30), bytes: new Uint8Array(2000).fill(i % 251) });

const b = backend({ cap: CAP });
const t = new NeonTransport(auth, { baseUrl: 'https://fake.local/rest/v1' });
await withFetch(b.fetchImpl, () => t.pushWorld({ worldId: 'w1', meta: { name: 'Test world 1', mode: 'duilt', height: 200 }, chunks: made }));
ok(`a big world is sent in batches, not one request (${b.calls.post} requests, ${b.calls.refused} too big and split)`, b.chunks.length === 450 && b.calls.post > 1);

b.calls.refused = 0;
const back = await withFetch(b.fetchImpl, () => t.pullWorld('w1'));
ok(`and opened again in pages (${b.calls.get} pages, ${b.calls.refused} too big and halved)`, back?.chunks.length === 450 && b.calls.get > 1);
const key = (c) => `${c.cx},${c.cz}`;
ok('every chunk once, none missed or doubled', new Set(back.chunks.map(key)).size === 450);
const same = back.chunks.every((c) => { const m = made.find((x) => key(x) === key(c)); return m && c.bytes.length === m.bytes.length && c.bytes[7] === m.bytes[7]; });
ok('each one as it was saved', same);

// A small world: one request, as before.
const small = backend({ cap: 10_485_760 });
await withFetch(small.fetchImpl, () => t.pushWorld({ worldId: 'w1', meta: { name: 'Test world 1', mode: 'duilt', height: 200 }, chunks: made.slice(0, 12) }));
await withFetch(small.fetchImpl, () => t.pullWorld('w1'));
ok('a small world is still one request each way', small.calls.post === 1 && small.calls.get === 1);

const src = readFileSync(new URL('../src/net/NeonTransport.js', import.meta.url), 'utf8');
ok('pages come in a fixed order, so none skips or repeats', /order=cx\.asc,cz\.asc&limit=\$\{size\}&offset=\$\{from\}/.test(src));

process.exit(f ? 1 : 0);
