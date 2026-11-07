/* PR3 gated read-only integration into the real legacy v5 runtime.
 * Activation: explicit ?v6preview=1 only; zero storage writes and zero apply API.
 * Main v5 navigation and its existing storage code remain untouched.
 */
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {createOptimizerClient} from './optimizer-client.mjs';
import {mountRegisseurPreview} from './regisseur-view.mjs';

const PLAN_KEY='kamado-bereidingsplanner-v1';
const copy=o=>JSON.parse(JSON.stringify(o));
export function mountLegacyReadOnlyPreview({
  win=window,getLegacyState,
  maxCandidates=96
}={}){
  if(new URLSearchParams(win.location.search).get('v6preview')!=='1')
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
  info.textContent='v6 testweergave · Alleen lezen · Wijzigt je planning niet';
  const refresh=doc.createElement('button');
  refresh.id='bbq6-refresh';refresh.type='button';refresh.textContent='Ververs planning';
  const calculate=doc.createElement('button');
  calculate.id='bbq6-calculate';calculate.type='button';
  calculate.textContent='Zoek verbeteringen';
  const status=doc.createElement('p');
  status.id='bbq6-beta-status';status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const viewRoot=doc.createElement('div');
  viewRoot.id='bbq6-beta-view';
  header.append(info,refresh,calculate,status);
  host.append(header,viewRoot);
  shell.insertBefore(host,app);
  const css=doc.createElement('link');
  css.rel='stylesheet';
  css.href=new URL('./regisseur.css',import.meta.url).href;
  css.dataset.bbq6BetaCss='1';
  doc.head.append(css);
  const client=createOptimizerClient();
  let rendered=null,started=0,disposed=false,lastJSON=null;
  let input=null,baseline=null;
  function render(state){
    if(rendered)rendered.dispose();
    rendered=mountRegisseurPreview(viewRoot,{input,outcome:state});
  }
  function loadSnapshot(){
    const source=copy(getLegacyState());
    if(!source||!Array.isArray(source.dishes))
      throw new Error('INVALID_LEGACY_STATE');
    const json=JSON.stringify(source);
    const converted=fromLegacyState(source,{
      houseZone:'Europe/Amsterdam',now:Date.now()
    });
    if(!converted.input)throw new Error('INVALID_V6_INPUT');
    const next=converted.input;
    next.limits={maxCandidates,maxAlternatives:3};
    return {json,input:next,baseline:plan(next)};
  }
  function setStatus(message){status.textContent=message;}
  function refreshSnapshot(){
    started++;
    client.cancel();
    const next=loadSnapshot();
    lastJSON=next.json;
    input=next.input;
    baseline=next.baseline;
    render(baseline);
    setStatus('Actuele sessie ingelezen. Alleen bekijken; toepassen is uitgeschakeld.');
    calculate.disabled=!input.dishes.length||baseline.planStatus==='unknown';
    refresh.disabled=false;
  }
  async function run(){
    if(disposed||!input)return;
    const serial=++started;
    client.cancel();
    setStatus('Optimizer rekent veilig buiten de hoofdthread…');
    calculate.disabled=true;
    refresh.disabled=false;
    try{
      const outcome=await client.run(input);
      if(disposed||serial!==started)return;
      const actual=JSON.stringify(copy(getLegacyState()));
      if(actual!==lastJSON){
        render(baseline);
        setStatus('Planning is intussen gewijzigd. Ververs vóór je nieuwe voorstellen bekijkt.');
        return;
      }
      render(outcome);
      setStatus('Gereed: '+outcome.alternatives.length+
        ' voorstellen. Toepassen blijft uitgeschakeld.');
    }catch(error){
      if(disposed||serial!==started||error?.name==='AbortError')return;
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
      started++;client.cancel();
      setStatus('Planning in een ander tabblad gewijzigd. Ververs om verder te gaan.');
      calculate.disabled=true;
    }
  };
  const onHidden=()=>{if(doc.hidden){started++;client.cancel();}};
  refresh.addEventListener('click',refreshClick);
  calculate.addEventListener('click',run);
  win.addEventListener('storage',storageChanged);
  doc.addEventListener('visibilitychange',onHidden);
  try{refreshSnapshot();}catch(error){calculate.disabled=true;setStatus('V6 preview niet beschikbaar: '+error.message);}
  return {refresh:refreshClick,dispose(){
    if(disposed)return;
    disposed=true;
    client.dispose();
    refresh.removeEventListener('click',refreshClick);
    calculate.removeEventListener('click',run);
    win.removeEventListener('storage',storageChanged);
    doc.removeEventListener('visibilitychange',onHidden);
    rendered?.dispose();
    host.remove();css.remove();
  }};
}
