/* v5.1.1 -> v5.2.1 same-origin browser-storage regression (jsdom).
   Not a physical iPhone, service-worker update, HA connection or MEATER test.
   Creates only synthetic recipes/reviews/plan data in isolated jsdom origins. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';

const REPO_RELEASE = '8afb5a89c7d2af975f6cddcbb97598682906e543';
const htmlPath = 'dist/BBQ_bereidingsplanner_MEATER_v4.html';
const URL = 'https://bbq-upgrade.test.invalid/dist/BBQ_bereidingsplanner_MEATER_v4.html';
const oldFile = path => execFileSync('git', ['show', REPO_RELEASE + ':' + path], {encoding: 'utf8', maxBuffer: 32 << 20});
const newFile = path => fs.readFileSync(path, 'utf8');

function assemble(read, version) {
  let html = read(htmlPath);
  assert.ok(html.includes('?v=' + version), 'expected app version ' + version);
  for (const file of ['bbq-v5.js', 'bbq-v501.js']) {
    const tag = new RegExp('<script src="\\./' + file.replaceAll('.', '\\.') + '\\?v=[^"]+"></script>');
    assert.match(html, tag, file + ' script tag exists');
    html = html.replace(tag, () => '<script>' + read('dist/' + file).replaceAll('</script>', '<\\/script>') + '</script>');
  }
  return html;
}
const oldHtml = assemble(oldFile, '5.1.1');
const rcHtml = assemble(newFile, '5.2.1');

function boot(html, seed = {}) {
  const errors = [];
  const dom = new JSDOM(html, {
    url: URL, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.confirm = () => true;
      w.alert = () => {};
      w.prompt = () => null;
      w.print = () => {};
      w.URL.createObjectURL = () => 'blob:test';
      w.URL.revokeObjectURL = () => {};
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      w.setInterval = () => 0;
      w.addEventListener('error', e => errors.push(String(e.error?.stack || e.message)));
      for (const [key, value] of Object.entries(seed)) w.localStorage.setItem(key, value);
    }
  });
  assert.deepEqual(errors, [], 'page script errors on bootstrap');
  assert.ok(dom.window.document.getElementById('v5-root'), 'v5 UI mounted');
  return dom;
}
const snapshot = w => Object.fromEntries(Array.from({length: w.localStorage.length}, (_, i) => {
  const key = w.localStorage.key(i);
  return [key, w.localStorage.getItem(key)];
}));

// Synthetic data expressed using the storage contract of the published v5.1.1 app.
const seed = {
  'kamado-recipe-book-v1': JSON.stringify([{
    name: 'Upgrade test Bavette', category: 'rund', method: 'direct', grate: 'rvs',
    kamado: 'large', cook: 45, rest: 10, core: '54', grill: 230,
    recipeIngredients: '500 g bavette', recipeCook: 'Grillen op de kamado',
    updatedAt: '2026-11-01T12:00:00.000Z'
  }]),
  'kamado-recipe-deletions-v1': JSON.stringify([{name:'Verwijderd testrecept', updatedAt:'2026-10-25T12:00:00.000Z'}]),
  'kamado-reviews-v1': JSON.stringify([{
    id: 'upgrade-review-511', name: 'Bavette', date: '2026-11-01',
    createdAt: '2026-11-01T19:00:00.000Z', rating: 5,
    actualMinutes: 45, comment: 'Bestaande review uit 5.1.1'
  }]),
  'bbq-v5-session-v1': JSON.stringify({version:1,active:true,stage:'live',created:'2026-11-01T12:00:00.000Z'})
};

// Boot the actual published source and create a stored plan via its UI.
const first = boot(oldHtml, seed);
const mealDate = first.window.document.getElementById('meal-date');
const mealTime = first.window.document.getElementById('meal-time');
mealDate.value = '2026-12-24';
mealDate.dispatchEvent(new first.window.Event('input', {bubbles: true}));
mealTime.value = '19:15';
mealTime.dispatchEvent(new first.window.Event('input', {bubbles: true}));
const PLAN_KEY = 'kamado-bereidingsplanner-v1';
const plan = JSON.parse(first.window.localStorage.getItem(PLAN_KEY));
assert.equal(plan.dateMode, 'manual');
assert.equal(plan.dishes.length, 3, 'v5.1.1 generated 3 actual sample dishes');
plan.v46Pantry = [{name:'Testkruiden',qty:2,unit:'g'}];
plan.v46Done = {'upgrade-task-id':true};
plan.v5Actual = {'upgrade-task-id':1730433600000};
first.window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
const saved = snapshot(first.window);
first.window.close();

// Ensure the saved payload is accepted by v5.1.1 on a fresh launch.
const oldReopened = boot(oldHtml, saved);
assert.equal(oldReopened.window.document.getElementById('meal-time').value, '19:15');
assert.equal(JSON.parse(oldReopened.window.localStorage.getItem(PLAN_KEY)).dishes.length, 3);
const before = snapshot(oldReopened.window);
oldReopened.window.close();

// Same logical origin and localStorage payload, but now boot actual PR app code.
const next = boot(rcHtml, before);
const after = snapshot(next.window);
const mustPreserve = [PLAN_KEY, 'kamado-recipe-book-v1', 'kamado-recipe-deletions-v1',
  'kamado-reviews-v1', 'bbq-v5-session-v1'];
for (const key of mustPreserve) {
  assert.ok(before[key] != null, key + ' exists before upgrade');
  assert.ok(after[key] != null, key + ' exists after upgrade');
  assert.deepEqual(JSON.parse(after[key]), JSON.parse(before[key]), key + ' preserved after 5.2.1 bootstrap');
}
for (const key of Object.keys(before)) assert.ok(key in after, 'previous key retained: ' + key);
assert.equal(JSON.parse(after[PLAN_KEY]).dishes.length, 3);
assert.equal(JSON.parse(after[PLAN_KEY]).mealTime, '19:15');
assert.equal(JSON.parse(after[PLAN_KEY]).v46Pantry[0].name, 'Testkruiden');
const recipesNav = next.window.document.querySelector('#v5-nav [data-v5-act="recipes"]');
assert.ok(recipesNav);
recipesNav.click();
assert.match(next.window.document.getElementById('v47-recipes').textContent, /Upgrade test Bavette/);
assert.deepEqual(JSON.parse(next.window.localStorage.getItem('kamado-recipe-book-v1')),
  JSON.parse(before['kamado-recipe-book-v1']), 'recipe not lost after navigation');
next.window.close();
console.log('PASS v5.1.1 → v5.2.1 same-origin jsdom data upgrade: 3 dishes, date/time, pantry, tasks, local cookbook, deleted recipes, reviews and active session retained');
