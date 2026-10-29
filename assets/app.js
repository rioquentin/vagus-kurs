// Kursrahmen: Fortschritt, zuletzt gelesen, Farbschema, Inhaltsverzeichnis, Legende.
// Gespeichert wird im Browser (localStorage); mit Konto gleicht sync.js den Stand zwischen Geräten ab.
(function () {
  var KEY = 'vagus-kurs:v1';
  var UNITS = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
  var root = document.documentElement;
  var page = document.body.dataset.page;
  // Fokusring nur für die Tastatur: Nach einem Tippen öffnen Dialoge sonst mit einem Ring um den ersten Knopf
  document.addEventListener('pointerdown', function () { root.dataset.input = 'pointer'; }, true);
  document.addEventListener('keydown', function (e) { if (!e.ctrlKey && !e.metaKey) root.dataset.input = 'key'; }, true);

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  var state = load();
  state.done = state.done || {};
  // Früher landeten Klicks auf beantwortete Prüfungsfragen (eigenes data-done der Seite) hier: aufräumen
  Object.keys(state.done).forEach(function (k) { if (!/^\d\d$/.test(k)) delete state.done[k]; });
  state.scroll = state.scroll || {};
  var prev = JSON.parse(JSON.stringify(state));

  // Zeitstempel pro Eintrag, damit zwei Geräte Eintrag für Eintrag zusammengeführt werden können:
  // Karten c.t, Notizen n.mod, gelöschte Notizen gone[id], erledigt doneT[id], Ansichten viewsT[id], Rest _mt.
  function stamp() {
    var now = Date.now(), same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
    var pc = prev.cards || {}, cc = state.cards || {};
    Object.keys(cc).forEach(function (k) { if (!same(pc[k], cc[k])) cc[k].t = now; });
    var pn = {}; (prev.notes || []).forEach(function (n) { pn[n.id] = n; });
    var seen = {};
    (state.notes || []).forEach(function (n) { seen[n.id] = 1; if (!same(pn[n.id], n)) n.mod = now; });
    Object.keys(pn).forEach(function (id) { if (!seen[id]) { state.gone = state.gone || {}; state.gone[id] = now; } });
    [['done', 'doneT'], ['views', 'viewsT'], ['miss', 'missT'], ['quiz', 'quizT'], ['days', 'daysT'], ['skip', 'skipT'], ['log', 'logT'], ['conf', 'confT'], ['figs', 'figsT'], ['mnem', 'mnemT']].forEach(function (p) {
      var a = prev[p[0]] || {}, b = state[p[0]] || {}, t = state[p[1]] = state[p[1]] || {};
      Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!same(a[k], b[k])) t[k] = now; });
    });
    ['theme', 'last', 'scroll', 'view', 'read', 'tour', 'gate', 'ui', 'exam', 'examLog', 'weekSeen', 'newsSeen'].forEach(function (k) { if (!same(prev[k], state[k])) state._mt = now; });
  }
  function save() {
    stamp();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    prev = JSON.parse(JSON.stringify(state));
    document.dispatchEvent(new CustomEvent('kurs:save'));
  }

  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // ---- Fortschritt ----
  function render() {
    // In Abschnitten gezählt wie im Kurs („Abschnitt 1 von 10“): Seite 9–10 sind zwei
    var n = UNITS.reduce(function (s, id) { return s + (state.done[id] ? (id === '09' ? 2 : 1) : 0); }, 0), ALL = 10;
    $$('[data-prog]').forEach(function (el) { el.textContent = n + ' / ' + ALL; });
    $$('.prog i').forEach(function (el) { el.style.setProperty('--p', n / ALL); });
    $$('[data-prog-long]').forEach(function (el) {
      el.textContent = n === 0 ? 'Noch nichts erledigt' : n === ALL ? 'Alle 10 Abschnitte erledigt' : n + ' von ' + ALL + ' Abschnitten erledigt';
    });
    $$('[data-unit]').forEach(function (el) {
      var id = el.getAttribute('data-unit');
      el.classList.toggle('is-done', !!state.done[id]);
      el.classList.toggle('is-last', state.last === id);
      if (el.classList.contains('ctoc-unit') || el.classList.contains('unit')) {
        el.setAttribute('aria-description', state.done[id] ? 'erledigt' : '');
      }
    });
    $$('.done-btn[data-done]').forEach(function (b) {
      var on = !!state.done[b.getAttribute('data-done')];
      b.setAttribute('aria-pressed', on);
      b.querySelector('span:last-child').textContent = on ? 'Erledigt · zurücknehmen' : 'Als erledigt markieren';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.done-btn[data-done]');
    if (b) {
      var id = b.getAttribute('data-done'); state.done[id] = !state.done[id]; if (!state.done[id]) delete state.done[id]; save(); render();
      if (state.done[id]) { b.classList.add('just'); setTimeout(function () { b.classList.remove('just'); }, 500); }
    }
    if (e.target.closest('[data-reset]') && confirm('Alle „erledigt“-Häkchen und den Lesestand zurücksetzen? Lernkarten, Merkheft und Schwachstellen bleiben erhalten.')) {
      state.done = {}; state.scroll = {}; delete state.last; save(); render(); resume();
    }
  });

  // ---- Zuletzt gelesen ----
  if (UNITS.indexOf(page) >= 0 || page === '00') {
    if (page !== '00') { state.last = page; save(); }
    if (location.hash === '#weiter' && state.scroll[page]) {
      history.replaceState(null, '', location.pathname);
      window.addEventListener('load', function () { window.scrollTo(0, state.scroll[page]); });
    }
    var t;
    window.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.scroll[page] = Math.round(window.scrollY); save(); }, 300);
    }, { passive: true });
  }
  function resume() {
    var box = document.querySelector('[data-resume]');
    if (!box) return;
    var link = state.last && document.querySelector('.unit[data-unit="' + state.last + '"]');
    box.hidden = !link;
    if (!link) return;
    box.querySelector('[data-resume-t]').textContent = link.querySelector('.n').textContent + ' · ' + link.querySelector('.t').textContent;
    box.querySelector('[data-resume-a]').href = link.getAttribute('href') + '#weiter';
  }

  // ---- Lesefortschritt (Balken unter der Kopfzeile) ----
  var bar = document.querySelector('.readbar');
  function readbar() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--read', h > 0 ? Math.min(1, window.scrollY / h) : 0);
  }
  if (bar && page !== 'home') { window.addEventListener('scroll', readbar, { passive: true }); window.addEventListener('resize', readbar); readbar(); }

  // ---- Farbschema: System → Hell → Dunkel ----
  var NAMES = { '': 'System', light: 'Hell', dark: 'Dunkel' };
  function theme(animate) {
    var t = state.theme || '';
    // Beim Umschalten weich überblenden (View Transitions), beim Laden sofort
    var apply = function () { if (t) root.dataset.theme = t; else delete root.dataset.theme; };
    if (animate && document.startViewTransition && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) document.startViewTransition(apply); else apply();
    $$('[data-theme-label]').forEach(function (el) { el.textContent = NAMES[t]; });
    $$('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-label', 'Farbschema: ' + NAMES[t] + ' (wechseln)'); });
  }
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var order = ['', 'light', 'dark'];
      state.theme = order[(order.indexOf(state.theme || '') + 1) % 3];
      if (!state.theme) delete state.theme;
      save(); theme(true);
    });
  });

  // ---- Inhaltsverzeichnis als Schublade (schmale Bildschirme) ----
  var side = document.getElementById('sidebar'), scrim = document.querySelector('.scrim'), opener = document.querySelector('[data-open-nav]');
  function nav(open) {
    side.classList.toggle('open', open); scrim.classList.toggle('open', open);
    opener.setAttribute('aria-expanded', open);
    if (open) { var c = side.querySelector('[aria-current]') || side.querySelector('a'); c && c.focus(); } else opener.focus();
  }
  opener.addEventListener('click', function () { nav(true); });
  $$('[data-close-nav]').forEach(function (el) { el.addEventListener('click', function () { nav(false); }); });
  side.addEventListener('click', function (e) { if (e.target.closest('.ctoc-sub a') && side.classList.contains('open')) { side.classList.remove('open'); scrim.classList.remove('open'); opener.setAttribute('aria-expanded', false); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) nav(false); });

  // ---- Aktueller Unterabschnitt im Inhaltsverzeichnis ----
  var subs = $$('.ctoc-sub a');
  if (subs.length) {
    var heads = subs.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var spy = function () {
      // Letzte Überschrift, die schon oberhalb der Lesehöhe liegt
      var cur = heads[0];
      heads.forEach(function (h) { if (h && h.getBoundingClientRect().top < window.innerHeight * 0.35) cur = h; });
      subs.forEach(function (a, i) { a.classList.toggle('here', heads[i] === cur); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  // ---- Legende ----
  var dlg = document.getElementById('legend');
  $$('[data-open-legend]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (side.classList.contains('open')) { side.classList.remove('open'); scrim.classList.remove('open'); }
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
  });
  $$('[data-close-legend]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  render(); resume(); theme();

  // Gemeinsamer Speicher für study.js (Lernkarten, Antwortprüfung)
  // adopt: zusammengeführten Stand vom Server übernehmen, ohne neue Zeitstempel zu setzen
  function adopt(next) {
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.keys(next).forEach(function (k) { state[k] = next[k]; });
    state.done = state.done || {}; state.scroll = state.scroll || {};
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    prev = JSON.parse(JSON.stringify(state));
    render(); theme();
    document.dispatchEvent(new CustomEvent('kurs:adopt'));
  }
  window.Kurs = { state: state, save: save, adopt: adopt, render: render, page: page, key: KEY, theme: function () { theme(true); } };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // ---- Eröffnung: zeichnet sich, wartet dann auf „Zum Kurs“. Tippen während des Zeichnens spult ans Ende vor. ----
  var afterIntro = [];
  window.Kurs.afterIntro = function (fn) { if (root.classList.contains('intro-on')) afterIntro.push(fn); else fn(); };
  if (root.classList.contains('intro-on')) {
    if (window.KursGarden) window.KursGarden(document.querySelector('.intro .gold'), { start: 1.2 }); // Pfingstrosen (assets/peony.js)
    var intro = document.querySelector('.intro'), go = intro && intro.querySelector('[data-intro-go]'), ended = false, opened = false;
    var end = function () { if (ended) return; ended = true; root.classList.remove('intro-on', 'intro-open', 'intro-ff'); afterIntro.forEach(function (fn) { fn(); }); afterIntro = []; };
    var open = function () { if (opened) return; opened = true; root.classList.add('intro-ff', 'intro-open'); setTimeout(end, 1300); };
    if (intro) {
      intro.addEventListener('animationend', function (e) { if (e.target === intro && e.animationName === 'intro-lift') end(); });
      intro.addEventListener('click', function (e) { if (e.target.closest('[data-intro-go]')) open(); else root.classList.add('intro-ff'); });
    }
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('intro-on')) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); open(); } else root.classList.add('intro-ff');
    });
    // Nur für Tastatur/Maus vorfokussieren; am Handy würde sonst ein Ring um den Knopf erscheinen
    if (go && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) setTimeout(function () { try { go.focus({ preventScroll: true }); } catch (x) {} }, 4900);
  }

  // ---- „Neu im Kurs“: einmal nach einem Update, für alle, die schon gelernt haben ----
  // „Verstanden“ merkt sich die Ausgabe (state.newsSeen, mit dem Konto abgeglichen); „Später“ nur für diesen Besuch.
  var NEWS_ID = '2026-10-29';
  var NEWS = [
    ['Lernen', [
      ['Prüfungstermin', 'In „Heute“ auf der Startseite eintragen: Countdown, Lesetempo, und jede Karte kommt vor dem Termin noch einmal.', 'index.html#heute'],
      ['Lückentext', 'Neuer Stapel in den Lernkarten: der Satz aus dem Kurs, der Fachbegriff fehlt.', 'lernkarten.html?deck=l'],
      ['Abbildungen üben', 'Unter jeder Abbildung „Beschriftung verdecken“, dann „Finden üben“. Sie kommen danach in „Heute“ wieder.', '01-gelenke-muskeln.html?fig=' + encodeURIComponent('Abb. 1.1') + '&find=1'],
      ['Begriffe antippen', 'Unterstrichene Fachbegriffe zeigen beim Antippen den Satz, in dem sie eingeführt werden.', '03-n-laryngeus-recurrens.html'],
      ['Verwechslungen und Eselsbrücken', 'Im Merkheft: was du verwechselst, und eigene Merkhilfen, die bei jeder Antwort erscheinen.', 'merkheft.html#verwechslungen'],
      ['Probeprüfung mit Uhr', '40 Minuten mit Pause, Verlauf deiner Ergebnisse, und die mündliche Frage kannst du jetzt aufnehmen und anhören.', '09-10-wiederholung-pruefung.html#pruefung'],
      ['Fortschritt', 'In den Lernkarten: Lernkalender, was in den nächsten Tagen fällig ist, und wo es noch wackelt.', 'lernkarten.html'],
      ['Deine Tonhöhe live', 'In Abschnitt 5.3: Mikrofon an, von tief nach hoch gleiten, die Linie folgt deiner Stimme.', '05-stimmentstehung.html#h-5-3-tonhoehe-lautstaerke-register-wer-stellt-was-ein'],
      ['Lernblatt drucken', 'Am Ende jedes Abschnitts: als PDF sichern oder drucken, mit Lösungen.', '02-n-laryngeus-superior.html'],
    ]],
    ['Komfort', [
      ['Erinnerung und Sicherung', 'Im „Aa“-Menü: tägliche Erinnerung in den Kalender, und dein Lernstand als Datei.', null],
      ['Ruhiger lesen', 'Die Kopfzeile weicht beim Lesen aus, Antworten klappen sanft auf, offline wird gespeichert und Bescheid gesagt.', null],
      ['iPhone', 'Leg den Kurs auf den Home-Bildschirm, dann bleibst du auch nach einer Pause angemeldet.', null],
    ]],
  ];
  var newsShown = false;
  function whatsNew() {
    var later = false; try { later = sessionStorage.getItem('vagus-kurs:news-later') === NEWS_ID; } catch (e) {}
    // Für alle, die das Willkommen hinter sich haben. Ganz Neue bekommen die Anleitung; deren Ende markiert die Neuigkeiten als gesehen.
    if (newsShown || !(state.gate || state.tour) || state.newsSeen === NEWS_ID || later || /[?&](note|hl|fig|quiz)=|access_token/.test(location.search + location.hash)) return;
    if (root.classList.contains('intro-on')) return; // kommt nach „Zum Kurs“
    var busy = document.querySelector('dialog[open]');
    if (busy) { busy.addEventListener('close', function () { setTimeout(whatsNew, 400); }, { once: true }); return; } // erst, wenn das andere Fenster zu ist
    newsShown = true;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var dlg = document.createElement('dialog'); dlg.className = 'legend news'; dlg.setAttribute('aria-labelledby', 'news-t');
    dlg.innerHTML = '<i class="orn tl" aria-hidden="true">❦</i><i class="orn tr" aria-hidden="true">❦</i><i class="orn bl" aria-hidden="true">❦</i><i class="orn br" aria-hidden="true">❦</i>' +
      '<div class="lg-head"><h2 id="news-t">Neu im Kurs</h2></div><div class="lg-body"><p class="news-lead">Seit deinem letzten Besuch ist einiges dazugekommen. Alles ist freiwillig; der Kurs selbst ist unverändert.</p>' +
      NEWS.map(function (grp) {
        return '<section class="news-g"><span class="eyebrow">' + esc(grp[0]) + '</span><ul>' + grp[1].map(function (it) {
          return '<li><b>' + esc(it[0]) + '</b><span>' + esc(it[1]) + (it[2] ? ' <a href="' + esc(it[2]) + '" data-news-go>Zeigen →</a>' : '') + '</span></li>';
        }).join('') + '</ul></section>';
      }).join('') +
      '</div><div class="news-act"><button type="button" class="cta" data-news-ok>Schön, verstanden</button><button type="button" class="linkbtn" data-news-later>Später ansehen</button></div>';
    document.body.appendChild(dlg);
    var seen = function () { state.newsSeen = NEWS_ID; save(); };
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-news-ok]')) { seen(); dlg.close(); }
      else if (e.target.closest('[data-news-later]')) { try { sessionStorage.setItem('vagus-kurs:news-later', NEWS_ID); } catch (x) {} dlg.close(); }
      else if (e.target.closest('[data-news-go]')) seen(); // wer einem Link folgt, hat es gesehen
    });
    dlg.addEventListener('cancel', function () { try { sessionStorage.setItem('vagus-kurs:news-later', NEWS_ID); } catch (x) {} });
    dlg.addEventListener('close', function () { setTimeout(function () { dlg.remove(); }, 300); });
    dlg.showModal();
  }
  window.Kurs.NEWS_ID = NEWS_ID;
  window.Kurs.afterIntro(function () { setTimeout(whatsNew, 450); });
  document.addEventListener('kurs:adopt', function () { setTimeout(whatsNew, 600); }); // Daten vom Konto kamen erst nach dem Laden

  // ---- Fokus beim Lesen: Kopfzeile weicht nach unten scrollend aus, kommt beim kleinsten Zurückscrollen wieder ----
  if (UNITS.indexOf(page) >= 0 || page === '00') {
    var lastY = window.scrollY, acc = 0, busy = false;
    window.addEventListener('scroll', function () {
      if (busy) return; busy = true;
      requestAnimationFrame(function () {
        busy = false;
        var y = window.scrollY, dy = y - lastY; lastY = y;
        if (document.querySelector('dialog[open], .sidebar.open')) { root.classList.remove('bar-away'); return; }
        acc = (dy > 0) === (acc > 0) ? acc + dy : dy; // Richtung merken, kleine Zitterer ignorieren
        if (y < 160 || acc < -6) root.classList.remove('bar-away');
        else if (acc > 48) root.classList.add('bar-away');
      });
    }, { passive: true });
    // Tastatur: Fokus in der Kopfzeile holt sie zurück
    document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.topbar')) root.classList.remove('bar-away'); });
  }

  // ---- iPhone: Tipp „Zum Home-Bildschirm“ ----
  // Safari löscht Daten von Seiten, die 7 Tage nicht geöffnet wurden (Anmeldung inklusive). Als App auf dem
  // Home-Bildschirm gilt das nicht. Nur auf iOS, nur auf der Startseite, nur nach den ersten Schritten, nie in der App selbst.
  (function () {
    var A2 = 'vagus-kurs:a2hs'; // pro Gerät: „done“ oder Zeitpunkt für „später“
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var app = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var seen; try { seen = localStorage.getItem(A2); } catch (e) { return; }
    var used = Object.keys(state.cards || {}).length || state.last || Object.keys(state.done || {}).length;
    if (!ios || app || page !== 'home' || !used || seen === 'done' || (seen && Date.now() < +seen)) return;
    var hero = document.querySelector('.home-hero'); if (!hero) return;
    var box = document.createElement('section'); box.className = 'a2hs';
    box.innerHTML = '<span class="eyebrow">Tipp fürs iPhone</span>' +
      '<p>Leg den Kurs auf deinen Home-Bildschirm. Dann öffnet er sich wie eine App, und du bleibst angemeldet, auch nach einer Woche Pause.</p>' +
      '<ol class="a2hs-steps" hidden><li>In Safari unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil nach oben, eventuell erst auf <b>···</b>).</li><li><b>Zum Home-Bildschirm</b> wählen, dann <b>Hinzufügen</b>.</li><li>Den Kurs ab jetzt über das neue Symbol öffnen und dort <b>einmal anmelden</b>.</li></ol>' +
      '<div class="a2hs-row"><button type="button" class="cta" data-a2-how>Zeig mir wie</button><button type="button" class="linkbtn" data-a2-later>Später</button><button type="button" class="linkbtn" data-a2-done>Schon erledigt</button></div>';
    hero.insertAdjacentElement('afterend', box);
    box.addEventListener('click', function (e) {
      var set = function (v) { try { localStorage.setItem(A2, v); } catch (x) {} box.remove(); };
      if (e.target.closest('[data-a2-how]')) { box.querySelector('.a2hs-steps').hidden = false; e.target.closest('[data-a2-how]').remove(); }
      else if (e.target.closest('[data-a2-later]')) set(String(Date.now() + 14 * 864e5));
      else if (e.target.closest('[data-a2-done]')) set('done');
    });
  })();

  // ---- Kurze Hinweise unten (z. B. offline) ----
  function toast(msg, ms) {
    var t = document.querySelector('.ui-toast');
    if (!t) { t = document.createElement('div'); t.className = 'ui-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, ms || 4000);
  }
  window.addEventListener('offline', function () { toast('Offline. Du kannst weiterlernen, alles wird gespeichert.', 6000); });
  window.addEventListener('online', function () { toast('Wieder online.', 2500); });
  window.Kurs.toast = toast;

  // ---- Bewegung: Hilfen für study.js und tools.js ----
  function calm() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  // Kleine Blüte ❦ neben einer geschafften Überschrift (einmal, nicht doppelt)
  window.Kurs.bloom = function (el) {
    if (!el || el.querySelector('.bloom')) return;
    var s = document.createElement('span'); s.className = 'bloom'; s.setAttribute('aria-hidden', 'true'); s.textContent = '❦'; el.appendChild(s);
  };
  // Zahlen zählen kurz hoch (nur reine Zahlen, nur einmal je Element)
  window.Kurs.countUp = function (els) {
    if (calm()) return;
    Array.prototype.forEach.call(els, function (el) {
      var to = +el.textContent; if (!/^\d+$/.test(el.textContent.trim()) || to < 2 || el.dataset.counted) return;
      el.dataset.counted = 1; var t0 = performance.now(), D = 650;
      (function step(t) { var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  };
  // Kurzer Abgang zur Seite (dir: 1 rechts, -1 links, 0 nach oben), danach done()
  window.Kurs.leave = function (els, dir, done) {
    els = [].concat(els).filter(function (e) { return e && !e.hidden && e.animate; });
    if (calm() || !els.length) { done(); return; }
    var anims = els.map(function (e) {
      return e.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: dir ? 'translateX(' + dir * 34 + 'px) rotate(' + dir * 1.2 + 'deg)' : 'translateY(-10px)' }],
        { duration: 150, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    });
    anims[0].onfinish = function () { done(); anims.forEach(function (a) { a.cancel(); }); };
  };
  // Beim Scrollen auftauchen: Abbildungen, Kästen, Karten im Kurs und auf der Startseite (einmal)
  (function reveal() {
    if (calm() || !('IntersectionObserver' in window)) return;
    var sel = 'main .wrap .figure, main .wrap .box, main .wrap .plate, main .wrap .card, main .wrap > section > .scroll, main .wrap .unit, main .wrap .howto, main .wrap .review, main .fc-progress, main .wrap .done-row';
    var vh = window.innerHeight, els = Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (e) { return e.getBoundingClientRect().top > vh * 0.92; });
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { e.classList.add('rv'); io.observe(e); });
    window.addEventListener('beforeprint', function () { els.forEach(function (e) { e.classList.add('rv-in'); }); });
  })();
  // Gerade gemerkte Stelle: wie mit dem Textmarker überstrichen
  window.Kurs.sweep = function (id) {
    if (calm()) return;
    document.querySelectorAll('mark.saved[data-note="' + id + '"]').forEach(function (m, i) {
      m.style.setProperty('--d', (i * 90) + 'ms'); m.classList.add('fresh'); setTimeout(function () { m.classList.remove('fresh'); }, 1200 + i * 90);
    });
  };
  // Leiser Eintritt für neue Inhalte (Karteikarte usw.)
  window.Kurs.enter = function (el, dy) {
    if (!el || calm() || !el.animate) return;
    el.animate([{ opacity: 0, transform: 'translateY(' + (dy || 6) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 170, easing: 'cubic-bezier(.23,1,.32,1)' });
  };
})();
