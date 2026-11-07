/* Pure view model for PR3. Never modifies the source input or optimizer result. */
const compare=(a,b)=>String(a??'').localeCompare(String(b??''),'nl');
const taskOrder={prep:0,fire:1,on:2,changeover:3,off:4,rest:5,serve:6};
const names={prep:'Voorbereiden',fire:'Aansteken',on:'Opleggen',
  changeover:'Ombouwen',off:'Van het rooster',rest:'Rusten',serve:'Serveren'};
const statuses={feasible:'Haalbaar',conditional:'Onder voorwaarden',
  unknown:'Onzeker',infeasible:'Conflict'};
function when(at,zone,date){
  if(Number.isFinite(at)){
    try{return new Intl.DateTimeFormat('nl-NL',{timeZone:zone||'Europe/Amsterdam',
      day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at));}
    catch{return 'Ongeldige tijd';}
  }
  return date?date+' · tijd onbekend':'Tijd onbekend';
}
function labelChange(change,dishNames){
  if(change.type==='kamado')
    return (dishNames.get(change.dishId)||change.dishId)+': '+change.from+' → '+change.to;
  if(change.type==='serve_delay')
    return 'Gang '+change.slotId+': '+change.minutes+' minuten later';
  return 'Onbekende wijziging';
}
export function buildPreviewModel({input,outcome,selectedId=null,loading=false}={}){
  if(!input||!Array.isArray(input.dishes)||!Array.isArray(input.kamados)||
    !Array.isArray(input.serveSlots))throw new TypeError('Invalid PR3 view input');
  if(!outcome||!Array.isArray(outcome.dishes)||!Array.isArray(outcome.proposedTasks))
    throw new TypeError('Invalid PR3 plan');
  const dishNames=new Map(input.dishes.map(d=>[d.id,d.name||d.id]));
  const alternatives=(Array.isArray(outcome.alternatives)?outcome.alternatives:[])
    .slice(0,3).map(a=>({
      id:a.id,status:a.planStatus,statusLabel:statuses[a.planStatus]||'Onbekend',
      conditional:a.planStatus==='conditional',
      changes:(a.changes||[]).map(c=>labelChange(c,dishNames)),
      warnings:(a.conflicts||[]).filter(c=>c.severity!=='blocker').map(c=>c.code),
      raw:a
    }));
  const selected=alternatives.find(a=>a.id===selectedId)||null;
  const source=selected?{
    dishes:selected.raw.suggestedPlan.dishes,
    tasks:selected.raw.suggestedPlan.tasks,
    fires:selected.raw.suggestedPlan.fires
  }:{dishes:outcome.dishes,tasks:outcome.proposedTasks,fires:outcome.fires};
  const timeline=new Map(input.kamados.map(k=>[k.id,[]]));
  const prep=[];
  for(const task of source.tasks||[]){
    const item={id:task.id,type:task.type,label:names[task.type]||task.type,
      dishId:task.dishId||null,dish:dishNames.get(task.dishId)||task.dishId||null,
      kamadoId:task.kamadoId||null,at:task.at,
      when:when(task.at,input.timeZone,task.localDate),
      localDate:task.localDate||null};
    if(task.type==='prep'||!timeline.has(task.kamadoId))prep.push(item);
    else timeline.get(task.kamadoId).push(item);
  }
  const sorter=(a,b)=>(Number.isFinite(a.at)?a.at:Infinity)-
    (Number.isFinite(b.at)?b.at:Infinity)||
    (taskOrder[a.type]??99)-(taskOrder[b.type]??99)||compare(a.id,b.id);
  prep.sort(sorter);
  const kamados=input.kamados.map(k=>({id:k.id,
    name:k.name||({large:'Grote kamado',small:'Kleine kamado'}[k.id]||k.id),
    tasks:timeline.get(k.id).sort(sorter)}));
  const dishes=source.dishes.map(d=>({
    id:d.id,name:dishNames.get(d.id)||d.id,kamadoId:d.kamadoId,
    slotId:d.slotId,serveAt:d.serveAt,serve:when(d.serveAt,input.timeZone),
    fixed:!!d.fixed
  })).sort((a,b)=>a.serveAt-b.serveAt||compare(a.name,b.name));
  const slots=input.serveSlots.map(s=>{
    const shifted=source.dishes.find(d=>d.slotId===s.id)?.serveAt;
    const at=Number.isFinite(shifted)?shifted:s.at;
    return {id:s.id,at,when:when(at,input.timeZone)};
  }).sort((a,b)=>a.at-b.at||compare(a.id,b.id));
  const warnings=(selected?selected.raw.conflicts:outcome.conflicts||[])
    .filter(c=>c.severity==='blocker'||c.severity==='unknown'||c.severity==='warning')
    .map(c=>({code:c.code,severity:c.severity,affectedIds:c.affectedIds||[]}));
  const search=outcome.optimization||{};
  return {
    dishes,slots,kamados,preparation:prep,warnings,alternatives,selected,
    originalStatus:outcome.planStatus,
    displayedStatus:selected?selected.status:outcome.planStatus,
    statusLabel:statuses[selected?selected.status:outcome.planStatus]||'Onbekend',
    loading:!!loading,searchStatus:outcome.searchStatus||'not_run',
    budgetExhausted:outcome.searchStatus==='budget_exhausted',
    testedCandidates:search.testedCandidates??0,
    totalCandidates:search.totalCandidates??0,
    maxCandidates:search.maxCandidates??null,
    baselineFingerprint:outcome.provenance?.inputFingerprint||null
  };
}
