// ファイルを変えたら VERSION を変える(古いキャッシュが消える)
const VERSION = 'v3';
const CACHE = `app-${VERSION}`;
const FILES = [
  './', './index.html', './offline.html',
  './css/style.css', './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// キャッシュ優先、なければネット、だめなら offline.html
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).catch(() =>
        e.request.mode === 'navigate' ? caches.match('./offline.html') : undefined
      )
    )
  );
});
