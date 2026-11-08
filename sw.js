// Offline-Cache für den Kurs. build.mjs setzt Version und Dateiliste ein.
const CACHE = 'vagus-kurs-mw7rcc17';
const FILES = ["./","00-styleguide.html","01-gelenke-muskeln.html","02-n-laryngeus-superior.html","03-n-laryngeus-recurrens.html","04-gesamtkarte.html","05-stimmentstehung.html","06-schutzfunktionen.html","07-laehmungen.html","08-abgrenzung.html","09-10-wiederholung-pruefung.html","begriffe.html","funktionell-00-handout-check.html","funktionell-01-einordnung-fst.html","funktionell-02-hyperfunktionell.html","funktionell-03-hypofunktionell.html","funktionell-04-kindlich-juvenil.html","funktionell-05-psychogen.html","funktionell-06-vcd-ilo.html","funktionell-07-spasmodisch.html","funktionell-08-pruefung.html","funktionell.html","gutartig-00-handout-check.html","gutartig-01-knoetchen.html","gutartig-02-polyp.html","gutartig-03-zyste.html","gutartig-04-sulcus.html","gutartig-05-blutung.html","gutartig-06-varizen.html","gutartig-07-synechie.html","gutartig-08-asymmetrien.html","gutartig-09-papillomatose.html","gutartig-10-pruefung.html","gutartig.html","index.html","laryngitis-00-handout-check.html","laryngitis-01-einordnung.html","laryngitis-02-pathophysiologie.html","laryngitis-03-laryngitis-acuta.html","laryngitis-04-nicht-infektioes.html","laryngitis-05-chronische-laryngitis.html","laryngitis-06-reflux-granulom.html","laryngitis-07-pseudokrupp.html","laryngitis-08-kindliche-notfaelle.html","laryngitis-09-logopaedie.html","laryngitis-10-pruefung.html","laryngitis.html","lernkarten.html","merkheft.html","schnellkurs-00-start.html","schnellkurs-01-entzuendung.html","schnellkurs-02-funktionell.html","schnellkurs-03-steuerung.html","schnellkurs-04-raumforderungen.html","schnellkurs-05-gefaesse-narben-bau.html","schnellkurs-06-verletzung-gelenk.html","schnellkurs-07-hormone-alter.html","schnellkurs-08-erkennen.html","schnellkurs-09-quiz.html","schnellkurs.html","trauma-hormone-00-handout-check.html","trauma-hormone-01-intubation.html","trauma-hormone-02-aryluxation.html","trauma-hormone-03-ankylose.html","trauma-hormone-04-hormone-frau.html","trauma-hormone-05-presbyphonie.html","trauma-hormone-06-mutationsfistelstimme.html","trauma-hormone-07-mutationsstoerungen.html","trauma-hormone-08-pruefung.html","trauma-hormone.html","vagus.html","assets/app.js","assets/course.css","assets/courses.json","assets/data-search.js","assets/data.js","assets/i18n-en.js","assets/i18n.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png","assets/icon-maskable-512.png","assets/icon.svg","assets/og.png","assets/peony.js","assets/report.js","assets/study.js","assets/sync-config.js","assets/sync.js","assets/tableau.js","assets/tools.js","assets/tour.js","assets/fonts/Anton-400-latin.woff2","assets/fonts/AtkinsonHyperlegible-400-latin.woff2","assets/fonts/AtkinsonHyperlegible-400i-latin.woff2","assets/fonts/AtkinsonHyperlegible-700-latin.woff2","assets/fonts/CormorantGaramond-500-latin.woff2","assets/fonts/CormorantGaramond-500i-latin.woff2","assets/fonts/CormorantGaramond-600-latin.woff2","assets/fonts/CormorantGaramond-700-latin.woff2","assets/fonts/fonts.css","assets/fonts/IBMPlexSansCondensed-400-latin.woff2","assets/fonts/IBMPlexSansCondensed-600-latin.woff2","assets/fonts/Literata-400-latin.woff2","assets/fonts/Literata-400i-latin.woff2","assets/fonts/UnifrakturMaguntia-400-latin.woff2"];

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

// Mitteilung „heute fällig“ (verschickt von .github/workflows/push.yml): anzeigen, beim Antippen den Kurs öffnen
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Vagus-Kurs', {
    body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', lang: d.lang || 'de',
    tag: 'vagus-kurs-heute', renotify: false, data: { url: d.url || 'index.html#heute' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) return (open.navigate ? open.navigate(url) : Promise.resolve(open)).then(c => (c || open).focus());
    return self.clients.openWindow(url);
  }));
});
