/* BBQ Planner 5.0.1 — three explicit recipe entry points, reusing existing controllers. */
(function(){
'use strict';
window.initBBQV501=function(){
 const page=document.getElementById('v47-recipes');
 const catalog=document.getElementById('v48-catalog');
 const generator=document.getElementById('recipe-importer');
 const library=document.getElementById('library-panel');
 if(!page||!catalog||!generator||!library||document.getElementById('v501-recipe-tabs'))return;
 const KEY='bbq-v501-recipe-tab-v1';
 const items=[
  {id:'generate',icon:'✨',label:'Recept genereren',description:'Maak van je recepttekst of een link een bewerkbaar recept. Verwerking gebeurt lokaal; controleer altijd het resultaat.'},
  {id:'library',icon:'📚',label:'Mijn bibliotheek',description:'Bekijk je opgeslagen recepten, pas ze aan of voeg ze toe aan jouw BBQ-planning.'},
  {id:'junkie',icon:'🔥',label:'BBQ Junkie',description:'Ontdek geselecteerde recepten met foto’s en bereidingstijden. Voeg ze zelf toe aan je bibliotheek.'}
 ];
 const nav=document.createElement('div');
 nav.id='v501-recipe-tabs';nav.className='v501-recipe-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Kies een receptbron');
 const panels={};
 for(const item of items){
  const button=document.createElement('button');
  button.type='button';button.className='v501-recipe-choice';button.dataset.v501RecipeTab=item.id;
  button.setAttribute('role','tab');button.id='v501-recipe-tab-'+item.id;
  button.setAttribute('aria-controls',item.id==='junkie'?'v48-catalog':'v501-recipe-panel-'+item.id);
  const icon=document.createElement('span');icon.className='v501-recipe-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.icon;
  const label=document.createElement('span');label.textContent=item.label;
  button.append(icon,label);nav.appendChild(button);
  let pane;
  if(item.id==='junkie'){pane=catalog;pane.id='v48-catalog';}
  else{pane=document.createElement('section');pane.id='v501-recipe-panel-'+item.id;pane.className='v501-recipe-pane';page.insertBefore(pane,catalog);}
  pane.setAttribute('role','tabpanel');
  pane.setAttribute('aria-labelledby',button.id);
  pane.setAttribute('tabindex','0');
  if(item.id!=='junkie'){
   const intro=document.createElement('p');intro.className='v501-recipe-intro';intro.textContent=item.description;pane.appendChild(intro);
   pane.appendChild(item.id==='generate'?generator:library);
  }
  panels[item.id]=pane;
 }
 // The fixed tab order is above all three recipe sections.
 page.insertBefore(nav,panels.generate);
 function selectTab(value,save=true){
  const tab=panels[value]?value:'library';
  for(const item of items){
   const active=item.id===tab;
   panels[item.id].hidden=!active;
   const button=nav.querySelector('[data-v501-recipe-tab="'+item.id+'"]');
   button.setAttribute('aria-selected',String(active));
   button.tabIndex=active?0:-1;
  }
  if(tab==='generate')generator.open=true;
  if(tab==='library')library.open=true;
  if(save){try{localStorage.setItem(KEY,tab)}catch(e){}}
 }
 nav.addEventListener('click',event=>{
  const button=event.target.closest('[data-v501-recipe-tab]');
  if(button)selectTab(button.dataset.v501RecipeTab);
 });
 nav.addEventListener('keydown',event=>{
  const button=event.target.closest('[data-v501-recipe-tab]');
  if(!button)return;
  const current=items.findIndex(x=>x.id===button.dataset.v501RecipeTab);
  const next=event.key==='ArrowRight'?(current+1)%items.length:event.key==='ArrowLeft'?(current+items.length-1)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:-1;
  if(next<0)return;
  event.preventDefault();selectTab(items[next].id);
  nav.querySelector('[data-v501-recipe-tab="'+items[next].id+'"]').focus();
 });
 window.v501SelectRecipeTab=selectTab;
 let last='library';
 try{last=localStorage.getItem(KEY)||last}catch(e){}
 selectTab(last,false);
};
})();