const CACHE="toolloot-shell-v1";
self.addEventListener("install",event=>{self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim())});
self.addEventListener("fetch",event=>{
 const u=new URL(event.request.url);
 if(u.origin===self.location.origin && (u.pathname.endsWith("/")||u.pathname.endsWith(".js")||u.pathname.endsWith(".css")||u.pathname.endsWith(".html"))){
  event.respondWith(caches.open(CACHE).then(async c=>{
   try{const r=await fetch(event.request);c.put(event.request,r.clone());return r}catch{return (await c.match(event.request))||fetch(event.request)}
  }));
 }
});
