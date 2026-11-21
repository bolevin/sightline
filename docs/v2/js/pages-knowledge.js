/* Domain: Knowledge. What the team knows and has decided: risks, decisions, agreements and actions, documents, definitions.
   The risk register and the decision marks are the user's own notes in a local file; Jira and Wiki are only read. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;
  const MINE = 'your notes, kept on this computer';
  const today = K.day(D.now.date);
  const dd = s => K.day('2026-' + s.slice(3, 5) + '-' + s.slice(0, 2));        // '20.11' -> day number
  const daysTo = s => (!s || s === 'not set') ? null : dd(s) - today;
  const rkey = id => `<button class="key" data-dr="risk:${esc(id)}">${esc(id)}</button>`;
  const dkey = id => `<button class="key" data-dr="decision:${esc(id)}">${esc(id)}</button>`;
  const roamTone = { New: 'watch', Owned: '', Accepted: '', Mitigated: 'ok' };

  /* ── Risks ────────────────────────────────────────────────────────────── */
  // likelihood and impact: 3 high, 2 medium, 1 low (the user's own placement in the register)
  const place = { 'R-1': [3, 3], 'R-2': [3, 3], 'R-3': [3, 2], 'R-4': [2, 3], 'R-5': [1, 2], 'R-6': [2, 2] };
  const riskSignals = {
    'R-1': [['KES-4131 blocked for 9 days by ATL-882, which has no date', null], ['KES-3318: 16 SP still open in this sprint, due 27.11', 'sprint.open_sp'], ['pricing-engine main red since 17.11 16:40: contract test against the price feed v3', 'build.green']],
    'R-2': [['Committed 63 SP; no full sprint completed more than 52', 'sprint.committed_sp'], ['Chance to finish everything that is open: 9 %', 'forecast.chance_all'], ['85 % sure of at least 47 SP by the end', 'forecast.p85']],
    'R-3': [['INC-2299: the third export timeout in 30 nights', null], ['KES-4146 in Implementing, pull request #97 waits for a first review', null], ['KES-3325: 3 SP left in this sprint, 5 SP after it', null]],
    'R-4': [['KES-4160 24 days in Implementing, in its third sprint', 'flow.p85'], ['Code freeze for release 2026.12 on Fri 27.11', null]],
    'R-5': [['KES-4197 in Review, pull request #57', null], ['Came in after the start of the sprint, no story points', 'sprint.open_sp']],
    'R-6': [['Release 2026.12: smoke test on INT passed, pricing-engine on INT is still 2026.11.0', null], ['Code freeze Fri 27.11, release Thu 03.12', null]]
  };
  const riskHist = {
    'R-1': [['16.11', 'bad', 'Level raised to off track; escalated to the train'], ['11.11', 'watch', 'Fallback added: static price tiers for two weeks'], ['28.09', '', 'Written at PI Planning, owned by the product owner']],
    'R-2': [['17.11', 'bad', 'Answer set: decision D-1 with the product owner on 19.11'], ['13.11', 'watch', 'Level raised after two items came in after the start'], ['10.11', '', 'Written after sprint planning']],
    'R-3': [['17.11', 'watch', 'INC-2299 linked; still accepted until release 2026.12'], ['05.11', 'watch', 'ROAM set to Accepted: manual restart by the on-call'], ['29.10', '', 'Written after INC-2262']],
    'R-4': [['16.11', 'watch', 'Dry run on INT planned for 20.11'], ['09.11', 'watch', 'KES-4160 went into its third sprint'], ['08.10', '', 'Written with ADR-029']],
    'R-5': [['16.11', 'ok', 'ROAM set to Mitigated: new certificate in review'], ['16.11', '', 'KES-4197 linked'], ['12.11', '', 'Written from the warning mail of the carrier']],
    'R-6': [['17.11', 'watch', 'Written from the release plan; owner and review date not set yet'], ['17.11', '', 'R2026.12 linked'], ['17.11', '', 'Level set to needs a look']]
  };
  function reviewCell(r) {
    const d = daysTo(r.review);
    if (d == null) return '<span class="c-watch">not set</span>';
    return `<span class="${d <= 0 ? 'c-bad' : d <= 7 ? 'c-watch' : ''}">${esc(r.review)}</span>`;
  }
  const rflags = r => { const d = daysTo(r.review); return ['all', r.level === 'bad' ? 'bad' : '', r.level === 'watch' ? 'watch' : '', d != null && d <= 7 ? 'due' : ''].join(' '); };

  function matrix() {
    const word = ['', 'Low', 'Medium', 'High'];
    let cells = '';
    for (let l = 3; l >= 1; l--) {
      cells += `<div class="kn-rl">${word[l]}</div>`;
      for (let i = 1; i <= 3; i++) {
        const ids = D.risks.filter(r => place[r.id][0] === l && place[r.id][1] === i);
        const sc = l + i, tone = sc >= 6 ? 'bad' : sc >= 4 ? 'watch' : '';
        cells += `<div class="kn-c ${tone}" data-tip="Likelihood ${word[l].toLowerCase()}, impact ${word[i].toLowerCase()}">${ids.map(r => `<button class="kn-rk" data-dr="risk:${r.id}" data-tip="${esc(r.title)}">${r.id}</button>`).join('')}</div>`;
      }
    }
    return `<div class="kn-mx"><div class="kn-yl">Likelihood</div>${cells}<div class="kn-sp"></div><div class="kn-cl">Low</div><div class="kn-cl">Medium</div><div class="kn-cl">High</div><div class="kn-xl">Impact</div></div>`;
  }

  // the pre-mortem: signs of the running sprint at 53 % of its length against closed sprints at the same point
  const pm = [
    { s: 'Committed against the usual completion', sub: '63 SP against 49, the median completed of the three sprints before', now: '129 %', a: '114 %', b: '112 %', c: '108 %', like: 'worse than all three', tone: 'bad' },
    { s: 'Committed items carried over from an earlier sprint', sub: 'KES-4120, KES-4131, KES-4160, KES-4079', now: '4 of 22', a: '2', b: '3', c: '5', like: '38', tone: 'watch' },
    { s: 'Items without story points', sub: 'invisible to the forecast', now: '3', a: '1', b: '1', c: '3', like: '38', tone: 'watch' },
    { s: 'Items that came in after the start', sub: 'KES-4188, KES-4190, KES-4193, KES-4197', now: '4 of 22', a: '1', b: '2', c: '4', like: '38', tone: 'watch' },
    { s: 'Committed items not started', sub: 'KES-4115, KES-4136', now: '2', a: '4', b: '5', c: '6', like: 'better than all three', tone: 'ok' },
    { s: 'Blocked items', sub: 'KES-4131 for 9 days, KES-4079 for 13 days', now: '2', a: '0', b: '1', c: '2', like: '38', tone: 'watch' },
    { s: 'Share of the scope done', sub: '25 of 65 SP', now: '38 %', a: '52 %', b: '47 %', c: '35 %', like: '38', tone: 'watch' }
  ];

  function risksPage(ctx) {
    const R = D.risks;
    const reg = K.table([
      { h: 'Risk', cls: 's', v: r => rkey(r.id), s: r => r.id },
      { h: 'What could happen', cls: 'ttl', v: r => esc(r.title), s: r => r.title },
      { h: 'ROAM', cls: 's', v: r => K.pill(r.roam, roamTone[r.roam]), s: r => ['New', 'Owned', 'Accepted', 'Mitigated'].indexOf(r.roam) },
      { h: 'Level', cls: 's', v: r => K.dot(r.level) + ' <span class="dim">' + K.stateWord[r.level] + '</span>', s: r => ({ bad: 0, watch: 1, ok: 2 }[r.level]) },
      { h: 'Owner', cls: 's', v: r => r.owner === 'not set' ? '<span class="c-watch">not set</span>' : esc(r.owner), s: r => r.owner },
      { h: 'Review', cls: 's', n: true, v: reviewCell, s: r => daysTo(r.review) == null ? 999 : daysTo(r.review), tip: 'Red: today or past. Amber: within 7 days.' },
      { h: 'Links', cls: 's', v: r => r.links.length ? K.keys(r.links) : '<span class="faint">none</span>' },
      { h: 'Signal', cls: 's', v: r => { const g = D.riskSignals[r.id]; return `${K.dot(g[0] === 'gone' ? 'ok' : g[0] === 'there' ? 'watch' : '', g[0] === 'none')} <span class="${g[0] === 'gone' ? 'c-ok' : 'dim'}">${esc(g[1])}</span>`; }, s: r => D.riskSignals[r.id][0], tip: 'Code keeps watching what made this a risk and says when it is gone. Closing the risk stays your call.' },
      { h: 'Answer', v: r => r.answer ? `<span class="kn-one" title="${esc(r.answer)}">${esc(r.answer)}</span>` : '<span class="c-watch">no answer yet</span>' }
    ], R, { attrs: r => `data-dr="risk:${r.id}" data-f-rk="${rflags(r)}"`, rowCls: () => 'kn-click' });

    const due = R.filter(r => { const d = daysTo(r.review); return d != null && d <= 7; });
    const cand = D.riskCandidates.map(c => `<div class="kn-cand">${K.dot(c.level)}<span class="tx">${c.key ? K.key(c.key) + ' ' + esc(c.text.slice(c.key.length + 1)) : esc(c.text)}</span>
      <span class="rowf"><button class="btn sm" data-toast="The register is your own file on this computer. This demo does not change it.">Add to register</button><button class="btn sm" data-toast="Marked as not a risk in your notes. This demo does not change them.">Not a risk</button></span></div>`).join('');

    const reviews = K.feed(R.slice().sort((a, b) => (daysTo(a.review) == null ? 999 : daysTo(a.review)) - (daysTo(b.review) == null ? 999 : daysTo(b.review))).map(r => {
      const d = daysTo(r.review);
      return { t: r.review === 'not set' ? 'no date' : r.review, tone: d == null ? 'watch' : d <= 0 ? 'bad' : d <= 7 ? 'watch' : '', html: rkey(r.id) + ' ' + esc(r.title), sub: esc(r.owner === 'not set' ? 'no owner' : r.owner) + (d != null ? ' · in ' + d + (d === 1 ? ' day' : ' days') : '') };
    }));
    const byOwner = [['Application manager', 2], ['Product owner', 1], ['Scrum master', 1], ['Tech lead', 1], ['not set', 1]];

    const pmTable = K.table([
      { h: 'Sign', cls: 'ttl', v: r => `<span class="ink">${esc(r.s)}</span><span class="sub">${esc(r.sub)}</span>` },
      { h: '42 now', n: true, v: r => `<b class="c-${r.tone}">${esc(r.now)}</b>` },
      { h: '40 · kept 93 %', n: true, v: r => esc(r.a) },
      { h: '41 · kept 84 %', n: true, v: r => esc(r.b) },
      { h: '38 · missed 79.6 %', n: true, v: r => esc(r.c) },
      { h: 'Looks like', cls: 's', v: r => K.pill(r.like, r.like === '38' ? 'watch' : r.tone) }
    ], pm);

    return {
      lede: `The risks you keep for ${esc(D.team.name)}, next to the signals of Jira that are not in the register yet. Window: ${ctx.pick({ sprint: 'sprint 42', pi: 'PI 26.4' })}.`,
      acts: `<button class="btn" data-toast="The register is your own file on this computer. This demo does not change it.">Add a risk</button>`,
      kpis: [
        { l: 'Risks in the register', v: R.length, s: '1 new, 4 owned or accepted, 1 mitigated' },
        { l: 'Off track', v: R.filter(r => r.level === 'bad').length, s: '<b>R-1</b> Price feed v3, <b>R-2</b> sprint 42', tone: 'bad' },
        { l: 'Reviews due', v: due.length, u: 'in 7 days', s: 'R-2 19.11, R-1 20.11, R-4 24.11', tone: 'watch' },
        { l: 'Signals not in it', v: D.riskCandidates.length, s: 'found in Jira, Build server, Git hosting', tone: 'watch' },
        { l: 'Without an owner', v: R.filter(r => r.owner === 'not set').length, s: '<b>R-6</b> has no review date either', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Risk register', sub: 'click a row for the risk', w: 'c12 x8', flush: true, foot: MINE,
          right: K.filter('rk', [['all', 'All', R.length], ['bad', 'Off track', 2], ['watch', 'Needs a look', 3], ['due', 'Review due', due.length]]),
          body: reg, help: 'Your own register, kept in a file on this computer. The app links each risk to the issues, releases and incidents it names and reads their state from Jira; it never writes the register for you.' }),
        K.panel({ title: 'Exposure', sub: 'likelihood against impact', w: 'c4 x4', foot: MINE, body: matrix() + `<div class="faint fs-11 mt-8" >The placement is your judgement in the register. The app does not compute it.</div>` }),
        K.panel({ title: 'Signals not in the register', sub: 'from the data', w: 'c4 x4', src: ['jira', 'ci', 'git'], right: K.pill(D.riskCandidates.length, 'watch'), body: cand,
          help: 'Rules over the read data: an item blocked for more than 10 days, main red for more than a working day, a review wait twice the usual. A signal stays here until you add it or say it is not a risk.' }),
        K.panel({ title: 'Owners', sub: 'risks per role', w: 'c4 x4', foot: MINE, body: K.hbars(byOwner.map(o => ({ n: o[0], v: o[1], cls: o[0] === 'not set' ? 'watch' : 's1', label: o[1] })), { max: 3, nw: 140, vw: 30 }) +
          K.note('Owners are roles. The register names no person.', '') }),
        K.panel({ title: 'Reviews coming up', sub: 'by date', w: 'c4 x4', foot: MINE, body: reviews }),
        K.panel({ title: 'Suppose this sprint misses its promise', sub: 'seven signs at 53 % of sprint 42, against the team\'s closed sprints at the same point', w: 'c8 x12', src: ['jira'], flush: true, ev: 'sprint.committed_sp',
          right: K.pill('5 of 7 look like 38', 'watch'),
          body: pmTable + `<div class="pd-10-14-0">${K.note('Five of seven signs look like <b>38</b>, the sprint that ended at 43 of 54 SP, just under the 80 % line. One sign is worse than any of the three: the commitment. One is better than all of them: little committed work is still unstarted. Resemblance is not proof: three sprints are a small sample, and the same signs ended well before. A sprint kept its promise at 80 % or more of the commitment.', 'watch')}</div>`,
          help: 'The pre-mortem of the first version. Each sign is counted at the same share of the sprint length in the running sprint and in the closed ones. Decision D-1 answers the biggest sign.' })
      )
    };
  }

  /* ── Decisions ────────────────────────────────────────────────────────── */
  const decMeta = {
    'D-1': { since: '16.11', risk: 'R-2', facts: [['Chance to finish everything that is open: 9 %', 'forecast.chance_all'], ['85 % sure of at least 47 SP by the end', 'forecast.p85'], ['Still open: 40 SP in 17 items', 'sprint.open_sp']] },
    'D-2': { since: '12.11', risk: 'R-1', facts: [['KES-3318: 16 SP open, 5 SP of them blocked by ATL-882', 'sprint.open_sp'], ['Release 2026.12: 19 of 31 issues done', null], ['Code freeze Fri 27.11, Winter sale 13.12', null]],
      opts: [['Ship 2026.12 on 03.12 without the price tiers, bring them with a patch on 08.12', 'KES-3301, KES-3325 and KES-3347 ship on time. The price tiers need ATL-882 by about 01.12; five days stay before the Winter sale.'],
        ['Move release 2026.12 to 08.12', 'All four features ship together. KES-3318 gets three more working days for its 16 SP. The export retry of KES-3325 waits five more nights.']] },
    'D-3': { since: '17.11', risk: 'R-3', facts: [['Export finished before 05:00 on 27 of 30 nights: target 93.3 %, actual 90.0 %', null], ['3 nights missed: 29.10, 05.11, 17.11', null], ['The fix KES-3325 waits for release 2026.12 on 03.12', null]],
      opts: [['Take it to the risk board of the train', 'The train and Carrier-Integration see the miss before release 2026.12. Risk R-3 moves from Accepted to Owned.'],
        ['Keep it in the team', 'R-3 stays accepted with a manual restart by the on-call. Up to 15 more nights run without the retry until 03.12.']] },
    'ADR-031': { facts: [['INC-2262 and INC-2274: the export gave up without a retry', null], ['KES-4142 done: retry with a growing delay', null]] },
    'ADR-030': { facts: [['INC-2291: the pool ran empty for 26 min on 12.11', 'slo.res.budget'], ['KES-4188 done, in production since 13.11', null]] },
    'ADR-029': { facts: [['KES-4160 in its third sprint, 24 days in Implementing', 'flow.p85']] },
    'WA-4': { facts: [['The limit held on 3 of 8 days of this sprint', null], ['7 items in Implementing now', 'flow.p85']] }
  };
  const decKeys = { 'ADR-031': ['KES-4142', 'INC-2274'], 'ADR-030': ['INC-2291', 'KES-4188'], 'ADR-029': ['KES-3347', 'KES-4160'], 'WA-4': [] };

  function decisionsPage(ctx) {
    const wait = D.decisions.filter(d => d.state === 'waiting'), made = D.decisions.filter(d => d.state === 'made');
    const cards = `<div class="kn-decs">${wait.map(K.dec).join('')}</div>`;
    const log = K.table([
      { h: 'Decision', cls: 's', v: d => dkey(d.id), s: d => d.id },
      { h: 'Decided', cls: 's', n: true, v: d => esc(d.on), s: d => dd(d.on) },
      { h: 'What was decided', cls: 'ttl', v: d => esc(d.title) },
      { h: 'Who decided', cls: 's', v: d => esc(d.owner) },
      { h: 'Where it is written', v: d => `<span class="dim">${esc(d.text)}</span>` }
    ], made.slice().sort((a, b) => dd(b.on) - dd(a.on)), { attrs: d => `data-dr="decision:${d.id}"`, rowCls: () => 'kn-click' });
    // weeks W39 (PI Planning) to W50 (end of the PI): made, and opened and still waiting
    const madeW = [1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0], openW = [0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0];
    const tipM = { 0: 'WA-4 at PI Planning', 2: 'ADR-029', 6: 'ADR-031', 7: 'ADR-030' }, tipO = { 7: 'D-2 opened', 8: 'D-1 and D-3 opened' };
    const chart = K.chart({ label: 'Decisions per week of the PI', w: 460, h: 190, x: [-.6, 11.6], y: [0, 3], yt: [0, 1, 2, 3],
      xt: [[0, 'W39'], [1, 'W40'], [3, 'W42'], [5, 'W44'], [7, 'W46'], [8, 'now'], [11, 'W50']],
      bars: madeW.map((v, i) => v ? { x: i, w: .62, y1: v, color: 's1', tip: `Week ${39 + i}: ${tipM[i]} decided` } : null).filter(Boolean)
        .concat(openW.map((v, i) => v ? { x: i, w: .62, y0: madeW[i], y1: madeW[i] + v, color: 's3', tip: `Week ${39 + i}: ${tipO[i]}, still waiting` } : null).filter(Boolean)),
      vmarks: [{ x: 1, color: 'faint', label: 'PI start' }, { x: 8.45, color: 'ink', label: 'today', dash: false }] }) +
      K.legend([['decided', 'bg-s1'], ['opened, still waiting', 'bg-s3']]);
    const who = K.hbars([{ n: 'Team', v: 4, cls: 's1', label: '4 made' }, { n: 'Product owner', v: 2, cls: 's3', label: '2 waiting' }, { n: 'Application manager', v: 2, cls: 's3', label: '2 waiting' }], { max: 4, nw: 140, vw: 70 }) +
      K.note('D-2 waits for the product owner and the application manager together.', '') +
      K.sect('Due next') + K.list(D.decisions.filter(d => d.state === 'waiting').sort((a, b) => dd(a.due.slice(-5)) - dd(b.due.slice(-5))).map(d => ({ tone: d.level, html: dkey(d.id) + ' ' + esc(d.owner), v: esc(d.due) })));
    const record = K.checks([
      { state: '', html: '<b>A question</b>', sub: 'one sentence that can be answered with one of the options' },
      { state: '', html: '<b>The options</b>', sub: 'each with what it does to a number of this app: story points, a chance, a date' },
      { state: '', html: '<b>Who decides</b>', sub: 'a role, or the team' },
      { state: '', html: '<b>By when</b>', sub: 'the date after which the question answers itself' }
    ]) + K.note('The app records that a question was decided when you mark it, in your own file on this computer. It never writes the answer to Jira or Wiki; an architecture decision is read from its wiki page.', '');
    return {
      lede: `What is waiting for a decision and what was decided. Window: ${ctx.pick({ sprint: 'sprint 42', pi: 'PI 26.4' })}.`,
      kpis: [
        { l: 'Waiting', v: wait.length, u: 'decisions', s: '<b>D-1, D-2</b> off track, D-3 needs a look', tone: 'bad' },
        { l: 'Due in 5 days', v: 2, s: 'D-1 Thu 19.11 · D-3 Mon 23.11', tone: 'bad' },
        { l: 'Next after that', v: '24.11', s: 'D-2, release 2026.12' },
        { l: 'Made for this PI', v: made.length, s: '3 architecture decisions, 1 agreement' },
        { l: 'Oldest waiting since', v: '12.11', s: 'D-2 · 6 days', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Waiting for a decision', sub: 'each card links to the page that holds its numbers', w: 'c12 x8', src: ['jira'], foot: 'decision marks: ' + MINE, right: K.pill(wait.length + ' waiting', 'bad'), body: cards }),
        K.panel({ title: 'What a decision record is here', w: 'c4 x4', foot: MINE, body: record }),
        K.panel({ title: 'Decided', sub: 'click a row for the decision', w: 'c8 x6', src: ['wiki'], flush: true, foot: 'marks: ' + MINE, body: log,
          help: 'Architecture decisions are read from the wiki page Architecture decisions: title, number and date. Working agreements come from the PI Planning page.' }),
        K.panel({ title: 'Decisions by the week', sub: 'PI 26.4, from PI Planning', w: 'c6 x3', src: ['wiki'], foot: MINE, body: chart }),
        K.panel({ title: 'Who decides', sub: 'by role', w: 'c6 x3', foot: MINE, body: who })
      )
    };
  }

  /* ── Agreements and actions ───────────────────────────────────────────── */
  function agreementsPage(ctx) {
    const A = D.agreements, X = D.actions;
    const held = a => a.unit.charAt(0) === '%' ? a.kept : Math.round(a.kept / a.of * 100);
    const agr = K.table([
      { h: 'Agreement', cls: 'ttl', v: a => `<span class="mono faint">${a.id}</span> <span class="ink">${esc(a.text)}</span><span class="sub">${a.unit.charAt(0) === '%' ? a.kept + ' ' + esc(a.unit) : a.kept + ' of ' + a.of + ' ' + esc(a.unit)}</span>` },
      { h: 'How often it held', v: a => `<div class="kn-bar">${K.hbars([{ n: '', v: held(a), cls: a.state, label: held(a) + ' %' }], { max: 100, nw: 1, vw: 40 })}</div>` },
      { h: '', cls: 's', v: a => K.pill(K.stateWord[a.state], a.state) },
      { h: '', cls: 's', v: a => K.link('Detail', a.to) }
    ], A);
    const aflags = x => ['all', x.state, x.state === 'open' && x.age >= 30 ? 'old' : ''].join(' ');
    const act = K.table([
      { h: 'Action', cls: 's', v: x => `<span class="mono">${x.id}</span>`, s: x => +x.id.slice(2) },
      { h: 'From', cls: 's', v: x => esc(x.from), s: x => x.from },
      { h: 'What was agreed', cls: 'ttl', v: x => esc(x.text) + (x.key ? ' &nbsp;' + K.key(x.key) : '') },
      { h: 'Owner', cls: 's', v: x => esc(x.owner), s: x => x.owner },
      { h: 'Age', n: true, v: x => `<span class="${x.state === 'open' && x.age >= 50 ? 'c-bad' : x.state === 'open' && x.age >= 30 ? 'c-watch' : ''}">${x.age} d</span>`, s: x => x.age, tip: 'Days since the retrospective. Amber from 30 days, red from 50, for open actions.' },
      { h: 'State', cls: 's', v: x => K.pill(x.state, x.state === 'done' ? 'ok' : ''), s: x => x.state }
    ], X, { attrs: x => `data-f-ac="${aflags(x)}"` });
    const qs = K.list([
      { tone: 'watch', html: 'The first review waited <b>14 h</b> in week 46 against 6 h before. What held the reviews that week?', cite: 'W46 · pr.first_review', ev: 'pr.first_review' },
      { tone: 'bad', html: 'Implementing held more than six items on <b>5 of 8 days</b>. Does the limit still fit, or does action A-13 bring it back to the board?', cite: 'WA-4 · 3 of 8 days', to: '#/delivery/flow' },
      { tone: 'bad', html: '<b>31 %</b> of the work done in the PI went to bugs and support, against an agreed 20 %. Which part could the team have prevented?', cite: 'mix.unplanned', ev: 'mix.unplanned' },
      { tone: 'bad', html: 'The sprint started with <b>63 SP</b>; no full sprint completed more than 52. What made 63 look possible at planning?', cite: 'sprint.committed_sp', ev: 'sprint.committed_sp' },
      { tone: 'watch', html: 'A-11, a date for the price feed v3, is open for <b>33 days</b> and risk R-1 rests on it. Who can get the date?', cite: 'A-11 · R-1', to: '#/knowledge/risks' }
    ]);
    const hist = K.feed([
      { t: 'Fri 06.11', tone: 'watch', html: 'Retro 41 · <b>2 actions agreed</b>, 0 done', sub: 'A-13 WIP limit on the board, A-14 pairing on pricing-engine reviews' },
      { t: 'Fri 16.10', tone: 'watch', html: 'Retro 40 · <b>2 actions agreed</b>, 1 done', sub: 'A-12 done; A-11 open for 33 days' },
      { t: 'Fri 25.09', tone: 'watch', html: 'Retro 39 · <b>2 actions agreed</b>, 1 done', sub: 'A-10 done; A-9 open for 54 days' }
    ]) + K.note('The postmortem of INC-2291 on 13.11 added A-15; it is open and planned as ' + K.key('KES-4193') + '.', '');
    const open = X.filter(x => x.state === 'open'), old = open.filter(x => x.age >= 30);
    return {
      lede: `What the team agreed and how it holds, and the improvement actions of its retrospectives. Window: ${ctx.pick({ sprint: 'sprint 42', pi: 'PI 26.4' })}.`,
      kpis: [
        { l: 'Working agreements', v: A.length, s: 'from PI Planning and retrospectives' },
        { l: 'Kept', v: A.filter(a => a.state === 'ok').length, s: 'WA-2 estimates, WA-3 production bugs', tone: 'ok' },
        { l: 'Broken', v: A.filter(a => a.state === 'bad').length, s: '<b>WA-4</b> WIP limit, <b>WA-5</b> bugs and support', tone: 'bad' },
        { l: 'Actions open', v: open.length, s: 'of ' + X.length + ' since retro 39' },
        { l: 'Open for more than 30 days', v: old.length, s: 'A-11 33 d, <b>A-9 54 d</b>', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Working agreements', sub: 'how often each held', w: 'c7 x6', src: ['wiki', 'jira', 'git'], flush: true, body: agr,
          help: 'The agreements are read from the team page in the wiki. How often each held is counted from Jira and Git hosting with the rule shown under Counted over.' }),
        K.panel({ title: 'Questions the data suggests for the next retrospective', w: 'c5 x6', src: ['jira', 'git'], body: qs + `<div class="rowf mt-10" ><button class="btn sm" data-toast="In the real tool this copies the five questions as text. You paste them where the team keeps its retrospective.">Copy the questions</button></div>`,
          help: 'Each question cites the fact it comes from. The app suggests; the team decides what it talks about.' }),
        K.panel({ title: 'Improvement actions', sub: 'from retrospectives and postmortems', w: 'c8 x8', src: ['wiki'], flush: true,
          right: K.filter('ac', [['all', 'All', X.length], ['open', 'Open', open.length], ['done', 'Done', X.length - open.length], ['old', 'Older than 30 days', old.length]]), body: act }),
        K.panel({ title: 'Retrospectives', sub: 'actions agreed and done', w: 'c4 x4', src: ['wiki'], body: hist })
      )
    };
  }

  /* ── Documents ────────────────────────────────────────────────────────── */
  const months = s => { const n = parseFloat(s); return /month/.test(s) ? n : /week/.test(s) ? n / 4.3 : /day/.test(s) ? n / 30 : n; };
  const kindId = k => k.toLowerCase().replace(/\s+/g, '-');
  const docLabels = { Runbook: ['operations', 'runbook'], Architecture: ['architecture'], Decisions: ['adr', 'architecture'], 'Release notes': ['release', '2026-12'], Postmortem: ['postmortem', 'inc-2291'], Planning: ['pi-planning', 'pi-2026-12'], Agreement: ['team-agreement', 'dod'], Interface: ['interface', 'carrier-export'] };
  const docCited = {
    0: [['Incident report INC-2291', '#/incident/INC-2291'], ['Postmortem INC-2291', null], ['Action A-9: update the manual', '#/knowledge/agreements']],
    1: [['Incident report INC-2299', '#/incident/INC-2299'], ['Risk R-3', null]],
    2: [], 3: [['ADR-029', null]], 4: [['ADR-029, ADR-030, ADR-031', '#/knowledge/decisions']],
    5: [['Release readiness of 2026.12', '#/release/readiness']], 6: [['Action A-15', '#/knowledge/agreements'], ['ADR-030', '#/knowledge/decisions']],
    7: [['Working agreement WA-4', '#/knowledge/agreements']], 8: [['Working agreement WA-2', '#/knowledge/agreements']], 9: [['Incident report INC-2299', '#/incident/INC-2299']]
  };
  const incidentReads = [
    { inc: 'INC-2299', doc: 1, what: 'restart steps of the export, used at 05:00' },
    { inc: 'INC-2299', doc: 9, what: 'the 30 s timeout of the carrier endpoint' },
    { inc: 'INC-2291', doc: 0, what: 'pool settings; the manual still named 20 connections' }
  ];
  function documentsPage(ctx) {
    const docs = D.docs.map((d, n) => Object.assign({ n: n }, d));
    const kinds = []; docs.forEach(d => { if (kinds.indexOf(d.kind) < 0) kinds.push(d.kind); });
    const tbl = K.table([
      { h: 'Page', cls: 'ttl', v: d => `<span class="ink">${esc(d.title)}</span>`, s: d => d.title },
      { h: 'Kind', cls: 's', v: d => K.tag(d.kind), s: d => d.kind },
      { h: 'Application', cls: 's', v: d => d.svc ? K.svc(d.svc) : '<span class="faint">–</span>', s: d => d.svc || '' },
      { h: 'Last edit', cls: 's', n: true, v: d => esc(d.edited), s: d => months(d.edited) },
      { h: '', cls: 's', v: d => K.dot(d.state) + (d.state === 'bad' ? ' <span class="c-bad">out of date</span>' : d.state === 'watch' ? ' <span class="c-watch">older than 6 months</span>' : ''), s: d => ({ bad: 0, watch: 1, ok: 2 }[d.state]),
        tip: 'Red: a runbook older than a year. Amber: older than six months.' }
    ], docs, { attrs: d => `data-dr="doc:${d.n}" data-f-dk="all ${kindId(d.kind)}"`, rowCls: () => 'kn-click' });
    const rb = D.services.map(s => {
      const d = docs.find(x => x.kind === 'Runbook' && x.svc === s.id);
      return { state: d ? d.state : s.tier === 1 ? 'bad' : 'watch', html: K.svc(s.id) + ` <span class="faint">tier ${s.tier}</span>`, sub: d ? esc(d.title) : 'no operations manual in the team space', v: d ? esc(d.edited) : '<span class="c-bad">none</span>' };
    });
    const ages = K.hbars(docs.slice().sort((a, b) => months(b.edited) - months(a.edited)).map(d => ({
      n: `<span data-tip="${esc(d.title)}">${esc(d.title.length > 30 ? d.title.slice(0, 28) + '…' : d.title)}</span>`, v: +months(d.edited).toFixed(1), cls: d.state === 'bad' ? 'bad' : d.state === 'watch' ? 'watch' : 's1',
      label: months(d.edited) >= 1 ? Math.round(months(d.edited)) + ' mo' : Math.max(1, Math.round(months(d.edited) * 30)) + ' d', tick: 6, tickTip: 'six months'
    })), { max: 15, nw: 190, vw: 44 });
    const reads = K.list(incidentReads.map(r => ({ tone: docs[r.doc].state, html: K.key(r.inc) + ` cites <button class="ent" data-dr="doc:${r.doc}">${esc(docs[r.doc].title)}</button><span class="faint"> · ${esc(r.what)}</span>`, v: esc(docs[r.doc].edited) })));
    return {
      lede: `The pages of the team space that the app watches: what kind they are, which application they belong to and how old they are. Window: ${ctx.pick({ pi: 'PI 26.4', quarter: 'Q4 2026' })}.`,
      acts: K.link('Search in the text', '#/search', 'btn'),
      kpis: [
        { l: 'Pages watched', v: docs.length, s: 'in the wiki space of the team' },
        { l: 'Out of date', v: docs.filter(d => d.state === 'bad').length, s: '<b>runbook</b> of checkout-api, 14 months', tone: 'bad' },
        { l: 'Older than six months', v: docs.filter(d => d.state === 'watch').length, s: 'pricing-engine runbook, DoD, interface', tone: 'watch' },
        { l: 'Applications without a runbook', v: 2, u: 'of 5', s: 'checkout-web, order-mail', tone: 'bad' },
        { l: 'Edited in 7 days', v: 3, s: 'release notes, ADRs, postmortem' }
      ],
      body: K.grid(
        K.panel({ title: 'Pages of the team space', sub: 'click a row for the page', w: 'c8 x6', src: ['wiki'], flush: true,
          body: `<div class="pd-0-14-8">${K.filter('dk', [['all', 'All', docs.length]].concat(kinds.map(k => [kindId(k), k, docs.filter(d => d.kind === k).length])))}</div>` + tbl }),
        K.panel({ title: 'Runbook per application', sub: '3 of 5 have one', w: 'c4 x3', src: ['wiki'], body: K.checks(rb),
          help: 'An operations manual is a page with the label runbook and the name of the application. Red: an application of tier 1 without one, or a manual older than a year.' }),
        K.panel({ title: 'Read lately by incidents', sub: 'pages an incident report cites', w: 'c4 x3', src: ['increp', 'wiki'], body: reads +
          K.note('The manual of checkout-api was cited during INC-2291 while it was 14 months old. Action A-9 has asked for its update for 54 days.', 'bad') }),
        K.panel({ title: 'Age of the pages', sub: 'months since the last edit', w: 'c4 x8', src: ['wiki'], body: ages }),
        K.panel({ title: 'What the app reads here', w: 'c4 x4', src: ['wiki'], body: K.note('The app reads titles, labels and the date of the last edit. It shows the text of a page only on screen, while you look, and stores none of it.', '') +
          `<div class="rowf mt-10" >${K.link('Search in the text', '#/search', 'btn sm pri')}<span class="faint fs-11" >for a search in Jira and Wiki text</span></div>` })
      )
    };
  }

  /* ── Definitions ──────────────────────────────────────────────────────── */
  const terms = [
    ['Committed', 'The items and story points in the sprint at the moment Start was pressed, with the points they had then.'],
    ['Done', 'In the last column of the board. Rejected counts as closed, not as done.'],
    ['Carried over', 'An item that was in an earlier sprint of this board and not done there. Its sprint no. counts the sprints it has been in.'],
    ['Cycle time', 'Days from the first status past To do until Done.'],
    ['Working day', 'Monday to Friday, without the public holidays of the team calendar. Sprint 42 has 15.'],
    ['Bug', 'An issue of type Bug in the board filter, whatever its age or priority.'],
    ['Incident', 'An incident report of the on-call with a priority. P2 or higher counts against the change before it.'],
    ['Release', 'A fix version that reached production. A hotfix or a patch is a release too.']
  ];
  function definitionsPage() {
    const F = Object.keys(D.facts).map(id => Object.assign({ id: id }, D.facts[id]));
    const glos = K.table([
      { h: 'Fact', cls: 's', v: f => `<span class="mono">${esc(f.id)}</span>`, s: f => f.id },
      { h: 'What is counted', cls: 'ttl', v: f => `<span class="ink">${esc(f.say)}</span><span class="sub">${esc(f.def)}</span>` },
      { h: 'Source', cls: 's', v: f => K.srcChip(f.src), s: f => f.src },
      { h: 'Version', cls: 's', v: f => `<span class="dim">${esc(f.v)}</span>`, s: f => f.v }
    ], F, { attrs: f => `data-ev="${esc(f.id)}"`, rowCls: () => 'kn-click' });
    const bySrc = {}; F.forEach(f => { bySrc[f.src] = (bySrc[f.src] || 0) + 1; });
    const srcRows = Object.keys(bySrc).sort((a, b) => bySrc[b] - bySrc[a]).map(id => ({ n: esc(K.source(id).name), v: bySrc[id], cls: 's1', label: bySrc[id] }));
    return {
      lede: 'The glossary of the numbers: what each one counts, where it comes from and which version of its definition it uses.',
      kpis: [
        { l: 'Facts with a definition', v: F.length, s: 'every headline number points to one' },
        { l: 'Terms without one fact', v: terms.length, s: 'used across pages' },
        { l: 'Changed in the PI', v: 3, u: 'definitions', s: 'forecast, bugs, work mix', tone: 'watch' },
        { l: 'Sources behind them', v: Object.keys(bySrc).length, s: 'Jira holds ' + bySrc.jira + ' of ' + F.length },
        { l: 'Typed in by the team', v: 1, s: 'capacity, from the wiki' }
      ],
      body: K.grid(
        K.panel({ title: 'Facts', sub: 'click a row for the query and the rows', w: 'c8 x6', src: ['jira', 'git', 'ci', 'testrep', 'mon', 'wiki'], flush: true, body: glos,
          help: 'One row per fact of the app. A page that shows the number reads this fact; the agent may cite it, and a sentence whose number is not this number is dropped.' }),
        K.stack('c4 x3',
          K.panel({ title: 'Terms', sub: 'words that have no single fact', foot: 'the same words on every page', body: K.kv(terms.map(t => [t[0], esc(t[1])])) }),
          K.panel({ title: 'The words for state', foot: 'one colour, one meaning', body: K.list([
          { tone: 'ok', html: '<b>On track</b>: the number is on the right side of its line. Nothing to do.' },
          { tone: 'watch', html: '<b>Needs a look</b>: close to the line or moving towards it. Worth a question.' },
          { tone: 'bad', html: '<b>Off track</b>: past the line. Something has to change, or a decision is due.' },
          { tone: '', html: '<b>No state</b>: no line was agreed, or the source is down. The app says so rather than guess.' }
        ]) + K.note('The line is named on each panel: a target the team agreed, a service level, or the team\'s own past (the 85 % line).', '') }),
          K.panel({ title: 'Facts by source', sub: 'where the defined numbers come from', foot: 'counted over the facts of this page', body: K.hbars(srcRows, { max: Math.max.apply(null, srcRows.map(r => r.v)), nw: 110, vw: 30 }) })),
        K.panel({ title: 'Changes of definitions', sub: 'in this PI', w: 'c12 x3', foot: 'kept by the app with each fact', body: K.feed([
          { t: '20.11', tone: 'watch', html: '<span class="mono">mix.unplanned</span> · work mix rule set to <b>version 2</b>', sub: 'support issues with a feature link count as support, not as feature work' },
          { t: '17.11', tone: 'watch', html: '<span class="mono">bugs.open</span> · bug definition to <b>version 2</b>', sub: 'bugs open before the PI count, whatever their age' },
          { t: '14.11', tone: 'watch', html: '<span class="mono">forecast.*</span> · forecast to <b>version 4</b>', sub: 'history window of 75 working days instead of 60' }
        ]) + K.note('A definition never changes silently. The old numbers keep the old version; a page that compares across a change says so.', '') })
      )
    };
  }

  /* ── drawers ──────────────────────────────────────────────────────────── */
  SM.drawer('risk', function (id) {
    const r = D.risks.find(x => x.id === id); if (!r) return null;
    const sig = (riskSignals[id] || []).map(s => ({ tone: r.level, html: esc(s[0]), cite: s[1] || 'no single fact', ev: s[1] || undefined }));
    return { kind: 'Risk · ' + esc(r.id) + ' · from your register', title: r.title, body:
      K.kv([['ROAM', K.pill(r.roam, roamTone[r.roam])], ['Level', K.dot(r.level) + ' ' + K.stateWord[r.level]], ['Owner', r.owner === 'not set' ? '<span class="c-watch">not set</span>' : esc(r.owner)],
        ['Review', reviewCell(r)], ['Links', r.links.length ? K.keys(r.links) : '<span class="faint">none</span>'], ['Exposure', ['', 'low', 'medium', 'high'][place[id][0]] + ' likelihood, ' + ['', 'low', 'medium', 'high'][place[id][1]] + ' impact']]) +
      K.sect('The answer') + (r.answer ? K.note(esc(r.answer), r.level) : K.note('No answer yet. A new risk gets an owner and a review date first.', 'watch')) +
      K.sect('Signals behind it', 'read from Jira and the other sources') + K.list(sig) +
      K.sect('History') + K.feed(riskHist[id].map(h => ({ t: h[0], tone: h[1], html: esc(h[2]) }))) +
      `<div class="mt-14">${K.note('Titles and answers you type stay on this computer and never go to a model.', '')}</div>` +
      `<div class="rowf mt-12" ><button class="btn sm" data-toast="The register is your own file on this computer. This demo does not change it.">Edit in the register</button>${K.link('All risks', '#/knowledge/risks', 'btn sm')}</div>` };
  });

  SM.drawer('decision', function (id) {
    const d = D.decisions.find(x => x.id === id); if (!d) return null;
    const m = decMeta[id] || { facts: [] };
    let opts;
    if (id === 'D-1') {
      opts = `<div class="faint fs-11 mg-0-0-2 d-flex jc-sb" ><span>Option</span><span>chance to finish the rest</span></div>` + D.sprint.options.map(o => `<div class="opt"><b>${esc(o.label)}</b><span class="o-sp">${o.sp} SP out</span>
        <div class="hb"><span></span><span class="tr"><i class="fl ${o.chance >= 50 ? 'ok' : o.chance >= 25 ? 'watch' : 'bad'}" style="width:${o.chance}%"></i></span><span class="vv">${o.chance} %</span></div>
        ${o.moves.length ? `<span class="mv">${K.keys(o.moves)}</span>` : ''}</div>`).join('');
    } else if (m.opts) {
      opts = K.checks(m.opts.map((o, n) => ({ state: '', html: `<b>${'AB'[n]}. ${esc(o[0])}</b>`, sub: esc(o[1]) })));
    } else {
      opts = `<p class="dim fs-12 lh-155" >The options and the reasons are on the wiki page. The app reads its title, number and date.</p><div class="rowf mt-6" >${K.extLink('Open ' + d.id + ' in the wiki', 'Wiki')}</div>`;
    }
    const facts = K.list(m.facts.map(f => ({ tone: d.level || 'ok', html: esc(f[0]), cite: f[1] || 'no single fact', ev: f[1] || undefined })));
    const links = decKeys[id] && decKeys[id].length ? K.sect('Linked') + K.keys(decKeys[id]) : '';
    const made = d.state === 'made';
    return { kind: 'Decision · ' + esc(d.id) + ' · ' + (made ? 'decided ' + esc(d.on) : 'waiting since ' + esc(m.since)), title: d.title, body:
      K.sect('The question') + `<p class="dim fs-12 lh-155" >${esc(made ? d.title : d.text)}</p>` +
      K.sect(made ? 'How it was decided' : 'The options', made ? '' : 'what each does') + opts +
      K.sect('Who decides and by when') + K.kv(made ? [['Decided by', esc(d.owner)], ['On', esc(d.on)], ['Written in', esc(d.text)]] :
        [['Decides', esc(d.owner)], ['By', `<span class="c-${d.level}">${esc(d.due)}</span>`], ['Waiting since', esc(m.since)], ['Risk', m.risk ? rkey(m.risk) : '<span class="faint">none</span>']]) +
      K.sect('The facts behind it') + facts + links +
      `<div class="mt-14">${K.note(made ? 'Read from the wiki. The app changes nothing there.' : 'When you mark it decided, the app records the choice in your own file on this computer. Nothing goes to Jira.', '')}</div>` +
      `<div class="rowf mt-12" >${K.link(made ? 'All decisions' : 'Open the numbers', made ? '#/knowledge/decisions' : d.to, 'btn sm pri')}${made ? '' : `<button class="btn sm" data-toast="Marked in your notes on this computer. This demo does not change them.">Mark as decided</button>`}</div>` };
  });

  SM.drawer('doc', function (n) {
    const d = D.docs[+n]; if (!d) return null;
    const labels = (docLabels[d.kind] || []).concat(d.svc ? [d.svc] : []);
    const cited = docCited[+n] || [];
    return { kind: 'wiki page · ' + esc(d.kind), title: d.title, body:
      K.kv([['Kind', K.tag(d.kind)], ['Application', d.svc ? K.svc(d.svc) : '<span class="faint">none</span>'], ['Last edit', esc(d.edited)],
        ['State', K.dot(d.state) + ' ' + (d.state === 'bad' ? 'out of date: a runbook older than a year' : d.state === 'watch' ? 'older than six months' : 'recent enough')], ['Labels', labels.map(K.tag).join(' ')]]) +
      K.sect('Where it is cited') + (cited.length ? K.list(cited.map(c => ({ tone: '', html: c[1] ? K.link(c[0], c[1]) : esc(c[0]) }))) : '<p class="faint fs-12" >No incident report, decision or action cites this page.</p>') +
      `<div class="mt-14">${K.note('The app reads the title, the labels and the date of the last edit. The text is shown only on screen and stored nowhere.', '')}</div>` +
      `<div class="rowf mt-12" >${K.extLink('Open in the wiki', 'Wiki')}${K.link('All documents', '#/knowledge/documents', 'btn sm')}</div>` };
  });

  SM.domain({
    id: 'knowledge', title: 'Knowledge', icon: 'knowledge',
    pages: [
      { id: 'risks', title: 'Risks', hz: ['sprint', 'pi'], was: 'kept', from: 'Risks', find: 'risk register roam exposure pre-mortem signals', render: risksPage },
      { id: 'decisions', title: 'Decisions', hz: ['sprint', 'pi'], was: 'new', from: 'Today and Promises (Decision waiting)', find: 'decision adr architecture waiting log', render: decisionsPage },
      { id: 'agreements', title: 'Agreements and actions', hz: ['sprint', 'pi'], was: 'new', from: 'Sprint (was a line under Not connected)', find: 'working agreements retro retrospective actions improvement', render: agreementsPage },
      { id: 'documents', title: 'Documents', hz: ['pi', 'quarter'], was: 'new', from: 'Search (demo part)', find: 'wiki pages runbook operations manual docs', render: documentsPage },
      { id: 'definitions', title: 'Definitions', hz: ['pi'], was: 'new', from: 'System (All facts), the ? of each panel', find: 'glossary facts terms definition versions', render: definitionsPage }
    ]
  });
})();
