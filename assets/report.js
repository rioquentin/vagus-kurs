// Fehler, die im Browser passieren, still an Supabase melden (Tabelle client_errors, siehe supabase/monitor-push.sql).
// Ohne Inhalt aus dem Lernstand: nur Meldung, Stelle, Seite, Version und Gerät. Ein kleiner Fänger im <head>
// (window.__kErr) sammelt, was schon vor dieser Datei passiert ist.
(function () {
  var cfg = window.KURS_SYNC, QKEY = 'vagus-kurs:errq', CAP = 'vagus-kurs:errcap';
  var early = window.__kErr || [];
  function get(k, s) { try { return JSON.parse((s || localStorage).getItem(k)); } catch (e) { return null; } }
  function put(k, v, s) { try { (s || localStorage).setItem(k, JSON.stringify(v)); } catch (e) {} }
  // Lokal (Tests, Vorschau) nie an das echte Supabase: nur an die Test-Adresse in vagus-kurs:report-test (dev/mock-supabase.mjs)
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    var t = get('vagus-kurs:report-test');
    cfg = typeof t === 'string' && /^http:\/\/localhost:\d+$/.test(t) ? { url: t, key: 'mock-anon-key' } : null;
  }
  var off = !cfg || !cfg.url || get('vagus-kurs:noreport');
  if (off) { window.__kErr = { push: function () {} }; return; }

  var sent = 0, seen = get('vagus-kurs:errseen', sessionStorage) || [];
  function short(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function here(u) { try { var x = new URL(u, location.href); return x.origin === location.origin ? x.pathname.replace(/^.*\//, '') + x.search.replace(/[?&]v=[^&]*/, '') : null; } catch (e) { return null; } }
  function row(e) {
    var t = e && e.target, r;
    if (e && e.type === 'unhandledrejection') {
      var why = e.reason || {};
      r = { kind: 'reject', msg: why.message || String(why), stack: why.stack };
      if (why.name === 'AbortError' || why.status) return null; // abgebrochene Anfragen, Serverantworten: kein Fehler der Seite
    } else if (t && t !== window && (t.src || t.href)) {
      if (!navigator.onLine) return null; // offline schlagen Ladevorgänge erwartbar fehl
      var f = here(t.src || t.href); if (!f) return null;
      r = { kind: 'resource', msg: t.tagName.toLowerCase() + ' lädt nicht', src: f };
    } else if (e) {
      if (e.filename && !here(e.filename)) return null; // Erweiterungen, fremde Skripte
      if (/^Script error\.?$|ResizeObserver loop/.test(e.message || '')) return null;
      r = { kind: 'error', msg: e.message || 'Fehler', src: e.filename ? here(e.filename) + ':' + e.lineno + ':' + e.colno : null, stack: e.error && e.error.stack };
    }
    if (!r) return null;
    var d = document.documentElement, s = get('vagus-kurs:v1') || {};
    return { build: window.KURS_BUILD || null, page: short(location.pathname.replace(/^.*\//, '') + location.hash, 200), kind: r.kind,
      msg: short(r.msg, 500), src: r.src ? short(r.src, 300) : null, stack: r.stack ? short(r.stack, 2000) : null, ua: short(navigator.userAgent, 300),
      extra: { ui: s.ui || 'de', theme: d.dataset.theme || 'system', app: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches),
        w: innerWidth, h: innerHeight, online: navigator.onLine, acc: !!(window.KursSync && window.KursSync.hasSession && window.KursSync.hasSession()) } };
  }
  // Erst nach Bestätigung aus der Warteschlange nehmen (beim Schließen der Seite kann die Anfrage verloren gehen)
  var busy = false;
  function flush() {
    var q = get(QKEY) || []; if (!q.length || !navigator.onLine || busy) return;
    busy = true;
    fetch(cfg.url + '/rest/v1/client_errors', { method: 'POST', keepalive: true,
      headers: { apikey: cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(q) })
      .then(function (r) {
        // 4xx (z. B. Tabelle fehlt noch): verwerfen statt ewig erneut zu senden
        if (r.ok || r.status < 500) put(QKEY, (get(QKEY) || []).slice(q.length));
      })
      .catch(function () {})
      .then(function () { busy = false; });
  }
  function take(e) {
    var r; try { r = row(e); } catch (x) { return; } if (!r) return;
    var id = r.kind + r.msg + r.src; if (seen.indexOf(id) >= 0 || sent >= 8) return;
    // höchstens 30 Meldungen pro Gerät und Tag
    var day = new Date().toISOString().slice(0, 10), cap = get(CAP) || {}; if (cap.d !== day) cap = { d: day, n: 0 }; if (cap.n >= 30) return;
    cap.n++; put(CAP, cap); sent++; seen.push(id); put('vagus-kurs:errseen', seen.slice(-50), sessionStorage);
    put(QKEY, (get(QKEY) || []).concat([r]).slice(-20));
    clearTimeout(take.t); take.t = setTimeout(flush, 1500);
  }
  addEventListener('error', take, true);
  addEventListener('unhandledrejection', take);
  addEventListener('online', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.__kErr = { push: take };
  early.forEach(take);
  setTimeout(flush, 4000); // Liegengebliebenes von früher (offline)
  // Anwesenheit für die Übersicht (tableau.html): etwa jede Minute, nur solange die Seite sichtbar ist.
  // Angemeldet → über KursSync (frisches Token), damit die Datenbank das Konto selbst erkennt; sonst anonym.
  var sid = null; try { sid = sessionStorage.getItem('vagus-kurs:sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('vagus-kurs:sid', sid); } } catch (e) {}
  var lastPing = 0;
  function ping() {
    if (!sid || document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - lastPing < 20000) return;
    lastPing = Date.now();
    var body = { p_sid: sid, p_page: location.pathname.replace(/^.*\//, '') || 'index.html', p_ua: navigator.userAgent.slice(0, 300),
      p_app: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches) };
    var S = window.KursSync, real = window.KURS_SYNC && window.KURS_SYNC.url === cfg.url;
    (real && S && S.hasSession && S.hasSession() && S.rest ? S.rest('/rest/v1/rpc/presence_ping', { method: 'POST', body: body })
      : fetch(cfg.url + '/rest/v1/rpc/presence_ping', { method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).catch(function () {});
  }
  setTimeout(ping, 2500);
  setInterval(ping, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') ping(); });

  window.KursReport = { flush: flush, test: function (m) { take({ type: 'error', message: m || 'Testmeldung', filename: location.href }); } };
})();
