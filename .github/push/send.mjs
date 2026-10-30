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
// Höchstens eine Mitteilung am Tag. Vorrang: Prüfung in 7 Tagen / morgen › Sonntag Wochenrückblick › fällige Karten.
function message(x) {
  const en = x.ui === 'en', due = x.due || 0, figs = x.figs || 0, pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const dueTxt = [due ? (en ? pl(due, 'card', 'cards') + ' due' : pl(due, 'Karte', 'Karten') + ' fällig') : '', figs ? (en ? pl(figs, 'figure', 'figures') : pl(figs, 'Abbildung', 'Abbildungen')) : ''].filter(Boolean).join(' · ');
  const T = (de, e) => (en ? 'Vagus course · ' + e : 'Vagus-Kurs · ' + de);
  if (x.exam_in === 7) return { title: T('noch 7 Tage bis zur Prüfung', 'exam in 7 days'), url: '09-10-wiederholung-pruefung.html',
    body: (en ? 'A good moment for the mock exam: 40 minutes, then you know where you stand.' : 'Guter Moment für die Probeprüfung: 40 Minuten, danach weißt du, wo du stehst.') + (dueTxt ? ' · ' + dueTxt : '') };
  if (x.exam_in === 1) return { title: T('morgen ist Prüfung', 'exam tomorrow'), url: 'index.html#heute',
    body: en ? `Go over the shaky points briefly, then rest. ${x.done} of 10 sections done.` : `Kurz die wackligen Punkte durchgehen, dann ausruhen. ${x.done} von 10 Abschnitten erledigt.` };
  if (x.dow === 0) return { title: T('deine Woche', 'your week'), url: 'index.html#heute',
    body: (x.week ? (en ? `${pl(x.week, 'card', 'cards')} practised on ${pl(x.week_days, 'day', 'days')} · ${x.done} of 10 sections done` : `${pl(x.week, 'Karte', 'Karten')} geübt an ${pl(x.week_days, 'Tag', 'Tagen')} · ${x.done} von 10 Abschnitten erledigt`)
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
