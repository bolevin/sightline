/* Sightline v2 demo: the component kit. Every page is built from these functions and nothing else,
   so a panel, a table or a chart looks and behaves the same on every screen. All functions return HTML strings. */
(function () {
  'use strict';
  const K = {};
  const D = window.D;

  const esc = K.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  K.fmt = n => n == null ? '–' : (typeof n === 'number' ? n.toLocaleString('en-US') : String(n));
  K.pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const day = s => Date.parse(s + 'T00:00:00Z') / 864e5;
  K.day = day;
  K.dm = s => s.slice(8, 10) + '.' + s.slice(5, 7);          // 2026-11-18 -> 18.11
  K.pos = (d, from, to) => Math.max(0, Math.min(100, (day(d) - day(from)) / (day(to) - day(from)) * 100));

  /* ── small parts ─────────────────────────────────────────────────────── */
  K.dot = (tone, ring) => `<i class="dot ${tone || ''}${ring ? ' ring' : ''}"></i>`;
  K.pill = (text, tone) => `<span class="pill ${tone || ''}">${esc(text)}</span>`;
  K.tag = text => `<span class="tag">${esc(text)}</span>`;
  K.btn = (label, attrs, cls) => `<button class="btn ${cls || ''}" ${attrs || ''}>${esc(label)}</button>`;
  K.link = (label, href, cls) => `<a class="${cls || 'ent'}" href="${href}">${esc(label)}</a>`;
  K.note = (html, tone) => `<div class="note ${tone || ''}">${html}</div>`;
  K.sect = (title, sub) => `<div class="sect">${esc(title)}${sub ? ` <span class="faint">${esc(sub)}</span>` : ''}</div>`;
  K.kv = pairs => `<dl class="kv">${pairs.map(p => `<dt>${esc(p[0])}</dt><dd>${p[1]}</dd>`).join('')}</dl>`;
  K.help = text => `<button class="help" data-help="${esc(text)}" aria-label="What this panel shows">?</button>`;
  K.stateWord = { ok: 'on track', watch: 'needs a look', bad: 'off track' };
  K.agreed = a => ({ v: a.shown || a.kept + ' of ' + a.of, sub: a.shownSub || a.unit });   // how an agreement reads
  K.toneOf = st => ({ ok: 'ok', watch: 'watch', bad: 'bad' }[st] || '');

  /* lookups */
  K.issue = key => D.issues.find(i => i.key === key) || D.bugs.openList.find(i => i.key === key) || D.removed.find(i => i.key === key);
  K.feature = key => D.features.find(f => f.key === key);
  K.service = id => D.services.find(s => s.id === id);
  K.source = id => D.sources.find(s => s.id === id);
  K.release = id => D.releases.find(r => r.id === id);
  K.incident = id => D.incidents.find(i => i.id === id);

  /* a key that opens its object: sprint issues and bugs, features, releases, incidents; foreign keys stay text */
  K.key = function (key, o) {
    o = o || {};
    const f = K.feature(key), i = K.issue(key);
    let href = null, title = '';
    if (f) { href = '#/feature/' + key; title = f.title; }
    else if (i) { href = '#/issue/' + key; title = i.title; }
    else if (K.release(key)) { href = '#/release/' + key; title = K.release(key).name; }
    else if (K.incident(key)) { href = '#/incident/' + key; title = K.incident(key).title; }
    const own = key.indexOf(D.team.project + '-') === 0;
    const k = href ? `<a class="key" href="${href}">${esc(key)}</a>` : `<span class="key far"${own ? '' : ' data-tip="Belongs to another team: not read"'}>${esc(key)}</span>`;
    const sp = o.sp && i && i.sp != null ? ` <span class="sp">${i.sp} SP</span>` : '';
    return k + sp + (o.title && title ? ` <span class="ttl-t">${esc(title)}</span>` : '');
  };
  K.keys = (list, o) => list.map(k => K.key(k, o)).join(o && o.title ? '<br>' : ' &nbsp;');
  K.svc = id => { const s = K.service(id); return s ? `<a class="ent" href="#/service/${id}">${esc(id)}</a>` : id ? esc(id) : '<span class="faint">none</span>'; };
  K.status = st => {
    const tone = { blocked: 'bad', done: 'ok' }[st] || '';
    return `<span class="pill ${tone}">${esc(D.status[st] || st)}</span>`;
  };

  /* ── sources and panel states ────────────────────────────────────────── */
  K.srcState = id => (window.SM && SM.src && SM.src[id]) || (K.source(id) || {}).state || 'ok';
  K.srcChip = function (id) {
    const s = K.source(id); if (!s) return '';
    const st = K.srcState(id);
    const age = st === 'ok' ? s.age : st === 'stale' ? (s.state === 'stale' ? s.age : '3 h 10 min') : st === 'down' ? 'no answer' : 'not connected';
    return `<a class="src is-${st}" href="#/system/sources" data-tip="${esc(s.name)}: ${esc(s.reads)}<small>last read ${esc(s.last)} · read every ${esc(s.every)}</small>">${K.dot(st === 'ok' ? 'ok' : st === 'stale' ? 'watch' : st === 'down' ? 'bad' : '', st === 'off')}${esc(s.name)} · ${esc(age)}</a>`;
  };
  K.stateBlock = function (kind, o) {
    const s = o.src ? K.source(o.src) : null, nm = s ? s.name : '';
    const T = {
      off: ['–', nm + ' is not connected', (o.would ? 'This panel would show ' + o.would + '. ' : '') + (s && s.why ? 'Why: ' + s.why + '.' : 'Set it up under System, Sources.'), 'Open Sources', '#/system/sources'],
      down: ['!', nm + ' did not answer', 'The last read failed at ' + (s ? s.last : '') + ' (timeout after 60 s). Nothing is shown rather than numbers of unknown age. The app tries again every ' + (s ? s.every : '') + '.', 'Open Sources', '#/system/sources'],
      empty: ['0', o.title || 'Nothing in this window', o.text || 'No rows match the scope.', o.act || '', o.to || ''],
      held: ['§', o.title || 'Withheld by a rule', o.text || 'Customer data stays in Jira: the app shows counts and keys only.', 'See the rules', '#/system/settings'],
      loading: ['…', 'Reading ' + nm, 'First read of this source; usually done within a few seconds.', '', '']
    }[kind];
    return `<div class="pst is-${kind}"><span class="gl">${T[0]}</span><div><b>${esc(T[1])}</b>${esc(T[2])}${kind === 'loading' ? '<div class="skel" style="width:70%"></div><div class="skel" style="width:45%"></div>' : ''}${T[3] ? `<div class="do"><a class="btn sm" href="${T[4]}">${esc(T[3])}</a></div>` : ''}</div></div>`;
  };

  /* the panel: title, body, and a footer that names the sources with their age and opens the evidence.
     o: {title, sub, w, src:[ids], help, body, right, flush, ev, state, empty, would, foot, id, isNew, mixed}
     mixed: the rows of this panel come from several sources and degrade one by one, so a source that is gone never blanks
     the panel; a string is the line shown above the rows. */
  K.panel = function (o) {
    const srcs = o.src || [];
    const states = srcs.map(K.srcState);
    let bar = '', body = o.body || '', cls = '';
    const first = states[0];
    if (o.state === 'empty') body = K.stateBlock('empty', o.empty || {});
    else if (o.state === 'held') body = K.stateBlock('held', o.empty || {});
    else if (o.state === 'loading') body = K.stateBlock('loading', { src: srcs[0] });
    else if (first === 'off' && !o.mixed) body = K.stateBlock('off', { src: srcs[0], would: o.would });
    else if (first === 'down' && !o.mixed) body = K.stateBlock('down', { src: srcs[0] });
    else {
      const bad = srcs.find((id, n) => states[n] === 'down'), late = srcs.find((id, n) => states[n] === 'stale'), gone = srcs.find((id, n) => states[n] === 'off');
      if (typeof o.mixed === 'string') bar = `<div class="stale-bar is-down">${K.dot('bad')}${esc(o.mixed)}</div>`;
      else if (o.mixed) bar = '';
      else if (bad) { const s = K.source(bad); bar = `<div class="stale-bar is-down">${K.dot('bad')}${esc(s.name)} did not answer: the part of this panel that comes from it shows the read of ${esc(s.last)}.</div>`; cls = ' st-stale'; }
      else if (late) { const s = K.source(late); bar = `<div class="stale-bar">${K.dot('watch')}${esc(s.name)}: last read ${esc(s.last)}, expected every ${esc(s.every)}. ${s.why ? esc(s.why.charAt(0).toUpperCase() + s.why.slice(1)) + '.' : 'The numbers may be old.'}</div>`; cls = ' st-stale'; }
      else if (gone) { const s = K.source(gone); bar = `<div class="stale-bar is-demo">${K.dot('', true)}${esc(s.name)} is not connected: its part of this panel is left out.</div>`; }
      if (o.state === 'demo') bar += `<div class="stale-bar is-demo">Demo data: invented rows that show what this panel does. No number from here reaches another page or the agent.</div>`;
      body = `<div class="pan-b${o.flush ? ' flush' : ''}">${body}</div>`;
    }
    const helpText = o.help || (window.HELP && window.HELP[String(o.title).replace(/\d+(?:[.,]\d+)*/g, '#')]);   // js/help.js holds the texts of the panels without their own
    const foot = (srcs.length || o.foot || o.ev)
      ? `<div class="pan-f">${srcs.map(K.srcChip).join('')}${o.foot ? `<span>${o.foot}</span>` : ''}${o.ev ? `<button class="ev" data-ev="${esc(o.ev)}">evidence ›</button>` : ''}</div>` : '';
    return `<section class="pan ${o.w || 'c12'}${cls}"${o.id ? ` id="${o.id}"` : ''}>
      <header class="pan-h"><span class="t" data-full="${esc(o.title)}">${esc(o.title)}</span>${o.sub ? `<span class="q" data-full="${esc(o.sub)}">${o.sub}</span>` : ''}<span class="r">${o.right || ''}${o.isNew ? '<span class="mark-new">new</span>' : ''}${helpText ? K.help(helpText) : ''}</span></header>
      ${bar}${body}${foot}</section>`;
  };
  K.grid = (...panels) => `<div class="grid">${panels.join('')}</div>`;
  K.stack = (w, ...panels) => `<div class="stack ${w}">${panels.join('')}</div>`;

  /* KPI strip. items: {l, v, u, s, tone, ev, to, spark, tip} */
  K.kpis = items => `<div class="kpis${window.SM && SM.cmp && SM.cmp.on && !SM.cmpSkipPage ? ' has-d' : ''}" style="--n:${items.length}">${items.map(k => {
    if (window.SM && SM.cmpCell) k = SM.cmpCell(k);
    const inner = `<div class="k-l">${k.tone ? K.dot(k.tone) : ''}<span class="cut">${esc(k.l)}</span></div><div class="k-v">${esc(k.v)}${k.u ? `<span class="u">${esc(k.u)}</span>` : ''}</div>${k.s ? `<div class="k-s">${k.s}</div>` : ''}${k.d ? `<div class="k-d">${k.d}</div>` : ''}${k.spark ? K.spark(k.spark, { w: 46, h: 20 }) : ''}`;
    if (k.to) return `<a class="k t-${k.tone || ''}" href="${k.to}">${inner}</a>`;
    if (k.ev) return `<button class="k t-${k.tone || ''}" data-ev="${esc(k.ev)}" data-tip="Click for the definition, the query and the rows">${inner}</button>`;
    return `<div class="k t-${k.tone || ''}">${inner}</div>`;
  }).join('')}</div>`;

  /* table. cols: {h, v(row) -> html, n (right aligned), s(row) -> sort value, cls}. o: {attrs(row), rowCls(row), empty} */
  K.table = function (cols, rows, o) {
    o = o || {};
    if (!rows.length) return K.stateBlock('empty', o.empty || {});
    const th = cols.map((c, n) => `<th class="${c.n ? 'n' : ''}"${c.s ? ` data-sort="${n}"` : ''}${c.tip ? ` data-tip="${esc(c.tip)}"` : ''}>${esc(c.h)}</th>`).join('');
    const tr = rows.map(r => `<tr class="${o.rowCls ? o.rowCls(r) : ''}" ${o.attrs ? o.attrs(r) : ''}>${cols.map(c =>
      `<td class="${c.n ? 'n ' : ''}${c.cls || ''}"${c.s ? ` data-s="${esc(c.s(r))}"` : ''}>${c.v(r)}</td>`).join('')}</tr>`).join('');
    return `<div class="tbwrap"><table class="tb"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  };

  /* list rows with a state dot. items: {tone, html, v, to, ev, cite} */
  K.list = items => items.map(i => {
    const inner = `${K.dot(i.tone)}<span class="tx">${i.html}${i.cite ? `<span class="cite">${esc(i.cite)}</span>` : ''}</span><span class="v">${i.v == null ? '' : i.v}</span>`;
    // a row may hold links of its own, so the row itself is never an <a> or a <button>
    return i.to ? `<div class="li" data-go="${i.to}">${inner}</div>` : i.ev ? `<div class="li" data-ev="${esc(i.ev)}">${inner}</div>` : `<div class="li">${inner}</div>`;
  }).join('');

  /* horizontal bars. rows: {n, v, max, cls, label, tick, parts:[[value, cls, tip]]} */
  K.hbars = function (rows, o) {
    o = o || {};
    const max = o.max || Math.max.apply(null, rows.map(r => r.max || (r.parts ? r.parts.reduce((s, p) => s + p[0], 0) : r.v)));
    return `<div style="${o.nw != null ? '--hb-n:' + o.nw + 'px;' : ''}${o.vw != null ? '--hb-v:' + o.vw + 'px' : ''}">` + rows.map(r => {
      const parts = r.parts || [[r.v, r.cls || '']];
      return `<div class="hb"><span class="nm" title="${esc(r.plain || '')}">${r.n}</span><span class="tr">${parts.map(p =>
        `<i class="fl ${p[1] || ''}" style="width:${Math.max(0, p[0]) / max * 100}%" ${p[2] ? `data-tip="${esc(p[2])}"` : ''}></i>`).join('')}${r.tick != null ? `<i class="tick" style="left:${r.tick / max * 100}%" data-tip="${esc(r.tickTip || 'target')}"></i>` : ''}</span><span class="vv">${r.label == null ? K.fmt(r.v) : r.label}</span></div>`;
    }).join('') + '</div>';
  };
  /* one stacked bar with a legend. parts: [label, value, bgClass] */
  K.stackbar = function (parts, o) {
    o = o || {};
    const sum = parts.reduce((s, p) => s + p[1], 0) || 1;
    return `<div class="stackbar" style="height:${o.h || 10}px">${parts.filter(p => p[1] > 0).map(p => `<i class="${p[2]}" style="flex:${p[1]}" data-tip="${esc(p[0])}: ${K.fmt(p[1])}${o.unit ? ' ' + o.unit : ''} (${Math.round(p[1] / sum * 100)} %)"></i>`).join('')}</div>
      <div class="leg">${parts.map(p => `<span${p[1] === 0 ? ' class="op-45"' : ''}><i class="${p[2]}"></i>${esc(p[0])} <b class="ink">${K.fmt(p[1])}</b></span>`).join('')}</div>`;
  };
  K.legend = items => `<div class="leg">${items.map(i => `<span><i class="${i[1]}${i[2] ? ' ln' : ''}"></i>${esc(i[0])}</span>`).join('')}</div>`;

  /* a y range that follows the data: [max, ticks] with round steps */
  K.nice = function (max, n) {
    max = Math.max(max, 1); n = n || 4;
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    const top = Math.ceil(max / step) * step, ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
    return [top, ticks];
  };

  /* sparkline */
  K.spark = function (vals, o) {
    o = o || {}; const w = o.w || 80, h = o.h || 22, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), r = (max - min) || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1) * (w - 4) + 2).toFixed(1), (h - 3 - (v - min) / r * (h - 6)).toFixed(1)]);
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--${o.color || 'dim'})" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.2" fill="var(--${o.color || 'ink'})"/></svg>`;
  };

  /* XY chart. o: {w, h, x:[min,max], y:[min,max], xt:[[x,label]], yt:[values], yu (unit),
       areas:[{pts:[[x,y0,y1]], color, op}], lines:[{pts:[[x,y]], color, dash, w, label, tip(x,y)}],
       dots:[{x,y,color,r,tip}], bars:[{x,w,y0,y1,color,tip,op}], hlines:[{y,color,dash,label}], vmarks:[{x,color,label,tip,dash}]} */
  /* A chart is drawn at the width it really has (K.fitCharts), so its text is 11 px on every screen.
     Dated ticks tell it where days lie: it then marks today and the releases by itself. o.dayX(day) -> x overrides that. */
  const chartReg = {};
  let chartSeq = 0;
  const MONTH = { Sep: '2026-09-01', Oct: '2026-10-01', Nov: '2026-11-01', Dec: '2026-12-01', 'Jan 2027': '2027-01-01' };
  function tickDay(t) {
    t = String(t);
    if (t === 'today') return day(D.now.date);
    if (MONTH[t]) return day(MONTH[t]);
    let m = /^(\d\d)\.(\d\d)$/.exec(t);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return day('2026-' + m[2] + '-' + m[1]);
    m = /^W(\d\d)$/.exec(t);
    return m ? day('2025-12-29') + (+m[1] - 1) * 7 + 2 : null;           // the middle of the ISO week
  }
  function dayMapper(o) {
    if (o.dayX) return o.dayX;
    const pts = (o.xt || []).map(t => [tickDay(t[1]), t[0]]).filter(p => p[0] != null);
    if (pts.length < 2) return null;
    return d => { const t = day(d); let i = 0; while (i < pts.length - 2 && t > pts[i + 1][0]) i++; const a = pts[i], b = pts[i + 1]; return a[1] + (t - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); };
  }
  K.chart = function (o) { const id = ++chartSeq; chartReg[id] = o; return drawChart(o, id); };
  K.chartsReset = () => Object.keys(chartReg).forEach(k => delete chartReg[k]);
  K.fitCharts = function (root) {
    (root || document).querySelectorAll('svg.ch[data-c]').forEach(s => {
      const id = s.getAttribute('data-c'), o = chartReg[id], w = Math.round(s.getBoundingClientRect().width);
      if (o && w > 40 && Math.abs(w - s.viewBox.baseVal.width) > 1) s.outerHTML = drawChart(Object.assign({}, o, { w: w }), id);
    });
  };
  function drawChart(o, id) {
    const yLabels = (o.yt || []).map(v => K.fmt(v) + (o.yu || ''));
    const W = o.w || 640, H = o.h || 220, L = Math.max(o.left || 0, yLabels.length ? Math.max.apply(null, yLabels.map(t => t.length)) * 6.3 + 10 : 34), R = o.right || 14, T = 12, B = 22;
    const X = x => L + (x - o.x[0]) / (o.x[1] - o.x[0]) * (W - L - R), Y = y => H - B - (y - o.y[0]) / (o.y[1] - o.y[0]) * (H - T - B);
    const col = c => `var(--${c || 's1'})`;
    const toX = dayMapper(o), onAxis = x => x >= o.x[0] - .001 && x <= o.x[1] + .001, nowX = toX ? toX(D.now.date) : null, hasNow = nowX != null && onAxis(nowX);
    let s = `<svg class="ch" data-c="${id}"${hasNow ? ' data-time' : ''} viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'chart')}">`;
    (o.yt || []).forEach(v => { s += `<line class="g" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${K.fmt(v)}${o.yu || ''}</text>`; });
    s += `<line class="ax" x1="${L}" x2="${W - R}" y1="${Y(o.y[0])}" y2="${Y(o.y[0])}"/>`;
    let tickEnd = -1e9;     // a tick that would touch the one before it is left out
    (o.xt || []).forEach(t => {
      const half = String(t[1]).length * 3.2, x = Math.max(half, Math.min(W - half, X(t[0])));
      if (x - half < tickEnd + 5) return;
      tickEnd = x + half;
      s += `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(t[1])}</text>`;
    });
    (o.areas || []).forEach(a => {
      const up = a.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[2]).toFixed(1)}`), dn = a.pts.slice().reverse().map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`);
      s += `<polygon points="${up.concat(dn).join(' ')}" fill="${col(a.color)}" opacity="${a.op || .9}" ${a.tip ? `data-tip="${esc(a.tip)}"` : ''}/>`;
    });
    (o.bars || []).forEach(b => {
      const x0 = X(b.x - b.w / 2) + 1, x1 = X(b.x + b.w / 2) - 1, y1 = Y(b.y1), y0 = Y(b.y0 || o.y[0]);
      s += `<rect x="${x0.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${Math.max(1, Math.abs(y0 - y1)).toFixed(1)}" rx="2" fill="${b.fill || col(b.color)}" ${b.stroke ? `stroke="${col(b.stroke)}" stroke-width="1.2"` : ''} opacity="${b.op || 1}" ${b.tip ? `data-tip="${esc(b.tip)}"` : ''}/>`;
    });
    (o.hlines || []).forEach(h => {
      s += `<line x1="${L}" x2="${W - R}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="${col(h.color || 'dim')}" stroke-width="1.2" ${h.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      if (h.label) s += h.left ? `<text class="lb" x="${L + 4}" y="${Y(h.y) - 4}">${esc(h.label)}</text>` : `<text class="lb" x="${W - R - 2}" y="${Y(h.y) - 4}" text-anchor="end">${esc(h.label)}</text>`;
    });
    let nowDrawn = false;
    (o.vmarks || []).forEach(v => {
      const isNow = hasNow && !nowDrawn && Math.abs(X(v.x) - X(nowX)) < 4; if (isNow) nowDrawn = true;
      s += `<line${isNow ? ' data-mark="today"' : ''} x1="${X(v.x)}" x2="${X(v.x)}" y1="${T}" y2="${H - B}" stroke="${col(v.color || 'dim')}" stroke-width="1" ${v.dash === false ? '' : 'stroke-dasharray="2 3"'}/>`;
      if (v.label) s += `<text class="lb" x="${X(v.x) + (v.left ? -4 : 4)}" y="${T + 8 + (v.row || 0) * 12}" text-anchor="${v.left ? 'end' : 'start'}">${esc(v.label)}</text>`;
      if (v.tip) s += `<rect class="hit" x="${X(v.x) - 6}" y="${T}" width="12" height="${H - T - B}" data-tip="${esc(v.tip)}"/>`;
    });
    if (hasNow && !nowDrawn) s += `<line class="m-now" data-mark="today" x1="${X(nowX).toFixed(1)}" x2="${X(nowX).toFixed(1)}" y1="${T}" y2="${H - B}"><title>today</title></line>`;
    if (toX) D.cal.marks.filter(m => m.kind === 'rel' || m.kind === 'plan').forEach(m => {
      const x = toX(m.d); if (!onAxis(x)) return;
      s += `<path class="m-rel${m.kind === 'plan' ? ' plan' : ''}" data-mark="release" d="M${X(x).toFixed(1)} ${H - B - 4}l4 4-4 4-4-4z" data-tip="${esc(m.label)}<small>${K.dm(m.d)}</small>"/>`;
    });
    (o.lines || []).forEach(l => {
      s += `<polyline points="${l.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col(l.color)}" stroke-width="${l.w || 2}" stroke-linejoin="round" stroke-linecap="round" ${l.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      if (l.tip) l.pts.forEach(p => { s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="9" class="hit" data-tip="${esc(l.tip(p[0], p[1]))}"/>`; });
      if (l.end) { const p = l.pts[l.pts.length - 1]; s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="${col(l.color)}" stroke="var(--plane)" stroke-width="2"/>`; }
      if (l.label) { const p = l.at || l.pts[l.pts.length - 1]; s += `<text class="lb ls-${l.color || 's1'}" x="${X(p[0]) + (l.at ? 0 : 7)}" y="${Y(p[1]) + 3.5}">${esc(l.label)}</text>`; }
    });
    (o.dots || []).forEach(d => {
      s += `<circle cx="${X(d.x).toFixed(1)}" cy="${Y(d.y).toFixed(1)}" r="${d.r || 4}" fill="${col(d.color)}" stroke="var(--plane)" stroke-width="1.5" opacity="${d.op || 1}" ${d.tip ? `data-tip="${esc(d.tip)}"` : ''}/>`;
    });
    return s + '</svg>';
  }

  /* in-page tabs. tabs: [{id, label, cnt, html}] */
  K.tabs = function (group, tabs) {
    const cur = (window.SM && SM.ui[group]) || tabs[0].id;
    return `<div class="tabs" data-tabs="${group}">${tabs.map(t => `<button class="${t.id === cur ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}${t.cnt != null ? `<span class="cnt">${t.cnt}</span>` : ''}</button>`).join('')}</div>` +
      tabs.map(t => `<div data-pane="${group}:${t.id}"${t.id === cur ? '' : ' hidden'}>${t.html}</div>`).join('');
  };
  /* filter chips: rows carry data-f="value value"; "all" shows everything. opts: [[value, label, count]] */
  K.filter = function (group, opts) {
    const cur = (window.SM && SM.ui['f:' + group]) || 'all';
    return `<div class="chips" data-filter="${group}">${opts.map(o => `<button class="chip${o[0] === cur ? ' on' : ''}" data-fv="${o[0]}">${esc(o[1])}${o[2] != null ? `<span class="cnt">${o[2]}</span>` : ''}</button>`).join('')}</div>`;
  };
  K.seg = (group, opts, cur) => `<div class="seg" data-seg="${group}">${opts.map(o => `<button class="${o[0] === cur ? 'on' : ''}" data-sv="${o[0]}">${esc(o[1])}</button>`).join('')}</div>`;

  /* feed (activity stream). items: {t, tone, html, sub} */
  K.feed = items => `<div class="feed">${items.map(i => `<div class="fd"><span class="t">${esc(i.t)}</span>${K.dot(i.tone)}<span class="b">${i.html}${i.sub ? `<span class="sub">${i.sub}</span>` : ''}</span></div>`).join('')}</div>`;
  /* check rows. items: {state, html, sub, v} */
  K.checks = items => items.map(c => `<div class="ck ${c.state}"><span class="m">${{ ok: '✓', bad: '✕', watch: '!' }[c.state] || '·'}</span><span class="tx">${c.html}${c.sub ? `<span class="sub">${c.sub}</span>` : ''}</span><span class="v">${c.v == null ? '' : c.v}</span></div>`).join('');
  /* decision card */
  K.dec = d => `<div class="dec ${d.level || ''}"><div class="dh"><span>${esc(d.id)} · ${d.state === 'made' ? 'decided ' + esc(d.on) : 'due ' + esc(d.due)}</span><span>${esc(d.owner)}</span></div>
    <div class="dt">${esc(d.title)}</div><div class="dd">${esc(d.text)}</div>${d.to && d.state !== 'made' ? `<div class="da"><a class="btn sm pri" href="${d.to}">Open the numbers</a><button class="btn sm" data-dr="decision:${d.id}">Details</button></div>` : ''}</div>`;

  /* timeline lanes over a date range. rows: {name (html), from, to, done (0..1), tone, tip, marks:[{d, cls}]} */
  K.timeline = function (rows, from, to, o) {
    o = o || {};
    const ticks = (o.ticks || []).map(t => `<span style="left:${K.pos(t[0], from, to)}%">${esc(t[1])}</span>`).join('');
    const vls = (o.lines || []).map(l => `<i class="vl ${l[1] || ''}" style="left:${K.pos(l[0], from, to)}%" ${l[2] ? `data-tip="${esc(l[2])}"` : ''}></i>`).join('');
    return `<div class="tl" style="--tl-n:${o.nw || 300}px"><div></div><div class="hdr">${ticks}</div>${rows.map(r => {
      const a = K.pos(r.from, from, to), b = K.pos(r.to, from, to);
      return `<div class="nm">${r.name}</div><div class="lane">${vls}<span class="bar ${r.tone || ''}" style="left:${a}%;width:${Math.max(1.2, b - a)}%" data-tip="${esc(r.tip || '')}"><i style="width:${(r.done || 0) * 100}%"></i></span></div>`;
    }).join('')}</div>`;
  };

  /* an entity header: kind line, name, facts, links */
  K.ehead = o => `<div class="ehead"><div><div class="ek">${o.kind}</div><h1>${esc(o.title)}</h1><div class="em">${(o.facts || []).map(f => `<span>${f}</span>`).join('')}</div></div><div class="links">${(o.links || []).join('')}</div></div>`;
  K.extLink = (label, sys) => `<span class="btn sm" data-toast="In the real tool this opens ${esc(sys)} in a new tab. This demo opens nothing outside.">${esc(label)} ↗</span>`;

  /* what a page returns to the shell */
  K.page = o => o;

  window.K = K;
})();
