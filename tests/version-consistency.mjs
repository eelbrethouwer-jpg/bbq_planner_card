/* Runtime version consistency + in-memory mutation regressions.
   This test does not write to app files or need third-party dependencies. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeFiles=[
  'sw.js',
  'index.html',
  'dist/BBQ_bereidingsplanner_MEATER_v4.html',
  'dist/bbq_planner_card.js'
];
const source=Object.fromEntries(runtimeFiles.map(path=>[path,fs.readFileSync(path,'utf8')]));
const checks={
  'AGENTS.md':fs.readFileSync('AGENTS.md','utf8'),
  'CLAUDE.md':fs.readFileSync('CLAUDE.md','utf8')
};

function verify(files,exists=fs.existsSync){
  const sw=files['sw.js'],index=files['index.html'],html=files['dist/BBQ_bereidingsplanner_MEATER_v4.html'],card=files['dist/bbq_planner_card.js'];
  const cache=[...sw.matchAll(/\bconst\s+CACHE\s*=\s*['"]bbq-regisseur-v(\d+\.\d+\.\d+)['"]/g)];
  assert.equal(cache.length,1,'sw.js must define exactly one valid versioned CACHE');
  const VERSION=cache[0][1];

  const checkHeader=(file,content)=>{
    const block=content.match(/^\s*\/\*[\s\S]*?\*\//)?.[0];
    assert.ok(block,file+' must start with a versioned comment');
    const versions=[...block.matchAll(/\bv(\d+\.\d+\.\d+)\b/g)].map(m=>m[1]);
    assert.deepEqual(versions,[VERSION],file+' header version differs from CACHE');
  };
  checkHeader('sw.js',sw);
  checkHeader('dist/bbq_planner_card.js',card);

  const checkQueries=(file,content)=>{
    const refs=[...content.matchAll(/\?v=([^\s"'<>\x60&#?]+)/g)].map(m=>m[1]);
    assert.ok(refs.length>0,file+' must contain cache-busting query parameters');
    for(const value of refs){
      assert.equal(value,VERSION,file+': ?v='+value+' differs from CACHE v'+VERSION);
    }
    return refs.length;
  };
  const indexRefs=checkQueries('index.html',index);
  const htmlRefs=checkQueries('dist/BBQ_bereidingsplanner_MEATER_v4.html',html);
  const cardRefs=checkQueries('dist/bbq_planner_card.js',card);

  const checkTitle=(file,content,required)=>{
    const titles=[...content.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
    assert.equal(titles.length,1,file+' must contain exactly one title');
    const matches=[...titles[0][1].matchAll(/\bv(\d+\.\d+\.\d+)\b/g)].map(m=>m[1]);
    if(required)assert.equal(matches.length,1,file+' title must have exactly one version');
    for(const value of matches)assert.equal(value,VERSION,file+' title version differs from CACHE');
  };
  checkTitle('index.html',index,false); // Landing page title contains no version at present.
  checkTitle('dist/BBQ_bereidingsplanner_MEATER_v4.html',html,true);

  const loaderAttrs=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](\.\/bbq-[^"']+\.(?:js|css)(?:\?v=[^"']*)?)["'][^>]*>/gi)];
  assert.ok(loaderAttrs.length>0,'Planner must contain versioned CSS/JS loader tags');
  for(const tag of loaderAttrs){
    assert.ok(tag[1].includes('?v='+VERSION),'Unversioned or mismatched loader: '+tag[1]);
  }

  assert.ok(exists('RELEASE_v'+VERSION+'.md'),'Missing RELEASE_v'+VERSION+'.md');
  for(const [file,content] of Object.entries(checks)){
    assert.ok(content.includes('](PROJECT_STATUS.md)'),file+' must link PROJECT_STATUS.md');
    assert.ok(content.includes('](docs/AI_WORKFLOW.md)'),file+' must link docs/AI_WORKFLOW.md');
  }
  return {VERSION,indexRefs,htmlRefs,cardRefs,loaders:loaderAttrs.length};
}

const result=verify(source);
const wrongVersion=(label,mutate,expectPath)=>{
  const broken=mutate({...source});
  assert.throws(()=>verify(broken),e=>e instanceof assert.AssertionError&&e.message.includes(expectPath),label+' must fail');
};
const alternate=(candidate)=>candidate===result.VERSION?'9.9.9':candidate;

// Negative 1: simulated index.html redirect regression (currently 5.1.0).
wrongVersion('index.html 5.1.0',files=>{
 files['index.html']=files['index.html'].replace(/\?v=\d+\.\d+\.\d+/, '?v='+alternate('5.1.0'));
 return files;
},'index.html');

// Negative 2: simulated CSS/JS loader regression (currently ?v=5.0.3).
wrongVersion('loader ?v=5.0.3',files=>{
 const file='dist/BBQ_bereidingsplanner_MEATER_v4.html';
 assert.match(files[file],/\.\/bbq-v5\.js\?v=\d+\.\d+\.\d+/,'Expected script loader');
 files[file]=files[file].replace(/(\.\/bbq-v5\.js\?v=)\d+\.\d+\.\d+/,(_,prefix)=>prefix+alternate('5.0.3'));
 return files;
},'dist/BBQ_bereidingsplanner_MEATER_v4.html');

// Positive: a hypothetical *consistent* new runtime version, including the release file.
const parts=result.VERSION.split('.').map(Number);
const future=[parts[0],parts[1],parts[2]+1].join('.');
assert.notEqual(future,result.VERSION);
const consistent=Object.fromEntries(Object.entries(source).map(([file,content])=>[file,content.replaceAll(result.VERSION,future)]));
const hypothetical=verify(consistent,path=>path==='RELEASE_v'+future+'.md'||fs.existsSync(path));
assert.equal(hypothetical.VERSION,future,'Consistent future version must pass without hard-coded expected versions');

console.log('OK version consistency: CACHE-derived runtime v'+result.VERSION+
  '; index '+result.indexRefs+', planner '+result.htmlRefs+', HA '+result.cardRefs+
  ', asset loaders '+result.loaders);
console.log('OK negative mutations: index.html 5.1.0 rejected; loader ?v=5.0.3 rejected');
console.log('OK positive mutation: consistent future version '+future+' accepted');
