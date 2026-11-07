/* PR3 route (b): real same-origin v5 data in standalone /v6/preview.html.
 * Production dist must stay byte-identical to main. Tests run Chromium + WebKit.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,
      'http://localhost').pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const data=await readFile(target);
    res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
    res.end(data);
  }catch{res.writeHead(404).end('Missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const legacyUrl=origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html';
const previewUrl=origin+'/v6/preview.html';
const PLAN='kamado-bereidingsplanner-v1',DRAFT='bbq-v6-proposal-draft-v1',
  JOURNAL='bbq-v6-apply-journal-v1',BACKUP='bbq-v5-previous-plan-v1';
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
const snapshots=()=>({
  plan:localStorage.getItem('kamado-bereidingsplanner-v1'),
  journal:localStorage.getItem('bbq-v6-apply-journal-v1'),
  backup:localStorage.getItem('bbq-v5-previous-plan-v1')
});
async function calculated(page){
  await page.locator('#bbq6-calculate').click();
  await page.waitForFunction(()=>document.getElementById('bbq6-beta-status')
    ?.textContent?.startsWith('Gereed:'),null,{timeout:25000});
  const alternatives=page.locator('#bbq6-beta-panel [data-bbq6-action^="select:"]');
  const count=await alternatives.count();
  assert.ok(count>0&&count<=3,'expected 1-3 optimizer proposals, got '+count);
  await alternatives.first().click();
  assert.equal(await page.locator('#bbq6-beta-panel [data-bbq6-action="apply"]').count(),0,
    'Apply must be HIDDEN when no production onApply exists');
  return count;
}
let checks=0;
try{
  for(const browserType of [chromium,webkit]){
    const browser=await browserType.launch({headless:true});
    try{
      for(const width of [320,375,390,768,1024]){
        const context=await browser.newContext({viewport:{width,height:844},
          isMobile:width<500,hasTouch:width<500,acceptDownloads:true});
        await context.addInitScript(({PLAN,sample})=>{
          if(localStorage.getItem(PLAN)===null)
            localStorage.setItem(PLAN,JSON.stringify(sample));
        },{PLAN,sample});
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(legacyUrl+'?v6preview=1',{waitUntil:'load'});
        assert.equal(await page.locator('#bbq6-beta-panel').count(),0,
          'legacy URL must not mount v6, even if query param supplied');
        assert.equal(await page.evaluate(()=>typeof window.__bbqV6ReadOnlyState),
          'undefined');
        assert.ok(await page.locator('#v5-root').count(),'legacy planner missing');
        const before=await page.evaluate(snapshots);
        await page.goto(previewUrl,{waitUntil:'load'});
        await page.locator('#bbq6-beta-panel .bbq6-title').waitFor({timeout:10000});
        assert.ok((await page.locator('#bbq6-beta-panel').innerText())
          .includes('Concept apart bewaren'));
        assert.equal(await page.locator('#bbq6-beta-panel .bbq6-dish').count(),2);
        assert.deepEqual(await page.evaluate(snapshots),before,
          'preview boot must not write legacy keys');
        const count=await calculated(page);
        await page.locator('#bbq6-beta-panel [data-bbq6-action="save"]').click();
        await page.waitForFunction(()=>localStorage.getItem('bbq-v6-proposal-draft-v1')!==null,
          null,{timeout:10000});
        const draft=await page.evaluate(()=>localStorage.getItem('bbq-v6-proposal-draft-v1'));
        const obj=JSON.parse(draft);
        assert.equal(obj.version,1);
        assert.ok(['feasible','conditional'].includes(obj.planStatus));
        assert.equal(obj.sourceHash.length,64);
        assert.ok(!draft.includes('Ribeye')&&!draft.includes('Aardappeltjes'));
        assert.deepEqual(await page.evaluate(snapshots),before,
          'draft save must not mutate any old v5 key');
        const bounds=await page.evaluate(()=>({
          viewport:innerWidth,doc:document.documentElement.scrollWidth
        }));
        assert.ok(bounds.doc<=bounds.viewport+1,
          browserType.name()+' '+width+' horizontal overflow '+JSON.stringify(bounds));
        assert.deepEqual(errors,[]);
        console.log('PASS preview '+browserType.name()+' '+width+
          'px alternatives='+count+'; live-plan untouched');
        checks++;

        if(width===375){
          // Changing localStorage in the SAME tab does not fire storage event:
          // the preview must detect this via its 2-second polling and focus.
          await page.evaluate(()=>{
            const raw=JSON.parse(localStorage.getItem('kamado-bereidingsplanner-v1'));
            raw.mealTime='18:40';
            localStorage.setItem('kamado-bereidingsplanner-v1',JSON.stringify(raw));
          });
          const modified=await page.evaluate(snapshots);
          await page.waitForFunction(()=>document.getElementById('bbq6-beta-status')
            ?.textContent?.includes('gewijzigd'),null,{timeout:3500});
          assert.equal(await page.locator('#bbq6-beta-panel .bbq6-option').count(),0,
            'same-tab stale options must disappear');
          await page.waitForFunction(()=>document.getElementById('bbq6-draft-status')
            ?.textContent?.includes('verouderd'),null,{timeout:4000});
          assert.equal(await page.evaluate(()=>localStorage.getItem('bbq-v6-proposal-draft-v1')),
            draft);
          assert.deepEqual(await page.evaluate(snapshots),modified);
          console.log('PASS same-tab 2s invalidation '+browserType.name());
          checks++;
        }
        if(width===390){
          // Recalculate while the existing concept is still current.
          await page.locator('#bbq6-refresh').click();
          await page.locator('#bbq6-beta-panel .bbq6-title').waitFor();
          await calculated(page);
          // A replacement requires an explicit warning and confirmation.
          page.once('dialog',dialog=>dialog.dismiss());
          await page.locator('#bbq6-beta-panel [data-bbq6-action="save"]').click();
          await page.waitForFunction(()=>document.querySelector('#bbq6-beta-panel .bbq6-notice')
            ?.textContent?.includes('GEANNULEERD'),null,{timeout:5000});
          assert.equal(await page.evaluate(()=>localStorage.getItem('bbq-v6-proposal-draft-v1')),
            draft,'declined overwrite altered existing draft');

          const legacy=await context.newPage();
          await legacy.goto(legacyUrl,{waitUntil:'load'});
          await legacy.evaluate(()=>{
            const input=document.getElementById('meal-time');
            input.value='19:00';
            input.dispatchEvent(new Event('input',{bubbles:true}));
          });
          await page.waitForFunction(()=>document.getElementById('bbq6-beta-status')
            ?.textContent?.includes('gewijzigd'),null,{timeout:10000});
          assert.equal(await page.locator('#bbq6-beta-panel .bbq6-option').count(),0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('bbq-v6-proposal-draft-v1')),
            draft);
          const changed=await page.evaluate(snapshots);
          assert.equal(JSON.parse(changed.plan).mealTime,'19:00');
          await Promise.all([page.waitForEvent('load',{timeout:10000}),
            page.locator('#bbq6-refresh').click()]);
          await page.locator('#bbq6-beta-panel .bbq6-title').waitFor({timeout:10000});
          await page.waitForFunction(()=>document.getElementById('bbq6-draft-status')
            ?.textContent?.includes('verouderd'),null,{timeout:10000});
          await page.locator('#bbq6-discard-draft').click();
          await page.waitForFunction(()=>
            localStorage.getItem('bbq-v6-proposal-draft-v1')===null,null,{timeout:10000});
          assert.deepEqual(await page.evaluate(snapshots),changed);
          await legacy.close();
          console.log('PASS legacy second-tab invalidation, reload, draft discard '+browserType.name());
          checks++;
        }
        await context.close();
      }
      for(const journal of ['','{corrupt',JSON.stringify({
        version:1,stage:'prepared',before:JSON.stringify(sample),
        after:JSON.stringify({...sample,mealTime:'19:00'})
      })]){
        const context=await browser.newContext({acceptDownloads:true});
        await context.addInitScript(({PLAN,DRAFT,JOURNAL,BACKUP,sample,journal})=>{
          localStorage.setItem(PLAN,JSON.stringify(sample));
          localStorage.setItem(JOURNAL,journal);
          localStorage.setItem(BACKUP,'ORIGINAL_BACKUP');
        },{PLAN,DRAFT,JOURNAL,BACKUP,sample,journal});
        const page=await context.newPage();
        await page.goto(previewUrl);
        assert.ok(await page.locator('#bbq6-recovery-root').isVisible());
        assert.equal(await page.locator('#bbq6-beta-panel').count(),0);
        const before=await page.evaluate(snapshots);
        const [download]=await Promise.all([
          page.waitForEvent('download',{timeout:10000}),
          page.locator('#bbq6-download-emergency').click()
        ]);
        const output=JSON.parse(await readFile(await download.path(),'utf8'));
        assert.equal(output.keys[PLAN],before.plan);
        assert.equal(output.keys[JOURNAL],journal);
        assert.equal(output.keys[BACKUP],before.backup);
        page.once('dialog',dialog=>dialog.dismiss());
        await page.locator('#bbq6-discard-journal').click();
        assert.deepEqual(await page.evaluate(snapshots),before,
          'cancel journal deletion mutated backup/plan');
        page.once('dialog',dialog=>dialog.accept());
        await Promise.all([
          page.waitForEvent('load',{timeout:10000}),
          page.locator('#bbq6-discard-journal').click()
        ]);
        await page.locator('#bbq6-beta-panel .bbq6-title').waitFor({timeout:10000});
        const after=await page.evaluate(snapshots);
        assert.equal(after.plan,before.plan);
        assert.equal(after.backup,before.backup);
        assert.equal(after.journal,null);
        await context.close();
        console.log('PASS standalone journal emergency export/discard '+browserType.name());
        checks++;
      }
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+checks+' standalone preview browser cases');
