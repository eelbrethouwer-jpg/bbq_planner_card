/* No dependencies: verify collaboration docs without changing the app. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const names=['AGENTS.md','CLAUDE.md','docs/AI_WORKFLOW.md','docs/PROJECT_HANDOFF.md','.github/PULL_REQUEST_TEMPLATE.md','README.md','PROJECT_STATUS.md','CHANGELOG.md','RELEASE_v5.1.0.md','RELEASE_v5.1.1.md','RELEASE_v5.1.2.md','docs/PROJECT_STATUS_ARCHIVE_2026-11-07.md'];
for(const name of names)assert.ok(fs.existsSync(name),'Missing required document: '+name);
const handoff=read('docs/PROJECT_HANDOFF.md');
const published=handoff.match(/Gepubliceerde release:\s*(v\d+\.\d+\.\d+)/)?.[1];
assert.ok(published,'Handoff must identify published version');
for(const name of ['README.md','PROJECT_STATUS.md','CHANGELOG.md']) {
 assert.ok(read(name).includes('v5.1.1')&&read(name).includes(published),name+' out of sync with handoff');
}
for(const name of ['AGENTS.md','CLAUDE.md']) {
 assert.ok(read(name).includes('docs/AI_WORKFLOW.md'),name+' must point to central workflow');
 assert.ok(read(name).includes('docs/PROJECT_HANDOFF.md'),name+' must point to handoff');
}
assert.ok(handoff.includes('v5.1.2')&&read('PROJECT_STATUS.md').includes('v5.1.2'),'Candidate missing');
assert.ok(read('docs/AI_WORKFLOW.md').includes('expliciet')&&read('.github/PULL_REQUEST_TEMPLATE.md').includes('Claude-review'),'Review contract missing');
assert.ok(read('RELEASE_v5.1.1.md').includes('Status: gepubliceerd'),'Latest release notes still say candidate');
assert.ok(read('sw.js').includes('bbq-regisseur-v5.1.1')&&read('dist/bbq_planner_card.js').includes('v5.1.1'),'Docs-only change must not bump runtime');
console.log('OK documentation contract: published '+published+', v5.1.2 docs-only candidate');
