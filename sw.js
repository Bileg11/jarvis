const CACHE = 'jarvis-v24';
// Зөвхөн static asset cache хийнэ — HTML navigation-д ХҮРЭХГҮЙ
const ASSETS = [
  './style.css', './jarvis-config.js', './app.js', './gemini.js', './intel.js', './firebase-config.js',
  './hsk-vocab.js', './hsk-vocab-45.js', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url)))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTML navigation (хуудас солих) → ҮРГЭЛЖ network. SW хүрэхгүй.
  // Ингэснээр clean URL redirect, шинэ deploy алдаагүй ажиллана.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    return; // browser өөрөө network-аас авна
  }

  // Static asset → cache-first (хурд, offline)
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req)).catch(() => fetch(req))
  );
});
