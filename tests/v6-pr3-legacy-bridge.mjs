/*
 * PR3: test v6 live bridge against the real, unmodified v5.1.1 planner
 * running inside jsdom. A test-only bridge hook is injected into the string
 * before evaluation; NO production HTML/JavaScript is changed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {mountRegisseurPreview} from '../v6/regisseur-view.mjs';
import {createLegacyApplyAdapter,createPreloadRecovery} from '../v6/live-apply-adapter.mjs';
import {PLAN_KEY,JOURNAL_KEY} from '../v6/storage-journal.mjs';

process.env.TZ='Europe/Amsterdam';
const at=Date.parse('2026-11-14T11:00:00.000Z'),date='2026-11-14';
const sample={date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,equipment:{large:[],small:[]},
  smart:{enabled:true,mode:'fixed'},v46Done:{},v5Actual:{},
  dishes:[
    {id:'a',name:'a',kamado:'large',cook:60,rest:15,grill:120,method:'indirect',
      grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[]},
    {id:'b',name:'b',kamado:'large',cook:60,rest:15,grill:250,method:'direct',
      grate:'cast',mode:'auto',phase:'waiting',prepTasks:[]}
  ]};
let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
for(const f of ['bbq-v5.js','bbq-v501.js']){
  const re=new RegExp('<script src="\\./'+f.replace('.','\\.')+'\\?v=[^"]+"></script>');
  assert.match(html,re);
  html=html.replace(re,()=>'<script>'+fs.readFileSync('dist/'+f,'utf8')+'</script>');
}
assert.ok(html.includes('window.initBBQV5({'));
html=html.replace('window.initBBQV5({','window.initBBQV5(window.__bridge={');
assert.ok(html.includes('    getState:()=>state,'));
html=html.replace('    getState:()=>state,',
  '    getState:()=>state,\n    __v6TestReplace:next=>{state=next;initValuesOnly();renderAll();},');
const errors=[];
const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',
  runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    const NativeDate=w.Date;
    w.Date=class FixedDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[at]));}
      static now(){return at;}
    };
    w.localStorage.setItem(PLAN_KEY,JSON.stringify(sample));
    w.localStorage.setItem('bbq-v5-previous-plan-v1','EXISTING-BACKUP');
    w.localStorage.setItem('bbq-v5-session-v1',JSON.stringify({
      version:1,active:false,stage:'select',created:''}));
    w.scrollTo=()=>{};
    w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
    w.Element.prototype.scrollIntoView=()=>{};
    w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
    w.setInterval=()=>1;
    w.addEventListener('error',event=>errors.push(event.error?.stack||event.message));
  }});
try{
  assert.deepEqual(errors,[],'v5 boot should have no runtime errors');
  const w=dom.window,b=w.__bridge;
  assert.ok(b&&typeof b.getState==='function'&&
    typeof b.__v6TestReplace==='function','test-only v5 state bridge missing');
  b.commit(); // Align stored JSON with the normalised, in-memory legacy state.
  const original=JSON.stringify(b.getState());
  assert.equal(w.localStorage.getItem(PLAN_KEY),original);
  const parsed=fromLegacyState(b.getState(),{houseZone:'Europe/Amsterdam',now:at});
  assert.deepEqual(parsed.validation,[]);
  const input=parsed.input;
  input.limits={maxCandidates:96,maxAlternatives:3};
  input.kamados.find(k=>k.id==='small').verifiedDishIds=['b'];
  const outcome=optimize(input);
  const choice=outcome.alternatives.find(a=>a.planStatus==='feasible');
  assert.ok(choice,'v5 fixture should offer safe kamado move');
  const lockManager={request:async (name,opts,fn)=>fn({name,mode:'exclusive'})};
  const gateway=createLegacyApplyAdapter({
    storage:w.localStorage,lockManager,
    readLiveState:()=>b.getState(),replaceLiveState:next=>b.__v6TestReplace(next)
  });
  const root=w.document.createElement('section');
  w.document.body.append(root);
  const view=mountRegisseurPreview(root,{input,outcome,
    onApply:gateway.onApply({input,outcome})});
  assert.equal(w.localStorage.getItem(PLAN_KEY),original);
  root.querySelector('[data-bbq6-action="select:'+choice.id+'"]').click();
  root.querySelector('[data-bbq6-action="cancel"]').click();
  assert.equal(w.localStorage.getItem(PLAN_KEY),original,'cancel changed storage');
  root.querySelector('[data-bbq6-action="select:'+choice.id+'"]').click();
  root.querySelector('[data-bbq6-action="apply"]').click();
  assert.equal(w.localStorage.getItem(PLAN_KEY),original,'preview changed storage');
  root.querySelector('[data-bbq6-action="confirm"]').click();
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(b.getState().dishes.find(d=>d.id==='b').kamado,'small');
  assert.equal(JSON.parse(w.localStorage.getItem(PLAN_KEY)).dishes.find(d=>d.id==='b').kamado,
    'small');
  assert.equal(w.localStorage.getItem(JOURNAL_KEY),null);
  assert.equal(w.localStorage.getItem('bbq-v5-previous-plan-v1'),'EXISTING-BACKUP');
  assert.equal(JSON.parse(w.localStorage.getItem('bbq-v5-session-v1')).version,1);
  assert.equal((await createPreloadRecovery({storage:w.localStorage,lockManager})()).status,
    'clean','reload recovery must not disturb a committed plan');
  view.dispose();
  assert.deepEqual(errors,[],'unhandled real v5 errors');
  console.log('PASS PR3 actual v5 DOM bridge: cancel, confirmation, persisted kamado, no backup/session regression, recovery');
}finally{dom.window.close();}
