/* BBQ Planner v5.0.0 — offline shell for GitHub Pages ONLY.
   Do not cache Home Assistant traffic, private sensor payloads or external recipe images. */
const CACHE='bbq-regisseur-v5.0.0';
const ROOT=self.registration.scope;
const PATH=new URL(ROOT).pathname;
const PAGES=['','index.html','dist/BBQ_bereidingsplanner_MEATER_v4.html','dist/bbq-v5.js','dist/bbq-v5.css'];
const ASSETS=['manifest.webmanifest','assets/app-icon.svg','assets/apple-touch-icon.png','assets/icon-512.png'];
const SHELL=[...PAGES,...ASSETS].map(x=>new URL(x,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(key=>key.startsWith('bbq-regisseur-')&&key!==CACHE).map(key=>caches.delete(key))
 )).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
 if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(PATH))return;
 const canonical=url.origin+url.pathname;
 if(!SHELL.includes(canonical))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){
   const clone=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(canonical,clone)));
  }
  return response;
 }).catch(async()=>{
  const cache=await caches.open(CACHE);
  return (await cache.match(canonical))||(req.mode==='navigate'?await cache.match(new URL('dist/BBQ_bereidingsplanner_MEATER_v4.html',ROOT).href):Response.error());
 }));
});
