/**
 * The local half of saving: a world with nowhere else to live.
 *
 * Cloud sync only ever made sense as something you turn on — the same
 * settlement following you from a phone to a desktop. It should never have
 * been the price of playing at all, but for a while it was: SaveManager was
 * deleted outright, on the reasoning that reconciling a browser's copy of a
 * world with an account's copy of the *same* world has no good answer. That
 * reasoning was correct — and it does not apply here. A world is either
 * signed-in-and-cloud or signed-out-and-local, decided once at HomeScreen's
 * naming step (see whereToLive) and never both, so there is never a second
 * copy of the same world to reconcile in the first place. Two disjoint
 * libraries need no merging, only listing together.
 *
 * Modern browsers store owned binary chunks through a background worker in
 * IndexedDB. The small legacy library remains readable until replacement
 * commits; environments without IndexedDB retain the synchronous old path.
 */

import {captureWorldSnapshot} from './WorldSnapshot.js';
import {LocalWorldWorker} from './LocalWorldWorker.js';

const INDEX_KEY = 'voxelgame:local:index';
const PROGRESSION_KEY = 'voxelgame:local:progression';
const worldKey = (id) => `voxelgame:local:world:${id}`;

export class LocalWorlds {
  constructor({workerFactory}={}) {
    this.rows=[];
    if(typeof indexedDB!=='undefined'){
      this.store=new LocalWorldWorker(workerFactory);
      this.ready=this.refresh();
      // A browser may deny persistent storage. The UI's awaited refresh/save
      // reports it; merely constructing the library must not crash startup.
      this.ready.catch(()=>{});
    }
  }
  async refresh(){
    if(this.store){
      try{this.rows=await this.store.request('list');this.storageError=null;}
      catch(error){this.storageError=error;if(!readIndex().length)throw error;}
    }
    return this.list();
  }
  /** Every world this browser holds, newest first — what the worlds screen lists. */
  list() {
    const rows=new Map(readIndex().map(row=>[row.id,row]));
    for(const row of this.rows)if(!rows.has(row.id)||(rows.get(row.id).updatedAt??0)<=row.updatedAt)rows.set(row.id,row);
    return [...rows.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  /** Whether an id lives here at all, without paying for the full payload. */
  has(id) {
    return this.list().some((w) => w.id === id);
  }

  /**
   * Writes atomically. IndexedDB returns a promise for the actual commit;
   * the legacy fallback returns the same revision object synchronously.
   */
  save(id, { world, name, mode, player, duilt, economy, territoryBounds, revision } = {}, emergency=false) {
    const background=this.store&&!this.storageError&&!emergency;
    this.lastStamp=Math.max(Date.now(),(this.lastStamp??0)+1);
    const payload = {
      world: background?captureWorldSnapshot(world,territoryBounds):world.serialize({ keepBounds: territoryBounds }),
      mode,
      name: name || 'Untitled world',
      player: player
        ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch }
        : null,
      duilt: duilt ?? null,
      economy: economy?.toJSON?.() ?? {},
      updatedAt: this.lastStamp,
      revision: revision ?? Date.now(),
    };
    if(background){
      // JSON game metadata is small; detach it from live mutable simulation
      // state before it joins a pending worker operation.
      const owned={...structuredClone({...payload,world:null}),world:payload.world};
      return this.store.request('save',{id,payload:owned}).then(result=>{
        this.rows=this.rows.filter(row=>row.id!==id);this.rows.push(result.meta);
        // A replacement is authoritative only after the IndexedDB commit.
        try{
          const index=readIndex();
          if(!index.some(row=>row.id===id&&row.updatedAt>result.meta.updatedAt)
            &&!(readLegacy(id)?.updatedAt>result.meta.updatedAt)){
            localStorage.removeItem(worldKey(id));writeIndex(index.filter(row=>row.id!==id));
          }
        }catch{}
        return{revision:result.revision};
      });
    }
    try {
      localStorage.setItem(worldKey(id), JSON.stringify(payload));
    } catch {
      // Almost always the quota, not a fluke — say so plainly rather than
      // leaving a save that silently didn't happen.
      throw new Error('This browser is full. Sign in to keep your worlds in your account, or delete a world you don\'t need.');
    }
    const index = readIndex().filter((w) => w.id !== id);
    index.push({
      id, name: payload.name, mode: payload.mode,
      age: duilt?.territory?.age ?? null,
      ...(duilt?.battle ? { battle: true } : {}),
      updatedAt: payload.updatedAt,
    });
    writeIndex(index);
    return { revision: payload.revision };
  }

  // Browsers may stop workers during navigation or mobile suspension. Retain
  // the old synchronous best-effort checkpoint on those lifecycle events.
  // Normal gameplay saves never use this potentially expensive path.
  saveEmergency(id,state){
    const result=this.save(id,state,true);
    if(state.gamification)this.saveProgression(state.gamification.toJSON?.()??state.gamification);
    return result;
  }

  /** The full payload back, or throws — the same contract CloudWorlds.restore keeps. */
  restore(id) {
    const modern=this.rows.find(row=>row.id===id),payload=readLegacy(id);
    if(this.store&&modern&&(!payload||(payload.updatedAt??0)<=modern.updatedAt))return this.store.request('load',{id});
    if (!payload) throw new Error('That world is no longer saved in this browser.');
    return payload;
  }

  delete(id,{ifUnchangedSince=null}={}) {
    const newer=()=>ifUnchangedSince!==null&&(this.list().some(row=>row.id===id&&row.updatedAt>ifUnchangedSince)
      ||readLegacy(id)?.updatedAt>ifUnchangedSince);
    if(newer())return false;
    if(this.store&&this.storageError)throw new Error('Local storage is unavailable. Try deleting the world again when access is restored.');
    if(this.store&&!this.storageError)return this.store.request('delete',{id,ifUnchangedSince}).then(deleted=>{
      if(!deleted||newer())return false;
      this.rows=this.rows.filter(row=>row.id!==id);this.deleteLegacy(id);return true;
    });
    this.deleteLegacy(id);return true;
  }

  deleteLegacy(id){
    try { localStorage.removeItem(worldKey(id)); } catch { /* nothing to remove */ }
    writeIndex(readIndex().filter((w) => w.id !== id));
  }

  /**
   * Level, XP and achievements live outside any one world — CloudWorlds
   * keeps the same split, one row per account rather than one per world
   * (see its own progression()/pushProgression) — so this browser gets one
   * row too, shared by every local world rather than reset each time you
   * open a different one.
   */
  saveProgression(json) {
    try { localStorage.setItem(PROGRESSION_KEY, JSON.stringify(json)); } catch { /* not worth failing the world save over */ }
  }

  loadProgression() {
    try { return JSON.parse(localStorage.getItem(PROGRESSION_KEY) ?? 'null'); } catch { return null; }
  }
}

function readIndex() {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function readLegacy(id){
  try{return JSON.parse(localStorage.getItem(worldKey(id))??'null');}catch{return null;}
}

function writeIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch { /* out of room; the world itself already failed loudly */ }
}
