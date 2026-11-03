// Offline shell. App files: network first (so updates show at once), cache as fallback.
const CACHE = 'medsched-v2-4';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.json', './logo.png', './icons/icon.svg', './icons/icon-192.png',
  './js/main.js', './js/util.js', './js/settings.js', './js/api.js', './js/store.js', './js/model.js', './js/registry.js',
  './js/ui.js', './js/print.js', './js/docx.js', './js/demo.js', './js/wordimport.js',
  './js/views/today.js', './js/views/portcath.js', './js/views/admissions.js', './js/views/followup.js', './js/views/tumorboard.js',
  './js/views/clinic.js', './js/views/calendar.js', './js/views/importer.js', './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // Apps Script, fonts, CDN: straight to the network
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
