/* PR3 write-ahead recovery tests. Isolated mock storage; never touches user data. */
import assert from 'node:assert/strict';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';
import {prepareLegacyApply} from '../v6/apply-proposal.mjs';
import {PLAN_KEY,JOURNAL_KEY,applyWithJournal,recoverJournal}
  from '../v6/storage-journal.mjs';

const date='2026-11-14',houseZone='Europe/Amsterdam';
const now=toInstant(date,'12:00',houseZone);
assert.equal(now.ok,true);
const legacyState={
  date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,
  dishes:[
    {id:'a',name:'a',kamado:'large',cook:60,rest:15,grill:120,method:'indirect',
      grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[]},
    {id:'b',name:'b',kamado:'large',cook:60,rest:15,grill:250,method:'direct',
      grate:'cast',mode:'auto',phase:'waiting',prepTasks:[]}
  ],
  v46Done:{other:true},v5Actual:{other:123}
};
const parsed=fromLegacyState(legacyState,{houseZone,now:now.at});
assert.deepEqual(parsed.validation,[]);
const input=parsed.input;
input.kamados.find(k=>k.id==='small').verifiedDishIds=['b'];
input.limits={maxCandidates:96,maxAlternatives:3};
const outcome=optimize(input);
const alternative=outcome.alternatives.find(a=>a.planStatus==='feasible');
assert.ok(alternative);
const proposal=prepareLegacyApply({legacyState,input,outcome,alternativeId:alternative.id});
const before=proposal.expectedSourceJSON,after=proposal.proposedJSON;
let assertions=0;
class StorageMock{
  constructor(){
    this.map=new Map([
      [PLAN_KEY,before],
      ['bbq-v5-previous-plan-v1','DO-NOT-TOUCH'],
      ['kamado-recipe-book-v1','RECIPES-UNCHANGED'],
      ['bbq-v5-session-v1','SESSION-UNCHANGED']
    ]);
    this.events=[];this.fail=null;this.ignore=null;
  }
  getItem(k){this.events.push('get:'+k);return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){
    this.events.push('set:'+k);
    if(this.fail?.('set',k,v))throw Error('SIMULATED_STORAGE_ERROR');
    if(!this.ignore?.('set',k,v))this.map.set(k,String(v));
  }
  removeItem(k){
    this.events.push('remove:'+k);
    if(this.fail?.('remove',k))throw Error('SIMULATED_STORAGE_ERROR');
    if(!this.ignore?.('remove',k))this.map.delete(k);
  }
  raw(k){return this.map.get(k)??null}
}
function bridge(storage,config={}){
  let live=structuredClone(legacyState),lockCount=0;
  const withExclusiveLock=async fn=>{lockCount++;return fn();};
  const commitLiveState=async next=>{
    if(config.beforeCommit)await config.beforeCommit(storage,next);
    live=structuredClone(next);
    if(!config.commitWithoutWrite)storage.setItem(PLAN_KEY,JSON.stringify(live));
    if(config.afterCommit)await config.afterCommit(storage,next);
  };
  const rollbackLiveState=async previous=>{
    if(config.rollbackThrows)throw Error('SIMULATED_ROLLBACK_FAILURE');
    live=structuredClone(previous);
    storage.setItem(PLAN_KEY,JSON.stringify(live));
  };
  return {
    storage,proposal,withExclusiveLock,commitLiveState,rollbackLiveState,
    readLiveState:()=>live,
    setLive:value=>{live=value;},
    getLockCount:()=>lockCount
  };
}
const checkOtherKeys=s=>{
  assert.equal(s.raw('bbq-v5-previous-plan-v1'),'DO-NOT-TOUCH');
  assert.equal(s.raw('kamado-recipe-book-v1'),'RECIPES-UNCHANGED');
  assert.equal(s.raw('bbq-v5-session-v1'),'SESSION-UNCHANGED');
};
const checkResult=(s,expected)=>{
  assert.equal(s.raw(PLAN_KEY),expected);
  checkOtherKeys(s);
};
{
  const s=new StorageMock(),b=bridge(s);
  const res=await applyWithJournal(b);
  assert.equal(res.status,'applied');
  checkResult(s,after);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assert.equal(JSON.stringify(b.readLiveState()),after);
  assert.equal(b.getLockCount(),1);
  assert.ok(s.events.indexOf('set:'+JOURNAL_KEY)<
    s.events.indexOf('set:'+PLAN_KEY),'journal must be durable before plan write');
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  s.setItem(PLAN_KEY,'CONCURRENT-CHANGE');
  await assert.rejects(applyWithJournal(b),/STALE_STORED_PLAN/);
  assert.equal(s.raw(JOURNAL_KEY),null);
  checkResult(s,'CONCURRENT-CHANGE');
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  b.setLive({...legacyState,mealTime:'19:00'});
  await assert.rejects(applyWithJournal(b),/STALE_LIVE_PLAN/);
  checkResult(s,before);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
{
  const s=new StorageMock();
  s.setItem(JOURNAL_KEY,'garbage');
  await assert.rejects(applyWithJournal(bridge(s)),/RECOVERY_REQUIRED/);
  assert.equal(s.raw(JOURNAL_KEY),'garbage');
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock();
  s.fail=(op,key)=>op==='set'&&key===JOURNAL_KEY;
  await assert.rejects(applyWithJournal(bridge(s)),/SIMULATED_STORAGE_ERROR/);
  checkResult(s,before);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
{
  const s=new StorageMock();
  const b=bridge(s,{afterCommit:()=>{throw Error('SIMULATED_COMMIT_FAILURE');}});
  await assert.rejects(applyWithJournal(b),/SIMULATED_COMMIT_FAILURE/);
  checkResult(s,before);
  assert.equal(JSON.stringify(b.readLiveState()),before);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
{
  const s=new StorageMock();
  const b=bridge(s,{commitWithoutWrite:true});
  await assert.rejects(applyWithJournal(b),/COMMIT_VERIFY_FAILED/);
  checkResult(s,before);
  assert.equal(JSON.stringify(b.readLiveState()),before);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
{
  const s=new StorageMock();
  const b=bridge(s,{afterCommit:()=>{throw Error('INTERRUPTED');},
    rollbackThrows:true});
  await assert.rejects(applyWithJournal(b),/RECOVERY_REQUIRED/);
  checkResult(s,after);
  assert.equal(JSON.parse(s.raw(JOURNAL_KEY)).stage,'prepared');
  const recovery=await recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock});
  assert.equal(recovery.status,'rolled_back');
  checkResult(s,before);
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  const journal={version:1,stage:'prepared',before,after};
  s.setItem(JOURNAL_KEY,JSON.stringify(journal));
  s.setItem(PLAN_KEY,after);
  const recovery=await recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock});
  assert.equal(recovery.status,'rolled_back');
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  s.setItem(JOURNAL_KEY,JSON.stringify({version:1,stage:'prepared',before,after}));
  const recovery=await recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock});
  assert.equal(recovery.status,'discarded');
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  s.setItem(JOURNAL_KEY,JSON.stringify({version:1,stage:'committed',before,after}));
  s.setItem(PLAN_KEY,after);
  const recovery=await recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock});
  assert.equal(recovery.status,'finalized');
  checkResult(s,after);
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  s.setItem(JOURNAL_KEY,JSON.stringify({version:1,stage:'prepared',before,after}));
  s.setItem(PLAN_KEY,'CHANGED-BY-ANOTHER-TAB');
  await assert.rejects(recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock}),
    /CONCURRENT_CHANGE/);
  checkResult(s,'CHANGED-BY-ANOTHER-TAB');
  assert.ok(s.raw(JOURNAL_KEY));
  assertions++;
}
{
  const s=new StorageMock(),b=bridge(s);
  s.setItem(JOURNAL_KEY,'{broken');
  await assert.rejects(recoverJournal({storage:s,withExclusiveLock:b.withExclusiveLock}),
    /CORRUPT_JOURNAL/);
  checkResult(s,before);
  assert.equal(s.raw(JOURNAL_KEY),'{broken');
  assertions++;
}
{
  const s=new StorageMock();
  const first=await recoverJournal({storage:s,withExclusiveLock:async fn=>fn()});
  assert.equal(first.status,'clean');
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock();
  await assert.rejects(applyWithJournal({storage:s,proposal}),/LIVE_BRIDGE_REQUIRED/);
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock();
  const b=bridge(s);
  const tampered={...proposal,proposedJSON:'{}'};
  await assert.rejects(applyWithJournal({...b,proposal:tampered}),/INVALID_PROPOSAL/);
  checkResult(s,before);
  assertions++;
}
{
  const s=new StorageMock();
  // Quota/cleanup failure after a verified commit must not be reported as success.
  s.fail=(op,key)=>op==='remove'&&key===JOURNAL_KEY;
  await assert.rejects(applyWithJournal(bridge(s)),/RECOVERY_REQUIRED/);
  assert.equal(JSON.parse(s.raw(JOURNAL_KEY)).stage,'prepared');
  checkResult(s,before);
  s.fail=null;
  const recovery=await recoverJournal({storage:s,withExclusiveLock:async fn=>fn()});
  assert.equal(recovery.status,'discarded');
  assert.equal(s.raw(JOURNAL_KEY),null);
  assertions++;
}
assert.equal(JSON.stringify(legacyState),before,'mock source state changed');
console.log('PASS '+assertions+' PR3 journal scenarios: success, stale, backup, rollback, reload/recovery, errors and unrelated v5 data');
