/* Real-browser visual bounds regression for v5.0.2 (Chromium mobile simulation).
   Not a substitute for real iOS Safari/HA testing. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const fixture='<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:12px;background:#121b20"><iframe id="ha" title="HA mobile card simulation" src="/dist/BBQ_bereidingsplanner_MEATER_v4.html" style="display:block;width:100%;height:690px;border:0"></iframe></body></html>';
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  if(req.url?.startsWith('/__ha-fixture')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(fixture);return;}
  const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,origin='http://127.0.0.1:'+port;
try{
 for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  let browser;
  try{
   browser=await engine.launch({headless:true});
 for(const width of [320,360,375,393,430,768]){
  for(const embedded of [false,true]){
   const context=await browser.newContext({viewport:{width,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2});
   const page=await context.newPage();
   await page.goto(origin+(embedded?'/__ha-fixture':'/dist/BBQ_bereidingsplanner_MEATER_v4.html'),{waitUntil:'domcontentloaded'});
   const app=embedded?page.frameLocator('#ha'):page;
   await app.locator('#v5-root').waitFor();
   await app.locator('#v5-root [data-v5-act="resume"]').click();
   await app.locator('.v5-serve-card .v5-input-frame').first().waitFor();
   const measure=await app.locator('#v5-root').evaluate(root=>{
     const card=root.querySelector('.v5-serve-card');
     const items=[...card.querySelectorAll('.v5-serve-fields>.v5-field')];
     const rect=r=>({left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom});
     const viewport=document.documentElement.clientWidth;
     return {
       viewport,scrollWidth:document.documentElement.scrollWidth,
       card:rect(card.getBoundingClientRect()),
       items:items.map(el=>{
         const frame=el.querySelector('.v5-input-frame'),input=el.querySelector('input');
         return {field:rect(el.getBoundingClientRect()),frame:rect(frame.getBoundingClientRect()),input:rect(input.getBoundingClientRect()),type:input.type};
       })
     };
   });
   const name=engineName+' '+(embedded?'HA iframe ':'PWA ')+width+'px';
   assert.equal(measure.items.length,4,name+': all serve form inputs');
   assert.deepEqual(measure.items.map(x=>x.type),['date','time','time','number'],name+': preserve native pickers');
   assert.ok(measure.scrollWidth<=measure.viewport+2,name+': no horizontal body overflow '+JSON.stringify(measure));
   for(const input of measure.items){
     assert.ok(input.frame.width>100,name+': useful input width');
     assert.ok(input.frame.left>=measure.card.left-1,name+': no overflow on left '+JSON.stringify(input));
     assert.ok(input.frame.right<=measure.card.right+1,name+': no overflow on right '+JSON.stringify(input));
     assert.ok(input.input.right<=input.frame.right+1,name+': native picker fits its visible frame '+JSON.stringify(input));
   }
   const dateInput=app.locator('[data-v5-setting="date"]');
   await dateInput.fill('2026-11-24');
   assert.equal(await dateInput.inputValue(),'2026-11-24',name+': native date input is editable');
   const timeInput=app.locator('[data-v5-setting="mealTime"]');
   await timeInput.fill('18:30');
   assert.equal(await timeInput.inputValue(),'18:30',name+': native time input is editable');
   console.log('OK mobile bounds:',name);
   await context.close();
  }
 }
  } finally {if(browser)await browser.close();}
 }
} finally {
 await new Promise(resolve=>server.close(resolve));
}
