import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {createServer} from 'vite';
mkdirSync('art/review',{recursive:true});
const [reviewPage='tools/visual-review.html',output='art/review/visuals-and-caves.png']=process.argv.slice(2);
const server=await createServer({server:{host:'127.0.0.1',port:5203,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:1500}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:5203/${reviewPage}`);
  await page.waitForFunction(()=>window.reviewReady,null,{timeout:90000});
  if(errors.length)throw Error(errors.join('\n'));
  await page.screenshot({path:output,fullPage:true});
  console.log('PASS actual GLBs and terrain render in browser without JavaScript errors');
} finally {await browser.close();await server.close();}
