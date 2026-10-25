/* v5 synthetic browser flow. This is NOT a physical iPhone or live-MEATER test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
const ui=fs.readFileSync('dist/bbq-v5.js','utf8');
const ux501=fs.readFileSync('dist/bbq-v501.js','utf8');
const loader='<script src="./bbq-v5.js?v=5.0.2"></script>';
const loader501='<script src="./bbq-v501.js?v=5.0.2"></script>';
assert.ok(html.includes(loader),'v5 must be loaded ahead of the original planner engine');
assert.ok(html.includes(loader501),'v5.0.1 enhancer is loaded');
const documentHtml=html.replace(loader,'<script>'+ui+'</script>').replace(loader501,'<script>'+ux501+'</script>');
const errors=[];
const dom=new JSDOM(documentHtml,{
  url:'https://planner.test.invalid/dist/BBQ_bereidingsplanner_MEATER_v4.html',
  runScripts:'dangerously',
  pretendToBeVisual:true,
  beforeParse(w){
    w.Element.prototype.scrollIntoView=()=>{};
    w.scrollTo=()=>{};
    w.confirm=()=>true;
    w.alert=()=>{};
    w.prompt=()=>null;
    w.print=()=>{};
    w.URL.createObjectURL=()=> 'blob:https://planner.test.invalid/test';
    w.URL.revokeObjectURL=()=>{};
    w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
  }
});
const {window}=dom,doc=window.document,$=id=>doc.getElementById(id);
const click=el=>{assert.ok(el,'Missing clickable element');el.click()};
const press=act=>click(doc.querySelector('#v5-root [data-v5-act="'+act+'"]'));
const store=()=>JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1'));
const session=()=>JSON.parse(window.localStorage.getItem('bbq-v5-session-v1'));
const change=(el,value)=>{assert.ok(el,'Missing field');el.value=value;el.dispatchEvent(new window.Event('change',{bubbles:true}))};
try{
 assert.deepEqual(errors,[],'boot without runtime errors');
 assert.ok(doc.body.classList.contains('v5-ready'),'v5 UI activated');
 assert.ok($('v5-root'),'session dashboard exists');
 assert.equal(doc.querySelectorAll('#v5-root .v5-nav button').length,4,'compact 4-tab navigation');
 assert.match($('v5-root').textContent,/Wat gaan we bereiden/);
 assert.equal(doc.querySelectorAll('[data-v47-tab]').length,5,'legacy functions retained');
 press('new');
 assert.equal(store().dishes.length,0,'new session resets only planned dishes');
 assert.ok(window.localStorage.getItem('bbq-v5-previous-plan-v1'),'previous plan backed up before replacement');
 assert.equal(session().stage,'select');
 click(doc.querySelector('[data-v5-recipe="Pulled pork op brood"]'));
 assert.equal(store().dishes.length,1);
 assert.equal(store().dishes[0].name,'Pulled pork op brood');
 click(doc.querySelector('[data-v5-recipe="Krieltjes"]'));
 assert.equal(store().dishes.length,2);
 press('setup');
 assert.equal(session().stage,'setup');
 assert.match($('v5-root').textContent,/Verdeel de gerechten/);
 change(doc.querySelector('[data-v5-setting="date"]'),'2026-11-21');
 assert.equal(store().date,'2026-11-21');
 change(doc.querySelector('[data-v5-setting="mealTime"]'),'19:15');
 assert.equal(store().mealTime,'19:15');
 const kamado=doc.querySelector('[data-v5-kamado]');
 change(kamado,'small');
 assert.equal(store().dishes[0].kamado,'small','kamado selection persists');
 press('prep');
 assert.equal(session().stage,'prep');
 assert.match($('v5-root').textContent,/Procureur schoonmaken en kruiden/,'day-before recipe task appears');
 const preptask=doc.querySelector('#v5-root [data-v5-check]');assert.ok(preptask);
 const prepId=preptask.dataset.v5Check;
 preptask.checked=true;preptask.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(store().v46Done[prepId],true,'preparation completed in existing task state');
 press('live');
 assert.equal(session().stage,'live');
 assert.match($('v5-root').textContent,/Jouw BBQ in uitvoering/);
 assert.match($('v5-root').textContent,/Geplande BBQ-temp/,'not pretending to have live data');
 const topAction=doc.querySelector('#v5-root [data-v5-act^="done:"]');
 assert.ok(topAction,'next timed task is actionable');
 const taskId=topAction.dataset.v5Act.slice(5);click(topAction);
 assert.equal(store().v46Done[taskId],true,'live task completion persisted');
 assert.equal(typeof store().v5Actual[taskId],'number','actual completion time is saved');
 const phase=doc.querySelector('#v5-root [data-v5-act^="phase:"]');
 assert.ok(phase,'dish phase change available');
 click(phase);assert.ok(store().dishes.some(d=>d.phase==='cooking'),'phase change persisted');
 press('planning');
 assert.ok(doc.body.classList.contains('v5-legacy'),'advanced editing safely opens old planner');
 assert.equal($('v47-planning').hidden,false,'legacy planning is available');
 click($('v5-back'));
 assert.ok(!doc.body.classList.contains('v5-legacy'),'return to streamlined session');
 assert.match($('v5-root').textContent,/Jouw BBQ in uitvoering/);
 press('home');
 assert.match($('v5-root').textContent,/Hervat live bereiding/);
 press('resume');
 assert.equal(session().stage,'live');
 assert.ok(!errors.length,'all interactions free of runtime errors: '+errors.join('\n'));
 console.log('OK BBQ Planner v5: welcome, backup, selection, planning, prep, live tasks, legacy access, resume');
}finally{window.close()}
