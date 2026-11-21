/* Compare two days. The app keeps one snapshot of the facts per working day, so any two days can be put side by side:
   pick a reference day and a shown day in the top bar (as a time picker), and every page answers with
   a summary of what happened between them (from the event log) and the change of each of its numbers.
   In this demo the history of the sprint numbers is exact (burn-up and cumulative flow of js/data.js);
   the history of the other numbers is generated, stable for a given number and day, to show how the page behaves. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;
  const TODAY = D.now.date, H = D.sprintHist, S = D.sprint;
  const C = SM.cmp = { on: false, a: TODAY, b: '2026-11-11', field: 'b' };
  SM.cmpStats = [];
  const wd = d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()];
  const lab = d => wd(d) + ' ' + K.dm(d);
  const back = d => K.day(TODAY) - K.day(d);
  const idx = d => { if (d < H.days[0]) return -1; let i = -1; H.days.forEach((x, n) => { if (x <= d) i = n; }); return i; };

  /* numbers of the running sprint with an exact history, found by their label on any page */
  const EXACT = [
    [/^(done|sprint goal work done)$/i, i => S.burn[i + 1]], [/^still open$/i, i => S.scope[i + 1] - S.burn[i + 1]],
    [/^blocked$/i, i => S.cfd[i][1]], [/^in progress( now)?$/i, i => S.cfd[i][2]],
    [/^chance to finish/i, i => H.chance[i]], [/^by the end, 85 % sure$/i, i => H.p85[i]]
  ];
  /* numbers that do not move between two days: what was fixed at a start, what was agreed, how the app is built */
  const FIXED = /committed at the start|agreed|target|limit|people|^applications$|^sources$|^files|kinds|palette|screens|modules|planned value|^sprint$|tools|engine|write|^facts|read-only|sprint no|^stale$|no answer|not connected|^pi$|requests that write|carry a person|with a definition|domain modules|service levels$|^releases$/i;
  function parse(v) {
    v = String(v).trim(); let m;
    if ((m = v.match(/^([≥≈]?\s?)(\d[\d,]*)(\.\d)?(\s?%)?$/))) return { pre: m[1], n: parseFloat((m[2] + (m[3] || '')).replace(/,/g, '')), dec: m[3] ? 1 : 0, post: m[4] || '', of: null };
    if ((m = v.match(/^(\d+) of (\d+)$/))) return { pre: '', n: +m[1], dec: 0, post: ' of ' + m[2], of: +m[2] };
    return null;
  }
  const fmt = (p, n) => p.pre + (p.dec ? n.toFixed(1) : K.fmt(Math.round(n))) + p.post;
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function generated(key, cur, p, date) {
    const b = back(date); if (b <= 0 || hash(key) < 0.3) return cur;
    const sign = hash(key + '#') < 0.5 ? -1 : 1, rel = (0.05 + 0.2 * hash(key + '$')) * Math.min(1.7, Math.sqrt(b / 7));
    const step = p.dec ? Math.max(0.1, Math.round(cur * rel * 10) / 10) : Math.max(1, Math.round(cur * rel));
    let v = Math.max(0, cur - sign * step);
    if (p.post.indexOf('%') >= 0) v = Math.min(100, v);
    if (p.of != null) v = Math.min(p.of, v);
    return p.dec ? Math.round(v * 10) / 10 : Math.round(v);
  }
  /* called by K.kpis for every cell: the value of the shown day and its change against the reference day */
  SM.cmpCell = function (k) {
    if (!C.on || SM.cmpSkipPage || k.nodelta) return k;
    const p = parse(k.v); if (!p || FIXED.test(k.l)) return k;
    const out = Object.assign({}, k), key = location.hash.split('?')[0] + '|' + k.l, ex = EXACT.find(e => e[0].test(k.l));
    let va, vb;
    if (ex && ex[1](H.days.length - 1) === p.n) {
      const ia = idx(C.a), ib = idx(C.b);
      if (ia < 0 || ib < 0) { out.d = `<span class="dl same">another sprint on ${K.dm(ib < 0 ? C.b : C.a)}</span>`; return out; }
      va = ex[1](ia); vb = ex[1](ib);
    } else { va = generated(key, p.n, p, C.a); vb = generated(key, p.n, p, C.b); }
    const diff = Math.round((va - vb) * 10) / 10, mag = p.dec ? Math.abs(diff).toFixed(1) : K.fmt(Math.abs(diff));
    out.v = fmt(p, va); out.spark = null;
    SM.cmpStats.push({ l: k.l, from: fmt(p, vb), to: fmt(p, va), diff: diff, exact: !!ex });
    out.d = diff === 0 ? `<span class="dl same">= as on ${K.dm(C.b)}</span>`
      : `<span class="dl ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ −'}${mag}</span><span class="was">was ${esc(fmt(p, vb))} on ${K.dm(C.b)}</span>`;
    return out;
  };

  /* the summary on top of a page: the events of its domain between the two days, and how many of its numbers moved */
  const ROLE_DOMS = { sm: ['delivery', 'knowledge'], tl: ['eng', 'quality'], am: ['ops', 'release'], lead: ['delivery', 'knowledge'], po: ['product', 'release', 'delivery'] };
  SM.cmpEvents = () => D.events.filter(e => e.d > C.b && e.d <= C.a);
  SM.cmpSummary = function (cur) {
    if (!C.on || SM.cmpSkipPage) return '';
    const all = SM.cmpEvents(); let ev = all, scope = 'all domains';
    const head = `<div class="cb-h"><span class="cb-i">◷</span><b>${lab(C.b)}</b><span class="arr">→</span><b>${lab(C.a)}</b><span class="faint">${D.snapDays.filter(d => d > C.b && d <= C.a).length} working days · reference on the left</span>
        <span class="grow"></span><button class="btn sm" data-act="cmpmenu">Change the days</button><button class="btn sm" data-act="cmpoff">Stop comparing</button></div>`;
    if (cur.page && cur.page.id === 'events') return `<section class="cmpbar">${head.replace('box-shadow', '')}</section>`;
    const dom = cur.page ? cur.page.domain.id : cur.entity ? cur.entity.domain : null;
    if (cur.entity) { ev = all.filter(e => e.obj === cur.id || (e.to || '').indexOf('/' + cur.id) >= 0 || e.text.indexOf(cur.id) >= 0); scope = cur.id; }
    else if (dom === 'home' && cur.page.id === 'overview') { const fo = SM.ui.focus, fd = SM.domains.find(d => d.id === fo); if (fd) { ev = all.filter(e => e.dom === fo); scope = 'the focus ' + fd.title; } }
    else if (dom === 'home') { ev = all.filter(e => ROLE_DOMS[SM.role].indexOf(e.dom) >= 0); scope = 'the domains of the ' + SM.roleObj().name; }
    else if (dom && dom !== 'misc' && dom !== 'system') { ev = all.filter(e => e.dom === dom); scope = cur.page.domain.title; }
    const n = w => ev.filter(e => w.indexOf(e.kind) >= 0).length, moved = SM.cmpStats.filter(s => s.diff !== 0);
    const days = D.snapDays.filter(d => d > C.b && d <= C.a).length;
    const rows = ev.slice().reverse().slice(0, 6).map(e => `<a class="cb-e" href="${e.to || '#/events'}"><span class="t">${lab(e.d)} ${esc(e.t)}</span>${K.dot(e.tone)}<span class="tx cut">${esc(e.text)}</span></a>`).join('');
    return `<section class="cmpbar"><div class="cb-h"><span class="cb-i">◷</span><b>${lab(C.b)}</b><span class="arr">→</span><b>${lab(C.a)}</b><span class="faint">${days} working day${days === 1 ? '' : 's'} · reference on the left</span>
        <span class="grow"></span><button class="btn sm" data-act="cmpmenu">Change the days</button><button class="btn sm" data-act="cmpoff">Stop comparing</button></div>
      <div class="cb-b"><div class="cb-n"><div><b>${moved.length}</b> of ${SM.cmpStats.length} numbers on this page moved</div>
          <div><b>${ev.length}</b> event${ev.length === 1 ? '' : 's'} in ${esc(scope)}: <span class="c-bad">${n(['worse'])} turned worse</span>, <span class="c-ok">${n(['better', 'done'])} came back or got done</span>, ${n(['in'])} came in, ${n(['change', 'info'])} other</div>
          <div class="faint">${moved.slice(0, 3).map(s => esc(s.l) + ': ' + esc(s.from) + ' → ' + esc(s.to)).join(' · ') || 'No number of this page has a snapshot that differs.'}</div></div>
        <div class="cb-l">${rows || '<span class="faint">No event of this page between the two days.</span>'}${ev.length > 6 ? `<a class="cb-m" href="#/events">and ${ev.length - 6} more in the event log ›</a>` : `<a class="cb-m" href="#/events">all ${all.length} events of the period ›</a>`}</div></div></section>`;
  };

  /* top bar button, and the two days on the line of the PI */
  SM.cmpButton = () => C.on
    ? `<button class="tbtn on cmp-btn" data-act="cmpmenu" data-tip="Comparing two days: click to change them">◷ <b>${K.dm(C.b)}</b> → <b>${K.dm(C.a)}</b></button>`
    : `<button class="tbtn cmp-btn" data-act="cmpmenu" data-tip="Pick two days: every page shows what happened between them and how its numbers moved">◷ Compare days</button>`;
  SM.cmpMarks = function (P) {
    if (!C.on) return '';
    const a = P(C.a), b = P(C.b);
    return `<i class="pl-cmp" style="left:${b}%;width:${Math.max(.4, a - b)}%"></i><i class="pl-cmp-m is-b" style="left:${b}%" data-tip="Reference: ${lab(C.b)}"></i><i class="pl-cmp-m is-a" style="left:${a}%" data-tip="Shown: ${lab(C.a)}"></i>`;
  };

  function menuHtml() {
    const PRE = [['Today', TODAY], ['Yesterday', '2026-11-17'], ['A week ago', '2026-11-11'], ['Start of sprint 42', '2026-11-09'], ['End of sprint 41', '2026-11-06'], ['Release 2026.11', '2026-11-10'], ['Start of the PI', '2026-09-28']];
    const weeks = []; D.snapDays.forEach((d, n) => { if (n % 5 === 0) weeks.push([]); weeks[weeks.length - 1].push(d); });
    const cell = d => {
      const ev = D.events.filter(e => e.d === d), worst = ev.some(e => e.tone === 'bad') ? 'bad' : ev.some(e => e.tone === 'watch') ? 'watch' : ev.length ? 'ok' : '';
      return `<button class="cm-d${d === C.a ? ' is-a' : ''}${d === C.b ? ' is-b' : ''}${d > C.b && d < C.a ? ' in' : ''}" data-act="cmpday" data-d="${d}" data-tip="${lab(d)}${ev.length ? '<small>' + ev.length + ' event' + (ev.length === 1 ? '' : 's') + '</small>' : ''}">${d.slice(8)}${worst ? `<i class="${worst}"></i>` : ''}</button>`;
    };
    return `<div class="cm-h"><b>Compare two days</b><span>one snapshot of the facts per working day</span></div>
      <div class="cm-f"><button class="${C.field === 'b' ? 'on' : ''}" data-act="cmpfield" data-v="b"><small>Reference</small>${lab(C.b)}</button><span class="arr">→</span><button class="${C.field === 'a' ? 'on' : ''}" data-act="cmpfield" data-v="a"><small>Shown</small>${lab(C.a)}</button></div>
      <div class="cm-b"><div class="cm-pre"><small>Set the ${C.field === 'b' ? 'reference' : 'shown day'} to</small>${PRE.map(x => `<button class="${x[1] === C[C.field] ? 'on' : ''}" data-act="cmpday" data-d="${x[1]}">${x[0]}<span>${K.dm(x[1])}</span></button>`).join('')}</div>
        <div class="cm-cal"><div class="cm-w"><span></span>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(x => `<span>${x}</span>`).join('')}</div>
          ${weeks.map(w => `<div class="cm-w"><span>${K.dm(w[0])}</span>${w.map(cell).join('')}</div>`).join('')}
          <div class="cm-leg"><span><i class="bad"></i>something turned off track</span><span><i class="watch"></i>needs a look</span><span><i class="ok"></i>other events</span></div></div></div>
      <div class="cm-foot"><span class="faint">Click a day for the ${C.field === 'b' ? 'reference' : 'shown day'}; the next click sets the other one.</span><span class="grow"></span>${C.on ? '<button class="btn sm" data-act="cmpoff">Stop comparing</button>' : ''}<button class="btn sm pri" data-close>Done</button></div>`;
  }
  function openMenu() {
    const t = document.querySelector('.cmp-btn'), r = t ? t.getBoundingClientRect() : { right: window.innerWidth - 20, bottom: 48 };
    SM.layer().innerHTML = `<div class="scrim nobg" data-close ></div><div class="cmp-menu" style="left:${Math.max(8, Math.min(window.innerWidth - 548, r.right - 540))}px;top:${r.bottom + 8}px">${menuHtml()}</div>`;
  }
  Object.assign(SM.acts, {
    cmpmenu: () => openMenu(),
    cmpfield: t => { C.field = t.getAttribute('data-v'); openMenu(); },
    cmpday: t => {
      C[C.field] = t.getAttribute('data-d'); C.field = C.field === 'b' ? 'a' : 'b';
      if (C.a < C.b) { const x = C.a; C.a = C.b; C.b = x; }
      C.on = C.a !== C.b; SM.render(); openMenu();
    },
    cmpoff: () => { C.on = false; C.a = TODAY; SM.closeOverlays(); SM.render(); }
  });
  SM.cmpSet = function (b, a) { C.b = b; C.a = a || TODAY; C.on = C.a !== C.b; SM.render(); };
})();
