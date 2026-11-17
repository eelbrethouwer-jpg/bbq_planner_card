/* BBQ Planner v5.0.0 — session-first experience. Keep v4 calculations and storage as source of truth.
   v5.3.0: Live shows one card per dish (core → target, ambient, rise, 'op tafel rond' with source, one coach line).
   v5.4.0: the card uses the shared estimate (own curve → MEATER ETA → start + duration → planning), anchored at the last reading.
   v5.5.0: timeline on Live (planned frame + expected blocks, now and serve line), a "Zo meteen" hero from estimate + phase,
           automatic MEATER recognition in the HA card, and "Pas planning aan op verwachting" only after a before/after confirmation. */
(function(){
'use strict';
window.initBBQV5=function(b){
  const KEY='bbq-v5-session-v1',BACKUP='bbq-v5-previous-plan-v1',escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const clock=t=>Number.isFinite(t)?new Date(t).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'—';
  const day=t=>Number.isFinite(t)?new Date(t).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}):'Datum onbekend';
  const taskTime=t=>Number.isFinite(t)&&new Date(t).toDateString()!==new Date().toDateString()?day(t)+' '+clock(t):clock(t);
  const labelKam=k=>k==='large'?'Grote kamado':k==='small'?'Kleine kamado':'Algemeen';
  const categoryIcon={rund:'🥩',varken:'🥓',gevogelte:'🍗',vis:'🐟',lam:'🍖',groenten:'🥦',vegetarisch:'🥬',dessert:'🍰',overig:'🍽️'};
  let wakeLock=null,wakePending=false,livePlan=new Map();
  // v5.5 in-memory UI state only (never stored): open probe choices on cards, acknowledged hero actions, open adjust panel.
  const probeEdit=new Set(),heroAck=new Set();let adjustOpen=false;
  let meta={active:false,stage:'select',created:''},screen='home',recipeSearch='',legacyFrom='home',legacyTab='',legacyReturn='',legacyReturnScroll=0,showAllTasks=false,recipeFilter='all';
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object'&&saved.version===1){meta={active:saved.active===true,stage:['select','setup','prep','live','finished'].includes(saved.stage)?saved.stage:'select',created:String(saved.created||'')}}}catch(e){}
  const state=()=>b.getState();
  const dishes=()=>state().dishes||[];
  function saveMeta(){try{localStorage.setItem(KEY,JSON.stringify({...meta,version:1}))}catch(e){/* Only session navigation metadata; dishes remain in v4 storage */}}
  function commit(){b.commit();}
  function goto(next){screen=next;if(['select','setup','prep','live'].includes(next)&&meta.active){meta.stage=next;saveMeta();}render();try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch(e){}}
  function logo(){return '<div class="v5-top"><div class="v5-brand"><span class="v5-flame">🔥</span><div><div class="v5-title">BBQ Planner</div><div class="v5-sub">Rustig samen koken</div></div></div><span class="v5-chip neutral">'+escape(day(Date.parse(state().date)))+'</span></div>'}
  function progress(n){return '<div class="v5-steps" aria-label="Stap '+n+' van 3">'+[1,2,3].map(i=>'<span class="'+(i<=n?'on':'')+'"></span>').join('')+'</div>'}
  function action(label,act,variant='subtle',disabled=false){return '<button type="button" class="v5-btn '+variant+'" data-v5-act="'+escape(act)+'"'+(disabled?' disabled':'')+'>'+label+'</button>'}
  const heading=(cap,title,copy)=>'<p class="v5-eyebrow">'+escape(cap)+'</p><h1 class="v5-h1">'+escape(title)+'</h1>'+(copy?'<p class="v5-copy">'+escape(copy)+'</p>':'');
  function row(icon,label,sub,act){return '<button type="button" class="v5-list-row" data-v5-act="'+escape(act)+'"><span class="v5-row-ico" aria-hidden="true">'+icon+'</span><span class="v5-row-text"><strong>'+escape(label)+'</strong>'+(sub?'<small>'+escape(sub)+'</small>':'')+'</span><span class="v5-row-chev" aria-hidden="true">›</span></button>'}
  function home(){
    // v5.2: one clear primary action. An active session is resumed first; otherwise start a new one.
    const s=state(),n=dishes().length,hasPlan=n>0,active=meta.active&&hasPlan,isLive=active&&meta.stage==='live';
    const summary=n+' gerecht'+(n===1?'':'en')+' · serveren '+(s.mealTime||'—')+' · '+day(Date.parse(s.date));
    let primary,secondary='';
    if(active){
      const all=isLive?b.getTasks().filter(t=>!t.id.includes(':prep:')):[],done=s.v46Done||{},finished=all.filter(t=>done[t.id]).length;
      const stageLabel={select:'Gerechten kiezen',setup:'Planning',prep:'Voorbereiden',live:'Live koken'}[meta.stage]||'Planning';
      primary='<section class="v5-card v5-home-primary" aria-labelledby="v5-home-title"><p class="v5-eyebrow">Actieve sessie · '+escape(stageLabel)+'</p>'+
        '<h2 id="v5-home-title">'+(isLive?'▶ Hervat live bereiding':'▶ Ga verder met je planning')+'</h2><p class="v5-muted">'+escape(summary)+'</p>'+
        (isLive&&all.length?'<progress class="v5-home-progress" max="'+all.length+'" value="'+finished+'" aria-label="'+finished+' van '+all.length+' handelingen afgerond"></progress><p class="v5-muted">'+finished+' van '+all.length+' handelingen afgerond</p>':'')+
        action(isLive?'Verder met koken →':'Verder →','resume','primary v5-wide')+'</section>';
      secondary=row('＋','Nieuwe sessie starten','Je huidige planning wordt eerst als reservekopie bewaard','new');
    }else{
      primary='<section class="v5-card v5-home-primary" aria-labelledby="v5-home-title"><h2 id="v5-home-title">🔥 Nieuwe BBQ-sessie</h2>'+
        '<p class="v5-muted">Kies gerechten, stel de serveertijd in en volg stap voor stap wat er moet gebeuren.</p>'+
        action('＋ Nieuwe sessie samenstellen','new','primary v5-wide')+'</section>';
      if(hasPlan)secondary=row('📋','Bestaande planning openen',summary,'resume');
    }
    return heading(active?'Welkom terug':'Welkom bij jouw BBQ',active?'Jouw BBQ-sessie':'Wat gaan we bereiden?','')+primary+
      '<div class="v5-list">'+secondary+row('📖','Recepten','Eigen bibliotheek, import en BBQ Junkie','recipes')+row('📈','Historie en reviews','Eerdere bereidingen en leerpunten','history')+'</div>';
  }
  function allRecipes(){
    return Object.entries(b.getRecipes()).filter(([name,r])=>r&&typeof r==='object'&&r.name).sort((a,z)=>a[0].localeCompare(z[0],'nl')).map(([key,r])=>({...r,_key:key}));
  }
  function recipeCard(r){
    const name=String(r.name||r._key),origin=b.recipeOrigin(name),already=dishes().some(d=>d.name===name);
    const photo=typeof r.photo==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(r.photo)?'<img loading="lazy" alt="" src="'+r.photo+'">':null;
    return '<button type="button" class="v5-recipe'+(already?' selected':'')+'" data-v5-recipe="'+escape(r._key)+'" aria-label="'+escape((already?'Nogmaals toevoegen: ':'Toevoegen: ')+name)+'">'+
      (photo||'<div class="v5-recipe-icon" aria-hidden="true">'+(categoryIcon[r.category]||categoryIcon.overig)+'</div>')+
      '<span class="v5-recipe-body"><span class="v5-origin">'+(origin==='own'?'Eigen':'Voorbeeld')+'</span><span class="v5-recipe-name">'+escape(name)+'</span><span class="v5-recipe-foot">'+(already?'✓ In menu · tik voor extra portie':'＋ Toevoegen · ±'+escape(r.cook||'?')+' min')+'</span></span></button>';
  }
  function recipeGrid(){
    const needle=recipeSearch.trim().toLocaleLowerCase('nl-NL'),results=allRecipes().filter(r=>(recipeFilter==='all'||b.recipeOrigin(r.name)===recipeFilter)&&(r.name+' '+r.category).toLocaleLowerCase('nl-NL').includes(needle));
    return results.length?results.map(recipeCard).join(''):'<div class="v5-empty">Geen recepten gevonden. Importeer een recept via je receptenbibliotheek.</div>';
  }
  function menuLines(removeOnly=false){
    return dishes().map(d=>'<div class="v5-dishline"><div><strong>'+escape(d.name)+'</strong><small>'+escape(labelKam(d.kamado))+' · ±'+escape(d.cook)+' min garen</small></div>'+
      '<button type="button" class="v5-mini-btn" data-v5-remove="'+escape(d.id)+'" aria-label="Verwijder '+escape(d.name)+'">✕</button></div>').join('');
  }
  function select(){
    return heading('Stap 1 van 3','Kies je gerechten','Tik op een recept om het aan jouw BBQ-menu toe te voegen. Je kunt ook recepten toevoegen uit je eigen bibliotheek.')+progress(1)+
      '<label class="v5-field v5-filter">Zoek gerechten<input id="v5-search" type="search" class="v5-input" placeholder="Bijv. ribeye, pulled pork, zalm..." value="'+escape(recipeSearch)+'"></label>'+
      '<div class="v5-origin-filters" aria-label="Herkomst recepten">'+[['all','Alle'],['own','Eigen'],['example','Voorbeelden']].map(([value,label])=>'<button type="button" class="v5-btn subtle" data-v5-filter="'+value+'" aria-pressed="'+(recipeFilter===value)+'">'+label+'</button>').join('')+'</div>'+
      '<div class="v5-recipes" id="v5-recipe-list">'+recipeGrid()+'</div>'+
      '<div class="v5-card"><h3>Jouw menu ('+dishes().length+')</h3>'+(dishes().length?menuLines():'<p class="v5-muted">Nog geen gerechten geselecteerd.</p>')+'</div>'+
      '<div class="v5-row">'+action('📝 Recept uit tekst maken','recipe-generate')+action('📚 Mijn bibliotheek','recipes')+action('🔥 BBQ Junkie','recipe-junkie')+action('← Startscherm','home')+'</div>'+
      '<div class="v5-sticky-actions"><div><strong>'+dishes().length+' gerechten gekozen</strong><small>Groot en klein combineren</small></div>'+action('Volgende →','setup','primary',!dishes().length)+'</div>';
  }
  function setup(){
    const s=state(),c=b.calculate();
    const alerts=c.alerts||[];
    return heading('Stap 2 van 3','Plan de BBQ-dag','Bepaal wanneer je wilt serveren en verdeel gerechten over beide kamado’s. Bereidingstijden blijven schattingen.')+progress(2)+
    '<div class="v5-card v5-serve-card"><h3>🍽️ Serveermoment</h3><div class="v5-grid v5-serve-fields">'+
      '<label class="v5-field">Datum<span class="v5-input-frame"><input class="v5-input" type="date" data-v5-setting="date" value="'+escape(s.date)+'"></span></label>'+
      '<label class="v5-field">Serveren om<span class="v5-input-frame"><input class="v5-input" type="time" data-v5-setting="mealTime" value="'+escape(s.mealTime)+'"></span></label>'+
      '<label class="v5-field">Beschikbaar vanaf<span class="v5-input-frame"><input class="v5-input" type="time" data-v5-setting="availableFrom" value="'+escape(s.availableFrom)+'"></span></label>'+
      '<label class="v5-field">Aantal personen<span class="v5-input-frame"><input class="v5-input" type="number" min="1" max="50" data-v5-setting="v45People" value="'+escape(s.v45People||4)+'"></span></label>'+
    '</div><p class="v5-muted">Voor een diner met meerdere gangen kun je in de uitgebreide planning aparte serveertijden instellen.</p></div>'+
    '<div class="v5-card"><h3>🔥 Verdeel de gerechten en thermometers</h3>'+dishes().map(d=>'<div class="v5-dishline v5-setup-dish"><div><strong>'+escape(d.name)+'</strong><small>±'+escape(d.cook)+' min · BBQ '+escape(d.grill)+' °C</small></div>'+
      '<div class="v5-setup-selects"><select class="v5-input" aria-label="Kamado voor '+escape(d.name)+'" data-v5-kamado="'+escape(d.id)+'"><option value="large"'+(d.kamado==='large'?' selected':'')+'>Groot</option><option value="small"'+(d.kamado==='small'?' selected':'')+'>Klein</option></select>'+
      meaterSelect(d)+'</div></div>').join('')+
      '<div class="v5-row" style="margin-top:14px">'+action('⚙ Temperatuur / methode wijzigen','planning')+'</div></div>'+
    '<div class="v5-card"><h3>⏱️ Planning in het kort</h3><div class="v5-grid"><div><span class="v5-muted">Grote kamado aan</span><div class="v5-number">'+clock(c.fires.large)+'</div></div><div><span class="v5-muted">Kleine kamado aan</span><div class="v5-number">'+clock(c.fires.small)+'</div></div></div>'+
       (alerts.length?'<details class="v5-alerts" data-v5-key="alerts"><summary>⚠️ '+alerts.length+' aandachtspunt(en) — bekijken</summary>'+alerts.slice(0,12).map(a=>'<p>'+a.message+'</p>').join('')+'</details>':'<p class="v5-muted">Geen planningsconflicten gedetecteerd. Controleer de praktische roosterruimte zelf.</p>')+'</div>'+
    '<div class="v5-row">'+action('← Gerechten','select')+action('Naar voorbereiding →','prep','primary')+'</div>';
  }
  function prepTasks(){
    const s=state(),tasks=b.getPrepTasks().map(t=>({id:s.date+'|'+t.dishId+':prep:'+t.id,title:t.titleFull,when:t.time?day(t.timeAt)+' '+clock(t.timeAt):day(t.timeAt)+' · tijdstip zelf bepalen',detail:t.notes||'',sort:t.timeAt}));
    const idSet=new Set(tasks.map(t=>t.id));
    for(const d of dishes()){
      const steps=Array.isArray(d.recipeSteps)?d.recipeSteps:[];
      steps.forEach((r,i)=>{
        if(!/avond|dag(?:en)?\s*(?:ervoor|vooraf)|nacht|vooraf/i.test(r.trigger||''))return;
        // A separately scheduled preparation already covers the same preceding day.
        if(Array.isArray(d.prepTasks)&&d.prepTasks.some(t=>Number(t.daysBefore)>0))return;
        const id=s.date+'|'+d.id+':recipe:'+i;
        if(!idSet.has(id)){tasks.push({id,title:(r.title||'Voorbereiding')+' · '+d.name,when:r.trigger||'Vooraf voorbereiden',detail:r.detail||'',sort:0});idSet.add(id)}
      });
      if(!tasks.some(t=>t.id.includes('|'+d.id+':'))&&d.recipePrep){
        const id=s.date+'|'+d.id+':prep-general';
        tasks.push({id,title:'Voorbereiding · '+d.name,when:'Voor de bereiding · eigen tijdstip kiezen',detail:d.recipePrep,sort:0});
      }
    }
    return tasks.sort((a,z)=>a.sort-z.sort);
  }
  function checklist(tasks){
    const done=state().v46Done||{};
    return tasks.map(t=>'<div class="v5-check'+(done[t.id]?' done':'')+'"><input type="checkbox" id="v5-check-'+escape(t.id)+'" data-v5-check="'+escape(t.id)+'"'+(done[t.id]?' checked':'')+'><label for="v5-check-'+escape(t.id)+'"><strong>'+escape(t.title)+'</strong><small><span data-v5-when>'+escape(t.when||'')+'</span>'+(done[t.id]&&t.time!=null&&Number.isFinite(state().v5Actual?.[t.id])?' · gedaan '+clock(state().v5Actual[t.id]):'')+(t.detail?'\n'+escape(t.detail):'')+'</small></label></div>').join('');
  }
  function prep(){
    const tasks=prepTasks(),done=state().v46Done||{},count=tasks.filter(t=>done[t.id]).length;
    return heading('Stap 3 van 3','Voorbereiden','Alles wat je alvast kunt doen. Een taak zonder exacte tijd mag je zelf inplannen; de app verzint geen startmoment.')+progress(3)+
    '<div class="v5-card"><div class="v5-between"><h3>✅ Voorbereidingslijst</h3><span class="v5-chip neutral">'+count+' / '+tasks.length+' gedaan</span></div>'+
    (tasks.length?checklist(tasks):'<div class="v5-empty">Geen afzonderlijke voorbereidingsstappen vastgelegd. Bekijk het recept voor snij- en voorbereidingsinstructies.</div>')+'</div>'+
    '<div class="v5-card"><h3>🛒 Nog nodig?</h3><p class="v5-muted">Je automatische boodschappenlijst, voorraad en uitgebreide receptinstructies blijven beschikbaar.</p>'+action('Open boodschappenlijst','more')+'</div>'+
    '<div class="v5-row">'+action('← Planning','setup')+action('🔥 Start live BBQ-sessie','live','primary')+'</div>';
  }
  const PROBE_LABEL={pro:'MEATER Pro',plus:'MEATER Plus'};
  const hasProbe=d=>d&&(d.meater==='pro'||d.meater==='plus');
  function meaterSelect(d,extra=''){
    // v5.3: the existing d.meater field; one probe can only belong to one dish.
    const used=k=>dishes().some(x=>x.id!==d.id&&x.meater===k);
    const value=hasProbe(d)?d.meater:'none';
    return '<select class="v5-input'+extra+'" aria-label="Thermometer voor '+escape(d.name)+'" data-v5-meater="'+escape(d.id)+'">'+
      '<option value="none"'+(value==='none'?' selected':'')+'>Geen thermometer</option>'+
      ['pro','plus'].map(k=>'<option value="'+k+'"'+(value===k?' selected':'')+(used(k)&&value!==k?' disabled':'')+'>'+PROBE_LABEL[k]+(used(k)&&value!==k?' (bezet)':'')+'</option>').join('')+'</select>';
  }
  const temp=(v,digits=1)=>Number(v).toLocaleString('nl-NL',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const goalOf=d=>{const g=Number(d?.core);return d&&d.core!==''&&d.core!=null&&Number.isFinite(g)&&g>0?g:null};
  function ageText(p){
    // v5.5 (review PR #44, finding 2): HA keeps an unchanged value without a new timestamp. While the sensor is available
    // that is "no change since", not a stale reading. Unavailable sensors never reach this function.
    if(p.unchanged)return '● Geen verandering sinds '+clock(p.changedAt)+' · HA meldt de waarde nog';
    // The timestamp is from HA, never fabricated by the one-second display ticker.
    const age=Number.isFinite(p.updatedAt)?Math.max(0,Math.floor((Date.now()-p.updatedAt)/1000)):null;
    const elapsed=age==null?'tijd onbekend':age<60?age+' s geleden':Math.floor(age/60)+' min '+age%60+' s geleden';
    return (age!=null&&age<60?'● LIVE':'● Vertraagd')+' · HA-update '+elapsed;
  }
  // Slots of one dish card. Only these are patched on a sensor update or the 1-second ticker.
  function cardSlots(d){
    const p=hasProbe(d)?b.getProbe(d):null,live=!!p?.ok,goal=goalOf(d),plan=livePlan.get(String(d.id))||{};
    // v5.4: one shared estimate per dish; times are anchored at the last real reading, not at the clock.
    const est=b.getEstimate&&d.phase!=='done'?b.getEstimate(d,plan):null;
    const goalHtml=goal!=null?'<span class="v5-dc-goal">→ '+escape(temp(goal,0))+' °C</span>':'<span class="v5-dc-goal">geen kerndoel</span>';
    let core;
    if(live){
      // Progress from the first reading of this session (not from 0 °C) when known.
      const pct=est?.progress&&Number.isFinite(est.progress.pct)?est.progress.pct:goal!=null?Math.max(0,Math.min(100,Math.round(p.core/goal*100))):0;
      core='<div class="v5-dc-temp"><span class="v5-dc-core">'+escape(temp(p.core))+' °C</span>'+goalHtml+'</div>'+
        (goal!=null?'<div class="v5-dc-bar" role="img" aria-label="'+pct+'% van de richtkern"><span style="width:'+pct+'%"></span></div>':'')+
        '<div class="v5-muted v5-dc-age">'+ageText(p)+'</div>';
    }else{
      core='<div class="v5-dc-temp"><span class="v5-dc-core v5-dc-none">— °C</span>'+goalHtml+'</div>'+
        '<div class="v5-muted v5-dc-age">'+escape(hasProbe(d)?(p?.note||'Geen live meting'):goal!=null?'Geen thermometer · controleer de kern zelf':'Geen thermometer · controleer de gaarheid zelf')+'</div>';
    }
    const started=d.phase==='cooking'&&Number.isFinite(Number(d.startedAt))&&Number(d.startedAt)>0?Math.max(0,Math.round((Date.now()-Number(d.startedAt))/60000)):null;
    const parts=[];
    if(live){
      const trend=b.getTrend(d);
      parts.push('Omgeving '+(p.ambient==null?'—':escape(temp(p.ambient,0))+' °C'));
      parts.push(trend?.ok?(trend.slope>=0?'+':'')+escape(temp(trend.slope))+' °C/min':'stijging volgt');
    }else parts.push('Doel BBQ '+escape(d.grill??'—')+' °C');
    if(started!=null)parts.push('op BBQ '+started+' min');
    const env=parts.join(' · ');
    // One estimate per dish (ETA-module): own curve, MEATER ETA, registered start + duration, else the planning.
    let when=null,source='planning',sub='',margin=null,label=null;
    const rest=Math.max(0,Number(d.rest)||0);
    if(d.phase==='done'){when=Number(d.doneAt)||null;source='gereed gemeld'}
    else if(d.phase==='resting'&&Number(d.restAt)>0){when=Number(d.restAt)+rest*60000;source='rusttijd'}
    else if(est&&est.ok&&est.source!=='planning'){
      when=est.ready;
      const goalTxt=goal!=null?escape(temp(goal,0))+' °C':'doel';
      if(est.source==='curve'&&est.state==='reached'){source='kerndoel bereikt';sub='controleer de gaarheid'}
      else if(est.source==='curve'){
        source='eigen trend';margin=est.margin;
        sub=(est.phase?escape(temp(est.phase.target,0))+' °C (einde indirect) rond '+clock(est.phase.at)+' · ':'')+'kern '+goalTxt+' rond '+clock(est.cookEnd);
      }else if(est.source==='meater'){source='MEATER-ETA';sub='kern '+goalTxt+' rond '+clock(est.cookEnd)}
      else{source='start + receptduur';sub='op de BBQ sinds '+clock(Number(d.startedAt))+(live&&est.reason&&!est.stall?' · eigen schatting volgt':'')}
      if(rest&&!(est.source==='curve'&&est.state==='reached'))sub+=' + '+rest+' min rust';
      if(est.source==='curve'&&est.meater?.disagree)sub+=' · MEATER-ETA zegt '+clock(est.meater.cookEnd);
      if(est.source==='curve'&&est.stale){label='Laatste schatting '+clock(when);sub+=' · verouderd: meting '+est.ageMin+' min oud'}
    }else{
      when=Number.isFinite(plan.end)?plan.end:null;
      if(est&&est.reason&&hasProbe(d)&&(live||est.points>0))sub='schatting volgt: '+escape(est.reason.charAt(0).toLowerCase()+est.reason.slice(1));
    }
    if(est?.stall){
      const st=est.stall,med=Number.isFinite(st.medianMinutes)?' · eigen historie: meestal '+st.medianMinutes+' min':'';
      sub='Stall rond '+escape(temp(st.level,0))+' °C sinds '+clock(st.since)+med+(sub?' · '+sub:'');
    }
    if(est?.advice&&est.source==='curve'&&est.state==='estimate'&&goal!=null&&est.core!=null&&est.core>=goal-12)sub+=' · '+escape(est.advice.text);
    let delta='';
    if(when!=null&&source!=='planning'&&Number.isFinite(plan.end)&&d.phase!=='done'){
      const diff=Math.round((when-plan.end)/60000);
      delta=Math.abs(diff)<=2?' · op schema':diff<0?' · '+(-diff)+' min vroeg':' · '+diff+' min later';
    }
    if(label==null)label=d.phase==='done'?'Gereed'+(when?' sinds '+clock(when):''):'Op tafel rond '+clock(when);
    const eta='<div class="v5-dc-when"><strong>'+escape(label)+'</strong>'+escape(delta)+'</div>'+
      '<div class="v5-muted">'+escape(source)+(margin!=null?' ±'+margin+' min':'')+(sub?' · '+sub:'')+'</div>';
    const advice=b.getAdvice?b.getAdvice(d):null;
    const text=advice&&advice.text?String(advice.text).replace(/(\d)\.(\d) °C/g,'$1,$2 °C'):'';
    const coach=text?'<p class="v5-dc-coach'+(advice.warn?' warn':'')+'">'+escape(text.charAt(0).toUpperCase()+text.slice(1))+'</p>':'';
    return {probe:probeSlot(d),link:linkSlot(d),core,env,eta,coach};
  }
  function probeSlot(d){return '<small class="v5-muted">'+escape(labelKam(d.kamado)+' · '+(hasProbe(d)?PROBE_LABEL[d.meater]:'geen thermometer'))+'</small>'}
  function linkSlot(d){
    // v5.5: an automatically linked probe is always visible and can be changed on the card.
    const id=String(d.id);
    if(probeEdit.has(id))return '<label class="v5-dc-probechoice">Thermometer'+meaterSelect(d,' v5-dc-probe-select')+'</label>';
    if(hasProbe(d)&&d.meaterAuto===true)return '<p class="v5-dc-auto">'+escape(PROBE_LABEL[d.meater])+' automatisch gekoppeld · '+action('wijzigen','probe-edit:'+id,'subtle v5-linkbtn')+'</p>';
    if(!hasProbe(d)&&d.phase==='cooking'&&b.hasLiveBridge&&b.hasLiveBridge())return '<p class="v5-dc-auto">Geen thermometer gekoppeld · '+action('kiezen','probe-edit:'+id,'subtle v5-linkbtn')+'</p>';
    return '';
  }
  function dishCard(d){
    const phaseLabel={waiting:'Nog niet begonnen',cooking:'Op de BBQ',resting:'Rusten',done:'Gereed'}[d.phase]||'Nog niet begonnen';
    const phaseNext=d.phase==='waiting'?'cooking':d.phase==='cooking'?(Number(d.rest)>0?'resting':'done'):d.phase==='resting'?'done':null;
    const nextName={cooking:'▶ Op BBQ gelegd',resting:'⏱️ Begin rusten',done:'✓ Gerecht gereed'};
    const slots=cardSlots(d);
    return '<section class="v5-card v5-dishcard" data-v5-dishcard="'+escape(d.id)+'" aria-label="'+escape(d.name)+'">'+
      '<div class="v5-between v5-dc-head"><div class="v5-dc-title"><h3>'+escape(d.name)+'</h3><div data-v5-slot="probe">'+slots.probe+'</div></div>'+
      '<span class="v5-chip neutral v5-dc-phase">'+escape(phaseLabel)+'</span></div>'+
      '<div data-v5-slot="link">'+slots.link+'</div>'+
      '<div data-v5-slot="core">'+slots.core+'</div>'+
      '<p class="v5-dc-line" data-v5-slot="env">'+slots.env+'</p>'+
      '<div class="v5-dc-eta" data-v5-slot="eta">'+slots.eta+'</div>'+
      '<div data-v5-slot="coach">'+slots.coach+'</div>'+
      '<div class="v5-dc-actions">'+(phaseNext?action(nextName[phaseNext],'phase:'+d.id+':'+phaseNext,'subtle v5-emph'):'')+
      action('Details ›','dish:'+d.id,'subtle')+'</div></section>';
  }
  function refreshLiveMeater(){
    if(screen!=='live'||document.body.classList.contains('v5-legacy')||document.hidden)return;
    const root=$('v5-root');
    if(!root||root.dataset.screen!=='live')return;
    // Update only sensor slots, not the page: keep open details, scroll and focus.
    for(const card of root.querySelectorAll('[data-v5-dishcard]')){
      const d=dishes().find(x=>String(x.id)===card.dataset.v5Dishcard);
      if(!d)continue;
      const slots=cardSlots(d);
      for(const [key,markup] of Object.entries(slots)){
        const slot=card.querySelector('[data-v5-slot="'+key+'"]');
        if(slot&&slot.innerHTML!==markup)slot.innerHTML=markup;
      }
    }
  }
  function syncWakeLock(){
    // v5.3: keep the screen on while Live is visible. Unsupported or refused: silently skip.
    const want=screen==='live'&&!document.hidden&&!document.body.classList.contains('v5-legacy');
    if(!want){if(wakeLock){const l=wakeLock;wakeLock=null;try{l.release().catch(()=>{})}catch(e){}}return}
    if(wakeLock||wakePending||!navigator.wakeLock||typeof navigator.wakeLock.request!=='function')return;
    wakePending=true;
    try{
      navigator.wakeLock.request('screen').then(l=>{
        wakePending=false;wakeLock=l;
        l.addEventListener?.('release',()=>{if(wakeLock===l)wakeLock=null});
        if(screen!=='live'||document.hidden||document.body.classList.contains('v5-legacy'))syncWakeLock();
      }).catch(()=>{wakePending=false});
    }catch(e){wakePending=false}
  }
  /* ---------- v5.5: one live model for timeline, hero, task times and the planning proposal ---------- */
  const MIN=60000;
  const kamOf=d=>d&&d.kamado==='small'?'small':'large';
  const fireStarted=k=>dishes().some(d=>kamOf(d)===k&&d.phase&&d.phase!=='waiting');
  function taskDone(t,done){
    // Lighting a kamado counts as done as soon as a dish on it is on the grill (also for sessions started before v5.5).
    if(done[t.id])return true;
    const m=/\|(large|small):fire$/.exec(t.id);
    return !!(m&&fireStarted(m[1]));
  }
  function liveCore(d){
    const p=hasProbe(d)&&b.getProbe?b.getProbe(d):null;
    return p&&p.ok&&Number.isFinite(p.core)?p.core:null;
  }
  // Planned and expected times for one dish. Expected never invents readings: estimate → registered phase → planning.
  function dishTimes(d,plan,est,now){
    if(!plan||!Number.isFinite(plan.start)||!Number.isFinite(plan.cookEnd))return null;
    const rest=Math.max(0,Number(plan.rest)||0)*MIN,dur=Math.max(MIN,plan.cookEnd-plan.start);
    const planSegs=(b.getSegments?b.getSegments(plan):[]).map(x=>({start:x.start,end:x.end,kind:x.method==='ombouw'?'swap':x.method==='direct'?'direct':'indirect'}));
    if(!planSegs.length)planSegs.push({start:plan.start,end:plan.cookEnd,kind:'indirect'});
    const planned={start:plan.start,cookEnd:plan.cookEnd,end:plan.cookEnd+rest,segs:planSegs};
    const map=(s0,ce)=>planSegs.map(x=>({kind:x.kind,start:s0+(x.start-plan.start)/dur*(ce-s0),end:s0+(x.end-plan.start)/dur*(ce-s0)}));
    const started=Number(d.startedAt)>0?Number(d.startedAt):null;
    let s0,ce,ready,segs,state=d.phase||'waiting';
    if(state==='done'){
      s0=started??plan.start;const end=Number(d.doneAt)||now;ce=Math.min(end,Number(d.restAt)||end);ready=end;
      segs=[{kind:'done',start:s0,end:ce}];
    }else if(state==='resting'&&Number(d.restAt)>0){
      ce=Number(d.restAt);s0=started??ce-dur;ready=ce+rest;segs=map(s0,ce);
    }else if(state==='cooking'&&started){
      s0=started;
      ce=est&&est.ok&&est.source!=='planning'&&Number.isFinite(est.cookEnd)?est.cookEnd:started+dur;
      ce=Math.max(ce,Math.min(now,started+24*60*MIN)); // still on the grill: the block runs at least until now
      ready=ce+rest;segs=map(s0,ce);
      if(est&&est.phase&&Number.isFinite(est.phase.at)&&segs.length>1){
        const at=Math.max(s0,Math.min(ce,est.phase.at));
        segs[0].end=at;for(let i=1;i<segs.length;i++){segs[i].start=Math.max(segs[i].start,at);if(segs[i].end<segs[i].start)segs[i].end=segs[i].start}
        if(segs.length>2&&segs[1].kind==='swap'){segs[1].start=at;segs[1].end=Math.max(at,Math.min(ce,at+(planSegs[1].end-planSegs[1].start)));segs[2].start=segs[1].end}
      }
    }else{
      // Not started yet: it cannot start in the past.
      s0=Math.max(plan.start,now);const shift=s0-plan.start;ce=plan.cookEnd+shift;ready=ce+rest;
      segs=planSegs.map(x=>({kind:x.kind,start:x.start+shift,end:x.end+shift}));
    }
    if(ready>ce&&state!=='done')segs.push({kind:'rest',start:ce,end:ready});
    return {planned,expected:{start:s0,cookEnd:ce,ready,segs},state};
  }
  function liveModel(now=Date.now()){
    const c=b.calculate(),s=state(),plans=new Map((c.dishes||[]).map(x=>[String(x.id),x]));
    livePlan=plans;
    const rows=dishes().map(d=>{
      const plan=plans.get(String(d.id)),est=b.getEstimate&&d.phase!=='done'?b.getEstimate(d,plan||{}):null;
      return {d,plan,est,times:dishTimes(d,plan,est,now)};
    });
    // Expected serve time: every dish has to be ready (single serve time only; multi-course keeps its own slots).
    let expectedServe=null,proposal=null;
    const readies=rows.map(r=>r.times?.expected.ready).filter(Number.isFinite);
    if(readies.length===rows.length&&rows.length)expectedServe=Math.max(...readies);
    if(expectedServe!=null&&Number.isFinite(c.serve)&&!s.v46MultiServe&&rows.some(r=>r.d.phase&&r.d.phase!=='waiting')){
      const diff=expectedServe-c.serve,to=Math.ceil(expectedServe/(5*MIN))*5*MIN;
      const sameDay=new Date(to).toDateString()===new Date(c.serve).toDateString();
      if(Math.abs(diff)>10*MIN&&to>now&&sameDay&&to!==c.serve)proposal={from:c.serve,to,time:hhmm(to),shift:to-c.serve};
    }
    return {c,s,now,rows,expectedServe,proposal};
  }
  const hhmm=t=>{const x=new Date(t);return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')};
  // Expected time of a planned task (shown next to "gepland" when more than 5 min apart).
  function expectedFor(task,model){
    const m=/\|(.+):(on|off|serve)$/.exec(task.id);if(!m)return null;
    const r=model.rows.find(x=>String(x.d.id)===m[1]);if(!r||!r.times)return null;
    const e=r.times.expected,v=m[2]==='on'?e.start:m[2]==='off'?e.cookEnd:e.ready;
    return Number.isFinite(v)&&Math.abs(v-task.time)>5*MIN?v:null;
  }
  function taskWhen(t,model){const exp=expectedFor(t,model);return 'Gepland '+taskTime(t.time)+(exp?' · verwacht '+taskTime(exp):'')}
  /* ---------- timeline ---------- */
  function timelineHtml(model){
    const {rows,c,now,s}=model,lanes=[];
    for(const k of ['large','small']){
      const own=rows.filter(r=>kamOf(r.d)===k&&r.times);
      if(!own.length)continue;
      const pre=Math.max(0,Number(k==='large'?s.preheatLarge:s.preheatSmall)||0)*MIN;
      const firstPlan=Math.min(...own.map(r=>r.times.planned.start)),firstExp=Math.min(...own.map(r=>r.times.expected.start));
      lanes.push({k,rows:own,fire:{planned:[firstPlan-pre,firstPlan],expected:[firstExp-pre,firstExp],done:fireStarted(k)}});
    }
    if(!lanes.length)return '';
    const times=[now];
    for(const l of lanes){times.push(l.fire.planned[0],l.fire.expected[0]);for(const r of l.rows){const t=r.times;times.push(t.planned.end,t.expected.ready,t.expected.start)}}
    if(Number.isFinite(c.serve))times.push(c.serve);
    let from=Math.min(...times.filter(Number.isFinite)),to=Math.max(...times.filter(Number.isFinite));
    from=Math.floor((from-5*MIN)/(15*MIN))*15*MIN;to=Math.ceil((to+5*MIN)/(15*MIN))*15*MIN;
    const span=Math.max(30*MIN,to-from),pct=t=>Math.max(0,Math.min(100,(t-from)/span*100));
    const box=(a,z,cls,label)=>{const l=pct(a),w=Math.max(0,pct(z)-l);return w<=0?'':'<span class="'+cls+'" style="left:'+l.toFixed(2)+'%;width:'+w.toFixed(2)+'%">'+(label?escape(label):'')+'</span>'};
    const step=span<=3*60*MIN?30*MIN:span<=6*60*MIN?60*MIN:span<=12*60*MIN?120*MIN:240*MIN;
    let ticks='';for(let t=Math.ceil(from/step)*step;t<=to;t+=step){const l=pct(t);if(l>4&&l<96)ticks+='<span style="left:'+l.toFixed(2)+'%">'+escape(clock(t))+'</span>'}
    let body='';
    for(const lane of lanes){
      lane.rows.forEach((r,i)=>{
        const t=r.times,name=r.d.name;
        let bars='';
        if(i===0){bars+=box(lane.fire.planned[0],lane.fire.planned[1],'v5-tl-plan','');if(!lane.fire.done)bars+=box(lane.fire.expected[0],lane.fire.expected[1],'v5-tl-seg fire','aan')}
        bars+=box(t.planned.start,t.planned.end,'v5-tl-plan','');
        t.expected.segs.forEach((g,j)=>{bars+=box(g.start,g.end,'v5-tl-seg '+g.kind,j===0?name:g.kind==='rest'?'rust':g.kind==='direct'?'sear':'')});
        body+='<button type="button" class="v5-tl-row" data-v5-act="card:'+escape(r.d.id)+'" aria-label="'+escape(name+' · '+labelKam(lane.k)+' · verwacht '+clock(t.expected.start)+'–'+clock(t.expected.ready)+' · gepland '+clock(t.planned.start)+'–'+clock(t.planned.end))+'">'+
          '<span class="v5-tl-lab">'+(i===0?(lane.k==='large'?'Groot':'Klein'):'')+'</span><span class="v5-tl-track">'+bars+'</span></button>';
      });
    }
    const serve=Number.isFinite(c.serve)&&c.serve>=from&&c.serve<=to?'<i class="v5-tl-serve" style="left:'+pct(c.serve).toFixed(2)+'%" title="Serveren '+escape(clock(c.serve))+'"></i>':'';
    const nowLine=now>=from&&now<=to?'<i class="v5-tl-now" data-v5-now style="left:'+pct(now).toFixed(2)+'%"></i>':'';
    let adjust='';
    if(model.proposal){
      const p=model.proposal,mins=Math.round(Math.abs(p.shift)/MIN);
      adjust=adjustOpen?adjustPanel(model):
        '<div class="v5-tl-adjust">'+action('Pas planning aan op verwachting','adjust-open','subtle v5-wide')+'<small class="v5-muted">Verwacht klaar '+escape(clock(model.expectedServe))+' · '+mins+' min '+(p.shift<0?'eerder':'later')+' dan gepland</small></div>';
    }else adjustOpen=false;
    return '<div class="v5-tl-body" data-v5-from="'+from+'" data-v5-to="'+to+'"><div class="v5-tl-axis" aria-hidden="true">'+ticks+'</div>'+body+
      '<div class="v5-tl-over" aria-hidden="true">'+serve+nowLine+'</div></div>'+
      '<div class="v5-tl-foot"><span class="v5-tl-legend"><i class="v5-tl-key plan"></i>gepland <i class="v5-tl-key exp"></i>verwacht <i class="v5-tl-key now"></i>nu <i class="v5-tl-key serve"></i>serveren</span>'+
      action('Alle stappen ›','all-steps','subtle v5-tl-all')+'</div>'+adjust;
  }
  function adjustPanel(model){
    // Before/after first. Nothing changes until "Bevestig" (the same route as changing "Serveren om" in step 2).
    const p=model.proposal,lines=['<li><span>Serveren</span><strong>'+escape(clock(p.from))+' → '+escape(clock(p.to))+'</strong></li>'];
    for(const r of model.rows){
      if(r.d.phase&&r.d.phase!=='waiting'||!r.plan||!Number.isFinite(r.plan.start))continue;
      if(r.d.mode==='manual'){lines.push('<li><span>'+escape(r.d.name)+'</span><strong>vaste starttijd blijft '+escape(clock(r.plan.start))+'</strong></li>');continue}
      const next=r.plan.start+p.shift;
      lines.push('<li><span>'+escape(r.d.name)+' op de BBQ</span><strong>'+escape(clock(r.plan.start))+' → '+escape(clock(next))+(next<model.now?' (al verstreken)':'')+'</strong></li>');
    }
    return '<div class="v5-tl-adjust v5-tl-confirm" role="group" aria-label="Voorstel planning"><strong>Voorstel: planning op verwachting</strong><ul>'+lines.join('')+'</ul>'+
      '<p class="v5-muted">Gerechten die al op de BBQ liggen houden hun werkelijke tijden.</p>'+
      '<div class="v5-hero-actions">'+action('Bevestig','adjust-apply:'+p.time,'primary')+action('Annuleer','adjust-cancel','subtle')+'</div></div>';
  }
  /* ---------- "Zo meteen" hero ---------- */
  function heroModel(model){
    const {now,rows}=model,done=state().v46Done||{},cands=[];
    const tasks=b.getTasks().filter(t=>!t.id.includes(':prep:')&&!taskDone(t,done));
    const byId=new Map(rows.map(r=>[String(r.d.id),r]));
    for(const t of tasks){
      const m=/\|(.+):(on|off|serve)$/.exec(t.id),r=m?byId.get(m[1]):null;
      // Tasks of a dish that is already on the grill follow the estimate below instead of the clock.
      if(r&&r.d.phase&&r.d.phase!=='waiting')continue;
      cands.push({kind:'task',key:t.id,time:t.time,task:t,dish:m?m[1]:null});
    }
    for(const r of rows){
      const d=r.d,id=String(d.id),e=r.times?.expected,est=r.est,goal=goalOf(d),core=liveCore(d)??(est&&!est.stale&&Number.isFinite(est.core)?est.core:null);
      const kam=kamOf(d)==='large'?'grote':'kleine',hot=Number(d.phase2Temp)||250;
      if(d.phase==='cooking'){
        const pt=(b.getPhaseTargets?b.getPhaseTargets(d):[])[0];
        const reached=(est&&est.source==='curve'&&est.state==='reached')||(core!=null&&goal!=null&&core>=goal);
        const nextPhase=Number(d.rest)>0?'resting':'done';
        if(reached){cands.push({kind:'dish',key:'off:'+id,time:now-MIN,dish:id,title:Number(d.rest)>0?'Haal '+d.name+' van de BBQ':d.name+' is klaar',
          detail:'Kern '+(core!=null?temp(core)+' °C':'doel')+' bereikt · controleer de gaarheid',act:['phase:'+id+':'+nextPhase,nextPhase==='resting'?'⏱️ Begin rusten':'✓ Gerecht gereed']});continue}
        if(Number.isFinite(pt)&&d.method==='combo'){
          if(core!=null&&core<pt&&!heroAck.has('stoke:'+id)){
            const at=est&&est.phase&&Number.isFinite(est.phase.at)?est.phase.at:null;
            const swap=r.times&&r.times.expected.segs.length>1?r.times.expected.segs[0].end:null;
            const when=at??swap;
            cands.push({kind:'dish',key:'stoke:'+id,time:when??now,dish:id,title:'Stook de '+kam+' kamado op naar ~'+hot+' °C',
              detail:d.name+' bereikt '+temp(pt,0)+' °C (einde indirect) '+(at!=null?(at<=now+MIN?'nu':'over ±'+Math.round((at-now)/MIN)+' min'):when!=null?'rond '+clock(when)+' (planning)':'binnenkort')+' · kern nu '+temp(core)+' °C',act:['hero-ack:stoke:'+id,'✓ Gedaan']});
            continue;
          }
          if(core!=null&&core>=pt&&goal!=null&&core<goal&&!heroAck.has('sear:'+id)){
            cands.push({kind:'dish',key:'sear:'+id,time:now,dish:id,title:'Schroei '+d.name+' direct op ~'+hot+' °C',
              detail:'Kern '+temp(core)+' °C · doel '+temp(goal,0)+' °C rond '+clock(e?.cookEnd),act:['hero-ack:sear:'+id,'✓ Gedaan']});
            continue;
          }
        }
        if(e)cands.push({kind:'dish',key:'off:'+id,time:e.cookEnd,dish:id,title:Number(d.rest)>0?'Haal '+d.name+' van de BBQ':'Rond '+d.name+' af',
          detail:(core!=null&&goal!=null?'Kern '+temp(core)+' → '+temp(goal,0)+' °C · ':'')+(est&&est.ok&&est.source==='curve'?'eigen schatting':est&&est.ok&&est.source==='meater'?'MEATER-ETA':est&&est.ok&&est.source==='start'?'start + receptduur':'planning')+(core==null?' · controleer de kern zelf':''),
          act:['phase:'+id+':'+nextPhase,nextPhase==='resting'?'⏱️ Begin rusten':'✓ Gerecht gereed']});
      }else if(d.phase==='resting'&&e){
        cands.push({kind:'dish',key:'serve:'+id,time:e.ready,dish:id,title:'Serveer '+d.name,detail:'Rusttijd '+(Number(d.rest)||0)+' min · klaar '+clock(e.ready),act:['phase:'+id+':done','✓ Gerecht gereed']});
      }
    }
    if(!cands.length)return null;
    // Reality first: an overdue planned task counts as "now", and within the next 5 minutes an action that follows
    // from the measurements of a dish on the grill comes before a planned task. Otherwise: earliest first.
    const eff=c=>Math.max(c.time,now),soon=c=>eff(c)<=now+5*MIN;
    cands.sort((a,z)=>soon(a)&&soon(z)&&a.kind!==z.kind?(a.kind==='dish'?-1:1):eff(a)-eff(z)||a.time-z.time);
    return cands[0];
  }
  function heroParts(h,model){
    const now=model.now;
    if(h.kind==='task'){
      const t=h.task,exp=expectedFor(t,model);
      return {tag:t.time<=now+10*MIN?'🔥 NU DOEN':'⏱️ HIERNA',when:taskTime(t.time),title:t.title,
        detail:labelKam(t.k)+' · '+(t.time<now-10*MIN?'Geplande tijd verstreken; controleer of dit nog nodig is.':'Geplande handeling · tijd is indicatief.')+(exp?' Verwacht '+clock(exp)+'.':'')};
    }
    return {tag:h.time<=now+2*MIN?'🔥 NU DOEN':'⏱️ ZO METEEN',when:'~'+clock(Math.max(h.time,now)),title:h.title,detail:h.detail};
  }
  function heroHtml(model){
    const h=heroModel(model);
    if(!h)return '<div class="v5-hero"><h2>✅ Alle geplande handelingen afgevinkt</h2><p>Controleer de gaarheid voordat je serveert.</p>'+action('Sessie afronden','finish','primary')+'</div>';
    return '<div class="v5-hero" data-v5-hero-task="'+escape(h.key)+'"'+(h.dish?' data-v5-hero-dish="'+escape(h.dish)+'"':'')+'>'+heroInner(h,model)+'</div>';
  }
  function heroInner(h,model){
    const p=heroParts(h,model);
    const primary=h.kind==='task'?action('✓ Markeer uitgevoerd','done:'+h.key,'primary'):action(h.act[1],h.act[0],'primary');
    return '<div class="v5-between"><span class="v5-nowtag">'+p.tag+'</span><span class="v5-hero-when">'+escape(p.when)+'</span></div>'+
      '<h2>'+escape(p.title)+'</h2><p class="v5-hero-detail">'+escape(p.detail)+'</p>'+
      '<div class="v5-hero-actions">'+primary+action('📖 Recept','recipe-in-live')+'</div>';
  }
  function refreshLiveSchedule(){
    if(screen!=='live'||document.body.classList.contains('v5-legacy')||document.hidden)return;
    const root=$('v5-root');
    if(!root||root.dataset.screen!=='live')return;
    const model=liveModel(),{c,s,now}=model;
    const remaining=Math.max(0,Math.ceil((c.serve-now)/60000));
    const countdown=Number.isFinite(c.serve)&&c.serve>now
      ?'nog '+Math.floor(remaining/60)+' u '+remaining%60+' min':'serveertijd verstreken';
    const bar=root.querySelector('.v5-live-bar strong');
    const label='Serveren '+String(s.mealTime||'—')+' · '+countdown;
    if(bar&&bar.textContent!==label)bar.textContent=label;
    // v5.5: the timeline follows the 30-second timer (never a sensor update); only its own slot is patched.
    const tl=root.querySelector('[data-v5-tl]');
    if(tl){const markup=timelineHtml(model);if(tl.innerHTML!==markup)tl.innerHTML=markup}
    // v5.5: "gepland · verwacht" of the visible tasks follows the same estimate (text only).
    const tasks=new Map(b.getTasks().map(t=>[t.id,t]));
    for(const el of root.querySelectorAll('.v5-next-tasks [data-v5-check]')){
      const t=tasks.get(el.dataset.v5Check),span=el.parentElement?.querySelector('[data-v5-when]');
      if(!t||!span)continue;
      const text=taskWhen(t,model);if(span.textContent!==text)span.textContent=text;
    }
    const hero=root.querySelector('.v5-hero[data-v5-hero-task]');
    if(!hero)return;
    const h=heroModel(model);
    if(!h)return;
    if(h.key!==hero.dataset.v5HeroTask){
      // Another action is next: replace the content of the same hero element.
      hero.dataset.v5HeroTask=h.key;if(h.dish)hero.dataset.v5HeroDish=h.dish;else delete hero.dataset.v5HeroDish;
      hero.innerHTML=heroInner(h,model);return;
    }
    const p=heroParts(h,model);
    const set=(sel,text)=>{const el=hero.querySelector(sel);if(el&&typeof text==='string'&&el.textContent!==text)el.textContent=text};
    set('.v5-nowtag',p.tag);set('.v5-hero-detail',p.detail);
    if(h.kind!=='task')set('.v5-hero-when',p.when);
  }
  function live(){
    const model=liveModel(),{c,s,now}=model,all=b.getTasks().filter(t=>!t.id.includes(':prep:'));
    const done=s.v46Done||{},upcoming=all.filter(t=>!taskDone(t,done));
    const finished=all.length-upcoming.length,remaining=Math.max(0,Math.ceil((c.serve-now)/60000));
    const countdown=Number.isFinite(c.serve)&&c.serve>now?'nog '+Math.floor(remaining/60)+' u '+remaining%60+' min':'serveertijd verstreken';
    const heroKey=heroModel(model)?.key;
    const follow=upcoming.filter(t=>t.id!==heroKey),rows=showAllTasks?follow:follow.slice(0,3);
    const taskRow=t=>({id:t.id,title:t.title,time:t.time,when:taskWhen(t,model),detail:''});
    const tl=timelineHtml(model);
    return '<div class="v5-live-bar"><div class="v5-between"><strong>Serveren '+escape(s.mealTime)+' · '+countdown+'</strong><span>'+finished+'/'+all.length+' afgerond</span></div><progress max="'+Math.max(1,all.length)+'" value="'+finished+'" aria-label="Handelingen afgerond"></progress></div>'+
    '<div class="v5-between v5-live-head"><h1 class="v5-h1 v5-live-title">Jouw BBQ in uitvoering</h1>'+
      '<details class="v5-live-info" data-v5-key="live-info"><summary aria-label="Uitleg over tijden en metingen">ⓘ</summary><p>Geplande tijden zijn indicatief; alleen afgevinkt telt als uitgevoerd. Live MEATER-metingen komen alleen via Home Assistant. Een schatting is een indicatie: controleer altijd kern en gaarheid. In de tijdlijn is het stippelkader de planning en het gekleurde blok de verwachting.</p></details></div>'+
    (tl?'<section class="v5-card v5-tl" data-v5-tl aria-label="Tijdlijn">'+tl+'</section>':'')+heroHtml(model)+
    '<div class="v5-dishcards">'+dishes().map(dishCard).join('')+'</div>'+
    '<h2 class="v5-sectionhead" id="v5-all-steps">Volgende handelingen</h2><div class="v5-card v5-next-tasks">'+
      (rows.length?checklist(rows.map(taskRow)):'<p class="v5-muted">Geen volgende geplande taken.</p>')+
      (follow.length>3?action(showAllTasks?'Toon minder':'Toon alle '+follow.length+' handelingen','show-tasks','subtle v5-wide'):'')+'</div>'+
    (all.some(t=>done[t.id])?'<details class="v5-card" data-v5-key="completed"><summary>Afgeronde handelingen ('+all.filter(t=>done[t.id]).length+')</summary>'+checklist(all.filter(t=>done[t.id]).map(taskRow))+'</details>':'')+
    '<h2 class="v5-sectionhead">Bereidingsdetails per gerecht</h2>'+dishes().map(d=>liveDish(d)).join('')+
    (c.alerts.length?'<details class="v5-card v5-alerts" data-v5-key="alerts"><summary>⚠️ Planning: '+c.alerts.length+' aandachtspunt(en)</summary>'+c.alerts.slice(0,10).map(a=>'<p>'+a.message+'</p>').join('')+'</details>':'')+
    '<h2 class="v5-sectionhead">Meer acties</h2><div class="v5-action-grid">'+action('📈 MEATER & focus','cooking')+action('✎ Planning aanpassen','planning')+action('🧂 Voorbereiding','prep')+action('Sessie afronden','finish','warn')+'</div>';
  }
  function liveDish(d){
    const s=state(),stages=Array.isArray(d.recipeSteps)?d.recipeSteps:[];
    const phaseLabel={waiting:'Nog niet begonnen',cooking:'Op de BBQ',resting:'Aan het rusten',done:'Gereed'}[d.phase]||'Nog niet begonnen';
    const checked=s.v46Done||{};
    return '<details class="v5-card" data-v5-dish="'+escape(d.id)+'" data-v5-key="dish:'+escape(d.id)+'" '+(d.phase==='cooking'?'open':'')+'><summary style="cursor:pointer;font-weight:850">'+escape(d.name)+' · '+escape(phaseLabel)+'</summary>'+
      '<p class="v5-muted" style="margin-top:10px">'+escape(labelKam(d.kamado))+' · '+escape(d.grill)+' °C gepland'+(d.core!==''?' · Richtkern '+escape(d.core)+' °C':'')+'</p>'+
      (stages.length?stages.map((r,i)=>{
        const id=s.date+'|'+d.id+':recipe:'+i;
        return '<div class="v5-recipestage"><details data-v5-key="stage:'+escape(d.id)+':'+i+'"><summary>'+(checked[id]?'✓ ':'○ ')+escape(r.title||'Stap '+(i+1))+' · '+escape(r.trigger||'Op volgorde')+'</summary><p>'+escape(r.detail||'Geen extra uitleg.')+'</p>'+action(checked[id]?'↺ Heropen stap':'✓ Stap uitgevoerd','done:'+id,checked[id]?'subtle':'subtle v5-emph')+'</details></div>';
      }).join(''):'<details class="v5-recipestage" data-v5-key="instructions:'+escape(d.id)+'"><summary>Bereidingsinstructies</summary><p>'+escape(b.getRecipeDetails(d).cook||d.notes||'Volg de kerntemperatuur en controleer de gaarheid.')+'</p></details>')+
      '</details>';
  }
  function renderNav(){
    const current=document.body.classList.contains('v5-legacy')?(legacyTab==='recipes'?'recipes':legacyTab==='cooking'?(legacyReturn==='more'?'more':'live'):legacyTab==='planning'?(legacyFrom==='live'?'live':'home'):'more'):screen;
    $('v5-nav').innerHTML=[['home','⌂','Vandaag'],['recipes','▤','Recepten'],['live','🔥','Live'],['more','•••','Meer']].map(([act,ic,label])=>
      '<button type="button" data-v5-act="'+act+'"'+(current===act?' aria-current="page"':'')+'><span class="v5-ico" aria-hidden="true">'+ic+'</span><span>'+label+'</span></button>').join('');
  }
  function render(){
    const root=$('v5-root');if(!root)return;
    const scroll=window.scrollY,open=new Map([...root.querySelectorAll('details[data-v5-key]')].map(el=>[el.dataset.v5Key,el.open]));
    let body=screen==='home'?home():screen==='select'?select():screen==='setup'?setup():screen==='prep'?prep():screen==='live'?live():home();
    root.dataset.screen=screen;
    root.innerHTML='<div class="v5-content">'+logo()+body+'</div>';
    root.querySelectorAll('input[data-v5-setting]').forEach(el=>{el.setAttribute('autocomplete','off')});
    root.querySelectorAll('details[data-v5-key]').forEach(el=>{if(open.has(el.dataset.v5Key))el.open=open.get(el.dataset.v5Key)});
    renderNav();syncWakeLock();
    if(window.scrollY!==scroll)window.scrollTo({top:scroll,left:0,behavior:'instant'});
  }
  // Terugknop toont altijd de werkelijke bestemming. legacyReturn (alleen in geheugen) onthoudt een
  // tussenstap binnen de oudere schermen, bv. Meer → MEATER → terug naar Meer.
  const BACK_LABEL={home:'← Vandaag',live:'← Live',select:'← Kies gerechten',setup:'← Plan de BBQ-dag',prep:'← Voorbereiden'};
  function legacy(tab,recipeTab,returnTo){
    if(returnTo)legacyReturnScroll=window.scrollY;
    legacyFrom=screen;legacyTab=tab;legacyReturn=returnTo||'';
    if(tab==='recipes'&&typeof window.v501SelectRecipeTab==='function')window.v501SelectRecipeTab(recipeTab||'library');
    b.showLegacy(tab);document.body.classList.add('v5-legacy');syncWakeLock();$('v5-back').textContent=legacyReturn==='more'?'← Meer':BACK_LABEL[legacyFrom]||'← Vandaag';$('v5-back').style.display='inline-flex';renderNav();try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch(e){}
  }
  function goBack(){
    if(legacyReturn){const to=legacyReturn,y=legacyReturnScroll;legacy(to);try{window.scrollTo({top:y,left:0,behavior:'instant'})}catch(e){}return}
    exitLegacy();
  }
  function exitLegacy(){
    legacyReturn='';document.body.classList.remove('v5-legacy');$('v5-back').style.display='none';b.syncLegacy();screen=legacyFrom;legacyTab='';render();try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch(e){}
  }
  function start(){
    const s=state();
    if(dishes().length){
      if(!window.confirm('Nieuwe sessie beginnen? Dit vervangt je huidige planning. Een lokale reservekopie wordt gemaakt.'))return;
      try{localStorage.setItem(BACKUP,JSON.stringify(s))}catch(e){window.alert('Reservekopie opslaan mislukt. Exporteer eerst jouw bestaande planning via Meer.');return;}
    }
    s.dishes=[];s.v46Done={};s.v5Actual={};s.date=today();s.dateMode='auto';s.v46MultiServe=false;
    meta={active:true,stage:'select',created:new Date().toISOString()};saveMeta();commit();recipeSearch='';goto('select');
  }
  function setPhase(d,next){
    const t=Date.now();d.phase=next;
    if(next==='cooking'){
      d.startedAt=t;d.restAt=null;d.doneAt=null;
      // v5.5: the kamado is evidently lit once a dish is on it; tick "Steek … aan" off (existing task state, no time invented).
      const s=state(),fire=s.date+'|'+kamOf(d)+':fire';s.v46Done=s.v46Done||{};s.v46Done[fire]=true;
      autoLink();
    }
    else if(next==='resting'){d.restAt=t;d.doneAt=null}
    else if(next==='done'){d.doneAt=t}
    // Explicit phase changes also complete the matching legacy timeline task.
    const suffix=next==='cooking'?'on':next==='resting'||(next==='done'&&!(Number(d.rest)>0))?'off':next==='done'?'serve':null;
    if(suffix){const s=state(),key=s.date+'|'+d.id+':'+suffix;s.v46Done=s.v46Done||{};s.v5Actual=s.v5Actual||{};s.v46Done[key]=true;s.v5Actual[key]=t}
  }
  function toggleDone(id,checked){
    const s=state();s.v46Done=s.v46Done||{};s.v5Actual=s.v5Actual||{};
    if(checked){s.v46Done[id]=true;s.v5Actual[id]=Date.now()}
    else{delete s.v46Done[id];delete s.v5Actual[id]}
    if(checked){
      for(const d of dishes()){
        if(id===s.date+'|'+d.id+':on'&&d.phase==='waiting')setPhase(d,'cooking');
        if(id===s.date+'|'+d.id+':off'&&d.phase==='cooking')setPhase(d,Number(d.rest)>0?'resting':'done');
        if(id===s.date+'|'+d.id+':serve'&&d.phase!=='done')setPhase(d,'done');
      }
    }
    commit();render();
  }
  /* v5.2: group the legacy Recipes and More pages. Existing DOM nodes are MOVED, never cloned,
     so their event listeners, ids and storage behaviour stay exactly as before. Idempotent. */
  function fold(title,node,id){
    if(!node)return null;
    const f=document.createElement('details');f.className='v47-fold';if(id)f.id=id;
    const sum=document.createElement('summary');sum.textContent=title;f.append(sum,node);return f;
  }
  function organizeRecipes(){
    const panel=$('library-panel');if(!panel||$('v520-library-tools'))return;
    const tools=document.createElement('details');tools.id='v520-library-tools';tools.className='v520-tools';
    const sum=document.createElement('summary');sum.textContent='⚙️ Importeren, exporteren en synchroniseren';tools.append(sum);
    for(const node of [panel.querySelector(':scope>p.hint'),panel.querySelector('.library-toolbar'),$('library-sync-status'),$('review-sync-status')])if(node)tools.append(node);
    panel.append(tools);
  }
  function organizeMore(){
    const page=$('v47-more'),mount=$('v47-more-mount');if(!page||!mount||$('v520-more-groups'))return;
    const owner=id=>{const el=$(id);return el?el.closest('details.v47-fold')||null:null};
    const toolbar=page.querySelector('.toolbar'),footer=page.querySelector('footer.footer'),install=page.querySelector('.v49-install');
    const meater=document.createElement('div');meater.className='v520-info';
    meater.innerHTML='<p>Live MEATER-metingen werken alleen in de Home Assistant-dashboardkaart. De grafiek en focusmodus open je ook vanuit Live.</p>';
    const open=document.createElement('button');open.type='button';open.className='v5-btn subtle';open.id='v520-open-cooking';
    open.textContent='📈 MEATER-grafiek en focusmodus openen';open.addEventListener('click',()=>legacy('cooking',null,'more'));meater.append(open);
    const groups=[
      ['koken','🍖 Koken','Boodschappen, voorraad en eerdere bereidingen',[owner('v45-shopping')||owner('v45-tools'),owner('v46-pantry-list'),owner('v46-history')]],
      ['koppelingen','🔗 Koppelingen','Home Assistant en MEATER',[owner('v46-notify'),fold('🌡️ MEATER en live metingen',meater,'v520-meater-fold')]],
      ['gegevens','💾 Gegevens','Planning bewaren, laden, delen en printen',[fold('💾 Planning bewaren, laden en printen',toolbar,'v520-data-fold')]],
      ['app','📱 App en info','Installeren, bijwerken en voedselveiligheid',[fold('📱 App installeren en bijwerken',install,'v520-app-fold'),fold('ℹ️ Uitleg en voedselveiligheid',footer,'v520-info-fold')]]
    ];
    const wrap=document.createElement('div');wrap.id='v520-more-groups';
    const jump=document.createElement('div');jump.className='v520-jump';jump.setAttribute('role','group');jump.setAttribute('aria-label','Ga naar onderdeel');
    for(const [id,title,sub,nodes] of groups){
      const items=nodes.filter(Boolean);if(!items.length)continue;
      const sec=document.createElement('section');sec.className='v520-group';sec.id='v520-more-'+id;sec.setAttribute('aria-labelledby','v520-more-h-'+id);
      const h=document.createElement('h3');h.id='v520-more-h-'+id;h.textContent=title;
      const p=document.createElement('p');p.className='v520-group-sub';p.textContent=sub;
      sec.append(h,p);
      if(id==='app'){
        // The displayed version belongs to this loaded UI, not to HACS or an online release check.
        const version=document.title.match(/\bv\d+\.\d+\.\d+\b/)?.[0]||'onbekend';
        const el=document.createElement('p');el.id='v520-app-version';el.className='v520-app-version';
        el.textContent='Versie van deze app: '+version;sec.append(el);
      }
      sec.append(...items);wrap.append(sec);
      const chip=document.createElement('button');chip.type='button';chip.className='v520-chip';chip.textContent=title;
      chip.addEventListener('click',()=>sec.scrollIntoView?.({behavior:'smooth',block:'start'}));jump.append(chip);
    }
    // Anything not explicitly grouped stays visible at the end instead of disappearing.
    const rest=[...mount.children];
    mount.append(jump,wrap,...rest);
  }
  function openHistory(){
    legacy('more');
    const f=$('v46-history')?.closest('details.v47-fold');
    if(f){f.open=true;try{f.scrollIntoView({behavior:'instant',block:'start'})}catch(e){}}
  }
  const root=document.createElement('div');root.id='v5-root';
  const main=document.querySelector('.shell > main');
  if(!main)return;main.parentElement.insertBefore(root,main);
  const back=document.createElement('button');back.id='v5-back';back.type='button';back.className='v5-btn primary v5-back-legacy';back.textContent='← Vandaag';back.addEventListener('click',goBack);main.parentElement.insertBefore(back,main);
  const nav=document.createElement('nav');nav.id='v5-nav';nav.className='v5-nav';nav.setAttribute('aria-label','BBQ-navigatie');root.after(nav);
  document.body.classList.add('v5-ready');
  try{organizeRecipes();organizeMore();}catch(e){/* Never block the planner because a legacy panel is missing. */}
  root.addEventListener('input',e=>{
    if(e.target?.id==='v5-search'){recipeSearch=e.target.value;const list=$('v5-recipe-list');if(list)list.innerHTML=recipeGrid();}
  });
  root.addEventListener('change',e=>{
    const el=e.target,s=state();
    if(el.matches('[data-v5-check]')){toggleDone(el.dataset.v5Check,el.checked);return}
    if(el.matches('[data-v5-setting]')){
      const field=el.dataset.v5Setting,value=el.value;
      if(field==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;s.date=value;s.dateMode='manual';s.v46Done={}}
      else if(field==='mealTime'||field==='availableFrom'){if(!/^\d{2}:\d{2}$/.test(value))return;s[field]=value}
      else if(field==='v45People'){s.v45People=Math.max(1,Math.min(50,Number(value)||4))}
      commit();render();return;
    }
    if(el.matches('[data-v5-meater]')){
      const d=dishes().find(d=>d.id===el.dataset.v5Meater);if(!d)return;
      const next=['pro','plus'].includes(el.value)?el.value:'none';
      if(next!=='none'&&dishes().some(x=>x.id!==d.id&&x.meater===next)){window.alert('Deze thermometer is al gekoppeld aan een ander gerecht. Ontkoppel hem daar eerst.');render();return}
      d.meater=next;d.meaterAuto=false;probeEdit.delete(String(d.id));commit();render();return;
    }
    if(el.matches('[data-v5-kamado]')){const d=dishes().find(d=>d.id===el.dataset.v5Kamado);if(d){d.kamado=el.value==='small'?'small':'large';commit();render()}return}
  });
  function openDish(id){
    const card=[...root.querySelectorAll('[data-v5-dish]')].find(el=>el.dataset.v5Dish===id);
    if(card){card.open=true;card.scrollIntoView?.({behavior:'smooth',block:'start'})}
  }
  function heroDish(){
    const hero=$('v5-root')?.querySelector('.v5-hero[data-v5-hero-task]');if(!hero)return null;
    if(hero.dataset.v5HeroDish)return hero.dataset.v5HeroDish;
    const id=hero.dataset.v5HeroTask,task=id.slice(id.indexOf('|')+1),fire=/^(large|small):fire$/.exec(task);
    if(fire)return b.calculate().dishes.filter(d=>d.kamado===fire[1]).sort((a,z)=>a.start-z.start)[0]?.id;
    return task.replace(/:(on|off|serve)$/,'');
  }
  function scrollToCard(id){
    const card=[...root.querySelectorAll('[data-v5-dishcard]')].find(el=>el.dataset.v5Dishcard===id);
    if(card)card.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  function defaultProbe(dish){
    // v5.3 AANNAME: MEATER Pro → first dish on the large kamado, Plus → first dish on the small one.
    // v5.5: only in the Home Assistant card (the public website never receives live readings), and marked as automatic:
    // the live recognition below may replace it when another probe is the one that is measuring.
    if(!(b.hasLiveBridge&&b.hasLiveBridge()))return;
    const k=dish.kamado==='small'?'small':'large',probe=k==='large'?'pro':'plus';
    if(hasProbe(dish)||dishes().some(x=>x.kamado===k||x.meater===probe))return;
    dish.meater=probe;dish.meaterAuto=true;
  }
  /* v5.5: automatic MEATER recognition (HA card only). The probe whose readings come in is the probe in use.
     Optional field d.meaterAuto: true = linked automatically, false = chosen by the user (also "Geen"), absent = old data.
     Rules: only a dish that is on the grill; never over a choice of the user; never a probe of another dish;
     exactly one candidate dish; both probes active and free → MEATER Pro. Returns true when it linked. */
  function autoLink(){
    if(!b.getActiveProbes||!(b.hasLiveBridge&&b.hasLiveBridge()))return false;
    const active=b.getActiveProbes();if(!Array.isArray(active)||!active.length)return false;
    const all=dishes();
    const cand=all.filter(d=>d.phase==='cooking'&&d.meaterAuto!==false&&(!hasProbe(d)||(d.meaterAuto===true&&!active.includes(d.meater))));
    if(cand.length!==1)return false;
    const d=cand[0],free=active.filter(k=>(k==='pro'||k==='plus')&&!all.some(x=>x.id!==d.id&&x.meater===k));
    if(!free.length)return false;
    const pick=free.includes('pro')?'pro':free[0];
    if(d.meater===pick)return false;
    d.meater=pick;d.meaterAuto=true;probeEdit.delete(String(d.id));
    return true;
  }
  function onSensorUpdate(){
    // A link is a one-time storage write; the Live DOM is still only patched slot by slot.
    if(autoLink())commit();
    refreshLiveMeater();
  }
  function handleClick(e){
    const filter=e.target.closest('[data-v5-filter]');
    if(filter){recipeFilter=filter.dataset.v5Filter;render();return}

    const recipe=e.target.closest('[data-v5-recipe]');
    if(recipe){const r=b.getRecipes()[recipe.dataset.v5Recipe];if(r){const dish=b.makeDish(r);defaultProbe(dish);state().dishes.push(dish);commit();render()}return}
    const remove=e.target.closest('[data-v5-remove]');
    if(remove){state().dishes=state().dishes.filter(d=>d.id!==remove.dataset.v5Remove);commit();render();return}
    const el=e.target.closest('[data-v5-act]');if(!el)return;
    const act=el.dataset.v5Act;
    if(document.body.classList.contains('v5-legacy'))exitLegacy();
    if(act==='show-tasks'){showAllTasks=!showAllTasks;render();return}
    if(act==='all-steps'){showAllTasks=true;render();$('v5-all-steps')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}
    if(act.startsWith('card:')){scrollToCard(act.slice(5));return}
    if(act.startsWith('probe-edit:')){probeEdit.add(act.slice(11));refreshLiveMeater();return}
    if(act.startsWith('hero-ack:')){heroAck.add(act.slice(9));refreshLiveSchedule();return}
    if(act==='adjust-open'){adjustOpen=true;refreshLiveSchedule();return}
    if(act==='adjust-cancel'){adjustOpen=false;refreshLiveSchedule();return}
    if(act.startsWith('adjust-apply:')){
      // Only after the explicit confirmation: the shown serve time, through the same route as step 2 "Serveren om".
      const value=act.slice(13),s=state();
      if(!/^\d{2}:\d{2}$/.test(value)||s.v46MultiServe)return;
      adjustOpen=false;s.mealTime=value;commit();render();return;
    }
    if(act==='new'){start();return}
    if(act==='resume'){const fromLegacy=!meta.active;meta.active=true;meta.stage=fromLegacy||meta.stage==='finished'?'setup':meta.stage||'setup';saveMeta();goto(meta.stage);return}
    if(act==='home'||act==='select'||act==='setup'||act==='prep'){if(act!=='home'&&act!=='select'&&!dishes().length)return;goto(act);return}
    if(act==='live'){if(!dishes().length){goto('select');return}meta.active=true;goto('live');return}
    if(act==='finish'){
      if(!window.confirm('BBQ-sessie afronden? Alle recepten, reviews en gegevens blijven bewaard.'))return;
      meta.active=false;meta.stage='finished';saveMeta();goto('home');return;
    }
    if(act==='recipes'){legacy('recipes','library');return}
    if(act==='recipe-generate'){legacy('recipes','generate');return}
    if(act==='recipe-junkie'){legacy('recipes','junkie');return}
    if(act==='history'){openHistory();return}
    if(act==='more'){legacy('more');return}
    if(act==='planning'){legacy('planning');return}
    if(act==='cooking'){legacy('cooking');return}
    if(act==='recipe-in-live'){openDish(heroDish());return}
    if(act.startsWith('dish:')){openDish(act.slice(5));return}
    if(act.startsWith('phase:')){const [,id,phase]=act.split(':'),d=dishes().find(d=>String(d.id)===id);if(d&&['cooking','resting','done'].includes(phase)){setPhase(d,phase);commit();render()}return}
    if(act.startsWith('done:')){const id=act.slice(5);toggleDone(id,!(state().v46Done||{})[id]);return}
  }
  root.addEventListener('click',handleClick);nav.addEventListener('click',handleClick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&screen==='live'&&!document.body.classList.contains('v5-legacy'))render();else syncWakeLock()});
  window.addEventListener('bbq-meater-updated',onSensorUpdate);
  window.setInterval(refreshLiveMeater,1000); // display timer only
  window.setInterval(refreshLiveSchedule,30000); // only refresh countdown and due-state text, never the Live DOM
  render();
};
})();