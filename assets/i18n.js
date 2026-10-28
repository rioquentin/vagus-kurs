// Oberfläche auf Englisch (Kursinhalt bleibt Deutsch).
// Übersetzt Textknoten und Attribute der Benutzeroberfläche über ein Wörterbuch Deutsch → Englisch
// (assets/i18n-en.js). Zahlen werden zu „#“, damit „Frage 4 von 16“ und „Frage 1 von 12“ denselben Eintrag nutzen.
// Kursinhalt (die ursprüngliche Lesespalte der Abschnitte) wird nie angefasst, nur die eingefügten Werkzeuge darin.
(function () {
  var KEY = 'vagus-kurs:v1', root = document.documentElement;
  function ui() { try { return (JSON.parse(localStorage.getItem(KEY) || '{}') || {}).ui || 'de'; } catch (e) { return 'de'; } }
  var DICT = window.KURS_EN || {};
  var RX = (window.KURS_EN_RX || []).map(function (r) { return [new RegExp(r[0]), r[1]]; });
  var exact = {}, pat = {};
  Object.keys(DICT).forEach(function (k) { if (k.indexOf('#') >= 0) pat[k] = DICT[k]; else exact[k] = DICT[k]; });
  var missing = window.__i18nMissing = {};

  // Werkzeuge, die in der Lesespalte liegen und übersetzt werden dürfen
  var TOOL = '.qa-btn, .qa > .eyebrow, .qa-rate, .fig-tools, .view-sw, .atlas-note > b, .atlas-card figcaption > p > b, .tts-btn, .dr-launch, .miss-banner, .lbl-bar, .quiz, .today, .weak, .z-open';
  // Kursinhalt innerhalb dieser Werkzeuge (Fragen, Lösungen, Erklärungen) bleibt Deutsch
  var KEEP = '.skip-list li > span, .qa-a, .cq-q, .cq-ctx, .fc-answer > p, .qz-opt, .qz-fb > p:not(.qz-verdict):not(.note), .qz-missed, .weak-e > div, .weak-e summary > span:first-child, .cq-term, .tv-q, .tv-line, .tv-opts, .atlas-card figcaption p:not(.atlas-cr), .dr-steps, .z-cap, #zoom-t, .s-snip, .s-results b, .gl-e dd > p:first-child, .gl-e dt, .nb-e blockquote, .nb-e textarea, .ctoc-t, .ctoc-sub, .unit .t, .unit .s, .chip > b + *, [data-fc-card], [data-fc-answer]';
  var COURSE_PAGE = /^\d\d$/.test(document.body.dataset.page);
  function inScope(el) {
    if (!el || el.closest('script, style, svg text, code, pre, [data-no-i18n]')) return false;
    if (el.closest(KEEP)) return false;
    if (COURSE_PAGE && el.closest('main > .wrap') && !el.closest(TOOL)) return false;
    return true;
  }
  function tr(s) {
    var t = s.trim(); if (!t || !/[A-Za-zÄÖÜäöüß]/.test(t)) return null;
    if (exact[t] != null) return s.replace(t, exact[t]);
    var nums = t.match(/\d+(?:[.,]\d+)?/g);
    if (nums) {
      var k = t.replace(/\d+(?:[.,]\d+)?/g, '#');
      if (pat[k] != null) { var i = 0; return s.replace(t, pat[k].replace(/#/g, function () { return nums[i++]; })); }
    }
    // Feste Vorsätze vor deutschem Kurstext, z. B. „Abschnitt 3 · …“ → „Section 3 · …“
    for (var i = 0; i < RX.length; i++) if (RX[i][0].test(t)) return s.replace(t, t.replace(RX[i][0], RX[i][1]));
    if (!/^[A-Za-z0-9 .,·:–—()/+%-]*$/.test(t) || /[äöüßÄÖÜ]/.test(t)) missing[t] = (missing[t] || 0) + 1;
    return null;
  }
  var ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  function walk(node) {
    if (node.nodeType === 3) {
      if (!inScope(node.parentElement)) return;
      var r = tr(node.data); if (r != null && r !== node.data) node.data = r;
      return;
    }
    if (node.nodeType !== 1 || node.matches('script, style')) return;
    // Auch außerhalb des Übersetzungsbereichs weiter hineinschauen: In der Lesespalte liegen eingefügte Werkzeuge
    if (inScope(node)) ATTRS.forEach(function (a) { var v = node.getAttribute(a); if (v) { var r = tr(v); if (r != null && r !== v) node.setAttribute(a, r); } });
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  var obs = null;
  function start() {
    walk(document.body);
    document.title = document.title.replace('Lernkarten', 'Flashcards').replace('Merkheft', 'Notebook').replace('Fachbegriffe', 'Glossary');
    obs = new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') walk(m.target);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Rückfragen (confirm/alert) ebenfalls übersetzen
    var c = window.confirm, a = window.alert;
    window.confirm = function (m) { return c.call(window, tr(String(m)) || m); };
    window.alert = function (m) { return a.call(window, tr(String(m)) || m); };
  }
  if (ui() === 'en') {
    root.dataset.ui = 'en';
    start();
    root.classList.add('ui-ready');
  }

  // Umschalter: in der Kopfzeile und im Lesemodus. Neu laden, damit alles aus einem Guss ist.
  function setUi(v) {
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; s.ui = v; s._mt = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    if (window.Kurs) { window.Kurs.state.ui = v; window.Kurs.save(); }
    location.reload();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ui-set]'); if (b) { e.preventDefault(); setUi(b.getAttribute('data-ui-set')); }
    var t = e.target.closest('[data-ui-toggle]'); if (t) { e.preventDefault(); setUi(ui() === 'en' ? 'de' : 'en'); }
  });
  function $$x(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  $$x('[data-ui-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ui-set') === ui()); });
  window.KursI18n = { tr: tr, missing: missing, ui: ui };
})();
