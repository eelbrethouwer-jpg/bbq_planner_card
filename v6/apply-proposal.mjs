/* PR3 preflight only: translate a verified optimizer preview into a legacy v5 state copy.
 * NO storage access. This is NOT the transaction/rollback adapter.
 */
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {localParts,toInstant} from '../engine/time.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ensure=(ok,code)=>{if(!ok)throw new Error(code);};
const locked=d=>{
  const recorded=v=>v!==null&&v!==undefined&&v!=='';
  return d.status!=='waiting'||d.startConstraint?.kind==='fixed'||
    ['immutableActuals','actuals',null].some(source=>
      ['startedAt','restAt','doneAt'].some(field=>
        recorded((source?d[source]:d)?.[field])));
};
const kamadoInV5=id=>id==='large'||id==='small';
const clock=(at,date,zone)=>{
  ensure(Number.isFinite(at),'INVALID_TARGET_TIME');
  const parts=localParts(at,zone);
  ensure(parts.localDate===date&&parts.second===0,'UNREPRESENTABLE_V5_DATE');
  const converted=toInstant(date,parts.localTime,zone);
  ensure(converted.ok&&converted.at===at,'UNREPRESENTABLE_V5_TIME');
  return parts.localTime;
};
function checkSource(legacyState,input){
  ensure(legacyState&&typeof legacyState==='object'&&!Array.isArray(legacyState),
    'INVALID_LEGACY_STATE');
  ensure(Array.isArray(legacyState.dishes)&&Array.isArray(input?.dishes),
    'INVALID_SOURCE_INPUT');
  const rebuilt=fromLegacyState(legacyState,{
    houseZone:input.timeZone,now:input.now
  });
  ensure(rebuilt.input&&rebuilt.validation.length===0,'INVALID_LEGACY_SOURCE');
  const a=rebuilt.input;
  ensure(a.timeZone===input.timeZone&&a.localDate===input.localDate&&
    a.availableAt===input.availableAt,'STALE_SOURCE');
  // Check the complete original dish contract; only optimizer configuration
  // (limits, kamado capacity / fit, explicit slot flexibility) may differ.
  ensure(same(a.dishes,input.dishes),'STALE_DISHES');
  ensure(a.serveSlots.length===input.serveSlots.length&&
    a.serveSlots.every((s,i)=>{
      const t=input.serveSlots[i];
      return s.id===t.id&&s.at===t.at&&s.toleranceMin===t.toleranceMin;
    }),'STALE_SLOTS');
  ensure(a.kamados.length===input.kamados.length&&
    a.kamados.every((k,i)=>k.id===input.kamados[i].id&&
      k.preheatMin===input.kamados[i].preheatMin),'STALE_KAMADOS');
  return a;
}

/**
 * Build a read-only legacy v5 plan copy. Throws on stale/unsupported changes.
 * An actual persistence adapter MUST compare source against storage again,
 * retain a durable recovery snapshot, and commit atomically or fail closed.
 */
export function prepareLegacyApply({
  legacyState,input,outcome,alternativeId,allowConditional=false
}={}){
  ensure(input&&outcome&&Array.isArray(outcome.alternatives),'INVALID_OPTIMIZER_RESULT');
  const source=checkSource(legacyState,input);
  const baseline=plan(input);
  ensure(outcome.provenance?.inputFingerprint===baseline.provenance.inputFingerprint&&
    outcome.planStatus===baseline.planStatus,'STALE_OPTIMIZER_RESULT');
  ensure(outcome.alternatives.length<=3,'INVALID_ALTERNATIVE_COUNT');
  const alternative=outcome.alternatives.find(a=>a.id===alternativeId);
  ensure(alternative&&Array.isArray(alternative.changes)&&
    alternative.changes.length>=1&&alternative.changes.length<=2,
    'INVALID_ALTERNATIVE');
  ensure(alternative.planStatus==='feasible'||
    (allowConditional===true&&alternative.planStatus==='conditional'),
    'UNVERIFIED_ALTERNATIVE');

  const patch=new Map(),slotUpdates=new Map();
  const sourceDishes=new Map(source.dishes.map(d=>[d.id,d]));
  const sourceSlots=new Map(input.serveSlots.map(s=>[s.id,s]));
  for(const change of alternative.changes){
    if(change.type==='kamado'){
      ensure(!patch.has(change.dishId),'DUPLICATE_MOVE');
      const original=sourceDishes.get(change.dishId);
      ensure(original&&!locked(original)&&
        kamadoInV5(change.from)&&kamadoInV5(change.to)&&
        original.currentKamadoId===change.from&&change.from!==change.to&&
        input.kamados.some(k=>k.id===change.to),'UNSAFE_KAMADO_MOVE');
      patch.set(change.dishId,change.to);
    }else if(change.type==='serve_delay'){
      ensure(slotUpdates.size===0,'MULTIPLE_SLOT_DELAYS');
      const original=sourceSlots.get(change.slotId);
      const members=source.dishes.filter(d=>d.slotId===change.slotId);
      const names=members.map(d=>d.id).sort();
      ensure(original&&members.length>0&&members.every(d=>!locked(d))&&
        same(change.dishIds,names)&&Number.isInteger(change.minutes)&&
        change.minutes>0&&change.minutes<=original.laterAllowedMaxMin&&
        change.from===original.at&&change.to===original.at+change.minutes*60000,
        'UNSAFE_SLOT_DELAY');
      ensure(['main','starter','dessert'].includes(change.slotId),
        'UNSUPPORTED_SLOT');
      ensure(change.slotId==='main'||legacyState.v46MultiServe===true,
        'UNSUPPORTED_MULTISERVE');
      // v5 stores a single wall-date and HH:MM, not an absolute serve instant.
      const field={main:'mealTime',starter:'v46Starter',dessert:'v46Dessert'}[change.slotId];
      slotUpdates.set(change.slotId,{field,time:clock(change.to,input.localDate,input.timeZone)});
    }else throw new Error('UNSUPPORTED_CHANGE');
  }
  ensure(!(patch.size===2&&slotUpdates.size>0),'UNSUPPORTED_COMBINATION');

  const candidateInput={
    ...input,
    dishes:input.dishes.map(d=>patch.has(d.id)?{...d,currentKamadoId:patch.get(d.id)}:d),
    serveSlots:input.serveSlots.map(s=>slotUpdates.has(s.id)?
      {...s,at:alternative.changes.find(c=>c.type==='serve_delay'&&c.slotId===s.id).to}:s)
  };
  const candidate=plan(candidateInput);
  ensure(alternative.inputFingerprint===candidate.provenance.inputFingerprint&&
    same(alternative.suggestedPlan?.dishes,candidate.dishes)&&
    same(alternative.suggestedPlan?.fires,candidate.fires)&&
    same(alternative.suggestedPlan?.tasks,candidate.proposedTasks),
    'TAMPERED_ALTERNATIVE');
  ensure(candidate.planStatus!=='infeasible'&&candidate.planStatus!=='unknown',
    'UNSAFE_CANDIDATE');

  const updated={
    ...legacyState,
    dishes:legacyState.dishes.map(d=>patch.has(d.id)?
      {...d,kamado:patch.get(d.id)}:{...d})
  };
  for(const {field,time} of slotUpdates.values())updated[field]=time;
  ensure(!same(updated,legacyState),'NO_CHANGE');
  return {
    proposedState:updated,
    expectedSourceJSON:JSON.stringify(legacyState),
    proposedJSON:JSON.stringify(updated),
    baselineFingerprint:baseline.provenance.inputFingerprint,
    alternativeId:alternative.id,
    changedDishIds:[...patch.keys()],
    changedSlotIds:[...slotUpdates.keys()],
    requiresDurableBackup:true
  };
}
