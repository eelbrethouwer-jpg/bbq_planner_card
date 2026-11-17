/* v5.5.0 Live timeline, "Zo meteen" hero, automatic MEATER recognition and freshness (Playwright, Chromium + WebKit, 390 px).
   FIXTURES ONLY: a simulated Home Assistant card host (the real dist/bbq_planner_card.js with fake hass.states) and a fake
   browser clock. This is not a real Home Assistant, MEATER or physical iPhone test.
   Scenario "zoals gisteren": Ribeye 500 g (reverse sear), serve 18:30, no cook in the MEATER app (target, status and
   remaining unavailable). Put on the grill at 16:55; the core rises in 40 min from 9.5 to 45.5 °C at 121 °C.
   Optional: SCREENSHOTS_DIR=<dir> writes 390 px screenshots per engine. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const HOST=`<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#111"><script type="module">
import '/dist/bbq_planner_card.js';
const IDS={pro:'sensor.meater_probe_00e865be_',plus:'sensor.meater_probe_c7dbf045_'};
window.__states={};window.__connected=true;
const hass=()=>({states:window.__states,connected:window.__connected,callService:async()=>{},
  connection:{sendMessagePromise:async m=>m&&m.type==='history/history_during_period'?{}:{value:null},subscribeMessage:async()=>()=>{}}});
const card=document.createElement('bbq-planner-meater-card');document.body.append(card);card.setConfig({});card.hass=hass();
// FIXTURE: HA keeps last_updated when a value does not change (as HA does). extra = optional fields (last_reported).
window.__set=(probe,values,extra={})=>{
  const t=new Date(Date.now()-2000).toISOString(),s={...window.__states};
  for(const [k,v] of Object.entries(values)){const id=IDS[probe]+k,old=s[id];s[id]={state:String(v),last_updated:old&&old.state===String(v)?old.last_updated:t,...(extra[k]||{})};}
  window.__states=s;card.hass=hass();
};
window.__hass=()=>{card.hass=hass();};
window.__frame=()=>card.querySelector('iframe');
</script></body></html>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  if(req.url?.startsWith('/__ha-host')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(HOST);return;}
  const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const START='2026-11-16T15:55:00Z'; // 16:55 in Amsterdam
const KEY='kamado-bereidingsplanner-v1';
const idle=(core,ambient)=>({interne_temperatuur:core,omgevingstemperatuur:ambient,doeltemperatuur:'unavailable',kookstatus:'unavailable',
  kookt:'off',piektemperatuur:'unavailable',resterende_tijd:'unavailable',tijd_verstreken:'unavailable'});
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,{ha=true}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,
    timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.clock.install({time:new Date(START)});
  const page=await context.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await page.goto(origin+(ha?'/__ha-host':'/dist/BBQ_bereidingsplanner_MEATER_v4.html'),{waitUntil:'load'});
  const frame=()=>ha?page.frames().find(f=>f.url().includes('BBQ_bereidingsplanner')):page.mainFrame();
  await page.waitForFunction(()=>true);
  for(let i=0;i<50&&!(frame()&&await frame().locator('#v5-root').count());i++)await page.waitForTimeout(100);
  const s={context,page,f:frame(),errors,dialogs};
  // Helpers always use the current frame (s.f), also after an iframe reload.
  s.act=async a=>{await s.f.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);};
  s.text=sel=>s.f.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.set=(probe,values,extra)=>page.evaluate(([p,v,e])=>window.__set(p,v,e),[probe,values,extra||{}]);
  s.store=()=>s.f.evaluate(k=>localStorage.getItem(k),KEY);
  s.dishes=async()=>JSON.parse(await s.store()).dishes;
  return s;
}
async function reloadFrame(s){
  // Reload the planner iframe inside the HA host (as the HA app does after switching apps) and wait for the new document.
  await s.page.evaluate(()=>{window.__frame().contentWindow.location.reload();});
  for(let i=0;i<100;i++){
    await s.page.waitForTimeout(100);
    const f=s.page.frames().find(x=>x.url().includes('BBQ_bereidingsplanner')&&!x.isDetached());
    try{if(f&&await f.evaluate(()=>!!document.querySelector('#v5-root')&&document.readyState==='complete')){s.f=f;await s.page.waitForTimeout(150);return f;}}catch(e){}
  }
  throw new Error('iframe not reloaded');
}
async function startSession(s,names){
  await s.act('new');
  for(const n of names){await s.f.locator('[data-v5-recipe="'+n+'"]').click();await s.page.waitForTimeout(80);}
  await s.act('setup');
}
async function goLive(s){await s.act('prep');if(await s.f.locator('#v5-root [data-v5-act="prep-confirm"]').count())await s.act('prep-confirm');await s.act('live');}
async function rise(s,probe='pro',minutes=40){
  // 9.5 → 45.5 °C in 40 min at 121 °C: a reading every 4 minutes (+3.6 °C).
  let core=9.5;
  for(let m=4;m<=minutes;m+=4){await s.context.clock.fastForward('04:00');core+=3.6;await s.set(probe,idle(core.toFixed(1),121));}
  await s.page.waitForTimeout(100);
}
const tick30=async s=>{await s.context.clock.runFor(31000);await s.page.waitForTimeout(80);};

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   // 1. "Zoals gisteren": hero follows reality, Pro linked automatically (old plan without probe), timeline, no redraw.
   {
    const s=await open(browser);
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);
    // FIXTURE "old data": a plan saved before v5.5 without probe and without meaterAuto (not a choice of the user).
    await s.f.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k));for(const d of p.dishes){d.meater='none';delete d.meaterAuto}localStorage.setItem(k,JSON.stringify(p));},KEY);
    const f=s.f=await reloadFrame(s);
    // v5.5 (bug 2): an active session reopens on the last screen after the iframe reloads, not on Vandaag.
    ok(await f.evaluate(()=>document.querySelector('#v5-root').dataset.screen)==='setup',engineName+': reload reopens step 2');
    ok((await s.dishes())[0].meater==='none',engineName+': fixture without probe');
    await goLive(s);
    ok(/Steek grote kamado aan/.test(await s.text('.v5-hero')),engineName+': before the start the hero follows the planning');
    const id=(await s.dishes())[0].id;
    await f.locator('[data-v5-dishcard="'+id+'"] [data-v5-act="phase:'+id+':cooking"]').click();await s.page.waitForTimeout(150);
    const heroAfter=await s.text('.v5-hero');
    ok(!/Steek grote kamado aan/.test(heroAfter),engineName+': after "Op BBQ gelegd" no "Steek grote kamado aan": '+heroAfter);
    let d0=(await s.dishes())[0];
    ok(d0.meater==='pro'&&d0.meaterAuto===true,engineName+': active MEATER Pro linked automatically '+JSON.stringify({m:d0.meater,a:d0.meaterAuto}));
    ok(/MEATER Pro automatisch gekoppeld · wijzigen/.test(await s.text('[data-v5-dishcard="'+id+'"] [data-v5-slot="link"]')),engineName+': visible auto-link line');
    const fire=JSON.parse(await s.store()).v46Done;
    ok(Object.keys(fire).some(k=>k.endsWith('|large:fire')),engineName+': lighting the large kamado ticked off by the start');
    await rise(s);
    await f.evaluate(()=>{window.__content=document.querySelector('#v5-root .v5-content');window.__tl=document.querySelector('[data-v5-tl]');});
    await tick30(s); // 17:35:3x
    const hero=await s.text('.v5-hero');
    ok(/Stook de grote kamado op naar ~250 °C/.test(hero),engineName+': hero around 47 °C: '+hero);
    ok(/Ribeye 500 g bereikt 47 °C \(einde indirect\) over ±\d+ min/.test(hero),engineName+': phase target from the ETA-module: '+hero);
    ok(await f.evaluate(()=>document.querySelector('#v5-root .v5-content')===window.__content&&document.querySelector('[data-v5-tl]')===window.__tl),engineName+': 30-s refresh keeps Live and the timeline element');
    // Timeline inside the first screen, now line at the right place, early ETA: expected block left of the planned frame.
    // Instant scroll to the top (the page may use smooth scrolling; the fake clock must not leave it half-way).
    await f.evaluate(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});document.scrollingElement.scrollTop=0;});await s.page.waitForTimeout(80);
    ok(await f.evaluate(()=>document.scrollingElement.scrollTop)===0,engineName+': scrolled to the top');
    const g=await f.evaluate(()=>{
      const body=document.querySelector('.v5-tl-body'),tl=document.querySelector('[data-v5-tl]').getBoundingClientRect();
      const track=document.querySelector('.v5-tl-track').getBoundingClientRect(),now=document.querySelector('[data-v5-now]').getBoundingClientRect();
      const from=+body.dataset.v5From,to=+body.dataset.v5To;
      const row=document.querySelector('.v5-tl-row'),plans=[...row.querySelectorAll('.v5-tl-plan')].map(e=>e.getBoundingClientRect());
      const segs=[...row.querySelectorAll('.v5-tl-seg')].map(e=>e.getBoundingClientRect());
      return {top:tl.top,bottom:tl.bottom,vh:innerHeight,nowX:now.left+now.width/2,expectX:track.left+(Date.now()-from)/(to-from)*track.width,
        planRight:Math.max(...plans.map(r=>r.right)),expRight:Math.max(...segs.map(r=>r.right)),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    ok(g.top>=0&&g.bottom<=g.vh,engineName+': timeline within the first screen '+JSON.stringify(g));
    ok(Math.abs(g.nowX-g.expectX)<=2,engineName+': now line at the right position '+JSON.stringify(g));
    ok(g.expRight<g.planRight-10,engineName+': early estimate moves the expected block left of the planned frame '+JSON.stringify(g));
    ok(g.overflow<=1,engineName+': no horizontal overflow');
    const tl=await s.text('[data-v5-tl]');
    ok(/gepland/.test(tl)&&/verwacht/.test(tl)&&/Alle stappen/.test(tl),engineName+': legend and "Alle stappen"');
    // A sensor update never rebuilds the timeline (it follows the 30-s timer).
    const before=await f.evaluate(()=>document.querySelector('[data-v5-tl]').innerHTML);
    await s.set('pro',idle('46.0','121'));await s.page.waitForTimeout(120);
    ok(await f.evaluate(h=>document.querySelector('[data-v5-tl]').innerHTML===h&&document.querySelector('#v5-root .v5-content')===window.__content,before),engineName+': sensor update leaves timeline and Live DOM alone');
    // Tasks: expected next to planned when more than 5 min apart.
    ok(/Gepland 18:22 · verwacht \d\d:\d\d/.test(await s.text('.v5-next-tasks')),engineName+': task shows expected next to planned');
    if(process.env.SCREENSHOTS_DIR){
      await mkdir(process.env.SCREENSHOTS_DIR,{recursive:true});
      await s.page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,engineName+'-live-1736-zo-meteen.png')});
    }
    // 2. "Pas planning aan op verwachting": before/after first; storage byte-identical until confirmed.
    const saved=await s.store();
    ok(await f.locator('[data-v5-act="adjust-open"]').count()===1,engineName+': adjust button when the expected serve time differs > 10 min');
    await s.act('adjust-open');
    const panel=await s.text('.v5-tl-confirm');
    ok(/Serveren 18:30 → \d\d:\d\d/.test(panel),engineName+': before/after shown '+panel);
    ok(await s.store()===saved,engineName+': opening the proposal does not write');
    if(process.env.SCREENSHOTS_DIR)await s.page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,engineName+'-pas-planning-aan.png')});
    await s.act('adjust-cancel');
    ok(await s.store()===saved,engineName+': cancel leaves storage byte-identical');
    await tick30(s);
    ok(await s.store()===saved,engineName+': timer refresh does not write');
    await s.act('adjust-open');
    const target=panel.match(/Serveren 18:30 → (\d\d:\d\d)/)[1];
    await f.locator('[data-v5-act^="adjust-apply:"]').click();await s.page.waitForTimeout(150);
    ok(JSON.parse(await s.store()).mealTime===target,engineName+': confirmed proposal sets the shown serve time '+target);
    // Past 47 °C: sear.
    await s.context.clock.fastForward('02:00');await s.set('pro',idle('47.6','121'));await tick30(s);
    ok(/Schroei Ribeye 500 g direct op ~250 °C/.test(await s.text('.v5-hero')),engineName+': past the phase target the hero says sear');
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   // 3. Recognition rules: Plus measuring → relink an automatic default; manual "Geen" and other dishes' probes untouched.
   {
    const s=await open(browser);
    await s.set('plus',idle('8.0','15'));
    await startSession(s,['Ribeye 500 g','Kippenpoten']);
    // v5.7: Kippenpoten now lands on the small kamado by itself (fewest conflicts). This scenario keeps both dishes on the large
    // kamado, as before: the user chooses "Groot" by hand (a manual choice is never changed by the app).
    {const kip=(await s.dishes())[1].id;await s.f.locator('select[data-v5-kamado="'+kip+'"]').selectOption('large');await s.page.waitForTimeout(80);}
    let [rib,chk]=await s.dishes();
    ok(rib.meater==='pro'&&rib.meaterAuto===true,engineName+': in the HA card the default Pro is still linked, marked automatic');
    // Kippenpoten: the user chooses "Geen thermometer" explicitly.
    await s.f.locator('select[data-v5-meater="'+chk.id+'"]').selectOption('plus');await s.page.waitForTimeout(80);
    await s.f.locator('select[data-v5-meater="'+chk.id+'"]').selectOption('none');await s.page.waitForTimeout(80);
    chk=(await s.dishes())[1];
    ok(chk.meater==='none'&&chk.meaterAuto===false,engineName+': manual "Geen" stored as a choice');
    await goLive(s);
    await s.f.locator('[data-v5-act="phase:'+chk.id+':cooking"]').click();await s.page.waitForTimeout(120);
    await s.set('plus',idle('9.1','120'));await s.page.waitForTimeout(120);
    ok((await s.dishes())[1].meater==='none',engineName+': a manual "Geen" is never overwritten');
    await s.f.locator('[data-v5-act="phase:'+rib.id+':cooking"]').click();await s.page.waitForTimeout(120);
    [rib,chk]=await s.dishes();
    ok(rib.meater==='plus'&&rib.meaterAuto===true,engineName+': the measuring Plus replaces the automatic default Pro '+rib.meater);
    ok(/MEATER Plus automatisch gekoppeld/.test(await s.text('[data-v5-dishcard="'+rib.id+'"] [data-v5-slot="link"]')),engineName+': visible line');
    // "wijzigen" on the card: a manual choice from then on.
    await s.f.locator('[data-v5-dishcard="'+rib.id+'"] [data-v5-act="probe-edit:'+rib.id+'"]').click();await s.page.waitForTimeout(80);
    await s.f.locator('[data-v5-dishcard="'+rib.id+'"] select[data-v5-meater]').selectOption('pro');await s.page.waitForTimeout(120);
    rib=(await s.dishes())[0];
    ok(rib.meater==='pro'&&rib.meaterAuto===false,engineName+': card choice is manual');
    await s.set('plus',idle('10.2','120'));await s.page.waitForTimeout(120);
    ok((await s.dishes())[0].meater==='pro',engineName+': a manual choice is never overwritten by recognition');
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   // 4. Freshness (review PR #44, finding 2): with and without last_reported, unavailable, lost HA connection.
   {
    const s=await open(browser);
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);await goLive(s);
    const id=(await s.dishes())[0].id,core=()=>s.text('[data-v5-dishcard="'+id+'"] [data-v5-slot="core"]');
    await s.f.locator('[data-v5-act="phase:'+id+':cooking"]').click();await s.page.waitForTimeout(100);
    await rise(s,'pro',24); // 9.5 → 31.1 °C
    // a) no last_reported (today's HA frontend): unchanged for 6 min → "geen verandering sinds", value and estimate kept.
    await s.context.clock.runFor(6*60000);await s.page.waitForTimeout(100);
    let c=await core();
    ok(/31,1 °C/.test(c)&&/Geen verandering sinds \d\d:\d\d/.test(c)&&!/● LIVE/.test(c),engineName+': unchanged value without last_reported: '+c);
    ok(!/Laatste schatting/.test(await s.text('[data-v5-dishcard="'+id+'"] [data-v5-slot="eta"]')),engineName+': estimate does not expire while the sensor is available');
    // b) FIXTURE last_reported (HA ≥ 2024.3 core attribute; only if a frontend ever provides it): fresh report → LIVE.
    const rep=await s.page.evaluate(()=>new Date(Date.now()-3000).toISOString()); // browser (fake) clock
    await s.set('pro',idle('31.1','121'),{interne_temperatuur:{last_reported:rep}});await s.page.waitForTimeout(100);
    c=await core();
    ok(/31,1 °C/.test(c)&&/● LIVE/.test(c),engineName+': fresh last_reported → LIVE although the value did not change: '+c);
    await s.context.clock.runFor(6*60000);await s.page.waitForTimeout(100);
    c=await core();
    ok(!/31,1/.test(c)&&/Geen verse live MEATER-meting/.test(c),engineName+': last_reported 6 min old → stale, no value: '+c);
    // c) HA frontend disconnected → the card reports the probes unavailable → no value.
    await s.set('pro',idle('33.0','121'));await s.page.waitForTimeout(100);
    ok(/33,0 °C/.test(await core()),engineName+': new value');
    await s.page.evaluate(()=>{window.__connected=false;window.__hass();});await s.page.waitForTimeout(120);
    c=await core();
    ok(!/33,0/.test(c)&&/Kerntemperatuur niet beschikbaar/.test(c),engineName+': lost HA connection → no value: '+c);
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   // 5. Public website (no HA): no automatic probe, no LIVE, timeline from the planning.
   {
    const s=await open(browser,{ha:false});
    await startSession(s,['Ribeye 500 g']);
    ok((await s.dishes())[0].meater==='none',engineName+': no probe linked on the public website');
    await goLive(s);
    ok(await s.f.locator('[data-v5-tl] .v5-tl-row').count()===1,engineName+': timeline from the planning');
    ok(!/LIVE/.test(await s.text('#v5-root')),engineName+': nowhere LIVE');
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   // 6. Bug (user, HA panel-view): after switching apps the HA app reloads the iframe → reopen the last screen, scroll included.
   {
    const s=await open(browser);
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g','Kippenpoten']);await goLive(s);
    await s.f.evaluate(()=>window.scrollTo({top:600,left:0,behavior:'instant'}));
    await s.context.clock.runFor(1500);await s.page.waitForTimeout(100); // throttled save of the scroll position
    const y0=await s.f.evaluate(()=>window.scrollY);
    ok(y0>300,engineName+': scrolled on Live '+y0);
    await reloadFrame(s);
    ok(await s.f.evaluate(()=>document.querySelector('#v5-root').dataset.screen)==='live',engineName+': reload reopens Live');
    ok(Math.abs(await s.f.evaluate(()=>window.scrollY)-y0)<=4,engineName+': scroll position restored');
    ok(await s.f.locator('#v5-nav [aria-current="page"]').getAttribute('data-v5-act')==='live',engineName+': nav marks Live');
    // Legacy page (Meer) is remembered too.
    await s.f.locator('#v5-nav [data-v5-act="more"]').click();await s.page.waitForTimeout(150);
    await reloadFrame(s);
    ok(await s.f.evaluate(()=>document.body.classList.contains('v5-legacy')),engineName+': reload reopens Meer (legacy page)');
    ok(await s.f.locator('#v5-nav [aria-current="page"]').getAttribute('data-v5-act')==='more',engineName+': nav marks Meer');
    const meta=JSON.parse(await s.f.evaluate(()=>localStorage.getItem('bbq-v5-session-v1')));
    ok(meta.version===1&&meta.active===true&&meta.view&&typeof meta.view.at==='number'&&meta.view.legacyTab==='more',engineName+': optional field view in bbq-v5-session-v1');
    // The 12-hour limit is tested in tests/v550-session-restore.mjs (jsdom, storage fixture): a closing page saves its view again.
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   // 7. Bug (user): step 1 tap toggles a recipe; "+1" adds a portion; a started dish is never removed by a tap.
   {
    const s=await open(browser,{ha:false});
    await s.act('new');
    const tap=async n=>{await s.f.locator('[data-v5-recipe="'+n+'"]').click();await s.page.waitForTimeout(100);};
    await tap('Ribeye 500 g');
    ok((await s.dishes()).length===1,engineName+': tap adds');
    ok(/tik om te verwijderen/.test(await s.text('[data-v5-recipe="Ribeye 500 g"]')),engineName+': label says tap to remove');
    ok(/^Verwijder uit menu: /.test(await s.f.locator('[data-v5-recipe="Ribeye 500 g"]').getAttribute('aria-label')),engineName+': aria-label');
    await tap('Ribeye 500 g');
    ok((await s.dishes()).length===0,engineName+': second tap removes');
    await tap('Ribeye 500 g');
    const first=(await s.dishes())[0].id;
    await s.f.locator('[data-v5-extra="'+first+'"]').click();await s.page.waitForTimeout(100);
    ok((await s.dishes()).length===2,engineName+': "+1" adds an extra portion');
    ok(/\(2×\)/.test(await s.text('[data-v5-recipe="Ribeye 500 g"]')),engineName+': count shown');
    await tap('Ribeye 500 g');
    const left=await s.dishes();
    ok(left.length===1&&left[0].id===first,engineName+': tap removes the last added portion');
    // Started dish: put it on the grill, return to step 1, tap → message only.
    await s.act('setup');await goLive(s);
    await s.f.locator('[data-v5-act="phase:'+first+':cooking"]').click();await s.page.waitForTimeout(100);
    await s.act('prep');if(await s.f.locator('#v5-root [data-v5-act="prep-confirm"]').count())await s.act('prep-confirm');await s.act('setup');await s.act('select');
    const before=await s.store();
    await tap('Ribeye 500 g');
    ok(await s.store()===before,engineName+': started dish not removed by a tap (storage unchanged)');
    ok(s.dialogs.some(m=>/al gestart/.test(m)),engineName+': message shown');
    ok(s.errors.length===0,engineName+': no page errors '+s.errors.join(' | '));
    await s.context.close();
   }
   console.log('OK v5.5 live timeline: '+engineName+' 390px');
  }finally{await browser.close();}
 }
 console.log('PASS v5.5 live timeline, hero, auto MEATER and freshness: '+checks+' checks (chromium, webkit)');
}finally{server.close();}
