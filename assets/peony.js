// Eröffnung: Pfingstrosen im Strichstil (wie gestochen) rund um das Goldene Rechteck.
// Alles wird als SVG-Pfad erzeugt, damit es Strich für Strich „gezeichnet“ werden kann (CSS: .garden, --t Start, --d Dauer).
// Eigene Zeichnung, nur vom Stil gestochener Blumenmuster inspiriert. Bei jedem Besuch etwas anders angeordnet.
(function () {
  var NS = 'http://www.w3.org/2000/svg', W = 161.8, H = 100;
  function KursGarden(svg, opts) {
    opts = opts || {};
    var R = opts.random || Math.random, out = [], g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'garden');
    function r(a, b) { return a + R() * (b - a); }
    function f(v) { return Math.round(v * 100) / 100; }
    function P(x, y) { return f(x) + ' ' + f(y); }
    function add(d, t, dur, cls) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1');
      if (cls) p.setAttribute('class', cls);
      p.style.setProperty('--t', t.toFixed(2) + 's'); p.style.setProperty('--d', dur.toFixed(2) + 's'); out.push(p);
    }
    function dot(x, y, rad, t) {
      var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', f(x)); c.setAttribute('cy', f(y)); c.setAttribute('r', f(rad));
      c.setAttribute('class', 'gd-dot'); c.setAttribute('pathLength', '1'); c.style.setProperty('--t', t.toFixed(2) + 's'); out.push(c);
    }
    // Welliger Bogen um (cx, cy): Radius schwankt leicht, das gibt die gekräuselten Blütenränder
    function wavy(cx, cy, rad, a0, a1, amp, freq, ph, n) {
      n = n || 22; var d = '';
      for (var i = 0; i <= n; i++) {
        var a = a0 + (a1 - a0) * i / n, rr = rad * (1 + amp * Math.sin(freq * a + ph) + amp * 0.5 * Math.sin(freq * 2.3 * a + ph * 1.7));
        d += (i ? 'L' : 'M') + P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      return d;
    }
    function stem(x0, y0, x1, y1, bend, t, dur) {
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
      add('M' + P(x0, y0) + 'Q' + P(mx + nx * bend, my + ny * bend) + ' ' + P(x1, y1), t, dur || 0.8, 'gd-stem');
    }
    // Blatt: spitz, Mittelrippe, auf einer Seite parallele Schraffur zur Spitze hin
    function leaf(x, y, a, L, t) {
      var w = L * 0.3, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, side = R() < 0.5 ? 1 : -1;
      var tx = x + ca * L, ty = y + sa * L;
      add('M' + P(x, y) + 'C' + P(x + ca * L * 0.3 + nx * w, y + sa * L * 0.3 + ny * w) + ' ' + P(x + ca * L * 0.75 + nx * w * 0.7, y + sa * L * 0.75 + ny * w * 0.7) + ' ' + P(tx, ty) +
        'C' + P(x + ca * L * 0.75 - nx * w * 0.7, y + sa * L * 0.75 - ny * w * 0.7) + ' ' + P(x + ca * L * 0.3 - nx * w, y + sa * L * 0.3 - ny * w) + ' ' + P(x, y), t, 0.7, 'gd-leaf');
      add('M' + P(x, y) + 'Q' + P(x + ca * L * 0.5 + nx * w * 0.12, y + sa * L * 0.5 + ny * w * 0.12) + ' ' + P(x + ca * L * 0.92, y + sa * L * 0.92), t + 0.25, 0.5, 'gd-leaf');
      for (var k = 1; k <= 6; k++) { // Schraffur
        var s = k / 7.2, bx = x + ca * L * s, by = y + sa * L * s, wid = w * Math.sin(Math.PI * Math.min(1, s * 1.05)) * 0.85;
        var ex = bx + ca * wid * 0.55 + nx * side * wid, ey = by + sa * wid * 0.55 + ny * side * wid;
        add('M' + P(bx, by) + 'L' + P(ex, ey), t + 0.45 + k * 0.04, 0.25, 'gd-hatch');
      }
    }
    // Knospe: Tropfenform (rund am Grund, spitz zulaufend), zwei umhüllende Blätter, zwei Kelchblätter
    function bud(x, y, a, sz, t) {
      var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, L = sz * 2.1, w = sz * 1.05;
      var tx = x + ca * L, ty = y + sa * L;
      add('M' + P(x, y) + 'C' + P(x + nx * w * 1.25, y + ny * w * 1.25) + ' ' + P(tx - ca * L * 0.25 + nx * w * 0.55, ty - sa * L * 0.25 + ny * w * 0.55) + ' ' + P(tx, ty) +
        'C' + P(tx - ca * L * 0.25 - nx * w * 0.55, ty - sa * L * 0.25 - ny * w * 0.55) + ' ' + P(x - nx * w * 1.25, y - ny * w * 1.25) + ' ' + P(x, y), t, 0.7, 'gd-petal');
      add('M' + P(x + nx * w * 0.5, y + ny * w * 0.5) + 'Q' + P(x + ca * L * 0.55 - nx * w * 0.15, y + sa * L * 0.55 - ny * w * 0.15) + ' ' + P(tx - ca * L * 0.05, ty - sa * L * 0.05), t + 0.3, 0.5, 'gd-petal');
      add('M' + P(x - nx * w * 0.6, y - ny * w * 0.6) + 'Q' + P(x + ca * L * 0.4 - nx * w * 0.5, y + sa * L * 0.4 - ny * w * 0.5) + ' ' + P(x + ca * L * 0.7 - nx * w * 0.1, y + sa * L * 0.7 - ny * w * 0.1), t + 0.4, 0.4, 'gd-hatch');
      [-1, 1].forEach(function (k) { leaf(x, y, a + k * 0.55, sz * 1.6, t + 0.2); });
    }
    // Zweig mit kleinen Beeren
    function sprig(x, y, a, L, t) {
      var ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
      stem(x, y, ex, ey, r(-0.2, 0.2) * L, t, 0.7);
      for (var k = 0; k < 4; k++) {
        var s = 0.45 + k * 0.17, bx = x + (ex - x) * s, by = y + (ey - y) * s, ba = a + (k % 2 ? 0.75 : -0.75), bl = L * 0.18;
        var tx = bx + Math.cos(ba) * bl, ty = by + Math.sin(ba) * bl;
        add('M' + P(bx, by) + 'L' + P(tx, ty), t + 0.4 + k * 0.08, 0.3, 'gd-stem');
        dot(tx + Math.cos(ba) * 0.9, ty + Math.sin(ba) * 0.9, 0.9, t + 0.6 + k * 0.08);
      }
      dot(ex + Math.cos(a) * 0.9, ey + Math.sin(a) * 0.9, 1, t + 0.9);
    }
    // Pfingstrose von vorn: dichtes gekräuseltes Herz, ein Kranz gewölbter Blätter, außen große festonierte Blätter.
    // Schraffur als kurze Bögen, die der Wölbung folgen (wie gestochen).
    function peony(cx, cy, Rr, t) {
      var ph = r(0, 6);
      for (var k = 0; k < 12; k++) { // Herz, innen nach außen
        var rad = Rr * (0.07 + k * 0.032), a0 = ph + k * 2.2, span = r(1.8, 3.2);
        add(wavy(cx, cy, rad, a0, a0 + span, 0.13, 6, r(0, 6), 12), t + k * 0.06, 0.4, 'gd-petal');
      }
      var t1 = t + 0.6, n1 = 7;
      for (var j = 0; j < n1; j++) { // mittlerer Kranz: gewölbte Blätter, je mit einer inneren Linie für die Tiefe
        var th1 = ph + 0.4 + j * 2 * Math.PI / n1, hw1 = Math.PI / n1 * 1.15, ro1 = Rr * r(0.56, 0.66);
        add(wavy(cx, cy, ro1, th1 - hw1, th1 + hw1, 0.06, 8, r(0, 6), 16), t1 + j * 0.06, 0.45, 'gd-petal');
        add(wavy(cx, cy, ro1 * 0.86, th1 - hw1 * 0.6, th1 + hw1 * 0.6, 0.04, 7, r(0, 6), 10), t1 + 0.2 + j * 0.06, 0.35, 'gd-hatch');
      }
      var n = 7, t2 = t + 1.05;
      for (var i = 0; i < n; i++) { // äußere Blätter: U-Form mit festoniertem Rand
        var th = ph + i * 2 * Math.PI / n + r(-0.12, 0.12), hw = Math.PI / n * r(1.1, 1.3), ro = Rr * r(0.93, 1.07), ri = Rr * 0.62;
        var s1x = cx + Math.cos(th - hw * 0.7) * ri, s1y = cy + Math.sin(th - hw * 0.7) * ri, s2x = cx + Math.cos(th + hw * 0.7) * ri, s2y = cy + Math.sin(th + hw * 0.7) * ri;
        var e0x = cx + Math.cos(th - hw) * ro, e0y = cy + Math.sin(th - hw) * ro, e1x = cx + Math.cos(th + hw) * ro, e1y = cy + Math.sin(th + hw) * ro;
        var edge = wavy(cx, cy, ro, th - hw, th + hw, 0.045, 8, r(0, 6), 24).replace(/^M[^L]*/, '');
        add('M' + P(s1x, s1y) + 'Q' + P(cx + Math.cos(th - hw * 1.05) * (ri + ro) / 2, cy + Math.sin(th - hw * 1.05) * (ri + ro) / 2) + ' ' + P(e0x, e0y) + edge +
          'Q' + P(cx + Math.cos(th + hw * 1.05) * (ri + ro) / 2, cy + Math.sin(th + hw * 1.05) * (ri + ro) / 2) + ' ' + P(s2x, s2y), t2 + i * 0.08, 0.6, 'gd-petal');
        for (var h = 0; h < 3; h++) { // gebogene Schraffur im Blatt
          var hr = ri + (ro - ri) * (0.22 + h * 0.16), hs = hw * (0.55 - h * 0.1);
          add(wavy(cx, cy, hr, th - hs, th + hs * 0.2, 0.02, 5, 0, 8), t2 + 0.45 + i * 0.08 + h * 0.04, 0.25, 'gd-hatch');
        }
      }
    }
    // Ein Strauß: Stängel vom Rahmen nach außen, zwei Blätter, Pfingstrose am Ende, dazu Knospe und Beerenzweig
    function bouquet(x0, y0, a, L, Rr, t) {
      var x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      stem(x0, y0, x1, y1, r(-0.18, 0.18) * L, t, 0.9);
      leaf(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35, a + r(0.65, 0.95), r(13, 18), t + 0.35);
      leaf(x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, a - r(0.65, 0.95), r(12, 16), t + 0.5);
      peony(x1 + Math.cos(a) * Rr * 0.55, y1 + Math.sin(a) * Rr * 0.55, Rr, t + 0.6);
      var side = R() < 0.5 ? -1 : 1, ba = a + side * r(0.75, 1.05), bx = x0 + (x1 - x0) * 0.25, by = y0 + (y1 - y0) * 0.25, bl = L * r(0.6, 0.8);
      stem(bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, r(-3, 3), t + 0.4, 0.7);
      bud(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, ba, r(4.5, 6), t + 1);
      sprig(x0 + (x1 - x0) * 0.15, y0 + (y1 - y0) * 0.15, a - side * r(0.85, 1.2), r(16, 22), t + 0.7);
    }
    var T0 = opts.start || 1.2, up = -Math.PI / 2, down = Math.PI / 2;
    // Zwei große Pfingstrosen auf den Ecken (oben links, unten rechts), wie ein Kranz
    leaf(-2, 6, Math.PI * 0.95, 18, T0 + 0.2); leaf(6, -2, -Math.PI * 0.55, 17, T0 + 0.3);
    peony(r(-2, 3), r(-2, 3), r(17, 20), T0 + 0.3);
    leaf(W + 2, H - 6, r(-0.15, 0.1), 17, T0 + 0.5); leaf(W - 6, H + 2, Math.PI * 0.45, 16, T0 + 0.6);
    peony(W + r(6, 10), H + r(5, 8), r(15, 18), T0 + 0.6); // knapp außerhalb, damit die Spirale frei bleibt
    // Sträuße oben (dort ist am Handy viel Platz), an den Seiten und an den unteren Ecken
    [[0.3, up - 0.3, 34, 52, 14, 18], [0.55, up + 0.15, 40, 62, 15, 20], [0.82, up + 0.4, 30, 48, 13, 17]].forEach(function (b, i) {
      bouquet(b[0] * W + r(-5, 5), 0, b[1] + r(-0.15, 0.15), r(b[2], b[3]), r(b[4], b[5]), T0 + 0.5 + i * 0.25 + r(0, 0.15));
    });
    bouquet(W, r(0.25, 0.4) * H, r(-0.3, 0.1), r(22, 30), r(11, 14), T0 + 1.2);
    bouquet(0, r(0.4, 0.55) * H, Math.PI + r(-0.1, 0.3), r(22, 30), r(11, 14), T0 + 1.3);
    bouquet(r(0.04, 0.12) * W, H, down + r(0.2, 0.5), r(26, 36), r(12, 15), T0 + 1.4);
    sprig(r(0.75, 0.82) * W, H, down - r(0.2, 0.5), r(18, 24), T0 + 1.6);
    out.forEach(function (el) { g.appendChild(el); });
    svg.insertBefore(g, svg.firstElementChild && svg.firstElementChild.nextSibling);
    return g;
  }
  window.KursGarden = KursGarden;
})();
