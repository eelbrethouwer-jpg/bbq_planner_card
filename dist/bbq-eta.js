/* BBQ Planner v5.5.0 — eigen schattingsmodule (ETA) voor Live, tijdlijn, slim advies en meldingen.
   Puur: geen DOM, geen klok, geen opslag, geen netwerk. `now` is altijd een parameter.
   Klassiek script (window.BBQEta), zodat de planner geen module-lader nodig heeft; dezelfde functies
   zijn via de ES-module-ingang in Node testbaar (zie tests/eta-engine.mjs). */
(function(root){
'use strict';
const MIN=60000;
const DEFAULTS=Object.freeze({
  windowMin:12,        // regressievenster: laatste 10–15 min ...
  maxWindowMin:30,     // ... bij schaarse metingen stapsgewijs groter (HA schrijft alleen bij een gewijzigde waarde)
  windowStepMin:3,
  jitterMs:5000,       // tolerantie op tijdstempels (ms-afwijkingen tussen metingen)
  minSpanMin:5,        // pas een tijd na >= 5 min stijging ...
  minPoints:4,         // ... met minstens 4 meetpunten
  freshMin:5,          // ouder: verouderd (bestaande grens van de Live-kaart)
  staleMaxMin:15,      // ouder: niet meer gebruiken, terugvallen op start + duur
  minRise:0.05,        // °C/min; lager is geen bruikbare stijging
  maxRise:6,           // °C/min; hoger is onbetrouwbaar (probe verplaatst, deksel open)
  maxRiseRatio:2,      // helling eerste/tweede helft van het venster; groter is niet stabiel
  stallLow:65,stallHigh:80,stallMin:15,stallRise:0.05,
  newtonGap:5,         // omgeving moet > doel + 5 °C zijn voor het Newton-model
  meaterDisagreeMin:10,
  maxHorizonMin:1440,
  maxFitPoints:60
});
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=-30&&n<=500?n:null;};
const mins=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=1&&n<=10000?n:null;};
const finiteTime=v=>{const n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)&&n>0?n:null;};
function median(a){
  if(!a.length)return null;
  const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
// Robuuste helling (Theil–Sen): mediaan van alle paarsgewijze hellingen.
function theilSen(xs,ys){
  const slopes=[];
  for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){
    const dx=xs[j]-xs[i];if(dx>1e-9)slopes.push((ys[j]-ys[i])/dx);
  }
  if(!slopes.length)return null;
  const slope=median(slopes),intercept=median(ys.map((y,i)=>y-slope*xs[i]));
  return {slope,intercept};
}
function thin(list,max){
  if(list.length<=max)return list;
  const out=[],step=(list.length-1)/(max-1);
  for(let i=0;i<max;i++)out.push(list[Math.round(i*step)]);
  return out;
}
function cleanPoints(points,now){
  const out=[];
  if(!Array.isArray(points))return out;
  for(const p of points){
    if(!p||typeof p!=='object')continue;
    const t=finiteTime(p.t),core=num(p.core);
    if(t===null||core===null||t>now+MIN)continue;
    out.push({t,core,ambient:num(p.ambient)});
  }
  out.sort((a,b)=>a.t-b.t);
  const dedup=[];
  for(const p of out){if(dedup.length&&dedup[dedup.length-1].t===p.t)dedup[dedup.length-1]=p;else dedup.push(p);}
  return dedup;
}
// Kleinste venster (windowMin → maxWindowMin) met >= `count` punten over >= `spanMin` minuten; anders null.
function adaptiveWindow(pts,fromMin,count,spanMin,cfg){
  const last=pts[pts.length-1];
  for(let w=fromMin;;w=Math.min(cfg.maxWindowMin,w+cfg.windowStepMin)){
    const win=pts.filter(p=>p.t>=last.t-w*MIN-cfg.jitterMs);
    if(win.length>=count&&(last.t-win[0].t)/MIN>=spanMin)return {win,minutes:w};
    if(w>=cfg.maxWindowMin)return null;
  }
}
function detectStall(pts,cfg){
  const last=pts[pts.length-1];
  if(last.core<cfg.stallLow||last.core>cfg.stallHigh)return null;
  // Ook bij schaarse metingen: tijdens een stall verandert de waarde weinig, dus HA schrijft weinig punten.
  const found=adaptiveWindow(pts,cfg.stallMin,3,cfg.stallMin*0.95,cfg);
  if(!found)return null;
  const w=found.win;
  if(w.some(p=>p.core<cfg.stallLow-2||p.core>cfg.stallHigh+2))return null;
  const sample=thin(w,cfg.maxFitPoints),fit=theilSen(sample.map(p=>(p.t-last.t)/MIN),sample.map(p=>p.core));
  if(!fit||fit.slope>=cfg.stallRise)return null;
  const level=median(w.map(p=>p.core));
  // Begin van het plateau: terug zolang de kern binnen 1 °C van het stall-niveau blijft.
  let since=w[0].t;
  for(let i=pts.indexOf(w[0])-1;i>=0;i--){if(Math.abs(pts[i].core-level)>1)break;since=pts[i].t;}
  return {level,since,minutes:Math.round((last.t-since)/MIN),rise:fit.slope};
}
// Schatting uit de eigen temperatuurcurve. Tijden zijn verankerd aan de laatste meting, nooit aan `now`.
function curve(pts,target,phaseTargets,cfg){
  const last=pts[pts.length-1];
  const res={state:'insufficient',reason:'',core:last.core,rise:null,ambient:null,model:null};
  const stall=detectStall(pts,cfg);
  if(stall)return {...res,state:'stall',stall,rise:stall.rise,reason:'Stall: de kern blijft rond '+Math.round(stall.level)+' °C hangen; geen betrouwbare tijd'};
  const found=adaptiveWindow(pts,cfg.windowMin,cfg.minPoints,cfg.minSpanMin,cfg);
  if(target!==null&&last.core>=target){
    const from=found?found.win[0].t:last.t-cfg.windowMin*MIN;
    const hit=pts.find(p=>p.t>=from&&p.core>=target)||last;
    return {...res,state:'reached',at:hit.t,reason:''};
  }
  if(!found){
    // Eerlijke reden: wachten helpt alleen als de meetreeks pas net begonnen is.
    const recent=pts.filter(p=>p.t>=last.t-cfg.maxWindowMin*MIN-cfg.jitterMs);
    const span=(last.t-recent[0].t)/MIN,young=pts[0].t>=last.t-cfg.maxWindowMin*MIN-cfg.jitterMs;
    if(young&&span<cfg.minSpanMin)return {...res,reason:'Nog te weinig metingen voor een schatting; wacht ongeveer '+Math.max(1,Math.ceil(cfg.minSpanMin-span))+' min'};
    return {...res,reason:'Te weinig metingen in de laatste '+cfg.maxWindowMin+' min voor een schatting ('+recent.length+' van de minimaal '+cfg.minPoints+')'};
  }
  const win=thin(found.win,cfg.maxFitPoints);
  const xs=win.map(p=>(p.t-last.t)/MIN),ys=win.map(p=>p.core);
  const lin=theilSen(xs,ys);
  if(!lin)return {...res,reason:'Nog te weinig metingen voor een schatting'};
  const ambients=win.map(p=>p.ambient).filter(v=>v!==null);
  const ambient=ambients.length>=Math.ceil(win.length/2)?median(ambients):null;
  res.ambient=ambient;
  if(lin.slope<cfg.minRise)return {...res,rise:lin.slope,reason:'De kern stijgt nauwelijks; nog geen betrouwbare tijd'};
  if(lin.slope>cfg.maxRise)return {...res,rise:lin.slope,reason:'De temperatuur springt te veel; nog geen betrouwbare tijd'};
  if(target===null)return {...res,rise:lin.slope,reason:'Geen kerndoel ingesteld'};
  // Stabiele stijging: de helling in de eerste en tweede helft van het venster moet vergelijkbaar zijn
  // (niet net uit een stall, niet nog sterk versnellend). Anders nog geen tijd.
  const mid=xs[0]/2,firstHalf=win.filter((p,i)=>xs[i]<=mid),secondHalf=win.filter((p,i)=>xs[i]>=mid);
  if(firstHalf.length>=2&&secondHalf.length>=2){
    const a=theilSen(firstHalf.map(p=>(p.t-last.t)/MIN),firstHalf.map(p=>p.core)),b=theilSen(secondHalf.map(p=>(p.t-last.t)/MIN),secondHalf.map(p=>p.core));
    if(a&&b&&(a.slope<cfg.minRise/2||b.slope<cfg.minRise/2||Math.max(a.slope,b.slope)/Math.min(a.slope,b.slope)>cfg.maxRiseRatio))
      return {...res,rise:lin.slope,reason:'De stijging is nog niet stabiel; schatting volgt'};
  }
  const maxCore=Math.max(...ys);
  let model='linear',coreFit,rise,timeTo,residuals,k=null,slopeErrRel;
  const xMean=xs.reduce((s,v)=>s+v,0)/xs.length,sxx=xs.reduce((a,x)=>a+(x-xMean)**2,0);
  if(ambient!==null&&ambient>target+cfg.newtonGap&&ambient>maxCore+cfg.newtonGap){
    // Newton-opwarming: ln(T_omg − T_kern) daalt lineair met helling −k.
    const ly=ys.map(y=>Math.log(ambient-y)),fit=theilSen(xs,ly);
    if(fit&&fit.slope<0){
      model='newton';k=-fit.slope;
      coreFit=ambient-Math.exp(fit.intercept);
      rise=k*(ambient-coreFit);
      timeTo=T=>T<=coreFit?0:Math.log((ambient-coreFit)/(ambient-T))/k;
      residuals=ys.map((y,i)=>y-(ambient-Math.exp(fit.intercept+fit.slope*xs[i])));
      const lres=ly.map((y,i)=>y-(fit.intercept+fit.slope*xs[i]));
      const lsig=1.4826*median(lres.map(Math.abs));
      slopeErrRel=sxx>0?(lsig/Math.sqrt(sxx))/k:1;
    }
  }
  if(model==='linear'){
    coreFit=lin.intercept;rise=lin.slope;
    timeTo=T=>T<=coreFit?0:(T-coreFit)/rise;
    residuals=ys.map((y,i)=>y-(lin.intercept+lin.slope*xs[i]));
    const sig=1.4826*median(residuals.map(Math.abs));
    slopeErrRel=sxx>0?(sig/Math.sqrt(sxx))/rise:1;
  }
  if(coreFit>=target){
    const hit=pts.find(p=>p.t>=win[0].t&&p.core>=target)||last;
    return {...res,state:'reached',at:hit.t,rise:lin.slope,model,reason:''};
  }
  const remaining=timeTo(target);
  if(!Number.isFinite(remaining)||remaining<0||remaining>cfg.maxHorizonMin)return {...res,rise:lin.slope,model,reason:'Schatting valt buiten 24 uur'};
  const sigma=Math.max(0.05,1.4826*median(residuals.map(Math.abs)));
  // Marge uit de spreiding van de residuen (niveau en helling, ~2σ) plus een modelfout.
  const modelFrac=model==='newton'?0.1:0.2;
  const margin=Math.max(1,Math.ceil(2*(remaining*Math.min(1,slopeErrRel)+sigma/rise)+modelFrac*remaining));
  let phase=null;
  for(const raw of phaseTargets){
    const pt=num(raw);
    if(pt===null||pt>=target||pt<=coreFit)continue;
    if(!phase||pt<phase.target){const m=timeTo(pt);phase={target:pt,at:Math.round(last.t+m*MIN),minutes:Math.round(m)};}
  }
  // `rise` is the robust slope over the window (what the user sees); `riseNow` is the model's current rate.
  return {...res,state:'estimate',at:Math.round(last.t+remaining*MIN),remaining,margin,rise:lin.slope,riseNow:rise,model,k,coreFit,sigma,
    confidence:model==='newton'?'normaal':'laag',phase,reason:''};
}
function carryoverAdvice(target,rest,weightKg,allow){
  if(target===null||allow===false)return null;
  const big=Number.isFinite(weightKg)&&weightKg>=1;
  if(!(rest>=10||big))return null;
  const early=rest>=20||(Number.isFinite(weightKg)&&weightKg>=2)?3:2;
  return {pullAt:target-early,degrees:early,
    text:'Doorgaren: haal het van het rooster bij ongeveer '+(target-early)+' °C; tijdens het rusten stijgt de kern nog '+early+' °C. Je doel blijft '+target+' °C.'};
}
/* estimate({points,target,phaseTargets,now,rest,startedAt,cookMinutes,transitionMinutes,plannedEnd,meater,history,weightKg,carryover,heldUntil})
   points:     echte metingen [{t,core,ambient}] (ms, °C)
   heldUntil:  v5.5, optioneel: tot dit tijdstip bevestigt de bron dat de laatste waarde nog geldt (HA last_reported,
               of: de sensor is nog beschikbaar en HA schrijft alleen bij een gewijzigde waarde). Alleen voor de versheid
               (ageMin, stale, expired); er wordt geen meetpunt verzonnen en tijden blijven aan de laatste meting verankerd.
   target:     einddoel kern (°C) of null
   meater:     {eta,at} alleen als de MEATER-ETA al gevalideerd is (incl. de 2 °C-doelcheck), anders null
   history:    {medianMinutes} uit eigen reviews, of null
   Resultaat bevat altijd `source`: 'curve' | 'meater' | 'start' | 'planning' | 'none'. */
function estimate(input){
  const o=input&&typeof input==='object'?input:{};
  const cfg={...DEFAULTS,...(o.options&&typeof o.options==='object'?o.options:{})};
  const now=Number(o.now);
  if(!Number.isFinite(now))throw new TypeError('estimate: now is verplicht');
  const target=num(o.target),rest=Math.max(0,Number(o.rest)||0);
  const phaseTargets=Array.isArray(o.phaseTargets)?o.phaseTargets:[];
  const pts=cleanPoints(o.points,now);
  const startedAt=finiteTime(o.startedAt);
  const out={ok:false,source:'none',state:'none',cookEnd:null,ready:null,margin:null,reason:'',
    asOf:null,ageMin:null,unchangedMin:null,stale:false,core:null,rise:null,ambient:null,model:null,confidence:null,
    phase:null,stall:null,meater:null,progress:null,points:pts.length,
    advice:carryoverAdvice(target,rest,Number(o.weightKg),o.carryover)};
  let c=null;
  if(pts.length){
    const last=pts[pts.length-1];
    const held=finiteTime(o.heldUntil),ref=held!==null&&held>last.t&&held<=now+MIN?Math.min(held,now):last.t;
    out.asOf=last.t;out.ageMin=Math.max(0,Math.floor((now-ref)/MIN));out.core=last.core;
    out.stale=now-ref>cfg.freshMin*MIN;
    out.unchangedMin=Math.max(0,Math.floor((ref-last.t)/MIN));
    if(now-ref>cfg.staleMaxMin*MIN){out.state='expired';out.reason='Laatste meting is ouder dan '+cfg.staleMaxMin+' minuten';}
    else{
      c=curve(pts,target,phaseTargets,cfg);
      out.state=c.state;out.reason=c.reason;out.rise=c.rise;out.ambient=c.ambient;out.model=c.model;
      const median=mins(o.history&&o.history.medianMinutes);
      if(c.stall)out.stall={...c.stall,medianMinutes:median,expectedEnd:startedAt!==null&&median!==null?startedAt+median*MIN:null};
    }
    // Voortgang vanaf de eerste meting van deze sessie (na de start), niet vanaf 0 °C.
    const session=startedAt!==null?pts.filter(p=>p.t>=startedAt-MIN):pts;
    const from=session.length?session[0].core:null;
    if(target!==null&&from!==null&&target-from>1)out.progress={from,pct:Math.max(0,Math.min(100,Math.round((last.core-from)/(target-from)*100)))};
  }else out.reason='Nog geen metingen';
  const m=o.meater&&typeof o.meater==='object'?o.meater:null;
  const meaterEta=m?finiteTime(m.eta):null,meaterAt=m?finiteTime(m.at):null;
  const meaterOk=meaterEta!==null&&meaterAt!==null&&now-meaterAt<=cfg.staleMaxMin*MIN&&meaterAt<=now+MIN;
  const setEnd=(cookEnd,source)=>{out.ok=true;out.source=source;out.cookEnd=cookEnd;out.ready=cookEnd+rest*MIN;};
  if(c&&(c.state==='estimate'||c.state==='reached')){
    setEnd(c.at,'curve');
    if(c.state==='estimate'){out.margin=c.margin;out.phase=c.phase;out.confidence=c.confidence;}
    if(meaterOk){const diff=Math.round((meaterEta-c.at)/MIN);out.meater={cookEnd:meaterEta,diffMin:diff,disagree:Math.abs(diff)>cfg.meaterDisagreeMin};}
  }else if(meaterOk){
    setEnd(meaterEta,'meater');out.meater={cookEnd:meaterEta,diffMin:null,disagree:false};
  }else if(startedAt!==null&&Number(o.cookMinutes)>0){
    setEnd(startedAt+(Number(o.cookMinutes)+Math.max(0,Number(o.transitionMinutes)||0))*MIN,'start');
  }else if(finiteTime(o.plannedEnd)!==null){
    setEnd(finiteTime(o.plannedEnd),'planning');
  }
  return out;
}
const api=Object.freeze({estimate,defaults:DEFAULTS,version:'5.5.0'});
root.BBQEta=api;
})(typeof globalThis!=='undefined'?globalThis:this);
