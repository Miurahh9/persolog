self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No caching behavior by default; expand this if you want offline support.
self.addEventListener('fetch', (event) => {
  // Let the network handle requests by default.
});
