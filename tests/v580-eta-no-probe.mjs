/* v5.8.0 schatting zonder probe (engine/eta.mjs → dist/bbq-eta.js): bereik, handmatige kerninvoer, kamadotemperatuur.
   Puur: geen DOM, geen klok, geen opslag; `now` is altijd een parameter. FIXTURES ONLY: synthetische metingen, nooit echte MEATER-
   of Home Assistant-data. Ook draaien met TZ=America/New_York en TZ=Pacific/Kiritimati (de module mag niet van de tijdzone afhangen). */
import assert from 'node:assert/strict';
import {estimate, ETA_DEFAULTS} from '../engine/eta.mjs';

const MIN = 60000;
const NOW = Date.parse('2026-11-16T13:20:00Z');            // "14:20" in Amsterdam
const START = NOW - 90 * MIN;                               // 90 min op de BBQ
const BASE = Object.freeze({now: NOW, startedAt: START, cookMinutes: 120, transitionMinutes: 0, rest: 10, target: 63, grillPlanned: 180, points: []});
let n = 0;
const caseOf = (id, fn) => { try { fn(); n++; console.log('PASS ' + id); } catch (e) { console.error('FAIL ' + id + ': ' + e.stack); process.exitCode = 1; } };
const widthMin = e => Math.round((e.range.to - e.range.from) / MIN);
const probe = (count, from, step, now = NOW) => Array.from({length: count}, (_, i) => ({t: now - (count - 1 - i) * 30000, core: from + i * step, ambient: 180}));

caseOf('1 zonder probe en zonder invoer: bron "start" met bereik (AANNAME ±20 %, min. ±15 min)', () => {
  const e = estimate({...BASE});
  assert.equal(e.ok, true);
  assert.equal(e.source, 'start');
  assert.equal(e.cookEnd, START + 120 * MIN);
  // resterend 30 min → 20 % = 6 min < 15 min → ±15 min
  assert.equal(Math.round((e.cookEnd - e.range.from) / MIN), 15);
  assert.equal(Math.round((e.range.to - e.cookEnd) / MIN), 15);
  assert.equal(e.range.halfMin, 15);
  assert.deepEqual([e.readyRange.from - e.range.from, e.readyRange.to - e.range.to], [10 * MIN, 10 * MIN], 'rust komt erbij');
  assert.equal(e.manual, null);
  assert.equal(e.grill, null);
  assert.equal(ETA_DEFAULTS.rangeFrac, 0.2);
  assert.equal(ETA_DEFAULTS.rangeMinMin, 15);
});
caseOf('2 bereik is 20 % van de resterende tijd als dat meer dan 15 min is', () => {
  const e = estimate({...BASE, now: START + 10 * MIN, startedAt: START});   // nog 110 min
  assert.equal(e.range.halfMin, 22);
  assert.equal(widthMin(e), 44);
  assert.ok(e.range.begin < e.range.from || e.range.begin === e.range.from);
});
caseOf('3 bereik wordt smaller naarmate het einde dichterbij komt', () => {
  const w = t => widthMin(estimate({...BASE, now: t}));
  assert.ok(w(START + 10 * MIN) > w(START + 60 * MIN) && w(START + 60 * MIN) >= w(START + 100 * MIN));
});
caseOf('4 te laat: het bereik begint nu en eindigt na minimaal 15 min; nooit in het verleden', () => {
  const e = estimate({...BASE, now: START + 150 * MIN});
  assert.equal(e.range.from, START + 150 * MIN);
  assert.equal(e.range.to, START + 165 * MIN);
  assert.ok(e.range.begin < e.range.from, 'begin blijft de ongeklemde tijd voor de prik-melding');
});
caseOf('5 zonder echte start geen bereik (planning blijft de bron)', () => {
  const e = estimate({...BASE, startedAt: null, plannedEnd: NOW + 60 * MIN});
  assert.equal(e.source, 'planning');
  assert.equal(e.range, null);
});
caseOf('6 handmatig 62 °C om 14:20: bron "manual", smaller bereik dan vooraf', () => {
  const before = estimate({...BASE});
  const after = estimate({...BASE, manual: [{t: NOW, core: 62}]});
  assert.equal(after.source, 'manual');
  assert.equal(after.state, 'estimate');
  assert.deepEqual({at: after.manual.at, core: after.manual.core, n: after.manual.n}, {at: NOW, core: 62, n: 1});
  assert.ok(widthMin(after) < widthMin(before), 'smaller: ' + widthMin(after) + ' < ' + widthMin(before));
  assert.equal(after.core, null, 'een handmatige waarde is nooit de probe-kern');
  assert.ok(after.cookEnd >= NOW && after.cookEnd <= NOW + 15 * MIN, '62 van 63 °C is bijna klaar');
});
caseOf('7 één invoer verfijnt de positie: ver van het doel = later dan bij start + duur', () => {
  const far = estimate({...BASE, manual: [{t: NOW, core: 30}]}), near = estimate({...BASE, manual: [{t: NOW, core: 55}]});
  assert.ok(far.cookEnd > near.cookEnd + 10 * MIN);
  assert.equal(far.manual.model, 'newton');
});
caseOf('8 twee of meer invoeren geven een helling (met bereik nooit breder dan bij één invoer)', () => {
  const one = estimate({...BASE, manual: [{t: NOW, core: 44}]});
  const two = estimate({...BASE, manual: [{t: NOW - 20 * MIN, core: 30}, {t: NOW, core: 44}]});
  assert.equal(two.source, 'manual');
  assert.equal(two.manual.model, 'slope');
  assert.ok(Math.abs(two.manual.slope - 0.7) < 1e-9);
  // 63 - 44 = 19 °C bij 0,7 °C/min = 27,1 min
  assert.ok(Math.abs((two.cookEnd - NOW) / MIN - 27.14) < 0.1, String((two.cookEnd - NOW) / MIN));
  assert.ok(widthMin(two) <= widthMin(one));
});
caseOf('9 helling onbruikbaar (te dicht op elkaar of dalend): terugval op één meetpunt', () => {
  const close = estimate({...BASE, manual: [{t: NOW - 3 * MIN, core: 40}, {t: NOW, core: 44}]});
  assert.equal(close.manual.model, 'newton');
  const falling = estimate({...BASE, manual: [{t: NOW - 20 * MIN, core: 50}, {t: NOW, core: 44}]});
  assert.equal(falling.manual.model, 'newton');
});
caseOf('10 handmatig op of boven het kerndoel: "reached", geen bereik, nooit LIVE', () => {
  const e = estimate({...BASE, manual: [{t: NOW - MIN, core: 64.5}]});
  assert.equal(e.source, 'manual');
  assert.equal(e.state, 'reached');
  assert.equal(e.cookEnd, NOW - MIN);
  assert.equal(e.range, null);
});
caseOf('11 een verse probe-meting heeft altijd voorrang: curve, geen bereik, handmatig genegeerd', () => {
  const e = estimate({...BASE, manual: [{t: NOW - 25 * MIN, core: 40}], points: Array.from({length: 24}, (_, i) => ({t: NOW - (23 - i) * 30000, core: 40 + i * 0.4, ambient: 180}))});
  assert.equal(e.source, 'curve');
  assert.equal(e.range, null);
  assert.equal(e.readyRange, null);
  assert.equal(e.manual, null);
});
caseOf('12 verse probe-meting zonder genoeg punten voor een curve is nieuwer dan de invoer: geen handmatige bron', () => {
  const e = estimate({...BASE, manual: [{t: NOW - 10 * MIN, core: 40}], points: [{t: NOW - 5000, core: 47, ambient: 180}]});
  assert.notEqual(e.source, 'manual');
  assert.equal(e.source, 'start');
});
caseOf('13 een handmatige invoer nieuwer dan de laatste (niet verse) probe-meting telt wel mee', () => {
  const e = estimate({...BASE, manual: [{t: NOW - MIN, core: 50}], points: [{t: NOW - 20 * MIN, core: 40, ambient: 180}]});
  assert.equal(e.source, 'manual');
});
caseOf('14 een handmatige meting ouder dan 90 min telt niet meer mee', () => {
  const e = estimate({...BASE, manual: [{t: NOW - 91 * MIN, core: 40}], startedAt: NOW - 120 * MIN});
  assert.equal(e.source, 'start');
  assert.equal(e.manual.model, 'stale', 'wel zichtbaar als oud');
});
caseOf('15 metingen van een eerdere keer op de BBQ (vóór de start) en uit de toekomst tellen niet', () => {
  const e = estimate({...BASE, manual: [{t: START - 60 * MIN, core: 50}, {t: NOW + 10 * MIN, core: 60}]});
  assert.equal(e.source, 'start');
  assert.equal(e.manual, null);
});
caseOf('16 ongeldige invoer in de data wordt genegeerd (negatief, > 120, tekst, leeg)', () => {
  const bad = [{t: NOW, core: -1}, {t: NOW, core: 121}, {t: NOW, core: 'abc'}, {t: NOW, core: ''}, {t: NOW, core: null}, null, 'x', {t: 'x', core: 50}, {core: 50}];
  const e = estimate({...BASE, manual: bad});
  assert.equal(e.source, 'start');
});
caseOf('17 zonder kerndoel geen handmatige schatting (alleen start + duur)', () => {
  const e = estimate({...BASE, target: null, manual: [{t: NOW, core: 50}]});
  assert.equal(e.source, 'start');
});
caseOf('18 kamado 140 °C i.p.v. 180 °C: later klaar; 240 °C: eerder; verschil < 10 °C telt niet', () => {
  const plan = estimate({...BASE}).cookEnd;
  const cool = estimate({...BASE, grillNow: {t: START + 60 * MIN, temp: 140}}), hot = estimate({...BASE, grillNow: {t: START + 60 * MIN, temp: 240}});
  assert.ok(cool.cookEnd > plan + 15 * MIN, 'kouder = later');
  assert.ok(hot.cookEnd < plan - 5 * MIN, 'heter = eerder');
  assert.equal(cool.grill.model, 'newton');
  assert.equal(cool.grill.planned, 180);
  assert.equal(cool.grill.temp, 140);
  assert.equal(estimate({...BASE, grillNow: {t: START, temp: 175}}).grill, null);
  assert.equal(estimate({...BASE, grillNow: {t: START, temp: 175}}).cookEnd, plan);
});
caseOf('19 kamadocorrectie geldt vanaf het moment van invoer (daarvóór de geplande temperatuur)', () => {
  const early = estimate({...BASE, grillNow: {t: START, temp: 140}}), late = estimate({...BASE, grillNow: {t: START + 80 * MIN, temp: 140}});
  assert.ok(early.cookEnd > late.cookEnd, 'vroeg ingevoerd werkt langer door');
  const factor = early.grill.factor;
  assert.ok(Math.abs(early.cookEnd - (START + 120 * MIN * factor)) < 2, 'invoer bij de start schaalt de hele tijd');
});
caseOf('20 zonder kerndoel eenvoudige schaling; begrensd tussen 0,5 en 2,5', () => {
  const e = estimate({...BASE, target: null, grillNow: {t: START, temp: 140}});
  assert.equal(e.grill.model, 'simple');
  assert.ok(Math.abs(e.grill.factor - (180 - 20) / (140 - 20)) < 1e-9);
  const extreme = estimate({...BASE, target: null, grillNow: {t: START, temp: 60}});
  assert.equal(extreme.grill.factor, 2.5);
  assert.equal(estimate({...BASE, target: null, grillNow: {t: START, temp: 'x'}}).grill, null);
});
caseOf('21 kamadotemperatuur stuurt ook de handmatige schatting (Newton met de ingevoerde temperatuur)', () => {
  const plan = estimate({...BASE, manual: [{t: NOW, core: 40}]}), cool = estimate({...BASE, manual: [{t: NOW, core: 40}], grillNow: {t: NOW - 20 * MIN, temp: 130}});
  assert.ok(cool.cookEnd > plan.cookEnd);
  assert.equal(cool.source, 'manual');
});
caseOf('22 breedte met handmatige meting is nooit groter dan het bereik zonder meting', () => {
  for (const core of [10, 30, 45, 55, 60]) {
    const a = estimate({...BASE}), b = estimate({...BASE, manual: [{t: NOW, core}]});
    assert.ok(widthMin(b) < widthMin(a), core + ' °C: ' + widthMin(b) + ' ≤ ' + widthMin(a));
  }
});
caseOf('23 puur: invoer onveranderd, zelfde antwoord, geen klok', () => {
  const input = {...BASE, manual: [{t: NOW - 20 * MIN, core: 30}, {t: NOW, core: 44}], grillNow: {t: NOW - 30 * MIN, temp: 150}};
  const frozen = JSON.stringify(input);
  const a = estimate(input), b = estimate(input);
  assert.equal(JSON.stringify(input), frozen);
  assert.deepEqual(a, b);
  assert.throws(() => estimate({...input, now: undefined}), /now is verplicht/);
});
caseOf('24 bereik naast een MEATER-ETA: de MEATER-ETA gaat voor (geen handmatige of start-bron)', () => {
  const e = estimate({...BASE, manual: [{t: NOW, core: 50}], meater: {eta: NOW + 12 * MIN, at: NOW - 30000}});
  assert.equal(e.source, 'meater');
  assert.equal(e.range, null);
});
caseOf('25 zonder omschakeltijd/duur: geen start-bereik', () => {
  const e = estimate({...BASE, cookMinutes: 0, plannedEnd: NOW + 40 * MIN});
  assert.equal(e.source, 'planning');
  assert.equal(e.range, null);
});
caseOf('26 probe-metingen verlopen (> 15 min oud, sensor offline): terug naar het bereik "geschat, geen meting"', () => {
  const old = Array.from({length: 12}, (_, i) => ({t: NOW - 40 * MIN + i * 30000, core: 30 + i * 0.5, ambient: 180}));
  const e = estimate({...BASE, points: old});
  assert.equal(e.state, 'expired');
  assert.equal(e.stale, true);
  assert.equal(e.source, 'start');
  assert.ok(e.range && e.readyRange);
});
if (!process.exitCode) console.log('OK v5.8.0 schatting zonder probe: ' + n + ' gevallen (FIXTURES; TZ=' + (process.env.TZ || 'standaard') + ')');
