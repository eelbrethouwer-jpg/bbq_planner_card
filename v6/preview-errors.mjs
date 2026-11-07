/* Human-readable, fail-closed preview error messages.
 * Never display raw parser errors or internal codes as the primary status.
 */
const details = [
  ['NO_SAVED_PLAN',
   'Er is nog geen BBQ-planning opgeslagen in deze browser. Open eerst de bestaande BBQ Planner in Safari of dezelfde browser, sla een planning op en open daarna de preview opnieuw.'],
  ['INVALID_SAVED_PLAN',
   'De opgeslagen BBQ-planning kan niet worden gelezen. Open de bestaande planner en controleer of je je planning kunt exporteren. De preview heeft niets aangepast.'],
  ['STALE_STORED_PLAN',
   'De BBQ-planning is gewijzigd. Herlaad de pagina om de nieuwste planning te bekijken.'],
  ['STALE_LIVE_PLAN',
   'De BBQ-planning is gewijzigd. Herlaad de pagina om de nieuwste planning te bekijken.'],
  ['WEB_LOCKS_UNAVAILABLE',
   'De browser ondersteunt de vereiste opslagbeveiliging niet. Je kunt de voorstellen bekijken, maar geen concept bewaren.']
];
export function friendlyPreviewError(error){
  const message=String(error?.message||error||'');
  if(error instanceof SyntaxError || /SyntaxError|Unexpected token|JSON_PARSE/.test(message))
    return 'De opgeslagen BBQ-planning bevat ongeldige gegevens. Controleer of je deze in de bestaande planner kunt openen of exporteren. De preview heeft niets aangepast.';
  for(const [code,label] of details)if(message.includes(code))return label;
  return 'De preview kan je planning momenteel niet openen. Probeer de bestaande planner te openen en herlaad daarna de preview. Je bestaande planning is niet aangepast.';
}
export function appendPreviewErrorDetails(container,error){
  const doc=container.ownerDocument;
  const old=container.querySelector('[data-bbq6-error-details]');
  old?.remove();
  const details=doc.createElement('details');
  details.dataset.bbq6ErrorDetails='1';
  const summary=doc.createElement('summary');
  summary.textContent='Technische details';
  const code=doc.createElement('code');
  code.textContent=String(error?.message||error||'Onbekende fout');
  details.append(summary,code);
  container.append(details);
}
