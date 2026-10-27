// Kursrahmen: Fortschritt, zuletzt gelesen, Farbschema, Inhaltsverzeichnis, Legende.
// Gespeichert wird im Browser (localStorage); mit Konto gleicht sync.js den Stand zwischen Geräten ab.
(function () {
  var KEY = 'vagus-kurs:v1';
  var UNITS = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
  var root = document.documentElement;
  var page = document.body.dataset.page;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  var state = load();
  state.done = state.done || {};
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
    [['done', 'doneT'], ['views', 'viewsT'], ['miss', 'missT'], ['quiz', 'quizT'], ['days', 'daysT']].forEach(function (p) {
      var a = prev[p[0]] || {}, b = state[p[0]] || {}, t = state[p[1]] = state[p[1]] || {};
      Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!same(a[k], b[k])) t[k] = now; });
    });
    ['theme', 'last', 'scroll', 'view', 'read', 'tour'].forEach(function (k) { if (!same(prev[k], state[k])) state._mt = now; });
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
    var n = UNITS.filter(function (id) { return state.done[id]; }).length;
    $$('[data-prog]').forEach(function (el) { el.textContent = n + ' / ' + UNITS.length; });
    $$('.prog i').forEach(function (el) { el.style.setProperty('--p', n / UNITS.length); });
    $$('[data-prog-long]').forEach(function (el) {
      el.textContent = n === 0 ? 'Noch nichts erledigt' : n === UNITS.length ? 'Alle 9 Einheiten erledigt' : n + ' von ' + UNITS.length + ' Einheiten erledigt';
    });
    $$('[data-unit]').forEach(function (el) {
      var id = el.getAttribute('data-unit');
      el.classList.toggle('is-done', !!state.done[id]);
      el.classList.toggle('is-last', state.last === id);
      if (el.classList.contains('ctoc-unit') || el.classList.contains('unit')) {
        el.setAttribute('aria-description', state.done[id] ? 'erledigt' : '');
      }
    });
    $$('[data-done]').forEach(function (b) {
      var on = !!state.done[b.getAttribute('data-done')];
      b.setAttribute('aria-pressed', on);
      b.querySelector('span:last-child').textContent = on ? 'Erledigt · zurücknehmen' : 'Als erledigt markieren';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-done]');
    if (b) { var id = b.getAttribute('data-done'); state.done[id] = !state.done[id]; if (!state.done[id]) delete state.done[id]; save(); render(); }
    if (e.target.closest('[data-reset]') && confirm('Alle Markierungen und den Lesestand löschen?')) {
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
  function theme() {
    var t = state.theme || '';
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    $$('[data-theme-label]').forEach(function (el) { el.textContent = NAMES[t]; });
    $$('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-label', 'Farbschema: ' + NAMES[t] + ' (wechseln)'); });
  }
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var order = ['', 'light', 'dark'];
      state.theme = order[(order.indexOf(state.theme || '') + 1) % 3];
      if (!state.theme) delete state.theme;
      save(); theme();
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
  }
  window.Kurs = { state: state, save: save, adopt: adopt, render: render, page: page, key: KEY };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
