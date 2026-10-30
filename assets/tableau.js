// Tableau de bord (tableau.html): santé du site et progression. Nur für Admin-Konten (supabase/admin.sql).
// Nutzt die Anmeldung des Kurses im selben Browser (localStorage vagus-kurs:auth). Liest Zahlen, nie Notiz-Inhalte.
(function () {
  var CFG = window.KURS_SYNC, UNITS = window.KURS_UNITS || [], REPO = 'rioquentin/vagus-kurs', AUTH = 'vagus-kurs:auth';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var get = function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  function gate(html) { $('[data-gate]').hidden = false; $('[data-gate-msg]').innerHTML = html; $('[data-meta]').textContent = ''; }

  // ── Zeit ──
  function ago(t) {
    var s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 90) return 'à l’instant'; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h'; var d = Math.round(s / 86400); return d === 1 ? 'hier' : 'il y a ' + d + ' jours';
  }
  function date(t) { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  function dayKey(t) { var d = new Date(t - 4 * 3600e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var TODAY = Math.floor((Date.now() - 4 * 3600e3 - new Date().getTimezoneOffset() * 60e3) / 864e5);
  function browser(ua) {
    ua = ua || '';
    var os = /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '?';
    var b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'autre';
    return b + ' · ' + os;
  }

  // ── Anmeldung (wie sync.js, mit Erneuern des Tokens) ──
  function session() {
    var s = get(AUTH); if (!s) return Promise.reject({ gate: 'login' });
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    return fetch(CFG.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { if (!r.ok) throw { gate: 'login' }; return r.json(); })
      .then(function (n) { var x = { access_token: n.access_token, refresh_token: n.refresh_token, expires_at: n.expires_at || Date.now() / 1000 + (n.expires_in || 3600), user: n.user ? { id: n.user.id, email: n.user.email } : s.user }; localStorage.setItem(AUTH, JSON.stringify(x)); return x; });
  }
  function rpc(fn, body) {
    return session().then(function (s) {
      return fetch(CFG.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) {} if (!r.ok) throw { status: r.status, msg: (j && (j.message || j.msg)) || t }; return j; }); });
    });
  }
  function runs(file) {
    return fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + file + '/runs?per_page=' + (file === 'push.yml' ? 24 : 6), { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : { workflow_runs: [], missing: r.status }; }).catch(function () { return { workflow_runs: [], offline: true }; });
  }

  // ── Santé du site ──
  function health(ov, gh) {
    var errs = ov.errors || [], mon = gh[0].workflow_runs, push = gh[1].workflow_runs, keep = gh[2].workflow_runs;
    var lastMon = mon.find(function (r) { return r.status === 'completed'; });
    var groups = {};
    errs.forEach(function (e) {
      var k = e.kind + '|' + e.msg + '|' + (e.src || '');
      var g = groups[k] = groups[k] || { e: e, n: 0, last: e.at, first: e.at, pages: {}, br: {}, builds: {} };
      g.n++; if (e.at > g.last) g.last = e.at; if (e.at < g.first) g.first = e.at;
      g.pages[e.page || '?'] = 1; g.br[browser(e.ua)] = 1; if (e.build) g.builds[e.build] = 1;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    var week = errs.filter(function (e) { return Date.now() - new Date(e.at) < 7 * 864e5; }).length;
    var devs = ov.devices || [], lastSent = devs.map(function (d) { return d.last_sent; }).filter(Boolean).sort().pop();
    var dots = function (rs) { return '<span class="tb-dots" aria-hidden="true">' + rs.slice().reverse().map(function (r) { return '<i class="' + (r.status !== 'completed' ? 'o' : r.conclusion === 'success' ? '' : 'x') + '" title="' + esc(date(r.created_at) + ' · ' + (r.conclusion || r.status)) + '"></i>'; }).join('') + '</span>'; };
    var runRow = function (name, rs, what) {
      var r = rs[0]; if (!r) return '<tr><td>' + name + '</td><td colspan="3" class="tb-sub">Pas encore lancé' + (gh.some(function (x) { return x.missing; }) ? ' (arrive au prochain déploiement)' : '') + '</td></tr>';
      var okk = r.conclusion === 'success';
      return '<tr><td><b>' + name + '</b><br><span class="tb-sub">' + what + '</span></td><td class="' + (r.status !== 'completed' ? '' : okk ? 'tb-ok' : 'tb-bad') + '">' + (r.status !== 'completed' ? 'en cours' : okk ? '✓ réussi' : '✗ échec') + '<br><span class="tb-sub">' + ago(r.created_at) + '</span></td><td class="hide-s">' + dots(rs) + '</td><td><a href="' + esc(r.html_url) + '" target="_blank" rel="noopener">détails</a></td></tr>';
    };
    var html = '<div data-presence></div><div class="tb-grid">' +
      '<div class="tb-card"><span class="tb-k">Contrôle du lundi</span>' + (lastMon ? '<p class="tb-big ' + (lastMon.conclusion === 'success' ? 'tb-ok' : 'tb-bad') + '">' + (lastMon.conclusion === 'success' ? '✓' : '✗') + '<small>' + ago(lastMon.created_at) + '</small></p><p class="tb-sub">' + (lastMon.conclusion === 'success' ? '13 pages, Chrome et Safari, téléphone et ordinateur : tout va bien.' : 'Quelque chose ne va pas : voir le détail ci-dessous.') + '</p>' : '<p class="tb-big">–</p><p class="tb-sub">Premier contrôle lundi prochain, ou lancé à la main depuis GitHub.</p>') + '</div>' +
      '<div class="tb-card"><span class="tb-k">Erreurs remontées</span><p class="tb-big ' + (week ? 'tb-bad' : 'tb-ok') + '">' + week + '<small>sur 7 jours</small></p><p class="tb-sub">' + (errs.length ? errs.length + ' sur 30 jours, ' + list.length + ' différente' + (list.length > 1 ? 's' : '') + '.' : 'Aucune erreur sur 30 jours.') + '</p></div>' +
      '<div class="tb-card"><span class="tb-k">Rappels</span><p class="tb-big">' + devs.length + '<small>appareil' + (devs.length > 1 ? 's' : '') + '</small></p><p class="tb-sub">' + (devs.length ? 'Dernier envoi : ' + (lastSent ? date(lastSent) : 'pas encore') + '.' : 'Personne ne les a encore activés.') + '</p></div>' +
      '</div>';
    html += '<div class="tb-sec"><h2>Erreurs (30 jours)</h2>' + (list.length ? '<ul class="tb-list">' + list.map(function (g) {
      var e = g.e, x = e.extra || {};
      return '<li><details class="tb-err"><summary><span class="m">' + esc(e.msg) + '</span><span class="n">' + g.n + '×</span><span class="w">' + esc(e.kind === 'resource' ? 'fichier manquant : ' + e.src : e.kind === 'reject' ? 'promesse rejetée' : (e.src || '')) + ' · dernière fois ' + ago(g.last) + ' · ' + esc(Object.keys(g.pages).join(', ')) + ' · ' + esc(Object.keys(g.br).join(', ')) + '</span></summary>' +
        '<p class="tb-sub" style="margin-top:10px">Première fois ' + date(g.first) + ' · versions ' + esc(Object.keys(g.builds).join(', ') || '?') + ' · écran ' + esc((x.w || '?') + '×' + (x.h || '?')) + (x.app ? ' · ouvert depuis l’écran d’accueil' : '') + (x.ui === 'en' ? ' · interface en anglais' : '') + (x.acc ? ' · connectée' : '') + '</p>' +
        (e.stack ? '<pre>' + esc(e.stack) + '</pre>' : '') + '<pre>' + esc(e.ua) + '</pre></details></li>';
    }).join('') + '</ul><p style="margin-top:14px"><button class="tb-btn" type="button" data-clear>Tout marquer comme traité</button> <span class="tb-sub" data-clear-msg>Supprime ces erreurs ; le contrôle du lundi repart de zéro.</span></p>' : '<p class="tb-sub">Rien à signaler.</p>') + '</div>';
    html += '<div class="tb-sec"><h2>Tâches automatiques</h2><div class="tb-card" style="padding:6px 14px"><table class="tb-runs"><thead><tr><th>Tâche</th><th>Dernier passage</th><th class="hide-s">Historique</th><th></th></tr></thead><tbody>' +
      runRow('Contrôle du site', mon, 'chaque lundi') + runRow('Rappels', push, 'chaque heure') + runRow('Supabase éveillé', keep, 'lundi et jeudi') + '</tbody></table></div>' +
      (gh.some(function (x) { return x.offline; }) ? '<p class="tb-sub">GitHub injoignable pour le moment.</p>' : '') + '</div>';
    if (devs.length) html += '<div class="tb-sec"><h2>Appareils avec rappels</h2><div class="tb-card" style="padding:6px 14px"><table class="tb-runs"><thead><tr><th>Compte</th><th>Heure</th><th class="hide-s">Service</th><th>Dernier envoi</th></tr></thead><tbody>' +
      devs.map(function (d) { return '<tr><td>' + esc(d.user || '?') + '</td><td>' + d.hour + ' h<br><span class="tb-sub">' + esc(d.tz) + '</span></td><td class="hide-s">' + esc(/apple/.test(d.service) ? 'Apple' : /google|fcm/.test(d.service) ? 'Google' : /mozilla/.test(d.service) ? 'Mozilla' : d.service) + '</td><td>' + (d.last_sent ? date(d.last_sent) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    var p = $('[data-panel="sante"]'); p.innerHTML = html;
    var clr = $('[data-clear]', p); if (clr) clr.addEventListener('click', function () {
      if (clr.dataset.armed !== '1') { clr.dataset.armed = '1'; clr.textContent = 'Sûr ? Cliquer encore'; return; }
      clr.disabled = true; rpc('admin_clear_errors', { p_until: ov.now }).then(function (n) { $('[data-clear-msg]', p).textContent = n + ' erreur(s) supprimée(s).'; setTimeout(load, 700); }, function () { clr.disabled = false; $('[data-clear-msg]', p).textContent = 'Échec, réessaie plus tard.'; });
    });
  }

  // ── Progression ──
  function learner(l) {
    var cards = l.cards || {}, ids = Object.keys(cards), sit = 0, due = 0;
    ids.forEach(function (k) { var c = cards[k] || {}; if (c.b >= 3) sit++; if (typeof c.d === 'number' && c.d <= TODAY) due++; });
    var done = l.done || [], views = l.views || [], log = l.log || {};
    var keys = Object.keys(log).filter(function (k) { return /^\d{4}-\d\d-\d\d$/.test(k) && log[k] > 0; }).sort(), lastAct = keys[keys.length - 1];
    var w7 = 0, d7 = 0; for (var i = 0; i < 7; i++) { var k = dayKey(Date.now() - i * 864e5); if (log[k]) { w7 += log[k]; d7++; } }
    var heat = ''; for (var j = 27; j >= 0; j--) { var kk = dayKey(Date.now() - j * 864e5), v = log[kk] || 0; heat += '<span data-l="' + (v === 0 ? 0 : v < 10 ? 1 : v < 30 ? 2 : 3) + '" title="' + kk + ' : ' + v + ' carte(s)"></span>'; }
    var seg = UNITS.map(function (u) { return '<span class="' + (done.indexOf(u.id) >= 0 ? 'd' : views.indexOf(u.id) >= 0 ? 'v' : '') + '" title="' + esc(u.n + ' · ' + u.t) + '"></span>'; }).join('');
    // Fehler und Karten pro Abschnitt
    var per = {}; UNITS.forEach(function (u) { per[u.id] = { seen: 0, sit: 0, miss: 0 }; });
    ids.forEach(function (k) { var u = k.slice(0, 2); if (per[u]) { per[u].seen++; if ((cards[k] || {}).b >= 3) per[u].sit++; } });
    Object.keys(l.miss || {}).forEach(function (k) { var m = l.miss[k] || {}, u = m.unit || k.slice(0, 2); if (per[u]) per[u].miss += m.n || 1; });
    var weak = UNITS.filter(function (u) { return per[u.id].miss; }).sort(function (a, b) { return per[b.id].miss - per[a.id].miss; }).slice(0, 3);
    var examIn = l.exam ? Math.round((new Date(l.exam + 'T12:00') - new Date(dayKey(Date.now()) + 'T12:00')) / 864e5) : null;
    var mocks = (l.examLog || []).slice(-5);
    return '<div class="tb-card"><h2>' + esc(l.email || 'Compte') + '</h2>' +
      '<p class="tb-sub">Dernière activité : ' + (lastAct ? (lastAct === dayKey(Date.now()) ? 'aujourd’hui' : date(lastAct + 'T12:00')) : 'aucune carte révisée') + ' · synchronisé ' + ago(l.updated) + (l.exam ? ' · examen le ' + date(l.exam + 'T12:00') + (examIn >= 0 ? ' (J-' + examIn + ')' : ' (passé)') : '') + '</p>' +
      '<h3>Sections · ' + done.length + ' sur 10 terminées</h3><div class="tb-seg" role="img" aria-label="' + done.length + ' sections terminées, ' + views.length + ' ouvertes">' + seg + '</div><p class="tb-sub">Plein : terminée · pâle : ouverte · vide : pas encore ouverte</p>' +
      '<div class="tb-facts" style="margin-top:14px"><div><b>' + ids.length + '</b><span>cartes vues</span></div><div><b>' + sit + '</b><span>bien sues</span></div><div><b>' + due + '</b><span>à revoir aujourd’hui</span></div><div><b>' + w7 + '</b><span>cartes cette semaine, sur ' + d7 + ' jour' + (d7 > 1 ? 's' : '') + '</span></div><div><b>' + l.notes + '</b><span>note' + (l.notes > 1 ? 's' : '') + ' · ' + l.mnem + ' moyen' + (l.mnem > 1 ? 's' : '') + ' mnémo</span></div></div>' +
      '<h3>4 dernières semaines</h3><p class="tb-sub">Une case par jour, la plus récente en bas à droite.</p><div class="tb-heat" role="img" aria-label="Activité des 28 derniers jours">' + heat + '</div>' +
      '<h3>Points fragiles</h3>' + (weak.length ? '<p class="tb-sub">' + weak.map(function (u) { return '<b>' + esc(u.n) + ' · ' + esc(u.t) + '</b> : ' + per[u.id].miss + ' erreur(s)'; }).join('<br>') + '</p>' : '<p class="tb-sub">Aucune erreur enregistrée aux quiz.</p>') +
      (mocks.length ? '<h3>Probeprüfungen</h3><p class="tb-sub">' + mocks.map(function (m) { return date(m.t) + ' : ' + m.pct + ' %' + (m.min ? ' en ' + m.min + ' min' : ''); }).join(' · ') + '</p>' : '') +
      '<h3>Par section</h3><table class="tb-units">' + UNITS.map(function (u) { var x = per[u.id]; return '<tr><td>' + esc(u.n) + '</td><td>' + esc(u.t) + '</td><td style="width:28%"><div class="tb-bar" title="' + x.sit + ' sur ' + x.seen + ' bien sues"><i style="width:' + (x.seen ? Math.round(x.sit / x.seen * 100) : 0) + '%"></i></div></td><td class="num">' + x.sit + '/' + x.seen + '</td></tr>'; }).join('') + '</table>' +
      '</div>';
  }
  function progress(ov) {
    var ls = ov.learners || [];
    $('[data-panel="progres"]').innerHTML = '<p class="tb-note">À ne consulter qu’avec l’accord de la personne. Seuls des chiffres sont affichés : jamais le texte des notes, des moyens mnémotechniques ni des réponses.</p>' +
      (ls.length ? '<div class="tb-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))">' + ls.map(learner).join('') + '</div>' : '<p class="tb-sub">Aucun compte n’a encore synchronisé.</p>');
  }

  // ── En ligne maintenant ──
  var PAGES = { 'index.html': 'Accueil', 'lernkarten.html': 'Lernkarten', 'merkheft.html': 'Merkheft', 'begriffe.html': 'Begriffe', '00-styleguide.html': 'Styleguide', 'tableau.html': 'Tableau de bord' };
  function pageName(p) { if (PAGES[p]) return PAGES[p]; var u = UNITS.filter(function (x) { return p && p.indexOf(x.id + '-') === 0; })[0]; return u ? u.n + ' · ' + u.t : (p || '?'); }
  function dur(a, b) { var m = Math.round((new Date(b) - new Date(a)) / 60000); return m < 1 ? 'moins d’une minute' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); }
  function presence(ov) {
    var el = $('[data-presence]'); if (!el) return;
    var all = ov.presence || [], now = new Date(ov.now).getTime();
    var on = all.filter(function (p) { return now - new Date(p.last) < 150000; });
    var who = function (p) { return p.user ? esc(p.user) : 'Visiteur anonyme'; };
    var accounts = {}; all.forEach(function (p) { if (p.user) accounts[p.user] = 1; });
    var anon = all.filter(function (p) { return !p.user; }).length;
    el.innerHTML = '<div class="tb-card tb-live"><div class="tb-live-h"><span class="tb-k"><i class="tb-pulse' + (on.length ? '' : ' off') + '" aria-hidden="true"></i>En ligne maintenant</span><span class="tb-sub">actualisé toutes les 30 s</span></div>' +
      (on.length ? '<ul class="tb-list" style="margin-top:12px">' + on.map(function (p) {
        return '<li class="tb-who"><b>' + who(p) + '</b><span>' + esc(pageName(p.page)) + '</span><span class="tb-sub">' + esc(browser(p.ua)) + (p.app ? ' · depuis l’icône' : '') + ' · depuis ' + dur(p.first, p.last) + '</span></li>';
      }).join('') + '</ul>' : '<p class="tb-sub" style="margin-top:8px">Personne en ce moment.</p>') +
      '<p class="tb-sub" style="margin-top:12px">Dernières 24 h : ' + all.length + ' visite' + (all.length > 1 ? 's' : '') + (Object.keys(accounts).length ? ' · comptes : ' + Object.keys(accounts).map(esc).join(', ') : '') + (anon ? ' · ' + anon + ' anonyme' + (anon > 1 ? 's' : '') : '') + '.</p></div>';
  }
  var live = null;
  function startLive() {
    clearInterval(live);
    live = setInterval(function () { if (document.visibilityState === 'visible') rpc('admin_overview').then(presence).catch(function () {}); }, 30000);
  }

  function load() {
    $('[data-meta]').textContent = 'Chargement …';
    return Promise.all([rpc('admin_overview'), Promise.all([runs('monitor.yml'), runs('push.yml'), runs('keepalive.yml')])]).then(function (r) {
      $('[data-app]').hidden = false; $('[data-gate]').hidden = true;
      health(r[0], r[1]); progress(r[0]); presence(r[0]); startLive();
      var s = get(AUTH); $('[data-meta]').textContent = (s && s.user ? s.user.email + ' · ' : '') + 'mis à jour ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }).catch(function (e) {
      if (e && e.gate === 'login') return gate('Connecte-toi d’abord <a href="index.html">dans le cours</a> (bouton « Anmelden ») avec ton compte, dans ce même navigateur, puis reviens ici.');
      if (e && (e.status === 401 || e.status === 403 || /denied/.test(e.msg || ''))) return gate('Ce compte n’est pas administrateur. Dans Supabase › SQL Editor, exécute la dernière ligne de <code>supabase/admin.sql</code> avec ton adresse e-mail.');
      if (e && e.status === 404) return gate('Le tableau de bord n’est pas encore installé dans Supabase : exécute <code>supabase/admin.sql</code> dans le SQL Editor.');
      gate('Chargement impossible' + (navigator.onLine ? '' : ' (hors ligne)') + '. <button class="tb-btn" type="button" onclick="location.reload()">Réessayer</button>');
    });
  }
  if (!CFG || !CFG.url) return gate('Pas de compte configuré pour ce site.');
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
    });
  });
  load();
})();
