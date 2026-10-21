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
    window.scrollTo=()=>{};
    window.URL.createObjectURL=()=> 'blob:https://planner.test.invalid/mock';
    window.URL.revokeObjectURL=()=>{};
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

  // v4.7: all controls remain in DOM but are reorganized into single-screen navigation.
  const nav=$('v47-nav');
  assert.ok(nav,'five-screen mobile navigation exists');
  assert.equal(nav.querySelectorAll('[data-v47-tab]').length,5,'five navigation destinations');
  assert.equal(doc.querySelectorAll('[data-v47-page]:not([hidden])').length,1,'only one full screen visible at a time');
  assert.equal(doc.querySelector('[data-v47-page]:not([hidden])').dataset.v47Page,'overview','default overview');
  assert.ok($('metrics').closest('#v47-overview'),'metrics mounted on overview');
  assert.ok($('fire-times').closest('#v47-overview'),'kamado ignition visible in overview');
  assert.ok($('recipe-importer').closest('#v47-recipes'),'recipe generator retained on recipes screen');
  assert.ok($('library-panel').closest('#v47-recipes'),'book library retained on recipes screen');
  assert.ok($('v45-shopping').closest('#v47-more'),'shopping retained in more screen');
  assert.ok($('v46-pantry-list').closest('#v47-more'),'pantry retained in more screen');
  assert.ok($('v46-board').closest('#v47-cooking'),'interactive board in cooking screen');
  assert.ok($('probe-pro').closest('#v47-cooking'),'MEATER probe in cooking screen');
  assert.ok($('probe-plus').closest('#v47-cooking'),'other MEATER probe in cooking screen');
  click(nav.querySelector('[data-v47-tab="planning"]'));
  assert.equal(doc.querySelector('[data-v47-page]:not([hidden])').dataset.v47Page,'planning','planning opens');
  assert.ok($('dishes').closest('#v47-planning'),'dish cards in planning');
  assert.equal(JSON.parse(JSON.stringify([...$('dishes').querySelectorAll('article.dish')].map(el=>el.querySelector('.v47-detail').hidden))).every(Boolean),true,'dish details start collapsed');
  const toggle=doc.querySelector('#dishes [data-v47-dish-toggle]');
  click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'),'true','dish detail expands');
  assert.equal(toggle.closest('article.dish').querySelector('.v47-detail').hidden,false);
  assert.equal(JSON.parse(window.localStorage.getItem('bbq-v47-expanded-v1')).length,1,'expanded dish persists');
  click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'),'false','dish detail collapses');
  assert.equal(window.localStorage.getItem('bbq-v47-expanded-v1'),'[]','collapsed dish persists');
  click($('v47-fullscreen')); // button exists on hidden cooking tab but opens existing cook dialog
  assert.ok($('v45-cook-screen').classList.contains('open'),'focus cooking button uses existing live dialog');
  click($('v45-close'));
  click(nav.querySelector('[data-v47-tab="recipes"]'));
  assert.ok(!$('v47-recipes').hidden,'recipes screen visible');
  click(nav.querySelector('[data-v47-tab="more"]'));
  assert.ok(!$('v47-more').hidden,'more screen visible');
  assert.equal(window.localStorage.getItem('bbq-v47-tab'),'more','tab selection survives reload');
  click(nav.querySelector('[data-v47-tab="overview"]'));
  assert.ok(!$('v47-overview').hidden,'overview restored');
  assert.match($('v47-live-label').textContent,/geen verse live/i,'fresh live status never invented');
  assert.equal(errors.length,0,'no script errors during mobile navigation');


  // v4.6: multiple courses, task board, timers, pantry and strict opt-in notifications.
  assert.ok($('v46-control'),'BBQ Regisseur is present');
  assert.match($('v46-board').textContent,/Steek|Leg/,'generated schedule tasks appear');
  assert.ok(!$('v46-multi').checked,'legacy single serve time stays default');
  assert.ok(!$('v46-notify').checked,'mobile notifications require explicit opt-in');
  assert.equal(doc.querySelector('#dishes article.dish [data-v46-course]').value,'main','existing dishes start as main course');
  $('v46-multi').checked=true;$('v46-multi').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v46MultiServe,true);
  let course=doc.querySelector('#dishes article.dish [data-v46-course]');
  assert.ok(course,'dish offers course selection');
  course.value='starter';course.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dishes[0].serveSlot,'starter');
  assert.match($('steps').textContent,/Serveer voorgerecht/,'new course appears on schedule');
  $('v46-multi').checked=false;$('v46-multi').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.match($('v46-course-status').textContent,/gezamenlijke/,'single serve behavior restored');
  const task=doc.querySelector('#v46-board [data-v46-check]');
  assert.ok(task,'task checkbox available');
  const taskId=task.dataset.v46Check;task.checked=true;task.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v46Done[taskId],true,'task completion persists');
  $('v46-pantry-name').value='krieltjes';$('v46-pantry-qty').value='250';$('v46-pantry-unit').value='g';
  click($('v46-pantry-add'));
  assert.match($('v46-pantry-list').textContent,/krieltjes/i,'pantry add works');
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v46Pantry[0].qty,250);
  click($('v46-pantry-list').querySelector('[data-v46-stock-remove]'));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v46Pantry.length,0,'pantry deletion works');
  const recipeBox=doc.querySelector('#dishes article.dish .v46-recipes');
  assert.ok(recipeBox,'recipe scaling and timer controls available');
  recipeBox.open=true;
  click(recipeBox.querySelector('[data-v46-timer-start]'));
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dishes[0].v46TimerEndsAt>Date.now(),'timer starts and persists');
  const stop=doc.querySelector('#dishes article.dish [data-v46-timer-stop]');
  click(stop);
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dishes[0].v46TimerEndsAt,0,'timer stops');
  assert.ok(fs.existsSync('sw.js')&&fs.existsSync('manifest.webmanifest'),'public PWA offline assets exist');

  // v4.5: mobile cooking panel and practical preparation tools.
  assert.ok($('v45-coach-content').textContent,'coaching UI is rendered without falsely claiming live readings');
  assert.ok($('v45-shopping'),'shopping UI exists');
  assert.ok($('v45-kamado'),'kamado advisor exists');
  click($('v45-open'));
  assert.ok($('v45-cook-screen').classList.contains('open'),'mobile cooking screen opens');
  assert.match($('v45-cook-body').textContent,/Geen recente live meting|Geen verse live|Geen MEATER gekozen/i,'no invented live temperatures');
  assert.equal($('v45-cook-body').querySelectorAll('[data-v45-step]').length,2,'next and previous step controls exist');
  click($('v45-close'));assert.ok(!$('v45-cook-screen').classList.contains('open'),'mobile cooking screen closes');
  $('v45-people').value='6';$('v45-people').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v45People,6,'shopping person count persists');


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
  card.querySelector('[data-review="actualMinutes"]').value='55';
  card.querySelector('[data-review="comment"]').value='Volgende keer korter op de BBQ';
  click(card.querySelector('[data-action="review"]'));
  let rs=JSON.parse(window.localStorage.getItem('kamado-reviews-v1'));
  assert.equal(rs.length,1,'one review persisted');
  assert.equal(rs[0].finalCore,63);
  assert.equal(rs[0].actualMinutes,55,'actual BBQ duration saved for later learning');
  assert.equal(rs[0].lastMeasured,null,'no invented live MEATER values');
  assert.ok(rs[0].id,'review gets a stable sync id');
  assert.match($('review-sync-status').textContent,/Bereidingshistorie lokaal|lokaal bewaard/i,'standalone review remains local');
  assert.match(doc.querySelector('#dishes .review-editor').textContent,/Volgende keer korter op de BBQ/);
  const another=doc.querySelector('#dishes article.dish');
  another.querySelector('[data-review="actualMinutes"]').value='65';
  another.querySelector('[data-review="comment"]').value='Tweede sessie duurt langer';
  click(another.querySelector('[data-action="review"]'));
  rs=JSON.parse(window.localStorage.getItem('kamado-reviews-v1'));
  assert.equal(rs.length,2,'a second review remains distinct');
  assert.match($('v45-learning').textContent,/mediane duur/i,'two real durations activate history advice');
  assert.match($('v45-learning').textContent,/mediane duur 60 min/i,'two durations yield the arithmetic median');
  assert.match($('v45-shopping').textContent,/vis/i,'shopping list includes parsed recipe ingredients');
  const receipt=$('v45-shopping').querySelector('input[data-v45-check]');
  assert.ok(receipt,'grocery checkbox exists');
  receipt.checked=true;receipt.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.ok(Object.values(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).v45ShopDone).some(Boolean),'shopping checked state persists');

  click($('reset'));assert.equal(count(),3,'reset restores default plan');
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-reviews-v1')).length,2,'reviews survive plan reset');
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
  assert.equal(pulled.prepTasks.length,1,'built-in pulled pork includes the night-before preparation');
  assert.equal(pulled.prepTasks[0].daysBefore,1);
  assert.equal(pulled.prepTasks[0].time,'','no invented evening clock time in built-in preset');
  assert.match(doc.getElementById('v46-prep-timeline').textContent,/Procureur schoonmaken en kruiden/,'night-before pulled pork prep appears in separate timeline');
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

  // v4.6: generator should recognize explicit before-the-event cues, but never invent an exact hour.
  $('recipe-text').value='Pulled pork met voorbereiding\nIngrediënten\n2 kg procureur\n\nVoorbereiding\nDe avond ervoor:\nDep procureur droog, snijd overtollig vet weg en wrijf het vlees in met rub. Pak goed in en bewaar in de koelkast.\n\nBereiding\nBBQ temperatuur 120 °C indirect. Bereidingstijd 9 uur. Rusttijd 1 uur.';
  click($('recipe-analyze'));
  let inferred=$('generator-preps').querySelectorAll('[data-gprep]');
  assert.equal(inferred.length,1,'night before section is recognized as advance preparation');
  assert.equal(inferred[0].querySelector('[data-gprep-field="daysBefore"]').value,'1');
  assert.equal(inferred[0].querySelector('[data-gprep-field="time"]').value,'','unknown clock time remains blank');
  assert.match(inferred[0].querySelector('[data-gprep-field="notes"]').value,/procureur droog/i,'recipe detail preserved');
  const clock=inferred[0].querySelector('[data-gprep-field="time"]');
  clock.value='20:15';clock.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(clock.value,'20:15','manual exact time is editable');
  click($('generator-save'));
  const newRecipe=JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1')).find(x=>x.name==='Pulled pork met voorbereiding');
  assert.equal(newRecipe.prepTasks.length,1,'generated prep saved to cookbook');
  assert.equal(newRecipe.prepTasks[0].time,'20:15','edited time persisted');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-bereidingsplanner-v1')).dishes.some(x=>x.name==='Pulled pork met voorbereiding'&&x.prepTasks[0].daysBefore===1),'generated prep also saved with planned dish');
  assert.match($('v46-prep-timeline').textContent,/Kruiden of marineren/,'generated day-before prep appears in schedule');

  $('recipe-text').value='Gemarineerde zalm\nIngrediënten\n400 g zalm\n\nVoorbereiding\nLaat vis 24 uur marineren in de koelkast en dek af.\n\nBereiding\nGrill de vis bij 160 °C.';
  click($('recipe-analyze'));
  inferred=$('generator-preps').querySelectorAll('[data-gprep]');
  assert.equal(inferred.length,1,'24h marinating is recognized');
  assert.equal(inferred[0].querySelector('[data-gprep-field="daysBefore"]').value,'1');
  assert.equal(inferred[0].querySelector('[data-gprep-field="time"]').value,'');
  const remove=inferred[0].querySelector('[data-gprep-remove]');
  click(remove);assert.equal($('generator-preps').querySelectorAll('[data-gprep]').length,0,'detected prep can be removed');
  click($('generator-prep-add'));assert.equal($('generator-preps').querySelectorAll('[data-gprep]').length,1,'manual prep can be added');


  $('recipe-text').value='Pizzadeeg met lange rijs\n\nVoorbereiding\nÉén dag van te voren: kneed het deeg en laat het afgedekt in de koelkast rijzen.\n\nBereiding\nBak op de kamado.';
  click($('recipe-analyze'));
  inferred=$('generator-preps').querySelectorAll('[data-gprep]');
  assert.equal(inferred.length,1,'Één dag van te voren is recognized regardless of accent and spacing');
  assert.equal(inferred[0].querySelector('[data-gprep-field="daysBefore"]').value,'1');

  $('recipe-text').value='Bavette met marinade\nTwee dagen vooraf: marineer het vlees afgedekt in de koelkast.\nBereiding\nGrill direct.';
  click($('recipe-analyze'));
  inferred=$('generator-preps').querySelectorAll('[data-gprep]');
  assert.equal(inferred.length,1,'two days beforehand is recognized');
  assert.equal(inferred[0].querySelector('[data-gprep-field="daysBefore"]').value,'2');

  $('recipe-text').value='Pizza recept\nBereiding\nKneed 12 uur van tevoren het deeg niet, maar meng bloem met water.';
  click($('recipe-analyze'));
  assert.equal($('generator-preps').querySelectorAll('[data-gprep]').length,0,'12h cue does not invent a specific previous calendar day');

  $('recipe-text').value='Zonder temperaturen\nIngrediënten\n2 kg procureur\nBereiding\nKruid het vlees en gaar langzaam.';
  click($('recipe-analyze'));
  assert.equal($('generator-fields').querySelector('[data-gfield="grill"]').value,'','missing BBQ temp stays blank');
  assert.equal($('generator-fields').querySelector('[data-gfield="core"]').value,'','missing core stays blank');

  // v4.3 local cookbook: custom recipes are listed, usable, editable and removable.
  assert.ok($('library-items'),'library manager exists');
  assert.ok($('library-count'),'library count exists');
  assert.match($('library-sync-status').textContent,/Lokale bibliotheek|Lokaal/);
  assert.ok($('review-sync-status'),'review sync status exists');
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
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-reviews-v1')).length===2,'reviews are never erased by cookbook edits');
  assert.ok(![...$('preset').options].some(o=>o.value==='Ribeye proefrecept bewerkt'),'deleted cookbook entry removed from selector');
  assert.ok([...$('preset').options].some(o=>o.value==='Pulled pork op brood'),'built in recipes remain');
  click($('library-export'));
  assert.match($('library-feedback').textContent,/Back-up/,'library export button operates');

  // Import entire cookbook from a real-format JSON fixture, first merging, then replacing.
  const importFile=$('library-file');
  function mockFile(books){Object.defineProperty(importFile,'files',{configurable:true,value:[{size:3000,text:async()=>JSON.stringify(books)}]});}
  const readLibrary=()=>JSON.parse(window.localStorage.getItem('kamado-recipe-book-v1'));
  const backup={format:'bbq-receptenbibliotheek-v1',recipes:[
    {name:'Meegenomen van iPhone',category:'varken',grill:120,cook:480,rest:45,core:'92',recipeIngredients:'2 kg procureur',recipeSteps:[{title:'Roken',trigger:'Tot 92 °C',detail:'Gaar indirect.'}]}
  ]};
  $('library-import-mode').value='merge';
  mockFile(backup);importFile.dispatchEvent(new window.Event('change',{bubbles:true}));
  await new Promise(r=>setImmediate(r));
  assert.ok(readLibrary().some(r=>r.name==='Meegenomen van iPhone'),'merged backup cookbook recipe added');
  assert.ok(readLibrary().some(r=>r.name==='BBQ proefgerecht'),'merge keeps older imported recipes');
  assert.ok(readLibrary().find(r=>r.name==='Meegenomen van iPhone').recipeSteps.length===1,'import preserves recipe stages');
  $('library-import-mode').value='replace';
  mockFile(backup);importFile.dispatchEvent(new window.Event('change',{bubbles:true}));
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(Array.from(readLibrary(),r=>r.name),['Meegenomen van iPhone'],'replace removes other personal recipes');
  assert.ok(JSON.parse(window.localStorage.getItem('kamado-recipe-deletions-v1')).some(r=>r.name==='BBQ proefgerecht'),'replace creates deletion sync tombstones');
  assert.ok([...$('preset').options].some(x=>x.value==='Pulled pork op brood'),'built-ins preserved after replacing local cookbook');
  assert.equal(JSON.parse(window.localStorage.getItem('kamado-reviews-v1')).length,2,'review data preserved after library replacement');

  $('recipe-url').value='not a valid url';
  click($('recipe-read'));assert.match($('recipe-message').textContent,/geldige http/,'invalid URL handled locally');

  const entry=fs.readFileSync('index.html','utf8');
  const route='./dist/BBQ_bereidingsplanner_MEATER_v4.html';
  assert.ok(entry.includes('url='+route+'?v=4.7.0'),'HTML redirect points at versioned planner');
  assert.ok(entry.includes('href="'+route+'?v=4.7.0"'),'accessible versioned fallback link');
  assert.ok(fs.existsSync('dist/BBQ_bereidingsplanner_MEATER_v4.html'),'site target exists');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OK v4.7: five-screen nav, compact dish cards and v4.6 cooking functions preserved');
}finally{
  window.close();
}

/* Legacy browser storage and explicit future dates must survive migration. */
function launchWithPlan(plan){
 const instance=new JSDOM(html,{url:'https://planner-migration.test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
   w.Element.prototype.scrollIntoView=()=>{};
   w.scrollTo=()=>{};
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
// v4.5 optimizer must separate overlapping incompatible dishes, never silently edit the plan.
const distribution=launchWithPlan({date:localToday,dateMode:'manual',mealTime:'18:30',availableFrom:'12:00',
 preheatLarge:30,preheatSmall:25,dishes:[
  {id:'smoke-one',name:'Indirect gerecht',kamado:'large',method:'indirect',grate:'rvs',grill:120,cook:60,rest:0,mode:'auto'},
  {id:'smoke-two',name:'Direct gerecht',kamado:'large',method:'direct',grate:'cast',grill:250,cook:60,rest:0,mode:'auto'}
 ]});
try{
 const d=distribution.window.document;
 assert.deepEqual(Array.from(JSON.parse(distribution.window.localStorage.getItem('kamado-bereidingsplanner-v1')).dishes,x=>x.kamado),['large','large'],'kamado recommendation does not auto-modify');
 const apply=d.getElementById('v45-apply');
 assert.ok(apply,'optimizer proposes a fix for overlapping incompatible dishes');
 apply.click();
 const updated=JSON.parse(distribution.window.localStorage.getItem('kamado-bereidingsplanner-v1'));
 assert.notEqual(updated.dishes[0].kamado,updated.dishes[1].kamado,'explicit applying optimizer separates conflicting dishes');
}finally{distribution.window.close();}

/* v4.6 — planned tomorrow/future is not 'already too late'; food preparation may be a day earlier. */
const preparedPlan=launchWithPlan({
 date:future,dateMode:'manual',mealTime:'18:30',availableFrom:'17:45',
 preheatLarge:30,preheatSmall:25,dishes:[{
  id:'prepared-fish',name:'Gerookte zalm',category:'vis',kamado:'large',method:'indirect',
  grill:120,cook:120,rest:10,core:'63',mode:'auto',
  prepTasks:[{id:'brine',title:'Vis pekelen',daysBefore:1,time:'19:00',duration:15,notes:'Koelkast maximaal 4 °C en receptduur controleren'}]
 }]
});
try{
 const w=preparedPlan.window,d=w.document;
 const all=()=>JSON.parse(w.localStorage.getItem('kamado-bereidingsplanner-v1'));
 const alert=d.querySelector('#alerts .alert');
 assert.ok(alert,'availability gap on a future date is still a planning consideration');
 assert.match(alert.textContent,/Vooruitblik op de BBQ-dag/,'future gap is named correctly');
 assert.match(alert.textContent,/gekozen toekomstige datum/,'future planned actions are not already overdue');
 assert.ok(!alert.classList.contains('urgent'),'future availability gap does not become an overdue warning');
 assert.match(d.getElementById('v46-prep-timeline').textContent,/Vis pekelen/,'prep timeline contains day-before action');
 assert.match(d.getElementById('steps').textContent,/Vis pekelen/,'detailed recipe schedule shows prep');
 assert.match(d.getElementById('v46-board').textContent,/Voorbereiden op eerdere dagen/,'interactive board separates previous-day prep');
 assert.equal(d.querySelector('#dishes .v46-prep-row [data-v46-prep-field="daysBefore"]').value,'1');
 const editor=d.querySelector('#dishes .v46-prep-editor');editor.open=true;
 const days=editor.querySelector('[data-v46-prep-field="daysBefore"]');
 days.value='2';days.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(all().dishes[0].prepTasks[0].daysBefore,2,'prep offset persists to plan storage');
 const template=editor.querySelector('[data-v46-prep-template]');template.value='meat';
 editor.querySelector('[data-v46-prep-add]').click();
 assert.equal(all().dishes[0].prepTasks.length,2,'prep template adds another editable task');
 assert.match(d.getElementById('v46-prep-timeline').textContent,/Vlees marineren/,'second task is visible on prep timeline');
 const updatedEditor=d.querySelector('#dishes .v46-prep-editor');
 updatedEditor.querySelector('[data-v46-prep-save]').click();
 const saved=JSON.parse(w.localStorage.getItem('kamado-recipe-book-v1'));
 assert.ok(saved.some(x=>x.name==='Gerookte zalm'&&x.prepTasks.length===2),'prep persists in local recipe library');
 const remove=updatedEditor.querySelector('[data-v46-prep-remove]');
 remove.click();
 assert.equal(all().dishes[0].prepTasks.length,1,'remove prep task works');
 const prepCheck=d.querySelector('#v46-board [data-v46-check*=":prep:"]');
 assert.ok(prepCheck,'prep task can be checked off');
 prepCheck.checked=true;prepCheck.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.ok(Object.values(all().v46Done).some(Boolean),'checked prep survives rerender');
 assert.equal(all().dishes[0].cook,120,'prep offsets never change cooking time');
}finally{preparedPlan.window.close();}
console.log('OK v4.6: multi-day preparations, future-only warnings and recipe persistence');

console.log('OK: optimizer is opt-in and preserves legacy plan support');

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
  const servers={
    bbq_planner_cookbook_v1:{version:1,recipes:[{name:'Zalm',updatedAt:'2026-10-01T10:00:00.000Z',grill:160}],deleted:[]},
    bbq_planner_reviews_v1:{version:1,reviews:[{id:'zalm-2026-10-01',name:'Zalm',date:'01-10-2026',createdAt:'2026-10-01T10:00:00.000Z',rating:4,finalCore:61,grill:160,targetCore:'63',thermometer:'plus',lastMeasured:61,ambient:158,comment:'Volgende keer iets langer'}]}
  };
  const subscriptions=new Map();
  const connection={
    sendMessagePromise:async m=>{
      if(m.type==='frontend/get_user_data')return {value:servers[m.key]};
      if(m.type==='frontend/set_user_data'){servers[m.key]=m.value;subscriptions.get(m.key)?.({value:servers[m.key]});return null;}
      throw Error('Unknown call '+m.type);
    },
    subscribeMessage:async (fn,m)=>{
      assert.equal(m.type,'frontend/subscribe_user_data');
      subscriptions.set(m.key,fn);fn({value:servers[m.key]});
      return ()=>subscriptions.delete(m.key);
    }
  };
  card.hass={states:{},connection};

  const photo='data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const pork={name:'Pulled pork op brood',grill:120,photo,updatedAt:'2026-10-20T10:00:00.000Z'};
  card._saveCookbook({version:1,recipes:[pork],deleted:[]});
  await card._syncQueue;
  assert.deepEqual(Array.from(servers.bbq_planner_cookbook_v1.recipes,x=>x.name).sort(),['Pulled pork op brood','Zalm'],'HA merge preserves existing server recipes');
  const deleted={name:'Zalm',updatedAt:'2026-10-21T10:00:00.000Z'};
  card._saveCookbook({version:1,recipes:[],deleted:[deleted]});
  await card._syncQueue;
  assert.deepEqual(Array.from(servers.bbq_planner_cookbook_v1.recipes,x=>x.name),['Pulled pork op brood'],'HA deletion prevents stale recipe resurrection');
  assert.ok(servers.bbq_planner_cookbook_v1.deleted.some(x=>x.name==='Zalm'),'HA sync stores tombstones');
  assert.equal(servers.bbq_planner_cookbook_v1.recipes[0].photo,photo,'small recipe photo survives HA cookbook sync');

  const porkReview={name:'Pulled pork op brood',date:'21-10-2026',createdAt:'2026-10-21T18:00:00.000Z',rating:5,finalCore:94,grill:120,targetCore:'92',thermometer:'pro',lastMeasured:94,ambient:121,actualMinutes:545,photo,comment:'Mooie bark en sappig'};
  card._saveReviews({version:1,reviews:[porkReview]});
  await card._syncQueue;
  assert.equal(servers.bbq_planner_reviews_v1.reviews.length,2,'HA review sync merges local and remote history');
  assert.ok(servers.bbq_planner_reviews_v1.reviews.some(x=>x.name==='Zalm'),'existing remote review preserved');
  assert.ok(servers.bbq_planner_reviews_v1.reviews.some(x=>x.name==='Pulled pork op brood'&&x.finalCore===94),'new cooking review synced including final core');
  assert.ok(servers.bbq_planner_reviews_v1.reviews.some(x=>x.name==='Pulled pork op brood'&&x.actualMinutes===545&&x.photo===photo),'photo and real cooking duration survive HA review sync');
  assert.ok(card._cookbookUnsub,'HA cookbook subscription connected');
  assert.ok(card._reviewsUnsub,'HA review-history subscription connected');

  const services=[];
  card.hass={states:{},connection,callService:async (domain,service,data)=>{services.push({domain,service,data});}};
  await card._sendNotification({service:'notify.mobile_app_bbq_iphone',message:'Kern bereikt',key:'notify-test-1'});
  assert.equal(services.length,1,'valid opted-in notification can reach HA mobile notify service');
  assert.equal(services[0].domain,'notify');
  assert.equal(services[0].service,'mobile_app_bbq_iphone');
  await card._sendNotification({service:'notify.mobile_app_bbq_iphone',message:'Kern bereikt',key:'notify-test-1'});
  assert.equal(services.length,1,'duplicate notifications are suppressed by bridge');
  await card._sendNotification({service:'switch.turn_on',message:'Do not send',key:'notify-test-2'});
  assert.equal(services.length,1,'bridge cannot call other domains or switch the kamado');


  card.remove();
  assert.equal(subscriptions.size,0,'all HA user-storage subscriptions cleaned up');
}finally{parentDom.window.close();}
console.log('OK v4.6: HA user data and opt-in notification bridge');
