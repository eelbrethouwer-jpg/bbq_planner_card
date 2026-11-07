/* PR2 independent optimizer oracles. None require the UI, HA or a real sensor. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';

const zone='Europe/Amsterdam', date='2026-11-14';
const at=(time,d=date)=>{
  const r=toInstant(d,time,zone);
  assert.equal(r.ok,true,JSON.stringify(r));
  return r.at;
};
const makeDish=(id,more={})=>({id,name:id,kamado:'large',cook:60,rest:15,
  grill:120,method:'indirect',grate:'rvs',mode:'auto',phase:'waiting',
  prepTasks:[],...more});
const makeState=(dishes,more={})=>({date,dateMode:'manual',mealTime:'18:30',
  availableFrom:'00:00',preheatLarge:30,preheatSmall:25,dishes,...more});
function build(dishes,more={},config={}){
  const {input,validation}=fromLegacyState(makeState(dishes,more),{
    houseZone:zone,now:at('12:00')});
  assert.deepEqual(validation,[]);
  input.limits={maxCandidates:config.maxCandidates??100,maxAlternatives:config.maxAlternatives??3};
  const slot=input.serveSlots.find(s=>s.id==='main');
  slot.laterAllowedMaxMin=config.laterAllowedMaxMin??0;
  for(const k of input.kamados){
    if(config.capacity?.[k.id]!==undefined)k.capacity={unit:'dishes',value:config.capacity[k.id]};
    if(config.fit?.[k.id])k.verifiedDishIds=config.fit[k.id];
    if(config.preheat?.[k.id]!==undefined)k.preheatMin=config.preheat[k.id];
  }
  return input;
}
const results=[];
function test(id,fn){
  try{fn();results.push({id,ok:true});console.log('PASS '+id);}
  catch(e){results.push({id,ok:false});console.error('FAIL '+id+': '+e.stack);}
}
const codes=r=>r.conflicts.map(c=>c.code);
const moves=r=>r.alternatives.flatMap(a=>a.changes);
const byId=(r,id)=>r.dishes.find(d=>d.id===id);
function frozen(o){
  if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))frozen(v);}
  return o;
}
function assertSource(input,optimizerOutput){
  const before=plan(input);
  assert.equal(optimizerOutput.planStatus,before.planStatus,'baseline plan must remain');
  assert.deepEqual(optimizerOutput.dishes,before.dishes);
  assert.deepEqual(optimizerOutput.proposedTasks,before.proposedTasks);
  assert.deepEqual(optimizerOutput.fires,before.fires);
  assert.equal(optimizerOutput.provenance.inputFingerprint,before.provenance.inputFingerprint);
  assert.deepEqual(optimizerOutput.alternatives.map(a=>a.id),
    optimizerOutput.alternatives.map((_,i)=>'alternative-'+(i+1)));
}
test('O01-REASSIGN',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},fit:{small:['b']},maxCandidates:10});
  const baseline=plan(input);
  assert.equal(baseline.planStatus,'infeasible');
  assert.ok(codes(baseline).includes('INCOMPATIBLE_SETUP'));
  const result=optimize(frozen(input));
  assertSource(input,result);
  assert.equal(result.searchStatus,'complete');
  assert.equal(result.optimization.testedCandidates,3); // two single moves + one two-dish combination
  assert.ok(result.alternatives.length>0);
  const best=result.alternatives[0];
  assert.equal(best.planStatus,'feasible');
  assert.deepEqual(best.changes,[{type:'kamado',dishId:'b',from:'large',to:'small'}]);
  assert.equal(best.suggestedPlan.dishes.find(d=>d.id==='b').kamadoId,'small');
  assert.equal(best.feasibleUnderAssumptions,true);
});
test('N04-LOCKED-COOKING-AND-PINNED',()=>{
  const input=build([
    makeDish('pinned',{mode:'manual',fixedStart:'17:15',cook:60,rest:15}),
    makeDish('active',{kamado:'small',phase:'cooking',startedAt:at('17:15')}),
    makeDish('waiting',{grill:250,method:'direct',grate:'cast'})
  ],{}, {laterAllowedMaxMin:60,maxCandidates:100});
  const original=JSON.stringify(input),baseline=plan(input);
  assert.equal(baseline.planStatus,'infeasible');
  const out=optimize(frozen(input));
  assert.equal(JSON.stringify(input),original);
  assertSource(input,out);
  assert.ok(out.alternatives.length>0,'waiting dish can be proposed for later serving');
  for(const alt of out.alternatives){
    assert.ok(alt.changes.every(c=>c.dishId==='waiting'),'N04 must preserve pinned & cooking dishes');
    for(const id of ['pinned','active']){
      const a=byId(baseline,id),b=byId(alt.suggestedPlan,id);
      assert.deepEqual(b,a,'N04: locked planned dish must remain byte-identical');
    }
    assert.equal(input.dishes.find(d=>d.id==='active').immutableActuals.startedAt,at('17:15'));
  }
});
test('O03-IMMUTABLE-ACTUALS',()=>{
  const input=build([
    makeDish('actual',{startedAt:at('17:15')}),
    makeDish('iso-actual',{startedAt:'2026-11-14T16:15:00.000Z',
      grill:230,method:'direct',grate:'cast'}),
    makeDish('waiting',{grill:250,method:'direct',grate:'cast'})
  ],{},{laterAllowedMaxMin:60});
  const original=JSON.stringify(input),result=optimize(frozen(input));
  assert.equal(JSON.stringify(input),original);
  assert.ok(moves(result).every(c=>c.dishId==='waiting'),
    'numeric and ISO actual timestamps must both prevent alternatives');
});
test('O04-EXPLICIT-SERVE-FLEXIBILITY',()=>{
  const dishes=[makeDish('a'),makeDish('b')];
  const input=build(dishes,{}, {laterAllowedMaxMin:60,capacity:{large:1},maxCandidates:30});
  input.kamados=input.kamados.filter(k=>k.id==='large');
  const out=optimize(frozen(input));
  assert.equal(out.planStatus,'infeasible');
  assert.ok(codes(out).includes('RESOURCE_CAPACITY'));
  assert.equal(out.searchStatus,'complete');
  assert.ok(out.alternatives.length>0);
  assert.ok(out.alternatives.some(a=>a.planStatus==='feasible' &&
    a.changes.some(c=>c.type==='serve_delay'&&c.minutes===60)));
  assert.equal(input.serveSlots[0].at,at('18:30'),'original serve slot unchanged');
  assert.ok(out.alternatives.every(a=>a.changes.every(c=>c.type==='serve_delay')));
});
test('O05-BUDGET-EXHAUSTED',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},fit:{small:['a','b']},maxCandidates:1});
  const out=optimize(input);
  assert.equal(out.searchStatus,'budget_exhausted');
  assert.equal(out.optimization.testedCandidates,1);
  assert.equal(out.optimization.maxCandidates,1);
  assert.ok(out.optimization.totalCandidates>1);
  assert.ok(out.alternatives.length<=3);
});
test('O06-MAX-ALTERNATIVES',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},fit:{small:['a','b']},maxCandidates:10,maxAlternatives:1});
  const out=optimize(input);
  assert.equal(out.alternatives.length,1);
  assert.equal(out.alternatives[0].id,'alternative-1');
});
test('O07-INVALID-LIMITS',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})]);
  input.limits.maxCandidates=513;
  const out=optimize(input);
  assert.equal(out.searchStatus,'not_run');
  assert.equal(out.planStatus,'unknown'===plan(input).planStatus?'unknown':'infeasible');
  assert.ok(out.validation.some(v=>v.code==='INVALID_LIMITS'));
  assert.equal(out.optimization.testedCandidates,0);
});
test('O08-PURITY-NO-IO',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},maxCandidates:3});
  frozen(input);
  const dateNow=Date.now;
  const descriptors={};
  try{
    Date.now=()=>{throw Error('Date.now forbidden')};
    for(const k of ['window','document','localStorage']){
      descriptors[k]=Object.getOwnPropertyDescriptor(globalThis,k);
      Object.defineProperty(globalThis,k,{configurable:true,get(){throw Error(k+' forbidden')}});
    }
    const out=optimize(input);
    assert.equal(out.optimization.testedCandidates,3); // no time/IO needed for bounded candidate count
  }finally{
    Date.now=dateNow;
    for(const k of ['window','document','localStorage']){
      if(descriptors[k])Object.defineProperty(globalThis,k,descriptors[k]);
      else delete globalThis[k];
    }
  }
});
test('O09-DETERMINISM-AND-FINGERPRINT',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},laterAllowedMaxMin:30,maxCandidates:24});
  const a=optimize(input),b=optimize(input);
  assert.deepEqual(a,b);
  assert.deepEqual(a.alternatives.map(x=>x.inputFingerprint),
    b.alternatives.map(x=>x.inputFingerprint));
  assert.equal(a.searchStatus,'budget_exhausted');
});
test('O10-NO-ALTERNATIVES-WHEN-FEASIBLE',()=>{
  const input=build([makeDish('a')],{},{laterAllowedMaxMin:60,maxCandidates:200});
  const out=optimize(input);
  assert.equal(out.planStatus,'feasible');
  assert.equal(out.searchStatus,'complete');
  assert.deepEqual(out.alternatives,[]);
  assert.equal(out.optimization.testedCandidates,0);
});
test('O11-VALIDATION-UNKNOWN-NO-SEARCH',()=>{
  const state=makeState([makeDish('a',{cook:null})]);
  const {input}=fromLegacyState(state,{houseZone:zone,now:at('12:00')});
  const out=optimize(input);
  assert.equal(out.planStatus,'unknown');
  assert.equal(out.searchStatus,'not_run');
  assert.deepEqual(out.alternatives,[]);
});
test('O12-UNVERIFIED-KAMADO-FIT',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},maxCandidates:10});
  const out=optimize(input);
  assert.equal(out.planStatus,'infeasible');
  assert.ok(out.alternatives.length>0);
  assert.equal(out.alternatives[0].planStatus,'conditional');
  assert.ok(out.alternatives[0].conflicts.some(c=>c.code==='KAMADO_FIT_UNVERIFIED'));
  assert.equal(out.alternatives[0].feasibleUnderAssumptions,false);
});
test('O13-EXACT-DELAY-BOUND',()=>{
  const input=build([makeDish('a'),makeDish('b')],{},
    {capacity:{large:1},laterAllowedMaxMin:17,maxCandidates:100});
  input.kamados=input.kamados.filter(k=>k.id==='large');
  const out=optimize(input);
  assert.ok(out.optimization.testedCandidates>0);
  assert.ok(out.alternatives.every(a=>a.changes.every(c=>c.minutes<=17)));
  assert.equal(out.searchStatus,'complete');
});
test('O14-NO-SILENT-SHARED-SLOT-CHANGES',()=>{
  const input=build([makeDish('pinned',{mode:'manual',fixedStart:'17:15'}),
    makeDish('free',{grill:250,method:'direct',grate:'cast'})],{},
  {laterAllowedMaxMin:60,maxCandidates:100});
  input.kamados=input.kamados.filter(k=>k.id==='large');
  const before=JSON.stringify(input),baseline=plan(input);
  const out=optimize(frozen(input));
  assert.equal(JSON.stringify(input),before);
  assert.ok(out.alternatives.length>0);
  for(const candidate of out.alternatives){
    assert.equal(byId(candidate.suggestedPlan,'pinned').start,byId(baseline,'pinned').start);
    assert.equal(byId(candidate.suggestedPlan,'pinned').serveAt,at('18:30'));
    assert.equal(input.serveSlots[0].at,at('18:30'));
  }
});
test('O15-MAX-3-NOT-4',()=>{
  const input=build([makeDish('a')]);
  input.limits.maxAlternatives=4;
  const out=optimize(input);
  assert.equal(out.searchStatus,'not_run');
  assert.ok(out.validation.some(v=>v.code==='INVALID_LIMITS'));
});
test('O16-12-DISHES-BOUNDED',()=>{
  const dishes=Array.from({length:12},(_,i)=>makeDish('d'+i,{grill:i%2?250:120,
    method:i%2?'direct':'indirect'}));
  const input=build(dishes,{}, {maxCandidates:8,laterAllowedMaxMin:90});
  const start=performance.now(),out=optimize(input),elapsed=performance.now()-start;
  assert.equal(out.searchStatus,'budget_exhausted');
  assert.equal(out.optimization.testedCandidates,8);
  assert.ok(elapsed<1500,'bounded optimizer unexpectedly slow: '+elapsed);
});
test('O17-ZERO-CANDIDATE-BUDGET',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{maxCandidates:0});
  const out=optimize(input);
  assert.equal(out.searchStatus,'budget_exhausted');
  assert.equal(out.optimization.testedCandidates,0);
  assert.deepEqual(out.alternatives,[]);
});
test('O18-NO-COURSE-CROSSING',()=>{
  const input=build([makeDish('a',{serveSlot:'starter'}),
    makeDish('b',{serveSlot:'starter',grill:250,method:'direct',grate:'cast'})],
    {v46MultiServe:true,v46Starter:'18:15'},
    {laterAllowedMaxMin:60,maxCandidates:80});
  input.serveSlots.find(s=>s.id==='starter').laterAllowedMaxMin=60;
  input.kamados=input.kamados.filter(k=>k.id==='large');
  const out=optimize(input);
  assert.ok(out.optimization.testedCandidates>0);
  assert.ok(moves(out).every(c=>c.type!=='serve_delay'||c.to<=at('18:30')));
});
test('O19-BASELINE-INPUT-IMMUTABLE',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},laterAllowedMaxMin:30});
  const before=JSON.stringify(input),out=optimize(frozen(input));
  assert.equal(JSON.stringify(input),before);
  assert.equal(out.provenance.inputFingerprint,plan(input).provenance.inputFingerprint);
  assert.ok(out.alternatives.every(x=>x.changes.length>0));
});
test('O20-EXPLICIT-NO-ALTERNATIVE-APPLY',()=>{
  const input=build([makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
    {},{preheat:{small:25},fit:{small:['b']}});
  const before=JSON.stringify(input),out=optimize(input);
  assert.equal(JSON.stringify(input),before);
  assert.equal(input.dishes[1].currentKamadoId,'large');
  assert.ok(out.alternatives.some(a=>byId(a.suggestedPlan,'b').kamadoId==='small'));
  assert.equal(plan(input).planStatus,'infeasible');
});

const failures=results.filter(r=>!r.ok);
console.log('OPTIMIZER_ORACLES '+results.map(r=>r.id+'='+(r.ok?'PASS':'FAIL')).join(' '));
if(failures.length)throw Error(failures.length+' PR2 oracle(s) failed: '+failures.map(x=>x.id).join(','));
console.log('PASS '+results.length+' PR2 optimizer oracles');
