# Atomic world save rollout (0006, not applied)

`0006_atomic_world_saves.sql` is a reviewable migration, with client support
behind `VITE_ATOMIC_SAVES=true`. The default remains off. No database was
contacted or changed while preparing it. The flag is public build configuration;
it is not an API key, and no new credentials are required.

Two devices can currently upload chunk pages between each other's requests.
Checking only the world row's revision would still leave mixed chunks. The new
protocol stages each device's diff privately, then publishes the metadata and
all staged chunks in one PostgreSQL transaction:

1. `POST /rpc/begin_world_save`: a random save UUID, world UUID, last agreed
   revision, changed-chunk count, and the complete world metadata.
2. `POST /rpc/stage_world_save`: that save UUID and at most 100 changed chunks.
   Pages can be retried; coordinates upsert only within the private session.
3. `POST /rpc/commit_world_save`: locks the world UUID (including a not-yet-created
   world), locks/checks its row, rejects a stale revision or deleted world, then
   copies the chunks and metadata together. Constraint failures roll everything
   back. An idempotency receipt answers retries of the same commit.

Unchanged published chunks remain in place, preserving incremental saves. A
reader checks the revision again after its final page and retries the entire
download if a commit crossed it. Repeated concurrent changes produce a readable
conflict instead of accepting an inconsistent world. Atomic deletes use a
matching owner/revision check and invalidate unfinished sessions.

PostgreSQL supplies transaction visibility and row locks; the absent-row case
also takes an advisory transaction lock. The final upsert repeats ownership and
revision conditions as a second guard. See the [PostgreSQL locking
documentation](https://www.postgresql.org/docs/current/explicit-locking.html).

## Access and resource limits

Staging/budget tables have RLS enabled and no client grants or policies. Only
the four public RPC functions are executable by `authenticated`; internal
helpers are revoked. Every definer function uses a fixed `pg_catalog` search
path and explicitly checks the JWT identity against `public.players`.
The expected Data API role is `authenticated`, consistent with [Neon's RLS
documentation](https://neon.com/blog/higher-level-crud-abstraction-for-postgres-rls).
The real deployment's role and privileges still must be checked.

Restrictive RLS policies block **all direct authenticated writes to worlds and
world_chunks**, including old clients. Leaving those writes open would allow
the atomic protocol to be bypassed. Existing table reads remain unchanged.

SQL enforces a token bucket per JWT identity: 40-request burst, four successful
write requests per second thereafter, shared across RPCs and statement triggers
on players, progression, templates and save_failures. The identity key survives
deleting/recreating a player row. Rejected transactions do not consume a token
because PostgreSQL rolls their changes back; this is a successful-write quota,
not HTTP request/CPU denial-of-service protection. The client queue additionally
paces its own writes; server enforcement is independent of that queue.

Each player can hold four unfinished sessions, 64 MiB of staged chunks across
them, at most 16,384 changed chunks per session, and 8 MiB metadata per session.
Each chunk is at most 1 MiB and must decode to the declared chunk height with
valid bounded RLE values. A page is at most 4 MiB. Existing published-table
constraints still apply at commit, including the live migration 0005 limits.

Sessions expire after 30 minutes. Beginning another save cleans that player's
expired sessions and retains at most 256 completed receipts. These receipts
contain no world metadata/chunk bytes after commit. Deploy an owner maintenance
job for idle-player staging and inactive quota identities, for example:

```sql
delete from public.world_save_sessions where expires_at <= clock_timestamp();
delete from public.player_write_budgets
where refilled_at < clock_timestamp() - interval '7 days';
```

These statements remove temporary protocol state, never published worlds.
Maintenance must run as a trusted owner, outside the Data API. Include quota
identity records in the account-erasure procedure.

## Required review and coordinated deployment

1. Recover the exact **already-live 0005 size-limit migration** into source
   control; it is absent from this checkout. Review its constraints against the
   staging limits. Do not invent or overwrite 0005.
2. Apply 0001–0006 only to an isolated test database/branch first. 0001 is a
   baseline and must never be replayed against the existing live database.
   Verify the actual Data API role is `authenticated`, is not a table owner and
   cannot bypass RLS; execute 0006 as the trusted table owner. Check real JWT
   authentication and RPC exposure/schema-cache refresh through the Data API.
3. Exercise two genuine connections interleaving paged saves, two accounts
   attempting the same new world UUID, disconnect/retry, stale revision,
   deletion during upload, and existing large/legacy worlds. Verify 0005 size
   errors roll back metadata and chunks together. Verify ancillary table rate
   triggers and admin/account-deletion maintenance.
4. Obtain the owner's approval to change the live database. Stage the client
   build with the flag enabled and coordinate a brief write-maintenance window
   with migration application and deployment. Old open tabs will fail direct
   writes until reloaded; they must keep their device backups. Migration and
   flag deployment cannot be treated as independent ordinary releases.
5. Monitor conflicts, size failures, quota errors and staging growth. Install
   the cleanup job. Do not delete backups when an upload conflicts.

Disabling the flag alone is **not** a rollback: the legacy mutation paths remain
blocked by RLS. Any rollback needs a separately reviewed, numbered migration
and consciously restores the old concurrency risk. Keep owner-approved backup
and recovery procedures available during deployment.

## Verification performed

`node tests/atomic-saves.test.mjs` exercises the real JavaScript transport against
a mock RPC contract: 201 chunks paged, an interleaved winning/losing device,
lost commit response/idempotency, and a revision change during paged reads.

`tools/test-atomic-sql.mjs` also ran the actual migration in **temporary,
in-memory PostgreSQL/WASM (PGlite 0.5.11)** with the baseline migrations and a
stub JWT identity function. It verified staging invisibility, incomplete-save
rejection, idempotency, competing same-base sessions, RLS denial of direct and
cross-account writes, full rollback when a published chunk constraint fails,
delete protection, malformed RLE rejection and server write-quota exhaustion.
PGlite was installed only in a temporary directory, with no project dependency
changes. A reproducible command is given at the top of that test tool.

This is actual isolated SQL execution, but it does **not** verify live 0005,
Neon JWT/PostgREST integration, or multiple simultaneous PostgreSQL connections.
Those deployment checks remain prerequisites; no claim of a live concurrency
fix is made before approval and activation.
