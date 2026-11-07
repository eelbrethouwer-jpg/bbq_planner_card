/* PR3 isolated UI/worker protocol regressions. Does not write persistent state. */
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';
import {buildPreviewModel} from '../v6/preview-model.mjs';
import {mountRegisseurPreview} from '../v6/regisseur-view.mjs';
import {createOptimizerClient} from '../v6/optimizer-client.mjs';

const zone='Europe/Amsterdam',day='2026-11-14';
const timestamp=time=>{
  const x=toInstant(day,time,zone);
  assert.equal(x.ok,true);
  return x.at;
};
const dish=(id,extra={})=>({id,name:id,kamado:'large',cook:60,rest:15,
  grill:120,method:'indirect',grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[],...extra});
const state={date:day,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,dishes:[
    dish('a'),dish('b',{grill:250,method:'direct',grate:'cast'})
  ]};
const {input,validation}=fromLegacyState(state,{houseZone:zone,now:timestamp('12:00')});
assert.deepEqual(validation,[]);
input.limits={maxCandidates:96,maxAlternatives:3};
input.kamados.find(k=>k.id==='small').verifiedDishIds=['b'];
const original=JSON.stringify(input);
const outcome=optimize(input);
assert.equal(outcome.planStatus,'infeasible');
assert.ok(outcome.alternatives.length>0);
assert.equal(JSON.stringify(input),original,'optimizer mutated source input');
const baseline=buildPreviewModel({input,outcome});
assert.equal(baseline.originalStatus,'infeasible');
assert.equal(baseline.kamados.length,2);
assert.equal(baseline.dishes.length,2);
assert.ok(baseline.kamados.find(k=>k.id==='large').tasks.some(t=>t.type==='fire'));
assert.ok(baseline.alternatives.length<=3);
const first=outcome.alternatives[0];
const preview=buildPreviewModel({input,outcome,selectedId:first.id});
assert.equal(preview.selected.id,first.id);
assert.equal(preview.displayedStatus,first.planStatus);
assert.equal(preview.baselineFingerprint,outcome.provenance.inputFingerprint);
assert.equal(JSON.stringify(input),original,'view model mutated input');
assert.equal(buildPreviewModel({input,outcome,selectedId:'bogus'}).selected,null);
const exhausted=buildPreviewModel({input,outcome:{...outcome,searchStatus:'budget_exhausted'}});
assert.equal(exhausted.budgetExhausted,true);
const zero=buildPreviewModel({input,outcome:{...outcome,alternatives:[]}});
assert.deepEqual(zero.alternatives,[]);

// The view inserts input labels using textContent; no executable HTML.
const dom=new JSDOM('<!doctype html><main id="view"></main>');
const root=dom.window.document.getElementById('view');
const dangerous={...input,dishes:input.dishes.map((d,i)=>i===0?{...d,name:'<img src=x onerror=alert(1)>'}:d)};
const xss=mountRegisseurPreview(root,{input:dangerous,outcome});
assert.equal(root.querySelector('img'),null);
assert.ok(root.textContent.includes('<img src=x onerror=alert(1)>'));
xss.dispose();
assert.equal(root.children.length,0);

const readOnly=mountRegisseurPreview(root,{input,outcome});
root.querySelector('[data-bbq6-action="select:'+first.id+'"]').click();
assert.equal(root.querySelector('[data-bbq6-action="apply"]'),null,
  'Apply must not appear without an explicitly supplied storage adapter');
readOnly.dispose();

let applied=0,received=null;
const view=mountRegisseurPreview(root,{input,outcome,onApply:async (alt,meta)=>{
  applied++;received={alt,meta};
}});
root.querySelector('[data-bbq6-action="select:'+first.id+'"]').click();
assert.ok(root.textContent.includes('Geselecteerd'));
root.querySelector('[data-bbq6-action="apply"]').click();
assert.equal(applied,0,'first apply click must not mutate');
assert.ok(root.querySelector('[data-bbq6-action="confirm"]'),'explicit confirmation required');
root.querySelector('[data-bbq6-action="back"]').click();
assert.equal(applied,0,'back must cancel confirmation');
root.querySelector('[data-bbq6-action="apply"]').click();
root.querySelector('[data-bbq6-action="confirm"]').click();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(applied,1);
assert.equal(received.alt.id,first.id);
assert.equal(received.meta.expectedFingerprint,outcome.provenance.inputFingerprint);
assert.equal(received.meta.requiresRollback,true);
assert.equal(JSON.stringify(input),original,'applying preview view mutated source');
view.update({input,outcome,loading:true});
assert.ok(root.textContent.includes('Berekenen'));
view.dispose();

class FakeWorker{
  constructor(){this.listeners=new Map();this.terminated=false;}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  postMessage(message){this.request=message;}
  terminate(){this.terminated=true;}
  emit(type,data){this.listeners.get(type)?.({data});}
}
const workers=[];
const states=[];
const client=createOptimizerClient({
  workerFactory:()=>{const worker=new FakeWorker();workers.push(worker);return worker;},
  onStateChange:s=>states.push(s.status)
});
const p1=client.run(input);
const p1Rejected=assert.rejects(p1,{name:'AbortError'});
const p2=client.run(input);
await p1Rejected;
assert.equal(workers[0].terminated,true,'cancel must terminate costly optimizer work');
workers[0].emit('message',{type:'result',id:workers[0].request.id,result:{invalid:true}});
assert.equal(client.getState().status,'running','stale reply must not affect new request');
workers[1].emit('message',{type:'result',id:workers[1].request.id,result:outcome});
assert.equal(await p2,outcome);
assert.equal(client.getState().status,'complete');
assert.equal(workers[1].terminated,true);
const p3=client.run(input);
const p3Rejected=assert.rejects(p3,{name:'AbortError'});
client.cancel();
await p3Rejected;
assert.equal(workers[2].terminated,true);
client.dispose();
await assert.rejects(client.run(input),/disposed/);
assert.ok(states.includes('running')&&states.includes('complete'));
console.log('PASS PR3 preview model, mobile DOM, XSS, explicit confirmation, Worker cancellation/stale results, immutability');
