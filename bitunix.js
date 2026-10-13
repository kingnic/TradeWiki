// Port von bitunix_api.py – gleiche Signatur, gleiche Endpunkte, gleiches Mapping.
// BITUNIX API & MAPPING MODULE
const crypto = require('crypto');

const BASE_URL = 'https://fapi.bitunix.com';
const sha256 = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// Step 1: queryParams = Keys ASCII-sortiert, "key"+"value" ohne Trennzeichen
const buildQuery = p => Object.entries(p || {})
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  .map(([k, v]) => `${k}${v}`).join('');

// Step 3: sha256( sha256(nonce+timestamp+apiKey+queryParams+body) + secret )
function sign({ nonce, timestamp, apiKey, secret, queryParams = '', body = '' }) {
  const digest = sha256(`${nonce}${timestamp}${apiKey}${queryParams}${body}`);
  return sha256(`${digest}${secret}`);
}

class BitunixAPI {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = BASE_URL;
  }

  async _makeRequest(endpoint, params) {
    const timestamp = String(Date.now());
    const nonce = String(Date.now() * 1000 + Math.floor(Math.random() * 1000)).slice(0, 32);
    const has = params && Object.keys(params).length > 0;
    const signature = sign({ nonce, timestamp, apiKey: this.apiKey, secret: this.apiSecret, queryParams: has ? buildQuery(params) : '' });
    const headers = {
      'api-key': this.apiKey, sign: signature, nonce, timestamp,
      language: 'en-US', 'Content-Type': 'application/json'
    };
    const url = `${this.baseUrl}${endpoint}${has ? '?' + new URLSearchParams(params).toString() : ''}`;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      if (!res.ok) return { code: -1, msg: `HTTP ${res.status}: ${text.slice(0, 200)}`, data: null };
      return JSON.parse(text);
    } catch (e) {
      return { code: -1, msg: String((e && e.message) || e), data: null };
    }
  }

  getHistoryPositions({ symbol, startTime, endTime, limit = 100, skip = 0 } = {}) {
    const params = {};
    if (symbol) params.symbol = symbol;
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    if (limit) params.limit = limit;
    if (skip) params.skip = skip;
    return this._makeRequest('/api/v1/futures/position/get_history_positions', params);
  }

  getPendingPositions({ symbol, positionId } = {}) {
    const params = {};
    if (symbol) params.symbol = symbol;
    if (positionId) params.positionId = positionId;
    return this._makeRequest('/api/v1/futures/position/get_pending_positions', params);
  }

  getPositionTiers(symbol) {
    return this._makeRequest('/api/v1/futures/position/get_position_tiers', { symbol });
  }
}

// --- Python-kompatibles Parsen (float()/int() werfen bei Müll, fehlende Felder = Default) ---
const pyFloat = v => {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v)) return parseFloat(v);
  throw new Error('float() Fehler: ' + v);
};
const pyInt = v => {
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return parseInt(v, 10);
  throw new Error('int() Fehler: ' + v);
};
const p2 = n => String(n).padStart(2, '0');
const fmtTime = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
const get = (o, k, def) => (o[k] === undefined ? def : o[k]);

function mapBitunixToTrade(position) {
  const entryPrice = pyFloat(get(position, 'entryPrice', 0));
  const closePrice = pyFloat(get(position, 'closePrice', 0));
  const maxQty = pyFloat(get(position, 'maxQty', 0));
  const leverage = pyInt(get(position, 'leverage', 1));
  const realizedPnl = pyFloat(get(position, 'realizedPNL', 0));
  const fee = pyFloat(get(position, 'fee', 0));
  const funding = pyFloat(get(position, 'funding', 0));

  const netPnl = realizedPnl; 
  const result = netPnl > 0 ? 'Win' : 'Loss';
  const sideRaw = String(get(position, 'side', 'BUY')).toUpperCase();
  const bias = (sideRaw === 'BUY' || sideRaw === 'LONG') ? 'Long' : 'Short'; 

  let entryTime, exitTime;
  try {
    const ctime = pyInt(get(position, 'ctime', 0));
    const mtime = pyInt(get(position, 'mtime', 0));
    entryTime = fmtTime(ctime);
    exitTime = fmtTime(mtime);
  } catch {
    entryTime = exitTime = fmtTime(Date.now());
  }

  return {
    symbol: get(position, 'symbol', 'UNKNOWN'),
    market: 'Crypto',
    timeframe: '15',
    bias,
    entry_time: entryTime,
    exit_time: exitTime,
    entry_price: entryPrice,
    exit_price: closePrice,
    quantity: maxQty,
    leverage,
    pnl: netPnl,
    result,
    bitunix_position_id: get(position, 'positionId', ''),
    bitunix_fee: fee,
    bitunix_funding: funding,
    bitunix_realized_pnl: realizedPnl
  };
}

async function fetchAndImportPositions(apiKey, apiSecret, daysBack = 90) {
  if (!apiKey || !apiSecret) return { success: false, message: 'API Key und Secret sind erforderlich!', trades: [] };
  try {
    const client = new BitunixAPI(apiKey, apiSecret);
    const endTime = Date.now();
    const startTime = Math.floor(endTime - daysBack * 24 * 60 * 60 * 1000);
    const PAGE = 100, MAX_PAGES = 30;

    const trades = [];
    let skip = 0, total = Infinity, pages = 0, note = '';
    while (pages < MAX_PAGES) {
      const response = await client.getHistoryPositions({ startTime, endTime, limit: PAGE, skip });
      if (response.code !== 0) {
        if (pages === 0) return { success: false, message: `API Fehler: ${response.msg || 'Unknown error'}`, trades: [] };
        note = ` (Abruf nach ${skip} Positionen gestoppt: ${response.msg || 'Fehler'})`;
        break;
      }
      const positions = (response.data && response.data.positionList) || [];
      total = Number(response.data && response.data.total) || 0;
      if (!positions.length) break;
      for (const position of positions) {
        try { trades.push(mapBitunixToTrade(position)); } catch { /* Position überspringen wie im Original */ }
      }
      pages++;
      skip += positions.length;
      if (positions.length < PAGE || skip >= total) break;
    }
    if (!trades.length) return { success: true, message: `Keine Positionen in den letzten ${daysBack} Tagen gefunden.`, trades: [] };
    return { success: true, message: `${trades.length} Trades erfolgreich geladen!${note}`, trades, total };
  } catch (e) {
    return { success: false, message: `Fehler beim Laden der Daten: ${e.message}`, trades: [] };
  }
}

// Öffentliche Kerzendaten : GET /api/v1/futures/market/kline, max. 200 Kerzen
async function getKline({ symbol, interval, startTime, endTime, limit = 200 }) {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  if (startTime) params.set('startTime', String(startTime));
  if (endTime) params.set('endTime', String(endTime));
  try {
    const res = await fetch(`${BASE_URL}/api/v1/futures/market/kline?${params}`, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    if (!res.ok) return { code: -1, msg: `HTTP ${res.status}: ${text.slice(0, 200)}`, data: null };
    return JSON.parse(text);
  } catch (e) {
    return { code: -1, msg: String((e && e.message) || e), data: null };
  }
}

module.exports = { BitunixAPI, buildQuery, sign, mapBitunixToTrade, fetchAndImportPositions, getKline };
