// preload alles wichtige (Sichere IPC-Brücke)

const { contextBridge, ipcRenderer: i } = require('electron');
contextBridge.exposeInMainWorld('api', {
  // --- Allgemeine App-Funktionen & Export ---
  load: () => i.invoke('load'),
  save: d => i.invoke('save', d),
  img: u => i.invoke('img', u),
  launch: l => i.invoke('launch', l),
  pdf: (h, n) => i.invoke('pdf', h, n),

  // --- Trading Journal & Analysen ---
  jLoad: () => i.invoke('journal:load'),
  jSync: o => i.invoke('journal:sync', o),
  jDelete: id => i.invoke('journal:delete', id),
  jAnalysis: (id, a) => i.invoke('journal:analysis', id, a),
  jCandles: (id, iv) => i.invoke('journal:candles', id, iv),

  // --- Verschlüsselte API-Key Verwaltung ---
  keysHas: () => i.invoke('keys:has'),
  keysSet: (k, s) => i.invoke('keys:set', k, s),
  keysClear: () => i.invoke('keys:clear'),

  // --- Zwischenablage (Clipboard) ---
  clipText: t => i.invoke('clip:text', t),
  clipImg: d => i.invoke('clip:image', d),

  // --- Backup-System ---
  backupCreate: () => i.invoke('backup:create'),
  backupOpen: () => i.invoke('backup:open')
});