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
    window.addEventListener('error',event=>{errors.push(String(event.error?.stack||event.message));});
  }
});
const {window}=dom;
const doc=window.document;
const $=x=>doc.getElementById(x);
function click(el){assert.ok(el,'Missing button');el.click()}
function count(){return doc.querySelectorAll('#dishes article.dish').length}
try{
  assert.equal(errors.length,0,'startup JavaScript errors');
  assert.match($('js-status').textContent,/Interactieve bediening actief/);
  assert.equal(count(),3,'start with three default dishes');
  assert.equal($('meater-source').textContent,'Niet gekoppeld · plannermodus');

  click($('add'));assert.equal(count(),4,'add dish button');
  const select=$('preset');select.value='Ribeye 500 g';
  select.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(count(),5,'ribeye preset');
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
  assert.ok(card.textContent.includes('BBQ proefgerecht'));
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

  $('recipe-url').value='not a valid url';
  click($('recipe-read'));assert.match($('recipe-message').textContent,/geldige http/,'invalid URL handled locally');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OK: initial render, controls, add, preset, expandable steps, recipe import, local saves, reviews, reset and offline MEATER');
}finally{
  window.close();
}
