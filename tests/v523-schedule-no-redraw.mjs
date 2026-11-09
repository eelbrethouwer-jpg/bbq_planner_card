/* v5.2.3 regression: a 30s Live schedule refresh patches text only, never reconstructs the page.
   Uses a synthetic time/task fixture; not a real HA, MEATER or physical iPhone test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
for(const file of ['bbq-v5.js','bbq-v501.js']){
  const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
  assert.match(html,re);
  html=html.replace(re,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
}
html=html.replace('window.initBBQV5({','window.initBBQV5(window.__v523Bridge={');
const errors=[];
const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',
 runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  const NativeDate=w.Date;
  w.__testNow=Date.parse('2026-11-09T17:00:00Z');
  w.Date=class extends NativeDate {
    constructor(...args){super(...(args.length?args:[w.__testNow]));}
    static now(){return w.__testNow;}
  };
  w.__intervals={};
  w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
  w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
 }});
try{
 const w=dom.window,d=w.document,$=selector=>d.querySelector(selector);
 const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]');assert.ok(el,act);el.click();};
 press('new');
 const recipe=$('[data-v5-recipe="Pulled pork op brood"]');assert.ok(recipe);recipe.click();
 press('setup');press('prep');press('live');
 const bridge=w.__v523Bridge,root=$('#v5-root .v5-content');
 assert.ok(bridge&&root,'real v5 running');
 const hero=$('.v5-hero[data-v5-hero-task]'),bar=$('.v5-live-bar strong');
 assert.ok(hero&&bar,'task and countdown');
 assert.equal(w.__intervals[30000]?.length,1,'single schedule-only timer');
 const firstTask=hero.dataset.v5HeroTask,time=w.__testNow+11*60000,serve=w.__testNow+15*60000;
 const originalCalculate=bridge.calculate;
 bridge.calculate=()=>({...originalCalculate(),serve});
 bridge.getTasks=()=>[{id:firstTask,time,k:'large'}];
 const prior=w.localStorage.getItem('kamado-bereidingsplanner-v1');
 const details=$('[data-v5-dish]');assert.ok(details);details.open=true;
 const stage=details.querySelector('details');if(stage)stage.open=true;
 const tick=()=>w.__intervals[30000][0]();
 tick();
 assert.match(bar.textContent,/nog 0 u 15 min/,'countdown updates');
 assert.equal(hero.querySelector('.v5-nowtag').textContent,'⏱️ HIERNA','upcoming task label');
 assert.equal($('#v5-root .v5-content'),root,'no whole-page replacement');
 assert.equal($('.v5-hero'),hero,'hero not replaced');
 assert.equal(details.open,true,'dish stays open');
 if(stage)assert.equal(stage.open,true,'step stays open');
 w.__testNow+=2*60000;
 tick();
 assert.match(bar.textContent,/nog 0 u 13 min/,'countdown changes as time passes');
 assert.equal(hero.querySelector('.v5-nowtag').textContent,'🔥 NU DOEN','task becomes due without reload');
 assert.equal($('#v5-root .v5-content'),root,'30-second refresh does not reconstruct DOM');
 assert.equal(w.localStorage.getItem('kamado-bereidingsplanner-v1'),prior,'no state/storage writes');
 assert.deepEqual(errors,[],'no JS runtime exceptions');
 console.log('PASS v5.2.3: clock updates only text, due-status transition, details retained, no DOM redraw or storage changes');
}finally{dom.window.close();}
