/* Genuine two-tab Web Locks test on a single browser origin. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(request,response)=>{
  try{
    const name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+name);
    if(!target.startsWith(root+path.sep)){
      response.writeHead(403).end('Forbidden');return;
    }
    const bytes=await readFile(target);
    const type=target.endsWith('.mjs')?'text/javascript; charset=utf-8':
      target.endsWith('.html')?'text/html; charset=utf-8':'text/plain';
    response.writeHead(200,{'content-type':type});response.end(bytes);
  }catch{response.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let checked=0;
try{
  for(const type of [chromium,webkit]){
    const browser=await type.launch({headless:true});
    try{
      const context=await browser.newContext();
      const a=await context.newPage(),b=await context.newPage();
      await Promise.all([a.goto(origin+'/v6/sandbox.html'),b.goto(origin+'/v6/sandbox.html')]);
      const support=await a.evaluate(()=>!!navigator.locks?.request);
      if(!support){
        const result=await a.evaluate(async()=>{
          const {createPlanLock}=await import('/v6/plan-lock.mjs');
          try{createPlanLock({lockManager:navigator.locks});return 'UNSAFE_FALLBACK'}
          catch(error){return error.message}
        });
        assert.equal(result,'WEB_LOCKS_UNAVAILABLE');
        console.log('PASS '+type.name()+' Web Locks unavailable -> fail-closed, no apply');
      }else{
        await a.evaluate(async()=>{
          const {createPlanLock}=await import('/v6/plan-lock.mjs');
          const locked=createPlanLock({lockManager:navigator.locks});
          window.__lockTask=locked(async()=>{
            window.__lockHeld=true;
            await new Promise(resolve=>{window.__unlock=resolve});
          });
        });
        await a.waitForFunction(()=>window.__lockHeld===true);
        const busy=await b.evaluate(async()=>{
          const {createPlanLock}=await import('/v6/plan-lock.mjs');
          try{
            return await createPlanLock({lockManager:navigator.locks})(async()=> 'UNSAFE_CONCURRENT_APPLY');
          }catch(error){return error.message;}
        });
        assert.equal(busy,'PLAN_LOCK_BUSY','second tab must fail-closed');
        await a.evaluate(async()=>{window.__unlock();await window.__lockTask;});
        const unlocked=await b.evaluate(async()=>{
          const {createPlanLock}=await import('/v6/plan-lock.mjs');
          return createPlanLock({lockManager:navigator.locks})(async()=> 'LOCK_RELEASED');
        });
        assert.equal(unlocked,'LOCK_RELEASED');
        console.log('PASS '+type.name()+' genuine cross-tab lock contention/release');
      }
      checked++;
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+checked+' two-tab lock scenarios');
