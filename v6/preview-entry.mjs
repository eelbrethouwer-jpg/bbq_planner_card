/* Standalone PR3 beta — same-origin v5 storage, never writes a live plan.
 * Keep the import token aligned with preview.html: version-consistency CI checks it.
 */
import {friendlyPreviewError,appendPreviewErrorDetails} from './preview-errors.mjs';
const BETA_VERSION='6.0.0-beta.1';
if(!window.__bbq6PreviewBlocked){
  try{
    const {mountLegacyReadOnlyPreview}=await import('./legacy-readonly-entry.mjs?v='+BETA_VERSION);
    mountLegacyReadOnlyPreview({
      win:window,
      standalone:true,
      getLegacyState:()=>{
        const raw=window.localStorage.getItem('kamado-bereidingsplanner-v1');
        if(raw===null||raw==='')throw new Error('NO_SAVED_PLAN');
        let state;
        try{state=JSON.parse(raw);}
        catch{throw new Error('INVALID_SAVED_PLAN');}
        if(!state||typeof state!=='object'||!Array.isArray(state.dishes))
          throw new Error('INVALID_SAVED_PLAN');
        return state;
      }
    });
  }catch(error){
    const area=document.getElementById('bbq6-recovery-root');
    if(area){
      area.hidden=false;
      area.textContent=friendlyPreviewError(error);
      appendPreviewErrorDetails(area,error);
    }
  }
}
