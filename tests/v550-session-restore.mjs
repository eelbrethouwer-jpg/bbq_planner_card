/* v5.5.0 user bugs (jsdom). FIXTURES ONLY: fake clock, no Home Assistant, MEATER or physical iPhone.
   Bug 2: after switching apps the HA app reloads the card/iframe and the planner started on Vandaag again. An active
          session now reopens on the last screen (optional field `view` in bbq-v5-session-v1, within 12 hours).
          "Reload" = a new document with exactly the same localStorage.
   Bug 1: in step 1 a tap on a chosen recipe removes it again (last added portion); "+1" in "Jouw menu" adds a portion;
          a dish that has started is never removed by a tap. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

let template=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
for(const file of ['bbq-eta.js','bbq-v5.js','bbq-v501.js']){
  const re=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
  assert.match(template,re,'loader for '+file);
  template=template.replace(re,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
}
template=template.replace('window.initBBQV5({','window.initBBQV5(window.__v550Bridge={');
const START=Date.parse('2026-11-16T15:55:00Z');
const SESSION='bbq-v5-session-v1',PLAN='kamado-bereidingsplanner-v1';

function boot(storage={},now=START){
  const errors=[],alerts=[];
  const dom=new JSDOM(template,{url:'https://planner.test.invalid/dist/planner.html',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
      const NativeDate=w.Date;w.__testNow=now;
      w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[w.__testNow]));}static now(){return w.__testNow;}};
      w.__intervals={};w.setInterval=(fn,ms)=>{(w.__intervals[ms]??=[]).push(fn);return ms;};
      w.confirm=()=>true;w.alert=m=>alerts.push(String(m));w.prompt=()=>null;w.print=()=>{};
      w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
      w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
      w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
    }});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);
  const press=act=>{const el=$('#v5-root [data-v5-act="'+act+'"]')||$('#v5-nav [data-v5-act="'+act+'"]');assert.ok(el,'action '+act);el.click();};
  const tap=name=>{const el=$('[data-v5-recipe="'+name+'"]');assert.ok(el,'recipe '+name);el.click();};
  const dump=()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));
  const screen=()=>$('#v5-root').dataset.screen;
  const navCurrent=()=>$('#v5-nav [aria-current="page"]')?.dataset.v5Act;
  const dishes=()=>JSON.parse(w.localStorage.getItem(PLAN)).dishes;
  return {dom,w,d,$,press,tap,dump,screen,navCurrent,dishes,errors,alerts};
}

// Bug 1: tap toggles a recipe in step 1.
{
  const t=boot();
  try{
    t.press('new');
    t.tap('Ribeye 500 g');
    assert.equal(t.dishes().length,1,'tap adds');
    const card=()=>t.$('[data-v5-recipe="Ribeye 500 g"]');
    assert.match(card().textContent,/✓ In menu · tik om te verwijderen/);
    assert.equal(card().getAttribute('aria-label'),'Verwijder uit menu: Ribeye 500 g');
    assert.equal(card().getAttribute('aria-pressed'),'true');
    t.tap('Ribeye 500 g');
    assert.equal(t.dishes().length,0,'second tap removes');
    assert.equal(card().getAttribute('aria-label'),'Toevoegen: Ribeye 500 g');
    t.tap('Ribeye 500 g');
    const first=t.dishes()[0].id;
    const extra=t.$('[data-v5-extra="'+first+'"]');assert.ok(extra,'"+1" next to the dish in "Jouw menu"');
    assert.equal(extra.getAttribute('aria-label'),'Extra portie: Ribeye 500 g');
    extra.click();
    assert.equal(t.dishes().length,2,'"+1" adds a portion');
    assert.match(card().textContent,/\(2×\)/);
    t.tap('Ribeye 500 g');
    assert.deepEqual(t.dishes().map(d=>d.id),[first],'tap removes the last added portion');
    // A started dish is not removed by a tap; only a message.
    t.w.__v550Bridge.getState().dishes[0].phase='cooking';t.w.__v550Bridge.commit();
    const before=t.w.localStorage.getItem(PLAN);
    t.tap('Ribeye 500 g');
    assert.equal(t.w.localStorage.getItem(PLAN),before,'started dish stays (storage unchanged)');
    assert.equal(t.alerts.length,1);assert.match(t.alerts[0],/al gestart/);
    // The serialized dish has no new fields (no schema change).
    assert.ok(!('meaterAuto' in t.dishes()[0]),'no probe choice made → no optional field');
    assert.deepEqual(t.errors,[]);
    console.log('PASS v5.5 bug 1: tap toggles, "+1" adds a portion, last portion removed first, started dish kept with a message');
  }finally{t.dom.window.close();}
}
