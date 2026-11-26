const CACHE = 'viaticos-v37';
const FILES = ['./vendor/jszip.min.js', './vendor/plantilla.xlsx', './', './index.html', './manifest.webmanifest', './vendor/xlsx.full.min.js', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  // Red primero, sin usar la caché HTTP del navegador (GitHub Pages guarda 10 min), para recibir siempre la última versión; caché si no hay internet
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
