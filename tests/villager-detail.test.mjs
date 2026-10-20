import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ids=['settler',...Array.from({length:5},(_,i)=>`settler_${i+1}`),'citizen',...Array.from({length:3},(_,i)=>`citizen_${i+1}`)];
for(const id of ids) {
  const bytes=readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const names=json.nodes.map(n=>n.name.replace(`${id}_`,''));
  for(const bone of ['body','head','leg_l','leg_r','arm_l','arm_r']) assert.ok(names.includes(bone),`${id} retains ${bone}`);
  assert.ok(json.animations?.length,`${id} retains animation`);
  const channels=json.animations.flatMap(a=>a.channels);
  assert.ok(channels.some(c=>json.nodes[c.target.node].name===`${id}_leg_l`),`${id} still walks`);
  for(const detail of ['collar_l','pocket_flap','belt_pouch','nose','boot_toe_l']) assert.ok(names.includes(detail),`${id} has ${detail}`);
  assert.ok(bytes.length<100*1024,`${id} is small enough to instance on mobile`);
}
console.log('PASS ten detailed villager GLBs retain animation bones and stay below 100 KB each');
