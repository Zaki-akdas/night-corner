// Minimal offline shell for Night Corner PWA
const CACHE = "night-corner-v2";
const SHELL = ["/", "/shop", "/offline", "/logo.svg", "/logo-icon.svg", "/favicon.svg", "/logo.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  // Network-first for pages, cache-first for static assets
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/offline")))
    );
  } else {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              if (res.ok && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/images/") || url.pathname.endsWith(".svg"))) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(request, copy));
              }
              return res;
            })
            .catch(() => cached)
      )
    );
  }
});
