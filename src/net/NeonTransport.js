import { deriveUrls } from './cloudConfig.js';
import { describeFailure } from './CloudAuth.js';
import { keepTrying } from './retry.js';

/**
 * SyncEngine transport over the Neon Data API (PostgREST).
 *
 * Every request carries the signed-in user's JWT and nothing else. There is no
 * service key in this bundle and no server of ours in the path — the database's
 * row-level security decides what each request can touch, so the worst a stolen
 * copy of this code can do is ask the database questions it will refuse.
 *
 * Deliberately no Node runtime to keep alive: the only moving parts are Neon's
 * own, which is what makes this survive a platform bumping its runtime versions
 * underneath us.
 */

const BYTEA_PREFIX = '\\x';

/** Postgres `bytea` crosses JSON as a hex string, both directions. */
export function bytesToHex(bytes) {
  let out = BYTEA_PREFIX;
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex) {
  const body = hex.startsWith(BYTEA_PREFIX) ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.substr(i * 2, 2), 16);
  return out;
}

export class NeonTransport {
  /** @param auth a CloudAuth — asked for a fresh token on every request. */
  constructor(auth, { baseUrl = deriveUrls().dataApi } = {}) {
    this.auth = auth;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.playerId = null;
  }

  /**
   * One Data API call, asked again while the database is waking.
   *
   * The token is fetched once, outside the retry: `accessToken` does its own
   * waiting, and nesting the two would turn a genuinely dead service into
   * sixteen attempts and a quarter of a minute of a spinner.
   */
  async request(path, { method = 'GET', body, prefer } = {}) {
    const token = await this.auth.accessToken();
    if (!token) throw new Error('Sign in to sync worlds to the cloud.');
    try {
      return await keepTrying(() => this.send(path, { method, body, prefer, token }));
    } catch (err) {
      // Same reasoning as the token call: the readable sentence goes on the
      // card, the technical one folds up underneath it.
      console.error('[duilt] data request failed', method, path, err);
      if (!err.detail) err.detail = describeFailure(err, `${method} ${path.split('?')[0]}`);
      throw err;
    }
  }

  async send(path, { method, body, prefer, token }) {
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // The status rides along on the error: without it the retry cannot tell
      // "not ready yet" from "no, and it will still be no in a second".
      const err = new Error(describeError(res.status, detail));
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /**
   * Finds or creates this account's player row. Everything else hangs off it,
   * and RLS resolves ownership through it, so it has to exist before any write.
   */
  async ensurePlayer() {
    if (this.playerId) return this.playerId;
    const me = this.auth.summary();
    if (!me) throw new Error('Sign in to sync worlds to the cloud.');

    const existing = await this.request(`/players?select=id&limit=1`);
    if (existing?.length) {
      this.playerId = existing[0].id;
      return this.playerId;
    }

    // device_key is still the local install's id: it is not an identity, but it
    // is a useful record of which browser a cloud account was first opened from.
    const created = await this.request('/players', {
      method: 'POST',
      prefer: 'return=representation',
      body: [{
        device_key: deviceKey(),
        auth_user_id: me.id,
        display_name: me.name || me.email || null,
      }],
    });
    this.playerId = created[0].id;
    return this.playerId;
  }

  async listWorlds() {
    await this.ensurePlayer();
    const rows = await this.request(
      '/worlds?select=id,name,mode,block_count,revision,updated_at&deleted_at=is.null&order=updated_at.desc',
    );
    return (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      mode: r.mode,
      blockCount: r.block_count,
      revision: Number(r.revision),
      updatedAt: Date.parse(r.updated_at),
    }));
  }

  /**
   * Upserts the world row and only the chunks SyncEngine says changed. A world
   * the size of the current one is ~16 chunks; editing one corner uploads one.
   */
  async pushWorld({ worldId, meta, chunks }) {
    const playerId = await this.ensurePlayer();
    const now = new Date().toISOString();

    await this.request('/worlds?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{
        id: worldId,
        player_id: playerId,
        name: meta.name,
        mode: meta.mode,
        size_x: meta.sizeX,
        size_z: meta.sizeZ,
        height: meta.height,
        spawn: meta.spawn ?? null,
        economy: meta.economy ?? {},
        block_count: meta.blockCount ?? 0,
        revision: meta.revision ?? 1,
        updated_at: now,
        deleted_at: null, // pushing to a soft-deleted world brings it back
      }],
    });

    if (chunks.length) {
      await this.request('/world_chunks?on_conflict=world_id,cx,cz', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: chunks.map((c) => ({
          world_id: worldId,
          cx: c.cx,
          cz: c.cz,
          rle: bytesToHex(c.bytes),
          revision: meta.revision ?? 1,
          updated_at: now,
        })),
      });
    }
    return { revision: meta.revision ?? 1 };
  }

  async pullWorld(worldId) {
    await this.ensurePlayer();
    const worlds = await this.request(`/worlds?select=*&id=eq.${worldId}&limit=1`);
    if (!worlds?.length) return null;
    const w = worlds[0];
    const rows = await this.request(`/world_chunks?select=cx,cz,rle&world_id=eq.${worldId}`);
    return {
      meta: {
        id: w.id,
        name: w.name,
        mode: w.mode,
        sizeX: w.size_x,
        sizeZ: w.size_z,
        height: w.height,
        spawn: w.spawn,
        economy: w.economy,
        blockCount: w.block_count,
        revision: Number(w.revision),
      },
      chunks: (rows || []).map((r) => ({ cx: r.cx, cz: r.cz, bytes: hexToBytes(r.rle) })),
    };
  }

  /**
   * Soft delete. The row stays so a mistaken tap is recoverable, and the chunks
   * go immediately because they are the bulk of the storage.
   */
  async deleteWorld(worldId) {
    await this.ensurePlayer();
    await this.request(`/worlds?id=eq.${worldId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { deleted_at: new Date().toISOString() },
    });
    await this.request(`/world_chunks?world_id=eq.${worldId}`, { method: 'DELETE', prefer: 'return=minimal' });
  }

  /** Progression is per account, not per world, so it is written on its own. */
  async pushProgression(progression) {
    const playerId = await this.ensurePlayer();
    await this.request('/progression?on_conflict=player_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{
        player_id: playerId,
        xp: progression.xp ?? 0,
        level: progression.level ?? 1,
        streak_count: progression.streak ?? 0,
        last_play_date: progression.lastPlayDate ?? null,
        achievements: progression.achievements ?? [],
        stats: progression.stats ?? {},
        updated_at: new Date().toISOString(),
      }],
    });
  }

  async pullProgression() {
    await this.ensurePlayer();
    const rows = await this.request('/progression?select=*&limit=1');
    return rows?.length ? rows[0] : null;
  }
}

function describeError(status, detail) {
  if (status === 401 || status === 403) return 'Your session expired — sign in again.';
  if (status === 409) return 'That world changed elsewhere. Reload it before saving again.';
  if (status >= 500) return 'The cloud is unreachable right now. Your local save is untouched.';
  return `Cloud request failed (${status}). ${detail.slice(0, 160)}`;
}

const DEVICE_KEY = 'voxelgame:device-key';

function deviceKey() {
  let key = localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}
