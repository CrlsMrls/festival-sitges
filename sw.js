const CACHE_NAME = 'sitges-2025-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com'
];

// Install service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => console.log('All files cached successfully'))
      .catch(err => console.error('Failed to cache files:', err))
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
          // Check if valid response
          if (!response || response.status !== 200) {
            return response;
          }
          
          // Cache images from IMDb CDN and other cross-origin resources
          const shouldCache = response.type === 'basic' || 
                            (response.type === 'cors' && event.request.url.includes('media-amazon.com'));
          
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
