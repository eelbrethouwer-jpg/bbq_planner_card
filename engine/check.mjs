/* Pure deterministic v6 shadow checker: no optimizer, no DOM/storage/clock I/O. */
import {localParts,toInstant} from './time.mjs';
const MIN=60000;
const TYPE_ORDER={fire:0,prep:1,on:2,changeover:3,off:4,rest:5,serve:6};
const idsort=(a,b)=>String(a??'')<String(b??'')?-1:String(a??'')>String(b??'')?1:0;
const stable=v=>JSON.stringify(v,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?
  Object.fromEntries(Object.entries(value).sort(([a],[b])=>idsort(a,b))):value);
function fingerprint(x){
  const s=stable(x);let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
const isNum=Number.isFinite;
export function plan(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.dishes)||!Array.isArray(input.kamados)||
      !Array.isArray(input.serveSlots))throw new TypeError('Invalid v6 engine input');
  const conflicts=[],proposedTasks=[],dishes=[],fires={},seenConflicts=new Set();
  const issues=Array.isArray(input.validation)?input.validation:[];
  const houseZone=input.timeZone,serveDate=input.localDate;
  const localDay=instant=>localParts(instant,houseZone).localDate;
  function conflict(code,ids,severity,explanation){
    const affectedIds=[...new Set(ids)].sort(idsort),key=code+'|'+affectedIds.join('|');
    if(seenConflicts.has(key))return;
    seenConflicts.add(key);
    conflicts.push({code,affectedIds,severity,explanation});
  }
  for(const issue of issues)conflict(issue.code,issue.affectedIds||[],'unknown','Unverified source input');
  const validation=issues.map(issue=>({code:issue.code,field:issue.affectedIds?.[0]??'',
    ...(issue.affectedIds?.[0]?.split(':')[0]?{dishId:issue.affectedIds[0].split(':')[0]}:{})}));
  const slots=new Map(input.serveSlots.map(x=>[x.id,x]));
  const kamados=new Map(input.kamados.map(k=>[k.id,k]));
  const parts=new Map(input.kamados.map(k=>[k.id,[]]));
  const starts=new Map(input.kamados.map(k=>[k.id,[]]));
  const seenDishes=new Set();
  const hasInvalidDish=d=>issues.some(issue=>issue.code!=='DUPLICATE_ID'&&
    (issue.affectedIds||[]).some(id=>id===d.id||(id.startsWith(d.id+':')&&!id.includes(':prep:'))));
  function availability(at,code,affectedIds){
    if(!isNum(input.availableAt)||!isNum(at))return;
    const day=localDay(at);
    if(day<serveDate)conflict('AVAILABILITY_UNVERIFIED',affectedIds,'warning','Earlier-day availability is unverified');
    else if(day===serveDate&&at<input.availableAt)
      conflict(code,affectedIds,'blocker','Required action precedes serve-day availability');
  }
  const starter=slots.get('starter'),main=slots.get('main');
  if(starter&&main&&isNum(starter.at)&&isNum(main.at)&&starter.at>main.at)
    conflict('SLOT_ORDER',['starter','main'],'warning','Starter is scheduled after the main course');
  for(const d of input.dishes){
    if(seenDishes.has(d.id)){
      conflict('DUPLICATE_ID',[d.id],'unknown','Duplicate dish ID; only the first is scheduled');
      continue;
    }
    seenDishes.add(d.id);
    if(hasInvalidDish(d))continue;
    const slot=slots.get(d.slotId),k=kamados.get(d.currentKamadoId);
    if(!slot||!isNum(slot.at)){conflict('INVALID_SERVE_SLOT',[d.id],'unknown','Missing serve instant');continue;}
    if(!k){conflict('UNKNOWN_KAMADO',[d.id],'unknown','Missing kamado ID');continue;}
    if(!isNum(d.restMin)||d.restMin<0){conflict('DURATION_UNKNOWN',[d.id],'unknown','Rest duration missing');continue;}
    if(!Array.isArray(d.segments)||!d.segments.length||d.segments.some(seg=>!isNum(seg.durationMin)||seg.durationMin<0)){
      conflict('DURATION_UNKNOWN',[d.id],'unknown','Cooking segment duration missing');continue;
    }
    if(d.segments.some(seg=>seg.method!=='changeover'&&!isNum(seg.heatC))){
      conflict('TEMPERATURE_UNKNOWN',[d.id],'unknown','Cooking temperature is unverified');continue;
    }
    const cookMin=d.segments.reduce((sum,seg)=>sum+seg.durationMin,0);
    if(cookMin<=0){conflict('INVALID_DURATION',[d.id],'unknown','Cook duration must be positive');continue;}
    const pinned=d.startConstraint?.kind==='fixed';
    if(pinned&&!isNum(d.startConstraint.at)){
      conflict('INVALID_FIXED_START',[d.id],'unknown','Fixed start missing');continue;
    }
    const start=pinned?d.startConstraint.at:slot.at-(cookMin+d.restMin)*MIN;
    const cookEnd=start+cookMin*MIN,end=cookEnd+d.restMin*MIN;
    const tol=(isNum(slot.toleranceMin)&&slot.toleranceMin>=0?slot.toleranceMin:0)*MIN;
    if(pinned&&end>slot.at+tol){
      conflict('FIXED_START_MISSES_SERVE',[d.id],'blocker','Fixed start leads to serving too late');
    }else if(pinned&&end<slot.at-tol){
      conflict('HOLD_UNVERIFIED',[d.id],'warning','Unverified holding period before serving');
    }
    availability(start,'EARLIEST_START_AFTER_REQUIRED',[d.id]);
    let cursor=start;
    for(const seg of d.segments){
      const finish=cursor+seg.durationMin*MIN;
      if(seg.durationMin>0){
        parts.get(k.id).push({start:cursor,end:finish,dishId:d.id,id:seg.id,
          method:seg.method,heatC:seg.heatC,accessory:seg.accessory});
        if(seg.method==='changeover')proposedTasks.push({id:seg.id,type:'changeover',
          at:cursor,end:finish,dishId:d.id,kamadoId:k.id});
      }
      cursor=finish;
    }
    starts.get(k.id).push(start);
    proposedTasks.push({id:d.id+':on',type:'on',at:start,dishId:d.id,kamadoId:k.id});
    proposedTasks.push({id:d.id+':off',type:'off',at:cookEnd,dishId:d.id,kamadoId:k.id});
    proposedTasks.push({id:d.id+':serve',type:'serve',at:end,dishId:d.id,kamadoId:k.id});
    if(d.restMin>0)proposedTasks.push({id:d.id+':rest',type:'rest',at:cookEnd,end,
      dishId:d.id,kamadoId:k.id});
    const startDay=localDay(start);
    for(const p of d.preparation||[]){
      const invalidPrep=issues.some(issue=>(issue.affectedIds||[]).some(x=>x===p.id||x.startsWith(p.id+':')));
      if(!p.localDate){
        conflict('INVALID_DATE',[d.id,p.id],'unknown','Preparation date invalid');
      }else if(!invalidPrep){
        if(p.timeKnown){
          if(isNum(p.at)){
            if(p.at+(isNum(p.durationMin)?p.durationMin:0)*MIN>start)
              conflict('PREP_AFTER_START',[d.id,p.id],'blocker','Preparation ends after cooking begins');
            else if(!isNum(p.durationMin)&&localDay(p.at)===startDay)
              conflict('PREP_TIME_UNVERIFIED',[d.id,p.id],'warning','Preparation duration unknown on cook day');
          }
        }else if(p.localDate>startDay){
          conflict('PREP_AFTER_START',[d.id,p.id],'blocker','Undated preparation scheduled on a later day');
        }else if(p.localDate===startDay){
          conflict('PREP_TIME_UNVERIFIED',[d.id,p.id],'warning','Same-day preparation time unknown');
        }
        if(isNum(input.availableAt)&&(p.localDate<serveDate))
          conflict('AVAILABILITY_UNVERIFIED',[d.id,p.id],'warning','Earlier-day preparation availability unverified');
      }
      proposedTasks.push({id:p.id,type:'prep',at:p.timeKnown?p.at:null,
        localDate:p.localDate,timeKnown:p.timeKnown,dishId:d.id,kamadoId:k.id});
    }
    dishes.push({id:d.id,kamadoId:k.id,slotId:d.slotId,start,cookEnd,end,serveAt:slot.at,
      restMin:d.restMin,cookMin,fixed:pinned});
  }
  for(const k of input.kamados){
    const times=starts.get(k.id)||[];
    if(!times.length){fires[k.id]=null;continue}
    if(!isNum(k.preheatMin)){
      fires[k.id]=null;
      conflict('DURATION_UNKNOWN',[k.id],'unknown','Preheat duration missing');continue;
    }
    const at=Math.min(...times)-k.preheatMin*MIN;
    fires[k.id]=at;
    proposedTasks.push({id:k.id+':fire',type:'fire',at,kamadoId:k.id});
    availability(at,'PREHEAT_UNAVAILABLE',[k.id]);
  }
  for(const k of input.kamados){
    const segments=parts.get(k.id)||[];
    for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
      const a=segments[i],b=segments[j];
      if(a.dishId===b.dishId||!overlap(a,b))continue;
      if(a.method==='changeover'||b.method==='changeover'||a.method!==b.method||
        a.accessory!==b.accessory||Math.abs(a.heatC-b.heatC)>25){
        conflict('INCOMPATIBLE_SETUP',[a.dishId,b.dishId],'blocker','Simultaneous setups incompatible');
      }else{
        const capacity=k.capacity?.unit==='dishes'?k.capacity.value:k.maxConcurrent;
        if(isNum(capacity)){
          const begin=Math.max(a.start,b.start),end=Math.min(a.end,b.end);
          const ev=segments.filter(s=>s.method!=='changeover'&&s.start<end&&s.end>begin)
            .flatMap(s=>[{t:Math.max(s.start,begin),n:1},{t:Math.min(s.end,end),n:-1}])
            .sort((x,y)=>x.t-y.t||x.n-y.n);
          let n=0,peak=0;
          for(const event of ev){n+=event.n;peak=Math.max(peak,n)}
          if(peak>capacity)
            conflict('RESOURCE_CAPACITY',[a.dishId,b.dishId],'blocker','Known kamado capacity exceeded');
        }else conflict('CAPACITY_UNVERIFIED',[a.dishId,b.dishId],'warning','Grate space not verified');
      }
    }
    const cooked=segments.filter(s=>s.method!=='changeover')
      .sort((a,b)=>a.start-b.start||a.end-b.end||idsort(a.dishId,b.dishId));
    // For each segment use the other dish whose segment ended *latest* before its own start.
    for(const current of cooked){
      let previous=null;
      for(const candidate of cooked){
        if(candidate.dishId===current.dishId||candidate.end>current.start)continue;
        if(!previous||candidate.end>previous.end||
          (candidate.end===previous.end&&idsort(candidate.dishId,previous.dishId)<0))
          previous=candidate;
      }
      if(!previous)continue;
      const gap=current.start-previous.end;
      const rise=current.heatC-previous.heatC;
      const switchSetup=current.method!==previous.method||current.accessory!==previous.accessory;
      if(rise< -60||(rise>60&&gap<15*MIN)||(switchSetup&&gap<15*MIN))
        conflict('CHANGEOVER_UNVERIFIED',[previous.dishId,current.dishId],'warning',
          'Cooling/heating or setup turnaround is unverified');
    }
  }
  const sortAt=t=>{
    if(t.at!==null&&isNum(t.at))return t.at;
    if(typeof t.localDate==='string'){
      const v=toInstant(t.localDate,'00:00',houseZone,'earlier');
      if(v.ok)return v.at;
    }
    return Infinity;
  };
  proposedTasks.sort((a,b)=>sortAt(a)-sortAt(b)||
    (TYPE_ORDER[a.type]??99)-(TYPE_ORDER[b.type]??99)||
    idsort(a.kamadoId,b.kamadoId)||idsort(a.dishId,b.dishId)||idsort(a.id,b.id));
  const priority={blocker:0,unknown:1,warning:2};
  conflicts.sort((a,b)=>priority[a.severity]-priority[b.severity]||
    idsort(a.code,b.code)||idsort(a.affectedIds.join(','),b.affectedIds.join(',')));
  const planStatus=conflicts.some(c=>c.severity==='blocker')?'infeasible':
    conflicts.some(c=>c.severity==='unknown')?'unknown':
    conflicts.some(c=>c.severity==='warning')?'conditional':'feasible';
  return {planStatus,searchStatus:'not_run',dishes,fires,proposedTasks,conflicts,validation,
    alternatives:[],provenance:{engineVersion:'v6-shadow-pr1',inputFingerprint:fingerprint(input),
    assumptions:['Legacy timings used for read-only comparison','Physical grate capacity unknown unless explicit',
      'Actuals and cooking status ignored until PR4','No optimizer or alternatives in PR1']}};
}
