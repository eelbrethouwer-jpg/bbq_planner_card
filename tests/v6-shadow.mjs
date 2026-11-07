/* Legacy-to-shadow parity test using the existing jsdom harness approach. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {toInstant} from '../engine/time.mjs';
process.env.TZ='Europe/Amsterdam';
const date='2026-11-14',zone='Europe/Amsterdam';
const FIXED_NOW=Date.parse('2026-11-14T11:00:00Z');
const at=time=>{const r=toInstant(date,time,zone);assert.ok(r.ok);return r.at};
const item=(id,extra={})=>({id,name:id,kamado:'large',cook:60,rest:15,grill:120,
  grate:'rvs',grate2:'cast',method:'indirect',mode:'auto',phase:'waiting',
  fixedStart:'17:00',transitionMins:0,phase2Minutes:5,phase2Temp:250,
  prepTasks:[],recipeSteps:[],meater:'none',...extra});
const sample=(dishes,other={})=>({date,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
 preheatLarge:30,preheatSmall:25,equipment:{large:[],small:[]},smart:{enabled:true,mode:'fixed'},
 dishes,v46MultiServe:false,v46Done:{},v5Actual:{},...other});
function legacy(s,now=FIXED_NOW) {
 let html=fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html','utf8');
 for(const file of ['bbq-v5.js','bbq-v501.js']){
  const regex=new RegExp('<script src="\\./'+file.replace('.','\\.')+'\\?v=[^"]+"></script>');
  html=html.replace(regex,()=>'<script>'+fs.readFileSync('dist/'+file,'utf8')+'</script>');
 }
 html=html.replace('window.initBBQV5({','window.initBBQV5(window.__bridge={');
 const errors=[];
 const dom=new JSDOM(html,{url:'https://planner.test.invalid/dist/planner.html',
   runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
     // Freeze the jsdom realm clock; the adapter receives the same instant.
     const NativeDate=w.Date;
     w.Date=class FixedDate extends NativeDate{
       constructor(...args){super(...(args.length?args:[now]));}
       static now(){return now;}
     };
     w.localStorage.setItem('kamado-bereidingsplanner-v1',JSON.stringify(s));
     w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.print=()=>{};
     w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
     w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};
     w.setInterval=()=>1;
     w.addEventListener('error',e=>errors.push(String(e.error?.stack||e.message)));
   }});
 assert.deepEqual(errors,[],'legacy browser errors');
 const b=dom.window.__bridge;
 assert.ok(b&&typeof b.calculate==='function','missing read-only legacy bridge');
 assert.equal(typeof b.getState,'function','missing legacy getState bridge');
 const calculated=b.calculate();
 // Capture state before closing jsdom; avoid crossing realms with a live mutable object.
 const legacyState=JSON.parse(JSON.stringify(b.getState()));
 dom.window.close();
 return {...calculated,legacyState};
}
function compare(id,s,now=FIXED_NOW){
 const old=legacy(s,now),{input,validation}=fromLegacyState(s,{houseZone:zone,now});
 assert.deepEqual(validation,[],id+' adapter validation');
 const shadow=plan(input);
 assert.ok(['feasible','conditional'].includes(shadow.planStatus),id+' shadow '+shadow.planStatus);
 for(const d of old.dishes){
  const v=shadow.dishes.find(x=>x.id===d.id);assert.ok(v,id+' missing '+d.id);
  for(const key of ['start','cookEnd','end'])assert.equal(v[key],d[key],id+' '+d.id+' '+key);
 }
 for(const k of ['large','small'])assert.equal(shadow.fires[k],old.fires[k],id+' fire '+k);
 console.log('PASS parity '+id+' legacy/shadow for start, cookEnd, end, fire');
 return {legacyState:old.legacyState,input};
}
compare('S01',sample([item('a')]));
compare('S02',sample([item('a',{cook:90}),item('b',{kamado:'small',cook:30,rest:0})]));
compare('S06',sample([item('a',{cook:55,rest:10,method:'combo',
 transitionMins:15,phase2Minutes:5,phase2Temp:250})]));
compare('S14',sample([item('a',{cook:600,rest:60})]));
compare('STRING-TEMPERATURES',sample([
 item('a',{cook:90,rest:15,grill:'120'}),
 item('b',{kamado:'small',cook:30,rest:0,grill:'250'})]));
const auto2026=compare('AUTO-DATE-2026-11-14',
 sample([item('a')],{date:'2026-11-10',dateMode:'auto'}),
 Date.parse('2026-11-14T11:00:00Z'));
assert.equal(auto2026.legacyState.date,'2026-11-14','legacy must follow frozen date 2026-11-14');
assert.equal(auto2026.input.localDate,'2026-11-14','adapter must follow frozen date 2026-11-14');
const auto2027=compare('AUTO-DATE-2027-03-28',
 sample([item('a')],{date:'2026-11-10',dateMode:'auto'}),
 Date.parse('2027-03-28T10:00:00Z'));
assert.equal(auto2027.legacyState.date,'2027-03-28','legacy must follow frozen date 2027-03-28');
assert.equal(auto2027.input.localDate,'2027-03-28','adapter must follow frozen date 2027-03-28');
// One additional independent parity case ensures the requested eight cases:
// explicit manual dates must NOT follow the injected auto-date clock.
const manual=compare('MANUAL-DATE-PRESERVED',
 sample([item('a')],{date:'2026-11-10',dateMode:'manual'}),
 Date.parse('2027-03-28T10:00:00Z'));
assert.equal(manual.legacyState.date,'2026-11-10');
assert.equal(manual.input.localDate,'2026-11-10');
const intentional={
 S03:{s:sample([item('a'),item('b',{grill:250,method:'direct',grate:'cast'})]),
   code:'INCOMPATIBLE_SETUP',status:'infeasible',
   reason:'legacy reports alert text; shadow promotes incompatible overlap to hard conflict'},
 S04:{s:sample([item('a'),item('b')]),code:'CAPACITY_UNVERIFIED',status:'conditional',
   reason:'legacy lacks a capacity oracle; shadow requires verification for compatible overlap'},
 S08:{s:sample([item('a')],{availableFrom:'18:00'}),
   code:'EARLIEST_START_AFTER_REQUIRED',status:'infeasible',
   reason:'legacy advises later serving; shadow reports infeasible without changing serve slot'},
 S13:{s:sample([item('a',{cook:null})]),code:'DURATION_UNKNOWN',status:'unknown',
   reason:'legacy sanitizes null to zero; shadow retains explicit unknown duration'},
 V03:{s:sample([item('a',{kamado:'unregistered'})]),code:'UNKNOWN_KAMADO',status:'unknown',
   reason:'legacy can calculate a dish not assigned to large/small; shadow rejects unknown resource'},
 PHASE2:{s:sample([item('a',{cook:55,rest:10,method:'combo',
    transitionMins:15,phase2Minutes:0,phase2Temp:250})]),
   code:'INVALID_DURATION',status:'unknown',
   reason:'legacy clamps invalid phase2 but shadow rejects raw duration'}
};
for(const [id,fixture] of Object.entries(intentional)){
 const old=legacy(fixture.s);
 const {input}=fromLegacyState(fixture.s,{houseZone:zone,now:at('12:00')});
 const shadow=plan(input);
 assert.ok(old&&Array.isArray(old.dishes)&&Array.isArray(old.alerts),id+' legacy did not compute');
 assert.equal(shadow.planStatus,fixture.status,id+' status');
 assert.ok(shadow.conflicts.some(c=>c.code===fixture.code),id+' missing '+fixture.code);
 if(id==='S13')assert.equal(old.dishes[0].cook,0,'legacy clamps null cook to zero');
 if(id==='PHASE2'){
   assert.equal(old.dishes.length,1,'legacy computes despite zero phase2');
   assert.ok(Number.isFinite(old.dishes[0].start),'legacy has a calculated start');
   assert.ok(shadow.validation.some(v=>v.code==='INVALID_DURATION'&&v.field==='a:phase2'),
     'shadow reports invalid raw phase2');
 }
 if(id==='S03')assert.ok(old.alerts.some(a=>/Verschillende/.test(a.message)),
   'legacy reports incompatible setup text');
 if(id==='V03'){
   assert.equal(old.alerts.length,0,'legacy does not warn unknown kamado in calc');
   assert.equal(old.fires.large,null,'unknown kamado has no legacy large fire');
   assert.equal(old.fires.small,null,'unknown kamado has no legacy small fire');
 }
 assert.ok(fixture.reason.length>30);
 console.log('PASS intentional difference '+id+': '+fixture.code+' / '+fixture.reason);
}
console.log('PASS v6-shadow 8 parity and 6 explicit intentional differences');
