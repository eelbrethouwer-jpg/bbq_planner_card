/* PR3 fail-closed preboot guard: no live plan loads while recovery is pending. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {PLAN_KEY,JOURNAL_KEY} from '../v6/storage-journal.mjs';
const source=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
const state={date:'2026-11-14',dateMode:'manual',mealTime:'18:30',
  dishes:[{id:'a',name:'FICTIEF',kamado:'large',cook:60,rest:15,grill:120,
    method:'indirect',mode:'auto',phase:'waiting',prepTasks:[]}]};
const raw=JSON.stringify(state);
let count=0;
for(const journal of [
  'corrupt journal bytes',
  JSON.stringify({version:1,stage:'prepared',before:raw,
    after:JSON.stringify({...state,mealTime:'19:00'})}),
  JSON.stringify({version:1,stage:'committed',before:raw,
    after:JSON.stringify({...state,mealTime:'19:00'})})
]){
  const errors=[];
  const dom=new JSDOM(source,{
    url:'https://planner.test.invalid/dist/BBQ_bereidingsplanner_MEATER_v4.html',
    pretendToBeVisual:true,runScripts:'dangerously',beforeParse(w){
      w.localStorage.setItem(PLAN_KEY,raw);
      w.localStorage.setItem(JOURNAL_KEY,journal);
      w.localStorage.setItem('bbq-v5-previous-plan-v1','OLD-BACKUP');
      w.addEventListener('error',e=>errors.push(e.error?.message||e.message));
    }
  });
  try{
    assert.ok(dom.window.document.querySelector('#bbq6-recovery-blocked'),
      'pending journal must prevent v5 startup');
    assert.equal(dom.window.document.querySelector('#v5-root'),null);
    const heading=dom.window.document.querySelector('#bbq6-recovery-blocked h1');
    assert.ok(heading.textContent.includes('veilig herstel'));
    assert.equal(dom.window.localStorage.getItem(PLAN_KEY),raw,
      'guard must not mutate the v5 plan');
    assert.equal(dom.window.localStorage.getItem(JOURNAL_KEY),journal,
      'guard must preserve recovery evidence');
    assert.equal(dom.window.localStorage.getItem('bbq-v5-previous-plan-v1'),
      'OLD-BACKUP');
    assert.deepEqual(errors,[]);
    count++;
  }finally{dom.window.close();}
}
console.log('PASS '+count+
  ' PR3 preboot blocks corrupt, prepared and committed journals before v5 reads its state; no writes');
