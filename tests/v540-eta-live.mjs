/* v5.4.0 shared estimate on Live (jsdom). FIXTURES ONLY: simulated Home Assistant/MEATER readings and a fake clock.
   This is not a real Home Assistant, MEATER or physical iPhone test.
   Covers review PR #43: finding 1 (no drift with the clock), finding 2 (no jump back to the planning for a dish on the
   grill), finding 4 (progress from the first reading), plus one estimate shared by Live, v46Prediction and smartPlan,
   the bbq-ha-history-v1 merge and a planner that still works when the ETA-module is missing. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

function template({eta=true}={}){
  let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
  for(const file of ['bbq-eta.js','bbq-v5.js','bbq-v501.js']){
    const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
    assert.match(html,re,'loader for '+file);
    html=html.replace(re,()=>file==='bbq-eta.js'&&!eta?'':'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
  }
  const anchor='const meaterData={pro:null,plus:null};';
  assert.ok(html.includes(anchor),'meater state anchor');
  // Test-only hooks. __v540Reading follows the accepted bbq-ha-sensors-v1 path; __v540History calls the same merge
  // as an accepted bbq-ha-history-v1 message (the origin/source check itself is tested separately below).
  html=html.replace(anchor,anchor+'\nwindow.__v540Reading=(probe,reading)=>{meaterBridgeSeen=true;meaterData[probe]=reading;rememberProbe(probe,reading);renderSmart(calc());v46Render(calc());window.dispatchEvent(new Event("bbq-meater-updated"));};'+
    '\nwindow.__v540History=probes=>{let n=0;for(const p of ["pro","plus"])n+=mergeProbeHistory(p,probes[p]);if(n>0)window.dispatchEvent(new Event("bbq-meater-updated"));return n;};'+
    '\nwindow.__v540Smart=()=>smartPlan(calc());window.__v540Count=probe=>meaterHistory[probe].length;');
  return html.replace('window.initBBQV5({','window.initBBQV5(window.__v540Bridge={');
}
const START=Date.parse('2026-11-16T15:55:00Z'); // 16:55 in Amsterdam
function boot(opts){
  const errors=[];
  const dom=new JSDOM(template(opts),{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      const NativeDate=w.Date;w.__testNow=START;
      w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[w.__testNow]));}static now(){return w.__testNow;}};
      w.__intervals={};w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
      w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
      w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
      w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
      w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
    }});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);
  const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]');assert.ok(el,'action '+act);el.click();if(act==='prep'){const c=$('#v5-root [data-v5-act="prep-confirm"]');if(c)c.click();}};
  const addRecipe=name=>{const el=$('[data-v5-recipe="'+name+'"]');assert.ok(el,'recipe '+name);el.click();};
  const slot=(id,key)=>$('[data-v5-dishcard="'+id+'"] [data-v5-slot="'+key+'"]');
  const tick=()=>{w.__intervals[1000].forEach(fn=>fn());};
  const tick30=()=>{w.__intervals[30000].forEach(fn=>fn());};
  const sensor=v=>({state:String(v),last_updated:new w.Date(w.__testNow-2000).toISOString()});
  const idle=(core,ambient)=>({internal:sensor(core),ambient:sensor(ambient),target:sensor('unavailable'),status:sensor('unavailable'),
    cooking:sensor('off'),peak:sensor('unavailable'),remaining:sensor('unavailable'),elapsed:sensor('unavailable')});
  const ribeyeOnGrill=()=>{
    press('new');addRecipe('Ribeye 500 g');press('setup');press('prep');press('live');
    const r=w.__v540Bridge.getState().dishes[0];
    $('[data-v5-dishcard="'+r.id+'"] [data-v5-act="phase:'+r.id+':cooking"]').click();
    return r;
  };
  return {dom,w,d,$,press,addRecipe,slot,tick,tick30,sensor,idle,errors,ribeyeOnGrill};
}
// "Zoals gisteren" at realistic HA cadence: a reading every 30 s, 9.5 → 45.5 °C in 40 min at 121 °C (Newton).
const K=Math.log((121-9.5)/(121-45.5))/40;
const coreAt=m=>121-(121-9.5)*Math.exp(-K*m);
// Same local formatting as the app (process time zone; CI runs in UTC).
const clock=t=>new Date(t).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});

// 1. One estimate, anchored at the last reading: no drift, no jump back to the planning, progress from the first reading.
{
  const t=boot();
  const {w,$,slot,tick,tick30,idle,errors,ribeyeOnGrill}=t;
  try{
    const ribeye=ribeyeOnGrill(),root=$('#v5-root .v5-content');
    // v5.5: no probe is linked on the public website; the first HA reading links the measuring MEATER Pro automatically.
    assert.equal(w.__v540Bridge.getState().dishes[0].meater,'none','no default probe without a Home Assistant bridge');
    for(let i=0;i<=80;i++){
      if(i)w.__testNow+=30000;
      w.__v540Reading('pro',idle(coreAt(i/2).toFixed(1),i<2?14:121));
    }
    const lastReading=w.__testNow-2000;
    const eta=()=>slot(ribeye.id,'eta').textContent.replace(/\s+/g,' ').trim();
    const first=eta();
    assert.match(first,/^Op tafel rond \d\d:\d\d/,first);
    assert.match(first,/eigen trend ±\d+ min/,'own curve with margin: '+first);
    assert.match(first,/47 °C \(einde indirect\) rond \d\d:\d\d/,'reverse-sear phase target: '+first);
    assert.match(first,/kern 54 °C rond \d\d:\d\d \+ 8 min rust/,first);
    // The Newton truth for 54 °C is 52.3 min after the start (17:47 in Amsterdam); allow ±1 min.
    const truth=START+Math.log((121-9.5)/(121-54))/K*60000;
    assert.ok([-60000,0,60000].some(dt=>first.includes('kern 54 °C rond '+clock(truth+dt))),'close to the Newton truth: '+first);
    const est=w.__v540Bridge.getEstimate(ribeye);
    assert.equal(est.source,'curve');assert.equal(est.asOf,lastReading,'anchored at the last reading');
    // Same estimate everywhere: Live card, v46Prediction (MEATER page) and smartPlan.
    const pred=w.__v540Bridge.getPrediction(ribeye);
    assert.equal(pred.eta,est.cookEnd,'v46Prediction uses the module');
    assert.match($('#v46-live').textContent,/Eigen schatting uit de temperatuurcurve/,'MEATER page');
    const row=w.__v540Smart().rows.find(r=>r.d.id===ribeye.id);
    assert.equal(row.cookEnd,est.cookEnd,'smartPlan uses the module');
    assert.equal(row.source,'eigen schatting uit temperatuurcurve');
    assert.match($('#smart-indicator').textContent,/1 eigen schatting/);
    // Rise: robust slope over the window (°C/min).
    assert.match(slot(ribeye.id,'env').textContent,/\+0,[78] °C\/min/,slot(ribeye.id,'env').textContent);
    // Review finding 4: progress from the first reading of the session (9.5 °C), not from 0 °C.
    const bar=$('[data-v5-dishcard="'+ribeye.id+'"] .v5-dc-bar').getAttribute('aria-label');
    assert.equal(bar,Math.round((45.5-9.5)/(54-9.5)*100)+'% van de richtkern',bar);
    // Review finding 1: no new reading → "Op tafel rond" stays exactly the same (1-s and 30-s timers running).
    for(let s=1;s<=270;s++){w.__testNow+=1000;tick();if(s%30===0)tick30();}
    assert.equal(eta(),first,'no drift after 4.5 min without a reading');
    // v5.5 (review PR #44, finding 2): HA writes no new state for an unchanged value. While the sensor stays available,
    // 6 min without a change is "geen verandering sinds", the estimate stays (same time, not stale, not the planning).
    w.__testNow=lastReading+6*60000+1000;tick();tick30();
    const time=first.match(/^Op tafel rond (\d\d:\d\d)/)[1];
    assert.equal(eta().match(/^Op tafel rond (\d\d:\d\d)/)?.[1],time,'unchanged value: same estimate, not expired: '+eta());
    assert.match(slot(ribeye.id,'core').textContent,/45,5 °C[\s\S]*Geen verandering sinds \d\d:\d\d/,'unchanged since, value kept');
    assert.doesNotMatch(slot(ribeye.id,'core').textContent,/● LIVE/,'an unchanged value is not labelled LIVE');
    // Review finding 2 of PR #43 (kept): the probe goes offline (HA: unavailable) → last estimate with a stale label,
    // never the planned end. Before v5.5 a missing update alone triggered this; now only an unavailable sensor does.
    const off=idle('unavailable','unavailable');w.__v540Reading('pro',off);tick();tick30();
    const stale=eta();
    assert.equal(stale.match(/^Laatste schatting (\d\d:\d\d)/)?.[1],time,'same time, labelled as last estimate: '+stale);
    assert.match(stale,/verouderd: meting 6 min oud/);
    assert.doesNotMatch(stale,/planning|18:30/,'not the planned end (18:30): '+stale);
    assert.match(slot(ribeye.id,'core').textContent,/— °C[\s\S]*Kerntemperatuur niet beschikbaar/,'no core value while the sensor is unavailable');
    // 16 min: the curve is no longer used → registered start + recipe duration (55 + 15 ombouw) + 8 rest, now as a range (v5.8).
    w.__testNow=lastReading+16*60000;tick();
    const later=eta();
    // v5.8: without a (fresh) measurement the registered start + duration is shown as an honest range "geschat, geen meting"
    // (±20 %, min. ±15 min); the point estimate (start + 55 + 15 ombouw + 8 rest) lies inside it.
    assert.match(later,/geschat, geen meting/,later);
    const range=later.match(/Op tafel tussen (\d\d:\d\d) en (\d\d:\d\d)/);
    assert.ok(range,'range label: '+later);
    const point=clock(START+(55+15+8)*60000);
    assert.ok(range[1]<=point&&point<=range[2],'point estimate '+point+' inside '+range[1]+'–'+range[2]+': '+later);
    assert.doesNotMatch(later,/planning/);
    assert.doesNotMatch(later,/LIVE/);
    assert.equal($('#v5-root .v5-content'),root,'no Live rebuild');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.4.0 shared estimate: own curve, phase 47 °C, no drift over 4.5 min, last estimate at 6 min, start + duration at 16 min, progress from first reading');
  }finally{t.dom.window.close();}
}

// 2. History at open (bbq-ha-history-v1): an estimate right away, live readings win, junk ignored.
{
  const t=boot();
  const {w,slot,idle,errors,ribeyeOnGrill}=t;
  try{
    const ribeye=ribeyeOnGrill();
    w.__testNow=START+40*60000;
    const core=[],ambient=[];
    for(let i=0;i<=80;i++){const tt=START+i*30000;core.push([tt,Number(coreAt(i/2).toFixed(1))]);ambient.push([tt,i<2?14:121]);}
    core.push([START-5*3600000,20],['x',30],[START+30000,'unavailable'],[START+90*60000,99]); // too old, junk, future
    w.__v540Reading('pro',idle('45.5',121));
    const before=w.__v540Count('pro');
    const added=w.__v540History({pro:{internal:core,ambient},plus:null});
    assert.equal(added,81,'81 valid historic points merged; too old, junk and future points ignored');
    assert.equal(w.__v540Count('pro'),before+81);
    assert.match(slot(ribeye.id,'eta').textContent,/eigen trend/,'estimate right after opening');
    assert.equal(w.__v540History({pro:{internal:'nope'}}),0,'invalid payload ignored');
    // Origin/source check: a message that does not come from a parent HA card is ignored.
    w.postMessage({__bbq:'bbq-ha-history-v1',probes:{plus:{internal:[[START,50],[START+600000,60]]}}},'*');
    await new Promise(r=>setTimeout(r,10));
    assert.equal(w.__v540Count('plus'),0,'message from the page itself rejected');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.4.0 history at open: merged, validated, rejected without a parent HA card');
  }finally{t.dom.window.close();}
}

// 3. Stall on a pork shoulder: "Stall rond 70 °C", no curve time, start + duration as source.
{
  const t=boot();
  const {w,$,press,addRecipe,slot,idle,errors}=t;
  try{
    w.__testNow=Date.parse('2026-11-16T07:00:00Z'); // 08:00
    press('new');addRecipe('Pulled pork op brood');press('setup');press('prep');press('live');
    const pork=w.__v540Bridge.getState().dishes[0];
    $('[data-v5-dishcard="'+pork.id+'"] [data-v5-act="phase:'+pork.id+':cooking"]').click();
    let m=0,c=5;
    while(c<70){w.__testNow+=30000;m+=0.5;c=120-(120-5)*Math.exp(-0.012*m);w.__v540Reading('pro',idle(c.toFixed(1),120));}
    for(let i=1;i<=50;i++){w.__testNow+=30000;w.__v540Reading('pro',idle((70+i/180).toFixed(1),119));}
    const eta=slot(pork.id,'eta').textContent.replace(/\s+/g,' ');
    assert.match(eta,/Stall rond 70 °C sinds \d\d:\d\d/,eta);
    assert.match(eta,/start \+ receptduur/,eta);
    assert.doesNotMatch(eta,/eigen trend/,'no curve time during a stall');
    assert.equal(w.__v540Bridge.getEstimate(pork).state,'stall');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.4.0 stall: no curve time, start + recipe duration');
  }finally{t.dom.window.close();}
}

// 4. ETA-module missing (e.g. a failed load): the planner keeps working with the planning as source.
{
  const t=boot({eta:false});
  const {w,slot,idle,errors,ribeyeOnGrill}=t;
  try{
    const ribeye=ribeyeOnGrill();
    for(let i=0;i<=20;i++){if(i)w.__testNow+=30000;w.__v540Reading('pro',idle(coreAt(i/2).toFixed(1),121));}
    assert.equal(w.__v540Bridge.getEstimate(ribeye),null);
    assert.match(slot(ribeye.id,'eta').textContent,/Op tafel rond \d\d:\d\d/);
    assert.match(slot(ribeye.id,'core').textContent,/°C/);
    const row=w.__v540Smart().rows.find(r=>r.d.id===ribeye.id);
    assert.equal(row.source,'schatting vanaf geregistreerde start','smartPlan falls back to the registered start');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.4.0 without the ETA-module: no errors, planning/start as source');
  }finally{t.dom.window.close();}
}

// 5. HA card: history/history_during_period once per load, converted to bbq-ha-history-v1; failures stay silent.
{
  const code=fs.readFileSync('dist/bbq_planner_card.js','utf8').replace('import.meta.url','"https://planner.test.invalid/dist/bbq_planner_card.js"');
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://planner.test.invalid/',runScripts:'dangerously',pretendToBeVisual:true});
  const w=dom.window,consoleCalls=[];
  try{
    for(const k of ['log','info','warn','error','debug'])w.console[k]=(...a)=>consoleCalls.push(a);
    w.eval(code);
    const card=w.document.createElement('bbq-planner-meater-card');
    w.document.body.appendChild(card);card.setConfig({});
    const sent=[];card._iframe={contentWindow:{postMessage:(m,o)=>sent.push({m,o})},style:{}};
    const P='sensor.meater_probe_00e865be_';
    const calls=[];let fail=false;
    const connection={
      sendMessagePromise:async m=>{calls.push(m);if(m.type!=='history/history_during_period')return {value:null};if(fail)throw Error('recorder off');
        return {[P+'interne_temperatuur']:[{s:'9.5',lu:1794844500.25},{s:'unavailable',lu:1794844530},{s:'10.4',lu:1794844560}],[P+'omgevingstemperatuur']:[{s:'121',lu:1794844500}]};},
      subscribeMessage:async()=>()=>{}
    };
    const states={[P+'interne_temperatuur']:{state:'10.4',last_updated:'2026-11-16T15:56:00Z'},[P+'omgevingstemperatuur']:{state:'121',last_updated:'2026-11-16T15:56:00Z'}};
    // Review PR #44, finding 4: planner ready before HA states are known → no call yet, but retried later.
    card.hass={states:{},connection};
    card._onMsg({origin:w.location.origin,source:card._iframe.contentWindow,data:{__bbq:'bbq-child-ready-v1'}});
    await new Promise(r=>setTimeout(r,20));
    assert.equal(calls.filter(c=>c.type==='history/history_during_period').length,0,'no history call without known sensors');
    assert.equal(card._historyWanted,true,'request stays open');
    card.hass={states,connection};
    await new Promise(r=>setTimeout(r,20));
    const hist=calls.filter(c=>c.type==='history/history_during_period');
    assert.equal(hist.length,1,'one history call per load');
    const plain=v=>JSON.parse(JSON.stringify(v)); // jsdom objects come from another realm
    const q=plain(hist[0]);
    assert.deepEqual(q.entity_ids,[P+'interne_temperatuur',P+'omgevingstemperatuur'],'only existing probe sensors (the Plus is not in hass.states)');
    assert.equal(q.minimal_response,true);assert.equal(q.no_attributes,true);
    assert.equal(q.significant_changes_only,false);assert.equal(q.include_start_time_state,false);
    assert.ok(Math.abs(Date.now()-3*3600000-Date.parse(q.start_time))<60000,'last 3 hours');
    const found=sent.find(x=>x.m.__bbq==='bbq-ha-history-v1'),msg=found&&{m:plain(found.m),o:found.o};
    assert.ok(msg,'history sent to the planner');
    assert.equal(msg.o,w.location.origin,'same-origin target only');
    assert.deepEqual(msg.m.probes.pro.internal,[[1794844500250,9.5],[1794844560000,10.4]],'seconds → ms, non-numeric states dropped');
    assert.deepEqual(msg.m.probes.pro.ambient,[[1794844500000,121]]);
    assert.deepEqual(msg.m.probes.plus,{internal:[],ambient:[]});
    // Further hass updates do not repeat the call; a failure is silent (no message, nothing logged).
    card.hass={states,connection};await new Promise(r=>setTimeout(r,10));
    assert.equal(calls.filter(c=>c.type==='history/history_during_period').length,1,'not repeated on every hass update');
    fail=true;sent.length=0;
    card._onMsg({origin:w.location.origin,source:card._iframe.contentWindow,data:{__bbq:'bbq-child-ready-v1'}});
    await new Promise(r=>setTimeout(r,20));
    assert.equal(sent.filter(x=>x.m.__bbq==='bbq-ha-history-v1').length,0,'no history message after a failure');
    assert.deepEqual(consoleCalls,[],'nothing logged');
    console.log('PASS v5.4.0 HA card: history/history_during_period once per load, converted, silent fallback');
  }finally{dom.window.close();}
}
