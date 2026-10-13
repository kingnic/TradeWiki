  /* 
   pdf.js – PDF-Export 
   Das HTML wird an den Hauptprozess geschickt und dort zu PDF gedruckt.
  */

const ICO = { rein: '🎯', raus: '🚪', achten: '👁', best: '✅', bsp: '🧪' };
const LBL = { rein: 'Wann rein', raus: 'Wo raus', achten: 'Worauf achten', best: 'Bestätigung', bsp: 'Beispiel-Trade' };
const COL = { rein: '#00e5b0', raus: '#5ef0ff', achten: '#a58bff', best: '#ff7ad9', bsp: '#ffd166' };

// PDF STYLING & DESIGN (A4 Dark Mode Layout)
const PDFCSS = `
  /* Grundlegendes Seitenformat & A4-Druckoptimierung */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { 
    margin: 0; 
    background: #0b0d12; 
    color: #e8ecf4; 
    font: 10.5pt/1.6 'Segoe UI', sans-serif; 
    -webkit-print-color-adjust: exact; /* Erzwingt den Farbdruck für Hintergründe/Gradients */
  }

  /* Einzelne A4-Seiten Container mit individuellem Farbverlauf */
  .pg { 
    page-break-after: always; 
    padding: 16mm 17mm; 
    min-height: 297mm; 
    background: radial-gradient(90% 35% at 0 0, #7c5cff38, transparent), 
                radial-gradient(80% 30% at 100% 100%, #00e5b024, transparent), 
                #0b0d12; 
  }
  .pg:last-child { page-break-after: auto; }

  /* Typografie & dekorative Elemente */
  small { letter-spacing: .32em; color: #00e5b0; font-size: 8pt; }
  h1 { margin: 2mm 0 0; font-size: 30pt; line-height: 1.1; color: #fff; }
  .bar { height: 1.2mm; width: 100%; margin: 4mm 0 5mm; border-radius: 1mm; background: linear-gradient(90deg, #00e5b0, #5ef0ff, #7c5cff); }
  .d { color: #aab2c6; white-space: pre-wrap; margin-bottom: 5mm; font-size: 11pt; }

  /* Bild-Darstellung im PDF (Verhindert unsaubere Seitenumbrüche mitten im Bild) */
  img { display: block; width: 100%; border-radius: 3mm; border: .3mm solid #2a3150; margin: 3mm 0; break-inside: avoid; }

  /* Sektionen & Boxen mit variablen Akzentfarben (--c) */
  .sec { margin-top: 6mm; padding: 4mm 5.5mm 5mm; border-radius: 3.5mm; background: #ffffff0d; border-left: 1.4mm solid var(--c); break-inside: avoid; }
  .sec.big { break-inside: auto; }
  h3 { margin: 0 0 3mm; padding-bottom: 2mm; border-bottom: .35mm solid var(--c); font-size: 9pt; letter-spacing: .16em; text-transform: uppercase; color: var(--c); }
  h3 span { margin-right: 2.5mm; font-size: 11pt; }

  .t { white-space: pre-wrap; }

  /* Fußzeile */
  .ft { margin-top: 8mm; padding-top: 3mm; border-top: .3mm solid #2a3150; font-size: 7.5pt; letter-spacing: .3em; color: #5d667d; }

  /* Spezielle Layout-Container (z. B. für strukturierte Listen) */
  .cv { display: flex; flex-direction: column; justify-content: center; }
  .cv ol { color: #c9d0e0; line-height: 2.2; font-size: 12pt; }
`;

const pim = n => `<img src="images/${n}">`;

/* ---------- Setups ---------- */
function pdfSec(s, k) {
  const im = k == 'bsp' ? (s.bimages || []).map(pim).join('') : '';
  if (!s[k] && !im) return '';
  return `<div class="sec${k == 'bsp' ? ' big' : ''}" style="--c:${COL[k]}"><h3><span>${ICO[k]}</span>${LBL[k]}</h3>${im}<div class="t">${esc(s[k])}</div></div>`;
}

const pdfPage = s => `<section class="pg"><small>SETUP</small><h1>${esc(s.title || 'Setup')}</h1><div class="bar"></div><div class="d">${esc(s.sum)}</div>${(s.images || []).map(pim).join('')}${['rein', 'raus', 'achten', 'best', 'bsp'].map(k => pdfSec(s, k)).join('')}<div class="ft">◢ TRADE WIKI</div></section>`;

async function pdf(list, name, all) {
  const cover = all
    ? `<section class="pg cv"><small>HANDBUCH</small><h1 style="font-size:38pt">TRADE WIKI</h1><div class="bar"></div><div class="d">Meine Setups · ${new Date().toLocaleDateString('de-DE')}</div><ol>${list.map(s => `<li>${esc(s.title || 'Setup')}</li>`).join('')}</ol></section>`
    : '';
  const html = '<!doctype html><meta charset="utf-8"><style>' + PDFCSS + '</' + 'style>' + cover + list.map(pdfPage).join('');
  const p = await api.pdf(html, 'TradeWiki-' + name.replace(/[^\wÄÖÜäöüß]+/g, '-') + '.pdf');
  if (p) toast('PDF gespeichert ✓');
}

/* ---------- Einzelner Trade mit Chart ---------- */
async function exportTrade() {
  const t = J.trades.find(x => x.id == tid);
  if (!t) return;
  const a = anl(t), sh = t.bias == 'Short';
  const c = CH && CH.shot ? CH.shot() : null;
  const img = c ? `<img src="${c.toDataURL('image/png')}">` : '';
  const su = D.setups.find(x => x.id == a.setupId);
  const sec = (col, h, b) => b ? `<div class="sec" style="--c:${col}"><h3>${h}</h3><div class="t">${b}</div></div>` : '';
  const lv = [a.sl ? 'Stop-Loss: ' + esc(a.sl) : '', a.tp ? 'Take-Profit: ' + esc(a.tp) : '', esc(rrText(t))].filter(Boolean).join('\n');

  const page = `<section class="pg"><small>TRADE</small><h1>${esc(t.symbol)}</h1><div class="bar"></div><div class="d">${sh ? '▼ Short' : '▲ Long'} · ${jpnl(t.pnl)} · ${jdt(t.entry_time)}\nEntry ${esc(t.entry_price)} · Exit ${esc(t.exit_price)}</div>${img}${sec('#a58bff', 'Stop-Loss &amp; Take-Profit', lv)}${(a.images || []).length ? `<div class="sec big" style="--c:#ff7ad9"><h3>Bookmap / NQ</h3>${a.images.map(pim).join('')}</div>` : ''}${sec('#00e5b0', 'Setup', su ? esc(su.title || 'Setup') : '')}${sec('#5ef0ff', 'Plan', a.plan == 'ja' ? '✓ Nach Plan' : a.plan == 'nein' ? '↯ Vom Plan abgewichen' : '')}${sec('#ffd166', 'Notiz', esc(a.note))}${a.plan == 'nein' ? sec('#ff7ad9', 'Abweichung', esc(a.diff)) : ''}<div class="ft">◢ TRADE WIKI</div></section>`;
  const html = '<!doctype html><meta charset="utf-8"><style>' + PDFCSS + '</' + 'style>' + page;
  const p = await api.pdf(html, 'Trade-' + String(t.symbol).replace(/[^\wÄÖÜäöüß]+/g, '-') + '-' + String(t.entry_time).slice(0, 10) + '.pdf');
  if (p) toast('PDF gespeichert ✓');
}
