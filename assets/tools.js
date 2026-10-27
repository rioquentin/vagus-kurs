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
    bar.querySelector('.lbl-n').textContent = on ? c.open + ' von ' + c.all + ' aufgedeckt' : '';
    bar.querySelector('[data-lbl-all]').hidden = !on;
  }
  function labelSetup() {
    $$('.wrap .figure').forEach(function (host) {
      var svg = $('svg[viewBox]', host);
      if (!svg || labelTexts(svg).length < 3) return;
      var bar = el('div', 'lbl-bar', '<button type="button" class="lbl-btn" data-lbl aria-pressed="false">Beschriftung verdecken</button><span class="lbl-n note" aria-live="polite"></span><button type="button" class="linkbtn" data-lbl-all hidden>alle aufdecken</button>');
      var cap = $('.figcap', host);
      host.insertBefore(bar, cap || null);
      bar.querySelector('[data-lbl]').addEventListener('click', function () {
        var on = !host.classList.contains('lbl-on');
        host.classList.toggle('lbl-on', on);
        if (on) cover(svg); else uncover(svg);
        updateBar(host);
      });
      bar.querySelector('[data-lbl-all]').addEventListener('click', function () { $$('.lbl-cover', svg).forEach(function (r) { r.classList.add('open'); }); updateBar(host); });
      // Interaktive Abbildungen (Stufen, Ausfälle) ändern sichtbare Texte: Abdeckungen danach neu setzen
      host.addEventListener('click', function (e) {
        if (host.classList.contains('lbl-on') && e.target.closest('button') && !e.target.closest('.lbl-bar, .z-open')) setTimeout(function () { cover(svg); updateBar(host); }, 350);
      });
    });
    // Aufdecken: per Klick oder Tastatur, auch in der Bildlupe (dort ist die Abbildung eine Kopie)
    function reveal(r) {
      r.classList.toggle('open');
      var host = r.closest('.figure'); if (host) updateBar(host);
    }
    document.addEventListener('click', function (e) { var r = e.target.closest('.lbl-cover'); if (r) { e.stopPropagation(); reveal(r); } }, true);
    document.addEventListener('keydown', function (e) { var r = e.target.closest && e.target.closest('.lbl-cover'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); reveal(r); } });
    // Ankunft aus der Tagesrunde: ?fig=Abb. 3.1 → Abbildung zeigen und verdecken
    var want = new URLSearchParams(location.search).get('fig');
    if (want) {
      var cap = $$('.figcap b').filter(function (b) { return b.textContent.trim() === want; })[0];
      var host = cap && cap.closest('.figure');
      history.replaceState(null, '', location.pathname + location.hash);
      if (host) {
        if (host.hidden) { var sw = host.previousElementSibling; if (sw && sw.classList.contains('view-sw')) sw.querySelector('[data-view="schema"]').click(); }
        // Erst nach dem Laden der Schriften springen (sonst verschiebt sich die Seite danach noch)
        (document.fonts && document.fonts.ready || Promise.resolve()).then(function () {
          var b = $('[data-lbl]', host); if (b && !host.classList.contains('lbl-on')) b.click();
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
      var c = svg.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height'); $$('.lbl-cover', c).forEach(function (r) { r.remove(); });
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
  var SANS_URL = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
  function applyRead() {
    var r = state.read || {}, root = document.documentElement;
    root.dataset.size = r.size || 'm';
    if (r.font === 'sans') {
      root.dataset.font = 'sans';
      if (!document.getElementById('font-sans')) { var l = document.createElement('link'); l.id = 'font-sans'; l.rel = 'stylesheet'; l.href = SANS_URL; document.head.appendChild(l); }
    } else delete root.dataset.font;
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
      });
    }
    applyRead();
  }

  // ---------- 4 · Vorlesen ----------
  var synth = window.speechSynthesis, voice = null, queue = [], qi = 0, playing = false, curSec = null;
  // Abkürzungen so, wie man sie spricht
  var SAY = [[/\s*\(?\b(?:CN|N\.) X\)?/g, ', der zehnte Hirnnerv,'], [/\bNn\.\s/g, 'Nervi '], [/\bN\.\s(?=[a-zX])/g, 'Nervus '], [/\bRr\.\s/g, 'Rami '], [/\bR\.\s(?=[a-z])/g, 'Ramus '], [/\bMm\.\s/g, 'Musculi '], [/\bM\.\s(?=[a-z])/g, 'Musculus '],
    [/\bAa\.\s/g, 'Arteriae '], [/\bA\.\s(?=[a-z])/g, 'Arteria '], [/\bV\.\s(?=[a-z])/g, 'Vena '], [/\bLig\.\s/g, 'Ligamentum '], [/\bProc\.\s/g, 'Processus '], [/\bProcc\.\s/g, 'Processus '],
    [/\bCart\.\s/g, 'Cartilago '], [/\bz\.\s?B\./g, 'zum Beispiel'], [/\bd\.\s?h\./g, 'das heißt'], [/\bu\.\s?a\./g, 'unter anderem'], [/\bca\./g, 'circa'], [/\bAbb\.\s/g, 'Abbildung '],
    [/\bF(\d+)\./g, 'Frage $1.'], [/\s*→\s*/g, ', führt zu, '], [/≈\s?/g, 'etwa '], [/[↑]/g, ' steigt'], [/[↓]/g, ' sinkt'], [/·/g, ', ']];
  function say(t) { SAY.forEach(function (r) { t = t.replace(r[0], r[1]); }); return t.replace(/\s+/g, ' ').trim(); }
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
  function speakNext() {
    if (qi >= queue.length) { stop(); return; }
    var b = queue[qi], u = new SpeechSynthesisUtterance(say(b.textContent));
    u.lang = 'de-DE'; if (voice) u.voice = voice; u.rate = (state.read && state.read.rate) || 1;
    u.onend = function () { if (playing) { qi++; speakNext(); } };
    u.onerror = function (e) { if (e.error !== 'interrupted' && e.error !== 'canceled') { qi++; speakNext(); } };
    mark(b); synth.speak(u);
  }
  function play(h2) { synth.cancel(); curSec = h2; queue = blocks(h2); qi = 0; playing = true; speakNext(); speakUI(); }
  function stop() { playing = false; synth.cancel(); curSec = null; mark(null); speakUI(); }
  function ttsSetup() {
    if (!synth || !window.SpeechSynthesisUtterance || !/^dd$/.test(K.page)) return; // nur auf Kursseiten
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
      else if (act === 'pause') { if (playing) { playing = false; synth.cancel(); } else { playing = true; speakNext(); } speakUI(); }
      else if (act === 'next' || act === 'prev') { synth.cancel(); qi = Math.max(0, Math.min(queue.length - 1, qi + (act === 'next' ? 1 : -1))); if (playing) speakNext(); else mark(queue[qi]); }
      else if (act === 'sec') { var i = heads.indexOf(curSec); if (i >= 0 && i + 1 < heads.length) play(heads[i + 1]); else stop(); }
    });
    window.addEventListener('pagehide', function () { synth.cancel(); });
  }

  readSetup(); labelSetup(); drawSetup(); ttsSetup();
  window.KursTools = { cover: cover, uncover: uncover };
})();
