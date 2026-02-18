// Sumureza Business Suite — Service Worker
// Enables offline use and fast loading

const CACHE = 'sumureza-v1';
const OFFLINE_URLS = [
  '/sumureza/',
  '/sumureza/index.html',
  '/sumureza/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
];

// ── INSTALL: cache all core files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(OFFLINE_URLS).catch(err => {
        console.warn('[SW] Some files failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Google Drive API calls
  if (url.hostname === 'www.googleapis.com' ||
      url.hostname === 'apis.google.com' ||
      url.hostname === 'accounts.google.com') {
    return; // let browser handle normally
  }

  // For Google Fonts — try network first, cache fallback
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(event.request)
          .then(response => { cache.put(event.request, response.clone()); return response; })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  // For app files — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return main app
        if (event.request.destination === 'document') {
          return caches.match('/sumureza/index.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: notify when back online ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
