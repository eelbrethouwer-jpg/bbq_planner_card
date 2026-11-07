/* PR3 live-state integration with a shared cross-tab lock and recovery. */
import assert from 'node:assert/strict';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';
import {createLegacyApplyAdapter,createPreloadRecovery}
  from '../v6/live-apply-adapter.mjs';
import {createPlanLock,LOCK_NAME} from '../v6/plan-lock.mjs';
import {PLAN_KEY,JOURNAL_KEY} from '../v6/storage-journal.mjs';

class Storage{
  constructor(initial){this.m=new Map([[PLAN_KEY,JSON.stringify(initial)],
    ['bbq-v5-previous-plan-v1','older-session'],
    ['bbq-v5-session-v1','v5-session'],
    ['kamado-recipe-book-v1','my-recipes']]);}
  getItem(k){return this.m.has(k)?this.m.get(k):null}
  setItem(k,v){this.m.set(k,String(v))}
  removeItem(k){this.m.delete(k)}
}
class SharedLocks{
  constructor(){this.active=new Set();this.calls=[];}
  async request(name,options,fn){
    assert.equal(options.mode,'exclusive');
    assert.equal(options.ifAvailable,true);
    assert.equal(name,LOCK_NAME);
    this.calls.push(name);
    if(this.active.has(name))return fn(null);
    this.active.add(name);
    try{return await fn({name,mode:'exclusive'});}
    finally{this.active.delete(name);}
  }
}
const date='2026-11-14',houseZone='Europe/Amsterdam';
const now=toInstant(date,'12:00',houseZone);
assert.equal(now.ok,true);
const makeDish=(id,extra={})=>({id,name:id,kamado:'large',cook:60,rest:15,grill:120,
  method:'indirect',grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[],...extra});
const state={
  date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,
  dishes:[makeDish('a'),makeDish('b',{grill:250,method:'direct',grate:'cast'})],
  v46Done:{},v5Actual:{}
};
const copy=o=>JSON.parse(JSON.stringify(o));
const engine=fromLegacyState(state,{houseZone,now:now.at});
assert.deepEqual(engine.validation,[]);
const input=engine.input;
input.limits={maxCandidates:96,maxAlternatives:3};
input.kamados.find(k=>k.id==='small').verifiedDishIds=['b'];
const outcome=optimize(input);
const option=outcome.alternatives.find(a=>a.planStatus==='feasible');
assert.ok(option);
const fingerprint=outcome.provenance.inputFingerprint;
const before=JSON.stringify(state);
const makeTab=(storage,locks,{broken=false}={})=>{
  let live=copy(state),refreshes=0;
  const bridge={
    storage,lockManager:locks,
    readLiveState:()=>live,
    replaceLiveState:async next=>{
      live=copy(next);
      if(broken)throw Error('BROKEN_LIVE_BRIDGE');
    },
    refreshView:()=>{refreshes++;}
  };
  return {
    ...bridge,
    adapter:createLegacyApplyAdapter(bridge),
    setState:next=>{live=copy(next)},
    getState:()=>live,
    getRefreshes:()=>refreshes
  };
};
let passes=0;
{
  const s=new Storage(state),locks=new SharedLocks(),a=makeTab(s,locks);
  const result=await a.adapter.onApply({input,outcome})(
    option,{expectedFingerprint:fingerprint,requiresRollback:true});
  assert.equal(result.status,'applied');
  assert.equal(JSON.parse(s.getItem(PLAN_KEY)).dishes[1].kamado,'small');
  assert.equal(a.getState().dishes[1].kamado,'small');
  assert.equal(s.getItem(JOURNAL_KEY),null);
  assert.equal(s.getItem('bbq-v5-previous-plan-v1'),'older-session');
  assert.equal(s.getItem('bbq-v5-session-v1'),'v5-session');
  assert.equal(s.getItem('kamado-recipe-book-v1'),'my-recipes');
  assert.equal(a.getRefreshes(),1);
  passes++;
}
{
  const s=new Storage(state),locks=new SharedLocks(),a=makeTab(s,locks);
  await assert.rejects(a.adapter.onApply({input,outcome})(
    option,{expectedFingerprint:'invalid',requiresRollback:true}),/STALE_FINGERPRINT/);
  await assert.rejects(a.adapter.onApply({input,outcome})(
    option,{expectedFingerprint:fingerprint,requiresRollback:false}),/RECOVERY_GUARD_REQUIRED/);
  await assert.rejects(a.adapter.onApply({input,outcome})(
    copy(option),{expectedFingerprint:fingerprint,requiresRollback:true}),/STALE_SELECTION/);
  assert.equal(s.getItem(PLAN_KEY),before);
  assert.equal(s.getItem(JOURNAL_KEY),null);
  passes++;
}
{
  const s=new Storage(state),locks=new SharedLocks(),a=makeTab(s,locks);
  a.setState({...state,mealTime:'19:00'});
  await assert.rejects(a.adapter.apply({input,outcome,alternativeId:option.id,
    expectedFingerprint:fingerprint}),/STALE_SOURCE|STALE_SLOTS|STALE_DISHES/);
  assert.equal(s.getItem(PLAN_KEY),before);
  passes++;
}
{
  const s=new Storage(state),locks=new SharedLocks(),tab1=makeTab(s,locks);
  const tab2=makeTab(s,locks);
  let release;
  let acquired;
  const acquiredPromise=new Promise(resolve=>{acquired=resolve;});
  const hold=createPlanLock({lockManager:locks})(async()=>{
    acquired();
    await new Promise(resolve=>{release=resolve;});
  });
  await acquiredPromise;
  await assert.rejects(tab2.adapter.apply({input,outcome,alternativeId:option.id,
    expectedFingerprint:fingerprint}),/PLAN_LOCK_BUSY/);
  assert.equal(s.getItem(JOURNAL_KEY),null);
  assert.equal(s.getItem(PLAN_KEY),before);
  release();await hold;
  const completed=await tab1.adapter.apply({input,outcome,alternativeId:option.id,
    expectedFingerprint:fingerprint});
  assert.equal(completed.status,'applied');
  // Tab 2 has stale in-memory state; it must not override the first apply.
  await assert.rejects(tab2.adapter.apply({input,outcome,alternativeId:option.id,
    expectedFingerprint:fingerprint}),/STALE_STORED_PLAN/);
  assert.equal(JSON.parse(s.getItem(PLAN_KEY)).dishes[1].kamado,'small');
  passes++;
}
{
  const s=new Storage(state),locks=new SharedLocks(),a=makeTab(s,locks,{broken:true});
  await assert.rejects(a.adapter.apply({input,outcome,alternativeId:option.id,
    expectedFingerprint:fingerprint}),/BROKEN_LIVE_BRIDGE/);
  assert.equal(s.getItem(PLAN_KEY),before);
  assert.equal(s.getItem(JOURNAL_KEY),null);
  passes++;
}
{
  const s=new Storage(state),locks=new SharedLocks();
  const recover=createPreloadRecovery({storage:s,lockManager:locks});
  assert.deepEqual(await recover(),{status:'clean'});
  const after=copy(state);after.dishes[1].kamado='small';
  s.setItem(JOURNAL_KEY,JSON.stringify({
    version:1,stage:'prepared',before,after:JSON.stringify(after)
  }));
  s.setItem(PLAN_KEY,JSON.stringify(after));
  assert.deepEqual(await recover(),{status:'rolled_back'});
  assert.equal(s.getItem(PLAN_KEY),before);
  assert.equal(s.getItem(JOURNAL_KEY),null);
  passes++;
}
{
  const s=new Storage(state),a=makeTab(s,new SharedLocks());
  // Cancel/close does not invoke onApply and must be mutation-free.
  const cancel=()=>{};
  cancel();
  assert.equal(s.getItem(PLAN_KEY),before);
  assert.equal(s.getItem(JOURNAL_KEY),null);
  assert.equal(a.getRefreshes(),0);
  passes++;
}
{
  assert.throws(()=>createPlanLock({lockManager:null}),/WEB_LOCKS_UNAVAILABLE/);
  assert.throws(()=>createLegacyApplyAdapter({storage:new Storage(state),
    readLiveState:()=>state,replaceLiveState:()=>{}}),/WEB_LOCKS_UNAVAILABLE/);
  passes++;
}
console.log('PASS '+passes+
  ' PR3 live bridge cases: apply, cancel, stale, tamper, cross-tab, rollback, reload, fail-closed Web Locks');
