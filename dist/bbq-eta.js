/* BBQ Planner v5.14.0 — eigen schattingsmodule (ETA) voor Live, tijdlijn, slim advies en meldingen; en planningshulp (BBQPlan).
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
  maxFitPoints:60,
  // v5.8 — schatting zonder probe. Alle waarden hieronder zijn AANNAMES (grove richtwaarden, geen meting).
  rangeFrac:0.2,       // bereik zonder meting: ±20 % van de resterende kooktijd ...
  rangeMinMin:15,      // ... en minimaal ±15 min
  manualFrac:0.12,     // bereik met één handmatige kerntemperatuur: ±12 % van de rest ...
  manualMinMin:8,      // ... minimaal ±8 min
  manualSlopeFrac:0.08,// bereik met twee of meer handmatige metingen (helling): ±8 % ...
  manualSlopeMinMin:5, // ... minimaal ±5 min
  manualMaxMin:90,     // een handmatige meting ouder dan dit telt niet meer mee
  manualSlopeSpanMin:10,// helling pas als de metingen minstens zoveel minuten uit elkaar liggen
  manualMaxPoints:6,   // hoeveel recente handmatige metingen de helling gebruikt
  startCore:5,         // aanname: kern bij het opleggen (koelkast), voor positie op de curve
  grillMinDiff:10,     // kamadotemperatuur telt pas als hij zo veel °C afwijkt van de planning
  grillAmbient:20,     // eenvoudige schaling (zonder kerndoel): ΔT t.o.v. omgeving
  scaleMin:0.5,scaleMax:2.5
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
/* v5.8 — zonder probe. Handmatige kerntemperaturen en een afwijkende kamadotemperatuur verfijnen een grove, eerlijke schatting.
   Nooit LIVE: de bron heet 'manual' (handmatig) of 'start' (geschat, geen meting). */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function cleanManual(list,now,startedAt,cfg){
  const out=[];
  if(!Array.isArray(list))return out;
  for(const p of list){
    if(!p||typeof p!=='object')continue;
    const t=finiteTime(p.t),core=Number(p.core);
    if(t===null||t>now+MIN||!(p.core!==null&&p.core!==''&&Number.isFinite(core)&&core>=0&&core<=120))continue;
    if(startedAt!==null&&t<startedAt-MIN)continue; // meting van een eerdere keer op de BBQ
    out.push({t,core});
  }
  out.sort((a,b)=>a.t-b.t);
  return out;
}
// Factor op de kooktijd bij een afwijkende kamadotemperatuur. Newton (zoals de curve) als kern- en kamadodoel dat toelaten,
// anders eenvoudige schaling op het temperatuurverschil met de omgeving. null = geen afwijking of geen bruikbare invoer.
function grillScale(o,target,cfg){
  const planned=num(o.grillPlanned),g=o.grillNow&&typeof o.grillNow==='object'?o.grillNow:null;
  if(!g||planned===null)return null;
  const temp=num(g.temp),t=finiteTime(g.t);
  if(temp===null||t===null||temp<=0||Math.abs(temp-planned)<cfg.grillMinDiff)return null;
  const c0=cfg.startCore;let factor=null,model='simple';
  if(target!==null&&target>c0&&planned>target+cfg.newtonGap&&temp>target+cfg.newtonGap){
    factor=Math.log((temp-c0)/(temp-target))/Math.log((planned-c0)/(planned-target));model='newton';
  }else if(planned>cfg.grillAmbient+20&&temp>cfg.grillAmbient+20){
    factor=(planned-cfg.grillAmbient)/(temp-cfg.grillAmbient);
  }
  if(!Number.isFinite(factor)||factor<=0)return null;
  return {t,temp,planned,factor:clamp(factor,cfg.scaleMin,cfg.scaleMax),model};
}
// Einde van de kooktijd uit de echte start + receptduur (minuten, incl. omschakeltijd), met een eventuele kamadocorrectie.
// Voor het moment van de invoer rekent de schatting op de geplande temperatuur, daarna op de ingevoerde.
function startEnd(startedAt,total,grill){
  const full=total*MIN;
  if(!grill)return startedAt+full;
  const tg=Math.max(grill.t,startedAt),done=clamp((tg-startedAt)/full,0,1);
  return tg+full*(1-done)*grill.factor;
}
function rangeAround(end,now,frac,minMin){
  const rem=Math.max(0,end-now),half=Math.max(minMin*MIN,frac*rem);
  return {from:Math.max(now,end-half),to:Math.max(end+half,now+minMin*MIN),begin:end-half,halfMin:Math.round(half/MIN)};
}
// Schatting uit handmatige kerntemperaturen. Eén meting: positie op de (Newton-)curve geijkt aan de planning; twee of meer: helling.
function manualEstimate(pts,o,target,total,grill,now,cfg){
  if(!pts.length||target===null)return null;
  const last=pts[pts.length-1];
  if(now-last.t>cfg.manualMaxMin*MIN)return null;
  const info={n:pts.length,at:last.t,core:last.core,slope:null,model:'point'};
  if(last.core>=target)return {state:'reached',cookEnd:last.t,info};
  let remaining=null;
  const recent=pts.filter(p=>p.t>=now-cfg.manualMaxMin*MIN).slice(-cfg.manualMaxPoints);
  if(recent.length>=2&&(recent[recent.length-1].t-recent[0].t)/MIN>=cfg.manualSlopeSpanMin){
    const fit=theilSen(recent.map(p=>(p.t-last.t)/MIN),recent.map(p=>p.core));
    if(fit&&fit.slope>=cfg.minRise&&fit.slope<=cfg.maxRise){
      const r=(target-last.core)/fit.slope;
      if(Number.isFinite(r)&&r>=0&&r<=cfg.maxHorizonMin){remaining=r;info.slope=fit.slope;info.model='slope';}
    }
  }
  if(remaining===null){
    if(!(total>0))return null;
    const c0=cfg.startCore,planned=num(o.grillPlanned),A=grill?grill.temp:planned;
    if(planned!==null&&A!==null&&target>c0&&planned>target+cfg.newtonGap&&A>target+cfg.newtonGap){
      const k=Math.log((planned-c0)/(planned-target))/total,from=Math.max(c0,last.core);
      remaining=Math.log((A-from)/(A-target))/k;info.model='newton';
    }else{
      const f=clamp((last.core-c0)/(target-c0),0,1);
      remaining=total*(1-f)*(grill?grill.factor:1);info.model='linear';
    }
    if(!Number.isFinite(remaining)||remaining<0||remaining>cfg.maxHorizonMin)return null;
  }
  return {state:'estimate',cookEnd:Math.round(last.t+remaining*MIN),info};
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
   manual:     v5.8, optioneel: handmatige kerntemperaturen [{t,core}] (handthermometer). Nooit LIVE; een verse probe heeft voorrang.
   grillPlanned / grillNow: v5.8, optioneel: geplande kamadotemperatuur en één door de gebruiker ingevoerde {t,temp}.
   target:     einddoel kern (°C) of null
   meater:     {eta,at} alleen als de MEATER-ETA al gevalideerd is (incl. de 2 °C-doelcheck), anders null
   history:    {medianMinutes} uit eigen reviews, of null
   Resultaat bevat altijd `source`: 'curve' | 'meater' | 'manual' | 'start' | 'planning' | 'none'.
   v5.8: `range` {from,to,begin,halfMin} (kooteinde; `begin` = ongeklemd begin, voor de prik-melding) en `readyRange` (incl. rust) bij 'start' en 'manual' (geschat of handmatig, nooit een meting). */
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
    phase:null,stall:null,meater:null,progress:null,points:pts.length,range:null,readyRange:null,manual:null,grill:null,
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
  }else{
    const total=Number(o.cookMinutes)>0?Number(o.cookMinutes)+Math.max(0,Number(o.transitionMinutes)||0):0;
    const grill=grillScale(o,target,cfg);
    const mpts=cleanManual(o.manual,now,startedAt,cfg);
    const lastProbe=pts.length?pts[pts.length-1].t:null;
    // Een verse probe-meting (nieuwer dan de laatste handmatige invoer) heeft altijd voorrang op het handmatige meetpunt.
    const probeWins=lastProbe!==null&&!out.stale&&mpts.length&&lastProbe>=mpts[mpts.length-1].t;
    const man=startedAt!==null&&!probeWins?manualEstimate(mpts,o,target,total,grill,now,cfg):null;
    // Bereik uit de echte start + receptduur: de basis, en de bovengrens voor de breedte van een bereik met een meting.
    const startEndAt=startedAt!==null&&total>0?startEnd(startedAt,total,grill):null;
    const startRange=startEndAt!==null?rangeAround(startEndAt,now,cfg.rangeFrac,cfg.rangeMinMin):null;
    if(grill)out.grill={planned:grill.planned,temp:grill.temp,at:grill.t,factor:grill.factor,model:grill.model};
    const setRange=(end,r)=>{out.range={from:r.from,to:r.to,begin:r.begin,halfMin:r.halfMin};out.readyRange={from:r.from+rest*MIN,to:r.to+rest*MIN};};
    if(man){
      setEnd(man.cookEnd,'manual');out.manual=man.info;out.state=man.state;out.reason='';
      if(man.state==='estimate'){
        const frac=man.info.model==='slope'?cfg.manualSlopeFrac:cfg.manualFrac,min=man.info.model==='slope'?cfg.manualSlopeMinMin:cfg.manualMinMin;
        let r=rangeAround(man.cookEnd,now,frac,min);
        // Een meting maakt de schatting nooit onzekerder: het bereik is altijd smaller dan zonder meting.
        if(startRange){const w=startRange.to-startRange.from;for(let h=r.halfMin;r.to-r.from>=w&&h>1;h--)r=rangeAround(man.cookEnd,now,0,h-1);}
        setRange(man.cookEnd,r);
      }
    }else if(startRange){
      setEnd(startEndAt,'start');setRange(startEndAt,startRange);
      if(mpts.length)out.manual={n:mpts.length,at:mpts[mpts.length-1].t,core:mpts[mpts.length-1].core,slope:null,model:'stale'};
    }else if(finiteTime(o.plannedEnd)!==null){
      setEnd(finiteTime(o.plannedEnd),'planning');
    }
  }
  return out;
}
const api=Object.freeze({estimate,defaults:DEFAULTS,version:'5.14.0'});
root.BBQEta=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* v5.7.0 — planningshulp (window.BBQPlan), in hetzelfde klassieke script als de schatting zodat de planner geen extra loader nodig heeft.
   Puur: geen DOM, geen klok, geen opslag, geen netwerk; `now` is altijd een parameter. Tijden zijn epoch-ms; tekst gebruikt
   de lokale tijd van de aanroeper (zoals de planner zelf). Nooit wijzigen: alleen berekenen en voorstellen. */
(function(root){
'use strict';
const MIN=60000,TWO_HOURS=120*MIN;
const pad=n=>String(n).padStart(2,'0');
const fin=v=>typeof v==='number'&&Number.isFinite(v);
const DAYS=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const hhmm=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())};
const ymd=t=>{const d=new Date(t);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const clockText=(t,ref)=>hhmm(t)+(fin(ref)&&ymd(t)!==ymd(ref)?' ('+DAYS[new Date(t).getDay()]+')':'');
const kamLabel=k=>k==='small'?'kleine kamado':'grote kamado';
const startOfDay=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const endOfDay=t=>{const d=new Date(t);d.setHours(24,0,0,0);return d.getTime()};
const hm=ms=>{const m=Math.max(0,Math.round(ms/MIN));return m>=60?Math.floor(m/60)+' u'+(m%60?' '+m%60+' min':''):m+' min'};

/* 1. Kamado kiezen bij TOEVOEGEN van één gerecht. De aanroeper levert de v45-conflictscore per kamado (bestaande gerechten
   blijven zoals ze zijn). De laagste score wint; bij gelijke score blijft de standaard van het recept. */
function pickKamado(o){
  const s=(o&&o.scores)||{},L=Number(s.large),S=Number(s.small),preferred=o&&o.preferred==='small'?'small':'large';
  if(!Number.isFinite(L)||!Number.isFinite(S))return {kamado:preferred,scores:{large:L,small:S},reason:'unknown',changed:false};
  const kamado=L<S?'large':S<L?'small':preferred;
  return {kamado,scores:{large:L,small:S},reason:L===S?'tie':'fewest-conflicts',changed:kamado!==preferred};
}

/* 2. Urgente conflicten met een directe oplossing. alerts: de urgente meldingen van de planner met `meta`;
   dishes: {id,name,kamado,method,cook,phase}; simulate(id,naar) → aantal urgente conflicten ná verplaatsen (of null). */
function urgentIssues(o){
  o=o||{};
  const alerts=(o.alerts||[]).filter(a=>a&&a.type==='urgent'&&a.meta&&a.meta.kind);
  const dishes=new Map((o.dishes||[]).map(d=>[String(d.id),d]));
  const total=alerts.filter(a=>a.meta.kind==='conflict').length;
  const out=[],groups=new Map();
  for(const a of alerts){
    const m=a.meta;
    if(m.kind==='conflict'){
      const ids=(m.dishIds||[]).map(String).sort(),key=m.kamado+':'+ids.join(':');
      let g=groups.get(key);
      if(!g){g={id:'conflict:'+key,kind:'conflict',kamado:m.kamado,dishIds:ids,reasons:[],fix:null};groups.set(key,g);out.push(g)}
      if(m.reason&&!g.reasons.includes(m.reason))g.reasons.push(m.reason);
    }else if(m.kind==='late-start'&&fin(m.first)&&fin(m.available)){
      const late=Math.ceil((m.available-m.first)/MIN),alt=fin(o.serve)?o.serve+late*MIN:null;
      out.push({id:'late-start',kind:'late-start',fix:null,reasons:[],
        title:'Starttijd '+clockText(m.first,o.serve)+' is al verstreken; je kunt beginnen vanaf '+clockText(m.available,o.serve),
        solution:'Begin om '+clockText(m.first,o.serve)+(alt!==null?' of serveer om '+clockText(alt,o.serve)+', dan begin je om '+clockText(m.available,o.serve)+' zoals je beschikbaar bent':'')+'. Of kies een gerecht dat sneller klaar is.'});
    }else if(m.kind==='manual-late'&&fin(m.start)&&fin(m.offset)){
      out.push({id:'manual-late:'+m.dishId,kind:'manual-late',fix:null,reasons:[],
        title:m.name+' is met de vaste starttijd '+Math.abs(m.offset)+' min te laat klaar',
        solution:'Start '+m.name+' om '+clockText(m.start-m.offset*MIN,o.serve)+(fin(m.serveAt)?' of serveer om '+clockText(m.serveAt+m.offset*MIN,o.serve):'')+'.'});
    }
  }
  for(const g of out){
    if(g.kind!=='conflict')continue;
    const names=(o.dishes||[]).filter(d=>g.dishIds.includes(String(d.id))).map(d=>d.name);
    g.title=names.join(' en ')+' botsen op de '+kamLabel(g.kamado);
    const options=[];
    g.dishIds.forEach((id,index)=>{
      const d=dishes.get(id);if(!d||(d.phase&&d.phase!=='waiting')||typeof o.simulate!=='function')return;
      const to=d.kamado==='small'?'large':'small',left=o.simulate(id,to);
      if(!Number.isFinite(left)||left>=total)return;
      const complex=d.method==='combo'||d.method==='directindirect'?1:0;
      options.push({id,to,left,complex,cook:Number(d.cook)||0,index,name:d.name});
    });
    options.sort((a,z)=>a.left-z.left||a.complex-z.complex||a.cook-z.cook||z.index-a.index);
    const best=options[0];
    if(best){
      const label='Zet '+best.name+' op de '+kamLabel(best.to);
      g.fix={type:'move',dishId:best.id,to:best.to,label,remaining:best.left};
      g.solution=label+(best.left>0?' (dan blijven er nog '+best.left+' urgente conflict'+(best.left===1?'':'en')+' over)':'')+'.';
    }else g.solution='Pas de methode, het rooster of de tijd aan via Planning aanpassen.';
  }
  return out;
}

/* 3. Te laat gestart. Alleen als nog niets is gestart: serveertijd verstreken of vereiste starttijd > drempel (15 min) te laat.
   Nieuwe serveertijd = nu + benodigde tijd (eerste actie → serveren), naar boven afgerond op een hele minuut. */
function lateStart(o){
  o=o||{};
  const base={late:false,reasons:[],lateByMin:0,neededMin:null,newServe:null,date:null,time:null};
  if(o.anyStarted||!fin(o.now)||!fin(o.serve)||!fin(o.first))return base;
  const thr=fin(o.thresholdMin)?o.thresholdMin:15,reasons=[];
  if(o.serve<o.now)reasons.push('serve-past');
  if(o.first<o.now-thr*MIN)reasons.push('start-late');
  if(!reasons.length)return base;
  const needed=Math.max(0,o.serve-o.first),newServe=Math.ceil((o.now+needed)/MIN)*MIN;
  return {late:true,reasons,lateByMin:Math.max(0,Math.round((o.now-o.first)/MIN)),neededMin:Math.round(needed/MIN),
    newServe,date:ymd(newServe),time:hhmm(newServe),oldServe:o.serve,oldFirst:o.first};
}

/* 4. Voorbereiding "avond vooraf" die al voorbij is. tasks: {id,title,kind:'prep'|'recipe',daysBefore,hasTime,timeAt,trigger}. */
const EVENING=/avond|nacht|dag(?:en)?\s*(?:ervoor|vooraf)/i;
function prepOverdue(o){
  o=o||{};const out=[],done=o.done||{};
  if(!fin(o.now))return out;
  for(const t of o.tasks||[]){
    if(!t||done[t.id])continue;
    let due=null;
    if(t.kind==='recipe'){if(!EVENING.test(String(t.trigger||''))||!fin(o.serve))continue;due=startOfDay(o.serve)}
    else{if(!(Number(t.daysBefore)>=1)||!fin(t.timeAt))continue;due=t.hasTime?t.timeAt:endOfDay(t.timeAt)}
    if(o.now<due)continue;
    const lead=fin(o.firstAction)?o.firstAction-o.now:null;let alternative;
    if(lead!==null&&lead>=TWO_HOURS)alternative='Doe het nu: tot de eerste BBQ-actie ('+clockText(o.firstAction,o.serve)+') heb je nog '+hm(lead)+'. Een kortere inwerktijd geeft minder smaak.';
    else if(lead!==null&&lead>0&&fin(o.serve)){
      const shift=Math.ceil((o.serve+(TWO_HOURS-lead))/(5*MIN))*5*MIN;
      alternative='Doe het nu en schuif de serveertijd op naar '+clockText(shift,o.serve)+', zodat er minstens 2 uur zit tussen nu en de eerste BBQ-actie, of sla de stap bewust over.';
    }else alternative='Doe het nu en plan opnieuw vanaf nu bij Start live (de eerste BBQ-actie is al aan de beurt), of sla de stap bewust over.';
    out.push({id:t.id,title:t.title,dueAt:due,when:t.kind==='recipe'?'de avond vooraf':(t.hasTime?DAYS[new Date(t.timeAt).getDay()]+' '+hhmm(t.timeAt):DAYS[new Date(t.timeAt).getDay()]+' (de avond vooraf)'),alternative});
  }
  return out;
}

root.BBQPlan=Object.freeze({pickKamado,urgentIssues,lateStart,prepOverdue,clockText});
})(typeof globalThis!=='undefined'?globalThis:this);
