// ══════════════════════════════════════════════════════════════════
// JARVIS Service Worker
// ══════════════════════════════════════════════════════════════════
// ЧУХАЛ ӨӨРЧЛӨЛТ (2026-09): өмнө нь энэ файл "cache-first" байсан —
// нэг удаа хадгалсан код ҮҮРД хадгалагдаж, шинэ хувилбар хэрэглэгчид
// хүрдэггүй байсан. (Тиймээс шалгалтын огноо, шинэ функц зэрэг
// шинэчлэлт хуучин хэрэглэгчид харагддаггүй байв.)
//
// Одоо: код/стиль → "network-first" (үргэлж шинийг авна, интернэт
// тасарвал л хадгалсныг ашиглана). Дата/зураг → "cache-first" (хурдан).
const CACHE = 'jarvis-v26';

// Хурдан ачаалах ёстой, ховор өөрчлөгддөг файлууд
const STATIC_ASSETS = [
  './hsk-vocab.js', './hsk-vocab-45.js', './hsk4-bank.js', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

// Байнга шинэчлэгддэг код — ҮРГЭЛЖ шинийг нь авах ёстой
const FRESH_PATTERN = /\/(app|gemini|intel|speak|themes|firebase-config|jarvis-config|main)\.js$|\.css$/;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
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

  // HTML хуудас → ҮРГЭЛЖ network. SW хүрэхгүй.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // гадны файлд хүрэхгүй

  // ── Код / стиль → network-first ────────────────────────────────
  // Шинэ хувилбар байвал ҮРГЭЛЖ түүнийг авна. Офлайн үед хадгалсныг өгнө.
  if (FRESH_PATTERN.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // ── Дата / зураг → cache-first (хурд), хажуугаар нь шинэчилнэ ──
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
