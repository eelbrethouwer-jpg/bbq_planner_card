/* v5.2.2: fake Home Assistant telemetry, not a real MEATER/iPhone/HA test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
assert.match(html,/window\.dispatchEvent\(new Event\('bbq-meater-updated'\)\)/);
for(const file of ['bbq-v5.js','bbq-v501.js']){
  const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
  assert.match(html,re,'loader for '+file);
  html=html.replace(re,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
}
const anchor='const meaterData={pro:null,plus:null};';
assert.ok(html.includes(anchor),'meater state anchor');
const injected=[
  'window.__v522AssignMeater=probe=>{state.dishes[0].meater=probe;};',
  'window.__v522FakeHaReading=(probe,reading)=>{meaterBridgeSeen=true;meaterData[probe]=reading;window.dispatchEvent(new Event("bbq-meater-updated"));};'
].join('\n');
html=html.replace(anchor,anchor+'\n'+injected);
const errors=[];
const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',
 pretendToBeVisual:true,beforeParse(w){
  const NativeDate=w.Date;w.__testNow=Date.parse('2026-11-09T17:00:00Z');
  w.Date=class extends NativeDate{
    constructor(...args){super(...(args.length?args:[w.__testNow]));}
    static now(){return w.__testNow;}
  };
  w.__intervals={};w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
  w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
}});
try{
 const w=dom.window,d=w.document,$=s=>d.querySelector(s);
 const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]');assert.ok(el,act);el.click();};
 assert.equal($('#v5-root').dataset.screen,'home');
 press('new');
 const recipe=$('[data-v5-recipe="Pulled pork op brood"]');assert.ok(recipe);recipe.click();
 w.__v522AssignMeater('pro');press('setup');press('prep');press('live');
 const root=$('#v5-root .v5-content'),kamado=$('[data-v5-live-kamado="large"]'),dish=$('[data-v5-live-dish]');
 assert.ok(root&&kamado&&dish);
 assert.ok(!kamado.textContent.includes('● LIVE'),'no fictitious live data without Home Assistant');
 const saved=w.localStorage.getItem('kamado-bereidingsplanner-v1');
 const stamp=new Date(w.__testNow-2000).toISOString();
 const reading=core=>({internal:{state:String(core),last_updated:stamp},ambient:{state:'120.4',last_updated:stamp}});
 w.__v522FakeHaReading('pro',reading(54.2));
 assert.match(kamado.textContent,/54.2 °C/,'immediate kamado update');
 assert.match(dish.textContent,/54.2 °C/,'immediate dish update');
 assert.match(kamado.textContent,/LIVE · HA-update 2 s geleden/,'age from HA timestamp');
 assert.equal($('#v5-root .v5-content'),root,'no full DOM rebuild on sensor event');
 w.__v522FakeHaReading('pro',reading(54.8));
 assert.match(kamado.textContent,/54.8 °C/,'new real value replaces previous');
 assert.equal($('#v5-root .v5-content'),root,'DOM preserved');
 assert.ok(Array.isArray(w.__intervals[1000])&&w.__intervals[1000].length===1,'single display timer');
 w.__testNow+=1000;w.__intervals[1000][0]();
 assert.match(kamado.textContent,/HA-update 3 s geleden/,'age tick updates');
 assert.match(kamado.textContent,/54.8 °C/,'tick does not invent core data');
 w.__testNow+=65000;w.__intervals[1000][0]();
 assert.match(kamado.textContent,/Vertraagd · HA-update 1 min 8 s geleden/,'old value labelled');
 w.__testNow+=240000;w.__intervals[1000][0]();
 assert.ok(!kamado.textContent.includes('54.8 °C'),'expired core hidden');
 assert.match(kamado.textContent,/Geen verse live MEATER-meting/,'existing cutoff enforced');
 assert.equal($('#v5-root .v5-content'),root,'stale update does not rebuild');
 assert.equal(w.localStorage.getItem('kamado-bereidingsplanner-v1'),saved,'no telemetry writes to storage');
 assert.deepEqual(errors,[],'no runtime errors');
 console.log('PASS v5.2.2 MEATER Live: instant HA update, age ticks, stale cutoff, no persisted changes');
}finally{dom.window.close();}
