#!/usr/bin/env node
/* Draaier voor de Playwright-tests van de CI-job `mobile-browser` (ook lokaal te gebruiken).
   Waarom: één `node a.mjs && node b.mjs ...`-stap had geen time-out per test. Een vastgelopen browser of
   `await` kon de hele job tot de job-time-out laten hangen, zonder dat duidelijk was welke test het was.

   Wat dit doet (en wat niet):
   - Elke test draait als eigen proces met een harde time-out (standaard 6 min; per test overschrijfbaar).
     Bij overschrijding wordt de hele procesgroep (test + browsers) gedood en faalt de run met "TIME-OUT: <test>".
     Een time-out wordt NIET opnieuw geprobeerd.
   - Eén automatische herpoging, ALLEEN als de uitvoer een infrastructuurfout toont bij starten of laden
     (browser start niet, verbinding met de lokale testserver/route.fetch valt weg, navigatie komt niet op gang)
     en er geen enkele assertion-fout in de uitvoer staat. Een mislukte controle (AssertionError,
     "check mislukt", onverwacht gedrag) wordt nooit herhaald en nooit verzwakt.
   - Alle tests worden uitgevoerd; aan het eind staat een samenvatting met duur en uitkomst per test en de
     melding van elke herpoging (zodat een flaky infrastructuur zichtbaar blijft).
   Gebruik: node tests/run-browser-suite.mjs [--timeout=<seconden>] [test.mjs ...]
   Zonder testnamen draait de standaardlijst hieronder (zelfde volgorde als eerder in validate.yml). */
import {spawn} from 'node:child_process';
import path from 'node:path';

const SUITE = [
  'tests/mobile-bounds.mjs',
  'tests/v6-pr3-browser.mjs',
  'tests/v6-pr3-lock-browser.mjs',
  'tests/v6-pr3-real-v5-browser.mjs',
  'tests/v520-mobile-ux.mjs',
  'tests/v550-live-timeline.mjs',
  'tests/v551-panel-fullscreen.mjs',
  'tests/v570-planning-ui.mjs',
  'tests/v580-no-probe-ui.mjs',
  'tests/v590-cleanup.mjs',
  'tests/v5100-fasedoelen.mjs',
  'tests/v5110-generator.mjs',
  'tests/v5120-geen-dialogen.mjs',
  'tests/v5121-paneel-in-beeld.mjs',
  'tests/v5131-planning-live.mjs',
  'tests/v5150-sessiehistorie.mjs',
];
const DEFAULT_TIMEOUT_S = 360; // langste test duurt ~2-3 min op een CI-runner; ruim 2x marge
const TIMEOUT_S = {};

// Infrastructuurfouten bij starten/laden. Bewust smal: geen "Target closed" of vage tekst.
const INFRA = [
  /\bECONNRESET\b/, /\bECONNREFUSED\b/, /\bEPIPE\b/,
  /browserType\.launch:/, /\bpage\.goto:/, /\bnet::ERR_[A-Z_]+/, /NS_ERROR_[A-Z_]+/,
];
const ASSERTION = /AssertionError|ERR_ASSERTION|\bexpect\(|check mislukt/i;

const args = process.argv.slice(2);
let timeoutOverride = null;
const tests = [];
for (const a of args) {
  const m = a.match(/^--timeout=(\d+)$/);
  if (m) timeoutOverride = Number(m[1]);
  else tests.push(a);
}
const list = tests.length ? tests : SUITE;

function runOnce(file, timeoutS) {
  return new Promise(resolve => {
    const started = Date.now();
    // detached: eigen procesgroep, zodat we bij een time-out ook de browserprocessen kunnen doden.
    const child = spawn(process.execPath, [file], {stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: process.env});
    let out = '', timedOut = false;
    const tail = chunk => { const s = chunk.toString(); out = (out + s).slice(-20000); process.stdout.write(s); };
    child.stdout.on('data', tail);
    child.stderr.on('data', tail);
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* al weg */ } }
    }, timeoutS * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* geen restanten */ }
      resolve({code, out, timedOut, seconds: Math.round((Date.now() - started) / 1000)});
    });
    child.on('error', e => { clearTimeout(timer); resolve({code: 1, out: String(e), timedOut: false, seconds: 0}); });
  });
}

const rows = [];
for (const file of list) {
  const name = path.basename(file);
  const timeoutS = timeoutOverride ?? TIMEOUT_S[file] ?? DEFAULT_TIMEOUT_S;
  console.log(`\n::group::${name}`);
  console.log(`=== START ${file} (time-out ${timeoutS} s)`);
  let r = await runOnce(file, timeoutS), retried = false, retryWhy = '';
  if (r.code !== 0 && !r.timedOut && !ASSERTION.test(r.out)) {
    const hit = INFRA.find(re => re.test(r.out));
    if (hit) {
      retried = true; retryWhy = String(hit);
      console.log(`=== HERPOGING (eenmalig, alleen infrastructuur: ${retryWhy}) ${file}`);
      console.log(`::warning title=Herpoging infrastructuurfout::${name}: ${retryWhy}`);
      r = await runOnce(file, timeoutS);
    }
  }
  const status = r.timedOut ? 'TIME-OUT' : r.code === 0 ? 'OK' : 'MISLUKT';
  console.log(`=== ${status} ${file} na ${r.seconds} s${retried ? ' (na herpoging: ' + retryWhy + ')' : ''}`);
  console.log('::endgroup::');
  if (status !== 'OK') console.log(`::error title=${status}::${file} ${status === 'TIME-OUT' ? 'overschreed ' + timeoutS + ' s en is gestopt (vastgelopen browser of await)' : 'faalde (zie de log hierboven)'}`);
  rows.push({file, status, seconds: r.seconds, retried, retryWhy});
}

console.log('\n=== SAMENVATTING mobile-browser');
for (const r of rows) console.log(`${r.status.padEnd(8)} ${String(r.seconds).padStart(4)} s  ${r.file}${r.retried ? '  [herpoging: ' + r.retryWhy + ']' : ''}`);
const bad = rows.filter(r => r.status !== 'OK');
const retried = rows.filter(r => r.retried);
if (retried.length) console.log(`LET OP: ${retried.length} test(s) slaagden/faalden pas na een herpoging van een infrastructuurfout.`);
if (bad.length) { console.log(`${bad.length} van ${rows.length} test(s) mislukt of verlopen.`); process.exit(1); }
console.log(`Alle ${rows.length} browsertests gehaald.`);
