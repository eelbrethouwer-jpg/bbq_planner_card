/* PR3 demo ONLY. Explicitly fictional recipes; no persistent storage or production imports. */
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {toInstant} from '../engine/time.mjs';
import {createOptimizerClient} from './optimizer-client.mjs';
import {mountRegisseurPreview} from './regisseur-view.mjs';

const zone='Europe/Amsterdam',date='2026-11-14';
const now=toInstant(date,'12:00',zone);
if(!now.ok)throw Error('Invalid fictional fixture date');
const dish=(id,name,extra={})=>({
  id,name,kamado:'large',cook:60,rest:15,grill:120,method:'indirect',
  grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[],...extra
});
const fixture={
  date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,v46MultiServe:true,
  v46Starter:'17:30',v46Dessert:'20:00',
  dishes:[
    dish('starter','Voorgerecht',{kamado:'small',cook:35,rest:0,grill:140,serveSlot:'starter'}),
    dish('ribeye','Ribeye',{cook:60,rest:15}),
    dish('burger','Smashburgers',{cook:30,rest:0,grill:250,method:'direct',grate:'cast'}),
    dish('dessert','Dessert',{kamado:'small',cook:25,rest:10,grill:180,serveSlot:'dessert'})
  ]
};
const {input,validation}=fromLegacyState(fixture,{houseZone:zone,now:now.at});
if(validation.length)throw Error('Invalid fictional fixture');
input.limits={maxCandidates:96,maxAlternatives:3};
input.serveSlots.find(s=>s.id==='main').laterAllowedMaxMin=90;
input.kamados.find(k=>k.id==='small').verifiedDishIds=['starter','burger','dessert'];
const baseline=plan(input);
const root=document.getElementById('regisseur');
const status=document.getElementById('status');
const calculate=document.getElementById('calculate');
const view=mountRegisseurPreview(root,{input,outcome:baseline});
const client=createOptimizerClient();
calculate.addEventListener('click',async ()=>{
  calculate.disabled=true;
  status.textContent='Bezig in Web Worker…';
  view.update({input,outcome:baseline,loading:true});
  try{
    const result=await client.run(input);
    status.textContent='Gereed: '+result.alternatives.length+' alternatieven ('+result.searchStatus+')';
    view.update({input,outcome:result});
  }catch(error){
    if(error.name==='AbortError')status.textContent='Geannuleerd';
    else status.textContent='Berekening mislukt: '+error.message;
    view.update({input,outcome:baseline});
  }finally{calculate.disabled=false;}
});
window.addEventListener('pagehide',()=>client.dispose(),{once:true});
