// FamilieHub service worker
// • Appens egne filer: hent fra nettet først (så opdateringer altid slår igennem),
//   brug cachen når der ikke er net.
// • Skrifttyper og opskriftsbilleder: brug cachen først.
// • Firebase-trafik røres ikke.
// Skift VERSION ved større ændringer, så gamle caches ryddes.

const VERSION = 'fh-4.0.0';
const APP_CACHE = 'familiehub-app-' + VERSION;
const ASSET_CACHE = 'familiehub-assets-v1';
const PHOTO_CACHE = 'familiehub-photos-v1';   // bruges af js/photos.js

const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/vendor/firebase.js',
  'js/config.js',
  'js/backend.js',
  'js/core.js',
  'js/photos.js',
  'data/opskrifter.js',
  'js/kalender.js',
  'js/lister.js',
  'js/feed.js',
  'js/mad.js',
  'js/boern.js',
  'js/mere.js',
  'js/home.js',
  'js/sync.js',
  'js/auth.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k !== APP_CACHE && k !== ASSET_CACHE && k !== PHOTO_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))
      .then(r => r || new Response('Offline', { status: 503, statusText: 'Offline' }));

    // Hvis nettet er langsomt (>4 sek), så vis cachen
    const timer = setTimeout(() => {
      fromCache().then(r => { if (!done && r.status !== 503) { done = true; resolve(r); } });
    }, 4000);

    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(APP_CACHE).then(c => c.put(req, copy));
      }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!done) { fromCache().then(r => { done = true; resolve(r); }); }
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(ASSET_CACHE).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => hit));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/__foto/')) return;   // lokale billeder håndteres af photos.js
    event.respondWith(networkFirst(req));
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'images.unsplash.com') {
    event.respondWith(cacheFirst(req));
  }
  // Alt andet (Firebase m.m.) går direkte til nettet
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
