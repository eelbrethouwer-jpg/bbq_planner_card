/* v5.8.0 schatting zonder probe + handmatige kerninvoer (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam),
   echte opslag van v5.7.0 (tests/fixtures/v570-session.json) en een nagebootste Home Assistant-kaart (de echte dist/bbq_planner_card.js
   met een nep-hass). Geen echte Home Assistant, MEATER of iPhone.
   Scenario's: 1) oude data (v5.7.0) laadt foutloos, bereik + label + veiligheidstekst; 2) "Kern invoeren": validatie, 62 °C om 14:20,
   tweede invoer = helling; 3) afwijkende kamadotemperatuur; 4) v5.2.3-contract: alleen slots, één 1-s- en één 30-s-timer, invoer blijft
   staan; 5) Home Assistant: prik-melding één keer, geen herhaling binnen 15 min, verse probe heeft voorrang; 6) 320 px zonder overflow.
   Optioneel: SCREENSHOTS_DIR=<map> schrijft screenshots per engine; ENGINES=chromium beperkt de engines. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const FIXTURE=JSON.parse(await readFile(path.join(root,'tests/fixtures/v570-session.json'),'utf8'));
const KEY='kamado-bereidingsplanner-v1',SKEY='bbq-v5-session-v1';
const HOST=`<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#111"><script type="module">
import '/dist/bbq_planner_card.js';
const IDS={pro:'sensor.meater_probe_00e865be_',plus:'sensor.meater_probe_c7dbf045_'};
window.__states={};window.__connected=true;window.__calls=[];
const hass=()=>({states:window.__states,connected:window.__connected,
  services:{notify:{mobile_app_test_telefoon:{}}},devices:{},
  callService:async(domain,service,data)=>{window.__calls.push({domain,service,message:data&&data.message,data:JSON.parse(JSON.stringify(data||{}))});},
  connection:{sendMessagePromise:async m=>m&&m.type==='history/history_during_period'?{}:{value:null},subscribeMessage:async()=>()=>{}}});
const card=document.createElement('bbq-planner-meater-card');document.body.append(card);card.setConfig({});card.hass=hass();
window.__set=(probe,values)=>{
  const t=new Date(Date.now()-2000).toISOString(),s={...window.__states};
  for(const [k,v] of Object.entries(values)){const id=IDS[probe]+k,old=s[id];s[id]={state:String(v),last_updated:old&&old.state===String(v)?old.last_updated:t};}
  window.__states=s;card.hass=hass();
};
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
const idle=(core,ambient)=>({interne_temperatuur:core,omgevingstemperatuur:ambient,doeltemperatuur:'unavailable',kookstatus:'unavailable',
  kookt:'off',piektemperatuur:'unavailable',resterende_tijd:'unavailable',tijd_verstreken:'unavailable'});
// Europe/Amsterdam (CET, UTC+1): 13:30 = 12:30Z.
const Z=hhmm=>'2026-11-16T'+String(Number(hhmm.slice(0,2))-1).padStart(2,'0')+hhmm.slice(2)+':00Z';
const START_1330=Date.parse(Z('13:30'));
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const KIP='Kippenpoten';
const norm=t=>t.replace(/\s+/g,' ').trim();

// De fixture is de echte opslag van v5.7.0 (geen veld `manual`); `patch` zet alleen tijden/velden voor een scenario.
function seed(patch){
  const state=JSON.parse(JSON.stringify(FIXTURE.state)),session=JSON.parse(JSON.stringify(FIXTURE.session));
  if(patch)patch(state,session);
  return {state,session};
}
async function openPage(browser,time,{width=390,data=seed(),ha=false}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.addInitScript(([k,sk,payload])=>{
    window.__confirmCalls=0;const oc=window.confirm;window.confirm=(...a)=>{window.__confirmCalls++;return oc.apply(window,a)};
    if(payload&&!sessionStorage.getItem('__seeded')){localStorage.setItem(k,JSON.stringify(payload.state));localStorage.setItem(sk,JSON.stringify(payload.session));sessionStorage.setItem('__seeded','1')}
  },[KEY,SKEY,ha?null:data]);
  await context.clock.install({time:new Date(time)});
  // Na de nagebootste klok: telt de timers die de planner zelf aanmaakt.
  await context.addInitScript(()=>{window.__intervals=[];const si=window.setInterval;window.setInterval=function(fn,ms,...r){window.__intervals.push(ms);return si.call(window,fn,ms,...r)}});
  const page=await context.newPage(),errors=[],dialogs=[];
  const s={context,page,errors,dialogs};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await page.goto(origin+(ha?'/__ha-host':'/dist/BBQ_bereidingsplanner_MEATER_v4.html'),{waitUntil:'load'});
  const frame=()=>ha?page.frames().find(f=>f.url().includes('BBQ_bereidingsplanner')&&!f.isDetached()):page.mainFrame();
  for(let i=0;i<60&&!(frame()&&await frame().locator('#v5-root').count());i++)await page.waitForTimeout(100);
  s.f=frame();
  if(!ha)await context.clock.setFixedTime(new Date(time));
  s.q=(sel)=>s.f.locator(sel);
  s.act=async a=>{await s.f.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);if(a==='new'){const c=s.f.locator('#v5-root [data-v5-act="new-confirm"]');if(await c.count()){await c.first().click();await page.waitForTimeout(120);}}};
  s.text=sel=>s.f.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.store=()=>s.f.evaluate(k=>localStorage.getItem(k),KEY);
  s.dishes=async()=>JSON.parse(await s.store()).dishes;
  s.dish=async name=>(await s.dishes()).find(d=>d.name===name);
  s.overflow=()=>s.f.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  // Zet de vaste klok (alleen zonder HA-host) en laat de 1-s-timer een keer lopen, zodat de slots worden gepatcht.
  s.at=async iso=>{await context.clock.setFixedTime(new Date(iso));await context.clock.runFor(1100);await page.waitForTimeout(60)};
  // Oude sessies heropenen op het laatste scherm (Live); anders via "Verder" naar Live.
  s.live=async()=>{
    const screen=()=>s.f.evaluate(()=>document.querySelector('#v5-root').dataset.screen);
    if(await screen()==='live')return;
    if(await s.f.locator('#v5-root [data-v5-act="resume"]').count())await s.act('resume');
    if(await screen()!=='live')await s.act('live');
  };
  s.card=name=>'[data-v5-dishcard="'+name+'"]';
  // Zet de kaart onder de vaste balk bovenin, zodat een screenshot de hele kaart toont.
  s.focus=async id=>{await s.f.evaluate(i=>{const el=document.querySelector('[data-v5-dishcard="'+i+'"]');const y=el.getBoundingClientRect().top+scrollY-84;window.scrollTo({top:y,left:0,behavior:'instant'})},id);await page.waitForTimeout(80)};
  s.shot=async(dir,name)=>{if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')})};
  return s;
}
const idOf=async(s,name)=>(await s.dish(name)).id;
const slot=async(s,name,key)=>s.text('[data-v5-dishcard="'+(await idOf(s,name))+'"] [data-v5-slot="'+key+'"]');
const clockRange=t=>{const m=/tussen (\d\d:\d\d) en (\d\d:\d\d)/.exec(t);return m?[m[1],m[2]]:null};
const mins=hhmm=>Number(hhmm.slice(0,2))*60+Number(hhmm.slice(3));
async function openPanel(s,name){const id=await idOf(s,name);await s.f.locator('[data-v5-dishcard="'+id+'"] [data-v5-act="manual-open:'+id+'"]').click();await s.page.waitForTimeout(80);return id}
async function submit(s,id,kind,value){
  const form=s.f.locator('[data-v5-dishcard="'+id+'"] [data-v5-manual-form="'+kind+':'+id+'"]');
  await form.locator('input').fill(value);await form.locator('button[type="submit"]').click();await s.page.waitForTimeout(120);
}
const errText=(s,id)=>s.text('[data-v5-dishcard="'+id+'"] [data-v5-manual-err]');

const wanted=(process.env.ENGINES||'chromium,webkit').split(',');
try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>wanted.includes(n))){
  const browser=await engine.launch({headless:true});
  const shots=process.env.SCREENSHOTS_DIR?path.join(process.env.SCREENSHOTS_DIR,engineName):null;
  try{
   // 1. Oude data (echte opslag v5.7.0) laadt foutloos; zonder probe en zonder invoer: bereik + label + veiligheidstekst.
   {
    const before=seed();
    const s=await openPage(browser,Z('13:40'),{data:before});
    ok(s.errors.length===0,engineName+': oude opslag (v5.7.0) laadt zonder paginafouten '+s.errors.join(' | '));
    ok(!('manual' in (await s.dish(KIP)))&&!('manual' in (await s.dish('Ribeye 500 g'))),engineName+': oude gerechten krijgen geen veld `manual`');
    await s.live();
    const id=await idOf(s,KIP);
    const eta=await slot(s,KIP,'eta');
    ok(/Op tafel tussen \d\d:\d\d en \d\d:\d\d/.test(eta),engineName+': bereik "tussen HH:MM en HH:MM": '+eta);
    ok(/geschat, geen meting/.test(eta),engineName+': label "geschat, geen meting": '+eta);
    ok(!/LIVE/.test(await s.text(s.card(id))),engineName+': zonder probe nergens LIVE');
    ok(await slot(s,KIP,'safe')==='Controleer de kern met een thermometer voordat je serveert',engineName+': vaste veiligheidstekst bij kip');
    ok(/— °C/.test(await slot(s,KIP,'core')),engineName+': geen verzonnen kerntemperatuur');
    const rib=await idOf(s,'Ribeye 500 g');
    ok(await s.f.locator('[data-v5-dishcard="'+rib+'"] [data-v5-act="manual-open:'+rib+'"]').count()===1&&await s.f.locator(s.card(id)+' [data-v5-act="manual-open:'+id+'"]').count()===1,engineName+': "Kern invoeren" op elke gerechtkaart');
    ok(await s.text(s.card(id)+' [data-v5-act="manual-open:'+id+'"]')==='Kern invoeren',engineName+': knoptekst "Kern invoeren"');
    ok(JSON.stringify((await s.dishes()).map(d=>[d.name,d.phase,d.startedAt]))===JSON.stringify(before.state.dishes.map(d=>[d.name,d.phase,d.startedAt])),engineName+': kijken wijzigt de gerechten niet');
    // Geen veiligheidstekst bij niet-vlees (patch: categorie vis) en een gerecht dat nog niet op de BBQ ligt toont geen bereik.
    ok(!/Op tafel tussen/.test(await slot(s,'Ribeye 500 g','eta')),engineName+': gerecht dat nog niet is begonnen: geen bereik');
    ok((await s.overflow())<=1,engineName+': 390 px zonder horizontale overflow');
    await s.focus(id);await s.shot(shots,'01-live-bereik-zonder-probe-390');
    ok(s.dialogs.length===0,engineName+': geen dialogen');
    await s.context.close();
    const fish=await openPage(browser,Z('13:40'),{data:seed(st=>{st.dishes.find(d=>d.name===KIP).category='vis'})});
    await fish.live();
    ok(await slot(fish,KIP,'safe')==='',engineName+': geen veiligheidstekst bij vis');
    await fish.context.close();
   }
   // 2. "Kern invoeren": validatie, 62 °C om 14:20, tweede invoer = helling.
   {
    const data=seed(st=>{st.dishes.find(d=>d.name===KIP).startedAt=START_1330});
    const s=await openPage(browser,Z('14:20'),{data});
    await s.live();
    const id=await idOf(s,KIP);
    const before=clockRange(await slot(s,KIP,'eta'));
    ok(before&&before[0]==='14:20'&&before[1]==='14:40',engineName+': vooraf bereik 14:20–14:40 '+JSON.stringify(before));
    const content=await s.f.evaluate(()=>{window.__content=document.querySelector('#v5-root .v5-content');return true});
    await openPanel(s,KIP);
    ok(await s.f.locator(s.card(id)+' [data-v5-manual-panel] form').count()===2,engineName+': invoerpaneel in de pagina');
    ok(s.dialogs.length===0&&await s.f.evaluate(()=>window.__confirmCalls)===0,engineName+': paneel, geen dialoog / window.confirm');
    const input=s.f.locator(s.card(id)+' [data-v5-manual-form="core:'+id+'"] input');
    ok(await input.getAttribute('inputmode')==='decimal',engineName+': numeriek toetsenbord (inputmode=decimal)');
    ok(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16&&el.getBoundingClientRect().height>=44),engineName+': invoerveld minstens 16 px en 44 px hoog');
    const stored=await s.store();
    const bad=[['','Vul een temperatuur in.'],['  ','Vul een temperatuur in.'],['-5','tussen 0 en 120'],['121','tussen 0 en 120'],['130','tussen 0 en 120'],['abc','geen getal'],['1e2','geen getal'],['6 2','geen getal'],['62°','geen getal'],['NaN','geen getal'],['Infinity','geen getal']];
    for(const [value,expect] of bad){
      await submit(s,id,'core',value);
      const err=await errText(s,id);
      ok(err.includes(expect)||new RegExp(expect).test(err),engineName+': invoer "'+value+'" → '+err);
      ok(await s.store()===stored,engineName+': invoer "'+value+'" slaat niets op');
    }
    await s.focus(id);await s.shot(shots,'02-kern-invoeren-foutmelding-390');
    ok(await s.f.locator(s.card(id)+' [data-v5-manual-panel] form').count()===2,engineName+': na een fout blijft het paneel open');
    // Gerecht dat nog niet op de BBQ ligt: duidelijke melding, niets opgeslagen.
    const rib=await openPanel(s,'Ribeye 500 g');
    await submit(s,rib,'core','50');
    ok(/Zet het gerecht eerst op de BBQ/.test(await errText(s,rib))&&await s.store()===stored,engineName+': nog niet begonnen: melding en niets opgeslagen');
    await s.f.locator('[data-v5-dishcard="'+rib+'"] [data-v5-act="manual-close:'+rib+'"]').click();
    // 62 °C om 14:20.
    await submit(s,id,'core','62');
    ok(await s.f.locator(s.card(id)+' [data-v5-manual-panel] form').count()===0,engineName+': na opslaan sluit het paneel');
    const dish=await s.dish(KIP);
    ok(JSON.stringify(dish.manual)===JSON.stringify({points:[{t:Date.parse(Z('14:20')),core:62}],grill:null}),engineName+': opgeslagen als {points:[{t,core}],grill:null} '+JSON.stringify(dish.manual));
    await s.at(Z('14:20'));
    const eta=await slot(s,KIP,'eta');
    ok(/handmatig, 14:20/.test(eta),engineName+': bron "handmatig, 14:20": '+eta);
    ok(!/LIVE/.test(await s.text(s.card(id))),engineName+': handmatig wordt nooit als LIVE getoond');
    ok(!/geschat, geen meting/.test(eta),engineName+': na invoer niet meer "geen meting"');
    const after=clockRange(eta);
    ok(after&&(mins(after[1])-mins(after[0]))<(mins(before[1])-mins(before[0])),engineName+': bereik smaller dan vooraf '+JSON.stringify(before)+' → '+JSON.stringify(after));
    ok(/62 °C gemeten/.test(eta),engineName+': toont de ingevoerde 62 °C '+eta);
    ok(/Laatst: 62 °C · handmatig, 14:20/.test(await slot(s,KIP,'manual')),engineName+': laatste invoer zichtbaar als handmatig');
    ok(/— °C/.test(await slot(s,KIP,'core')),engineName+': de kernregel blijft zonder live meting');
    await s.focus(id);await s.shot(shots,'03-live-handmatig-62-390');
    // Tweede invoer (decimale komma) = helling.
    await s.at(Z('14:30'));
    await openPanel(s,KIP);await submit(s,id,'core','68,5');
    await s.at(Z('14:30'));
    const eta2=await slot(s,KIP,'eta');
    ok(/handmatig, 14:30/.test(eta2)&&/helling \+0,[0-9] °C\/min/.test(eta2),engineName+': tweede invoer geeft een helling: '+eta2);
    ok(/Laatst: 68,5 °C · handmatig, 14:30 \(2 metingen\)/.test(await slot(s,KIP,'manual')),engineName+': twee metingen zichtbaar');
    const d2=await s.dish(KIP);
    ok(d2.manual.points.length===2&&d2.manual.points[1].core===68.5,engineName+': 68,5 → 68.5 opgeslagen');
    const r2=clockRange(eta2);
    ok(r2&&(mins(r2[1])-mins(r2[0]))<=(mins(after[1])-mins(after[0])),engineName+': helling: bereik niet breder');
    // Bestaande opslag blijft: alle andere velden en gerechten ongewijzigd.
    const now=JSON.parse(await s.store());
    ok(now.dishes.length===FIXTURE.state.dishes.length&&now.dishes.every((d,i)=>Object.keys(FIXTURE.state.dishes[i]).every(k=>k==='startedAt'||JSON.stringify(d[k])===JSON.stringify(FIXTURE.state.dishes[i][k]))),engineName+': overige gerechtvelden ongewijzigd');
    ok(await s.f.evaluate(()=>document.querySelector('#v5-root .v5-content')===window.__content),engineName+': opslaan bouwt .v5-content niet opnieuw op');
    ok(s.errors.length===0&&s.dialogs.length===0,engineName+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }
   // 3. Afwijkende kamadotemperatuur.
   {
    const data=seed(st=>{st.dishes.find(d=>d.name===KIP).startedAt=START_1330});
    const s=await openPage(browser,Z('14:00'),{data});
    await s.live();
    const id=await idOf(s,KIP);
    const plan=clockRange(await slot(s,KIP,'eta')),line0=await slot(s,KIP,'env');
    ok(/Doel BBQ 180 °C/.test(line0),engineName+': standaard de geplande temperatuur: '+line0);
    await openPanel(s,KIP);
    const stored=await s.store();
    await submit(s,id,'grill','30');
    ok(/De kamadotemperatuur moet tussen 50 en 450 °C liggen/.test(await errText(s,id))&&await s.store()===stored,engineName+': 30 °C kamado → foutmelding, niets opgeslagen');
    await submit(s,id,'grill','abc');
    ok(/geen getal/.test(await errText(s,id))&&await s.store()===stored,engineName+': tekst → foutmelding');
    await submit(s,id,'grill','140');
    await s.at(Z('14:00'));
    const cool=clockRange(await slot(s,KIP,'eta')),env=await slot(s,KIP,'env'),eta=await slot(s,KIP,'eta');
    ok(/Kamado nu 140 °C \(handmatig, 14:00\) · plan 180 °C/.test(env),engineName+': kamado 140 °C zichtbaar als handmatig: '+env);
    ok(/gerekend met 140 °C kamado/.test(eta),engineName+': de schatting zegt dat hij met 140 °C rekent: '+eta);
    ok(mins(cool[1])>mins(plan[1]),engineName+': koudere kamado = later klaar '+JSON.stringify(plan)+' → '+JSON.stringify(cool));
    const d=await s.dish(KIP);
    ok(d.cook===55&&d.grill===180&&d.manual.grill.temp===140&&d.manual.points.length===0,engineName+': de planning (cook/grill) is niet gewijzigd; alleen manual.grill');
    await s.focus(id);await s.shot(shots,'04-kamado-140-390');
    await openPanel(s,KIP);
    await s.f.locator(s.card(id)+' [data-v5-act="grill-clear:'+id+'"]').click();await s.page.waitForTimeout(100);
    await s.at(Z('14:00'));
    const back=clockRange(await slot(s,KIP,'eta'));
    ok(/Doel BBQ 180 °C/.test(await slot(s,KIP,'env'))&&JSON.stringify(back)===JSON.stringify(plan),engineName+': "Terug naar planning" herstelt tekst en bereik');
    ok(!('manual' in (await s.dish(KIP))),engineName+': zonder invoer geen veld `manual` meer');
    await s.context.close();
   }
   // 4. v5.2.3-contract: alleen slots, één 1-s- en één 30-s-timer; wat je typt blijft staan.
   {
    const s=await openPage(browser,Z('14:00'),{data:seed(st=>{st.dishes.find(d=>d.name===KIP).startedAt=START_1330})});
    await s.live();
    const id=await idOf(s,KIP);
    await s.f.evaluate(()=>{const c=document.querySelector('#v5-root .v5-content');window.__content=c;window.__card=document.querySelector('[data-v5-dishcard]');});
    await openPanel(s,KIP);
    const input=s.f.locator(s.card(id)+' [data-v5-manual-form="core:'+id+'"] input');
    await input.focus();await input.pressSequentially('6',{delay:20});
    for(let i=0;i<3;i++)await s.context.clock.runFor(1100);
    await s.context.clock.runFor(31000);await s.page.waitForTimeout(100);
    ok(await input.inputValue()==='6'&&await input.evaluate(el=>document.activeElement===el),engineName+': 1-s- en 30-s-timer laten het getypte getal en de focus staan');
    ok(await s.f.evaluate(()=>document.querySelector('#v5-root .v5-content')===window.__content&&document.querySelector('[data-v5-dishcard]')===window.__card),engineName+': .v5-content en de kaart worden niet vervangen');
    const iv=await s.f.evaluate(()=>window.__intervals);
    ok(iv.filter(x=>x===1000).length===1&&iv.filter(x=>x===30000).length===1,engineName+': precies één 1-s- en één 30-s-timer '+JSON.stringify(iv));
    ok(s.errors.length===0&&await s.f.evaluate(()=>window.__confirmCalls)===0,engineName+': geen fouten, geen window.confirm');
    await s.context.close();
   }
   // 5. Home Assistant: prik-melding één keer, geen herhaling binnen 15 min; een verse probe heeft voorrang op de handmatige bron.
   {
    const s=await openPage(browser,Z('13:30'),{ha:true});
    // Eigen sessie (geen fixture): Kippenpoten op de BBQ om 13:30, zonder probe.
    await s.act('new');
    await s.f.locator('[data-v5-recipe="'+KIP+'"]').click();await s.page.waitForTimeout(80);
    await s.act('setup');await s.act('prep');if(await s.f.locator('#v5-root [data-v5-act="prep-confirm"]').count())await s.act('prep-confirm');await s.live();
    const id=await idOf(s,KIP);
    s.dialogs.length=0; // de bestaande bevestiging bij "Nieuwe sessie" hoort niet bij deze functie
    await s.f.locator('[data-v5-dishcard="'+id+'"] [data-v5-act="phase:'+id+':cooking"]').click();await s.page.waitForTimeout(150);
    const dish0=await s.dish(KIP);
    ok(dish0.phase==='cooking',engineName+': HA: Kippenpoten op de BBQ; de kaart koppelt standaard MEATER Pro (v5.3), maar die meet nog niet: '+JSON.stringify([dish0.meater,dish0.meaterAuto]));
    const calls=()=>s.page.evaluate(()=>window.__calls.map(c=>c.message));
    const prik=async()=>(await calls()).filter(m=>/^Tijd om te prikken/.test(m));
    const run=async min=>{for(let i=0;i<min;i++){await s.context.clock.runFor(60000);await s.page.waitForTimeout(15)}await s.page.waitForTimeout(60)};
    ok(/Op tafel tussen/.test(await slot(s,KIP,'eta')),engineName+': HA: bereik zonder probe');
    ok(!/LIVE/.test(await s.text(s.card(id))),engineName+': HA zonder probe: nergens LIVE');
    await run(38);                       // 14:08
    ok((await prik()).length===0,engineName+': geen prik-melding vóór het begin van het bereik (14:10): '+JSON.stringify(await calls()));
    await run(4);                        // 14:12
    let p=await prik();
    ok(p.length===1&&p[0]==='Tijd om te prikken: controleer Kippenpoten met een thermometer en voer de kern in',engineName+': prik-melding gaat één keer af: '+JSON.stringify(p));
    const sent=await s.page.evaluate(()=>window.__calls.find(c=>/^Tijd om te prikken/.test(c.message)));
    ok(sent.domain==='notify'&&sent.service==='mobile_app_test_telefoon'&&sent.data.data.push['interruption-level']==='time-sensitive',engineName+': via de bestaande meldingsroute (vaste time-sensitive data)');
    await run(12);                       // 14:24
    ok((await prik()).length===1,engineName+': geen herhaling binnen 15 min');
    await run(3);                        // 14:27
    ok((await prik()).length===2,engineName+': herhaling pas na 15 min: '+(await prik()).length);
    // Invoer: daarna geen nieuwe prik-melding binnen 15 min na de invoer.
    await openPanel(s,KIP);await submit(s,id,'core','62');
    ok(/handmatig, 14:27/.test(await slot(s,KIP,'eta'))||/handmatig, 14:2\d/.test(await slot(s,KIP,'eta')),engineName+': HA: handmatig gelabeld: '+await slot(s,KIP,'eta'));
    await run(13);                       // 14:40
    ok((await prik()).length===2,engineName+': na een invoer geen prik-melding binnen 15 min');
    // Verse probe: de gekoppelde MEATER Pro gaat meten (stijgende, verse metingen). Het bereik verdwijnt, de eigen curve neemt het over.
    for(let i=0,core=55;i<9;i++,core+=0.8){await s.page.evaluate(([c])=>window.__set('pro',{interne_temperatuur:c,omgevingstemperatuur:175,doeltemperatuur:'unavailable',kookstatus:'unavailable',kookt:'off',piektemperatuur:'unavailable',resterende_tijd:'unavailable',tijd_verstreken:'unavailable'}),[core.toFixed(1)]);await s.context.clock.runFor(60000);await s.page.waitForTimeout(30)}
    await s.page.waitForTimeout(150);
    const etaProbe=await slot(s,KIP,'eta'),coreProbe=await slot(s,KIP,'core');
    ok(/LIVE/.test(coreProbe)&&!/Op tafel tussen/.test(etaProbe)&&!/handmatig/.test(etaProbe)&&!/geschat, geen meting/.test(etaProbe),engineName+': verse probe overschrijft handmatig: bereik weg, geen "handmatig": '+etaProbe+' | '+coreProbe);
    ok(/eigen trend/.test(etaProbe),engineName+': de eigen curve neemt het over: '+etaProbe);
    ok(await slot(s,KIP,'safe')==='',engineName+': met een meetende probe geen veiligheidsregel zonder meting');
    ok(s.errors.length===0&&s.dialogs.length===0,engineName+': HA: geen paginafouten of dialogen '+s.errors.join(' | ')+JSON.stringify(s.dialogs));
    await s.context.close();
   }
   // 6. 320 px en 390 px: geen horizontale overflow, ook met geopend paneel en een foutmelding.
   for(const width of [320,390]){
    const s=await openPage(browser,Z('14:20'),{width,data:seed(st=>{st.dishes.find(d=>d.name===KIP).startedAt=START_1330})});
    await s.live();
    const id=await openPanel(s,KIP);
    await submit(s,id,'core','abc');
    ok((await s.overflow())<=1,engineName+': '+width+' px: geen horizontale overflow met paneel en foutmelding ('+await s.overflow()+')');
    const wide=await s.f.evaluate(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return r.right-innerWidth},'[data-v5-dishcard="'+id+'"] [data-v5-manual-panel] .v5-dc-panel');
    ok(wide<=1,engineName+': '+width+' px: paneel past in het scherm');
    const small=await s.f.evaluate(()=>[...document.querySelectorAll('[data-v5-manual-panel] .v5-btn,[data-v5-manual-panel] button')].filter(b=>b.getBoundingClientRect().height<43).length);
    ok(small===0,engineName+': '+width+' px: knoppen in het paneel minstens 44 px hoog');
    await s.f.locator('[data-v5-dishcard="'+id+'"]').scrollIntoViewIfNeeded();
    await s.focus(id);await s.shot(shots,'05-paneel-foutmelding-'+width);
    await submit(s,id,'core','62');await s.at(Z('14:20'));
    ok((await s.overflow())<=1,engineName+': '+width+' px: geen overflow na invoer');
    await s.focus(id);await s.shot(shots,'06-live-handmatig-'+width);
    ok(s.errors.length===0,engineName+': '+width+' px: geen paginafouten');
    await s.context.close();
   }
   console.log('OK v5.8.0 zonder probe: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.8.0 schatting zonder probe + kern invoeren: '+checks+' checks ('+wanted.join(', ')+'; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
