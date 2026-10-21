export const EMERGING_INTERVAL = 10;
export const EMERGING_LIMIT = 12;
export const EMERGING_KINDS = ['caravan','mossfolk','camp','ruin'];
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function validEmergingDescriptor(p){
 return record(p)&&/^emerging:(?:[0-9]|1[01])$/.test(p.id)&&EMERGING_KINDS.includes(p.kind)&&
  int(p.x,-16777200,16777200)&&int(p.z,-16777200,16777200)&&int(p.y,1,190)&&
  int(p.seed,0,2147483647)&&int(p.day,0,1000000000);
}
export function validateEmergingDescriptors(places){
 if(places==null)return;
 if(!Array.isArray(places)||places.length>EMERGING_LIMIT||!places.every(validEmergingDescriptor)||new Set(places.map(p=>p.id)).size!==places.length)
  throw new TypeError('Invalid emerging places: expected at most twelve bounded, unique site descriptors.');
}
export function validateEmergingState(state){
 if(state==null)return;
 if(!record(state)||state.version!==1||!int(state.nextSlot,0,EMERGING_LIMIT)||!int(state.checkedDay,-1,1000000000))throw new TypeError('Invalid emerging place progress.');
 validateEmergingDescriptors(state.places);
 if(!Array.isArray(state.places))throw new TypeError('Invalid emerging place list.');
}
/** Sanitise legacy/absent progress without keeping arbitrary nested data. */
export function emergingState(saved={}){
 const source=Array.isArray(saved)?{places:saved}:record(saved)?saved:{};
 const places=[],ids=new Set();
 for(const p of Array.isArray(source.places)?source.places.slice(0,EMERGING_LIMIT):[]){
  if(!validEmergingDescriptor(p)||ids.has(p.id))continue;
  ids.add(p.id);places.push({id:p.id,kind:p.kind,x:p.x,y:p.y,z:p.z,seed:p.seed,day:p.day});
 }
 const nextSlot=Number.isFinite(source.nextSlot)?Math.floor(source.nextSlot):0;
 const afterLast=places.reduce((max,p)=>Math.max(max,Number(p.id.split(':')[1])+1),0);
 return {version:1,nextSlot:Math.max(afterLast,Math.min(EMERGING_LIMIT,Math.max(0,nextSlot))),
  checkedDay:int(source.checkedDay,-1,1000000000)?source.checkedDay:-1,places};
}
/** Restore before generators/workers/Wanderers consume their landmark list. */
export function installEmergingPlaces(gen, saved) {
  if(!gen)return;
  const records=emergingState(saved).places;
  const signature=JSON.stringify(records);
  if(gen.emergingPlaceSignature===signature)return;
  gen.emergingPlaces=records;
  gen.emergingPlaceSignature=signature;
  gen.landmarkCache=null;
}


