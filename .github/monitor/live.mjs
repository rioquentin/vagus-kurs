// Wöchentliche Prüfung der veröffentlichten Seite (läuft auf GitHub, .github/workflows/monitor.yml).
// Öffnet alle Seiten in Chromium und WebKit (Safari) am Handy und am Rechner und schlägt fehl, wenn etwas kaputt ist:
// Skriptfehler, fehlende Dateien, Schriften, seitlicher Überlauf, Dialoge, Lernkarten, Offline-Cache.
// Dazu: Anzahl der Fehler, die Besucher in den letzten 8 Tagen gemeldet haben (Tabelle client_errors).
import { chromium, webkit } from 'playwright';
import fs from 'fs';
const B = process.env.SITE || 'https://rioquentin.github.io/vagus-kurs/';
const PAGES = ['index', '01-gelenke-muskeln', '02-n-laryngeus-superior', '03-n-laryngeus-recurrens', '04-gesamtkarte', '05-stimmentstehung', '06-schutzfunktionen',
  '07-laehmungen', '08-abgrenzung', '09-10-wiederholung-pruefung', 'begriffe', 'lernkarten', 'merkheft'];
const STATE = { tour: 1, gate: 1, last: '03', done: { '01': true } };
const bad = [], info = [];
const within = (pr, ms, what) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error(`${what}: keine Antwort nach ${ms / 1000} s`)), ms))]);
// Hängt etwas trotzdem, wenigstens das Bisherige melden
setTimeout(() => finish(['Prüfung nach 15 Minuten abgebrochen (etwas hängt)']), 15 * 60e3).unref();
const fits = (sel) => { const e = document.querySelector(sel); if (!e) return 'fehlt'; const r = e.getBoundingClientRect();
  return r.width > 50 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 ? 'ok' : `außerhalb ${Math.round(r.left)}…${Math.round(r.right)}/${innerWidth}`; };

for (const [en, eng] of [['Chromium', chromium], ['Safari (WebKit)', webkit]]) {
  const b = await eng.launch();
  for (const [dev, vp] of [['Handy', { width: 390, height: 844 }], ['Rechner', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: dev === 'Handy' }); ctx.setDefaultTimeout(20000);
    await ctx.addInitScript((s) => { sessionStorage.setItem('vagus-kurs:intro', '1'); localStorage.setItem('vagus-kurs:noreport', '1');
      if (!localStorage.getItem('vagus-kurs:v1')) localStorage.setItem('vagus-kurs:v1', s); }, JSON.stringify(STATE));
    const p = await ctx.newPage(), where = (pg) => `${en} · ${dev} · ${pg}`;
    let cur = '';
    // „Neu im Kurs“ als gesehen markieren (die Ausgabe ändert sich mit jedem Update), sonst liegt es über allem
    await p.goto(B + 'index.html', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('vagus-kurs:v1') || '{}'); s.newsSeen = window.Kurs && window.Kurs.NEWS_ID; localStorage.setItem('vagus-kurs:v1', JSON.stringify(s)); }).catch(() => {});
    p.on('pageerror', (e) => bad.push(`${where(cur)}: Skriptfehler „${e.message.slice(0, 160)}“`));
    p.on('response', (r) => { if (r.url().startsWith(B) && r.status() >= 400) bad.push(`${where(cur)}: ${r.status()} ${r.url().slice(B.length)}`); });
    p.on('requestfailed', (r) => { if (r.url().startsWith(B) && !/ERR_ABORTED|cancel/i.test(r.failure()?.errorText || '')) bad.push(`${where(cur)}: lädt nicht ${r.url().slice(B.length)} (${r.failure()?.errorText})`); });
    for (const pg of PAGES) {
      cur = pg;
      const res = await p.goto(B + pg + '.html', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => { bad.push(`${where(pg)}: öffnet nicht (${e.message.split('\n')[0]})`); return null; });
      if (!res) continue;
      if (!res.ok()) { bad.push(`${where(pg)}: HTTP ${res.status()}`); continue; }
      const r = await within(p.evaluate(async () => {
        await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 8000))]);
        const vw = document.documentElement.clientWidth;
        return { over: document.documentElement.scrollWidth - vw, main: !!document.querySelector('main h1'),
          fonts: ['Cormorant Garamond', 'UnifrakturMaguntia'].filter((f) => ![...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded')),
          kurs: !!window.Kurs, sync: !!window.KURS_SYNC };
      }), 20000, 'Seite').catch((e) => { bad.push(`${where(pg)}: ${e.message.split('\n')[0]}`); return null; });
      if (!r) continue;
      if (r.over > 1) bad.push(`${where(pg)}: Seite ${r.over}px zu breit`);
      if (!r.main) bad.push(`${where(pg)}: keine Überschrift (Seite leer?)`);
      if (r.fonts.length) bad.push(`${where(pg)}: Schrift nicht geladen: ${r.fonts.join(', ')}`);
      if (!r.kurs) bad.push(`${where(pg)}: Kursskript (app.js) läuft nicht`);
      if (!r.sync) bad.push(`${where(pg)}: Konto-Einstellungen (sync-config.js) fehlen`);
    }
    // Bedienung: Suche, Lesemodus, Legende, Lernkarten-Runde
    cur = 'Bedienung';
    const step = async (name, fn) => { try { const r = await within(fn(), 45000, name); if (r && r !== 'ok') bad.push(`${where(name)}: ${r}`); } catch (e) { bad.push(`${where(name)}: ${e.message.split('\n')[0]}`); } };
    await p.goto(B + 'index.html', { waitUntil: 'networkidle' }).catch(() => {});
    await step('Suche', async () => { await p.locator('[data-open-search]').first().click(); await p.keyboard.type('recurrens'); await p.waitForTimeout(600);
      const n = await p.locator('#search [role=option], #search a').count(); const f = await p.evaluate(fits, '#search'); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); return n ? f : 'keine Treffer für „recurrens“'; });
    await step('Lesemodus', async () => { await p.locator('[data-open-reading]').first().click(); await p.waitForTimeout(400); const f = await p.evaluate(fits, '#reading'); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); return f; });
    await p.goto(B + '01-gelenke-muskeln.html', { waitUntil: 'networkidle' }).catch(() => {});
    await step('Legende', async () => { await p.evaluate(() => document.querySelector('#legend').showModal()); await p.waitForTimeout(300); return p.evaluate(fits, '#legend'); });
    await p.goto(B + 'lernkarten.html', { waitUntil: 'networkidle' }).catch(() => {});
    await step('Lernkarten', async () => { await p.locator('[data-fc-start]').click(); await p.locator('[data-fc-show]').click({ timeout: 5000 });
      return (await p.locator('[data-fc-answer]').isVisible()) ? 'ok' : 'Antwort lässt sich nicht aufdecken'; });
    if (en === 'Chromium' && dev === 'Handy') {
      await step('Offline', async () => { await p.goto(B + 'index.html', { waitUntil: 'networkidle' }); await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((ok) => setTimeout(ok, 10000))])); await p.waitForTimeout(3000);
        await ctx.setOffline(true); const r = await p.goto(B + '03-n-laryngeus-recurrens.html').catch(() => null); const ok = r && (await p.locator('main h1').count());
        await ctx.setOffline(false); return ok ? 'ok' : 'offline nicht verfügbar (Service Worker)'; });
    }
    await ctx.close();
  }
  await b.close();
}

// Von Besuchern gemeldete Fehler (nur die Anzahl ist öffentlich lesbar)
try {
  const cfg = await (await fetch(B + 'assets/sync-config.js?nc=' + Date.now())).text();
  const url = (cfg.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0], key = (cfg.match(/sb_publishable_[A-Za-z0-9_-]+/) || [])[0];
  const since = new Date(Date.now() - 8 * 864e5).toISOString();
  const r = await fetch(url + '/rest/v1/rpc/error_count', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_since: since }) });
  if (r.status === 404) info.push('Fehlerprotokoll noch nicht eingerichtet (supabase/monitor-push.sql).');
  else { const n = await r.json(); if (n > 0) bad.push(`Besucher: ${n} Fehlermeldung(en) in den letzten 8 Tagen → Supabase › Table Editor › client_errors`); else info.push('Besucher: keine Fehlermeldungen in den letzten 8 Tagen.'); }
} catch (e) { info.push('Fehlerprotokoll nicht abrufbar: ' + e.message); }

finish();
function finish(extra = []) {
// Gleiches Problem auf vielen Seiten zu einer Zeile zusammenfassen: „Skriptfehler … (26×: Chromium · Handy · index, …)“
const groups = new Map();
for (const x of bad.concat(extra)) { const i = x.indexOf(': '); const k = i > 0 ? x.slice(i + 2) : x, w = i > 0 ? x.slice(0, i) : ''; if (!groups.has(k)) groups.set(k, []); if (w && !groups.get(k).includes(w)) groups.get(k).push(w); }
const uniq = [...groups].map(([k, w]) => w.length > 3 ? `${k} (${w.length}×: ${w.slice(0, 3).join(', ')} …)` : w.length ? `${w.join(', ')}: ${k}` : k);
const text = (uniq.length ? `## ✗ ${uniq.length} Problem(e)\n\n` + uniq.map((x) => '- ' + x).join('\n') : '## ✓ Alles in Ordnung\n\n13 Seiten · Chromium + Safari · Handy + Rechner') + (info.length ? '\n\n' + info.map((x) => '- ' + x).join('\n') : '') + '\n';
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
process.exit(uniq.length ? 1 : 0);
}
