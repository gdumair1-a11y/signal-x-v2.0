const CACHE_NAME = 'v2k-pro-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/index.css',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Promise.all with individual catch statements so that any single missing file,
      // or typescript source files not served in production, will not block the entire service worker installation.
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[V2K SW Linker] Delayed caching or build transition for asset: ${url}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for our UI assets
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback or just let it fail for API calls
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// Background Sync or Push could go here if needed
