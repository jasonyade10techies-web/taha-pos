const CACHE = "taha-companion-v2";
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/", "/companion-icon-192.png"]))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("taha-companion-") && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) return;
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/").then(response => response || Response.error())));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(caches.open(CACHE).then(async cache => { const saved = await cache.match(event.request); if (saved) return saved; const response = await fetch(event.request); if (response.ok) await cache.put(event.request, response.clone()); return response; }));
});
self.addEventListener("push", event => {
  let data = {}; try { data = event.data?.json() || {}; } catch { /* Ignore malformed push data. */ }
  const path = typeof data.url === "string" && data.url.startsWith("/mobile-camera") ? data.url : "/mobile-camera";
  event.waitUntil(self.registration.showNotification("TAHA MOBILES", { body: "A photo has been requested by your paired counter.", icon: "/companion-icon-192.png", tag: data.requestId || "camera-request", data: { path } }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const url = new URL(event.notification.data?.path || "/mobile-camera", self.location.origin).href;
    const existing = windows.find(window => window.url.startsWith(self.location.origin));
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return clients.openWindow(url);
  }));
});
