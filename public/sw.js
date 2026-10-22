// KILLER SERVICE WORKER — UNINSTALLS AND PURGES ALL WORKBOX CACHES
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      for (const client of clients) {
        try { client.navigate(client.url); } catch (err) {}
      }
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
