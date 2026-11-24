// Read-only SQL over Neon's HTTP endpoint, shared by the support scripts.
// Writes are impossible: every statement must start with select or with, has no
// semicolon, and the batch is sent with Neon-Batch-Read-Only (a read-only transaction).
// The connection string never appears in output.

export function sqlEndpoint(connectionString) {
  return `https://${new URL(connectionString).hostname}/sql`;
}

export function assertSelect(query) {
  if (!/^\s*(select|with)\b/i.test(query) || /;/.test(query)) throw new Error('Only a single select is allowed.');
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i.test(query.replace(/'[^']*'/g, "''"))) {
    throw new Error('Only a single select is allowed.');
  }
}

/** Runs queries ([{query, params}]) in one read-only batch. Returns an array of row arrays. */
export async function readonlyQueries(connectionString, queries, fetchImpl = globalThis.fetch) {
  queries.forEach((q) => assertSelect(q.query));
  let res;
  try {
    res = await fetchImpl(sqlEndpoint(connectionString), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString,
        'Neon-Batch-Read-Only': 'true',
      },
      body: JSON.stringify({ queries: queries.map((q) => ({ query: q.query, params: q.params ?? [] })) }),
    });
  } catch (err) {
    throw new Error(`Could not reach the database: ${redact(err.message, connectionString)}`);
  }
  if (!res.ok) throw new Error(`The database answered ${res.status}: ${redact(await res.text(), connectionString).slice(0, 200)}`);
  const body = await res.json();
  const results = body.results ?? [];
  if (results.length !== queries.length) throw new Error('The database answered with the wrong number of results.');
  return results.map((r) => r.rows ?? []);
}

export function redact(text, connectionString) {
  let out = String(text);
  if (connectionString) {
    out = out.replaceAll(connectionString, '[connection string]');
    try { const p = new URL(connectionString).password; if (p) out = out.replaceAll(p, '[password]'); } catch { /* not a URL */ }
  }
  return out;
}
