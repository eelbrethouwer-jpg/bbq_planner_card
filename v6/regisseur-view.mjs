/* PR3 isolated mobile-first view. Preview-only until a verified storage adapter is provided. */
import {buildPreviewModel} from './preview-model.mjs';

export function mountRegisseurPreview(root,{input,outcome,loading=false,onApply=null,
  onSaveDraft=null}={}){
  if(!root||!root.ownerDocument)throw new TypeError('A DOM root is required');
  let sourceInput=input,sourceOutcome=outcome,isLoading=loading;
  let selectedId=null,confirming=false,applying=false,message='';
  const doc=root.ownerDocument;
  root.classList.add('bbq6-root');
  const node=(tag,cls='',text='')=>{
    const item=doc.createElement(tag);
    if(cls)item.className=cls;
    if(text!==undefined&&text!==null)item.textContent=String(text);
    return item;
  };
  const button=(label,action,disabled=false)=>{
    const b=node('button','bbq6-button',label);
    b.type='button';b.dataset.bbq6Action=action;b.disabled=disabled;
    return b;
  };
  function section(title,className){
    const s=node('section',className);
    s.append(node('h3','bbq6-section-title',title));
    return s;
  }
  function draw(){
    const model=buildPreviewModel({input:sourceInput,outcome:sourceOutcome,
      selectedId,loading:isLoading});
    const wrapper=node('div','bbq6-screen');
    const header=node('header','bbq6-header');
    header.append(node('div','bbq6-eyebrow','BBQ Regisseur · v6-preview'),
      node('h2','bbq6-title','Jouw BBQ-planning'));
    const meta=node('div','bbq6-meta');
    meta.append(node('span','bbq6-state',isLoading?'Berekenen…':model.statusLabel));
    if(model.maxCandidates!==null){
      meta.append(node('span','bbq6-budget',
        'Onderzocht: '+model.testedCandidates+'/'+model.maxCandidates+' kandidaten'));
    }
    if(model.budgetExhausted)meta.append(node('strong','bbq6-alert',
      'Zoekbudget bereikt — betere opties kunnen ontbreken'));
    header.append(meta);
    wrapper.append(header);

    const serving=section('Samen serveren','bbq6-serving');
    const slotRow=node('div','bbq6-chips');
    for(const slot of model.slots){
      slotRow.append(node('span','bbq6-chip',slot.id+' · '+slot.when));
    }
    serving.append(slotRow);
    wrapper.append(serving);

    const dishSection=section('Gerechten','bbq6-dishes');
    const dishes=node('div','bbq6-dish-list');
    for(const d of model.dishes){
      const card=node('div','bbq6-dish');
      card.append(node('strong','',d.name),
        node('small','',d.kamadoId+' · '+d.slotId+' · '+d.serve));
      if(d.fixed)card.append(node('span','bbq6-locked','Vastgezet'));
      dishes.append(card);
    }
    dishSection.append(dishes);
    wrapper.append(dishSection);

    if(model.warnings.length){
      const issues=section('Waarschuwingen en conflicten','bbq6-issues');
      const list=node('ul','bbq6-list');
      for(const issue of model.warnings){
        const item=node('li','bbq6-issue',
          issue.code+(issue.affectedIds.length?' · '+issue.affectedIds.join(', '):''));
        item.dataset.severity=issue.severity;
        list.append(item);
      }
      issues.append(list);
      wrapper.append(issues);
    }

    const time=section('Tijdlijnen per kamado','bbq6-timelines');
    const lanes=node('div','bbq6-lanes');
    for(const kamado of model.kamados){
      const lane=node('div','bbq6-lane');
      lane.append(node('h4','',kamado.name));
      if(!kamado.tasks.length)lane.append(node('p','bbq6-muted','Geen taken gepland'));
      const events=node('ol','bbq6-events');
      for(const task of kamado.tasks){
        const entry=node('li','bbq6-event');
        entry.append(node('time','',task.when),
          node('span','',task.label+(task.dish?' · '+task.dish:'')));
        events.append(entry);
      }
      lane.append(events);
      lanes.append(lane);
    }
    time.append(lanes);
    wrapper.append(time);
    if(model.preparation.length){
      const prep=section('Voorbereidingen en overige taken','bbq6-preparation');
      const list=node('ol','bbq6-events');
      for(const task of model.preparation){
        const item=node('li','bbq6-event');
        item.append(node('time','',task.when),
          node('span','',task.label+(task.dish?' · '+task.dish:'')));
        list.append(item);
      }
      prep.append(list);
      wrapper.append(prep);
    }
    const options=section('Slimme alternatieven','bbq6-options');
    if(isLoading)options.append(node('p','bbq6-muted','Optimizer draait buiten de interface…'));
    else if(!model.alternatives.length)options.append(node('p','bbq6-muted','Geen verbeterende alternatieven gevonden.'));
    else{
      const list=node('div','bbq6-option-list');
      for(const option of model.alternatives){
        const card=node('div','bbq6-option');
        if(model.selected?.id===option.id)card.classList.add('bbq6-selected');
        card.append(node('strong','',option.id+' · '+option.statusLabel));
        const ul=node('ul','bbq6-list');
        for(const change of option.changes)ul.append(node('li','',change));
        card.append(ul);
        if(option.warnings.length)card.append(node('small','bbq6-alert',
          'Controleer: '+option.warnings.join(', ')));
        const select=button(model.selected?.id===option.id?'Geselecteerd':'Bekijk alternatief',
          'select:'+option.id);
        select.setAttribute('aria-pressed',String(model.selected?.id===option.id));
        card.append(select);
        list.append(card);
      }
      options.append(list);
    }
    wrapper.append(options);
    if(message)wrapper.append(node('p','bbq6-notice',message));
    const actions=node('footer','bbq6-actions');
    if(confirming){
      actions.append(node('p','bbq6-confirm',
        'Bevestig: dit voorstel kan jouw planning wijzigen. Controleer de waarschuwingen.'));
      actions.append(button('Terug','back',applying),
        button('Ja, toepassen','confirm',applying));
    }else{
      actions.append(button('Annuleren','cancel',!model.selected||applying));
      if(typeof onSaveDraft==='function')
        actions.append(button(model.selected?.status==='conditional'?
          'Bewaar concept (voorwaarden controleren)':'Bewaar als concept','save',
          !model.selected||!['feasible','conditional'].includes(model.selected.status)||applying));
      actions.append(button('Toepassen','apply',
        !model.selected||typeof onApply!=='function'||applying));
    }
    wrapper.append(actions);
    root.replaceChildren(wrapper);
  }
  async function onClick(event){
    const control=event.target.closest?.('button[data-bbq6-action]');
    if(!control||!root.contains(control)||control.disabled||applying)return;
    const action=control.dataset.bbq6Action;
    if(action.startsWith('select:')){
      selectedId=action.slice(7);confirming=false;message='';draw();return;
    }
    if(action==='cancel'){selectedId=null;confirming=false;message='';draw();return;}
    if(action==='back'){confirming=false;draw();return;}
    if(action==='save'&&selectedId&&typeof onSaveDraft==='function'){
      const model=buildPreviewModel({
        input:sourceInput,outcome:sourceOutcome,selectedId
      });
      if(!model.selected||!['feasible','conditional'].includes(model.selected.status))return;
      applying=true;draw();
      try{
        await onSaveDraft(model.selected.raw,{
          expectedFingerprint:model.baselineFingerprint
        });
        message=model.selected.status==='conditional'?
          'Concept bewaard onder voorwaarden; fysieke geschiktheid nog controleren. Je bestaande planning is niet gewijzigd.':
          'Concept opgeslagen. De bestaande BBQ-planning is niet gewijzigd.';
      }catch(error){
        message='Concept niet opgeslagen: '+
          (error instanceof Error?error.message:'onbekende fout');
      }finally{
        applying=false;draw();
      }
      return;
    }
    if(action==='apply'){
      if(typeof onApply!=='function'||!selectedId)return;
      confirming=true;draw();return;
    }
    if(action==='confirm'&&confirming&&selectedId&&typeof onApply==='function'){
      const model=buildPreviewModel({input:sourceInput,outcome:sourceOutcome,selectedId});
      if(!model.selected)return;
      applying=true;draw();
      try{
        await onApply(model.selected.raw,{
          expectedFingerprint:model.baselineFingerprint,
          requiresRollback:true
        });
        message='Voorstel toegepast door de aangesloten opslagadapter.';
        selectedId=null;confirming=false;
      }catch(error){
        message='Toepassen mislukt: '+(error instanceof Error?error.message:'onbekende fout');
        confirming=false;
      }finally{applying=false;draw();}
    }
  }
  root.addEventListener('click',onClick);
  draw();
  return {
    update({input:nextInput,outcome:nextOutcome,loading:nextLoading=false}){
      sourceInput=nextInput;sourceOutcome=nextOutcome;isLoading=nextLoading;
      selectedId=null;confirming=false;message='';draw();
    },
    dispose(){root.removeEventListener('click',onClick);root.replaceChildren();}
  };
}
