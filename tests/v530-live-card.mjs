/* v5.3.0 Live dish card (jsdom). FIXTURES ONLY: simulated Home Assistant/MEATER readings and a fake clock.
   This is not a real Home Assistant, MEATER or physical iPhone test.
   Scenario "zoals gisteren": Ribeye 500 g, MEATER Pro linked, no cook in the MEATER app (target, status and
   remaining time unavailable). The core rises in 40 minutes from 9.5 to 45.5 °C at 121 °C ambient. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

let template=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
for(const file of ['bbq-eta.js','bbq-v5.js','bbq-v501.js']){ // v5.4: the ETA-module loads before bbq-v5.js
  const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
  assert.match(template,re,'loader for '+file);
  template=template.replace(re,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
}
const anchor='const meaterData={pro:null,plus:null};';
assert.ok(template.includes(anchor),'meater state anchor');
// Test-only hook: the same path as an accepted bbq-ha-sensors-v1 message (state, history, v5 event).
template=template.replace(anchor,anchor+'\nwindow.__v530Reading=(probe,reading)=>{meaterBridgeSeen=true;meaterData[probe]=reading;rememberProbe(probe,reading);window.dispatchEvent(new Event("bbq-meater-updated"));};');
template=template.replace('window.initBBQV5({','window.initBBQV5(window.__v530Bridge={');

const START=Date.parse('2026-11-16T15:55:00Z'); // 16:55 in Amsterdam; 40 min later = 17:35

function boot({wakeLock=false}={}){
  const errors=[],alerts=[],wake={requests:0,releases:0};
  const dom=new JSDOM(template,{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      const NativeDate=w.Date;w.__testNow=START;
      w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[w.__testNow]));}static now(){return w.__testNow;}};
      w.__intervals={};w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
      w.confirm=()=>true;w.alert=msg=>alerts.push(String(msg));w.prompt=()=>null;w.print=()=>{};
      w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
      w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
      w.__hidden=false;Object.defineProperty(w.document,'hidden',{configurable:true,get:()=>w.__hidden});
      if(wakeLock)Object.defineProperty(w.navigator,'wakeLock',{configurable:true,value:{request:type=>{
        assert.equal(type,'screen');wake.requests++;
        const listeners=[];
        return Promise.resolve({released:false,addEventListener:(n,f)=>listeners.push(f),release(){wake.releases++;this.released=true;listeners.forEach(f=>f());return Promise.resolve();}});
      }}});
      w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
    }});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);
  const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]');assert.ok(el,'action '+act);el.click();};
  const addRecipe=name=>{const el=$('[data-v5-recipe="'+name+'"]');assert.ok(el,'recipe '+name);el.click();};
  const card=id=>$('[data-v5-dishcard="'+id+'"]');
  const slot=(id,key)=>card(id)?.querySelector('[data-v5-slot="'+key+'"]');
  const tick=()=>w.__intervals[1000].forEach(fn=>fn());
  const stamp=()=>new w.Date(w.__testNow-2000).toISOString();
  const sensor=v=>({state:String(v),last_updated:stamp()});
  // MEATER without a cook in the MEATER app: target, status and remaining are unavailable.
  const idle=(core,ambient)=>({internal:sensor(core),ambient:sensor(ambient),target:sensor('unavailable'),status:sensor('unavailable'),
    cooking:sensor('off'),peak:sensor('unavailable'),remaining:sensor('unavailable'),elapsed:sensor('unavailable')});
  return {dom,w,d,$,press,addRecipe,card,slot,tick,sensor,idle,errors,alerts,wake};
}
const flush=()=>new Promise(r=>setTimeout(r,0));

// 1. Scenario "zoals gisteren" through the real flow, own trend as source.
{
  const t=boot({wakeLock:true});
  const {w,d,$,press,addRecipe,card,slot,tick,sensor,idle,errors,wake}=t;
  try{
    press('new');addRecipe('Ribeye 500 g');
    const bridge=w.__v530Bridge,ribeye=bridge.getState().dishes[0];
    // v5.5 (review PR #43, finding 3): no automatic probe on the public website (no HA bridge seen yet).
    // The default (Pro → first dish on the large kamado) only applies in the HA card; see tests/v550-live-timeline.mjs.
    assert.equal(ribeye.meater,'none','no default probe without Home Assistant');
    press('setup');
    let select=$('select[data-v5-meater="'+ribeye.id+'"]');
    assert.ok(select,'thermometer choice in step 2');
    assert.deepEqual([...select.options].map(o=>o.value),['none','pro','plus']);
    select.value='pro';select.dispatchEvent(new w.Event('change',{bubbles:true}));
    select=$('select[data-v5-meater="'+ribeye.id+'"]');
    assert.equal(select.value,'pro');
    assert.equal(bridge.getState().dishes[0].meaterAuto,false,'a choice in step 2 is marked as manual (optional field)');
    press('prep');press('live');
    await flush();
    assert.equal(wake.requests,1,'wake lock requested while Live is visible');
    assert.ok(!$('.v5-live-status'),'explanatory status line moved behind the info button');
    assert.match($('.v5-live-info').textContent,/alleen via Home Assistant/,'explanation kept behind ⓘ');
    const root=$('#v5-root .v5-content');
    assert.equal(d.querySelectorAll('[data-v5-dishcard]').length,1,'one card per dish');
    // Before any reading: dashes, never an invented value.
    assert.match(slot(ribeye.id,'core').textContent,/— °C/);
    assert.ok(!$('#v5-root').textContent.includes('● LIVE'),'no LIVE label without readings');
    // Put the ribeye on the grill with the existing phase button on the card.
    $('[data-v5-dishcard="'+ribeye.id+'"] [data-v5-act="phase:'+ribeye.id+':cooking"]').click();
    const cardRoot=$('#v5-root .v5-content');
    const saved=w.localStorage.getItem('kamado-bereidingsplanner-v1');
    w.__v530Reading('pro',idle(9.5,14));
    for(let k=1;k<=10;k++){
      w.__testNow+=4*60000;
      w.__v530Reading('pro',idle((9.5+3.6*k).toFixed(1),121));
    }
    assert.equal($('#v5-root .v5-content'),cardRoot,'sensor updates never rebuild #v5-root .v5-content');
    const core=slot(ribeye.id,'core').textContent,env=slot(ribeye.id,'env').textContent,eta=slot(ribeye.id,'eta').textContent,coach=slot(ribeye.id,'coach').textContent;
    assert.match(core,/45,5 °C/,'core shown '+core);
    assert.match(core,/→ 54 °C/,'target from Richtkern');
    assert.match(core,/● LIVE · HA-update 2 s geleden/,'age from HA timestamp');
    assert.ok(card(ribeye.id).querySelector('.v5-dc-bar'),'progress bar');
    assert.match(env,/Omgeving 121 °C/,'ambient '+env);
    assert.match(env,/\+0,9 °C\/min/,'rise around 0.9 °C/min '+env);
    assert.match(eta,/Op tafel rond \d\d:\d\d/,'estimate '+eta);
    assert.match(eta,/eigen trend ±\d+ min/,'source and margin '+eta);
    assert.ok(coach.trim().length>0,'one coach line');
    assert.equal(card(ribeye.id).querySelectorAll('.v5-dc-coach').length,1,'at most one coach line');
    assert.match(coach,/overgang van indirect naar direct/,'reverse-sear advice from v45Advice');
    assert.equal(w.__intervals[1000]?.length,1,'one 1-second timer');
    assert.equal(w.__intervals[30000]?.length,1,'one 30-second timer');
    w.__intervals[30000][0]();
    assert.equal($('#v5-root .v5-content'),cardRoot,'30-second schedule refresh preserves Live DOM');

    // 2. Same moment with a MEATER ETA (cook started in the MEATER app, target 54).
    // v5.4 source order: the own curve stays the source; a MEATER ETA more than 10 min off is shown next to it.
    const etaAt=new w.Date(w.__testNow+30*60000).toISOString();
    w.__v530Reading('pro',{...idle('45.5',121),target:sensor('54'),status:sensor('started'),cooking:sensor('on'),remaining:sensor(etaAt)});
    assert.match(slot(ribeye.id,'eta').textContent,/eigen trend/,'own curve stays the source');
    assert.match(slot(ribeye.id,'eta').textContent,/MEATER-ETA zegt \d\d:\d\d/,'MEATER ETA shown as second opinion');
    assert.equal($('#v5-root .v5-content'),cardRoot,'still no rebuild');

    // 3. No new reading: delayed label; after five minutes (v5.5, review PR #44 finding 2) "geen verandering sinds"
    //    while HA keeps the sensor available; once the sensor is unavailable no core value at all.
    w.__testNow+=2*60000;tick();
    assert.match(slot(ribeye.id,'core').textContent,/45,5 °C[\s\S]*Vertraagd/,'stale label after a minute');
    w.__testNow+=4*60000;tick(); // 6 minutes since the last change
    const held=slot(ribeye.id,'core').textContent;
    assert.match(held,/45,5 °C[\s\S]*Geen verandering sinds \d\d:\d\d/,'unchanged value kept with its own label: '+held);
    assert.ok(!$('#v5-root').textContent.includes('● LIVE'),'an unchanged value is never labelled LIVE');
    w.__v530Reading('pro',idle('unavailable','unavailable')); // MEATER offline: HA reports the sensors unavailable
    const stale=slot(ribeye.id,'core').textContent;
    assert.ok(!stale.includes('45,5'),'unavailable core hidden: '+stale);
    assert.match(stale,/— °C/);
    assert.match(stale,/Kerntemperatuur niet beschikbaar/,'unavailable sensor');
    assert.ok(!$('#v5-root').textContent.includes('● LIVE'),'no LIVE label for an unavailable value');
    assert.doesNotMatch(slot(ribeye.id,'env').textContent,/°C\/min/,'no rise without a usable reading');
    // v5.4 (review PR #43, finding 2): a dish on the grill no longer jumps back to the planning.
    assert.match(slot(ribeye.id,'eta').textContent,/Laatste schatting \d\d:\d\d[\s\S]*verouderd: meting 6 min oud/,'last estimate, marked stale');
    assert.doesNotMatch(slot(ribeye.id,'eta').textContent,/planning/,'not the planning');
    assert.equal($('#v5-root .v5-content'),cardRoot,'stale ticks do not rebuild');
    assert.equal(w.localStorage.getItem('kamado-bereidingsplanner-v1'),saved,'sensor readings never write to storage');

    // Wake lock: released when hidden or when leaving Live, requested again on return.
    w.__hidden=true;d.dispatchEvent(new w.Event('visibilitychange'));await flush();
    assert.equal(wake.releases,1,'released while hidden');
    w.__hidden=false;d.dispatchEvent(new w.Event('visibilitychange'));await flush();
    assert.equal(wake.requests,2,'requested again when visible');
    $('#v5-nav [data-v5-act="home"]').click();await flush();
    assert.equal(wake.releases,2,'released when leaving Live');
    assert.deepEqual(errors,[],'no runtime errors');
    console.log('PASS v5.3.0 scenario "zoals gisteren": 45,5 → 54 °C, omgeving 121, +0,9 °C/min, eigen trend, MEATER-ETA, stale cutoff, wake lock, no redraw');
  }finally{t.dom.window.close();}
}

// 4. Public PWA without Home Assistant: dashes and the planning as source; nowhere "LIVE".
{
  const t=boot();
  const {w,$,press,addRecipe,slot,tick,errors}=t;
  try{
    press('new');addRecipe('Ribeye 500 g');press('setup');press('prep');press('live');tick();
    const ribeye=w.__v530Bridge.getState().dishes[0];
    assert.match(slot(ribeye.id,'core').textContent,/— °C/);
    assert.match(slot(ribeye.id,'eta').textContent,/Op tafel rond \d\d:\d\d[\s\S]*planning/);
    assert.doesNotMatch($('#v5-root').textContent,/LIVE/,'no LIVE label in the public PWA');
    assert.doesNotMatch(slot(ribeye.id,'env').textContent,/°C\/min/);
    assert.deepEqual(errors,[]);
    console.log('PASS v5.3.0 public PWA: dashes, planning as source, no LIVE');
  }finally{t.dom.window.close();}
}

// 5. Two dishes on one kamado: two cards, each with its own probe; the same probe twice is refused.
{
  const t=boot();
  const {w,d,$,press,addRecipe,slot,sensor,idle,errors,alerts}=t;
  try{
    press('new');addRecipe('Ribeye 500 g');addRecipe('Kippenpoten');
    const [ribeye,chicken]=w.__v530Bridge.getState().dishes;
    // v5.7: a new dish gets the kamado with the fewest conflicts (Kippenpoten → small). This scenario needs both dishes on one
    // kamado, so the user chooses "Groot" by hand in step 2 (a manual choice that the app never changes by itself).
    assert.equal(ribeye.kamado,'large');assert.equal(chicken.kamado,'small','v5.7: chosen when added');
    press('setup');
    const kamadoSelect=$('select[data-v5-kamado="'+chicken.id+'"]');kamadoSelect.value='large';kamadoSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(chicken.kamado,'large');
    assert.equal(chicken.meater,'none','no default for a second dish on the same kamado');
    const choose=(dish,value)=>{const el=$('select[data-v5-meater="'+dish.id+'"]');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
    choose(ribeye,'pro'); // v5.5: chosen in step 2 (no automatic default on the public website)
    assert.equal(ribeye.meater,'pro');
    choose(chicken,'pro');
    assert.equal(alerts.length,1,'duplicate probe refused with a message');
    assert.equal(chicken.meater,'none','duplicate probe not stored');
    choose(chicken,'plus');
    assert.equal(chicken.meater,'plus');
    const ribeyeSelect=$('select[data-v5-meater="'+ribeye.id+'"]');
    assert.equal(ribeyeSelect.querySelector('option[value="plus"]').disabled,true,'probe in use elsewhere is disabled');
    press('prep');press('live');
    assert.equal(d.querySelectorAll('[data-v5-dishcard]').length,2,'two cards on one kamado');
    const root=$('#v5-root .v5-content');
    w.__v530Reading('pro',idle('41.2',118));
    w.__v530Reading('plus',idle('63.4',176));
    assert.match(slot(ribeye.id,'core').textContent,/41,2 °C/);
    assert.match(slot(chicken.id,'core').textContent,/63,4 °C/);
    assert.match(slot(chicken.id,'core').textContent,/→ 75 °C/);
    assert.match(d.querySelector('[data-v5-dishcard="'+chicken.id+'"] .v5-dc-title').textContent,/MEATER Plus/);
    assert.equal($('#v5-root .v5-content'),root,'no rebuild');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.3.0 two dishes on one kamado: two cards with their own probe; duplicate probe refused');
  }finally{t.dom.window.close();}
}
