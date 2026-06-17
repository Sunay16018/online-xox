// public/sw.js
const CACHE_NAME = 'xox-arena-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/xox_icon.png',
  '/xox_pro.png',
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/socket.io/')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // Return cached version, but update in background
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const cloned = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, cloned);
                });
              }
            })
            .catch(() => {});
          return cached;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, cloned);
              });
            }
            return response;
          })
          .catch(() => {
            // Offline fallback - return index.html for navigation
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Handle offline page for fetch failures
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});