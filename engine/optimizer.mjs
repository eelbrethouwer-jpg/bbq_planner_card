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
  return d.status !== 'waiting' || d.startConstraint?.kind === 'fixed' ||
    ['startedAt','restAt','doneAt'].some(k => finite(d.immutableActuals?.[k])) ||
    ['startedAt','restAt','doneAt'].some(k => finite(d.actuals?.[k]));
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
function daysAllowed(slot) {
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
  const slots=new Map(input.serveSlots.map(s=>[s.id,s]));
  const resources=[...input.kamados].sort((a,b)=>compareId(a.id,b.id));
  const options=[];
  const dishes=[...input.dishes].sort((a,b)=>compareId(a.id,b.id));
  for(const d of dishes){
    if(isLocked(d))continue;
    if(d.startConstraint?.kind==='fixed')continue;
    if(!slots.has(d.slotId))continue;
    const slot=slots.get(d.slotId);
    if(!finite(slot.at))continue;
    const flexibility=daysAllowed(slot);
    if(flexibility===null)return {options:[],invalidFlexibility:true};
    const destinations=resources.filter(k=>k.id!==d.currentKamadoId);
    for(const k of destinations){
      options.push({dishId:d.id,kamadoId:k.id,delayMin:0});
    }
    for(const minutes of delayValues(flexibility)){
      const newAt=slot.at+minutes*MIN;
      // Preserve course ordering: do not silently move a single dish across another course.
      const main=slots.get('main'),dessert=slots.get('dessert');
      if(d.slotId==='starter'&&finite(main?.at)&&newAt>main.at)continue;
      if(d.slotId==='main'&&finite(dessert?.at)&&newAt>dessert.at)continue;
      if(d.slotId==='dessert'&&finite(main?.at)&&newAt<main.at)continue;
      options.push({dishId:d.id,kamadoId:d.currentKamadoId,delayMin:minutes});
      for(const k of destinations)options.push({dishId:d.id,kamadoId:k.id,delayMin:minutes});
    }
  }
  return {options,invalidFlexibility:false};
}
function candidateInput(input,options){
  const slotMap=new Map(input.serveSlots.map(s=>[s.id,s]));
  const usedIds=new Set(slotMap.keys());
  const created=[];
  const dishes=input.dishes.map(d=>{
    const action=options.find(o=>o.dishId===d.id);
    if(!action)return d; // Share immutable originals, never write to them.
    const out={...d,currentKamadoId:action.kamadoId};
    if(action.delayMin){
      const slot=slotMap.get(d.slotId);
      let name='__v6_opt__'+encodeURIComponent(d.id);
      let suffix=1;
      while(usedIds.has(name))name='__v6_opt__'+encodeURIComponent(d.id)+'_'+(suffix++);
      usedIds.add(name);
      out.slotId=name;
      created.push({...slot,id:name,at:slot.at+action.delayMin*MIN,
        laterAllowedMaxMin:0,fixed:true});
    }
    return out;
  });
  return {...input,serveSlots:[...input.serveSlots,...created],dishes};
}
function changesOf(input,options){
  const byId=new Map(input.dishes.map(d=>[d.id,d]));
  const slots=new Map(input.serveSlots.map(s=>[s.id,s]));
  const changes=[];
  for(const option of options){
    const original=byId.get(option.dishId);
    if(option.kamadoId!==original.currentKamadoId){
      changes.push({type:'kamado',dishId:original.id,
        from:original.currentKamadoId,to:option.kamadoId});
    }
    if(option.delayMin){
      const slot=slots.get(original.slotId);
      changes.push({type:'serve_delay',dishId:original.id,
        from:slot.at,to:slot.at+option.delayMin*MIN,minutes:option.delayMin});
    }
  }
  changes.sort((a,b)=>compareId(a.dishId,b.dishId)||compareId(a.type,b.type));
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
      : 'Serveer '+c.dishId+' '+c.minutes+' minuten later').join('; ')
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
    return {...baseline,planStatus:baseline.planStatus==='infeasible'?'infeasible':'unknown',
      searchStatus:'not_run',validation,conflicts,alternatives:[],
      optimization:{testedCandidates:0,totalCandidates:0,maxCandidates:null,reason:'invalid_limits'}};
  }
  const {maxCandidates,maxAlternatives}=limits;
  const result=(searchStatus,alternatives,testedCandidates,totalCandidates,reason)=>({
    ...baseline,searchStatus,alternatives,optimization:{
      testedCandidates,totalCandidates,maxCandidates,maxAlternatives,reason},
      provenance:{...baseline.provenance,assumptions:[
        ...baseline.provenance.assumptions,
        'PR2 alternatives are previews only; legacy scheduling and storage remain unchanged',
        'Search tests up to two waiting dishes, in 15-minute steps (plus exact allowance)',
        'Unverified destination kamado fit is conditional, not proven',
        'Complete means search space exhausted within the documented two-dish strategy, not global optimality'
      ]}});

  if(baseline.validation.length||baseline.planStatus==='unknown')
    return result('not_run',[],0,0,'invalid_or_unknown_input');
  if(baseline.planStatus==='feasible'||maxAlternatives===0)
    return result('complete',[],0,0,'nothing_to_improve');
  const candidates=candidateOptions(input);
  if(candidates.invalidFlexibility){
    const issue={code:'INVALID_FLEXIBILITY',field:'serveSlots.laterAllowedMaxMin'};
    return {...baseline,planStatus:baseline.planStatus==='infeasible'?'infeasible':'unknown',
      searchStatus:'not_run',validation:[...baseline.validation,issue],
      conflicts:[...baseline.conflicts,{code:'INVALID_FLEXIBILITY',affectedIds:['serveSlots'],
        severity:'unknown',explanation:'Explicit allowed delay must be 0..1440 integer minutes'}],
      alternatives:[],optimization:{testedCandidates:0,totalCandidates:0,
        maxCandidates,maxAlternatives,reason:'invalid_flexibility'}};
  }
  const opts=candidates.options;
  // Count combinations without enumerating all of them; never allocate a factorial search tree.
  let total=opts.length;
  for(let i=0;i<opts.length;i++)for(let j=i+1;j<opts.length;j++)
    if(opts[i].dishId!==opts[j].dishId)total++;
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
      signature:changes.map(c=>c.type+':'+c.dishId+':'+c.to+':'+c.minutes).join('|')});
  }
  for(const option of opts){
    if(tested>=maxCandidates)break;
    consider([option]);
  }
  if(tested<maxCandidates){
    outer: for(let i=0;i<opts.length;i++)for(let j=i+1;j<opts.length;j++){
      if(opts[i].dishId===opts[j].dishId)continue;
      if(tested>=maxCandidates)break outer;
      consider([opts[i],opts[j]]);
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
