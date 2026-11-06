// Verschickt die täglichen Mitteilungen „heute fällig“ (läuft stündlich auf GitHub, .github/workflows/push.yml).
// Supabase (push_batch) liefert die Geräte, deren Stunde gerade dran ist, samt Zahl der fälligen Karten.
// Geheim (GitHub-Secrets): VAPID_PRIVATE_KEY, PUSH_TOKEN. Öffentlich aus der Seite: Supabase-Adresse, Schlüssel, VAPID-Public-Key.
import webpush from 'web-push';
const SITE = process.env.SITE || 'https://rioquentin.github.io/vagus-kurs/';
const { VAPID_PRIVATE_KEY: priv, PUSH_TOKEN: token } = process.env;
if (!priv || !token) { console.log('Noch nicht eingerichtet (Secrets fehlen) – nichts zu tun.'); process.exit(0); }

const cfg = await (await fetch(SITE + 'assets/sync-config.js?nc=' + Date.now())).text();
const conf = JSON.parse(cfg.replace(/^window\.KURS_SYNC=/, '').replace(/;\s*$/, ''));
if (!conf || !conf.vapid) { console.log('Seite ohne VAPID-Schlüssel – nichts zu tun.'); process.exit(0); }
webpush.setVapidDetails('https://rioquentin.github.io/vagus-kurs/', conf.vapid, priv); // Kontakt-Angabe für die Push-Dienste
const rpc = (fn, body) => fetch(conf.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: conf.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const r = await rpc('push_batch', { p_token: token });
if (r.status === 404) { console.log('push_batch fehlt in Supabase (supabase/monitor-push.sql) – nichts zu tun.'); process.exit(0); }
if (!r.ok) { console.error('push_batch:', r.status, await r.text()); process.exit(1); }
const rows = await r.json();
// Kursliste der Seite (assets/courses.json, aus courses.mjs). Fehlt sie, gelten die beiden ersten Kurse wie bisher.
const COURSES = await fetch(SITE + 'assets/courses.json?nc=' + Date.now()).then((x) => (x.ok ? x.json() : null)).catch(() => null) || [
  { key: 'v', prefix: '', short: 'Vagus', label: 'N. vagus', total: 10, double: ['09'], examKey: 'exam', files: { exam: '09-10-wiederholung-pruefung.html' } },
  { key: 'l', prefix: 'L', short: 'Laryngitis', label: 'Laryngitis', total: 10, double: [], examKey: 'examL', files: { exam: 'laryngitis-10-pruefung.html' } },
];
const ofKey = (id) => { const c = COURSES.filter((k) => id.startsWith(k.prefix) && /^\d\d$/.test(id.slice(k.prefix.length))).sort((a, b) => b.prefix.length - a.prefix.length)[0]; return c && c.key; };
// Je Kurs: Tage bis zur Prüfung und erledigte Abschnitte. Neue Spalten (exams, done_keys); ältere SQL-Fassung: exam_in/done (Vagus), exam_in_l/done_l (Laryngitis)
function perCourse(x) {
  return COURSES.filter((c) => c.files.exam !== null).map((c) => { // Schnellkurs: ohne Prüfung
    const exam = x.exams ? (x.exams[c.examKey] ?? null) : c.key === 'v' ? x.exam_in : c.key === 'l' ? x.exam_in_l : null;
    const done = x.done_keys ? x.done_keys.filter((id) => ofKey(id) === c.key).reduce((s, id) => s + ((c.double || []).includes(id) ? 2 : 1), 0)
      : (c.key === 'v' ? x.done : c.key === 'l' ? x.done_l : 0) || 0;
    return { name: c.key === 'v' ? 'Vagus' : c.label || c.short, exam, done, total: c.total || 10, page: c.files.exam };
  });
}
// Höchstens eine Mitteilung am Tag. Vorrang: Prüfung in 7 Tagen / morgen (je Kurs) › Sonntag Wochenrückblick › fällige Karten.
function message(x) {
  const en = x.ui === 'en', due = x.due || 0, figs = x.figs || 0, pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const dueTxt = [due ? (en ? pl(due, 'card', 'cards') + ' due' : pl(due, 'Karte', 'Karten') + ' fällig') : '', figs ? (en ? pl(figs, 'figure', 'figures') : pl(figs, 'Abbildung', 'Abbildungen')) : ''].filter(Boolean).join(' · ');
  const T = (de, e) => (en ? 'Logopedics · ' + e : 'Logopädie-Kurse · ' + de);
  const C = perCourse(x);
  const progress = C.filter((c) => c.done).map((c) => `${c.name} ${c.done}/${c.total}`).join(', ');
  const seven = C.find((c) => c.exam === 7), one = C.find((c) => c.exam === 1);
  if (one) return { title: T(`morgen ist Prüfung · ${one.name}`, `exam tomorrow · ${one.name}`), url: 'index.html#heute',
    body: en ? `Go over the shaky points briefly, then rest. ${one.done} of ${one.total} sections done.` : `Kurz die wackligen Punkte durchgehen, dann ausruhen. ${one.done} von ${one.total} Abschnitten erledigt.` };
  if (seven) return { title: T(`noch 7 Tage bis zur Prüfung · ${seven.name}`, `exam in 7 days · ${seven.name}`), url: seven.page,
    body: (en ? 'A good moment for the mock exam: 40 minutes, then you know where you stand.' : 'Guter Moment für die Probeprüfung: 40 Minuten, danach weißt du, wo du stehst.') + (dueTxt ? ' · ' + dueTxt : '') };
  if (x.dow === 0) return { title: T('deine Woche', 'your week'), url: 'index.html#heute',
    body: (x.week ? (en ? `${pl(x.week, 'card', 'cards')} practised on ${pl(x.week_days, 'day', 'days')}` : `${pl(x.week, 'Karte', 'Karten')} geübt an ${pl(x.week_days, 'Tag', 'Tagen')}`) + (progress ? ' · ' + (en ? 'done: ' : 'erledigt: ') + progress : '')
      : (en ? 'A quiet week. Ten minutes today is a good start.' : 'Eine ruhige Woche. Zehn Minuten heute sind ein guter Anfang.')) + (dueTxt ? ' · ' + dueTxt : '') };
  if (!dueTxt) return null;
  const min = Math.max(2, Math.round(due * 0.5 + figs));
  return { title: T('heute', 'today'), url: 'index.html#heute', body: dueTxt + (en ? ` · about ${min} minutes` : ` · etwa ${min} Minuten`) };
}

let sent = 0, gone = 0, quiet = 0, failed = 0;
for (const x of rows) {
  const m = message(x);
  if (!m) { quiet++; continue; }
  const payload = JSON.stringify({ ...m, lang: x.ui === 'en' ? 'en' : 'de' });
  try {
    await webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, payload, { TTL: 6 * 3600, urgency: 'normal' });
    sent++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { gone++; await rpc('push_gone', { p_token: token, p_endpoint: x.endpoint }); }
    else { failed++; console.error('Versand fehlgeschlagen:', e.statusCode, (e.body || e.message || '').toString().slice(0, 200)); }
  }
}
console.log(`dran: ${rows.length} · gesendet: ${sent} · nichts fällig: ${quiet} · abgemeldet: ${gone} · Fehler: ${failed}`);
