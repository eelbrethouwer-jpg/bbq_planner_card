/* PR3 apply preflight: no localStorage writes, no schema migrations. */
import assert from 'node:assert/strict';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';
import {prepareLegacyApply} from '../v6/apply-proposal.mjs';

const date='2026-11-14',houseZone='Europe/Amsterdam';
const at=time=>{
  const t=toInstant(date,time,houseZone);
  assert.equal(t.ok,true);
  return t.at;
};
const dish=(id,more={})=>({
  id,name:id,kamado:'large',cook:60,rest:15,grill:120,method:'indirect',
  grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[],...more
});
function fixture(dishes,extra={},config={}){
  const legacyState={
    date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
    preheatLarge:30,preheatSmall:25,dishes,...extra
  };
  const v6=fromLegacyState(legacyState,{houseZone,now:at('12:00')});
  assert.deepEqual(v6.validation,[]);
  const input=v6.input;
  input.limits={maxCandidates:96,maxAlternatives:3};
  if(config.fit)input.kamados.find(k=>k.id==='small').verifiedDishIds=config.fit;
  if(config.laterAllowedMaxMin!==undefined)
    input.serveSlots.find(s=>s.id==='main').laterAllowedMaxMin=config.laterAllowedMaxMin;
  return {legacyState,input,outcome:optimize(input)};
}
const base=fixture([
  dish('a'),dish('b',{grill:250,method:'direct',grate:'cast'})
],{v46Done:{'2026-11-14|irrelevant':true},v5Actual:{'2026-11-14|irrelevant':123}},
  {fit:['b']});
const snapshot=JSON.stringify(base.legacyState),inputSnapshot=JSON.stringify(base.input);
const best=base.outcome.alternatives[0];
assert.ok(best,'optimizer must offer an alternative in this fixture');
assert.equal(best.planStatus,'feasible');
const p=prepareLegacyApply({...base,alternativeId:best.id});
assert.equal(p.proposedState.dishes[0].kamado,'large');
assert.equal(p.proposedState.dishes[1].kamado,'small');
assert.deepEqual(p.changedDishIds,['b']);
assert.deepEqual(p.changedSlotIds,[]);
assert.equal(p.proposedState.v46Done,base.legacyState.v46Done);
assert.equal(p.proposedState.v5Actual,base.legacyState.v5Actual);
assert.equal(p.proposedState.mealTime,'18:30');
assert.equal(p.requiresDurableBackup,true);
assert.equal(p.expectedSourceJSON,snapshot);
assert.equal(JSON.stringify(base.legacyState),snapshot,'original legacy state mutated');
assert.equal(JSON.stringify(base.input),inputSnapshot,'original engine input mutated');

const stale=structuredClone(base.legacyState);
stale.dishes[0].grill=125;
assert.throws(()=>prepareLegacyApply({...base,legacyState:stale,alternativeId:best.id}),
  /STALE_DISHES/);
assert.throws(()=>prepareLegacyApply({...base,alternativeId:'missing'}),/INVALID_ALTERNATIVE/);
assert.throws(()=>prepareLegacyApply({
  ...base,outcome:{...base.outcome,provenance:{inputFingerprint:'wrong'}},
  alternativeId:best.id
}),/STALE_OPTIMIZER_RESULT/);
const altered=structuredClone(base.outcome);
altered.alternatives[0].suggestedPlan.dishes[0].start=0;
assert.throws(()=>prepareLegacyApply({...base,outcome:altered,alternativeId:best.id}),
  /TAMPERED_ALTERNATIVE/);

const unverified=fixture([
  dish('a'),dish('b',{grill:250,method:'direct',grate:'cast'})
]);
assert.ok(unverified.outcome.alternatives[0]);
assert.equal(unverified.outcome.alternatives[0].planStatus,'conditional');
assert.throws(()=>prepareLegacyApply({...unverified,
  alternativeId:unverified.outcome.alternatives[0].id
}),/UNVERIFIED_ALTERNATIVE/);

const delayed=fixture([dish('a')],{availableFrom:'18:00'},{
  laterAllowedMaxMin:90
});
assert.equal(delayed.outcome.alternatives[0]?.changes[0]?.type,'serve_delay');
const d=prepareLegacyApply({...delayed,alternativeId:delayed.outcome.alternatives[0].id});
assert.equal(d.proposedState.mealTime,'19:45');
assert.deepEqual(d.changedSlotIds,['main']);
assert.equal(delayed.legacyState.mealTime,'18:30');
const fakeDelayed=structuredClone(delayed.outcome);
fakeDelayed.alternatives[0].changes[0].dishIds=['other'];
assert.throws(()=>prepareLegacyApply({...delayed,outcome:fakeDelayed,
  alternativeId:fakeDelayed.alternatives[0].id}),/UNSAFE_SLOT_DELAY/);

const lockedState=structuredClone(base.legacyState);
lockedState.dishes[1].phase='cooking';
assert.throws(()=>prepareLegacyApply({...base,legacyState:lockedState,
  alternativeId:best.id}),/STALE_DISHES/);

console.log('PASS PR3 apply proposal: v5 schema preservation, no mutation, stale input, tamper, unverified fit, whole-slot delay, locks');
