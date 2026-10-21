import assert from 'node:assert/strict';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
let failures=0;
function check(n,f){try{f();console.log(`PASS ${n}`);}catch(e){failures++;console.error(`FAIL ${n}: ${e.message}`);}}
check('storage interface is a craftable separate item',()=>assert.equal(ITEMS_BY_ID.get('storage_interface')?.block,526));
check('directory keeps each store separate, including empty and broken stores',()=>{
  const stores=[{id:1,type:'storehouse',valid:true,store:{slots:[{id:'stone',count:4},{id:'stone',count:3}]}},{id:2,type:'granary',valid:false,store:{slots:[]}}];
  const result=DuiltGame.prototype.storeDirectory.call({structures:{structures:stores}});
  assert.equal(result.length,2);assert.equal(result[0].total,7);assert.deepEqual(result[0].items,[{id:'stone',count:7}]);assert.equal(result[1].total,0);assert.equal(result[1].id,2);
});
process.exitCode=failures?1:0;
