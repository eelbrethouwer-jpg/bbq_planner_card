/* PR3 route B publish guard. The workflow compares v5 assets against main. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('v6/preview.html');
const entry=read('v6/preview-entry.mjs');
const sandbox=read('v6/sandbox.html');
const errorMap=read('v6/preview-errors.mjs');
const view=read('v6/regisseur-view.mjs');
const beta=html.match(/preview-entry\.mjs\?v=([\w.-]+)/)?.[1];
const version=entry.match(/const BETA_VERSION='([\w.-]+)'/)?.[1];
assert.equal(beta,'6.0.0-beta.1','preview.html requires an explicit beta version');
assert.equal(version,beta,'dynamic legacy preview import MUST match HTML version');
assert.ok(entry.includes("import('./legacy-readonly-entry.mjs?v='+BETA_VERSION)"),
  'dynamic module import must use BETA_VERSION, not a stale static path');
assert.match(html,/<script type="module" src="\.\/preview-entry\.mjs\?v=/);
assert.ok(sandbox.includes('TESTPAGINA – FICTIEVE DATA'),
  'public test-only sandbox must be unmistakably labeled');
assert.ok(errorMap.includes('NO_SAVED_PLAN')&&errorMap.includes('INVALID_SAVED_PLAN'));
assert.ok(view.includes("if(typeof onApply==='function')"),
  'preview must hide Apply when no production callback was provided');
console.log('PASS PR3 beta import version, public sandbox labeling and hidden Apply contract');
