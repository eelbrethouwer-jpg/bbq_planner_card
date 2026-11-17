/* v5.1.1 regressions over v5.1.0 using the real v4 engine and synthetic DOM/timers.
   No physical Safari, PWA update or live HA claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>fs.readFileSync(p,'utf8');
let html=read('dist/BBQ_bereidingsplanner_MEATER_v4.html');
for(const file of ['bbq-v5.js','bbq-v501.js'])html=html.replace(new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>'),()=>'<script>'+read('dist/'+file)+'</script>');
// Capture the existing read-only bridge for probes; never add a production test hook.
html=html.replace('window.initBBQV5({','window.initBBQV5(window.__bridge={');
const errors=[],intervals=[];
const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 let y=0;Object.defineProperty(w,'scrollY',{get:()=>y});w.scrollTo=(x,next)=>{y=typeof x==='object'?x.top:next};
 w.Element.prototype.scrollIntoView=function(){w.__scrolledDish=this.dataset.v5Dish};
 w.setInterval=(fn,delay)=>{intervals.push({fn,delay});return intervals.length};
 w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
}});
const w=dom.window,d=w.document,root=()=>d.getElementById('v5-root'),bridge=()=>w.__bridge;
const press=a=>{const el=d.querySelector('[data-v5-act="'+a+'"]');assert.ok(el,'action '+a);el.click();if(a==='prep'){const c=d.querySelector('[data-v5-act="prep-confirm"]');if(c)c.click()}};
const clickRecipe=name=>{const el=[...d.querySelectorAll('[data-v5-recipe]')].find(e=>e.dataset.v5Recipe===name);assert.ok(el,name);el.click()};
const change=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}))};
const visible=el=>!el.hidden&&!el.closest('[hidden]')&&!(el.id==='v47-nav'&&d.body.classList.contains('v5-ready'));
function navigation(active){
 assert.equal(d.querySelectorAll('nav').length,2,'only new and retained hidden legacy nav exist');
 assert.equal([...d.querySelectorAll('nav')].filter(visible).length,1);
 assert.equal(d.querySelector('#v5-nav [aria-current=page]')?.dataset.v5Act,active);
 assert.equal(d.getElementById('v5-nav').parentElement,root().parentElement,'nav is a sibling');
 assert.doesNotMatch(d.getElementById('v5-nav').textContent,/v5/i);
 assert.doesNotMatch(root().querySelector('.v5-top').textContent,/v5/i);
}
try{
 navigation('home');press('new');
 for(const name of ['Pulled pork op brood','Krieltjes','Warmgerookte zalm op brioche'])clickRecipe(name);
 assert.ok(d.querySelectorAll('[data-v5-recipe]').length>=6);
 for(const card of d.querySelectorAll('[data-v5-recipe]'))assert.equal(card.querySelectorAll('.v5-origin').length,1);
 assert.ok([...d.querySelectorAll('.v5-origin')].every(e=>['Eigen','Voorbeeld'].includes(e.textContent)));
 const before=JSON.stringify(bridge().getRecipes());
 d.querySelector('[data-v5-filter="own"]').click();assert.ok([...d.querySelectorAll('.v5-origin')].every(e=>e.textContent==='Eigen'));
 d.querySelector('[data-v5-filter="example"]').click();assert.ok(d.querySelectorAll('[data-v5-recipe]').length>=6);
 assert.equal(JSON.stringify(bridge().getRecipes()),before,'origin filtering is read-only');
 press('setup');press('planning');navigation('home');
 // v5.2 review M1: the back label names the real destination (the setup step), not Vandaag.
 assert.equal(d.getElementById('v5-back').textContent,'← Plan de BBQ-dag');
 d.getElementById('v5-back').click();assert.equal(root().dataset.screen,'setup','back returns to the setup step');press('prep');press('live');navigation('live');
 const live=root().querySelector('.v5-content');
 assert.ok([...live.children].indexOf(live.querySelector('.v5-hero'))<[...live.children].indexOf(live.querySelector('.v5-dishcards')),'v5.3: hero above the dish cards');
 press('cooking');navigation('live');
 assert.equal(d.getElementById('v5-back').textContent,'← Live');
 const cooking=d.getElementById('v47-cooking'),meater=d.getElementById('live-panel'),fullscreen=d.getElementById('v47-fullscreen');
 assert.equal(cooking.hidden,false,'legacy cooking reached from Live');
 assert.ok(cooking.contains(meater)&&!meater.closest('[hidden]'),'MEATER panel visible in legacy cooking');
 assert.ok(cooking.contains(fullscreen)&&!fullscreen.closest('[hidden]'),'focus trigger visible in legacy cooking');
 d.getElementById('v5-back').click();navigation('live');
 const task=d.querySelector('.v5-hero [data-v5-act^="done:"]').dataset.v5Act.slice(5);
 assert.ok(![...d.querySelectorAll('.v5-next-tasks [data-v5-check]')].some(e=>e.dataset.v5Check===task),'hero excluded from following tasks');
 // v5.2: Live shows at most three following tasks; the rest stays one tap away.
 assert.ok(d.querySelectorAll('.v5-next-tasks [data-v5-check]').length<=3);
 if(d.querySelector('[data-v5-act="show-tasks"]')){press('show-tasks');assert.ok(d.querySelectorAll('.v5-next-tasks [data-v5-check]').length>3);press('show-tasks')}
 const details=[...root().querySelectorAll('details')];
 assert.ok(details.every(e=>e.dataset.v5Key));assert.equal(new Set(details.map(e=>e.dataset.v5Key)).size,details.length);
 const dish=details.find(e=>e.dataset.v5Dish);dish.open=true;const stage=dish.querySelector('details');stage.open=true;
 const key=stage.dataset.v5Key;w.scrollTo(0,640);
 const beforeTick=root().querySelector('.v5-content');
 intervals.filter(i=>i.delay===30000).forEach(i=>i.fn());
 assert.equal(root().querySelector('.v5-content'),beforeTick,'30s status refresh preserves DOM');
 assert.ok([...root().querySelectorAll('details')].find(e=>e.dataset.v5Key===key).open);assert.equal(w.scrollY,640);
 d.dispatchEvent(new w.Event('visibilitychange'));assert.equal(w.scrollY,640);
 assert.ok([...root().querySelectorAll('details')].find(e=>e.dataset.v5Key===key).open);
 const originalTasks=bridge().getTasks,originalCalculate=bridge().calculate,originalProbe=bridge().getProbe;
 const dishes=bridge().getState().dishes;
 // Distinct IDs with identical names catch the old textContent-selection bug.
 dishes[1].name=dishes[0].name;
 const render=()=>d.dispatchEvent(new w.Event('visibilitychange')); // force full rendering only for synthetic test-state changes
 const day=bridge().getState().date;
 const noon=new Date();noon.setHours(12,0,0,0);
 const tomorrow=new Date(noon);tomorrow.setDate(tomorrow.getDate()+1);
 const todayClock=noon.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
 const futureLabel=tomorrow.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})+' '+tomorrow.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
 bridge().getTasks=()=>[
   {id:day+'|today:on',time:noon.getTime(),title:'Vandaagtaak',k:'large'},
   {id:day+'|tomorrow:on',time:tomorrow.getTime(),title:'Morgentaak',k:'small'}
 ];
 render();
 assert.equal(root().querySelector('.v5-hero .v5-between span:last-child').textContent,todayClock,'today hero only clock');
 assert.ok(root().querySelector('.v5-next-tasks').textContent.includes(futureLabel),'next-day task includes date and clock');
 bridge().getTasks=()=>[{id:day+'|tomorrow:on',time:tomorrow.getTime(),title:'Morgentaak',k:'large'}];
 render();
 assert.equal(root().querySelector('.v5-hero .v5-between span:last-child').textContent,futureLabel,'next-day hero includes date and clock');
 for(const suffix of ['on','off','serve']){
  bridge().getTasks=()=>[{id:day+'|'+dishes[1].id+':'+suffix,time:Date.now()+1000,title:'Test taak',k:'large'}];render();press('recipe-in-live');assert.equal(w.__scrolledDish,dishes[1].id);
 }
 bridge().getTasks=()=>[{id:day+'|large:fire',time:Date.now(),title:'Aansteektaak',k:'large'}];
 bridge().calculate=()=>({...originalCalculate(),dishes:[{...dishes[0],kamado:'large',start:200},{...dishes[1],kamado:'large',start:100}]});render();press('recipe-in-live');assert.equal(w.__scrolledDish,dishes[1].id);
 press('dish:'+dishes[0].id);assert.equal(w.__scrolledDish,dishes[0].id);
 // v5.5: the public website no longer links a probe by default (review PR #43, finding 3); fixture: probe chosen for dish 1.
 bridge().getState().dishes[0].meater='pro';
 bridge().getProbe=()=>({ok:false,note:'Geen verse live MEATER-meting (maximaal vijf minuten oud)'});render();
 // v5.3: one card per dish; a dish with a probe but without a fresh reading shows dashes, never a value.
 const probeCards=()=>[...root().querySelectorAll('[data-v5-dishcard]')].filter(card=>/MEATER (Pro|Plus)/.test(card.querySelector('.v5-dc-title').textContent));
 assert.ok(probeCards().length>=1,'probe linked to the first dish');
 for(const card of probeCards()){const core=card.querySelector('[data-v5-slot="core"]');assert.match(core.textContent,/— °C/);assert.match(core.textContent,/maximaal vijf minuten oud/)}
 bridge().getProbe=()=>({ok:true,core:51.2,ambient:115,updatedAt:Date.now()});render();assert.match(probeCards()[0].querySelector('[data-v5-slot="core"]').textContent,/51,2 °C[\s\S]*● LIVE · HA-update/);
 const originalKamados=dishes.map(d=>d.kamado);dishes.forEach(d=>d.kamado='large');render();
 // v5.3 replaces the per-kamado tiles: all dishes on one kamado still each get their own card.
 assert.equal(root().querySelectorAll('[data-v5-dishcard]').length,dishes.length,'one card per dish, also on one kamado');
 assert.doesNotMatch(root().querySelector('.v5-dishcards').textContent,/Niet in gebruik/);
 dishes.forEach((d,i)=>d.kamado=originalKamados[i]);
 bridge().getTasks=originalTasks;bridge().calculate=originalCalculate;bridge().getProbe=originalProbe;render();
 const done=d.querySelector('.v5-hero [data-v5-act^="done:"]');done.click();
 assert.ok([...root().querySelectorAll('details')].find(e=>e.dataset.v5Key===key).open,'commit render retains open recipe step');
 assert.match(root().querySelector('[data-v5-key="completed"]').textContent,/Gepland \d\d:\d\d · gedaan \d\d:\d\d/);
 press('recipes');navigation('recipes');assert.equal(d.getElementById('v5-back').textContent,'← Live');
 press('more');navigation('more');press('home');navigation('home');press('resume');press('planning');navigation('live');assert.equal(d.getElementById('v5-back').textContent,'← Live');
 d.getElementById('v5-back').click();press('live');navigation('live');
 const storageKeys=Object.keys(w.localStorage).sort();
 const allowed=['kamado-bereidingsplanner-v1','bbq-v5-session-v1','bbq-v5-previous-plan-v1','bbq-v501-recipe-tab-v1','bbq-v47-tab','kamado-reviews-v1'];
 assert.ok(storageKeys.every(k=>allowed.includes(k)),'no new storage keys: '+storageKeys);
 const saved=JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1'));
 assert.deepEqual(Object.keys(saved).sort(),['availableFrom','date','dateMode','dishes','equipment','mealTime','preheatLarge','preheatSmall','smart','v46Done','v46MultiServe','v5Actual'],'v5.0.3 serialized plan schema');
 assert.deepEqual(Object.keys(saved.dishes[0]).sort(),['category','coachStep','cook','core','doneAt','fixedStart','grate','grate2','grill','id','kamado','meater','method','mode','name','notes','phase','phase2Minutes','phase2Temp','photo','prepTasks','recipeCook','recipeIngredients','recipePrep','recipeRest','recipeSlice','recipeSource','recipeSteps','rest','restAt','serveSlot','startedAt','transitionMins','v46BasePeople','v46TimerEndsAt'],'v5.0.3 serialized dish schema');
 assert.equal(typeof saved,'object');assert.ok(Array.isArray(saved.dishes));assert.equal(typeof saved.v46Done,'object');assert.equal(typeof saved.v5Actual,'object');
 // v5.5: optional field `view` (last screen of an active session, bug "terug naar het eerste scherm"); the rest is unchanged.
 assert.deepEqual(Object.keys(JSON.parse(w.localStorage.getItem('bbq-v5-session-v1'))).filter(k=>k!=='view').sort(),['active','created','stage','version']);
 assert.equal(typeof JSON.parse(w.localStorage.getItem('bbq-v5-session-v1')).view.screen,'string','view saved while navigating');
 assert.deepEqual(errors,[]);console.log('OK v5.1.1: cooking access, dates, unused kamado, single nav, live order, render retention, exact recipe IDs, fresh/stale probes, origin badges, unchanged storage keys');
}finally{w.close()}
