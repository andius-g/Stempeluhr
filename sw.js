const CACHE_NAME = 'stempeluhr-v1.11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// 1. Dateien beim Installieren cachen
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 2. Alte Caches beim Aktivieren aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. HTML immer zuerst frisch vom Server laden, Statisches aus dem Cache
self.addEventListener('fetch', (event) => {
  const isHtml =
    event.request.mode === 'navigate' ||
    event.request.url.endsWith('.html') ||
    event.request.url.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
