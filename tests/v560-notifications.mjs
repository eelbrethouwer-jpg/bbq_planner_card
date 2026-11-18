/* v5.6.0 notifications on the phone (jsdom). FIXTURES ONLY: a simulated Home Assistant card/parent window with two
   notify.mobile_app_* services and one other notify service, simulated MEATER readings and a fake clock.
   This is not a real Home Assistant, Companion app, iPhone or MEATER test.
   Covers: the list of phones from the card (bbq-ha-notify-targets-v1), the default "on" for exactly one phone, no
   notification without a choice when there are two phones, every moment exactly once with the right Dutch text
   (light the kamado, put the dish on, phase target, 5 min before the target, target reached, stall, rest done,
   measurement lost), the test notification, nothing on the public website, and only the fixed time-sensitive data
   reaching callService. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const ORIGIN='https://planner.test.invalid';
function template(){
  let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
  for(const file of ['bbq-eta.js','bbq-v5.js','bbq-v501.js']){
    const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
    assert.match(html,re,'loader for '+file);
    html=html.replace(re,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
  }
  return html.replace('window.initBBQV5({','window.initBBQV5(window.__v560Bridge={');
}
// Same local formatting as the app (process time zone; CI runs in UTC).
const clock=t=>new Date(t).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
const local=(h,m)=>new Date(2026,10,16,h,m).getTime();

function boot({ha=true,start=local(15,0)}={}){
  const errors=[],sent=[];
  const parent={postMessage:(m,o)=>sent.push({m:JSON.parse(JSON.stringify(m)),o})};
  const dom=new JSDOM(template(),{url:ORIGIN+'/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      const NativeDate=w.Date;w.__testNow=start;
      w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[w.__testNow]));}static now(){return w.__testNow;}};
      w.__intervals={};w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
      w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
      w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
      w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
      // FIXTURE: the planner runs inside the HA card iframe (window.parent is the card page).
      if(ha)Object.defineProperty(w,'parent',{configurable:true,get:()=>parent});
      w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
    }});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);
  // A message from the card: same origin, source = window.parent (as the planner checks).
  const fromHA=data=>{const ev=new w.Event('message');Object.defineProperties(ev,{data:{value:data},origin:{value:ORIGIN},source:{value:w.parent}});w.dispatchEvent(ev);};
  const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]');assert.ok(el,'action '+act);assert.ok(!el.disabled,'action '+act+' enabled');el.click();if(act==='prep'){const c=$('#v5-root [data-v5-act="prep-confirm"]');if(c)c.click();}if(act==='new'){const c=$('#v5-root [data-v5-act="new-confirm"]');if(c)c.click();}};
  const addRecipe=name=>{const el=$('[data-v5-recipe="'+name+'"]');assert.ok(el,'recipe '+name);el.click();};
  const tick60=()=>{w.__intervals[60000].forEach(fn=>fn());};
  const sensor=v=>({state:String(v),last_updated:new w.Date(w.__testNow-2000).toISOString()});
  const idle=(core,ambient)=>({internal:sensor(core),ambient:sensor(ambient),target:sensor('unavailable'),status:sensor('unavailable'),
    cooking:sensor('off'),peak:sensor('unavailable'),remaining:sensor('unavailable'),elapsed:sensor('unavailable')});
  const reading=(core,ambient)=>fromHA({__bbq:'bbq-ha-sensors-v1',probes:{pro:idle(core,ambient),plus:null}});
  const requests=()=>sent.map(x=>x.m).filter(m=>m.__bbq==='bbq-notify-request-v1');
  const line=()=>($('#v5-root [data-v5-notify]')?.textContent||'').replace(/\s+/g,' ').trim();
  // Parts of the phone line: shown phone (name or select) and the on/off switch.
  const parts=()=>{const root=$('#v5-root [data-v5-notify]'),sel=root?.querySelector('[data-v5-notify-service]'),tg=root?.querySelector('[data-v5-act="notify-toggle"]');
    return {device:root?.querySelector('.v5-notify-device')?.textContent||null,options:sel?[...sel.options].map(o=>o.textContent):null,value:sel?sel.value:null,
      toggle:tg?tg.textContent:null,checked:tg?tg.getAttribute('aria-checked'):null,auto:!!root?.querySelector('.v5-notify-auto')};};
  return {dom,w,d,$,fromHA,press,addRecipe,tick60,reading,requests,line,parts,errors,sent};
}
const PHONES=[{service:'notify.mobile_app_ipad_keuken',name:'iPad in de keuken'},{service:'notify.mobile_app_jans_iphone',name:'Jan’s iPhone'}];
const ONE=[PHONES[1]];
const checkShape=reqs=>{
  for(const r of reqs){
    assert.deepEqual(Object.keys(r).filter(k=>!['__bbq','service','message','key','level'].includes(k)),[],'only fixed request fields: '+JSON.stringify(r));
    assert.ok(r.level===undefined||r.level==='time-sensitive','only the fixed level name: '+r.level);
    assert.equal(r.service,'notify.mobile_app_jans_iphone');
    assert.ok(r.message.length<=230&&r.message.length>0);
  }
};

// 1. The card: list of phones, fixed data shape, nothing else forwarded.
{
  const dom=new JSDOM('<!doctype html><body></body>',{url:ORIGIN+'/',runScripts:'dangerously',pretendToBeVisual:true});
  try{
    const w=dom.window;
    w.eval(fs.readFileSync('dist/bbq_planner_card.js','utf8').replace('import.meta.url','"'+ORIGIN+'/dist/bbq_planner_card.js"'));
    const card=w.document.createElement('bbq-planner-meater-card');
    w.document.body.appendChild(card);card.setConfig({});
    const sent=[],calls=[];
    const frame={postMessage:(m,o)=>sent.push({m:JSON.parse(JSON.stringify(m)),o})};
    card._iframe={contentWindow:frame,style:{}};
    const connection={sendMessagePromise:async()=>({value:null}),subscribeMessage:async()=>()=>{}};
    // FIXTURE hass: two phones (mobile_app_*), one other notify service, and a device registry with display names.
    const hass=()=>({states:{},connection,
      services:{notify:{mobile_app_jans_iphone:{},persistent_notification:{},mobile_app_ipad_keuken:{},'mobile_app_Bad-Name':{}},light:{turn_on:{}}},
      devices:{a:{name:'Jan’s iPhone',name_by_user:null,manufacturer:'Apple'},b:{name:'iPad keuken',name_by_user:'iPad in de keuken'},c:{name:'Thermostaat'}},
      callService:async(domain,service,data)=>{calls.push({domain,service,data:JSON.parse(JSON.stringify(data))});}});
    card.hass=hass();
    const targets=sent.filter(x=>x.m.__bbq==='bbq-ha-notify-targets-v1');
    assert.equal(targets.length,1,'one list of phones');
    assert.equal(targets[0].o,ORIGIN,'list only to the same origin');
    assert.deepEqual(targets[0].m.targets,PHONES,'only mobile_app_* services (strict pattern), sorted, with device names');
    card.hass=hass();
    assert.equal(sent.filter(x=>x.m.__bbq==='bbq-ha-notify-targets-v1').length,1,'unchanged list is not sent again');
    const ask=data=>card._onMsg({origin:ORIGIN,source:frame,data});
    ask({__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_jans_iphone',message:'Kern bereikt',key:'k1',level:'time-sensitive'});
    ask({__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_jans_iphone',message:'Stall',key:'k2'});
    // Free data from the iframe is never forwarded; an unknown level gives a normal notification.
    ask({__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_jans_iphone',message:'Probeer',key:'k3',level:'critical',
      data:{push:{'interruption-level':'critical',sound:{critical:1}}},title:'Anders'});
    // A phone that is not (or no longer) in Home Assistant, another domain and another origin are refused.
    ask({__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_oude_telefoon',message:'Weg',key:'k4'});
    ask({__bbq:'bbq-notify-request-v1',service:'notify.persistent_notification',message:'Nee',key:'k5'});
    card._onMsg({origin:'https://evil.invalid',source:frame,data:{__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_jans_iphone',message:'Nee',key:'k6'}});
    await new Promise(r=>setTimeout(r,20));
    assert.deepEqual(calls,[
      {domain:'notify',service:'mobile_app_jans_iphone',data:{title:'BBQ Regisseur',message:'Kern bereikt',data:{push:{'interruption-level':'time-sensitive'}}}},
      {domain:'notify',service:'mobile_app_jans_iphone',data:{title:'BBQ Regisseur',message:'Stall'}},
      {domain:'notify',service:'mobile_app_jans_iphone',data:{title:'BBQ Regisseur',message:'Probeer'}}
    ],'only the fixed time-sensitive data shape reaches callService');
    const results=sent.filter(x=>x.m.__bbq==='bbq-notify-result-v1').map(x=>x.m);
    assert.ok(results.some(r=>!r.ok&&/niet \(meer\) in Home Assistant/.test(r.error)),'unknown phone refused with a message');
    assert.ok(results.some(r=>!r.ok&&/Ongeldige/.test(r.error)),'other notify service refused');
    ask({__bbq:'bbq-notify-request-v1',service:'notify.mobile_app_jans_iphone',message:'Kern bereikt',key:'k1',level:'time-sensitive'});
    await new Promise(r=>setTimeout(r,20));
    assert.equal(calls.length,3,'same key is sent only once');
    // No services in hass (older frontends): an empty list, still sent once.
    sent.length=0;card._lastTargets='';card.hass={states:{},connection,callService:async()=>{}};
    assert.deepEqual(sent.filter(x=>x.m.__bbq==='bbq-ha-notify-targets-v1').map(x=>x.m.targets),[[]],'empty list without notify services');
    card.remove();
    console.log('PASS v5.6.0 card: phone list, fixed time-sensitive data, refusals, dedup');
  }finally{dom.window.close();}
}

// 2. Public website: no phone line, no automatic choice, no notification.
{
  const t=boot({ha:false});
  const {w,$,fromHA,press,addRecipe,tick60,line,errors}=t;
  try{
    assert.equal(w.parent,w,'public website: no parent card');
    // Even a same-window message cannot turn the website into a notifying HA card.
    fromHA({__bbq:'bbq-ha-notify-targets-v1',targets:ONE});
    press('new');addRecipe('Ribeye 500 g');press('setup');
    assert.equal(line(),'','no phone line in step 2 on the public website');
    assert.equal(w.__v560Bridge.getNotify().on,false,'not on without the HA card');
    assert.equal($('#v46-notify').checked,false,'Meer: not checked');
    press('prep');press('live');
    assert.equal(line(),'','no phone line on Live on the public website');
    const c=w.__v560Bridge.calculate();w.__testNow=c.fires.large+30000;tick60();
    assert.deepEqual(errors,[]);
    console.log('PASS v5.6.0 public website: no phone line and no notifications');
  }finally{t.dom.window.close();}
}

// 3. Two phones and no choice: nothing is sent; after choosing a phone it works.
{
  const t=boot();
  const {w,$,fromHA,press,addRecipe,tick60,requests,line,parts,errors}=t;
  try{
    fromHA({__bbq:'bbq-ha-notify-targets-v1',targets:[...PHONES,{service:'notify.persistent_notification',name:'x'},{service:'switch.kamado',name:'y'}]});
    assert.deepEqual(JSON.parse(JSON.stringify(w.__v560Bridge.getNotify().targets)),PHONES,'the planner keeps only valid mobile_app services');
    press('new');addRecipe('Ribeye 500 g');press('setup');
    assert.match(line(),/^📱 Meldingen op je telefoon:/,line());
    assert.deepEqual(parts().options,['Kies je telefoon','iPad in de keuken','Jan’s iPhone'],'phones by name, nothing chosen');
    assert.equal(parts().toggle,'uit');assert.equal(parts().checked,'false');assert.equal(parts().auto,false);
    assert.ok($('#v5-root [data-v5-act="notify-toggle"]').disabled,'toggle needs a phone first');
    assert.ok($('#v5-root [data-v5-act="notify-test"]').disabled,'test needs a phone first');
    const c=w.__v560Bridge.calculate(),dish=c.dishes[0];
    w.__testNow=c.fires[dish.kamado]+30000;tick60();
    assert.equal(requests().length,0,'no notification without a choice');
    const select=$('#v5-root [data-v5-notify-service]');
    select.value='notify.mobile_app_jans_iphone';select.dispatchEvent(new w.Event('change',{bubbles:true}));
    const stored=JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1'));
    assert.equal(stored.v46Notify,true);assert.equal(stored.v46NotifyService,'notify.mobile_app_jans_iphone','choice in the existing settings');
    assert.equal(parts().value,'notify.mobile_app_jans_iphone');assert.equal(parts().toggle,'aan');
    tick60();
    assert.equal(requests().length,1,'notification after the choice');
    assert.match(requests()[0].message,/^Steek nu de grote kamado aan/);
    checkShape(requests());
    assert.deepEqual(errors,[]);
    console.log('PASS v5.6.0 two phones: nothing without a choice, then on for the chosen phone');
  }finally{t.dom.window.close();}
}

// 4. One phone: on by default (visible), toggle, test notification, and every moment exactly once.
{
  const t=boot();
  const {w,$,fromHA,press,addRecipe,tick60,reading,requests,line,parts,errors}=t;
  try{
    fromHA({__bbq:'bbq-ha-notify-targets-v1',targets:ONE});
    press('new');addRecipe('Ribeye 500 g');press('setup');
    assert.deepEqual([parts().device,parts().toggle,parts().checked,parts().auto],['Jan’s iPhone','aan','true',true],line());
    assert.match(line(),/Automatisch aan: dit is de enige telefoon in Home Assistant/,line());
    assert.match(line(),/Alleen zolang de planner open is in de Home Assistant-app/,'limitation shown at the setting');
    assert.equal(w.__v560Bridge.getNotify().auto,true);
    assert.equal(JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1')).v46Notify,undefined,'the default is not written to storage');
    assert.equal($('#v46-notify').checked,true,'Meer shows the same choice');
    // Off and on again: an explicit choice, stored in the existing fields.
    press('notify-toggle');
    assert.deepEqual([parts().device,parts().toggle,parts().auto],['Jan’s iPhone','uit',false],line());
    assert.equal(JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1')).v46Notify,false);
    press('notify-toggle');
    let stored=JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1'));
    assert.equal(stored.v46Notify,true);assert.equal(stored.v46NotifyService,'notify.mobile_app_jans_iphone');
    // Test notification.
    press('notify-test');
    assert.equal(requests().length,1);
    assert.equal(requests()[0].message,'Testmelding van de BBQ-planner: meldingen komen aan op deze telefoon.');
    assert.match(requests()[0].key,/^test\|\d+$/);assert.equal(requests()[0].level,'time-sensitive');
    fromHA({__bbq:'bbq-notify-result-v1',ok:true,error:''});
    assert.match(line(),/HA-melding verzonden\./,'result shown at the setting');
    w.__testNow+=1000;press('notify-test');
    assert.equal(requests().length,2,'every press is a new test');
    press('prep');press('live');
    assert.deepEqual([parts().device,parts().toggle],['Jan’s iPhone','aan'],'the same line on Live: '+line());

    const s=w.__v560Bridge.getState(),ribeye=s.dishes[0],c=w.__v560Bridge.calculate(),plan=c.dishes[0];
    const kam=plan.kamado==='small'?'kleine':'grote',fire=c.fires[plan.kamado];
    const moment=key=>requests().filter(r=>r.key===s.date+'|'+(key==='fire'?plan.kamado:ribeye.id)+'|'+key);
    // Light the kamado: not before, once at the planned time, not again.
    w.__testNow=fire-60000;tick60();assert.equal(moment('fire').length,0,'not before the planned time');
    w.__testNow=fire+30000;tick60();tick60();
    assert.equal(moment('fire').length,1,'fire once');
    assert.equal(moment('fire')[0].message,'Steek nu de '+kam+' kamado aan (Ribeye 500 g om '+clock(plan.start)+' erop)');
    // Put the dish on.
    w.__testNow=plan.start+10000;tick60();tick60();
    assert.equal(moment('on').length,1,'on once');
    assert.equal(moment('on')[0].message,'Leg Ribeye 500 g nu op de '+kam+' kamado (gepland '+clock(plan.start)+')');
    reading('9.5','14');
    $('[data-v5-dishcard="'+ribeye.id+'"] [data-v5-act="phase:'+ribeye.id+':cooking"]').click();
    // Readings every 30 s (Newton, 121 °C): phase target 47 °C, 5 min before 54 °C, 54 °C reached.
    const K=Math.log((121-9.5)/(121-45.5))/40,coreAt=m=>121-(121-9.5)*Math.exp(-K*m);
    const order=[];const seen=new Set();
    for(let i=1;i<=120;i++){
      w.__testNow+=30000;const core=coreAt(i/2);reading(core.toFixed(1),121);
      if(i%2===0)tick60();
      for(const r of requests())if(!seen.has(r.key)){seen.add(r.key);order.push(r.key.split('|').pop()+'@'+core.toFixed(1));}
      if(core>=55)break;
    }
    assert.equal(w.__v560Bridge.getState().dishes[0].meater,'pro','measuring MEATER linked automatically');
    assert.equal(moment('phase').length,1,'phase target once: '+order);
    assert.equal(moment('phase')[0].message,'Ribeye 500 g 47 °C — stook op naar ~'+(Number(ribeye.phase2Temp)||250)+' °C');
    assert.equal(moment('pre5').length,1,'5 min before the target once');
    assert.match(moment('pre5')[0].message,/^Ribeye 500 g: nog ±[1-5] min tot 54 °C \(eigen schatting\)$/,moment('pre5')[0].message);
    assert.equal(moment('core').length,1,'target reached once');
    assert.equal(moment('core')[0].message,'Ribeye 500 g 54 °C bereikt — haal van de BBQ en controleer de gaarheid');
    const pos=k=>order.findIndex(x=>x.startsWith(k+'@'));
    assert.ok(pos('phase')>=0&&pos('phase')<pos('pre5')&&pos('pre5')<pos('core'),'order phase → 5 min before → reached: '+order);
    assert.ok(Number(order[pos('phase')].split('@')[1])<51,'phase message near 47 °C: '+order);
    // Measurement lost while the dish is on the grill: only after 3 minutes, once.
    reading('unavailable','unavailable');
    w.__testNow+=2*60000;tick60();assert.equal(moment('lost').length,0,'not before 3 minutes');
    w.__testNow+=70000;tick60();tick60();
    assert.equal(moment('lost').length,1,'lost once after 3 minutes');
    assert.equal(moment('lost')[0].message,'Ribeye 500 g: de meting is weg (MEATER Pro geeft al 3 min niets door) — controleer de probe');
    // Rest done.
    $('[data-v5-dishcard="'+ribeye.id+'"] [data-v5-act="phase:'+ribeye.id+':resting"]').click();
    w.__testNow+=7*60000;tick60();assert.equal(moment('serve').length,0,'not before the rest is over');
    w.__testNow+=70000;tick60();tick60();
    assert.equal(moment('serve').length,1,'rest done once');
    assert.equal(moment('serve')[0].message,'Ribeye 500 g: rusttijd voorbij — serveren');
    // Every key at most once; time-critical moments carry the fixed level.
    const keys=requests().map(r=>r.key);
    assert.equal(new Set(keys).size,keys.length,'no duplicate notification: '+keys);
    for(const k of ['fire','on','phase','pre5','core','lost','serve'])assert.equal(moment(k)[0].level,'time-sensitive',k+' is time-sensitive');
    checkShape(requests());
    // Reload with the same storage: already sent moments are not sent again (existing dedup in v46AlertSent).
    stored=JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1'));
    for(const k of ['fire','on','phase','pre5','core','lost','serve'])assert.ok(stored.v46AlertSent[s.date+'|'+(k==='fire'?plan.kamado:ribeye.id)+'|'+k],k+' remembered');
    assert.deepEqual(errors,[]);
    console.log('PASS v5.6.0 one phone: default on, toggle, test, fire/on/phase/5 min/reached/lost/rest exactly once: '+order.join(', '));
  }finally{t.dom.window.close();}
}

// 5. Stall on a pork shoulder: one notification.
{
  const t=boot({start:local(8,0)});
  const {w,$,fromHA,press,addRecipe,reading,requests,errors}=t;
  try{
    fromHA({__bbq:'bbq-ha-notify-targets-v1',targets:ONE});
    press('new');addRecipe('Pulled pork op brood');press('setup');press('prep');press('live');
    reading('5','20');
    const pork=w.__v560Bridge.getState().dishes[0];
    $('[data-v5-dishcard="'+pork.id+'"] [data-v5-act="phase:'+pork.id+':cooking"]').click();
    let m=0,c=5;
    while(c<70){w.__testNow+=30000;m+=0.5;c=120-(120-5)*Math.exp(-0.012*m);reading(c.toFixed(1),120);}
    for(let i=1;i<=50;i++){w.__testNow+=30000;reading((70+i/180).toFixed(1),119);}
    assert.equal(w.__v560Bridge.getEstimate(pork).state,'stall');
    const stall=requests().filter(r=>r.key.endsWith('|'+pork.id+'|stall'));
    assert.equal(stall.length,1,'stall once');
    assert.match(stall[0].message,/^Pulled pork op brood: stall rond 70 °C sinds \d\d:\d\d — de kern staat even stil$/,stall[0].message);
    assert.equal(stall[0].level,undefined,'stall is a normal notification');
    checkShape(requests());
    assert.deepEqual(errors,[]);
    console.log('PASS v5.6.0 stall: one notification');
  }finally{t.dom.window.close();}
}
console.log('OK v5.6.0 notifications (FIXTURES; no real Home Assistant, Companion app, iPhone or MEATER)');
