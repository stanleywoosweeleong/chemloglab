/* ChemLogger service worker — network-first so updates always land,
   with an offline cache fallback. Bump CACHE on every deploy. */
const CACHE = "chemlogger-v3";

// Files that make up the app shell (relative to the SW scope).
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // For page navigations, fall back to the cached index when offline.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match(req)) || (await c.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Everything else: network-first, cache fallback.
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) c.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await c.match(req);
      return hit || Response.error();
    }
  })());
});
