/* v5.12.1 paneel in beeld in een HOGE kaart-iframe (Playwright, Chromium + WebKit; 390 px en 320 px).
   FIXTURES ONLY: een nagebootste Home Assistant-pagina (kopregel, de echte dist/bbq_planner_card.js met een lege nagebootste hass) met de echte
   planner in het kaart-iframe. Geen echte Home Assistant, iPhone of MEATER. Dialogen zijn GEBLOKKEERD (confirm = false, alert/prompt niets).
   Probleem (review PR #56): .v512-overlay is position:fixed en het paneel staat gecentreerd in de iframe-viewport. Is de kaart-iframe veel hoger
   dan het scherm (automatische hoogte, 'bbq-child-height-v1'), dan stond het paneel midden in het hoge iframe en buiten beeld.
   Controle: iframe geforceerd op 3000 px hoog, pagina op scrollY=0, 'Voorbeeld herstellen' (Meer) openen en dan moet het paneel (iframe-offset +
   getBoundingClientRect) volledig binnen het zichtbare bovenste scherm vallen (0..innerHeight). Drie standen: hoog iframe vanaf boven, hoog iframe
   met de pagina onderaan, en het gewone (schermhoge) iframe. Plus 320 px zonder horizontale overflow en annuleren = opslag ongewijzigd.
   Optioneel: SCREENSHOTS_DIR=<map> schrijft screenshots (Chromium). Optioneel: CHROMIUM_PATH=<pad>. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const root=process.cwd();
const HOST=tall=>`<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;background:#111;font-family:sans-serif}.hdr{height:56px;background:#03a9f4;color:#fff;display:flex;align-items:center;padding:0 12px;box-sizing:border-box}
${tall?'bbq-planner-meater-card iframe{height:3000px!important;min-height:3000px!important;max-height:none!important}':''}</style></head><body>
<div class="hdr">BBQ (nagebootste HA-kopbalk)</div>
<script type="module">
import '/dist/bbq_planner_card.js';
const hass=()=>({states:{},connected:true,callService:async()=>{},connection:{sendMessagePromise:async()=>({value:null}),subscribeMessage:async()=>()=>{}}});
const card=document.createElement('bbq-planner-meater-card');card.setConfig({fullscreen:false});card.hass=hass();document.body.append(card);
window.__iframe=()=>card.querySelector('iframe');
</script></body></html>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname==='/__ha-host'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(HOST(url.searchParams.get('tall')==='1'));return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const launchOpts=process.env.CHROMIUM_PATH?{headless:true,executablePath:process.env.CHROMIUM_PATH}:{headless:true};
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};

async function open(browser,{width,height=844,tall}){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,timezoneId:'Europe/Amsterdam',locale:'nl-NL',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__dialogCalls=[];window.confirm=(...a)=>{window.__dialogCalls.push('confirm');return false};window.alert=()=>{window.__dialogCalls.push('alert')};window.prompt=()=>{window.__dialogCalls.push('prompt');return null};});
  const page=await context.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.goto(origin+'/__ha-host?tall='+(tall?1:0),{waitUntil:'load'});
  let f=null;
  for(let i=0;i<100;i++){f=page.frames().find(x=>x.url().includes('BBQ_bereidingsplanner'));if(f&&await f.locator('#v5-nav button').count().catch(()=>0))break;await page.waitForTimeout(100);}
  ok(f&&await f.locator('#v5-nav button').count(),'planner met onderste navigatie geladen in de kaart-iframe');
  await page.waitForTimeout(500);
  return {context,page,f,errors,dialogs};
}
const topMetrics=(page)=>page.evaluate(()=>{const i=window.__iframe().getBoundingClientRect();return {iframeTop:i.top,iframeH:i.height,innerH:innerHeight,innerW:innerWidth,scrollY:Math.round(scrollY),docH:document.documentElement.scrollHeight}});
const panelInTop=async(s)=>{
  const t=await topMetrics(s.page);
  const r=await s.f.evaluate(()=>{const p=document.querySelector('.v512-panel');if(!p)return null;const b=p.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}});
  return {t,r,top:r&&t.iframeTop+r.top,bottom:r&&t.iframeTop+r.bottom};
};
// Meer -> Gegevens-blok openklappen -> "Voorbeeld herstellen" met een script-klik (geen Playwright-scroll, zodat scrollY vooraf instelbaar blijft).
const openPanel=async(s,scrollTo)=>{
  await s.f.evaluate(()=>document.querySelector('#v5-nav [data-v5-act="more"]').click());await s.page.waitForTimeout(300);
  await s.f.evaluate(()=>{let e=document.querySelector('#reset');for(;e;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;});
  await s.page.waitForTimeout(150);
  await s.page.evaluate(y=>window.scrollTo({top:y==='bottom'?document.documentElement.scrollHeight:y,left:0,behavior:'instant'}),scrollTo);
  await s.page.waitForTimeout(200);
  const before=await topMetrics(s.page);
  await s.f.evaluate(()=>document.querySelector('#reset').click());
  await s.f.waitForSelector('.v512-panel');await s.page.waitForTimeout(300);
  return before;
};

try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(engineName==='chromium'?launchOpts:{headless:true});
  const shots=process.env.SCREENSHOTS_DIR?path.join(process.env.SCREENSHOTS_DIR,engineName):null;
  try{
   for(const width of [390,320]){
    const E=engineName+' '+width;
    for(const [name,tall,scrollTo] of [['hoog iframe, pagina bovenaan',true,0],['hoog iframe, pagina onderaan',true,'bottom'],['gewoon (schermhoog) iframe',false,0]]){
     const L=E+' '+name;
     const s=await open(browser,{width,tall});
     const m0=await topMetrics(s.page);
     if(tall)ok(m0.iframeH>=2900,L+': het iframe is hoog ('+m0.iframeH+' px) en veel hoger dan het scherm ('+m0.innerH+' px)');
     else ok(m0.iframeH<m0.innerH*1.2,L+': het iframe is niet hoger dan het scherm ('+m0.iframeH+' px)');
     const before=await openPanel(s,scrollTo);
     if(scrollTo===0&&tall)ok(before.scrollY===0,L+': startpunt scrollY=0 (paneel nog dicht)');
     ok(await s.f.locator('.v512-overlay').count()===1,L+': precies een paneel open');
     const p=await panelInTop(s);
     ok(p.r!==null&&p.top>=0&&p.bottom<=p.t.innerH+0.5,L+': het paneel valt in het zichtbare scherm (boven '+Math.round(p.top)+', onder '+Math.round(p.bottom)+', scherm '+p.t.innerH+', scrollY '+p.t.scrollY+')');
     ok(p.r.left>=0&&p.r.right<=width+0.5,L+': het paneel past horizontaal ('+Math.round(p.r.left)+'..'+Math.round(p.r.right)+' van '+width+')');
     const ovf=await s.f.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
     const ovfTop=await s.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
     ok(ovf<=1&&ovfTop<=1,L+': geen horizontale overflow (iframe '+ovf+', pagina '+ovfTop+')');
     ok(await s.f.evaluate(()=>{const a=document.activeElement;return !!a&&!!a.closest('.v512-panel')}),L+': focus staat in het paneel');
     if(shots&&tall&&scrollTo===0){await mkdir(shots,{recursive:true});await s.page.screenshot({path:path.join(shots,'01-hoog-iframe-paneel-in-beeld-'+width+'.png')});}
     // Annuleren: paneel weg, niets uitgevoerd.
     await s.f.locator('.v512-overlay [data-v512="cancel"]').click({force:true,timeout:5000}).catch(async()=>{await s.f.evaluate(()=>document.querySelector('.v512-overlay [data-v512="cancel"]').click())});
     await s.page.waitForTimeout(200);
     ok(await s.f.locator('.v512-overlay').count()===0,L+': annuleren sluit het paneel');
     ok(s.errors.length===0&&s.dialogs.length===0&&await s.f.evaluate(()=>window.__dialogCalls.length)===0,L+': geen paginafouten of dialogen '+s.errors.join(' | '));
     await s.context.close();
    }
   }
   console.log('OK v5.12.1 paneel in beeld: '+engineName);
  }finally{await browser.close();}
 }
 console.log('PASS v5.12.1 paneel in beeld: '+checks+' controles (chromium, webkit; 390 en 320 px; hoog iframe; FIXTURES, geen HA/MEATER/iPhone)');
}finally{server.close();}
