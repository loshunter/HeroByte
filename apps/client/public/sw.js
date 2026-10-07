// v3: on Cloudflare the app moved to /play/ and / became the website. The new name makes activate
// delete v2, which held the app's page under "/" and the old manifest. Only the canonical page URL
// is cached: Cloudflare Pages redirects /play/index.html to /play/, and the Fetch spec refuses a
// redirected response for a navigation. /play/ exists on Cloudflare, and the Vite dev and preview
// servers answer it with the app's page; a static host without it fails the install (main.tsx
// ignores that, and the app works without a worker). The manifest is not cached, so a change to it
// reaches installed apps without a cache bump.
const CACHE_NAME = "herobyte-cache-v3";
const urlsToCache = ["/play/", "/favicon-32x32.png", "/logo-wide.webp"];

self.addEventListener("install", (event) => {
  // Take over from v2 now rather than once every HeroByte tab is closed: v2 answers the manifest
  // from its cache, so until it goes, installed apps keep the old start page.
  self.skipWaiting();
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
