/* v5.15.0 sessiehistorie (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam) en een
   gezaaide opslag (drie gerechten: Ribeye 500 g staat te rusten na 65 min met een handmatige kern van 54,5 °C, Kippenpoten staat nog op de BBQ,
   Krieltjes is nog niet begonnen). Geen Home Assistant, MEATER of echte iPhone; geen live MEATER-waarden.
   Toetst: "Sessie afronden" bewaart precies de gestarte gerechten in kamado-reviews-v1 (naam, duur, eindkern met bron, score optioneel),
   niet het niet-gestarte gerecht, checkbox uit = geen item, tweede keer afronden = geen duplicaat, een eerdere handmatige review van dezelfde
   bereiding telt als al bewaard (een oudere review van een andere keer niet), Annuleren = opslag byte-gelijk (view.scroll uitgezonderd),
   "Eerdere bereidingen (N)" op Vandaag leidt naar "Vorige bereidingen" met het item, een niet ingevulde score vertekent het gemiddelde niet,
   geen dialogen, geen horizontale overflow, tikdoelen >= 44 px. */
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
const FIXTURE=JSON.parse(await readFile(path.join(root,'tests/fixtures/v570-session.json'),'utf8'));
const PLAN='kamado-bereidingsplanner-v1',SESSION='bbq-v5-session-v1',REVIEWS='kamado-reviews-v1';
const T_1500='2026-11-16T14:00:00Z'; // Europe/Amsterdam: 15:00
const START_RIB=Date.parse('2026-11-16T12:00:00Z'),REST_RIB=START_RIB+65*60000,START_KIP=Date.parse('2026-11-16T12:30:00Z');
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

function seedPlan(){
  const plan=JSON.parse(JSON.stringify(FIXTURE.state)),[rib,kip]=plan.dishes;
  Object.assign(rib,{phase:'resting',startedAt:START_RIB,restAt:REST_RIB,doneAt:null,manual:{points:[{t:START_RIB+50*60000,core:54.5}],grill:null}});
  Object.assign(kip,{phase:'cooking',startedAt:START_KIP,restAt:null,doneAt:null});
  const third=JSON.parse(JSON.stringify(rib));Object.assign(third,{id:'gerecht-1794830400000-6',name:'Krieltjes',phase:'waiting',startedAt:null,restAt:null,doneAt:null,manual:undefined});delete third.manual;
  plan.dishes=[rib,kip,third];
  return plan;
}
const review=(name,createdAt,extra={})=>({id:'',name,date:'1-11-2026',createdAt,rating:2,finalCore:null,grill:120,targetCore:'54',thermometer:'none',lastMeasured:null,ambient:null,actualMinutes:70,photo:'',comment:'oud',...extra});

async function open(browser,{width=390,reviews=null}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__dialogCalls=[];
    window.confirm=(...a)=>{window.__dialogCalls.push('confirm:'+a[0]);return false};
    window.alert=(...a)=>{window.__dialogCalls.push('alert:'+a[0])};
    window.prompt=(...a)=>{window.__dialogCalls.push('prompt:'+a[0]);return null};});
  await context.addInitScript(([k,sk,rk,payload])=>{if(!sessionStorage.getItem('__seeded')){localStorage.setItem(k,JSON.stringify(payload.plan));localStorage.setItem(sk,JSON.stringify(payload.session));if(payload.reviews)localStorage.setItem(rk,JSON.stringify(payload.reviews));sessionStorage.setItem('__seeded','1')}},
    [PLAN,SESSION,REVIEWS,{plan:seedPlan(),session:FIXTURE.session,reviews}]);
  await context.clock.install({time:new Date(T_1500)});
  const page=await context.newPage(),errors=[],dialogs=[];
  const s={context,page,errors,dialogs};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.goto(origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html',{waitUntil:'load'});
  await page.locator('#v5-root').waitFor();
  await context.clock.setFixedTime(new Date(T_1500));
  s.click=async a=>{await page.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);};
  s.tab=async a=>{await page.locator('#v5-nav [data-v5-act="'+a+'"]').click();await page.waitForTimeout(120);};
  s.count=sel=>page.locator(sel).count();
  s.visible=sel=>page.locator(sel).first().isVisible();
  s.text=sel=>page.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  // Byte-vergelijking van de hele opslag, met ENIGE uitzondering de schuifpositie die de app zelf onthoudt (bbq-v5-session-v1 -> view.scroll,
  // 1000 ms na elke scroll geschreven; zie v590). Alle andere sleutels en velden blijven byte-gelijk getoetst.
  s.dump=()=>page.evaluate(([SK])=>{const o=Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
    if(o[SK]){try{const j=JSON.parse(o[SK]);if(j&&j.view&&typeof j.view==='object'){j.view.scroll='(genegeerd)';o[SK]=JSON.stringify(j);}}catch{}}
    return JSON.stringify(o);},[SESSION]);
  s.get=k=>page.evaluate(k=>localStorage.getItem(k),k);
  s.reviews=async()=>JSON.parse(await s.get(REVIEWS)||'[]');
  s.screen=()=>page.evaluate(()=>document.querySelector('#v5-root').dataset.screen);
  s.dialogCalls=()=>page.evaluate(()=>window.__dialogCalls.length);
  s.overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  s.small=sel=>page.evaluate(q=>[...document.querySelectorAll(q+' button, '+q+' input, '+q+' select, '+q+' textarea')].filter(b=>b.getBoundingClientRect().height<43.5).length,sel);
  s.inside=sel=>page.evaluate(q=>{const p=document.querySelector(q).getBoundingClientRect();return p.left>=0&&p.right<=innerWidth},sel);
  s.dishId=async name=>(JSON.parse(await s.get(PLAN)).dishes.find(d=>d.name===name)||{}).id;
  return s;
}
const PANEL='[data-v5-finish-confirm]';

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   // 1. Hoofdroute (390 px): paneel, annuleren, bevestigen, tweede keer afronden, Vandaag-link, historie.
   {
    const s=await open(browser);
    ok(await s.screen()==='live',engineName+': de gezaaide sessie opent op Live');
    ok(JSON.parse(await s.get(PLAN)).dishes.map(d=>d.phase).join()==='resting,cooking,waiting',engineName+': fixture: gestart, gestart, niet begonnen');
    ok((await s.reviews()).length===0,engineName+': nog geen historie');
    await s.page.waitForTimeout(150);
    const before=await s.dump();
    await s.click('finish');
    ok(await s.count(PANEL)===1,engineName+': paneel in de pagina');
    ok(await s.count(PANEL+' [data-v5-fin-save]')===2,engineName+': twee regels (alleen de gestarte gerechten)');
    const txt=await s.text(PANEL);
    ok(/Bewaar in bereidingshistorie/.test(txt),engineName+': "Bewaar in bereidingshistorie" '+txt);
    ok(/Ribeye 500 g/.test(txt)&&/65 min op de BBQ/.test(txt)&&/eindkern 54,5 °C \(handmatig ingevoerd\)/.test(txt),engineName+': Ribeye: naam, 65 min, eindkern met bron handmatig: '+txt);
    ok(/Kippenpoten/.test(txt)&&/duur niet vastgelegd/.test(txt)&&/eindkern niet bekend/.test(txt),engineName+': Kippenpoten: geen verzonnen duur of kern');
    ok(!/Krieltjes/.test(txt),engineName+': het niet-gestarte gerecht staat er niet bij');
    ok(!/LIVE|MEATER-meting/.test(txt),engineName+': een handmatige kern wordt niet als MEATER/LIVE getoond');
    ok(/alleen bewaard in je eigen opslag/.test(txt)&&/Home Assistant-account/.test(txt),engineName+': korte opslagregel');
    ok(await s.page.locator(PANEL+' [data-v5-fin-save]').evaluateAll(l=>l.every(e=>e.checked)),engineName+': standaard AAN');
    ok(await s.page.locator(PANEL+' [data-v5-fin-rating]').evaluateAll(l=>l.length===2&&l.every(e=>e.value==='')),engineName+': score standaard leeg ("Geen score")');
    ok(await s.page.evaluate(q=>{const p=document.querySelector(q).getBoundingClientRect();return p.top>=0},PANEL),engineName+': paneel begint in beeld');
    ok(await s.dump()===before&&await s.dialogCalls()===0,engineName+': het paneel tonen schrijft niets');
    // Annuleren: opslag byte-gelijk, ook na invullen.
    const ribId=await s.dishId('Ribeye 500 g');
    await s.page.locator(PANEL+' [data-v5-fin-rating="'+ribId+'"]').selectOption('4');
    await s.page.locator(PANEL+' [data-v5-fin-comment]').fill('niet bewaren');
    await s.page.locator(PANEL+' [data-v5-fin-save="'+await s.dishId('Kippenpoten')+'"]').uncheck();
    await s.click('finish-cancel');
    ok(await s.count(PANEL)===0&&await s.screen()==='live',engineName+': annuleren: paneel weg, nog op Live');
    ok(await s.dump()===before,engineName+': annuleren: de hele opslag byte-gelijk (view.scroll uitgezonderd)');
    // Opnieuw openen: schoon concept (alles weer standaard).
    await s.click('finish');
    ok(await s.page.locator(PANEL+' [data-v5-fin-save]').evaluateAll(l=>l.every(e=>e.checked))&&await s.page.locator(PANEL+' [data-v5-fin-comment]').inputValue()==='',engineName+': heropend: standaard AAN en leeg concept');
    // Invullen en een herbouw (zichtbaarheidswissel) overleeft het concept.
    await s.page.locator(PANEL+' [data-v5-fin-rating="'+ribId+'"]').selectOption('4');
    await s.page.locator(PANEL+' [data-v5-fin-comment]').fill('Mooi rosé, volgende keer 5 min korter');
    await s.page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'))});await s.page.waitForTimeout(100);
    ok(await s.page.locator(PANEL+' [data-v5-fin-rating="'+ribId+'"]').inputValue()==='4'&&(await s.page.locator(PANEL+' [data-v5-fin-comment]').inputValue()).startsWith('Mooi rosé'),engineName+': invoer blijft staan na een herbouw');
    await s.click('finish-confirm');
    ok(await s.screen()==='home'&&await s.count(PANEL)===0,engineName+': bevestigen: terug op Vandaag');
    const items=await s.reviews();
    ok(items.length===2,engineName+': precies 2 items in kamado-reviews-v1 (was '+items.length+')');
    const rib=items.find(i=>i.name==='Ribeye 500 g'),kip=items.find(i=>i.name==='Kippenpoten');
    ok(rib&&kip&&!items.some(i=>i.name==='Krieltjes'),engineName+': Ribeye en Kippenpoten, geen Krieltjes');
    ok(rib.actualMinutes===65&&rib.finalCore===54.5&&rib.lastMeasured===null&&rib.ambient===null&&rib.thermometer==='none',engineName+': Ribeye: 65 min, eindkern 54,5 handmatig (geen MEATER-waarde) '+JSON.stringify(rib));
    ok(rib.rating===4&&rib.comment==='Mooi rosé, volgende keer 5 min korter'&&rib.targetCore==='54'&&rib.grill===120,engineName+': Ribeye: score, opmerking, doel en BBQ-temperatuur');
    ok(kip.actualMinutes===null&&kip.finalCore===null&&kip.rating===null,engineName+': Kippenpoten: geen duur, geen kern en geen score verzonnen '+JSON.stringify(kip));
    ok(kip.comment==='Mooi rosé, volgende keer 5 min korter'&&/^\d{4}-\d{2}-\d{2}T/.test(kip.createdAt)&&!!kip.date&&!!kip.id,engineName+': opmerking per sessie, createdAt, datum en id gevuld');
    ok(JSON.parse(await s.get(SESSION)).active===false&&JSON.parse(await s.get(SESSION)).stage==='finished',engineName+': sessie afgerond');
    ok(await s.count('[data-v5-finish-info]')===1&&/2 gerechten bewaard in je bereidingshistorie/.test(await s.text('[data-v5-finish-info]')),engineName+': melding "2 gerechten bewaard"');
    ok(/Eerdere bereidingen \(2\)/.test(await s.text('#v5-root .v5-list')),engineName+': Vandaag: "Eerdere bereidingen (2)"');
    // De link na afronden leidt naar Vorige bereidingen.
    await s.click('history');
    ok(await s.visible('#v46-history'),engineName+': "Vorige bereidingen" is zichtbaar via de link');
    const hist=await s.text('#v46-history');
    ok(/Ribeye 500 g/.test(hist)&&/Kippenpoten/.test(hist),engineName+': beide bereidingen staan in de historie: '+hist);
    ok(/Ribeye 500 g 1 geregistreerde sessie · laatst .*mediane duur 65 min.*score 4\.0\/5.*54\.5/.test(hist),engineName+': Ribeye: duur, score en eindkern in de historie: '+hist);
    ok(/Kippenpoten 1 geregistreerde sessie.*Werkelijke duur niet vastgelegd.*geen score/.test(hist),engineName+': Kippenpoten: eerlijk "duur niet vastgelegd" en "geen score": '+hist);
    ok(!/Krieltjes/.test(hist),engineName+': Krieltjes staat niet in de historie');
    // Tweede keer afronden: geen duplicaten.
    await s.tab('live');
    await s.click('finish');
    ok(await s.count(PANEL+' [data-v5-fin-save]')===0&&(await s.text(PANEL).then(t=>(t.match(/Staat al in je bereidingshistorie/g)||[]).length))===2,engineName+': tweede keer: beide gerechten "Staat al in je bereidingshistorie", geen checkbox');
    await s.click('finish-confirm');
    ok((await s.reviews()).length===2,engineName+': tweede keer afronden: nog steeds 2 items (geen duplicaat)');
    ok(/niets dubbel bewaard/.test(await s.text('[data-v5-finish-info]')),engineName+': melding legt uit dat er niets dubbel is bewaard');
    ok(await s.dialogCalls()===0&&s.dialogs.length===0&&s.errors.length===0,engineName+': geen dialogen of fouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // 2. Checkbox uit: geen item; en één van de twee uit = één item.
   {
    const s=await open(browser);
    await s.click('finish');
    for(const l of await s.page.locator(PANEL+' [data-v5-fin-save]').all())await l.uncheck();
    await s.click('finish-confirm');
    ok((await s.reviews()).length===0,engineName+': beide uit: geen enkel item');
    ok(await s.screen()==='home'&&JSON.parse(await s.get(SESSION)).stage==='finished',engineName+': de sessie wordt toch afgerond');
    ok(/Er is niets in je bereidingshistorie bewaard/.test(await s.text('[data-v5-finish-info]'))&&/Eerdere bereidingen \(0\)/.test(await s.text('#v5-root .v5-list')),engineName+': melding "niets bewaard" en teller (0)');
    await s.context.close();
    const t=await open(browser);
    await t.click('finish');
    await t.page.locator(PANEL+' [data-v5-fin-save="'+await t.dishId('Kippenpoten')+'"]').uncheck();
    await t.click('finish-confirm');
    const items=await t.reviews();
    ok(items.length===1&&items[0].name==='Ribeye 500 g'&&items[0].rating===null,engineName+': alleen Ribeye bewaard, zonder score (rating leeg)');
    ok(await t.dialogCalls()===0&&t.dialogs.length===0&&t.errors.length===0,engineName+': geen dialogen of fouten');
    await t.context.close();
   }
   // 3. Dedup met een eerdere handmatige review van dezelfde bereiding; een oudere review van een andere keer telt niet; score vertekent niets.
   {
    const s=await open(browser,{reviews:[review('Kippenpoten','2026-11-16T12:45:00.000Z',{rating:5,comment:'handmatig',actualMinutes:null}),review('Ribeye 500 g','2026-11-01T18:00:00.000Z')]});
    ok((await s.reviews()).length===2,engineName+': gezaaid: twee bestaande reviews');
    await s.click('finish');
    const txt=await s.text(PANEL);
    ok(await s.count(PANEL+' [data-v5-fin-save]')===1&&/Kippenpoten Staat al in je bereidingshistorie/.test(txt),engineName+': Kippenpoten (handmatige review na het starten) staat al in de historie; Ribeye niet (oudere review)');
    await s.click('finish-confirm');
    const items=await s.reviews();
    ok(items.length===3&&items.filter(i=>i.name==='Kippenpoten').length===1&&items.filter(i=>i.name==='Ribeye 500 g').length===2,engineName+': 3 items: geen tweede Kippenpoten, wel een nieuwe Ribeye');
    ok(items.find(i=>i.name==='Kippenpoten').comment==='handmatig',engineName+': de handmatige review is ongewijzigd');
    await s.click('history');
    const hist=await s.text('#v46-history');
    ok(/Ribeye 500 g 2 geregistreerde sessies.*mediane duur 67\.5 min.*score 2\.0\/5/.test(hist),engineName+': een niet ingevulde score telt niet mee: gemiddelde blijft 2.0/5 (niet 3.5): '+hist);
    ok(/Kippenpoten 1 geregistreerde sessie.*score 5\.0\/5/.test(hist),engineName+': handmatige score 5.0/5 ongewijzigd');
    ok(s.errors.length===0&&await s.dialogCalls()===0,engineName+': geen dialogen of fouten');
    await s.context.close();
   }
   // 4. 390 en 320 px: geen overflow, tikdoelen >= 44 px, paneel binnen het scherm, Vandaag na afronden.
   for(const width of [390,320]){
    const s=await open(browser,{width});
    await s.click('finish');
    ok((await s.overflow())<=1&&await s.small(PANEL)===0&&await s.inside(PANEL),engineName+': '+width+' px: paneel zonder overflow, alle bediening >= 44 px');
    ok(await s.page.locator(PANEL+' [data-v5-fin-comment]').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),engineName+': '+width+' px: invoervelden 16 px (geen zoom op iOS)');
    await s.click('finish-confirm');
    ok((await s.overflow())<=1&&await s.small('[data-v5-finish-info]')===0,engineName+': '+width+' px: Vandaag na afronden zonder overflow');
    await s.click('history');
    ok((await s.overflow())<=1&&await s.visible('#v46-history'),engineName+': '+width+' px: Vorige bereidingen zonder overflow');
    ok(s.errors.length===0&&await s.dialogCalls()===0&&s.dialogs.length===0,engineName+': '+width+' px: geen dialogen of fouten '+s.errors.join(' | '));
    await s.context.close();
   }
   console.log('OK v5.15.0 sessiehistorie: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.15.0 sessiehistorie: '+checks+' checks (chromium, webkit; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
