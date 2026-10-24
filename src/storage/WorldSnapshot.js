import {World} from '../world/World.js';
import {ChunkGen} from '../world/ChunkGen.js';
import {terrainConfig,terrainGenerator,generateTerrainChunk} from '../world/terrainPayload.js';

const FORMAT='duilt-local-binary';

/** Owned buffers captured synchronously with the accompanying game state.
 * No live chunk is generated, encoded, detached or retained by the snapshot.
 */
export function captureWorldSnapshot(world,keepBounds=null){
  const chunks=[],included=new Set();
  const add=(cx,cz)=>{
    const key=`${cx},${cz}`;if(included.has(key))return;included.add(key);
    const chunk=world.getChunk(cx,cz,false);
    chunks.push(chunk?{cx,cz,height:world.height,data:chunk.data.slice(),
      surface:chunk.surface.slice(),biomes:chunk.biomes.slice()}:{cx,cz});
  };
  for(const chunk of world.chunks.values())if(!world.endless||chunk.touched)add(chunk.cx,chunk.cz);
  if(world.endless&&keepBounds){
    for(let cx=keepBounds.minX>>4;cx<=keepBounds.maxX>>4;cx++)
      for(let cz=keepBounds.minZ>>4;cz<=keepBounds.maxZ>>4;cz++)add(cx,cz);
  }
  return{format:FORMAT,version:1,endless:world.endless,height:world.height,chunks,
    ...(world.endless?{generation:structuredClone(terrainConfig(world))}
      :{sizeX:world.sizeX,sizeZ:world.sizeZ,surfaceHeightMap:world.surfaceHeightMap.slice(),biomeMap:world.biomeMap.slice()})};
}

/** Worker preparation; the fallback yields between chunks. Never installs
 * generated terrain into the playing world or builds rendering resources.
 */
export async function completeWorldSnapshot(snapshot,yieldWork=null,previous=null){
  const compatible=previous?.format===FORMAT&&previous.height===snapshot.height
    &&previous.generation?.seed===snapshot.generation?.seed
    &&previous.generation?.homeX===snapshot.generation?.homeX&&previous.generation?.homeZ===snapshot.generation?.homeZ;
  const kept=new Map(compatible?previous.chunks.map(c=>[`${c.cx},${c.cz}`,c]):[]);
  let gen;
  for(let i=0;i<snapshot.chunks.length;i++){
    const c=snapshot.chunks[i];
    if(!c.data){
      const existing=kept.get(`${c.cx},${c.cz}`);
      if(existing?.data)snapshot.chunks[i]=existing;
      else{
        gen??=terrainGenerator(snapshot.generation);
        snapshot.chunks[i]=generateTerrainChunk(snapshot.generation,c.cx,c.cz,gen);
      }
      if(yieldWork)await yieldWork();
    }
  }
  return snapshot;
}

/** Legacy RLE payloads remain readable. New internal binary records avoid
 * generating terrain merely to overwrite it with the saved blocks.
 */
export function restoreWorldSnapshot(snapshot){
  if(snapshot.format!==FORMAT)return World.deserialize(snapshot,{makeGen:o=>new ChunkGen(o)});
  if(snapshot.version!==1)throw new Error('This local world needs a newer game version.');
  const world=new World(snapshot.endless
    ?{height:snapshot.height,gen:terrainGenerator(snapshot.generation)}
    :{height:snapshot.height,sizeX:snapshot.sizeX,sizeZ:snapshot.sizeZ});
  if(!snapshot.endless){
    world.surfaceHeightMap=snapshot.surfaceHeightMap;world.biomeMap=snapshot.biomeMap;
  }
  for(const c of snapshot.chunks){
    let chunk;
    if(snapshot.endless)chunk=world.acceptGeneratedChunk(c);
    else{
      chunk=world.getChunk(c.cx,c.cz,false);
      if(chunk&&c.data?.length===16*world.height*16){
        chunk.data=c.data;chunk.surface=c.surface;chunk.biomes=c.biomes;
      }else chunk=null;
    }
    if(!chunk)throw new Error('The local world contains an incomplete chunk.');
    chunk.touched=true;chunk.dirty=true;world.scanLights(chunk);
  }
  return world;
}

/** Only snapshot-owned copies may be transferred out of the game thread. */
export function snapshotTransfers(snapshot){
  const buffers=[];
  for(const c of snapshot.chunks)for(const key of ['data','surface','biomes'])if(c[key])buffers.push(c[key].buffer);
  for(const key of ['surfaceHeightMap','biomeMap'])if(snapshot[key])buffers.push(snapshot[key].buffer);
  return buffers;
}
