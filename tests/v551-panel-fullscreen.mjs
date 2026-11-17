/* v5.5.1 full-screen card in a Home Assistant panel view (Playwright, Chromium + WebKit, 390x844 and 320x568).
   FIXTURES ONLY: a simulated Home Assistant page (fixed 56 px header, view container, a hui-panel-view custom element
   with a shadow root and a hui-card wrapper) around the REAL dist/bbq_planner_card.js with an empty fake hass.
   This is not a real Home Assistant app, iPhone or safe-area test (desktop engines report safe-area insets of 0).
   Checks: iframe bottom equals the viewport bottom (+-2 px), no document scroll, the planner's bottom navigation is
   visible and tappable, the height follows a viewport resize, and the old behaviour without panel view or with
   fullscreen: false. Optional: SCREENSHOTS_DIR=<dir> writes 390 px screenshots (Chromium).
   Optional: CHROMIUM_PATH=<path> uses a local Chrome instead of the Playwright download. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
// mode: panel (auto), panel-off (fullscreen:false), panel-pad (view padding below the card), masonry (no panel), plain-on (fullscreen:true)
const host=mode=>`<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>html,body{margin:0;background:#111;font-family:sans-serif}</style></head><body><ha-fake-root></ha-fake-root>
<script type="module">
import '/dist/bbq_planner_card.js';
const MODE=${JSON.stringify(mode)};
const hass=()=>({states:{},connected:true,callService:async()=>{},
  connection:{sendMessagePromise:async()=>({value:null}),subscribeMessage:async()=>()=>{}}});
const card=document.createElement('bbq-planner-meater-card');
card.setConfig(MODE==='panel-off'?{fullscreen:false}:MODE==='plain-on'?{fullscreen:true}:{});
card.hass=hass();
const wrapper=document.createElement('hui-card');wrapper.append(card);
class FakeView extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block}</style>';}}
customElements.define('hui-panel-view',class extends FakeView{});
customElements.define('hui-masonry-view',class extends FakeView{});
customElements.define('ha-fake-root',class extends HTMLElement{constructor(){super();
  const s=this.attachShadow({mode:'open'});
  s.innerHTML='<style>header{position:fixed;top:0;left:0;right:0;height:56px;background:#03a9f4;color:#fff;z-index:4;display:flex;align-items:center;padding:0 12px;box-sizing:border-box}'+
    '#view{padding-top:56px;'+(MODE==='panel-pad'?'padding-bottom:8px;':'')+(MODE==='masonry'?'padding:64px 8px 8px;':'')+'}</style>'+
    '<header>BBQ (nagebootste HA-kopbalk 56 px)</header><div id="view"></div>';
  if(MODE==='plain-on'){s.getElementById('view').append(wrapper);return;}
  const view=document.createElement(MODE==='masonry'?'hui-masonry-view':'hui-panel-view');
  s.getElementById('view').append(view);view.shadowRoot.append(wrapper);
}});
window.__frame=()=>card.querySelector('iframe');
</script></body></html>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname==='/__ha-host'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(host(url.searchParams.get('mode')||'panel'));return;}
  const pathname=decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,mode,viewport){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:'nl-NL',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  await page.goto(origin+'/__ha-host?mode='+mode,{waitUntil:'load'});
  let f=null;
  for(let i=0;i<80;i++){
    f=page.frames().find(x=>x.url().includes('BBQ_bereidingsplanner'));
    if(f&&await f.locator('#v5-nav button').count().catch(()=>0))break;
    await page.waitForTimeout(100);
  }
  ok(f&&await f.locator('#v5-nav button').count(),mode+': planner with bottom navigation loaded in the card iframe');
  await page.waitForTimeout(400);
  return {context,page,f,errors};
}
// Geometry in page coordinates, measured from outside (host) and inside (planner).
async function geometry(s){
  const outer=await s.page.evaluate(()=>{
    const r=window.__frame().getBoundingClientRect(),se=document.scrollingElement||document.documentElement;
    const before=se.scrollTop;window.scrollTo(0,10000);const after=se.scrollTop;window.scrollTo(0,before);
    return {top:r.top,bottom:r.bottom,height:r.height,inner:window.innerHeight,docScroll:se.scrollHeight-se.clientHeight,scrolledTo:after,
      style:window.__frame().style.cssText};
  });
  const nav=await s.f.evaluate(()=>{
    const n=document.getElementById('v5-nav'),r=n.getBoundingClientRect(),b=n.querySelector('button'),br=b.getBoundingClientRect();
    const hit=document.elementFromPoint(br.left+br.width/2,br.top+br.height/2);
    return {top:r.top,bottom:r.bottom,height:r.height,hit:!!hit&&n.contains(hit),inner:window.innerHeight,
      scrollable:(document.scrollingElement.scrollHeight>document.scrollingElement.clientHeight)};
  });
  return {...outer,nav};
}
async function expectFull(s,label){
  const g=await geometry(s);
  ok(Math.abs(g.bottom-g.inner)<=2,label+': iframe bottom '+g.bottom.toFixed(1)+' equals viewport bottom '+g.inner+' (+-2 px)');
  ok(Math.abs(g.top-56)<=2,label+': iframe starts under the 56 px HA header (top '+g.top.toFixed(1)+')');
  ok(g.docScroll<=0&&g.scrolledTo===0,label+': no document scroll in the HA page (overflow '+g.docScroll+', scrollTo -> '+g.scrolledTo+')');
  ok(g.nav.height>40&&g.nav.top>=0&&g.nav.bottom<=g.nav.inner+1,label+': planner bottom navigation fully inside the iframe');
  ok(g.top+g.nav.bottom<=g.inner+2&&g.top+g.nav.top>=56,label+': planner bottom navigation inside the visible screen');
  ok(g.nav.hit,label+': planner bottom navigation is on top at its own position (tappable)');
  return g;
}

const engines=[['Chromium',chromium,process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}],['WebKit',webkit,{}]];
const only=(process.env.ENGINES||'').toLowerCase();
for(const [name,type,launch] of engines){
  if(only&&!only.includes(name.toLowerCase()))continue;
  const browser=await type.launch(launch);
  try{
    for(const vp of [{width:390,height:844},{width:320,height:568}]){
      const label=name+' '+vp.width+'x'+vp.height;
      // 1. Panel view, automatic detection.
      let s=await open(browser,'panel',vp);
      await expectFull(s,label+' panel');
      // Navigate inside the planner: the page still does not scroll and the iframe keeps the screen.
      await s.f.locator('#v5-nav button').nth(1).click();await s.page.waitForTimeout(400);
      await expectFull(s,label+' panel after tapping Recepten');
      if(process.env.SCREENSHOTS_DIR&&name==='Chromium'&&vp.width===390){
        await mkdir(process.env.SCREENSHOTS_DIR,{recursive:true});
        await s.f.locator('#v5-nav button').nth(0).click();await s.page.waitForTimeout(400);
        await s.page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,'01-panel-vandaag-390.png')});
        await s.f.locator('#v5-nav button').nth(1).click();await s.page.waitForTimeout(400);
        await s.page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,'02-panel-recepten-390.png')});
        await s.f.locator('#v5-nav button').nth(2).click();await s.page.waitForTimeout(400);
        await s.page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,'03-panel-live-390.png')});
      }
      // 2. Resize (rotation / split view): the height follows.
      const other=vp.width===390?{width:390,height:700}:{width:568,height:320};
      await s.page.setViewportSize(other);await s.page.waitForTimeout(500);
      const g2=await expectFull(s,label+' panel resized to '+other.width+'x'+other.height);
      ok(Math.abs(g2.height-(other.height-56))<=2,label+': iframe height followed the resize ('+g2.height+')');
      await s.page.setViewportSize(vp);await s.page.waitForTimeout(500);
      await expectFull(s,label+' panel resized back');
      ok(!s.errors.length,label+' panel: no page errors '+s.errors.join(' | '));
      await s.context.close();

      // 3. View padding below the card: no document scroll, navigation stays visible (iframe gives up those pixels).
      s=await open(browser,'panel-pad',vp);
      let g=await geometry(s);
      ok(g.docScroll<=0&&g.scrolledTo===0,label+' panel-pad: no document scroll (overflow '+g.docScroll+')');
      ok(g.bottom<=g.inner&&g.bottom>=g.inner-10,label+' panel-pad: iframe ends just above the view padding ('+g.bottom+')');
      ok(g.nav.hit&&g.top+g.nav.bottom<=g.inner,label+' panel-pad: planner navigation visible and tappable');
      await s.context.close();

      // 4. fullscreen: true outside a panel view.
      s=await open(browser,'plain-on',vp);
      await expectFull(s,label+' fullscreen:true');
      await s.context.close();

      // 5. fullscreen: false in a panel view, and no panel view at all: previous behaviour (v4.7 viewport estimate).
      for(const mode of ['panel-off','masonry']){
        s=await open(browser,mode,vp);
        g=await geometry(s);
        ok(g.style.includes('calc(100dvh - 118px)')&&g.style.includes('max-height: 94dvh'),label+' '+mode+': previous viewport sizing kept ('+g.style+')');
        ok(!s.errors.length,label+' '+mode+': no page errors');
        await s.context.close();
      }
    }
  }finally{await browser.close();}
  console.log('PASS '+name+' v5.5.1 panel-view full screen');
}
server.close();
console.log('OK v5.5.1 panel full screen: '+checks+' checks (FIXTURE HA host; no real HA app, iPhone or safe area)');
