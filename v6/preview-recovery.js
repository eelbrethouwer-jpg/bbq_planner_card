/* PR3 standalone preview: detect journal before any v6 planner loads.
 * This MUST NOT change the legacy v5 app or automatically roll back a plan.
 * Manual journal removal is destructive to recovery evidence: user confirms.
 */
(()=>{
  'use strict';
  const JOURNAL='bbq-v6-apply-journal-v1';
  const PLAN='kamado-bereidingsplanner-v1';
  const BACKUP='bbq-v5-previous-plan-v1';
  const root=document.getElementById('bbq6-recovery-root');
  if(!root)throw new Error('RECOVERY_ROOT_MISSING');
  let pending=null,storageError=null;
  try{pending=window.localStorage.getItem(JOURNAL);}
  catch(error){storageError=error;}
  window.__bbq6PreviewBlocked=!!storageError||pending!==null;
  if(!window.__bbq6PreviewBlocked)return;
  root.hidden=false;
  const make=(tag,text)=>{
    const element=document.createElement(tag);
    element.textContent=text;
    return element;
  };
  const heading=make('h1','BBQ Regisseur: opgeslagen herstelgegevens gevonden');
  const explanation=make('p',
    storageError?
      'De opslag kan niet worden gelezen. De preview start daarom niet. Controleer de browserinstellingen.':
      'Er is een onafgeronde of onbekende v6-opslagtransactie gevonden. '+
      'Je v5-planning is niet automatisch gewijzigd of hersteld. '+
      'Bewaar eerst een noodkopie voordat je besluit wat je doet.');
  const note=make('p',
    'Het verwijderen van het journaal herstelt geen eerdere wijzigingen. '+
    'Het kan een gedeeltelijk opgeslagen plan achterlaten. '+
    'Gebruik dit alleen nadat je de gegevens hebt gecontroleerd.');
  const status=make('p','');
  status.id='bbq6-recovery-status';
  status.setAttribute('role','status');
  const download=make('button','Download noodkopie');
  download.id='bbq6-download-emergency';download.type='button';
  const discard=make('button','Journal verwijderen en planner openen');
  discard.id='bbq6-discard-journal';discard.type='button';
  if(storageError){download.disabled=true;discard.disabled=true;}
  root.append(heading,explanation,note,download,discard,status);
  function snapshot(){
    return {
      format:'bbq-v6-emergency-backup-v1',
      exportedAt:new Date().toISOString(),
      keys:{
        [JOURNAL]:window.localStorage.getItem(JOURNAL),
        [PLAN]:window.localStorage.getItem(PLAN),
        [BACKUP]:window.localStorage.getItem(BACKUP)
      }
    };
  }
  download.addEventListener('click',()=>{
    try{
      const payload=JSON.stringify(snapshot(),null,2);
      const blob=new Blob([payload],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download='bbq-regisseur-noodkopie-'+
        new Date().toISOString().slice(0,10)+'.json';
      link.style.display='none';
      document.body.append(link);
      link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='Download gestart. Controleer of het bestand is opgeslagen.';
    }catch(error){
      status.textContent='Noodkopie maken mislukt: '+(error?.message||error);
    }
  });
  discard.addEventListener('click',()=>{
    if(!window.confirm(
      'LET OP: alleen het v6-journaal wordt verwijderd. Dit herstelt NIETS en kan herstel onmogelijk maken. '+
      'Heb je een noodkopie gemaakt en gecontroleerd? Wil je het journaal echt verwijderen?'
    ))return;
    try{
      window.localStorage.removeItem(JOURNAL);
      if(window.localStorage.getItem(JOURNAL)!==null)
        throw new Error('JOURNAL_DELETE_FAILED');
      status.textContent='Journaal verwijderd. De bestaande v5-planner wordt geopend.';
      window.location.assign('../dist/BBQ_bereidingsplanner_MEATER_v4.html');
    }catch(error){
      status.textContent='Journaal verwijderen mislukt: '+(error?.message||error);
    }
  });
})();
