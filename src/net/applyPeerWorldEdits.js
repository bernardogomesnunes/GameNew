import { isChest } from '../config/blocks.js';
import { validateEditCells } from './PeerBattle.js';

/** Already-authorised host changes: guest claims/inventories can be stale. */
export function applyPeerWorldEdits(game, cells) {
  const changes=validateEditCells(cells);
  if(changes.some(c=>!game.world.inBounds(c.x,c.y,c.z)))return false;
  for(const c of changes) {
    const prev=game.world.getBlock(c.x,c.y,c.z);
    game.world.setBlock(c.x,c.y,c.z,c.next);
    game.farTerrain?.invalidateAt(c.x,c.z);
    if(isChest(prev)&&!isChest(c.next))game.duilt?.removeChest(c.x,c.y,c.z);
    if(!isChest(prev)&&isChest(c.next))game.duilt?.chestAt(c.x,c.y,c.z);
  }
  game.remeshDirty();
  game.duilt?.structures.revalidateAround(changes);
  game.selectionDirty=true;
  game.editedAt=Date.now();
  return true;
}
