/**
 * One open session per world (owner, 9 November): "we should have the same
 * game open in all devices. We can deal with opening the world at the same
 * time gracefully, by telling the user if another session is open, if the
 * user wants to proceed we will close that another session."
 *
 * Each browser tab gets its own id. Opening a world reads who has it open
 * (`check`); taking it writes this tab's id (`claim`); a heartbeat (`beat`)
 * keeps it fresh and is how a tab learns another one took the world over.
 * The table lives in migrations/0007. Where it is missing, every call says
 * "unknown" and the game goes on as it did before.
 */

/** A session not heard from in this long is gone: its tab closed or slept. */
export const SESSION_FRESH_MS = 75_000;
/** How often an open world says it is still open. */
export const HEARTBEAT_MS = 25_000;

function newId() {
  try { return crypto.randomUUID(); } catch { return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
}

/** A short name for this device, shown to the other one: "iPhone", "Windows", ... */
export function describeDevice(ua = globalThis.navigator?.userAgent ?? '') {
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows computer' : /Linux/.test(ua) ? 'Linux computer' : 'another device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${kind}, ${browser}` : kind;
}

export class WorldSession {
  /**
   * @param transport  NeonTransport (readWorldSession, claimWorldSession,
   *                   touchWorldSession, releaseWorldSession)
   */
  constructor({ transport, now = () => Date.now(), id = newId(), device = describeDevice() } = {}) {
    this.transport = transport;
    this.now = now;
    this.id = id;
    this.device = device;
    this.worldId = null;
  }

  /**
   * Who else has `worldId` open now: { device, secondsAgo } or null. Null
   * also when it cannot be told (no table, no answer): opening is never
   * blocked on this.
   */
  async check(worldId) {
    let row;
    try { row = await this.transport.readWorldSession(worldId); } catch { return null; }
    if (!row || row.session_id === this.id) return null;
    const ago = this.now() - Date.parse(row.seen_at);
    if (!(ago < SESSION_FRESH_MS)) return null;
    return { device: row.device || 'another device', secondsAgo: Math.max(0, Math.round(ago / 1000)) };
  }

  /** Takes `worldId` for this tab. Any other tab's next beat finds it gone. */
  async claim(worldId) {
    this.worldId = worldId;
    try { await this.transport.claimWorldSession(worldId, { sessionId: this.id, device: this.device }); return true; } catch { return false; }
  }

  /**
   * Says this tab still has its world open. 'mine' when it does, 'lost' when
   * another tab took it over, 'unknown' when it cannot be told.
   */
  async beat() {
    if (!this.worldId) return 'unknown';
    let r;
    try { r = await this.transport.touchWorldSession(this.worldId, this.id); } catch { return 'unknown'; }
    return r === true ? 'mine' : r === false ? 'lost' : 'unknown';
  }

  /** Lets the world go, so the next device to open it is not asked. */
  async release() {
    const worldId = this.worldId;
    this.worldId = null;
    if (!worldId) return;
    try { await this.transport.releaseWorldSession(worldId, this.id); } catch { /* it goes stale by itself */ }
  }
}
