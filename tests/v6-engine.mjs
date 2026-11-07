/* Independent v6 engine oracles. No actual sensor data, no runtime file writes. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fromLegacyState} from '../engine/adapter.mjs';
import {plan} from '../engine/check.mjs';
import {toInstant,localParts} from '../engine/time.mjs';
const Z='Europe/Amsterdam';
const at=(date,time,zone=Z,disambiguation)=>{const r=toInstant(date,time,zone,disambiguation);assert.equal(r.ok,true,JSON.stringify(r));return r.at};
const baseDate='2026-11-14',clock=time=>at(baseDate,time);
const item=(id,opts={})=>({id,name:id,kamado:'large',cook:60,rest:15,grill:120,method:'indirect',
  grate:'rvs',mode:'auto',phase:'waiting',prepTasks:[],...opts});
const state=(dishes=[],opts={})=>({date:baseDate,dateMode:'manual',mealTime:'18:30',availableFrom:'00:00',
  preheatLarge:30,preheatSmall:25,dishes,...opts});
function run(s,mutate){
  const {input,validation}=fromLegacyState(s,{houseZone:Z,now:clock('12:00')});
  if(mutate)mutate(input);
  return {out:plan(input),input,validation};
}
const results=[];
function caseOf(id,fn){
  try{fn();results.push({id,status:'PASS'});console.log('PASS '+id)}
  catch(e){results.push({id,status:'FAIL',error:e.message});console.error('FAIL '+id+': '+e.stack)}
}
const codes=out=>new Set(out.conflicts.map(x=>x.code));
function expected(s,status,includes=[],mutate){
  const x=run(s,mutate);
  assert.equal(x.out.planStatus,status,'unexpected plan status: '+JSON.stringify(x.out.conflicts));
  for(const c of includes)assert.ok(codes(x.out).has(c),'missing '+c+': '+JSON.stringify(x.out.conflicts));
  assert.equal(x.out.searchStatus,'not_run');
  assert.deepEqual(x.out.alternatives,[]);
  return x.out;
}
const dOf=(out,id)=>{const d=out.dishes.find(x=>x.id===id);assert.ok(d,id);return d};
const assertTimes=(out,id,start,off,end)=>{
  const d=dOf(out,id);
  assert.equal(d.start,clock(start),id+' start');
  assert.equal(d.cookEnd,clock(off),id+' off');
  assert.equal(d.end,clock(end),id+' ready');
};
caseOf('S01',()=>{const o=expected(state([item('a')]),'feasible');
  assertTimes(o,'a','17:15','18:15','18:30');assert.equal(o.fires.large,clock('16:45'))});
caseOf('S02',()=>{const o=expected(state([item('a',{cook:90}),item('b',{kamado:'small',cook:30,rest:0})]),'feasible');
  assertTimes(o,'a','16:45','18:15','18:30');assertTimes(o,'b','18:00','18:30','18:30');
  assert.equal(o.fires.large,clock('16:15'));assert.equal(o.fires.small,clock('17:35'))});
caseOf('S03',()=>expected(state([item('a'),item('b',{grill:250,method:'direct',grate:'cast'})]),'infeasible',['INCOMPATIBLE_SETUP']));
caseOf('S04',()=>expected(state([item('a'),item('b')]),'conditional',['CAPACITY_UNVERIFIED']));
caseOf('S05',()=>expected(state([item('a'),item('b')]),'infeasible',['RESOURCE_CAPACITY'],i=>{
 i.kamados[0].capacity={unit:'dishes',value:1};
}));
caseOf('S06',()=>{const o=expected(state([item('a',{cook:55,rest:10,method:'combo',
 transitionMins:15,phase2Minutes:5,phase2Temp:260,grate2:'cast'})]),'feasible');
 assertTimes(o,'a','17:10','18:20','18:30');assert.equal(o.fires.large,clock('16:40'));
 assert.equal(o.proposedTasks.find(x=>x.type==='changeover').at,clock('18:00'))});
caseOf('S07',()=>{const o=expected(state([item('a',{cook:90,rest:0,mode:'manual',fixedStart:'17:00'})]),'feasible');
 assertTimes(o,'a','17:00','18:30','18:30')});
caseOf('S08',()=>expected(state([item('a')],{availableFrom:'18:00'}),'infeasible',
 ['EARLIEST_START_AFTER_REQUIRED','PREHEAT_UNAVAILABLE']));
caseOf('S09',()=>{const o=expected(state([item('a')],{availableFrom:'17:00'}),'infeasible',['PREHEAT_UNAVAILABLE']);
 assert.equal(o.fires.large,clock('16:45'));assert.equal(codes(o).has('EARLIEST_START_AFTER_REQUIRED'),false)});
caseOf('S10',()=>{const o=expected(state([]),'feasible');assert.deepEqual(o.dishes,[]);
 assert.equal(o.fires.large,null);assert.equal(o.fires.small,null);assert.deepEqual(o.conflicts,[])});
caseOf('S12',()=>expected(state([item('a')],{mealTime:'25:99'}),'unknown',['INVALID_TIME']));
caseOf('S13',()=>expected(state([item('a',{cook:null})]),'unknown',['DURATION_UNKNOWN']));
caseOf('S14',()=>{const o=expected(state([item('a',{cook:600,rest:60})]),'feasible');
 assertTimes(o,'a','07:30','17:30','18:30');assert.equal(o.fires.large,clock('07:00'))});
caseOf('S15',()=>{const o=expected(state([item('a',{prepTasks:[{id:'rub',daysBefore:1,time:'19:00',duration:15}]})]),'feasible');
 const p=o.proposedTasks.find(x=>x.id==='a:prep:rub');assert.equal(p.at,at('2026-11-13','19:00'));assert.equal(p.timeKnown,true)});
caseOf('S16',()=>{const o=expected(state([item('a',{prepTasks:[{id:'salt',daysBefore:2,time:'',duration:10}]})]),'feasible');
 const p=o.proposedTasks.find(x=>x.id==='a:prep:salt');assert.equal(p.at,null);
 assert.equal(p.localDate,'2026-11-12');assert.equal(p.timeKnown,false)});
caseOf('S17',()=>{
 assert.deepEqual(toInstant('2027-03-28','02:30',Z),{ok:false,code:'NONEXISTENT_LOCAL_TIME'});
 const o=expected(state([item('a',{mode:'manual',fixedStart:'02:30'})],{date:'2027-03-28'}),'unknown',['NONEXISTENT_LOCAL_TIME']);
 assert.equal(o.dishes.length,0);
});
caseOf('S18',()=>{
 assert.deepEqual(toInstant('2027-10-31','02:30',Z),{ok:false,code:'AMBIGUOUS_LOCAL_TIME'});
 const early=toInstant('2027-10-31','02:30',Z,'earlier');
 const late=toInstant('2027-10-31','02:30',Z,'later');
 assert.equal(early.ok,true);assert.equal(late.ok,true);assert.equal(late.at-early.at,3600000);
});
caseOf('S19',()=>{const t=at('2026-11-14','18:30');assert.deepEqual(
 localParts(t,Z).localTime,'18:30');assert.equal(t,Date.parse('2026-11-14T17:30:00Z'));});
caseOf('S20',()=>{const o=expected(state([item('a',{prepTasks:[{id:'before',daysBefore:1,time:'19:00',duration:10}]}),
 item('b',{kamado:'small',cook:30,rest:0})]),'feasible');
 const order=o.proposedTasks.filter(x=>Number.isFinite(x.at));
 assert.deepEqual(order.map(x=>x.id),[...order].sort((a,b)=>a.at-b.at||
 ({fire:0,prep:1,on:2,changeover:3,off:4,rest:5,serve:6}[a.type]-
 {fire:0,prep:1,on:2,changeover:3,off:4,rest:5,serve:6}[b.type])||
 String(a.kamadoId).localeCompare(String(b.kamadoId),'en')||
 String(a.dishId??'').localeCompare(String(b.dishId??''),'en')||
 String(a.id).localeCompare(String(b.id),'en')).map(x=>x.id));});
caseOf('S29',()=>{const s=state([item('a',{kamado:'large-2'})]);
 expected(s,'infeasible',['UNKNOWN_KAMADO']);
 assert.equal(s.dishes[0].kamado,'large-2')});
caseOf('S30',()=>{
 const s=state(Array.from({length:12},(_,i)=>item('d'+String(i).padStart(2,'0'))));
 const {input}=run(s);
 const t=performance.now(),a=plan(input),duration=performance.now()-t;
 const b=plan(input);assert.deepEqual(a,b);assert.ok(duration<50,'S30 exceeded 50 ms: '+duration.toFixed(2));
 assert.equal(a.searchStatus,'not_run');assert.equal(a.planStatus,'conditional');
});
caseOf('N01',()=>expected(state([item('a',{cook:-5})]),'unknown',['INVALID_DURATION']));
caseOf('N02',()=>expected(state([item('dup'),item('dup',{kamado:'small'})]),'infeasible',['DUPLICATE_ID']));
caseOf('N03',()=>expected(state([item('a',{kamado:'other'})]),'infeasible',['UNKNOWN_KAMADO']));
caseOf('N05',()=>expected(state([
 item('a',{cook:60,rest:60,mode:'manual',fixedStart:'16:30',grill:120}),
 item('b',{cook:60,rest:0,grill:250,method:'direct',grate:'cast'})
 ]),'conditional',['CHANGEOVER_UNVERIFIED']));
caseOf('N06',()=>expected(state([item('a',{prepTasks:[{id:'late',daysBefore:0,time:'18:00',duration:10}]})]),
 'infeasible',['PREP_AFTER_START']));
caseOf('N04',()=>{const a=toInstant('2027-10-31','02:30',Z,'earlier');
 const b=toInstant('2027-10-31','02:30',Z,'later');
 assert.equal(b.at-a.at,3600000)});
caseOf('N09',()=>expected(state([item('a',{cook:10001})]),'unknown',['OUT_OF_RANGE']));
caseOf('STATUS-PRIORITY',()=>expected(state([
 item('a',{cook:null}),
 item('b',{kamado:'missing'})
 ]),'infeasible',['DURATION_UNKNOWN','UNKNOWN_KAMADO']));
caseOf('N10',()=>{
 const s=state([item('a')]),before=JSON.stringify(s);
 const savedNow=Date.now;Date.now=()=>{throw Error('forbidden Date.now')};
 for(const name of ['localStorage','document','window']){
  Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('forbidden '+name)}});
 }
 try{
  const one=run(s).out,two=run(s).out;assert.deepEqual(one,two);
  assert.equal(JSON.stringify(s),before);assert.equal(one.planStatus,'feasible');
 }finally{
  Date.now=savedNow;for(const name of ['localStorage','document','window'])delete globalThis[name];
 }
});
caseOf('NEG-DOUBLE-BOOK',()=>{
 const o=expected(state([item('a'),item('b',{method:'direct',grill:250,grate:'cast'})]),
 'infeasible',['INCOMPATIBLE_SETUP']);assert.ok(codes(o).has('INCOMPATIBLE_SETUP'))});
caseOf('NEG-FIXED-SHIFT',()=>expected(state([item('a',{mode:'manual',fixedStart:'17:00'})]),
 'infeasible',['FIXED_START_MISSES_SERVE']));
const failed=results.filter(x=>x.status==='FAIL');
console.log('SCENARIO_SUMMARY '+results.map(x=>x.id+'='+x.status).join(' '));
if(failed.length)throw new Error(failed.length+' v6 scenario(s) failed: '+failed.map(x=>x.id).join(','));
console.log('PASS '+results.length+' v6 oracle scenarios');
