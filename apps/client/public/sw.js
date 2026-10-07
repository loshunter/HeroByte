// v3: the app moved to /play/ and / became the website. The new name makes activate delete v2,
// which held the app's page under "/". Only the canonical page URL is cached: /play/index.html
// is a redirect on Cloudflare Pages, and a redirected response cannot answer a navigation.
const CACHE_NAME = "herobyte-cache-v3";
const urlsToCache = ["/play/", "/favicon-32x32.png", "/logo-wide.webp", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith("herobyte-cache-") && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Navigation requests (HTML) -> Network First
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      }),
    );
    return;
  }

  // Asset requests -> Cache First, falling back to network
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request)),
  );
});
