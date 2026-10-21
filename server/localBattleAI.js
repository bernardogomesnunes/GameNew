// Development-server bridge: the browser never holds a model key or chooses an
// arbitrary upstream address. LM Studio stays bound to this computer.
export async function chooseRivalStrategies(snapshot, { fetcher = fetch, baseUrl = 'http://127.0.0.1:1234/v1', model = null, apiKey = null } = {}) {
  if (!Array.isArray(snapshot?.rivals) || snapshot.rivals.length !== 3) throw new Error('Invalid rival snapshot');
  const rivals = snapshot.rivals.map(r => {
    if (!Number.isInteger(r.id) || r.id < 0 || r.id > 2 || !Number.isFinite(r.strength)) throw new Error('Invalid rival');
    return {id:r.id,strength:Math.max(1,Math.min(12,r.strength)),falls:Math.max(0,Math.min(100,Number(r.falls)||0))};
  });
  const headers = {'Content-Type':'application/json', ...(apiKey ? {Authorization:`Bearer ${apiKey}`} : {})};
  const signal = AbortSignal.timeout(20000);
  if (!model) {
    const res = await fetcher(`${baseUrl}/models`, {headers,signal});
    if (!res.ok) throw new Error('LM Studio models unavailable');
    const models=(await res.json()).data??[];
    model=(models.find(m=>m.id==='duilt-local-ai')??models.find(m=>typeof m.id==='string'&&!/embed/i.test(m.id)))?.id;
  }
  if (!model) throw new Error('Load a chat model in LM Studio');
  const res = await fetcher(`${baseUrl}/chat/completions`, {method:'POST',headers,signal,body:JSON.stringify({model,temperature:.6,max_tokens:256,messages:[
    {role:'system',content:'You choose strategy for three rivals in a whimsical settlement game. Reply ONLY JSON: {"rivals":[{"id":0,"stance":"pressure"},{"id":1,"stance":"guard"},{"id":2,"stance":"rebuild"}]}. Choose exactly one stance per id (0,1,2). Allowed stances: pressure, guard, rebuild. Vary choices according to strength and past defeats. No other fields or actions.'},
    {role:'user',content:JSON.stringify({rivals})+'\n/no_think'},
  ]})});
  if (!res.ok) throw new Error('LM Studio could not answer');
  const body = await res.json(), content = body.choices?.[0]?.message?.content;
  const parsed = JSON.parse(String(content).replace(/^```(?:json)?\s*|\s*```$/g,''));
  if (!Array.isArray(parsed.rivals) || parsed.rivals.length!==3) throw new Error('Invalid model strategy');
  const seen=new Set();
  return {rivals:parsed.rivals.map(r=>{
    if (!Number.isInteger(r.id)||r.id<0||r.id>2||seen.has(r.id)||!['pressure','guard','rebuild'].includes(r.stance)) throw new Error('Invalid model strategy');
    seen.add(r.id); return {id:r.id,stance:r.stance};
  })};
}

export function localBattlePlugin() {
  return {name:'local-battle-ai',configureServer(server){
    let busy=false,last=0;
    server.middlewares.use('/api/local-battle-ai',async(req,res)=>{
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      if(req.method!=='POST'){res.statusCode=405;return res.end('{"error":"Use POST"}');}
      // Only the local dev site's origin can ask this computer's model.
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`){res.statusCode=403;return res.end('{"error":"Origin refused"}');}
      if(busy||Date.now()-last<10000){res.statusCode=429;return res.end('{"error":"Please wait"}');}
      busy=true;last=Date.now();
      try {
        let text='';for await(const part of req){text+=part;if(text.length>4096){res.statusCode=413;return res.end('{"error":"Snapshot too large"}');}}
        const result=await chooseRivalStrategies(JSON.parse(text),{model:process.env.BATTLE_AI_MODEL||null,apiKey:process.env.BATTLE_AI_KEY||null});
        res.end(JSON.stringify(result));
      }catch{res.statusCode=503;res.end('{"error":"LM Studio unavailable; normal rivals continue"}');}
      finally{busy=false;}
    });
  }};
}
