/* PR3 gated read-only integration into the real legacy v5 runtime.
 * Activation: explicit ?v6preview=1 only; writes only isolated concept metadata
 * on explicit user click and NEVER touches the live v5 plan or apply API.
 * Main v5 navigation and its existing storage code remain untouched.
 */
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {createOptimizerClient} from './optimizer-client.mjs';
import {mountRegisseurPreview} from './regisseur-view.mjs';
import {createPlanLock} from './plan-lock.mjs';
import {saveProposalDraft,inspectProposalDraft,discardProposalDraft,DRAFT_KEY}
  from './proposal-draft.mjs';

const PLAN_KEY='kamado-bereidingsplanner-v1';
const copy=o=>JSON.parse(JSON.stringify(o));
export function mountLegacyReadOnlyPreview({
  win=window,getLegacyState,standalone=false,
  maxCandidates=96
}={}){
  if(!standalone&&new URLSearchParams(win.location.search).get('v6preview')!=='1')
    return null;
  if(typeof getLegacyState!=='function')
    throw new Error('READONLY_SOURCE_UNAVAILABLE');
  if(!Number.isInteger(maxCandidates)||maxCandidates<0||maxCandidates>512)
    throw new Error('INVALID_SEARCH_BUDGET');
  const doc=win.document;
  const app=doc.getElementById('v5-root');
  if(!app)throw new Error('LEGACY_PLANNER_NOT_INITIALIZED');
  if(doc.getElementById('bbq6-beta-panel'))
    throw new Error('PREVIEW_ALREADY_MOUNTED');
  const shell=app.parentElement;
  const host=doc.createElement('section');
  host.id='bbq6-beta-panel';
  host.setAttribute('aria-label','BBQ Regisseur v6 testweergave');
  host.className='bbq6-beta-shell';
  const header=doc.createElement('div');
  header.className='bbq6-beta-toolbar';
  const info=doc.createElement('p');
  info.textContent='v6 testweergave · Concept apart bewaren · Je actieve planning blijft ongewijzigd';
  const refresh=doc.createElement('button');
  refresh.id='bbq6-refresh';refresh.type='button';refresh.textContent='Ververs planning';
  const calculate=doc.createElement('button');
  calculate.id='bbq6-calculate';calculate.type='button';
  calculate.textContent='Zoek verbeteringen';
  const status=doc.createElement('p');
  status.id='bbq6-beta-status';status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const savedStatus=doc.createElement('p');
  savedStatus.id='bbq6-draft-status';
  savedStatus.setAttribute('role','status');
  const discard=doc.createElement('button');
  discard.id='bbq6-discard-draft';discard.type='button';
  discard.textContent='Verwijder bewaard concept';discard.hidden=true;
  const viewRoot=doc.createElement('div');
  viewRoot.id='bbq6-beta-view';
  header.append(info,refresh,calculate,status,savedStatus,discard);
  host.append(header,viewRoot);
  shell.insertBefore(host,app);
  const css=doc.createElement('link');
  css.rel='stylesheet';
  css.href=new URL('./regisseur.css',import.meta.url).href;
  css.dataset.bbq6BetaCss='1';
  doc.head.append(css);
  const client=createOptimizerClient();
  let withDraftLock=null;
  try{withDraftLock=createPlanLock({lockManager:win.navigator.locks});}
  catch{ /* no fallback: saving concepts is disabled without Web Locks */ }
  let rendered=null,started=0,disposed=false,remoteStale=false,lastJSON=null;
  let lastStoredJSON=null,legacySnapshot=null,latestOutcome=null;
  let input=null,baseline=null,draftCheck=0;
  async function refreshDraftStatus(){
    const sequence=++draftCheck;
    try{
      const result=await inspectProposalDraft({
        storage:win.localStorage,liveState:getLegacyState(),
        subtle:win.crypto?.subtle
      });
      if(disposed||sequence!==draftCheck)return;
      const labels={
        none:'Nog geen voorstel als concept bewaard.',
        current:'Bewaard concept past bij deze planning; nog niet toegepast.',
        outdated:'Bewaard concept is verouderd. Bereken opnieuw en bewaar een nieuw voorstel.',
        unsafe_recovery:'Herstel van een eerdere wijziging is vereist; concept niet toepassen.',
        corrupt:'Bewaard concept is ongeldig. Verwijder het en bereken opnieuw.'
      };
      savedStatus.textContent=labels[result.status]||'Conceptstatus onbekend';
      if(result.status==='current'&&result.record?.planStatus==='conditional')
        savedStatus.textContent=
          'Bewaard concept onder voorwaarden; fysieke geschiktheid eerst controleren.';
      discard.hidden=result.status==='none';
      discard.disabled=!withDraftLock;
    }catch(error){
      if(disposed||sequence!==draftCheck)return;
      savedStatus.textContent='Conceptstatus niet beschikbaar: '+(error?.message||error);
      discard.hidden=true;
    }
  }
  async function saveDraftChoice(selected,{expectedFingerprint}={}){
    if(!withDraftLock)throw new Error('WEB_LOCKS_UNAVAILABLE');
    if(remoteStale||!latestOutcome||!selected||
      latestOutcome.alternatives?.find(a=>a.id===selected.id)!==selected)
      throw new Error('STALE_SELECTION');
    if(expectedFingerprint!==latestOutcome.provenance?.inputFingerprint)
      throw new Error('STALE_FINGERPRINT');
    if(JSON.stringify(getLegacyState())!==lastJSON)
      throw new Error('STALE_LIVE_PLAN');
    const expectedDraftJSON=win.localStorage.getItem(DRAFT_KEY);
    const replaceExisting=expectedDraftJSON!==null;
    if(replaceExisting&&!win.confirm(
      'Je hebt al een bewaard concept. Wil je dat concept echt vervangen?'+
      ' Je bestaande BBQ-planning wordt niet gewijzigd.'
    ))throw new Error('CONCEPT_OVERSCHRIJVEN_GEANNULEERD');
    const result=await saveProposalDraft({
      storage:win.localStorage,legacyState:legacySnapshot,
      readLiveState:getLegacyState,input,outcome:latestOutcome,
      alternativeId:selected.id,expectedStorageJSON:lastStoredJSON,
      expectedDraftJSON,replaceExisting,
      allowConditional:selected.planStatus==='conditional',
      subtle:win.crypto?.subtle,withExclusiveLock:withDraftLock
    });
    await refreshDraftStatus();
    return result;
  }
  function isSnapshotCurrent(){
    if(lastJSON===null)return true;
    try{
      return JSON.stringify(getLegacyState())===lastJSON&&
        win.localStorage.getItem(PLAN_KEY)===lastStoredJSON;
    }catch{return false;}
  }
  function invalidate(reason='Planning gewijzigd. Herlaad de pagina om verder te gaan.'){
    if(disposed||remoteStale)return;
    started++;
    client.cancel();
    remoteStale=true;latestOutcome=null;
    rendered?.dispose();rendered=null;viewRoot.replaceChildren();
    setStatus(reason);
    refresh.textContent='Herlaad planning';
    calculate.disabled=true;
    void refreshDraftStatus();
  }
  function checkSnapshot(){
    if(!disposed&&!remoteStale&&lastJSON!==null&&!isSnapshotCurrent())
      invalidate();
  }
  function render(state){
    if(!isSnapshotCurrent()){
      invalidate();
      return;
    }
    if(rendered)rendered.dispose();
    rendered=mountRegisseurPreview(viewRoot,{
      input,outcome:state,onSaveDraft:state===latestOutcome&&withDraftLock&&
        typeof lastStoredJSON==='string'?saveDraftChoice:null
    });
  }
  function loadSnapshot(){
    const stored=win.localStorage.getItem(PLAN_KEY);
    const source=copy(getLegacyState());
    if(stored!==win.localStorage.getItem(PLAN_KEY))
      throw new Error('STALE_STORED_PLAN');
    if(!source||!Array.isArray(source.dishes))
      throw new Error('INVALID_LEGACY_STATE');
    const json=JSON.stringify(source);
    const converted=fromLegacyState(source,{
      houseZone:'Europe/Amsterdam',now:Date.now()
    });
    if(!converted.input)throw new Error('INVALID_V6_INPUT');
    const next=converted.input;
    next.limits={maxCandidates,maxAlternatives:3};
    return {json,stored,source,input:next,baseline:plan(next)};
  }
  function setStatus(message){status.textContent=message;}
  function refreshSnapshot(){
    if(remoteStale){
      // v5 holds a stale closure state; a refresh must RELOAD the entire app,
      // not reuse getLegacyState() from this tab and overwrite newer storage.
      win.location.reload();
      return;
    }
    started++;
    client.cancel();
    const next=loadSnapshot();
    lastJSON=next.json;
    lastStoredJSON=next.stored;
    legacySnapshot=next.source;
    latestOutcome=null;
    input=next.input;
    baseline=next.baseline;
    render(baseline);
    if(remoteStale)return;
    setStatus('Actuele sessie ingelezen. Alleen bekijken; toepassen is uitgeschakeld.');
    calculate.disabled=!input.dishes.length||baseline.planStatus==='unknown';
    refresh.disabled=false;
    void refreshDraftStatus();
  }
  async function run(){
    if(disposed||remoteStale||!input)return;
    const serial=++started;
    client.cancel();
    setStatus('Optimizer rekent veilig buiten de hoofdthread…');
    calculate.disabled=true;
    refresh.disabled=false;
    try{
      const outcome=await client.run(input);
      if(disposed||serial!==started)return;
      const actual=JSON.stringify(copy(getLegacyState()));
      if(actual!==lastJSON||win.localStorage.getItem(PLAN_KEY)!==lastStoredJSON){
        invalidate();
        return;
      }
      latestOutcome=outcome;
      render(outcome);
      setStatus('Gereed: '+outcome.alternatives.length+
        ' voorstellen. Toepassen blijft uitgeschakeld.');
    }catch(error){
      if(disposed||serial!==started||error?.name==='AbortError')return;
      latestOutcome=null;
      render(baseline);
      setStatus('Berekening mislukt: '+(error?.message||'onbekende fout'));
    }finally{
      if(!disposed&&serial===started)
        calculate.disabled=!input?.dishes.length||baseline?.planStatus==='unknown';
    }
  }
  const refreshClick=()=>{try{refreshSnapshot();}catch(error){
    calculate.disabled=true;setStatus('Verversen mislukt: '+(error?.message||error));
  }};
  const storageChanged=event=>{
    if(event.key===PLAN_KEY||event.key===null){
      invalidate('Planning gewijzigd in een ander tabblad. Herlaad de pagina.');
    }else if(event.key===DRAFT_KEY){
      void refreshDraftStatus();
    }
  };
  const discardClick=async()=>{
    if(!withDraftLock)return;
    discard.disabled=true;
    try{
      await discardProposalDraft({
        storage:win.localStorage,withExclusiveLock:withDraftLock
      });
      await refreshDraftStatus();
    }catch(error){
      savedStatus.textContent='Concept verwijderen mislukt: '+(error?.message||error);
      discard.disabled=false;
    }
  };
  const onHidden=()=>{
    if(doc.hidden){started++;client.cancel();}
    else checkSnapshot();
  };
  const onFocus=()=>checkSnapshot();
  const healthTimer=win.setInterval(checkSnapshot,2000);
  refresh.addEventListener('click',refreshClick);
  calculate.addEventListener('click',run);
  discard.addEventListener('click',discardClick);
  win.addEventListener('storage',storageChanged);
  win.addEventListener('focus',onFocus);
  doc.addEventListener('visibilitychange',onHidden);
  try{refreshSnapshot();}catch(error){calculate.disabled=true;setStatus('V6 preview niet beschikbaar: '+error.message);}
  return {refresh:refreshClick,dispose(){
    if(disposed)return;
    disposed=true;
    client.dispose();
    refresh.removeEventListener('click',refreshClick);
    calculate.removeEventListener('click',run);
    discard.removeEventListener('click',discardClick);
    win.removeEventListener('storage',storageChanged);
    win.removeEventListener('focus',onFocus);
    doc.removeEventListener('visibilitychange',onHidden);
    win.clearInterval(healthTimer);
    rendered?.dispose();
    host.remove();css.remove();
  }};
}
