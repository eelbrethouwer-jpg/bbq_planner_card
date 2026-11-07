/*
 * BBQ Regisseur v6 — PR2 read-only, deterministic bounded alternative search.
 * Does not replace plan(), mutate the input, persist anything or update the PWA.
 */
import {plan} from './check.mjs';

const MIN = 60000;
const STEP_MIN = 15;
const DEFAULT_MAX_CANDIDATES = 96;
const HARD_MAX_CANDIDATES = 512;
const STATUS_RANK = {feasible:0, conditional:1, unknown:2, infeasible:3};
const SEVERITY_RANK = {blocker:0, unknown:1, warning:2};
const compareId = (a,b) => String(a ?? '') < String(b ?? '') ? -1 :
  String(a ?? '') > String(b ?? '') ? 1 : 0;
const finite = Number.isFinite;

function isLocked(d) {
  // Any recorded actual is a lock—even an ISO timestamp from an older/imported session.
  // Fail closed on unrecognised state; never replan a dish with evidence of progress.
  const recorded = v => v !== undefined && v !== null && v !== '';
  const hasActual = source => ['startedAt','restAt','doneAt']
    .some(k => recorded(source?.[k]));
  return d.status !== 'waiting' || d.startConstraint?.kind === 'fixed' ||
    hasActual(d.immutableActuals) || hasActual(d.actuals) || hasActual(d);
}
function conflictCount(result, severity) {
  return result.conflicts.filter(c => c.severity === severity).length;
}
function score(result, changes) {
  return [
    STATUS_RANK[result.planStatus] ?? 4,
    conflictCount(result,'blocker'),
    conflictCount(result,'unknown'),
    conflictCount(result,'warning'),
    changes.length,
    changes.filter(x => x.type === 'kamado').length,
    changes.filter(x => x.type === 'serve_delay').reduce((s,x) => s+x.minutes,0)
  ];
}
function compareScores(a,b) {
  for(let i=0;i<a.length;i++){
    if(a[i]!==b[i]) return a[i]<b[i]?-1:1;
  }
  return 0;
}
function limitsOf(input) {
  const raw=input.limits??{};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const maxCandidates=raw.maxCandidates===undefined?DEFAULT_MAX_CANDIDATES:raw.maxCandidates;
  const maxAlternatives=raw.maxAlternatives===undefined?3:raw.maxAlternatives;
  if(!Number.isInteger(maxCandidates)||maxCandidates<0||maxCandidates>HARD_MAX_CANDIDATES||
      !Number.isInteger(maxAlternatives)||maxAlternatives<0||maxAlternatives>3)return null;
  return {maxCandidates,maxAlternatives};
}
function allowedDelayMin(slot) {
  const n=slot?.laterAllowedMaxMin??0;
  // A minute-accurate, explicit approval only. No guessed flexibility.
  return Number.isInteger(n)&&n>=0&&n<=1440?n:null;
}
function delayValues(max){
  if(!max)return [];
  const values=[];
  for(let n=STEP_MIN;n<max;n+=STEP_MIN)values.push(n);
  if(values.at(-1)!==max)values.push(max);
  return values;
}
function knownFit(kamado,dishId){
  // An absent list does not prove that a piece fits on a given kamado.
  return Array.isArray(kamado?.verifiedDishIds)&&kamado.verifiedDishIds.includes(dishId);
}
function candidateOptions(input){
  const slots=[...input.serveSlots].sort((a,b)=>compareId(a.id,b.id));
  const slotById=new Map(slots.map(s=>[s.id,s]));
  const dishes=[...input.dishes].sort((a,b)=>compareId(a.id,b.id));
  const resources=[...input.kamados].sort((a,b)=>compareId(a.id,b.id));
  const moves=[],delays=[];
  // Separate per-dish resource moves from per-slot delays. Shared serve slots
  // are atomic: no candidate may silently split a main course into two times.
  for(const d of dishes){
    if(isLocked(d)||!slotById.has(d.slotId)||!finite(slotById.get(d.slotId).at))continue;
    for(const k of resources){
      if(k.id!==d.currentKamadoId)moves.push({type:'kamado',dishId:d.id,kamadoId:k.id});
    }
  }
  for(const slot of slots){
    const flexibility=allowedDelayMin(slot);
    if(flexibility===null)return {options:[],moves:[],delays:[],invalidFlexibility:true};
    if(!flexibility||!finite(slot.at))continue;
    const members=dishes.filter(d=>d.slotId===slot.id);
    if(!members.length||members.some(isLocked))continue;
    for(const minutes of delayValues(flexibility)){
      const newAt=slot.at+minutes*MIN;
      const main=slotById.get('main'),dessert=slotById.get('dessert');
      if(slot.id==='starter'&&finite(main?.at)&&newAt>main.at)continue;
      if(slot.id==='main'&&finite(dessert?.at)&&newAt>dessert.at)continue;
      if(slot.id==='dessert'&&finite(main?.at)&&newAt<main.at)continue;
      delays.push({type:'serve_delay',slotId:slot.id,minutes});
    }
  }
  return {options:[...moves,...delays],moves,delays,invalidFlexibility:false};
}
function candidateInput(input,actions){
  const moves=new Map(actions.filter(a=>a.type==='kamado').map(a=>[a.dishId,a]));
  const delays=new Map(actions.filter(a=>a.type==='serve_delay').map(a=>[a.slotId,a]));
  return {
    ...input,
    serveSlots:input.serveSlots.map(slot=>{
      const delay=delays.get(slot.id);
      return delay?{...slot,at:slot.at+delay.minutes*MIN}:slot;
    }),
    dishes:input.dishes.map(d=>{
      const move=moves.get(d.id);
      return move?{...d,currentKamadoId:move.kamadoId}:d;
    })
  };
}
function changesOf(input,actions){
  const byId=new Map(input.dishes.map(d=>[d.id,d]));
  const slots=new Map(input.serveSlots.map(s=>[s.id,s]));
  const changes=[];
  for(const action of actions){
    if(action.type==='kamado'){
      const dish=byId.get(action.dishId);
      changes.push({type:'kamado',dishId:dish.id,
        from:dish.currentKamadoId,to:action.kamadoId});
    }else{
      const slot=slots.get(action.slotId);
      changes.push({type:'serve_delay',slotId:slot.id,
        dishIds:input.dishes.filter(d=>d.slotId===slot.id).map(d=>d.id).sort(compareId),
        from:slot.at,to:slot.at+action.minutes*MIN,minutes:action.minutes});
    }
  }
  changes.sort((a,b)=>compareId(a.dishId??a.slotId,b.dishId??b.slotId)||
    compareId(a.type,b.type));
  return changes;
}
function withFitWarnings(result,input,changes){
  const resources=new Map(input.kamados.map(k=>[k.id,k]));
  const extra=changes.filter(c=>c.type==='kamado'&&!knownFit(resources.get(c.to),c.dishId))
    .map(c=>({code:'KAMADO_FIT_UNVERIFIED',affectedIds:[c.dishId,c.to].sort(compareId),
      severity:'warning',explanation:'Physical size and accessories on destination kamado not verified'}));
  if(!extra.length)return result;
  const conflicts=[...result.conflicts,...extra].sort((a,b)=>
    (SEVERITY_RANK[a.severity]??9)-(SEVERITY_RANK[b.severity]??9)||
    compareId(a.code,b.code)||compareId(a.affectedIds.join(','),b.affectedIds.join(',')));
  return {...result,conflicts,
    planStatus:result.planStatus==='feasible'?'conditional':result.planStatus};
}
function preservedLocked(baseline,candidate,input){
  const locked=new Set(input.dishes.filter(isLocked).map(d=>d.id));
  for(const id of locked){
    const old=baseline.dishes.find(d=>d.id===id);
    const next=candidate.dishes.find(d=>d.id===id);
    if(!old&&!next)continue;
    if(!old||!next)return false;
    for(const field of ['kamadoId','slotId','start','cookEnd','end','serveAt','fixed'])
      if(old[field]!==next[field])return false;
  }
  // A move may change the first ignition time on a kamado even if the
  // already-cooking dish's own timeline is unchanged. Keep that fire fixed.
  const lockedKamados=new Set(input.dishes.filter(isLocked).map(d=>d.currentKamadoId));
  for(const kamadoId of lockedKamados){
    if(baseline.fires[kamadoId]!==candidate.fires[kamadoId])return false;
  }
  return true;
}
function makeAlternative(id,checked,changes){
  return {
    id,
    planStatus:checked.planStatus,
    changes,
    conflicts:checked.conflicts,
    suggestedPlan:{
      dishes:checked.dishes,
      fires:checked.fires,
      tasks:checked.proposedTasks
    },
    feasibleUnderAssumptions:checked.planStatus==='feasible',
    inputFingerprint:checked.provenance.inputFingerprint,
    rationale:changes.map(c=>c.type==='kamado'
      ? 'Verplaats '+c.dishId+' van '+c.from+' naar '+c.to
      : 'Serveer gang '+c.slotId+' ('+c.dishIds.join(', ')+') '+c.minutes+' minuten later').join('; ')
  };
}

/**
 * @param {object} input PR1 adapter input with optional limits and serveSlots[].laterAllowedMaxMin.
 * @returns {object} the unchanged baseline plan plus proposed alternatives; no state writes.
 */
export function optimize(input){
  const baseline=plan(input);
  const limits=limitsOf(input);
  if(!limits){
    const issue={code:'INVALID_LIMITS',field:'limits'};
    const validation=[...baseline.validation,issue];
    const conflicts=[...baseline.conflicts,{code:'INVALID_LIMITS',affectedIds:['limits'],
      severity:'unknown',explanation:'maxCandidates must be 0..512; maxAlternatives must be 0..3'}];
    return {...baseline,searchStatus:'not_run',validation,conflicts,alternatives:[],
      optimization:{testedCandidates:0,totalCandidates:0,maxCandidates:null,reason:'invalid_limits'}};
  }
  const {maxCandidates,maxAlternatives}=limits;
  const result=(searchStatus,alternatives,testedCandidates,totalCandidates,reason)=>({
    ...baseline,searchStatus,alternatives,optimization:{
      testedCandidates,totalCandidates,maxCandidates,maxAlternatives,reason},
      provenance:{...baseline.provenance,assumptions:[
        ...baseline.provenance.assumptions,
        'PR2 alternatives are previews only; legacy scheduling and storage remain unchanged',
        'Search tests one whole-slot delay and/or up to two waiting-dish resource moves, in 15-minute steps (plus exact allowance)',
        'Unverified destination kamado fit is conditional, not proven',
        'Complete means search space exhausted within the documented two-dish strategy, not global optimality'
      ]}});

  if(baseline.validation.length||baseline.planStatus==='unknown')
    return result('not_run',[],0,0,'invalid_or_unknown_input');
  if(maxAlternatives===0)
    return result('not_run',[],0,0,'alternatives_disabled');
  if(baseline.planStatus==='feasible')
    return result('complete',[],0,0,'nothing_to_improve');
  const candidates=candidateOptions(input);
  if(candidates.invalidFlexibility){
    const issue={code:'INVALID_FLEXIBILITY',field:'serveSlots.laterAllowedMaxMin'};
    return {...baseline,searchStatus:'not_run',validation:[...baseline.validation,issue],
      conflicts:[...baseline.conflicts,{code:'INVALID_FLEXIBILITY',affectedIds:['serveSlots'],
        severity:'unknown',explanation:'Explicit allowed delay must be 0..1440 integer minutes'}],
      alternatives:[],optimization:{testedCandidates:0,totalCandidates:0,
        maxCandidates,maxAlternatives,reason:'invalid_flexibility'}};
  }
  const {options:opts,moves,delays}=candidates;
  // Only legal pairs: two resource moves on different dishes, or
  // one whole-slot delay plus one resource move. Never two slot delays.
  const perDish=new Map();
  for(const move of moves)perDish.set(move.dishId,(perDish.get(move.dishId)||0)+1);
  const sameDishPairs=[...perDish.values()].reduce((sum,n)=>sum+n*(n-1)/2,0);
  const twoMoves=moves.length*(moves.length-1)/2-sameDishPairs;
  const total=opts.length+twoMoves+moves.length*delays.length;
  const checked=[];
  let tested=0;
  const baselineScore=score(baseline,[]);
  function consider(actions){
    const snapshot=candidateInput(input,actions);
    const changes=changesOf(input,actions);
    let trial=plan(snapshot);
    trial=withFitWarnings(trial,input,changes);
    tested++;
    if(trial.planStatus==='unknown'||trial.planStatus==='infeasible')return;
    if(!preservedLocked(baseline,trial,input))return;
    const value=score(trial,changes);
    if(compareScores(value,baselineScore)>=0)return;
    checked.push({changes,trial,score:value,
      signature:changes.map(c=>c.type+':'+(c.dishId??c.slotId)+':'+c.to+':'+c.minutes).join('|')});
  }
  for(const option of opts){
    if(tested>=maxCandidates)break;
    consider([option]);
  }
  if(tested<maxCandidates){
    outerMoves:for(let i=0;i<moves.length;i++)for(let j=i+1;j<moves.length;j++){
      if(moves[i].dishId===moves[j].dishId)continue;
      if(tested>=maxCandidates)break outerMoves;
      consider([moves[i],moves[j]]);
    }
  }
  if(tested<maxCandidates){
    outerMixed:for(const delay of delays)for(const move of moves){
      if(tested>=maxCandidates)break outerMixed;
      consider([delay,move]);
    }
  }
  checked.sort((a,b)=>compareScores(a.score,b.score)||compareId(a.signature,b.signature));
  const alternatives=[];
  const seen=new Set();
  for(const c of checked){
    if(seen.has(c.signature))continue;
    seen.add(c.signature);
    alternatives.push(makeAlternative('alternative-'+(alternatives.length+1),c.trial,c.changes));
    if(alternatives.length===maxAlternatives)break;
  }
  return result(tested<total?'budget_exhausted':'complete',alternatives,
    tested,total,tested<total?'candidate_limit':'enumerated_candidate_space');
}
