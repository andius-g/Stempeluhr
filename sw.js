/* =========================================================
   STEMPELUHR & WOCHENÜBERSICHT — SERVICE WORKER (VERSION 1.7.2)
   ========================================================= */
const CACHE_NAME = "stempeluhr-cache-v172";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json?v=172",
    "./styles.css?v=172",
    "./app.js?v=172",
    "./favicon.png?v=172",
    "./favicon_32.png?v=172",
    "./favicon_180.png?v=172",
    "./favicon_192.png?v=172",
    "./favicon_512.png?v=172"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((networkResponse) => {
                if (
                    networkResponse &&
                    networkResponse.status === 200 &&
                    networkResponse.type === "basic"
                ) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => cachedResponse);
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ("focus" in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow("./index.html");
        })
    );
});