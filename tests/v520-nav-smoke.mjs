/* v5.2 review M1/L1: the back button always names its real destination and the bottom navigation
   matches the open screen. Real v4 engine + v5 layer in jsdom; no production test hook.
   Not a physical iPhone, Home Assistant or MEATER test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>fs.readFileSync(p,'utf8');
let html=read('dist/BBQ_bereidingsplanner_MEATER_v4.html');
for(const file of ['bbq-v5.js','bbq-v501.js'])html=html.replace(new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>'),()=>'<script>'+read('dist/'+file)+'</script>');
const errors=[];
const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 let y=0;Object.defineProperty(w,'scrollY',{get:()=>y});w.scrollTo=(x,next)=>{y=typeof x==='object'?x.top:next};
 w.Element.prototype.scrollIntoView=function(){};
 w.setInterval=()=>0;
 w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const screen=()=>$('v5-root').dataset.screen;
const legacy=()=>d.body.classList.contains('v5-legacy');
const active=()=>d.querySelector('#v5-nav [aria-current=page]')?.dataset.v5Act;
const back=()=>$('v5-back');
const backShown=()=>back().style.display!=='none'&&back().style.display!=='';
const page=id=>{const el=$(id);assert.ok(el,id);return !el.hidden&&!el.closest('[hidden]')};
const press=a=>{const el=$('v5-root').querySelector('[data-v5-act="'+a+'"]');assert.ok(el,'action '+a);el.click()};
const tab=a=>{const el=d.querySelector('#v5-nav [data-v5-act="'+a+'"]');assert.ok(el,'nav '+a);el.click()};
const openMeaterFromMore=()=>{const fold=$('v520-meater-fold');assert.ok(fold,'MEATER fold in Meer');fold.open=true;$('v520-open-cooking').click()};
const expectLegacy=(pageId,label,nav,msg)=>{
 assert.ok(legacy(),msg+': legacy open');assert.ok(page(pageId),msg+': '+pageId+' visible');
 assert.equal(back().textContent,label,msg+': back label');assert.ok(backShown(),msg+': back visible');
 assert.equal(active(),nav,msg+': bottom navigation');
};
const expectV5=(name,nav,msg)=>{
 assert.ok(!legacy(),msg+': legacy closed');assert.equal(screen(),name,msg+': screen');
 assert.ok(!backShown(),msg+': back hidden');if(nav)assert.equal(active(),nav,msg+': bottom navigation');
};
const meaterReachable=msg=>{
 const cooking=$('v47-cooking'),meater=$('live-panel'),fullscreen=$('v47-fullscreen');
 assert.ok(cooking.contains(meater)&&!meater.closest('[hidden]'),msg+': MEATER panel visible');
 assert.ok(cooking.contains(fullscreen)&&!fullscreen.closest('[hidden]'),msg+': focus trigger visible');
 fullscreen.click();assert.ok($('v45-cook-screen').classList.contains('open'),msg+': focus mode opens');
 $('v45-close').click();assert.ok(!$('v45-cook-screen').classList.contains('open'),msg+': focus mode closes');
};
try{
 const keysBefore=Object.keys(w.localStorage).sort();
 // L1: the Vandaag list has no list role without list items; rows stay buttons.
 expectV5('home','home','start');
 const list=$('v5-root').querySelector('.v5-list');
 assert.ok(list,'Vandaag list present');assert.equal(list.getAttribute('role'),null,'no role=list without listitems');
 assert.equal($('v5-root').querySelectorAll('[role=list],[role=listitem]').length,0);
 assert.ok([...list.querySelectorAll('.v5-list-row')].every(el=>el.tagName==='BUTTON'&&el.dataset.v5Act),'rows remain buttons with actions');

 // Vandaag → legacy → ← Vandaag.
 press('recipes');expectLegacy('v47-recipes','← Vandaag','recipes','Vandaag → Recepten');
 back().click();expectV5('home','home','← Vandaag from Recepten');
 press('history');expectLegacy('v47-more','← Vandaag','more','Vandaag → Historie');
 assert.equal($('v520-app-version')?.textContent,'Versie van deze app: v5.2.2','App en info shows loaded app version');
 assert.equal($('v520-app-version')?.parentElement?.id,'v520-more-app','version located in App en info');
 back().click();expectV5('home','home','← Vandaag from Historie');

 // Session flow: the back label names the real step, not Vandaag.
 press('new');
 for(const name of ['Pulled pork op brood','Krieltjes']){const el=[...d.querySelectorAll('[data-v5-recipe]')].find(e=>e.dataset.v5Recipe===name);assert.ok(el,name);el.click()}
 press('setup');assert.equal(screen(),'setup');
 press('planning');assert.ok(page('v47-planning'));assert.equal(back().textContent,'← Plan de BBQ-dag','planning from setup');
 back().click();expectV5('setup',null,'back to setup');

 // Live → MEATER → ← Live (existing route unchanged).
 press('prep');press('live');expectV5('live','live','Live');
 press('cooking');expectLegacy('v47-cooking','← Live','live','Live → MEATER');meaterReachable('Live → MEATER');
 back().click();expectV5('live','live','← Live from MEATER');

 // Live → Meer → MEATER → ← Meer → ← Live.
 tab('more');expectLegacy('v47-more','← Live','more','Live → Meer');
 openMeaterFromMore();expectLegacy('v47-cooking','← Meer','more','Live → Meer → MEATER');meaterReachable('Meer → MEATER');
 back().click();expectLegacy('v47-more','← Live','more','← Meer');
 back().click();expectV5('live','live','← Live from Meer');

 // Vandaag → Meer → MEATER → ← Meer → ← Vandaag (the reviewed bug).
 tab('home');expectV5('home','home','Vandaag');
 tab('more');expectLegacy('v47-more','← Vandaag','more','Vandaag → Meer');
 openMeaterFromMore();expectLegacy('v47-cooking','← Meer','more','Vandaag → Meer → MEATER');
 back().click();expectLegacy('v47-more','← Vandaag','more','← Meer from Vandaag route');
 back().click();expectV5('home','home','← Vandaag from Meer');

 // Bottom navigation from the nested MEATER step clears the in-memory return step.
 tab('more');openMeaterFromMore();tab('recipes');expectLegacy('v47-recipes','← Vandaag','recipes','nav switch from MEATER');
 back().click();expectV5('home','home','back after nav switch');
 tab('more');openMeaterFromMore();tab('live');expectV5('live','live','nav Live from MEATER');
 press('cooking');assert.equal(back().textContent,'← Live','Live → MEATER after nested route');back().click();expectV5('live','live','still back to Live');

 // No new storage keys: the return step lives only in memory.
 const keysAfter=Object.keys(w.localStorage).sort();
 const allowed=new Set([...keysBefore,'kamado-bereidingsplanner-v1','bbq-v5-session-v1','bbq-v5-previous-plan-v1','bbq-v47-tab','bbq-v47-expanded-v1','bbq-v501-recipe-tab-v1','kamado-recipe-book-v1','kamado-reviews-v1','kamado-recipe-deletions-v1']);
 assert.ok(keysAfter.every(k=>allowed.has(k)),'no new storage keys: '+keysAfter);
 assert.ok(!Object.values({...w.localStorage}).some(v=>/legacyReturn|"returnTo"/.test(String(v))),'return step not persisted');
 assert.equal(d.querySelectorAll('nav').length,2,'no extra navigation element');
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS v5.2 navigation smoke (back destination, bottom nav, MEATER/focus reachability, list semantics)');
}finally{w.close()}
