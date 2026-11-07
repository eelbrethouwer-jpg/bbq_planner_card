/* PR3 stage-only: old v5 writers can never overwrite a separate draft key. */
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fromLegacyState} from '../engine/adapter.mjs';
import {optimize} from '../engine/optimizer.mjs';
import {toInstant} from '../engine/time.mjs';
import {DRAFT_KEY,saveProposalDraft,inspectProposalDraft,discardProposalDraft}
  from '../v6/proposal-draft.mjs';
import {PLAN_KEY,JOURNAL_KEY} from '../v6/storage-journal.mjs';
const subtle=webcrypto.subtle;
const date='2026-11-14',zone='Europe/Amsterdam',now=toInstant(date,'12:00',zone);
assert.ok(now.ok);
const dish=(id,extra={})=>({id,name:'Fictief '+id,kamado:'large',cook:60,
  rest:15,grill:120,method:'indirect',grate:'rvs',mode:'auto',
  phase:'waiting',prepTasks:[],...extra});
const state={date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,dishes:[
    dish('a'),dish('b',{grill:250,method:'direct',grate:'cast'})
  ],v46Done:{},v5Actual:{},notes:'DO-NOT-CLONE-PRIVATE-USER-DATA'};
const converted=fromLegacyState(state,{houseZone:zone,now:now.at});
assert.deepEqual(converted.validation,[]);
const input=converted.input;
input.kamados.find(k=>k.id==='small').verifiedDishIds=['b'];
input.limits={maxCandidates:96,maxAlternatives:3};
const outcome=optimize(input);
const option=outcome.alternatives.find(a=>a.planStatus==='feasible');
assert.ok(option);
const base=JSON.stringify(state);
class Storage{
  constructor(){
    this.m=new Map([
      [PLAN_KEY,base],['bbq-v5-session-v1','SESSION'],
      ['bbq-v5-previous-plan-v1','OLD-BACKUP'],
      ['kamado-recipe-book-v1','RECIPES'],['kamado-reviews-v1','REVIEWS']
    ]);
    this.failWrites=false;
  }
  getItem(k){return this.m.get(k)??null;}
  setItem(k,v){
    if(this.failWrites&&k===DRAFT_KEY)throw Error('QUOTA_BLOCKED');
    this.m.set(k,String(v));
  }
  removeItem(k){this.m.delete(k);}
}
const make=(s=new Storage())=>{
  const withExclusiveLock=async fn=>fn();
  return {storage:s,legacyState:state,input,outcome,
    alternativeId:option.id,expectedStorageJSON:base,subtle,
    withExclusiveLock,now:Date.parse('2026-11-14T16:00:00Z')};
};
const protectedKeys=[
  PLAN_KEY,'bbq-v5-session-v1','bbq-v5-previous-plan-v1',
  'kamado-recipe-book-v1','kamado-reviews-v1'
];
function assertProtected(s){
  assert.equal(s.getItem(PLAN_KEY),base,'v5 plan mutated');
  assert.equal(s.getItem('bbq-v5-session-v1'),'SESSION');
  assert.equal(s.getItem('bbq-v5-previous-plan-v1'),'OLD-BACKUP');
  assert.equal(s.getItem('kamado-recipe-book-v1'),'RECIPES');
  assert.equal(s.getItem('kamado-reviews-v1'),'REVIEWS');
}
let count=0;
{
  const a=make();
  const saved=await saveProposalDraft(a);
  assert.equal(saved.status,'saved');
  assert.equal(saved.record.version,1);
  assert.equal(saved.record.changedDishIds.length,1);
  assert.deepEqual(saved.record.changedSlotIds,[]);
  assert.ok(saved.record.proposedHash.length===64);
  assert.ok(saved.record.sourceHash.length===64);
  const raw=a.storage.getItem(DRAFT_KEY);
  assert.equal(raw,JSON.stringify(saved.record));
  assert.ok(!raw.includes('DO-NOT-CLONE-PRIVATE-USER-DATA'));
  assert.ok(!raw.includes('Fictief b'));
  assertProtected(a.storage);
  assert.equal((await inspectProposalDraft({storage:a.storage,liveState:state,subtle})).status,
    'current');
  // Same browser after restart can inspect using persistent plan data alone.
  assert.equal((await inspectProposalDraft({storage:a.storage,subtle})).status,'current');
  count++;
}
{
  const a=make();
  await saveProposalDraft(a);
  const originalDraft=a.storage.getItem(DRAFT_KEY);
  // A real legacy v5 writer can ignore Web Locks but can only write PLAN_KEY.
  const changed=JSON.stringify({...state,mealTime:'19:00'});
  a.storage.setItem(PLAN_KEY,changed);
  assert.equal(a.storage.getItem(DRAFT_KEY),originalDraft);
  assert.equal((await inspectProposalDraft({storage:a.storage,subtle})).status,'outdated');
  assert.equal(a.storage.getItem(PLAN_KEY),changed);
  await assert.rejects(saveProposalDraft(a),/STALE_STORED_PLAN/);
  assert.equal(a.storage.getItem(DRAFT_KEY),originalDraft);
  count++;
}
{
  const a=make();
  a.storage.setItem(PLAN_KEY,JSON.stringify({...state,mealTime:'19:00'}));
  await assert.rejects(saveProposalDraft(a),/STALE_STORED_PLAN/);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  count++;
}
{
  const a=make();
  const injected={
    digest:async (...args)=>{
      a.storage.setItem(PLAN_KEY,JSON.stringify({...state,mealTime:'19:30'}));
      return subtle.digest(...args);
    }
  };
  await assert.rejects(saveProposalDraft({...a,subtle:injected}),
    /STALE_STORED_PLAN/);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  count++;
}
{
  const a=make();
  a.storage.failWrites=true;
  await assert.rejects(saveProposalDraft(a),/QUOTA_BLOCKED/);
  assertProtected(a.storage);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  count++;
}
{
  const a=make();
  a.storage.setItem(JOURNAL_KEY,'pending recovery');
  await assert.rejects(saveProposalDraft(a),/RECOVERY_REQUIRED/);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  count++;
}
{
  const a=make();
  const fake={...outcome,alternatives:outcome.alternatives.map(v=>({...v,planStatus:'conditional'}))};
  await assert.rejects(saveProposalDraft({...a,outcome:fake}),/UNVERIFIED_ALTERNATIVE/);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  count++;
}
{
  const a=make();
  await saveProposalDraft(a);
  assert.equal((await inspectProposalDraft({storage:a.storage,
    liveState:{...state,mealTime:'18:40'},subtle})).status,'outdated');
  assertProtected(a.storage);
  count++;
}
{
  const a=make();
  a.storage.setItem(DRAFT_KEY,'INVALID JSON');
  assert.equal((await inspectProposalDraft({storage:a.storage,subtle})).status,'corrupt');
  assertProtected(a.storage);
  count++;
}
{
  const a=make();
  await saveProposalDraft(a);
  a.storage.setItem(JOURNAL_KEY,'pending');
  assert.equal((await inspectProposalDraft({storage:a.storage,subtle})).status,
    'unsafe_recovery');
  assertProtected(a.storage);
  count++;
}
{
  const a=make();
  await saveProposalDraft(a);
  assert.equal((await discardProposalDraft(a)).status,'discarded');
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  assert.equal((await inspectProposalDraft({storage:a.storage,subtle})).status,'none');
  assertProtected(a.storage);
  count++;
}
{
  const a=make();
  await assert.rejects(saveProposalDraft({...a,withExclusiveLock:null}),/LOCK_REQUIRED/);
  await assert.rejects(saveProposalDraft({...a,subtle:null}),/DIGEST_UNAVAILABLE/);
  assert.equal(a.storage.getItem(DRAFT_KEY),null);
  assertProtected(a.storage);
  count++;
}
{
  const a=make();
  await saveProposalDraft(a);
  const saved=a.storage.getItem(DRAFT_KEY);
  await saveProposalDraft(a);
  assert.equal(a.storage.getItem(DRAFT_KEY),saved,'same draft deterministic with explicit time');
  assertProtected(a.storage);
  count++;
}
assert.equal(JSON.stringify(state),base);
assert.ok(protectedKeys.length>=5);
console.log('PASS '+count+' PR3 draft-isolation scenarios: explicit save, stale old v5 writer, recoverability, quota, rollback boundaries and privacy');
