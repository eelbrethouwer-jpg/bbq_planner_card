#!/usr/bin/env node
// Mutatietests voor tests/v5-publication-guard.mjs: bewijst dat de bewaking faalt op verboden
// wijzigingen en slaagt op de ongewijzigde werkboom. Draait in een tijdelijke git-worktree, zodat
// de echte werkboom nooit wordt aangeraakt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkPublication, resolveBase} from './v5-publication-guard.mjs';

const root = process.cwd();
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const base = resolveBase(root, process.argv[2]);
const HTML = 'dist/BBQ_bereidingsplanner_MEATER_v4.html';
const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'bbq-guard-'));
// Huidige (eventueel nog niet gecommitte) bestanden die de bewaking en de appversie bepalen.
const carry = ['.github/publication-guard.json', 'tests/v5-publication-guard.mjs', ...JSON.parse(fs.readFileSync('.github/publication-guard.json', 'utf8')).allowedProductionChanges];

git(root, 'worktree', 'add', '--detach', '--force', wt, 'HEAD');
const reset = () => {
  git(wt, 'checkout', '--', '.');
  git(wt, 'clean', '-fdq');
  for (const f of carry) if (fs.existsSync(path.join(root, f))) { fs.mkdirSync(path.dirname(path.join(wt, f)), {recursive: true}); fs.copyFileSync(path.join(root, f), path.join(wt, f)); }
};
const edit = (file, fn) => { const p = path.join(wt, file); const before = fs.readFileSync(p, 'utf8'); const after = fn(before); assert.notEqual(after, before, `mutatie in ${file} had geen effect`); fs.writeFileSync(p, after); };
const replaceOnce = (needle, repl) => s => { assert.ok(s.includes(needle), `'${needle}' niet gevonden`); return s.replace(needle, repl); };

const cases = [
  ['1 enginebestand gewijzigd', 'PROTECTED_PATH', () => edit('engine/check.mjs', s => s + '\n// mutatie\n')],
  ['1b nieuw bestand in engine/', 'PROTECTED_PATH', () => fs.writeFileSync(path.join(wt, 'engine/extra.mjs'), 'export const x=1;\n')],
  ['2 v6-previewbestand gewijzigd', 'PROTECTED_PATH', () => edit('v6/preview-entry.mjs', s => s + '\n// mutatie\n')],
  ['2b v6-preview-HTML gewijzigd', 'PROTECTED_PATH', () => edit('v6/preview.html', s => s.replace('</body>', '<p>x</p></body>'))],
  ['3 productie-loader <script src> naar v6', 'FORBIDDEN_REFERENCE', () => edit(HTML, replaceOnce('<script src="./bbq-v5.js', '<script src="../v6/preview-entry.mjs"></script>\n<script src="./bbq-v5.js'))],
  ['3b loader via procent-codering (../%76%36/)', 'FORBIDDEN_REFERENCE', () => edit(HTML, replaceOnce('<script src="./bbq-v5.js', '<script src="./%2E%2E/%76%36/preview-entry.mjs"></script>\n<script src="./bbq-v5.js'))],
  ['3c <link> naar v6-stylesheet', 'FORBIDDEN_REFERENCE', () => edit(HTML, replaceOnce('<link rel="stylesheet" href="./bbq-v5.css', '<link rel="stylesheet" href="../v6/regisseur.css">\n<link rel="stylesheet" href="./bbq-v5.css'))],
  ['3d index.html stuurt door naar v6', 'FORBIDDEN_REFERENCE', () => edit('index.html', s => s.replace(/'\.\/dist\/BBQ_bereidingsplanner_MEATER_v4\.html\?v=[^']*'/, "'./v6/preview.html'"))],
  ['3e statisch <iframe> in productie-HTML', 'FORBIDDEN_LOADER', () => edit(HTML, replaceOnce('<div class="toast"', '<iframe src="./bbq-v5.css"></iframe><div class="toast"'))],
  ['4 dynamische import met samengestelde specifier', 'FORBIDDEN_LOADER', () => edit('dist/bbq-v5.js', s => s + "\n;import('./'+'pre'+'view.mjs');\n")],
  ['4b dynamische import met commentaar ertussen', 'FORBIDDEN_LOADER', () => edit('dist/bbq-v501.js', s => s + "\n;const u=location.href;import /* lazy */ (u);\n")],
  ['4c script-injectie', 'FORBIDDEN_LOADER', () => edit('dist/bbq-v5.js', s => s + "\n;document.head.appendChild(Object.assign(document.createElement('script'),{src:'x.js'}));\n")],
  ['4d Worker', 'FORBIDDEN_LOADER', () => edit('dist/bbq-v5.js', s => s + "\n;new Worker(window.__w);\n")],
  ['4e module-script inline', 'FORBIDDEN_LOADER', () => edit(HTML, replaceOnce('<script src="./bbq-v5.js', '<script type="module">window.x=1</script>\n<script src="./bbq-v5.js'))],
  ['4f nieuwe navigatiesink (.src=)', 'LOADER_INVENTORY', () => edit('dist/bbq-v5.js', s => s + "\n;(new Image()).src=window.__u;\n")],
  ['5 opslagsleutel v1→v2', 'STORAGE_CONTRACT', () => edit(HTML, replaceOnce("const KEY='kamado-bereidingsplanner-v1'", "const KEY='kamado-bereidingsplanner-v2'"))],
  ['5b nieuwe opslagsleutel', 'STORAGE_CONTRACT', () => edit('dist/bbq-v5.js', s => s + "\n;try{localStorage.setItem('bbq-new-thing-v1','1')}catch(e){}\n")],
  ['5c state-schema (initial) gewijzigd', 'STORAGE_CONTRACT', () => edit(HTML, replaceOnce("mealTime:'18:30'", "mealTime:'19:00'"))],
  ['5d opslag via indirecte sleutel', 'STORAGE_CONTRACT', () => edit('dist/bbq-v501.js', s => s + "\n;const K2=['bbq','x'].join('-');try{window.localStorage.setItem(K2,'1')}catch(e){}\n")],
  ['5e HA-berichttype hernoemd', 'STORAGE_CONTRACT', () => edit('dist/bbq_planner_card.js', s => s.replaceAll('bbq-notify-result-v1', 'bbq-notify-result-v2'))],
  ['6 niet-toegestaan productiebestand (manifest)', 'UNDECLARED_PRODUCTION_CHANGE', () => edit('manifest.webmanifest', s => s.replace('"lang": "nl"', '"lang": "en"'))],
  ['6b nieuw productiebestand', 'UNDECLARED_PRODUCTION_CHANGE', () => fs.writeFileSync(path.join(wt, 'dist/extra.js'), 'window.x=1;\n')],
  ['7 sw.js-shell naar v6', 'FORBIDDEN_REFERENCE', () => edit('sw.js', replaceOnce("'dist/bbq-v520.css'", "'dist/bbq-v520.css','v6/preview.html'"))],
  ['7b sw.js-shell naar niet-bestaand bestand', 'FORBIDDEN_REFERENCE', () => edit('sw.js', replaceOnce("'dist/bbq-v520.css'", "'dist/bbq-v520.css','dist/ontbreekt.js'"))],
  ['8 productie gewijzigd zonder nieuwe appversie', 'RELEASE_REQUIRED', () => {
    // Zet de appversie terug op die van de base (no-op als die al gelijk is, bv. na een merge) en wijzig productie.
    const baseVersion = git(root, 'show', `${base}:sw.js`).match(/bbq-regisseur-v([^'"]+)/)[1];
    const p = path.join(wt, 'sw.js'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/bbq-regisseur-v[^'"]+/, 'bbq-regisseur-v' + baseVersion));
    edit('dist/bbq-v5.css', s => s + '\n/* mutatie */\n');
  }],
];

let failed = 0;
try {
  reset();
  const clean = checkPublication({root: wt, base});
  assert.equal(clean.ok, true, 'ongemuteerde werkboom moet slagen: ' + JSON.stringify(clean.issues, null, 1));
  console.log(`ok   0 ongemuteerde werkboom slaagt (base ${base.slice(0, 7)}, ${clean.productionChanged.length} toegestane productiewijzigingen)`);
  for (const [name, code, mutate] of cases) {
    reset();
    try {
      mutate();
      const r = checkPublication({root: wt, base});
      assert.equal(r.ok, false, 'bewaking slaagde onterecht');
      assert.ok(r.issues.some(i => i.code === code), `verwachte ${code}, kreeg ${r.issues.map(i => i.code).join(',')}`);
      // Verwijzingen moeten structureel (via URL-resolutie) worden gevonden, niet alleen via de token-grep.
      if (code === 'FORBIDDEN_REFERENCE') assert.ok(r.issues.some(i => i.code === code && !/token/.test(i.msg)), 'alleen token-detectie, geen structurele detectie');
      console.log(`ok   ${name} → ${[...new Set(r.issues.map(i => i.code))].join(', ')}`);
    } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
  }
} finally {
  try { git(root, 'worktree', 'remove', '--force', wt); } catch { fs.rmSync(wt, {recursive: true, force: true}); git(root, 'worktree', 'prune'); }
}
if (failed) { console.error(`${failed} mutatietest(s) gefaald`); process.exit(1); }
console.log(`v5-publicatiebewaking: alle ${cases.length} verboden mutaties gedetecteerd`);
