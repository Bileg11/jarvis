const CACHE = 'jarvis-v22';
const ASSETS = [
  './', './index.html', './dashboard.html', './learn.html',
  './tracker.html', './profile.html', './chat.html', './life.html',
  './finance.html', './hsk.html', './hsk-vocab.js',
  './style.css', './app.js', './gemini.js', './intel.js', './firebase-config.js',
  './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Asset тус бүрийг тусдаа cache — нэг алдаа бусдыг хааxгүй
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
  // GET request л cache хийнэ
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
      .catch(() => fetch(e.request))
  );
});
