/* Standalone, same-origin PR3 entry: no live v5 state writes and no dist imports. */
if(!window.__bbq6PreviewBlocked){
  try{
    const {mountLegacyReadOnlyPreview}=await import('./legacy-readonly-entry.mjs');
    mountLegacyReadOnlyPreview({
      win:window,
      standalone:true,
      getLegacyState:()=>{
        const raw=window.localStorage.getItem('kamado-bereidingsplanner-v1');
        if(!raw)throw new Error('NO_SAVED_PLAN: sla eerst een planning op in v5');
        const state=JSON.parse(raw);
        if(!state||!Array.isArray(state.dishes))throw new Error('INVALID_SAVED_PLAN');
        return state;
      }
    });
  }catch(error){
    const area=document.getElementById('bbq6-recovery-root');
    if(area){
      area.hidden=false;
      area.textContent='Preview niet beschikbaar: '+(error?.message||'onbekende fout');
    }
  }
}
