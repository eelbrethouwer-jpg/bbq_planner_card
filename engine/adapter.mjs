/* Read-only conversion of raw legacy state. No mutation, DOM, localStorage or clock calls. */
import {toInstant,subtractLocalDays} from './time.mjs';
const MISS='DURATION_UNKNOWN',BAD='INVALID_DURATION';
function numeric(raw,id,issues,{required=true,max=10000}={}){
  if(raw===null||raw===undefined||raw===''||(typeof raw==='string'&&!raw.trim())){
    if(required)issues.push({code:MISS,affectedIds:[id]});
    return null;
  }
  if(!((typeof raw==='number'&&Number.isFinite(raw))||(typeof raw==='string'&&/^-?\d+(?:\.\d+)?$/.test(raw.trim())))){
    issues.push({code:BAD,affectedIds:[id]});return null;
  }
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0){issues.push({code:BAD,affectedIds:[id]});return null;}
  if(value>max){issues.push({code:'OUT_OF_RANGE',affectedIds:[id]});return null;}
  return value;
}
const issue=(issues,res,id)=>{if(!res.ok)issues.push({code:res.code,affectedIds:[id]});return res.ok?res.at:null;};
const instant=(date,time,zone,id,issues,disambiguation)=>issue(issues,toInstant(date,time,zone,disambiguation),id);
export function fromLegacyState(plainStateJSON,{houseZone,now}={}){
  const validation=[];
  if(!plainStateJSON||typeof plainStateJSON!=='object'||Array.isArray(plainStateJSON)){
    return {input:null,validation:[{code:'INVALID_STATE',affectedIds:[]}]};
  }
  const state=plainStateJSON,zone=houseZone||'Europe/Amsterdam';
  if(!Number.isFinite(now))validation.push({code:'INVALID_NOW',affectedIds:[]});
  const date=state.date;
  const serveSlots=[{id:'main',at:instant(date,state.mealTime,zone,'main',validation)}];
  if(state.v46MultiServe){
    for(const [id,field,fallback] of [['starter','v46Starter','17:30'],['dessert','v46Dessert','19:15']]){
      serveSlots.push({id,at:instant(date,state[field]||fallback,zone,id,validation)});
    }
  }
  const availableAt=state.availableFrom===null||state.availableFrom===undefined?
    null:instant(date,state.availableFrom,zone,'availability',validation);
  const kamados=['large','small'].map(id=>({
    id,preheatMin:numeric(state[id==='large'?'preheatLarge':'preheatSmall'],id+':preheat',validation),
    capacity:null
  }));
  const seen=new Set(),dishes=[];
  for(const [index,d] of (Array.isArray(state.dishes)?state.dishes:[]).entries()){
    if(!d||typeof d!=='object'){validation.push({code:'INVALID_DISH',affectedIds:[String(index)]});continue;}
    const id=typeof d.id==='string'&&d.id.trim()?d.id:'__dish_'+index;
    if(seen.has(id))validation.push({code:'DUPLICATE_ID',affectedIds:[id]});
    seen.add(id);
    const kamado=d.kamado;
    if(!['large','small'].includes(kamado))validation.push({code:'UNKNOWN_KAMADO',affectedIds:[id]});
    const cook=numeric(d.cook,id+':cook',validation),restMin=numeric(d.rest,id+':rest',validation);
    const multi=['combo','directindirect'].includes(d.method);
    const transition=multi?numeric(d.transitionMins,id+':transition',validation):0;
    const phase2=multi?numeric(d.phase2Minutes,id+':phase2',validation):null;
    let segments=[];
    const base={heatC:d.grill,accessory:d.grate||'rvs'};
    if(multi&&cook!==null&&transition!==null&&phase2!==null){
      // Mirrors phaseSegments(): phase 2 is at least 1 min, capped at active cook.
      const p2=Math.min(Math.max(1,phase2),Math.max(1,cook));
      const p1=Math.max(0,cook-p2);
      if(p1>0)segments.push({id:id+':phase1',durationMin:p1,heatC:base.heatC,
        method:d.method==='combo'?'indirect':'direct',accessory:base.accessory});
      if(transition>0)segments.push({id:id+':changeover',durationMin:transition,
        heatC:null,method:'changeover',accessory:'changeover'});
      segments.push({id:id+':phase2',durationMin:p2,heatC:d.phase2Temp,
        method:d.method==='combo'?'direct':'indirect',accessory:d.grate2||'cast'});
    }else if(!multi&&cook!==null){
      segments=[{id:id+':cook',durationMin:cook,heatC:base.heatC,
        method:d.method||'indirect',accessory:base.accessory}];
    }
    const slotId=state.v46MultiServe&&['starter','dessert'].includes(d.serveSlot)?d.serveSlot:'main';
    let fixed=null;
    if(d.mode==='manual')fixed=instant(date,d.fixedStart,zone,id+':fixedStart',validation);
    const preparation=[];
    const prepIds=new Set();
    for(const [pi,p] of (Array.isArray(d.prepTasks)?d.prepTasks:[]).entries()){
      if(!p||typeof p!=='object')continue;
      const pid=String(p.id||'prep-'+pi),taskId=id+':prep:'+pid;
      if(prepIds.has(pid))validation.push({code:'DUPLICATE_ID',affectedIds:[taskId]});
      prepIds.add(pid);
      const days=numeric(p.daysBefore,taskId+':daysBefore',validation,{max:366});
      if(days===null||!Number.isInteger(days)){if(days!==null)validation.push({code:'INVALID_DATE',affectedIds:[taskId]});continue;}
      const localDate=subtractLocalDays(date,days),timeKnown=typeof p.time==='string'&&p.time.trim()!=='';
      let at=null;
      if(timeKnown)at=instant(localDate,p.time,zone,taskId,validation);
      preparation.push({id:taskId,localDate,localTime:timeKnown?p.time:null,
        timeKnown,at,durationMin:p.duration===undefined?null:numeric(p.duration,taskId+':duration',validation,{required:false,max:600})});
    }
    dishes.push({id,name:String(d.name||id),currentKamadoId:kamado,slotId,
      status:['waiting','cooking','resting','done'].includes(d.phase)?d.phase:'waiting',
      segments,restMin,preparation,
      startConstraint:d.mode==='manual'?{kind:'fixed',at:fixed}:null,
      original:{method:d.method,mode:d.mode},immutableActuals:{
        startedAt:d.startedAt??null,restAt:d.restAt??null,doneAt:d.doneAt??null}
    });
  }
  return {input:{now,timeZone:zone,localDate:date,serveSlots,availableAt,kamados,dishes,
    validation:[...validation]},validation};
}
