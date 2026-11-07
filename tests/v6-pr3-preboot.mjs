/* PR3 route (b): recovery controls on the separate preview (NOT dist/v5). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {PLAN_KEY,JOURNAL_KEY} from '../v6/storage-journal.mjs';

const BACKUP='bbq-v5-previous-plan-v1';
const recovery=fs.readFileSync('v6/preview-recovery.js','utf8');
const html=fs.readFileSync('v6/preview.html','utf8')
  .replace('<script src="./preview-recovery.js"></script>',
    '<script>'+recovery+'</script>');
const state={date:'2026-11-14',dateMode:'manual',mealTime:'18:30',
  dishes:[{id:'a',name:'FICTIEF',kamado:'large',cook:60,rest:15,grill:120,
    method:'indirect',mode:'auto',phase:'waiting',prepTasks:[]}]};
const raw=JSON.stringify(state);
let count=0;
for(const journal of [
  '{corrupt',
  '',
  JSON.stringify({version:1,stage:'prepared',before:raw,
    after:JSON.stringify({...state,mealTime:'19:00'})})
]){
  let approve=false,captured=null,downloaded=null;
  const dom=new JSDOM(html,{
    url:'https://planner.test.invalid/v6/preview.html',
    pretendToBeVisual:true,runScripts:'dangerously',beforeParse(w){
      w.localStorage.setItem(PLAN_KEY,raw);
      w.localStorage.setItem(JOURNAL_KEY,journal);
      w.localStorage.setItem(BACKUP,'OLD-BACKUP');
      w.confirm=()=>approve;
      // jsdom's Blob has no .text(), unlike real browsers.
      // A test-only Blob replacement captures the exact JSON payload.
      w.Blob=class {
        constructor(parts){this.payload=parts.join('');}
        async text(){return this.payload;}
      };
      w.URL.createObjectURL=blob=>{captured=blob;return 'blob:emergency';};
      w.URL.revokeObjectURL=()=>{};
      w.HTMLAnchorElement.prototype.click=function(){
        downloaded={filename:this.download,url:this.href};
      };
    }
  });
  try{
    const w=dom.window,root=w.document.getElementById('bbq6-recovery-root');
    assert.equal(w.__bbq6PreviewBlocked,true);
    assert.equal(root.hidden,false);
    assert.ok(root.textContent.includes('geen')||root.textContent.includes('niet'));
    assert.equal(w.localStorage.getItem(PLAN_KEY),raw);
    const download=w.document.getElementById('bbq6-download-emergency');
    assert.ok(download);
    download.click();
    assert.ok(captured);
    const payload=JSON.parse(await captured.text());
    assert.equal(payload.keys[PLAN_KEY],raw);
    assert.equal(payload.keys[JOURNAL_KEY],journal);
    assert.equal(payload.keys[BACKUP],'OLD-BACKUP');
    assert.ok(downloaded.filename.endsWith('.json'));
    const discard=w.document.getElementById('bbq6-discard-journal');
    discard.click();
    assert.equal(w.localStorage.getItem(JOURNAL_KEY),journal,
      'cancel must preserve journal');
    assert.equal(w.localStorage.getItem(PLAN_KEY),raw);
    approve=true;
    discard.click();
    assert.equal(w.localStorage.getItem(JOURNAL_KEY),null,
      'confirmed discard must remove only journal');
    assert.equal(w.localStorage.getItem(PLAN_KEY),raw);
    assert.equal(w.localStorage.getItem(BACKUP),'OLD-BACKUP');
    count++;
  }finally{dom.window.close();}
}
{
  const dom=new JSDOM(html,{url:'https://planner.test.invalid/v6/preview.html',
    runScripts:'dangerously',beforeParse(w){w.localStorage.setItem(PLAN_KEY,raw);}});
  assert.equal(dom.window.__bbq6PreviewBlocked,false);
  assert.equal(dom.window.document.getElementById('bbq6-recovery-root').hidden,true);
  assert.equal(dom.window.localStorage.getItem(PLAN_KEY),raw);
  dom.window.close();
  count++;
}
console.log('PASS '+count+' PR3 standalone preview recovery cases: corrupt/empty/prepared journal, JSON export, cancel, confirm, unchanged plan');
