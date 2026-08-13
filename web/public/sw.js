const CACHE = 'handbook-static-v2';
const PRECACHE = [
  '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
  '/fonts/kruti-dev-010.ttf', '/offline-shell',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always serve fresh content, fall back to cache when offline.
// Every successful GET gets cached as it's seen — page HTML, and (since
// browsing any page pulls in the shared Next.js/CSS/font chunks) the app
// shell too, so a repeat visit works fully offline without a separate
// build-time precache list for hashed asset filenames.
//
// Navigation to a page never visited before going offline is the one gap
// that leaves — for that, /offline-shell (precached, so always available;
// Next.js serves public/offline-shell.html at the extensionless path,
// redirecting the .html URL — precache/match the extensionless one so the
// Cache API entry actually gets hit) reads the page straight out of the
// IndexedDB corpus cache (client-db.ts / CorpusSync.tsx), which downloads
// in the background independently of which pages were actually opened.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('/offline-shell');
        return Response.error();
      })
  );
});
