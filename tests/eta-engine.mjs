/* ETA-module (v5.4.0) oracles. No dependencies, no DOM, no clock: `now` is always passed in.
   FIXTURES ONLY: synthetic temperature curves, never real MEATER or Home Assistant readings.
   Run also with TZ=America/New_York and TZ=Pacific/Kiritimati (the module must not depend on the time zone). */
import assert from 'node:assert/strict';
import {estimate, ETA_DEFAULTS, ETA_VERSION} from '../engine/eta.mjs';

const MIN = 60000;
const T0 = Date.parse('2026-11-16T15:55:00Z'); // 16:55 in Amsterdam
const results = [];
function caseOf(id, fn) {
  try { fn(); results.push({id, status: 'PASS'}); console.log('PASS ' + id); }
  catch (e) { results.push({id, status: 'FAIL'}); console.error('FAIL ' + id + ': ' + e.stack); }
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const kFor = (Ta, c0, c1, minutes) => Math.log((Ta - c0) / (Ta - c1)) / minutes;
const trueMinutes = (Ta, c0, target, k) => Math.log((Ta - c0) / (Ta - target)) / k;
// Newton heating sampled every 30 s (MEATER via HA delivers roughly every 30 s), core rounded to 0.1 °C.
function newton({Ta, c0, k, until, noise = 0, ambientNoise = 0, seed = 1, step = 0.5}) {
  const r = rng(seed), pts = [];
  for (let m = 0; m <= until + 1e-9; m += step) {
    const core = Ta - (Ta - c0) * Math.exp(-k * m);
    pts.push({t: T0 + Math.round(m * MIN), core: +(core + (noise ? (r() * 2 - 1) * noise : 0)).toFixed(1),
      ambient: +(Ta + (ambientNoise ? (r() * 2 - 1) * ambientNoise : 0)).toFixed(1), clean: core});
  }
  return pts;
}
const strip = pts => pts.map(({t, core, ambient}) => ({t, core, ambient}));
const at = (pts, i, extra = {}) => estimate({points: strip(pts.slice(0, i + 1)), now: pts[i].t + 2000, ...extra});

const RIBEYE = {Ta: 120, c0: 9.5, target: 54, k: kFor(120, 9.5, 45.5, 40)}; // 9.5 → 45.5 °C in 40 min, as in the review
const KIP = {Ta: 180, c0: 5, target: 75, k: kFor(180, 5, 75, 55)};          // kippenpoot, 55 min recipe time

caseOf('module: version, defaults and frozen API', () => {
  assert.equal(ETA_VERSION, '5.12.0');
  assert.equal(ETA_DEFAULTS.windowMin, 12);
  assert.equal(ETA_DEFAULTS.minSpanMin, 5);
  assert.equal(ETA_DEFAULTS.minPoints, 4);
  assert.ok(Object.isFrozen(ETA_DEFAULTS));
  assert.throws(() => estimate({points: []}), /now is verplicht/);
});

for (const [name, c] of [['ribeye 500 g bij 120 °C', RIBEYE], ['kippenpoot bij 180 °C', KIP]]) {
  caseOf(`Newton ${name}: eindtijd binnen ±10% vanaf 50% van de opwarming (zonder en met ruis)`, () => {
    const truth = trueMinutes(c.Ta, c.c0, c.target, c.k), trueEnd = T0 + truth * MIN;
    for (const [noise, seeds] of [[0, [1]], [0.3, [1, 2, 3, 4, 5, 6, 7, 8]]]) {
      for (const seed of seeds) {
        const pts = newton({...c, until: truth, noise, ambientNoise: noise ? 2 : 0, seed});
        let checked = 0, worst = 0;
        for (let i = 0; i < pts.length; i++) {
          if ((pts[i].clean - c.c0) / (c.target - c.c0) < 0.5 || pts[i].core >= c.target) continue;
          const e = at(pts, i, {target: c.target, rest: 0});
          assert.equal(e.source, 'curve', 'source at ' + i + ': ' + e.reason);
          assert.equal(e.state, 'estimate');
          assert.equal(e.model, 'newton');
          const err = Math.abs(e.cookEnd - trueEnd) / MIN;
          worst = Math.max(worst, err);
          assert.ok(err <= 0.1 * truth, `${name} noise ${noise} seed ${seed} i=${i}: error ${err.toFixed(2)} min > 10% of ${truth.toFixed(1)}`);
          checked++;
        }
        assert.ok(checked >= 10, 'enough checkpoints');
        if (seed === 1) console.log(`  ${name} ruis ±${noise}: grootste afwijking ${worst.toFixed(2)} min van ${truth.toFixed(1)} min (${(100 * worst / truth).toFixed(1)}%)`);
      }
    }
  });
  caseOf(`Newton ${name}: ruis ±0,3 °C laat de schatting tussen opeenvolgende metingen hooguit 3 min springen`, () => {
    const truth = trueMinutes(c.Ta, c.c0, c.target, c.k);
    let worst = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const pts = newton({...c, until: truth, noise: 0.3, ambientNoise: 2, seed});
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].core >= c.target) break;
        const e = at(pts, i, {target: c.target});
        if (e.source !== 'curve' || e.state !== 'estimate') { prev = null; continue; }
        if (prev !== null) worst = Math.max(worst, Math.abs(e.cookEnd - prev) / MIN);
        prev = e.cookEnd;
      }
    }
    assert.ok(worst <= 3, 'largest jump ' + worst.toFixed(2) + ' min');
    console.log(`  ${name}: grootste sprong over 30 ruisreeksen ${worst.toFixed(2)} min`);
  });
}

caseOf('pas een tijd na >= 5 min stabiele stijging met >= 4 meetpunten; anders insufficient met reden', () => {
  const pts = newton({...RIBEYE, until: 20});
  const none = estimate({points: [], target: 54, now: T0});
  assert.equal(none.state, 'none'); assert.equal(none.source, 'none'); assert.equal(none.ok, false);
  assert.match(none.reason, /Nog geen metingen/);
  const three = at(pts, 2, {target: 54});
  assert.equal(three.state, 'insufficient'); assert.notEqual(three.source, 'curve');
  assert.match(three.reason, /te weinig metingen.*wacht ongeveer \d+ min/i);
  const four = at(pts, 9, {target: 54}); // 4.5 min span
  assert.equal(four.state, 'insufficient', 'not before five minutes');
  const ok = at(pts, 10, {target: 54}); // 5 min span
  assert.equal(ok.state, 'estimate'); assert.equal(ok.source, 'curve');
  // Sparse: only 3 points spread over 10 minutes.
  const sparse = estimate({points: [pts[0], pts[10], pts[20]].map(({t, core, ambient}) => ({t, core, ambient})), target: 54, now: pts[20].t});
  assert.equal(sparse.state, 'insufficient');
  // Flat core (fridge-cold meat that has not started rising).
  const flat = Array.from({length: 20}, (_, i) => ({t: T0 + i * 30000, core: 6 + (i % 2) * 0.1, ambient: 118}));
  const f = estimate({points: flat, target: 54, now: flat[19].t});
  assert.equal(f.state, 'insufficient'); assert.match(f.reason, /stijgt nauwelijks/);
  // Garbage is ignored, never turned into a value.
  const junk = estimate({points: [null, {t: 'x', core: 5}, {t: T0, core: 'unavailable'}, {t: T0, core: 9999}], target: 54, now: T0});
  assert.equal(junk.points, 0); assert.equal(junk.core, null);
  for (const r of [none, three, four, f]) assert.match(r.reason, /^[A-Z][a-zë ;,.0-9°—–-]+$/i, 'plain-language reason: ' + r.reason);
});

// Review PR #44, finding 1: HA writes a state only when the value changes, so readings can be sparse.
const jitter = (seed) => { const r = rng(seed); return () => Math.round((r() * 2 - 1) * 900); }; // ±0.9 s
function sparseNewton(c, everyMin, seed, until) {
  const j = jitter(seed), pts = [];
  for (let m = 0; m <= until + 1e-9; m += everyMin) {
    const core = c.Ta - (c.Ta - c.c0) * Math.exp(-c.k * m);
    if (core >= c.target) break;
    pts.push({t: T0 + Math.round(m * MIN) + j(), core: +core.toFixed(1), ambient: c.Ta, clean: core});
  }
  return pts;
}
for (const every of [2, 4]) {
  caseOf(`schaarse metingen elke ${every} min (met ms-jitter): adaptief venster geeft een eigen schatting binnen ±10% vanaf 50%`, () => {
    for (const [name, c] of [['ribeye', RIBEYE], ['kip', KIP]]) {
      const truth = trueMinutes(c.Ta, c.c0, c.target, c.k), trueEnd = T0 + truth * MIN;
      for (let seed = 1; seed <= 10; seed++) {
        const pts = sparseNewton(c, every, seed, truth);
        let checked = 0, worst = 0;
        for (let i = 0; i < pts.length; i++) {
          const e = at(pts, i, {target: c.target});
          if ((pts[i].clean - c.c0) / (c.target - c.c0) < 0.5) continue;
          assert.equal(e.source, 'curve', `${name} every ${every} min seed ${seed} i=${i}: ${e.reason}`);
          const err = Math.abs(e.cookEnd - trueEnd) / MIN;
          worst = Math.max(worst, err);
          assert.ok(err <= 0.1 * truth, `${name} every ${every} min: ${err.toFixed(2)} min > 10%`);
          checked++;
        }
        assert.ok(checked >= 2, 'checkpoints');
        if (seed === 1) console.log(`  ${name} elke ${every} min: grootste afwijking ${worst.toFixed(2)} min van ${truth.toFixed(1)} min`);
      }
    }
  });
}

caseOf('reproductie review #44: elke 4 min, 40 min lang 9,5 → 45,5 °C bij 121 °C geeft een eigen schatting', () => {
  const j = jitter(42), pts = [];
  for (let k = 0; k <= 10; k++) pts.push({t: T0 + k * 4 * MIN + j(), core: +(9.5 + 3.6 * k).toFixed(1), ambient: k ? 121 : 14});
  const e = estimate({points: pts, target: 54, now: pts.at(-1).t + 2000, rest: 8, startedAt: T0, cookMinutes: 55});
  assert.equal(e.source, 'curve', e.reason);
  assert.equal(e.state, 'estimate');
  assert.ok(e.rise > 0.8 && e.rise < 1, 'rise around 0.9 °C/min: ' + e.rise);
  assert.ok(e.cookEnd > pts.at(-1).t && e.cookEnd < pts.at(-1).t + 20 * MIN);
});

caseOf('eerlijke reden bij te weinig metingen: wachten alleen als de reeks net begonnen is', () => {
  const young = estimate({points: [{t: T0, core: 10, ambient: 120}, {t: T0 + 2 * MIN, core: 12, ambient: 120}], target: 54, now: T0 + 2 * MIN});
  assert.match(young.reason, /wacht ongeveer 3 min/, young.reason);
  const sparseYoung = estimate({points: [0, 4, 8].map(m => ({t: T0 + m * MIN, core: 10 + m, ambient: 120})), target: 54, now: T0 + 8 * MIN});
  assert.match(sparseYoung.reason, /Te weinig metingen in de laatste 30 min.*3 van de minimaal 4/, sparseYoung.reason);
  assert.doesNotMatch(sparseYoung.reason, /wacht/, 'waiting is not the remedy once the span is long enough');
  const old = [{t: T0, core: 10, ambient: 120}, {t: T0 + 20 * MIN, core: 20, ambient: 120}, {t: T0 + 50 * MIN, core: 40, ambient: 120}, {t: T0 + 70 * MIN, core: 48, ambient: 120}];
  const gap = estimate({points: old, target: 54, now: T0 + 70 * MIN});
  assert.equal(gap.state, 'insufficient');
  assert.match(gap.reason, /Te weinig metingen in de laatste 30 min voor een schatting \(2 van de minimaal 4\)/, gap.reason);
  for (const r of [young, sparseYoung, gap]) assert.match(r.reason, /^[A-Z][a-zë ;,.0-9°()—–-]+$/i, 'plain language: ' + r.reason);
});

caseOf('stall met schaarse metingen (HA schrijft alleen bij verandering) wordt herkend', () => {
  const pts = [];
  let m = 0, core = 5;
  while (core < 70) { m += 2; core = 120 - (120 - 5) * Math.exp(-0.012 * m); pts.push({t: T0 + m * MIN + (m % 3) * 300, core: +core.toFixed(1), ambient: 120}); }
  // Plateau 70 → 71 °C over 90 min: a new value only every 0.1 °C, i.e. every ~9 min.
  const stallStart = m;
  for (let i = 1; i <= 10; i++) { m = stallStart + i * 9; pts.push({t: T0 + m * MIN - 400, core: +(70 + i / 10).toFixed(1), ambient: 119}); }
  const e = estimate({points: pts, target: 92, now: pts.at(-1).t + 2000, startedAt: T0, cookMinutes: 540, history: {medianMinutes: 600}});
  assert.equal(e.state, 'stall', e.reason);
  assert.notEqual(e.source, 'curve');
  assert.ok(Math.abs(e.stall.level - 70.5) <= 1);
  // Already after ~27 min of sparse plateau.
  const early = estimate({points: pts.slice(0, pts.length - 7), target: 92, now: pts[pts.length - 8].t + 2000, startedAt: T0, cookMinutes: 540});
  assert.equal(early.state, 'stall', 'after three sparse plateau points: ' + early.reason);
});

caseOf('te oude metingen: verouderd na 5 min, niet meer gebruikt na 15 min (start + duur, anders planning)', () => {
  const pts = strip(newton({...RIBEYE, until: 40}));
  const last = pts[pts.length - 1].t, startedAt = T0 - MIN;
  const base = {points: pts, target: 54, rest: 8, startedAt, cookMinutes: 55, transitionMinutes: 15, plannedEnd: T0 + 95 * MIN};
  const fresh = estimate({...base, now: last + 2000});
  assert.equal(fresh.source, 'curve'); assert.equal(fresh.stale, false);
  const stale = estimate({...base, now: last + 6 * MIN});
  assert.equal(stale.source, 'curve', 'a 6-minute-old reading still gives the last estimate');
  assert.equal(stale.stale, true); assert.equal(stale.ageMin, 6);
  assert.equal(stale.cookEnd, fresh.cookEnd, 'the last estimate is unchanged');
  const expired = estimate({...base, now: last + 16 * MIN});
  assert.equal(expired.state, 'expired'); assert.match(expired.reason, /ouder dan 15 minuten/);
  assert.equal(expired.source, 'start', 'dish on the grill: start + recipe duration, not the planning');
  assert.equal(expired.cookEnd, startedAt + (55 + 15) * MIN, 'start + cook + transition');
  assert.equal(expired.ready, expired.cookEnd + 8 * MIN, '+ rest');
  const noStart = estimate({...base, startedAt: null, now: last + 16 * MIN});
  assert.equal(noStart.source, 'planning'); assert.equal(noStart.cookEnd, T0 + 95 * MIN);
});

caseOf('geen drift: zonder nieuwe meting blijft de schatting exact gelijk (verankerd aan de laatste meting)', () => {
  const pts = strip(newton({...RIBEYE, until: 40}));
  const last = pts[pts.length - 1].t, input = {points: pts, target: 54, rest: 8, phaseTargets: [47]};
  const first = estimate({...input, now: last + 2000});
  assert.equal(first.source, 'curve');
  for (let s = 30; s <= 300; s += 30) {
    const later = estimate({...input, now: last + 2000 + s * 1000});
    assert.equal(later.cookEnd, first.cookEnd, 'cookEnd after ' + s + ' s');
    assert.equal(later.ready, first.ready, 'ready after ' + s + ' s');
    assert.equal(later.margin, first.margin);
    assert.deepEqual(later.phase, first.phase);
  }
  assert.equal(first.asOf, last, 'asOf is the last reading');
});

caseOf('fasedoel (reverse sear ~47 °C) en einddoel worden beide geschat', () => {
  const truth47 = trueMinutes(RIBEYE.Ta, RIBEYE.c0, 47, RIBEYE.k), truth54 = trueMinutes(RIBEYE.Ta, RIBEYE.c0, 54, RIBEYE.k);
  const pts = newton({...RIBEYE, until: 30});
  const e = at(pts, pts.length - 1, {target: 54, phaseTargets: [47, 90, 'x', 20]});
  assert.equal(e.phase.target, 47, 'the next phase target below the final target');
  assert.ok(Math.abs(e.phase.at - (T0 + truth47 * MIN)) / MIN <= 0.1 * truth47, 'phase time');
  assert.ok(Math.abs(e.cookEnd - (T0 + truth54 * MIN)) / MIN <= 0.1 * truth54, 'final time');
  assert.ok(e.phase.at < e.cookEnd);
  const past = at(newton({...RIBEYE, until: 45}), 90, {target: 54, phaseTargets: [47]});
  assert.equal(past.phase, null, 'phase target already passed');
});

caseOf('procureur met stall op 70 °C: stall zonder curvetijd, daarna weer een tijd', () => {
  const Ta = 120, pts = [];
  let m = 0, core = 5;
  const k1 = 0.012;
  while (core < 70) { m += 0.5; core = Ta - (Ta - 5) * Math.exp(-k1 * m); pts.push({t: T0 + m * MIN, core: +core.toFixed(1), ambient: Ta}); }
  const stallStart = m;
  for (let i = 1; i <= 180; i++) { m += 0.5; pts.push({t: T0 + m * MIN, core: +(70 + i / 180).toFixed(1), ambient: Ta}); } // 90 min, 70 → 71 °C
  const stallEnd = m, base = 71, k2 = 0.008;
  let u = 0;
  while (core < 92) { m += 0.5; u += 0.5; core = Ta - (Ta - base) * Math.exp(-k2 * u); pts.push({t: T0 + m * MIN, core: +core.toFixed(1), ambient: Ta}); }
  const end = m, input = {target: 92, rest: 60, startedAt: T0, cookMinutes: 540, history: {medianMinutes: 600}};
  let firstStall = null, stallCount = 0, curveDuringStall = 0, firstAfter = null;
  for (let i = 0; i < pts.length; i++) {
    const e = at(pts, i, input), min = (pts[i].t - T0) / MIN;
    if (e.state === 'stall') {
      stallCount++;
      firstStall ??= {min, e};
      assert.notEqual(e.source, 'curve', 'no curve time during a stall');
      assert.equal(e.source, 'start', 'stall falls back to start + recipe duration');
      assert.equal(e.stall.medianMinutes, 600);
      assert.equal(e.stall.expectedEnd, T0 + 600 * MIN);
      assert.match(e.reason, /Stall/);
    }
    if (min >= stallStart + 20 && min <= stallEnd && e.source === 'curve') curveDuringStall++;
    if (min > stallEnd && e.state === 'estimate' && !firstAfter) firstAfter = {min, e};
  }
  assert.ok(firstStall, 'stall detected');
  assert.ok(firstStall.min <= stallStart + 15, 'stall detected within 15 min of the plateau: ' + firstStall.min);
  assert.ok(Math.abs(firstStall.e.stall.since - (T0 + stallStart * MIN)) / MIN <= 6, 'stall start near the real start');
  assert.ok(Math.abs(firstStall.e.stall.level - 70) <= 1);
  assert.equal(curveDuringStall, 0, 'never a curve time on the plateau');
  assert.ok(stallCount > 100);
  assert.ok(firstAfter, 'a time again after the stall');
  assert.ok(firstAfter.min - stallEnd <= 20, 'within 20 min after the stall: ' + (firstAfter.min - stallEnd));
  const err = Math.abs(firstAfter.e.cookEnd - (T0 + end * MIN)) / MIN, remaining = end - firstAfter.min;
  assert.ok(err <= 0.15 * remaining + 2, `first estimate after the stall close to the truth (${err.toFixed(1)} min off, ${remaining.toFixed(0)} min remaining)`);
  console.log(`  stall ${stallStart}–${stallEnd} min herkend op ${firstStall.min} min; eerste tijd na de stall op ${firstAfter.min} min, ${err.toFixed(1)} min naast de werkelijkheid`);
});

caseOf('bronvolgorde: eigen curve → MEATER-ETA → start + duur → planning; MEATER > 10 min afwijkend: beide', () => {
  const pts = strip(newton({...RIBEYE, until: 40})), last = pts[pts.length - 1].t, now = last + 2000;
  const base = {target: 54, now, rest: 8, startedAt: T0, cookMinutes: 55, plannedEnd: T0 + 95 * MIN};
  const curve = estimate({...base, points: pts});
  assert.equal(curve.source, 'curve'); assert.equal(curve.meater, null);
  const close = estimate({...base, points: pts, meater: {eta: curve.cookEnd + 4 * MIN, at: now - 5000}});
  assert.equal(close.source, 'curve'); assert.equal(close.meater.disagree, false); assert.equal(close.meater.diffMin, 4);
  const far = estimate({...base, points: pts, meater: {eta: curve.cookEnd + 14 * MIN, at: now - 5000}});
  assert.equal(far.source, 'curve'); assert.equal(far.meater.disagree, true, 'both shown when > 10 min apart');
  assert.equal(far.cookEnd, curve.cookEnd, 'the MEATER ETA never overrides the own curve');
  const meaterOnly = estimate({...base, points: pts.slice(0, 3), meater: {eta: T0 + 60 * MIN, at: now - 5000}});
  assert.equal(meaterOnly.source, 'meater'); assert.equal(meaterOnly.cookEnd, T0 + 60 * MIN);
  const oldMeater = estimate({...base, points: pts.slice(0, 3), meater: {eta: T0 + 60 * MIN, at: now - 16 * MIN}});
  assert.equal(oldMeater.source, 'start', 'an old MEATER ETA is not used');
  const start = estimate({...base, points: []});
  assert.equal(start.source, 'start'); assert.equal(start.cookEnd, T0 + 55 * MIN); assert.equal(start.ready, T0 + 63 * MIN);
  const plan = estimate({...base, points: [], startedAt: null});
  assert.equal(plan.source, 'planning'); assert.equal(plan.cookEnd, T0 + 95 * MIN);
  const nothing = estimate({target: 54, now, points: []});
  assert.equal(nothing.source, 'none'); assert.equal(nothing.ok, false); assert.equal(nothing.cookEnd, null);
});

caseOf('lineaire terugval zonder bruikbare omgeving, met lagere betrouwbaarheid', () => {
  const pts = strip(newton({...RIBEYE, until: 30}));
  const noAmb = estimate({points: pts.map(p => ({t: p.t, core: p.core})), target: 54, now: pts.at(-1).t});
  assert.equal(noAmb.model, 'linear'); assert.equal(noAmb.confidence, 'laag'); assert.equal(noAmb.source, 'curve');
  const lowAmb = estimate({points: pts.map(p => ({...p, ambient: 57})), target: 54, now: pts.at(-1).t});
  assert.equal(lowAmb.model, 'linear', 'ambient <= target + 5');
  const newtonFit = estimate({points: pts, target: 54, now: pts.at(-1).t});
  assert.equal(newtonFit.model, 'newton'); assert.equal(newtonFit.confidence, 'normaal');
  assert.ok(noAmb.margin >= newtonFit.margin, 'linear margin is not smaller');
});

caseOf('kerndoel bereikt: tijdstip van de eerste meting op het doel', () => {
  const pts = strip(newton({...RIBEYE, until: 60}));
  const i = pts.findIndex(p => p.core >= 54);
  const e = estimate({points: pts, target: 54, now: pts.at(-1).t + 1000, rest: 8});
  assert.equal(e.state, 'reached'); assert.equal(e.source, 'curve');
  assert.ok(e.cookEnd <= pts.at(-1).t && e.cookEnd >= pts[i].t - 12 * MIN);
  assert.equal(e.ready, e.cookEnd + 8 * MIN);
});

caseOf('doorgaren: advies 2–3 °C eerder bij rust >= 10 min of >= 1 kg; doel ongewijzigd', () => {
  const now = T0;
  assert.equal(estimate({target: 54, rest: 8, weightKg: 0.5, now}).advice, null, 'ribeye 500 g, 8 min rest: no advice');
  const rest10 = estimate({target: 54, rest: 10, now}).advice;
  assert.equal(rest10.pullAt, 52); assert.match(rest10.text, /52 °C/); assert.match(rest10.text, /doel blijft 54 °C/);
  assert.equal(estimate({target: 56, rest: 5, weightKg: 1.2, now}).advice.pullAt, 54);
  assert.equal(estimate({target: 92, rest: 60, weightKg: 2.5, now}).advice.pullAt, 89);
  assert.equal(estimate({target: 75, rest: 15, now, carryover: false}).advice, null, 'disabled (e.g. poultry)');
  assert.equal(estimate({target: null, rest: 30, now}).advice, null);
  const e = estimate({points: strip(newton({...RIBEYE, until: 40})), target: 54, rest: 15, now: T0 + 40 * MIN});
  assert.equal(e.cookEnd < e.ready, true); assert.equal(e.advice.pullAt, 52);
});

caseOf('voortgang vanaf de eerste meting van de sessie, niet vanaf 0 °C', () => {
  const pts = strip(newton({...RIBEYE, until: 40}));
  const e = estimate({points: pts, target: 54, now: pts.at(-1).t, startedAt: T0});
  const expected = Math.round((pts.at(-1).core - 9.5) / (54 - 9.5) * 100);
  assert.equal(e.progress.from, 9.5); assert.equal(e.progress.pct, expected);
  assert.ok(e.progress.pct < Math.round(pts.at(-1).core / 54 * 100), 'lower than core/goal');
  const before = [{t: T0 - 20 * MIN, core: 4, ambient: 20}, ...pts];
  assert.equal(estimate({points: before, target: 54, now: pts.at(-1).t, startedAt: T0}).progress.from, 9.5, 'points before the start are ignored');
});

caseOf('marge uit de spreiding: groter met ruis dan zonder, altijd >= 1 min', () => {
  const clean = at(newton({...RIBEYE, until: 35}), 70, {target: 54});
  const noisy = at(newton({...RIBEYE, until: 35, noise: 0.3, ambientNoise: 2, seed: 3}), 70, {target: 54});
  assert.ok(Number.isInteger(clean.margin) && clean.margin >= 1);
  assert.ok(noisy.margin >= clean.margin, `noisy ${noisy.margin} >= clean ${clean.margin}`);
});

caseOf('puur: invoer onveranderd, zelfde antwoord bij dezelfde invoer, geen klok', () => {
  const input = {points: strip(newton({...RIBEYE, until: 40, noise: 0.3, seed: 9})), target: 54, rest: 8, phaseTargets: [47],
    now: T0 + 40 * MIN + 2000, startedAt: T0, cookMinutes: 55, transitionMinutes: 15, plannedEnd: T0 + 95 * MIN,
    meater: {eta: T0 + 60 * MIN, at: T0 + 40 * MIN}, history: {medianMinutes: 50}, weightKg: 0.5};
  const copy = structuredClone(input);
  const realNow = Date.now, RealDate = globalThis.Date;
  let a, b;
  try {
    Date.now = () => { throw new Error('module read the clock'); };
    a = estimate(input); b = estimate(input);
  } finally { Date.now = realNow; globalThis.Date = RealDate; }
  assert.deepEqual(input, copy, 'input unchanged');
  assert.deepEqual(a, b, 'deterministic');
  const deep = o => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object') deep(v); return o; };
  assert.deepEqual(estimate(deep(structuredClone(input))), a, 'works on frozen input');
});

caseOf('informatief: tweetraps-opwarming (eerst buitenkant, dan kern) — bekende modelgrens', () => {
  // Not an acceptance criterion of the assignment (that is about Newton curves). It documents the bias of the
  // Newton model on an S-shaped curve and catches regressions: the estimate errs late, not dangerously early.
  for (const [name, Ta, c0, target, k1, k2] of [['ribeye', 120, 9.5, 54, 0.05, 0.025], ['kip', 180, 5, 75, 0.06, 0.03]]) {
    let S = c0, C = c0, m = 0; const pts = [];
    while (C < target) { for (let i = 0; i < 30; i++) { S += k1 * (Ta - S) / 60; C += k2 * (S - C) / 60; } m += 0.5; pts.push({t: T0 + m * MIN, core: +C.toFixed(1), ambient: Ta}); }
    let worst = 0, early = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if ((pts[i].core - c0) / (target - c0) < 0.5) continue;
      const e = at(pts, i, {target});
      if (e.state !== 'estimate') continue;
      const err = (e.cookEnd - (T0 + m * MIN)) / MIN;
      worst = Math.max(worst, Math.abs(err)); early = Math.min(early, err);
    }
    assert.ok(worst <= 0.25 * m, name + ' within 25%');
    assert.ok(early >= -0.05 * m, name + ' never more than 5% too early');
    console.log(`  tweetraps ${name}: grootste afwijking ${worst.toFixed(1)} min van ${m} min (${(100 * worst / m).toFixed(0)}%), te laat`);
  }
});

// v5.5 (review PR #44, finding 2): heldUntil = the source confirms the last value is still current (HA last_reported, or a
// sensor that is still available while HA writes only on a change). Only freshness changes; no point is invented.
caseOf('heldUntil: onveranderde waarde blijft vers, tijden blijven aan de laatste meting verankerd', () => {
  const pts = strip(newton({...RIBEYE, until: 40}));
  const last = pts[pts.length - 1].t, now = last + 20 * MIN;
  const base = {points: pts, target: 54, phaseTargets: [47], rest: 8, startedAt: T0, cookMinutes: 55, transitionMinutes: 15};
  const without = estimate({...base, now});
  assert.equal(without.state, 'expired'); assert.equal(without.source, 'start', 'zonder heldUntil: na 15 min vervalt de curve');
  const held = estimate({...base, now, heldUntil: now});
  assert.equal(held.source, 'curve'); assert.equal(held.stale, false); assert.equal(held.ageMin, 0);
  assert.equal(held.unchangedMin, 20, 'aantal minuten zonder verandering');
  const fresh = estimate({...base, now: last + 2000});
  assert.equal(held.cookEnd, fresh.cookEnd, 'zelfde eindtijd: verankerd aan de laatste meting, niet aan heldUntil');
  assert.equal(held.points, pts.length, 'geen verzonnen meetpunt');
  // last_reported 6 min old → stale; 16 min → expired.
  assert.equal(estimate({...base, now, heldUntil: now - 6 * MIN}).stale, true);
  assert.equal(estimate({...base, now, heldUntil: now - 16 * MIN}).state, 'expired');
  // Invalid or future heldUntil is ignored.
  assert.equal(estimate({...base, now, heldUntil: now + 10 * MIN}).state, 'expired');
  assert.equal(estimate({...base, now, heldUntil: 'x'}).state, 'expired');
  assert.equal(estimate({...base, now, heldUntil: last - MIN}).state, 'expired', 'ouder dan de laatste meting telt niet');
});
caseOf('heldUntil: puur (invoer onveranderd, zelfde antwoord)', () => {
  const pts = strip(newton({...RIBEYE, until: 30}));
  const input = {points: pts, target: 54, now: pts[pts.length - 1].t + 9 * MIN, heldUntil: pts[pts.length - 1].t + 9 * MIN};
  const copy = JSON.stringify(input);
  const a = estimate(input), b = estimate(input);
  assert.equal(JSON.stringify(input), copy); assert.deepEqual(a, b);
});

// v5.10: fasedoelen uit het recept (coreAt) komen als phaseTargets binnen; zonder coreAt blijft de aanname (doel − 7 °C) of geen fase.
caseOf('fasedoel uit het recept (coreAt) in plaats van de aanname doel − 7 °C', () => {
  const pts = newton({...RIBEYE, until: 30});
  const withCoreAt = at(pts, pts.length - 1, {target: 54, phaseTargets: [50]});      // recept: coreAt 50
  const assumption = at(pts, pts.length - 1, {target: 54, phaseTargets: [54 - 7]});  // aanname: 47
  const none = at(pts, pts.length - 1, {target: 54, phaseTargets: []});              // geen fasedoel
  assert.equal(withCoreAt.phase.target, 50, 'het fasedoel uit het recept wordt geschat');
  assert.equal(assumption.phase.target, 47, 'zonder coreAt: de aanname blijft');
  assert.equal(none.phase, null, 'zonder fasedoel geen fasetijd');
  const t = v => trueMinutes(RIBEYE.Ta, RIBEYE.c0, v, RIBEYE.k);
  assert.ok(Math.abs(withCoreAt.phase.at - (T0 + t(50) * MIN)) / MIN <= 0.1 * t(50), 'fasetijd voor 50 °C binnen 10%');
  assert.ok(withCoreAt.phase.at > assumption.phase.at && withCoreAt.phase.at < withCoreAt.cookEnd, '50 °C komt na 47 °C en vóór 54 °C');
  // Het einddoel verandert er niet door.
  assert.equal(withCoreAt.cookEnd, assumption.cookEnd); assert.equal(withCoreAt.cookEnd, none.cookEnd);
  // Meerdere fasedoelen (bijvoorbeeld pulled pork 70 en 88 °C): het eerstvolgende niet-bereikte telt; een doel op of boven het einddoel niet.
  const multi = at(pts, pts.length - 1, {target: 54, phaseTargets: [54, 20, 52, 50, 'x', null]});
  assert.equal(multi.phase.target, 50, 'het eerstvolgende fasedoel boven de huidige kern en onder het einddoel');
});

const failed = results.filter(r => r.status === 'FAIL');
console.log(`${results.length - failed.length}/${results.length} ETA-cases geslaagd (TZ=${process.env.TZ || 'standaard'})`);
if (failed.length) process.exit(1);
