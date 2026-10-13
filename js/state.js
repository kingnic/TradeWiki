
/* ==
   Alle Skripte teilen sich den globalen Scope
   Ladereihenfolge: state → utils → chart → views → pdf → zoom → app
/* ==

/* ---------- Standarddaten first start ---------- */
const DEF = {
  programs: [
    { n: 'TradingView', t: 'https://www.tradingview.com' },
    { n: 'Bookmap', t: '' },
    { n: 'Börse / Browser', t: '' }
  ],
  groups: [{
    t: 'Vorbereitung',
    items: [
      'Wochenchart: FVGs markieren',
      'Wichtige Ranges und Zonen einzeichnen im Stunden-Chart',
      '30-Min-Chart: Zonen markieren anhand vom SVP',
      'Single Prints markieren im 30-Min',
      'Mögliche Setups einzeichnen, die man sieht',
      'Alarme setzen'
    ].map(t => ({ t, d: false }))
  }],
  feel: '',
  date: '',
  setups: [],
  bookmap: { text: '', images: [] }
};



/* Standard-Tipps */
const DEF_TIPS = [

];

/* ---------- Globaler Zustand ---------- */
let D;                       // Wiki-Daten (data.json): Programme, Setups, Tipps, Bookmap …
let B;                       // Basis-URL des Bilderordners
let J = { trades: [], lastSync: 0 };   // Journal (journal.json)
let page = 'start';          // aktuelle Seite
let sid = null;              // geöffnetes Setup (ID)
let tid = null;              // geöffneter Trade (ID)
let edit = false;            // Bearbeiten- oder Lesemodus
let fresh = false;           // true = Detailfenster mit Einblend-Animation öffnen
let hasKeys = false;         // API-Schlüssel gespeichert?
let busy = false;            // Synchronisation läuft

let JF = { mode: 'all', off: 0, from: '', to: '' };      // Zeitfilter Journal
let AF = { mode: 'month', off: 0, from: '', to: '' };    // Zeitfilter Analyse

let CC = {};                 // Kerzen-Cache  (Trade-ID:Intervall → Daten)
let CIV = {};                // gewähltes Chart-Intervall pro Trade
let AP = new Set();          // Trades mit noch nicht gespeicherter Analyse
let AT = {};                 // Speicher-Timer pro Trade
let pick = null;             // 'sl' | 'tp' | null – Preis per Klick im Chart setzen
let CH = null;               // aktuelles Chart-Objekt

/* ---------- Helfer ---------- */
const $ = s => document.querySelector(s);

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const save = () => api.save(D);
const getP = p => p.split('.').reduce((o, k) => o[k], D);   // "setups.0.title" → D.setups[0].title

function setP(p, v) {
  const k = p.split('.');
  let o = D;
  while (k.length > 1) o = o[k.shift()];
  o[k[0]] = v;
  save();
}

let toastT;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), Math.max(2600, String(m).length * 65));
}
