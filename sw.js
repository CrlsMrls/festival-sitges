const CACHE_NAME = 'sitges-2026-v11';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/2026/movies.json',
  '/2025/movies.json'
];

// Install service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();

  // cache.addAll() is all-or-nothing: if a single URL in the list ever fails
  // to fetch, NONE of them get cached and the SW still reports a successful
  // install (the failure is only logged to the console, never surfaced to
  // the user) — which is exactly what silently broke offline mode before.
  // Caching each file on its own means one bad fetch can't take the rest
  // down with it. Each fetch also forces `cache: 'reload'` so a stale copy
  // sitting in the browser's own HTTP cache (from a visit before this file
  // last changed) can't get baked into the offline cache instead of the
  // real, current version.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urlsToCache.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((response) => cache.put(url, response))
            .catch((err) => console.error('Failed to cache', url, err))
        )
      )
    ).then(() => console.log('App shell caching finished'))
  );
});

// Fetch from cache first, then network
self.addEventListener('fetch', (event) => {
  // Handle navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then((response) => {
          if (response) {
            console.log('Serving index.html from cache');
            return response;
          }
          return fetch(event.request).catch(() => {
            return caches.match('/index.html');
          });
        })
    );
    return;
  }
  
  // movies.json changes during the festival (fixed showtimes, corrected
  // sessions, etc). Always try the network first so a fix shows up the next
  // time there's a connection, and only fall back to the cached copy when
  // offline — that's what keeps "sin internet" working at all.
  if (event.request.url.includes('movies.json')) {
    // Same reasoning as the timeout in app.js: don't let a hung connection
    // (rather than a clean, fast failure) stall this past the point where
    // falling back to cache would've already solved it.
    const networkFetch = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('movies.json network timeout')), 4000);
      fetch(event.request, { cache: 'no-store' }).then((r) => { clearTimeout(timer); resolve(r); }, (e) => { clearTimeout(timer); reject(e); });
    });
    event.respondWith(
      networkFetch
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Handle all other requests
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          console.log('Cache hit:', event.request.url);
          return response;
        }

        console.log('Cache miss, fetching:', event.request.url);

        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          if (!response) {
            return response;
          }

          // Posters load via plain <img src>, which browsers fetch in
          // no-cors mode -> 'opaque' responses (status is always 0 and
          // unreadable, but they're still perfectly cacheable and are
          // exactly what makes posters work offline).
          const isPosterHost = event.request.url.includes('media-amazon.com') ||
                                event.request.url.includes('sitgesfilmfestival.com');
          const shouldCache = response.status === 200 && (
            response.type === 'basic' ||
            (response.type === 'cors' && isPosterHost)
          ) || (response.type === 'opaque' && isPosterHost);

          if (shouldCache) {
            console.log('Caching:', event.request.url);
            // Clone the response
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        }).catch((error) => {
          console.error('Fetch failed:', event.request.url, error);
          // If network fails, try to return a fallback
          return caches.match('/index.html');
        });
      })
  );
});

// Activate and clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim clients to make the service worker take control immediately
      return self.clients.claim();
    }).then(() => {
      console.log('Service Worker activated and claimed clients');
    })
  );
});
