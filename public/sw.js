/* Service worker minimal — critères d'installabilité PWA (fetch handler + activation). */
const CACHE_VERSION = "matima-admin-pwa-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("matima-admin-pwa-") && key !== CACHE_VERSION,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Network-only : pas de cache offline pour l'instant, mais handler requis pour l'installabilité.
  event.respondWith(fetch(event.request));
});
