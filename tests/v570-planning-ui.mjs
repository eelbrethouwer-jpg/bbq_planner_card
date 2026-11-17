/* v5.7.0 "Planning eenvoudiger" (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam).
   Geen Home Assistant, MEATER of echte iPhone.
   Scenario's: 1) Ribeye + Kippenpoten, 2) Ribeye + Pulled pork, 3) start om 23:40, 4) een handmatige kamadokeuze verandert nooit.
   Optioneel: SCREENSHOTS_DIR=<map> schrijft screenshots per engine. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
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
const T_1500='2026-11-16T14:00:00Z',T_1300='2026-11-16T12:00:00Z',T_2340='2026-11-16T22:40:00Z'; // Europe/Amsterdam: 15:00, 13:00, 23:40
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,time,{width=390}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__confirmCalls=0;const o=window.confirm;window.confirm=(...a)=>{window.__confirmCalls++;return o.apply(window,a)}});
  await context.clock.install({time:new Date(time)});
  const page=await context.newPage(),errors=[],dialogs=[];
  const s={context,page,errors,dialogs,answer:'accept'};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());if(s.answer==='accept')d.accept();else d.dismiss();});
  await page.goto(origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html',{waitUntil:'load'});
  await page.locator('#v5-root').waitFor();
  await context.clock.setFixedTime(new Date(time)); // de klok staat stil: tijden in de uitkomsten zijn exact
  s.f=page.mainFrame();
  s.act=async a=>{await page.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);};
  s.text=sel=>page.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.count=sel=>page.locator(sel).count();
  s.store=()=>page.evaluate(k=>localStorage.getItem(k),KEY);
  s.plan=async()=>JSON.parse(await s.store());
  s.kamado=async()=>Object.fromEntries((await s.plan()).dishes.map(d=>[d.name,d.kamado]));
  s.screen=()=>page.evaluate(()=>document.querySelector('#v5-root').dataset.screen);
  s.add=async name=>{await page.locator('[data-v5-recipe="'+name+'"]').click();await page.waitForTimeout(100);};
  s.overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  s.shot=async(dir,name)=>{if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});};
  return s;
}
const startSession=async(s,names)=>{await s.act('new');for(const n of names)await s.add(n);await s.act('setup');};

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  const shots=process.env.SCREENSHOTS_DIR?path.join(process.env.SCREENSHOTS_DIR,engineName):null;
  try{
   // 1. Ribeye + Kippenpoten: de app kiest bij het TOEVOEGEN de kamado met de minste conflicten.
   {
    const s=await open(browser,T_1500);
    await s.act('new');
    await s.add('Ribeye 500 g');
    ok((await s.kamado())['Ribeye 500 g']==='large',engineName+': eerste gerecht staat op de grote kamado');
    await s.add('Kippenpoten');
    const kam=await s.kamado();
    ok(kam['Ribeye 500 g']==='large'&&kam['Kippenpoten']==='small',engineName+': Kippenpoten wordt bij toevoegen op de kleine kamado gezet (receptstandaard is groot) '+JSON.stringify(kam));
    await s.act('setup');
    ok(await s.count('[data-v5-urgent]')===0,engineName+': geen urgent conflict na de automatische keuze');
    ok(/Geen planningsconflicten/.test(await s.text('#v5-root')),engineName+': stap 2 meldt geen conflicten');
    ok((await s.overflow())<=1,engineName+': geen horizontale overflow (390)');
    await s.shot(shots,'00-stap2-kamado-automatisch-gekozen-390');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // 4a. Een handmatige kamadokeuze verandert nooit automatisch; de oplossing is alleen een tik van de gebruiker.
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g','Kippenpoten']);
    const kipId=(await s.plan()).dishes.find(d=>d.name==='Kippenpoten').id;
    await s.f.locator('[data-v5-kamado="'+kipId+'"]').selectOption('large');await s.page.waitForTimeout(150);
    ok((await s.kamado())['Kippenpoten']==='large','handmatig: Kippenpoten op groot gezet');
    const urgent=await s.text('[data-v5-urgent]');
    ok(/1 urgent conflict/.test(urgent)&&/Ribeye 500 g en Kippenpoten botsen op de grote kamado/.test(urgent),engineName+': urgent conflict bovenaan stap 2: '+urgent);
    ok(/Oplossing: Zet Kippenpoten op de kleine kamado/.test(urgent),engineName+': directe oplossing "Zet Kippenpoten op de kleine kamado"');
    const order=await s.page.evaluate(()=>{const c=document.querySelector('#v5-root .v5-content');return ['[data-v5-urgent]','.v5-serve-card'].map(q=>[...c.children].indexOf(c.querySelector(q)));});
    ok(order[0]>=0&&order[0]<order[1],engineName+': het rode paneel staat boven de rest van stap 2 '+order);
    const red=await s.page.evaluate(()=>{const c=getComputedStyle(document.querySelector('[data-v5-urgent]')).borderTopColor.match(/\d+/g).map(Number);return c;});
    ok(red[0]>150&&red[1]<110&&red[2]<110,engineName+': het paneel is rood '+red);
    await s.shot(shots,'01-stap2-urgent-conflict-390');
    // Er wordt niets gewijzigd door kijken, wachten, andere gerechten toevoegen of herladen.
    const before=await s.store();
    await s.context.clock.runFor(61000);await s.page.waitForTimeout(100);
    ok(await s.store()===before,engineName+': tijd laten verstrijken wijzigt niets');
    await s.act('select');await s.add('Zalm');await s.act('setup');
    const kam=await s.kamado();
    ok(kam['Ribeye 500 g']==='large'&&kam['Kippenpoten']==='large',engineName+': bestaande keuzes blijven na het toevoegen van andere gerechten '+JSON.stringify(kam));
    await s.page.reload({waitUntil:'load'});await s.page.locator('#v5-root').waitFor();
    ok((await s.kamado())['Kippenpoten']==='large',engineName+': ook na herladen blijft de handmatige keuze');
    // "+1" (extra portie) en weer verwijderen raken de andere gerechten niet.
    if(await s.count('#v5-root [data-v5-act="resume"]'))await s.act('resume');if(await s.screen()!=='select')await s.act('select');
    const byId=async()=>Object.fromEntries((await s.plan()).dishes.map(d=>[d.id,d.kamado]));
    const known=await byId(),rib=(await s.plan()).dishes.find(d=>d.name==='Ribeye 500 g').id;
    await s.f.locator('[data-v5-extra="'+rib+'"]').click();await s.page.waitForTimeout(100);
    const after=await byId();
    ok(Object.keys(after).length===Object.keys(known).length+1&&Object.entries(known).every(([id,k])=>after[id]===k),engineName+': "+1" laat de kamado van alle bestaande gerechten staan');
    const extra=Object.keys(after).find(id=>!(id in known));
    await s.f.locator('[data-v5-remove="'+extra+'"]').click();await s.page.waitForTimeout(100);
    await s.act('setup');
    ok(/Zet Kippenpoten op de kleine kamado/.test(await s.text('[data-v5-urgent]')),engineName+': urgent conflict blijft staan (gebruikerskeuze)');
    // "Naar voorbereiding": bevestigingspaneel in de pagina (geen window.confirm); annuleren = niets gebeurt.
    const stored=await s.store();s.dialogs.length=0;
    await s.act('prep');
    const confirmText=await s.text('[data-v5-prep-confirm]');
    ok(/Toch doorgaan naar voorbereiding\?/.test(confirmText)&&/1 urgent conflict/.test(confirmText)&&/Zet Kippenpoten op de kleine kamado/.test(confirmText),engineName+': bevestigingspaneel met conflict en oplossing: '+confirmText);
    ok(await s.screen()==='setup'&&await s.store()===stored,engineName+': het paneel tonen blijft op stap 2 en schrijft niets');
    ok((await s.overflow())<=1,engineName+': paneel zonder overflow');
    await s.shot(shots,'08-stap2-bevestiging-naar-voorbereiding-390');
    await s.act('prep-cancel');
    ok(await s.count('[data-v5-prep-confirm]')===0&&await s.screen()==='setup'&&await s.store()===stored,engineName+': annuleren: paneel weg, opslag byte-gelijk');
    await s.act('prep');await s.act('prep-confirm');
    ok(await s.screen()==='prep',engineName+': na "Toch doorgaan" naar voorbereiding');
    ok(s.dialogs.length===0&&await s.page.evaluate(()=>window.__confirmCalls)===0,engineName+': op dit pad wordt geen window.confirm of ander dialoog meer gebruikt');
    await s.act('setup');
    // De oplossing toepassen is een tik van de gebruiker; alleen dat ene gerecht verandert.
    await s.f.locator('[data-v5-act^="fix:"]').click();await s.page.waitForTimeout(150);
    const kam3=await s.kamado();
    ok(kam3['Kippenpoten']==='small'&&kam3['Ribeye 500 g']==='large',engineName+': na de tik staat Kippenpoten op klein '+JSON.stringify(kam3));
    ok(await s.count('[data-v5-urgent]')===0,engineName+': het paneel verdwijnt');
    s.dialogs.length=0;await s.act('prep');
    ok(await s.count('[data-v5-prep-confirm]')===0&&await s.screen()==='prep',engineName+': zonder urgente conflicten geen bevestiging');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // 4b. Een eigen keuze op het eerste gerecht blijft ook als een tweede gerecht wordt toegevoegd.
   {
    const s=await open(browser,T_1500);
    await s.act('new');await s.add('Ribeye 500 g');await s.act('setup');
    const rib=(await s.plan()).dishes[0].id;
    await s.f.locator('[data-v5-kamado="'+rib+'"]').selectOption('small');await s.page.waitForTimeout(100);
    await s.act('select');await s.add('Kippenpoten');
    const kam=await s.kamado();
    ok(kam['Ribeye 500 g']==='small',engineName+': Ribeye (handmatig klein) blijft klein '+JSON.stringify(kam));
    await s.context.close();
   }
   // 2. Ribeye + Pulled pork: te vroeg beginnen; voorbereiding "avond vooraf" is voorbij.
   {
    const s=await open(browser,T_1300);
    await startSession(s,['Ribeye 500 g','Pulled pork op brood']);
    const urgent=await s.text('[data-v5-urgent]');
    ok(/Starttijd 08:\d\d is al verstreken; je kunt beginnen vanaf 16:30/.test(urgent),engineName+': urgent: starttijd verstreken '+urgent);
    ok(/Oplossing: Begin om 08:\d\d of serveer om 03:\d\d/.test(urgent),engineName+': directe oplossing "Begin om 08:xx of serveer om 03:xx": '+urgent);
    await s.shot(shots,'02-stap2-pulled-pork-te-vroeg-390');
    ok((await s.overflow())<=1,engineName+': geen horizontale overflow (390)');
    const stored=await s.store();await s.act('prep');
    ok(/Begin om 08/.test(await s.text('[data-v5-prep-confirm]'))&&await s.screen()==='setup'&&await s.store()===stored,engineName+': bevestiging vraagt om akkoord; wijzigt niets');
    await s.act('prep-cancel');ok(await s.store()===stored,engineName+': annuleren wijzigt niets');
    await s.act('prep');await s.act('prep-confirm');
    // Avond vooraf voorbij.
    const overdue=await s.text('[data-v5-overdue]');
    ok(/Voorbereiding al voorbij/.test(overdue)&&/Procureur schoonmaken en kruiden/.test(overdue),engineName+': melding voor de voorbije voorbereiding: '+overdue);
    ok(/Stond gepland: zondag \(de avond vooraf\)/.test(overdue)&&/Alternatief: Doe het nu/.test(overdue),engineName+': melding noemt wanneer en een alternatief');
    ok(/Voorbereidingslijst/.test(await s.text('#v5-root')),engineName+': de voorbereidingslijst blijft bestaan');
    await s.shot(shots,'03-stap3-avond-vooraf-voorbij-390');
    ok((await s.overflow())<=1,engineName+': geen horizontale overflow stap 3');
    // Afvinken haalt de melding weg.
    await s.f.locator('[data-v5-check*=":prep:"]').first().check();await s.page.waitForTimeout(120);
    ok(await s.count('[data-v5-overdue-task]')===0,engineName+': afgevinkt = geen melding meer');
    await s.context.close();
   }
   // 3. Te laat gestart: Ribeye, start om 23:40 (serveren 18:30 staat in het verleden).
   {
    const s=await open(browser,T_2340);
    await startSession(s,['Ribeye 500 g']);
    ok(await s.count('[data-v5-urgent]')===0,engineName+': stap 2 zonder conflicten');
    await s.act('prep');
    ok(/Je begint later dan gepland/.test(await s.text('[data-v5-late]')),engineName+': aanbod al zichtbaar in stap 3');
    s.dialogs.length=0;await s.act('live');
    ok(await s.screen()==='live'&&/Je begint later dan gepland/.test(await s.text('[data-v5-late]')),engineName+': bij "Start live" staat het aanbod bovenaan Live');
    ok(/serveertijd \(18:30\) is al voorbij/.test(await s.text('[data-v5-late]'))||/geplande serveertijd \(18:30\) is al voorbij/.test(await s.text('[data-v5-late]')),engineName+': legt uit waarom');
    ok(/Plan opnieuw vanaf nu/.test(await s.text('[data-v5-late]')),engineName+': knop "Plan opnieuw vanaf nu"');
    const primary=await s.count('#v5-root .v5-btn.primary');
    ok(primary<=1,engineName+': de knop is niet de primaire actie');
    await s.shot(shots,'04-live-te-laat-gestart-390');
    ok((await s.overflow())<=1,engineName+': geen horizontale overflow Live');
    const stored=await s.store();
    await s.context.clock.runFor(61000);await s.page.waitForTimeout(100);
    ok(await s.store()===stored,engineName+': nooit automatisch: tijd laten verstrijken wijzigt niets');
    await s.act('late-ask');
    const panel=await s.text('[data-v5-late] .v5-tl-confirm');
    ok(/Nu gepland serveren 18:30/.test(panel)&&/Nieuw serveren ±.*01:28/.test(panel)&&/Benodigde tijd 1 u 48 min/.test(panel),engineName+': voor/na getoond, nu + benodigde tijd = 01:28: '+panel);
    await s.shot(shots,'05-live-plan-opnieuw-bevestigen-390');
    ok(await s.store()===stored,engineName+': het voorstel tonen schrijft niets');
    await s.act('late-cancel');
    ok(await s.store()===stored&&await s.count('[data-v5-late] .v5-tl-confirm')===0,engineName+': annuleren laat de opslag byte-gelijk');
    await s.act('late-ask');await s.act('late-apply');
    const plan=await s.plan();
    ok(plan.mealTime==='01:28'&&plan.date==='2026-11-17'&&plan.dateMode==='manual',engineName+': na bevestiging: serveren 01:28 op de volgende dag '+JSON.stringify([plan.mealTime,plan.date,plan.dateMode]));
    ok(plan.availableFrom==='',engineName+': "Beschikbaar vanaf" is niet later dan de start nu');
    ok(await s.count('[data-v5-late]')===0,engineName+': het aanbod verdwijnt na het opnieuw plannen');
    ok(/Serveren 01:28/.test(await s.text('.v5-live-bar')),engineName+': de Live-balk toont de nieuwe serveertijd');
    ok(!plan.dishes.some(d=>d.phase&&d.phase!=='waiting'),engineName+': er is niets gestart');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // 3b. Houd de planning: verbergt het aanbod zonder te wijzigen. Al gestart: geen aanbod.
   {
    const s=await open(browser,T_2340);
    await startSession(s,['Ribeye 500 g']);await s.act('prep');await s.act('live');
    const stored=await s.store();
    await s.act('late-hide');
    ok(await s.count('[data-v5-late]')===0&&await s.store()===stored,engineName+': "Houd de planning zoals hij is" wijzigt niets');
    await s.context.close();
    const t=await open(browser,T_2340);
    await startSession(t,['Ribeye 500 g']);await t.act('prep');await t.act('live');
    const id=(await t.plan()).dishes[0].id;
    await t.f.locator('[data-v5-act="phase:'+id+':cooking"]').click();await t.page.waitForTimeout(150);
    ok(await t.count('[data-v5-late]')===0,engineName+': een gestart gerecht = geen "plan opnieuw"-aanbod meer');
    await t.context.close();
   }
   // Een plan op tijd (15:00, serveren 18:30, Ribeye): geen aanbod, geen melding.
   {
    const s=await open(browser,T_1500);
    await startSession(s,['Ribeye 500 g']);await s.act('prep');
    ok(await s.count('[data-v5-late]')===0&&await s.count('[data-v5-overdue]')===0,engineName+': op tijd: geen aanbod en geen melding');
    await s.act('live');
    ok(await s.count('[data-v5-late]')===0,engineName+': op tijd: Live zonder aanbod');
    await s.context.close();
   }
   // Mobiel 320 px: geen overflow en tikdoelen >= 44 px in de nieuwe panelen.
   for(const width of [320,390]){
    const s=await open(browser,T_1500,{width});
    await startSession(s,['Ribeye 500 g','Kippenpoten']);
    const kipId=(await s.plan()).dishes.find(d=>d.name==='Kippenpoten').id;
    await s.f.locator('[data-v5-kamado="'+kipId+'"]').selectOption('large');await s.page.waitForTimeout(150);
    ok((await s.overflow())<=1,engineName+': '+width+' px: stap 2 met urgent conflict zonder overflow');
    const small=await s.page.evaluate(()=>[...document.querySelectorAll('[data-v5-urgent] button')].filter(b=>b.getBoundingClientRect().height<43.5).length);
    ok(small===0,engineName+': '+width+' px: tikdoelen in het rode paneel >= 44 px');
    const inside=await s.page.evaluate(()=>{const p=document.querySelector('[data-v5-urgent]').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth});
    ok(inside,engineName+': '+width+' px: het rode paneel past binnen het scherm');
    if(width===320)await s.shot(shots,'06-stap2-urgent-conflict-320');
    await s.act('prep');
    ok((await s.overflow())<=1,engineName+': '+width+' px: bevestigingspaneel zonder overflow');
    ok(await s.page.evaluate(()=>[...document.querySelectorAll('[data-v5-prep-confirm] button')].every(b=>b.getBoundingClientRect().height>=43.5)),engineName+': '+width+' px: knoppen >= 44 px');
    if(width===320)await s.shot(shots,'09-stap2-bevestiging-320');
    await s.context.close();
    const t=await open(browser,T_2340,{width});
    await startSession(t,['Ribeye 500 g']);await t.act('prep');await t.act('live');await t.act('late-ask');
    ok((await t.overflow())<=1,engineName+': '+width+' px: Live met voorstel zonder overflow');
    const btn=await t.page.evaluate(()=>[...document.querySelectorAll('[data-v5-late] button')].filter(b=>b.getBoundingClientRect().height<43.5).length);
    ok(btn===0,engineName+': '+width+' px: tikdoelen in het aanbod >= 44 px');
    if(width===320)await t.shot(shots,'07-live-plan-opnieuw-320');
    await t.context.close();
   }
   console.log('OK v5.7.0 planning: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.7.0 planning eenvoudiger: '+checks+' checks (chromium, webkit; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
