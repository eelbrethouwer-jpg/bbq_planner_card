/* BBQ Planner v5.0.0 — session-first experience. Keep v4 calculations and storage as source of truth. */
(function(){
'use strict';
window.initBBQV5=function(b){
  const KEY='bbq-v5-session-v1',BACKUP='bbq-v5-previous-plan-v1',escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const clock=t=>Number.isFinite(t)?new Date(t).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'—';
  const day=t=>Number.isFinite(t)?new Date(t).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}):'Datum onbekend';
  const labelKam=k=>k==='large'?'Grote kamado':k==='small'?'Kleine kamado':'Algemeen';
  const categoryIcon={rund:'🥩',varken:'🥓',gevogelte:'🍗',vis:'🐟',lam:'🍖',groenten:'🥦',vegetarisch:'🥬',dessert:'🍰',overig:'🍽️'};
  let meta={active:false,stage:'select',created:''},screen='home',recipeSearch='';
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object'&&saved.version===1){meta={active:saved.active===true,stage:['select','setup','prep','live','finished'].includes(saved.stage)?saved.stage:'select',created:String(saved.created||'')}}}catch(e){}
  const state=()=>b.getState();
  const dishes=()=>state().dishes||[];
  function saveMeta(){try{localStorage.setItem(KEY,JSON.stringify({...meta,version:1}))}catch(e){/* Only session navigation metadata; dishes remain in v4 storage */}}
  function commit(){b.commit();}
  function goto(next){screen=next;if(['select','setup','prep','live'].includes(next)&&meta.active){meta.stage=next;saveMeta();}render();try{window.scrollTo(0,0)}catch(e){}}
  function logo(){return '<div class="v5-top"><div class="v5-brand"><span class="v5-flame">🔥</span><div><div class="v5-title">BBQ Planner</div><div class="v5-sub">The Cooking Experience · v5.0</div></div></div><span class="v5-chip neutral">'+escape(state().date||today())+'</span></div>'}
  function progress(n){return '<div class="v5-steps" aria-label="Stap '+n+' van 3">'+[1,2,3].map(i=>'<span class="'+(i<=n?'on':'')+'"></span>').join('')+'</div>'}
  function action(label,act,variant='subtle',disabled=false){return '<button type="button" class="v5-btn '+variant+'" data-v5-act="'+escape(act)+'"'+(disabled?' disabled':'')+'>'+label+'</button>'}
  const heading=(cap,title,copy)=>'<p class="v5-eyebrow">'+escape(cap)+'</p><h1 class="v5-h1">'+escape(title)+'</h1><p class="v5-copy">'+escape(copy)+'</p>';
  function home(){
    const hasPlan=dishes().length>0,canResume=meta.active||hasPlan,showActive=meta.active&&meta.stage==='live';
    return heading('Welkom bij jouw BBQ','Wat gaan we bereiden?','Stel je menu samen, doorloop je voorbereidingen en volg tijdens het BBQ’en alleen de handelingen die op dat moment belangrijk zijn.')+
    '<div class="v5-card v5-accent"><h2>🔥 Nieuwe BBQ-sessie</h2><p class="v5-copy">Begin met je favoriete gerechten. Wij helpen met de planning voor je grote en kleine kamado.</p>'+action('＋ Nieuwe sessie samenstellen','new','primary')+'</div>'+
    (canResume?'<div class="v5-card"><div class="v5-between"><div><h3>'+(showActive?'▶ Hervat live bereiding':'📋 Bestaande planning')+'</h3><p class="v5-muted">'+dishes().length+' gerechten · '+escape(state().mealTime||'—')+' serveren</p></div>'+action('Openen →','resume','primary')+'</div></div>':'')+
    '<div class="v5-grid"><div class="v5-card"><h3>📖 Recepten</h3><p class="v5-muted">Je eigen bibliotheek, import en inspiratie.</p>'+action('Bekijk recepten','recipes')+'</div><div class="v5-card"><h3>📈 Mijn BBQ-historie</h3><p class="v5-muted">Reviews, tijden en leerpunten.</p>'+action('Bekijk historie','history')+'</div></div>';
  }
  function allRecipes(){
    return Object.entries(b.getRecipes()).filter(([name,r])=>r&&typeof r==='object'&&r.name).sort((a,z)=>a[0].localeCompare(z[0],'nl')).map(([key,r])=>({...r,_key:key}));
  }
  function recipeCard(r){
    const name=String(r.name||r._key),already=dishes().some(d=>d.name===name);
    const photo=typeof r.photo==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(r.photo)?'<img loading="lazy" alt="" src="'+r.photo+'">':null;
    return '<button type="button" class="v5-recipe'+(already?' selected':'')+'" data-v5-recipe="'+escape(r._key)+'" aria-label="'+escape((already?'Nogmaals toevoegen: ':'Toevoegen: ')+name)+'">'+
      (photo||'<div class="v5-recipe-icon" aria-hidden="true">'+(categoryIcon[r.category]||categoryIcon.overig)+'</div>')+
      '<span class="v5-recipe-body"><span class="v5-recipe-name">'+escape(name)+'</span><span class="v5-recipe-foot">'+(already?'✓ In menu · tik voor extra portie':'＋ Toevoegen · ±'+escape(r.cook||'?')+' min')+'</span></span></button>';
  }
  function recipeGrid(){
    const needle=recipeSearch.trim().toLocaleLowerCase('nl-NL'),results=allRecipes().filter(r=>(r.name+' '+r.category).toLocaleLowerCase('nl-NL').includes(needle));
    return results.length?results.map(recipeCard).join(''):'<div class="v5-empty">Geen recepten gevonden. Importeer een recept via je receptenbibliotheek.</div>';
  }
  function menuLines(removeOnly=false){
    return dishes().map(d=>'<div class="v5-dishline"><div><strong>'+escape(d.name)+'</strong><small>'+escape(labelKam(d.kamado))+' · ±'+escape(d.cook)+' min garen</small></div>'+
      '<button type="button" class="v5-mini-btn" data-v5-remove="'+escape(d.id)+'" aria-label="Verwijder '+escape(d.name)+'">✕</button></div>').join('');
  }
  function select(){
    return heading('Stap 1 van 3','Kies je gerechten','Tik op een recept om het aan jouw BBQ-menu toe te voegen. Je kunt ook recepten toevoegen uit je eigen bibliotheek.')+progress(1)+
      '<label class="v5-field v5-filter">Zoek gerechten<input id="v5-search" type="search" class="v5-input" placeholder="Bijv. ribeye, pulled pork, zalm..." value="'+escape(recipeSearch)+'"></label>'+
      '<div class="v5-recipes" id="v5-recipe-list">'+recipeGrid()+'</div>'+
      '<div class="v5-card"><h3>Jouw menu ('+dishes().length+')</h3>'+(dishes().length?menuLines():'<p class="v5-muted">Nog geen gerechten geselecteerd.</p>')+'</div>'+
      '<div class="v5-row">'+action('＋ Eigen recept maken','recipes')+action('← Startscherm','home')+'</div>'+
      '<div class="v5-sticky-actions"><div><strong>'+dishes().length+' gerechten gekozen</strong><small>Groot en klein combineren</small></div>'+action('Volgende →','setup','primary',!dishes().length)+'</div>';
  }
  function setup(){
    const s=state(),c=b.calculate();
    const alerts=c.alerts||[];
    return heading('Stap 2 van 3','Plan de BBQ-dag','Bepaal wanneer je wilt serveren en verdeel gerechten over beide kamado’s. Bereidingstijden blijven schattingen.')+progress(2)+
    '<div class="v5-card"><h3>🍽️ Serveermoment</h3><div class="v5-grid">'+
      '<label class="v5-field">Datum<input class="v5-input" type="date" data-v5-setting="date" value="'+escape(s.date)+'"></label>'+
      '<label class="v5-field">Serveren om<input class="v5-input" type="time" data-v5-setting="mealTime" value="'+escape(s.mealTime)+'"></label>'+
      '<label class="v5-field">Beschikbaar vanaf<input class="v5-input" type="time" data-v5-setting="availableFrom" value="'+escape(s.availableFrom)+'"></label>'+
      '<label class="v5-field">Aantal personen<input class="v5-input" type="number" min="1" max="50" data-v5-setting="v45People" value="'+escape(s.v45People||4)+'"></label>'+
    '</div><p class="v5-muted">Voor een diner met meerdere gangen kun je in de uitgebreide planning aparte serveertijden instellen.</p></div>'+
    '<div class="v5-card"><h3>🔥 Verdeel de gerechten</h3>'+dishes().map(d=>'<div class="v5-dishline"><div><strong>'+escape(d.name)+'</strong><small>±'+escape(d.cook)+' min · BBQ '+escape(d.grill)+' °C</small></div>'+
      '<select class="v5-input" aria-label="Kamado voor '+escape(d.name)+'" data-v5-kamado="'+escape(d.id)+'"><option value="large"'+(d.kamado==='large'?' selected':'')+'>Groot</option><option value="small"'+(d.kamado==='small'?' selected':'')+'>Klein</option></select></div>').join('')+
      '<div class="v5-row" style="margin-top:14px">'+action('⚙ Temperatuur / methode wijzigen','planning')+'</div></div>'+
    '<div class="v5-card"><h3>⏱️ Planning in het kort</h3><div class="v5-grid"><div><span class="v5-muted">Grote kamado aan</span><div class="v5-number">'+clock(c.fires.large)+'</div></div><div><span class="v5-muted">Kleine kamado aan</span><div class="v5-number">'+clock(c.fires.small)+'</div></div></div>'+
       (alerts.length?'<details class="v5-alerts"><summary>⚠️ '+alerts.length+' aandachtspunt(en) — bekijken</summary>'+alerts.slice(0,12).map(a=>'<p>'+a.message+'</p>').join('')+'</details>':'<p class="v5-muted">Geen planningsconflicten gedetecteerd. Controleer de praktische roosterruimte zelf.</p>')+'</div>'+
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
    return tasks.map(t=>'<div class="v5-check'+(done[t.id]?' done':'')+'"><input type="checkbox" id="v5-check-'+escape(t.id)+'" data-v5-check="'+escape(t.id)+'"'+(done[t.id]?' checked':'')+'><label for="v5-check-'+escape(t.id)+'"><strong>'+escape(t.title)+'</strong><small>'+escape(t.when||'')+(t.detail?'\n'+escape(t.detail):'')+'</small></label></div>').join('');
  }
  function prep(){
    const tasks=prepTasks(),done=state().v46Done||{},count=tasks.filter(t=>done[t.id]).length;
    return heading('Stap 3 van 3','Voorbereiden','Alles wat je alvast kunt doen. Een taak zonder exacte tijd mag je zelf inplannen; de app verzint geen startmoment.')+progress(3)+
    '<div class="v5-card"><div class="v5-between"><h3>✅ Voorbereidingslijst</h3><span class="v5-chip neutral">'+count+' / '+tasks.length+' gedaan</span></div>'+
    (tasks.length?checklist(tasks):'<div class="v5-empty">Geen afzonderlijke voorbereidingsstappen vastgelegd. Bekijk het recept voor snij- en voorbereidingsinstructies.</div>')+'</div>'+
    '<div class="v5-card"><h3>🛒 Nog nodig?</h3><p class="v5-muted">Je automatische boodschappenlijst, voorraad en uitgebreide receptinstructies blijven beschikbaar.</p>'+action('Open boodschappenlijst','more')+'</div>'+
    '<div class="v5-row">'+action('← Planning','setup')+action('🔥 Start live BBQ-sessie','live','primary')+'</div>';
  }
  function live(){
    const s=state(),c=b.calculate(),all=b.getTasks().filter(t=>!t.id.includes(':prep:'));
    const done=s.v46Done||{},upcoming=all.filter(t=>!done[t.id]),now=Date.now(),next=upcoming.find(t=>t.time<=now+10*60000)||upcoming[0];
    const finished=all.length-upcoming.length,active=meta.active&&meta.stage==='live';
    const prepOpen=prepTasks().filter(t=>!done[t.id]).length;
    const labels=dishes().length+' gerechten · '+finished+'/'+all.length+' handelingen afgerond';
    let hero=next?
       '<div class="v5-hero"><div class="v5-between"><span class="v5-nowtag">'+(next.time<=now+10*60000?'🔥 NU DOEN':'⏱️ HIERNA')+'</span><span>'+day(next.time)+' · '+clock(next.time)+'</span></div>'+
       '<h2>'+escape(next.title)+'</h2><p>'+escape(labelKam(next.k))+' · '+(next.time<now-10*60000?'Geplande tijd verstreken; controleer of dit nog nodig is.':'Geplande handeling — tijd blijft indicatief.')+'</p>'+
       '<div class="v5-row">'+action('✓ Markeer uitgevoerd','done:'+next.id,'primary')+action('📖 Recept bekijken','recipe-in-live')+'</div></div>':
       '<div class="v5-hero"><h2>✅ Alle geplande handelingen afgevinkt</h2><p>Controleer de gaarheid en veiligheid voordat je serveert. Je kunt de BBQ-sessie afronden.</p>'+action('Sessie afronden','finish','primary')+'</div>';
    return '<div class="v5-between"><div><p class="v5-eyebrow">🔥 Live kookmodus</p><h1 class="v5-h1">Jouw BBQ in uitvoering</h1><p class="v5-muted">'+escape(labels)+'</p></div><div><div class="v5-muted">Serveren</div><div class="v5-number">'+escape(s.mealTime)+'</div></div></div>'+
    '<div class="v5-status">'+(active?'● Actieve sessie. ':'Sessie staat niet actief. ')+
      'Kloktijden zijn gepland; alleen handmatig bevestigde acties zijn werkelijk uitgevoerd. MEATER is uitsluitend live via Home Assistant.</div>'+
    (prepOpen?'<div class="v5-status" style="border-color:#97714e">⚠ '+prepOpen+' voorbereiding(en) nog niet afgevinkt. '+action('Bekijk','prep')+'</div>':'')+
    hero+
    '<div class="v5-sectionhead">🔥 Beide kamado’s</div><div class="v5-grid">'+['large','small'].map(k=>{
      const ds=dishes().filter(d=>d.kamado===k),live=ds.filter(d=>d.phase==='cooking'),d=live[0]||ds[0],p=d?b.getProbe(d):null;
      return '<div class="v5-probe"><strong>'+labelKam(k)+'</strong><div class="v5-muted">'+escape(d?.name||'Geen gerecht')+'</div>'+
       '<div class="v5-number">'+(p?.ok?escape(p.core.toFixed(1))+' °C':escape(d?.grill||'—')+' °C')+'</div>'+
       '<div class="v5-muted">'+(p?.ok?'● Live kern · MEATER':'Geplande BBQ-temp. · geen live meting')+'</div>'+
       (d?'<div style="margin-top:10px">'+action('Bekijk gerecht','dish:'+d.id)+'</div>':'')+'</div>';
    }).join('')+'</div>'+
    '<div class="v5-sectionhead">⏭️ Volgende handelingen</div><div class="v5-card">'+
      (upcoming.length?checklist(upcoming.slice(0,8).map(t=>({id:t.id,title:t.title,when:day(t.time)+' · '+clock(t.time)+' · '+labelKam(t.k),detail:''}))):'<p class="v5-muted">Geen openstaande geplande taken.</p>')+
    '</div>'+
    '<div class="v5-sectionhead">📖 Receptfasen per gerecht</div>'+dishes().map(d=>liveDish(d)).join('')+
    (c.alerts.length?'<details class="v5-card v5-alerts"><summary>⚠️ Planning: '+c.alerts.length+' aandachtspunt(en)</summary>'+c.alerts.slice(0,10).map(a=>'<p>'+a.message+'</p>').join('')+'</details>':'')+
    '<div class="v5-row">'+action('✎ Planning aanpassen','planning')+action('Voorbereiding','prep')+action('Sessie afronden','finish','warn')+'</div>';
  }
  function liveDish(d){
    const s=state(),p=b.getProbe(d),stages=Array.isArray(d.recipeSteps)?d.recipeSteps:[];
    const phaseLabel={waiting:'Nog niet begonnen',cooking:'Op de BBQ',resting:'Aan het rusten',done:'Gereed'}[d.phase]||'Nog niet begonnen';
    const phaseNext=d.phase==='waiting'?'cooking':d.phase==='cooking'?(Number(d.rest)>0?'resting':'done'):d.phase==='resting'?'done':null;
    const nextName={cooking:'▶ Op BBQ gelegd',resting:'⏱️ Begin rusten',done:'✓ Gerecht gereed'};
    const checked=s.v46Done||{};
    return '<details class="v5-card" '+(d.phase==='cooking'?'open':'')+'><summary style="cursor:pointer;font-weight:850">'+escape(d.name)+' · '+escape(phaseLabel)+'</summary>'+
      '<p class="v5-muted" style="margin-top:10px">'+escape(labelKam(d.kamado))+' · '+escape(d.grill)+' °C gepland'+(d.core!==''?' · Richtkern '+escape(d.core)+' °C':'')+'</p>'+
      (p?.ok?'<div class="v5-status">● LIVE kern '+escape(p.core.toFixed(1))+' °C'+(p.ambient!=null?' · omgeving '+escape(p.ambient.toFixed(1))+' °C':'')+'</div>':'<div class="v5-muted">Geen verse MEATER-meting; dit is planningsinformatie.</div>')+
      (phaseNext?'<div class="v5-row" style="margin:12px 0">'+action(nextName[phaseNext],'phase:'+d.id+':'+phaseNext,'primary')+'</div>':'')+
      (stages.length?stages.map((r,i)=>{
        const id=s.date+'|'+d.id+':recipe:'+i;
        return '<div class="v5-recipestage"><details><summary>'+(checked[id]?'✓ ':'○ ')+escape(r.title||'Stap '+(i+1))+' · '+escape(r.trigger||'Op volgorde')+'</summary><p>'+escape(r.detail||'Geen extra uitleg.')+'</p>'+action(checked[id]?'↺ Heropen stap':'✓ Stap uitgevoerd','done:'+id,checked[id]?'subtle':'primary')+'</details></div>';
      }).join(''):'<details class="v5-recipestage"><summary>Bereidingsinstructies</summary><p>'+escape(b.getRecipeDetails(d).cook||d.notes||'Volg de kerntemperatuur en controleer de gaarheid.')+'</p></details>')+
      '</details>';
  }
  function render(){
    const root=$('v5-root');if(!root)return;
    let body=screen==='home'?home():screen==='select'?select():screen==='setup'?setup():screen==='prep'?prep():screen==='live'?live():home();
    root.innerHTML='<div class="v5-content">'+logo()+body+'</div>'+
      '<nav class="v5-nav" aria-label="BBQ-navigatie">'+[['home','⌂','Vandaag'],['recipes','▤','Recepten'],['live','🔥','Live'],['more','•••','Meer']].map(([act,ic,label])=>
      '<button type="button" data-v5-act="'+act+'"'+(screen===act?' aria-current="page"':'')+'><span class="v5-ico" aria-hidden="true">'+ic+'</span><span>'+label+'</span></button>').join('')+'</nav>';
    root.querySelectorAll('input[data-v5-setting]').forEach(el=>{el.setAttribute('autocomplete','off')});
  }
  function legacy(tab){
    b.showLegacy(tab);document.body.classList.add('v5-legacy');$('v5-back').style.display='inline-flex';try{window.scrollTo(0,0)}catch(e){}
  }
  function exitLegacy(){
    document.body.classList.remove('v5-legacy');$('v5-back').style.display='none';b.syncLegacy();render();try{window.scrollTo(0,0)}catch(e){}
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
    if(next==='cooking'){d.startedAt=t;d.restAt=null;d.doneAt=null}
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
  const root=document.createElement('div');root.id='v5-root';
  const main=document.querySelector('.shell > main');
  if(!main)return;main.parentElement.insertBefore(root,main);
  const back=document.createElement('button');back.id='v5-back';back.type='button';back.className='v5-btn primary v5-back-legacy';back.textContent='← Terug naar BBQ v5';back.addEventListener('click',exitLegacy);document.body.appendChild(back);
  document.body.classList.add('v5-ready');
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
    if(el.matches('[data-v5-kamado]')){const d=dishes().find(d=>d.id===el.dataset.v5Kamado);if(d){d.kamado=el.value==='small'?'small':'large';commit();render()}return}
  });
  root.addEventListener('click',e=>{
    const recipe=e.target.closest('[data-v5-recipe]');
    if(recipe){const r=b.getRecipes()[recipe.dataset.v5Recipe];if(r){state().dishes.push(b.makeDish(r));commit();render()}return}
    const remove=e.target.closest('[data-v5-remove]');
    if(remove){state().dishes=state().dishes.filter(d=>d.id!==remove.dataset.v5Remove);commit();render();return}
    const el=e.target.closest('[data-v5-act]');if(!el)return;
    const act=el.dataset.v5Act;
    if(act==='new'){start();return}
    if(act==='resume'){const fromLegacy=!meta.active;meta.active=true;meta.stage=fromLegacy||meta.stage==='finished'?'setup':meta.stage||'setup';saveMeta();goto(meta.stage);return}
    if(act==='home'||act==='select'||act==='setup'||act==='prep'){if(act!=='home'&&act!=='select'&&!dishes().length)return;goto(act);return}
    if(act==='live'){if(!dishes().length){goto('select');return}meta.active=true;goto('live');return}
    if(act==='finish'){
      if(!window.confirm('BBQ-sessie afronden? Alle recepten, reviews en gegevens blijven bewaard.'))return;
      meta.active=false;meta.stage='finished';saveMeta();goto('home');return;
    }
    if(act==='recipes'){legacy('recipes');return}
    if(act==='history'||act==='more'){legacy('more');return}
    if(act==='planning'){legacy('planning');return}
    if(act==='recipe-in-live'){const el=root.querySelector('.v5-card details');if(el){el.open=true;el.scrollIntoView?.({behavior:'smooth',block:'start'})}else{legacy('recipes')}return}
    if(act.startsWith('dish:')){const id=act.slice(5),cards=[...root.querySelectorAll('details.v5-card')],card=cards.find(c=>c.textContent.includes(dishes().find(d=>d.id===id)?.name||'\u0000'));if(card){card.open=true;card.scrollIntoView?.({behavior:'smooth',block:'center'})}return}
    if(act.startsWith('phase:')){const [,id,phase]=act.split(':'),d=dishes().find(d=>d.id===id);if(d&&['cooking','resting','done'].includes(phase)){setPhase(d,phase);commit();render()}return}
    if(act.startsWith('done:')){const id=act.slice(5);toggleDone(id,!(state().v46Done||{})[id]);return}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&screen==='live'&&!document.body.classList.contains('v5-legacy'))render()});
  window.setInterval(()=>{if(screen==='live'&&!document.body.classList.contains('v5-legacy'))render()},30000);
  render();
};
})();