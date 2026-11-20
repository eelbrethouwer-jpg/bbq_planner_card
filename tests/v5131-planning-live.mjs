/* v5.13.1 "Planningsmeldingen live" (Playwright, Chromium + WebKit; 390 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam,
   Playwright clock: de tijd loopt alleen als de test hem laat lopen). Geen Home Assistant, MEATER of echte iPhone.
   Bewijst: de meldingen "te laat" en "voorbereiding al voorbij" verschijnen zonder tik of herrender, verdwijnen na "Plan opnieuw vanaf nu",
   een verborgen tabblad wordt niet bijgewerkt, en focus, invoer, bevestigingsvensters en scrollpositie blijven staan.
   BBQ_ENGINES=chromium beperkt de engines (lokaal zonder WebKit). */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const KEY='kamado-bereidingsplanner-v1';
const MIN=60000,HOUR=3600000;
const T_1500='2026-11-16T14:00:00Z';   // maandag 15:00 (Amsterdam); serveren 18:30, eerste actie ongeveer 16:42
const T_SAT='2026-11-14T11:00:00Z';    // zaterdag 12:00 (Amsterdam)
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,time,{width=390}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.clock.install({time:new Date(time)}); // de klok loopt niet vanzelf: alleen via runFor/fastForward
  const page=await context.newPage(),errors=[],dialogs=[];
  const s={context,page,errors,dialogs};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.goto(origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html',{waitUntil:'load'});
  await page.locator('#v5-root').waitFor();
  s.act=async a=>{await page.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);if(a==='new'){const c=page.locator('#v5-root [data-v5-act="new-confirm"]');if(await c.count()){await c.first().click();await page.waitForTimeout(120);}}};
  s.text=sel=>page.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.count=sel=>page.locator(sel).count();
  s.store=()=>page.evaluate(k=>localStorage.getItem(k),KEY);
  s.plan=async()=>JSON.parse(await s.store());
  s.screen=()=>page.evaluate(()=>document.querySelector('#v5-root').dataset.screen);
  s.add=async name=>{await page.locator('[data-v5-recipe="'+name+'"]').click();await page.waitForTimeout(100);};
  s.mark=()=>page.evaluate(()=>{document.querySelector('#v5-root .v5-content').__keep=1;});
  s.marked=()=>page.evaluate(()=>document.querySelector('#v5-root .v5-content')?.__keep===1);
  // De tijd laat 'ms' verstrijken en de 30-seconden-timer van de planner één keer afgaan (met de nieuwe klok).
  s.advance=async ms=>{await page.clock.fastForward(ms);await page.waitForTimeout(150);};
  s.hide=hidden=>page.evaluate(h=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});if(!h)document.dispatchEvent(new Event('visibilitychange'));},hidden);
  s.activeIs=()=>page.evaluate(()=>document.activeElement&&document.activeElement.__mine===true);
  return s;
}
const startSession=async(s,names)=>{await s.act('new');for(const n of names)await s.add(n);await s.act('setup');};

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>(process.env.BBQ_ENGINES||'chromium,webkit').split(',').includes(n))){
  const browser=await engine.launch({headless:true});
  try{
   // 1. Live: de melding "je begint later dan gepland" verschijnt vanzelf, zonder herrender, en verdwijnt na "Plan opnieuw vanaf nu".
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g']);await s.act('prep');await s.act('live');
    ok(await s.screen()==='live'&&await s.count('[data-v5-late]')===0,engineName+': 15:00, serveren 18:30: Live zonder melding');
    const stored=await s.store();
    await s.mark();
    await s.advance(5*MIN);
    ok(await s.count('[data-v5-late]')===0,engineName+': een tik van de timer op tijd verandert niets');
    await s.advance(2*HOUR+10*MIN); // 17:15: de eerste actie (ongeveer 16:42) is meer dan 15 minuten geleden
    ok(await s.count('[data-v5-late]')===1,engineName+': na het verstrijken van de tijd verschijnt de melding zonder interactie');
    ok(/Je begint later dan gepland/.test(await s.text('[data-v5-late]'))&&/Plan opnieuw vanaf nu/.test(await s.text('[data-v5-late]')),engineName+': melding met knop "Plan opnieuw vanaf nu"');
    ok(await s.marked(),engineName+': geen volledige herrender (Live-DOM is dezelfde)');
    ok(await s.store()===stored,engineName+': de planning is nooit stilzwijgend gewijzigd (opslag byte-gelijk)');
    // Opnieuw plannen: bevestigen is een tik; de nieuwe serveertijd is nu + benodigde tijd.
    await s.act('late-ask');
    ok(await s.count('[data-v5-late] .v5-tl-confirm')===1,engineName+': voorstel tonen');
    await s.advance(40*1000);
    ok(await s.count('[data-v5-late] .v5-tl-confirm')===1,engineName+': een open bevestiging blijft staan als de timer afgaat');
    await s.act('late-apply');
    const plan=await s.plan();
    ok(/^\d\d:\d\d$/.test(plan.mealTime)&&plan.mealTime!=='18:30',engineName+': na bevestiging een nieuwe serveertijd '+plan.mealTime);
    ok(await s.count('[data-v5-late]')===0,engineName+': de melding verdwijnt na "Plan opnieuw vanaf nu"');
    await s.mark();await s.advance(MIN);
    ok(await s.count('[data-v5-late]')===0&&await s.marked(),engineName+': en komt niet meteen terug');
    ok(s.errors.length===0&&s.dialogs.length===0,engineName+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }
   // 2. Verborgen tabblad: geen bijwerking; bij terugkeren klopt de melding.
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g']);await s.act('prep');await s.act('live');
    await s.hide(true);
    await s.advance(2*HOUR+10*MIN);
    ok(await s.count('[data-v5-late]')===0,engineName+': tabblad verborgen: de timer werkt niets bij');
    await s.hide(false);await s.page.waitForTimeout(150);
    ok(await s.count('[data-v5-late]')===1,engineName+': tabblad weer zichtbaar: de melding klopt direct');
    await s.context.close();
   }
   // 3. Focus en invoer blijven staan: een knop in de melding, een bevestigingsvenster en een invoerveld.
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g']);
    // Stap 2: een open invoerveld met half ingetypte tekst blijft ongemoeid bij een tik van de timer.
    const input=s.page.locator('input[data-v5-setting="v45People"]');
    await input.focus();await s.page.keyboard.type('7');
    await s.page.evaluate(()=>{document.activeElement.__mine=true;});
    await s.advance(40*1000);
    ok(await s.activeIs()&&await input.inputValue()!=='','stap 2 ('+engineName+'): focus en ingetypte waarde blijven staan');
    await input.blur();
    await s.act('prep');await s.act('live');
    // Live: bevestigingsvenster "Sessie afronden" open; de melding verschijnt erbij; het venster en de focus blijven staan.
    await s.act('finish');
    const cancel=s.page.locator('[data-v5-finish-confirm] [data-v5-act="finish-cancel"]');
    await cancel.focus();await s.page.evaluate(()=>{document.activeElement.__mine=true;});
    await s.mark();
    await s.advance(2*HOUR+10*MIN);
    ok(await s.count('[data-v5-late]')===1,engineName+': melding verschijnt terwijl het bevestigingsvenster open staat');
    ok(await s.count('[data-v5-finish-confirm]')===1&&await s.activeIs()&&await s.marked(),engineName+': bevestigingsvenster en focus blijven staan, geen herrender');
    // Focus op een knop in de melding zelf: die wordt niet onder de vinger vervangen.
    await s.page.evaluate(()=>{const b=document.querySelector('[data-v5-late] [data-v5-act="late-hide"]');b.focus();b.__mine=true;});
    await s.advance(40*1000);
    ok(await s.activeIs(),engineName+': focus op een knop in de melding blijft behouden');
    // Scrollpositie: de melding staat boven het zichtbare deel; de inhoud mag niet verspringen.
    await s.page.evaluate(()=>{document.activeElement.blur();});
    await s.page.evaluate(()=>{window.scrollTo({top:document.documentElement.scrollHeight,left:0,behavior:'instant'})});
    await s.context.close();
   }
   // 4. Scroll: de melding verschijnt boven het zichtbare deel; wat je leest blijft op dezelfde plek.
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g']);await s.act('prep');await s.act('live');
    await s.page.evaluate(()=>{window.scrollTo({top:document.documentElement.scrollHeight,left:0,behavior:'instant'})});
    await s.page.waitForTimeout(100);
    const probe=()=>s.page.evaluate(()=>{const el=document.querySelector('#v5-root .v5-action-grid')||document.querySelector('#v5-root .v5-content').lastElementChild;return Math.round(el.getBoundingClientRect().top)});
    const y0=await s.page.evaluate(()=>window.scrollY);
    ok(y0>0,engineName+': pagina is gescrold (scrollY '+y0+')');
    const heroH=()=>s.page.evaluate(()=>document.querySelector('#v5-root .v5-hero').getBoundingClientRect().height);
    const before=await probe(),hero0=await heroH();
    await s.advance(2*HOUR+10*MIN);
    ok(await s.count('[data-v5-late]')===1,engineName+': melding verschijnt tijdens het scrollen');
    const after=await probe(),grow=Math.round(await heroH()-hero0);
    // De hero (bestaande 30-s-verversing van de Live-tekst) mag zelf van hoogte veranderen; de melding zelf mag niets verschuiven.
    ok(Math.abs(after-before-grow)<=2,engineName+': de melding laat de zichtbare inhoud niet verspringen ('+before+' -> '+after+', hero '+grow+')');
    await s.context.close();
   }
   // 5. Stap 3: "Voorbereiding al voorbij" verschijnt vanzelf zodra de dag vooraf voorbij is (zaterdag 12:00 -> maandag 00:30), en de melding "te laat" niet ten onrechte.
   {
    const s=await open(browser,T_SAT);
    await startSession(s,['Pulled pork op brood']);
    await s.page.locator('input[data-v5-setting="date"]').fill('2026-11-16');await s.page.locator('input[data-v5-setting="date"]').dispatchEvent('change');await s.page.waitForTimeout(150);
    await s.act('prep');
    ok(await s.screen()==='prep'&&await s.count('[data-v5-overdue]')===0&&await s.count('[data-v5-late]')===0,engineName+': zaterdag 12:00: nog niets te laat');
    const stored=await s.store();
    await s.mark();
    await s.advance(36*HOUR+30*MIN); // maandag 00:30
    ok(await s.count('[data-v5-overdue]')===1&&/Voorbereiding al voorbij/.test(await s.text('[data-v5-overdue]')),engineName+': de melding "voorbereiding al voorbij" verschijnt vanzelf');
    ok(await s.marked()&&await s.store()===stored,engineName+': geen herrender en opslag byte-gelijk');
    // Afvinken haalt de melding weg (bestaand gedrag, herrender op tik).
    await s.page.locator('[data-v5-check*=":prep:"]').first().check();await s.page.waitForTimeout(150);
    ok(await s.count('[data-v5-overdue-task]')===0,engineName+': afgevinkt = melding weg');
    await s.context.close();
   }
  }finally{await browser.close();}
 }
 console.log('PASS v5.13.1 planningsmeldingen live: '+checks+' controles');
}finally{server.close();}
