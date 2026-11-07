/* Read-only conversion of raw legacy state. No mutation, DOM, localStorage or clock calls. */
import {toInstant,subtractLocalDays,localParts} from './time.mjs';
const MISS='DURATION_UNKNOWN',BAD='INVALID_DURATION';
function numeric(raw,id,issues,{required=true,max=10000,missingCode=MISS,invalidCode=BAD,positive=false,integer=false}={}){
  if(raw===null||raw===undefined||raw===''||(typeof raw==='string'&&!raw.trim())){
    if(required)issues.push({code:missingCode,affectedIds:[id]});
    return null;
  }
  if(!((typeof raw==='number'&&Number.isFinite(raw))||(typeof raw==='string'&&/^-?\d+(?:\.\d+)?$/.test(raw.trim())))){
    issues.push({code:invalidCode,affectedIds:[id]});return null;
  }
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0||(positive&&value===0)||(integer&&!Number.isInteger(value))){
    issues.push({code:invalidCode,affectedIds:[id]});return null;
  }
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
  // Follow legacy automatic-date semantics, but use the explicitly injected house clock.
  const today=Number.isFinite(now)?localParts(now,zone).localDate:null;
  const mode=state.dateMode==='auto'||state.dateMode==='manual'?state.dateMode:
    typeof state.date==='string'&&today&&state.date>today?'manual':'auto';
  const date=mode==='auto'&&today?today:state.date;
  const serveSlots=[{id:'main',at:instant(date,state.mealTime,zone,'main',validation),toleranceMin:0,laterAllowedMaxMin:0}];
  if(state.v46MultiServe){
    for(const [id,field,fallback] of [['starter','v46Starter','17:30'],['dessert','v46Dessert','19:15']]){
      serveSlots.push({id,at:instant(date,state[field]||fallback,zone,id,validation),toleranceMin:0,laterAllowedMaxMin:0});
    }
  }
  const availableAt=state.availableFrom===null||state.availableFrom===undefined||state.availableFrom===''?
    null:instant(date,state.availableFrom,zone,'availability',validation);
  const rawDishes=Array.isArray(state.dishes)?state.dishes:[];
  const used=new Set(rawDishes.filter(d=>d&&typeof d==='object').map(d=>d.kamado));
  const kamados=['large','small'].map(id=>({
    id,
    // Preserve valid equipment data even if unused, but unused invalid/absent
    // equipment must not invalidate an otherwise sound existing legacy plan.
    preheatMin:numeric(state[id==='large'?'preheatLarge':'preheatSmall'],id+':preheat',
      used.has(id)?validation:[],{required:used.has(id)}),
    capacity:null
  }));
  const seen=new Set(),dishes=[];
  for(const [index,d] of rawDishes.entries()){
    if(!d||typeof d!=='object'){validation.push({code:'INVALID_DISH',affectedIds:[String(index)]});continue;}
    const id=typeof d.id==='string'&&d.id.trim()?d.id:'__dish_'+index;
    if(seen.has(id)){validation.push({code:'DUPLICATE_ID',affectedIds:[id]});continue;}
    seen.add(id);
    const kamado=d.kamado;
    if(!['large','small'].includes(kamado))validation.push({code:'UNKNOWN_KAMADO',affectedIds:[id]});
    const cook=numeric(d.cook,id+':cook',validation,{positive:true}),restMin=numeric(d.rest,id+':rest',validation);
    const multi=['combo','directindirect'].includes(d.method);
    const transition=multi?numeric(d.transitionMins,id+':transition',validation):0;
    let phase2=multi?numeric(d.phase2Minutes,id+':phase2',validation,{positive:true}):null;
    // Preserve raw phase lengths: invalid fractions must not be silently clamped.
    if(multi&&phase2!==null&&cook!==null&&phase2>cook){
      validation.push({code:'INVALID_DURATION',affectedIds:[id+':phase2']});
      phase2=null;
    }
    const heat=numeric(d.grill,id+':temp',validation,{max:500,missingCode:'TEMPERATURE_UNKNOWN',invalidCode:'INVALID_TEMPERATURE'});
    const heat2=multi?numeric(d.phase2Temp,id+':phase2:temp',validation,{max:500,missingCode:'TEMPERATURE_UNKNOWN',invalidCode:'INVALID_TEMPERATURE'}):null;
    let segments=[];
    const base={heatC:heat,accessory:d.grate||'rvs'};
    if(multi&&cook!==null&&transition!==null&&phase2!==null){
      // Preserve valid phase2 exactly; legacy clamping is intentionally not reproduced.
      const p2=phase2;
      const p1=cook-p2;
      if(p1>0)segments.push({id:id+':phase1',durationMin:p1,heatC:base.heatC,
        method:d.method==='combo'?'indirect':'direct',accessory:base.accessory});
      if(transition>0)segments.push({id:id+':changeover',durationMin:transition,
        heatC:null,method:'changeover',accessory:'changeover'});
      segments.push({id:id+':phase2',durationMin:p2,heatC:heat2,
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
      if(prepIds.has(pid)){validation.push({code:'DUPLICATE_ID',affectedIds:[taskId]});continue;}
      prepIds.add(pid);
      const days=numeric(p.daysBefore,taskId+':daysBefore',validation,{max:366,integer:true});
      if(days===null)continue;
      const localDate=subtractLocalDays(date,days),timeKnown=typeof p.time==='string'&&p.time.trim()!=='';
      let at=null;
      if(timeKnown)at=instant(localDate,p.time,zone,taskId,validation);
      preparation.push({id:taskId,localDate,localTime:timeKnown?p.time:null,
        timeKnown,at,durationMin:p.duration===undefined?null:numeric(p.duration,taskId+':duration',validation,{required:false,max:600})});
    }
    dishes.push({id,name:String(d.name||id),currentKamadoId:kamado,slotId,
      status:['waiting','cooking','resting','done'].includes(d.phase)?d.phase:'waiting',
      segments,restMin,maxHoldMin:null,preparation,
      startConstraint:d.mode==='manual'?{kind:'fixed',at:fixed}:null,
      original:{method:d.method,mode:d.mode},immutableActuals:{
        startedAt:d.startedAt??null,restAt:d.restAt??null,doneAt:d.doneAt??null}
    });
  }
  return {input:{now,timeZone:zone,localDate:date,serveSlots,availableAt,kamados,dishes,
    params:{sameSetupDeltaC:25},validation:[...validation]},validation};
}
