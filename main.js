
///
// Hauptprozess (main.js): Steuert die Anwendungslogik und initialisiert das Programm.
///
const { app, BrowserWindow, ipcMain, shell, screen, Menu, dialog, safeStorage, clipboard, nativeImage } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const bitunix = require('./bitunix');

// ---------- Single instance (zwei Fenster würden sich gegenseitig die Daten überschreiben) ----------
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
let mainWin = null;
app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });

// ---------- Pfade ----------
const baseDir = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath))
  : __dirname;
const dir = path.join(baseDir, app.isPackaged ? 'TradeWiki-Data' : 'data');
const legacyDir = path.join(app.getPath('documents'), 'TradeWiki'); // alter Speicherort

fs.mkdirSync(dir, { recursive: true });
try {
  if (!fs.existsSync(path.join(dir, 'data.json')) && fs.existsSync(path.join(legacyDir, 'data.json'))) {
    fs.cpSync(legacyDir, dir, { recursive: true, force: false });
  }
} catch (err) { console.error('Migration fehlgeschlagen:', err); }

const img = path.join(dir, 'images');
const backups = path.join(dir, 'backups');
const db = path.join(dir, 'data.json');
const jf = path.join(dir, 'journal.json');   
const secF = path.join(dir, 'secrets.bin');  
const wf = path.join(dir, 'window.json');
fs.mkdirSync(img, { recursive: true });
fs.mkdirSync(backups, { recursive: true });

// ---------- Seed-Bild ----------
const seedSrc = path.join(__dirname, 'seed-vwap-short.jpg'), seedDst = path.join(img, 'seed-vwap-short.jpg');
try { if (fs.existsSync(seedSrc) && (!fs.existsSync(seedDst) || fs.statSync(seedDst).size !== fs.statSync(seedSrc).size)) fs.copyFileSync(seedSrc, seedDst); } catch {}

// ---------- Sichere Datenhaltung ----------
const readJson = f => { const t = fs.readFileSync(f, 'utf8'); if (!t.trim()) throw new Error('empty'); return JSON.parse(t); };
const isValid = f => { try { const d = readJson(f); return d && typeof d === 'object'; } catch { return false; } };
const today = () => new Date().toISOString().slice(0, 10);

try {
  const first = path.join(backups, 'data-vor-update.json');
  if (fs.existsSync(db) && !fs.existsSync(first)) fs.copyFileSync(db, first);
} catch {}

const prevOf = f => f.replace(/\.json$/, '.prev.json');

// Mach Dailybackup der Daten max 30 days
function dailyBackup() {
  for (const file of [db, jf]) {
    try {
      if (!fs.existsSync(file) || !isValid(file)) continue;
      const base = path.basename(file, '.json');
      const f = path.join(backups, `${base}-${today()}.json`);
      if (!fs.existsSync(f)) fs.copyFileSync(file, f);
      const re = new RegExp(`^${base}-\\d{4}-\\d{2}-\\d{2}\\.json$`);
      fs.readdirSync(backups).filter(n => re.test(n)).sort().reverse().slice(30).forEach(n => fs.rmSync(path.join(backups, n), { force: true }));
    } catch {}
  }
}
// Liest eine datei fehlerfrei ein 
function safeRead(file) {
  const prev = prevOf(file), base = path.basename(file, '.json');
  if (!fs.existsSync(file) && !fs.existsSync(prev)) return { data: null, recovered: null };
  if (fs.existsSync(file)) {
    try { return { data: readJson(file), recovered: null }; }
    catch {
      try { fs.renameSync(file, path.join(dir, `${base}.corrupt-${Date.now()}.json`)); } catch {}
    }
  }
  //Fallback auf .prev oder die letzten tages-backup
  const re = new RegExp(`^${base}-\\d{4}-\\d{2}-\\d{2}\\.json$`);
  const daily = fs.readdirSync(backups).filter(n => re.test(n)).sort().reverse().map(n => path.join(backups, n));
  for (const c of [prev, ...daily, path.join(backups, `${base}-vor-update.json`)]) {
    if (fs.existsSync(c) && isValid(c)) return { data: readJson(c), recovered: path.basename(c) };
  }
  return { data: null, recovered: 'FAILED' };
}

// Schreibt Daten atomar in eine JSON-Datei (mittels temporärer Datei + Umbenennung) für abrupte  Abbruch  
function safeWrite(file, d) {
  if (!d || typeof d !== 'object') throw new Error('Ungültige Daten – Speichern abgebrochen');
  const json = JSON.stringify(d, null, 2);
  JSON.parse(json);  //Self Test
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, json); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (fs.existsSync(file) && isValid(file)) { try { fs.copyFileSync(file, prevOf(file)); } catch {} }
  fs.renameSync(tmp, file);
  return true;
}
// IPC-Schnittstellen für das Laden und Speichern der Hauptdaten
ipcMain.handle('load', () => {
  const r = safeRead(db);
  dailyBackup();
  return { data: r.data, recovered: r.recovered, imgBase: require('url').pathToFileURL(img).href + '/' };
});
ipcMain.handle('save', (e, d) => safeWrite(db, d));

// ---------- Trading Journal  und Api Handler----------
const emptyJ = () => ({ version: 1, trades: [], deleted: [], lastSync: 0 });
const loadJournal = () => Object.assign(emptyJ(), safeRead(jf).data || {});
const pubJ = J => ({ trades: J.trades, lastSync: J.lastSync });
const num = x => Math.abs(x || 0);

// --- Verschlüsselte API-Key Verwaltung ---
function getKeys() {
  try {
    if (!fs.existsSync(secF) || !safeStorage.isEncryptionAvailable()) return null;
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(secF)));
  } catch { return null; }
}
ipcMain.handle('keys:has', () => !!getKeys());
ipcMain.handle('keys:set', (e, key, secret) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows-Verschlüsselung nicht verfügbar');
  if (!key || !secret) throw new Error('Key und Secret nötig');
  fs.writeFileSync(secF, safeStorage.encryptString(JSON.stringify({ key: key.trim(), secret: secret.trim() })));
  return true;
});
ipcMain.handle('keys:clear', () => { fs.rmSync(secF, { force: true }); return true; });

// --- Journal Kernfunktionen & Bitunix Synchronisation ---
ipcMain.handle('journal:load', () => pubJ(loadJournal()));

ipcMain.handle('journal:delete', (e, id) => {
  const J = loadJournal(), t = J.trades.find(x => x.id === id);
  if (t) {
    if (t.bitunix_position_id) J.deleted.push(t.bitunix_position_id);
    J.trades = J.trades.filter(x => x.id !== id);
    safeWrite(jf, J);
  }
  return pubJ(J);
});


//Synchronisiert Trades mit der Bitunix-Börsen-API (unterstützt von Full-Sync, Inkretionen und manuellen Zeitraum)
ipcMain.handle('journal:sync', async (e, opts) => {
  const k = getKeys();
  if (!k) return { success: false, message: 'Bitte zuerst API-Key und Secret eintragen.' };
  const J0 = loadJournal();
  const first = !J0.trades.some(t => t.bitunix_position_id);
  const DAY = 86400000;
  const manual = opts && +opts.days > 0 ? Math.min(1095, Math.floor(+opts.days)) : 0;
  const daysBack = manual || (first ? 90 : Math.min(90, Math.max(7, Math.ceil((Date.now() - (J0.lastSync || 0)) / DAY) + 1)));
  const syncType = manual ? `VERLAUF LADEN (${daysBack} Tage)` : first ? 'FULL SYNC (Erste Synchronisation)' : 'INCREMENTAL SYNC (Update)';

  const r = await bitunix.fetchAndImportPositions(k.key, k.secret, daysBack);
  if (!r.success) return { success: false, message: r.message };
  const J = loadJournal();

  let imported = 0, skipped = 0;
  let nextId = Math.max(0, ...J.trades.map(t => t.id)) + 1;
  for (const t of r.trades) {
    const pid = t.bitunix_position_id;
    if (pid && J.deleted.includes(pid)) { skipped++; continue; }
    const ex = pid && J.trades.find(x => x.bitunix_position_id === pid);
    if (ex) {
      if (num(ex.pnl - t.pnl) > 0.0001 || num(ex.exit_price - t.exit_price) > 0.0001 || num(ex.quantity - t.quantity) > 0.0001) {
        Object.assign(ex, { exit_price: t.exit_price, exit_time: t.exit_time, quantity: t.quantity, pnl: t.pnl, result: t.result,
          bitunix_fee: t.bitunix_fee, bitunix_funding: t.bitunix_funding, bitunix_realized_pnl: t.bitunix_realized_pnl });
        imported++;
      } else skipped++;
      continue;
    }
    if (J.trades.some(x => x.symbol === t.symbol && x.entry_time === t.entry_time && x.exit_time === t.exit_time &&
        x.entry_price === t.entry_price && x.exit_price === t.exit_price && x.quantity === t.quantity)) { skipped++; continue; }
    J.trades.push({ id: nextId++, ...t, created_at: new Date().toISOString() });
    imported++;
  }
  J.lastSync = Date.now();
  safeWrite(jf, J);

  const oldest = r.trades.length ? r.trades.map(t => t.entry_time).sort()[0].slice(0, 10) : null;
  const tail = manual && oldest ? ` · Älteste Position von Bitunix: ${oldest}` : '';
  const msg = imported > 0
    ? `✅ ${syncType}: ${imported} neue Trades importiert!${skipped ? ` (${skipped} Duplikate übersprungen)` : ''}${tail}`
    : `ℹ️ ${syncType}: Keine neuen Trades gefunden. Alle aktuell!${tail}`;
  return { success: true, message: msg, journal: pubJ(J) };
});

ipcMain.handle('clip:text', (e, t) => { clipboard.writeText(String(t == null ? '' : t)); return true; });
ipcMain.handle('clip:image', (e, d) => { const img = nativeImage.createFromDataURL(String(d)); if (img.isEmpty()) return false; clipboard.writeImage(img); return true; });


// --- Trade-Analysen & Chart-Daten ---
//  Speichert benutzerdefinierte Analysen, Notizen und Zeichnungen (Setups, Lines, VWAP etc.) zu einem Trade.
//
ipcMain.handle('journal:analysis', (e, id, a) => {
  const J = loadJournal(), t = J.trades.find(x => x.id === id);
  if (!t || !a || typeof a !== 'object') return false;
  const S = v => String(v == null ? '' : v).slice(0, 20000);
  const N = x => (typeof x === 'number' && isFinite(x)) ? x : undefined;
  const V = v => {   // gespeicherte Chart-Ansicht: { h, '<intervall>': { l, r, pmin, pmax } }
    if (!v || typeof v !== 'object') return undefined;
    const out = {};
    if (N(v.h) !== undefined) out.h = Math.min(1200, Math.max(150, v.h));
    for (const k of Object.keys(v)) {
      if (k === 'h' || !/^[0-9a-z]{1,4}$/i.test(k) || !v[k] || typeof v[k] !== 'object') continue;
      const o = {}; for (const f of ['l', 'r', 'pmin', 'pmax']) if (N(v[k][f]) !== undefined) o[f] = v[k][f];
      if (Object.keys(o).length) out[k] = o;
    }
    return Object.keys(out).length ? out : undefined;
  };
  t.analysis = { setupId: S(a.setupId), plan: ['ja', 'nein'].includes(a.plan) ? a.plan : '', note: S(a.note), diff: S(a.diff), sl: S(a.sl), tp: S(a.tp), view: V(a.view),
    images: Array.isArray(a.images) ? a.images.filter(n => typeof n === 'string' && /^[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(n)).slice(0, 12) : [],
    draws: Array.isArray(a.draws) ? a.draws.slice(0, 80).map(d => {
      if (!d || !['box', 'line', 'vp', 'vwap', 'path'].includes(d.k)) return null;
      const o = { k: d.k, id: S(d.id).slice(0, 16) };
      for (const f of ['t1', 'p1', 't2', 'p2']) if (N(d[f]) !== undefined) o[f] = d[f];
      if (d.k === 'path') {
        o.pts = Array.isArray(d.pts)
          ? d.pts.slice(0, 60).map(q => q && N(q.t) !== undefined && N(q.p) !== undefined ? { t: q.t, p: q.p } : null).filter(Boolean)
          : [];
        if (o.pts.length < 2) return null;
      }
      return o;
    }).filter(Boolean) : [] };
  safeWrite(jf, J);
  return true;
});
// Candlesticks zu einem höheren Zeitfenster zusammen
const IV = { '1m': 60e3, '2m': 120e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '6h': 21600e3, '8h': 28800e3, '12h': 43200e3, '1d': 86400e3 };
function mergeCandles(c, step) {
  const out = [];
  for (const k of c) {
    const b = Math.floor(k.t / step) * step, l = out[out.length - 1];
    if (l && l.t === b) { l.h = Math.max(l.h, k.h); l.l = Math.min(l.l, k.l); l.c = k.c; l.v += k.v || 0; }
    else out.push({ t: b, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v || 0 });
  }
  return out;
}
//Lädt historische Kerzendaten (Klines) stückweise von der Bitunix-API
async function loadCandles(symbol, iv, start, end) {
  const derived = iv === '2m', base = derived ? '1m' : iv, win = 190 * IV[base], raw = [];
  for (let s0 = start; s0 < end; s0 += win) {
    const r = await bitunix.getKline({ symbol, interval: base, startTime: s0, endTime: Math.min(end, s0 + win), limit: 200 });
    if (r.code !== 0) return { error: r.msg || 'Kerzen nicht abrufbar' };
    raw.push(...(r.data || []));
  }
  const seen = new Set();
  let candles = raw.map(c => ({ t: Number(c.time), o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +(c.baseVol || 0) || 0 }))
    .filter(c => isFinite(c.t) && isFinite(c.o) && isFinite(c.h) && isFinite(c.l) && isFinite(c.c) && !seen.has(c.t) && seen.add(c.t))
    .sort((a, b) => a.t - b.t);
  if (derived) candles = mergeCandles(candles, IV['2m']);
  return { candles };
}
const tsOf = str => new Date(String(str).replace(' ', 'T')).getTime();
ipcMain.handle('journal:candles', async (e, id, want) => {
  const t = loadJournal().trades.find(x => x.id === id);
  if (!t) return { error: 'Trade nicht gefunden' };
  const entry = tsOf(t.entry_time), exit = Math.max(tsOf(t.exit_time), entry);
  if (!isFinite(entry)) return { error: 'Ungültige Zeit am Trade' };
  const D = Math.max(exit - entry, 60e3);
  const avail = Object.keys(IV).filter(k => D / IV[k] <= 120);      // sollte passt alles in 200 Kerzen
  let iv = avail.includes(want) ? want : (avail.includes('2m') ? '2m' : (avail.find(k => D / IV[k] <= 40) || avail[avail.length - 1] || '1d'));
  const step = IV[iv];
  let start = entry - 40 * step, end = exit + 40 * step;
  if ((end - start) / step > 199) start = end - 199 * step;
  const cdir = path.join(dir, 'candles'), cf = path.join(cdir, `t${id}-${iv}.json`);
  try { if (fs.existsSync(cf)) { const c = readJson(cf); if (c.candles && c.candles.length && c.candles[0].v !== undefined) return { ...c, avail, iv, entry, exit }; } } catch {}
  const lc = await loadCandles(t.symbol, iv, start, end);
  if (lc.error) return { error: lc.error };
  const candles = lc.candles;
  if (!candles.length) return { error: 'Bitunix liefert für diesen Zeitraum keine Kerzen' };
  try { fs.mkdirSync(cdir, { recursive: true }); fs.writeFileSync(cf, JSON.stringify({ candles })); } catch {}
  return { candles, avail, iv, entry, exit };
});

// --- System-Tools (Backup, Bilder, PDF-Export, Externe Links) ---
ipcMain.handle('backup:create', async () => {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Wohin soll das Backup?', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const dest = path.join(r.filePaths[0], `TradeWiki-Backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of [db, jf]) if (fs.existsSync(f) && isValid(f)) fs.copyFileSync(f, path.join(dest, path.basename(f)));
  if (fs.existsSync(img)) fs.cpSync(img, path.join(dest, 'images'), { recursive: true });
  shell.showItemInFolder(dest);
  return dest;
});
ipcMain.handle('backup:open', () => shell.openPath(dir));

// Speichert Base64-Bilder als Datei ab (mit Zeitstempel & Hash)
ipcMain.handle('img', (e, url) => {
  const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.*)$/.exec(url); if (!m) return null;
  const ext = m[1].startsWith('jp') ? 'jpg' : m[1];
  const n = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(img, n), Buffer.from(m[2], 'base64')); return n;
});

// Generiert PDF aus HTML via BrowserWindows
ipcMain.handle('pdf', async (e, html, name) => {
  const r = await dialog.showSaveDialog({ defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return null;
  const tmp = path.join(dir, 'export-tmp.html'); fs.writeFileSync(tmp, html);
  const w = new BrowserWindow({ show: false });
  try {
    await w.loadFile(tmp); await new Promise(x => setTimeout(x, 400));
    fs.writeFileSync(r.filePath, await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }));
  } finally { w.destroy(); fs.rmSync(tmp, { force: true }); }
  shell.showItemInFolder(r.filePath); return r.filePath;
});

ipcMain.handle('launch', async (e, list) => {
  const errs = [];
  for (const t of list) {
    if (/^https?:/i.test(t)) await shell.openExternal(t);
    else { const r = await shell.openPath(t); if (r) errs.push(path.basename(t)); }
  }
  return errs;
});

// ---------- Fenster und LifeCycle ----------
/**
 * Lädt die gespeicherten Fenster-Koordinaten und prüft
 * Check ob dass das Fenster auf einem nicht mehr existierenden Zweitmonitor ist
 */
function loadWin() {
  try {
    const b = JSON.parse(fs.readFileSync(wf, 'utf8'));
    const ok = screen.getAllDisplays().some(d => { const a = d.workArea; return b.x >= a.x - 50 && b.y >= a.y - 50 && b.x < a.x + a.width - 100 && b.y < a.y + a.height - 100; });
    return ok ? b : null;
  } catch { return null; }
}

// Wird ausgeführt wenn Electron bereit ist 
app.whenReady().then(() => {
  const S = loadWin(), st = S ? { x: S.x, y: S.y, width: S.width, height: S.height } : { width: 820, height: 950 };
  //windwos fenster wird erstellt
  const w = new BrowserWindow({
    ...st, minWidth: 600, backgroundColor: '#0b0d12', titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0d12', symbolColor: '#e8ecf4', height: 52 },
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: { spellcheck: true, preload: path.join(__dirname, 'preload.js') }
  });
  mainWin = w;
  w.setMenu(null); 

  //Rechtschreibungsprüfung für En und DE
  const ses = w.webContents.session, av = ses.availableSpellCheckerLanguages;
  const de = ['de-DE', 'de'].find(l => av.includes(l)), en = av.includes('en-US') ? 'en-US' : null;
  ses.setSpellCheckerLanguages([de, en].filter(Boolean));

  // Rechtschreibungsprüfung und Zwischen ablage funktion 
  w.webContents.on('context-menu', (e, p) => {
    const it = p.dictionarySuggestions.map(s => ({ label: s, click: () => w.webContents.replaceMisspelling(s) }));
    if (p.misspelledWord) it.push({ label: 'Zum Wörterbuch hinzufügen', click: () => ses.addWordToSpellCheckerDictionary(p.misspelledWord) });
    if (it.length) it.push({ type: 'separator' });
    if (p.isEditable) it.push({ role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' });
    else if (p.selectionText) it.push({ role: 'copy', label: 'Kopieren' });
    if (it.length) Menu.buildFromTemplate(it).popup();
  });
  //Fenster Größe regulieren
  if (S && S.max) w.maximize();
  w.on('close', () => { try { fs.writeFileSync(wf, JSON.stringify({ ...w.getNormalBounds(), max: w.isMaximized() })); } catch {} });
  w.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());