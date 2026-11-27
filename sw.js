const CACHE_NAME = "stempeluhr-v1.9.4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=194",
  "./app.js?v=194",
  "./manifest.json",
  "./manifest-rose.json",
  "./favicon.png",
  "./favicon_32.png",
  "./favicon_180.png",
  "./favicon_192.png",
  "./favicon_512.png",
  "./favicon_rose_32.png",
  "./favicon_rose_180.png",
  "./favicon_rose_192.png",
  "./favicon_rose_512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});