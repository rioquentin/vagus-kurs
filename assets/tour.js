// Willkommens-Anleitung: erscheint beim ersten Besuch, später über „Anleitung“ wieder aufrufbar.
// Sieben kurze Schritte mit kleinen, sanft animierten Nachbildungen der echten Werkzeuge.
(function () {
  var K = window.Kurs; if (!K) return;
  var state = K.state;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var hasSync = !!(window.KURS_SYNC && window.KURS_SYNC.url);

  var STEPS = [
    { t: 'Willkommen', lead: 'Der N. vagus und die Stimme, in zehn Abschnitten zu je etwa zwanzig Minuten.',
      body: 'Lies die Abschnitte der Reihe nach. Was du geschafft hast, wird gespeichert, und die Seite merkt sich, wo du aufgehört hast.',
      art: '<div class="tv-path">' + [1, 2, 3, 4, 5, 6, 7, 8, '9–10'].map(function (n, i) { return '<span style="--i:' + i + '">' + n + '</span>'; }).join('') + '</div><p class="tv-cap">❦</p>' },
    { t: 'Erst denken, dann prüfen', lead: 'Neben jeder Frage im Text liegt die Lösung bereit.',
      body: 'Antworte zuerst selbst, laut oder im Kopf. Dann „Antwort zeigen“ und ehrlich bewerten: Deine Bewertung bestimmt, wann die Frage wiederkommt.',
      art: '<div class="tv-card"><p class="tv-q"><b>F1.</b> Zwischen welchen zwei Punkten spannt sich jede Stimmlippe?</p><span class="tv-pill tv-a1">Antwort zeigen</span>' +
        '<div class="tv-ans tv-a2"><i></i><i class="short"></i></div><div class="tv-rate tv-a3"><span>Nochmal</span><span>Unsicher</span><span class="tv-on">Gewusst</span></div></div>' },
    { t: 'Abbildungen', lead: 'Tippe auf eine Abbildung, um sie groß zu sehen.',
      body: '„Beschriftung verdecken“ macht jede Abbildung zum Test: erst benennen, dann antippen. Über „Anatomie“ siehst du dieselbe Stelle in einer echten Zeichnung.',
      art: '<div class="tv-card tv-fig"><div class="tv-sw"><span class="tv-s1">Schema</span><span class="tv-s2">Anatomie</span></div>' +
        '<svg viewBox="0 0 220 120" aria-hidden="true"><path class="tv-cart" d="M110 14 L40 90 L52 96 L110 34 L168 96 L180 90 Z"/><path class="tv-fold" d="M108 36 L102 100 M112 36 L118 100"/>' +
        '<line class="tv-lead" x1="150" y1="60" x2="182" y2="44"/><line class="tv-lead" x1="70" y1="62" x2="34" y2="50"/><line class="tv-lead" x1="104" y1="92" x2="70" y2="108"/>' +
        '<rect class="tv-lbl l1" x="184" y="36" width="32" height="14" rx="3"/><rect class="tv-lbl l2" x="4" y="42" width="30" height="14" rx="3"/><rect class="tv-lbl l3" x="34" y="100" width="36" height="14" rx="3"/>' +
        '<text class="tv-txt l1" x="186" y="46">Schild</text><text class="tv-txt l2" x="6" y="52">Lippe</text><text class="tv-txt l3" x="36" y="110">Stell</text></svg></div>' },
    { t: 'Quiz und Schwachstellen', lead: 'Am Ende jedes Abschnitts wartet ein kurzes Quiz.',
      body: 'Was du verpasst, landet unter „Schwachstellen“ im Merkheft, mit Lösung und Weg zurück zur Stelle. Es verschwindet erst, wenn du es zweimal hintereinander richtig hast.',
      art: '<div class="tv-card"><p class="tv-q">Der linke N. laryngeus recurrens schlingt sich um …</p><div class="tv-opts"><span class="tv-bad">✕ die A. subclavia</span><span class="tv-ok">✓ den Aortenbogen</span><span>die A. thyroidea inferior</span></div>' +
        '<div class="tv-weak"><b>Schwachstellen</b><span>1</span></div></div>' },
    { t: 'Jeden Tag: Heute', lead: 'Auf der Startseite liegt jeden Tag eine Runde von etwa fünfzehn Minuten.',
      body: 'Sie mischt deine Schwachstellen, fällige Karten und Neues aus den gelernten Abschnitten, und am Ende eine Abbildung zum Beschriften. Du musst nichts planen; kurze tägliche Runden halten länger als lange vor der Prüfung.',
      art: '<div class="tv-card"><p class="tv-title">Deine Runde</p><div class="tv-chips"><span style="--i:0">2 Schwachstellen</span><span style="--i:1">5 fällig</span><span style="--i:2">4 neu</span><span style="--i:3">1 Abbildung</span></div><span class="tv-pill tv-solid">Runde starten</span></div>' },
    { t: 'Merkheft und Zeichnen', lead: 'Markiere einen Satz, dann „★ Merken“.',
      body: 'Er wird im Text unterstrichen und im Merkheft gesammelt, gern mit eigener Notiz. In jedem Kasten „Aus dem Gedächtnis zeichnen“ kannst du direkt auf dem Bildschirm zeichnen und danach die echte Abbildung darüberlegen.',
      art: '<div class="tv-card"><p class="tv-line">Die Muskeln stellen die Stimmlippen nur ein: <mark class="tv-hl">den Rest erledigen Luftdruck und Elastizität.</mark></p><span class="tv-pop">★ Merken</span>' +
        '<svg class="tv-draw" viewBox="0 0 220 60" aria-hidden="true"><path d="M10 40 C40 10, 70 10, 90 34 S140 58, 170 26 S205 12, 212 30"/></svg></div>' },
    { t: 'Ganz für dich', lead: 'Oben unter „Aa“ stellst du Schrift und Größe ein.',
      body: 'Für lange Abende gibt es eine ruhigere, serifenlose Schrift. Unter jeder Überschrift kann dir die Seite den Abschnitt vorlesen.' + (hasSync ? ' Mit einem Konto ist alles auf jedem Gerät gleich.' : ' Alles bleibt in diesem Browser gespeichert.'),
      art: '<div class="tv-card tv-set"><span class="tv-aa">Aa</span><div class="tv-sizes"><span style="--s:.8">a</span><span style="--s:1">a</span><span style="--s:1.25">a</span><span style="--s:1.5">a</span></div>' +
        '<span class="tv-pill tv-voice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9z"/><path class="w1" d="M17 9a4 4 0 0 1 0 6"/><path class="w2" d="M19.5 6.5a8 8 0 0 1 0 11"/></svg>Vorlesen</span></div>' },
  ];

  var dlg, i = 0;
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'tour'; dlg.id = 'tour'; dlg.setAttribute('aria-labelledby', 'tour-t');
    dlg.innerHTML = '<i class="orn tl" aria-hidden="true">❦</i><i class="orn tr" aria-hidden="true">❦</i><i class="orn bl" aria-hidden="true">❦</i><i class="orn br" aria-hidden="true">❦</i>' +
      '<button class="tbtn tour-x" type="button" data-tour="skip" aria-label="Anleitung schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="tour-art" aria-hidden="true"></div><div class="tour-text"><span class="eyebrow tour-k"></span><h2 id="tour-t"></h2><p class="tour-lead"></p><p class="tour-body"></p></div>' +
      '<div class="tour-nav"><button type="button" class="linkbtn" data-tour="skip">Überspringen</button><div class="tour-dots" role="tablist" aria-label="Schritte">' +
      STEPS.map(function (s, k) { return '<button type="button" role="tab" data-dot="' + k + '" aria-label="Schritt ' + (k + 1) + ': ' + s.t + '"></button>'; }).join('') +
      '</div><div class="tour-btns"><button type="button" class="cta ghost" data-tour="prev">Zurück</button><button type="button" class="cta" data-tour="next">Weiter</button></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tour]'), d = e.target.closest('[data-dot]');
      if (d) go(+d.getAttribute('data-dot'));
      if (!a) return;
      var act = a.getAttribute('data-tour');
      if (act === 'next') { if (i < STEPS.length - 1) go(i + 1); else finish(true); }
      else if (act === 'prev') go(i - 1);
      else if (act === 'skip') finish(false);
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); if (i < STEPS.length - 1) go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    });
    dlg.addEventListener('cancel', function () { finish(false); });
  }
  function go(k) {
    k = Math.max(0, Math.min(STEPS.length - 1, k));
    var s = STEPS[k], box = $('.tour-text', dlg), art = $('.tour-art', dlg);
    i = k;
    // Inhalt austauschen und neu einblenden (Animationen der Abbildung starten so von vorn)
    box.classList.remove('tour-in'); art.classList.remove('tour-in'); void box.offsetWidth;
    $('.tour-k', dlg).textContent = 'Schritt ' + (k + 1) + ' von ' + STEPS.length;
    $('#tour-t', dlg).textContent = s.t;
    $('.tour-lead', dlg).textContent = s.lead;
    $('.tour-body', dlg).textContent = s.body;
    art.innerHTML = s.art;
    box.classList.add('tour-in'); art.classList.add('tour-in');
    $$('[data-dot]', dlg).forEach(function (d, n) { d.setAttribute('aria-selected', n === k); d.classList.toggle('on', n === k); d.classList.toggle('seen', n < k); });
    $('[data-tour="prev"]', dlg).style.visibility = k ? 'visible' : 'hidden';
    var last = k === STEPS.length - 1, started = state.done && Object.keys(state.done).length;
    $('[data-tour="next"]', dlg).textContent = last ? (started ? 'Los geht’s' : 'Mit Abschnitt 1 beginnen') : 'Weiter';
  }
  function open() { if (!dlg) build(); go(0); dlg.showModal(); $('[data-tour="next"]', dlg).focus(); }
  function finish(toStart) {
    if (!state.tour && K.NEWS_ID) state.newsSeen = K.NEWS_ID; // wer gerade neu anfängt, braucht „Neu im Kurs“ nicht
    state.tour = Date.now(); K.save();
    if (dlg.open) dlg.close();
    var started = state.done && Object.keys(state.done).length;
    if (toStart && !started && K.page === 'home') location.href = '01-gelenke-muskeln.html';
  }

  $$('[data-open-tour]').forEach(function (b) { b.addEventListener('click', function () {
    var side = $('#sidebar'); if (side) { side.classList.remove('open'); var sc = $('.scrim'); if (sc) sc.classList.remove('open'); }
    var other = $('dialog[open]'); if (other) other.close();
    open(); }); });
  // ---------- Willkommen: Konto zuerst, dann Anleitung, dann die Website ----------
  var S = window.KursSync;
  function gate() {
    var g = document.createElement('dialog');
    g.className = 'gate'; g.id = 'gate'; g.setAttribute('aria-labelledby', 'gate-t');
    g.innerHTML =
      '<div class="gate-in">' +
      '<div class="poster gate-poster" aria-hidden="true"><span>vagus</span><span>vagus</span><span>vagus</span>' +
      '<svg viewBox="0 0 89 55"><rect x="0" y="0" width="89" height="55"/><line x1="55" y1="0" x2="55" y2="55"/><line x1="55" y1="34" x2="89" y2="34"/><line x1="68" y1="34" x2="68" y2="55"/><line x1="55" y1="42" x2="68" y2="42"/><line x1="63" y1="34" x2="63" y2="42"/><line x1="63" y1="39" x2="68" y2="39"/><path stroke-width=".6" d="M0,55 A55,55 0 0 1 55,0 A34,34 0 0 1 89,34 A21,21 0 0 1 68,55 A13,13 0 0 1 55,42 A8,8 0 0 1 63,34 A5,5 0 0 1 68,39"/></svg></div>' +
      '<div class="gate-body">' +
        '<span class="eyebrow">N. vagus und Stimme · Lernkurs</span><h1 id="gate-t">Willkommen</h1>' +
        '<p class="gate-lead">Bevor es losgeht: Mit einem Konto ist dein Lernstand sicher und auf jedem Gerät gleich, vom Handy bis zum Laptop.</p>' +
        '<div class="gate-tabs" role="tablist"><button type="button" role="tab" data-gate-tab="signup" aria-selected="true">Konto anlegen</button><button type="button" role="tab" data-gate-tab="login" aria-selected="false">Ich habe schon ein Konto</button></div>' +
        '<form class="gate-form" data-gate-form novalidate>' +
          '<label>E-Mail<input name="email" type="email" autocomplete="username" required></label>' +
          '<label>Passwort <span class="note" data-gate-hint>(mindestens 8 Zeichen)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
          '<p class="acc-err" role="alert"></p>' +
          '<button class="cta" type="submit" data-gate-submit>Konto anlegen</button>' +
        '</form>' +
        '<div class="gate-done" data-gate-done hidden></div>' +
        '<p class="gate-skip"><button type="button" class="linkbtn" data-gate-skip>Erst einmal ohne Konto</button><span class="note">Alles bleibt dann in diesem Browser. Ein Konto kannst du jederzeit oben unter „Anmelden“ anlegen.</span></p>' +
        '<p class="note gate-privacy">Gespeichert werden nur dein Lernstand, Notizen und Einstellungen, auf Servern in der EU. Keine Werbung, keine Weitergabe.</p>' +
      '</div></div>';
    document.body.appendChild(g);
    var mode = 'signup', form = g.querySelector('[data-gate-form]'), err = g.querySelector('.acc-err');
    function setMode(m) {
      mode = m;
      $$('[data-gate-tab]', g).forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-gate-tab') === m); });
      g.querySelector('[data-gate-submit]').textContent = m === 'signup' ? 'Konto anlegen' : 'Anmelden';
      g.querySelector('[data-gate-hint]').hidden = m !== 'signup';
      form.password.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
      err.textContent = '';
    }
    $$('[data-gate-tab]', g).forEach(function (t) { t.addEventListener('click', function () { setMode(t.getAttribute('data-gate-tab')); }); });
    // Weiter: Willkommen blendet aus, die Anleitung blendet ein (oder direkt die Seite, wenn die Anleitung schon gesehen wurde)
    function onward(reload) {
      state.gate = Date.now(); K.save();
      g.classList.add('gate-out');
      setTimeout(function () {
        g.close(); g.remove();
        if (reload) { location.reload(); return; }
        if (!state.tour) open();
      }, 380);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim(), pw = form.password.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.'; form.email.focus(); return; }
      if (mode === 'signup' && pw.length < 8) { err.textContent = 'Bitte mindestens 8 Zeichen.'; form.password.focus(); return; }
      if (!pw) { err.textContent = 'Bitte das Passwort eingeben.'; form.password.focus(); return; }
      $$('button, input', form).forEach(function (x) { x.disabled = true; });
      err.textContent = '';
      (mode === 'signup' ? S.signup(email, pw) : S.login(email, pw)).then(function (r) {
        form.hidden = true; g.querySelector('.gate-tabs').hidden = true; g.querySelector('.gate-skip').hidden = true;
        var done = g.querySelector('[data-gate-done]'); done.hidden = false;
        if (r.confirm) {
          done.innerHTML = '<p><b>Fast geschafft.</b> Wir haben dir eine E-Mail an <b>' + email.replace(/[<>&"]/g, '') + '</b> geschickt. Ein Klick auf den Link darin bestätigt dein Konto, auf diesem oder einem anderen Gerät.</p><p class="note">Bis dahin kannst du schon anfangen; dein Lernstand wird danach automatisch gesichert. Nichts angekommen? Schau im Spam-Ordner nach.</p><button class="cta" type="button" data-gate-go>Weiter zur Anleitung</button>';
          done.querySelector('[data-gate-go]').addEventListener('click', function () { onward(false); });
        } else {
          // Angemeldet: Daten vom anderen Gerät sind schon da, die Seite baut sich einmal neu auf
          done.innerHTML = '<p><b>Angemeldet.</b> Dein Lernstand ist gesichert.</p>';
          setTimeout(function () { onward(mode === 'login'); }, 900);
        }
      }).catch(function (x) {
        err.textContent = S.niceError(x);
        $$('button, input', form).forEach(function (y) { y.disabled = false; });
      });
    });
    g.querySelector('[data-gate-skip]').addEventListener('click', function () { onward(false); });
    g.addEventListener('cancel', function (e) { e.preventDefault(); }); // nur über die Knöpfe weiter, nicht versehentlich per Esc
    g.showModal();
    setTimeout(function () { form.email.focus(); }, 60);
  }

  // Erster Besuch: zuerst Willkommen mit Konto (wenn eingerichtet und nicht angemeldet), dann Anleitung.
  // Nicht über einen Link aus einer E-Mail oder einen Sprung zu einer bestimmten Stelle.
  var q = new URLSearchParams(location.search);
  var direct = /access_token|error_description/.test(location.hash) || q.get('note') || q.get('fig') || q.get('hl');
  if (!direct) {
    setTimeout(function () {
      if (document.querySelector('dialog[open]')) return;
      if (S && S.signup && !S.hasSession() && !state.gate) gate();
      else if (!state.tour) open();
    }, 500);
  }
  window.KursTour = { open: open, gate: gate };
})();
