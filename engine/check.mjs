/* Pure, deterministic shadow checker. No optimizer, I/O, DOM, storage or clocks. */
const MIN=60000;
const TYPE_ORDER={fire:0,prep:1,on:2,changeover:3,off:4,rest:5,serve:6};
const compareStr=(a,b)=>String(a??'').localeCompare(String(b??''),'en');
const stable=(v)=>JSON.stringify(v,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?
  Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value);
function fingerprint(x){
  const s=stable(x);let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
const idsort=(a,b)=>compareStr(a,b);
export function plan(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.dishes)||!Array.isArray(input.kamados)||
      !Array.isArray(input.serveSlots))throw new TypeError('Invalid v6 engine input');
  const conflicts=[],proposedTasks=[],dishes=[],fires={};
  const seen=new Set();
  function conflict(code,affectedIds,level,explanation){
    const ids=[...new Set(affectedIds)].sort(idsort);
    const key=code+'|'+ids.join('|');
    if(!seen.has(key)){
      seen.add(key);
      conflicts.push({code,affectedIds:ids,severity:level,explanation});
    }
  }
  for(const issue of input.validation||[]){
    conflict(issue.code,issue.affectedIds||[],['DUPLICATE_ID','UNKNOWN_KAMADO'].includes(issue.code)?'blocker':'unknown','Invalid or unverified input');
  }
  const slots=new Map(input.serveSlots.map(x=>[x.id,x]));
  const kamados=new Map(input.kamados.map(k=>[k.id,k]));
  const segmentsByKamado=new Map(input.kamados.map(k=>[k.id,[]]));
  const startsByKamado=new Map(input.kamados.map(k=>[k.id,[]]));
  for(const d of input.dishes){
    const affected=[d.id];
    const slot=slots.get(d.slotId),resource=kamados.get(d.currentKamadoId);
    if(!slot||!Number.isFinite(slot.at)){
      conflict('INVALID_SERVE_SLOT',affected,'unknown','Serve instant is unavailable');
      continue;
    }
    if(!resource){
      conflict('UNKNOWN_KAMADO',affected,'blocker','Dish references a missing kamado');
      continue;
    }
    if(d.restMin===null||!Number.isFinite(d.restMin)||d.restMin<0){
      conflict('DURATION_UNKNOWN',affected,'unknown','Rest duration is not verified');continue;
    }
    if(!Array.isArray(d.segments)||!d.segments.length||d.segments.some(s=>!Number.isFinite(s.durationMin)||s.durationMin<0)){
      conflict('DURATION_UNKNOWN',affected,'unknown','Cooking segment duration is not verified');continue;
    }
    const cookMin=d.segments.reduce((sum,s)=>sum+s.durationMin,0);
    const fixed=d.startConstraint?.kind==='fixed',fixedAt=d.startConstraint?.at;
    if(fixed&&!Number.isFinite(fixedAt)){
      conflict('INVALID_FIXED_START',affected,'unknown','Fixed start instant is missing');continue;
    }
    const start=fixed?fixedAt:slot.at-(cookMin+d.restMin)*MIN;
    const cookEnd=start+cookMin*MIN,end=cookEnd+d.restMin*MIN;
    if(fixed&&Math.abs(end-slot.at)>1){
      conflict('FIXED_START_MISSES_SERVE',affected,'blocker','Fixed start plus cook/rest misses serve slot');
      if(end<slot.at-30*MIN)conflict('HOLD_UNVERIFIED',affected,'warning','Holding a dish until serving is unverified');
    }
    if(Number.isFinite(input.availableAt)&&start<input.availableAt){
      conflict('EARLIEST_START_AFTER_REQUIRED',affected,'blocker','Dish must start before the available-from time');
    }
    let cursor=start;
    for(const s of d.segments){
      const finish=cursor+s.durationMin*MIN;
      if(s.durationMin>0){
        segmentsByKamado.get(d.currentKamadoId).push({
          start:cursor,end:finish,dishId:d.id,id:s.id,method:s.method,
          heatC:s.heatC,accessory:s.accessory});
        if(s.method==='changeover')proposedTasks.push({id:s.id,type:'changeover',at:cursor,
          end:finish,dishId:d.id,kamadoId:d.currentKamadoId});
      }
      cursor=finish;
    }
    startsByKamado.get(d.currentKamadoId).push(start);
    proposedTasks.push({id:d.id+':on',type:'on',at:start,dishId:d.id,kamadoId:d.currentKamadoId});
    proposedTasks.push({id:d.id+':off',type:'off',at:cookEnd,dishId:d.id,kamadoId:d.currentKamadoId});
    proposedTasks.push({id:d.id+':serve',type:'serve',at:end,dishId:d.id,kamadoId:d.currentKamadoId});
    if(d.restMin>0)proposedTasks.push({id:d.id+':rest',type:'rest',at:cookEnd,end,
      dishId:d.id,kamadoId:d.currentKamadoId});
    for(const prep of d.preparation||[]){
      if(!prep.localDate)conflict('INVALID_DATE',[d.id,prep.id],'unknown','Preparation date is invalid');
      if(prep.timeKnown&&Number.isFinite(prep.at)&&prep.at>=start){
        conflict('PREP_AFTER_START',[d.id,prep.id],'blocker','Preparation is after cooking starts');
      }
      proposedTasks.push({id:prep.id,type:'prep',at:prep.timeKnown?prep.at:null,
        localDate:prep.localDate,timeKnown:prep.timeKnown,dishId:d.id,kamadoId:d.currentKamadoId});
    }
    dishes.push({id:d.id,kamadoId:d.currentKamadoId,slotId:d.slotId,
      start,cookEnd,end,serveAt:slot.at,restMin:d.restMin,cookMin,fixed});
  }
  // Kamado preheating is modelled per resource, rather than multiplied by dishes.
  for(const k of input.kamados){
    const starts=startsByKamado.get(k.id)||[];
    if(!starts.length){fires[k.id]=null;continue}
    if(!Number.isFinite(k.preheatMin)){
      fires[k.id]=null;conflict('DURATION_UNKNOWN',[k.id],'unknown','Preheat duration missing');
      continue;
    }
    const at=Math.min(...starts)-k.preheatMin*MIN;
    fires[k.id]=at;
    proposedTasks.push({id:k.id+':fire',type:'fire',at,kamadoId:k.id});
    if(Number.isFinite(input.availableAt)&&at<input.availableAt){
      conflict('PREHEAT_UNAVAILABLE',[k.id],'blocker','Kamado must be lit before available-from time');
    }
  }
  for(const k of input.kamados){
    const segments=segmentsByKamado.get(k.id)||[];
    for(let i=0;i<segments.length;i++){
      const a=segments[i];
      for(let j=i+1;j<segments.length;j++){
        const b=segments[j];
        if(a.dishId===b.dishId||!overlap(a,b))continue;
        if(a.method==='changeover'||b.method==='changeover'||a.method!==b.method||
           a.accessory!==b.accessory||(Number.isFinite(a.heatC)&&Number.isFinite(b.heatC)&&
           Math.abs(a.heatC-b.heatC)>25)){
          conflict('INCOMPATIBLE_SETUP',[a.dishId,b.dishId],'blocker','Overlapping incompatible kamado setups');
        }else if(k.capacity?.unit==='dishes'&&Number.isFinite(k.capacity.value)){
          // Concurrency is evaluated in half-open segments; zero-length transitions do not overlap.
          const events=segments.filter(s=>s.method!=='changeover'&&s.start<Math.min(a.end,b.end)&&
            s.end>Math.max(a.start,b.start)).flatMap(s=>[{t:s.start,n:1},{t:s.end,n:-1}])
            .sort((x,y)=>x.t-y.t||x.n-y.n);
          let count=0,peak=0;
          for(const e of events){count+=e.n;peak=Math.max(peak,count)}
          if(peak>k.capacity.value)conflict('RESOURCE_CAPACITY',[a.dishId,b.dishId],'blocker','Kamado capacity exceeded');
        }else conflict('CAPACITY_UNVERIFIED',[a.dishId,b.dishId],'warning','Compatible overlap, grate capacity unknown');
      }
    }
    const cooked=segments.filter(s=>s.method!=='changeover').sort((a,b)=>a.start-b.start||idsort(a.dishId,b.dishId));
    for(let i=1;i<cooked.length;i++){
      const a=cooked[i-1],b=cooked[i];
      if(a.dishId===b.dishId||a.end>b.start)continue;
      const change=a.method!==b.method||a.accessory!==b.accessory||
        (Number.isFinite(a.heatC)&&Number.isFinite(b.heatC)&&Math.abs(a.heatC-b.heatC)>60);
      if(change&&b.start-a.end<15*MIN)
        conflict('CHANGEOVER_UNVERIFIED',[a.dishId,b.dishId],'warning','Turnaround time and thermal recovery unverified');
    }
  }
  proposedTasks.sort((a,b)=>
    ((a.at===null?Infinity:a.at)-(b.at===null?Infinity:b.at))||
    ((TYPE_ORDER[a.type]??99)-(TYPE_ORDER[b.type]??99))||
    idsort(a.kamadoId,b.kamadoId)||idsort(a.dishId,b.dishId)||idsort(a.id,b.id));
  const priority={blocker:0,unknown:1,warning:2};
  conflicts.sort((a,b)=>(priority[a.severity]-priority[b.severity])||
    idsort(a.code,b.code)||idsort(a.affectedIds.join(','),b.affectedIds.join(',')));
  const planStatus=conflicts.some(c=>c.severity==='blocker')?'infeasible':
    conflicts.some(c=>c.severity==='unknown')?'unknown':
    conflicts.some(c=>c.severity==='warning')?'conditional':'feasible';
  return {planStatus,searchStatus:'not_run',dishes,fires,proposedTasks,conflicts,alternatives:[],
    provenance:{engineVersion:'v6-shadow-pr1',inputFingerprint:fingerprint(input)}};
}
