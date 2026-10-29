// Offline-Cache für den Kurs. build.mjs setzt Version und Dateiliste ein.
const CACHE = 'vagus-kurs-mvstu00e';
const FILES = ["./","00-styleguide.html","01-gelenke-muskeln.html","02-n-laryngeus-superior.html","03-n-laryngeus-recurrens.html","04-gesamtkarte.html","05-stimmentstehung.html","06-schutzfunktionen.html","07-laehmungen.html","08-abgrenzung.html","09-10-wiederholung-pruefung.html","begriffe.html","index.html","lernkarten.html","merkheft.html","assets/app.js","assets/course.css","assets/data.js","assets/i18n-en.js","assets/i18n.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/icon-maskable-512.png","assets/icon.svg","assets/og.png","assets/peony.js","assets/study.js","assets/sync-config.js","assets/sync.js","assets/tools.js","assets/tour.js","assets/atlas/gray793.png","assets/atlas/gray951.png","assets/atlas/gray952.png","assets/atlas/gray954.png","assets/atlas/gray956.png","assets/atlas/gray957.png","assets/atlas/gray958.png","assets/atlas/gray959.png","assets/atlas/gray960.png","assets/atlas/kiriyak-vagus-recurrens.webp","assets/atlas/servier-kehlkopf-frontalschnitt.png","assets/atlas/servier-kehlkopf-vorne.png","assets/atlas/servier-stimmlippen-geschlossen.png","assets/atlas/servier-stimmlippen-offen.png","assets/fonts/Anton-400-latin.woff2","assets/fonts/AtkinsonHyperlegible-400-latin.woff2","assets/fonts/AtkinsonHyperlegible-400i-latin.woff2","assets/fonts/AtkinsonHyperlegible-700-latin.woff2","assets/fonts/CormorantGaramond-500-latin.woff2","assets/fonts/CormorantGaramond-500i-latin.woff2","assets/fonts/CormorantGaramond-600-latin.woff2","assets/fonts/CormorantGaramond-700-latin.woff2","assets/fonts/fonts.css","assets/fonts/IBMPlexSansCondensed-400-latin.woff2","assets/fonts/IBMPlexSansCondensed-600-latin.woff2","assets/fonts/UnifrakturMaguntia-400-latin.woff2"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('vagus-kurs-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Kursdateien: erst Netz (Änderungen sofort sichtbar), offline aus dem Cache
  // Schriften ändern sich nie (fester Dateiname): direkt aus dem Cache, sonst einmal laden und merken
  if (url.origin === location.origin && url.pathname.indexOf('/assets/fonts/') >= 0 && /\.woff2$/.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) c.put(e.request, res.clone()); return res;
    }))));
    return;
  }
  if (url.origin === location.origin) {
    // no-cache: beim Server nachfragen, ob sich etwas geändert hat (sonst bis zu 10 Min. alte Dateien)
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })
      .then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
    return;
  }
});
