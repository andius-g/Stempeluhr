const CACHE_NAME = 'stempeluhr-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png'
];

// 1. Dateien beim Installieren cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Alte Caches beim Aktivieren aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// 3. Anfragen abfangen (Cache zuerst, Fallback auf Netzwerk)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
