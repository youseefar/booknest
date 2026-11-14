const CACHE_NAME = 'jacobestate-shell-v4';
const SHELL_ASSETS = [
    '/offline.html',
    '/manifest.webmanifest',
    '/jacobrent-app-icon.svg',
    '/jacobrent-icon-192.png',
    '/jacobrent-icon-512.png',
    '/css/style.css',
    '/css/pwa.css',
    '/js/theme.js'
];
const CACHEABLE_ASSETS = new Set(SHELL_ASSETS.slice(1));

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key =>
                (key.startsWith('jacobrent-shell-') || key.startsWith('jacobestate-shell-'))
                && key !== CACHE_NAME
            ).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    const url = new URL(request.url);
    if (!CACHEABLE_ASSETS.has(url.pathname)) return;

    event.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(response => {
            if (response.ok) {
                return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
                    .then(() => response)
                    .catch(error => {
                        console.error('Unable to cache PWA asset:', request.url, error);
                        return response;
                    });
            }
            return response;
        }))
    );
});
