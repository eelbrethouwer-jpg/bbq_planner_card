/*
 * PR3 recoverable storage transaction. NOT connected to the v5 app.
 *
 * A dedicated write-ahead journal preserves the old plan without touching
 * bbq-v5-previous-plan-v1 (which belongs to "new session").
 *
 * localStorage has atomic single-key writes, NOT a multi-key transaction.
 * Until ALL v5 writers share a cross-tab lock and the live state bridge has
 * been integrated and reviewed, this module must remain a test-only boundary.
 */
export const PLAN_KEY='kamado-bereidingsplanner-v1';
export const JOURNAL_KEY='bbq-v6-apply-journal-v1';

const fail=code=>{throw new Error(code);};
const requireValue=(ok,code)=>{if(!ok)fail(code);};
const parseObject=(raw,code)=>{
  try{
    const value=JSON.parse(raw);
    requireValue(value!==null&&typeof value==='object'&&!Array.isArray(value),code);
    return value;
  }catch{fail(code);}
};
function parseJournal(raw){
  const journal=parseObject(raw,'CORRUPT_JOURNAL');
  requireValue(journal.version===1&&
    ['prepared','committed'].includes(journal.stage)&&
    typeof journal.before==='string'&&typeof journal.after==='string'&&
    journal.before!==journal.after,'CORRUPT_JOURNAL');
  const before=parseObject(journal.before,'CORRUPT_JOURNAL');
  const after=parseObject(journal.after,'CORRUPT_JOURNAL');
  requireValue(Array.isArray(before.dishes)&&Array.isArray(after.dishes),
    'CORRUPT_JOURNAL');
  return journal;
}
function writeJournal(storage,journal){
  const bytes=JSON.stringify(journal);
  storage.setItem(JOURNAL_KEY,bytes);
  requireValue(storage.getItem(JOURNAL_KEY)===bytes,'JOURNAL_VERIFY_FAILED');
}
function removeJournal(storage){
  storage.removeItem(JOURNAL_KEY);
  requireValue(storage.getItem(JOURNAL_KEY)===null,'JOURNAL_CLEANUP_FAILED');
}
function expectedProposal(proposal){
  requireValue(proposal?.requiresDurableBackup===true&&
    typeof proposal.expectedSourceJSON==='string'&&
    typeof proposal.proposedJSON==='string'&&
    typeof proposal.baselineFingerprint==='string','INVALID_PROPOSAL');
  const before=parseObject(proposal.expectedSourceJSON,'INVALID_PROPOSAL');
  const after=parseObject(proposal.proposedJSON,'INVALID_PROPOSAL');
  requireValue(Array.isArray(before.dishes)&&Array.isArray(after.dishes)&&
    JSON.stringify(after)===JSON.stringify(proposal.proposedState)&&
    proposal.expectedSourceJSON!==proposal.proposedJSON,'INVALID_PROPOSAL');
  return {before,after};
}
/**
 * Apply only through a deliberately provided live-app bridge.
 * withExclusiveLock must keep the callback exclusively held until it resolves
 * (e.g. a Web Locks exclusive lock). A JS-local mutex is NOT sufficient.
 *
 * readLiveState: return the current in-memory v5 state.
 * commitLiveState: set live state AND persist the exact JSON synchronously.
 * rollbackLiveState: restore live state AND persist the exact original JSON.
 * All callbacks are required. No direct production wiring is supplied.
 */
export async function applyWithJournal({
  storage,proposal,readLiveState,commitLiveState,rollbackLiveState,withExclusiveLock
}={}){
  requireValue(storage&&['getItem','setItem','removeItem']
    .every(k=>typeof storage[k]==='function'),'INVALID_STORAGE');
  requireValue(typeof readLiveState==='function'&&
    typeof commitLiveState==='function'&&
    typeof rollbackLiveState==='function'&&
    typeof withExclusiveLock==='function','LIVE_BRIDGE_REQUIRED');
  const {before,after}=expectedProposal(proposal);
  return withExclusiveLock(async()=>{
    requireValue(storage.getItem(JOURNAL_KEY)===null,'RECOVERY_REQUIRED');
    requireValue(storage.getItem(PLAN_KEY)===proposal.expectedSourceJSON,
      'STALE_STORED_PLAN');
    requireValue(JSON.stringify(readLiveState())===proposal.expectedSourceJSON,
      'STALE_LIVE_PLAN');
    const journal={version:1,stage:'prepared',
      before:proposal.expectedSourceJSON,after:proposal.proposedJSON};
    writeJournal(storage,journal); // Durable backup BEFORE any plan mutation.
    try{
      requireValue(storage.getItem(PLAN_KEY)===journal.before&&
        JSON.stringify(readLiveState())===journal.before,'STALE_BEFORE_COMMIT');
      await commitLiveState(after);
      requireValue(storage.getItem(PLAN_KEY)===journal.after&&
        JSON.stringify(readLiveState())===journal.after,'COMMIT_VERIFY_FAILED');
      writeJournal(storage,{...journal,stage:'committed'});
      removeJournal(storage);
      return {status:'applied',baselineFingerprint:proposal.baselineFingerprint};
    }catch(error){
      // A commit may have partially updated in-memory or persisted state.
      // Keep a "prepared" journal so restart always rolls back an incomplete
      // operation. Never overwrite a third-party change.
      try{
        writeJournal(storage,journal);
        const current=storage.getItem(PLAN_KEY);
        requireValue(current===journal.before||current===journal.after,
          'CONCURRENT_CHANGE');
        await rollbackLiveState(before);
        requireValue(storage.getItem(PLAN_KEY)===journal.before&&
          JSON.stringify(readLiveState())===journal.before,'ROLLBACK_VERIFY_FAILED');
        removeJournal(storage);
      }catch(rollbackError){
        const failure=new Error('RECOVERY_REQUIRED');
        failure.cause={apply:error,rollback:rollbackError};
        throw failure;
      }
      throw error; // Recovered, but applying must still be reported as failed.
    }
  });
}

/**
 * On startup, BEFORE loading v5's in-memory plan, recover any unfinished
 * transaction. If a third-party write occurred, stop without destroying it.
 */
export async function recoverJournal({storage,withExclusiveLock}={}){
  requireValue(storage&&['getItem','setItem','removeItem']
    .every(k=>typeof storage[k]==='function'),'INVALID_STORAGE');
  requireValue(typeof withExclusiveLock==='function','LOCK_REQUIRED');
  return withExclusiveLock(async()=>{
    const raw=storage.getItem(JOURNAL_KEY);
    if(raw===null)return {status:'clean'};
    const journal=parseJournal(raw);
    const current=storage.getItem(PLAN_KEY);
    requireValue(current===journal.before||current===journal.after,
      'CONCURRENT_CHANGE');
    if(current===journal.after&&journal.stage==='prepared'){
      storage.setItem(PLAN_KEY,journal.before);
      requireValue(storage.getItem(PLAN_KEY)===journal.before,
        'ROLLBACK_VERIFY_FAILED');
      removeJournal(storage);
      return {status:'rolled_back'};
    }
    removeJournal(storage);
    return {status:current===journal.after?'finalized':'discarded'};
  });
}
