/* v5.10.0 vaste fasedoelen per recept: optioneel veld `coreAt` op een receptstap (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html) met een nagebootste browserklok (Europe/Amsterdam), een
   nagebootste Home Assistant-kaart (de echte dist/bbq_planner_card.js met een nep-hass en een nep-gebruikersopslag voor de bibliotheek),
   echte opslag van v5.7.0 (tests/fixtures/v570-session.json, receptstappen zonder coreAt) en een back-up in het oude exportformaat
   (tests/fixtures/v5100-bibliotheek.json). Geen echte Home Assistant, MEATER of iPhone.
   Scenario's: 1) standaardrecepten: welke coreAt-waarden; validatie 0-120; fasedoelen (recept of aanname); 2) oude opslag en oude
   back-up laden ongewijzigd; import en export behouden coreAt; 3) Home Assistant: Ribeye "zoals gisteren" met coreAt (uit recept) en
   zonder (aanname), eigen waarde 50 in plaats van 47; 4) meldingen per fasedoel één keer (ook na herladen), Pulled pork 70 en 88 °C;
   5) HA-bibliotheek-sync (cleanBooks) behoudt coreAt; 6) receptbewerker: veld, foutmelding in de pagina, geen dialogen; generator:
   voorstel uit de tekst pas na een tik; 7) v5.2.3-contract: slots, één 1-s- en één 30-s-timer; 8) 320 px zonder overflow.
   Optioneel: SCREENSHOTS_DIR=<map> schrijft screenshots per engine; ENGINES=chromium beperkt de engines. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const OLD_SESSION=JSON.parse(await readFile(path.join(root,'tests/fixtures/v570-session.json'),'utf8'));
const LIB_FIXTURE_PATH=path.join(root,'tests/fixtures/v5100-bibliotheek.json');
const LIB_FIXTURE=JSON.parse(await readFile(LIB_FIXTURE_PATH,'utf8'));
const KEY='kamado-bereidingsplanner-v1',SKEY='bbq-v5-session-v1',LIB='kamado-recipe-book-v1',COOKBOOK='bbq_planner_cookbook_v1';
const HOST=`<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#111"><script type="module">
import '/dist/bbq_planner_card.js';
const IDS={pro:'sensor.meater_probe_00e865be_',plus:'sensor.meater_probe_c7dbf045_'};
window.__states={};window.__connected=true;window.__calls=[];window.__book=null;window.__writes=[];
const hass=()=>({states:window.__states,connected:window.__connected,
  services:{notify:{mobile_app_test_telefoon:{}}},devices:{},
  callService:async(domain,service,data)=>{window.__calls.push({domain,service,message:data&&data.message,data:JSON.parse(JSON.stringify(data||{}))});},
  connection:{sendMessagePromise:async m=>{
      if(m&&m.type==='history/history_during_period')return {};
      if(m&&m.type==='frontend/get_user_data'&&m.key==='${COOKBOOK}')return {value:window.__book};
      if(m&&m.type==='frontend/set_user_data'&&m.key==='${COOKBOOK}'){window.__book=JSON.parse(JSON.stringify(m.value));window.__writes.push(JSON.parse(JSON.stringify(m.value)));return {};}
      return {value:null};
    },subscribeMessage:async()=>()=>{}}});
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
const START='2026-11-16T15:55:00Z'; // 16:55 in Amsterdam
const idle=(core,ambient)=>({interne_temperatuur:core,omgevingstemperatuur:ambient,doeltemperatuur:'unavailable',kookstatus:'unavailable',
  kookt:'off',piektemperatuur:'unavailable',resterende_tijd:'unavailable',tijd_verstreken:'unavailable'});
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};

async function open(browser,{ha=false,width=390,seed=null}={}){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  // Dialogen tellen: de v5-schil en de receptbewerker gebruiken er geen voor het fasedoel (sinds v5.12 ook de import niet meer: die vraagt in de pagina, en confirm() geeft hier false).
  await context.addInitScript(()=>{window.__dialogCalls=[];const oc=window.confirm;window.confirm=(...a)=>{window.__dialogCalls.push('confirm:'+a[0]);return false};
    window.alert=(...a)=>{window.__dialogCalls.push('alert:'+a[0])};window.prompt=(...a)=>{window.__dialogCalls.push('prompt:'+a[0]);return null};});
  if(seed)await context.addInitScript(([k,sk,payload])=>{if(!sessionStorage.getItem('__seeded')){localStorage.setItem(k,JSON.stringify(payload.state));localStorage.setItem(sk,JSON.stringify(payload.session));sessionStorage.setItem('__seeded','1')}},[KEY,SKEY,seed]);
  // Alleen voor de test: een kopie van de planner met een hook die een paar bestaande functies uit de afgesloten functie haalt (de bestanden
  // op schijf blijven ongewijzigd). Alle gedrag blijft dat van dist/BBQ_bereidingsplanner_MEATER_v4.html.
  await context.route(/BBQ_bereidingsplanner_MEATER_v4\.html/,async route=>{
    const res=await route.fetch();let body=await res.text();
    const anchor='initControls();renderAll();initLibraryUi();';
    if(!body.includes(anchor))throw new Error('anker voor de testhook ontbreekt');
    body=body.replace(anchor,'window.__t={examples,makeDish,cleanLibraryRecipe,v510PhasePlan,v55PhaseTargets,exportLibraryJson,addDish,requestLibrarySync,analyzeRecipeText,renderGeneratorPreview,getState:()=>state,localRecipes:()=>localRecipes,setDraft:d=>{recipeDraft=d},getDraft:()=>recipeDraft};'+anchor);
    await route.fulfill({response:res,body});
  });
  await context.clock.install({time:new Date(START)});
  await context.addInitScript(()=>{if(window.__intervals)return;window.__intervals=[];const si=window.setInterval;window.setInterval=function(fn,ms,...r){window.__intervals.push(ms);return si.call(window,fn,ms,...r)}});
  const page=await context.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await page.goto(origin+(ha?'/__ha-host':'/dist/BBQ_bereidingsplanner_MEATER_v4.html'),{waitUntil:'load'});
  const frame=()=>ha?page.frames().find(f=>f.url().includes('BBQ_bereidingsplanner')&&!f.isDetached()):page.mainFrame();
  for(let i=0;i<60&&!(frame()&&await frame().locator('#v5-root').count());i++)await page.waitForTimeout(100);
  if(!ha)await context.clock.setFixedTime(new Date(START));
  const s={context,page,f:frame(),errors,dialogs,ha};
  s.act=async a=>{await s.f.locator('#v5-root [data-v5-act="'+a+'"]').first().click();await page.waitForTimeout(120);if(a==='new'){const c=s.f.locator('#v5-root [data-v5-act="new-confirm"]');if(await c.count()){await c.first().click();await page.waitForTimeout(120);}}};
  s.text=sel=>s.f.locator(sel).first().evaluate(el=>el.innerText.replace(/\s+/g,' ').trim());
  s.store=()=>s.f.evaluate(k=>localStorage.getItem(k),KEY);
  s.dishes=async()=>JSON.parse(await s.store()).dishes;
  s.dish=async name=>(await s.dishes()).find(d=>d.name===name);
  s.set=(probe,values)=>page.evaluate(([p,v])=>window.__set(p,v),[probe,values]);
  s.calls=()=>page.evaluate(()=>window.__calls.map(c=>c.message));
  s.overflow=()=>s.f.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  s.shot=async(dir,name)=>{if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')})};
  return s;
}
async function reloadFrame(s){
  await s.page.evaluate(()=>{window.__frame().contentWindow.location.reload();});
  for(let i=0;i<100;i++){
    await s.page.waitForTimeout(100);
    const f=s.page.frames().find(x=>x.url().includes('BBQ_bereidingsplanner')&&!x.isDetached());
    try{if(f&&await f.evaluate(()=>!!document.querySelector('#v5-root')&&document.readyState==='complete')){s.f=f;await s.page.waitForTimeout(150);return f;}}catch(e){}
  }
  throw new Error('iframe niet herladen');
}
async function startSession(s,names){
  await s.act('new');
  for(const n of names){await s.f.locator('[data-v5-recipe="'+n+'"]').click();await s.page.waitForTimeout(80);}
  await s.act('setup');
}
async function goLive(s){await s.act('prep');if(await s.f.locator('#v5-root [data-v5-act="prep-confirm"]').count())await s.act('prep-confirm');await s.act('live');}
async function onGrill(s,name){const id=(await s.dish(name)).id;await s.f.locator('[data-v5-dishcard="'+id+'"] [data-v5-act="phase:'+id+':cooking"]').click();await s.page.waitForTimeout(150);return id;}
async function rise(s,probe='pro',minutes=40){
  // 9,5 → 45,5 °C in 40 min bij 121 °C: iedere 4 minuten een meting (+3,6 °C).
  let core=9.5;
  for(let m=4;m<=minutes;m+=4){await s.context.clock.fastForward('04:00');core+=3.6;await s.set(probe,idle(core.toFixed(1),121));}
  await s.page.waitForTimeout(100);
}
// Zet de gerechtkaart onder de vaste balk bovenin, zodat een screenshot de hele kaart toont.
const focusCard=async(s,id)=>{await s.f.evaluate(i=>{const el=document.querySelector('[data-v5-dishcard="'+i+'"]');window.scrollTo({top:el.getBoundingClientRect().top+scrollY-84,left:0,behavior:'instant'})},id);await s.page.waitForTimeout(80)};
const tick30=async s=>{await s.context.clock.runFor(31000);await s.page.waitForTimeout(80)};
// Patch de opgeslagen planning en laad de planner opnieuw (zoals de HA-app na het wisselen van app).
async function patchDishes(s,fn){
  await s.f.evaluate(([k,src])=>{const p=JSON.parse(localStorage.getItem(k));for(const d of p.dishes)(new Function('d',src))(d);localStorage.setItem(k,JSON.stringify(p));},[KEY,fn]);
  return reloadFrame(s);
}
const coreAts=d=>(d.recipeSteps||[]).map(x=>('coreAt' in x)?x.coreAt:null);

const wanted=(process.env.ENGINES||'chromium,webkit').split(',');
try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>wanted.includes(n))){
  const browser=await engine.launch({headless:true});
  const shots=process.env.SCREENSHOTS_DIR||null;
  try{
   // 1. Standaardrecepten, validatie en fasedoelen (zonder Home Assistant).
   {
    const s=await open(browser);
    const std=await s.f.evaluate(()=>Object.fromEntries(Object.entries(__t.examples).map(([n,e])=>[n,(e.recipeSteps||[]).map(x=>('coreAt' in x)?x.coreAt:null)])));
    eq(std['Ribeye 500 g'],[null,null,47,54,null],engineName+': Ribeye 500 g: 47 (opstoken/schroeien) en 54 (eindkern)');
    eq(std['Pulled pork op brood'],[null,null,null,null,70,null,88,null,null],engineName+': Pulled pork: 70 (saus) en 88 (malsheid testen)');
    ok(std['Warmgerookte zalm op brioche'].length===8&&std['Warmgerookte zalm op brioche'].every(x=>x===null),engineName+': zalm: geen coreAt (de tekst geeft geen eenduidige waarde)');
    const others=Object.entries(std).filter(([n])=>!['Ribeye 500 g','Pulled pork op brood','Warmgerookte zalm op brioche'].includes(n));
    ok(others.length>=8&&others.every(([,v])=>v.length===0),engineName+': de overige standaardrecepten hebben geen receptstappen en dus geen coreAt: '+others.map(x=>x[0]).join(', '));
    // Validatie 0-120: geldige waarden blijven (komma of punt, afgerond op 0,1), ongeldige vallen weg; nooit verzonnen.
    const v=await s.page.evaluate(()=>__t.makeDish({recipeSteps:[{title:'a',coreAt:47},{coreAt:'48,5'},{coreAt:0},{coreAt:120},{coreAt:121},{coreAt:-1},{coreAt:'abc'},{coreAt:null},{coreAt:''},{coreAt:true},{coreAt:[1]},{coreAt:NaN},{coreAt:'62.04'},{},{title:'t',trigger:'x',detail:'d',suggestCoreAt:70}]}).recipeSteps.map(x=>('coreAt' in x)?x.coreAt:null));
    eq(v,[47,48.5,0,120,null,null,null,null,null,null,null,null,62,null,null],engineName+': makeDish: coreAt alleen 0-120; ongeldig en een voorstel (suggestCoreAt) vallen weg');
    const lib=await s.page.evaluate(()=>__t.cleanLibraryRecipe({name:'x',recipeSteps:[{title:'a',coreAt:'70'},{coreAt:130},{coreAt:'-3'},{title:'z',suggestCoreAt:55}]}).recipeSteps.map(x=>Object.keys(x).join(',')+'|'+('coreAt' in x?x.coreAt:'-')));
    eq(lib,['title,trigger,detail,coreAt|70','title,trigger,detail|-','title,trigger,detail|-','title,trigger,detail|-'],engineName+': cleanLibraryRecipe: dezelfde validatie, vaste veldvolgorde, geen losse velden');
    // Fasedoelen: recept of aanname.
    const plan=await s.f.evaluate(()=>{
      const {examples,makeDish,v510PhasePlan,v55PhaseTargets}=__t;
      const rib=makeDish(examples['Ribeye 500 g']),old=makeDish({...examples['Ribeye 500 g'],recipeSteps:[]}),pp=makeDish(examples['Pulled pork op brood']),kip=makeDish(examples['Kippenpoten']);
      const own=makeDish({...examples['Ribeye 500 g'],recipeSteps:[{title:'Eigen',trigger:'',detail:'',coreAt:50}]});
      const hi=makeDish({...examples['Ribeye 500 g'],recipeSteps:[{title:'Hoog',trigger:'',detail:'',coreAt:60}]});
      const nog=makeDish({...examples['Ribeye 500 g'],core:''});
      return {rib:v510PhasePlan(rib),old:v510PhasePlan(old),pp:v510PhasePlan(pp),kip:v510PhasePlan(kip),own:v510PhasePlan(own),hi:v510PhasePlan(hi),nog:v510PhasePlan(nog),
        targets:{rib:v55PhaseTargets(rib),old:v55PhaseTargets(old),own:v55PhaseTargets(own),pp:v55PhaseTargets(pp)}};
    });
    eq(plan.rib,[{target:47,source:'recept',title:'Opstoken en schroeien',index:2,kind:'stoke'}],engineName+': Ribeye uit het recept: 47 °C, bron recept (54 = eindkern, geen tussendoel)');
    eq(plan.old,[{target:47,source:'aanname',title:'',index:-1,kind:'stoke'}],engineName+': Ribeye zonder coreAt: aanname doel − 7 °C = 47, bron aanname');
    eq(plan.own.map(p=>[p.target,p.source,p.kind]),[[50,'recept','stoke']],engineName+': eigen coreAt 50 vervangt de aanname');
    eq(plan.hi.map(p=>[p.target,p.source]),[[47,'aanname']],engineName+': een coreAt op of boven het kerndoel telt niet als tussendoel (terugval op de aanname)');
    eq(plan.pp.map(p=>[p.target,p.source,p.kind,p.title]),[[70,'recept','step','BBQ-saus aanbrengen'],[88,'recept','step','Doorgaren en malsheid testen']],engineName+': Pulled pork: 70 en 88 uit het recept (indirect, geen opstookfase)');
    eq(plan.kip,[],engineName+': Kippenpoten: geen fasedoel');
    eq(plan.nog,[],engineName+': zonder kerndoel geen fasedoelen');
    eq(plan.targets,{rib:[47],old:[47],own:[50],pp:[70,88]},engineName+': v55PhaseTargets voedt de schatting met dezelfde waarden');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }

   // 2. Oude opslag, oude back-up, import en export.
   {
    const s=await open(browser,{seed:OLD_SESSION});
    const before=JSON.parse(JSON.stringify(OLD_SESSION.state.dishes.map(d=>d.recipeSteps)));
    const after=await s.f.evaluate(()=>__t.getState().dishes.map(d=>d.recipeSteps));
    eq(after,before,engineName+': oude planning (v5.7.0, receptstappen zonder coreAt) laadt ongewijzigd');
    ok(s.errors.length===0,engineName+': oude opslag laadt zonder paginafouten '+s.errors.join(' | '));
    // Oude planning met receptstappen zonder coreAt + een ongeldige coreAt in opslag: de laadroutine ruimt alleen het ongeldige op.
    await s.f.evaluate(([k])=>{const p=JSON.parse(localStorage.getItem(k));p.dishes[0].recipeSteps=[{title:'Oud',trigger:'Avond vooraf',detail:'zonder'},{title:'Goed',trigger:'t',detail:'d',coreAt:'61,5'},{title:'Slecht',trigger:'t',detail:'d',coreAt:999},{title:'Tekst',trigger:'t',detail:'d',coreAt:'abc'}];localStorage.setItem(k,JSON.stringify(p));},[KEY]);
    await s.page.reload({waitUntil:'load'});await s.page.locator('#v5-root').waitFor();
    s.f=s.page.mainFrame();
    eq(await s.f.evaluate(()=>__t.getState().dishes[0].recipeSteps),[{title:'Oud',trigger:'Avond vooraf',detail:'zonder'},{title:'Goed',trigger:'t',detail:'d',coreAt:61.5},{title:'Slecht',trigger:'t',detail:'d'},{title:'Tekst',trigger:'t',detail:'d'}],engineName+': bij het laden blijft een geldige coreAt (afgerond) en vallen ongeldige weg; een stap zonder coreAt blijft zoals hij was');
    await s.context.close();
   }
   {
    // Oude back-up (v5.9.0-formaat) en een back-up met coreAt importeren; daarna exporteren.
    const s=await open(browser);
    await s.page.locator('#library-file').setInputFiles(LIB_FIXTURE_PATH);
    await s.page.locator('.v512-overlay [data-v512="ok"]').click(); // v5.12: bevestiging in de pagina (geen window.confirm)
    await s.page.waitForFunction(()=>document.querySelector('#library-feedback')&&/geïmporteerd|mislukt/.test(document.querySelector('#library-feedback').textContent));
    ok(/2 recepten geïmporteerd/.test(await s.page.locator('#library-feedback').textContent()),engineName+': import van de fixture-back-up: '+await s.page.locator('#library-feedback').textContent());
    const book=JSON.parse(await s.page.evaluate(k=>localStorage.getItem(k),LIB));
    const rec=n=>book.find(r=>r.name===n);
    const oldRec=rec('Fixture oud recept zonder coreAt'),newRec=rec('Fixture nieuw recept met coreAt');
    eq(oldRec.recipeSteps,LIB_FIXTURE.recipes[0].recipeSteps,engineName+': oud recept (zonder coreAt) is na import identiek aan het bronbestand, geen coreAt toegevoegd');
    eq(newRec.recipeSteps.map(x=>('coreAt' in x)?x.coreAt:null),[70,88.5,0,null,null,null,null,null],engineName+': import: geldige coreAt blijft (70, 88,5, 0); ongeldig (130, -5, tekst, null, leeg) valt weg');
    const [dl]=await Promise.all([s.page.waitForEvent('download'),s.page.evaluate(()=>__t.exportLibraryJson())]);
    const exported=JSON.parse(await readFile(await dl.path(),'utf8'));
    eq(exported.format,'bbq-receptenbibliotheek-v1',engineName+': exportformaat ongewijzigd');
    eq(exported.recipes.find(r=>r.name==='Fixture nieuw recept met coreAt').recipeSteps.map(x=>('coreAt' in x)?x.coreAt:null),[70,88.5,0,null,null,null,null,null],engineName+': export behoudt coreAt');
    eq(exported.recipes.find(r=>r.name==='Fixture oud recept zonder coreAt').recipeSteps,LIB_FIXTURE.recipes[0].recipeSteps,engineName+': export van een oud recept: stappen byte-gelijk (geen coreAt-sleutel)');
    // Een bibliotheekrecept toevoegen aan de planning behoudt coreAt in het gerecht.
    await s.page.evaluate(()=>__t.addDish(__t.localRecipes().find(r=>r.name==='Fixture nieuw recept met coreAt'),'test'));
    const dish=(await s.page.evaluate(k=>JSON.parse(localStorage.getItem(k)).dishes,KEY)).find(d=>d.name==='Fixture nieuw recept met coreAt');
    eq(coreAts(dish),[70,88.5,0,null,null,null,null,null],engineName+': recept uit de bibliotheek in de planning: coreAt behouden');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }

   // 3. Home Assistant: "zoals gisteren" met coreAt (uit recept), zonder (aanname) en met een eigen waarde (50).
   for(const variant of ['recept','aanname','eigen']){
    const s=await open(browser,{ha:true});
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);
    if(variant==='aanname')await patchDishes(s,'d.recipeSteps=[]');
    if(variant==='eigen')await patchDishes(s,'d.recipeSteps[2].coreAt=50');
    eq(coreAts(await s.dish('Ribeye 500 g')),variant==='aanname'?[]:variant==='eigen'?[null,null,50,54,null]:[null,null,47,54,null],engineName+' '+variant+': opgeslagen receptstappen');
    await goLive(s);
    await onGrill(s,'Ribeye 500 g');
    await rise(s);
    await tick30(s); // 17:35
    const id=(await s.dish('Ribeye 500 g')).id,card='[data-v5-dishcard="'+id+'"]';
    const pt=variant==='eigen'?50:47,src=variant==='aanname'?'aanname':'uit recept';
    const hero=await s.text('.v5-hero'),detail=await s.text('.v5-hero-detail'),eta=await s.text(card+' [data-v5-slot="eta"]');
    ok(/Stook de grote kamado op naar ~250 °C/.test(hero),engineName+' '+variant+': hero: opstoken '+hero);
    ok(new RegExp('Ribeye 500 g bereikt '+pt+' °C \\(einde indirect\\) over ±\\d+ min · kern nu 45,5 °C · '+src+'$').test(detail),engineName+' '+variant+': hero toont het fasedoel '+pt+' °C en de bron "'+src+'": '+detail);
    ok(new RegExp(pt+' °C \\(einde indirect\\) rond \\d\\d:\\d\\d \\('+src+'\\) · kern 54 °C rond \\d\\d:\\d\\d').test(eta),engineName+' '+variant+': kaart toont fasedoel, tijd en bron: '+eta);
    if(variant==='recept'){
      ok(!/aanname/.test(hero+eta),engineName+': bij een fasedoel uit het recept staat nergens "aanname"');
      ok(!/LIVE.*aanname/.test(eta),engineName+': geen nep-LIVE-label bij het fasedoel');
      if(shots){await s.f.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await s.page.waitForTimeout(80);await s.shot(shots,engineName+'-01-live-fasedoel-uit-recept-390');}
      if(shots){await focusCard(s,id);await s.shot(shots,engineName+'-01b-live-kaart-fasedoel-uit-recept-390');}
    }
    if(variant==='aanname'&&shots)await s.shot(shots,engineName+'-02-live-fasedoel-aanname-390');
    if(variant!=='eigen'){
      // Voorbij het fasedoel: schroeien-advies met de bron.
      await s.context.clock.fastForward('02:00');await s.set('pro',idle('47.6','121'));await tick30(s);
      const sear=await s.text('.v5-hero'),searDetail=await s.text('.v5-hero-detail');
      ok(/Schroei Ribeye 500 g direct op ~250 °C/.test(sear)&&new RegExp('fasedoel 47 °C '+src+'$').test(searDetail),engineName+' '+variant+': schroeien-advies met bron: '+searDetail);
    }else{
      // Eigen fasedoel 50: bij 47,6 °C is het fasedoel nog niet bereikt; er wordt niet geschroeid.
      await s.context.clock.fastForward('02:00');await s.set('pro',idle('47.6','121'));await tick30(s);
      ok(/Stook de grote kamado op/.test(await s.text('.v5-hero')),engineName+' eigen: bij 47,6 °C nog steeds opstoken, het fasedoel is 50 °C');
    }
    ok(s.errors.length===0&&await s.f.evaluate(()=>window.__dialogCalls.length)===0,engineName+' '+variant+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }

   // 4. Meldingen per fasedoel: één keer, bestaande route en sleutels, ook na herladen.
   {
    const s=await open(browser,{ha:true});
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);
    await goLive(s);await onGrill(s,'Ribeye 500 g');
    await rise(s);await tick30(s);
    const phase=async()=>(await s.calls()).filter(m=>/ 47 °C — stook op/.test(m));
    eq(await phase(),[],engineName+': vóór 47 °C geen fasemelding');
    await s.context.clock.fastForward('02:00');await s.set('pro',idle('47.6','121'));await tick30(s);await tick30(s);
    eq(await phase(),['Ribeye 500 g 47 °C — stook op naar ~250 °C'],engineName+': fasedoel 47 °C (uit recept): één melding, dezelfde tekst als voorheen');
    const sent=await s.page.evaluate(()=>window.__calls.find(c=>/ 47 °C — stook op/.test(c.message)));
    ok(sent.domain==='notify'&&sent.service==='mobile_app_test_telefoon'&&sent.data.data.push['interruption-level']==='time-sensitive',engineName+': via de bestaande meldingsroute (vaste time-sensitive data)');
    const keys=Object.keys(JSON.parse(await s.store()).v46AlertSent||{});
    ok(keys.some(k=>/\|phase$/.test(k))&&!keys.some(k=>/\|phase\|/.test(k)),engineName+': bestaande dedup-sleutel (…|phase); geen nieuwe sleutel voor het opstookdoel: '+keys.join(' ; '));
    await reloadFrame(s);await tick30(s);await s.context.clock.fastForward('01:00');await s.set('pro',idle('48.2','121'));await tick30(s);
    eq(await phase(),['Ribeye 500 g 47 °C — stook op naar ~250 °C'],engineName+': na herladen van de planner geen tweede melding');
    await s.context.close();
   }
   {
    const s=await open(browser,{ha:true});
    await s.set('pro',idle('55','110'));
    await startSession(s,['Pulled pork op brood']);
    await goLive(s);const id=await onGrill(s,'Pulled pork op brood');
    const card='[data-v5-dishcard="'+id+'"]';
    const msgs=async re=>(await s.calls()).filter(m=>re.test(m));
    const P70='Pulled pork op brood 70 °C bereikt — volgende stap: BBQ-saus aanbrengen',P88='Pulled pork op brood 88 °C bereikt — volgende stap: Doorgaren en malsheid testen';
    eq(coreAts(await s.dish('Pulled pork op brood')),[null,null,null,null,70,null,88,null,null],engineName+': Pulled pork in de planning: coreAt 70 en 88');
    // 55 → 69 °C: nog geen melding; de kaart noemt het volgende fasedoel (uit recept).
    let core=55;
    for(let i=0;i<14;i++){await s.context.clock.fastForward('01:00');core+=1;await s.set('pro',idle(core.toFixed(1),120));}
    await tick30(s);
    const etaBefore=await s.text(card+' [data-v5-slot="eta"]');
    ok(/70 °C · BBQ-saus aanbrengen/.test(etaBefore)&&/\(uit recept\)/.test(etaBefore),engineName+': kaart toont het volgende fasedoel 70 °C met stap en bron: '+etaBefore);
    ok(!/88 °C/.test(etaBefore.split('kern 92')[0]||''),engineName+': alleen het eerstvolgende fasedoel');
    eq(await msgs(/bereikt — volgende stap/),[],engineName+': vóór 70 °C geen fasemelding');
    const heroEarly=await s.text('.v5-hero-detail');
    ok(!/BBQ-saus aanbrengen/.test(await s.text('.v5-hero'))||/bereikt 70 °C (nu|over ±\d+ min) · kern nu 69,0 °C · uit recept$/.test(heroEarly),engineName+': hero: het fasedoel 70 °C is nog onderweg ("verwacht"), met bron: '+heroEarly);
    // 70 °C bereikt: één melding, hero met de stap.
    for(let i=0;i<2;i++){await s.context.clock.fastForward('01:00');core+=1;await s.set('pro',idle(core.toFixed(1),120));}
    await tick30(s);await tick30(s);
    eq(await msgs(/bereikt — volgende stap/),[P70],engineName+': 70 °C: één melding met de naam van de volgende stap');
    const sent=await s.page.evaluate(()=>window.__calls.find(c=>/70 °C bereikt/.test(c.message)));
    ok(sent.domain==='notify'&&sent.service==='mobile_app_test_telefoon'&&sent.data.data.push['interruption-level']==='time-sensitive',engineName+': via de bestaande meldingsroute');
    const keys=Object.keys(JSON.parse(await s.store()).v46AlertSent||{});
    ok(keys.some(k=>/\|phase\|70$/.test(k)),engineName+': dedup-sleutel per fasedoel (…|phase|70): '+keys.join(' ; '));
    const hero=await s.text('.v5-hero');
    ok(/^.*BBQ-saus aanbrengen/.test(hero)&&/fasedoel 70 °C uit recept/.test(hero),engineName+': hero: "BBQ-saus aanbrengen" met bron: '+hero);
    if(shots){await s.f.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await s.page.waitForTimeout(80);await s.shot(shots,engineName+'-03-live-pulled-pork-70-390');}
    // Herhaling: veel ticks, herladen en nieuwe metingen in hetzelfde venster: nog steeds één melding.
    for(let i=0;i<6;i++)await tick30(s);
    await reloadFrame(s);await tick30(s);await s.context.clock.fastForward('00:30');await s.set('pro',idle((core+0.5).toFixed(1),120));await tick30(s);
    eq(await msgs(/bereikt — volgende stap/),[P70],engineName+': geen tweede melding voor 70 °C (ook niet na herladen)');
    // Gedaan: de hero gaat verder met de rest.
    await s.f.locator('.v5-hero [data-v5-act="hero-ack:phase:'+id+':70"]').click();await s.page.waitForTimeout(120);
    ok(!/BBQ-saus aanbrengen/.test(await s.text('.v5-hero')),engineName+': na "Gedaan" verdwijnt het fasedoel uit de hero');
    // 88 °C.
    core=Math.ceil(core);
    for(let i=0;i<19;i++){await s.context.clock.fastForward('01:00');core+=1;await s.set('pro',idle(Math.min(core,88.5).toFixed(1),120));}
    await tick30(s);await tick30(s);
    eq(await msgs(/bereikt — volgende stap/),[P70,P88],engineName+': 88 °C: één melding, 70 °C niet opnieuw');
    ok(s.errors.length===0&&await s.f.evaluate(()=>window.__dialogCalls.length)===0,engineName+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }

   // 5. Home Assistant: bibliotheek-sync (cleanBooks) behoudt coreAt in beide richtingen; oude recepten ongewijzigd.
   {
    const s=await open(browser,{ha:true});
    await s.page.evaluate(b=>{window.__book=b},{version:1,recipes:[LIB_FIXTURE.recipes[1]],deleted:[]});
    await s.f.evaluate(()=>__t.requestLibrarySync());
    await s.page.waitForTimeout(400);
    const got=await s.f.evaluate(()=>__t.localRecipes().map(r=>[r.name,r.recipeSteps.map(x=>('coreAt' in x)?x.coreAt:null)]));
    eq(got,[['Fixture nieuw recept met coreAt',[70,88.5,0,null,null,null,null,null]]],engineName+': HA → planner (cleanBooks + opschoning): coreAt behouden, ongeldig weggevallen');
    // Planner → HA: een oud recept importeren; daarna staan beide recepten in de HA-opslag, het oude zonder coreAt.
    await s.f.locator('#library-file').setInputFiles(LIB_FIXTURE_PATH);
    await s.f.locator('.v512-overlay [data-v512="ok"]').click(); // v5.12: bevestiging in de pagina (geen window.confirm)
    await s.page.waitForTimeout(600);
    const written=await s.page.evaluate(()=>window.__writes.at(-1));
    ok(!!written,engineName+': de planner schrijft naar de HA-opslag');
    const byName=n=>written.recipes.find(r=>r.name===n);
    eq(byName('Fixture nieuw recept met coreAt').recipeSteps.map(x=>('coreAt' in x)?x.coreAt:null),[70,88.5,0,null,null,null,null,null],engineName+': planner → HA (cleanBooks/mergeBooks): coreAt behouden');
    eq(byName('Fixture oud recept zonder coreAt').recipeSteps,LIB_FIXTURE.recipes[0].recipeSteps,engineName+': planner → HA: een oud recept blijft ongewijzigd (zonder coreAt)');
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }

   // 6. Receptbewerker en generator: in de pagina, geen dialogen, validatie 0-120.
   for(const width of [390,320]){
    const s=await open(browser,{width});
    await s.act('new');await s.f.locator('[data-v5-recipe="Ribeye 500 g"]').click();await s.page.waitForTimeout(80);await s.act('setup');
    await goLive(s);await s.act('planning');
    await s.page.locator('[data-v47-dish-toggle]').first().dispatchEvent('click');await s.page.waitForTimeout(100);
    // De oude Planning-pagina heeft met uitgeklapte gerechtdetails al een bestaande overflow (sr-only labels, tijdlijn; ook in v5.9.0); het veld mag die niet vergroten.
    const overflowBefore=await s.overflow();
    const editor=s.page.locator('details.recipe-editor').first();
    await editor.locator('summary').dispatchEvent('click');await s.page.waitForTimeout(100);
    const fields=editor.locator('[data-recipe-step="coreAt"]');
    eq(await fields.count(),5,engineName+' '+width+': elke receptstap heeft het veld "Kern bij deze stap (°C)"');
    ok(/Kern bij deze stap \(°C\)/.test(await editor.locator('.generator-stage').nth(2).locator('label').nth(2).innerText()),engineName+' '+width+': label van het veld');
    eq(await fields.evaluateAll(els=>els.map(e=>e.value)),['','','47','54',''],engineName+' '+width+': de standaardwaarden staan in de velden');
    const field=fields.nth(2),msg=editor.locator('[data-coreat-msg]').nth(2);
    const stored=async()=>coreAts(await s.dish('Ribeye 500 g'));
    await field.scrollIntoViewIfNeeded();
    await field.fill('999');await s.page.waitForTimeout(60);
    ok(/tussen 0 en 120 °C/.test(await msg.innerText())&&await field.getAttribute('aria-invalid')==='true',engineName+' '+width+': 999 → foutmelding in de pagina: '+await msg.innerText());
    eq(await stored(),[null,null,47,54,null],engineName+' '+width+': bij een fout blijft de vorige waarde opgeslagen');
    if(shots&&width===390)await s.shot(shots,engineName+'-04-receptbewerker-foutmelding-390');
    if(shots&&width===320)await s.shot(shots,engineName+'-04-receptbewerker-foutmelding-320');
    await field.fill('abc');await s.page.waitForTimeout(60);
    ok(/geen getal/.test(await msg.innerText()),engineName+' '+width+': tekst → "Dat is geen getal": '+await msg.innerText());
    await field.fill('-5');await s.page.waitForTimeout(60);
    ok(/tussen 0 en 120/.test(await msg.innerText()),engineName+' '+width+': -5 → foutmelding');
    await field.fill('48,5');await s.page.waitForTimeout(60);
    ok(await msg.innerText()===''&&await field.getAttribute('aria-invalid')===null,engineName+' '+width+': 48,5 is geldig, de melding verdwijnt');
    eq(await stored(),[null,null,48.5,54,null],engineName+' '+width+': 48,5 opgeslagen als getal');
    await field.fill('60');await s.page.waitForTimeout(60);
    ok(/Op of boven het kerndoel \(54 °C\)/.test(await msg.innerText()),engineName+' '+width+': een waarde op/boven het kerndoel krijgt een opmerking: '+await msg.innerText());
    eq(await s.f.evaluate(()=>__t.v510PhasePlan(__t.getState().dishes[0]).map(p=>[p.target,p.source])),[[47,'aanname']],engineName+' '+width+': … en telt niet als tussendoel (terugval op de aanname)');
    await field.fill('');await s.page.waitForTimeout(60);
    eq(await stored(),[null,null,null,54,null],engineName+' '+width+': leeg = veld weg (geen fasedoel)');
    await field.fill('47');await s.page.waitForTimeout(60);
    eq(await stored(),[null,null,47,54,null],engineName+' '+width+': terug naar 47');
    const geom=await s.f.evaluate(()=>{const vw=document.documentElement.clientWidth,rs=[...document.querySelectorAll('.generator-stage')].flatMap(st=>[...st.querySelectorAll('input[data-recipe-step="coreAt"], [data-coreat-msg], label')]).map(e=>e.getBoundingClientRect()),i=document.querySelector('[data-recipe-step="coreAt"]').getBoundingClientRect();
      return {h:i.height,l:Math.min(...rs.map(r=>r.left)),r:Math.max(...rs.map(r=>r.right)),vw,over:document.documentElement.scrollWidth-vw}});
    ok(geom.l>=0&&geom.r<=geom.vw+0.5&&geom.over<=overflowBefore+1,engineName+' '+width+': veld, label en melding binnen het scherm en de overflow van de pagina neemt niet toe '+JSON.stringify(geom)+' basis '+overflowBefore);
    ok(geom.h>=36,engineName+' '+width+': veld is groot genoeg om te raken ('+geom.h+' px)');
    ok(await s.f.evaluate(()=>window.__dialogCalls.length)===0&&s.dialogs.length===0&&s.errors.length===0,engineName+' '+width+': geen window.confirm/alert/prompt, geen paginafouten '+s.dialogs.join('|')+s.errors.join('|'));
    await s.context.close();
   }
   {
    // Generator: coreAt als voorstel uit "bij ongeveer 70 °C kern"; pas een fasedoel na een tik van de gebruiker.
    const s=await open(browser);
    const draft=await s.page.evaluate(()=>{
      __t.setDraft(__t.analyzeRecipeText('Ingrediënten\n2 kg procureur\n\nBereiding:\nBestrijk het vlees rondom met saus bij ongeveer 70 °C kern en laat 30 minuten verder garen.\n\nGaar indirect op 120 °C tot circa 92 °C kern.\n\nControleer de malsheid vanaf 88 °C kern met een prikker en haal het vlees van de BBQ.'));
      __t.renderGeneratorPreview();
      return __t.getDraft().stages.map(x=>[x.trigger,x.suggestCoreAt??null,x.coreAt??null]);
    });
    ok(draft.some(x=>x[1]===70)&&draft.some(x=>x[1]===88),engineName+': voorstel 70 (bij ongeveer 70 °C kern) en 88 (vanaf 88 °C kern): '+JSON.stringify(draft));
    ok(draft.every(x=>x[2]===null),engineName+': een voorstel is nog geen coreAt');
    ok(!draft.some(x=>x[1]===92),engineName+': "tot circa 92 °C" is geen startpunt van een stap en wordt niet voorgesteld');
    const i70=draft.findIndex(x=>x[1]===70);
    ok(/Voorstel uit de tekst: 70 °C/.test(await s.page.locator('#generator-stages [data-stage]').nth(i70).innerText()),engineName+': het voorstel staat in de stap');
    await s.page.locator('#generator-stages [data-stage]').nth(i70).locator('[data-stage-action="coreat-suggest"]').dispatchEvent('click');
    const after=await s.page.evaluate(()=>__t.getDraft().stages.map(x=>[x.suggestCoreAt??null,x.coreAt??null]));
    ok(after[i70][1]===70&&after[i70][0]===null,engineName+': na een tik is 70 het fasedoel van die stap');
    ok(after.filter(x=>x[1]!==null).length===1,engineName+': alleen de bevestigde stap heeft een coreAt');
    // Een ongeldige waarde blokkeert het bewaren, met een melding in de pagina.
    await s.page.evaluate(()=>{for(const [k,v] of [['name','Fixture generator'],['grill','120'],['cook','480'],['core','92']]){const el=document.querySelector('[data-gfield="'+k+'"]');if(el)el.value=v;}});
    await s.page.locator('#generator-stages [data-stage]').nth(i70).locator('[data-stage-field="coreAt"]').evaluate(el=>{el.value='999';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await s.page.locator('#generator-save').dispatchEvent('click');
    ok(/tussen 0 en 120/.test(await s.page.locator('#generator-feedback').innerText())&&await s.page.locator('#generator-feedback').getAttribute('data-state')==='error',engineName+': ongeldig fasedoel → melding in de pagina: '+await s.page.locator('#generator-feedback').innerText());
    ok(!JSON.parse(await s.page.evaluate(k=>localStorage.getItem(k)||'[]',LIB)).some(r=>r.name==='Fixture generator'),engineName+': er is niets opgeslagen');
    await s.page.locator('#generator-stages [data-stage]').nth(i70).locator('[data-stage-field="coreAt"]').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await s.page.locator('#generator-save').dispatchEvent('click');await s.page.waitForTimeout(200);
    const saved=JSON.parse(await s.page.evaluate(k=>localStorage.getItem(k),LIB)).find(r=>r.name==='Fixture generator');
    ok(!!saved&&saved.recipeSteps.filter(x=>'coreAt' in x).length===1&&saved.recipeSteps.find(x=>'coreAt' in x).coreAt===70,engineName+': na bevestigen en bewaren staat coreAt 70 in de bibliotheek');
    ok(saved.recipeSteps.every(x=>!('suggestCoreAt' in x)),engineName+': het tijdelijke voorstel wordt niet opgeslagen');
    ok(s.errors.length===0&&await s.page.evaluate(()=>window.__dialogCalls.length)===0,engineName+': geen paginafouten of dialogen '+s.errors.join(' | '));
    await s.context.close();
   }

   // 7. v5.2.3-contract: sensorupdate patcht alleen slots (geen DOM-herbouw), één 1-s- en één 30-s-timer.
   {
    const s=await open(browser,{ha:true});
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);await goLive(s);await onGrill(s,'Ribeye 500 g');
    await rise(s);await tick30(s);
    await s.f.evaluate(()=>{window.__content=document.querySelector('#v5-root .v5-content');window.__tl=document.querySelector('[data-v5-tl]');});
    const id=(await s.dish('Ribeye 500 g')).id,sel='[data-v5-dishcard="'+id+'"] [data-v5-slot="eta"]';
    await s.context.clock.fastForward('01:00');await s.set('pro',idle('46.4','121'));await s.page.waitForTimeout(150);
    ok(await s.f.evaluate(()=>document.querySelector('#v5-root .v5-content')===window.__content&&document.querySelector('[data-v5-tl]')===window.__tl),engineName+': een sensorupdate herbouwt Live en de tijdlijn niet');
    ok(/\(uit recept\)/.test(await s.text(sel)),engineName+': het fasedoel staat in de bestaande schattingsslot: '+await s.text(sel));
    const iv=await s.f.evaluate(()=>window.__intervals);
    ok(iv.filter(x=>x===1000).length===1&&iv.filter(x=>x===30000).length===1,engineName+': precies één 1-s- en één 30-s-timer '+JSON.stringify(iv));
    await s.context.close();
   }

   // 8. 320 px: Live met een fasedoel uit het recept zonder overflow.
   {
    const s=await open(browser,{ha:true,width:320});
    await s.set('pro',idle('9.5','14'));
    await startSession(s,['Ribeye 500 g']);await goLive(s);await onGrill(s,'Ribeye 500 g');
    await rise(s);await tick30(s);
    const g=await s.f.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth,vw:innerWidth,
      out:[...document.querySelectorAll('.v5-hero, .v5-dishcard, [data-v5-slot="eta"]')].filter(e=>{const r=e.getBoundingClientRect();return r.left<-0.5||r.right>innerWidth+0.5}).length}));
    ok(g.over<=1&&g.out===0,engineName+': 320 px: geen horizontale overflow met het fasedoel op Live '+JSON.stringify(g));
    ok(/uit recept/.test(await s.text('.v5-hero')),engineName+': 320 px: hero toont de bron');
    if(shots){await s.f.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await s.page.waitForTimeout(80);await s.shot(shots,engineName+'-01-live-fasedoel-uit-recept-320');}
    if(shots){await focusCard(s,(await s.dish('Ribeye 500 g')).id);await s.shot(shots,engineName+'-01b-live-kaart-fasedoel-uit-recept-320');}
    ok(s.errors.length===0,engineName+': geen paginafouten '+s.errors.join(' | '));
    await s.context.close();
   }
   console.log('OK v5.10.0 fasedoelen: '+engineName);
  }finally{await browser.close();}
 }
}finally{server.close();}
console.log('PASS v5.10.0 fasedoelen (coreAt): '+checks+' checks ('+wanted.join(', ')+'; FIXTURES, geen HA/MEATER/iPhone)');
