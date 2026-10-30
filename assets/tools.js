// Lernwerkzeuge an den Kursseiten: Beschriftung verdecken, Zeichnen aus dem Gedächtnis,
// Lesemodus (Schrift/Größe) und Vorlesen. Nichts davon verändert den Kursinhalt.
(function () {
  var K = window.Kurs; if (!K) return;
  var state = K.state;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var NS = 'http://www.w3.org/2000/svg';

  // ---------- 1 · Beschriftung verdecken ----------
  // Verdeckt werden Beschriftungen, nicht Ausrichtungsmarken (vorne/hinten, R/L), Spaltenköpfe oder lange Erklärsätze.
  function labelTexts(svg) {
    return $$('text', svg).filter(function (t) {
      if (t.closest('.lbl-covers')) return false;
      if (t.matches('.t-or, .t-head')) return false;
      var s = t.textContent.trim();
      return s.length > 0 && s.length <= 45 && !/^[RL]$/.test(s);
    });
  }
  function cover(svg) {
    uncover(svg);
    var n = 0;
    labelTexts(svg).forEach(function (t) {
      var b; try { b = t.getBBox(); } catch (e) { return; }
      if (!b.width || !b.height || getComputedStyle(t).display === 'none') return;
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('class', 'lbl-cover'); r.setAttribute('x', b.x - 2); r.setAttribute('y', b.y - 1.5);
      r.setAttribute('width', b.width + 4); r.setAttribute('height', b.height + 3); r.setAttribute('rx', 3);
      r.setAttribute('tabindex', '0'); r.setAttribute('role', 'button'); r.setAttribute('aria-label', 'Beschriftung aufdecken');
      t.parentNode.insertBefore(r, t.nextSibling); // gleiches Koordinatensystem wie der Text
      n++;
    });
    svg.dataset.covers = n;
    return n;
  }
  function uncover(svg) { $$('.lbl-cover', svg).forEach(function (r) { r.remove(); }); delete svg.dataset.covers; }
  function count(svg) {
    var all = $$('.lbl-cover', svg).length, open = $$('.lbl-cover.open', svg).length;
    return { all: all, open: open };
  }
  function updateBar(host) {
    var svg = $('svg[viewBox]', host), bar = $('.lbl-bar', host); if (!svg || !bar) return;
    var on = host.classList.contains('lbl-on'), c = count(svg);
    bar.querySelector('[data-lbl]').textContent = on ? 'Beschriftung zeigen' : 'Beschriftung verdecken';
    bar.querySelector('[data-lbl]').setAttribute('aria-pressed', on);
    bar.querySelector('.lbl-n').textContent = on && !host.F ? c.open + ' von ' + c.all + ' aufgedeckt' : '';
    bar.querySelector('[data-lbl-all]').hidden = !on || !!host.F;
    bar.querySelector('[data-lbl-find]').hidden = !on || !!host.F;
  }

  // Umgekehrt üben: „Tippe auf: R. internus“. Richtig beim ersten Versuch zählt; gleiche Beschriftungen gelten alle.
  // Mehrzeilige Beschriftungen („Pars“ / „intermembranacea“) sind einzelne <text>: übereinander am gleichen x = ein Begriff
  function groupCovers(svg) {
    var groups = [], last = null;
    $$('.lbl-cover', svg).forEach(function (r) {
      var t = r.previousElementSibling, b = t.getBBox(), x = t.getAttribute('x'), a = getComputedStyle(t).textAnchor;
      var same = last && last.t.parentNode === t.parentNode && last.x === x && last.a === a && b.y - (last.b.y + last.b.height) < b.height * 0.8 && b.y > last.b.y;
      var g = same ? last.g : { covers: [], words: [] };
      if (!same) groups.push(g);
      g.covers.push(r); g.words.push(t.textContent.replace(/\s+/g, ' ').trim());
      last = { t: t, b: b, x: x, a: a, g: g };
    });
    // Trennstrich am Zeilenende gehört nicht zum Wort: „crico-“ + „thyroideus“ = „cricothyroideus“
    groups.forEach(function (g) { g.text = g.words.join(' ').replace(/-\s([a-zäöüß])/g, '$1'); g.covers.forEach(function (r) { r._g = g; }); });
    return groups;
  }
  function textOf(r) { return r._g ? r._g.text : ''; }
  function findStart(host) {
    var svg = $('svg[viewBox]', host);
    $$('.lbl-cover', svg).forEach(function (r) { r.classList.remove('open', 'ok', 'bad', 'hint'); });
    // Ziffern, „ja“/„nein“ und Zeichen sind keine Begriffe zum Suchen
    var seen = {}, list = groupCovers(svg).map(function (g) { return g.text; }).filter(function (s) {
      if (!s || seen[s] || s.length < 3 || /^(\d+|ja|nein|[!?+×·→↔–-]+)$/i.test(s)) return false; seen[s] = 1; return true;
    });
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = list[i]; list[i] = list[j]; list[j] = x; }
    host.F = { list: list, i: 0, first: 0, miss: false };
    findAsk(host);
  }
  function findAsk(host) {
    var F = host.F, q = $('.lbl-q', host);
    if (F.i >= F.list.length) {
      var when = figSchedule(host, F.list.length ? F.first / F.list.length : 1);
      q.innerHTML = '<span>Fertig: <b>' + F.first + ' von ' + F.list.length + '</b> beim ersten Versuch gefunden.</span>' + (when ? ' <span class="note">' + when + '</span>' : '') + ' <button type="button" class="linkbtn" data-find-again>Nochmal</button> <button type="button" class="linkbtn" data-find-stop>Beenden</button>';
      if (F.first === F.list.length && K.bloom) K.bloom(q.querySelector('span'));
      return;
    }
    q.innerHTML = '<span>Tippe auf: <b>' + F.list[F.i].replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</b></span> <span class="note">' + (F.i + 1) + ' / ' + F.list.length + '</span> <button type="button" class="linkbtn" data-find-stop>Beenden</button>';
    F.miss = false;
  }
  function findTap(host, r) {
    var F = host.F, want = F.list[F.i], svg = $('svg[viewBox]', host);
    if (!want || r.classList.contains('ok')) return;
    if (textOf(r) === want) {
      $$('.lbl-cover', svg).forEach(function (x) { if (textOf(x) === want) x.classList.add('open', 'ok'); x.classList.remove('hint'); });
      if (!F.miss) F.first++;
      F.i++; setTimeout(function () { findAsk(host); }, 450);
    } else {
      F.miss = true; r.classList.add('bad'); setTimeout(function () { r.classList.remove('bad'); }, 500);
      $$('.lbl-cover', svg).forEach(function (x) { if (textOf(x) === want) { x.classList.add('hint'); setTimeout(function () { x.classList.remove('hint'); }, 1400); } });
    }
  }
  // Abbildungen wie Karten wiederholen: state.figs["Abb. 1.1"] = { b: Fach, d: fällig am (Tag), s: letzte Quote }
  var FIG_DAYS = [1, 3, 7, 14, 30];
  function dayNow() { return Math.floor((Date.now() - 4 * 3600e3 - new Date().getTimezoneOffset() * 60e3) / 864e5); }
  function figSchedule(host, ratio) {
    var cap = $('.figcap b', host); if (!cap) return '';
    var abb = cap.textContent.trim(); state.figs = state.figs || {};
    var f = state.figs[abb] || { b: 0 }, first = !state.figs[abb], b = ratio >= 0.9 ? Math.min(first ? 2 : (f.b || 0) + 1, FIG_DAYS.length) : ratio >= 0.6 ? Math.max(1, f.b || 0) : 0;
    var days = b ? FIG_DAYS[b - 1] : 1;
    state.figs[abb] = { b: b, d: dayNow() + days, s: Math.round(ratio * 100) / 100 }; K.save();
    return 'Kommt ' + (days === 1 ? 'morgen' : 'in ' + days + ' Tagen') + ' wieder in „Heute“.';
  }
  function findStop(host) { host.F = null; host.classList.remove('lbl-finding'); $('.lbl-q', host).innerHTML = ''; updateBar(host); }
  function labelSetup() {
    $$('.wrap .figure').forEach(function (host) {
      var svg = $('svg[viewBox]', host);
      if (!svg || labelTexts(svg).length < 3) return;
      var bar = el('div', 'lbl-bar', '<button type="button" class="lbl-btn" data-lbl aria-pressed="false">Beschriftung verdecken</button><span class="lbl-n note" aria-live="polite"></span><button type="button" class="linkbtn" data-lbl-all hidden>alle aufdecken</button><button type="button" class="linkbtn" data-lbl-find hidden>Finden üben</button><span class="lbl-q" aria-live="polite"></span>');
      // Gleiche Werkzeugzeile wie „Vergrößern“ (study.js), unter der Abbildung
      var row = host.querySelector(':scope > .fig-tools');
      if (!row) { row = el('div', 'fig-tools'); host.insertBefore(row, $('.figcap', host)); }
      row.insertBefore(bar, row.firstChild);
      bar.querySelector('[data-lbl]').addEventListener('click', function () {
        var on = !host.classList.contains('lbl-on');
        host.classList.toggle('lbl-on', on);
        if (on) cover(svg); else { uncover(svg); if (host.F) findStop(host); }
        updateBar(host);
      });
      bar.querySelector('[data-lbl-find]').addEventListener('click', function () { cover(svg); host.classList.add('lbl-finding'); findStart(host); updateBar(host); });
      bar.addEventListener('click', function (e) {
        if (e.target.closest('[data-find-stop]')) { findStop(host); cover(svg); updateBar(host); }
        else if (e.target.closest('[data-find-again]')) findStart(host);
      });
      bar.querySelector('[data-lbl-all]').addEventListener('click', function () { $$('.lbl-cover', svg).forEach(function (r) { r.classList.add('open'); }); updateBar(host); });
      // Interaktive Abbildungen (Stufen, Ausfälle) ändern sichtbare Texte: Abdeckungen danach neu setzen
      host.addEventListener('click', function (e) {
        if (host.classList.contains('lbl-on') && e.target.closest('button') && !e.target.closest('.lbl-bar, .z-open')) setTimeout(function () { cover(svg); updateBar(host); }, 350);
      });
    });
    // Aufdecken: per Klick oder Tastatur, auch in der Bildlupe (dort ist die Abbildung eine Kopie)
    function reveal(r) {
      var host = r.closest('.figure');
      if (host && host.F) { findTap(host, r); return; }
      r.classList.toggle('open');
      if (host) updateBar(host);
    }
    document.addEventListener('click', function (e) { var r = e.target.closest('.lbl-cover'); if (r) { e.stopPropagation(); reveal(r); } }, true);
    document.addEventListener('keydown', function (e) { var r = e.target.closest && e.target.closest('.lbl-cover'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); reveal(r); } });
    // Ankunft aus der Tagesrunde: ?fig=Abb. 3.1 → Abbildung zeigen und verdecken
    var want = new URLSearchParams(location.search).get('fig'), findMode = new URLSearchParams(location.search).get('find') === '1';
    if (want) {
      var cap = $$('.figcap b').filter(function (b) { return b.textContent.trim() === want; })[0];
      var host = cap && cap.closest('.figure');
      history.replaceState(null, '', location.pathname + location.hash);
      if (host) {
        if (host.hidden) { var sw = host.previousElementSibling; if (sw && sw.classList.contains('view-sw')) sw.querySelector('[data-view="schema"]').click(); }
        // Erst nach dem Laden der Schriften springen (sonst verschiebt sich die Seite danach noch)
        (document.fonts && document.fonts.ready || Promise.resolve()).then(function () {
          var b = $('[data-lbl]', host); if (b && !host.classList.contains('lbl-on')) b.click();
          if (findMode) { var fb = $('[data-lbl-find]', host); if (fb) fb.click(); } // aus „Heute“: gleich „Tippe auf …“
          host.scrollIntoView({ block: 'center', behavior: 'instant' });
          host.classList.add('fig-flash');
          setTimeout(function () { host.scrollIntoView({ block: 'center', behavior: 'instant' }); }, 400);
        });
      }
    }
  }

  // ---------- 2 · Aus dem Gedächtnis zeichnen ----------
  var DRAW_KEY = 'vagus-kurs:drawings'; // eigene Ablage: Bilder sind groß und werden nicht synchronisiert
  function drawings() { try { return JSON.parse(localStorage.getItem(DRAW_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDrawing(id, url) { var d = drawings(); if (url) d[id] = url; else delete d[id]; try { localStorage.setItem(DRAW_KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
  var PENS = [
    { c: 'var(--ink)', n: 'Tinte' }, { c: 'var(--c-nerve)', n: 'Nerv (gelb)' }, { c: 'var(--c-sln)', n: 'SLN (türkis)' },
    { c: 'var(--c-rln)', n: 'RLN (violett)' }, { c: 'var(--c-muscle)', n: 'Muskel (rotbraun)' }, { c: 'var(--c-cart-line)', n: 'Knorpel (blaugrau)' }, { c: 'var(--c-lesion)', n: 'Läsion (magenta)' },
  ];
  function drawSetup() {
    var boxes = $$('.wrap .eyebrow').filter(function (e) { return /^(Aus dem Gedächtnis zeichnen|Hand-drawing prompt)/i.test(e.textContent.trim()); })
      .map(function (e) { return e.closest('.box, .card, .plate') || e.parentElement; });
    if (!boxes.length) return;
    var dlg = $('#draw'); if (!dlg) return;
    var cv = $('canvas', dlg), ctx = cv.getContext('2d'), stage = $('.dr-stage', dlg), over = $('.dr-over', dlg), steps = $('.dr-steps', dlg);
    var cur = null, pen = 0, size = 3, erase = false, history = [], drawing = false, last = null, dpr = Math.max(1, window.devicePixelRatio || 1);
    function color() { var c = PENS[pen].c; return c.indexOf('var(') === 0 ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() : c; }
    function fit(keep) {
      var img = keep ? cv.toDataURL() : null;
      var w = stage.clientWidth, h = stage.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (img) restore(img);
    }
    function restore(url) { var i = new Image(); i.onload = function () { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(i, 0, 0); ctx.restore(); }; i.src = url; } // in Originalgröße, nie verzerrt
    function snap() { history.push(cv.toDataURL()); if (history.length > 30) history.shift(); }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5 }; }
    cv.addEventListener('pointerdown', function (e) { if (e.button > 0) return; cv.setPointerCapture(e.pointerId); snap(); drawing = true; last = pos(e); dot(last); });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e]; // manche Browser liefern eine leere Liste
      evs.forEach(function (ev) { var p = pos(ev); line(last, p); last = p; });
    });
    function end() { if (drawing) { drawing = false; persist(); } }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    function stroke() { ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; ctx.strokeStyle = ctx.fillStyle = color(); }
    function dot(p) { stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, (erase ? size * 4 : size * (0.6 + p.p)) / 2, 0, 7); ctx.fill(); }
    function line(a, b) { stroke(); ctx.lineWidth = erase ? size * 4 : size * (0.6 + b.p); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    function persist() { if (cur && !saveDrawing(cur.id, cv.toDataURL('image/png'))) $('.dr-msg', dlg).textContent = 'Speicher voll: Zeichnung wird nicht dauerhaft gesichert.'; }
    // Werkzeuge
    var pal = $('.dr-pens', dlg);
    pal.innerHTML = PENS.map(function (p, i) { return '<button type="button" class="dr-pen" data-pen="' + i + '" aria-pressed="' + (i === 0) + '" title="' + p.n + '" aria-label="' + p.n + '" style="--pc:' + p.c + '"></button>'; }).join('');
    pal.addEventListener('click', function (e) { var b = e.target.closest('[data-pen]'); if (!b) return; pen = +b.getAttribute('data-pen'); erase = false; sync(); });
    $('[data-dr="erase"]', dlg).addEventListener('click', function () { erase = !erase; sync(); });
    $('[data-dr="size"]', dlg).addEventListener('input', function (e) { size = +e.target.value; });
    $('[data-dr="undo"]', dlg).addEventListener('click', function () { var u = history.pop(); if (u) { restore(u); setTimeout(persist, 30); } });
    $('[data-dr="clear"]', dlg).addEventListener('click', function () { if (!confirm('Zeichnung löschen und neu beginnen?')) return; snap(); ctx.clearRect(0, 0, cv.width, cv.height); saveDrawing(cur.id, null); });
    $('[data-dr="close"]', dlg).addEventListener('click', function () { dlg.close(); });
    function sync() {
      $$('[data-pen]', dlg).forEach(function (b) { b.setAttribute('aria-pressed', !erase && +b.getAttribute('data-pen') === pen); });
      $('[data-dr="erase"]', dlg).setAttribute('aria-pressed', erase);
    }
    // Vergleichen: echte Abbildung halbtransparent darüberlegen
    var opacity = $('[data-dr="opacity"]', dlg), refs = $('.dr-refs', dlg);
    opacity.addEventListener('input', function () { over.style.opacity = opacity.value / 100; });
    function showRef(abb) {
      over.innerHTML = ''; $$('[data-ref]', refs).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ref') === abb); });
      if (!abb) { opacity.disabled = true; return; }
      var cap = $$('.figcap b').filter(function (b) { return b.textContent.trim() === abb; })[0];
      var svg = cap && $('svg[viewBox]', cap.closest('.figure'));
      if (!svg) return;
      var c = svg.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height'); c.style.minWidth = ''; $$('.lbl-cover', c).forEach(function (r) { r.remove(); });
      over.appendChild(c); opacity.disabled = false; if (+opacity.value === 0) opacity.value = 45; over.style.opacity = opacity.value / 100;
    }
    refs.addEventListener('click', function (e) { var b = e.target.closest('[data-ref]'); if (b) showRef(b.getAttribute('aria-pressed') === 'true' ? null : b.getAttribute('data-ref')); });

    boxes.forEach(function (box, i) {
      var id = K.page + '-' + i;
      var list = $('ol', box);
      var mentioned = (box.textContent.match(/Abb\.\s*\d+\.\d+/g) || []).map(function (s) { return s.replace(/\s+/g, ' '); });
      // „Vergleiche mit Abb. 1.1, 1.3 und 1.4“: auch die Kurzformen nach dem ersten „Abb.“ mitnehmen
      var m = box.textContent.match(/Abb\.\s*(\d+\.\d+(?:\s*(?:,|und)\s*\d+\.\d+)*)/g) || [];
      m.forEach(function (s) { (s.match(/\d+\.\d+/g) || []).forEach(function (n) { mentioned.push('Abb. ' + n); }); });
      var figs = $$('.figcap b').map(function (b) { return b.textContent.trim(); });
      var own = mentioned.filter(function (a, k) { return mentioned.indexOf(a) === k && figs.indexOf(a) >= 0; });
      if (!own.length && box.closest('section')) own = $$('.figcap b', box.closest('section')).map(function (b) { return b.textContent.trim(); }).slice(0, 2);
      var b = el('div', 'dr-launch', '<button class="cta" type="button">Auf dem Bildschirm zeichnen</button>' + (drawings()[id] ? '<span class="note">Deine letzte Zeichnung ist gespeichert.</span>' : ''));
      box.appendChild(b);
      b.querySelector('button').addEventListener('click', function () {
        cur = { id: id, own: own };
        steps.innerHTML = list ? '<ol>' + $$('li', list).map(function (li) { return '<li>' + li.innerHTML + '</li>'; }).join('') + '</ol>' : '';
        refs.innerHTML = own.length ? '<span class="note">Vergleichen mit:</span>' + own.map(function (a) { return '<button type="button" class="chip" data-ref="' + a + '" aria-pressed="false">' + a + '</button>'; }).join('') : '';
        $('.dr-msg', dlg).textContent = '';
        history = []; showRef(null); opacity.value = 0; erase = false; pen = 0; sync();
        dlg.showModal();
        requestAnimationFrame(function () {
          fit(false); ctx.clearRect(0, 0, cv.width, cv.height);
          var saved = drawings()[id]; if (saved) restore(saved);
          var sp = b.querySelector('.note'); if (!sp) b.insertAdjacentHTML('beforeend', '<span class="note">Deine letzte Zeichnung ist gespeichert.</span>');
        });
      });
    });
    window.addEventListener('resize', function () { if (dlg.open) fit(true); });
    dlg.addEventListener('close', function () { persist(); over.innerHTML = ''; });
  }

  // ---------- 3 · Lesemodus ----------
  var SIZES = { s: .43, m: .47, l: .52, xl: .58 };
  function applyRead() {
    var r = state.read || {}, root = document.documentElement;
    root.dataset.size = r.size || 'm';
    if (r.font === 'sans') root.dataset.font = 'sans'; // Atkinson steht in assets/fonts/fonts.css und lädt erst bei Bedarf
    else delete root.dataset.font;
    $$('[data-read-font]').forEach(function (b) { b.setAttribute('aria-pressed', (r.font || 'serif') === b.getAttribute('data-read-font')); });
    $$('[data-read-size]').forEach(function (b) { b.setAttribute('aria-pressed', (r.size || 'm') === b.getAttribute('data-read-size')); });
  }
  function readSetup() {
    var dlg = $('#reading');
    $$('[data-open-reading]').forEach(function (b) { b.addEventListener('click', function () { if (dlg) dlg.showModal(); }); });
    if (dlg) {
      $$('[data-close-reading]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.close();
        var f = e.target.closest('[data-read-font]'), s = e.target.closest('[data-read-size]');
        if (f || s) { state.read = state.read || {}; if (f) state.read.font = f.getAttribute('data-read-font'); if (s) state.read.size = s.getAttribute('data-read-size'); K.save(); applyRead(); }
        var r = e.target.closest('[data-read-rate]'); if (r) { state.read = state.read || {}; state.read.rate = +r.getAttribute('data-read-rate'); K.save(); speakUI(); }
        var th = e.target.closest('[data-theme-set]');
        if (th) { var v = th.getAttribute('data-theme-set'); if (v) state.theme = v; else delete state.theme; K.save(); if (K.theme) K.theme(); themeChips(); }
      });
    }
    applyRead(); themeChips();
  }
  function themeChips() { $$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', (state.theme || '') === b.getAttribute('data-theme-set')); }); }

  // ---------- 4 · Vorlesen ----------
  var synth = window.speechSynthesis, voice = null, queue = [], qi = 0, playing = false, curSec = null;
  // Abkürzungen so, wie man sie spricht
  var SAY = [[/\s*\(?\b(?:CN|N\.) X\)?/g, ', der zehnte Hirnnerv,'], [/\bNn\.\s/g, 'Nervi '], [/\bN\.\s(?=[a-zX])/g, 'Nervus '], [/\bRr\.\s/g, 'Rami '], [/\bR\.\s(?=[a-z])/g, 'Ramus '], [/\bMm\.\s/g, 'Musculi '], [/\bM\.\s(?=[a-z])/g, 'Musculus '],
    [/\bAa\.\s/g, 'Arteriae '], [/\bA\.\s(?=[a-z])/g, 'Arteria '], [/\bV\.\s(?=[a-z])/g, 'Vena '], [/\bLig\.\s/g, 'Ligamentum '], [/\bProc\.\s/g, 'Processus '], [/\bProcc\.\s/g, 'Processus '],
    [/\bCart\.\s/g, 'Cartilago '], [/\bz\.\s?B\./g, 'zum Beispiel'], [/\bd\.\s?h\./g, 'das heißt'], [/\bu\.\s?a\./g, 'unter anderem'], [/\bca\./g, 'circa'], [/\bAbb\.\s/g, 'Abbildung '],
    [/\bF(\d+)\./g, 'Frage $1.'], [/\s*→\s*/g, ', führt zu, '], [/≈\s?/g, 'etwa '], [/[↑]/g, ' steigt'], [/[↓]/g, ' sinkt'], [/·/g, ', ']];
  function say(t) { t = t.replace(/ /g, ' '); SAY.forEach(function (r) { t = t.replace(r[0], r[1]); }); return t.replace(/\s+/g, ' ').trim(); }
  function pickVoice() {
    var vs = synth.getVoices();
    voice = vs.filter(function (v) { return /^de(-|_|$)/i.test(v.lang) && /natural|google|neural|premium|enhanced/i.test(v.name); })[0] ||
      vs.filter(function (v) { return /^de(-|_|$)/i.test(v.lang); })[0] || null;
  }
  function blocks(h2) {
    // Absätze vom Abschnittstitel bis zum nächsten <h2>; Abbildungen, Lösungen und Knöpfe nicht vorlesen
    var out = [h2], n = h2.parentElement === h2.closest('section') ? h2.nextElementSibling : null;
    var sec = h2.closest('section');
    $$('p, li, td, th, .figcap', sec).forEach(function (b) {
      if (b.closest('details:not([open]), svg, .atlas, .lbl-bar, .qa, .quiz, .sel-pop, button')) return;
      if (b.matches('li') && b.querySelector('p')) return;
      if (b.closest('li') && b.closest('li') !== b && b.matches('p')) return;
      out.push(b);
    });
    return out.filter(function (b, i) { return out.indexOf(b) === i; });
  }
  function speakUI() {
    var bar = $('.tts-bar'); if (!bar) return;
    bar.hidden = !curSec;
    $('[data-tts="pause"]', bar).textContent = playing ? 'Pause' : 'Weiter';
    var r = (state.read && state.read.rate) || 1;
    $$('[data-read-rate]').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-read-rate') === r); });
    $$('.tts-btn').forEach(function (b) { b.setAttribute('aria-pressed', !!curSec && b.closest('section') === curSec.closest('section')); });
  }
  function mark(b) { $$('.tts-now').forEach(function (x) { x.classList.remove('tts-now'); }); if (b) { b.classList.add('tts-now'); var r = b.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 80) b.scrollIntoView({ block: 'center' }); } }
  // Ein Absatz wird in Sätze zerlegt (Chrome bricht Äußerungen nach etwa 15 s ab, ohne „end“ zu melden).
  // Safari und Chrome verlieren „end“ außerdem gelegentlich ganz (die Äußerung wird vom Speicher aufgeräumt):
  // deshalb eine feste Referenz und ein Wächter, der weitergeht, wenn die Stimme still ist.
  function chunks(t) {
    var parts = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t], out = [], cur = '';
    parts.forEach(function (p) { if ((cur + p).length > 220 && cur) { out.push(cur); cur = p; } else cur += p; });
    if (cur.trim()) out.push(cur);
    return out.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  var parts = [], pi = 0, live = null, token = 0, guard = 0, quiet = 0;
  function advance(tk) {
    if (tk !== token || !playing) return;
    token++; pi++;
    if (pi >= parts.length) { qi++; pi = 0; parts = []; }
    speakNext();
  }
  function speakNext() {
    if (qi >= queue.length) { stop(); return; }
    var b = queue[qi];
    if (!parts.length) { parts = chunks(say(b.textContent)); pi = 0; if (!parts.length) { qi++; return speakNext(); } }
    var tk = ++token, u = new SpeechSynthesisUtterance(parts[pi]);
    u.lang = 'de-DE'; if (voice) u.voice = voice; u.rate = (state.read && state.read.rate) || 1;
    u.onend = function () { advance(tk); };
    u.onerror = function (e) { if (e.error !== 'interrupted' && e.error !== 'canceled') advance(tk); };
    live = u; // feste Referenz, sonst geht „end“ verloren
    if (pi === 0) mark(b);
    synth.speak(u);
    // Wächter: hat die Stimme angefangen und ist danach gut 1 s still (nichts mehr in der Warteschlange), gilt der Satz
    // als fertig. Hat sie nach 6 s gar nicht angefangen, auch weiter. Das Anlaufen (am iPhone bis ~1 s) zählt nicht als Stille.
    clearInterval(guard); quiet = 0;
    var started = false, t0 = Date.now();
    guard = setInterval(function () {
      if (tk !== token || !playing) { clearInterval(guard); return; }
      if (synth.speaking && !synth.paused) started = true;
      var silent = !synth.speaking && !synth.pending;
      if (started && silent) { if (++quiet >= 5) { clearInterval(guard); advance(tk); } }
      else if (!started && Date.now() - t0 > 6000) { clearInterval(guard); advance(tk); }
      else quiet = 0;
    }, 250);
  }
  function resetParts() { parts = []; pi = 0; token++; clearInterval(guard); }
  // resetParts() vor synth.cancel(): Safari meldet beim Abbrechen manchmal „end“, das sonst einen Absatz überspränge
  function play(h2) { resetParts(); synth.cancel(); curSec = h2; queue = blocks(h2); qi = 0; playing = true; speakNext(); speakUI(); }
  function stop() { playing = false; resetParts(); synth.cancel(); curSec = null; mark(null); speakUI(); }
  function ttsSetup() {
    if (!synth || !window.SpeechSynthesisUtterance || !/^\d\d$/.test(K.page)) return; // nur auf Kursseiten
    pickVoice(); if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = pickVoice;
    var heads = $$('.wrap section > h2[id]');
    if (!heads.length) return;
    heads.forEach(function (h) {
      var b = el('button', 'tts-btn', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg><span>Vorlesen</span>');
      b.type = 'button'; b.setAttribute('aria-label', 'Abschnitt vorlesen: ' + h.textContent.trim());
      b.addEventListener('click', function () { if (curSec === h) stop(); else play(h); });
      h.insertAdjacentElement('afterend', b);
    });
    var bar = el('div', 'tts-bar', '<span class="tts-t">Vorlesen</span><button type="button" data-tts="prev" aria-label="Vorheriger Absatz">‹</button><button type="button" data-tts="pause">Pause</button><button type="button" data-tts="next" aria-label="Nächster Absatz">›</button><button type="button" data-tts="sec">Nächster Abschnitt</button><button type="button" data-tts="stop">Stopp</button>');
    bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Vorlesen');
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tts]'); if (!a) return;
      var act = a.getAttribute('data-tts');
      if (act === 'stop') stop();
      else if (act === 'pause') { if (playing) { playing = false; resetParts(); synth.cancel(); } else { playing = true; speakNext(); } speakUI(); }
      else if (act === 'next' || act === 'prev') { resetParts(); synth.cancel(); qi = Math.max(0, Math.min(queue.length - 1, qi + (act === 'next' ? 1 : -1))); if (playing) speakNext(); else mark(queue[qi]); }
      else if (act === 'sec') { var i = heads.indexOf(curSec); if (i >= 0 && i + 1 < heads.length) play(heads[i + 1]); else stop(); }
    });
    window.addEventListener('pagehide', function () { synth.cancel(); });
  }

  // ---------- 5 · Abbildungen auf dem Handy lesbar ----------
  // Auf schmalen Bildschirmen würde jede Abbildung auf Bildschirmbreite gestaucht (Beschriftungen 3–7 px).
  // Stattdessen behält sie eine Mindestbreite, bei der die kleinste Beschriftung ≈ 9,5 px groß ist, höchstens
  // das 2,6-Fache der Spaltenbreite (große Karten: dann in der Lupe lesen); der Rest lässt sich in der Abbildung seitlich wischen, die Seite bleibt fest.
  var READ_PX = 9.5;
  function figSvgs() {
    return $$('.wrap svg[viewBox]').filter(function (s) {
      return !s.closest('button, .fig-tools, .z-canvas, .dr-over') && s.viewBox.baseVal.width >= 280;
    });
  }
  function phoneFigures() {
    figSvgs().forEach(function (svg) {
      if (!svg.hasAttribute('data-minfont')) {
        var sizes = $$('text', svg).map(function (t) { return parseFloat(getComputedStyle(t).fontSize) || 0; }).filter(function (v) { return v > 0; });
        if (!sizes.length) return;
        svg.setAttribute('data-minfont', Math.min.apply(null, sizes).toFixed(2)); // Kopie in der Lupe nutzt das auch
      }
      var box = svg.parentElement;
      if (!box.classList.contains('scroll')) { var wr = el('div', 'scroll'); box.insertBefore(wr, svg); wr.appendChild(svg); box = wr; }
      svg.style.minWidth = '';
      var avail = box.clientWidth, vbw = svg.viewBox.baseVal.width, mf = +svg.getAttribute('data-minfont');
      var need = vbw * READ_PX / mf, target = Math.min(need, avail * 2.6, vbw);
      var wide = avail < 700 && target > avail + 4;
      if (wide) svg.style.minWidth = Math.round(target) + 'px';
      box.classList.toggle('is-wide', wide);
      var hint = box.nextElementSibling && box.nextElementSibling.classList.contains('swipe-hint') ? box.nextElementSibling : null;
      if (wide && !hint) { hint = el('p', 'swipe-hint note', '↔ Seitlich wischen · zum Vergrößern antippen'); box.insertAdjacentElement('afterend', hint); }
      if (hint) hint.hidden = !wide;
    });
    scrollRegions();
  }
  // Seitlich scrollbare Kästen (breite Abbildungen, Tabellen) auch mit der Tastatur erreichbar machen
  function scrollRegions() {
    var nT = 0, nF = 0;
    $$('.wrap .scroll, .wrap pre').forEach(function (s) {
      var over = s.scrollWidth > s.clientWidth + 2;
      var isT = !!s.querySelector('table'), host = s.closest('.figure, .plate, section'), cap = host && host.querySelector('.figcap b, .caption b');
      var name = isT ? 'Tabelle ' + (++nT) : cap ? cap.textContent.trim() : (s.tagName === 'PRE' ? 'Codebeispiel ' : 'Abbildung ') + (++nF);
      if (over && !s.hasAttribute('tabindex')) {
        s.tabIndex = 0; s.setAttribute('role', 'region');
        s.setAttribute('aria-label', name + ', seitlich scrollbar');
      } else if (!over && s.getAttribute('role') === 'region') { s.removeAttribute('tabindex'); s.removeAttribute('role'); s.removeAttribute('aria-label'); }
    });
  }
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(phoneFigures, 150); });

  // ---------- Tägliche Erinnerung (Kalenderdatei) und Lernstand sichern/laden ----------
  function download(name, type, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }
  // Mitteilung aufs Gerät (Web Push): einmal am Tag zur gewählten Stunde, nur wenn Karten oder Abbildungen fällig sind.
  // Das Gerät steht in push_subs (supabase/monitor-push.sql); GitHub (.github/workflows/push.yml) verschickt stündlich.
  // Stunde und An/Aus gelten pro Gerät, deshalb nicht im Lernstand, sondern in localStorage bzw. beim Browser.
  function pushSetup() {
    var row = $('[data-push-row]'), cfg = window.KURS_SYNC, S = window.KursSync; if (!row || !cfg || !cfg.vapid || !S || !S.rest) return;
    row.hidden = false;
    var on = $('[data-push]', row), off = $('[data-push-off]', row), hour = $('[data-push-hour]', row), note = $('[data-push-note]', row);
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    try { hour.value = localStorage.getItem('vagus-kurs:push-hour') || '19'; } catch (e) {}
    function say(t) { note.textContent = t; }
    function key() {
      var s = cfg.vapid.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4);
      var raw = atob(s), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a;
    }
    function current() { return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }); }
    function store(s) {
      var j = s.toJSON(), tz = 'Europe/Berlin'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) {}
      return S.rest('/rest/v1/push_subs?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { endpoint: j.endpoint, user_id: S.userId(), p256dh: j.keys.p256dh, auth: j.keys.auth, tz: tz, hour: +hour.value } });
    }
    function show(active) {
      on.hidden = active; off.hidden = !active; on.disabled = false;
      say(active ? 'An: täglich ab ' + hour.value + ' Uhr, wenn es etwas gibt. Gilt für dieses Gerät.'
        : 'Höchstens einmal am Tag: wenn Karten fällig sind, sonntags ein kurzer Wochenrückblick, 7 Tage und 1 Tag vor der Prüfung ein Hinweis. Gilt für dieses Gerät.');
    }
    function refresh() {
      if (!can) { on.disabled = true; off.hidden = true; return say(ios ? 'Am iPhone geht das nur, wenn der Kurs auf dem Home-Bildschirm liegt: Teilen › Zum Home-Bildschirm, dann von dort öffnen.' : 'Dieser Browser kann keine Mitteilungen empfangen.'); }
      if (!S.hasSession()) { on.disabled = true; off.hidden = true; return say('Dafür brauchst du ein Konto (oben „Anmelden“), damit der Kurs weiß, was fällig ist.'); }
      if (Notification.permission === 'denied') { on.disabled = true; off.hidden = true; return say('Mitteilungen sind für diese Seite blockiert. Erlauben lässt sich das in den Einstellungen des Browsers.'); }
      current().then(function (s) { show(!!s && Notification.permission === 'granted'); }).catch(function () { show(false); });
    }
    on.addEventListener('click', function () {
      on.disabled = true; say('Einen Moment …');
      // Die Erlaubnis muss direkt aus dem Tippen heraus erfragt werden (Safari)
      Promise.resolve(Notification.requestPermission()).then(function (p) {
        if (p !== 'granted') throw new Error(p);
        return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }); });
      }).then(function (s) {
        return store(s).then(function () { show(true); K.toast && K.toast('Erinnerung an. Die erste kommt, sobald etwas fällig ist.'); },
          function (e) { s.unsubscribe(); throw e; });
      }).catch(function (e) {
        if (e && (e.message === 'denied' || e.message === 'default')) return refresh();
        on.disabled = false; say('Hat nicht geklappt' + (navigator.onLine ? '' : ' (offline)') + '. Bitte später noch einmal versuchen.');
      });
    });
    off.addEventListener('click', function () {
      off.disabled = true;
      current().then(function (s) {
        if (!s) return;
        var ep = s.endpoint;
        return s.unsubscribe().then(function () { return S.rest('/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE' }).catch(function () {}); });
      }).then(function () { off.disabled = false; show(false); }, function () { off.disabled = false; refresh(); });
    });
    hour.addEventListener('change', function () {
      try { localStorage.setItem('vagus-kurs:push-hour', hour.value); } catch (e) {}
      if (!can || !S.hasSession()) return;
      current().then(function (s) { if (s) return store(s).then(function () { show(true); }); }).catch(function () {});
    });
    // Beim Öffnen der Einstellungen den Zustand neu lesen (An-/Abmelden ändert ihn)
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-open-reading]')) setTimeout(refresh, 0); });
    refresh();
    // Einmal pro Besuch das Gerät auffrischen (Zeitzone nach einer Reise, gelöschter Eintrag)
    if (can && S.hasSession() && Notification.permission === 'granted') setTimeout(function () { current().then(function (s) { if (s) store(s).catch(function () {}); }); }, 5000);
  }

  // Frühere Stände: einmal am Tag (beim ersten Öffnen, vor dem Abgleich) den ganzen Lernstand in IndexedDB merken, 7 Tage lang,
  // dazu die letzten 3 Stände unmittelbar vor einem Wiederherstellen. Sicherheitsnetz, falls ein Abgleich oder eine Datei etwas überschreibt.
  function snapSetup() {
    var row = $('[data-snap-row]'); if (!row || !window.indexedDB) return;
    var sel = $('[data-snap]', row), go = $('[data-snap-go]', row), note = $('[data-snap-note]', row), KEEP = 7;
    function db() {
      return new Promise(function (ok, no) {
        var r = indexedDB.open('vagus-kurs-stand', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('snaps'); };
        r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
      });
    }
    function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction('snaps', mode), s = t.objectStore('snaps'), out = fn(s); t.oncomplete = function () { ok(out && out.result); }; t.onerror = function () { no(t.error); }; }); }); }
    function all() { return db().then(function (d) { return new Promise(function (ok) { var out = [], c = d.transaction('snaps').objectStore('snaps').openCursor(); c.onsuccess = function () { var x = c.result; if (x) { out.push({ k: x.key, v: x.value }); x.continue(); } else ok(out); }; c.onerror = function () { ok([]); }; }); }); }
    function day(t) { var d = new Date(t - 4 * 3600e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function raw() { try { return JSON.parse(localStorage.getItem(K.key) || 'null'); } catch (e) { return null; } }
    function sum(s) {
      var c = Object.keys(s.cards || {}).length, n = (s.notes || []).length, d = Object.keys(s.done || {}).length;
      var pl = function (x, one, many) { return x + ' ' + (x === 1 ? one : many); };
      return en() ? pl(c, 'card', 'cards') + ' · ' + pl(n, 'note', 'notes') + ' · ' + d + ' of 10 done' : pl(c, 'Karte', 'Karten') + ' · ' + pl(n, 'Notiz', 'Notizen') + ' · ' + d + ' von 10 erledigt';
    }
    // Beschriftung gleich in der Sprache der Oberfläche (enthält Daten, passt nicht ins Wörterbuch von i18n.js)
    function en() { return document.documentElement.dataset.ui === 'en'; }
    function label(x) {
      var t = new Date(x.v.t), today = day(Date.now()), y = day(Date.now() - 864e5), k = x.k.replace(/^vor-.*/, ''), loc = en() ? 'en-GB' : 'de-DE';
      var when = k === today ? (en() ? 'This morning' : 'Heute früh') : k === y ? (en() ? 'Yesterday' : 'Gestern') : t.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'numeric' });
      if (!k) when = (en() ? 'Before restoring, ' : 'Vor dem Wiederherstellen, ') + t.toLocaleDateString(loc, { day: 'numeric', month: 'numeric' }) + ' ' + t.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
      return when + ' · ' + sum(x.v.s);
    }
    function list() {
      return all().then(function (xs) {
        xs.sort(function (a, b) { return b.v.t - a.v.t; });
        sel.innerHTML = xs.map(function (x) { return '<option value="' + x.k + '">' + label(x) + '</option>'; }).join('');
        row.hidden = !xs.length; return xs;
      });
    }
    // Aufräumen: 7 Tage + 3 „vor dem Wiederherstellen“
    function prune() {
      return all().then(function (xs) {
        var days = xs.filter(function (x) { return !/^vor-/.test(x.k); }).sort(function (a, b) { return b.v.t - a.v.t; }).slice(KEEP);
        var befores = xs.filter(function (x) { return /^vor-/.test(x.k); }).sort(function (a, b) { return b.v.t - a.v.t; }).slice(3);
        var gone = days.concat(befores); if (gone.length) return tx('readwrite', function (s) { gone.forEach(function (x) { s.delete(x.k); }); });
      });
    }
    var s0 = raw(), today = day(Date.now());
    var ready = (s0 && Object.keys(s0).length > 2 ? tx('readonly', function (s) { return s.get(today); }).then(function (have) {
      if (!have) return tx('readwrite', function (s) { s.put({ t: Date.now(), s: s0 }, today); }).then(prune);
    }) : Promise.resolve()).then(list).catch(function () { row.hidden = true; });
    var armed = 0;
    go.addEventListener('click', function () {
      // Zweimal tippen statt Bestätigungsfenster
      if (Date.now() - armed > 4000) { armed = Date.now(); go.textContent = 'Wirklich? Noch einmal tippen'; setTimeout(function () { if (Date.now() - armed >= 4000) go.textContent = 'Wiederherstellen'; }, 4100); return; }
      armed = 0; go.disabled = true;
      var key = sel.value;
      tx('readonly', function (s) { return s.get(key); }).then(function (x) {
        if (!x || !x.s) throw new Error('fehlt');
        return tx('readwrite', function (s) { s.put({ t: Date.now(), s: JSON.parse(JSON.stringify(state)) }, 'vor-' + Date.now()); }).then(prune).then(function () {
          K.restore(x.s);
          note.textContent = 'Wiederhergestellt. Die Seite lädt neu …';
          setTimeout(function () { location.reload(); }, 900);
        });
      }).catch(function () { go.disabled = false; go.textContent = 'Wiederherstellen'; note.textContent = 'Das ging nicht. Der jetzige Stand ist unverändert.'; });
    });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-open-reading]')) ready.then(list).catch(function () {}); });
  }

  function keepSetup() {
    var ics = $('[data-ics]'); if (!ics) return;
    ics.addEventListener('click', function () {
      var t = ($('[data-ics-time]').value || '19:00').split(':'), d = new Date(); d.setDate(d.getDate() + 1);
      var day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      var url = location.href.replace(/[^/]*([?#].*)?$/, '') + 'index.html#heute';
      // Ortszeit ohne Zeitzone („schwebend“): der Termin bleibt auch nach der Zeitumstellung um 19 Uhr
      var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vagus-Kurs//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        'UID:vagus-kurs-taeglich-' + Date.now() + '@rioquentin.github.io', 'DTSTAMP:' + stamp(new Date()),
        'DTSTART:' + day + 'T' + t[0] + t[1] + '00', 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
        'SUMMARY:Vagus-Kurs · Tagesrunde (15 Minuten)', 'DESCRIPTION:Kurz wiederholen\\, was fällig ist: ' + url, 'URL:' + url,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:Vagus-Kurs: Tagesrunde', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
      download('vagus-kurs-erinnerung.ics', 'text/calendar', lines.join('\r\n') + '\r\n');
    });
    var msg = $('[data-backup-msg]');
    $('[data-backup]').addEventListener('click', function () {
      download('vagus-kurs-lernstand-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json',
        JSON.stringify({ app: 'vagus-kurs', v: 1, saved: new Date().toISOString(), state: state }, null, 1));
      msg.textContent = 'Gesichert. Die Datei liegt bei deinen Downloads.';
    });
    var file = $('[data-restore-file]');
    $('[data-restore]').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var data = JSON.parse(txt);
        if (!data || data.app !== 'vagus-kurs' || !data.state) throw new Error('fremd');
        var cur = JSON.parse(JSON.stringify(state));
        var merged = window.KursSync && window.KursSync.merge ? window.KursSync.merge(cur, data.state) : data.state;
        K.adopt(merged); K.save();
        msg.textContent = 'Geladen und zusammengeführt. Die Seite lädt neu …';
        setTimeout(function () { location.reload(); }, 900);
      }).catch(function () { msg.textContent = 'Diese Datei ist keine Sicherung vom Vagus-Kurs.'; });
      file.value = '';
    });
  }

  // ---------- Probeprüfung (Seite 9–10): mit Uhr und Verlauf ----------
  // Der Kurs schlägt „etwa 40 Minuten“ vor. Die Uhr läuft unten mit; „Prüfung auswerten“ (Kursskript) wird mitgeschrieben.
  function examSetup() {
    var exam = $('#exam'), grade = $('#grade'), result = $('#result');
    if (K.page !== '09' || !exam || !grade || !result) return;
    var LIMIT = 40 * 60, KEY_T = 'vagus-kurs:examclock', clock = null, tick = null;
    var bar = el('div', 'exam-timer', '<button type="button" class="cta" data-clock-start>Mit Uhr starten · 40 Minuten</button><span class="note">Die Zeit läuft unten mit. Ohne Uhr geht es wie gewohnt.</span>');
    exam.insertAdjacentElement('beforebegin', bar);
    var hist = el('div', 'exam-hist'); grade.insertAdjacentElement('beforebegin', hist);
    function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function load() { try { return JSON.parse(sessionStorage.getItem(KEY_T) || 'null'); } catch (e) { return null; } }
    function store(c) { try { if (c) sessionStorage.setItem(KEY_T, JSON.stringify(c)); else sessionStorage.removeItem(KEY_T); } catch (e) {} }
    function used(c) { return (c.acc || 0) + (c.run ? (Date.now() - c.run) / 1000 : 0); }
    function render() {
      var c = load();
      if (!c) { if (clock) { clock.remove(); clock = null; } clearInterval(tick); tick = null; bar.hidden = false; return; }
      bar.hidden = true;
      if (!clock) { clock = el('div', 'exam-clock'); clock.setAttribute('role', 'timer'); document.body.appendChild(clock); }
      var left = LIMIT - used(c);
      clock.classList.toggle('late', left <= 5 * 60); clock.classList.toggle('over', left <= 0);
      clock.innerHTML = '<span class="ec-t">' + (left > 0 ? 'noch ' + fmt(left) : 'Zeit um · +' + fmt(-left)) + '</span>' +
        '<button type="button" class="linkbtn" data-clock-pause>' + (c.run ? 'Pause' : 'Weiter') + '</button><button type="button" class="linkbtn" data-clock-stop>Beenden</button>';
      if (left <= 0 && !c.told) { c.told = 1; store(c); if (K.toast) K.toast('Die 40 Minuten sind um. Du kannst fertig schreiben und dann auswerten.', 7000); }
      if (c.run && !tick) tick = setInterval(render, 1000);
      if (!c.run) { clearInterval(tick); tick = null; }
    }
    bar.querySelector('[data-clock-start]').addEventListener('click', function () {
      store({ run: Date.now(), acc: 0 }); render(); exam.scrollIntoView({ block: 'start' });
    });
    document.addEventListener('click', function (e) {
      var c = load(); if (!c) return;
      if (e.target.closest('[data-clock-pause]')) { if (c.run) { c.acc = used(c); c.run = 0; } else c.run = Date.now(); store(c); render(); }
      else if (e.target.closest('[data-clock-stop]')) { store(null); render(); }
    });
    // Ergebnis mitschreiben, wenn das Kursskript auswertet
    function showHist() {
      var h = state.examLog || [];
      hist.innerHTML = h.length ? '<span class="eyebrow">Deine Probeprüfungen</span><ol>' + h.slice(-6).reverse().map(function (x) {
        return '<li><span>' + new Date(x.t).toLocaleDateString(document.documentElement.dataset.ui === 'en' ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' }) + '</span><b>' + x.tot + ' / ' + x.max + '</b><span>' + x.pct + ' %</span><span class="note">' + (x.min ? x.min + ' Min.' : 'ohne Uhr') + '</span></li>';
      }).join('') + '</ol>' : '';
    }
    new MutationObserver(function () {
      var big = result.querySelector('.big'); if (result.hidden || !big) return;
      var m = /(\d+)\s*\/\s*(\d+)[^\d]+(\d+)\s*%/.exec(big.textContent); if (!m) return;
      var log = state.examLog || [], recent = log.filter(function (x) { return Date.now() - x.t <= 60e3; })[0], c = load();
      var entry = { t: Date.now(), tot: +m[1], max: +m[2], pct: +m[3], min: c ? Math.max(1, Math.round(used(c) / 60)) : recent ? recent.min : 0 };
      if (recent && recent.tot === entry.tot && recent.min === entry.min) return; // gleiche Auswertung, schon notiert
      state.examLog = log.filter(function (x) { return x !== recent; }).concat([entry]).slice(-20); // erneutes Auswerten ersetzt
      K.save(); store(null); render(); showHist();
    }).observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    showHist(); render();
  }

  // ---------- Mündliche Frage: sich selbst aufnehmen und anhören ----------
  // Aufnahmen bleiben nur auf diesem Gerät (IndexedDB), werden nie synchronisiert oder hochgeladen.
  function oralSetup() {
    var oral = $('#oral'); if (K.page !== '09' || !oral) return;
    var box = el('div', 'rec', '<div class="rec-row"><button type="button" class="cta" data-rec>● Aufnahme starten</button><span class="rec-t" aria-live="off"></span></div>' +
      '<p class="note">Sprich die 5 Minuten laut, dann hör dir zu und hake ab, was drin war. Die Aufnahme bleibt nur auf diesem Gerät.</p><p class="note rec-msg" aria-live="polite"></p><ol class="rec-list"></ol>');
    oral.insertAdjacentElement('afterend', box);
    if (!window.MediaRecorder || !navigator.mediaDevices || !window.indexedDB) { box.querySelector('[data-rec]').disabled = true; box.querySelector('.rec-msg').textContent = 'Dieser Browser kann nicht aufnehmen.'; return; }
    var LIMIT = 5 * 60, rec = null, chunks = [], t0 = 0, tick = null, stream = null, btn = box.querySelector('[data-rec]'), tEl = box.querySelector('.rec-t'), msg = box.querySelector('.rec-msg');
    function db() { return new Promise(function (ok, fail) { var r = indexedDB.open('vagus-kurs-audio', 1); r.onupgradeneeded = function () { r.result.createObjectStore('takes', { keyPath: 'id' }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = fail; }); }
    function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, fail) { var t = d.transaction('takes', mode), s = t.objectStore('takes'), res = fn(s); t.oncomplete = function () { ok(res && res.result); }; t.onerror = fail; }); }); }
    function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function list() {
      tx('readonly', function (s) { return s.getAll(); }).then(function (all) {
        all = (all || []).sort(function (a, b) { return b.t - a.t; });
        box.querySelector('.rec-list').innerHTML = all.map(function (a) {
          return '<li data-id="' + a.id + '"><span class="rec-d">' + new Date(a.t).toLocaleDateString(document.documentElement.dataset.ui === 'en' ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' }) + ' · ' + fmt(a.dur) + '</span><button type="button" class="linkbtn" data-rec-del>Löschen</button><audio controls preload="metadata"></audio></li>';
        }).join('');
        all.forEach(function (a) {
          var au = box.querySelector('li[data-id="' + a.id + '"] audio'); if (!au) return;
          // Chrome speichert in WebM keine Länge: einmal ans Ende springen, dann ist der Zeitbalken benutzbar
          au.addEventListener('loadedmetadata', function fix() {
            au.removeEventListener('loadedmetadata', fix);
            if (au.duration !== Infinity) return;
            au.addEventListener('durationchange', function back() { if (au.duration !== Infinity) { au.removeEventListener('durationchange', back); au.currentTime = 0; } });
            au.currentTime = 1e7;
          });
          au.src = URL.createObjectURL(a.blob);
        });
      });
    }
    function stop() { if (rec && rec.state !== 'inactive') rec.stop(); }
    btn.addEventListener('click', function () {
      if (rec && rec.state === 'recording') { stop(); return; }
      msg.textContent = '';
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = [];
        var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].filter(function (m) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m); })[0];
        rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          clearInterval(tick); stream.getTracks().forEach(function (t) { t.stop(); });
          btn.textContent = '● Aufnahme starten'; btn.classList.remove('on'); tEl.textContent = '';
          var dur = (Date.now() - t0) / 1000; if (dur < 1 || !chunks.length) return;
          var take = { id: Date.now(), t: Date.now(), dur: dur, blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) };
          tx('readwrite', function (st) { st.put(take); }).then(function () {
            // höchstens 10 Aufnahmen behalten (Speicher am Handy)
            return tx('readonly', function (st) { return st.getAllKeys(); });
          }).then(function (keys) { keys = (keys || []).sort(); var old = keys.slice(0, Math.max(0, keys.length - 10)); return old.length ? tx('readwrite', function (st) { old.forEach(function (k) { st.delete(k); }); }) : null; })
            .then(list).catch(function () { msg.textContent = 'Die Aufnahme konnte nicht gespeichert werden (Speicher voll?).'; });
        };
        rec.start(1000); t0 = Date.now(); btn.textContent = '■ Aufnahme beenden'; btn.classList.add('on');
        tick = setInterval(function () { var s = (Date.now() - t0) / 1000; tEl.textContent = fmt(s) + ' / 5:00'; if (s >= LIMIT) stop(); }, 250);
      }).catch(function () { msg.textContent = 'Kein Zugriff auf das Mikrofon. Erlaube es in den Browser-Einstellungen, dann noch einmal tippen.'; });
    });
    box.addEventListener('click', function (e) {
      var d = e.target.closest('[data-rec-del]'); if (!d) return;
      var id = +d.closest('li').getAttribute('data-id');
      tx('readwrite', function (s) { s.delete(id); }).then(list);
    });
    list();
  }

  // ---------- Abschnitt 5.3: eigene Tonhöhe live ansehen ----------
  // Grundfrequenz per Autokorrelation, nur im Gerät. Nichts wird aufgenommen oder gespeichert; das Mikrofon geht beim Stoppen aus.
  var NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
  function f0(buf, sr) {
    var n = buf.length, rms = 0, i;
    for (i = 0; i < n; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / n) < 0.012) return 0; // zu leise
    var minLag = Math.floor(sr / 2000), maxLag = Math.min(Math.floor(sr / 60), n >> 1), W = n - maxLag, best = 0, bestLag = 0, c = new Float32Array(maxLag + 2);
    for (var lag = minLag; lag <= maxLag + 1; lag++) {
      var s = 0, e1 = 0, e2 = 0;
      for (i = 0; i < W; i++) { s += buf[i] * buf[i + lag]; e1 += buf[i] * buf[i]; e2 += buf[i + lag] * buf[i + lag]; }
      c[lag] = s / (Math.sqrt(e1 * e2) || 1);
    }
    // erster deutlicher Gipfel nach dem ersten Abfall (vermeidet Oktavfehler nach unten)
    var dip = minLag; while (dip < maxLag && c[dip] > 0) dip++;
    var max = 0; for (lag = dip; lag <= maxLag; lag++) if (c[lag] > max) max = c[lag];
    if (max < 0.8) return 0;
    // McLeod: der ERSTE Gipfel, der fast so hoch ist wie der höchste (sonst landet man eine Oktave zu tief)
    for (lag = dip + 1; lag < maxLag; lag++) if (c[lag] >= 0.93 * max && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) { best = c[lag]; bestLag = lag; break; }
    if (!bestLag) return 0;
    var a = c[bestLag - 1], b = c[bestLag], d = c[bestLag + 1], p = (a - d) / (2 * (a - 2 * b + d) || 1);
    return sr / (bestLag + (isFinite(p) ? p : 0));
  }
  function pitchSetup() {
    var h = $$('.wrap h2[id]').filter(function (x) { return /^h-5-3-/.test(x.id); })[0];
    if (K.page !== '05' || !h) return;
    var sec = h.closest('section') || h.parentElement;
    var box = el('div', 'pitch', '<span class="eyebrow">Ausprobieren · deine eigene Tonhöhe</span>' +
      '<p>Sprich oder sing ein langes „a“ und gleite langsam von tief nach hoch. Die Linie zeigt die Grundfrequenz (F0) deiner Stimme.</p>' +
      '<div class="pitch-row"><button type="button" class="cta" data-pitch>Mikrofon starten</button><span class="pitch-now" aria-live="off"></span></div>' +
      '<canvas class="pitch-cv" height="170" aria-label="Verlauf der Tonhöhe"></canvas><p class="note">Nichts wird aufgenommen oder gespeichert. Das Mikrofon geht aus, sobald du stoppst.</p><p class="note pitch-msg" aria-live="polite"></p>');
    sec.appendChild(box);
    var btn = $('[data-pitch]', box), now = $('.pitch-now', box), cv = $('.pitch-cv', box), msg = $('.pitch-msg', box);
    if (!navigator.mediaDevices || !(window.AudioContext || window.webkitAudioContext)) { btn.disabled = true; msg.textContent = 'Dieser Browser kann das Mikrofon nicht nutzen.'; return; }
    var ac = null, stream = null, an = null, buf = null, raf = 0, hist = [], LO = 70, HI = 700;
    function y(f, H) { return H - 8 - (Math.log(f / LO) / Math.log(HI / LO)) * (H - 22); }
    function draw() {
      var dpr = Math.max(1, window.devicePixelRatio || 1), W = cv.clientWidth, H = 170;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      var g = cv.getContext('2d'), cs = getComputedStyle(document.documentElement);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.font = '12px ' + cs.getPropertyValue('--f-body'); g.fillStyle = cs.getPropertyValue('--ink-2'); g.strokeStyle = cs.getPropertyValue('--rule'); g.lineWidth = 1;
      [100, 200, 400].forEach(function (f) { var yy = Math.round(y(f, H)) + .5; g.beginPath(); g.moveTo(34, yy); g.lineTo(W, yy); g.stroke(); g.fillText(f + ' Hz', 0, yy + 4); });
      g.strokeStyle = cs.getPropertyValue('--rose-text'); g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath();
      var step = (W - 36) / 240, pen = false;
      hist.forEach(function (f, i) { var x = 36 + i * step; if (!f) { pen = false; return; } var yy = y(Math.min(HI, Math.max(LO, f)), H); if (pen) g.lineTo(x, yy); else g.moveTo(x, yy); pen = true; });
      g.stroke();
    }
    function loop() {
      an.getFloatTimeDomainData(buf);
      var f = f0(buf, ac.sampleRate);
      var last = hist[hist.length - 1]; if (f && last && Math.abs(f - last) / last > 0.25 && hist.length > 2) f = 0; // Sprünge glätten
      hist.push(f); if (hist.length > 240) hist.shift();
      if (f) { var m = Math.round(12 * Math.log2(f / 440)) + 57; now.textContent = Math.round(f) + ' Hz · ' + NOTES[(m % 12 + 12) % 12] + Math.floor(m / 12); }
      draw(); raf = requestAnimationFrame(loop);
    }
    function stop() {
      cancelAnimationFrame(raf); raf = 0;
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null;
      if (ac) ac.close(); ac = null; btn.textContent = 'Mikrofon starten'; btn.classList.remove('on');
    }
    btn.addEventListener('click', function () {
      if (raf) { stop(); return; }
      msg.textContent = '';
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (s) {
        stream = s; ac = new (window.AudioContext || window.webkitAudioContext)();
        an = ac.createAnalyser(); an.fftSize = 2048; buf = new Float32Array(an.fftSize);
        ac.createMediaStreamSource(s).connect(an); hist = [];
        btn.textContent = 'Stopp'; btn.classList.add('on'); loop();
      }).catch(function () { msg.textContent = 'Kein Zugriff auf das Mikrofon. Erlaube es in den Browser-Einstellungen, dann noch einmal tippen.'; });
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && raf) stop(); });
    window.addEventListener('pagehide', stop);
    draw();
  }

  // ---------- Lernblatt drucken ----------
  // Beim Drucken (auch Strg+P) alle Kästen im Kurs aufklappen, damit die Lösungen mit aufs Papier kommen; danach wie vorher.
  function printSetup() {
    var opened = [];
    window.addEventListener('beforeprint', function () {
      opened = $$('.wrap details:not([open])'); opened.forEach(function (d) { d.open = true; });
      $$('.lbl-cover').forEach(function (r) { r.style.display = 'none'; });
    });
    window.addEventListener('afterprint', function () {
      opened.forEach(function (d) { d.open = false; }); opened = [];
      $$('.lbl-cover').forEach(function (r) { r.style.display = ''; });
    });
    var row = $('.done-row'); if (!row || !/^\d\d$/.test(K.page)) return;
    var b = el('div', 'print-row', '<button type="button" class="linkbtn">Als Lernblatt drucken oder als PDF sichern</button><span class="note">mit Lösungen, ohne Knöpfe</span>');
    row.insertAdjacentElement('afterend', b);
    b.querySelector('button').addEventListener('click', function () { window.print(); });
  }

  readSetup(); labelSetup(); drawSetup(); ttsSetup(); phoneFigures(); printSetup(); keepSetup(); snapSetup(); pushSetup(); examSetup(); oralSetup(); pitchSetup();
  window.KursTools = { cover: cover, uncover: uncover };
})();
