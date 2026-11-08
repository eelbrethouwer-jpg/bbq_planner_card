#!/usr/bin/env node
// Publicatiebewaking v5 (GitHub Pages publiceert main direct).
//
// Vergelijkt de werkboom met een vaste base-commit (PR-base of vorige push), niet met een
// verschuivende origin/main, en controleert vijf lagen:
//  1. PROTECTED_PATH            engine/** en v6/** wijzigen niet (tenzij expliciet toegestaan in de policy).
//  2. UNDECLARED_PRODUCTION     alleen productiebestanden uit de allowlist in .github/publication-guard.json
//                               mogen wijzigen, en alleen samen met een nieuwe appversie (RELEASE_REQUIRED).
//  3. FORBIDDEN_REFERENCE       HTML-loaders, CSS-url's, sw.js-shell en stringpaden in JS worden als URL
//                               opgelost (dus ook ../, %2E%2E en ?query) en mogen niet naar v6/ of engine/
//                               of naar niet-bestaande/niet-productiebestanden wijzen.
//  4. FORBIDDEN_LOADER          geen dynamische import(), statische import/export-from, importScripts,
//                               Worker, script-injectie, eval/new Function of module-scripts; overige
//                               laad-/navigatiesinks (src=, fetch, iframe, location) moeten exact gelijk
//                               zijn aan de geïnventariseerde aantallen in de base.
//  5. STORAGE_CONTRACT          set opslag-/berichtidentificatoren, sleutelconstanten en alle regels met
//                               localStorage/sessionStorage/indexedDB en de state-schema-regels zijn gelijk
//                               aan de base en aan de policy.
// Gebruik: node tests/v5-publication-guard.mjs [--base <ref>] [--root <dir>] [--json]
// Base: --base, anders $GUARD_BASE (CI: PR-base-SHA of push-before-SHA), anders merge-base met origin/main.
// Zonder vaststelbare base faalt de controle (fail-closed).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ZERO = /^0{40}$/;
const IDENT_RE = /['"`]((?:kamado|bbq)[-_][A-Za-z0-9_-]*v[0-9]+)['"`]/g;
const STORAGE_LINE_RE = /\b(localStorage|sessionStorage|indexedDB)\b/;
const SCHEMA_ANCHORS = [/^\s*const\s+initial\s*=/, /^\s*const\s+persist\s*=/, /^\s*const\s+[A-Z_]*KEY[A-Z_]*\s*=\s*['"`]/];
const FORBIDDEN_TOKENS = [/v6preview/i, /__bbqV6/, /\bv6\//, /\bengine\//];
const HARD_FORBIDDEN = [
  ['dynamic-import', /\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)*\(/],
  ['static-import', /(?:^|[;\n}])\s*import\s*(?:[\w*{][^;\n]*?\bfrom\s*)?['"`]/],
  ['export-from', /\bexport\s*[*{][^;\n]*?\bfrom\s*['"`]/],
  ['importScripts', /\bimportScripts\b/],
  ['worker', /\bnew\s+(?:Shared)?Worker\b|\bserviceWorker\s*\.\s*register\s*\((?!\s*['"]\.\.\/sw\.js['"])/],
  ['script-injection', /createElement\s*\(\s*['"`]script['"`]|insertAdjacentHTML\s*\([^)]*<script|\.innerHTML\s*=[^;]*<script/i],
  ['eval', /\beval\s*\(|\bnew\s+Function\s*\(/],
];
// Sinks die legitiem voorkomen; hun aantal per bestand moet gelijk blijven aan de base.
const SINKS = [
  ['src-href-assign', /\.(?:src|href|data)\s*=(?!=)/g],
  ['setAttribute-url', /setAttribute\s*\(\s*['"`](?:src|href|data|action)['"`]/g],
  ['fetch', /\bfetch\s*\(/g],
  ['iframe', /createElement\s*\(\s*['"`](?:iframe|object|embed|link)['"`]|<iframe\b/gi],
  ['navigation', /\blocation\s*(?:\.\s*(?:href|assign|replace))?\s*(?:=(?!=)|\()|\bwindow\.open\s*\(/g],
];

function sh(root, args, opts = {}) {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts}).trim();
}
function tryGit(root, args) { try { return sh(root, args); } catch { return null; } }

export function resolveBase(root, explicit) {
  const candidates = [explicit, process.env.GUARD_BASE].filter(x => x && !ZERO.test(x));
  for (const c of candidates) {
    if (tryGit(root, ['cat-file', '-e', c + '^{commit}']) === null) throw new Error(`base ${c} niet gevonden (fetch-depth te klein?)`);
    const mb = tryGit(root, ['merge-base', c, 'HEAD']);
    if (!mb) throw new Error(`geen merge-base tussen ${c} en HEAD`);
    return mb;
  }
  const mb = tryGit(root, ['merge-base', 'origin/main', 'HEAD']);
  if (mb && mb !== tryGit(root, ['rev-parse', 'HEAD'])) return mb;
  const parent = tryGit(root, ['rev-parse', 'HEAD~1']);
  if (parent) return parent;
  throw new Error('geen base-commit vast te stellen');
}

const isUnder = (file, prefixes) => prefixes.some(p => p.endsWith('/') ? file.startsWith(p) : file === p);
const toPosix = p => p.split(path.sep).join('/');

function readAt(root, base, file) {
  if (base === null) { try { return fs.readFileSync(path.join(root, file), 'utf8'); } catch { return null; } }
  try { return execFileSync('git', ['show', `${base}:${file}`], {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore']}); } catch { return null; }
}
function listFiles(root, base, policy) {
  const all = base === null
    ? [...new Set([...sh(root, ['ls-files']).split('\n'), ...sh(root, ['ls-files', '--others', '--exclude-standard']).split('\n')])].filter(f => f && fs.existsSync(path.join(root, f)))
    : sh(root, ['ls-tree', '-r', '--name-only', base]).split('\n');
  return all.filter(f => isUnder(f, policy.productionPaths));
}
const TEXT_EXT = /\.(?:html?|m?js|css|json|webmanifest)$/i;

function cacheVersion(src) { return src?.match(/const\s+CACHE\s*=\s*['"]bbq-regisseur-v([^'"]+)['"]/)?.[1] ?? null; }

// ---- referentie-analyse ----
const ORIGIN = 'https://guard.invalid/';
function classifyUrl(raw, fromFile, prodFiles, policy) {
  const value = raw.trim();
  if (!value || value.startsWith('#') || /^(?:data|blob|mailto|tel|javascript):/i.test(value)) {
    return /^javascript:/i.test(value) ? 'javascript-url' : null;
  }
  if (/['"+]|\$\{/.test(value)) return null; // runtime-samengesteld (escape(...)); sinks worden apart geteld
  let u;
  try { u = new URL(value, ORIGIN + fromFile); } catch { return null; }
  if (u.origin !== new URL(ORIGIN).origin) return null; // extern (recepten-, Pages-links); geen v6/engine-code
  let p;
  try { p = decodeURIComponent(u.pathname).replace(/^\/+/, ''); } catch { return 'undecodable-path'; }
  if (isUnder(p, policy.protectedPaths) || /(?:^|\/)(?:v6|engine)\//.test(p)) return `verwijst naar beschermd pad ${p}`;
  const target = p === '' || p.endsWith('/') ? p + 'index.html' : p;
  if (!isUnder(target, policy.productionPaths)) return `verwijst buiten productie naar ${p}`;
  if (!prodFiles.has(target)) return `verwijst naar niet-bestaand productiebestand ${p}`;
  return null;
}
function stripScripts(html) {
  const inline = [];
  const outer = html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (m, open, body, close) => { inline.push({open, body}); return open + close; });
  return {outer, inline};
}
function tagUrls(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase(), attrs = m[2];
    for (const a of attrs.matchAll(/\b(src|href|data|action|formaction|poster|srcset|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const name = a[1].toLowerCase(), val = a[2] ?? a[3] ?? a[4] ?? '';
      if (name === 'content') { if (/http-equiv\s*=\s*["']?refresh/i.test(attrs)) out.push({tag: 'meta-refresh', url: val.replace(/^[^;]*;\s*url\s*=\s*/i, '')}); continue; }
      if (name === 'srcset') { for (const part of val.split(',')) out.push({tag, url: part.trim().split(/\s+/)[0]}); continue; }
      out.push({tag, url: val});
    }
  }
  return out;
}
function jsStringPaths(js) {
  const out = [];
  for (const m of js.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const s = m[2];
    if (m[1] === '`' && s.includes('${')) continue;
    if (/^(?:\.{0,2}\/|[\w.-]+\/)[^\s<>]*$/.test(s) || /^[\w./%-]+\.(?:m?js|html?|css|json|webmanifest|wasm)(?:[?#][^\s]*)?$/i.test(s)) out.push(s);
  }
  return out;
}
const stripComments = js => js.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');

function analyseFile(file, src, prodFiles, policy) {
  const issues = [], sinks = {};
  const add = (code, msg) => issues.push({code, file, msg});
  for (const re of FORBIDDEN_TOKENS) if (re.test(src)) add('FORBIDDEN_REFERENCE', `bevat verboden v6/engine-token ${re}`);
  const scanJs = (js, label) => {
    const code = stripComments(js);
    for (const [kind, re] of HARD_FORBIDDEN) if (re.test(code)) add('FORBIDDEN_LOADER', `${label}: verboden laadmechanisme (${kind})`);
    for (const [kind, re] of SINKS) sinks[kind] = (sinks[kind] || 0) + (code.match(re) || []).length;
    for (const s of jsStringPaths(code)) {
      const r = classifyUrl(s, file, prodFiles, policy);
      if (r && /beschermd|javascript-url|undecodable/.test(r)) add('FORBIDDEN_REFERENCE', `${label}: string '${s}' ${r}`);
    }
  };
  if (/\.html?$/i.test(file)) {
    const {outer, inline} = stripScripts(src);
    for (const {tag, url} of tagUrls(outer)) {
      const r = classifyUrl(url, file, prodFiles, policy);
      if (r) add('FORBIDDEN_REFERENCE', `<${tag}> '${url}' ${r}`);
    }
    for (const t of ['iframe', 'object', 'embed', 'base', 'frame', 'portal']) if (new RegExp(`<${t}\\b`, 'i').test(outer)) add('FORBIDDEN_LOADER', `statisch <${t}>-element in productie-HTML`);
    for (const {open, body} of inline) {
      if (/\btype\s*=\s*["']?module/i.test(open)) add('FORBIDDEN_LOADER', 'module-script in productie-HTML');
      if (/\bsrc\s*=/.test(open)) continue; // al als tag-URL gecontroleerd
      scanJs(body, 'inline <script>');
    }
    for (const m of outer.matchAll(/\son\w+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) scanJs(m[1] ?? m[2], 'inline event-handler');
  } else if (/\.m?js$/i.test(file)) {
    const allowModule = (policy.moduleFiles || []).includes(file);
    const code = stripComments(src);
    if (!allowModule && /\bimport\.meta\b/.test(code)) add('FORBIDDEN_LOADER', 'import.meta in klassiek script');
    scanJs(src, 'js');
    if (file === 'sw.js') {
      for (const list of ['PAGES', 'ASSETS']) {
        const m = src.match(new RegExp(`const\\s+${list}\\s*=\\s*\\[([^\\]]*)\\]`));
        if (!m) { add('FORBIDDEN_REFERENCE', `sw.js: ${list} niet gevonden`); continue; }
        for (const s of m[1].matchAll(/['"]([^'"]*)['"]/g)) {
          const r = classifyUrl(s[1], 'sw.js', prodFiles, policy);
          if (r) add('FORBIDDEN_REFERENCE', `sw.js ${list} '${s[1]}' ${r}`);
        }
      }
    }
  } else if (/\.css$/i.test(file)) {
    for (const m of src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/gi)) {
      const url = m[2] ?? m[4];
      if (m[4]) add('FORBIDDEN_LOADER', `CSS @import '${url}'`);
      const r = classifyUrl(url, file, prodFiles, policy);
      if (r) add('FORBIDDEN_REFERENCE', `CSS url '${url}' ${r}`);
    }
  } else if (/\.(?:json|webmanifest)$/i.test(file)) {
    let data; try { data = JSON.parse(src); } catch { add('FORBIDDEN_REFERENCE', 'ongeldige JSON'); return {issues, sinks}; }
    const walk = (v, k) => {
      if (typeof v === 'string' && /^(?:src|start_url|scope|id|url|href)$/.test(k)) { const r = classifyUrl(v, file, prodFiles, policy); if (r) add('FORBIDDEN_REFERENCE', `${k} '${v}' ${r}`); }
      else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, Array.isArray(v) ? k : kk);
    };
    walk(data, '');
  }
  return {issues, sinks};
}

function storageFingerprint(files, read) {
  const identifiers = new Set(), lines = [], constants = {};
  for (const f of files) {
    if (!/\.(?:html?|m?js)$/i.test(f)) continue;
    const src = read(f); if (src == null) continue;
    for (const m of src.matchAll(IDENT_RE)) identifiers.add(m[1]);
    for (const m of src.matchAll(/(?:local|session)Storage\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*['"`]([^'"`]+)['"`]/g)) identifiers.add(m[1]);
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*['"`]([^'"`]+)['"`]/g)) constants[`${f}:${m[1]}`] = m[2];
    for (const line of src.split('\n')) if (STORAGE_LINE_RE.test(line) || SCHEMA_ANCHORS.some(re => re.test(line))) lines.push(`${f}: ${line.trim()}`);
  }
  return {identifiers: [...identifiers].sort(), constants, lines: lines.sort()};
}
const diffList = (a, b) => ({added: b.filter(x => !a.includes(x)), removed: a.filter(x => !b.includes(x))});

export function checkPublication({root = process.cwd(), base, policyFile = '.github/publication-guard.json'} = {}) {
  root = path.resolve(root);
  const policy = JSON.parse(fs.readFileSync(path.join(root, policyFile), 'utf8'));
  const resolvedBase = resolveBase(root, base);
  const issues = [], notes = [];
  const add = (code, file, msg) => issues.push({code, file, msg});

  const changed = new Set([
    ...sh(root, ['diff', '--name-only', '--no-renames', resolvedBase]).split('\n'),
    ...sh(root, ['ls-files', '--others', '--exclude-standard']).split('\n'),
  ].filter(Boolean));

  // 1. beschermde paden
  for (const f of changed) if (isUnder(f, policy.protectedPaths) && !(policy.allowProtectedChanges || []).includes(f)) add('PROTECTED_PATH', f, 'beschermd pad gewijzigd t.o.v. base');

  // 2. productie-allowlist en versie
  const prodChanged = [...changed].filter(f => isUnder(f, policy.productionPaths));
  for (const f of prodChanged) if (!policy.allowedProductionChanges.includes(f)) add('UNDECLARED_PRODUCTION_CHANGE', f, 'productiebestand gewijzigd maar niet in allowedProductionChanges');
  const headVersion = cacheVersion(readAt(root, null, 'sw.js')), baseVersion = cacheVersion(readAt(root, resolvedBase, 'sw.js'));
  if (prodChanged.length) {
    if (headVersion !== policy.release) add('RELEASE_REQUIRED', 'sw.js', `productie gewijzigd: CACHE-versie ${headVersion} moet gelijk zijn aan policy.release ${policy.release}`);
    if (headVersion && headVersion === baseVersion) add('RELEASE_REQUIRED', 'sw.js', `productie gewijzigd zonder nieuwe appversie (base en HEAD beide ${headVersion})`);
  }
  for (const f of [policyFile, 'tests/v5-publication-guard.mjs', 'tests/v5-publication-guard-negative.mjs', '.github/workflows/validate.yml']) if (changed.has(f)) notes.push(`${f} gewijzigd in deze diff — bewaking zelf vraagt review`);

  // 3/4. referenties en laders in de huidige werkboom
  const headProd = listFiles(root, null, policy), prodSet = new Set(headProd);
  const baseProd = listFiles(root, resolvedBase, policy), baseSet = new Set(baseProd);
  const headSinks = {}, baseSinks = {};
  for (const f of headProd) {
    if (!TEXT_EXT.test(f)) continue;
    const r = analyseFile(f, readAt(root, null, f), prodSet, policy);
    for (const i of r.issues) add(i.code, i.file, i.msg);
    headSinks[f] = r.sinks;
  }
  for (const f of baseProd) if (TEXT_EXT.test(f)) baseSinks[f] = analyseFile(f, readAt(root, resolvedBase, f), baseSet, policy).sinks;
  for (const f of new Set([...Object.keys(headSinks), ...Object.keys(baseSinks)])) {
    for (const [kind] of SINKS) {
      const h = headSinks[f]?.[kind] || 0, b = baseSinks[f]?.[kind] || 0;
      if (h !== b) add('LOADER_INVENTORY', f, `${kind}: ${b} → ${h} t.o.v. base; nieuwe of verwijderde laad-/navigatiesink vraagt een bewuste policywijziging`);
    }
  }

  // 5. opslagcontract
  const h = storageFingerprint(headProd, f => readAt(root, null, f));
  const b = storageFingerprint(baseProd, f => readAt(root, resolvedBase, f));
  if (!policy.allowDataContractChange) {
    const vsBase = diffList(b.identifiers, h.identifiers), vsPolicy = diffList([...policy.dataContractIdentifiers].sort(), h.identifiers);
    if (vsBase.added.length || vsBase.removed.length) add('STORAGE_CONTRACT', '*', `identificatoren t.o.v. base: +[${vsBase.added}] -[${vsBase.removed}]`);
    if (vsPolicy.added.length || vsPolicy.removed.length) add('STORAGE_CONTRACT', '.github/publication-guard.json', `identificatoren t.o.v. policy: +[${vsPolicy.added}] -[${vsPolicy.removed}]`);
    for (const k of new Set([...Object.keys(b.constants), ...Object.keys(h.constants)])) if (b.constants[k] !== h.constants[k]) add('STORAGE_CONTRACT', k.split(':')[0], `sleutelconstante ${k.split(':')[1]}: ${b.constants[k]} → ${h.constants[k]}`);
    const lines = diffList(b.lines, h.lines);
    for (const l of lines.added) add('STORAGE_CONTRACT', l.split(':')[0], `nieuwe/gewijzigde opslag- of schemaregel: ${l.slice(l.indexOf(':') + 2, l.indexOf(':') + 160)}`);
    for (const l of lines.removed) add('STORAGE_CONTRACT', l.split(':')[0], `verwijderde/gewijzigde opslag- of schemaregel: ${l.slice(l.indexOf(':') + 2, l.indexOf(':') + 160)}`);
  }
  return {ok: issues.length === 0, base: resolvedBase, head: tryGit(root, ['rev-parse', 'HEAD']), changed: [...changed].sort(), productionChanged: prodChanged.sort(), headVersion, baseVersion, issues, notes,
    stats: {productionFiles: headProd.length, identifiers: h.identifiers.length, storageLines: h.lines.length}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  let res;
  try { res = checkPublication({root: opt('--root') || process.cwd(), base: opt('--base')}); }
  catch (e) { console.error(`::error::publicatiebewaking kon niet draaien: ${e.message}`); process.exit(2); }
  if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else {
    console.log(`base ${res.base} → HEAD ${res.head}; appversie ${res.baseVersion} → ${res.headVersion}`);
    console.log(`gewijzigde productiebestanden (${res.productionChanged.length}): ${res.productionChanged.join(', ') || '-'}`);
    console.log(`gescand: ${res.stats.productionFiles} productiebestanden, ${res.stats.identifiers} opslag-/berichtidentificatoren, ${res.stats.storageLines} opslag-/schemaregels`);
    for (const n of res.notes) console.log(`::notice::${n}`);
    for (const i of res.issues) console.log(`::error file=${i.file}::${i.code}: ${i.msg}`);
    console.log(res.ok ? 'v5-publicatiebewaking: OK' : `v5-publicatiebewaking: ${res.issues.length} overtreding(en)`);
  }
  process.exit(res.ok ? 0 : 1);
}
