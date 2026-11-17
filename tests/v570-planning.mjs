/* v5.7.0 planningshulp (engine/plan.mjs): kamadokeuze bij toevoegen, urgente conflicten met een directe oplossing,
   "Plan opnieuw vanaf nu" en een voorbije voorbereiding "avond vooraf". Geen afhankelijkheden, geen DOM, geen klok.
   FIXTURES ONLY: verzonnen planningen, geen echte Home Assistant- of MEATER-data.
   Ook draaien met TZ=America/New_York en TZ=Pacific/Kiritimati (tijden worden lokaal opgebouwd, de uitkomst blijft gelijk). */
import assert from 'node:assert/strict';
import {pickKamado, urgentIssues, lateStart, prepOverdue} from '../engine/plan.mjs';

const MIN = 60000;
const at = (h, m = 0, day = 16) => new Date(2026, 10, day, h, m, 0, 0).getTime(); // lokale tijd, 16 november 2026
let n = 0;
function caseOf(id, fn) { try { fn(); n++; console.log('PASS ' + id); } catch (e) { console.error('FAIL ' + id + ': ' + e.stack); process.exitCode = 1; } }

// 1. Kamado kiezen bij toevoegen (de score komt uit de bestaande v45Score; hier alleen de keuze).
caseOf('P1 laagste score wint', () => {
  assert.equal(pickKamado({scores: {large: 12, small: 0}, preferred: 'large'}).kamado, 'small');
  assert.equal(pickKamado({scores: {large: 0, small: 3}, preferred: 'small'}).kamado, 'large');
});
caseOf('P2 gelijke score: de standaard van het recept blijft', () => {
  assert.deepEqual(pickKamado({scores: {large: 0, small: 0}, preferred: 'small'}), {kamado: 'small', scores: {large: 0, small: 0}, reason: 'tie', changed: false});
  assert.equal(pickKamado({scores: {large: 1, small: 1}, preferred: 'large'}).kamado, 'large');
});
caseOf('P3 onbekende of ongeldige score: standaard, nooit een verzonnen keuze', () => {
  for (const bad of [undefined, {}, {large: NaN, small: 1}, {large: 'x', small: 0}]) {
    const r = pickKamado({scores: bad, preferred: 'small'});
    assert.equal(r.kamado, 'small'); assert.equal(r.changed, false);
  }
  assert.equal(pickKamado({}).kamado, 'large');
});

// 2. Urgente conflicten met een directe oplossing.
const dishes = [
  {id: 'rib', name: 'Ribeye 500 g', kamado: 'large', method: 'combo', cook: 55, phase: 'waiting'},
  {id: 'kip', name: 'Kippenpoten', kamado: 'large', method: 'indirect', cook: 55, phase: 'waiting'}
];
const conflict = reason => ({type: 'urgent', message: '<b>x</b>', meta: {kind: 'conflict', kamado: 'large', dishIds: ['rib', 'kip'], reason}});
const threeAlerts = [conflict('Verschillende BBQ-temperaturen'), conflict('Ombouwen terwijl een ander gerecht op de kamado ligt'), conflict('Verschillende directe/indirecte opstellingen of roosters')];
caseOf('P4 Ribeye+Kippenpoten: drie meldingen worden één kaart met "Zet Kippenpoten op de kleine kamado"', () => {
  const calls = [];
  const out = urgentIssues({alerts: threeAlerts, dishes, serve: at(18, 30), now: at(15), simulate: (id, to) => { calls.push(id + '>' + to); return 0; }});
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Ribeye 500 g en Kippenpoten botsen op de grote kamado');
  assert.equal(out[0].reasons.length, 3);
  assert.equal(out[0].fix.label, 'Zet Kippenpoten op de kleine kamado', 'het gerecht met omstelling (combo) blijft staan');
  assert.deepEqual({dishId: out[0].fix.dishId, to: out[0].fix.to}, {dishId: 'kip', to: 'small'});
  assert.match(out[0].solution, /^Zet Kippenpoten op de kleine kamado\.$/);
  assert.ok(calls.includes('rib>small') && calls.includes('kip>small'), 'beide opties zijn doorgerekend');
});
caseOf('P5 de oplossing verplaatst nooit een gestart gerecht en nooit iets dat niet helpt', () => {
  const started = dishes.map(d => d.id === 'kip' ? {...d, phase: 'cooking'} : d);
  const out = urgentIssues({alerts: threeAlerts, dishes: started, serve: at(18, 30), now: at(17), simulate: () => 0});
  assert.equal(out[0].fix.dishId, 'rib');
  const none = urgentIssues({alerts: threeAlerts, dishes, serve: at(18, 30), now: at(17), simulate: () => 3});
  assert.equal(none[0].fix, null);
  assert.match(none[0].solution, /Planning aanpassen/);
  const noSim = urgentIssues({alerts: threeAlerts, dishes, serve: at(18, 30), now: at(17)});
  assert.equal(noSim[0].fix, null);
});
caseOf('P6 een restconflict wordt eerlijk genoemd', () => {
  const out = urgentIssues({alerts: threeAlerts, dishes, serve: at(18, 30), now: at(17), simulate: () => 1});
  assert.match(out[0].solution, /dan blijven er nog 1 urgente conflict over/);
});
caseOf('P7 Ribeye+Pulled pork: "Begin om 08:00 of serveer om 03:00"', () => {
  // eerste actie 08:00, beschikbaar vanaf 16:30 (510 min), serveren 18:30 → 03:00 de volgende dag
  const alerts = [{type: 'urgent', message: 'x', meta: {kind: 'late-start', first: at(8), available: at(16, 30), serve: at(18, 30), passed: true}}];
  const out = urgentIssues({alerts, dishes, serve: at(18, 30), now: at(13)});
  assert.equal(out.length, 1); assert.equal(out[0].kind, 'late-start'); assert.equal(out[0].fix, null);
  assert.match(out[0].solution, /^Begin om 08:00 of serveer om 03:00 \(\w+\), dan begin je om 16:30 zoals je beschikbaar bent\./);
  assert.match(out[0].title, /08:00.*verstreken.*16:30/);
});
caseOf('P8 meldingen die niet urgent zijn of geen meta hebben, worden genegeerd', () => {
  const out = urgentIssues({alerts: [{type: 'notice', message: 'x', meta: {kind: 'late-start', first: at(8), available: at(16)}}, {type: 'urgent', message: 'x'}], dishes});
  assert.deepEqual(out, []);
  assert.deepEqual(urgentIssues({}), []);
});
caseOf('P9 vaste starttijd te laat: starttijd en alternatieve serveertijd', () => {
  const alerts = [{type: 'urgent', message: 'x', meta: {kind: 'manual-late', dishId: 'rib', name: 'Ribeye 500 g', offset: 20, start: at(17, 30), serveAt: at(18, 30)}}];
  const out = urgentIssues({alerts, dishes, serve: at(18, 30)});
  assert.equal(out[0].solution, 'Start Ribeye 500 g om 17:10 of serveer om 18:50.');
});

// 3. Te laat gestart (scenario "start om 23:40").
caseOf('P10 start om 23:40, serveren 18:30, eerste actie 16:42: nieuwe serveertijd = nu + benodigde tijd', () => {
  const r = lateStart({now: at(23, 40), serve: at(18, 30), first: at(16, 42), anyStarted: false});
  assert.equal(r.late, true);
  assert.deepEqual(r.reasons, ['serve-past', 'start-late']);
  assert.equal(r.neededMin, 108);
  assert.equal(r.newServe, at(23, 40) + 108 * MIN);
  assert.equal(r.time, '01:28'); assert.equal(r.date, '2026-11-17');
});
caseOf('P11 afronden naar boven op een hele minuut', () => {
  const r = lateStart({now: at(23, 40) + 20000, serve: at(18, 30), first: at(16, 42)});
  assert.equal(r.time, '01:29');
});
caseOf('P12 niet te laat: toekomstige start, of binnen de drempel van 15 min', () => {
  assert.equal(lateStart({now: at(15), serve: at(18, 30), first: at(16, 42)}).late, false);
  assert.equal(lateStart({now: at(16, 56), serve: at(18, 30), first: at(16, 42)}).late, false, '14 min te laat is geen aanleiding');
  const r = lateStart({now: at(16, 58), serve: at(18, 30), first: at(16, 42)});
  assert.equal(r.late, true); assert.deepEqual(r.reasons, ['start-late']);
});
caseOf('P13 serveertijd verleden, maar de start was nog niet vereist: toch aanbieden', () => {
  const r = lateStart({now: at(19), serve: at(18, 30), first: at(18, 10)});
  assert.equal(r.late, true); assert.ok(r.reasons.includes('serve-past'));
});
caseOf('P14 al iets gestart of onbekende tijden: nooit aanbieden', () => {
  assert.equal(lateStart({now: at(23, 40), serve: at(18, 30), first: at(16, 42), anyStarted: true}).late, false);
  assert.equal(lateStart({now: at(23, 40), serve: null, first: at(16, 42)}).late, false);
  assert.equal(lateStart({now: at(23, 40), serve: at(18, 30), first: undefined}).late, false);
  assert.equal(lateStart({serve: at(18, 30), first: at(16, 42)}).late, false);
  assert.equal(lateStart().late, false);
});

// 4. Voorbereiding "avond vooraf" die al voorbij is.
const eve = {id: 'd|pp:prep:rub', title: 'Procureur kruiden · Pulled pork', kind: 'prep', daysBefore: 1, hasTime: false, timeAt: at(12, 0, 15)};
caseOf('P15 avond vooraf voorbij, genoeg tijd: doe het nu', () => {
  const r = prepOverdue({now: at(10), serve: at(18, 30), firstAction: at(13), tasks: [eve], done: {}});
  assert.equal(r.length, 1);
  assert.match(r[0].when, /zondag.*avond vooraf/);
  assert.match(r[0].alternative, /^Doe het nu: tot de eerste BBQ-actie \(13:00\) heb je nog 3 u/);
});
caseOf('P16 te weinig tijd: schuif de serveertijd op', () => {
  const r = prepOverdue({now: at(12), serve: at(18, 30), firstAction: at(13), tasks: [eve], done: {}});
  assert.match(r[0].alternative, /^Doe het nu en schuif de serveertijd op naar 19:30, zodat er minstens 2 uur zit tussen nu en de eerste BBQ-actie, of sla de stap bewust over\.$/);
});
caseOf('P16b eerste BBQ-actie al aan de beurt: opnieuw plannen vanaf nu, geen absurde serveertijd', () => {
  const r = prepOverdue({now: at(13), serve: at(18, 30), firstAction: at(8), tasks: [eve], done: {}});
  assert.match(r[0].alternative, /^Doe het nu en plan opnieuw vanaf nu bij Start live/);
  assert.doesNotMatch(r[0].alternative, /\d\d:\d\d/);
});
caseOf('P17 afgevinkt, nog niet voorbij of niet "avond vooraf": geen melding', () => {
  assert.deepEqual(prepOverdue({now: at(10), serve: at(18, 30), firstAction: at(13), tasks: [eve], done: {[eve.id]: true}}), []);
  assert.deepEqual(prepOverdue({now: at(20, 0, 14), serve: at(18, 30), firstAction: at(13), tasks: [eve]}), [], 'nog voor het einde van zondag');
  assert.deepEqual(prepOverdue({now: at(10), serve: at(18, 30), firstAction: at(13), tasks: [{...eve, daysBefore: 0}]}), []);
  assert.deepEqual(prepOverdue({now: at(10), serve: at(18, 30), tasks: [{id: 'x', title: 't', kind: 'recipe', trigger: 'Een uur vooraf'}]}), []);
});
caseOf('P18 een taak met tijdstip is voorbij vanaf dat tijdstip; receptstap met "avond" pas op de dag zelf', () => {
  const timed = {...eve, hasTime: true, timeAt: at(19, 0, 15)};
  assert.equal(prepOverdue({now: at(19, 1, 15), serve: at(18, 30), firstAction: at(13), tasks: [timed]}).length, 1);
  assert.equal(prepOverdue({now: at(18, 59, 15), serve: at(18, 30), firstAction: at(13), tasks: [timed]}).length, 0);
  const step = {id: 's1', title: 'Rub aanbrengen · Pulled pork', kind: 'recipe', trigger: 'De avond vooraf'};
  assert.equal(prepOverdue({now: at(23, 0, 15), serve: at(18, 30), firstAction: at(13), tasks: [step]}).length, 0);
  assert.equal(prepOverdue({now: at(8), serve: at(18, 30), firstAction: at(13), tasks: [step]}).length, 1);
});

// Puur: invoer blijft ongewijzigd en dezelfde invoer geeft hetzelfde antwoord.
caseOf('P19 puur: invoer onveranderd, deterministisch', () => {
  const input = {alerts: threeAlerts, dishes, serve: at(18, 30), now: at(15), simulate: () => 0};
  const snap = JSON.stringify({alerts: input.alerts, dishes: input.dishes});
  const a = JSON.stringify(urgentIssues(input)), b = JSON.stringify(urgentIssues(input));
  assert.equal(a, b); assert.equal(JSON.stringify({alerts: input.alerts, dishes: input.dishes}), snap);
  const l = {now: at(23, 40), serve: at(18, 30), first: at(16, 42)};
  const ls = JSON.stringify(l);
  assert.deepEqual(lateStart(l), lateStart(l)); assert.equal(JSON.stringify(l), ls);
  const t = {now: at(10), serve: at(18, 30), firstAction: at(13), tasks: [eve], done: {}}, ts = JSON.stringify(t);
  assert.deepEqual(prepOverdue(t), prepOverdue(t)); assert.equal(JSON.stringify(t), ts);
});

if (!process.exitCode) console.log('OK v5.7.0 planningshulp: ' + n + ' gevallen (FIXTURES; TZ=' + (process.env.TZ || 'standaard') + ')');
