/* Test van .github/workflows/release.yml zonder GitHub.
   Het run-script wordt letterlijk uit de workflow gehaald en met bash uitgevoerd tegen een
   nagebootste `gh` (FIXTURE-toestand, geen echte API, geen tokens). Elke casus controleert
   exitcode, melding en of er wel/niet een release is aangemaakt. Vereist bash, base64, jq. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const WORKFLOW = '.github/workflows/release.yml';
const yml = fs.readFileSync(WORKFLOW, 'utf8');

// --- Statische eisen aan de workflow ---------------------------------------------------------
assert.match(yml, /workflow_run:\s*\n\s*workflows: \["HACS-validatie"\]\s*\n\s*types: \[completed\]\s*\n\s*branches: \[main\]/, 'trigger: workflow_run HACS-validatie/completed/main');
assert.match(yml, /\npermissions:\s*\n\s*contents: write\s*\n\s*actions: read\s*\n(?!\s+\w+:)/, 'permissions: alleen contents: write en actions: read');
for (const cond of ["github.repository == 'eelbrethouwer-jpg/bbq_planner_card'", "github.event.workflow_run.event == 'push'", "github.event.workflow_run.head_branch == 'main'", "github.event.workflow_run.conclusion == 'success'"])
  assert.ok(yml.includes(cond), 'job-voorwaarde ontbreekt: ' + cond);
assert.ok(!/secrets\./.test(yml), 'geen secrets behalve github.token');
assert.ok(!/actions\/checkout/.test(yml), 'geen checkout: bestanden via de API op de exacte SHA');
assert.ok(!/pull_request_target|workflow_dispatch/.test(yml), 'geen andere triggers');

// --- Run-script uit de workflow halen ----------------------------------------------------------
const lines = yml.split('\n');
const runIdx = lines.findIndex(l => /^\s+run: \|\s*$/.test(l));
assert.ok(runIdx > 0, 'run: | blok niet gevonden');
assert.equal(lines.filter(l => /^\s+run: /.test(l)).length, 1, 'precies één run-stap verwacht');
const runIndent = lines[runIdx].match(/^\s*/)[0].length;
const body = [];
for (const l of lines.slice(runIdx + 1)) {
  if (l.trim() && l.match(/^\s*/)[0].length <= runIndent) break;
  body.push(l);
}
const bodyIndent = Math.min(...body.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length));
const script = body.map(l => l.slice(bodyIndent)).join('\n') + '\n';
assert.match(script, /^set -euo pipefail/, 'script begint met set -euo pipefail');

// --- Nagebootste gh ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bbq-release-test-'));
const fakeDir = path.join(tmp, 'bin');
fs.mkdirSync(fakeDir);
const scriptFile = path.join(tmp, 'run.sh');
fs.writeFileSync(scriptFile, script);
fs.writeFileSync(path.join(fakeDir, 'gh'), `#!/usr/bin/env node
const fs=require('fs'),{spawnSync}=require('child_process');
const file=process.env.FAKE_GH_STATE, s=JSON.parse(fs.readFileSync(file,'utf8'));
const args=process.argv.slice(2); s.calls.push(args); const save=()=>fs.writeFileSync(file,JSON.stringify(s));
const out=(data,jq)=>{ save(); const json=JSON.stringify(data);
  if(!jq){ process.stdout.write(json+'\\n'); process.exit(0); }
  const r=spawnSync('jq',['-r',jq],{input:json,encoding:'utf8'}); process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status); };
const notFound=()=>{ save(); process.stderr.write('gh: Not Found (HTTP 404)\\n'); process.exit(1); };
const flag=n=>{ const i=args.indexOf(n); return i>=0?args[i+1]:undefined; };
const R='repos/'+s.repo+'/';
if(args[0]==='api'){
  const rest=args.slice(1).filter((a,i,arr)=>a!=='--paginate'&&a!=='--jq'&&arr[i-1]!=='--jq');
  const p=rest[0], jq=flag('--jq');
  if(!p.startsWith(R)) notFound();
  const q=p.slice(R.length);
  let m;
  if(q==='branches/main') out({commit:{sha:s.main}},jq);
  if((m=q.match(/^contents\\/([^?]+)\\?ref=(\\w+)$/))){
    if(m[2]!==s.target||!(m[1] in s.files)) notFound();
    const b64=Buffer.from(s.files[m[1]]).toString('base64').replace(/.{60}/g,'$&\\n');
    out({name:m[1].split('/').pop(),content:b64,encoding:'base64'},jq);
  }
  if((m=q.match(/^git\\/ref\\/tags\\/(.+)$/))){ if(!(m[1] in s.tags)) notFound(); out({ref:'refs/tags/'+m[1],object:{type:'commit',sha:s.tags[m[1]]}},jq); }
  if(q==='releases?per_page=100'){ if(s.failReleases){ save(); process.stderr.write('gh: Server Error (HTTP 500)\\n'); process.exit(1);} out(s.releases,jq); }
  if(q==='actions/runs/'+s.runId) out(s.run,jq);
  if(q==='actions/runs/'+s.runId+'/jobs?per_page=100') out({jobs:s.jobs},jq);
  notFound();
}
if(args[0]==='release'&&args[1]==='view'){ const r=s.releases.find(x=>x.tag_name===args[2]); save(); if(!r){process.stderr.write('release not found\\n');process.exit(1);} process.stdout.write(JSON.stringify(r)+'\\n'); process.exit(0); }
if(args[0]==='release'&&args[1]==='create'){
  const tag=args[2], target=flag('--target');
  s.created.push({tag,target,title:flag('--title'),notes:fs.readFileSync(flag('--notes-file'),'utf8'),latest:args.includes('--latest')});
  s.tags[tag]=s.moveCreatedTagTo||target; s.releases.unshift({tag_name:tag,name:flag('--title'),draft:false,prerelease:false});
  save(); process.exit(0);
}
save(); process.stderr.write('fake gh: onbekend commando '+args.join(' ')+'\\n'); process.exit(2);
`, {mode: 0o755});

// --- Fixtures (duidelijk gemarkeerd, geen echte releasegegevens) ------------------------------
const SHA = 'f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1';
const OTHER = 'a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0';
const sw = v => `/* FIXTURE v${v} */\nconst CACHE='bbq-regisseur-v${v}';\nconst PAGES=[];\n`;
const notes = (v, approval = 'Publicatie: goedgekeurd door de eigenaar op 2026-11-17') =>
  `# BBQ Planner v${v} — FIXTURE-titel\n\n**Status: FIXTURE.**\n\n${approval}\n\n## Wat verandert er?\n- FIXTURE-regel\n`;
const REQUIRED = ['validate-hacs', 'html-javascript', 'ui-smoke', 'mobile-browser', 'version-consistency'];
const base = (v = '5.10.0', over = {}) => ({
  repo: 'eelbrethouwer-jpg/bbq_planner_card', main: SHA, target: SHA, runId: '4242',
  files: {'sw.js': sw(v), [`RELEASE_v${v}.md`]: notes(v)},
  run: {conclusion: 'success', head_sha: SHA},
  jobs: REQUIRED.map(name => ({name, conclusion: 'success'})),
  releases: [{tag_name: 'v5.9.0', draft: false, prerelease: false}, {tag_name: 'v5.0.3.0', draft: false, prerelease: false}, {tag_name: 'V4.9.1', draft: false, prerelease: false}, {tag_name: 'v9.0.0', draft: true, prerelease: false}, {tag_name: 'v8.0.0', draft: false, prerelease: true}],
  tags: {'v5.9.0': OTHER},
  calls: [], created: [], ...over
});

function run(state) {
  const stateFile = path.join(tmp, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', scriptFile], {
    encoding: 'utf8',
    env: {...process.env, PATH: fakeDir + path.delimiter + process.env.PATH, FAKE_GH_STATE: stateFile, GH_TOKEN: 'fixture-geen-token', GH_REPO: state.repo, TARGET: state.target, RUN_ID: state.runId}
  });
  return {status: r.status, out: r.stdout + r.stderr, state: JSON.parse(fs.readFileSync(stateFile, 'utf8'))};
}
const results = [];
function scenario(name, state, expect) {
  const r = run(state);
  try {
    assert.equal(r.status, expect.status, 'exitcode');
    if (expect.text) assert.ok(r.out.includes(expect.text), 'melding "' + expect.text + '" ontbreekt');
    assert.equal(r.state.created.length, expect.created ? 1 : 0, 'aantal aangemaakte releases');
    expect.check?.(r);
  } catch (e) {
    console.error('--- uitvoer ' + name + ' ---\n' + r.out);
    throw new Error(name + ': ' + e.message);
  }
  results.push(name);
}

// 1. Goedgekeurd, alles groen, 5.10.0 > 5.9.0 (numeriek, niet als tekst) → publiceren.
scenario('publiceert goedgekeurde nieuwe versie', base(), {status: 0, created: true, text: 'Gepubliceerd: v5.10.0', check: r => {
  const c = r.state.created[0];
  assert.equal(c.tag, 'v5.10.0'); assert.equal(c.target, SHA); assert.equal(c.latest, true);
  assert.equal(c.title, 'BBQ Planner v5.10.0 — FIXTURE-titel');
  assert.ok(c.notes.startsWith('**Status: FIXTURE.**'), 'notes zonder eerste kop en zonder lege beginregels');
  assert.ok(!/^# /m.test(c.notes), 'eerste kop niet in de notes');
  assert.ok(c.notes.includes('## Wat verandert er?'));
}});
// 2. Geen goedkeuringsregel → geen fout, geen release.
scenario('geen goedkeuringsregel', base('5.10.0', {files: {'sw.js': sw('5.10.0'), 'RELEASE_v5.10.0.md': notes('5.10.0', 'Publicatie: nog niet goedgekeurd')}}), {status: 0, created: false, text: 'geen publicatie: release niet goedgekeurd'});
// 3. Ongeldige varianten van de regel tellen niet als goedkeuring.
for (const bad of ['Publicatie: goedgekeurd door de eigenaar op 17-11-2026', '  Publicatie: goedgekeurd door de eigenaar op 2026-11-17', '- Publicatie: goedgekeurd door de eigenaar op 2026-11-17', 'Publicatie: goedgekeurd door de eigenaar op 2026-13-45', 'Publicatie: goedgekeurd door de eigenaar op 2026-11-17 (na review)', 'publicatie: goedgekeurd door de eigenaar op 2026-11-17', 'Publicatie: goedgekeurd door de eigenaar op '])
  scenario('ongeldige goedkeuring: ' + bad.trim(), base('5.10.0', {files: {'sw.js': sw('5.10.0'), 'RELEASE_v5.10.0.md': notes('5.10.0', bad)}}), {status: 0, created: false, text: 'release niet goedgekeurd'});
// 4. CRLF-regeleinden en een tweede kop verderop blijven werken.
scenario('CRLF-bestand', base('5.10.0', {files: {'sw.js': sw('5.10.0'), 'RELEASE_v5.10.0.md': notes('5.10.0').replace(/\n/g, '\r\n') + '# Tweede kop\r\n'}}), {status: 0, created: true, check: r => {
  assert.equal(r.state.created[0].title, 'BBQ Planner v5.10.0 — FIXTURE-titel');
  assert.ok(r.state.created[0].notes.includes('# Tweede kop'), 'alleen de eerste kop wordt verwijderd');
}});
// 5. RELEASE-bestand ontbreekt → niet goedgekeurd.
scenario('RELEASE-bestand ontbreekt', base('5.10.0', {files: {'sw.js': sw('5.10.0')}}), {status: 0, created: false, text: 'ontbreekt'});
// 6. Main is verder gegaan → oude commit niet publiceren.
scenario('main verschoven', base('5.10.0', {main: OTHER}), {status: 0, created: false, text: 'main is verder gegaan'});
// 7. Tag bestaat al op dezelfde SHA met release → idempotent.
scenario('release bestaat al op deze SHA', base('5.10.0', {tags: {'v5.10.0': SHA}, releases: [{tag_name: 'v5.10.0', draft: false, prerelease: false}]}), {status: 0, created: false, text: 'bestaat al op'});
// 8. Latere doc-only merge met dezelfde versie (tag op andere SHA) → notice, geen fout.
scenario('doc-only merge na publicatie', base('5.10.0', {tags: {'v5.10.0': OTHER}, releases: [{tag_name: 'v5.10.0', draft: false, prerelease: false}]}), {status: 0, created: false, text: 'is al gepubliceerd op ' + OTHER});
// 9. Tag zonder release → fout.
scenario('tag zonder release', base('5.10.0', {tags: {'v5.10.0': SHA}, releases: []}), {status: 1, created: false, text: 'bestaat zonder release'});
scenario('tag op andere SHA zonder release', base('5.10.0', {tags: {'v5.10.0': OTHER}, releases: []}), {status: 1, created: false, text: 'bestaat zonder release'});
// 10. Release zonder tag → fout.
scenario('release zonder tag', base('5.10.0', {tags: {}, releases: [{tag_name: 'v5.10.0', draft: false, prerelease: false}]}), {status: 1, created: false, text: 'zonder bijbehorende tag'});
// 11. Downgrade of gelijk aan nieuwste → fout.
scenario('downgrade', base('5.8.9'), {status: 1, created: false, text: 'niet hoger dan de nieuwste gepubliceerde release v5.9.0'});
scenario('gelijk zonder tag', base('5.9.0', {tags: {}}), {status: 1, created: false, text: 'zonder bijbehorende tag'});
// 12. Ophalen van releases mislukt → fout, geen publicatie met 0.0.0.
scenario('releases-API faalt', base('5.10.0', {failReleases: true}), {status: 1, created: false});
// 13. Een verplichte job niet groen of afwezig → fout.
scenario('job mislukt', base('5.10.0', {jobs: REQUIRED.map(name => ({name, conclusion: name === 'mobile-browser' ? 'failure' : 'success'}))}), {status: 1, created: false, text: 'mobile-browser ontbreekt of is niet groen'});
scenario('job ontbreekt', base('5.10.0', {jobs: REQUIRED.filter(n => n !== 'ui-smoke').map(name => ({name, conclusion: 'success'}))}), {status: 1, created: false, text: 'ui-smoke'});
scenario('run op andere SHA', base('5.10.0', {run: {conclusion: 'success', head_sha: OTHER}}), {status: 1, created: false, text: 'niet groen op'});
// 14. Versie in sw.js onduidelijk → fout.
scenario('twee CACHE-regels', base('5.10.0', {files: {'sw.js': sw('5.10.0') + "const CACHE='bbq-regisseur-v5.11.0';\n", 'RELEASE_v5.10.0.md': notes('5.10.0')}}), {status: 1, created: false, text: 'precies één'});
scenario('geen CACHE-regel', base('5.10.0', {files: {'sw.js': '/* leeg */\n', 'RELEASE_v5.10.0.md': notes('5.10.0')}}), {status: 1, created: false, text: 'precies één'});
// 15. Titel noemt de versie niet → fout.
scenario('titel zonder versie', base('5.10.0', {files: {'sw.js': sw('5.10.0'), 'RELEASE_v5.10.0.md': notes('5.10.0').replace('v5.10.0 — ', '')}}), {status: 1, created: false, text: 'noemt v5.10.0 niet'});
// 16. Tag komt na aanmaken op een andere SHA terecht → fout.
scenario('tag na aanmaken verkeerd', base('5.10.0', {moveCreatedTagTo: OTHER}), {status: 1, created: true, text: 'verwacht ' + SHA});
// 17. Bestanden worden alleen op de exacte SHA gelezen.
scenario('leest op exacte SHA', base(), {status: 0, created: true, check: r => {
  const reads = r.state.calls.filter(a => a[0] === 'api' && a.some(x => x.includes('/contents/')));
  assert.ok(reads.length >= 2 && reads.every(a => a.some(x => x.endsWith('?ref=' + SHA))), 'contents altijd met ?ref=TARGET');
}});

// 18. Echte repo-bestanden: versie zoals version-consistency, titel en goedkeuringsstatus.
const realSw = fs.readFileSync('sw.js', 'utf8');
const VERSION = [...realSw.matchAll(/\bconst\s+CACHE\s*=\s*['"]bbq-regisseur-v(\d+\.\d+\.\d+)['"]/g)].map(m => m[1]);
assert.equal(VERSION.length, 1);
const realRelease = fs.readFileSync(`RELEASE_v${VERSION[0]}.md`, 'utf8');
const approved = /^Publicatie: goedgekeurd door de eigenaar op \d{4}-\d{2}-\d{2}[ \t]*$/m.test(realRelease);
scenario(`echte sw.js en RELEASE_v${VERSION[0]}.md`, base(VERSION[0], {
  files: {'sw.js': realSw, [`RELEASE_v${VERSION[0]}.md`]: realRelease},
  releases: [{tag_name: 'v0.0.1', draft: false, prerelease: false}], tags: {}
}), approved ? {status: 0, created: true, check: r => {
  assert.equal(r.state.created[0].tag, 'v' + VERSION[0]);
  console.log('   echte releasetitel: ' + r.state.created[0].title);
}} : {status: 0, created: false, text: 'release niet goedgekeurd'});

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`OK release-workflow: ${results.length} casussen geslaagd (echte v${VERSION[0]}: ${approved ? 'goedgekeurd → zou publiceren' : 'niet goedgekeurd → geen publicatie'})`);
