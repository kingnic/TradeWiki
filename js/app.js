/* ==========================================================================
   app.js – Rendern, Navigation, Aktionen (Klicks), Events, Start
   ========================================================================== */

/* ---------- Navigation: Tabs, bei Platzmangel Burger-Menü ---------- */
function fitNav() {
  const nav = $('nav');
  if (!nav) return;
  const tabs = [...nav.querySelectorAll('a[data-go]')];
  const bg = nav.querySelector('.burger');
  const ms = [...document.querySelectorAll('#nm a')];
  const cs = getComputedStyle(nav);
  const avail = nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const gap = parseFloat(cs.columnGap) || 0;

  // benötigte Breite aller sichtbaren Elemente
  const need = () => {
    const k = [...nav.children].filter(c => getComputedStyle(c).display != 'none');
    return k.filter(c => !c.classList.contains('sp')).reduce((a, c) => {
      const m = getComputedStyle(c);
      return a + c.offsetWidth + parseFloat(m.marginLeft) + parseFloat(m.marginRight);
    }, 0) + gap * (k.length - 1);
  };

  tabs.forEach(a => a.classList.remove('hide'));
  ms.forEach(a => a.classList.add('hide'));
  bg.classList.remove('vis');

  // von hinten Tabs ins Burger-Menü schieben
  let i = tabs.length;
  while (need() > avail - 8 && i > 0) {
    bg.classList.add('vis');
    i--;
    tabs[i].classList.add('hide');
    ms[i].classList.remove('hide');
  }
  bg.classList.toggle('act', tabs.some(a => a.classList.contains('hide') && a.dataset.go == page));
  const nm = $('#nm');
  if (nm) nm.classList.add('hide');
}
addEventListener('resize', fitNav);

/* ---------- Alles neu zeichnen ---------- */
function render() {
  const y = scrollY;
  const m = $('.modal');
  const my = m ? m.scrollTop : 0;
  const open = page == 'setups' && sid && D.setups.some(s => s.id == sid);
  const tOpen = page == 'journal' && tid && J.trades.some(t => t.id == tid);
  const tabLinks = TABS.map(([k, l]) => `<a data-go="${k}" class="${page == k ? 'on' : ''}">${l}</a>`).join('');

  $('#app').innerHTML =
    `<nav><b class="brand">◢ TRADE WIKI</b>${tabLinks}<button class="pill burger" data-act="menu" title="Menü">☰</button><span class="sp"></span><button class="pill ${edit ? 'on' : ''}" data-act="mode">${edit ? '✎ Bearbeiten' : '👁 Lesen'}</button></nav>` +
    `<div class="navmenu hide" id="nm">${tabLinks}</div>` +
    `<main><section class="page">${V[page]()}</section></main>` +
    (open ? `<div class="ov ${fresh ? 'fresh' : ''}"><div class="modal">${V.setup()}</div></div>` : '') +
    (tOpen ? `<div class="ov ${fresh ? 'fresh' : ''}"><div class="modal">${V.trade()}</div></div>` : '');

  fitNav();
  initChart();
  fresh = false;
  scrollTo(0, y);
  const n = $('.modal');
  if (n) n.scrollTop = my;
}

/* (neuer Tag) */
const resetDay = () => {
  D.groups.forEach(g => g.items.forEach(i => i.d = false));
  D.feel = '';
};

/* Bilder speichern und anhängen */
async function addTImg(url) {                
  const t = J.trades.find(x => x.id == tid);
  if (!t) return;
  const n = await api.img(url);
  if (n) {
    const a = anl(t);
    (a.images = a.images || []).push(n);
    persistA(t);
    render();
  }
}
async function addImg(key, url) {             // Bild zu Setup / Bookmap
  const n = await api.img(url);
  if (n) { getP(key).push(n); save(); render(); }
}

//Aktionen – werden über data-act="…" in den Vorlagen aufgerufen
const acts = {
  mode() { edit = !edit; render(); },

  /* --- Tipps --- */
  pin(d) { const it = D.tips[d.a].items[d.b]; it.pin = !it.pin; save(); render(); },
  addTip(d) { D.tips[d.a].items.push({ t: '', pin: false }); save(); render(); },
  delTip(d) { D.tips[d.a].items.splice(d.b, 1); save(); render(); },
  addTipGroup() { D.tips.push({ i: '💡', t: 'Neue Kategorie', items: [] }); save(); render(); },
  delTipGroup(d) { if (confirm('Kategorie samt allen Tipps löschen?')) { D.tips.splice(d.a, 1); save(); render(); } },

  // --- Start --- 
  async launch() {
    const l = D.programs.map(p => p.t.trim().replace(/^"|"$/g, '')).filter(Boolean);
    if (!l.length) return toast('Erst Pfade eintragen (Bearbeiten-Modus)');
    const e = await api.launch(l);
    toast(e.length ? 'Nicht gefunden: ' + e.join(', ') : 'Gestartet ✓');
  },
  reset() { resetDay(); save(); render(); },
  addItem(d) { D.groups[d.a].items.push({ t: 'Neuer Punkt', d: false }); save(); render(); },
  delItem(d) { D.groups[d.a].items.splice(d.b, 1); save(); render(); },

  // --- Setups --- 
  addSetup() {
    const id = Date.now();
    D.setups.push({ id, title: '', sum: '', rein: '', raus: '', achten: '', best: '', images: [], cover: '' });
    sid = id; fresh = true; save(); render();
  },
  delSetup(d) {
    const id = d.id || sid;
    if (confirm('Setup löschen?')) { D.setups = D.setups.filter(s => s.id != id); sid = null; save(); render(); }
  },
  delImg(d) {
    const a = getP(d.k), n = a.splice(d.a, 1)[0], s = D.setups.find(x => x.id == sid);
    if (s && s.cover === n) s.cover = '';
    save(); render();
  },
  cover(d) { const s = D.setups.find(x => x.id == sid); s.cover = s.images[d.a]; save(); render(); },
  close() { sid = null; tid = null; render(); },
  exportOne() { const s = D.setups.find(x => x.id == sid); if (s) pdf([s], s.title || 'Setup'); },
  exportAll() { if (!D.setups.length) return toast('Noch keine Setups'); pdf(D.setups, 'Setups', true); },

  // --- Burger-Menü --- 
  menu() {
    const nm = $('#nm'), b = $('.burger');
    if (!nm.classList.contains('hide')) { nm.classList.add('hide'); return; }
    nm.classList.remove('hide');
    nm.style.left = Math.max(8, Math.min(b.getBoundingClientRect().left, innerWidth - nm.offsetWidth - 8)) + 'px';
  },

  // --- Zeitfilter (j = Journal, a = Analyse) --- 
  jmode(d) { JF.mode = d.m; JF.off = 0; render(); },
  joff(d) { JF.off = Math.min(0, JF.off + +d.a); render(); },
  amode(d) { AF.mode = d.m; AF.off = 0; render(); },
  aoff(d) { AF.off = Math.min(0, AF.off + +d.a); render(); },

  // --- Journal: Synchronisieren & Verlauf ---
  async sync() {
    if (busy) return;
    if (!hasKeys) { page = 'settings'; render(); return toast('Erst hier den API-Key eintragen'); }
    busy = true;
    toast('Synchronisiere …');
    try {
      const r = await api.jSync();
      if (r.journal) J = r.journal;
      toast(r.message);
    } catch (e) { toast('Fehler: ' + (e.message || e)); }
    busy = false;
    render();
  },
  async hist() {
    if (busy) return;
    if (!hasKeys) return toast('Erst den API-Key eintragen');
    busy = true;
    toast('Lade Verlauf …');
    try {
      const r = await api.jSync({ days: +$('#hd').value });
      if (r.journal) J = r.journal;
      toast(r.message);
    } catch (e) { toast('Fehler: ' + (e.message || e)); }
    busy = false;
    render();
  },

  // --- Einstellungen --- 
  async saveKeys() {
    const k = $('#bk').value.trim(), v = $('#bs').value.trim();
    if (!k || !v) return toast('Key und Secret eintragen');
    try { await api.keysSet(k, v); hasKeys = true; toast('Gespeichert ✓'); }
    catch (e) { toast('Speichern nicht möglich: ' + (e.message || e)); }
    render();
  },
  async clearKeys() {
    if (confirm('Gespeicherte Schlüssel entfernen?')) { await api.keysClear(); hasKeys = false; render(); }
  },
  async backup() {
    try { const p = await api.backupCreate(); if (p) toast('Backup erstellt ✓'); }
    catch (e) { toast('Backup fehlgeschlagen: ' + (e.message || e)); }
  },
  openData() { api.backupOpen(); },

  // --- Trade-Fenster --- 
  plan(d) {
    const t = J.trades.find(x => x.id == tid);
    if (!t) return;
    const a = anl(t);
    a.plan = a.plan == d.v ? '' : d.v;
    persistA(t);
    render();
  },
  pick(d) {
    if (CH && CH.cancelTool) CH.cancelTool();
    pick = pick == d.k ? null : d.k;
    document.querySelectorAll('[data-act="pick"]').forEach(b => b.classList.toggle('on', b.dataset.k == pick));
    if (pick) toast('Jetzt im Chart auf den ' + (pick == 'sl' ? 'Stop-Loss' : 'Take-Profit') + '-Preis klicken');
  },
  iv(d) { CIV[tid] = d.v; D.chartIv = d.v; save(); initChart(); },
  viewReset() { if (CH) CH.resetView(); },
  async delTrade(d) {
    const id = d.id || tid;
    if (confirm('Trade löschen? (Beim nächsten Sync kommt er nicht zurück.)')) {
      J = await api.jDelete(+id);
      tid = null;
      render();
    }
  },
  tImgDel(d) {
    const t = J.trades.find(x => x.id == tid);
    if (!t) return;
    anl(t).images.splice(+d.a, 1);
    persistA(t);
    render();
  },
  exportTrade
};

//     ---- Events

// Rechtsklick-Menü im Chart schließen 
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.ctxm')) document.querySelectorAll('.ctxm').forEach(x => x.remove());
}, true);
document.addEventListener('keydown', e => {
  if (e.key == 'Escape' && document.querySelector('.ctxm')) {
    document.querySelectorAll('.ctxm').forEach(x => x.remove());
    e.stopImmediatePropagation();
  }
}, true);
addEventListener('blur', () => document.querySelectorAll('.ctxm').forEach(x => x.remove()));

// Wo wurde die Maustaste gedrückt? 
let downT = null;
document.addEventListener('mousedown', e => { downT = e.target; }, true);

// Alle Klicks: Navigation, Kacheln, Aktionen, Bild-Zoom 
document.addEventListener('click', e => {
  const nm = $('#nm');
  if (nm && !e.target.closest('.burger,.navmenu')) nm.classList.add('hide');

  //  schließt das Detailfenster beim klick auf hintergrund
  if (e.target.classList.contains('ov')) {
    if (downT === e.target) { sid = null; tid = null; render(); }
    return;
  }

  const t = e.target.closest('[data-go],[data-open],[data-trade],[data-act],[data-zoom]');
  if (!t) return;
  const d = t.dataset;
  if (d.go) { page = d.go; sid = null; tid = null; render(); }
  else if (d.open) { sid = +d.open; fresh = true; render(); }
  else if (d.trade) { tid = +d.trade; fresh = true; render(); }
  else if ('zoom' in d) openZoom(t.src);
  else acts[d.act]?.(d);
});

//  Wiki-Felder (data-p) werden sofort gespeichert 
document.addEventListener('input', e => {
  const p = e.target.dataset.p;
  if (p) setP(p, e.target.type == 'checkbox' ? e.target.checked : e.target.value);
});

// Eingaben im Trade-Fenster (data-ja): Analyse-Felder 
document.addEventListener('input', e => {
  const k = e.target.dataset.ja;
  if (!k) return;
  const t = J.trades.find(x => x.id == tid);
  if (!t) return;
  anl(t)[k] = e.target.value;
  persistA(t);
  if (k == 'sl' || k == 'tp') {
    if (CH) CH.drawLv();
    const r = $('#rr');
    if (r) r.textContent = rrText(t);
  }
});

// Änderungen: Datumsfelder, Dateiauswahl für Bilder 
document.addEventListener('change', e => {
  const ak = e.target.dataset.af;
  if (ak) { AF[ak] = e.target.value; render(); return; }
  const jk = e.target.dataset.jf;
  if (jk) { JF[jk] = e.target.value; render(); return; }

  if (e.target.dataset.tfile && e.target.files[0]) {       // Bild zum Trade
    const r = new FileReader();
    r.onload = () => addTImg(r.result);
    r.readAsDataURL(e.target.files[0]);
    e.target.value = '';
    return;
  }
  const k = e.target.dataset.file;                         // Bild zu Setup / Bookmap oder NQ
  if (!k || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => addImg(k, r.result);
  r.readAsDataURL(e.target.files[0]);
});

/* Strg+V: Bild aus der Zwischenablage einfügen */
document.addEventListener('paste', e => {
  const first = () => [...e.clipboardData.items].find(x => x.type.startsWith('image/'));

  if (page == 'journal' && tid) {                          
    const f = first();
    if (!f) return;
    const r = new FileReader();
    r.onload = () => addTImg(r.result);
    r.readAsDataURL(f.getAsFile());
    return;
  }
  if (!edit) return;
  const key = page == 'setups' && sid
    ? `setups.${D.setups.findIndex(s => s.id == sid)}.${(document.activeElement.dataset.p || '').endsWith('.bsp') ? 'bimages' : 'images'}`
    : page == 'bookmap' ? 'bookmap.images' : null;
  if (!key) return;
  const f = first();
  if (!f) return;
  const r = new FileReader();
  r.onload = () => addImg(key, r.result);
  r.readAsDataURL(f.getAsFile());
});

/* Esc: Zoom oder Detailfenster schließen */
document.addEventListener('keydown', e => {
  if (e.key != 'Escape') return;
  const z = $('.zoom');
  if (z) z.remove();
  else if (sid || tid) { sid = null; tid = null; render(); }
});

//   ---------- Start
(async () => {
  const r = await api.load();
  B = r.imgBase;
  J = await api.jLoad();
  hasKeys = await api.keysHas();

  if (r.recovered) {
    setTimeout(() => toast(r.recovered == 'FAILED'
      ? 'Daten nicht lesbar – bitte Ordner backups prüfen!'
      : 'Daten aus Backup wiederhergestellt: ' + r.recovered), 600);
  }

  D = r.data || structuredClone(DEF);
  if (!D.tips) D.tips = structuredClone(DEF_TIPS);
  if (!D.seeded) { D.seeded = true; D.setups.unshift(SEED()); }

  const today = new Date().toDateString();       // neuer Tag → Häkchen zurücksetzen
  if (D.date !== today) { resetDay(); D.date = today; }

  save();
  render();
})();
