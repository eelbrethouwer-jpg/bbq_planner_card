/* PR3: actual v5 planner read-only integration (opt-in only), Chromium & WebKit. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

const dir=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async (request,response)=>{
  try{
    const target=path.resolve(dir,'.'+decodeURIComponent(
      new URL(request.url,'http://localhost').pathname));
    if(!target.startsWith(dir+path.sep)){response.writeHead(403).end();return;}
    const data=await readFile(target);
    response.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
    response.end(data);
  }catch{response.writeHead(404).end('Missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const mainPath='/dist/BBQ_bereidingsplanner_MEATER_v4.html';
const sample={
  date:'2026-11-14',dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,equipment:{large:[],small:[]},
  smart:{enabled:true,mode:'fixed'},v46Done:{},v5Actual:{},
  dishes:[
    {id:'a',name:'Aardappeltjes',kamado:'large',cook:60,rest:15,grill:120,
      grate:'rvs',method:'indirect',mode:'auto',phase:'waiting',prepTasks:[]},
    {id:'b',name:'Ribeye',kamado:'large',cook:60,rest:15,grill:250,
      grate:'cast',method:'direct',mode:'auto',phase:'waiting',prepTasks:[]}
  ]
};
let checks=0;
try{
  for(const browserType of [chromium,webkit]){
    const browser=await browserType.launch({headless:true});
    try{
      for(const width of [320,390,1024]){
        const context=await browser.newContext({
          viewport:{width,height:844},isMobile:width<500,hasTouch:width<500
        });
        await context.addInitScript(state=>{
          if(localStorage.getItem('kamado-bereidingsplanner-v1')===null)
            localStorage.setItem('kamado-bereidingsplanner-v1',JSON.stringify(state));
        },sample);
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+mainPath,{waitUntil:'load'});
        assert.equal(await page.locator('#bbq6-beta-panel').count(),0,
          'regular v5 must not render v6 beta UI');
        assert.equal(await page.evaluate(()=>typeof window.__bbqV6ReadOnlyState),
          'undefined','regular v5 must not expose the opt-in bridge');
        assert.ok(await page.locator('#v5-root').count(),'v5 root missing');
        const before=await page.evaluate(()=>
          localStorage.getItem('kamado-bereidingsplanner-v1'));
        await page.goto(origin+mainPath+'?v6preview=1',{waitUntil:'load'});
        await page.locator('#bbq6-beta-panel .bbq6-title').waitFor({timeout:10000});
        assert.ok((await page.locator('#bbq6-beta-panel').innerText())
          .includes('Alleen lezen'));
        assert.equal(await page.locator('#bbq6-beta-panel .bbq6-dish').count(),2);
        assert.ok(await page.locator('#v5-root').count());
        assert.equal(await page.evaluate(()=>
          localStorage.getItem('kamado-bereidingsplanner-v1')),before,
        'opt-in preview boot modified original storage');
        await page.locator('#bbq6-calculate').click();
        await page.waitForFunction(()=>document.getElementById('bbq6-beta-status')
          ?.textContent?.startsWith('Gereed:'),null,{timeout:25000});
        const alternatives=await page.locator('#bbq6-beta-panel [data-bbq6-action^="select:"]').count();
        assert.ok(alternatives>0&&alternatives<=3,'invalid alternative count');
        await page.locator('#bbq6-beta-panel [data-bbq6-action^="select:"]').first().click();
        assert.ok(await page.locator('#bbq6-beta-panel [data-bbq6-action="apply"]').isDisabled(),
          'beta must never write even after selecting a proposal');
        assert.equal(await page.evaluate(()=>
          localStorage.getItem('kamado-bereidingsplanner-v1')),before,
        'read-only optimizer modified storage');
        assert.equal(await page.evaluate(()=>
          localStorage.getItem('bbq-v6-apply-journal-v1')),null,
        'read-only preview must not create a recovery journal');
        const bounds=await page.evaluate(()=>({
          page:document.documentElement.scrollWidth,viewport:window.innerWidth
        }));
        assert.ok(bounds.page<=bounds.viewport+1,
          browserType.name()+' '+width+' overflow '+JSON.stringify(bounds));
        assert.deepEqual(errors,[],'browser script errors on gated real v5');
        console.log('PASS real v5 preview '+browserType.name()+' '+width+
          'px; alternatives='+alternatives+'; writes=0');
        checks++;
        if(width===390){
          // A plain old v5 tab bypasses Web Locks; it must invalidate any
          // preview results and force a full reload rather than trust stale
          // in-memory state. This does NOT make concurrent v5 writes safe.
          const legacy=await context.newPage();
          await legacy.goto(origin+mainPath,{waitUntil:'load'});
          await legacy.evaluate(()=>{
            const field=document.querySelector('#meal-time');
            if(!field)throw new Error('Legacy meal time input missing');
            field.value='19:00';
            field.dispatchEvent(new Event('input',{bubbles:true}));
          });
          await page.waitForFunction(()=>{
            const status=document.getElementById('bbq6-beta-status')?.textContent||'';
            return status.includes('ander tabblad');
          },null,{timeout:10000});
          assert.ok(await page.locator('#bbq6-calculate').isDisabled());
          assert.equal(await page.locator('#bbq6-beta-panel .bbq6-option').count(),0,
            'stale alternatives should disappear');
          const written=await page.evaluate(()=>
            localStorage.getItem('kamado-bereidingsplanner-v1'));
          assert.equal(JSON.parse(written).mealTime,'19:00');
          assert.equal(await page.evaluate(()=>
            localStorage.getItem('bbq-v6-apply-journal-v1')),null);
          await Promise.all([
            page.waitForEvent('load',{timeout:10000}),
            page.locator('#bbq6-refresh').click()
          ]);
          await page.locator('#bbq6-beta-panel .bbq6-title').waitFor({timeout:10000});
          const fresh=await page.evaluate(()=>window.__bbqV6ReadOnlyState()?.mealTime);
          assert.equal(fresh,'19:00','reload must read the newly saved legacy state');
          assert.equal(await page.evaluate(()=>
            localStorage.getItem('kamado-bereidingsplanner-v1')),written);
          assert.equal(await page.evaluate(()=>
            localStorage.getItem('bbq-v6-apply-journal-v1')),null);
          await legacy.close();
          console.log('PASS legacy old-tab write detected and reloaded '+browserType.name());
          checks++;
        }
        await context.close();
      }
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+checks+' gated real v5 browser scenarios');
