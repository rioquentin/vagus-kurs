// Lernwerkzeuge: Antwort prüfen, Lernkarten (verteilte Wiederholung), Bildlupe, Suche, Fachbegriffe.
// Alle Texte kommen unverändert aus den Kursseiten (assets/data.js wird beim Build daraus erzeugt).
(function () {
  var K = window.Kurs;
  if (!K) return;
  var state = K.state;
  state.cards = state.cards || {};
  var page = K.page;
  var UNIT_PAGES = ['01', '02', '03', '04', '05', '06', '07', '08'];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ---------- Daten (lazy) ----------
  var dataP = null;
  function data() {
    if (window.KURS) return Promise.resolve(window.KURS);
    if (!dataP) dataP = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = 'assets/data.js';
      s.onload = function () { ok(window.KURS); }; s.onerror = fail;
      document.head.appendChild(s);
    });
    return dataP;
  }
  // Link an eine Stelle im Kurs: Abschnitt anspringen und das Wort danach markieren (?hl=)
  function jump(file, sec, word) { return file + (word ? '?hl=' + encodeURIComponent(word) : '') + (sec ? '#' + sec : ''); }
  function highlight() {
    var p = new URLSearchParams(location.search), w = p.get('hl');
    if (!w) return;
    var wrap = $('.wrap'), from = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    var it = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (n.parentElement.closest('script, style, svg, .qa-btn')) return NodeFilter.FILTER_REJECT;
      if (from && !(from.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && !from.contains(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT; } });
    var lw = w.toLowerCase(), n;
    while ((n = it.nextNode())) {
      var i = n.data.toLowerCase().indexOf(lw);
      if (i < 0) continue;
      var r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length);
      var m = el('mark', 'hl'); r.surroundContents(m);
      var d = m.closest('details'); if (d) d.open = true;
      setTimeout(function () { m.scrollIntoView({ block: 'center' }); }, 60);
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
  }
  function unitOf(d, id) { return d.units.filter(function (u) { return u.id === id; })[0]; }

  // ---------- Verteilte Wiederholung (Leitner, 7 Fächer) ----------
  // Fach 0 = gerade nicht gewusst. Gewusst schiebt ein Fach weiter; das Fach bestimmt den Abstand in Tagen.
  var INTERVAL = [0, 1, 3, 7, 14, 30, 60];
  function today() { return Math.floor((Date.now() - 4 * 3600e3 - new Date().getTimezoneOffset() * 60e3) / 864e5); } // Tageswechsel um 4 Uhr
  function info(id) { return state.cards[id] || null; }
  function isDue(id) { var c = info(id); return !!c && c.d <= today(); }
  function next(id, r) {
    var fresh = !info(id);
    var c = info(id) || { b: 0, d: today(), n: 0 };
    // Beim ersten Mal gleich gewusst: direkt Fach 2 (3 Tage), sonst wäre es dasselbe wie „Unsicher“
    var b = r === 2 ? Math.min(fresh ? 2 : c.b + 1, 6) : r === 1 ? Math.max(1, c.b > 2 ? c.b - 1 : c.b) : 0;
    var days = r === 2 ? INTERVAL[b] : r === 1 ? 1 : 0;
    return { b: b, d: today() + days, n: (c.n || 0) + 1, r: r };
  }
  function rate(id, r) { state.cards[id] = next(id, r); K.save(); badges(); return state.cards[id]; }
  function whenText(days) { return days <= 0 ? 'heute nochmal' : days === 1 ? 'morgen' : 'in ' + days + ' Tagen'; }
  function hint(id, r) { return whenText(next(id, r).d - today()); }
  var LEVEL = function (c) { return !c ? 'neu' : c.b >= 3 ? 'sitzt' : c.b >= 1 ? 'im Aufbau' : 'wiederholen'; };

  function dueTotal() { var t = today(); return Object.keys(state.cards).filter(function (k) { return state.cards[k].d <= t; }).length; }
  function badges() {
    var n = dueTotal();
    $$('[data-due]').forEach(function (b) { b.hidden = !n; b.textContent = n; b.title = n + ' Karten fällig'; });
    var head = $('[data-review-head]');
    if (head) {
      var total = +head.getAttribute('data-total');
      var seen = Object.keys(state.cards).filter(function (k) { return k.indexOf('T:') !== 0; }).length;
      head.textContent = n ? n + (n === 1 ? ' Karte ist fällig' : ' Karten sind fällig') : seen ? 'Heute nichts fällig' : total + ' Lernkarten warten';
      var sub = $('[data-review-sub]');
      if (sub && seen) sub.textContent = seen + ' von ' + total + ' Fragen schon geübt. Was sitzt, kommt seltener; was wackelt, öfter.';
    }
  }

  // ---------- Antwort prüfen, direkt bei der Frage ----------
  function inlineChecks() {
    if (UNIT_PAGES.indexOf(page) < 0) return;
    var sol = $$('.wrap details').filter(function (d) { var s = d.querySelector('summary'); return s && /^Lösungen/.test(s.textContent.trim()); })[0];
    if (!sol) return;
    var answers = {};
    $$('p', sol).forEach(function (p) { var b = p.firstElementChild; var m = b && b.tagName === 'B' && /^F(\d+)\.$/.exec(b.textContent.trim()); if (m) answers[m[1]] = p; });
    $$('.wrap b').forEach(function (b) {
      var m = /^F(\d+)\.$/.exec(b.textContent.trim());
      var host = b.parentElement;
      if (!m || !answers[m[1]] || b.closest('details') || !host || (host.tagName !== 'LI' && host.tagName !== 'P') || host.firstElementChild !== b) return;
      var id = page + '-F' + m[1];
      var btn = el('button', 'qa-btn');
      btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
      host.appendChild(document.createTextNode(' '));
      host.appendChild(btn);
      var panel = null;
      function label() {
        var c = info(id);
        btn.dataset.level = c ? LEVEL(c) : '';
        btn.innerHTML = (btn.getAttribute('aria-expanded') === 'true' ? 'Antwort ausblenden' : 'Antwort prüfen') + (c ? ' <span class="qa-lv">· ' + LEVEL(c) + '</span>' : '');
      }
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        if (open) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); label(); return; }
        if (!panel) {
          var a = answers[m[1]].cloneNode(true); a.removeChild(a.firstElementChild);
          panel = el('div', 'qa');
          panel.innerHTML = '<span class="eyebrow">Lösung aus dem Kurs</span><p class="qa-a">' + a.innerHTML.trim() + '</p>' +
            '<div class="qa-rate"><span class="note">Selbst bewertet:</span>' +
            '<button type="button" data-r="0">Nochmal</button><button type="button" data-r="1">Unsicher</button><button type="button" data-r="2">Gewusst</button>' +
            '<span class="note qa-out" aria-live="polite"></span></div>';
          if (host.tagName === 'LI') host.appendChild(panel); else host.parentNode.insertBefore(panel, host.nextSibling);
          $$('[data-r]', panel).forEach(function (rb) {
            rb.addEventListener('click', function () {
              var c = rate(id, +rb.getAttribute('data-r'));
              $$('[data-r]', panel).forEach(function (x) { x.setAttribute('aria-pressed', x === rb); });
              $('.qa-out', panel).textContent = 'Kommt ' + whenText(c.d - today()) + ' wieder in den Lernkarten.';
              label();
            });
          });
        }
        panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); label();
      });
      label();
    });
  }

  // ---------- Bildlupe ----------
  var Z = null;
  function zoomSetup() {
    var dlg = $('#zoom'); if (!dlg) return;
    $$('.wrap svg').forEach(function (svg) {
      if (svg.closest('.z-canvas, button, td, .sw')) return;
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (!vb || !vb.width || vb.width < 280) return;
      var host = svg.closest('.figure, .plate') || svg.parentElement;
      if (host.querySelector(':scope > .z-open')) return;
      host.classList.add('has-zoom');
      var b = el('button', 'z-open', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg><span>Vergrößern</span>');
      b.type = 'button';
      b.addEventListener('click', function () { openZoom(svg, host); });
      host.appendChild(b);
      // Klick auf die Abbildung selbst öffnet ebenfalls die Lupe (nicht bei Abbildungen mit eigenen Bedienelementen)
      if (!svg.querySelector('a, button, [tabindex]')) svg.addEventListener('click', function () { openZoom(svg, host); });
    });
    var stage = $('.z-stage', dlg), canvas = $('.z-canvas', dlg), pct = $('.z-pct', dlg);
    Z = { s: 1, x: 0, y: 0, fit: 1, svg: null, vb: null };
    function apply() {
      if (!Z.svg) return;
      Z.svg.style.width = Z.vb.width * Z.s + 'px'; Z.svg.style.height = Z.vb.height * Z.s + 'px';
      Z.svg.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px)';
      pct.textContent = Math.round(Z.s * 100) + ' %';
    }
    function fit() {
      var W = stage.clientWidth, H = stage.clientHeight;
      Z.fit = Math.min(W / Z.vb.width, H / Z.vb.height) * 0.96;
      Z.s = Z.fit; Z.x = (W - Z.vb.width * Z.s) / 2; Z.y = (H - Z.vb.height * Z.s) / 2; apply();
    }
    function zoomAt(f, cx, cy) {
      var ns = Math.max(Z.fit * 0.5, Math.min(8, Z.s * f));
      if (cx == null) { cx = stage.clientWidth / 2; cy = stage.clientHeight / 2; }
      Z.x = cx - (cx - Z.x) * (ns / Z.s); Z.y = cy - (cy - Z.y) * (ns / Z.s); Z.s = ns; apply();
    }
    function openZoom(svg, host) {
      canvas.innerHTML = '';
      var c = svg.cloneNode(true);
      c.removeAttribute('width'); c.removeAttribute('height');
      c.setAttribute('aria-hidden', 'false');
      canvas.appendChild(c);
      // SVG-Schema oder Atlas-Bild (img mit width/height)
      Z.svg = c; Z.vb = svg.tagName === 'IMG' ? { width: +svg.getAttribute('width'), height: +svg.getAttribute('height') } : svg.viewBox.baseVal;
      var cap = host.querySelector('.figcap, .caption, figcaption');
      var t = cap && cap.querySelector('b');
      $('#zoom-t').textContent = svg.tagName === 'IMG' ? svg.alt : t ? t.textContent : (svg.querySelector('title') || {}).textContent || 'Abbildung';
      $('.z-cap', dlg).textContent = cap ? cap.textContent : '';
      dlg.showModal();
      requestAnimationFrame(fit);
    }
    $$('[data-zoom-img]').forEach(function (b) {
      b.addEventListener('click', function () { openZoom(b.querySelector('img'), b.closest('.atlas-card')); });
    });
    $$('[data-z]', dlg).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-z');
        if (a === 'in') zoomAt(1.4); else if (a === 'out') zoomAt(1 / 1.4); else if (a === 'fit') fit(); else dlg.close();
      });
    });
    var pts = {}, last = null;
    function mid() { var p = Object.keys(pts).map(function (k) { return pts[k]; }); var r = stage.getBoundingClientRect();
      if (p.length === 1) return { x: p[0].x - r.left, y: p[0].y - r.top, d: 0 };
      return { x: (p[0].x + p[1].x) / 2 - r.left, y: (p[0].y + p[1].y) / 2 - r.top, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) }; }
    stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; last = mid(); });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var m = mid();
      if (last) { Z.x += m.x - last.x; Z.y += m.y - last.y; if (m.d && last.d) { zoomAt(m.d / last.d, m.x, m.y); } else apply(); }
      last = m;
    });
    function up(e) { delete pts[e.pointerId]; last = Object.keys(pts).length ? mid() : null; }
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) { e.preventDefault(); var r = stage.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener('dblclick', function (e) { var r = stage.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') zoomAt(1.4); else if (e.key === '-') zoomAt(1 / 1.4); else if (e.key === '0') fit();
      else if (/^Arrow/.test(e.key)) { var d = 60; Z.x += e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0; Z.y += e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0; apply(); e.preventDefault(); }
    });
    window.addEventListener('resize', function () { if (dlg.open) fit(); });
    dlg.addEventListener('close', function () { canvas.innerHTML = ''; Z.svg = null; });
  }

  // ---------- Suche ----------
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function searchSetup() {
    var dlg = $('#search'); if (!dlg) return;
    var q = $('#search-q'), list = $('#search-r'), sel = 0, hits = [];
    function open() { if (dlg.open) return; dlg.showModal(); q.select(); data().then(run); }
    $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', function () {
      var side = $('#sidebar'); if (side) { side.classList.remove('open'); $('.scrim').classList.remove('open'); }
      open(); }); });
    $$('[data-close-search]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); open(); }
    });
    function snippet(body, toks) {
      var nb = norm(body), at = -1;
      toks.forEach(function (t) { var i = nb.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; });
      var a = Math.max(0, at - 70), b = Math.min(body.length, at + 130);
      var s = (a > 0 ? '… ' : '') + body.slice(a, b) + (b < body.length ? ' …' : '');
      var out = esc(s), ns = norm(out);
      // markieren (Länge bleibt bei NFD-Normalisierung gleich)
      var marks = [];
      toks.forEach(function (t) { var i = 0; while ((i = ns.indexOf(t, i)) >= 0) { marks.push([i, i + t.length]); i += t.length; } });
      marks.sort(function (x, y) { return x[0] - y[0]; });
      var res = '', pos = 0;
      marks.forEach(function (m) { if (m[0] < pos) return; res += out.slice(pos, m[0]) + '<mark>' + out.slice(m[0], m[1]) + '</mark>'; pos = m[1]; });
      return res + out.slice(pos);
    }
    function run() {
      var d = window.KURS; if (!d) return;
      var raw = q.value.trim(), toks = norm(raw).split(/\s+/).filter(function (t) { return t.length > 1; });
      hits = [];
      if (toks.length) {
        d.terms.forEach(function (t) {
          var n = norm(t.term + ' ' + (t.lat || ''));
          if (toks.every(function (k) { return n.indexOf(k) >= 0; })) hits.push({ score: 50 + (norm(t.term).indexOf(toks[0]) === 0 ? 20 : 0), kind: 'Begriff', unit: t.unit, sec: t.sec, title: t.term + (t.lat ? ' (' + t.lat + ')' : ''), text: t.ctx, word: t.term });
        });
        d.sections.forEach(function (s) {
          var nt = norm(s.title), nb = norm(s.body);
          if (!toks.every(function (k) { return nt.indexOf(k) >= 0 || nb.indexOf(k) >= 0; })) return;
          var score = 0;
          toks.forEach(function (k) { if (nt.indexOf(k) >= 0) score += 10; score += Math.min(8, nb.split(k).length - 1); });
          var ob = s.body, i = norm(ob).indexOf(toks[0]);
          var word = i >= 0 ? ob.slice(i, ob.indexOf(' ', i + toks[0].length) > 0 ? ob.indexOf(' ', i + toks[0].length) : undefined).replace(/[.,;:)„“"]+$/, '') : '';
          hits.push({ score: score, kind: 'Abschnitt', unit: s.unit, sec: s.id, title: s.title, text: s.body, word: word });
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        hits = hits.slice(0, 30);
      }
      sel = 0;
      list.innerHTML = !toks.length ? '<li class="s-empty">Tippe einen Begriff. Durchsucht werden alle Abschnitte, Lösungen und Fachbegriffe.</li>'
        : !hits.length ? '<li class="s-empty">Nichts gefunden für „' + esc(raw) + '“.</li>'
        : hits.map(function (h, i) {
          var u = unitOf(d, h.unit);
          var href = jump(u.file, h.sec, h.word);
          return '<li role="option" id="sr' + i + '"' + (i === 0 ? ' aria-selected="true"' : '') + '><a href="' + href + '"><span class="eyebrow">' + esc(h.kind) + ' · ' + (u.n === '·' ? 'Styleguide' : 'Abschnitt ' + u.n) + '</span><b>' + esc(h.title) + '</b><span class="s-snip">' + snippet(h.text, toks) + '</span></a></li>';
        }).join('');
    }
    q.addEventListener('input', function () { data().then(run); });
    q.addEventListener('keydown', function (e) {
      var items = $$('li[role=option]', list);
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[sel].removeAttribute('aria-selected');
        sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items[sel].setAttribute('aria-selected', 'true'); items[sel].scrollIntoView({ block: 'nearest' });
        q.setAttribute('aria-activedescendant', 'sr' + sel);
      } else if (e.key === 'Enter') { e.preventDefault(); location.href = $('a', items[sel]).href; dlg.close(); }
    });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) dlg.close(); });
  }

  // ---------- Lernkarten ----------
  function flashcards() {
    var root = $('.fc'); if (!root) return;
    var params = new URLSearchParams(location.search);
    var deck = params.get('deck') === 't' ? 't' : 'q';
    var chosen = {}; (params.get('unit') || '').split(',').filter(Boolean).forEach(function (u) { chosen[u] = true; });
    var NEW_LIMIT = 12;
    var d, queue = [], i = 0, tally = { 0: 0, 1: 0, 2: 0 }, repeats = {};

    function units() {
      var picked = Object.keys(chosen).filter(function (k) { return chosen[k]; });
      if (picked.length) return picked;
      var done = UNIT_PAGES.filter(function (u) { return state.done && state.done[u]; });
      return done.length ? done : UNIT_PAGES;
    }
    function pool() {
      var us = units();
      if (deck === 't') return d.terms.filter(function (t) { return t.lat && us.indexOf(t.unit) >= 0; })
        .map(function (t) { return { id: 'T:' + t.term.toLowerCase(), unit: t.unit, sec: t.sec, secT: t.secT, term: t }; });
      return d.cards.filter(function (c) { return us.indexOf(c.unit) >= 0; });
    }
    function plan() {
      var p = pool(), due = p.filter(function (c) { return isDue(c.id); }), fresh = p.filter(function (c) { return !info(c.id); });
      return { due: due, fresh: fresh.slice(0, NEW_LIMIT), freshAll: fresh.length, total: p.length };
    }
    function setup() {
      $$('[data-deck]').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-deck') === deck); });
      $$('[data-unit-chip]').forEach(function (b) { b.setAttribute('aria-pressed', !!chosen[b.getAttribute('data-unit-chip')]); });
      var pl = plan();
      $('[data-fc-plan]').textContent = pl.due.length + ' fällig · ' + pl.fresh.length + ' neu' + (pl.freshAll > pl.fresh.length ? ' (von ' + pl.freshAll + ')' : '') + ' · ' + pl.total + ' im Stapel';
      $('[data-fc-start]').disabled = !(pl.due.length + pl.fresh.length);
      $('[data-fc-start]').textContent = pl.due.length + pl.fresh.length ? 'Lernen starten · ' + (pl.due.length + pl.fresh.length) + ' Karten' : 'Für heute alles gelernt';
      // Wissensstand je Abschnitt
      var rows = UNIT_PAGES.map(function (uid) {
        var u = unitOf(d, uid);
        var ids = deck === 't' ? d.terms.filter(function (t) { return t.lat && t.unit === uid; }).map(function (t) { return 'T:' + t.term.toLowerCase(); })
          : d.cards.filter(function (c) { return c.unit === uid; }).map(function (c) { return c.id; });
        if (!ids.length) return '';
        var sit = 0, bau = 0;
        ids.forEach(function (id) { var c = info(id); if (c && c.b >= 3) sit++; else if (c) bau++; });
        var n = ids.length;
        return '<li><span class="m-n">' + u.n + '</span><span class="m-t">' + esc(u.t) + '</span><span class="m-bar" role="img" aria-label="' + sit + ' sitzen, ' + bau + ' im Aufbau, ' + (n - sit - bau) + ' neu"><i class="m-sit" style="width:' + (sit / n * 100) + '%"></i><i class="m-bau" style="width:' + (bau / n * 100) + '%"></i></span><span class="m-c">' + sit + ' / ' + n + '</span></li>';
      }).join('');
      $('[data-fc-mastery]').innerHTML = '<span class="eyebrow">Wissensstand</span><ul class="m-list">' + rows + '</ul><p class="note"><span class="m-key m-sit"></span> sitzt (mehrfach gewusst) <span class="m-key m-bau"></span> im Aufbau <span class="m-key"></span> noch nicht geübt</p>';
      var all = Object.keys(state.cards).length;
      $('[data-fc-stats]').innerHTML = '<div><b>' + dueTotal() + '</b><span>heute fällig</span></div><div><b>' + Object.keys(state.cards).filter(function (k) { return state.cards[k].b >= 3; }).length + '</b><span>sitzen</span></div><div><b>' + all + '</b><span>schon geübt</span></div><div><b>' + (d.cards.length + d.terms.filter(function (t) { return t.lat; }).length) + '</b><span>Karten insgesamt</span></div>';
    }
    function cardHtml(c) {
      if (c.term) return '<p class="cq-kind eyebrow">Fachbegriff</p><p class="cq-term">' + esc(c.term.term) + '</p><p class="cq-q">Wie lautet der andere Name?</p>';
      var h = '';
      if (c.ctx) h += '<div class="cq-ctx">' + (c.ctx.head ? '<span class="eyebrow">' + esc(c.ctx.head) + '</span>' : '') + '<p>' + c.ctx.html + '</p></div>';
      return h + '<p class="cq-q"><b>' + c.n + '.</b> ' + c.q + '</p>';
    }
    function answerHtml(c) {
      if (c.term) return '<span class="eyebrow">Lösung</span><p class="cq-term">' + esc(c.term.lat) + '</p><p class="note">' + esc(c.term.ctx) + '</p>';
      return '<span class="eyebrow">Lösung aus dem Kurs</span><p>' + c.a + '</p>';
    }
    function show() {
      var c = queue[i];
      var u = unitOf(d, c.unit);
      $('[data-fc-where]').innerHTML = 'Abschnitt ' + u.n + (c.secT ? ' · ' + esc(c.secT) : '') + ' · <a href="' + u.file + (c.sec ? '#' + c.sec : '') + '" target="_blank" rel="noopener">im Kurs ansehen ↗</a>';
      $('[data-fc-count]').textContent = (i + 1) + ' / ' + queue.length;
      $('[data-fc-bar]').style.width = (i / queue.length * 100) + '%';
      $('[data-fc-card]').innerHTML = cardHtml(c);
      $('[data-fc-answer]').hidden = true; $('[data-fc-rate]').hidden = true; $('[data-fc-show-row]').hidden = false;
      $('[data-fc-try]').value = '';
      [0, 1, 2].forEach(function (r) { $('[data-hint="' + r + '"]').textContent = hint(c.id, r); });
      $('[data-fc-show]').focus({ preventScroll: true });
    }
    function reveal() {
      if (!$('[data-fc-rate]').hidden) return;
      $('[data-fc-answer]').innerHTML = answerHtml(queue[i]);
      $('[data-fc-answer]').hidden = false; $('[data-fc-rate]').hidden = false; $('[data-fc-show-row]').hidden = true;
      $('.rate-b.r2').focus({ preventScroll: true });
    }
    function answer(r) {
      var c = queue[i]; rate(c.id, r); tally[r]++;
      if (r === 0 && (repeats[c.id] = (repeats[c.id] || 0) + 1) <= 3) queue.push(c); // gleich noch einmal, höchstens dreimal
      i++;
      if (i < queue.length) show(); else finish();
    }
    function finish() {
      $('[data-fc-run]').hidden = true;
      var t = today(), tomorrow = Object.keys(state.cards).filter(function (k) { return state.cards[k].d === t + 1; }).length;
      var box = $('[data-fc-done]');
      box.hidden = false;
      box.innerHTML = '<span class="eyebrow">Runde beendet</span><h2>' + (tally[2] + tally[1] + tally[0]) + ' Antworten</h2>' +
        '<ul class="tally"><li><b>' + tally[2] + '</b> gewusst</li><li><b>' + tally[1] + '</b> unsicher</li><li><b>' + tally[0] + '</b> nochmal</li></ul>' +
        '<p>Morgen fällig: ' + tomorrow + ' Karten. Kurze tägliche Runden halten länger als eine lange vor der Prüfung.</p>' +
        '<div class="fc-actions"><button class="cta" type="button" data-fc-again>Weitere Karten</button><a class="cta ghost" href="index.html">Zur Kursübersicht</a></div>';
      $('[data-fc-again]').addEventListener('click', function () { box.hidden = true; $('[data-fc-setup]').hidden = false; setup(); });
    }
    function start() {
      var pl = plan();
      queue = pl.due.sort(function (a, b) { return info(a.id).d - info(b.id).d; }).concat(pl.fresh);
      if (!queue.length) return;
      i = 0; tally = { 0: 0, 1: 0, 2: 0 }; repeats = {};
      $('[data-fc-setup]').hidden = true; $('[data-fc-done]').hidden = true; $('[data-fc-run]').hidden = false;
      show();
    }
    data().then(function (dd) {
      d = dd;
      $$('[data-deck]').forEach(function (b) { b.addEventListener('click', function () { deck = b.getAttribute('data-deck'); setup(); }); });
      $$('[data-unit-chip]').forEach(function (b) { b.addEventListener('click', function () { var u = b.getAttribute('data-unit-chip'); chosen[u] = !chosen[u]; setup(); }); });
      $('[data-fc-start]').addEventListener('click', start);
      $('[data-fc-show]').addEventListener('click', reveal);
      $('[data-fc-stop]').addEventListener('click', finish);
      $$('[data-rate]').forEach(function (b) { b.addEventListener('click', function () { answer(+b.getAttribute('data-rate')); }); });
      document.addEventListener('keydown', function (e) {
        if ($('[data-fc-run]').hidden || document.querySelector('dialog[open]')) return;
        var inText = e.target.tagName === 'TEXTAREA';
        if ((e.key === ' ' && !inText) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { if ($('[data-fc-rate]').hidden) { e.preventDefault(); reveal(); } }
        else if (!inText && !$('[data-fc-rate]').hidden && /^[123]$/.test(e.key)) { e.preventDefault(); answer(+e.key - 1); }
      });
      setup();
    });
  }

  // ---------- Fachbegriffe ----------
  function glossary() {
    var list = $('[data-gl-list]'); if (!list) return;
    data().then(function (d) {
      function letter(t) { var c = norm(t.replace(/^[„"(]+/, '')).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; }
      var groups = {};
      d.terms.forEach(function (t) { (groups[letter(t.term)] = groups[letter(t.term)] || []).push(t); });
      var keys = Object.keys(groups).sort();
      function link(unit, sec, secT, word) {
        var u = unitOf(d, unit);
        return '<a href="' + jump(u.file, sec, word) + '">' + 'Abschnitt ' + u.n + (secT ? ' · ' + esc(secT) : '') + '</a>';
      }
      list.innerHTML = keys.map(function (k) {
        return '<section class="gl-g" id="gl-' + k + '" data-g><h2>' + k + '</h2><dl>' + groups[k].map(function (t) {
          return '<div class="gl-e" data-n="' + esc(norm(t.term + ' ' + (t.lat || '') + ' ' + t.ctx)) + '"><dt><b>' + esc(t.term) + '</b>' + (t.lat ? ' <span class="lat">(' + esc(t.lat) + ')</span>' : '') + '</dt><dd><p>' + esc(t.ctx) + '</p><p class="gl-src">' +
            link(t.unit, t.sec, t.secT, t.term) + t.more.map(function (m) { return ' · ' + link(m.unit, m.sec, m.secT, t.term); }).join('') + '</p></dd></div>';
        }).join('') + '</dl></section>';
      }).join('');
      $('[data-gl-az]').innerHTML = keys.map(function (k) { return '<a href="#gl-' + k + '">' + k + '</a>'; }).join('');
      var q = $('[data-gl-q]');
      q.addEventListener('input', function () {
        var v = norm(q.value.trim());
        $$('.gl-e', list).forEach(function (e) { e.hidden = v && e.getAttribute('data-n').indexOf(v) < 0; });
        $$('[data-g]', list).forEach(function (g) { g.hidden = !$$('.gl-e', g).some(function (e) { return !e.hidden; }); });
      });
    });
  }

  // ---------- Umschalter Schema / Anatomie ----------
  // Jeder Umschalter gilt nur für seine eigene Abbildung und merkt sich die Wahl (state.views, Schlüssel „Abb. 1.1“).
  function viewSwitch() {
    var pairs = $$('[data-atlas]').map(function (a) { return { atlas: a, fig: a.previousElementSibling }; })
      .filter(function (p) { return p.fig && p.fig.classList.contains('figure'); });
    if (!pairs.length) return;
    function set(p, v) {
      p.fig.hidden = v === 'atlas'; p.atlas.hidden = v !== 'atlas';
      $$('button', p.sw).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v); });
    }
    delete state.view; // alte gemeinsame Einstellung aus der vorigen Version entfernen
    state.views = state.views || {};
    pairs.forEach(function (p) {
      var cap = p.fig.querySelector('.figcap b');
      p.key = cap ? cap.textContent.trim() : null;
      p.sw = el('div', 'view-sw', '<button type="button" data-view="schema">Schema</button><button type="button" data-view="atlas">Anatomie</button>');
      p.sw.setAttribute('role', 'group'); p.sw.setAttribute('aria-label', 'Darstellung der Abbildung');
      p.fig.parentNode.insertBefore(p.sw, p.fig);
      $$('button', p.sw).forEach(function (b) {
        b.addEventListener('click', function () {
          var top = p.sw.getBoundingClientRect().top;
          var v = b.getAttribute('data-view');
          set(p, v);
          if (p.key) { if (v === 'atlas') state.views[p.key] = v; else delete state.views[p.key]; K.save(); }
          window.scrollBy(0, p.sw.getBoundingClientRect().top - top); // Umschalter bleibt unter dem Finger
        });
      });
      set(p, p.key && state.views[p.key] === 'atlas' ? 'atlas' : 'schema');
    });
  }

  // ---------- Merkheft ----------
  // Einträge: { id, unit, sec, secT, quote, note, star, ts }. Nur im Browser gespeichert.
  state.notes = state.notes || [];
  var COURSE = ['00'].concat(UNIT_PAGES, ['09']);
  function noteCount() { $$('[data-notes-n]').forEach(function (b) { b.hidden = !state.notes.length; b.textContent = state.notes.length; }); }
  function unitInfo(id) {
    var a = $('.ctoc-unit[data-unit="' + id + '"]');
    if (a) return { n: a.querySelector('.ctoc-n').textContent, t: a.querySelector('.ctoc-t').textContent, file: a.getAttribute('href') };
    if (id === '00') return { n: '·', t: 'Visueller Styleguide', file: '00-styleguide.html' };
    return null;
  }
  function noteLink(n) { var u = unitInfo(n.unit); return u ? u.file + '?note=' + n.id + (n.sec ? '#' + n.sec : '') : null; }
  function addNote(n) { n.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); n.ts = Date.now(); n.star = !!n.star; n.note = n.note || ''; state.notes.push(n); K.save(); noteCount(); return n; }
  function removeNote(id) { state.notes = state.notes.filter(function (n) { return n.id !== id; }); K.state.notes = state.notes; K.save(); noteCount(); }
  function findNote(id) { return state.notes.filter(function (n) { return n.id === id; })[0]; }

  // Textknoten der Lesespalte (ohne Abbildungen, Knöpfe, Werkzeuge)
  function textNodes(root) {
    var out = [], it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (t) {
      return t.parentElement.closest('svg, script, style, button, select, textarea, .qa-btn, .sel-pop, .view-sw, .z-open, dialog') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    for (var n; (n = it.nextNode());) out.push(n);
    return out;
  }
  function sectionOf(node) {
    var heads = $$('.wrap h2[id]'), cur = null;
    heads.forEach(function (h) { if (h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) cur = h; });
    return cur ? { id: cur.id, t: cur.textContent.trim() } : { id: null, t: ($('.wrap h1') || {}).textContent || '' };
  }
  // Gespeicherte Stelle im Text wiederfinden und markieren (auch über Elementgrenzen hinweg)
  function markQuote(n) {
    var wrap = $('.wrap'); if (!wrap || !n.quote) return null;
    var nodes = textNodes(wrap), full = '', starts = [];
    nodes.forEach(function (t) { starts.push(full.length); full += t.data; });
    var words = n.quote.trim().split(/\s+/).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    var m = new RegExp(words.join('\\s*')).exec(full);
    if (!m) return null;
    var a = m.index, b = m.index + m[0].length, first = null;
    for (var i = nodes.length - 1; i >= 0; i--) {
      var s = starts[i], e = s + nodes[i].data.length;
      if (e <= a || s >= b) continue;
      var r = document.createRange();
      r.setStart(nodes[i], Math.max(0, a - s)); r.setEnd(nodes[i], Math.min(nodes[i].data.length, b - s));
      if (r.collapsed || !r.toString().trim()) continue;
      var mk = el('mark', 'saved' + (n.star ? ' star' : '')); mk.setAttribute('data-note', n.id);
      mk.title = n.note ? 'Notiz: ' + n.note : 'Im Merkheft';
      r.surroundContents(mk); first = mk;
    }
    return first;
  }

  function notebookInPage() {
    if (COURSE.indexOf(page) < 0 || !$('.wrap')) return;
    var mine = state.notes.filter(function (n) { return n.unit === page && n.quote; });
    mine.forEach(function (n) { markQuote(n); });
    // Ankunft aus dem Merkheft: Stelle zeigen
    var p = new URLSearchParams(location.search), want = p.get('note');
    if (want) {
      var mk = $('mark.saved[data-note="' + want + '"]');
      if (mk) { var d = mk.closest('details'); if (d) d.open = true; mk.classList.add('flash'); setTimeout(function () { mk.scrollIntoView({ block: 'center' }); }, 60); }
      history.replaceState(null, '', location.pathname + location.hash);
    }

    var pop = el('div', 'sel-pop'); pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Stelle merken');
    document.body.appendChild(pop);
    var pending = null, lastPick = null; // lastPick überlebt, falls ein Tipp die Auswahl vor dem Klick aufhebt
    function place(rect) {
      var coarse = matchMedia('(pointer: coarse)').matches;
      pop.hidden = false;
      var w = pop.offsetWidth, h = pop.offsetHeight;
      var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), innerWidth - w - 8);
      // Auf Touch unter die Auswahl, damit das Systemmenü oben frei bleibt
      var y = coarse || rect.top - h - 10 < 60 ? rect.bottom + 10 : rect.top - h - 10;
      pop.style.left = x + 'px'; pop.style.top = Math.min(y, innerHeight - h - 8) + 'px';
    }
    function hide() { pop.hidden = true; pending = null; }
    function showSave(range) {
      var q = range.toString().replace(/\s+/g, ' ').trim();
      var sec = sectionOf(range.startContainer);
      pending = lastPick = { unit: page, sec: sec.id, secT: sec.t, quote: q };
      pop.innerHTML = '<button type="button" data-a="save">★ Merken</button><button type="button" data-a="note">+ Notiz</button>';
      place(range.getBoundingClientRect());
    }
    function showNoteBox(saved) {
      pop.innerHTML = '<label class="eyebrow" for="sel-note">Deine Notiz</label><textarea id="sel-note" rows="3"></textarea><div class="sel-row"><button type="button" data-a="done">Speichern</button><button type="button" data-a="cancel">Ohne Notiz</button></div>';
      pending = saved;
      var t = $('#sel-note'); t.value = saved.note || ''; t.focus();
    }
    function showView(n, mk) {
      pending = n;
      pop.innerHTML = (n.note ? '<p class="sel-note">' + esc(n.note) + '</p>' : '<p class="note">Im Merkheft gespeichert.</p>') +
        '<div class="sel-row"><button type="button" data-a="edit">' + (n.note ? 'Notiz ändern' : '+ Notiz') + '</button><a href="merkheft.html">Merkheft</a><button type="button" data-a="del">Entfernen</button></div>';
      place(mk.getBoundingClientRect());
    }
    pop.addEventListener('mousedown', function (e) { if (!e.target.closest('textarea')) e.preventDefault(); }); // Auswahl nicht verlieren
    pop.addEventListener('click', function (e) {
      e.stopPropagation(); // Inhalt wird gleich ersetzt; der Dokument-Klick würde sonst „außerhalb“ sehen und schließen
      var a = e.target.closest('[data-a]'); if (!a) return;
      var act = a.getAttribute('data-a');
      if (act === 'save' || act === 'note') {
        var src = pending && !pending.id ? pending : lastPick;
        if (!src) { hide(); return; }
        lastPick = null;
        var n = addNote(src); markQuote(n);
        var s = getSelection(); if (s) s.removeAllRanges();
        if (act === 'note') { showNoteBox(n); return; }
        pop.innerHTML = '<p class="note">Gemerkt. <a href="merkheft.html">Zum Merkheft</a></p>';
        setTimeout(hide, 1600);
      } else if (act === 'done') {
        var t = $('#sel-note'); pending.note = t.value.trim(); K.save();
        $$('mark.saved[data-note="' + pending.id + '"]').forEach(function (m) { m.title = pending.note ? 'Notiz: ' + pending.note : 'Im Merkheft'; });
        hide();
      } else if (act === 'cancel') hide();
      else if (act === 'edit') showNoteBox(pending);
      else if (act === 'del') {
        $$('mark.saved[data-note="' + pending.id + '"]').forEach(function (m) { m.replaceWith.apply(m, Array.prototype.slice.call(m.childNodes)); });
        removeNote(pending.id); hide();
      }
    });
    var timer;
    function check() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var s = getSelection();
        if (!s || s.isCollapsed || !s.rangeCount) { if (pending && !pending.id) hide(); return; }
        var r = s.getRangeAt(0), wrap = $('.wrap');
        var anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
        var len = s.toString().trim().length;
        if (!wrap.contains(anc) || anc.closest('svg, button, textarea, input, select, .sel-pop') || len < 3 || len > 2000) return;
        showSave(r);
      }, 250);
    }
    document.addEventListener('selectionchange', check);
    document.addEventListener('click', function (e) {
      var mk = e.target.closest('mark.saved');
      if (mk && (!getSelection() || getSelection().isCollapsed)) { var n = findNote(mk.getAttribute('data-note')); if (n) { e.preventDefault(); showView(n, mk); } return; }
      if (!e.target.closest('.sel-pop') && pending && pending.id) hide();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) hide(); });
    window.addEventListener('scroll', function () { if (!pop.hidden && !(pending && pending.id && $('#sel-note'))) hide(); }, { passive: true });
  }

  function notebookPage() {
    var list = $('[data-nb-list]'); if (!list) return;
    var q = $('[data-nb-q]'), star = $('[data-nb-star]');
    function date(ts) { return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function groups() {
      var order = COURSE.concat(['']), by = {};
      state.notes.forEach(function (n) { (by[n.unit || ''] = by[n.unit || ''] || []).push(n); });
      return order.filter(function (k) { return by[k]; }).map(function (k) { return { unit: k, notes: by[k].sort(function (a, b) { return a.ts - b.ts; }) }; });
    }
    function render() {
      var v = norm(q.value.trim()), onlyStar = star.checked;
      if (!state.notes.length) {
        list.innerHTML = '<div class="nb-empty"><p><b>Noch leer.</b> Markiere im Kurs einen Satz mit der Maus oder lange mit dem Finger, dann erscheint <b>★ Merken</b>.</p><p class="note">Gut geeignet: Merksätze, Stellen, die du nicht sofort verstanden hast, und was in der Prüfung drankommen könnte.</p></div>';
        return;
      }
      var html = groups().map(function (g) {
        var u = g.unit ? unitInfo(g.unit) : null;
        var items = g.notes.filter(function (n) {
          return (!onlyStar || n.star) && (!v || norm((n.quote || '') + ' ' + n.note + ' ' + (n.secT || '')).indexOf(v) >= 0);
        });
        if (!items.length) return '';
        return '<section class="nb-g"><h2>' + (u ? '<span class="nb-n">' + esc(u.n) + '</span> ' + esc(u.t) : 'Allgemein') + '</h2>' + items.map(function (n) {
          var link = n.quote ? noteLink(n) : null;
          return '<article class="nb-e' + (n.star ? ' is-star' : '') + '" data-id="' + n.id + '">' +
            '<div class="nb-top"><span class="eyebrow">' + esc(n.secT || (n.quote ? '' : 'Freie Notiz')) + '</span><span class="note">' + date(n.ts) + '</span></div>' +
            (n.quote ? '<blockquote>' + esc(n.quote) + '</blockquote>' : '') +
            '<textarea rows="' + Math.max(1, Math.min(6, (n.note.match(/\n/g) || []).length + 1)) + '" placeholder="' + (n.quote ? 'Eigene Notiz dazu …' : '') + '" aria-label="Notiz">' + esc(n.note) + '</textarea>' +
            '<div class="nb-act"><button type="button" class="nb-star" data-star aria-pressed="' + n.star + '">' + (n.star ? '★ wichtig' : '☆ wichtig') + '</button>' +
            (link ? '<a href="' + link + '">Zur Stelle im Kurs →</a>' : '') + '<button type="button" data-del>Löschen</button></div></article>';
        }).join('') + '</section>';
      }).join('');
      list.innerHTML = html || '<p class="note">Keine Einträge für diesen Filter.</p>';
    }
    var t;
    list.addEventListener('input', function (e) {
      var ta = e.target.closest('textarea'); if (!ta) return;
      var n = findNote(ta.closest('[data-id]').getAttribute('data-id'));
      n.note = ta.value; clearTimeout(t); t = setTimeout(K.save, 400);
    });
    list.addEventListener('click', function (e) {
      var art = e.target.closest('[data-id]'); if (!art) return;
      var n = findNote(art.getAttribute('data-id'));
      if (e.target.closest('[data-star]')) { n.star = !n.star; K.save(); render(); }
      else if (e.target.closest('[data-del]')) {
        removeNote(n.id); render();
        var bar = el('div', 'nb-undo', 'Eintrag gelöscht. <button type="button">Rückgängig</button>');
        document.body.appendChild(bar);
        bar.querySelector('button').addEventListener('click', function () { state.notes.push(n); K.save(); noteCount(); render(); bar.remove(); });
        setTimeout(function () { bar.remove(); }, 6000);
      }
    });
    q.addEventListener('input', render); star.addEventListener('change', render);
    $('[data-nb-add]').addEventListener('click', function () {
      var ta = $('#nb-free'), txt = ta.value.trim(); if (!txt) { ta.focus(); return; }
      addNote({ unit: $('[data-nb-free-unit]').value || '', sec: null, secT: '', quote: '', note: txt });
      ta.value = ''; render();
    });
    $('[data-nb-print]').addEventListener('click', function () { window.print(); });
    $('[data-nb-export]').addEventListener('click', function () {
      var md = '# Merkheft · N. vagus und Stimme\n\nStand: ' + date(Date.now()) + '\n';
      groups().forEach(function (g) {
        var u = g.unit ? unitInfo(g.unit) : null;
        md += '\n## ' + (u ? 'Abschnitt ' + u.n + ' · ' + u.t : 'Allgemein') + '\n';
        g.notes.forEach(function (n) {
          md += '\n' + (n.star ? '★ ' : '') + (n.secT ? '**' + n.secT + '**\n' : '') + (n.quote ? '> ' + n.quote + '\n' : '') + (n.note ? '\n' + n.note + '\n' : '');
        });
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
      a.download = 'merkheft-vagus-kurs-' + new Date().toISOString().slice(0, 10) + '.md';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
    render();
  }

  inlineChecks(); highlight(); viewSwitch(); notebookInPage(); notebookPage(); noteCount(); zoomSetup(); searchSetup(); flashcards(); glossary(); badges();
})();
