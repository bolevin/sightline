/* Sightline v2 demo: the shell. It owns the frame (top bar with the line of the PI, the rail, the Ask panel),
   the registry of domains, pages, entities and drawers, the router and every shared interaction.
   A domain file calls SM.domain({...}) and knows nothing about the others: that is the plug-in idea of concept.md. */
(function () {
  'use strict';
  const D = window.D, K = window.K, esc = K.esc;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('smv2.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('smv2.' + k, v); } catch (e) { /* private window: the choice lives until reload */ } }
  };

  const SM = {
    domains: [], routes: {}, entities: {}, drawers: {}, order: [],
    role: store.get('role', 'sm'), home: store.get('home', 'overview'), hz: 'sprint', sprint: '42', palette: store.get('palette', 'graphite'),
    ui: {}, src: {},
    HZ: [['today', 'Today'], ['sprint', 'Sprint'], ['pi', 'PI'], ['quarter', 'Quarter']]
  };

  /* palettes: one block of tokens each in css/tokens.css; the choice is kept in this browser */
  SM.palettes = [
    { id: 'auto', name: 'Auto', note: 'follows the light or dark setting of this computer', auto: true },
    { id: 'graphite', name: 'Graphite', note: 'violet-tinted graphite, the default', dark: true },
    { id: 'midnight', name: 'Midnight', note: 'deep blue, cool text', dark: true },
    { id: 'carbon', name: 'Carbon', note: 'neutral black, no tint', dark: true },
    { id: 'slate', name: 'Slate', note: 'dimmed blue-grey, softer contrast', dark: true },
    { id: 'aubergine', name: 'Aubergine', note: 'plum, warm highlights', dark: true },
    { id: 'forest', name: 'Forest', note: 'green-black', dark: true },
    { id: 'mocha', name: 'Mocha', note: 'warm brown-grey', dark: true },
    { id: 'contrast', name: 'High contrast', note: 'black, strong lines', dark: true },
    { id: 'paper', name: 'Paper', note: 'white panels, cool grey page', dark: false },
    { id: 'sand', name: 'Sand', note: 'warm light', dark: false },
    { id: 'mist', name: 'Mist', note: 'blue-grey light', dark: false }
  ];
  SM.setPalette = function (id) {
    if (!SM.palettes.some(p => p.id === id)) id = 'graphite';
    SM.palette = id; store.set('palette', id);
    const shown = id === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'paper' : 'graphite') : id;
    if (shown === 'graphite') document.documentElement.removeAttribute('data-palette'); else document.documentElement.setAttribute('data-palette', shown);
  };
  SM.setPalette(SM.palette);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (SM.palette === 'auto') SM.setPalette('auto'); });

  /* ── registry ─────────────────────────────────────────────────────────── */
  /* domain: {id, title, icon, lede, pages:[{id, title, lede, hz:[...], was, from, render(ctx)}]} */
  SM.domain = function (d) {
    SM.domains.push(d);
    d.pages.forEach(p => { p.domain = d; p.path = '#/' + d.id + '/' + p.id; SM.routes[p.path] = p; SM.order.push(p); });
  };
  /* entity: {kind, title, list (route of its list), was, from, ids(), render(id, ctx)} -> #/kind/ID */
  SM.entity = function (e) { SM.entities[e.kind] = e; };
  /* a screen outside the domains: #/inbox, #/search, #/map, #/team */
  const MISC = { id: 'misc', title: '', hidden: true, noTabs: true, pages: [] };
  SM.single = function (p) { p.domain = MISC; p.path = '#/' + p.id; SM.routes[p.path] = p; SM.order.push(p); MISC.pages.push(p); };
  /* drawer: SM.drawer('pr', id => ({kind, title, body})) -> any element with data-dr="pr:412" */
  SM.drawer = function (kind, fn) { SM.drawers[kind] = fn; };

  SM.go = function (hash) { if (location.hash.split('?')[0] === hash) render(); else location.hash = hash; };
  SM.roleObj = () => D.roles.find(r => r.id === SM.role);
  /* two variants of the home screen: one overview for everybody (the default), or the five homes by role (the earlier variant) */
  SM.homePath = () => SM.home === 'roles' || !SM.routes['#/home/overview'] ? '#/home/' + SM.role : '#/home/overview';
  SM.sprintObj = () => D.cal.sprints.find(s => s.id === SM.sprint);
  SM.scopeLabel = function () {
    const sp = SM.sprintObj();
    return { today: 'Today · ' + D.now.label.slice(0, 14), sprint: 'Sprint ' + sp.id + ' · ' + K.dm(sp.from) + ' to ' + K.dm(sp.to),
      pi: D.cal.pi.id + ' · ' + K.dm(D.cal.pi.from) + ' to ' + K.dm(D.cal.pi.to), quarter: D.cal.quarter.id + ' · 01.10 to 31.12' }[SM.hz];
  };

  function resolve(hash) {
    hash = (hash || '').split('?')[0];
    if (!hash || hash === '#' || hash === '#/') hash = SM.homePath();
    if (SM.routes[hash]) return { page: SM.routes[hash], hash: hash };
    const m = hash.match(/^#\/([a-z]+)\/(.+)$/);
    if (m && SM.entities[m[1]]) {
      const e = SM.entities[m[1]], id = decodeURIComponent(m[2]);
      if (e.ids().indexOf(id) >= 0) return { entity: e, id: id, hash: hash };
    }
    return { missing: hash };
  }
  SM.resolve = resolve;

  /* ── frame ────────────────────────────────────────────────────────────── */
  const ICONS = {
    home: 'M2 7.5 8 2l6 5.5V14H9.5v-4h-3v4H2z', brief: 'M3 2.5h10v11H3zM5.5 2.5V1.2M10.5 2.5V1.2M5.5 6.5h5M5.5 9.5h3', log: 'M5.5 4h8M5.5 8h8M5.5 12h6M2.5 4h.01M2.5 8h.01M2.5 12h.01', inbox: 'M2 3h12v10H2zM2 9h3.5l1 2h3l1-2H14', delivery: 'M2 12h12M3 12V7m3.3 5V4m3.4 8V8m3.3 4V5',
    product: 'M8 1.5 14 5v6l-6 3.5L2 11V5zM2 5l6 3.5L14 5M8 8.5v6', eng: 'M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4M9 2.5 7 13.5', quality: 'M8 1.5 13.5 4v4c0 3-2.3 5.3-5.5 6.5C4.8 13.3 2.5 11 2.5 8V4zM5.5 8l2 2 3.2-3.6',
    ops: 'M1.5 8h3l1.5-4 3 8 1.5-4h4', release: 'M9 2c3 .3 4.7 2 5 5l-4 4-5-5zM5 6 2.5 7 4 8.5M10 11l-1 2.5L7.5 12M4.5 11.5 2 14', knowledge: 'M3 2.5h7.5L13 5v8.5H3zM10 2.5V5h3M5.5 8h5M5.5 10.5h5',
    system: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4', map: 'M2 3.5 6 2l4 1.5L14 2v10.5L10 14l-4-1.5L2 14zM6 2v10.5M10 3.5V14', find: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10.4 10.4 14 14'
  };
  const ico = n => `<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${ICONS[n] || ICONS.system}"/></svg>`;

  /* the strip under the top bar: horizon, the line of the PI, what is in scope.
     The line has three rows: a scale (months, weeks, today), the sprints, and the dates that matter. */
  function strip(supported) {
    const c = D.cal, P = d => K.pos(d, c.from, c.to), now = D.now.date, sel = SM.sprintObj();
    const months = [['2026-10-01', 'Oct'], ['2026-11-01', 'Nov'], ['2026-12-01', 'Dec']].map(m => `<span class="pl-mo" style="left:${P(m[0])}%">${m[1]}</span>`).join('');
    let weeks = '';
    for (let d = K.day(c.from); d <= K.day(c.to); d += 7) weeks += `<i class="pl-wk" style="left:${(d - K.day(c.from)) / (K.day(c.to) - K.day(c.from)) * 100}%"></i>`;
    const sp = c.sprints.map(x => {
      const a = P(x.from), b = P(x.to), on = SM.hz === 'sprint' && x.id === SM.sprint;
      const sub = x.state === 'closed' ? `${x.done} of ${x.committed} SP` : x.state === 'active' ? `day ${D.now.day} of ${D.now.days}` : 'IP, starts ' + K.dm(x.from);
      const el = x.state === 'active' ? `<i class="el" style="width:${K.pos(now, x.from, x.to)}%"></i>` : '';
      const at = x.state === 'active' ? (P(now) - a) / (b - a + 1.05) * 100 : 0;
      const subEl = x.state === 'active' ? `<span class="side" style="${at <= 55 ? 'left:calc(' + at.toFixed(2) + '% + 6px)' : 'right:calc(' + (100 - at).toFixed(2) + '% + 6px)'}">${sub}</span>` : `<span>${sub}</span>`;
      return `<button class="pl-sp is-${x.state}${on ? ' on' : ''}" style="left:${a}%;width:${b - a + 1.05}%" data-sprint="${x.id}" data-tip="${esc(x.name)}<small>${K.dm(x.from)} to ${K.dm(x.to)} · ${x.state}${x.state === 'future' ? '' : ' · ' + x.done + ' SP done of ' + x.committed + ' committed'} · click to look at it</small>">${el}<b>${x.id}</b>${subEl}</button>`;
    }).join('');
    const after = `<span class="pl-after" style="left:${P('2026-12-12')}%;right:0">after the PI</span>`;
    const span = { today: null, sprint: null, pi: [c.pi.from, c.pi.to], quarter: [c.quarter.from, c.quarter.to] }[SM.hz];
    const spanEl = span ? `<i class="pl-span" style="left:${Math.max(0, P(span[0]) - .35)}%;width:${P(span[1]) - P(span[0]) + 1.6}%"></i>` : '';
    const short = { freeze: 'freeze', 'R2026.12': 'R 2026.12', sale: 'Winter sale' };
    const marks = c.marks.map(m => {
      const k = K.release(m.id) ? 'release' : K.incident(m.id) ? 'incident' : null, future = m.d > now;
      const tip = `${esc(m.label)}<small>${K.dm(m.d)}${k ? ' · click to open' : ''}</small>`;
      const inner = `<i></i>${future && short[m.id] ? `<em>${short[m.id]} <u>${K.dm(m.d)}</u></em>` : ''}`;
      return k ? `<a class="pm ${m.kind}${future ? ' fut' : ''}" href="#/${k}/${m.id}" style="left:${P(m.d)}%" data-tip="${tip}">${inner}</a>` : `<span class="pm ${m.kind}${future ? ' fut' : ''}" style="left:${P(m.d)}%" data-tip="${tip}">${inner}</span>`;
    }).join('');
    const lab = SM.scopeLabel().split(' · ');
    const sub = { today: 'working day ' + D.now.day + ' of ' + D.now.days + ' in sprint 42', sprint: sel.state === 'active' ? 'working day ' + D.now.day + ' of ' + D.now.days + ' · 7 left' : sel.state === 'closed' ? 'closed · ' + sel.done + ' of ' + sel.committed + ' SP' : 'not started', pi: 'week 8 of 11 · sprint 3 of 4', quarter: 'week 7 of 13' }[SM.hz];
    const hzSeg = `<div class="seg" data-hz>${SM.HZ.map(h => `<button class="${h[0] === SM.hz ? 'on' : ''}" data-h="${h[0]}"${supported.indexOf(h[0]) < 0 ? ' disabled data-tip="This page has no ' + h[1].toLowerCase() + ' view"' : ''}>${h[1]}</button>`).join('')}</div>`;
    return `<div class="st-team"><a class="teamcard" href="#/team"><b>${esc(D.team.name)}</b><span>${esc(D.team.train)} · ${esc(D.team.pi)}</span></a></div>
      <div class="pl${SM.hz === 'today' ? ' hz-today' : ''}" aria-label="The line of the PI: sprints, releases, incidents, dates, today">
        <div class="pl-scale">${weeks}${months}<span class="pl-now-l" style="left:${P(now)}%">today · ${esc(D.now.label.slice(0, 9))}</span></div>
        <div class="pl-track">${spanEl}${sp}${after}</div>
        <div class="pl-marks">${marks}</div>
        ${SM.cmpMarks ? SM.cmpMarks(P) : ''}
        <i class="pl-now" style="left:${P(now)}%"></i>
      </div>
      <div class="st-leg"><span><i class="g rel"></i>release</span><span><i class="g plan"></i>planned</span><span><i class="g inc"></i>incident</span><span><i class="g flag"></i>date</span></div>
      <div class="st-time"><div class="st-t1">${hzSeg}${SM.cmpButton ? SM.cmpButton() : ''}</div><div class="st-t2"><b>${esc(lab[0])}</b> ${esc(lab[1] || '')}${sub ? ' · ' + esc(sub) : ''}</div></div>`;
  }

  function srcSummary() {
    const st = D.sources.map(s => K.srcState(s.id)), n = w => st.filter(x => x === w).length;
    const bits = [];
    if (n('down')) bits.push(`<b class="c-bad">${n('down')} down</b>`);
    if (n('stale')) bits.push(`<b class="c-watch">${n('stale')} stale</b>`);
    if (n('off')) bits.push(`${n('off')} off`);
    return `<button class="tbtn" id="src-btn" data-act="srcmenu" aria-haspopup="true" data-tip="Every panel names its sources and their age. Click for all of them.">${K.dot(n('down') ? 'bad' : n('stale') ? 'watch' : 'ok')}${D.sources.length} sources${bits.length ? ' · ' + bits.join(' · ') : ''}</button>`;
  }

  function top(cur) {
    const pal = SM.palettes.find(p => p.id === SM.palette) || SM.palettes[0];
    return `<button class="menu-btn" data-act="railtoggle" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button><a class="brand" href="${SM.homePath()}"><svg class="mark" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="8.5" fill="none" stroke="var(--ink)" stroke-width="2"/><path d="M1.5 14H8M20 14h6.5" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="14" r="3.2" fill="var(--s1)"/></svg><span><b>Sightline</b><span class="sub">v2 demo · invented data</span></span></a><a class="demo-pill" href="../demo/" data-tip="The design of the next version. The team and every number on these pages are invented and prepared by hand. The working version, where code computes every number from the data, opens here."><span class="dp-l">Design demo · invented numbers</span><b>Working version ↗</b></a>
      <button class="cmdline" data-cmd-open data-tip="A short command is answered at once from the facts. A question goes to the agent."><span class="ai-spark">✦</span><span class="ph">A command, a question or a few words from a name<i> · status · KES-4131 · what is stuck?</i></span><kbd>Ctrl K</kbd></button>
      <span class="grow"></span>
      <button class="tbtn" id="refresh" data-act="refresh"${SM.reading ? ' disabled' : ''} data-tip="Read every source again. The page also does it by itself every few minutes.">${refreshLabel()}</button>
      ${srcSummary()}
      <a class="tbtn" href="#/inbox" data-tip="Notices, decisions waiting and drafts. The number is what is new since your last look.">Inbox${SM.noticesFresh() ? ` <span class="cnt">${SM.noticesFresh()}</span>` : ''}</a>
      <button class="plt-btn" data-act="palmenu" aria-label="Palette" data-tip="Palette: ${esc(pal.name)}"><i class="sw-bg"></i><i class="sw-plane-3"></i><i class="sw-s1"></i><i class="sw-ok"></i></button>
      <button class="cmd-btn${SM.cmd && SM.cmd.open ? ' on' : ''}" data-cmd-open><span class="ai-spark">✦</span>AI Command</button>`;
  }

  function rail(cur) {
    const r = SM.roleObj(), here = cur.hash, byRole = SM.home === 'roles' || !SM.routes['#/home/overview'], next = SM.briefNext && SM.briefNext();
    const a = (href, label, extra, cls) => `<a href="${href}" class="${(here === href ? 'on ' : '') + (cls || '')}"${here === href ? ' aria-current="page"' : ''}>${label}${extra || ''}</a>`;
    const curDom = cur.page ? cur.page.domain.id : cur.entity ? cur.entity.domain : null, fresh = SM.noticesFresh(), pins = SM.myPins();
    const doms = SM.domains.filter(d => !d.hidden).map(d => {
      const inside = curDom === d.id;      // the pages of a domain are the tabs in the head of the page
      return `<div class="dom"><a href="${d.pages[0].path}" class="${inside ? 'on' : ''}"${inside ? ' aria-current="location"' : ''}>${ico(d.icon || d.id)}${esc(d.title)}</a></div>`;
    }).join('');
    const pinRows = pins.map((p, i) => `<a href="${esc(p.h)}" data-pin="${i}" draggable="true">${K.dot(p.t || '', !p.t)}<span class="cut">${esc(p.l)}</span></a>`).join('');
    return `<div class="rail-blk">
        <div class="homesw" data-tip="Two variants of the home screen, to compare. Overview: one home for everybody. By role: the five homes of the earlier variant. Every other page is the same in both."><a href="#/home/overview" class="${byRole ? '' : 'sel'}">Overview</a><a href="#/home/${SM.role}" class="${byRole ? 'sel' : ''}">By role</a></div>
        ${byRole ? `<div class="roles mt-6" >${D.roles.map(x => `<button class="${x.id === SM.role ? 'on' : ''}" data-role="${x.id}" data-tip="${esc(x.asks)}">${esc(x.short || x.name)}</button>`).join('')}</div>
        <div class="role-q">${esc(r.asks)}</div>` : ''}
      </div>
      <nav class="rail-blk nav" aria-label="Main">
        ${a(SM.homePath(), ico('home') + 'Home')}
        ${SM.routes['#/briefings'] ? a('#/briefings', ico('brief') + 'Briefings', next ? `<span class="cnt">${esc(next.name)}</span>` : '') : ''}
        ${a('#/inbox', ico('inbox') + 'Inbox', fresh ? `<span class="cnt">${fresh}</span>` : '')}
        ${a('#/events', ico('log') + 'Event log', `<span class="cnt">${D.events.filter(e => e.d === D.now.date).length}</span>`)}
        <div class="rail-h mt-10" ><span>Pinned</span><span data-tip="Your own list. Pin any page or view with the button in its head; drag a row to move it.">drag to sort</span></div>
        <div class="pins">${pinRows || '<div class="pin-none">Pin a page with the button in its head.</div>'}</div>
        <div class="rail-h mt-10" >Domains</div>
        ${doms}
        <div class="rail-h mt-10" >Find and check</div>
        ${a('#/search', ico('find') + 'Search')}
        ${a('#/map', ico('map') + 'Map of all screens')}
      </nav>`;
  }

  function pageHtml(cur, ctx) {
    if (cur.missing) {
      return `<div class="page"><div class="phead"><div><div class="crumbs">Not found</div><h1>No screen at ${esc(cur.missing)}</h1><div class="lede">The address names no screen of this demo. Every screen is listed on the map.</div></div></div><a class="btn pri" href="#/map">Open the map</a></div>`;
    }
    let res, crumbs = '', heading = '', tabs = '';
    SM.cmpStats = [];
    SM.cmpSkipPage = !!(cur.page && (cur.page.domain.id === 'system' || (cur.page.domain.id === 'misc' && cur.page.id !== 'events')));
    if (cur.page) {
      const p = cur.page, d = p.domain, own = d.pages.filter(x => !x.hidden);
      res = p.render(ctx);
      const title = (res && res.title) || p.h1 || p.title;
      if (own.length > 1 && !d.noTabs) {
        // one line: the domain, its pages as tabs; the page's own name stays in the heading for a screen reader
        heading = `<span class="ph-dom">${esc(d.title)}</span><span class="vh"> › ${esc(title)}</span>`;
        tabs = `<nav class="tabs" aria-label="Pages of ${esc(d.title)}">${own.map(x => `<a href="${x.path}" class="${x === p ? 'on' : ''}"${x === p ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}</nav>`;
      } else heading = esc(title);
    } else {
      const e = cur.entity; res = e.render(cur.id, ctx);
      const dom = SM.domains.find(d => d.id === e.domain);
      crumbs = `<a href="${dom.pages[0].path}">${esc(dom.title)}</a> › <a href="${e.list}">${esc(e.title)}</a> › ${esc(cur.id)}`;
    }
    if (typeof res === 'string') res = { body: res };
    const lede = res.lede || (cur.page && cur.page.lede) || '';
    const kp = res.kpis ? K.kpis(res.kpis) : '', summary = SM.cmpSummary ? SM.cmpSummary(cur) : '';
    return `<div class="page">
      <div class="phead">${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}${heading ? `<h1>${heading}</h1>` : ''}${tabs}${lede ? `<div class="lede" data-full="${esc(lede)}">${lede}</div>` : '<span class="grow"></span>'}<div class="acts">${res.acts || ''}<button class="tbtn pin-btn" data-act="pinmenu" aria-pressed="false">☆ Pin</button></div></div>
      ${summary}${kp}${res.body || ''}</div>`;
  }

  /* ── pins: the user's own pages and views. A pin keeps the address, so it also keeps the focus, days, filters and sort. ── */
  const PIN_SEED = [
    { h: '#/delivery/sprint', l: 'Sprint', t: 'bad' }, { h: '#/product/objectives', l: 'Objectives', t: 'bad' }, { h: '#/release/readiness', l: 'Release readiness', t: 'bad' },
    { h: '#/ops/services', l: 'Applications', t: 'watch' }, { h: '#/eng/prs', l: 'Pull requests', t: 'watch' },
    { h: '#/home/overview?focus=release', l: 'Release week', t: '' }, { h: '#/home/overview?hz=today&focus=ops', l: 'Operations today', t: '' }
  ];
  SM.myPins = () => {
    try { const v = JSON.parse(store.get('pins', 'null')); if (Array.isArray(v)) return v.filter(p => p && /^#\//.test(p.h) && typeof p.l === 'string'); } catch (e) { /* a broken entry falls back to the seed */ }
    return PIN_SEED.map(p => Object.assign({}, p));
  };
  const savePins = list => store.set('pins', JSON.stringify(list));
  const canon = h => {
    const parts = String(h).split('?'), u = new URLSearchParams(parts[1] || '');
    if (u.get('hz') === 'sprint') u.delete('hz');
    const q = Array.from(u.entries()).map(x => x.join('=')).sort().join('&');
    return parts[0] + (q ? '?' + q : '');
  };
  const pinIndex = () => { const now = canon(location.hash); return SM.myPins().findIndex(p => canon(p.h) === now); };
  function markPins() {
    const now = canon(location.hash), i = pinIndex(), b = document.querySelector('#main .pin-btn');
    document.querySelectorAll('.rail [data-pin]').forEach(a => a.classList.toggle('here', canon(a.getAttribute('href')) === now));
    if (b) { b.setAttribute('aria-pressed', i >= 0 ? 'true' : 'false'); b.classList.toggle('on', i >= 0); b.textContent = i >= 0 ? '★ Pinned' : '☆ Pin'; }
  }
  /* a pin opens exactly what was saved: what the user chose on other pages does not leak into it */
  SM.openView = function (h) {
    Object.keys(chosen).forEach(k => { delete SM.ui[k]; delete chosen[k]; });
    SM.hz = 'sprint'; SM.sprint = D.sprint.id; SM.sorts = {};
    if (SM.cmp) { SM.cmp.on = false; SM.cmp.a = D.now.date; }
    if (location.hash === h) { readAddress(); render(); } else location.hash = h;
  };
  let dragPin = null;
  document.addEventListener('dragstart', ev => { const a = ev.target.closest && ev.target.closest('[data-pin]'); if (!a) return; dragPin = +a.getAttribute('data-pin'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', a.getAttribute('href')); });
  document.addEventListener('dragover', ev => {
    const a = ev.target.closest && ev.target.closest('[data-pin]');
    document.querySelectorAll('.rail .drag-to').forEach(x => x.classList.remove('drag-to'));
    if (a && dragPin != null) { ev.preventDefault(); a.classList.add('drag-to'); }
  });
  document.addEventListener('drop', ev => {
    const a = ev.target.closest && ev.target.closest('[data-pin]');
    if (!a || dragPin == null) return;
    ev.preventDefault();
    const list = SM.myPins(), to = +a.getAttribute('data-pin'), moved = list.splice(dragPin, 1)[0];
    list.splice(to, 0, moved); savePins(list); dragPin = null; render();
  });
  document.addEventListener('dragend', () => { dragPin = null; document.querySelectorAll('.rail .drag-to').forEach(x => x.classList.remove('drag-to')); });

  function pinName(cur) {
    const base = cur.page ? (cur.page.h1 || cur.page.title) : cur.id, fo = SM.ui.focus;
    return cur.page && cur.page.id === 'overview' && fo && fo !== 'all' ? base + ': ' + fo : base;
  }

  /* ── the card of a key: rest the pointer on it, P pins it, Esc closes it. The title is shown here and kept nowhere. ── */
  let card = null, cardT = null, cardPinned = false;
  function cardData(key) {
    const row = (k, v) => v == null || v === '' ? '' : `<dt>${esc(k)}</dt><dd>${v}</dd>`;
    const i = K.issue(key);
    if (i) return { kind: (i.type || 'Bug'), title: i.title, href: '#/issue/' + key, rows: row('Status', K.status(i.st)) + row('Story points', i.sp) + row('Priority', i.prio && esc(i.prio)) + row('Days in this status', i.dis) + row('Age', i.age != null ? i.age + ' days' : null) + row('Sprint no.', i.n) + row('Feature', i.feat && esc(i.feat)) + row('Application', i.svc && esc(i.svc)) };
    const f = K.feature(key);
    if (f) return { kind: 'Feature', title: f.title, href: '#/feature/' + key, rows: row('State', esc(K.stateWord[f.state])) + row('Story points', f.done + ' of ' + f.sp + ' done') + row('Forecast', K.dm(f.eta[0]) + ' to ' + K.dm(f.eta[1])) + row('Release', f.rel && esc(f.rel)) };
    const r = K.release(key);
    if (r) return { kind: 'Release', title: r.name, href: '#/release/' + key, rows: row('Date', esc(r.date)) + row('Code freeze', r.freeze && esc(r.freeze)) + row('Issues', r.issues != null ? r.issuesDone + ' of ' + r.issues + ' done' : null) };
    const n = K.incident(key);
    if (n) return { kind: 'Incident', title: n.title, href: '#/incident/' + key, rows: row('Application', esc(n.svc)) + row('When', esc(n.at)) };
    const k = D.risks.find(x => x.id === key);
    if (k) return { kind: 'Risk', title: k.title, href: '#/knowledge/risks', rows: row('ROAM', esc(k.roam)) + row('Level', esc(K.stateWord[k.level])) + row('Owner', esc(k.owner)) + row('Review', esc(k.review)) };
    const d = D.decisions.find(x => x.id === key);
    if (d) return { kind: 'Decision', title: d.title, href: '#/knowledge/decisions', rows: row('State', d.state === 'made' ? 'decided ' + esc(d.on) : 'due ' + esc(d.due)) + row('Owner', esc(d.owner)) };
    return null;
  }
  function closeCard() { clearTimeout(cardT); if (card) card.remove(); card = null; cardPinned = false; }
  function openCard(el) {
    const key = (el.textContent || '').trim().replace(/^#/, ''), c = cardData(key); if (!c) return;
    if (card) card.remove();
    card = document.createElement('div'); card.className = 'kcard'; card.setAttribute('role', 'tooltip');
    card.innerHTML = `<div class="kc-h"><span class="mono">${esc(key)}</span><span class="faint">${esc(c.kind)}</span></div><div class="kc-t ttl-t">${esc(c.title)}</div><dl class="kc-d">${c.rows}</dl>
      <div class="kc-f"><span class="kc-hint">P pins this card · Esc closes it</span><span class="kc-do"><a class="btn sm" href="${c.href}">Open</a><button class="btn sm" data-act="kcclose">Close</button></span></div>`;
    document.body.appendChild(card);
    const r = el.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    card.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    card.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  }
  const aimCard = el => { if (cardPinned) return; clearTimeout(cardT); cardT = setTimeout(() => openCard(el), 320); };
  const leaveCard = () => { if (cardPinned) return; clearTimeout(cardT); cardT = setTimeout(closeCard, 100); };
  document.addEventListener('mouseover', ev => { const k = ev.target.closest && ev.target.closest('.key'); if (k) aimCard(k); });
  document.addEventListener('mouseout', ev => { if (ev.target.closest && ev.target.closest('.key')) leaveCard(); });
  document.addEventListener('focusin', ev => { if (ev.target.matches && ev.target.matches('.key:focus-visible')) aimCard(ev.target); });
  document.addEventListener('focusout', ev => { if (ev.target.matches && ev.target.matches('.key')) leaveCard(); });
  document.addEventListener('mousedown', ev => { if (!cardPinned || !ev.target.closest('.kcard')) closeCard(); }, true);

  /* ── Refresh: reads every source again; the page also does it by itself ── */
  const refreshLabel = () => SM.reading ? '<span class="rf-i">↻</span>Reading…' : `<span class="rf-i">↻</span>Read at ${esc(D.now.label.slice(-5))}`;
  function readAgain(quiet) {
    if (SM.reading) return;
    SM.reading = true;
    const paint = () => { const b = document.getElementById('refresh'); if (b) { b.disabled = !!SM.reading; b.classList.toggle('is-reading', !!SM.reading); b.innerHTML = refreshLabel(); } };
    paint();
    setTimeout(() => {
      SM.reading = false; paint();
      if (!quiet) { const st = D.sources.map(s => K.srcState(s.id)); toast(`Read again: ${st.filter(x => x === 'ok').length} of ${st.length} sources answer. Nothing was written anywhere.`); }
    }, 900);
  }
  setInterval(() => { if (!document.hidden) readAgain(true); }, 300000);

  /* ── notices: what is new since the last look at the Inbox ── */
  SM.noticesFresh = () => store.get('noticesSeen', '') === '1' ? 0 : D.notices.filter(n => /^\d/.test(n.at)).length;

  /* ── the view in the address ──────────────────────────────────────────────
     #/home/overview?focus=ops&hz=pi&f.prom=ok : what a person chose on a page, so that a reload or a copied link shows the same.
     Only what somebody chose goes in. A value is a plain word: nothing from the address can reach the page as markup. */
  const chosen = {};
  SM.sorts = {};
  SM.touch = k => { chosen[k] = 1; };
  const plain = v => /^[\w.-]{1,40}$/.test(v) ? v : null;
  function readAddress() {
    const q = location.hash.split('?')[1]; if (!q) return;
    let cmp = null;
    new URLSearchParams(q).forEach((val, k) => {
      const v = plain(val); if (!v) return;
      if (k === 'hz') { if (SM.HZ.some(h => h[0] === v)) SM.hz = v; }
      else if (k === 'sprint') { if (D.cal.sprints.some(x => x.id === v)) SM.sprint = v; }
      else if (k === 'cmp') cmp = v.split('_');
      else if (/^sort\.\d{1,2}$/.test(k)) { if (/^\d{1,2}[ad]$/.test(v)) { const b = location.hash.split('?')[0]; (SM.sorts[b] = SM.sorts[b] || {})[k.slice(5)] = v; } }
      else if (/^f\.[a-z][\w-]{0,20}$/.test(k)) { SM.ui['f:' + k.slice(2)] = v; chosen['f:' + k.slice(2)] = 1; }
      else if (/^[a-z][\w-]{0,20}$/.test(k) && !(k in Object.prototype)) { SM.ui[k] = v; chosen[k] = 1; }
    });
    if (cmp && SM.cmp && D.snapDays.indexOf(cmp[0]) >= 0 && D.snapDays.indexOf(cmp[1]) >= 0 && cmp[0] < cmp[1]) { SM.cmp.b = cmp[0]; SM.cmp.a = cmp[1]; SM.cmp.on = true; }
  }
  function writeAddress(cur, sup) {
    if (cur.missing) return;
    const q = new URLSearchParams(), main = document.getElementById('main'), dflt = sup.indexOf('sprint') >= 0 ? 'sprint' : sup[0];
    if (sup.length > 1 && SM.hz !== dflt) q.set('hz', SM.hz);
    if (sup.indexOf('sprint') >= 0 && SM.sprint !== D.sprint.id) q.set('sprint', SM.sprint);
    if (SM.cmp && SM.cmp.on && !SM.cmpSkipPage) q.set('cmp', SM.cmp.b + '_' + SM.cmp.a);
    const keys = [].concat(cur.page && cur.page.state || []);
    main.querySelectorAll('[data-seg]').forEach(x => keys.push(x.getAttribute('data-seg')));
    main.querySelectorAll('[data-tabs]').forEach(x => keys.push(x.getAttribute('data-tabs')));
    keys.forEach(k => { if (chosen[k] && SM.ui[k] != null && SM.ui[k] !== 'all') q.set(k, SM.ui[k]); });
    main.querySelectorAll('[data-filter]').forEach(x => { const g = x.getAttribute('data-filter'); if (chosen['f:' + g] && SM.ui['f:' + g]) q.set('f.' + g, SM.ui['f:' + g]); });
    const sorted = SM.sorts[cur.hash]; if (sorted) Object.keys(sorted).forEach(i => q.set('sort.' + i, sorted[i]));
    const text = q.toString(), url = cur.hash + (text ? '?' + text : '');
    if (location.hash !== url) history.replaceState(history.state, '', url);
    markPins();
  }
  let lastSup = ['sprint'];
  const syncAddress = () => writeAddress(resolve(location.hash), lastSup);
  /* every entry of the history remembers how far it was scrolled; a new page starts at the top */
  const scrolls = {};
  let entry = null;
  function arrive() {
    const st = history.state;
    if (st && st.smEntry) { entry = st.smEntry; return scrolls[entry] || 0; }
    entry = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    history.replaceState({ smEntry: entry }, '');
    return 0;
  }

  /* ── the layout of a page ───────────────────────────────────────────────
     Panels keep their natural height and stack under each other, so a short one never leaves a hollow panel.
     A table that does not fit gets tighter first, then the whole row. A small step at the bottom of a column is closed. */
  const STEP = 110;
  const cutTables = k => Array.from(k.querySelectorAll('.tbwrap')).filter(w => w.clientWidth && w.scrollWidth > w.clientWidth + 1);
  function packGrids() {
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 12;
    document.querySelectorAll('#main .grid').forEach(g => {
      if (!g.getClientRects().length) return;
      const kids = Array.from(g.children);
      g.classList.remove('packed'); g.classList.add('measuring');
      kids.forEach(k => { k.style.gridRowEnd = ''; k.classList.remove('fit12'); k.querySelectorAll('.tbwrap.tight').forEach(w => w.classList.remove('tight')); });
      K.fitCharts(g);
      kids.forEach(k => {
        const cut = cutTables(k); if (!cut.length) return;
        cut.forEach(w => w.classList.add('tight'));
        if (cutTables(k).length) { k.classList.add('fit12'); K.fitCharts(k); }
      });
      const spans = kids.map(k => Math.ceil(k.getBoundingClientRect().height + gap));
      g.classList.remove('measuring'); g.classList.add('packed');
      kids.forEach((k, i) => { k.style.gridRowEnd = 'span ' + spans[i]; });
      const r = kids.map(k => k.getBoundingClientRect()), end = Math.max.apply(null, r.map(x => x.bottom));
      kids.forEach((k, i) => {
        let below = end;
        r.forEach((o, j) => { if (j !== i && o.top >= r[i].bottom - 1 && o.left < r[i].right - 1 && o.right > r[i].left + 1) below = Math.min(below, o.top - gap); });
        const step = Math.round(below - r[i].bottom);
        if (step > 0 && step <= STEP) k.style.gridRowEnd = 'span ' + (spans[i] + step);
      });
    });
  }

  /* B9: a table wider than its panel fades out at the edge, so that it does not look complete */
  const markOne = w => w.classList.toggle('more-r', w.scrollWidth - w.clientWidth - w.scrollLeft > 2);
  const pageChanged = new MutationObserver(() => { cancelAnimationFrame(pageChanged.t); pageChanged.t = requestAnimationFrame(markWide); });
  const markWide = () => {
    const main = document.getElementById('main');
    pageChanged.disconnect();
    K.fitCharts();
    packGrids();
    pageChanged.observe(main, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    document.querySelectorAll('.tbwrap').forEach(markOne);
    document.querySelectorAll('#main .phead .lede, #main .pan-h [data-full]').forEach(l => {   // a line that is cut shows its whole text on hover
      if (l.scrollWidth > l.clientWidth + 1) l.setAttribute('data-tip', l.getAttribute('data-full')); else l.removeAttribute('data-tip');
    });
  };
  document.addEventListener('scroll', ev => { if (ev.target.classList && ev.target.classList.contains('tbwrap')) markOne(ev.target); }, true);
  let wideT, wideW = 0;
  new ResizeObserver(es => { const w = Math.round(es[0].contentRect.width); if (w === wideW) return; wideW = w; clearTimeout(wideT); wideT = setTimeout(markWide, 60); }).observe(document.getElementById('main'));

  let lastHash = null;
  function render() {
    const cur = resolve(location.hash);
    // a lens home follows the lens; a page that lacks the chosen horizon falls back to its own first
    if (cur.page && cur.page.domain.id === 'home') {
      const isRole = D.roles.some(x => x.id === cur.page.id), mode = isRole ? 'roles' : 'overview';
      if (isRole && cur.page.id !== SM.role) { SM.role = cur.page.id; store.set('role', SM.role); }
      if (mode !== SM.home) { SM.home = mode; store.set('home', mode); }
    }
    const sup = cur.page && cur.page.hz ? cur.page.hz : cur.entity && cur.entity.hz ? cur.entity.hz : ['sprint'];
    if (sup.indexOf(SM.hz) < 0) SM.hz = sup[0];
    const ctx = { role: SM.role, hz: SM.hz, sprint: SM.sprint, sp: SM.sprintObj(), pick: o => o[SM.hz] != null ? o[SM.hz] : o[Object.keys(o)[0]] };
    const app = document.getElementById('app');
    document.body.classList.toggle('no-titles', store.get('titles', '1') !== '1');
    const main = document.getElementById('main'), keep = lastHash === cur.hash ? main.scrollTop : 0;
    if (!cardPinned) closeCard();
    if (cur.page && cur.page.id === 'inbox') { const fresh = SM.noticesFresh(); if (fresh) { SM.freshRows = fresh; if (SM.keepNew) SM.keepNew = false; else store.set('noticesSeen', '1'); } } else SM.freshRows = 0;
    document.getElementById('top').innerHTML = top(cur);
    document.getElementById('strip').innerHTML = strip(sup);
    const railEl = document.getElementById('rail'), rs = railEl.scrollTop;
    railEl.innerHTML = rail(cur); railEl.scrollTop = rs;
    let html;
    K.chartsReset();
    try { html = pageHtml(cur, ctx); }
    catch (e) { console.error(e); html = `<div class="page"><div class="pst is-down"><span class="gl">!</span><div><b>This screen failed to draw</b>${esc(e.message)}</div></div></div>`; }
    main.innerHTML = html; main.scrollTo({ top: keep, behavior: 'instant' });
    if (SM.cmdRender) SM.cmdRender();
    const p = cur.page, e = cur.entity;
    document.title = (p ? p.title + ' · ' + (p.domain.hidden ? '' : p.domain.title + ' · ') : e ? cur.id + ' · ' : '') + 'Sightline v2';
    applyFilters();
    applySorts(cur.hash);
    markWide();
    lastSup = sup;
    writeAddress(cur, sup);
    lastHash = cur.hash;
    if (SM.wantSearch && cur.page && cur.page.id === 'search') { SM.wantSearch = false; const box = main.querySelector('.inp'); if (box) { box.focus(); box.select(); } }
  }
  SM.render = render;

  /* ── overlays ─────────────────────────────────────────────────────────── */
  const layer = () => document.getElementById('layer');
  let opener = null;
  function closeOverlays() {
    const had = !!layer().querySelector('.drawer');
    layer().innerHTML = ''; if (tipEl) tipEl.hidden = true;
    if (had && opener && document.contains(opener)) opener.focus({ preventScroll: true });
    if (had) opener = null;
  }
  SM.openDrawer = function (kind, id) {
    const fn = SM.drawers[kind]; if (!fn) return;
    const d = fn(id); if (!d) return;
    closeCard();
    if (!layer().querySelector('.drawer')) opener = document.activeElement;
    layer().innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(d.title)}"><div class="dr-h"><div class="grow"><div class="k0">${d.kind}</div><h2>${esc(d.title)}</h2></div><button class="x" data-close aria-label="Close">×</button></div><div class="dr-b">${d.body}</div></aside>`;
    layer().querySelector('.drawer').focus({ preventScroll: true });
    markWide();
  };
  SM.drawer('ev', function (id) {
    const f = D.facts[id]; if (!f) return null;
    const ids = f.srcs || (f.src ? [f.src] : []), s = ids.length ? K.source(ids[0]) : null;
    return { kind: 'Evidence · fact <span class="mono">' + esc(id) + '</span>', title: f.say, body:
      K.sect('What is counted') + `<p class="dim fs-12 lh-155" >${esc(f.def)}</p>` +
      K.sect('Where it comes from') + K.kv([['Source', s ? ids.map(K.srcChip).join(' ') : 'your own notes, on this computer'], ['Read with', ids.length === 1 ? '<span class="mono">' + esc(s.via) + '</span>' : ids.length ? 'each source with its own reader' : 'nothing is read from outside'], ['Rows behind it', K.fmt(f.rows)], ['Definition', esc(f.v)], ['Read at', (ids.length === 1 ? esc(s.last) + ' · ' : '') + esc(D.now.label.slice(0, 14))]]) +
      K.sect('The query') + `<div class="code">${esc(f.q)}</div>` +
      K.sect('Who may use it') + K.list([{ tone: 'ok', html: 'Pages: every panel that shows this number reads this fact' }, f.notes ? { tone: 'ok', html: 'The agent never gets your own notes' } : { tone: 'ok', html: 'The agent: may cite it; a sentence whose number is not this number is dropped' }, { tone: '', html: 'A change of the definition gets a new version and shows here' }]) +
      `<div class="rowf mt-14" ><a class="btn sm" href="#/system/facts">All facts</a>${ids.length === 1 ? K.extLink('Open the query in ' + s.name, s.name) : ''}</div>` };
  });

  function popover(el, html) {
    const r = el.getBoundingClientRect();
    layer().innerHTML = `<div class="scrim nobg" data-close ></div><div class="pop" style="left:${Math.max(8, Math.min(window.innerWidth - 340, r.left - 150))}px;top:${Math.min(window.innerHeight - 160, r.bottom + 8)}px">${html}</div>`;
  }
  let toastT;
  function toast(text) {
    let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  SM.toast = toast;

  /* what can be opened by name: screens, objects, commands. AI Command uses this list. */
  function paletteItems() {
    const it = [];
    SM.order.filter(p => !p.hidden).forEach(p => it.push({ g: 'Screens', kd: p.domain.hidden ? 'Screen' : p.domain.title, label: p.title, href: p.path, hay: p.title + ' ' + p.domain.title + ' ' + (p.find || '') }));
    D.services.forEach(s => it.push({ g: 'Applications', kd: 'Application', label: s.name, hint: s.id, href: '#/service/' + s.id, hay: s.name + ' ' + s.id }));
    D.features.forEach(f => it.push({ g: 'Features', kd: f.key, label: f.title, href: '#/feature/' + f.key, hay: f.key + ' ' + f.title }));
    D.issues.concat(D.bugs.openList.filter(b => !D.issues.some(i => i.key === b.key))).forEach(i => it.push({ g: 'Issues', kd: i.key, label: i.title, href: '#/issue/' + i.key, hay: i.key + ' ' + i.title }));
    D.releases.forEach(r => it.push({ g: 'Releases', kd: 'Release', label: r.name, hint: r.date, href: '#/release/' + r.id, hay: r.id + ' ' + r.name }));
    D.incidents.forEach(i => it.push({ g: 'Incidents', kd: i.id, label: i.title, hint: i.at, href: '#/incident/' + i.id, hay: i.id + ' ' + i.title + ' ' + i.svc }));
    if (SM.home === 'roles') D.roles.forEach(r => it.push({ g: 'Commands', kd: 'View as', label: 'View as ' + r.name, cmd: () => { SM.role = r.id; store.set('role', r.id); SM.go('#/home/' + r.id); }, hay: 'view as role ' + r.name + ' ' + r.code }));
    if (SM.moreItems) SM.moreItems().forEach(x => it.push(x));
    SM.HZ.forEach(h => it.push({ g: 'Commands', kd: 'Horizon', label: 'Show ' + h[1].toLowerCase(), cmd: () => { SM.hz = h[0]; render(); }, hay: 'horizon scope ' + h[1] }));
    SM.palettes.forEach(p => it.push({ g: 'Commands', kd: 'Palette', label: 'Palette ' + p.name, cmd: () => { SM.setPalette(p.id); render(); }, hay: 'palette theme colour ' + p.name + ' ' + p.id }));
    return it;
  }
  SM.items = paletteItems;

  /* ── shared behaviour ─────────────────────────────────────────────────── */
  function sortTable(th, desc) {
    const n = +th.getAttribute('data-sort'), tb = th.closest('table').tBodies[0];
    th.parentNode.querySelectorAll('th').forEach(h => h.classList.remove('asc', 'desc')); th.classList.add(desc ? 'desc' : 'asc');
    Array.from(tb.rows).sort((a, b) => {
      const x = a.cells[n].getAttribute('data-s'), y = b.cells[n].getAttribute('data-s'), nx = parseFloat(x), ny = parseFloat(y);
      const c = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : String(x).localeCompare(String(y));
      return desc ? -c : c;
    }).forEach(r => tb.appendChild(r));
  }
  function applySorts(base) {
    const want = SM.sorts[base]; if (!want) return;
    const tables = document.querySelectorAll('#main table.tb');
    Object.keys(want).forEach(i => {
      const m = /^(\d{1,2})([ad])$/.exec(want[i]), table = tables[+i]; if (!m || !table) return;
      const th = table.querySelector('th[data-sort="' + m[1] + '"]'); if (th) sortTable(th, m[2] === 'd');
    });
  }
  function applyFilters() {
    document.querySelectorAll('[data-filter]').forEach(box => {
      const g = box.getAttribute('data-filter'), cur = SM.ui['f:' + g] || 'all';
      box.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.getAttribute('data-fv') === cur));
      document.querySelectorAll('[data-f-' + g + ']').forEach(el => {
        el.hidden = !(cur === 'all' || (' ' + el.getAttribute('data-f-' + g) + ' ').indexOf(' ' + cur + ' ') >= 0);
      });
    });
  }
  document.addEventListener('click', function (ev) {
    const pinLink = ev.target.closest && ev.target.closest('a[data-pin]');
    if (pinLink && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) { ev.preventDefault(); SM.openView(pinLink.getAttribute('href')); return; }
    const t = ev.target.closest('[data-close],[data-role],[data-h],[data-sprint],[data-ev],[data-dr],[data-help],[data-tab],[data-fv],[data-sv],[data-toast],[data-sort],[data-go],[data-act]');
    if (!t) return;
    if (t.hasAttribute('data-close')) { closeOverlays(); return; }
    if (t.hasAttribute('data-role')) { SM.role = t.getAttribute('data-role'); store.set('role', SM.role); const cur = resolve(location.hash); if (cur.page && cur.page.domain.id === 'home') SM.go('#/home/' + SM.role); else render(); return; }
    if (t.hasAttribute('data-h')) { if (!t.disabled) { SM.hz = t.getAttribute('data-h'); render(); } return; }
    if (t.hasAttribute('data-sprint')) { SM.sprint = t.getAttribute('data-sprint'); const cur = resolve(location.hash); const sup = cur.page && cur.page.hz || ['sprint']; if (sup.indexOf('sprint') >= 0) SM.hz = 'sprint'; render(); return; }
    if (t.hasAttribute('data-ev')) { if (t.tagName !== 'BUTTON' && ev.target.closest('a')) return; ev.preventDefault(); SM.openDrawer('ev', t.getAttribute('data-ev')); return; }
    if (t.hasAttribute('data-dr')) { ev.preventDefault(); const v = t.getAttribute('data-dr'), n = v.indexOf(':'); SM.openDrawer(v.slice(0, n), v.slice(n + 1)); return; }
    if (t.hasAttribute('data-help')) { popover(t, `<b>What this panel shows</b><br>${esc(t.getAttribute('data-help'))}`); return; }
    if (t.hasAttribute('data-tab')) {
      const box = t.closest('[data-tabs]'), g = box.getAttribute('data-tabs'), id = t.getAttribute('data-tab'); SM.ui[g] = id; SM.touch(g);
      box.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === t));
      document.querySelectorAll('[data-pane^="' + g + ':"]').forEach(p => { p.hidden = p.getAttribute('data-pane') !== g + ':' + id; });
      markWide(); syncAddress();
      return;
    }
    if (t.hasAttribute('data-fv')) { const g = 'f:' + t.closest('[data-filter]').getAttribute('data-filter'); SM.ui[g] = t.getAttribute('data-fv'); SM.touch(g); applyFilters(); markWide(); syncAddress(); return; }
    if (t.hasAttribute('data-sv')) { const g = t.closest('[data-seg]').getAttribute('data-seg'); SM.ui[g] = t.getAttribute('data-sv'); SM.touch(g); render(); return; }
    if (t.hasAttribute('data-toast')) { toast(t.getAttribute('data-toast')); return; }
    if (t.hasAttribute('data-act')) { const f = SM.acts && SM.acts[t.getAttribute('data-act')]; if (f) f(t); return; }
    if (t.hasAttribute('data-sort')) {
      const desc = !t.classList.contains('desc'), base = location.hash.split('?')[0], i = Array.from(document.querySelectorAll('#main table.tb')).indexOf(t.closest('table'));
      sortTable(t, desc);
      if (i >= 0) { (SM.sorts[base] = SM.sorts[base] || {})[i] = t.getAttribute('data-sort') + (desc ? 'd' : 'a'); syncAddress(); }
      return;
    }
    if (t.hasAttribute('data-go') && !ev.target.closest('a,button')) { SM.go(t.getAttribute('data-go')); }
  });
  document.addEventListener('keydown', function (ev) {
    // Esc closes what lies on top: a drawer, a popover. The command window listens after this and skips a handled key.
    if (ev.key === 'Escape' && card) { closeCard(); ev.smHandled = true; return; }
    if (ev.key === 'Enter' && ev.target.id === 'pin-name') { ev.preventDefault(); SM.acts.pinsave(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((ev.key === 'p' || ev.key === 'P') && card && !cardPinned && !typing) { cardPinned = true; card.classList.add('pinned'); clearTimeout(cardT); return; }
    if (ev.key === '/' && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !layer().innerHTML) { ev.preventDefault(); SM.wantSearch = true; SM.go('#/search'); return; }
    if (ev.key === 'Escape' && layer().innerHTML) { closeOverlays(); ev.smHandled = true; }
    if (ev.key === 'Tab') {
      const dr = layer().querySelector('.drawer'); if (!dr) return;
      const all = [...dr.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]')].filter(e => e.offsetParent !== null);
      if (!all.length) { ev.preventDefault(); return; }
      const first = all[0], last = all[all.length - 1], at = document.activeElement;
      if (!dr.contains(at) || at === dr) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
      else if (ev.shiftKey && at === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && at === last) { ev.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('input', function (ev) {
    const f = ev.target.getAttribute && ev.target.getAttribute('data-input'); if (f && SM.acts && SM.acts[f]) SM.acts[f](ev.target);
  });
  /* tooltip for anything with data-tip */
  let tipEl;
  document.addEventListener('mouseover', function (ev) {
    const t = ev.target.closest('[data-tip]'); if (!t) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = t.getAttribute('data-tip'); tipEl.hidden = false;
    const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = (r.top - h - 8 < 4 ? r.bottom + 8 : r.top - h - 8) + 'px';
  });
  document.addEventListener('mouseout', function (ev) { if (tipEl && ev.target.closest('[data-tip]')) tipEl.hidden = true; });

  window.addEventListener('hashchange', function () {
    const main = document.getElementById('main');
    if (entry) scrolls[entry] = main.scrollTop;
    closeOverlays(); if (tipEl) tipEl.hidden = true;
    const y = arrive(); readAddress(); render(); main.scrollTo({ top: y, behavior: 'instant' });
  });
  SM.acts = SM.acts || {};
  /* on a phone the rail is a menu: the button opens it, a choice in it closes it */
  SM.acts.railtoggle = function () { const on = document.body.classList.toggle('rail-open'); document.querySelectorAll('.menu-btn').forEach(b => b.setAttribute('aria-expanded', on ? 'true' : 'false')); };
  document.addEventListener('click', ev => { if (ev.target.closest && (ev.target.closest('.rail a') || ev.target.closest('#main'))) document.body.classList.remove('rail-open'); });
  SM.acts.srcmenu = function (t) {
    const r = t.getBoundingClientRect(), rows = D.sources.map(x => {
      const st = K.srcState(x.id);
      return `<a class="vt is-${st}" href="#/system/sources" data-close>${K.dot(st === 'ok' ? 'ok' : st === 'stale' ? 'watch' : st === 'down' ? 'bad' : '', st === 'off')}<span class="n">${esc(x.name)}</span><span class="a">${st === 'ok' ? esc(x.age) : st}</span></a>`;
    }).join('');
    layer().innerHTML = `<div class="scrim nobg" data-close ></div><div class="src-menu" style="left:${Math.max(8, Math.min(window.innerWidth - 268, r.right - 260))}px;top:${r.bottom + 6}px">
      <div class="plt-g">Sources, last read ${esc(D.now.label.slice(-5))}</div>${rows}<a class="vt" href="#/system/agent" data-close>${K.dot('ok')}<span class="n">Agent</span><span class="a">${esc(D.agent.lastRun)}</span></a>
      <div class="src-f"><a class="btn sm" href="#/system/sources" data-close>All sources ›</a></div></div>`;
  };
  SM.acts.pinmenu = function (t) {
    const i = pinIndex(), list = SM.myPins(), name = i >= 0 ? list[i].l : pinName(resolve(location.hash));
    popover(t, `<div class="pin-pop"><b>${i >= 0 ? 'Pinned' : 'Pin this view'}</b><label>Name <input id="pin-name" class="inp" maxlength="40" value="${esc(name)}"></label>
      <p>The pin keeps what you see now: the focus, the horizon, the days, the filters and the sort.</p><div class="rowf"><button class="btn sm pri" data-act="pinsave">${i >= 0 ? 'Rename' : 'Pin'}</button>${i >= 0 ? '<button class="btn sm" data-act="pindel">Remove</button>' : ''}</div></div>`);
    const box = document.getElementById('pin-name'); box.focus(); box.select();
  };
  SM.acts.pinsave = function () {
    const box = document.getElementById('pin-name'), list = SM.myPins(), i = pinIndex(), cur = resolve(location.hash), name = (box ? box.value : '').trim().slice(0, 40) || pinName(cur);
    if (i >= 0) list[i].l = name; else list.push({ h: location.hash, l: name, t: '' });
    savePins(list); closeOverlays(); render();
  };
  SM.acts.pindel = function () { const list = SM.myPins(), i = pinIndex(); if (i >= 0) list.splice(i, 1); savePins(list); closeOverlays(); render(); };
  SM.acts.refresh = () => readAgain(false);
  SM.acts.kcclose = () => closeCard();
  SM.acts.noticesagain = () => { store.set('noticesSeen', ''); SM.keepNew = true; render(); };
  SM.acts.palette = t => { SM.setPalette(t.getAttribute('data-id')); closeOverlays(); render(); };
  SM.acts.palmenu = function (t) {
    const row = p => `<button class="plt-row${p.id === SM.palette ? ' on' : ''}" data-act="palette" data-id="${p.id}"><span class="plt-sw" data-palette="${p.id}"><i class="sw-bg"></i><i class="sw-plane-3"></i><i class="sw-s1"></i><i class="sw-ok"></i></span><span><b>${esc(p.name)}</b><small>${esc(p.note)}</small></span></button>`;
    const r = t.getBoundingClientRect();
    layer().innerHTML = `<div class="scrim nobg" data-close ></div><div class="plt-menu" style="left:${Math.max(8, Math.min(window.innerWidth - 292, r.right - 280))}px;top:${r.bottom + 8}px">
      <div class="plt-g">This computer</div>${SM.palettes.filter(p => p.auto).map(row).join('')}<div class="plt-g">Dark</div>${SM.palettes.filter(p => p.dark).map(row).join('')}<div class="plt-g">Light</div>${SM.palettes.filter(p => !p.dark && !p.auto).map(row).join('')}
      <div class="plt-f">Saved in this browser. Every colour of the app is a token; a palette is one block of them.</div></div>`;
  };
  SM.layer = layer; SM.closeOverlays = closeOverlays; SM.popover = popover;
  SM.start = function () { arrive(); readAddress(); render(); };
  SM.store = store;
  window.SM = SM;
})();
