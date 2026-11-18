/* v5.9.0 opruimen (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam).
   Geen Home Assistant, MEATER of echte iPhone.
   (a) navigatie zonder de oude kookpagina en draaiboeken; Meer → Geavanceerd bereikbaar,
   (b) één takenlijst in de gewone navigatie,
   (c) "Nieuwe sessie" en "Sessie afronden" zonder dialoog (window.confirm/alert/prompt zijn hier GEBLOKKEERD, zoals in een iframe kan);
       annuleren = niets verandert, de hele opslag byte-gelijk,
   (d) 320 px zonder overflow, tikdoelen >= 44 px, 30 s-/1 s-timers herbouwen het paneel niet.
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
const FIXTURE=JSON.parse(await readFile(path.join(root,'tests/fixtures/v570-session.json'),'utf8')); // echte opslag van v5.7.0: twee gerechten, een actieve sessie op Live
const PLAN='kamado-bereidingsplanner-v1',BACKUP='bbq-v5-previous-plan-v1',SESSION='bbq-v5-session-v1';
const T_1500='2026-11-16T14:00:00Z'; // Europe/Amsterdam: 15:00
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,{width=390,seed=false}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  // Dialogen zijn hier geblokkeerd (zoals een iframe in de HA-app kan doen): confirm geeft false, alert/prompt doen niets. Elke aanroep wordt geteld.
  await context.addInitScript(()=>{window.__dialogCalls=[];
    window.confirm=(...a)=>{window.__dialogCalls.push('confirm:'+a[0]);return false};
    window.alert=(...a)=>{window.__dialogCalls.push('alert:'+a[0])};
    window.prompt=(...a)=>{window.__dialogCalls.push('prompt:'+a[0]);return null};});
  if(seed)await context.addInitScript(([k,sk,payload])=>{if(!sessionStorage.getItem('__seeded')){localStorage.setItem(k,JSON.stringify(payload.state));localStorage.setItem(sk,JSON.stringify(payload.session));sessionStorage.setItem('__seeded','1')}},[PLAN,SESSION,FIXTURE]);
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
  s.dump=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
  s.get=k=>page.evaluate(k=>localStorage.getItem(k),k);
  s.screen=()=>page.evaluate(()=>document.querySelector('#v5-root').dataset.screen);
  s.dialogCalls=()=>page.evaluate(()=>window.__dialogCalls.length);
  s.overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  s.small=sel=>page.evaluate(q=>[...document.querySelectorAll(q+' button')].filter(b=>b.getBoundingClientRect().height<43.5).length,sel);
  s.inside=sel=>page.evaluate(q=>{const p=document.querySelector(q).getBoundingClientRect();return p.left>=0&&p.right<=innerWidth},sel);
  s.shot=async(dir,name)=>{if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});};
  s.add=async name=>{await page.locator('[data-v5-recipe="'+name+'"]').click();await page.waitForTimeout(100);};
  s.goLive=async()=>{await s.click('prep');if(await s.count('#v5-root [data-v5-act="prep-confirm"]'))await s.click('prep-confirm');await s.click('live');};
  return s;
}
const NORMAL_HIDDEN=['#v46-board','#steps','#live-panel','#smart-panel','#v45-coach','#v47-fullscreen'];

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  const shots=process.env.SCREENSHOTS_DIR?path.join(process.env.SCREENSHOTS_DIR,engineName):null;
  try{
   // (a)+(b) Gewone navigatie zonder oude pagina's; één takenlijst; Meer → Geavanceerd bereikbaar.
   {
    const s=await open(browser);
    ok(await s.count('#v5-nav button')===4,engineName+': onderaan nog vier knoppen (Vandaag, Recepten, Live, Meer)');
    await s.click('new');if(await s.count('[data-v5-act="new-confirm"]'))await s.click('new-confirm');
    await s.add('Ribeye 500 g');await s.add('Kippenpoten');await s.click('setup');
    ok(await s.count('#v5-root [data-v5-act="cooking"]')===0,engineName+': stap 2 heeft geen link naar de oude kookpagina');
    await s.goLive();
    ok(await s.screen()==='live',engineName+': Live');
    ok(await s.count('#v5-root [data-v5-act="cooking"]')===0,engineName+': Live heeft geen "MEATER & focus"-knop meer');
    ok(!/MEATER & focus/.test(await s.text('#v5-root')),engineName+': de tekst "MEATER & focus" staat niet meer op Live');
    ok(await s.count('#v5-root .v5-next-tasks')===1,engineName+': één takenlijst op Live (Volgende handelingen)');
    for(const sel of NORMAL_HIDDEN)ok(!(await s.visible(sel)),engineName+': op Live niet zichtbaar: '+sel);
    ok(await s.count('#v5-root .v5-action-grid [data-v5-act]')===3,engineName+': Meer acties op Live: Planning aanpassen, Voorbereiding, Sessie afronden');
    await s.shot(shots,'01-live-meer-acties-390');
    // De andere normale schermen tonen de oude draaiboeken evenmin.
    await s.tab('home');for(const sel of NORMAL_HIDDEN)ok(!(await s.visible(sel)),engineName+': op Vandaag niet zichtbaar: '+sel);
    await s.tab('recipes');for(const sel of NORMAL_HIDDEN)ok(!(await s.visible(sel)),engineName+': op Recepten niet zichtbaar: '+sel);
    // Planning aanpassen (blijft bestaan) bevat geen takenlijst.
    await s.tab('live');await s.click('planning');
    ok(await s.visible('#v47-planning')&&!(await s.visible('#v46-board'))&&!(await s.visible('#steps')),engineName+': Planning aanpassen heeft geen takenlijst');
    await s.page.locator('#v5-back').click();
    // Meer: de oude pagina's staan onder Geavanceerd, niet in de andere groepen.
    await s.tab('more');
    for(const sel of ['#v46-board','#steps','#live-panel'])ok(!(await s.visible(sel)),engineName+': op Meer niet zichtbaar: '+sel);
    const groups=await s.page.locator('#v47-more .v520-group').evaluateAll(els=>els.map(e=>e.id));
    ok(groups[groups.length-1]==='v520-more-geavanceerd'&&groups.length===5,engineName+': Geavanceerd is de laatste groep van Meer '+groups);
    for(const id of ['v520-open-cooking','v520-open-board','v520-open-steps'])ok(await s.count('#v520-more-geavanceerd #'+id)===1,engineName+': '+id+' staat in Geavanceerd');
    ok(await s.count('#v520-more-koppelingen #v520-open-cooking')===0,engineName+': de kookpagina-knop staat niet meer bij Koppelingen');
    await s.page.locator('#v520-more-geavanceerd').scrollIntoViewIfNeeded();
    await s.shot(shots,'02-meer-geavanceerd-390');
    const before=await s.dump();
    await s.page.locator('#v520-open-cooking').click();await s.page.waitForTimeout(100);
    ok(await s.visible('#v47-cooking')&&await s.visible('#live-panel')&&await s.visible('#v47-fullscreen'),engineName+': oude kookpagina bereikbaar (MEATER-grafiek, focus-kookmodus)');
    ok(await s.visible('#smart-panel')||(await s.count('#smart-panel'))===1,engineName+': slim bijsturen staat in de oude kookpagina');
    ok(await s.text('#v5-back')==='← Meer',engineName+': terugknop zegt ← Meer');
    ok((await s.overflow())<=1,engineName+': oude kookpagina zonder horizontale overflow');
    await s.page.locator('#v5-back').click();
    ok(await s.visible('#v47-more'),engineName+': terug op Meer');
    await s.page.locator('#v520-open-board').click();await s.page.waitForTimeout(100);
    ok(await s.visible('#v46-board'),engineName+': Interactief draaiboek bereikbaar via Geavanceerd');
    ok(await s.page.evaluate(()=>{const r=document.getElementById('v46-board').getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}),engineName+': het draaiboek staat in beeld');
    await s.page.locator('#v5-back').click();
    await s.page.locator('#v520-open-steps').click();await s.page.waitForTimeout(100);
    ok(await s.visible('#steps')&&await s.page.evaluate(()=>document.getElementById('steps').closest('details.v47-fold').open),engineName+': Uitgebreid stap-voor-stap draaiboek bereikbaar (opengeklapt)');
    await s.page.locator('#v5-back').click();
    ok(await s.dump()===before,engineName+': de oude pagina openen en sluiten verandert de opslag niet');
    // Terug naar Live: nog steeds één takenlijst.
    await s.page.locator('#v5-back').click();
    ok(await s.screen()==='live'&&!(await s.visible('#v46-board')),engineName+': terug op Live, oude draaiboek niet zichtbaar');
    ok(s.errors.length===0&&s.dialogs.length===0&&await s.dialogCalls()===0,engineName+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }
   // (c) Nieuwe sessie: paneel in de pagina; annuleren = byte-gelijk; bevestigen werkt ook als confirm() geblokkeerd is.
   {
    const s=await open(browser,{seed:true});
    await s.tab('home');
    ok(await s.screen()==='home',engineName+': Vandaag (opslag gezaaid met de echte v5.7.0-opslag)');
    const start=await s.dump();
    ok(JSON.parse(start)[PLAN]!==undefined&&JSON.parse(start)[SESSION]!==undefined,engineName+': de opslag bevat een plan en een sessie (byte-vergelijking is zinvol)');
    await s.click('new');
    ok(await s.count('[data-v5-new-confirm]')===1,engineName+': er staat al een planning: een paneel vraagt om bevestiging');
    const panel=await s.text('[data-v5-new-confirm]');
    ok(/Nieuwe sessie beginnen\?/.test(panel)&&/reservekopie/i.test(panel)&&/Er verandert niets tot je kiest/.test(panel),engineName+': paneel met reservekopie-uitleg: '+panel);
    ok(await s.screen()==='home'&&await s.dump()===start,engineName+': het paneel tonen schrijft niets, opslag byte-gelijk');
    ok(await s.dialogCalls()===0&&s.dialogs.length===0,engineName+': geen window.confirm of dialoog');
    ok((await s.overflow())<=1&&await s.small('[data-v5-new-confirm]')===0&&await s.inside('[data-v5-new-confirm]'),engineName+': paneel past, knoppen >= 44 px');
    await s.shot(shots,'03-vandaag-nieuwe-sessie-bevestiging-390');
    await s.click('new-cancel');
    ok(await s.count('[data-v5-new-confirm]')===0&&await s.screen()==='home',engineName+': annuleren: paneel weg, nog op Vandaag');
    ok(await s.dump()===start,engineName+': annuleren: de hele opslag byte-gelijk');
    await s.context.clock.runFor(2500);await s.page.waitForTimeout(100);
    ok(await s.dump()===start,engineName+': ook na wachten blijft de opslag byte-gelijk');
    // Paneel openen en via de onderbalk weggaan: het paneel blijft niet hangen.
    await s.click('new');await s.tab('recipes');await s.page.locator('#v5-back').click();
    ok(await s.count('[data-v5-new-confirm]')===0,engineName+': na wegklikken is het paneel weg');
    ok(await s.get(PLAN)===JSON.parse(start)[PLAN]&&await s.get(BACKUP)===null,engineName+': wegklikken wijzigt de planning niet en maakt geen reservekopie (de bestaande tab-onthouder bbq-v47-tab mag wel schrijven)');
    const planBefore=JSON.parse(await s.get(PLAN));
    await s.click('new');await s.click('new-confirm');
    ok(await s.screen()==='select'&&await s.count('[data-v5-new-confirm]')===0,engineName+': bevestigen: nieuwe sessie op stap 1, ook nu confirm() false zou geven');
    const planAfter=JSON.parse(await s.get(PLAN));
    ok(planAfter.dishes.length===0&&planBefore.dishes.length>0,engineName+': de planning is leeg gemaakt');
    ok(JSON.stringify(JSON.parse(await s.get(BACKUP)))===JSON.stringify(planBefore),engineName+': de reservekopie is gelijk aan de vorige planning');
    ok(JSON.parse(await s.get(SESSION)).active===true,engineName+': sessie actief');
    ok(await s.dialogCalls()===0&&s.dialogs.length===0&&s.errors.length===0,engineName+': geen dialogen of fouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // (c) Sessie afronden op Live; plus (d) het paneel overleeft de 1 s- en 30 s-timers zonder herbouw.
   {
    const s=await open(browser,{seed:true});
    ok(await s.screen()==='live',engineName+': de actieve sessie opent op Live (gezaaide opslag)');
    await s.page.waitForTimeout(150);
    const before=await s.dump();
    await s.click('finish');
    ok(await s.count('[data-v5-finish-confirm]')===1&&await s.screen()==='live',engineName+': "Sessie afronden" toont een paneel op Live');
    const panel=await s.text('[data-v5-finish-confirm]');
    ok(/BBQ-sessie afronden\?/.test(panel)&&/blijven bewaard/.test(panel),engineName+': paneeltekst: '+panel);
    ok(await s.dump()===before&&await s.dialogCalls()===0&&s.dialogs.length===0,engineName+': het paneel tonen schrijft niets en gebruikt geen dialoog');
    ok(await s.page.evaluate(()=>{const p=document.querySelector('[data-v5-finish-confirm]').getBoundingClientRect();return p.top>=0&&p.bottom<=innerHeight}),engineName+': het paneel staat in beeld');
    await s.shot(shots,'04-live-sessie-afronden-bevestiging-390');
    // Timers: het paneel blijft hetzelfde element (geen herbouw door de 1 s-ticker of de 30 s-planning).
    await s.page.evaluate(()=>{document.querySelector('[data-v5-finish-confirm]').__mark='zelfde'});
    await s.context.clock.runFor(31000);await s.page.waitForTimeout(100);
    ok(await s.page.evaluate(()=>document.querySelector('[data-v5-finish-confirm]')?.__mark)==='zelfde',engineName+': 1 s-/30 s-timers herbouwen het paneel niet');
    await s.click('finish-cancel');
    ok(await s.count('[data-v5-finish-confirm]')===0&&await s.screen()==='live',engineName+': annuleren: paneel weg, nog op Live');
    const after=JSON.parse(await s.dump()),was=JSON.parse(before);
    const drop=k=>{const o={...k};delete o[SESSION];return JSON.stringify(o)};
    ok(drop(after)===drop(was),engineName+': annuleren: planning, reservekopie en alle andere opslag byte-gelijk');
    ok(JSON.parse(after[SESSION]).active===true&&JSON.parse(after[SESSION]).stage==='live',engineName+': annuleren: sessie nog actief op Live');
    const planBefore=await s.get(PLAN);
    await s.click('finish');await s.click('finish-confirm');
    ok(await s.screen()==='home'&&await s.count('[data-v5-finish-confirm]')===0,engineName+': bevestigen: terug op Vandaag, ook nu confirm() false zou geven');
    const meta=JSON.parse(await s.get(SESSION));
    ok(meta.active===false&&meta.stage==='finished',engineName+': sessie afgerond '+JSON.stringify(meta));
    ok(await s.get(PLAN)===planBefore,engineName+': de planning zelf is byte-gelijk gebleven (recepten, reviews en gegevens bewaard)');
    ok(await s.dialogCalls()===0&&s.dialogs.length===0&&s.errors.length===0,engineName+': geen dialogen of fouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // (c) Meldingen in de pagina in plaats van window.alert: een gestart gerecht verdwijnt niet met een tik.
   {
    const s=await open(browser);
    await s.click('new');await s.click('new-confirm');
    await s.add('Ribeye 500 g');await s.click('setup');await s.goLive();
    await s.page.locator('[data-v5-act^="phase:"][data-v5-act$=":cooking"]').first().click();await s.page.waitForTimeout(100);
    await s.click('prep');if(await s.count('#v5-root [data-v5-act="prep-confirm"]'))await s.click('prep-confirm');
    await s.click('setup');await s.click('select');
    const before=await s.get(PLAN);
    await s.add('Ribeye 500 g');
    ok(/al gestart/.test(await s.text('[data-v5-notice]')),engineName+': melding in de pagina: "is al gestart"');
    ok(await s.get(PLAN)===before&&await s.dialogCalls()===0&&s.dialogs.length===0,engineName+': geen window.alert en de planning is byte-gelijk');
    await s.click('notice-close');
    ok(await s.count('[data-v5-notice]')===0,engineName+': de melding sluit');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   // (d) 320 en 390 px: geen overflow, tikdoelen >= 44 px, paneel binnen het scherm.
   for(const width of [320,390]){
    const s=await open(browser,{width});
    await s.click('new');
    ok((await s.overflow())<=1&&await s.small('[data-v5-new-confirm]')===0&&await s.inside('[data-v5-new-confirm]'),engineName+': '+width+' px: Nieuwe sessie-paneel zonder overflow, knoppen >= 44 px');
    if(width===320)await s.shot(shots,'05-vandaag-nieuwe-sessie-bevestiging-320');
    await s.click('new-confirm');await s.add('Ribeye 500 g');await s.add('Kippenpoten');await s.click('setup');await s.goLive();
    await s.click('finish');
    ok((await s.overflow())<=1&&await s.small('[data-v5-finish-confirm]')===0&&await s.inside('[data-v5-finish-confirm]'),engineName+': '+width+' px: Sessie afronden-paneel zonder overflow, knoppen >= 44 px');
    if(width===320)await s.shot(shots,'06-live-sessie-afronden-bevestiging-320');
    await s.click('finish-cancel');
    ok((await s.overflow())<=1,engineName+': '+width+' px: Live zonder overflow');
    await s.tab('more');
    await s.page.locator('#v520-more-geavanceerd').scrollIntoViewIfNeeded();
    ok((await s.overflow())<=1&&await s.page.evaluate(()=>[...document.querySelectorAll('#v520-more-geavanceerd button')].every(b=>{const r=b.getBoundingClientRect();return r.height>=43.5&&r.left>=0&&r.right<=innerWidth})),engineName+': '+width+' px: Meer → Geavanceerd zonder overflow, knoppen >= 44 px');
    if(width===320)await s.shot(shots,'07-meer-geavanceerd-320');
    await s.page.locator('#v520-open-cooking').click();await s.page.waitForTimeout(100);
    ok((await s.overflow())<=1,engineName+': '+width+' px: oude kookpagina zonder overflow');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   console.log('OK v5.9.0 opruimen: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.9.0 opruimen: '+checks+' checks (chromium, webkit; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
