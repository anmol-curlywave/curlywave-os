/* Curlywave OS service worker — caches only the app shell and static files.
   Private data (Supabase API calls) is never cached. */
const VERSION = "__BUILD_VERSION__";
const CACHE = `cw-shell-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname; // "/" or "/curlywave-os/"
const SHELL = ["", "index.html", "manifest.webmanifest", "favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "offline.html"].map((p) => BASE + p);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("cw-shell-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch API / third-party requests

  // Page navigations: always try the network first so users get the latest app.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        if (res.ok) c.put(BASE + "index.html", res.clone());
        return res;
      } catch {
        return (await caches.match(BASE + "index.html")) || (await caches.match(BASE + "offline.html"));
      }
    })());
    return;
  }

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith(BASE + "assets/") || url.pathname.startsWith(BASE + "icons/")) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // Everything else from our origin: network, falling back to cache.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
