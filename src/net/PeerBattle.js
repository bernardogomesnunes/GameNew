import { BLOCKS_BY_ID } from '../config/blocks.js';
import { MAX_WORLD_FILE_BYTES, validateWorldImport } from '../storage/WorldImportValidation.js';

export const PEER_LIMITS = Object.freeze({snapshotBytes:MAX_WORLD_FILE_BYTES,frameBytes:16384,bufferBytes:524288,editCells:32,requestsPerSecond:8,positionsPerSecond:10,inviteBytes:131072});
const VERSION=1,LABEL='duilt-battle-v1',MAGIC=0x44554c54;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const validNumber=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const fail=message=>{throw new Error(message);};

export function encodeInvitation(description,session) {
  const bytes=encoder.encode(JSON.stringify({v:VERSION,session,description:{type:description.type,sdp:description.sdp}}));
  if(bytes.length>PEER_LIMITS.inviteBytes)fail('Invitation is too large.');
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return 'DUILT1.'+btoa(binary);
}
export function decodeInvitation(code,expectedType) {
  if(typeof code!=='string'||code.length>PEER_LIMITS.inviteBytes*2||!code.trim().startsWith('DUILT1.'))fail('Paste a Duilt invitation code.');
  let value;
  try { const binary=atob(code.trim().slice(7));value=JSON.parse(decoder.decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))); }
  catch { fail('That invitation code is damaged or incomplete.'); }
  if(value?.v!==VERSION||typeof value.session!=='string'||value.session.length>80||!value.session.length||value.description?.type!==expectedType||typeof value.description.sdp!=='string'||value.description.sdp.length>PEER_LIMITS.inviteBytes)fail('That code is for a different connection step or game version.');
  return value;
}
export function validateEditCells(cells) {
  if(!Array.isArray(cells)||!cells.length||cells.length>PEER_LIMITS.editCells)fail('Send between 1 and 32 edited cells.');
  const seen=new Set();
  return cells.map(c=>{
    if(!c||![c.x,c.z].every(n=>integer(n,-16777200,16777200))||!integer(c.y,0,511)||!integer(c.next,0,65535)||c.next!==0&&!BLOCKS_BY_ID.has(c.next)||BLOCKS_BY_ID.get(c.next)?.system||!integer(c.prev,0,65535)||c.prev!==0&&!BLOCKS_BY_ID.has(c.prev))fail('Invalid world edit.');
    const key=`${c.x},${c.y},${c.z}`;if(seen.has(key))fail('An edit contains the same cell twice.');seen.add(key);
    return {x:c.x,y:c.y,z:c.z,prev:c.prev,next:c.next};
  });
}
function positionOf(p) {
  if(!p||![p.x,p.z].every(n=>validNumber(n,-16777200,16777200))||!validNumber(p.y,-4096,4096)||!validNumber(p.yaw??0,-10000,10000)||!validNumber(p.pitch??0,-Math.PI,Math.PI))fail('Invalid player position.');
  return {x:p.x,y:p.y,z:p.z,yaw:p.yaw??0,pitch:p.pitch??0};
}
function validateSnapshot(payload) {
  if(!payload||payload.format!=='voxel-sandbox-world'||payload.mode!=='duilt'||!payload.duilt?.battle)fail('Share a Battle world snapshot.');
  validateWorldImport(payload);
}
function snapshotText(payload) {
  validateSnapshot(payload);
  const text=JSON.stringify(payload),bytes=encoder.encode(text);
  if(bytes.length>PEER_LIMITS.snapshotBytes)fail('This snapshot exceeds the 128 MB connection limit.');
  return bytes;
}

/** One host and one invited guest, over a direct reliable encrypted RTC channel.
 * No signalling service, STUN, TURN, account or API key is contacted. */
export class PeerBattle {
  constructor({onSnapshot=null,onEditRequest=null,onEdits=null,onPosition=null,onStatus=null,RTCPeerConnectionClass=globalThis.RTCPeerConnection,now=()=>performance.now()}={}) {
    Object.assign(this,{onSnapshot,onEditRequest,onEdits,onPosition,onStatus,RTCPeerConnectionClass,now});
    this.role=null;this.ready=false;this.connected=false;this.disposed=false;
    this.pc=null;this.channel=null;this.session=null;this.revision=0;this.requestId=0;
    this.pending=new Map();this.timers=new Set();this._sendChain=Promise.resolve();this._receiveChain=Promise.resolve();this._rates=new Map();this.lastPosition=-Infinity;this.incoming=null;this.outgoing=null;this.lastGuestRequest=0;this.abort=new AbortController();
  }
  status(state,reason=null) { this.onStatus?.({state,reason,role:this.role,ready:this.ready,connected:this.connected}); }
  timer(fn,ms){const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
  clearTimer(id){clearTimeout(id);this.timers.delete(id);}
  createConnection(role) {
    if(this.disposed)fail('This connection has been closed. Create a new invitation.');
    if(this.pc)fail('A connection already exists. Disconnect before creating another.');
    if(!this.RTCPeerConnectionClass)fail('This browser does not support direct multiplayer.');
    this.role=role;this.pc=new this.RTCPeerConnectionClass({iceServers:[]});
    this.pc.onconnectionstatechange=()=>{
      const state=this.pc?.connectionState;
      if(state==='failed')this.closeWithError('The direct connection failed. Both players must be on a reachable LAN or direct network.');
      else if(state==='disconnected'){this.status('disconnected','Connection interrupted; waiting to reconnect.');this.timer(()=>{if(this.pc?.connectionState==='disconnected')this.dispose();},10000);}
    };
    this.status('connecting');return this.pc;
  }
  async gather() {
    if(this.pc.iceGatheringState==='complete')return;
    await new Promise((resolve,reject)=>{
      const pc=this.pc;
      const cleanup=()=>{pc.removeEventListener('icegatheringstatechange',changed);this.abort.signal.removeEventListener('abort',aborted);this.clearTimer(timeout);};
      const aborted=()=>{cleanup();reject(new Error('The multiplayer connection closed.'));};
      const changed=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve();}};
      const timeout=this.timer(()=>{cleanup();reject(new Error('Direct connection discovery timed out. Try again.'));},15000);
      pc.addEventListener('icegatheringstatechange',changed);this.abort.signal.addEventListener('abort',aborted,{once:true});changed();
    });
  }
  async createOffer() {
    const pc=this.createConnection('host');this.session=crypto.randomUUID();
    this.attachChannel(pc.createDataChannel(LABEL,{ordered:true}));
    await pc.setLocalDescription(await pc.createOffer());await this.gather();
    this.status('invite-ready');return encodeInvitation(pc.localDescription,this.session);
  }
  async acceptOffer(code) {
    const invite=decodeInvitation(code,'offer'),pc=this.createConnection('guest');this.session=invite.session;
    pc.ondatachannel=event=>{if(event.channel.label!==LABEL||this.channel){event.channel.close();return;}this.attachChannel(event.channel);};
    await pc.setRemoteDescription(invite.description);await pc.setLocalDescription(await pc.createAnswer());await this.gather();
    this.status('answer-ready');return encodeInvitation(pc.localDescription,this.session);
  }
  async acceptAnswer(code) {
    if(this.role!=='host'||!this.pc)fail('Create an invitation first.');
    const answer=decodeInvitation(code,'answer');if(answer.session!==this.session)fail('That answer belongs to a different invitation.');
    await this.pc.setRemoteDescription(answer.description);this.status('connecting');
  }
  attachChannel(channel) {
    this.channel=channel;channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=PEER_LIMITS.bufferBytes/2;
    channel.onopen=()=>{this.connected=true;this.status('connected','Connected. Waiting for the host world to synchronise.');};
    channel.onclose=()=>this.dispose();
    channel.onerror=()=>this.closeWithError('The multiplayer connection stopped.');
    channel.onmessage=event=>{this._receiveChain=this._receiveChain.then(()=>this.receive(event.data)).catch(error=>this.closeWithError(error.message));};
  }
  rate(name,max) {
    const time=this.now(),times=(this._rates.get(name)??[]).filter(t=>time-t<1000);
    if(times.length>=max)return false;times.push(time);this._rates.set(name,times);return true;
  }
  async drain() {
    if(!this.connected||this.channel?.readyState!=='open'||this.disposed)fail('The multiplayer connection is not open.');
    if(this.channel.bufferedAmount<=PEER_LIMITS.bufferBytes)return;
    await new Promise((resolve,reject)=>{
      const channel=this.channel;
      const cleanup=()=>{channel.removeEventListener('bufferedamountlow',low);channel.removeEventListener('close',closed);this.abort.signal.removeEventListener('abort',closed);this.clearTimer(timeout);};
      const low=()=>{cleanup();resolve();},closed=()=>{cleanup();reject(new Error('The multiplayer connection closed during transfer.'));};
      const timeout=this.timer(()=>{cleanup();reject(new Error('The multiplayer transfer stalled.'));},15000);
      channel.addEventListener('bufferedamountlow',low);channel.addEventListener('close',closed);this.abort.signal.addEventListener('abort',closed,{once:true});
      if(channel.bufferedAmount<=channel.bufferedAmountLowThreshold)low();
    });
  }
  queueSend(fn) {
    const task=this._sendChain.then(fn);this._sendChain=task.catch(()=>{});return task;
  }
  async send(message){await this.drain();this.channel.send(JSON.stringify({v:VERSION,...message}));}

  async sendSnapshot(payload) {
    if(this.role!=='host')fail('Only a host can send a Battle snapshot.');
    if(this.outgoing)fail('A world snapshot is already being sent.');
    if(!this.connected)fail('Connect a guest before sending the host snapshot.');
    const bytes=snapshotText(payload),transfer=crypto.randomUUID();let revision=this.revision;
    this.ready=false;this.outgoing={transfer,revision};this.status('syncing','Sending the host world. Guest edits stay locked until it is accepted.');
    try {
      await this.queueSend(async()=>{
        revision=this.revision;this.outgoing.revision=revision;
        await this.send({kind:'snapshot-start',transfer,revision,bytes:bytes.length,parts:Math.ceil(bytes.length/PEER_LIMITS.frameBytes)});
        for(let index=0,offset=0;offset<bytes.length;index++,offset+=PEER_LIMITS.frameBytes) {
          const slice=bytes.subarray(offset,Math.min(bytes.length,offset+PEER_LIMITS.frameBytes));
          const frame=new Uint8Array(12+slice.length),view=new DataView(frame.buffer);
          view.setUint32(0,MAGIC);view.setUint32(4,index);view.setUint32(8,slice.length);frame.set(slice,12);
          await this.drain();this.channel.send(frame.buffer);
        }
        await this.send({kind:'snapshot-end',transfer});
      });
      this.timer(()=>{if(this.outgoing?.transfer===transfer)this.closeWithError('The guest did not accept the world snapshot in time.');},60000);
    } catch(error){this.outgoing=null;throw error;}
  }
  sendEditRequest(cells) {
    if(this.role!=='guest'||!this.connected||!this.ready||this.disposed)fail('Wait until the host world has synchronised before editing.');
    const changes=validateEditCells(cells);
    if(!this.rate('send-edits',PEER_LIMITS.requestsPerSecond))return Promise.resolve({ok:false,reason:'Too many edits at once. Try again in a moment.'});
    const requestId=++this.requestId;
    return new Promise((resolve,reject)=>{
      const timeout=this.timer(()=>{this.pending.delete(requestId);reject(new Error('The host did not answer the edit request.'));},15000);
      this.pending.set(requestId,{resolve,reject,timeout});
      this.queueSend(()=>this.send({kind:'edit-request',requestId,baseRevision:this.revision,cells:changes})).catch(error=>{this.pending.delete(requestId);this.clearTimer(timeout);reject(error);});
    });
  }
  broadcastEdits(cells) {
    if(this.role!=='host'||!this.connected||this.disposed)return Promise.resolve(false);
    if(!Array.isArray(cells)||cells.length>32768)fail('Too many edits to broadcast. Send a new snapshot.');
    const batches=[];for(let i=0;i<cells.length;i+=PEER_LIMITS.editCells)batches.push(validateEditCells(cells.slice(i,i+PEER_LIMITS.editCells)));
    return this.queueSend(async()=>{for(const changes of batches)await this.send({kind:'edits',revision:++this.revision,cells:changes});return true;});
  }
  updatePosition(position) {
    if(!this.ready||!this.connected||this.disposed||this.now()-this.lastPosition<150)return false;
    const value=positionOf(position);this.lastPosition=this.now();
    this.queueSend(()=>this.send({kind:'position',position:value})).catch(()=>{});return true;
  }

  watchIncoming(incoming) {
    incoming.timer=this.timer(()=>{
      if(this.incoming!==incoming)return;
      if(this.now()-incoming.lastFrame>=60000)this.closeWithError('The host world transfer stalled. Reconnect to try again.');
      else this.watchIncoming(incoming);
    },30000);
  }

  async receive(data) {
    if(this.disposed)return;
    if(typeof data!=='string') {
      if(this.role!=='guest'||!this.incoming||!(data instanceof ArrayBuffer)||data.byteLength<12||data.byteLength>PEER_LIMITS.frameBytes+12)fail('Unexpected world transfer frame.');
      const view=new DataView(data),incoming=this.incoming,size=view.getUint32(8);
      if(view.getUint32(0)!==MAGIC||view.getUint32(4)!==incoming.index||size!==data.byteLength-12||size!==Math.min(PEER_LIMITS.frameBytes,incoming.bytes.length-incoming.offset))fail('World transfer frames are incomplete or out of order.');
      incoming.bytes.set(new Uint8Array(data,12),incoming.offset);incoming.offset+=size;incoming.index++;incoming.lastFrame=this.now();
      return;
    }
    if(data.length>65536)fail('Multiplayer message is too large.');
    const message=JSON.parse(data);
    if(message?.v!==VERSION||typeof message.kind!=='string')fail('Unsupported multiplayer message.');
    switch(message.kind) {
      case 'snapshot-start': {
        if(this.role!=='guest'||this.incoming||!integer(message.bytes,1,PEER_LIMITS.snapshotBytes)||!integer(message.parts,1,Math.ceil(PEER_LIMITS.snapshotBytes/PEER_LIMITS.frameBytes))||message.parts!==Math.ceil(message.bytes/PEER_LIMITS.frameBytes)||!integer(message.revision,0,Number.MAX_SAFE_INTEGER)||typeof message.transfer!=='string'||message.transfer.length>80)fail('Invalid world transfer header.');
        this.ready=false;this.incoming={transfer:message.transfer,revision:message.revision,parts:message.parts,bytes:new Uint8Array(message.bytes),offset:0,index:0,lastFrame:this.now(),timer:null};
        this.watchIncoming(this.incoming);
        this.status('syncing','Receiving the host world. Editing is read-only until synchronisation finishes.');break;
      }
      case 'snapshot-end': {
        const incoming=this.incoming;
        if(this.role!=='guest'||!incoming||message.transfer!==incoming.transfer||incoming.offset!==incoming.bytes.length||incoming.index!==incoming.parts)fail('The world transfer is incomplete.');
        const text=decoder.decode(incoming.bytes),payload=JSON.parse(text);
        validateSnapshot(payload);
        if(!this.onSnapshot)fail('The guest cannot load the shared world.');
        const accepted=await this.onSnapshot(payload,{revision:incoming.revision});
        if(accepted===false)fail('The shared world was not accepted.');
        this.revision=incoming.revision;this.clearTimer(incoming.timer);this.incoming=null;this.ready=true;
        await this.send({kind:'snapshot-accepted',transfer:incoming.transfer,revision:this.revision});this.status('ready','World synchronised. The host checks and pays for shared building edits.');break;
      }
      case 'snapshot-accepted': {
        if(this.role!=='host'||!this.outgoing||message.transfer!==this.outgoing.transfer||message.revision!==this.outgoing.revision)fail('Unexpected world synchronisation acknowledgement.');
        this.outgoing=null;this.ready=true;this.status('ready','Guest synchronised. Shared building edits use the host settlement inventory.');break;
      }
      case 'edit-request': {
        if(this.role!=='host')fail('Only the host can receive edit requests.');
        if(!integer(message.requestId,1,Number.MAX_SAFE_INTEGER)||!integer(message.baseRevision,0,Number.MAX_SAFE_INTEGER))fail('Invalid edit request identifier.');
        const cells=validateEditCells(message.cells);
        let result;
        if(message.requestId<=this.lastGuestRequest)fail('A multiplayer edit request was replayed.');
        this.lastGuestRequest=message.requestId;
        if(!this.ready)result={ok:false,reason:'The host is synchronising the world. Wait, then try again.'};
        else if(!this.rate('receive-edits',PEER_LIMITS.requestsPerSecond))result={ok:false,reason:'Too many requests. Try again in a moment.'};
        else if(message.baseRevision!==this.revision)result={ok:false,reason:'The world changed. Wait for it to catch up, then try again.'};
        else result=await this.onEditRequest?.(cells,{requestId:message.requestId,baseRevision:message.baseRevision})??{ok:false,reason:'The host has not enabled shared editing.'};
        if(result.ok)await this.broadcastEdits(result.changes??cells);
        await this.send({kind:'edit-result',requestId:message.requestId,ok:!!result.ok,reason:String(result.reason??'').slice(0,256)});break;
      }
      case 'edits': {
        if(this.role!=='guest'||!this.ready||!integer(message.revision,1,Number.MAX_SAFE_INTEGER)||message.revision!==this.revision+1)fail('World edits are out of sequence. Reconnect to synchronise again.');
        const cells=validateEditCells(message.cells);if(!this.onEdits)fail('The guest cannot apply shared world edits.');
        if(await this.onEdits(cells,{revision:message.revision})===false)fail('The guest could not apply the host world edit.');
        this.revision=message.revision;break;
      }
      case 'edit-result': {
        if(this.role!=='guest'||typeof message.ok!=='boolean'||typeof message.reason!=='string'||message.reason.length>256)fail('Invalid edit response.');
        const pending=this.pending.get(message.requestId);if(!pending)break;
        this.pending.delete(message.requestId);this.clearTimer(pending.timeout);pending.resolve({ok:message.ok,reason:message.reason});break;
      }
      case 'position': {
        if(!this.ready||!this.rate('receive-position',PEER_LIMITS.positionsPerSecond))break;
        this.onPosition?.(positionOf(message.position),{role:this.role==='host'?'guest':'host'});break;
      }
      default: fail('Unknown multiplayer message.');
    }
  }
  closeWithError(reason){if(this.disposed)return;this.dispose();this.status('error',String(reason).slice(0,256));}
  dispose() {
    if(this.disposed)return;this.disposed=true;this.ready=false;this.connected=false;this.abort.abort();
    for(const id of this.timers)clearTimeout(id);this.timers.clear();
    for(const pending of this.pending.values())pending.reject(new Error('The multiplayer connection closed.'));
    this.pending.clear();this.incoming=null;this.outgoing=null;
    const channel=this.channel,pc=this.pc;this.channel=null;this.pc=null;
    if(channel){channel.onclose=null;channel.onmessage=null;channel.onopen=null;channel.onerror=null;try{channel.close();}catch{}}
    if(pc){pc.onconnectionstatechange=null;pc.ondatachannel=null;try{pc.close();}catch{}}
    this.status('closed','Disconnected. The host keeps the authoritative world.');
  }
}
