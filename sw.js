const CACHE_NAME = "stempeluhr-cache-v1.9.0";

const APP_SHELL = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",
    "./favicon.png",
    "./favicon_32.png",
    "./favicon_180.png",
    "./favicon_192.png",
    "./favicon_512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request, { ignoreSearch: true });
            })
    );
});