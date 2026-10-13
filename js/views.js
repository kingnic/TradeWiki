//   views.js – alle Seiten als HTML-Vorlagen

// ---------- Titelbilder  Trade-Kacheln 
const TCOV = (() => {
  const g = (c, id) => `<defs><radialGradient id="${id}" cx="88%" cy="8%" r="85%"><stop offset="0" stop-color="${c}" stop-opacity=".30"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#${id})"/>${[60, 110, 160].map(y => `<line x1="0" x2="320" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".04"/>`).join('')}`;
  const Z = (y, h, c, o = 1) => `<rect x="70" y="${y}" width="230" height="${h}" fill="${c}" fill-opacity="${.16 * o}" stroke="${c}" stroke-opacity="${.55 * o}"/>`;
  const E = (y, o = 1) => `<line x1="70" x2="300" y1="${y}" y2="${y}" stroke="#d7deee" stroke-opacity="${.85 * o}"/>`;
  const P = (d, c, dash) => `<path d="${d}" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"${dash ? ' stroke-dasharray="5 4"' : ''}/>`;
  const D = (x, y, c) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}"/>`;
  return {
    long: id => g('#5ef0ff', id) + Z(62, 70, '#5ef0ff') + Z(132, 28, '#a58bff') + E(132) +
      P('M70 132 L120 118 L150 124 L205 92 L240 98 L286 66', '#5ef0ff') + D(286, 66, '#5ef0ff'),
    short: id => g('#a58bff', id) + Z(54, 28, '#a58bff') + Z(82, 70, '#5ef0ff') + E(82) +
      P('M70 82 L120 96 L150 90 L205 122 L240 116 L286 148', '#a58bff') + D(286, 148, '#a58bff'),
    dev: id => g('#ffd166', id) + Z(62, 70, '#5ef0ff', .45) + Z(132, 28, '#a58bff', .45) + E(132, .5) +
      P('M70 132 L286 66', '#5ef0ff', true) +
      P('M70 132 L112 112 L140 126 L178 150 L214 140 L250 168', '#ffd166') + D(250, 168, '#ffd166') +
      '<text x="258" y="190" font-size="11" font-weight="700" fill="#ffd166" font-family="system-ui,sans-serif" text-anchor="end" letter-spacing=".5">ABWEICHUNG</text>'
  };
})();

const tcov = t => {
  const v = t.analysis && t.analysis.plan == 'nein' ? 'dev' : t.bias == 'Short' ? 'short' : 'long';
  const id = 'g' + t.id;
  return `<div class="cov none tr"><svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">${TCOV[v](id)}<text x="18" y="38" font-size="22" font-weight="700" letter-spacing=".5" fill="#e8ecf4" font-family="system-ui,sans-serif">${esc(t.symbol)}</text></svg></div>`;
};

// ---------- Kleine Bausteine 

// Bilder-Galerie. key = Pfad in D (z. B. "setups.0.images");
const imgs = (key, a) => {
  const s = key.endsWith('.images') && key.startsWith('setups') && D.setups.find(x => x.id == sid);
  const cv = s && (s.cover || s.images[0]);
  return `<div class="gal">${a.map((n, j) => `<div class="im"><img src="${B + n}" data-zoom>${edit ? `${s ? `<button class="st ${n === cv ? 'on' : ''}" data-act="cover" data-a="${j}" title="Titelbild">★</button>` : ''}<button data-act="delImg" data-k="${key}" data-a="${j}">✕</button>` : ''}</div>`).join('')}${edit ? `<label class="im add">＋ Bild<small>oder Strg+V</small><input type="file" accept="image/*" hidden data-file="${key}"></label>` : ''}</div>`;
};

// Fokus-Tipps auf der Startseite 
const focusBlock = () => {
  const p = D.tips.flatMap(g => g.items.filter(i => i.pin));
  return p.length
    ? `<h2>Mein Fokus</h2><div class="sec c5">${p.map(i => `<div class="tip"><span style="flex:none;color:#ffd166">★</span><span>${esc(i.t)}</span></div>`).join('')}</div>`
    : '';
};

// Eine Kennzahl-Kachel der Analyse 
const stat = (label, value, sub = '', c = '', wide = false) =>
  `<div class="stat${wide ? ' wide' : ''}"><small>${label}</small><b class="${c}">${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;

// Zeitfilter-Leiste 
function periodBar(F, R, count, modes, navModes, pre, attr) {
  return `<div class="fl">${modes.map(([m, l]) => `<button class="pill ${F.mode == m ? 'on' : ''}" data-act="${pre}mode" data-m="${m}">${l}</button>`).join('')}</div>
${navModes.includes(F.mode) ? `<div class="fn"><button class="pill" data-act="${pre}off" data-a="-1" title="Zurück">◀</button><b>${R.label}<small>${count}</small></b><button class="pill" data-act="${pre}off" data-a="1" title="Vor" ${F.off >= 0 ? 'disabled' : ''}>▶</button></div>` : ''}
${F.mode == 'range' ? `<div class="row" style="align-items:center"><input type="date" data-${attr}="from" value="${F.from}"><span class="mut">bis</span><input type="date" data-${attr}="to" value="${F.to}"><small class="mut" style="margin-left:6px">${count}</small></div>` : ''}
${F.mode == 'all' ? `<p class="mut" style="margin:10px 0 0">${count}</p>` : ''}`;
}

const plural = n => `${n} Trade${n == 1 ? '' : 's'}`;

// ------ Seiten
const V = {

  // -------- Start  
  start() {
    return `<button class="go" data-act="launch">▶ Alles starten<small>${D.programs.map(p => esc(p.n)).join(' · ')}</small></button>
${edit ? `<div class="card">${D.programs.map((p, i) => `<div class="row"><input data-p="programs.${i}.n" value="${esc(p.n)}"><input class="wide" data-p="programs.${i}.t" placeholder="Pfad zur .exe oder https://…" value="${esc(p.t)}"></div>`).join('')}</div>` : ''}
${focusBlock()}
<h2>Session-Plan</h2>
${D.groups.map((g, gi) => `<h3>${esc(g.t)}</h3>${g.items.map((it, ii) => edit
      ? `<div class="row"><input class="wide" data-p="groups.${gi}.items.${ii}.t" value="${esc(it.t)}"><button class="ghost" data-act="delItem" data-a="${gi}" data-b="${ii}">✕</button></div>`
      : `<label class="chk"><input type="checkbox" data-p="groups.${gi}.items.${ii}.d" ${it.d ? 'checked' : ''}><span>${esc(it.t)}</span></label>`).join('')}${edit ? `<button class="ghost" data-act="addItem" data-a="${gi}">＋ Punkt</button>` : ''}`).join('')}
<h3>Vor dem Start</h3><label class="feel">Wie fühle ich mich? <input data-p="feel" value="${esc(D.feel)}" placeholder="ok, ruhig, müde …"></label>
<button class="ghost" data-act="reset">↺ Neuer Tag – Häkchen zurücksetzen</button>`;
  },

  // --------- Setups: Übersicht  
  setups() {
    const tiles = D.setups.map(s => {
      const c = s.cover || s.images[0] || (s.bimages || [])[0];
      return `<div class="tile" data-open="${s.id}">${edit ? `<button class="tdel" data-act="delSetup" data-id="${s.id}" title="Löschen">🗑</button>` : ''}<div class="cov ${c ? '' : 'none'}" ${c ? `style="background-image:url('${B + c}')"` : ''}></div><div class="tb"><b>${esc(s.title || 'Neues Setup')}</b><p>${esc(s.sum)}</p><span>Details →</span></div></div>`;
    }).join('');
    return `<div class="mh" style="align-items:center"><h1 style="flex:1;margin:0">Setups</h1><button class="pill" data-act="exportAll">⬇ Alle als PDF</button></div><div class="grid" style="margin-top:16px">${tiles}${edit ? `<div class="tile add" data-act="addSetup"><div class="tb"><b>＋ Neues Setup</b></div></div>` : ''}</div>${!D.setups.length ? '<p class="mut">Noch keine Setups. Oben rechts auf „Lesen“ klicken, dann ＋ Neues Setup.</p>' : ''}`;
  },

  // -------- Setup: Detailfenster 
  setup() {
    const i = D.setups.findIndex(s => s.id == sid), s = D.setups[i];
    if (!s) return '';
    s.bimages = s.bimages || [];
    // ein Textabschnitt (k = Feldname, l = Titel, ph = Platzhalter, c = Farbklasse)
    const f = (k, l, ph, c) => `<div class="sec ${c}"><h3>${l}</h3>${edit ? `<textarea data-p="setups.${i}.${k}" placeholder="${ph}">${esc(s[k])}</textarea>` : `<div class="txt">${esc(s[k]) || '<span class="mut">–</span>'}</div>`}</div>`;
    return `<div class="mh"><div class="mt">${edit
      ? `<input class="wide big" data-p="setups.${i}.title" value="${esc(s.title)}" placeholder="Titel"><textarea class="sum" data-p="setups.${i}.sum" placeholder="Kurzbeschreibung (für die Karte)">${esc(s.sum)}</textarea>`
      : `<h1>${esc(s.title || 'Neues Setup')}</h1><p class="mut">${esc(s.sum)}</p>`}</div><button class="pill ${edit ? 'on' : ''}" data-act="mode">${edit ? '✎ Bearbeiten' : '👁 Lesen'}</button>${edit ? `<button class="pill" data-act="delSetup" title="Löschen">🗑</button>` : ''}<button class="pill" data-act="exportOne">⬇ PDF</button><button class="pill" data-act="close">✕</button></div>
${imgs(`setups.${i}.images`, s.images)}${f('rein', 'Wann rein', '', 'c1')}${f('raus', 'Wo raus', 'z.B. Stop hinter letztem Wick, Ziel nächste Zone', 'c2')}${f('achten', 'Worauf achten', '', 'c3')}${f('best', 'Bestätigung (Bookmap / NQ / Kerze)', '', 'c4')}<div class="sec c5"><h3>Beispiel-Trade</h3>${imgs(`setups.${i}.bimages`, s.bimages)}${edit ? `<textarea data-p="setups.${i}.bsp" placeholder="Datum, was ist passiert, warum war es ein gutes Beispiel?">${esc(s.bsp)}</textarea>` : `<div class="txt">${esc(s.bsp) || '<span class="mut">–</span>'}</div>`}</div>${edit ? `<button class="ghost danger" data-act="delSetup">Setup löschen</button>` : ''}`;
  },

  // -------- Tipps
  tips() {
    const star = (g, i, it) => `<button class="star ${it.pin ? 'on' : ''}" data-act="pin" data-a="${g}" data-b="${i}" title="Als Fokus markieren (Startseite)">★</button>`;
    return `<h1>Tipps &amp; Verbesserungen</h1><p class="mut">Meine Fehler-Muster und die Regeln dagegen. ★ = Fokus, erscheint auf der Startseite.</p>
${D.tips.map((g, gi) => `<div class="sec tg c${gi % 5 + 1}">${edit
      ? `<div class="row"><input class="ic" data-p="tips.${gi}.i" value="${esc(g.i)}"><input class="wide" data-p="tips.${gi}.t" value="${esc(g.t)}" placeholder="Kategorie"><button class="ghost danger" data-act="delTipGroup" data-a="${gi}" title="Kategorie löschen">🗑</button></div>`
      : `<h3>${esc(g.i)} ${esc(g.t)}</h3>`}
${g.items.map((it, ii) => edit
      ? `<div class="row">${star(gi, ii, it)}<textarea class="ti" data-p="tips.${gi}.items.${ii}.t" placeholder="Tipp / Regel …">${esc(it.t)}</textarea><button class="ghost" data-act="delTip" data-a="${gi}" data-b="${ii}">✕</button></div>`
      : `<div class="tip">${star(gi, ii, it)}<span>${esc(it.t)}</span></div>`).join('')}
${edit ? `<button class="ghost" data-act="addTip" data-a="${gi}">＋ Tipp</button>` : ''}</div>`).join('')}
${edit ? `<button class="ghost" data-act="addTipGroup">＋ Neue Kategorie</button>` : ''}`;
  },

  // --------- Journal: Übersicht 
  journal() {
    const R = jrange();
    const T = J.trades.filter(inR(R)).sort((a, b) => String(b.entry_time).localeCompare(String(a.entry_time)));
    const bar = periodBar(JF, R, plural(T.length),
      [['all', 'Alle'], ['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat'], ['range', 'Zeitraum']],
      ['day', 'week', 'month'], 'j', 'jf');
    const tiles = T.map(t => `<div class="tile jt" data-trade="${t.id}">${edit ? `<button class="tdel" data-act="delTrade" data-id="${t.id}" title="Löschen">🗑</button>` : ''}${tcov(t)}<div class="tb"><b><span class="mut">${t.bias == 'Short' ? '▼ Short' : '▲ Long'}</span> <span class="${t.pnl > 0 ? 'lg' : 'sh'}">${jpnl(t.pnl)}</span></b><p>${jdt(t.entry_time)}</p><span>Details →</span></div></div>`).join('');
    const empty = !T.length
      ? (J.trades.length ? '<p class="mut">Keine Trades in diesem Zeitraum.</p>' : '<p class="mut">Noch keine Trades. Trage unter „Einstellungen“ deinen API-Key ein und klicke dann auf „Synchronisieren“.</p>')
      : '';
    return `<div class="mh" style="align-items:center"><h1 style="flex:1;margin:0">Trading Journal</h1><button class="pill" data-act="sync">⟳ Synchronisieren</button></div>
<p class="mut" style="margin:6px 0 0">${J.lastSync ? 'Zuletzt synchronisiert: ' + jdt(new Date(J.lastSync).toISOString()) : 'Noch nicht synchronisiert.'}</p>
${bar}
<div class="grid" style="margin-top:16px">${tiles}</div>${empty}`;
  },

  // -------- Trade: Detailfenster
  trade() {
    const t = J.trades.find(x => x.id == tid);
    if (!t) return '';
    const sh = t.bias == 'Short', a = anl(t);
    const opts = D.setups.map(x => `<option value="${x.id}" ${a.setupId == x.id ? 'selected' : ''}>${esc(x.title || 'Neues Setup')}</option>`).join('');
    return `<div class="mh"><div class="mt"><h1>${esc(t.symbol)}</h1><p class="mut"><span>${sh ? '▼ Short' : '▲ Long'}</span> · <span class="${t.pnl > 0 ? 'lg' : 'sh'}">${jpnl(t.pnl)}</span> · ${jdt(t.entry_time)}</p></div><button class="pill ${edit ? 'on' : ''}" data-act="mode">${edit ? '✎ Bearbeiten' : '👁 Lesen'}</button>${edit ? `<button class="pill" data-act="delTrade" title="Löschen">🗑</button>` : ''}<button class="pill" data-act="exportTrade">⬇ PDF</button><button class="pill" data-act="close">✕</button></div>
<div class="chartbox"><div class="ctb" id="ivb"></div><div id="ch"></div><div class="chmsg" id="chmsg"></div></div>
<div class="sec c4"><h3>Bookmap / NQ</h3><div class="gal">${(a.images || []).map((n, j) => `<div class="im"><img src="${B + n}" data-zoom>${edit ? `<button data-act="tImgDel" data-a="${j}">✕</button>` : ''}</div>`).join('')}<label class="im add">＋ Bild<small>oder Strg+V</small><input type="file" accept="image/*" hidden data-tfile="1"></label></div></div>
<div class="sec c2"><h3>Trade-Analyse</h3>
<p class="mut" style="margin:0 0 10px">Nur wenn du vom Plan abgewichen bist, fragt das Journal nach dem Warum. Ein Trade nach Plan braucht keine Fehlersuche – auch nicht, wenn er im Minus endet.</p>
<div class="row"><select class="wide" data-ja="setupId"><option value="">Setup wählen …</option>${opts}</select></div>
<div class="row" style="margin-top:10px"><button class="pill pj ${a.plan == 'ja' ? 'on' : ''}" data-act="plan" data-v="ja">✓ Nach Plan</button><button class="pill pn ${a.plan == 'nein' ? 'on' : ''}" data-act="plan" data-v="nein">↯ Vom Plan abgewichen</button></div>
<textarea data-ja="note" placeholder="Kurz festhalten: Was ist passiert?" style="margin-top:10px">${esc(a.note)}</textarea>
${a.plan == 'nein' ? `<textarea data-ja="diff" placeholder="Was war anders als geplant?" style="margin-top:10px">${esc(a.diff)}</textarea>` : ''}</div>
<div class="sec c3"><h3>Stop-Loss &amp; Take-Profit</h3>
<div class="lv"><input data-ja="sl" inputmode="decimal" placeholder="Stop-Loss" value="${esc(a.sl)}"><button class="pill pk" data-act="pick" data-k="sl">im Chart setzen</button><input data-ja="tp" inputmode="decimal" placeholder="Take-Profit" value="${esc(a.tp)}"><button class="pill pk" data-act="pick" data-k="tp">im Chart setzen</button></div>
<div class="mut" id="rr" style="margin-top:8px">${esc(rrText(t))}</div></div>`;
  },

  // ----- Analyse 
  analyse() {
    const R = arange(), T = J.trades.filter(inR(R)), S = stats(T);
    const sd = t => t ? `${esc(t.symbol)} · ${jdt(t.entry_time).split(',')[0]}` : '';
    const pj = T.filter(t => t.analysis && t.analysis.plan == 'ja');
    const pn = T.filter(t => t.analysis && t.analysis.plan == 'nein');
    const bar = periodBar(AF, R, plural(S.n),
      [['all', 'Alle'], ['month', 'Monat'], ['quarter', 'Quartal'], ['year', 'Jahr'], ['range', 'Zeitraum']],
      ['month', 'quarter', 'year'], 'a', 'af');

    let body;
    if (!S.n) {
      body = '<p class="mut" style="margin-top:18px">Keine Trades in diesem Zeitraum.</p>';
    } else {

      body = `<div class="stats">
${stat('Netto', fm(S.net), `${S.w} Gewinner · ${S.l} Verlierer${S.e ? ` · ${S.e} ±0` : ''}`, cls(S.net), true)}
${stat('Gewinn gesamt', fm(S.g), '', cls(S.g))}
${stat('Verlust gesamt', fm(S.v), '', cls(S.v))}
${stat('Trefferquote', S.rate.toFixed(0) + ' %', `${S.w} von ${S.n} Trades`)}
${stat('Profit-Faktor', S.pf == null ? '–' : S.pf.toFixed(2), 'Gewinn ÷ Verlust')}
${stat('Ø Gewinn', fm(S.avgW), '', cls(S.avgW))}
${stat('Ø Verlust', fm(S.avgL), '', cls(S.avgL))}
${stat('Bester Trade', fm(S.best.pnl), sd(S.best), cls(S.best.pnl))}
${stat('Schlechtester Trade', fm(S.worst.pnl), sd(S.worst), cls(S.worst.pnl))}</div>
<div class="sec c3"><h3>Gebühren &amp; Funding</h3><div class="stats" style="margin-top:0">
${stat('Gebühren gesamt', fm(-S.fee), `Ø ${S.avgFee.toFixed(2)} $ pro Trade · ${S.feeNot.toFixed(3)} % vom Positionswert`, 'sh')}
${stat('Funding', fm(S.fu), '', cls(S.fu))}
${stat('Anteil am Gewinn', S.feePct == null ? '–' : S.feePct.toFixed(0) + ' %', 'Gebühren ÷ Gewinn gesamt')}
${stat('Gewinner → Verlierer', String(S.flip), 'vor Gebühren im Plus, danach im Minus', S.flip ? 'sh' : '')}
${stat('Netto nach Gebühren &amp; Funding', fm(S.after), `Realisiert ${fm(S.net)} − Gebühren + Funding`, cls(S.after), true)}</div>
<p class="mut" style="margin:10px 0 0;font-size:12px">Bitunix liefert den realisierten Gewinn laut Doku ohne Gebühren und Funding. Rechnung: Realisiert − Gebühren + Funding.</p></div>
${pj.length + pn.length ? `<div class="sec c2"><h3>Nach Plan gehandelt</h3><div class="txt">Nach Plan: ${pj.length} Trades · ${fm(sumP(pj))}\nVom Plan abgewichen: ${pn.length} Trades · ${fm(sumP(pn))}\nNoch nicht eingeordnet: ${T.length - pj.length - pn.length}</div></div>` : ''}`;
    }

    return `<h1>Analyse</h1>
${bar}
${body}`;
  },

  // ------- Einstellungen 
  settings() {
    const ph = n => hasKeys ? n + ' (zum Ersetzen neu eingeben)' : n;
    return `<h1>Einstellungen</h1><h2>Bitunix API</h2>
<p class="mut">Die Schlüssel werden verschlüsselt (an dein Windows-Konto gebunden) neben dem Programm gespeichert und nie wieder angezeigt. Tipp: Für den Import brauchst du keine Trading-Rechte – vergib im Bitunix-Konto nach Möglichkeit nur Leserechte.</p>
<div class="sec c1"><h3>${hasKeys ? '✓ Verbunden – Schlüssel gespeichert' : 'Noch nicht verbunden'}</h3>
<div class="row"><input class="wide" id="bk" type="password" autocomplete="off" placeholder="${ph('API Key')}"></div>
<div class="row"><input class="wide" id="bs" type="password" autocomplete="off" placeholder="${ph('API Secret')}"></div>
<div class="row"><button class="pill" data-act="saveKeys">Speichern</button>${hasKeys ? '<button class="ghost danger" data-act="clearKeys">Schlüssel entfernen</button>' : ''}</div></div>
<h2>Verlauf</h2>
<p class="mut">Die Synchronisation holt normalerweise nur das Neue. Hier kannst du einmalig weiter zurückladen – die Meldung danach zeigt dir, wie weit Bitunix tatsächlich zurückreicht.</p>
<div class="row" style="align-items:center"><select id="hd"><option value="90">letzte 90 Tage</option><option value="180">letzte 180 Tage</option><option value="365">letzte 365 Tage</option><option value="730">letzte 2 Jahre</option></select><button class="pill" data-act="hist">Verlauf laden</button></div>
<h2>Backup</h2>
<p class="mut">Kopiert Wiki, Journal und alle Bilder in einen Ordner deiner Wahl (am besten auf einen USB-Stick oder in die Cloud). API-Schlüssel sind absichtlich nicht dabei. Wiederherstellen: App schließen und die Dateien aus dem Backup in den Datenordner kopieren. Tägliche Automatik-Sicherungen der letzten 30 Tage liegen zusätzlich im Unterordner „backups“.</p>
<div class="row"><button class="pill" data-act="backup">⬇ Backup erstellen</button><button class="pill" data-act="openData">📂 Datenordner öffnen</button></div>
<h2>Über</h2>
<p class="mut" style="font-size:12px">Kerzen: Bitunix. Charts: TradingView Lightweight Charts™ (Apache-2.0), Lizenz im Ordner „vendor“.</p>`;
  },

  // -------- Bookmap 
  bookmap() {
    return `<h1>Bookmap</h1>${edit
      ? `<textarea class="tall" data-p="bookmap.text" placeholder="Gedanken zu Bookmap …">${esc(D.bookmap.text)}</textarea>`
      : `<div class="txt">${esc(D.bookmap.text) || '<span class="mut">Noch leer.</span>'}</div>`}${imgs('bookmap.images', D.bookmap.images)}`;
  }
};
