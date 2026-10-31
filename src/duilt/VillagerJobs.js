import { Inventory } from '../items/Inventory.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../config/items.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';
import { settlerFloor, settlerRoute } from './settlerNavigation.js';
import { isLoaded } from '../world/Mobs.js';

const SPEED = 2.2, ACTION_SECONDS = .8, CARRY_LIMIT = 32;
/**
 * IMP-12: "Build with villagers should show them placing the blocks and take
 * time to be done". A builder swings at each block for BUILD_SECONDS (two
 * blows, SWING_SHOWS each, the arm the people view raises for `strike`)
 * before it goes in. While the game is closed a builder is counted at one
 * block every BLOCK_SECONDS_AWAY (the swing plus a walk between blocks), and
 * those blocks go in when the game is next open (owed).
 */
export const BUILD_SECONDS = 1.6, BLOCK_SECONDS_AWAY = 3;
const SWING_SHOWS = .3;
/** IMP-20: "0.5 faster only": your own building, a block every 1.5 times a builder's. */
export const SELF_BLOCK_SECONDS = BLOCK_SECONDS_AWAY * 1.5;
const centre = r => ({x:(r.minX+r.maxX+1)/2,z:(r.minZ+r.maxZ+1)/2});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const clone = v => JSON.parse(JSON.stringify(v));
const cellKey = c => `${c.x},${c.y},${c.z}`;

/** Real work orders: material escrow belongs to the queue, carried goods to
 * the worker. Neither is paid a second time after loading a saved world. */
export class VillagerJobs {
  constructor({world,settlers,structures,inventory,bus=null,canPlace=null,placeBlock=null,onBuildComplete=null,sources=null}) {
    Object.assign(this,{world,settlers,structures,inventory,bus,canPlace,placeBlock,onBuildComplete,sources});
    this.assignments = new Map();
    this.hallSupplies = new Map();
    this.builds = [];
    this.nextId = 1;
    if (settlers) settlers.jobs = this;
  }

  hall(id) { return this.structures.list().find(s=>s.id===id && s.type==='work_hall' && s.valid); }
  person(id) { return this.settlers.people.find(p=>p.id===id); }
  controls(person) { const a=this.assignments.get(typeof person==='object'?person.id:person); return !!a && a.role!=='automatic'; }
  assignment(personId) { return this.assignments.get(personId) ?? null; }
  supplyForHall(id) {
    if(!this.hallSupplies.has(id)) this.hallSupplies.set(id,new Inventory({slots:40}));
    return this.hallSupplies.get(id);
  }

  assign(personId,role,hallId=null) {
    const p=this.person(personId);
    if(!p) return {ok:false,reason:'That villager no longer lives here.'};
    if(!['builder','hauler','automatic'].includes(role)) return {ok:false,reason:'Choose builder, hauler or automatic work.'};
    if(role!=='automatic' && !this.hall(hallId)) return {ok:false,reason:'Build a working Work Hall first.'};
    const old=this.assignments.get(personId);
    if(old?.carrying && !this.returnCargo(old)) return {ok:false,reason:'Make room for the carried goods before changing this job.'};
    if(role==='automatic') this.assignments.delete(personId);
    else this.assignments.set(personId,{personId,role,hallId,carrying:null,status:'Waiting for work',action:0});
    p.workId=null;p.target=null;p._route=null;p.wait=0;p.atWork=false;
    this.changed();
    return {ok:true};
  }

  deposit(hallId,id,count=Infinity) {
    if(!this.hall(hallId)) return {ok:false,moved:0,reason:'That Work Hall is not working.'};
    const item=ITEMS_BY_ID.get(id);
    if(!item || item.kind==='tool' || item.wears) return {ok:false,moved:0,reason:'Put building materials, food or goods in the supplies.'};
    const stock=this.supplyForHall(hallId);
    const n=Math.min(this.inventory.countOf(id),count,stock.roomFor(id,count));
    if(!Number.isSafeInteger(n)||n<=0)return {ok:false,moved:0,reason:'No room or no supplies to move.'};
    const taken=this.inventory.remove(id,n),left=stock.add(id,taken);
    if(left)this.inventory.add(id,left);
    this.changed();
    return {ok:true,moved:taken-left};
  }

  /** plan.changes uses the same absolute {x,y,z,prev,next} cells as starterPlacement. */
  enqueueBuild(plan,funding=this.inventory,{self=false}={}) {
    if(!self&&!this.structures.list().some(s=>s.type==='work_hall'&&s.valid))return {ok:false,reason:'Build a working Work Hall first.'};
    if(!Array.isArray(plan?.changes)||!plan.changes.length||plan.changes.length>100000)return {ok:false,reason:'Choose a building design to queue.'};
    if(this.builds.filter(j=>j.state==='queued').length>=16)return {ok:false,reason:'Finish or cancel a queued build before adding another.'};
    const unique=new Map();
    for(const c of plan.changes) {
      if(![c.x,c.y,c.z,c.next].every(Number.isSafeInteger)||!this.world.inBounds(c.x,c.y,c.z)||c.next<0||c.next!==0&&!BLOCKS_BY_ID.has(c.next)||BLOCKS_BY_ID.get(c.next)?.system)return {ok:false,reason:'The design contains an invalid block.'};
      if(this.canPlace && !this.canPlace(c,plan))return {ok:false,reason:'The building would cross protected land.'};
      unique.set(cellKey(c),{x:c.x,y:c.y,z:c.z,prev:c.prev??this.world.getBlock(c.x,c.y,c.z),next:c.next});
    }
    const changes=[...unique.values()].sort((a,b)=>a.y-b.y||a.z-b.z||a.x-b.x);
    const keys=new Set(changes.map(cellKey));
    if(this.builds.some(j=>j.state==='queued'&&j.changes.slice(j.cursor).some(c=>keys.has(cellKey(c)))))return {ok:false,reason:'Another building is already queued on that site.'};
    const escrow={};
    for(const c of changes) { const id=ITEM_FOR_BLOCK.get(c.next);if(id)escrow[id]=(escrow[id]??0)+1; }
    if(!funding.hasAll(escrow))return {ok:false,reason:'Collect the full design materials before queuing it.',missing:funding.missing(escrow)};
    if(!funding.spend(escrow))return {ok:false,reason:'Your building materials changed. Try again.'};
    const job={id:this.nextId++,name:plan.name??plan.design?.name??'Building',type:plan.type??plan.design?.structure,designId:plan.designId??plan.design?.id,region:clone(plan.region??this.regionFor(changes)),changes,cursor:0,escrow,state:'queued',reason:null,...(self?{self:true,timer:0}:{})};
    this.builds.push(job);this.changed();return {ok:true,job};
  }

  regionFor(cells) {
    return {minX:Math.min(...cells.map(c=>c.x)),maxX:Math.max(...cells.map(c=>c.x)),minY:Math.min(...cells.map(c=>c.y)),maxY:Math.max(...cells.map(c=>c.y)),minZ:Math.min(...cells.map(c=>c.z)),maxZ:Math.max(...cells.map(c=>c.z))};
  }
  refund(job) {
    for(const [id,n] of Object.entries(job.escrow)) { const left=this.inventory.add(id,n);if(left)job.escrow[id]=left;else delete job.escrow[id]; }
    return !Object.keys(job.escrow).length;
  }
  cancelBuild(id) {
    const job=this.builds.find(j=>j.id===id);
    if(!job||job.state==='completed')return {ok:false,reason:'That build is no longer queued.'};
    job.state='cancelled';job.reason=this.refund(job)?null:'Make room in your bag, then collect the remaining materials.';
    this.changed();return {ok:true,remaining:{...job.escrow}};
  }
  collectRefund(id) { const job=this.builds.find(j=>j.id===id&&['cancelled','completed'].includes(j.state));if(!job)return {ok:false};const done=this.refund(job);this.changed();return {ok:done,remaining:{...job.escrow}}; }

  stores() {
    return this.structures.list().filter(s=>s.valid).map(s=>({id:s.id,structure:s,inventory:this.structures.storeFor(s),position:centre(s.region)})).filter(s=>s.inventory);
  }
  haulSources(a) {
    return this.sources?.(a) ?? [{id:`hall:${a.hallId}`,inventory:this.supplyForHall(a.hallId),position:centre(this.hall(a.hallId).region)}];
  }
  destination(id,item,count=1) { return this.stores().find(s=>s.id===id&&!s.structure.excludes?.includes(item)&&s.inventory.roomFor(item,count)>0)??null; }
  findDestination(p,item,count=1) {
    return this.stores().filter(s=>!s.structure.excludes?.includes(item)&&s.inventory.roomFor(item,count)>0).sort((a,b)=>distance(p,a.position)-distance(p,b.position))[0]??null;
  }
  returnCargo(a) {
    if(!a.carrying)return true;
    const c=a.carrying;
    if(this.hall(a.hallId))c.count=this.supplyForHall(a.hallId).add(c.item,c.count);
    if(c.count)c.count=this.inventory.add(c.item,c.count);
    if(c.count)return false;
    a.carrying=null;return true;
  }

  recoverSupplies(hallId) {
    const stock=this.hallSupplies.get(hallId);let moved=0;
    if(!stock)return {ok:true,moved};
    for(const slot of [...stock.slots]) {
      if(!slot)continue;
      const n=Math.min(slot.count,this.inventory.roomFor(slot.id,slot.count));
      if(n>0){stock.remove(slot.id,n);const left=this.inventory.add(slot.id,n);if(left)stock.add(slot.id,left);moved+=n-left;}
    }
    this.changed();return {ok:true,moved};
  }
  recoverCargo(personId) {
    const a=this.assignments.get(personId);if(!a)return {ok:false};
    const ok=this.returnCargo(a);this.changed();return {ok,remaining:a.carrying?{...a.carrying}:null};
  }

  /** A clear working spot beside a block or store, never the centre of a wall. */
  approach(p,target,reach=2.5) {
    if(distance(p,target)<=reach && settlerFloor(this.world,p.x,p.z,p.y)!=null)return {x:p.x,z:p.z};
    const options=[];
    for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++) {
      const spot={x:Math.floor(target.x)+dx+.5,z:Math.floor(target.z)+dz+.5};
      if(distance(spot,target)>reach||settlerFloor(this.world,spot.x,spot.z,p.y)==null)continue;
      options.push(spot);
    }
    return options.sort((a,b)=>distance(p,a)-distance(p,b))[0]??null;
  }

  move(p,a,target,dt,reach=2.5) {
    if(distance(p,target)<=reach && settlerFloor(this.world,p.x,p.z,p.y)!=null)return true;
    const spot=this.approach(p,target,reach);
    if(!spot){a.status='Waiting for a clear path';return false;}
    const key=`${spot.x},${spot.z}`;
    if(a.routeKey!==key){a.route=null;a.routeKey=key;}
    let remaining=SPEED*dt,planned=false;
    while(remaining>1e-6) {
      const aim=a.route?.[0]??spot,dx=aim.x-p.x,dz=aim.z-p.z,d=Math.hypot(dx,dz);
      if(d<.04){if(a.route?.length){a.route.shift();continue;}p.target=null;return distance(p,target)<=reach+.1;}
      const step=Math.min(.2,remaining,d),x=p.x+dx/d*step,z=p.z+dz/d*step,y=settlerFloor(this.world,x,z,p.y);
      if(y==null) {
        if(planned){a.status='Waiting for a clear path';return false;}
        a.route=settlerRoute(this.world,p,spot);planned=true;
        if(!a.route?.length){a.status='Waiting for a clear path';return false;}
        continue;
      }
      p.target=aim;p.x=x;p.z=z;p.y=y;remaining-=step;
    }
    return distance(p,target)<=reach;
  }

  build(p,a,dt) {
    const job=this.builds.find(j=>j.state==='queued'&&!j.self);
    if(!job){a.status='Waiting for a building order';return;}
    const c=job.changes[job.cursor];
    a.status=`Building ${job.name} (${job.cursor}/${job.changes.length})`;
    // Never wall a worker into the cell being placed. Step into the aisle
    // before raising a block through their body.
    if(c.next!==0 && Math.abs(p.x-(c.x+.5))<.8 && Math.abs(p.z-(c.z+.5))<.8 && c.y+1>p.y && c.y<p.y+1.8) {
      const escape=[];
      for(const [dx,dz] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]) {
        const spot={x:c.x+.5+dx,z:c.z+.5+dz};
        if(settlerFloor(this.world,spot.x,spot.z,p.y)!=null)escape.push(spot);
      }
      if(escape[0])this.move(p,a,escape[0],dt,.2);
      else a.status='Waiting for room beside the next block';
      return;
    }
    // Time owed from while the game was closed: these blocks go in without
    // the walk, as long as their ground is loaded.
    const owed=this.owedSeconds>=BLOCK_SECONDS_AWAY && isLoaded(this.world,c.x+.5,c.z+.5);
    if(!owed && !this.move(p,a,{x:c.x+.5,z:c.z+.5},dt))return;
    if(this.canPlace&&!this.canPlace(c,job)){job.reason='The next block is protected';return;}
    const current=this.world.getBlock(c.x,c.y,c.z);
    if(current!==c.prev&&current!==c.next){job.reason='The site changed — clear or cancel this build';return;}
    if(owed) this.owedSeconds-=BLOCK_SECONDS_AWAY;
    else {
      // Facing the block, a blow at the start and half way: you see it go in.
      p.facing=Math.atan2(c.x+.5-p.x,c.z+.5-p.z);
      const was=a.action??0;a.action=was+dt;
      if(was===0||(was<BUILD_SECONDS/2&&a.action>=BUILD_SECONDS/2))p.strike=SWING_SHOWS;
      if(a.action<BUILD_SECONDS)return;
      a.action=0;
    }
    this.putIn(job,c,current);
  }

  /** The next block of `job` goes in, paid from its escrow. Whether it did. */
  putIn(job,c,current) {
    const item=ITEM_FOR_BLOCK.get(c.next);
    if(current!==c.next) {
      if(item&&!(job.escrow[item]>0)){job.reason='Building material missing from escrow';return false;}
      const placed=this.placeBlock?this.placeBlock({...c,prev:current},job):this.world.setBlock(c.x,c.y,c.z,c.next)!==false;
      if(!placed){job.reason='The next block cannot be placed';return false;}
      if(item && --job.escrow[item]===0)delete job.escrow[item];
    }
    // A player may have placed this cell meanwhile: its reserved material is
    // left over and returned when the order completes, rather than lost.
    job.cursor++;job.reason=null;this.changed();
    if(job.cursor===job.changes.length) {
      job.state='completed';this.refund(job);
      this.onBuildComplete?.(job);
    }
    return true;
  }

  /**
   * IMP-20: a building you placed yourself goes up on its own, one block every
   * SELF_BLOCK_SECONDS (villagers are half as fast again), wherever you are in
   * the world. Not while the game is closed: it is not owed that time.
   */
  selfBuild(job,dt) {
    job.timer=Math.min((job.timer??0)+dt,SELF_BLOCK_SECONDS*2);
    while(job.state==='queued'&&job.timer>=SELF_BLOCK_SECONDS) {
      const c=job.changes[job.cursor];
      if(!isLoaded(this.world,c.x+.5,c.z+.5)){job.reason='Waiting for you to come near';return;}
      if(this.canPlace&&!this.canPlace(c,job)){job.reason='The next block is protected';return;}
      const current=this.world.getBlock(c.x,c.y,c.z);
      if(current!==c.prev&&current!==c.next){job.reason='The site changed — clear or cancel this build';return;}
      if(!this.putIn(job,c,current))return;
      job.timer-=SELF_BLOCK_SECONDS;
    }
  }

  haul(p,a,dt) {
    if(a.carrying) {
      const c=a.carrying;
      const dest=this.destination(a.destination,c.item,c.count)??this.findDestination(p,c.item,c.count);
      if(!dest){a.status='Carrying goods — waiting for store space';return;}
      a.destination=dest.id;a.status=`Carrying ${c.count} ${ITEMS_BY_ID.get(c.item)?.name??c.item}`;
      if(!this.move(p,a,dest.position,dt,4))return;
      const left=dest.inventory.add(c.item,c.count);
      if(left===c.count)return;
      c.count=left;if(!left)a.carrying=null;
      a.action=0;this.changed();return;
    }
    const sources=this.haulSources(a);
    let task=null;
    for(const source of sources) {
      for(const slot of source.inventory.slots) {
        if(!slot || ITEMS_BY_ID.get(slot.id)?.kind==='tool'||ITEMS_BY_ID.get(slot.id)?.wears)continue;
        const dest=this.findDestination(p,slot.id,Math.min(CARRY_LIMIT,slot.count));
        if(dest&&dest.inventory!==source.inventory){task={source,slot,dest};break;}
      }
      if(task)break;
    }
    if(!task){a.status='Waiting for supplies or store space';return;}
    a.status='Walking to supplies';
    if(!this.move(p,a,task.source.position,dt,3))return;
    a.action=(a.action??0)+dt;if(a.action<ACTION_SECONDS)return;a.action=0;
    const count=Math.min(CARRY_LIMIT,task.source.inventory.countOf(task.slot.id),task.dest.inventory.roomFor(task.slot.id,CARRY_LIMIT));
    if(count<=0)return;
    const taken=task.source.inventory.remove(task.slot.id,count);
    if(taken>0){a.carrying={item:task.slot.id,count:taken};a.destination=task.dest.id;this.changed();}
  }

  tick(dt) {
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.5); // no offline construction or teleporting on a long frame
    for(const job of this.builds)if(job.self&&job.state==='queued')this.selfBuild(job,dt);
    for(const a of this.assignments.values()) {
      const p=this.person(a.personId);
      if(!p){this.returnCargo(a);continue;}
      if(p.strike>0)p.strike=Math.max(0,p.strike-dt);
      p.workId=null;p.target=null;p.atWork=false;
      if(!this.hall(a.hallId)){a.status='Work Hall needs repair';continue;}
      if(p.hungry){a.status='Hungry — waiting for food';continue;}
      if(a.role==='builder')this.build(p,a,dt);
      else if(a.role==='hauler')this.haul(p,a,dt);
    }
  }
  changed(){this.bus?.emit('jobs:changed',{});}
  /**
   * The game was closed (or put away) for `ms`: building goes on meanwhile
   * (owner, 31 October: "For this case we should break that rule"), one
   * block every BLOCK_SECONDS_AWAY for each builder able to work, placed
   * when the game is open again. Hauling and production still wait.
   */
  owe(ms) {
    if(!(ms>0)||!this.builds.some(j=>j.state==='queued'&&!j.self))return;
    const builders=[...this.assignments.values()].filter(a=>a.role==='builder'&&!this.person(a.personId)?.hungry&&this.hall(a.hallId)).length;
    if(!builders)return;
    const left=this.builds.filter(j=>j.state==='queued'&&!j.self).reduce((n,j)=>n+j.changes.length-j.cursor,0);
    this.owedSeconds=Math.min((this.owedSeconds??0)+ms/1000*builders,left*BLOCK_SECONDS_AWAY);
  }
  toJSON() {
    return {version:1,nextId:this.nextId,owedSeconds:this.owedSeconds||0,assignments:[...this.assignments.values()].map(a=>({personId:a.personId,role:a.role,hallId:a.hallId,carrying:a.carrying?{...a.carrying}:null,destination:a.destination})),builds:clone(this.builds),supplies:[...this.hallSupplies].map(([hallId,inv])=>({hallId,inventory:inv.toJSON()}))};
  }
  loadJSON(data) {
    if(!data)return;
    this.nextId=Number.isSafeInteger(data.nextId)&&data.nextId>0?data.nextId:1;
    this.owedSeconds=Number.isFinite(data.owedSeconds)&&data.owedSeconds>0?data.owedSeconds:0;
    const builds=Array.isArray(data.builds)?data.builds:[];
    const validCell = c => [c.x,c.y,c.z,c.next,c.prev].every(Number.isSafeInteger)
      && this.world.inBounds(c.x,c.y,c.z) && (c.next===0 || BLOCKS_BY_ID.has(c.next))
      && !BLOCKS_BY_ID.get(c.next)?.system;
    const validJob = j => Number.isSafeInteger(j.id) && j.id>0
      && Array.isArray(j.changes) && j.changes.length>0 && j.changes.length<=100000
      && Number.isSafeInteger(j.cursor) && j.cursor>=0 && j.cursor<=j.changes.length
      && ['queued','cancelled','completed'].includes(j.state) && j.changes.every(validCell)
      && Object.entries(j.escrow??{}).every(([id,n])=>ITEMS_BY_ID.has(id)&&Number.isSafeInteger(n)&&n>=0&&n<=100000);
    if(builds.length>256 || !builds.every(validJob))throw new Error('Invalid saved villager building orders');
    const assignments=Array.isArray(data.assignments)?data.assignments:[];
    if(assignments.length>1000 || assignments.some(a=>!Number.isSafeInteger(a.personId)
      || !['builder','hauler'].includes(a.role) || (a.carrying && (!ITEMS_BY_ID.has(a.carrying.item)
      || !Number.isSafeInteger(a.carrying.count)||a.carrying.count<1||a.carrying.count>CARRY_LIMIT))))throw new Error('Invalid saved villager cargo');
    this.builds=clone(builds);
    this.nextId=Math.max(this.nextId,...this.builds.map(j=>j.id+1));
    this.assignments=new Map(clone(assignments).map(a=>[a.personId,{...a,action:0,status:'Returning to work',route:null}]));
    this.hallSupplies=new Map();
    for(const s of data.supplies??[])this.supplyForHall(s.hallId).loadJSON(s.inventory);
  }
}
