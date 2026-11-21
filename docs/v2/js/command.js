/* AI Command: the command window.
   Two answerers. The dispatcher is code: it answers a short command at once from the facts and finds things by name.
   The agent answers a question through read-only tools and cites the facts it used.
   The window docks on the right or at the bottom, detaches into a window you can drag (it snaps to the right
   and bottom edge), or expands to the whole window. Conversations are kept and can be found again.
   Neither answerer changes anything outside the app; a proposal only ever touches the user's own notes. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, store = SM.store;
  const C = SM.cmd = { open: store.get('cmd', '0') === '1', dock: store.get('dock', 'right'), chat: -1, hist: false, histQ: '', lang: 'EN',
    wait: null, sel: -1, rot: 0, draft: '', matches: [], fx: null, fy: null, focus: false };
  const SPARK = '<span class="ai-spark">✦</span>';
  const S = D.sprint, f = S.forecast;

  /* ── the dispatcher: commands answered by code ────────────────────────── */
  const ref = (k, label, href) => ({ k: k, label: label, href: href });
  const itemRef = i => ref(i.kd, i.label, i.href);
  function find(q) {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return SM.items().filter(i => words.every(w => i.hay.toLowerCase().indexOf(w) >= 0));
  }
  const HELP = () => `<p>Short commands are answered at once, by code, from what the app has read:</p>
    <div class="cmd-help"><b>status</b><span>the sprint in five lines</span><b>today</b><span>${SM.home === 'roles' ? 'what your role would look at first' : 'what to look at first'}</span><b>stuck</b><span>blocked and slow items</span>
    <b>next</b><span>the dates ahead</span><b>release</b><span>is the next release ready</span><b>risks</b><span>the register, worst first</span><b>sources</b><span>what answers and how fresh it is</span>
    <b>KES-4131</b><span>a key or a few words of a name: opens it</span>${SM.home === 'roles' ? '<b>view as po</b><span>switch the role</span>' : '<b>focus release</b><span>narrow the Overview to one area</span><b>brief daily</b><span>open the briefing of an event</span>'}<b>show pi</b><span>switch the horizon</span><b>palette carbon</b><span>switch the palette</span></div>
    <p>Anything that ends with a question mark, or starts with a question word, goes to the agent. It reads through the same read-only tools and cites its facts.</p>`;
  function dispatch(text) {
    const l = text.trim().toLowerCase().replace(/[.!]+$/, '');
    let m;
    if (l === 'help' || l === '?') return { who: 'disp', html: HELP() };
    if (/^(status|sprint)$/.test(l)) return { who: 'disp', facts: ['sprint.done_sp', 'forecast.p85', 'forecast.chance_all'],
      html: `<p><b>Sprint 42</b>, working day ${D.now.day} of ${D.now.days}.</p><p>Done: <b>${S.doneSp} of ${S.scopeSp} SP</b> in ${S.doneItems} of ${S.scopeItems} items. Open: ${S.openSp} SP.</p><p>By the end, 85 % sure of at least <b>${f.p85} SP</b>; chance to finish everything: <b>${f.all} %</b>.</p><p>Blocked: 2 items. Came in after the start: ${S.addedItems} items.</p>`,
      refs: [ref('Delivery', 'Sprint', '#/delivery/sprint'), ref('D-1', 'Sprint 42 does not fit: what moves out?', '#/knowledge/decisions')] };
    if (l === 'today' && SM.home !== 'roles' && SM.todayLines) return { who: 'disp', html: '<p>Today:</p>' + SM.todayLines().map(x => `<p>· ${esc(x)}</p>`).join(''), refs: [ref('Home', 'Overview', '#/home/overview'), ref('Briefing', 'Daily', '#/briefings')] };
    if (l === 'today') {
      const lines = { sm: ['Chance to finish everything: 9 %. Decision D-1 is due tomorrow.', 'KES-4131 blocked for 9 days, KES-4160 in Implementing for 24 days.', 'Seven items in progress against a limit of six.'],
        tl: ['pricing-engine: main red since 17.11 16:40.', 'Three pull requests wait a working day or more: #412, #118, #57.', 'Nightly regression 389 of 412; 5 failures nobody has looked at.'],
        am: ['carrier-export missed its end time on 17.11: the third night in 30.', 'pricing-engine: error rate 1.8 % since 17.11 21:12.', 'Release 2026.12: 3 of 8 checks fail; freeze in 7 working days.'],
        lead: ['63 SP committed; 86 available person-days carry about 45 SP.', '31 % of the work of the PI is bugs and support; agreed: 20 %.', 'The WIP limit held on 3 of 8 days.'],
        po: ['Objective 3: 16 of 24 SP open, 5 blocked; freeze on 27.11.', 'Decisions D-1 (tomorrow) and D-2 (24.11) wait for you.', 'Release 2026.12: 19 of 31 issues done.'] }[SM.role];
      return { who: 'disp', html: `<p>For the ${esc(SM.roleObj().name)}, today:</p>` + lines.map(x => `<p>· ${esc(x)}</p>`).join(''), refs: [ref('Home', SM.roleObj().name, '#/home/' + SM.role)] };
    }
    if (/^(stuck|blocked)$/.test(l)) {
      const st = D.issues.filter(i => i.st !== 'done' && (i.st === 'blocked' || i.dis >= D.flow.p85));
      return { who: 'disp', facts: ['flow.p85'], html: `<p><b>${st.length} items</b> are blocked or slower than 85 % of finished items (11.2 days):</p>`, refs: st.map(i => ref(i.key, i.title + ' · ' + D.status[i.st] + ', ' + i.dis + ' d', '#/issue/' + i.key)).concat([ref('Delivery', 'Flow', '#/delivery/flow')]) };
    }
    if (l === 'next') return { who: 'disp', html: `<p>Ahead of today, 18.11:</p><p>· Thu 19.11: decision D-1 is due<br>· Fri 20.11: dry run of the migration on INT<br>· Fri 27.11: end of sprint 42 and code freeze<br>· Thu 03.12: release 2026.12<br>· Sun 13.12: Winter sale</p>`, refs: [ref('Release', 'Readiness', '#/release/readiness')] };
    if (/^release( ready)?$/.test(l)) return { who: 'disp', html: `<p><b>Release 2026.12</b>, Thu 03.12, freeze Fri 27.11.</p><p>Checks: <b>2 pass</b>, 3 need a look, 3 fail. Issues: 19 of 31 done.</p><p>Failing: scope, two blocked items, main of pricing-engine.</p>`, refs: [ref('Release', 'Readiness', '#/release/readiness'), ref('R2026.12', 'Release 2026.12', '#/release/R2026.12'), ref('D-2', 'Without the school price tiers, or move the release?', '#/knowledge/decisions')] };
    if (/^risks?$/.test(l)) return { who: 'disp', html: `<p><b>${D.risks.length} risks</b> in the register; ${D.risks.filter(r => r.level === 'bad').length} off track:</p>`, refs: D.risks.filter(r => r.level !== 'ok').map(r => ref(r.id, r.title + ' · review ' + r.review, '#/knowledge/risks')) };
    if (/^sources?$/.test(l)) { const ns = D.sources.filter(x => K.srcState(x.id) !== 'ok'); return { who: 'disp', html: `<p><b>${D.sources.length - ns.length} of ${D.sources.length}</b> sources answer.</p>` + ns.map(x => `<p>· ${esc(x.name)}: ${esc(K.srcState(x.id))}${x.why ? ', ' + esc(x.why) : ''}</p>`).join(''), refs: [ref('System', 'Sources', '#/system/sources')] }; }
    if ((m = l.match(/^focus\s+(.+)$/)) && SM.focusFind) { const a = SM.focusFind(m[1]); if (a) return { who: 'disp', html: `<p>The Overview now shows <b>${esc(a[1])}</b>.</p>`, refs: [ref('Home', 'Overview', '#/home/overview')], run: () => { SM.ui.focus = a[0]; SM.touch('focus'); SM.go('#/home/overview'); } }; }
    if ((m = l.match(/^brief(?:ing)?\s+(.+)$/)) && SM.briefFind) { const b = SM.briefFind(m[1]); if (b) return { who: 'disp', html: `<p>Briefing for <b>${esc(b.name)}</b>, ${esc(b.when)}.</p>`, refs: [ref('Briefing', b.name, '#/briefings')], run: () => { SM.ui.brief = b.id; SM.touch('brief'); SM.go('#/briefings'); } }; }
    if (SM.home !== 'roles' && /^(?:view as|as|role)\s+/.test(l)) return { who: 'disp', html: '<p>The home has no roles now: it is one Overview, narrowed by a focus. Try <b>focus release</b>. The five homes by role are under Home screen › By role.</p>', refs: [ref('Home', 'The homes by role', '#/home/' + SM.role)] };
    if ((m = l.match(/^(?:view as|as|role)\s+(.+)$/))) { const r = D.roles.find(x => x.id === m[1] || x.code.toLowerCase() === m[1] || x.name.toLowerCase().indexOf(m[1]) === 0); if (r) return { who: 'disp', html: `<p>You now view as <b>${esc(r.name)}</b>: its home, its pinned pages, its questions here.</p>`, refs: [ref('Home', r.name, '#/home/' + r.id)], run: () => { SM.role = r.id; store.set('role', r.id); } }; }
    if ((m = l.match(/^(?:show|scope)\s+(today|sprint|pi|quarter)$/))) return { who: 'disp', html: `<p>The horizon is now <b>${m[1] === 'pi' ? 'PI' : m[1]}</b>. A page that has no such view keeps its own.</p>`, run: () => { SM.hz = m[1]; } };
    if ((m = l.match(/^palette\s+(.+)$/))) { const p = SM.palettes.find(x => x.id === m[1] || x.name.toLowerCase() === m[1]); if (p) return { who: 'disp', html: `<p>Palette: <b>${esc(p.name)}</b>. ${esc(p.note)}.</p>`, run: () => SM.setPalette(p.id) }; }
    const hits = find(text).filter(i => !i.cmd);
    if (hits.length === 1) return { who: 'disp', html: `<p>One match:</p>`, refs: [itemRef(hits[0])] };
    if (hits.length) return { who: 'disp', html: `<p><b>${hits.length}</b> things the app has read match "${esc(text.trim())}"${hits.length > 6 ? '; the first six' : ''}:</p>`, refs: hits.slice(0, 6).map(itemRef) };
    return null;
  }
  const isQuestion = t => /\?\s*$/.test(t) || /^(what|why|when|where|who|how|will|is|are|do|does|did|can|could|should|which|was|wie|warum|wann|wo|wer|ist|sind|kann|что|как|почему|когда|где|будет)\b/i.test(t.trim());

  /* ── the agent: prepared answers, each with its facts, references and sometimes a proposal ── */
  const EXTRA = {
    'What should we talk about in the Daily?': { refs: [ref('KES-4131', 'Take the new price tiers from the price feed v3', '#/issue/KES-4131'), ref('KES-4160', 'Stock hold table: move the data to the new schema', '#/issue/KES-4160'), ref('Engineering', 'Pull requests', '#/eng/prs')], prop: 'Put these points into the Inbox as the draft "Points for the Daily"' },
    'Will we finish the sprint?': { refs: [ref('Delivery', 'Sprint', '#/delivery/sprint'), ref('D-1', 'Sprint 42 does not fit: what moves out?', '#/knowledge/decisions')], prop: 'Put the four options into the Inbox as a mail to the product owner' },
    'Is release 2026.12 ready?': { refs: [ref('Release', 'Readiness', '#/release/readiness'), ref('Engineering', 'Builds', '#/eng/builds')], prop: 'Save this as the draft "Release 2026.12: where it stands" in the Inbox' },
    'What do we pay for more than once?': { refs: [ref('INC-2299', 'Nightly export to carriers timed out', '#/incident/INC-2299'), ref('KES-3325', 'Carrier export', '#/feature/KES-3325')], prop: 'Add the signal "export times out again before the fix is released" to the risk register' },
    'Will the price tiers make the Winter sale?': { refs: [ref('KES-3318', 'Pricing: new volume tiers', '#/feature/KES-3318'), ref('Delivery', 'Dependencies', '#/delivery/dependencies')] },
    'Why is main of the pricing-engine red?': { refs: [ref('Engineering', 'Builds', '#/eng/builds'), ref('Operations', 'Errors', '#/ops/errors')] },
    'Does the sprint fit the capacity?': { refs: [ref('Delivery', 'Capacity and work mix', '#/delivery/capacity')] }
  };
  function bank() { return SM.askBank || {}; }
  /* with the overview as home the questions follow no role */
  function mine() { return bank()[SM.home !== 'roles' && bank().overview ? 'overview' : SM.role] || []; }
  function prepared(text) {
    const t = text.trim().toLowerCase().replace(/\?+$/, '');
    let best = null;
    Object.keys(bank()).forEach(role => bank()[role].forEach(q => { if (q.q.toLowerCase().replace(/\?+$/, '') === t) best = q; }));
    if (best) return best;
    const words = t.split(/\W+/).filter(w => w.length > 3);
    let top = 0;
    Object.keys(bank()).forEach(role => bank()[role].forEach(q => { const n = words.filter(w => q.q.toLowerCase().indexOf(w) >= 0).length; if (n > top && n >= 2) { top = n; best = q; } }));
    return best;
  }
  function agentAnswer(text) {
    const q = prepared(text);
    if (q) { const x = EXTRA[q.q] || {}; return { who: 'ai', html: q.a, refs: x.refs, prop: x.prop ? { text: x.prop, state: null } : null }; }
    const hits = find(text.replace(/\?/g, '')).filter(i => !i.cmd).slice(0, 4);
    return { who: 'disp', warn: 'The agent did not answer: this demo holds prepared answers only. The dispatcher answered from what the app has read.',
      html: hits.length ? '<p>By name, these come closest:</p>' : '<p>Nothing by that name. Try <b>help</b>.</p>', refs: hits.map(itemRef) };
  }

  /* ── conversations ────────────────────────────────────────────────────── */
  function seed() {
    if (SM.chats) return;
    const mk = (title, at, group, texts) => ({ title: title, at: at, group: group, msgs: texts.reduce((a, t) => a.concat([{ who: 'me', text: t }, isQuestion(t) ? agentAnswer(t) : (dispatch(t) || agentAnswer(t))]), []) });
    SM.chats = [
      mk('What should we talk about in the Daily?', '09:02', 'Today', ['What should we talk about in the Daily?']),
      mk('Is release 2026.12 ready?', '16:40', 'Yesterday', ['release', 'Is release 2026.12 ready?']),
      mk('stuck', '11:05', 'Yesterday', ['stuck']),
      mk('Where do pull requests lose time?', 'Mon 16.11', 'Earlier', ['Where do pull requests lose time?']),
      mk('What do we pay for more than once?', 'Fri 13.11', 'Earlier', ['What do we pay for more than once?'])
    ];
  }
  const cur = () => (C.chat >= 0 ? SM.chats[C.chat] : null);
  function send(text) {
    text = (text || '').trim(); if (!text) return;
    seed();
    if (C.chat < 0) { SM.chats.unshift({ title: text.slice(0, 70), at: D.now.label.slice(-5), group: 'Today', msgs: [] }); C.chat = 0; }
    const chat = cur(); chat.msgs.push({ who: 'me', text: text });
    C.draft = ''; C.matches = []; C.sel = -1; C.hist = false; C.focus = true;
    const d = isQuestion(text) ? null : dispatch(text);
    if (d) { chat.msgs.push(d); if (d.run) { d.run(); SM.render(); return; } draw(); return; }
    const ans = agentAnswer(text), t0 = Date.now();
    C.wait = { t0: t0, tick: setInterval(() => { const el = document.getElementById('cmd-wait-s'); if (el) el.textContent = Math.max(1, Math.round((Date.now() - t0) / 1000)) + ' s'; }, 500),
      timer: setTimeout(() => { stopWait(); chat.msgs.push(ans); draw(); }, 1100) };
    draw();
  }
  function stopWait() { if (C.wait) { clearTimeout(C.wait.timer); clearInterval(C.wait.tick); C.wait = null; } }

  /* ── drawing ──────────────────────────────────────────────────────────── */
  const refRow = r => `<a class="cmd-ref" href="${r.href}"><span class="kd">${esc(r.k)}</span><span class="cut">${esc(r.label)}</span><span class="chev">›</span></a>`;
  function msgHtml(m, n) {
    if (m.who === 'me') return `<div class="bubble">${esc(m.text)}</div>`;
    const who = m.who === 'ai' ? `<div class="who ai">${SPARK}AI agent</div>` : `<div class="who"><i class="sq"></i>Dispatcher</div>`;
    const prop = m.prop ? `<div class="proposal"><span class="p-t">${esc(m.prop.text)}</span>${m.prop.state == null
      ? `<span class="p-b"><button class="btn sm pri" data-act="cmdprop" data-n="${n}" data-v="yes">Do it</button><button class="btn sm" data-act="cmdprop" data-n="${n}" data-v="no">No</button></span>`
      : `<span class="p-s ${m.prop.state ? 'c-ok' : 'faint'}">${m.prop.state ? '✓ done, in your own notes' : '– not done'}</span>`}</div>` : '';
    return `<div class="ans">${who}${m.warn ? `<div class="note watch mb-6" >${esc(m.warn)}</div>` : ''}<div class="ans-b">${m.html}</div>${(m.refs || []).map(refRow).join('')}${prop}</div>`;
  }
  function cards() {
    const b = mine();
    const open = SM.home !== 'roles' ? ['D-1', '#/knowledge/decisions', 'due tomorrow: what moves out?'] : { sm: ['KES-4131', '#/issue/KES-4131', 'blocked for 9 days'], tl: ['pricing-engine', '#/eng/builds', 'main is red'], am: ['INC-2299', '#/incident/INC-2299', 'open since Tue 02:09'], lead: ['Capacity', '#/delivery/capacity', '63 SP against about 45'], po: ['KES-3318', '#/feature/KES-3318', '16 of 24 SP open'] }[SM.role];
    return [`<button class="cmd-card" data-cmd-say="status"><small>Status · sprint 42</small>status</button>`,
      `<a class="cmd-card" href="${open[1]}"><small>Open · ${esc(open[0])}</small>${esc(open[2])}</a>`]
      .concat(b.slice(0, 2).map(q => `<button class="cmd-card" data-cmd-say="${esc(q.q)}"><small>${SPARK}Agent</small>${esc(q.q)}</button>`)).join('');
  }
  function suggestions() {
    const asked = (cur() ? cur().msgs : []).filter(m => m.who === 'me').map(m => m.text.toLowerCase());
    const pool = mine().map(q => [q.q, true]).concat([['stuck', false], ['next', false], ['release', false], ['risks', false], ['today', false]]).filter(x => asked.indexOf(x[0].toLowerCase()) < 0);
    const out = []; for (let i = 0; i < Math.min(3, pool.length); i++) out.push(pool[(i + C.rot) % pool.length]);
    return out;
  }
  function historyHtml() {
    const q = C.histQ.toLowerCase(), groups = ['Today', 'Yesterday', 'Earlier'];
    const rows = g => SM.chats.map((c, n) => [c, n]).filter(x => x[0].group === g && (!q || x[0].title.toLowerCase().indexOf(q) >= 0)).map(x =>
      `<div class="h-row${x[1] === C.chat ? ' on' : ''}" data-act="cmdchat" data-n="${x[1]}"><span class="h-t">${esc(x[0].at)}</span><span class="cut">${esc(x[0].title)}</span><button class="x" data-toast="In the real tool this asks first, then deletes the conversation. It cannot be undone." aria-label="Delete this conversation">×</button></div>`).join('');
    return `<div class="cmd-hist"><div class="h-h"><b>Conversations</b><button class="btn sm" data-act="cmdnew">+ New conversation</button></div>
      <input class="inp" id="cmd-hq" data-input="cmdhistq" placeholder="Find a conversation" value="${esc(C.histQ)}" autocomplete="off">
      ${groups.map(g => { const r = rows(g); return r ? `<div class="h-g">${g}</div>${r}` : ''; }).join('') || '<div class="h-g">No conversation matches.</div>'}</div>`;
  }
  const ICO = {
    pen: 'M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12zM9.5 4l2.5 2.5', bottom: 'M2.5 3h11v10h-11zM2.5 9.5h11', right: 'M2.5 3h11v10h-11zM9.5 3v10', float: 'M5.5 5.5h8v8h-8zM2.5 10.5v-8h8', wide: 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9',
    close: 'M3.5 3.5l9 9M12.5 3.5l-9 9', mic: 'M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2zM4 8a4 4 0 0 0 8 0M8 12v2', voice: 'M3 6v4M6 3.5v9M9 5v6M12 6.5v3', up: 'M8 13V3.5M4 7.5l4-4 4 4', turn: 'M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3'
  };
  const ic = n => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICO[n]}"/></svg>`;
  const tool = (act, v, tip, icon, on) => `<button class="tool${on ? ' on' : ''}" data-act="${act}"${v ? ` data-v="${v}"` : ''} data-tip="${esc(tip)}" aria-label="${esc(tip)}">${ic(icon)}</button>`;

  function html() {
    seed();
    const chat = cur(), r = SM.roleObj();
    let body;
    if (C.hist) body = historyHtml();
    else if (!chat) body = `<div class="cmd-empty"><h3>Ask about ${esc(D.team.name)}</h3>
        <p>I answer short commands at once, from the facts the pages show. A question goes to the agent, which reads through the same read-only tools and cites the facts it used. Neither of us changes anything in Jira or any other system.</p>
        <div class="cmd-cards">${cards()}</div><p class="faint fs-11" >Viewing as ${esc(r.name)} · ${esc(SM.scopeLabel().split(' · ')[0])} · type <b>help</b> for the commands</p></div>`;
    else body = chat.msgs.map(msgHtml).join('') + (C.wait ? `<div class="ans"><div class="who ai">${SPARK}AI agent</div><div class="cmd-wait"><i></i><i></i><i></i><span>Waiting for the answer · <span id="cmd-wait-s">1 s</span></span><button class="lnk" data-act="cmdstop">Don't wait</button></div></div>` : '');
    const sugg = chat && !C.hist && !C.wait ? `<div class="cmd-sugg"><span class="faint">Suggested</span>${suggestions().map(x => `<button class="chip" data-cmd-say="${esc(x[0])}">${x[1] ? SPARK : ''}${esc(x[0])}</button>`).join('')}<button class="tool sm" data-act="cmdrot" data-tip="Other suggestions">${ic('turn')}</button></div>` : '';
    return `${C.dock === 'bottom' ? '<div class="cmd-grip" data-grip data-tip="Drag to change the height"><i></i></div>' : ''}
      <div class="cmd-h" data-drag><span class="cmd-lab">AI Command</span>
        <button class="help" data-help="Short commands are answered by code from the facts, at once. Questions go to the agent: agent runtime with the models of your subscription, through twelve read-only tools. Every number in an answer is a fact; a proposal only ever touches your own notes on this computer.">?</button>
        <button class="cmd-title" data-act="cmdhist" data-tip="Conversations">${esc(chat ? chat.title : 'New conversation')}<span class="car">▾</span></button><span class="grow"></span>
        ${tool('cmdnew', '', 'New conversation', 'pen')}
        ${C.dock === 'bottom' ? tool('cmddock', 'right', 'Dock on the right', 'right') : tool('cmddock', 'bottom', 'Dock at the bottom, the full width', 'bottom')}
        ${C.dock === 'float' ? tool('cmddock', 'right', 'Dock the window back', 'float', true) : tool('cmddock', 'float', 'Detach into a window you can move (drag it to the right or the bottom edge to dock it there)', 'float')}
        ${C.dock === 'wide' ? tool('cmddock', 'right', 'Back to the side (Ctrl+Shift+K)', 'wide', true) : tool('cmddock', 'wide', 'Expand to the whole window (Ctrl+Shift+K)', 'wide')}
        <button class="tool" data-cmd-close data-tip="Close (Esc)" aria-label="Close">${ic('close')}</button></div>
      <div class="cmd-body"><div class="cmd-log" id="cmd-log">${body}</div></div>
      ${sugg}
      <div class="cmd-match" id="cmd-match"></div>
      <div class="composer"><textarea id="cmd-inp" rows="1" placeholder="A command, a question or a few words from a name…" spellcheck="false">${esc(C.draft)}</textarea>
        <div class="comp-bar"><button class="tool sm txt" data-act="cmdlang" data-tip="Language of dictation and of the voice">${C.lang}</button>
          <button class="tool sm txt" data-cmd-say="help" data-tip="What can I type?">?</button>
          <button class="tool sm" data-toast="This demo does not listen. In the real tool: dictation in the chosen language, the text lands in this field." data-tip="Dictate">${ic('mic')}</button>
          <button class="tool sm" data-toast="This demo does not talk. In the real tool: a voice conversation you can interrupt." data-tip="Voice conversation">${ic('voice')}</button>
          <span class="grow"></span><span class="faint fs-11" >Enter sends · Shift+Enter: new line</span>
          <button class="send" data-act="cmdsend" aria-label="Send" data-tip="Send">${ic('up')}</button></div></div>`;
  }

  function draw() {
    const app = document.getElementById('app'), el = document.getElementById('ask');
    if (!app || !el) return;
    app.className = 'app' + (C.open ? ' cmd-' + C.dock : '');
    el.className = 'cmd' + (C.open ? ' is-' + C.dock : '');
    if (C.open && C.dock === 'float') {
      if (C.fx == null) { C.fx = Math.max(16, window.innerWidth - 480); C.fy = 118; }
      el.style.left = C.fx + 'px'; el.style.top = C.fy + 'px';
      if (!el.style.width) { el.style.width = '440px'; el.style.height = Math.min(620, window.innerHeight - 140) + 'px'; }
    } else { el.style.left = el.style.top = el.style.width = el.style.height = ''; }
    if (!C.open) { el.innerHTML = ''; return; }
    el.innerHTML = html();
    const log = document.getElementById('cmd-log'); if (log && !C.hist) log.scrollTop = log.scrollHeight;
    const inp = document.getElementById('cmd-inp');
    if (inp) { grow(inp); if (C.focus) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
    C.focus = false;
    document.querySelectorAll('.cmd-btn').forEach(b => b.classList.toggle('on', C.open));
  }
  SM.cmdRender = draw;
  function grow(inp) { inp.style.height = 'auto'; inp.style.height = Math.min(168, inp.scrollHeight) + 'px'; }
  function matches() {
    const box = document.getElementById('cmd-match'); if (!box) return;
    const q = C.draft.trim();
    C.matches = q.length >= 2 && !isQuestion(q) ? find(q).slice(0, 5) : [];
    if (C.sel >= C.matches.length) C.sel = -1;
    box.innerHTML = C.matches.length ? `<div class="m-h"><span>Open by name</span><span><span class="kbd">↑↓</span> choose · <span class="kbd">Enter</span> open</span></div>` + C.matches.map((i, n) =>
      `<button class="cmd-ref${n === C.sel ? ' on' : ''}" data-act="cmdmatch" data-n="${n}"><span class="kd">${esc(i.kd)}</span><span class="cut">${esc(i.label)}</span><span class="chev">›</span></button>`).join('') : '';
  }
  function openMatch(n) { const i = C.matches[n]; if (!i) return; C.draft = ''; C.matches = []; C.sel = -1; if (i.cmd) { i.cmd(); SM.render(); } else SM.go(i.href); }
  SM.cmdOpen = function (focus) { C.open = true; store.set('cmd', '1'); C.focus = !!focus; draw(); };
  SM.cmdClose = function () { C.open = false; C.hist = false; store.set('cmd', '0'); stopWait(); draw(); };
  SM.cmdSay = send;
  function dock(v) { C.dock = v; C.hist = false; store.set('dock', v === 'wide' ? 'right' : v); C.focus = true; draw(); }

  /* ── acts and events ──────────────────────────────────────────────────── */
  Object.assign(SM.acts, {
    cmdnew: () => { stopWait(); C.chat = -1; C.hist = false; C.focus = true; draw(); },
    cmdhist: () => { C.hist = !C.hist; draw(); if (C.hist) { const q = document.getElementById('cmd-hq'); if (q) q.focus(); } },
    cmdhistq: el => { C.histQ = el.value; const at = el.selectionStart; draw(); const q = document.getElementById('cmd-hq'); if (q) { q.focus(); q.setSelectionRange(at, at); } },
    cmdchat: t => { stopWait(); C.chat = +t.getAttribute('data-n'); C.hist = false; draw(); },
    cmddock: t => dock(t.getAttribute('data-v')),
    cmdlang: () => { C.lang = { EN: 'DE', DE: 'RU', RU: 'EN' }[C.lang]; draw(); },
    cmdsend: () => { const i = document.getElementById('cmd-inp'); send(i ? i.value : ''); },
    cmdstop: () => { stopWait(); const c = cur(); if (c) c.msgs.push({ who: 'disp', html: '<p>Stopped waiting. Nothing was changed; the question stays in this conversation.</p>' }); draw(); },
    cmdrot: () => { C.rot++; draw(); },
    cmdmatch: t => openMatch(+t.getAttribute('data-n')),
    cmdprop: t => { const m = cur().msgs[+t.getAttribute('data-n')], yes = t.getAttribute('data-v') === 'yes'; m.prop.state = yes; if (yes) SM.toast('In the real tool this writes to your own notes on this computer. No other system is touched.'); draw(); }
  });
  document.addEventListener('click', function (ev) {
    const t = ev.target.closest('[data-cmd-open],[data-cmd-close],[data-cmd-say]');
    if (!t) return;
    if (t.hasAttribute('data-cmd-close')) { SM.cmdClose(); return; }
    if (t.hasAttribute('data-cmd-say')) { if (!C.open) { C.open = true; store.set('cmd', '1'); } send(t.getAttribute('data-cmd-say')); return; }
    if (C.open && t.classList.contains('cmd-btn')) SM.cmdClose(); else SM.cmdOpen(true);
  });
  document.addEventListener('keydown', function (ev) {
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && k === 'k') { ev.preventDefault(); if (!C.open) C.open = true; dock(C.dock === 'wide' ? 'right' : 'wide'); return; }
    if ((ev.ctrlKey || ev.metaKey) && k === 'k') { ev.preventDefault(); SM.cmdOpen(true); return; }
    if (ev.key === 'Escape' && !ev.smHandled && C.open) { if (C.hist) { C.hist = false; draw(); } else SM.cmdClose(); return; }
    if (ev.target.id !== 'cmd-inp') return;
    if (ev.key === 'ArrowDown' && C.matches.length) { C.sel = Math.min(C.matches.length - 1, C.sel + 1); matches(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp' && C.matches.length) { C.sel = Math.max(-1, C.sel - 1); matches(); ev.preventDefault(); }
    else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); if (C.sel >= 0) openMatch(C.sel); else send(ev.target.value); }
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'cmd-inp') { C.draft = ev.target.value; C.sel = -1; grow(ev.target); matches(); } });

  /* drag a detached window by its header; near the right or the bottom edge a ghost shows where it will dock */
  let drag = null, ghost = null;
  document.addEventListener('pointerdown', function (ev) {
    const grip = ev.target.closest('[data-grip]');
    if (grip) { drag = { grip: true, y0: ev.clientY, h0: document.getElementById('ask').offsetHeight }; ev.preventDefault(); return; }
    const h = ev.target.closest('[data-drag]');
    if (!h || C.dock !== 'float' || ev.target.closest('button')) return;
    const el = document.getElementById('ask');
    drag = { dx: ev.clientX - el.offsetLeft, dy: ev.clientY - el.offsetTop, el: el }; ev.preventDefault();
  });
  document.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    if (drag.grip) { const h = Math.max(180, Math.min(window.innerHeight - 220, drag.h0 + drag.y0 - ev.clientY)); document.getElementById('app').style.setProperty('--cmdh', h + 'px'); return; }
    C.fx = Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - drag.dx)); C.fy = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - drag.dy));
    drag.el.style.left = C.fx + 'px'; drag.el.style.top = C.fy + 'px';
    const side = ev.clientX > window.innerWidth - 24 ? 'right' : ev.clientY > window.innerHeight - 24 ? 'bottom' : null;
    if (side && !ghost) { ghost = document.createElement('div'); document.body.appendChild(ghost); }
    if (ghost) { if (side) { ghost.className = 'snap-ghost is-' + side; drag.snap = side; } else { ghost.remove(); ghost = null; drag.snap = null; } }
  });
  document.addEventListener('pointerup', function () {
    if (!drag) return;
    const snap = drag.snap; drag = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (snap) dock(snap);
  });
})();
