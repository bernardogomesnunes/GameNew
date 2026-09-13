import { generateDuiltWorld, STARTER_SIZE } from '../src/world/StarterWorld.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};

let worstNear=0, worstTrees=Infinity, worstRivers=Infinity, slowest=0, worstCoverage=Infinity, spawnBad=0;
for (let seed=1; seed<=25; seed++) {
  const t0=Date.now();
  const { world, origin } = generateDuiltWorld({ sizeX:128, sizeZ:128, seed });
  slowest=Math.max(slowest, Date.now()-t0);
  const { minX, minZ } = origin;

  // nearest water to any point in the starting plot — the farm rule needs <= 6
  let nearest=Infinity;
  for (let lx=0; lx<STARTER_SIZE; lx++) for (let lz=0; lz<STARTER_SIZE; lz++) {
    const x=minX+lx, z=minZ+lz;
    for (let r=0; r<=12 && r<nearest; r++) {
      let hit=false;
      for (let dx=-r; dx<=r && !hit; dx++) for (let dz=-r; dz<=r; dz++) {
        if (Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
        for (let y=0; y<48; y++) if (world.getBlock(x+dx,y,z+dz)===11) { hit=true; break; }
        if (hit) break;
      }
      if (hit) { nearest=Math.min(nearest,r); break; }
    }
  }
  worstNear=Math.max(worstNear, nearest);

  // water spread across the whole map, not just by spawn
  let quadrants=0;
  for (const [qx,qz] of [[0,0],[1,0],[0,1],[1,1]]) {
    let found=false;
    for (let x=qx*64; x<qx*64+64 && !found; x+=2) for (let z=qz*64; z<qz*64+64; z+=2) {
      for (let y=0;y<48;y++) if (world.getBlock(x,y,z)===11) { found=true; break; }
      if (found) break;
    }
    if (found) quadrants++;
  }
  worstCoverage=Math.min(worstCoverage, quadrants);
  worstTrees=Math.min(worstTrees, origin.trees);
  worstRivers=Math.min(worstRivers, origin.rivers.length);

  const s=origin.spawn, sx=Math.floor(s.x), sz=Math.floor(s.z);
  if (world.getBlock(sx,s.y,sz)!==0 || world.getBlock(sx,s.y+1,sz)!==0 || world.getBlock(sx,s.y-1,sz)===0) spawnBad++;
}
ok(`water always reachable from the plot (worst ${worstNear} blocks, farm needs <= 6)`, worstNear <= 6);
ok(`rivers reach every quadrant of the map (worst ${worstCoverage}/4)`, worstCoverage === 4);
ok(`at least ${worstTrees} trees at the start in all 25 seeds`, worstTrees >= 6);
ok(`multiple rivers every time (worst ${worstRivers})`, worstRivers >= 3);
ok(`spawn is dry and solid in all 25 seeds (${spawnBad} bad)`, spawnBad === 0);
ok(`generation stays fast (worst ${slowest}ms)`, slowest < 900);

/**
 * You have to be able to see something when you arrive.
 *
 * The first version of the spawn only checked that the ground was flat and that
 * nothing was inside your head, so it happily dropped you facing a hillside a
 * block away — the whole screen one flat wall, on the very first frame of the
 * game. This measures what the camera would actually be looking at.
 */
let worstView = 99, facingSet = 0;
for (let seed = 1; seed <= 25; seed++) {
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed });
  const s = origin.spawn;
  if (typeof s.yaw === 'number') facingSet++;
  // Forward is (-sin yaw, 0, -cos yaw); step along it at eye height.
  const dx = -Math.sin(s.yaw ?? 0), dz = -Math.cos(s.yaw ?? 0);
  let run = 0;
  for (let k = 1; k <= 16; k++) {
    const x = Math.floor(s.x + dx * k), z = Math.floor(s.z + dz * k);
    if (!world.inBounds(x, s.y + 1, z) || world.getBlock(x, s.y + 1, z) !== 0) break;
    run = k;
  }
  if (run < worstView) worstView = run;
}
ok(`every spawn faces somewhere (${facingSet}/25 carry a yaw)`, facingSet === 25);
ok(`clear line of sight on arrival (worst ${worstView} blocks)`, worstView >= 10);

process.exit(f?1:0);
