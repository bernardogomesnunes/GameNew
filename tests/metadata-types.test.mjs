import assert from 'node:assert/strict';
import { BLOCKS, ID_LIMIT } from '../src/config/blocks.js';
import { validateBlockList, validateSaveMetadata } from '../src/storage/MetadataTypes.js';
validateBlockList(BLOCKS, ID_LIMIT);
assert.throws(() => validateBlockList([{ id: 1, name: 'bad', color: '#fff' }], ID_LIMIT), /color/);
assert.throws(() => validateBlockList([BLOCKS[0], BLOCKS[0]], ID_LIMIT), /duplicate/);
const fixed = { name: 'Test', mode: 'creative', height: 64, sizeX: 64, sizeZ: 64 };
validateSaveMetadata(fixed);
validateSaveMetadata({ ...fixed, mode: 'campaign' });
validateSaveMetadata({ ...fixed, mode: 'duilt', sizeX: null, sizeZ: null, worldGen: { seed: 7, homeX: 0, homeZ: -10 } });
for (const fields of [{mode:'battle'}, {mode:3}, {height:Infinity}, {sizeX:null}, {worldGen:{seed:'7'}}, {spawn:{x:NaN,y:1,z:1}}]) {
  assert.throws(() => validateSaveMetadata({ ...fixed, ...fields }), /Invalid save/);
}
console.log('PASS block registry and save metadata match declared field types; malformed values fail before IO');

const { CloudWorlds } = await import('../src/net/CloudWorlds.js');
const cloud = new CloudWorlds({auth:{},bus:{emit(){}}});
cloud.sync.pull = async () => ({meta:{...fixed,height:Infinity},chunks:[]});
await assert.rejects(cloud.restore('invalid'), /Invalid save metadata/);
console.log('PASS corrupt cloud metadata is rejected before restoring a World');
