/* v5.12.0 geen dialogen meer (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam).
   Geen Home Assistant, MEATER of echte iPhone.
   Dialogen zijn GEBLOKKEERD zoals de HA-app/iframe dat kan: window.confirm geeft false, alert/prompt doen niets, en page.on('dialog') mag
   nooit afgaan. Elke vervangen actie wordt doorlopen: annuleren (hele opslag byte-gelijk) en bevestigen (het effect gebeurt):
     1. Voorbeeld herstellen (Meer)          5. Deel de app / Deel website (Meer), met en zonder klembord
     2. Recepten importeren (samenvoegen en vervangen) 6. Boodschappenlijst kopiëren (Meer), met en zonder klembord
     3. Recept verwijderen uit de bibliotheek   7. "Controleer de eindkerntemperatuur" als melding bij het veld
     4. Planning laden + "Kan planning niet laden"   8. Escape en tik naast het paneel = annuleren
   Plus: 320 px zonder overflow, tikdoelen >= 44 px, en de bronbestanden bevatten geen window.confirm/alert/prompt meer (behalve de PWA-installatie).
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
const FIXTURE=JSON.parse(await readFile(path.join(root,'tests/fixtures/v570-session.json'),'utf8')); // echte opslag van v5.7.0: twee gerechten, een actieve sessie
const LIBRARY=JSON.parse(await readFile(path.join(root,'tests/fixtures/v5100-bibliotheek.json'),'utf8')); // back-up met twee recepten
FIXTURE.state.dishes[0].recipeIngredients='500 g ribeye\n2 el olijfolie\n1 tl zeezout'; // zodat er een boodschappenlijst is
const PLAN='kamado-bereidingsplanner-v1',SESSION='bbq-v5-session-v1',BOOK='kamado-recipe-book-v1',DELETIONS='kamado-recipe-deletions-v1',REVIEWS='kamado-reviews-v1';
const SITE='https://eelbrethouwer-jpg.github.io/bbq_planner_card/';
const T_1500='2026-11-16T14:00:00Z'; // Europe/Amsterdam: 15:00
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const file=(name,obj)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(obj))});
const OTHER_BOOK={format:'bbq-receptenbibliotheek-v1',exportedAt:'2026-11-19T09:00:00.000Z',recipes:[{...LIBRARY.recipes[0],name:'Fixture ander recept'}]};

async function open(browser,{width=390,clipboard='fail'}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  // Dialogen GEBLOKKEERD: confirm geeft false, alert/prompt doen niets. Elke aanroep wordt geteld. Delen en klembord zijn per test te sturen.
  await context.addInitScript(([clip])=>{window.__dialogCalls=[];window.__clip=[];
    window.confirm=(...a)=>{window.__dialogCalls.push('confirm:'+a[0]);return false};
    window.alert=(...a)=>{window.__dialogCalls.push('alert:'+a[0])};
    window.prompt=(...a)=>{window.__dialogCalls.push('prompt:'+a[0]);return null};
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>clip==='ok'?(window.__clip.push(String(t)),Promise.resolve()):Promise.reject(new Error('NotAllowedError'))}});
  },[clipboard]);
  await context.addInitScript(([k,sk,payload])=>{if(!sessionStorage.getItem('__seeded')){localStorage.setItem(k,JSON.stringify(payload.state));localStorage.setItem(sk,JSON.stringify(payload.session));sessionStorage.setItem('__seeded','1')}},[PLAN,SESSION,FIXTURE]);
  await context.clock.install({time:new Date(T_1500)});
  const page=await context.newPage(),errors=[],dialogs=[];
  const s={context,page,errors,dialogs,width};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();}); // mag nooit afgaan
  await page.goto(origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html',{waitUntil:'load'});
  await page.locator('#v5-root').waitFor();
  await context.clock.setFixedTime(new Date(T_1500));
  s.tab=async a=>{await page.locator('#v5-nav [data-v5-act="'+a+'"]').click();await page.waitForTimeout(150);};
  // Klap de (dichte) uitklapblokken van Meer open zoals een gebruiker dat doet, tot het element zichtbaar is.
  s.reveal=async sel=>{for(let i=0;i<4;i++){const loc=page.locator(sel).first();if(await loc.isVisible()){await loc.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await s.flush();return;}const sum=loc.locator('xpath=ancestor::details[not(@open)][1]/summary');if(!await sum.count())return;await sum.click();await page.waitForTimeout(120);}};
  // De v5-schil bewaart de scrollstand met 1 s vertraging (bestaand gedrag): laat die eerst uitlopen voordat we de opslag als nulmeting nemen.
  s.flush=async()=>{let y=-1;for(let i=0;i<40;i++){const n=await page.evaluate(()=>Math.round(scrollY));if(n===y)break;y=n;await page.waitForTimeout(120);}await context.clock.runFor(1500);await page.waitForTimeout(60);}; // wacht ook op de vloeiende scroll (html{scroll-behavior:smooth})
  s.center=async loc=>{await loc.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await s.flush();};
  // Echte muisklik op het midden (na centreren): op de lange Planning-pagina verspringt Playwrights eigen scroll onder de klok-mock.
  s.hit=async loc=>{await s.center(loc);const b=await loc.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(120);};
  s.same=async(ref,msg)=>{const d=await s.dump();if(d!==ref){const a=JSON.parse(ref),b=JSON.parse(d);for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(a[k]!==b[k])console.log('OPSLAG VERSCHIL',k,String(a[k]).slice(0,300),'=>',String(b[k]).slice(0,300));}ok(d===ref,msg);};
  // Als dump, maar zonder de scrollstand van de v5-schil (view.scroll, bestaand gedrag): de veldmelding scrolt zelf het veld in beeld.
  s.dumpData=async()=>{const o=JSON.parse(await s.dump());try{const m=JSON.parse(o[SESSION]);delete m.view;o[SESSION]=JSON.stringify(m)}catch(e){}return JSON.stringify(o)};
  s.dump=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
  s.get=k=>page.evaluate(k=>localStorage.getItem(k),k);
  s.json=async k=>JSON.parse(await s.get(k)||'null');
  s.panels=()=>page.locator('.v512-overlay').count();
  s.panelText=()=>page.locator('.v512-panel').first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.press=async key=>{await page.locator('.v512-overlay [data-v512="'+key+'"]').click();await page.waitForTimeout(150);};
  s.overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  s.fits=()=>page.evaluate(()=>{const p=document.querySelector('.v512-panel').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight+0.5});
  s.small=()=>page.evaluate(()=>[...document.querySelectorAll('.v512-panel button')].filter(b=>b.getBoundingClientRect().height<43.5).length);
  s.dialogCalls=()=>page.evaluate(()=>window.__dialogCalls.length);
  s.shot=async(dir,name)=>{if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});};
  // Het paneel is open, leesbaar en past (ook op 320 px); geen dialoog, geen overflow, tikdoelen >= 44 px.
  s.expectPanel=async(label,re)=>{
    ok(await s.panels()===1,label+': er staat precies een paneel in de pagina');
    const t=await s.panelText();ok(re.test(t),label+': paneeltekst "'+t.slice(0,140)+'"');
    ok(await page.locator('.v512-panel[role="alertdialog"][aria-modal="true"]').count()===1,label+': role alertdialog, aria-modal');
    ok(await s.fits(),label+': het paneel past binnen het scherm ('+width+' px)');
    ok((await s.overflow())<=1,label+': geen horizontale overflow '+await s.overflow());
    ok(await s.small()===0,label+': alle paneelknoppen >= 44 px');
    ok(await s.dialogCalls()===0&&dialogs.length===0,label+': geen window.confirm/alert/prompt of dialoog');
  };
  return s;
}
const closed=async(s,label)=>{ok(await s.panels()===0,label+': het paneel is weg');};
const NOERR=async(s,label)=>ok(s.errors.length===0&&s.dialogs.length===0&&await s.dialogCalls()===0,label+': geen paginafouten of dialogen '+s.errors.join(' | '));

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  const shots=process.env.SCREENSHOTS_DIR?path.join(process.env.SCREENSHOTS_DIR,engineName):null;
  try{
   for(const width of [390,320]){
    const E=engineName+' '+width;
    // 1. Voorbeeld herstellen (Meer) + 8. Escape en tik naast het paneel.
    {
     const s=await open(browser,{width});await s.tab('more');await s.reveal('#reset');
     const start=await s.dump();
     ok(JSON.parse(start)[PLAN]!==undefined&&JSON.parse(JSON.parse(start)[PLAN]).dishes.length===2,E+': opslag gezaaid met de echte v5.7.0-opslag (2 gerechten)');
     await s.page.locator('#reset').click();await s.page.waitForTimeout(150);
     await s.expectPanel(E+' herstellen',/Voorbeeld herstellen\?.*vervangen.*Er verandert niets tot je kiest/);
     await s.same(start,E+' herstellen: het paneel tonen schrijft niets');
     await s.shot(shots,'01-meer-voorbeeld-herstellen-'+width);
     await s.press('cancel');await closed(s,E+' herstellen annuleren');
     await s.same(start,E+' herstellen annuleren: de hele opslag byte-gelijk');
     await s.page.locator('#reset').click();await s.page.waitForTimeout(100);await s.page.keyboard.press('Escape');await s.page.waitForTimeout(100);
     await closed(s,E+' herstellen Escape');await s.same(start,E+' herstellen Escape: opslag byte-gelijk');
     await s.page.locator('#reset').click();await s.page.waitForTimeout(100);await s.page.mouse.click(2,2);await s.page.waitForTimeout(100);
     await closed(s,E+' herstellen tik naast het paneel');await s.same(start,E+' herstellen tik naast het paneel: opslag byte-gelijk');
     const reviewsBefore=await s.get(REVIEWS);
     await s.page.locator('#reset').click();await s.page.waitForTimeout(100);await s.press('ok');
     await closed(s,E+' herstellen bevestigen');
     const plan=await s.json(PLAN);
     ok(plan.dishes.length===3&&!plan.dishes.some(d=>d.name==='Kippenpoten'),E+' herstellen bevestigen: het voorbeeld is terug (3 gerechten) '+plan.dishes.map(d=>d.name));
     ok(await s.get(REVIEWS)===reviewsBefore,E+' herstellen bevestigen: beoordelingen onaangeroerd (zoals voorheen)');
     ok(/Voorbeeld hersteld/.test(await s.page.locator('#toast').textContent()),E+' herstellen bevestigen: dezelfde melding als voorheen');
     await NOERR(s,E+' herstellen');await s.context.close();
    }
    // 2. Recepten importeren, 3. recept verwijderen (Recepten).
    {
     const s=await open(browser,{width});await s.tab('recipes');await s.reveal('#library-import');
     const start=await s.dump();
     // Samenvoegen: annuleren.
     await s.page.locator('#library-import-mode').selectOption('merge');
     await s.page.locator('#library-file').setInputFiles(file('bibliotheek.json',LIBRARY));await s.page.waitForTimeout(200);
     await s.expectPanel(E+' import samenvoegen',/Importeer 2 recepten\?.*Bestaande recepten met dezelfde naam worden bijgewerkt.*Bestaande beoordelingen blijven ongewijzigd.*Er verandert niets tot je kiest/);
     await s.same(start,E+' import samenvoegen: het paneel tonen schrijft niets');
     await s.shot(shots,'02-recepten-import-bevestiging-'+width);
     await s.press('cancel');await closed(s,E+' import annuleren');
     await s.same(start,E+' import annuleren: de hele opslag byte-gelijk');
     ok(!/geïmporteerd/.test(await s.page.locator('#library-feedback').textContent()),E+' import annuleren: geen succesmelding');
     // Samenvoegen: bevestigen (hetzelfde bestand nogmaals kiezen kan: de invoer is gewist).
     await s.page.locator('#library-file').setInputFiles(file('bibliotheek.json',LIBRARY));await s.page.waitForTimeout(200);await s.press('ok');
     await closed(s,E+' import bevestigen');
     ok(/2 recepten geïmporteerd \(samengevoegd\)/.test(await s.page.locator('#library-feedback').textContent()),E+' import bevestigen: '+await s.page.locator('#library-feedback').textContent());
     const names=(await s.json(BOOK)).map(r=>r.name).sort();
     ok(names.length===2&&names.includes('Fixture oud recept zonder coreAt')&&names.includes('Fixture nieuw recept met coreAt'),E+' import bevestigen: beide recepten staan in de bibliotheek '+names);
     // Vervangen: annuleren, dan bevestigen (een ander bestand met een recept).
     const afterMerge=await s.dump();
     await s.page.locator('#library-import-mode').selectOption('replace');
     await s.page.locator('#library-file').setInputFiles(file('ander.json',OTHER_BOOK));await s.page.waitForTimeout(200);
     await s.expectPanel(E+' import vervangen',/Importeer 1 recepten\?.*Dit vervangt alle eigen recepten.*Home Assistant.*Er verandert niets tot je kiest/);
     ok(await s.page.locator('.v512-overlay [data-v512="ok"]').textContent()==='Ja, bibliotheek vervangen',E+' import vervangen: de knop zegt wat er gebeurt');
     await s.press('cancel');
     await s.same(afterMerge,E+' import vervangen annuleren: de hele opslag byte-gelijk');
     await s.page.locator('#library-file').setInputFiles(file('ander.json',OTHER_BOOK));await s.page.waitForTimeout(200);await s.press('ok');
     ok(JSON.stringify((await s.json(BOOK)).map(r=>r.name))==='["Fixture ander recept"]',E+' import vervangen bevestigen: alleen het nieuwe recept staat er nog');
     ok((await s.json(DELETIONS)||[]).some(x=>x.name==='Fixture oud recept zonder coreAt'),E+' import vervangen bevestigen: verwijderingen zijn vastgelegd (zoals voorheen)');
     // Verwijderen.
     const item='#library-items [data-library-name="Fixture ander recept"]';
     await s.page.locator(item).evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await s.flush();
     const beforeDelete=await s.dump();
     await s.page.locator(item+' [data-library-action="delete"]').click();await s.page.waitForTimeout(150);
     await s.expectPanel(E+' verwijderen',/Recept verwijderen\?.*Recept "Fixture ander recept" verwijderen uit je bibliotheek\?.*Home Assistant-account.*Reeds geplande gerechten blijven staan.*Er verandert niets tot je kiest/);
     await s.same(beforeDelete,E+' verwijderen: het paneel tonen schrijft niets');
     await s.shot(shots,'03-recepten-verwijderen-bevestiging-'+width);
     await s.press('cancel');await closed(s,E+' verwijderen annuleren');
     ok(await s.dump()===beforeDelete&&await s.page.locator(item).count()===1,E+' verwijderen annuleren: opslag byte-gelijk, recept staat er nog');
     await s.page.locator(item+' [data-library-action="delete"]').click();await s.page.waitForTimeout(150);await s.press('ok');
     ok(await s.page.locator(item).count()===0&&(await s.json(BOOK)).length===0,E+' verwijderen bevestigen: recept weg uit de bibliotheek');
     ok((await s.json(DELETIONS)||[]).some(x=>x.name==='Fixture ander recept'),E+' verwijderen bevestigen: verwijdering vastgelegd voor synchronisatie (zoals voorheen)');
     // Een ongeldig bestand geeft nog steeds de bestaande foutmelding in de pagina, zonder paneel.
     const beforeBad=await s.dump();
     await s.page.locator('#library-file').setInputFiles(file('kapot.json',{format:'iets-anders',recipes:[]}));await s.page.waitForTimeout(200);
     ok(await s.panels()===0&&/Import mislukt/.test(await s.page.locator('#library-feedback').textContent())&&await s.dump()===beforeBad,E+' ongeldig bestand: bestaande melding, opslag byte-gelijk');
     await NOERR(s,E+' recepten');await s.context.close();
    }
    // 4. Planning laden + "Kan planning niet laden" (Meer).
    {
     const s=await open(browser,{width});await s.tab('more');await s.reveal('#json-import');
     const start=await s.dump();
     const plan=JSON.parse(JSON.parse(start)[PLAN]);
     const smaller={format:'bbq-planner-v4',savedAt:'2026-11-16T14:00:00.000Z',plan:{...plan,dishes:plan.dishes.slice(0,1)}};
     await s.page.locator('#json-file').setInputFiles(file('plan.json',smaller));await s.page.waitForTimeout(200);
     await s.expectPanel(E+' planning laden',/Planning laden\?.*Planning met 1 gerechten laden\? Dit vervangt de planning in deze browser.*Er verandert niets tot je kiest/);
     await s.same(start,E+' planning laden: het paneel tonen schrijft niets');
     await s.shot(shots,'04-meer-planning-laden-'+width);
     await s.press('cancel');await closed(s,E+' planning laden annuleren');
     await s.same(start,E+' planning laden annuleren: de hele opslag byte-gelijk');
     ok(!/Planning geladen/.test(await s.page.locator('#toast').textContent()),E+' planning laden annuleren: geen succesmelding');
     await s.page.locator('#json-file').setInputFiles(file('plan.json',smaller));await s.page.waitForTimeout(200);await s.press('ok');
     await closed(s,E+' planning laden bevestigen');
     ok((await s.json(PLAN)).dishes.length===1&&(await s.json(PLAN)).dishes[0].name===plan.dishes[0].name,E+' planning laden bevestigen: de planning is vervangen');
     ok(/Planning geladen/.test(await s.page.locator('#toast').textContent()),E+' planning laden bevestigen: dezelfde melding als voorheen');
     // Fout: een melding in de pagina, niets verandert.
     const beforeBad=await s.dump();
     await s.page.locator('#json-file').setInputFiles(file('kapot.json',{plan:{date:'morgen',dishes:[]}}));await s.page.waitForTimeout(200);
     await s.expectPanel(E+' planning laden mislukt',/Kan planning niet laden.*Onbekend bestandsformaat/);
     ok(await s.page.locator('.v512-overlay [data-v512="cancel"]').count()===0,E+' planning laden mislukt: alleen een sluitknop');
     await s.same(beforeBad,E+' planning laden mislukt: opslag byte-gelijk');
     await s.shot(shots,'05-meer-planning-laden-mislukt-'+width);
     await s.press('ok');await closed(s,E+' planning laden mislukt sluiten');
     await s.same(beforeBad,E+' planning laden mislukt sluiten: opslag byte-gelijk');
     await NOERR(s,E+' planning laden');await s.context.close();
    }
    // 5. Deel de app (window.prompt) -> leesbaar veld + kopieerknop. Klembord geweigerd.
    for(const id of ['share-public','v49-share']){
     const s=await open(browser,{width,clipboard:'fail'});await s.tab('more');await s.reveal('#'+id);
     const start=await s.dump();
     await s.page.locator('#'+id).click();await s.page.waitForTimeout(250);
     await s.expectPanel(E+' delen ('+id+')',/Deel de app.*Kopieer deze link.*niet gedeeld/);
     const field=s.page.locator('.v512-panel input.v512-field');
     ok(await field.count()===1&&await field.inputValue()===SITE&&await field.evaluate(e=>e.readOnly),E+' delen ('+id+'): de link staat leesbaar in een veld');
     ok(await field.evaluate(e=>e.scrollWidth<=e.clientWidth+1||e.clientWidth>=200),E+' delen ('+id+'): het veld is breed genoeg');
     await s.shot(shots,'06-meer-deel-de-app-'+width);
     await s.press('copy');
     ok(/geselecteerd/.test(await s.page.locator('.v512-status').textContent()),E+' delen ('+id+'): klembord geweigerd, de tekst is geselecteerd: '+await s.page.locator('.v512-status').textContent());
     ok(await field.evaluate(e=>e.selectionStart===0&&e.selectionEnd===e.value.length),E+' delen ('+id+'): de hele link is geselecteerd');
     await s.same(start,E+' delen ('+id+'): opslag byte-gelijk');
     await s.press('ok');await closed(s,E+' delen ('+id+') sluiten');
     await NOERR(s,E+' delen ('+id+')');await s.context.close();
    }
    // 5b. Deel de app met werkend klembord: zoals voorheen een melding, geen paneel; het paneel-kopieerknop werkt met een klembord.
    {
     const s=await open(browser,{width,clipboard:'ok'});await s.tab('more');await s.reveal('#share-public');
     await s.page.locator('#share-public').click();await s.page.waitForTimeout(250);
     ok(await s.panels()===0&&/Website-link gekopieerd/.test(await s.page.locator('#toast').textContent()),E+' delen met klembord: melding zoals voorheen, geen paneel');
     ok(JSON.stringify(await s.page.evaluate(()=>window.__clip))===JSON.stringify([SITE]),E+' delen met klembord: de link staat op het klembord');
     await NOERR(s,E+' delen met klembord');await s.context.close();
    }
    // 6. Boodschappenlijst kopiëren (prompt-terugval) -> tekstvak in de pagina.
    let listText='';
    {
     const s=await open(browser,{width,clipboard:'fail'});await s.tab('more');await s.reveal('#v45-copy');
     const start=await s.dump();
     await s.page.locator('#v45-copy').click();await s.page.waitForTimeout(250);
     await s.expectPanel(E+' boodschappenlijst',/Boodschappenlijst kopiëren.*Kopiëren naar het klembord lukt hier niet.*Selecteer de tekst/);
     const area=s.page.locator('.v512-panel textarea.v512-field');
     listText=await area.inputValue();
     ok(await area.count()===1&&/ribeye/i.test(listText)&&await area.evaluate(e=>e.readOnly),E+' boodschappenlijst: de lijst staat leesbaar in een tekstvak: '+listText.slice(0,60));
     ok(await area.evaluate(e=>e.clientWidth>=180&&e.getBoundingClientRect().right<=innerWidth),E+' boodschappenlijst: het tekstvak past');
     await s.shot(shots,'07-meer-boodschappenlijst-'+width);
     await s.press('copy');
     ok(/geselecteerd/.test(await s.page.locator('.v512-status').textContent()),E+' boodschappenlijst: klembord geweigerd, tekst geselecteerd');
     await s.same(start,E+' boodschappenlijst: opslag byte-gelijk');
     await s.press('ok');await closed(s,E+' boodschappenlijst sluiten');
     await NOERR(s,E+' boodschappenlijst');await s.context.close();
    }
    {
     const s=await open(browser,{width,clipboard:'ok'});await s.tab('more');await s.reveal('#v45-copy');
     await s.page.locator('#v45-copy').click();await s.page.waitForTimeout(250);
     ok(await s.panels()===0&&/Boodschappenlijst gekopieerd/.test(await s.page.locator('#toast').textContent()),E+' boodschappenlijst met klembord: melding zoals voorheen, geen paneel');
     ok((await s.page.evaluate(()=>window.__clip))[0]===listText,E+' boodschappenlijst met klembord: dezelfde tekst als in het tekstvak');
     await NOERR(s,E+' boodschappenlijst met klembord');await s.context.close();
    }
    // 7. "Controleer de eindkerntemperatuur": melding bij het veld in plaats van alert (oude Planning-pagina, gerechtdetails).
    {
     const s=await open(browser,{width});
     await s.tab('live');await s.page.locator('#v5-root [data-v5-act="planning"]').click();await s.page.waitForTimeout(200);
     const card=s.page.locator('#dishes article.dish').first();
     await s.hit(card.locator('[data-v47-dish-toggle]'));
     await s.hit(card.locator('details.review-editor > summary'));
     const input=card.locator('[data-review="finalCore"]');
     await s.center(input);
     await input.fill('200');await s.center(card.locator('[data-action="review"]'));
     const start=await s.dumpData(),reviews=await s.get(REVIEWS);
     const overflowBefore=await s.overflow(); // de oude Planning-pagina heeft met uitgeklapte details al een bestaande overflow (PROJECT_STATUS); de melding mag er niets aan toevoegen
     await s.hit(card.locator('[data-action="review"]'));
     const err=card.locator('.v512-field-error');
     ok(await err.count()===1&&/Controleer de eindkerntemperatuur/.test(await err.textContent()),E+' eindkern: melding bij het veld: '+await err.textContent());
     ok(await err.getAttribute('role')==='alert'&&await input.getAttribute('aria-invalid')==='true'&&await input.getAttribute('aria-describedby')===await err.getAttribute('id'),E+' eindkern: role alert, aria-invalid en aria-describedby');
     ok(await err.isVisible()&&await err.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),E+' eindkern: de melding is zichtbaar en past');
     await s.flush();ok(await s.dumpData()===start&&await s.get(REVIEWS)===reviews,E+' eindkern: er is niets bewaard, opslag byte-gelijk (buiten de scrollstand van de schil)');
     ok((await s.overflow())<=overflowBefore+1&&await s.dialogCalls()===0&&s.dialogs.length===0,E+' eindkern: de melding voegt geen overflow toe ('+overflowBefore+' -> '+await s.overflow()+'), geen dialoog');
     await s.shot(shots,'08-planning-eindkern-melding-'+width);
     // Corrigeren haalt de melding weg; daarna bewaart de review zoals voorheen.
     await input.fill('54');await s.page.waitForTimeout(100);
     ok(await err.count()===0&&await input.getAttribute('aria-invalid')===null,E+' eindkern: typen haalt de melding weg');
     await s.hit(card.locator('[data-action="review"]'));
     const saved=await s.json(REVIEWS);
     ok(Array.isArray(saved)&&saved.length===1&&saved[0].finalCore===54,E+' eindkern: een geldige waarde bewaart de review (finalCore 54)');
     await NOERR(s,E+' eindkern');await s.context.close();
    }
   }
   // Bron: geen window.confirm/alert/prompt meer in de productiebestanden (de PWA-installatie "prompt.prompt()" is iets anders).
   {
    for(const f of ['dist/BBQ_bereidingsplanner_MEATER_v4.html','dist/bbq-v5.js','dist/bbq-v501.js','dist/bbq-eta.js','dist/bbq_planner_card.js','index.html','sw.js']){
     const src=(await readFile(path.join(root,f),'utf8')).replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).split('\n'); // blokcommentaar telt niet
     const hits=src.map((l,i)=>[i+1,l]).filter(([,l])=>/(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\s*\(/.test(l)&&!/\bprompt\.prompt\(/.test(l)&&!/^\s*(?:\/\/|\/\*|\*)/.test(l));
     ok(hits.length===0,engineName+': '+f+' bevat geen confirm(/alert(/prompt( '+hits.map(h=>h[0]+': '+h[1].trim().slice(0,80)).join(' | '));
    }
   }
   console.log('OK v5.12.0 geen dialogen: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.12.0 geen dialogen: '+checks+' controles (chromium, webkit; 390 en 320 px; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
