/* v5.11.0 receptgenerator: kerndoel en methode bij reverse sear (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: eigen testteksten in de echte planner (dist/BBQ_bereidingsplanner_MEATER_v4.html). Geen Home Assistant, MEATER of iPhone.
   Alleen parsinglogica: geen nieuwe opslagvelden. Scenario's:
   1) de reproductie van de review: eindkern 54 (label), combo, fase 2 = 250 (de schroeitemperatuur, nooit de kern), BBQ 120;
   2) een gelabelde (eind)kern gaat voor op een tussen-waarde; zonder label is het doel de hoogste waarde die ook de laatste is,
      anders blijft het veld leeg met "controleer";
   3) reverse sear-detectie (positief) en geen reverse sear (negatief: kip, pulled pork, zalm, eerst direct dan indirect);
   4) het coreAt-voorstel (v5.10) blijft een voorstel: 47 staat bij de opstookstap, pas na een tik wordt het coreAt;
   5) 320 px en 390 px: preview zonder extra horizontale overflow, geen window.confirm/alert/prompt, geen paginafouten.
   Optioneel: SCREENSHOTS_DIR=<map>, ENGINES=chromium, CHROME_PATH=<pad naar chrome> (alleen lokaal). */
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
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

const REPRO='Ribeye reverse sear\nBereiding: Gaar indirect op 120 °C tot circa 46 °C kern. Bij ongeveer 47 °C kern stook je op naar 250 °C. Schroei tot 54 °C kern. Laat 8 minuten rusten.\nKerntemperatuur 54 °C. Bereidingstijd 55 minuten. BBQ 120 °C.';
// [naam, tekst, verwacht] ; verwacht: core, method, phase2Temp (alleen de genoemde velden worden gecontroleerd)
const CASES=[
  ['repro review (label + reverse sear)',REPRO,{core:'54',method:'combo',phase2Temp:'250',grill:'120',cook:'55',rest:'8'}],
  ['reverse sear zonder label: hoogste/laatste waarde is het doel',
   'Ribeye\nBereiding: Gaar indirect op 110 °C tot 46 °C kern. Bij 47 °C kern stook je op naar 250 °C. Schroei tot 54 °C kern.',{core:'54',method:'combo',phase2Temp:'250'}],
  ['eindkern gaat voor op kerntemperatuur en tussenwaarde',
   'Tomahawk reverse sear\nBereiding: Gaar indirect op 120 °C tot 48 °C kern. Stook daarna op naar 300 °C en schroei.\nKerntemperatuur 50 °C. Eindkern 56 °C.',{core:'56',method:'combo',phase2Temp:'300'}],
  ['kern met dubbele punt en reverse sear zonder schroeitemperatuur',
   'Entrecote reverse sear\nBereiding: Gaar indirect op 120 °C. Kern: 52 °C.',{core:'52',method:'combo',phase2Temp:''}],
  ['alleen een opstook-trigger is geen doel (twijfel: leeg)',
   'Ribeye\nBereiding: Gaar indirect op 120 °C. Bij 47 °C kern stook je op naar 250 °C en schroei je kort.',{core:'',method:'combo',phase2Temp:'250'}],
  ['kip: tot 63 °C kern, geen reverse sear',
   'Kip\nBereiding: Gril de kip indirect op 180 °C tot 63 °C kern.\nBBQ 180 °C.',{core:'63',method:'indirect',phase2Temp:'',grill:'180'}],
  ['twee gelijke labels: dezelfde waarde',
   'Kip\nKerntemperatuur 74 °C.\nBereiding: gril indirect op 180 °C. Haal af bij kerntemperatuur van 74 °C.',{core:'74',method:'indirect'}],
  ['twee verschillende labels, de hoogste is niet de laatste: leeg met controleer',
   'Gerecht\nKerntemperatuur 63 °C.\nBereiding: gaar indirect op 150 °C. Kerntemperatuur 54 °C.',{core:'',evidenceCore:/controleer/}],
  ['twee verschillende labels, laatste is de hoogste',
   'Gerecht\nKerntemperatuur 54 °C.\nBereiding: gaar indirect op 150 °C. Kerntemperatuur 63 °C.',{core:'63'}],
  ['meerdere kernwaarden zonder label, laatste is niet de hoogste: leeg met controleer',
   'Pulled pork\nBereiding: Gaar indirect op 120 °C tot 93 °C kern. Haal af, rust en trek het vlees bij 70 °C kern.',{core:'',evidenceCore:/controleer/,method:'indirect'}],
  ['pulled pork: 70 en 93 zonder label, 93 is het doel',
   'Pulled pork\nBereiding: Gaar indirect op 120 °C. Wikkel bij 70 °C kern in folie. Haal van de BBQ bij 93 °C kern.',{core:'93',method:'indirect',phase2Temp:''}],
  ['zalm: geen label en geen kernwaarde blijft leeg',
   'Zalm\nBereiding: Grill de zalm direct op 180 °C tot hij gaar is.',{core:'',method:'direct',phase2Temp:''}],
  ['zalm: 52 °C kern via tot',
   'Zalm\nBereiding: Gaar indirect op 130 °C tot 52 °C kern.',{core:'52',method:'indirect',phase2Temp:''}],
  ['eerst schroeien, dan indirect = geen reverse sear',
   'Steak\nBereiding: Schroei direct op 250 °C. Gaar daarna indirect op 150 °C tot 54 °C kern.',{core:'54',method:'directindirect'}],
  ['pulled pork met verhoging naar 160 °C is geen reverse sear',
   'Pulled pork\nBereiding: Gaar indirect op 120 °C. Verhoog daarna naar 160 °C tot 92 °C kern.',{core:'92',method:'indirect'}],
  ['reverse sear zonder label (review): kern NA de schroeizin is de eindkern, 48 is het opstookdoel',
   'Ribeye\nBereiding: Zet de kamado indirect op 110 °C. Gaar tot 48 °C in de kern. Verhoog de temperatuur naar 260 °C en schroei 1 minuut per kant. Haal van de BBQ bij 54 °C kern. Rust 10 minuten.',{core:'54',method:'combo',phase2Temp:'260',grill:'110',rest:'10',suggest:48}],
  ['reverse sear: eindkern-label na het opstookdoel',
   'Ribeye\nBereiding: Zet de kamado indirect op 110 °C. Gaar tot 48 °C in de kern. Verhoog de temperatuur naar 260 °C en schroei kort.\nEindkern 55 °C.',{core:'55',method:'combo',phase2Temp:'260',suggest:48}],
  ['reverse sear: haal van het rooster bij 52 °C',
   'Ribeye\nBereiding: Zet de kamado indirect op 110 °C. Gaar tot 46 °C in de kern. Verhoog de temperatuur naar 260 °C en schroei 1 minuut per kant. Haal van het rooster bij 52 °C.',{core:'52',method:'combo',phase2Temp:'260',suggest:46}],
  ['reverse sear: hoge waarde staat vóór de schroeizin: leeg met controleer',
   'Ribeye\nBereiding: Zet de kamado indirect op 110 °C. Gaar tot 54 °C in de kern. Verhoog de temperatuur naar 260 °C en schroei 1 minuut per kant. Rust 10 minuten.',{core:'',method:'combo',phase2Temp:'260',evidenceCore:/controleer/}],
  ['duur: "Rust 60 minuten. Bereidingstijd 600 minuten."',
   'Pulled pork\nBBQ temperatuur 120 °C indirect. Rust 60 minuten. Bereidingstijd 600 minuten.',{cook:'600',rest:'60'}],
  ['geen temperaturen',
   'Zonder temperaturen\nIngrediënten\n2 kg procureur\nBereiding\nKruid het vlees en gaar langzaam.',{core:'',grill:'',phase2Temp:''}]
];
const wanted=(process.env.ENGINES||'chromium,webkit').split(',');
const shots=process.env.SCREENSHOTS_DIR||null;
const launchOpts={headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox']}:{})};

async function openPlanner(browser,width){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__dialogCalls=[];window.confirm=(...a)=>{window.__dialogCalls.push('confirm');return true};window.alert=()=>{window.__dialogCalls.push('alert')};window.prompt=()=>{window.__dialogCalls.push('prompt');return null};});
  // Alleen voor de test: een kopie van de planner met een hook die analyzeRecipeText uit de afgesloten functie haalt (de bestanden op schijf blijven ongewijzigd).
  await context.route(/BBQ_bereidingsplanner_MEATER_v4\.html/,async route=>{
    const res=await route.fetch({maxRetries:3}); // maxRetries: een hergebruikte keep-alive-verbinding naar de lokale testserver kan ECONNRESET geven (eenmalige CI-fout)
    let body=await res.text();
    const anchor='initControls();renderAll();initLibraryUi();';
    if(!body.includes(anchor))throw new Error('anker voor de testhook ontbreekt');
    await route.fulfill({response:res,body:body.replace(anchor,'window.__t={analyzeRecipeText};'+anchor)});
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/dist/BBQ_bereidingsplanner_MEATER_v4.html',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.__t&&!!document.querySelector('#v5-root'),null,{timeout:15000});
  return {context,page,errors};
}
const analyse=(page,text)=>page.evaluate(t=>{const r=window.__t.analyzeRecipeText(t);return {fields:r.fields,evidence:r.evidence,stages:r.stages.map(s=>({title:s.title,trigger:s.trigger,suggestCoreAt:s.suggestCoreAt??null,coreAt:s.coreAt??null}))};},text);
async function openGenerator(page){
  await page.getByText('Recepten',{exact:false}).first().click();
  await page.getByText('Recept uit tekst maken').first().click();
  await page.waitForSelector('#recipe-text',{state:'visible'});
}

for(const name of wanted){
  const engine=name==='webkit'?webkit:chromium;
  const browser=await engine.launch(launchOpts);
  try{
    // 1-3. Parsing (pure functie, echte planner)
    {
      const {context,page,errors}=await openPlanner(browser,390);
      for(const [label,text,exp] of CASES){
        const r=await analyse(page,text);
        for(const [k,v] of Object.entries(exp)){
          if(k==='suggest'){ok(r.stages.some(x=>x.suggestCoreAt===v)&&r.stages.every(x=>x.coreAt===null),name+' · '+label+': '+v+' is een voorstel voor coreAt, geen coreAt: '+JSON.stringify(r.stages));continue;}
          if(k==='evidenceCore'){ok(v.test(r.evidence.core),name+' · '+label+': evidence.core "'+r.evidence.core+'"');continue;}
          ok(String(r.fields[k])===v,name+' · '+label+': '+k+' = "'+r.fields[k]+'" (verwacht "'+v+'")');
        }
        // fase 2 is nooit een kern, en een kern is nooit de BBQ- of fase-2-temperatuur
        const f=r.fields;
        ok(f.core===''||(String(f.phase2Temp)!==String(f.core)&&String(f.grill)!==String(f.core)),name+' · '+label+': kern ('+f.core+') is niet gelijk aan grill ('+f.grill+') of fase 2 ('+f.phase2Temp+')');
        ok(f.phase2Temp===''||(Number(f.phase2Temp)>=50&&Number(f.phase2Temp)<=450),name+' · '+label+': fase 2 binnen 50-450');
      }
      // evidence: de generator verzint niets
      const rs=await analyse(page,REPRO);
      ok(rs.evidence.method==='bron (reverse sear)'&&rs.evidence.phase2Temp==='bron'&&rs.evidence.core==='bron'&&rs.evidence.phase2Minutes==='ontbreekt'&&rs.fields.phase2Minutes===''&&rs.fields.transitionMins==='',name+': herkomstlabels; fase-2-duur en ombouwtijd blijven leeg ("ontbreekt")');
      // 4. het voorstel uit v5.10 blijft een voorstel
      ok(rs.stages.some(s=>s.suggestCoreAt===47)&&rs.stages.every(s=>s.coreAt===null),name+': 47 is een voorstel (suggestCoreAt), nog geen coreAt: '+JSON.stringify(rs.stages));
      ok(errors.length===0&&await page.evaluate(()=>window.__dialogCalls.length)===0,name+': geen paginafouten of dialogen '+errors.join('|'));
      await context.close();
    }
    // 4-5. Preview in de pagina op 390 en 320 px
    for(const width of [390,320]){
      const {context,page,errors}=await openPlanner(browser,width);
      await openGenerator(page);
      const before=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      await page.fill('#recipe-text',REPRO);
      await page.locator('#recipe-analyze').dispatchEvent('click');
      await page.waitForSelector('#generator-preview.visible');
      const g=async k=>page.locator('#generator-fields [data-gfield="'+k+'"]').inputValue();
      ok(await g('core')==='54'&&await g('method')==='combo'&&await g('phase2Temp')==='250'&&await g('grill')==='120',name+' '+width+': preview toont kern 54, combo, fase 2 250, BBQ 120');
      const stage=page.locator('#generator-stages [data-stage]',{hasText:/Voorstel uit de tekst:\s*47/}).first();
      ok(await stage.count()===1,name+' '+width+': voorstel 47 °C staat bij de opstookstap');
      ok(await stage.locator('[data-stage-field="coreAt"]').inputValue()==='','coreAt blijft leeg tot de gebruiker bevestigt');
      if(shots){await mkdir(shots,{recursive:true});
        await page.locator('#generator-fields').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(shots,name+'-01-preview-velden-'+width+'.png')});
        await stage.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(shots,name+'-02-preview-opstookstap-voorstel-'+width+'.png')});}
      await stage.locator('[data-stage-action="coreat-suggest"]').dispatchEvent('click');
      ok(await page.locator('#generator-stages [data-stage-field="coreAt"]').first().inputValue()==='47',name+' '+width+': na een tik op "Neem 47 °C over" is coreAt 47');
      const after=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      ok(after<=before+1,name+' '+width+': preview voegt geen horizontale overflow toe (voor '+before+', na '+after+')');
      const geom=await page.evaluate(()=>{const vw=innerWidth,bad=[...document.querySelectorAll('#generator-preview input,#generator-preview select,#generator-preview textarea,#generator-preview button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-0.5||r.right>vw+0.5)});return bad.map(e=>e.tagName+'#'+(e.id||e.dataset.gfield||e.dataset.stageField||''))});
      ok(geom.length===0,name+' '+width+': alle velden binnen het scherm '+geom.join(','));
      ok(errors.length===0&&await page.evaluate(()=>window.__dialogCalls.length)===0,name+' '+width+': geen paginafouten of dialogen '+errors.join('|'));
      await context.close();
    }
  }finally{await browser.close();}
}
server.close();
console.log('v5.11.0 generator reverse sear: '+checks+' controles geslaagd ('+wanted.join(', ')+')');
