//KI gemacht bin ich raus war mir zu hoch 

/* ==========================================================================
   chart.js – Trade-Chart (TradingView Lightweight Charts)
   - posPrim():   Plan-Zonen (Entry / SL / TP) als Hintergrund-Layer
   - initChart(): Kerzen, Marker, Zeichenwerkzeuge, Rechtsklick-Menü, Ansicht speichern
   ========================================================================== */

/* ---------- Icons der Werkzeugleiste (SVG, Farbe kommt vom Button: currentColor) ---------- */
const TOOL_ICONS = {
  box:  '<rect x="6" y="9" width="16" height="11" rx="1"/><circle cx="6" cy="9" r="1.7" fill="currentColor"/><circle cx="22" cy="20" r="1.7" fill="currentColor"/>',
  line: '<circle cx="7" cy="21" r="2.4"/><circle cx="21" cy="7" r="2.4"/><line x1="8.7" y1="19.3" x2="19.3" y2="8.7"/>',
  vp:   '<line x1="6" y1="5" x2="6" y2="23"/><line x1="8" y1="8" x2="13" y2="8"/><line x1="8" y1="11.5" x2="20" y2="11.5"/><line x1="8" y1="15" x2="23" y2="15"/><line x1="8" y1="18.5" x2="17" y2="18.5"/><line x1="8" y1="22" x2="12" y2="22"/>',
  vwap: '<circle cx="6.5" cy="20" r="2.2"/><path d="M8.7 19.6C12 19 12.5 12.5 15.5 13.4S20 9 23 8"/>',
  path: '<path d="M6 21L11 11.5L16 17L20 11.5"/><path d="M22 8L17.1 10.7L21.4 13.6Z" fill="currentColor"/>',
  undo: '<path d="M10 9L6 13L10 17"/><path d="M6 13H16.5a5 5 0 0 1 0 10H11"/>',
  del:  '<path d="M7 9.5h14"/><path d="M11 9.5V7h6v2.5"/><path d="M9 9.5l1 12.5h8l1-12.5"/><path d="M12.5 13v6M15.5 13v6"/>',
  grip: '<circle cx="11" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="11" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="11" cy="19" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="19" r="1.3" fill="currentColor" stroke="none"/>'
};
const toolIcon = n => `<svg viewBox="0 0 28 28" aria-hidden="true">${TOOL_ICONS[n]}</svg>`;

/* ---------- Plan-Zonen: Entry / Stop-Loss / Take-Profit als farbige Flächen ---------- */
function posPrim(get) {
  let chart, ser, req, PH = 0;
  const CY = '94,240,255', LV = '165,139,255';
  const pct = v => v.toFixed(3).replace('.', ',') + '%';
  const rr = v => String(+v.toFixed(2)).replace('.', ',');

  // kleine Beschriftungs-Pille (z. B. "0,450%")
  const pill = (ctx, txt, cx, cy, bg, pr, H) => {
    ctx.font = `600 ${Math.round(12 * pr)}px system-ui,sans-serif`;
    const w = ctx.measureText(txt).width + 14 * pr, h = 20 * pr;
    cy = Math.max(h / 2 + 1, Math.min(H - h / 2 - 1, cy));
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5 * pr);
    else ctx.rect(cx - w / 2, cy - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#0b0e15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, cy + pr * .5);
  };

  const renderer = {
    draw(target) {
      target.useBitmapCoordinateSpace(sc => {
        PH = sc.mediaSize.height;
        const ctx = sc.context, hr = sc.horizontalPixelRatio, vr = sc.verticalPixelRatio;
        const H = sc.bitmapSize.height, s = get(), ts = chart.timeScale();

        // Breite der Zone: etwas vor dem Entry bis etwas nach dem Exit
        const span = Math.max(s.iX - s.iE, 1);
        const pb = Math.max(4, Math.round(span * .2));
        const pf = Math.max(6, Math.round(span * .35));
        const xa = ts.logicalToCoordinate(s.iE - pb);
        const xb = ts.logicalToCoordinate(s.iX + pf);
        if (xa == null || xb == null) return;

        const Y = p => { const y = ser.priceToCoordinate(p); return y == null ? null : y * vr; };
        const ye = Y(s.entry);
        if (ye == null) return;
        const x1 = xa * hr, x2 = xb * hr, w = x2 - x1, cx = x1 + w / 2;

        // Fläche zwischen Entry und Preis p
        const zone = (p, rgb) => {
          const y = Y(p);
          if (y == null) return null;
          ctx.fillStyle = `rgba(${rgb},.17)`;
          ctx.fillRect(x1, Math.min(ye, y), w, Math.abs(y - ye));
          ctx.strokeStyle = `rgba(${rgb},.8)`;
          ctx.lineWidth = Math.max(1, hr);
          ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
          return y;
        };

        const hasSL = isFinite(s.sl) && s.sl !== s.entry;
        const hasTP = isFinite(s.tp) && s.tp !== s.entry;
        let yTP = null, ySL = null, yX = null;
        if (hasTP) yTP = zone(s.tp, CY);
        if (hasSL) ySL = zone(s.sl, LV);
        if (!hasTP && !hasSL) yX = zone(s.exit, s.win ? CY : LV);   // ohne Plan: Zone bis zum Exit

        // Entry-Linie
        ctx.strokeStyle = 'rgba(215,222,238,.9)';
        ctx.lineWidth = Math.max(1, hr * 1.2);
        ctx.beginPath(); ctx.moveTo(x1, ye); ctx.lineTo(x2, ye); ctx.stroke();

        // Pillen: Abstand in %, CRV, Ergebnis
        if (yTP != null) pill(ctx, pct(Math.abs(s.tp - s.entry) / s.entry * 100), cx, yTP, `rgb(${CY})`, hr, H);
        if (ySL != null) pill(ctx, pct(Math.abs(s.sl - s.entry) / s.entry * 100), cx, ySL, `rgb(${LV})`, hr, H);
        if (hasTP && hasSL) pill(ctx, rr(Math.abs(s.tp - s.entry) / Math.abs(s.entry - s.sl)), cx, ye, '#9db0d3', hr, H);
        if (yX != null) {
          const v = (s.exit - s.entry) / s.entry * 100 * (s.sh ? -1 : 1);
          pill(ctx, (v > 0 ? '+' : v < 0 ? '−' : '') + pct(Math.abs(v)), cx, yX, `rgb(${s.win ? CY : LV})`, hr, H);
        }
      });
    }
  };
  const view = { zOrder: () => 'bottom', renderer: () => renderer };

  return {
    attached: p => { chart = p.chart; ser = p.series; req = p.requestUpdate; },
    detached() {},
    updateAllViews() {},
    paneViews: () => [view],
    update: () => { if (req) req(); },
    ph: () => PH
  };
}

/* ==========================================================================
   initChart – baut den Chart im geöffneten Trade-Fenster auf
   ========================================================================== */
async function initChart() {
  if (CH) {
    try { CH.off && CH.off(); CH.ro.disconnect(); CH.chart.remove(); } catch {}
    CH = null;
  }
  pick = null;
  document.querySelectorAll('.ctxm').forEach(x => x.remove());

  const el = $('#ch');
  if (!el) return;
  el.querySelectorAll('.dtb').forEach(x => x.remove());
  const t = J.trades.find(x => x.id == tid);
  if (!t) return;

  const msg = $('#chmsg');
  const say = m => { if ($('#chmsg') === msg) msg.textContent = m; };

  if (typeof LightweightCharts === 'undefined') {
    return say('Chart-Bibliothek nicht geladen: Die Datei lw-charts.js muss im Ordner „vendor“ liegen (oder direkt neben index.html). Danach App neu starten – bei der fertigen .exe neu bauen.');
  }

  // --- Kerzen laden (mit Cache) ---
  say('Lade Kerzen …');
  const want = CIV[t.id] || D.chartIv || null;
  const key = t.id + ':' + want;
  let r = CC[key];
  if (!r) {
    try { r = await api.jCandles(t.id, want); }
    catch (e) { r = { error: String(e.message || e) }; }
    if (!r.error) { CC[key] = r; CC[t.id + ':' + r.iv] = r; }
  }
  if ($('#ch') !== el) return;              // Fenster wurde inzwischen gewechselt
  if (r.error) return say('Kein Chart möglich: ' + r.error);
  say('');

  // Intervall-Buttons
  $('#ivb').innerHTML =
    r.avail.map(v => `<button class="pill ${v == r.iv ? 'on' : ''}" data-act="iv" data-v="${v}">${v}</button>`).join('') +
    '<button class="pill" data-act="viewReset" title="Zoom, Skalierung und Höhe zurücksetzen" style="margin-left:auto">↺ Ansicht</button>';

  try {
    /* ---------- Grundwerte ---------- */
    const OFF = new Date(r.entry).getTimezoneOffset() * 60;
    const L = ms => Math.floor(ms / 1000) - OFF;          // lokale Zeit für den Chart
    const sh = t.bias == 'Short', win = t.pnl > 0;

    // Nachkommastellen aus Preisen ableiten
    const dc = v => { const q = String(v); return q.includes('e') ? 8 : (q.split('.')[1] || '').length; };
    const dec = Math.min(8, Math.max(2, dc(t.entry_price), dc(t.exit_price),
      ...r.candles.slice(0, 60).map(c => Math.max(dc(c.o), dc(c.c)))));

    // gespeicherte Ansicht (Höhe, Zoom, Preisbereich) pro Trade und Intervall
    const H0 = Math.round((anl(t).view && anl(t).view.h) || 300);
    el.style.height = H0 + 'px';
    const VW = () => { const v = anl(t).view; return v && v[r.iv] || null; };

    /* ---------- Chart & Kerzen ---------- */
    const chart = LightweightCharts.createChart(el, {
      width: el.clientWidth || 600,
      height: H0,
      layout: { background: { color: 'transparent' }, textColor: '#7d869c' },
      crosshair: { mode: LightweightCharts.CrosshairMode ? LightweightCharts.CrosshairMode.Normal : 0 },
      grid: { vertLines: { color: '#171c28' }, horzLines: { color: '#171c28' } },
      rightPriceScale: { borderColor: '#232838', scaleMargins: { top: .2, bottom: .1 } },
      timeScale: { borderColor: '#232838', timeVisible: true, secondsVisible: false }
    });
    const UP = '#4834d4', DN = '#552384', CY = '#5ef0ff', LV = '#a58bff';

    const ser = chart.addCandlestickSeries({
      upColor: UP, downColor: DN, borderUpColor: UP, borderDownColor: DN, wickUpColor: UP, wickDownColor: DN,
      priceFormat: { type: 'price', precision: dec, minMove: 1 / Math.pow(10, dec) },
      // Preisbereich: gespeicherte Ansicht oder so, dass Entry/Exit/SL/TP sichtbar bleiben
      autoscaleInfoProvider: o => {
        const vw = VW();
        if (vw && isFinite(vw.pmin) && isFinite(vw.pmax) && vw.pmax > vw.pmin) {
          const R = vw.pmax - vw.pmin;
          return { priceRange: { minValue: vw.pmin + .1 * R, maxValue: vw.pmax - .2 * R } };
        }
        const b = o();
        if (!b) return b;
        const a = anl(t);
        const xs = [+t.entry_price, +t.exit_price, num(a.sl), num(a.tp)].filter(isFinite);
        b.priceRange.minValue = Math.min(b.priceRange.minValue, ...xs);
        b.priceRange.maxValue = Math.max(b.priceRange.maxValue, ...xs);
        return b;
      }
    });
    ser.setData(r.candles.map(c => ({ time: L(c.t), open: c.o, high: c.h, low: c.l, close: c.c })));

    /* ---------- Entry / Exit: Pfeile, Linie, Preislinien ---------- */
    const near = ms => {                       // Kerze, die zu einem Zeitpunkt gehört
      let b = null;
      for (const c of r.candles) { if (c.t <= ms) b = c; else break; }
      return b || r.candles[0];
    };
    const eC = near(r.entry), xC = near(r.exit);

    ser.setMarkers([
      { time: L(eC.t), position: sh ? 'aboveBar' : 'belowBar', color: '#e8ecf4', shape: sh ? 'arrowDown' : 'arrowUp', text: 'Entry ' + t.entry_price },
      { time: L(xC.t), position: sh ? 'belowBar' : 'aboveBar', color: win ? CY : LV, shape: sh ? 'arrowUp' : 'arrowDown', text: 'Exit ' + t.exit_price }
    ].sort((a, b) => a.time - b.time));

    if (eC.t !== xC.t) {
      const ln = chart.addLineSeries({ color: win ? CY : LV, lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ln.setData([{ time: L(eC.t), value: +t.entry_price }, { time: L(xC.t), value: +t.exit_price }]);
    }
    ser.createPriceLine({ price: +t.entry_price, color: '#8a93ab', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Entry' });
    ser.createPriceLine({ price: +t.exit_price, color: win ? CY : LV, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Exit' });

    /* ---------- Plan-Zonen (SL / TP) ---------- */
    const prim = posPrim(() => {
      const a = anl(t);
      return { iE: r.candles.indexOf(eC), iX: r.candles.indexOf(xC), entry: +t.entry_price, exit: +t.exit_price, sl: num(a.sl), tp: num(a.tp), win, sh };
    });
    if (ser.attachPrimitive) ser.attachPrimitive(prim);

    const lines = {};
    const drawLv = () => {                    // SL/TP-Preislinien neu setzen
      for (const k of ['sl', 'tp']) {
        if (lines[k]) { ser.removePriceLine(lines[k]); lines[k] = null; }
        const v = num(anl(t)[k]);
        if (isFinite(v)) lines[k] = ser.createPriceLine({ price: v, color: k == 'sl' ? LV : CY, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: k.toUpperCase() });
      }
      chart.priceScale('right').applyOptions({ autoScale: true });
      prim.update();
    };
    drawLv();

    /* ======================================================================
       Zeichenwerkzeuge: Box, Linie, Range-Volumenprofil (VAH/VAL/POC), Anchored VWAP
       ====================================================================== */
    const CS = r.candles;
    const STP = CS.length > 1 ? CS[1].t - CS[0].t : 60000;      // Kerzenlänge in ms
    const TS = chart.timeScale();
    const DNM = { box: 'Box', line: 'Linie', vp: 'Volumenprofil', vwap: 'Anchored VWAP', path: 'Pfad' };
    const fp = v => v.toFixed(dec);

    let tool = null;        // aktives Werkzeug
    let pend = null;        // erster gesetzter Punkt (Box, Linie, Volumenprofil)
    let ppts = [];          // bisher gesetzte Punkte des Pfads
    let lastClick = null;   // letzter Klick (für Doppelklick = Pfad beenden)
    let cur = null;         // aktuelle Mausposition (Vorschau)
    let dreq = null;        // Neuzeichnen anfordern
    let selId = null;       // ausgewählte Zeichnung
    const vpC = {}, vwC = {};   // Caches für Volumenprofil / VWAP

    // Zeit (ms) ⇄ logischer Kerzenindex (auch außerhalb der Daten)
    const idxOf = ms => {
      const n = CS.length - 1;
      if (ms <= CS[0].t) return (ms - CS[0].t) / STP;
      if (ms >= CS[n].t) return n + (ms - CS[n].t) / STP;
      let lo = 0, hi = n;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CS[m].t <= ms) lo = m; else hi = m; }
      return lo + (ms - CS[lo].t) / (CS[lo + 1].t - CS[lo].t);
    };
    const msOf = ix => {
      const n = CS.length - 1;
      if (ix <= 0) return CS[0].t + ix * STP;
      if (ix >= n) return CS[n].t + (ix - n) * STP;
      const lo = Math.floor(ix);
      return CS[lo].t + (ix - lo) * (CS[lo + 1].t - CS[lo].t);
    };

    // Volumenprofil: 48 Preisstufen, Value Area = 70 % des Volumens um den POC
    const calcVP = d => {
      const a = Math.min(d.t1, d.t2), b = Math.max(d.t1, d.t2), k = r.iv + '|' + a + '|' + b;
      if (vpC[k] !== undefined) return vpC[k];
      const cs = CS.filter(c => c.t + STP > a && c.t <= b);
      let lo = Infinity, hi = -Infinity;
      for (const c of cs) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
      if (!cs.length || !(hi > lo)) return vpC[k] = null;

      const N = 48, st = (hi - lo) / N, v = new Array(N).fill(0);
      for (const c of cs) {                    // Kerzenvolumen gleichmäßig auf ihre Preisstufen verteilen
        const vol = c.v || 0;
        if (!vol) continue;
        const i0 = Math.min(N - 1, Math.floor((c.l - lo) / st));
        const i1 = Math.min(N - 1, Math.floor((c.h - lo) / st));
        const n = i1 - i0 + 1;
        for (let i = i0; i <= i1; i++) v[i] += vol / n;
      }
      const tot = v.reduce((x, y) => x + y, 0);
      if (!tot) return vpC[k] = null;

      let poc = 0;
      v.forEach((x, i) => { if (x > v[poc]) poc = i; });
      let L = poc, H = poc, acc = v[poc];      // Value Area vom POC aus erweitern
      while (acc < tot * .7 && (L > 0 || H < N - 1)) {
        const dn = L > 0 ? v[L - 1] : -1, up = H < N - 1 ? v[H + 1] : -1;
        if (up >= dn) { H++; acc += v[H]; } else { L--; acc += v[L]; }
      }
      return vpC[k] = { lo, st, v, poc, L, H, N, max: v[poc] };
    };

    // Anchored VWAP ab Kerze t1
    const vwapOf = t1 => {
      const i0 = Math.max(0, Math.min(CS.length - 1, Math.round(idxOf(t1))));
      const k = r.iv + '|' + i0;
      if (vwC[k]) return vwC[k];
      let pv = 0, vv = 0;
      const vals = [];
      for (let i = i0; i < CS.length; i++) {
        const c = CS[i], v = c.v || 0;
        pv += (c.h + c.l + c.c) / 3 * v;
        vv += v;
        vals.push(vv > 0 ? pv / vv : null);
      }
      return vwC[k] = { i0, vals };
    };

    // Eine Zeichnung zeichnen (X/Y wandeln Zeit/Preis in Pixel um)
    const drawOne = (ctx, d, X, Y, hr, vr) => {
      ctx.save();
      ctx.globalAlpha = d.pv ? 0.6 : 1;                 // pv = Vorschau
      ctx.lineWidth = Math.max(1, hr * 1.4);
      ctx.font = `600 ${Math.round(11 * hr)}px system-ui,sans-serif`;
      ctx.textBaseline = 'middle';

      const lbl = (txt, x, y, col) => {                // Beschriftung rechtsbündig
        const w = ctx.measureText(txt).width + 10 * hr, h = 16 * hr;
        ctx.fillStyle = col;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w, y - h / 2, w, h, 4 * hr);
        else ctx.rect(x - w, y - h / 2, w, h);
        ctx.fill();
        ctx.fillStyle = '#0b0e15';
        ctx.textAlign = 'right';
        ctx.fillText(txt, x - 5 * hr, y + .5 * hr);
      };
      const hl = (y, x1, x2, col, dash) => {           // waagerechte Linie
        ctx.strokeStyle = col;
        ctx.setLineDash(dash ? [5 * hr, 4 * hr] : []);
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        ctx.setLineDash([]);
      };

      if (d.k == 'box' || d.k == 'line') {
        const x1 = X(d.t1), x2 = X(d.t2), y1 = Y(d.p1), y2 = Y(d.p2);
        if (![x1, x2, y1, y2].some(v => v == null)) {
          if (d.k == 'box') {
            ctx.fillStyle = 'rgba(143,123,255,.15)';
            ctx.strokeStyle = 'rgba(160,140,255,.95)';
            ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
            ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          } else {
            ctx.strokeStyle = '#ffd166';
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.fillStyle = '#ffd166';
            for (const [px, py] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(px, py, 3.2 * hr, 0, 7); ctx.fill(); }
          }
        }
      } else if (d.k == 'path') {
        const P = (d.pts || []).map(q => [X(q.t), Y(q.p)]);
        if (P.length >= 2 && !P.some(a => a[0] == null || a[1] == null)) {
          const col = '#ff9f43';
          ctx.strokeStyle = col;
          ctx.fillStyle = col;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          P.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke();
          for (const [px, py] of P.slice(0, -1)) {            // kleine Punkte an den Knicken
            ctx.beginPath(); ctx.arc(px, py, 2.6 * hr, 0, 7); ctx.fill();
          }
          // Pfeilspitze am letzten Punkt, Richtung = letztes Stück mit echter Länge
          const [ex, ey] = P[P.length - 1];
          let from = null;
          for (let i = P.length - 2; i >= 0; i--) {
            if (Math.hypot(ex - P[i][0], ey - P[i][1]) > 2 * hr) { from = P[i]; break; }
          }
          if (from) {
            const ang = Math.atan2(ey - from[1], ex - from[0]), s = 11 * hr;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - s * Math.cos(ang - .45), ey - s * Math.sin(ang - .45));
            ctx.lineTo(ex - s * Math.cos(ang + .45), ey - s * Math.sin(ang + .45));
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (d.k == 'vwap') {
        const w = vwapOf(d.t1);
        let started = false, lx = null, ly = null, lv = null;
        ctx.strokeStyle = '#ff7ad9';
        ctx.beginPath();
        w.vals.forEach((v, k) => {
          if (v == null) return;
          const x = X(CS[w.i0 + k].t), y = Y(v);
          if (x == null || y == null) return;
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          lx = x; ly = y; lv = v;
        });
        ctx.stroke();
        if (started) {
          const x0 = X(CS[w.i0].t);
          ctx.fillStyle = '#ff7ad9';
          ctx.beginPath(); ctx.arc(x0, Y(CS[w.i0].c), 3.5 * hr, 0, 7); ctx.fill();
          lbl('AVWAP ' + fp(lv), lx, ly - 12 * vr, '#ff7ad9');
        }
      } else if (d.k == 'vp') {
        const v = calcVP(d);
        if (v) {
          const xa = X(Math.min(d.t1, d.t2)), xb = X(Math.max(d.t1, d.t2));
          const yt = Y(v.lo + v.N * v.st), yb = Y(v.lo);
          if (![xa, xb, yt, yb].some(q => q == null)) {
            const mw = Math.max(40 * hr, (xb - xa) * .45);       // maximale Balkenbreite
            ctx.fillStyle = 'rgba(143,123,255,.06)';
            ctx.fillRect(xa, yt, xb - xa, yb - yt);
            ctx.strokeStyle = 'rgba(143,123,255,.4)';
            ctx.strokeRect(xa, yt, xb - xa, yb - yt);
            for (let i = 0; i < v.N; i++) {
              const ya = Y(v.lo + (i + 1) * v.st), yc = Y(v.lo + i * v.st);
              if (ya == null || yc == null) continue;
              ctx.fillStyle = i >= v.L && i <= v.H ? 'rgba(94,240,255,.42)' : 'rgba(125,134,156,.32)';
              ctx.fillRect(xa, ya + hr * .5, v.v[i] / v.max * mw, Math.max(1, yc - ya - hr));
            }
            const yP = Y(v.lo + (v.poc + .5) * v.st);
            const yH = Y(v.lo + (v.H + 1) * v.st);
            const yL = Y(v.lo + v.L * v.st);
            hl(yH, xa, xb, '#5ef0ff', true);
            hl(yL, xa, xb, '#5ef0ff', true);
            hl(yP, xa, xb, '#ff5c7a', false);
            lbl('VAH ' + fp(v.lo + (v.H + 1) * v.st), xb - 4 * hr, yH - 10 * vr, '#5ef0ff');
            lbl('VAL ' + fp(v.lo + v.L * v.st), xb - 4 * hr, yL + 10 * vr, '#5ef0ff');
            lbl('POC ' + fp(v.lo + (v.poc + .5) * v.st), xb - 4 * hr, yP, '#ff5c7a');
          }
        }
      }

      // Auswahl: weiße Umrandung und Anfasser
      if (d.sel) {
        const sq = (x, y) => {
          if (x == null || y == null) return;
          const z = 5 * hr;
          ctx.fillStyle = '#0b0e15';
          ctx.strokeStyle = '#e8ecf4';
          ctx.setLineDash([]);
          ctx.lineWidth = Math.max(1, hr * 1.4);
          ctx.fillRect(x - z, y - z, 2 * z, 2 * z);
          ctx.strokeRect(x - z, y - z, 2 * z, 2 * z);
        };
        if (d.k == 'box' || d.k == 'line') {
          const x1 = X(d.t1), x2 = X(d.t2), y1 = Y(d.p1), y2 = Y(d.p2);
          if (d.k == 'box') {
            ctx.strokeStyle = '#e8ecf4';
            ctx.lineWidth = Math.max(1, hr * 1.4);
            ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
            sq(x1, y1); sq(x2, y1); sq(x1, y2); sq(x2, y2);
          } else { sq(x1, y1); sq(x2, y2); }
        } else if (d.k == 'vp') {
          const v = calcVP(d);
          if (v) {
            const xa = X(Math.min(d.t1, d.t2)), xb = X(Math.max(d.t1, d.t2));
            const yt = Y(v.lo + v.N * v.st), yb = Y(v.lo);
            ctx.strokeStyle = '#e8ecf4';
            ctx.lineWidth = Math.max(1, hr * 1.4);
            ctx.setLineDash([6 * hr, 4 * hr]);
            ctx.strokeRect(xa, yt, xb - xa, yb - yt);
            sq(xa, yt); sq(xb, yt); sq(xa, yb); sq(xb, yb);
          }
        } else if (d.k == 'path') {
          const P = (d.pts || []).map(q => [X(q.t), Y(q.p)]);
          if (P.length >= 2 && !P.some(a => a[0] == null || a[1] == null)) {
            ctx.strokeStyle = 'rgba(232,236,244,.9)';
            ctx.lineWidth = Math.max(1, hr * 2.6);
            ctx.lineJoin = 'round';
            ctx.beginPath();
            P.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            ctx.stroke();
            P.forEach(([x, y]) => sq(x, y));
          }
        } else if (d.k == 'vwap') {
          const w = vwapOf(d.t1);
          ctx.strokeStyle = 'rgba(232,236,244,.9)';
          ctx.lineWidth = Math.max(1, hr * 2.6);
          ctx.beginPath();
          let st = false;
          w.vals.forEach((v, k) => {
            if (v == null) return;
            const x = X(CS[w.i0 + k].t), y = Y(v);
            if (x == null || y == null) return;
            if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y);
          });
          ctx.stroke();
          sq(X(CS[w.i0].t), Y(CS[w.i0].c));
        }
      }
      ctx.restore();
    };

    // Zeichen-Layer über den Kerzen
    const dview = {
      zOrder: () => 'top',
      renderer: () => ({
        draw(target) {
          target.useBitmapCoordinateSpace(sc => {
            const ctx = sc.context, hr = sc.horizontalPixelRatio, vr = sc.verticalPixelRatio;
            const X = ms => { const v = TS.logicalToCoordinate(idxOf(ms)); return v == null ? null : v * hr; };
            const Y = p => { const v = ser.priceToCoordinate(p); return v == null ? null : v * vr; };
            const list = (anl(t).draws || []).map(d => d.id && d.id === selId ? Object.assign({ sel: 1 }, d) : d);
            // Vorschau während des Zeichnens
            if (tool && cur) {
              if (tool == 'vwap') list.push({ k: 'vwap', t1: cur.ms, pv: 1 });
              else if (tool == 'path') {
                if (ppts.length) list.push({ k: 'path', pts: [...ppts, cur].map(q => ({ t: q.ms, p: q.p })), pv: 1 });
              }
              else if (pend) list.push({ k: tool, t1: pend.ms, p1: pend.p, t2: cur.ms, p2: cur.p, pv: 1 });
            }
            for (const d of list) drawOne(ctx, d, X, Y, hr, vr);
          });
        }
      })
    };
    if (ser.attachPrimitive) ser.attachPrimitive({ paneViews: () => [dview], attached: p => { dreq = p.requestUpdate; }, detached() {}, updateAllViews() {} });
    const dupd = () => { if (dreq) dreq(); };

    /* ---------- Werkzeugleiste ---------- */
    const tb = document.createElement('div');
    tb.className = 'dtb';
    tb.innerHTML =
      `<span class="gr" title="Verschieben">${toolIcon('grip')}</span>` +
      `<button data-tool="box" title="Box">${toolIcon('box')}</button>` +
      `<button data-tool="line" title="Linie">${toolIcon('line')}</button>` +
      `<button data-tool="vp" title="Volumenprofil (Range): VAH · VAL · POC">${toolIcon('vp')}</button>` +
      `<button data-tool="vwap" title="Anchored VWAP">${toolIcon('vwap')}</button>` +
      `<button data-tool="path" title="Pfad mit Pfeil: mehrere Punkte klicken · Doppelklick, Enter oder Rechtsklick beendet">${toolIcon('path')}</button>` +
      '<i></i>' +
      `<button data-tb="undo" title="Letzte Zeichnung entfernen">${toolIcon('undo')}</button>` +
      `<button data-tb="del" title="Ausgewählte Zeichnung löschen (Entf)" disabled>${toolIcon('del')}</button>`;

    const refTb = () => {
      tb.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool == tool));
      tb.querySelector('[data-tb=del]').disabled = !selId;
    };
    const setTool = k => {
      tool = k === tool ? null : k;
      pend = null; cur = null; selId = null; ppts = []; lastClick = null;
      if (tool) {
        pick = null;
        document.querySelectorAll('[data-act="pick"]').forEach(b => b.classList.remove('on'));
        toast(tool == 'vwap' ? 'Auf die Kerze klicken, ab der der VWAP starten soll'
          : tool == 'path' ? 'Punkte nacheinander klicken · Doppelklick, Enter oder Rechtsklick beendet · Esc bricht ab'
          : 'Zwei Punkte klicken · Rechtsklick oder Esc bricht ab');
      }
      refTb(); dupd();
    };
    const cancelTool = () => {
      if (!tool) return false;
      tool = null; pend = null; cur = null; ppts = []; lastClick = null;
      refTb(); dupd();
      return true;
    };
    // Pfad abschließen: ab 2 Punkten speichern, sonst verwerfen
    const finishPath = () => {
      if (tool != 'path') return false;
      if (ppts.length >= 2) {
        addD({ k: 'path', pts: ppts.map(q => ({ t: q.ms, p: q.p })) });
        setTool(null);
      } else cancelTool();
      return true;
    };

    // Zeichnungen speichern / löschen
    const addD = d => {
      const a = anl(t);
      d.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      (a.draws = a.draws || []).push(d);
      persistA(t);
    };
    const delDraw = i => { anl(t).draws.splice(i, 1); selId = null; persistA(t); refTb(); dupd(); };
    const clearDraws = () => { anl(t).draws = []; selId = null; persistA(t); refTb(); dupd(); };
    const selectAt = pp => {
      const i = hitDraw(pp.x, pp.y), d = i >= 0 ? anl(t).draws[i] : null;
      selId = d ? d.id : null;
      refTb(); dupd();
    };
    const delSel = () => {
      const i = (anl(t).draws || []).findIndex(d => d.id === selId);
      if (i < 0) return false;
      delDraw(i);
      return true;
    };

    // Pixel → Zeit/Preis
    const pt = (x, y) => {
      const lg = TS.coordinateToLogical(x), p = ser.coordinateToPrice(y);
      return lg == null || p == null ? null : { ms: msOf(lg), p };
    };
    // Klick mit aktivem Werkzeug
    const toolClick = pp => {
      if (tool == 'path') {
        const now = Date.now();
        // zweiter Klick an fast gleicher Stelle direkt nach dem ersten = Doppelklick → beenden
        if (lastClick && now - lastClick.time < 400 && Math.hypot(pp.x - lastClick.x, pp.y - lastClick.y) < 5) {
          finishPath();
          return;
        }
        const q = pt(pp.x, pp.y);
        if (!q) return;
        ppts.push(q);
        cur = q;
        lastClick = { x: pp.x, y: pp.y, time: now };
        dupd();
        return;
      }
      if (tool == 'vwap') {
        const ix = Math.max(0, Math.min(CS.length - 1, Math.round(TS.coordinateToLogical(pp.x) ?? 0)));
        addD({ k: 'vwap', t1: CS[ix].t });
        setTool(null);
        return;
      }
      const q = pt(pp.x, pp.y);
      if (!q) return;
      if (!pend) { pend = q; cur = q; dupd(); return; }
      addD({ k: tool, t1: pend.ms, p1: pend.p, t2: q.ms, p2: q.p });
      setTool(null);
    };

    // Welche Zeichnung liegt unter dem Mauszeiger? (Index oder -1)
    const hitDraw = (x, y) => {
      const ds = anl(t).draws || [];
      const X = ms => TS.logicalToCoordinate(idxOf(ms));
      const Y = p => ser.priceToCoordinate(p);
      const inr = (x1, x2, y1, y2) =>
        ![x1, x2, y1, y2].some(v => v == null) &&
        x >= Math.min(x1, x2) - 4 && x <= Math.max(x1, x2) + 4 &&
        y >= Math.min(y1, y2) - 4 && y <= Math.max(y1, y2) + 4;
      for (let i = ds.length - 1; i >= 0; i--) {
        const d = ds[i];
        if (d.k == 'line') {
          const x1 = X(d.t1), y1 = Y(d.p1), x2 = X(d.t2), y2 = Y(d.p2);
          if ([x1, y1, x2, y2].some(v => v == null)) continue;
          const dx = x2 - x1, dy = y2 - y1;
          const q = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
          if (Math.hypot(x - (x1 + q * dx), y - (y1 + q * dy)) < 7) return i;
        } else if (d.k == 'path') {
          const P = (d.pts || []).map(q => [X(q.t), Y(q.p)]);
          if (P.some(a => a[0] == null || a[1] == null)) continue;
          for (let j = 1; j < P.length; j++) {
            const [x1, y1] = P[j - 1], [x2, y2] = P[j], dx = x2 - x1, dy = y2 - y1;
            const q = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
            if (Math.hypot(x - (x1 + q * dx), y - (y1 + q * dy)) < 7) return i;
          }
        } else if (d.k == 'box') {
          if (inr(X(d.t1), X(d.t2), Y(d.p1), Y(d.p2))) return i;
        } else if (d.k == 'vp') {
          const v = calcVP(d);
          if (v && inr(X(Math.min(d.t1, d.t2)), X(Math.max(d.t1, d.t2)), Y(v.lo + v.N * v.st), Y(v.lo))) return i;
        } else if (d.k == 'vwap') {
          const w = vwapOf(d.t1), v = w.vals[Math.round(TS.coordinateToLogical(x) ?? 0) - w.i0];
          if (v == null) continue;
          const yy = Y(v);
          if (yy != null && Math.abs(yy - y) < 9) return i;
        }
      }
      return -1;
    };

    // Vorschau beim Bewegen der Maus
    chart.subscribeCrosshairMove(p => {
      if (!tool || !p.point) return;
      if (tool == 'vwap') {
        const lg = TS.coordinateToLogical(p.point.x);
        if (lg != null) { cur = { ms: msOf(lg) }; dupd(); }
        return;
      }
      if (tool == 'path' ? !ppts.length : !pend) return;
      const q = pt(p.point.x, p.point.y);
      if (q) { cur = q; dupd(); }
    });

    // Tastatur: Esc bricht ab / hebt Auswahl auf, Entf löscht die Auswahl
    const esk = e => {
      if (e.key == 'Enter' && tool == 'path') { finishPath(); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.key == 'Escape' && tool) { cancelTool(); e.stopImmediatePropagation(); }
      else if (e.key == 'Escape' && selId) { selId = null; refTb(); dupd(); e.stopImmediatePropagation(); }
      else if ((e.key == 'Delete' || e.key == 'Backspace') && selId &&
               !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) {
        if (delSel()) e.preventDefault();
      }
    };
    document.addEventListener('keydown', esk, true);

    // Werkzeugleiste einsetzen, verschiebbar machen (Position wird gemerkt)
    el.appendChild(tb);
    const place = (l, b) => {
      l = Math.max(0, Math.min(el.clientWidth - tb.offsetWidth, l));
      b = Math.max(0, Math.min(el.clientHeight - tb.offsetHeight, b));
      tb.style.left = l + 'px';
      tb.style.bottom = b + 'px';
    };
    { const tp = D.tbPos || { l: 10, b: 34 }; place(tp.l, tp.b); }
    ['mousedown', 'contextmenu', 'wheel'].forEach(ev => tb.addEventListener(ev, e => {
      e.stopPropagation();
      if (ev == 'contextmenu') e.preventDefault();
    }));
    const gr = tb.querySelector('.gr');
    let gd = null;
    gr.addEventListener('pointerdown', e => {
      e.preventDefault();
      gr.setPointerCapture(e.pointerId);
      gd = { x: e.clientX, y: e.clientY, l: parseFloat(tb.style.left) || 0, b: parseFloat(tb.style.bottom) || 0 };
    });
    gr.addEventListener('pointermove', e => { if (gd) place(gd.l + e.clientX - gd.x, gd.b - (e.clientY - gd.y)); });
    gr.addEventListener('pointerup', () => {
      if (!gd) return;
      gd = null;
      D.tbPos = { l: parseFloat(tb.style.left) || 0, b: parseFloat(tb.style.bottom) || 0 };
      save();
    });
    tb.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.tool) setTool(b.dataset.tool);
      else if (b.dataset.tb == 'del') delSel();
      else if (b.dataset.tb == 'undo') {
        const a = anl(t);
        if ((a.draws || []).length) { a.draws.pop(); selId = null; persistA(t); refTb(); dupd(); }
      }
    });

    /* ---------- SL / TP setzen (Klick im Chart oder Rechtsklick-Menü) ---------- */
    const setLv = (k, v) => {
      const a = anl(t);
      a[k] = isFinite(v) ? v.toFixed(dec) : '';
      const inp = document.querySelector(`[data-ja="${k}"]`);
      if (inp) inp.value = a[k];
      persistA(t);
      drawLv();
      const rr = $('#rr');
      if (rr) rr.textContent = rrText(t);
    };

    chart.subscribeClick(p => {
      if (tool && p.point) { toolClick(p.point); return; }
      if (!pick || !p.point) { if (p.point && !pick) selectAt(p.point); return; }
      const pr = ser.coordinateToPrice(p.point.y);
      if (pr == null) return;
      setLv(pick, pr);
      pick = null;
      document.querySelectorAll('[data-act="pick"]').forEach(b => b.classList.remove('on'));
      tip.style.display = 'none';
    });

    // kleiner Preis-Hinweis am Mauszeiger, solange SL/TP gewählt wird
    el.querySelectorAll('.pktip').forEach(x => x.remove());
    el.style.position = 'relative';
    const tip = document.createElement('div');
    tip.className = 'pktip';
    tip.style.cssText = 'position:absolute;z-index:5;pointer-events:none;display:none;padding:2px 8px;border-radius:5px;font:600 12px system-ui,sans-serif;color:#0b0e15;white-space:nowrap';
    el.appendChild(tip);
    chart.subscribeCrosshairMove(p => {
      if (!pick || !p.point) { tip.style.display = 'none'; return; }
      const pr = ser.coordinateToPrice(p.point.y);
      if (pr == null) { tip.style.display = 'none'; return; }
      tip.textContent = (pick == 'sl' ? 'SL ' : 'TP ') + pr.toFixed(dec);
      tip.style.background = pick == 'sl' ? LV : CY;
      tip.style.left = Math.max(0, Math.min(p.point.x + 14, el.clientWidth - 140)) + 'px';
      tip.style.top = Math.max(0, p.point.y - 28) + 'px';
      tip.style.display = 'block';
    });

    /* ---------- Ansicht (Zoom, Preisbereich, Höhe) merken ---------- */
    chart.timeScale().fitContent();
    {
      const vw = VW();
      if (vw && isFinite(vw.l) && isFinite(vw.r) && vw.r > vw.l) {
        chart.timeScale().setVisibleLogicalRange({ from: vw.l, to: vw.r });
      }
    }
    let ct = null, dn = false;
    const capture = () => {
      try {
        const a = anl(t), lr = chart.timeScale().getVisibleLogicalRange();
        if (!lr) return;
        const v = a.view = a.view || {};
        v.h = el.clientHeight;
        const e = v[r.iv] = Object.assign({}, v[r.iv]);
        e.l = lr.from; e.r = lr.to;
        if (chart.priceScale('right').options().autoScale === false) {
          const ph = prim.ph() || el.clientHeight - 28;
          const hi = ser.coordinateToPrice(0), lo = ser.coordinateToPrice(ph);
          if (hi != null && lo != null && hi > lo) { e.pmax = hi; e.pmin = lo; }
        }
        persistA(t);
      } catch {}
    };
    const cap = () => { clearTimeout(ct); ct = setTimeout(capture, 300); };
    el.addEventListener('wheel', cap, { passive: true });
    el.addEventListener('touchend', cap);
    el.addEventListener('mousedown', () => { dn = true; });
    const mu = () => { if (dn) { dn = false; cap(); } };
    document.addEventListener('mouseup', mu);
    const resetView = () => { const a = anl(t); delete a.view; persistA(t); initChart(); };

    /* ---------- Rechtsklick-Menü ---------- */
    const cpt = async s => {                   
      try {
        if (api.clipText) await api.clipText(s);
        else await navigator.clipboard.writeText(s);
        return true;
      } catch { return false; }
    };
    const shot = () => {                       
      try {
        if (chart.clearCrosshairPosition) chart.clearCrosshairPosition();
        const c = chart.takeScreenshot(), o = document.createElement('canvas');
        o.width = c.width; o.height = c.height;
        const x = o.getContext('2d');
        x.fillStyle = '#0b0e15';
        x.fillRect(0, 0, o.width, o.height);
        x.drawImage(c, 0, 0);
        return o;
      } catch { return null; }
    };

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      document.querySelectorAll('.ctxm').forEach(x => x.remove());
      if (tool) { if (!finishPath()) cancelTool(); return; }
      const rc = el.getBoundingClientRect(), pr = ser.coordinateToPrice(e.clientY - rc.top);
      if (pr == null) return;
      const a = anl(t), ps = pr.toFixed(dec), has = k => isFinite(num(a[k]));

      // Rechtsklick auf eine Zeichnung wählt sie aus und bietet "löschen" an
      const dh = hitDraw(e.clientX - rc.left, e.clientY - rc.top);
      if (dh >= 0) { selId = a.draws[dh].id; refTb(); dupd(); }

      // Menüeinträge: [Symbol, Text, rechter Hinweis, Aktion]  ('-' = Trennlinie)
      const items = [
        ...(dh >= 0 ? [['🗑', DNM[a.draws[dh].k] + ' löschen', '', () => delDraw(dh)], '-'] : []),
        ['🛑', 'Hier Stop-Loss setzen', ps, () => setLv('sl', pr)],
        ['🎯', 'Hier Take-Profit setzen', ps, () => setLv('tp', pr)],
        ['📋', 'Preis kopieren', ps, async () => toast(await cpt(ps) ? 'Preis kopiert: ' + ps : 'Kopieren fehlgeschlagen')]
      ];
      if (has('sl') || has('tp')) items.push('-');
      if (has('sl')) items.push(['✕', 'Stop-Loss entfernen', esc(a.sl), () => setLv('sl', NaN)]);
      if (has('tp')) items.push(['✕', 'Take-Profit entfernen', esc(a.tp), () => setLv('tp', NaN)]);
      items.push('-',
        ['🖼', 'Chart als Bild kopieren', '', async () => {
          const c = shot();
          if (!c) return toast('Bild nicht möglich');
          const d = c.toDataURL('image/png');
          try {
            if (api.clipImg) await api.clipImg(d);
            else {
              const b = await new Promise(rs => c.toBlob(rs));
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
            }
            toast('Chart-Bild kopiert ✓');
          } catch { toast('Kopieren fehlgeschlagen'); }
        }],
        ...((a.draws || []).length ? [['🧹', 'Alle Zeichnungen löschen', '', clearDraws]] : []),
        ['↺', 'Ansicht zurücksetzen', '', resetView]
      );

      const m = document.createElement('div');
      m.className = 'ctxm';
      m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' :
        `<button data-i="${i}"><span>${it[0]}</span>${it[1]}<small>${it[2]}</small></button>`).join('');
      document.body.append(m);
      m.style.left = Math.max(8, Math.min(e.clientX, innerWidth - m.offsetWidth - 8)) + 'px';
      m.style.top = Math.max(8, Math.min(e.clientY, innerHeight - m.offsetHeight - 8)) + 'px';
      m.addEventListener('click', ev => {
        const b = ev.target.closest('button');
        if (!b) return;
        ev.stopPropagation();
        const f = items[+b.dataset.i][3];
        m.remove();
        f();
      });
    });

    /* ---------- Größe anpassen & Aufräum-Handle ---------- */
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      place(parseFloat(tb.style.left) || 0, parseFloat(tb.style.bottom) || 0);
    });
    ro.observe(el);

    CH = {
      chart, ser, drawLv, ro, shot, resetView, cancelTool,
      off: () => {
        clearTimeout(ct);
        document.removeEventListener('mouseup', mu);
        document.removeEventListener('keydown', esk, true);
      }
    };
  } catch (e) {
    say('Chart konnte nicht gezeichnet werden: ' + (e.message || e));
  }
}