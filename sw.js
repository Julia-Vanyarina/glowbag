// Офлайн-работа и обновления. При каждом обновлении приложения меняйте VERSION.
const VERSION = 'glowbag-2.15.0';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/data.js', './js/db.js', './js/analysis.js', './js/art.js', './js/inci.js', './js/ics.js',
  './icons/icon-180.png', './fonts/lora-italic.woff', './fonts/montserrat.woff', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  // cache:'reload' — берём свежие файлы с сайта, а не из кеша браузера
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // шрифты Google — кешируем при первом открытии
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open('fonts').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // номер версии на сайте — всегда из сети, без кеша
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(e.request.url, { cache: 'no-store' })); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))));
});
