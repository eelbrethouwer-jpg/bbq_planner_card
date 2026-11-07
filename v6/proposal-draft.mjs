/*
 * PR3: explicit, isolated saved-proposal drafts. Unlike the future "apply"
 * transaction this NEVER writes kamado-bereidingsplanner-v1. Old v5 tabs cannot
 * clobber the separate key, and any source change invalidates the concept.
 * No cryptographic authentication: hashes detect accidental stale snapshots;
 * saved concepts are NOT trusted input to the production apply path.
 */
import {prepareLegacyApply} from './apply-proposal.mjs';
import {PLAN_KEY,JOURNAL_KEY} from './storage-journal.mjs';

export const DRAFT_KEY='bbq-v6-proposal-draft-v1';
const requireState=(ok,code)=>{if(!ok)throw new Error(code);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const json=x=>JSON.stringify(x);
const hash=async(raw,subtle)=>{
  requireState(subtle&&typeof subtle.digest==='function','DIGEST_UNAVAILABLE');
  const data=new TextEncoder().encode(raw);
  const bytes=new Uint8Array(await subtle.digest('SHA-256',data));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
};
function validateRecord(record){
  requireState(isObject(record)&&record.version===1&&
    Number.isFinite(record.createdAt)&&record.createdAt>=0&&
    typeof record.alternativeId==='string'&&record.alternativeId.length>0&&
    typeof record.sourceHash==='string'&&/^[a-f0-9]{64}$/.test(record.sourceHash)&&
    typeof record.liveHash==='string'&&/^[a-f0-9]{64}$/.test(record.liveHash)&&
    typeof record.proposedHash==='string'&&/^[a-f0-9]{64}$/.test(record.proposedHash)&&
    Array.isArray(record.changedDishIds)&&record.changedDishIds.every(x=>typeof x==='string')&&
    Array.isArray(record.changedSlotIds)&&record.changedSlotIds.every(x=>typeof x==='string'),
    'CORRUPT_DRAFT');
}
function validStorage(storage){
  requireState(storage&&['getItem','setItem','removeItem']
    .every(n=>typeof storage[n]==='function'),'INVALID_STORAGE');
}
const clone=o=>JSON.parse(json(o));
export async function inspectProposalDraft({
  storage,liveState,subtle=globalThis.crypto?.subtle
}={}){
  validStorage(storage);
  const raw=storage.getItem(DRAFT_KEY);
  if(raw===null)return {status:'none',record:null};
  let record;
  try{record=JSON.parse(raw);validateRecord(record);}
  catch{return {status:'corrupt',record:null};}
  if(storage.getItem(JOURNAL_KEY)!==null)
    return {status:'unsafe_recovery',record};
  const current=storage.getItem(PLAN_KEY);
  if(typeof current!=='string')return {status:'outdated',record};
  const sourceHash=await hash(current,subtle);
  if(sourceHash!==record.sourceHash)return {status:'outdated',record};
  if(liveState!==undefined){
    const liveHash=await hash(json(liveState),subtle);
    if(liveHash!==record.liveHash)return {status:'outdated',record};
  }
  return {status:'current',record};
}

/**
 * Save a reviewed, FEASIBLE optimizer alternative as a metadata-only concept.
 * No plan data, recipes or old-backup copies are written; no implicit apply.
 * expectedStorageJSON is captured when the preview was produced, not at click.
 *
 * withExclusiveLock serializes cooperating v6 drafts, but old v5 writes only
 * the other key. An old writer changing PLAN_KEY before/during save is
 * detected and the resulting concept becomes outdated; never changes v5 data.
 */
export async function saveProposalDraft({
  storage,legacyState,readLiveState,input,outcome,alternativeId,
  expectedStorageJSON,withExclusiveLock,subtle=globalThis.crypto?.subtle,
  now=Date.now()
}={}){
  validStorage(storage);
  requireState(typeof withExclusiveLock==='function','LOCK_REQUIRED');
  requireState(typeof readLiveState==='function','LIVE_BRIDGE_REQUIRED');
  requireState(typeof expectedStorageJSON==='string','MISSING_SNAPSHOT');
  requireState(Number.isFinite(now)&&now>=0,'INVALID_TIMESTAMP');
  return withExclusiveLock(async()=>{
    const before=storage.getItem(PLAN_KEY);
    requireState(before===expectedStorageJSON,'STALE_STORED_PLAN');
    requireState(storage.getItem(JOURNAL_KEY)===null,'RECOVERY_REQUIRED');
    const source=clone(legacyState);
    const sourceJSON=json(source);
    requireState(sourceJSON===json(legacyState),'INVALID_SOURCE');
    requireState(json(readLiveState())===sourceJSON,'STALE_LIVE_PLAN');
    const candidate=prepareLegacyApply({
      legacyState:source,input,outcome,alternativeId,allowConditional:false
    });
    const record={
      version:1,createdAt:now,alternativeId,
      sourceHash:await hash(before,subtle),
      liveHash:await hash(sourceJSON,subtle),
      proposedHash:await hash(candidate.proposedJSON,subtle),
      changedDishIds:candidate.changedDishIds,
      changedSlotIds:candidate.changedSlotIds
    };
    validateRecord(record);
    requireState(storage.getItem(PLAN_KEY)===before,'STALE_STORED_PLAN');
    requireState(json(readLiveState())===sourceJSON,'STALE_LIVE_PLAN');
    requireState(storage.getItem(JOURNAL_KEY)===null,'RECOVERY_REQUIRED');
    const bytes=json(record);
    storage.setItem(DRAFT_KEY,bytes);
    requireState(storage.getItem(DRAFT_KEY)===bytes,'DRAFT_VERIFY_FAILED');
    // An old legacy tab can change PLAN_KEY after this check; that is fine:
    // inspectProposalDraft will mark this saved metadata outdated.
    return {status:'saved',record};
  });
}
export async function discardProposalDraft({
  storage,withExclusiveLock
}={}){
  validStorage(storage);
  requireState(typeof withExclusiveLock==='function','LOCK_REQUIRED');
  return withExclusiveLock(async()=>{
    storage.removeItem(DRAFT_KEY);
    requireState(storage.getItem(DRAFT_KEY)===null,'DRAFT_DELETE_FAILED');
    return {status:'discarded'};
  });
}
