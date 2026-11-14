const CACHE_NAME = 'jacobestate-shell-v6';
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
// Files that change with every release are fetched from the network first, so visitors always get
// the latest design; the cached copy is only used when offline. Icons and the manifest stay cache-first.
const NETWORK_FIRST_ASSETS = new Set(['/css/style.css', '/css/pwa.css', '/js/theme.js']);

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // cache: 'reload' skips the browser's HTTP cache so a stale copy is never stored.
            .then(cache => cache.addAll(SHELL_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
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

    if (NETWORK_FIRST_ASSETS.has(url.pathname)) {
        event.respondWith(
            fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                }
                return response;
            }).catch(() => caches.match(request))
        );
        return;
    }

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
