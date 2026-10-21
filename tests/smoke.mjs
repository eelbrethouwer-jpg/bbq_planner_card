/* Browser-DOM smoke checks for the standalone BBQ planner.
   Synthetic tests, never labeled as live MEATER or iPhone Safari tests. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
const errors=[];
const dom=new JSDOM(html,{
  url:'https://planner.test.invalid/',
  runScripts:'dangerously',
  pretendToBeVisual:true,
  beforeParse(window){
    window.Element.prototype.scrollIntoView=()=>{};
    window.confirm=()=>true;
    window.print=()=>{};
    window.navigator.share=async data=>{window.__shareURL=data.url;};
    window.prompt=()=>null;
    window.addEventListener('error',event=>{errors.push(String(event.error?.stack||event.message));});
  }
});
const localToday=(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')})();
const {window}=dom;
const doc=window.document;
const $=x=>doc.getElementById(x);
function click(el){assert.ok(el,'Missing button');el.click()}
function count(){return doc.querySelectorAll('#dishes article.dish').length}
try{
  assert.equal(errors.length,0,'startup JavaScript errors');
  assert.match($('js-status').textContent,/Interactieve bediening actief/);
  assert.equal(count(),3,'start with three default dishes');

  assert.equal($('meal-date').value,localToday,'auto date starts on today');
  assert.match($('date-mode').textContent,/Automatisch/);
  $('meal-date').value='2027-02-14';$('meal-date').dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dateMode,'manual','user date becomes manual');
  click($('date-today'));assert.equal($('meal-date').value,localToday,'today button resets');
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dateMode,'auto');
  $('preset-category').value='varken';$('preset-category').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.ok([...$('preset').options].some(o=>o.value==='Pulled pork op brood'),'pork category shows pulled pork');
  assert.ok(![...$('preset').options].some(o=>o.value==='Ribeye 500 g'),'pork category hides ribeye');
  $('preset-category').value='all';$('preset-category').dispatchEvent(new window.Event('change',{bubbles:true}));
  $('preset-search').value='ribeye';$('preset-search').dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.ok([...$('preset').options].some(o=>o.value==='Ribeye 500 g'),'search finds ribeye');
  $('preset-search').value='';$('preset-search').dispatchEvent(new window.Event('input',{bubbles:true}));
  click($('share-public'));
  assert.equal(window.__shareURL,'https://eelbrethouwer-jpg.github.io/bbq_planner_card/','share button never reveals HA URL or local plans');
  assert.equal($('meater-source').textContent,'Niet gekoppeld · plannermodus');

  click($('add'));assert.equal(count(),4,'add dish button');
  const select=$('preset');select.value='Ribeye 500 g';
  select.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(count(),5,'ribeye preset');
  const ribeyeCard=doc.querySelector('#dishes article.dish');
  assert.equal(ribeyeCard.querySelector('[data-field="method"]').value,'combo','ribeye uses indirect/direct');
  assert.match(doc.querySelector('#steps').textContent,/Bouw Ribeye 500 g om naar fase 2/,'changeover appears in step timeline');
  assert.match(doc.querySelector('#timeline').textContent,/Fase 1/,'timeline shows phase 1');
  assert.ok(doc.querySelector('#timeline .bar[title*="Fase 2"]'),'timeline shows phase 2, including short bars labeled by tooltip');
  ribeyeCard.querySelector('[data-field="transitionMins"]').value='20';
  ribeyeCard.querySelector('[data-field="transitionMins"]').dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.ok(doc.querySelector('#steps').textContent.includes('20 min'),'changeover minutes appear');
  assert.match(ribeyeCard.querySelector('.advice').textContent,/hitteschild/,'grate advice shown');
  assert.match(doc.querySelector('#alerts').textContent,/opstellingen|roosters|Ombouwen|temperaturen/i,'conflict warning from incompatible overlapping large-kamado dishes');
  assert.match(doc.querySelector('#steps').textContent,/Snijd en serveer Ribeye 500 g/);
  assert.equal(window.getComputedStyle(doc.querySelector('#steps details.step')).display,'block','accordion fills its card');

  const step=doc.querySelector('#steps details.step');
  assert.ok(step.querySelector('summary'),'accordion summary exists');
  step.open=true;assert.equal(step.open,true);
  assert.ok(step.querySelector('.step-detail'),'expanded details are present');

  $('recipe-name').value='BBQ proefgerecht';
  $('recipe-text').value='Ingrediënten\n1 stuk vis\nBereiding\nGaar indirect op 160 graden.\nServeren\nServeer warm.';
  $('recipe-duration').value='25';
  $('recipe-temp').value='160';
  click($('recipe-add'));
  assert.equal(count(),6,'pasted recipe added');
  assert.ok(doc.querySelector('#dishes article.dish .recipe-editor textarea'),'recipe detail editor');
  assert.ok(doc.querySelector('#steps').textContent.includes('BBQ proefgerecht'));
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).some(r=>r.name==='BBQ proefgerecht'),'recipe persisted');

  const card=doc.querySelector('#dishes article.dish');
  assert.equal(card.querySelector('[data-field="name"]').value,'BBQ proefgerecht');
  card.querySelector('[data-review="finalCore"]').value='63';
  card.querySelector('[data-review="comment"]').value='Volgende keer korter op de BBQ';
  click(card.querySelector('[data-action="review"]'));
  let rs=JSON.parse(window.localStorage.getItem('kamado-reviews-v1'));
  assert.equal(rs.length,1,'one review persisted');
  assert.equal(rs[0].finalCore,63);
  assert.equal(rs[0].lastMeasured,null,'no invented live MEATER values');
  assert.match(doc.querySelector('#dishes .review-editor').textContent,/Volgende keer korter op de BBQ/);

  click($('reset'));assert.equal(count(),3,'reset restores default plan');
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-reviews-v1')).length,1,'reviews survive plan reset');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).length>0,'custom recipes survive plan reset');

  // Nieuwe ingebouwde pulled-porkpreset: negen uitklapbare stappen met kerntemperatuurtriggers.
  const pulledOption=[...$('preset').options].find(o=>o.value==='Pulled pork op brood');
  assert.ok(pulledOption,'Pulled pork op brood is available in the preset selector');
  $('preset').value='Pulled pork op brood';
  $('preset').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(count(),4,'pulled pork preset can be added without replacing old dishes');
  const savedPlan=JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1'));
  const pulled=savedPlan.dishes.find(d=>d.name==='Pulled pork op brood');
  assert.ok(pulled,'pulled pork persisted inside local plan');
  assert.equal(pulled.grill,120);
  assert.equal(pulled.core,'92');
  assert.equal(pulled.cook,540);
  assert.equal(pulled.rest,60);
  assert.equal(pulled.recipeSteps.length,9,'nine structured recipe stages saved');
  assert.match(pulled.recipeIngredients,/2 kg procureur/);
  assert.match(pulled.recipeIngredients,/12 zachte witte bolletjes/);
  assert.match(pulled.recipePrep,/hitteschild/);
  assert.match(pulled.recipeCook,/88 °C/);
  assert.equal(doc.querySelectorAll('#steps details.recipe-stage').length,9,'nine recipe stages are expandable in section 04');
  assert.match(doc.querySelector('#steps .recipe-stage').textContent,/Avond vooraf/,'not clock-based, shows a trigger');
  assert.match(doc.querySelector('#steps .recipe-stage:last-child').textContent,/col(eslaw|eslaw)/i);

  // Offline recipe generator: parse, edit, approve, and persist, no data is sent off device.
  $('recipe-text').value='Ribeye v4.2 proefrecept\nIngrediënten\n500 g ribeye\nPeper en zout\n\nBereiding\nVerwarm de BBQ indirect op 120 °C. Gaar tot een kerntemperatuur van 48 °C. Laat daarna 6 minuten rusten.';
  click($('recipe-analyze'));
  assert.ok($('generator-preview').classList.contains('visible'),'analyzed draft shown');
  assert.equal($('generator-fields').querySelector('[data-gfield="grill"]').value,'120','BBQ temp detected');
  assert.equal($('generator-fields').querySelector('[data-gfield="core"]').value,'48','core temp separate from BBQ temp');
  assert.equal($('generator-fields').querySelector('[data-gfield="cook"]').value,'','missing duration not invented');
  const draftCook=$('generator-fields').querySelector('[data-gfield="cook"]');draftCook.value='45';
  draftCook.dispatchEvent(new window.Event('input',{bubbles:true}));
  click($('generator-stage-add'));
  assert.ok($('generator-stages').querySelectorAll('[data-stage]').length>=2,'stages can be added');
  click($('generator-save'));
  assert.equal(count(),5,'generator approved recipe added after reset');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).some(r=>r.name==='Ribeye v4.2 proefrecept'),'approved recipe stored');
  assert.ok(doc.querySelector('#dishes article.dish [data-recipe-step]'),'recipe steps editable on dish card');
  assert.ok(doc.querySelector('#steps details.recipe-stage'),'generator stages appear in expanded timeline');
  $('preset-search').value='Ribeye v4.2';$('preset-search').dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.ok([...$('preset').options].some(o=>o.value==='Ribeye v4.2 proefrecept'),'saved custom recipes searchable');
  $('preset-search').value='';$('preset-search').dispatchEvent(new window.Event('input',{bubbles:true}));
  $('recipe-text').value='Pulled Pork in het kort\nVlees Procureur\nBBQ temperatuur ±120 °C indirect\nKerntemperatuur Richtlijn ±92–96 °C + priktest\nBereidingstijd 2 kg ±7–11 uur\nRusttijd minimaal 1 uur\n\nIngrediënten\n– 2 kilogram procureur\n– 12 bolletjes\n\nBereiding\nMaak de kamado indirect klaar. Gaar het vlees totdat het boterzacht is.';
  click($('recipe-analyze'));
  assert.equal($('generator-fields').querySelector('[data-gfield="name"]').value,'Pulled Pork');
  assert.equal($('generator-fields').querySelector('[data-gfield="category"]').value,'varken');
  assert.equal($('generator-fields').querySelector('[data-gfield="grill"]').value,'120');
  assert.equal($('generator-fields').querySelector('[data-gfield="core"]').value,'92');
  assert.equal($('generator-fields').querySelector('[data-gfield="cook"]').value,'540');
  assert.equal($('generator-fields').querySelector('[data-gfield="rest"]').value,'60');
  $('recipe-text').value='Zonder temperaturen\nIngrediënten\n2 kg procureur\nBereiding\nKruid het vlees en gaar langzaam.';
  click($('recipe-analyze'));
  assert.equal($('generator-fields').querySelector('[data-gfield="grill"]').value,'','missing BBQ temp stays blank');
  assert.equal($('generator-fields').querySelector('[data-gfield="core"]').value,'','missing core stays blank');

  // v4.3 local cookbook: custom recipes are listed, usable, editable and removable.
  assert.ok($('library-items'),'library manager exists');
  assert.ok($('library-count'),'library count exists');
  assert.match($('library-sync-status').textContent,/Lokale bibliotheek|Lokaal/);
  const custom=doc.querySelector('#library-items [data-library-name="Ribeye v4.2 proefrecept"]');
  assert.ok(custom,'generated recipe appears in library');
  click(custom.querySelector('[data-library-action="edit"]'));
  assert.ok($('generator-preview').classList.contains('visible'),'library recipe opens editable draft');
  assert.equal($('generator-fields').querySelector('[data-gfield="name"]').value,'Ribeye v4.2 proefrecept');
  const renamed=$('generator-fields').querySelector('[data-gfield="name"]');
  renamed.value='Ribeye proefrecept bewerkt';
  renamed.dispatchEvent(new window.Event('input',{bubbles:true}));
  click($('generator-save'));
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).some(r=>r.name==='Ribeye proefrecept bewerkt'),'renamed recipe saved');
  assert.ok(!JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).some(r=>r.name==='Ribeye v4.2 proefrecept'),'rename deletes original recipe');
  assert.ok(doc.querySelector('#library-items [data-library-name="Ribeye proefrecept bewerkt"]'));
  const countBeforeUse=count();
  click(doc.querySelector('#library-items [data-library-name="Ribeye proefrecept bewerkt"] [data-library-action="use"]'));
  assert.equal(count(),countBeforeUse+1,'reusable cookbook entry added to planning');
  click(doc.querySelector('#library-items [data-library-name="Ribeye proefrecept bewerkt"] [data-library-action="delete"]'));
  assert.ok(!doc.querySelector('#library-items [data-library-name="Ribeye proefrecept bewerkt"]'),'deleted recipe hidden');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-deletions-v1')).some(x=>x.name==='Ribeye proefrecept bewerkt'),'deletion tombstone persisted');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-reviews-v1')).length===1,'reviews are never erased by cookbook edits');
  assert.ok(![...$('preset').options].some(o=>o.value==='Ribeye proefrecept bewerkt'),'deleted cookbook entry removed from selector');
  assert.ok([...$('preset').options].some(o=>o.value==='Pulled pork op brood'),'built in recipes remain');
  click($('library-export'));
  assert.match($('library-feedback').textContent,/Back-up/,'library export button operates');
  $('recipe-url').value='not a valid url';
  click($('recipe-read'));assert.match($('recipe-message').textContent,/geldige http/,'invalid URL handled locally');

  const entry=fs.readFileSync('index.html','utf8');
  const route='./dist/BBQ_bereidingsplanner_MEATER_v4.html';
  assert.ok(entry.includes('url='+route),'HTML redirect points at actual planner');
  assert.ok(entry.includes('href="'+route+'"'),'accessible fallback link');
  assert.ok(fs.existsSync('dist/BBQ_bereidingsplanner_MEATER_v4.html'),'site target exists');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OK v4.2: auto date, category filters, equipment/method planning, phase conflicts, recipe generator, editable stages, persistence, reviews, MEATER offline and Pages');
}finally{
  window.close();
}

/* Legacy browser storage and explicit future dates must survive migration. */
function launchWithPlan(plan){
 const instance=new JSDOM(html,{url:'https://planner-migration.test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
   w.Element.prototype.scrollIntoView=()=>{};
   w.print=()=>{};w.confirm=()=>true;
   w.localStorage.setItem('kamado-bereidingsplanner-v1',JSON.stringify(plan));
  }});
 return instance;
}
const previous=launchWithPlan({date:'2026-10-19',mealTime:'18:30',availableFrom:'16:30',
 preheatLarge:30,preheatSmall:25,dishes:[{id:'legacy1',name:'Zalm',kamado:'small',grill:160,cook:30,rest:5,core:'63',mode:'auto'}]});
try{
 assert.equal(previous.window.document.getElementById('meal-date').value,localToday,'stale v4.1 auto dates migrate to browser-local today');
 assert.equal(previous.window.document.querySelector('#dishes article.dish [data-field="category"]').value,'vis','existing dish category is inferred');
 assert.equal(previous.window.document.querySelector('#dishes article.dish [data-field="grate"]').value,'rvs','existing dish has a valid grate');
 assert.equal(previous.window.document.querySelector('#dishes article.dish [data-field="method"]').value,'indirect','existing dish has a valid cooking method');
}finally{previous.window.close();}
const manualFuture=new Date();manualFuture.setDate(manualFuture.getDate()+13);
const future=[manualFuture.getFullYear(),String(manualFuture.getMonth()+1).padStart(2,'0'),String(manualFuture.getDate()).padStart(2,'0')].join('-');
const planned=launchWithPlan({date:future,dateMode:'manual',mealTime:'19:00',availableFrom:'14:00',
 preheatLarge:30,preheatSmall:25,dishes:[]});
try{
 assert.equal(planned.window.document.getElementById('meal-date').value,future,'explicit planned dates survive reload');
 assert.match(planned.window.document.getElementById('date-mode').textContent,/Handmatig/);
}finally{planned.window.close();}
console.log('OK: legacy date migration, persistent manual future date, older recipe fields preserved');

/* Independent HA bridge tests with a mocked authenticated WebSocket connection.
   This is not live HA or Safari testing. */
const bridgeCode=fs.readFileSync('dist/bbq_planner_card.js','utf8').replace('import.meta.url','"https://planner.test.invalid/dist/bbq_planner_card.js"');
const parentDom=new JSDOM('<!doctype html><body></body>',{
  url:'https://planner.test.invalid/',
  runScripts:'dangerously',
  pretendToBeVisual:true
});
try {
  const w=parentDom.window;
  w.eval(bridgeCode);
  const card=w.document.createElement('bbq-planner-meater-card');
  w.document.body.appendChild(card);
  card.setConfig({});
  let server={version:1,recipes:[{name:'Zalm',updatedAt:'2026-10-01T10:00:00.000Z',grill:160}],deleted:[]};
  let subscription=null;
  const connection={
    sendMessagePromise:async m=>{
      if(m.type==='frontend/get_user_data')return {value:server};
      if(m.type==='frontend/set_user_data'){server=m.value;subscription?.({value:server});return null;}
      throw Error('Unknown call '+m.type);
    },
    subscribeMessage:async (fn,m)=>{assert.equal(m.type,'frontend/subscribe_user_data');subscription=fn;fn({value:server});return ()=>{subscription=null};}
  };
  card.hass={states:{},connection};
  const pork={name:'Pulled pork op brood',grill:120,updatedAt:'2026-10-20T10:00:00.000Z'};
  card._saveCookbook({version:1,recipes:[pork],deleted:[]});
  await card._syncQueue;
  assert.deepEqual(server.recipes.map(x=>x.name).sort(),['Pulled pork op brood','Zalm'],'HA merge preserves existing server recipes');
  const deleted={name:'Zalm',updatedAt:'2026-10-21T10:00:00.000Z'};
  card._saveCookbook({version:1,recipes:[],deleted:[deleted]});
  await card._syncQueue;
  assert.deepEqual(server.recipes.map(x=>x.name),['Pulled pork op brood'],'HA deletion prevents stale recipe resurrection');
  assert.ok(server.deleted.some(x=>x.name==='Zalm'),'HA sync stores tombstones');
  assert.ok(card._cookbookUnsub,'HA frontend user storage subscription connected');
  card.remove();
  assert.equal(subscription,null,'HA subscription cleaned up');
}finally{parentDom.window.close();}
console.log('OK: secure HA user-storage cookbook merge/delete/subscription bridge');
