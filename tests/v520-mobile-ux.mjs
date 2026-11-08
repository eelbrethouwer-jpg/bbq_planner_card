/* BBQ Planner v5.2 mobile UX regression (Chromium + WebKit).
   Browser emulation only: NOT a physical iPhone, Home Assistant or MEATER test.
   The iOS safe area is simulated by overriding --v5-safe-top/--v5-safe-bottom,
   the same tokens the app derives from env(safe-area-inset-*). */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const APP=origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html';
const SAFE_TOP=59,SAFE_BOTTOM=34;
const ALLOWED_KEYS=['kamado-bereidingsplanner-v1','bbq-v5-session-v1','bbq-v5-previous-plan-v1','bbq-v501-recipe-tab-v1','bbq-v47-tab','kamado-reviews-v1'];
const PLAN_KEYS=['availableFrom','date','dateMode','dishes','equipment','mealTime','preheatLarge','preheatSmall','smart','v46Done','v46MultiServe','v5Actual'];
const engines=(process.env.BBQ_ENGINES||'chromium,webkit').split(',');
const widths=[320,375,390,430,768,1280];
let checks=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);checks++;};

try{
 for(const engineName of engines){
  const engine={chromium,webkit}[engineName];
  const browser=await engine.launch({headless:true});
  try{
   for(const width of widths){
    const mobile=width<1024,name=engineName+' '+width+'px';
    const context=await browser.newContext({viewport:{width,height:mobile?844:900},isMobile:mobile&&engineName!=='firefox',
      hasTouch:mobile,timezoneId:'Europe/Amsterdam',serviceWorkers:'block'});
    // Install the fixed clock BEFORE the interval spy so the spy wraps the clock's timers.
    await context.clock.setFixedTime(new Date('2026-11-08T15:40:00Z'));
    await context.addInitScript(([top,bottom])=>{
      const original=window.setInterval;
      window.setInterval=(fn,delay,...args)=>{if(delay===30000)window.__liveRefresh=fn;return original(fn,delay,...args)};
      const style=()=>{const el=document.createElement('style');el.textContent=':root{--v5-safe-top:'+top+'px!important;--v5-safe-bottom:'+bottom+'px!important}';document.head.append(el)};
      if(document.head)style();else document.addEventListener('DOMContentLoaded',style,{once:true});
    },[SAFE_TOP,SAFE_BOTTOM]);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await page.locator('#v5-root').waitFor();
    const nav=page.locator('#v5-nav');
    const layout=async label=>{
      const r=await page.evaluate(()=>{
        const visible=el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&b.height>0;};
        const heads=[...document.querySelectorAll('#v5-root .v5-top,#v5-root .v5-live-bar,#v5-back,.v47-page:not([hidden]) .v47-page-head')].filter(visible);
        const small=[...document.querySelectorAll('#v5-root button,#v5-root summary,#v5-root input,#v5-root select,#v5-nav button,#v5-back,'+
          'body.v5-legacy .v47-page:not([hidden]) .v520-chip,body.v5-legacy .v47-page:not([hidden]) .v520-group summary,#v520-library-tools>summary,#v501-recipe-tabs button')]
          .filter(visible).filter(el=>el.getBoundingClientRect().height<44).map(el=>(el.id||el.className||el.tagName)+':'+Math.round(el.getBoundingClientRect().height));
        return {scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
          firstTop:Math.min(...heads.map(el=>el.getBoundingClientRect().top)),
          navs:[...document.querySelectorAll('nav')].filter(visible).length,small};
      });
      ok(r.scroll<=r.client+1,name+' '+label+': no horizontal overflow '+JSON.stringify(r));
      ok(r.navs===1,name+' '+label+': exactly one visible navigation');
      ok(r.firstTop>=SAFE_TOP,name+' '+label+': header clears the iOS status bar '+r.firstTop);
      ok(r.small.length===0,name+' '+label+': touch targets >=44px '+r.small.join(', '));
    };
    const shot=async label=>{
      if(!process.env.SCREENSHOTS_DIR||width!==390)return;
      await mkdir(process.env.SCREENSHOTS_DIR,{recursive:true});
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,engineName+'-'+label+'.png')});
    };

    // Vandaag without an active session: one primary action = start a new session.
    await layout('today');
    ok(await page.locator('#v5-root .v5-btn.primary').count()===1,name+': one primary action on Vandaag');
    ok(await page.locator('#v5-root .v5-btn.primary[data-v5-act="new"]').count()===1,name+': new session is primary');
    await shot('vandaag-nieuw');

    // New session through the real flow, two dishes per kamado.
    await page.locator('#v5-root [data-v5-act="new"]').click();
    for(const recipe of ['Pulled pork op brood','Ribeye 500 g','Krieltjes','Warmgerookte zalm op brioche'])
      await page.locator('[data-v5-recipe="'+recipe+'"]').click();
    await page.locator('#v5-root [data-v5-act="setup"]').click();
    await page.locator('[data-v5-kamado]').nth(2).selectOption('small');
    await page.locator('[data-v5-kamado]').nth(3).selectOption('small');
    await page.locator('#v5-root [data-v5-act="prep"]').click();
    await page.locator('#v5-root .v5-row [data-v5-act="live"]').click();
    const planBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('kamado-bereidingsplanner-v1')));

    // Live cockpit order and focus.
    await layout('live');
    const order=await page.evaluate(()=>{const c=document.querySelector('#v5-root .v5-content');
      return ['.v5-live-bar','.v5-hero','.v5-kamados','.v5-next-tasks','[data-v5-dish]','.v5-action-grid'].map(s=>[...c.children].indexOf(c.querySelector(s)));});
    ok(order.every(i=>i>=0)&&order.every((v,i)=>i===0||v>order[i-1]),name+': Live order status → NU DOEN → kamado → next → details → actions '+order);
    ok(await page.locator('#v5-root .v5-btn.primary').count()===1,name+': exactly one primary action on Live');
    if(mobile){
      const done=await page.locator('.v5-hero [data-v5-act^="done:"]').boundingBox();
      ok(done.y>=SAFE_TOP&&done.y+done.height<=844-80,name+': NU DOEN action visible above the tab bar '+JSON.stringify(done));
    }
    ok(await page.locator('.v5-next-tasks [data-v5-check]').count()<=3,name+': at most three next tasks');
    const total=await page.evaluate(()=>window.__liveTotal=document.querySelectorAll('.v5-next-tasks [data-v5-check]').length);
    if(await page.locator('[data-v5-act="show-tasks"]').count()){
      await page.locator('[data-v5-act="show-tasks"]').click();
      ok(await page.locator('.v5-next-tasks [data-v5-check]').count()>total,name+': all tasks one tap away');
      await page.locator('[data-v5-act="show-tasks"]').click();
    }
    // Sticky status bar stays below the status bar while scrolling.
    await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));
    const barTop=await page.locator('.v5-live-bar').evaluate(el=>el.getBoundingClientRect().top);
    ok(barTop>=SAFE_TOP-1,name+': sticky Live bar clears status bar when scrolled '+barTop);
    const liveBg=await page.locator('.v5-live-bar').evaluate(el=>getComputedStyle(el).backgroundColor);
    ok(liveBg==='rgb(16, 35, 42)',name+': sticky Live bar has fully opaque background '+liveBg);
    await shot('live');

    // A whole kamado card opens that dish's details.
    const card=page.locator('.v5-kamados button.v5-kamado-card').first();
    const dishId=(await card.getAttribute('data-v5-act')).slice(5);
    await card.click();
    await page.waitForTimeout(700); // openDish uses smooth scrolling; let it settle before measuring
    ok(await page.locator('[data-v5-dish="'+dishId+'"]').getAttribute('open')==='',name+': kamado card opens dish details');

    // Re-render keeps open details and scroll position.
    const step=page.locator('[data-v5-dish="'+dishId+'"] .v5-recipestage details').first();
    if(await step.count()){
      await step.locator('summary').click();
      const key=await step.getAttribute('data-v5-key');
      await step.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
      await page.waitForTimeout(200);
      const y=await page.evaluate(()=>window.scrollY);
      await page.evaluate(()=>{window.__liveRefresh();document.dispatchEvent(new Event('visibilitychange'));});
      ok(await page.locator('[data-v5-key="'+key+'"]').getAttribute('open')==='',name+': open step survives refresh');
      ok(Math.abs(await page.evaluate(()=>window.scrollY)-y)<=5,name+': scroll survives refresh');
    }

    // Completing NU DOEN uses the existing task state.
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    const taskId=(await page.locator('.v5-hero [data-v5-act^="done:"]').getAttribute('data-v5-act')).slice(5);
    await page.locator('.v5-hero [data-v5-act^="done:"]').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kamado-bereidingsplanner-v1')));
    ok(saved.v46Done[taskId]===true&&typeof saved.v5Actual[taskId]==='number',name+': task completion and actual time persisted');
    ok(JSON.stringify(Object.keys(saved).sort())===JSON.stringify(PLAN_KEYS),name+': plan schema unchanged');
    ok(JSON.stringify(saved.dishes.map(d=>[d.id,d.cook,d.rest,d.kamado]))===JSON.stringify(planBefore.dishes.map(d=>[d.id,d.cook,d.rest,d.kamado])),
      name+': UI never changes durations or kamado assignment');

    // MEATER graph and focus mode stay reachable from Live.
    await page.locator('#v5-root [data-v5-act="cooking"]').click();
    ok(await page.locator('#live-panel').isVisible()&&await page.locator('#v47-fullscreen').isVisible(),name+': MEATER panel and focus button reachable');
    await layout('cooking');
    await page.locator('#v47-fullscreen').click();
    const dialog=await page.locator('#v45-cook-screen').evaluate(el=>({open:el.classList.contains('open'),pad:parseFloat(getComputedStyle(el).paddingTop)}));
    ok(dialog.open&&dialog.pad>=SAFE_TOP,name+': focus mode opens below the status bar '+JSON.stringify(dialog));
    await page.locator('#v45-close').click();
    ok(await page.locator('#v5-back').textContent()==='← Live',name+': back label from Live MEATER says Live');
    await page.locator('#v5-back').click();
    ok(await nav.locator('[aria-current="page"]').getAttribute('data-v5-act')==='live',name+': back returns to Live');
    ok(await page.locator('#v5-root').getAttribute('data-screen')==='live'&&!await page.locator('#v5-back').isVisible(),name+': Live screen shown, back button hidden');

    // Vandaag with an active session: resume is the primary action.
    await nav.locator('[data-v5-act="home"]').click();
    await layout('today active');
    ok(/Hervat live bereiding/.test(await page.locator('#v5-root').textContent()),name+': active session can be resumed');
    ok(await page.locator('#v5-root .v5-btn.primary[data-v5-act="resume"]').count()===1&&await page.locator('#v5-root .v5-btn.primary').count()===1,
      name+': resume is the only primary action');
    await shot('vandaag-actief');

    // Recepten: existing controllers retained, management behind one disclosure.
    await nav.locator('[data-v5-act="recipes"]').click();
    await layout('recipes');
    ok(await page.locator('#v47-recipes #library-panel').count()===1,name+': one library panel on Recepten');
    for(const id of ['library-export','library-import','library-import-mode','library-refresh','library-file','library-sync-status','review-sync-status'])
      ok(await page.locator('#v520-library-tools #'+id).count()===1,name+': '+id+' kept inside library tools');
    ok(await page.locator('#library-feedback').evaluate(el=>!el.closest('#v520-library-tools')),name+': import feedback stays visible');
    for(const tab of ['generate','junkie','library']){
      await page.locator('[data-v501-recipe-tab="'+tab+'"]').click();
      ok(await page.locator('[data-v501-recipe-tab="'+tab+'"]').getAttribute('aria-selected')==='true',name+': recipe tab '+tab);
    }
    await shot('recepten');

    // Meer: four groups and every existing function still present inside #v47-more.
    await nav.locator('[data-v5-act="more"]').click();
    await layout('more');
    const groups=await page.locator('#v47-more .v520-group').evaluateAll(els=>els.map(el=>el.id));
    ok(JSON.stringify(groups)===JSON.stringify(['v520-more-koken','v520-more-koppelingen','v520-more-gegevens','v520-more-app']),name+': four ordered groups '+groups);
    const expected={koken:['v45-shopping','v46-pantry-list','v46-history'],koppelingen:['v46-notify','v520-open-cooking'],
      gegevens:['json-export','json-import','print','export','reset','share-public'],app:['v49-install','v49-update','v49-share','v49-install-steps']};
    for(const [group,ids] of Object.entries(expected))for(const id of ids)
      ok(await page.locator('#v520-more-'+group+' #'+id).count()===1,name+': '+id+' in group '+group);
    ok(await page.locator('#v47-more footer.footer').count()===1,name+': safety information retained');
    ok(await page.locator('#v47-more nav').count()===0,name+': no extra navigation element');
    await page.locator('#v47-more .v520-chip').nth(2).click();
    await shot('meer');

    // M1: terugknop = werkelijke bestemming. Vandaag → Meer → MEATER → ← Meer → ← Vandaag.
    const current=()=>nav.locator('[aria-current="page"]').getAttribute('data-v5-act');
    const backText=()=>page.locator('#v5-back').textContent();
    const openMeaterFromMore=async()=>{
      await page.locator('#v520-meater-fold').evaluate(el=>{el.open=true});
      await page.locator('#v520-open-cooking').click();
    };
    ok(await backText()==='← Vandaag',name+': Meer opened from Vandaag says ← Vandaag');
    await openMeaterFromMore();
    ok(await backText()==='← Meer',name+': MEATER opened from Meer says ← Meer');
    ok(await current()==='more',name+': Meer stays active in bottom navigation on MEATER');
    ok(await page.locator('#live-panel').isVisible()&&await page.locator('#v47-fullscreen').isVisible(),name+': MEATER panel and focus reachable from Meer');
    await page.locator('#v47-fullscreen').click();
    ok(await page.locator('#v45-cook-screen').evaluate(el=>el.classList.contains('open')),name+': focus mode opens from Meer route');
    await page.locator('#v45-close').click();
    await page.locator('#v5-back').click();
    ok(await page.locator('#v47-more').isVisible()&&await current()==='more',name+': ← Meer returns to Meer');
    {const r=await page.locator('#v520-open-cooking').evaluate(el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,vh:innerHeight,y:scrollY}});
     ok(r.y>0&&r.top>=0&&r.bottom<=r.vh,name+': Meer scroll position restored (MEATER button back in view) '+JSON.stringify(r));}
    ok(await backText()==='← Vandaag',name+': back on Meer now points to Vandaag');
    await page.locator('#v5-back').click();
    ok(await page.locator('#v5-root').getAttribute('data-screen')==='home'&&await current()==='home'&&!await page.locator('#v5-back').isVisible(),name+': ← Vandaag returns to Vandaag');

    // Live → Meer → MEATER → ← Meer → ← Live → Live.
    await nav.locator('[data-v5-act="live"]').click();
    await nav.locator('[data-v5-act="more"]').click();
    ok(await backText()==='← Live',name+': Meer opened from Live says ← Live');
    await openMeaterFromMore();
    ok(await backText()==='← Meer'&&await current()==='more',name+': Live → Meer → MEATER says ← Meer');
    await page.locator('#v5-back').click();
    ok(await page.locator('#v47-more').isVisible()&&await backText()==='← Live',name+': back to Meer, then points to Live');
    await page.locator('#v5-back').click();
    ok(await page.locator('#v5-root').getAttribute('data-screen')==='live'&&await current()==='live',name+': ← Live returns to Live');

    // Bottom navigation from MEATER (via Meer) leaves the legacy route cleanly.
    await nav.locator('[data-v5-act="more"]').click();
    await openMeaterFromMore();
    await nav.locator('[data-v5-act="recipes"]').click();
    ok(await current()==='recipes'&&await backText()==='← Live',name+': bottom nav from MEATER clears the Meer return step');
    await page.locator('#v5-back').click();
    ok(await page.locator('#v5-root').getAttribute('data-screen')==='live',name+': back after nav switch returns to the real origin');

    // History shortcut from Vandaag opens the history fold.
    await nav.locator('[data-v5-act="home"]').click();
    await page.locator('#v5-root [data-v5-act="history"]').click();
    ok(await page.locator('#v46-history').evaluate(el=>el.closest('details.v47-fold').open),name+': history shortcut opens history');
    // The legacy back button is not sticky: it must scroll out instead of covering cards.
    await page.evaluate(()=>window.scrollTo({top:550,behavior:'instant'}));
    const backFlow=await page.locator('#v5-back').evaluate(el=>({
      position:getComputedStyle(el).position,bottom:el.getBoundingClientRect().bottom,scrollY:window.scrollY
    }));
    ok(backFlow.position==='static'&&backFlow.scrollY>=500&&backFlow.bottom<SAFE_TOP,
      name+': legacy back button scrolls out without overlaying content '+JSON.stringify(backFlow));
    await page.locator('#v5-back').click();
    ok(await page.locator('#v5-root').getAttribute('data-screen')==='home',name+': back remains usable after scroll');

    // Storage contract.
    const keys=await page.evaluate(()=>Object.keys(localStorage).sort());
    ok(keys.every(k=>ALLOWED_KEYS.includes(k)),name+': no new storage keys '+keys);

    // Separate v6 preview still reads the same plan without writing it.
    const raw=await page.evaluate(()=>localStorage.getItem('kamado-bereidingsplanner-v1'));
    const preview=await context.newPage();
    await preview.goto(origin+'/v6/preview.html');
    await preview.locator('#bbq6-beta-panel').waitFor({timeout:15000});
    ok(await preview.evaluate(()=>localStorage.getItem('kamado-bereidingsplanner-v1'))===raw,name+': v6 preview leaves the v5 plan untouched');
    ok(errors.length===0,name+': no page errors '+errors.join(' | '));
    console.log('OK v5.2 mobile UX:',name);
    await context.close();
   }
  }finally{await browser.close();}
 }
 console.log('PASS v5.2 mobile UX: '+checks+' checks ('+engines.join(', ')+')');
}finally{
 await new Promise(resolve=>server.close(resolve));
}
