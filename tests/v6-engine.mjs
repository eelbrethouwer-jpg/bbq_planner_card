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
function run(s,mutate,now=clock('12:00')){
  const {input,validation}=fromLegacyState(s,{houseZone:Z,now});
  if(mutate)mutate(input);
  return {out:plan(input),input,validation};
}
const results=[];
function caseOf(id,fn){
  try{fn();results.push({id,status:'PASS'});console.log('PASS '+id)}
  catch(e){results.push({id,status:'FAIL',error:e.message});console.error('FAIL '+id+': '+e.stack)}
}
const codes=out=>new Set(out.conflicts.map(x=>x.code));
function expected(s,status,includes=[],mutate,now){
  const x=run(s,mutate,now);
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
caseOf('S15',()=>{const o=expected(state([item('a',{prepTasks:[{id:'rub',daysBefore:1,time:'19:00',duration:15}]})]),'conditional',['AVAILABILITY_UNVERIFIED']);
 const p=o.proposedTasks.find(x=>x.id==='a:prep:rub');assert.equal(p.at,at('2026-11-13','19:00'));assert.equal(p.timeKnown,true)});
caseOf('S16',()=>{const o=expected(state([item('a',{prepTasks:[{id:'salt',daysBefore:2,time:'',duration:10}]})]),'conditional',['AVAILABILITY_UNVERIFIED']);
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
caseOf('S20',()=>{
 const o=expected(state([item('a',{prepTasks:[
 {id:'before',daysBefore:1,time:'19:00',duration:10},
 {id:'untimed',daysBefore:2,time:'',duration:10}]}),
 item('b',{kamado:'small',cook:30,rest:0})]),'conditional',['AVAILABILITY_UNVERIFIED']);
 assert.equal(o.proposedTasks[0].id,'a:prep:untimed');
 assert.equal(o.proposedTasks[0].at,null);
 assert.equal(o.proposedTasks[1].id,'a:prep:before');
});
caseOf('S29',()=>{const s=state([item('a',{kamado:'large-2'})]);
 expected(s,'unknown',['UNKNOWN_KAMADO']);
 assert.equal(s.dishes[0].kamado,'large-2')});
caseOf('S30',()=>{
 const s=state(Array.from({length:12},(_,i)=>item('d'+String(i).padStart(2,'0'))));
 const {input}=run(s);
 const t=performance.now(),a=plan(input),duration=performance.now()-t;
 const b=plan(input);assert.deepEqual(a,b);assert.ok(duration<50,'S30 exceeded 50 ms: '+duration.toFixed(2));
 assert.equal(a.searchStatus,'not_run');assert.equal(a.planStatus,'conditional');
});
caseOf('V01',()=>expected(state([item('a',{cook:-5})]),'unknown',['INVALID_DURATION']));
caseOf('V02',()=>{
 const o=expected(state([item('dup'),item('dup',{kamado:'small'})]),'unknown',['DUPLICATE_ID']);
 assert.equal(o.dishes.length,1);
 assert.equal(new Set(o.proposedTasks.map(t=>t.id)).size,o.proposedTasks.length);
});
caseOf('V03',()=>expected(state([item('a',{kamado:'other'})]),'unknown',['UNKNOWN_KAMADO']));
caseOf('V05',()=>expected(state([
 item('a',{cook:60,rest:60,mode:'manual',fixedStart:'16:30',grill:120}),
 item('b',{cook:60,rest:0,grill:250,method:'direct',grate:'cast'})
 ]),'conditional',['CHANGEOVER_UNVERIFIED']));
caseOf('V06',()=>expected(state([item('a',{prepTasks:[{id:'late',daysBefore:0,time:'18:00',duration:10}]})]),
 'infeasible',['PREP_AFTER_START']));
caseOf('V09',()=>expected(state([item('a',{cook:10001})]),'unknown',['OUT_OF_RANGE']));
caseOf('STATUS-PRIORITY',()=>{
 expected(state([item('a',{cook:null}),item('b'),item('c')]),
 'unknown',['DURATION_UNKNOWN','CAPACITY_UNVERIFIED']);
 expected(state([item('b'),item('c')]),'conditional',['CAPACITY_UNVERIFIED']);
});
caseOf('NEG-DOUBLE-BOOK',()=>{
 const {input}=run(state([item('a'),item('b')]));
 assert.equal(plan(input).planStatus,'conditional');
 const b=input.dishes.find(x=>x.id==='b');
 b.segments[0].method='direct';b.segments[0].heatC=250;b.segments[0].accessory='cast';
 const changed=plan(input);
 assert.equal(changed.planStatus,'infeasible');
 assert.ok(codes(changed).has('INCOMPATIBLE_SETUP'));
});
caseOf('NEG-FIXED-SHIFT',()=>expected(state([item('a',{mode:'manual',fixedStart:'17:20'})]),
 'infeasible',['FIXED_START_MISSES_SERVE']));

caseOf('S11',()=>{
 const o=expected(state([item('a',{name:'Ribeye'}),
  item('b',{name:'Ribeye',kamado:'small'})]),'feasible');
 assert.equal(o.dishes.length,2);
 assert.equal(new Set(o.proposedTasks.map(x=>x.id)).size,o.proposedTasks.length);
});
caseOf('S14b',()=>{
 const o=expected(state([item('a',{cook:1200,rest:60})],
 {availableFrom:'16:30'}),'conditional',['AVAILABILITY_UNVERIFIED']);
 assert.equal(dOf(o,'a').start,Date.parse('2026-11-13T20:30:00Z'));
 assert.equal(o.fires.large,Date.parse('2026-11-13T20:00:00Z'));
 assert.equal(dOf(o,'a').cookEnd,Date.parse('2026-11-14T16:30:00Z'));
 assert.equal(codes(o).has('PREHEAT_UNAVAILABLE'),false);
});
caseOf('N01',()=>{
 const o=expected(state([item('a',{cook:840,rest:0})],
 {date:'2027-03-28',mealTime:'12:00',availableFrom:''}),'feasible');
 assert.equal(dOf(o,'a').start,Date.parse('2027-03-27T20:00:00Z'));
 assert.equal(dOf(o,'a').cookEnd,Date.parse('2027-03-28T10:00:00Z'));
});
caseOf('N02',()=>{
 const o=expected(state([item('a',{cook:840,rest:0,prepTasks:[{
 id:'rub',daysBefore:1,time:'19:00',duration:10}]})],
 {date:'2027-10-31',mealTime:'12:00',availableFrom:''}),'feasible');
 assert.equal(dOf(o,'a').start,Date.parse('2027-10-30T21:00:00Z'));
 assert.equal(o.proposedTasks.find(x=>x.id==='a:prep:rub').at,
  Date.parse('2027-10-30T17:00:00Z'));
});
const fixtureN03=()=>state([
 item('sear',{mode:'manual',fixedStart:'15:20',cook:60,rest:0,
  serveSlot:'starter',grill:250,method:'direct',grate:'cast'}),
 item('low',{mode:'manual',fixedStart:'17:00',cook:90,rest:0,
  grill:120,method:'indirect',grate:'rvs'})
],{v46MultiServe:true,v46Starter:'16:20'});
caseOf('N03',()=>{
 const o=expected(fixtureN03(),'conditional',['CHANGEOVER_UNVERIFIED']);
 assert.ok(o.conflicts.some(c=>c.code==='CHANGEOVER_UNVERIFIED'&&
  c.affectedIds.join(',')==='low,sear'));
});
caseOf('N05',()=>{
 const o=expected(state([item('a',{serveSlot:'starter',cook:30,rest:0})],
 {v46MultiServe:true,v46Starter:'20:00'}),'conditional',['SLOT_ORDER']);
 assert.equal(codes(o).has('FIXED_START_MISSES_SERVE'),false);
});
caseOf('N06',()=>expected(state([item('a',{prepTasks:[{
 id:'late',daysBefore:0,time:'16:50',duration:30}]})]),
 'infeasible',['PREP_AFTER_START']));
caseOf('N10',()=>{
 const o=expected(state([item('d',{cook:20000,rest:-5}),item('d')]),
 'unknown',['OUT_OF_RANGE','INVALID_DURATION','DUPLICATE_ID']);
 assert.ok(o.conflicts.filter(c=>['OUT_OF_RANGE','INVALID_DURATION','DUPLICATE_ID'].includes(c.code))
 .every(c=>c.severity==='unknown'));
});


caseOf('T01',()=>{
 const o=expected(state([item('a',{grill:'120'}),item('b',{grill:'250'})]),
  'infeasible',['INCOMPATIBLE_SETUP']);
 assert.equal(codes(o).has('TEMPERATURE_UNKNOWN'),false);
});
caseOf('T02',()=>{
 const o=expected(state([item('a',{grill:null}),item('b')]),'unknown',['TEMPERATURE_UNKNOWN']);
 assert.equal(codes(o).has('INCOMPATIBLE_SETUP'),false);
});
caseOf('T03',()=>{
 const early=expected(state([item('a',{mode:'manual',fixedStart:'17:05'})]),
 'conditional',['HOLD_UNVERIFIED']);
 assert.equal(dOf(early,'a').end,clock('18:20'));
 assert.equal(codes(early).has('FIXED_START_MISSES_SERVE'),false);
 const late=expected(state([item('a',{mode:'manual',fixedStart:'17:20'})]),
 'infeasible',['FIXED_START_MISSES_SERVE']);
 assert.equal(dOf(late,'a').end,clock('18:35'));
});
caseOf('T04',()=>{
 const o=expected(state([item('a')],{date:'2026-11-10',dateMode:'auto'}),
 'feasible',[],undefined,clock('12:00'));
 assert.equal(dOf(o,'a').start,Date.parse('2026-11-14T16:15:00Z'));
});
caseOf('T05',()=>expected(state([item('a',{prepTasks:[{
 id:'p',daysBefore:0,time:'16:50',duration:30}]})]),
 'infeasible',['PREP_AFTER_START']));
caseOf('T06',()=>{
 const o=expected(state([
 item('A',{cook:120,rest:0,mode:'manual',fixedStart:'16:30',grill:120}),
 item('B',{cook:20,rest:0,mode:'manual',fixedStart:'17:10',grill:130}),
 item('C',{cook:40,rest:0,mode:'manual',fixedStart:'18:35',
  serveSlot:'dessert',grill:250,method:'direct',grate:'cast'})
 ],{v46MultiServe:true,v46Dessert:'19:15'}),'conditional',['CHANGEOVER_UNVERIFIED'],
 input=>{input.kamados[0].capacity={unit:'dishes',value:2}});
 assert.ok(o.conflicts.some(c=>c.code==='CHANGEOVER_UNVERIFIED'&&
  c.affectedIds.join(',')==='A,C'));
 assert.equal(o.conflicts.some(c=>c.code==='CHANGEOVER_UNVERIFIED'&&
  c.affectedIds.join(',')==='B,C'),false);
});

const failed=results.filter(x=>x.status==='FAIL');
console.log('SCENARIO_SUMMARY '+results.map(x=>x.id+'='+x.status).join(' '));
if(failed.length)throw new Error(failed.length+' v6 scenario(s) failed: '+failed.map(x=>x.id).join(','));
console.log('PASS '+results.length+' v6 oracle scenarios');
