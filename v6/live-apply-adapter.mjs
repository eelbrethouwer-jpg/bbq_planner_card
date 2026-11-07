/*
 * PR3: wiring contract between the existing v5 in-memory plan, the v6
 * optimizer output, and the recoverable journal.
 *
 * This is opt-in and exports no global. It is not loaded by the public v5 UI.
 * Do not mount until every legacy plan writer participates in coordination
 * (or old/uncoordinated clients are reliably excluded). An explicit
 * assertLegacyWriterExclusion callback is REQUIRED for writes and recovery.
 * It is an integration contract, not a way to detect old tabs automatically.
 */
import {prepareLegacyApply} from './apply-proposal.mjs';
import {applyWithJournal,recoverJournal,PLAN_KEY} from './storage-journal.mjs';
import {createPlanLock} from './plan-lock.mjs';

const required=(ok,code)=>{if(!ok)throw new Error(code);};
const snapshot=state=>{
  // Take an immutable *serialized* view; v5 stores this exact JSON shape.
  const raw=JSON.stringify(state);
  required(typeof raw==='string','INVALID_LIVE_STATE');
  const parsed=JSON.parse(raw);
  required(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&
    Array.isArray(parsed.dishes),'INVALID_LIVE_STATE');
  return parsed;
};
export function createLegacyApplyAdapter({
  storage,lockManager,readLiveState,replaceLiveState,refreshView,
  assertLegacyWriterExclusion
}={}){
  required(storage&&['getItem','setItem','removeItem']
    .every(k=>typeof storage[k]==='function'),'INVALID_STORAGE');
  required(typeof readLiveState==='function'&&
    typeof replaceLiveState==='function','LIVE_BRIDGE_REQUIRED');
  if(refreshView!==undefined)
    required(typeof refreshView==='function','INVALID_VIEW_BRIDGE');
  // Old v5 tabs do not use Web Locks. Do not allow writes unless a future
  // boot coordinator can *prove* those tabs cannot write this plan key.
  // An existing Web Lock alone is NOT such proof.
  const validateIsolation=async()=>{
    required(typeof assertLegacyWriterExclusion==='function',
      'LEGACY_WRITER_EXCLUSION_REQUIRED');
    const result=await assertLegacyWriterExclusion();
    required(result===true,'UNCOORDINATED_V5_WRITERS');
  };
  // Deliberately throw on browsers without Web Locks. No unsafe fallback.
  const withExclusiveLock=createPlanLock({lockManager});

  const writeExact=async(next)=>{
    await validateIsolation();
    const target=snapshot(next);
    // v5 must replace its own state reference, never expose separate copies.
    await replaceLiveState(target);
    const serialized=JSON.stringify(readLiveState());
    required(serialized===JSON.stringify(target),'LIVE_REPLACE_FAILED');
    await validateIsolation();
    storage.setItem(PLAN_KEY,serialized);
    required(storage.getItem(PLAN_KEY)===serialized,'PERSIST_FAILED');
    if(refreshView)await refreshView();
  };
  async function apply({input,outcome,alternativeId,allowConditional=false,
    expectedFingerprint=null}={}){
    required(expectedFingerprint!==null&&
      expectedFingerprint===outcome?.provenance?.inputFingerprint,
      'STALE_FINGERPRINT');
    const legacyState=snapshot(readLiveState());
    // Recompute and validate against the live state before entering the lock.
    // applyWithJournal will recheck raw storage and memory while holding it.
    const proposal=prepareLegacyApply({
      legacyState,input,outcome,alternativeId,allowConditional
    });
    // Guard also runs INSIDE the exclusive v6 lock, not only at UI click.
    const withFencedLock=operation=>withExclusiveLock(async()=>{
      await validateIsolation();
      return operation();
    });
    return applyWithJournal({
      storage,proposal,withExclusiveLock:withFencedLock,
      readLiveState,
      commitLiveState:writeExact,
      rollbackLiveState:writeExact
    });
  }
  function onApply({input,outcome,allowConditional=false}={}){
    return (selected,{expectedFingerprint,requiresRollback}={})=>{
      required(requiresRollback===true,'RECOVERY_GUARD_REQUIRED');
      const matching=outcome?.alternatives?.find(a=>a.id===selected?.id);
      required(matching===selected,'STALE_SELECTION');
      return apply({
        input,outcome,alternativeId:selected.id,allowConditional,
        expectedFingerprint
      });
    };
  }
  return {apply,onApply};
}

/**
 * Run BEFORE the v5 boot script reads localStorage or constructs an
 * in-memory state. Must be awaited by a future gated bootstrap.
 * Do not run recovery against an already-live v5 tab.
 */
export function createPreloadRecovery({storage,lockManager,
  assertLegacyWriterExclusion}={}){
  const withExclusiveLock=createPlanLock({lockManager});
  return ()=>recoverJournal({storage,withExclusiveLock:operation=>
    withExclusiveLock(async()=>{
      required(typeof assertLegacyWriterExclusion==='function',
        'LEGACY_WRITER_EXCLUSION_REQUIRED');
      required(await assertLegacyWriterExclusion()===true,
        'UNCOORDINATED_V5_WRITERS');
      return operation();
    })
  });
}
