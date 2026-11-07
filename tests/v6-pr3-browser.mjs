/* Real PR3 browser smoke: HTTP module Worker, mobile width, Chromium and WebKit. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async (request,response)=>{
  try{
    const requested=new URL(request.url,'http://localhost').pathname;
    const target=path.resolve(root,'.'+decodeURIComponent(requested));
    if(!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    const bytes=await readFile(target);
    response.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
    response.end(bytes);
  }catch(error){response.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const url='http://127.0.0.1:'+address.port+'/v6/sandbox.html';
let checks=0;
try{
  for(const browserType of [chromium,webkit]){
    const browser=await browserType.launch({headless:true});
    try{
      for(const width of [320,390,1024]){
        const page=await browser.newPage({viewport:{width,height:844},
          isMobile:width<500,hasTouch:width<500});
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(url,{waitUntil:'load'});
        assert.ok(await page.locator('#regisseur .bbq6-title').count(),
          'preview screen missing');
        assert.equal(await page.locator('img').count(),0);
        assert.ok((await page.locator('body').innerText()).includes('FICTIEVE DATA'));
        await page.locator('#calculate').click();
        await page.waitForFunction(()=>{
          const v=document.getElementById('status')?.textContent||'';
          return v.startsWith('Gereed:')||v.includes('mislukt');
        },null,{timeout:20000});
        const message=await page.locator('#status').innerText();
        assert.ok(message.startsWith('Gereed:'),browserType.name()+' '+width+': '+message);
        const opts=await page.locator('[data-bbq6-action^="select:"]').count();
        assert.ok(opts>0&&opts<=3,'expected 1..3 alternatives, got '+opts);
        assert.ok(await page.locator('[data-bbq6-action="apply"]').isDisabled(),
          'apply may not be available without validated storage integration');
        await page.locator('[data-bbq6-action^="select:"]').first().click();
        assert.ok(await page.locator('[data-bbq6-action="apply"]').isDisabled(),
          'selected alternative must not bypass storage guard');
        const metrics=await page.evaluate(()=>({
          viewport:window.innerWidth,document:document.documentElement.scrollWidth,
          timeline:document.querySelectorAll('.bbq6-lane').length,
          warning:document.querySelector('.bbq6-budget')?.textContent||''
        }));
        assert.equal(metrics.timeline,2);
        assert.ok(metrics.document<=metrics.viewport+1,
          browserType.name()+' '+width+' horizontal overflow '+JSON.stringify(metrics));
        assert.ok(metrics.warning.includes('96'),'candidate budget not visible');
        assert.deepEqual(errors,[],'browser module error');
        checks++;
        console.log('PASS V6_PR3_BROWSER '+browserType.name()+' '+width+'px options='+opts);
        await page.close();
      }
    }finally{await browser.close();}
  }
}finally{
  await new Promise(resolve=>server.close(resolve));
}
console.log('PASS '+checks+' real PR3 browser scenarios');
