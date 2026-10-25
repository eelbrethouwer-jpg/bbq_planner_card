/* Synthetic v5.0.1 recipe chooser; no claim of physical Safari validation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=x=>fs.readFileSync(x,'utf8');
const html=read('dist/BBQ_bereidingsplanner_MEATER_v4.html');
const mainLoader='<script src="./bbq-v5.js?v=5.0.1"></script>';
const recipeLoader='<script src="./bbq-v501.js?v=5.0.1"></script>';
assert.ok(html.includes(mainLoader)&&html.includes(recipeLoader),'current v5 bundle and recipe switch loaded');
const body=html.replace(mainLoader,'<script>'+read('dist/bbq-v5.js')+'</script>').replace(recipeLoader,'<script>'+read('dist/bbq-v501.js')+'</script>');
const errors=[];
const dom=new JSDOM(body,{
 url:'https://planner.test.invalid/dist/BBQ_bereidingsplanner_MEATER_v4.html',
 pretendToBeVisual:true,runScripts:'dangerously',
 beforeParse(window){
  window.scrollTo=()=>{};
  window.Element.prototype.scrollIntoView=()=>{};
  window.confirm=()=>true;
  window.alert=()=>{};
  window.print=()=>{};
  window.prompt=()=>null;
  window.URL.createObjectURL=()=> 'blob:https://planner.test.invalid/a';
  window.URL.revokeObjectURL=()=>{};
  window.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
 }
});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const click=el=>{assert.ok(el,'click target missing');el.click()};
function select(tab){click(d.querySelector('[data-v501-recipe-tab="'+tab+'"]'))}
function pane(tab){return $('v501-recipe-panel-'+tab)|| (tab==='junkie'?$('v48-catalog'):null)}
function current(){return d.querySelector('[data-v501-recipe-tab][aria-selected=true]')?.dataset.v501RecipeTab}
try{
 assert.equal(errors.length,0,'page initializes without errors');
 assert.equal(d.querySelectorAll('#v501-recipe-tabs [role=tab]').length,3,'all three source tabs exist');
 assert.deepEqual([...d.querySelectorAll('#v501-recipe-tabs button')].map(el=>el.textContent.trim()),['✨Recept genereren','📚Mijn bibliotheek','🔥BBQ Junkie']);
 assert.equal(current(),'library','first visit defaults to personal library');
 assert.ok(!pane('library').hidden,'library panel displayed');
 assert.ok(pane('generate').hidden&&pane('junkie').hidden,'other sources are hidden');
 assert.ok($('library-panel').closest('#v47-recipes'),'saved recipe library retained');
 assert.equal(d.querySelectorAll('#library-panel').length,1,'library not duplicated');
 select('generate');
 assert.equal(current(),'generate');
 assert.ok($('recipe-importer').open,'generator form is open');
 assert.ok(!pane('generate').hidden&&pane('library').hidden);
 assert.ok($('recipe-url')&&$('recipe-text')&&$('recipe-read'),'existing generator handlers retained');
 assert.equal(w.localStorage.getItem('bbq-v501-recipe-tab-v1'),'generate');
 select('junkie');
 assert.equal(current(),'junkie');
 assert.ok(!pane('junkie').hidden,'catalog becomes visible');
 assert.equal($('v48-grid').querySelectorAll('.v48-card').length,11,'curated catalog remains intact');
 assert.ok($('v48-grid').querySelector('[data-v48-action="import"]'),'existing opt-in import works');
 const right=d.querySelector('[data-v501-recipe-tab="junkie"]');
 right.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
 assert.equal(current(),'generate','keyboard Home navigates recipe tabs');
 right.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
 assert.equal(current(),'junkie','keyboard End navigates recipe tabs');
 // Navigate from the v5 session flow to each existing recipe source, not to the wrong legacy section.
 click(d.querySelector('#v5-root [data-v5-act="recipes"]'));
 assert.ok(d.body.classList.contains('v5-legacy'),'v5 recipe action opens existing recipe controller');
 assert.equal(current(),'library','v5 recipe entry defaults to library');
 assert.equal($('v47-recipes').hidden,false,'recipes page visible');
 click($('v5-back'));
 click(d.querySelector('#v5-root [data-v5-act="new"]'));
 click(d.querySelector('#v5-root [data-v5-act="recipe-generate"]'));
 assert.equal(current(),'generate','session CTA opens generator');
 click($('v5-back'));
 click(d.querySelector('#v5-root [data-v5-act="recipe-junkie"]'));
 assert.equal(current(),'junkie','session CTA opens BBQ Junkie');
 assert.ok(!errors.length,'no runtime script errors '+errors.join('\n'));
 const css=read('dist/bbq-v501.css');
 assert.match(css,/safe-area-inset-top/,'iPhone safe area override');
 assert.match(css,/\.v5-card>\.v5-grid/,'narrow setup uses one-column layout');
 assert.match(css,/#add-area/,'legacy recipe selector overflow fix');
 assert.match(css,/\.v501-recipe-choice/,'new touch-target styles');
 console.log('OK v5.0.1 recipe tabs: generators, saved library, BBQ Junkie, keyboard, v5 session links');
}finally{w.close()}
