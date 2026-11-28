const CACHE_NAME = "stempeluhr-v2.0.5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=205",
  "./scribbles.js?v=205",
  "./holidays-nds.js?v=205",
  "./phrases.js?v=205",
  "./pdf-export.js?v=205",
  "./app.js?v=205",
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
  "./favicon_rose_512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {}
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && (response.status === 200 || response.type === "opaque")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});