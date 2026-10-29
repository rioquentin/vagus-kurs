// Konto und Abgleich zwischen Geräten (Supabase: Auth + Tabelle user_state, per fetch, ohne Bibliothek).
// Ohne Konfiguration (assets/sync-config.js) bleibt alles wie vorher: nur lokal.
// Zusammenführen Eintrag für Eintrag über die Zeitstempel aus app.js, damit kein Gerät das andere überschreibt.
(function () {
  var K = window.Kurs, CFG = window.KURS_SYNC;
  if (!K || !CFG || !CFG.url || !CFG.key) return;
  var AUTH_KEY = 'vagus-kurs:auth', DIRTY_KEY = 'vagus-kurs:dirty', LAST_KEY = 'vagus-kurs:synced';
  var base = CFG.url.replace(/\/+$/, '');

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- Sitzung ----------
  var session = get(AUTH_KEY); // { access_token, refresh_token, expires_at, user: { id, email } }
  function setSession(s) {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Date.now() / 1000 + (s.expires_in || 3600)), user: s.user && { id: s.user.id, email: s.user.email } } : null;
    put(AUTH_KEY, session); ui();
  }
  function api(path, opt) {
    opt = opt || {};
    var h = { apikey: CFG.key, 'Content-Type': 'application/json' };
    if (opt.auth !== false && session) h.Authorization = 'Bearer ' + session.access_token;
    Object.keys(opt.headers || {}).forEach(function (k) { h[k] = opt.headers[k]; });
    return fetch(base + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, keepalive: !!opt.keepalive })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((j && (j.msg || j.error_description || j.message || j.error)) || ('HTTP ' + r.status)); err.status = r.status; err.code = j && (j.error_code || j.code); throw err; }
          return j;
        });
      });
  }
  function fresh() {
    if (!session) return Promise.reject(new Error('nicht angemeldet'));
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(session);
    return api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } })
      .then(function (s) { setSession(s); return session; })
      .catch(function (e) { if (e.status === 400 || e.status === 401) { setSession(null); status('Bitte erneut anmelden.'); } throw e; });
  }
  var redirect = location.href.split('#')[0].split('?')[0];

  // ---------- Zusammenführen ----------
  function merge(a, b) {
    a = a || {}; b = b || {};
    var out = {}, aNewer = (a._mt || 0) >= (b._mt || 0), newer = aNewer ? a : b, older = aNewer ? b : a;
    Object.keys(older).concat(Object.keys(newer)).forEach(function (k) { out[k] = k in newer ? newer[k] : older[k]; });
    // Lernkarten: pro Karte die zuletzt bewertete
    var ca = a.cards || {}, cb = b.cards || {}; out.cards = {};
    Object.keys(ca).concat(Object.keys(cb)).forEach(function (k) {
      var x = ca[k], y = cb[k];
      out.cards[k] = !x ? y : !y ? x : ((x.t || 0) > (y.t || 0) || ((x.t || 0) === (y.t || 0) && (x.n || 0) >= (y.n || 0))) ? x : y;
    });
    // Merkheft: pro Notiz die neueste Fassung; gelöscht bleibt gelöscht, wenn danach nicht mehr geändert
    var gone = {}; [a.gone || {}, b.gone || {}].forEach(function (g) { Object.keys(g).forEach(function (k) { gone[k] = Math.max(gone[k] || 0, g[k]); }); });
    var notes = {};
    (a.notes || []).concat(b.notes || []).forEach(function (n) {
      var cur = notes[n.id], t = n.mod || n.ts || 0;
      if (!cur || t > (cur.mod || cur.ts || 0)) notes[n.id] = n;
    });
    out.notes = Object.keys(notes).map(function (k) { return notes[k]; })
      .filter(function (n) { return !(gone[n.id] >= (n.mod || n.ts || 0)); })
      .sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
    out.gone = gone;
    // Erledigt und Ansicht je Abbildung: pro Schlüssel die zuletzt geänderte Seite
    [['done', 'doneT'], ['views', 'viewsT'], ['miss', 'missT'], ['quiz', 'quizT'], ['days', 'daysT'], ['skip', 'skipT'], ['log', 'logT'], ['conf', 'confT'], ['figs', 'figsT'], ['mnem', 'mnemT']].forEach(function (p) {
      var va = a[p[0]] || {}, vb = b[p[0]] || {}, ta = a[p[1]] || {}, tb = b[p[1]] || {};
      out[p[0]] = {}; out[p[1]] = {};
      Object.keys(va).concat(Object.keys(vb), Object.keys(ta), Object.keys(tb)).forEach(function (k) {
        var useA = (ta[k] || 0) >= (tb[k] || 0);
        var v = useA ? va[k] : vb[k];
        if (v !== undefined) out[p[0]][k] = v;
        out[p[1]][k] = Math.max(ta[k] || 0, tb[k] || 0);
      });
    });
    return out;
  }
  var same = function (x, y) { return JSON.stringify(x) === JSON.stringify(y); };

  // ---------- Abgleich ----------
  var busy = null, again = false;
  function sync(opts) {
    opts = opts || {};
    if (!session) return Promise.resolve();
    if (busy) { again = true; return busy; }
    status('Synchronisiere …', 'busy');
    busy = fresh().then(function () {
      return api('/rest/v1/user_state?select=data,updated_at&user_id=eq.' + session.user.id);
    }).then(function (rows) {
      var remote = rows && rows[0] ? rows[0].data : null;
      var local = JSON.parse(JSON.stringify(K.state));
      var merged = remote ? merge(local, remote) : local;
      var changedLocal = !same(merged, local);
      if (changedLocal) K.adopt(merged);
      var push = !remote || !same(merged, remote)
        ? api('/rest/v1/user_state?on_conflict=user_id', { method: 'POST', keepalive: opts.keepalive, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: { user_id: session.user.id, data: merged, updated_at: new Date().toISOString() } })
        : Promise.resolve();
      return push.then(function () {
        put(DIRTY_KEY, null); put(LAST_KEY, Date.now());
        status(null); ui();
        // Neue Daten vom anderen Gerät: Seite einmal neu aufbauen, damit alle Anzeigen stimmen
        if (changedLocal && opts.reloadOnChange) {
          var flag = 'vagus-kurs:reloaded';
          if (!sessionStorage.getItem(flag)) { sessionStorage.setItem(flag, '1'); location.reload(); }
        }
      });
    }).catch(function (e) {
      put(DIRTY_KEY, true);
      status(navigator.onLine === false ? 'Offline: wird später synchronisiert.' : 'Synchronisieren fehlgeschlagen: ' + e.message, 'error');
    }).then(function () {
      busy = null;
      if (again) { again = false; return sync(); }
    });
    return busy;
  }
  var timer;
  document.addEventListener('kurs:save', function () {
    if (!session) return;
    put(DIRTY_KEY, true);
    clearTimeout(timer); timer = setTimeout(sync, 4000);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && session && get(DIRTY_KEY)) { clearTimeout(timer); sync({ keepalive: true }); }
    if (document.visibilityState === 'visible' && session) sync({ reloadOnChange: true });
  });
  window.addEventListener('online', function () { if (session && get(DIRTY_KEY)) sync(); });

  // ---------- Oberfläche ----------
  var dlg = $('#account'), msg = '', kind = '';
  function status(text, k) {
    msg = text || ''; kind = k || '';
    var s = $('[data-acc-status]'); if (s) { s.textContent = msg; s.dataset.kind = kind; }
    $$('[data-acc-dot]').forEach(function (d) { d.dataset.kind = session ? (kind || 'ok') : ''; });
  }
  function ago(ts) {
    if (!ts) return 'noch nie';
    var m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? 'gerade eben' : m < 60 ? 'vor ' + m + ' Min.' : m < 1440 ? 'vor ' + Math.round(m / 60) + ' Std.' : new Date(ts).toLocaleDateString(document.documentElement.dataset.ui === 'en' ? 'en-GB' : 'de-DE');
  }
  function view(name) {
    $$('[data-acc-view]', dlg).forEach(function (v) { v.hidden = v.getAttribute('data-acc-view') !== name; });
    var f = $('[data-acc-view="' + name + '"] input', dlg); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function ui() {
    $$('[data-open-account]').forEach(function (b) {
      b.hidden = false;
      var l = $('.lbl', b); if (l) l.textContent = session ? 'Konto' : 'Anmelden';
      b.setAttribute('aria-label', session ? 'Konto: ' + session.user.email : 'Anmelden, um auf allen Geräten zu speichern');
    });
    if (!dlg) return;
    if (session) { $('[data-acc-email]', dlg).textContent = session.user.email; $('[data-acc-last]', dlg).textContent = ago(get(LAST_KEY)); }
    status(msg, kind);
  }
  function open(which) {
    if (!dlg) return;
    msg = ''; ui();
    view(which || (session ? 'in' : 'login'));
    $$('.acc-err', dlg).forEach(function (e) { e.textContent = ''; });
    dlg.showModal();
  }
  function err(form, text) { $('.acc-err', form).textContent = text; }
  function niceError(e) {
    var m = (e.message || '').toLowerCase();
    if (/invalid login|invalid_credentials/.test(m + ' ' + e.code)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/not confirmed|email_not_confirmed/.test(m + ' ' + e.code)) return 'Bitte zuerst die E-Mail-Adresse über den Link in der Bestätigungsmail bestätigen.';
    if (/already registered|user_already_exists/.test(m + ' ' + e.code)) return 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.';
    if (/password/.test(m) && /6|8|characters|weak/.test(m)) return 'Das Passwort ist zu kurz oder zu einfach (mindestens 8 Zeichen).';
    if (/rate limit|too many/.test(m)) return 'Zu viele Versuche. Bitte ein paar Minuten warten.';
    if (e instanceof TypeError || /failed to fetch/.test(m)) return 'Keine Verbindung. Bist du online?';
    return 'Das hat nicht geklappt: ' + e.message;
  }
  function busyForm(form, on) { $$('button, input', form).forEach(function (x) { x.disabled = on; }); }

  if (dlg) {
    $$('[data-open-account]').forEach(function (b) { b.addEventListener('click', function () {
      var side = $('#sidebar'); if (side) { side.classList.remove('open'); $('.scrim').classList.remove('open'); }
      open(); }); });
    $$('[data-acc-go]', dlg).forEach(function (b) { b.addEventListener('click', function () { view(b.getAttribute('data-acc-go')); }); });
    $$('[data-close-account]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

    $('[data-acc-form="login"]', dlg).addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.currentTarget; busyForm(f, true);
      api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: f.email.value.trim(), password: f.password.value } })
        .then(function (s) { setSession(s); f.reset(); view('in'); return sync({ reloadOnChange: true }); })
        .catch(function (x) { err(f, niceError(x)); })
        .then(function () { busyForm(f, false); });
    });
    $('[data-acc-form="signup"]', dlg).addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.currentTarget;
      if (f.password.value.length < 8) { err(f, 'Bitte mindestens 8 Zeichen.'); return; }
      if (f.password.value !== f.password2.value) { err(f, 'Die beiden Passwörter sind nicht gleich.'); return; }
      busyForm(f, true);
      api('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', auth: false, body: { email: f.email.value.trim(), password: f.password.value } })
        .then(function (r) {
          if (r && r.access_token) { setSession(r); f.reset(); view('in'); return sync(); }
          $('[data-acc-sent]', dlg).textContent = f.email.value.trim(); f.reset(); view('check');
        })
        .catch(function (x) { err(f, niceError(x)); })
        .then(function () { busyForm(f, false); });
    });
    $('[data-acc-form="forgot"]', dlg).addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.currentTarget; busyForm(f, true);
      api('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', auth: false, body: { email: f.email.value.trim() } })
        .then(function () { $('[data-acc-sent]', dlg).textContent = f.email.value.trim(); f.reset(); view('check'); })
        .catch(function (x) { err(f, niceError(x)); })
        .then(function () { busyForm(f, false); });
    });
    $('[data-acc-form="newpw"]', dlg).addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.currentTarget;
      if (f.password.value.length < 8) { err(f, 'Bitte mindestens 8 Zeichen.'); return; }
      busyForm(f, true);
      fresh().then(function () { return api('/auth/v1/user', { method: 'PUT', body: { password: f.password.value } }); })
        .then(function () { f.reset(); view('in'); status('Neues Passwort gespeichert.'); return sync(); })
        .catch(function (x) { err(f, niceError(x)); })
        .then(function () { busyForm(f, false); });
    });
    $('[data-acc-sync]', dlg).addEventListener('click', function () { sync({ reloadOnChange: true }).then(ui); });
    $('[data-acc-logout]', dlg).addEventListener('click', function () {
      var done = function () { setSession(null); put(LAST_KEY, null); view('login'); status('Abgemeldet. Deine Daten bleiben auf diesem Gerät.'); };
      (get(DIRTY_KEY) ? sync() : Promise.resolve()).then(function () {
        return api('/auth/v1/logout', { method: 'POST' }).catch(function () {});
      }).then(done);
    });
    $('[data-acc-wipe]', dlg).addEventListener('click', function () {
      if (!confirm('Alle gesicherten Daten auf dem Server löschen? Auf diesem Gerät bleiben sie erhalten.')) return;
      fresh().then(function () { return api('/rest/v1/user_state?user_id=eq.' + session.user.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); })
        .then(function () { setSession(null); put(LAST_KEY, null); view('login'); status('Serverdaten gelöscht und abgemeldet. Um das Konto ganz zu entfernen, schreib an die Kursverantwortliche.'); })
        .catch(function (x) { status(niceError(x), 'error'); });
    });
  }

  // Rückkehr aus einer E-Mail (Bestätigung oder Passwort zurücksetzen): Sitzung steht im #-Teil der Adresse
  var h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    var s = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 };
    var type = h.get('type');
    history.replaceState(null, '', location.pathname + location.search);
    session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() / 1000 + s.expires_in, user: { id: '', email: '' } };
    api('/auth/v1/user').then(function (u) {
      s.user = u; setSession(s);
      if (type === 'recovery') open('newpw');
      else { open('in'); status('E-Mail bestätigt, du bist angemeldet.'); sync({ reloadOnChange: true }); }
    }).catch(function () { setSession(null); open('login'); status('Der Link ist abgelaufen. Bitte erneut anmelden oder einen neuen anfordern.', 'error'); });
  } else if (h.get('error_description')) {
    history.replaceState(null, '', location.pathname + location.search);
    open('login'); status(h.get('error_description').replace(/\+/g, ' '), 'error');
  } else if (session) {
    sync({ reloadOnChange: true });
  }
  ui();
  setTimeout(function () { sessionStorage.removeItem('vagus-kurs:reloaded'); }, 5000);
  // Für den Willkommensbildschirm (tour.js): gleiche Wege wie im Konto-Dialog
  function signup(email, password) {
    return api('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', auth: false, body: { email: email, password: password } })
      .then(function (r) {
        if (r && r.access_token) { setSession(r); return sync().then(function () { return { session: true }; }); }
        return { confirm: true };
      });
  }
  function login(email, password) {
    return api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: email, password: password } })
      .then(function (s) { setSession(s); return sync().then(function () { return { session: true }; }); });
  }
  window.KursSync = { sync: sync, merge: merge, signup: signup, login: login, niceError: niceError,
    hasSession: function () { return !!session; } };
})();
