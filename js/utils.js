/* 
   utils.js – Zeitfilter, Formatierung, Kennzahlen, Trade-Analyse-Helfer
*/

// ---------- Tabs der Navigation 
const TABS = [
  ['start', 'Start'],
  ['setups', 'Setups'],
  ['bookmap', 'Bookmap'],
  ['tips', 'Tipps'],
  ['journal', 'Journal'],
  ['analyse', 'Analyse'],
  ['settings', '⚙ Einstellungen']
];

/* ---------- Zeiträume 
   f = { mode, off, from, to }
   mode: all | day | week | month | quarter | year | range
   off:  0 = aktuell, -1 = einer zurück, …
*/
const z2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;

function prange(f) {
  const n = new Date();
  n.setHours(12, 0, 0, 0);
  const L = (d, o) => d.toLocaleDateString('de-DE', o);

  if (f.mode == 'day') {
    const d = new Date(n);
    d.setDate(d.getDate() + f.off);
    return {
      a: ymd(d), b: ymd(d),
      label: f.off == 0 ? 'Heute' : f.off == -1 ? 'Gestern'
        : L(d, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    };
  }
  if (f.mode == 'week') {
    const d = new Date(n);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + f.off * 7);  
    const e = new Date(d);
    e.setDate(e.getDate() + 6);
    return {
      a: ymd(d), b: ymd(e),
      label: `${f.off == 0 ? 'Diese Woche · ' : ''}${L(d, { day: '2-digit', month: 'short' })} – ${L(e, { day: '2-digit', month: 'short', year: 'numeric' })}`
    };
  }
  if (f.mode == 'month') {
    const d = new Date(n.getFullYear(), n.getMonth() + f.off, 1, 12);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
    return { a: ymd(d), b: ymd(e), label: L(d, { month: 'long', year: 'numeric' }) };
  }
  if (f.mode == 'quarter') {
    const q = Math.floor(n.getMonth() / 3) + f.off;
    const d = new Date(n.getFullYear(), q * 3, 1, 12);
    const e = new Date(d.getFullYear(), d.getMonth() + 3, 0, 12);
    return { a: ymd(d), b: ymd(e), label: `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` };
  }
  if (f.mode == 'year') {
    const y = n.getFullYear() + f.off;
    return { a: y + '-01-01', b: y + '-12-31', label: String(y) };
  }
  if (f.mode == 'range') {
    return { a: f.from || '0000-00-00', b: f.to || '9999-99-99', label: '' };
  }
  return { a: '0000-00-00', b: '9999-99-99', label: '' };   // all
}

const jrange = () => prange(JF);
const arange = () => prange(AF);

// Filter: Trade liegt im Zeitraum R (nach Einstiegsdatum)
const inR = R => t => {
  const d = String(t.entry_time).slice(0, 10);
  return d >= R.a && d <= R.b;
};

// ---------- Formatierung 
const fm = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Number(n) || 0).toFixed(2) + ' $';
const cls = n => (n > 0 ? 'lg' : n < 0 ? 'sh' : '');
const jpnl = n => (n > 0 ? '+' : '') + Number(n || 0).toFixed(2) + ' $';
const jdt = s => {
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? esc(s) : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
};
const num = v => parseFloat(String(v).replace(',', '.'));   // "1,5" oder "1.5" → Zahl
const sumP = a => a.reduce((x, t) => x + (+t.pnl || 0), 0);

/* ---------- Kennzahlen für die Analyse-Seite 
   Nach Gebühren & Funding = Realisiert − Gebühren + Funding 
*/
function stats(T) {
  const w = T.filter(t => t.pnl > 0);
  const l = T.filter(t => t.pnl < 0);
  const g = sumP(w);                       // Gewinn gesamt
  const v = sumP(l);                       // Verlust gesamt
  const fee = T.reduce((x, t) => x + Math.abs(+t.bitunix_fee || 0), 0);
  const fu = T.reduce((x, t) => x + (+t.bitunix_funding || 0), 0);
  const notional = T.reduce((x, t) => x + Math.abs((+t.entry_price || 0) * (+t.quantity || 0)), 0);
  // Gewinner, die nach Gebühren und Funding im Minus (oder bei 0) landen
  const flip = T.filter(t => t.pnl > 0 && t.pnl - Math.abs(+t.bitunix_fee || 0) + (+t.bitunix_funding || 0) <= 0).length;

  return {
    n: T.length, w: w.length, l: l.length, e: T.length - w.length - l.length,
    g, v, net: g + v,
    rate: T.length ? w.length / T.length * 100 : 0,
    avgW: w.length ? g / w.length : 0,
    avgL: l.length ? v / l.length : 0,
    pf: v < 0 ? g / -v : null,
    best: T.reduce((b, t) => !b || t.pnl > b.pnl ? t : b, null),
    worst: T.reduce((b, t) => !b || t.pnl < b.pnl ? t : b, null),
    fee, fu,
    after: g + v - fee + fu,
    feePct: g > 0 ? fee / g * 100 : null,                  // Gebühren in % vom Gewinn
    avgFee: T.length ? fee / T.length : 0,                 
    feeNot: notional ? fee / notional * 100 : 0,           
    flip
  };
}

// ---------- Trade-Analyse (Setup etc.) 
const anl = t => t.analysis || (t.analysis = { setupId: '', plan: '', note: '', diff: '', sl: '', tp: '' });

// CRV / Ergebnis in R, 
function rrText(t) {
  const a = anl(t), sl = num(a.sl), tp = num(a.tp), e = +t.entry_price, x = +t.exit_price;
  const dir = t.bias == 'Short' ? -1 : 1, out = [];
  if (isFinite(sl) && sl !== e) {
    const risk = Math.abs(e - sl);
    if (isFinite(tp)) out.push('Geplantes CRV 1 : ' + (Math.abs(tp - e) / risk).toFixed(2));
    const R = (x - e) * dir / risk;
    out.push('Ergebnis ' + (R > 0 ? '+' : '') + R.toFixed(2) + ' R');
  }
  return out.join(' · ');
}

// ----- Analyse speichern time out das nicht jederm itein tastendruck geschrieben wird
function persistA(t) {
  AP.add(t.id);
  clearTimeout(AT[t.id]);
  AT[t.id] = setTimeout(() => {
    AP.delete(t.id);
    api.jAnalysis(t.id, t.analysis);
  }, 350);
}

// ----- Beim Schließen noch offene Änderungen sofort sichern 
addEventListener('beforeunload', () => {
  AP.forEach(id => {
    const t = J.trades.find(x => x.id == id);
    if (t) api.jAnalysis(id, t.analysis);
  });
});
