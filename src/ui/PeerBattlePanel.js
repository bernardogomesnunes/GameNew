import { PeerBattle } from '../net/PeerBattle.js';

/** Battle-only manual signalling UI. It never sends codes to another person;
 * the user copies the invitation and answer through their chosen channel. */
export class PeerBattlePanel {
  constructor({isBattle,getSnapshot,onSnapshot,onEditRequest,onEdits,onPosition,onPeer=()=>{},onStatus=null,createPeer=null}) {
    Object.assign(this,{isBattle,getSnapshot,onSnapshot,onEditRequest,onEdits,onPosition,onPeer,onStatus,createPeer});
    this.peer=null;this.element=null;this.syncing=false;this.busy=false;
  }
  mount() {
    if(this.element)return;
    const dialog=document.createElement('dialog');dialog.className='peer-battle-dialog';
    dialog.setAttribute('aria-label','Invite a friend to Battle');
    dialog.innerHTML=`<style>
.peer-battle-dialog { width:min(520px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;box-sizing:border-box;padding:20px;border:2px solid #98734c;border-radius:14px;background:#fff6e6;color:#3c3025;font:15px/1.45 system-ui,sans-serif;z-index:10000; }
.peer-battle-dialog::backdrop{background:#17110acc;}
.peer-battle-dialog h2{margin:0 0 12px;font-size:22px;}
.peer-battle-dialog p{margin:10px 0;}
.peer-battle-dialog textarea{box-sizing:border-box;width:100%;min-height:88px;resize:vertical;font:12px/1.3 monospace;padding:8px;}
.peer-battle-dialog button{min-height:44px;border:1px solid #98734c;border-radius:6px;padding:8px 12px;background:#f0ddbd;color:#3c3025;cursor:pointer;}
.peer-battle-dialog button:disabled{opacity:.55;cursor:wait;}
.peer-battle-dialog .peer-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;}
.peer-battle-dialog label{display:block;font-weight:600;margin-top:12px;}
.peer-battle-dialog .peer-status{padding:10px;background:#e7e7d0;border-radius:7px;}
.peer-battle-dialog .peer-small{font-size:12px;}
</style>
<h2>Invite a friend to Battle</h2>
<p>Play together in the host’s settlement. The host checks building edits and supplies the materials. One guest can join this invitation.</p>
<p class="peer-small">Direct connection only: both devices must be able to reach each other, usually on the same local network. This uses no relay server; many internet and mobile networks will not connect. Exchange codes only with someone you want to share this world with.</p>
<div class="peer-actions"><button data-peer-host>Create invitation</button><button data-peer-join>Join invitation</button></div>
<label for="peer-battle-input">Paste invitation or answer</label><textarea id="peer-battle-input" data-peer-input spellcheck="false" autocomplete="off" placeholder="Paste a DUILT1 code here"></textarea>
<div class="peer-actions"><button data-peer-answer>Accept guest’s answer</button></div>
<label for="peer-battle-output">Code to give your friend</label><textarea id="peer-battle-output" data-peer-output readonly spellcheck="false" placeholder="Your invitation or answer appears here"></textarea>
<div class="peer-actions"><button data-peer-copy>Copy code</button><button data-peer-sync>Send current host world</button></div>
<p class="peer-status" role="status" aria-live="polite" data-peer-status>Choose Create invitation to host, or paste your friend’s invitation and choose Join invitation.</p>
<p class="peer-small">Guests stay read-only until the initial world is accepted. This session shares building edits and player positions; the host runs the settlement simulation. Leaving ends the connection. The host keeps the main save.</p>
<div class="peer-actions"><button data-peer-disconnect>Disconnect</button><button data-peer-close>Close panel</button></div>`;
    document.body.append(dialog);this.element=dialog;
    const bind=(name,fn)=>dialog.querySelector(`[data-peer-${name}]`).addEventListener('click',()=>this.perform(fn));
    bind('host',async()=>{const peer=this.newPeer();this.output.value=await peer.createOffer();this.message('Give this invitation to your friend. Paste their answer above, then choose Accept guest’s answer.');});
    bind('join',async()=>{const code=this.input.value.trim();if(!code)throw new Error('Paste the host’s invitation first.');const peer=this.newPeer();this.output.value=await peer.acceptOffer(code);this.message('Give this answer to the host. Keep this world open while they accept it.');});
    bind('answer',async()=>{if(!this.peer||this.peer.role!=='host')throw new Error('Create an invitation before accepting an answer.');await this.peer.acceptAnswer(this.input.value.trim());});
    bind('copy',async()=>{if(!this.output.value)throw new Error('Create an invitation or answer first.');try{await navigator.clipboard.writeText(this.output.value);this.message('Code copied. Send it to your friend.');}catch{this.output.focus();this.output.select();this.message('Select and copy the code with your device’s copy command.');}});
    bind('sync',()=>this.sendWorld());
    bind('disconnect',()=>{this.peer?.dispose();this.onPeer(null);this.peer=null;});
    bind('close',()=>this.close());
    dialog.addEventListener('close',()=>this.onStatus?.({state:'panel-closed'}));
  }
  get input(){return this.element.querySelector('[data-peer-input]');}
  get output(){return this.element.querySelector('[data-peer-output]');}
  message(text){if(this.element)this.element.querySelector('[data-peer-status]').textContent=String(text);}
  async perform(fn) {
    if(this.busy)return;this.busy=true;this.buttons();
    try{await fn();}catch(error){this.message(error?.message??'The connection could not be completed.');}
    finally{this.busy=false;this.buttons();}
  }
  buttons() {
    if(!this.element)return;
    for(const button of this.element.querySelectorAll('button'))button.disabled=this.busy;
    this.element.querySelector('[data-peer-sync]').disabled=this.busy||this.peer?.role!=='host'||!this.peer?.connected;
    this.element.querySelector('[data-peer-answer]').disabled=this.busy||this.peer?.role!=='host';
  }
  newPeer() {
    if(!this.isBattle?.())throw new Error('Open or create a Battle world before inviting a friend.');
    this.peer?.dispose();this.syncing=false;
    const callbacks={onSnapshot:this.onSnapshot,onEditRequest:this.onEditRequest,onEdits:this.onEdits,onPosition:this.onPosition,
      onStatus:status=>{this.message(status.reason??status.state.replaceAll('-',' '));this.buttons();this.onStatus?.(status);
        if(status.state==='connected'&&this.peer?.role==='host')this.sendWorld().catch(error=>this.message(error.message));}};
    this.peer=this.createPeer?this.createPeer(callbacks):new PeerBattle(callbacks);
    this.onPeer(this.peer);this.buttons();return this.peer;
  }
  async sendWorld() {
    if(this.syncing)return;
    if(!this.peer||this.peer.role!=='host'||!this.peer.connected)throw new Error('Connect a guest before sending the host world.');
    if(!this.getSnapshot)throw new Error('This host cannot export its Battle world.');
    this.syncing=true;
    try{await this.peer.sendSnapshot(await this.getSnapshot());}
    finally{this.syncing=false;this.buttons();}
  }
  open() {
    if(!this.isBattle?.())return false;
    this.mount();if(!this.element.open)this.element.showModal();this.buttons();return true;
  }
  close(){this.element?.close();}
  dispose(){this.peer?.dispose();this.peer=null;this.onPeer(null);this.element?.remove();this.element=null;}
}
