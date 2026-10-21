/* BBQ Regisseur v4.6.0 — only the public GitHub Pages origin gets an offline shell.
   Never cache live sensor messages, credentials or HA user storage. */
const CACHE='bbq-regisseur-v4.6.0';
const ROOT=self.registration.scope;
const SHELL=['','index.html','dist/BBQ_bereidingsplanner_MEATER_v4.html','manifest.webmanifest','assets/app-icon.svg'].map(x=>new URL(x,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bbq-regisseur-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(ROOT).pathname))return;
 if(req.mode==='navigate'||SHELL.includes(url.origin+url.pathname)){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
   return response;
  }).catch(async()=>{
   const cache=await caches.open(CACHE);
   return await cache.match(req,{ignoreSearch:true})||await cache.match(new URL('dist/BBQ_bereidingsplanner_MEATER_v4.html',ROOT).href);
  }));
 }
});