/* Home without roles, and the briefings.
   Overview follows the loop of steering a team, the same for everybody:
   Promises (what we said) · At risk (what can break a promise) · To decide (what waits for a choice) · Changed (what moved).
   The proof behind every row is a domain page. A person narrows the overview by focus (a domain), never by a job title.
   Briefings are the second plane: what the facts bring to each event of the team (Daily, Review, Go or no-go, PI Planning).
   Neither page keeps a number of its own: every row is a view of a fact that lives on a domain page. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, S = D.sprint, f = S.forecast;
  const FOCUS = [['all', 'Everything'], ['delivery', 'Delivery'], ['product', 'Product'], ['eng', 'Engineering'], ['quality', 'Quality'], ['ops', 'Operations'], ['release', 'Release']];
  /* Knowledge is no focus: its risks, decisions and agreements are the planes of this page, each shown under the area of work it belongs to */
  const ORDER = { bad: 0, watch: 1, ok: 2 };
  const yesterday = D.snapDays[D.snapDays.indexOf(D.now.date) - 1] || D.now.date;
  const since = () => D.events.filter(e => e.d >= yesterday);
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const P = (tone, html, to) => ({ tone: tone, html: html, to: to });
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /* ── the promises of the team: one list over every domain ─────────────── */
  const iso = s => '2026-' + s.slice(-2) + '-' + s.slice(-5, -3);                 // 'Fri 27.11' -> 2026-11-27
  const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = d => DAYN[new Date(d + 'T00:00:00Z').getUTCDay()] + ' ' + K.dm(d);
  function workdaysAfter(d, n) {
    const t = new Date(d + 'T00:00:00Z');
    while (n > 0) { t.setUTCDate(t.getUTCDate() + 1); if (t.getUTCDay() % 6) n--; }
    return t.toISOString().slice(0, 10);
  }
  const SOON = workdaysAfter(D.now.date, 3);
  const ACTIVE = D.cal.sprints.find(x => x.state === 'active');
  /* the numbers of this page are views, so their evidence is built with them and stays out of the list under System › Facts */
  const putFact = (id, f) => { Object.defineProperty(D.facts, id, { value: f, enumerable: false, configurable: true, writable: true }); return id; };
  const V1 = 'definition 1 of 21.11.2026';
  const evb = (id, label) => `<button class="ov-ev" data-ev="${esc(id)}">${label}</button>`;

  function promises() {
    const ok = D.readiness.filter(c => c.state === 'ok').length, rel = K.release('R2026.12');
    const list = [{ id: 'sprint', short: 'Sprint ' + S.id, kind: 'Sprint', dom: 'delivery', src: ['jira'], day: iso(S.to), fact: 'forecast.chance_all', text: `Sprint ${S.id}: ${S.committedSp} SP committed at the start`, due: S.to, state: f.all < 50 ? 'bad' : f.all < 85 ? 'watch' : 'ok',
      ev: `${f.all} % to finish everything · 85 % sure of ${f.p85} SP`, to: '#/delivery/sprint', risks: ['R-2'], dec: 'D-1' }];
    D.objectives.forEach(o => { const x = K.feature(o.feat), due = o.n === 3 ? 'Sun 13.12' : 'Fri 11.12'; list.push({ id: 'obj' + o.n, short: 'PI objective ' + o.n, kind: o.committed ? 'PI objective' : 'PI objective, uncommitted', dom: 'product', src: ['jira', 'wiki'], day: iso(due), text: `${o.n} · ${o.text}`, due: due, state: o.state,
      ev: `${x.done} of ${x.sp} SP · forecast ${K.dm(x.eta[0])} to ${K.dm(x.eta[1])}`, to: '#/product/objectives', risks: o.n === 3 ? ['R-1'] : o.n === 4 ? ['R-3'] : [], dec: o.n === 3 ? 'D-2' : null,
      def: `Story points of feature ${x.key} done against those planned in the PI. The forecast comes from the team's own finished points. The rows are its issues in the running sprint.`, q: `"Feature Link" = ${x.key}`, rows: D.issues.filter(i => i.feat === x.key).length }); });
    list.push({ id: 'release', short: 'Release 2026.12', kind: 'Release', dom: 'release', src: ['jira', 'ci', 'testrep', 'wiki', 'mon'], day: iso(rel.date.slice(0, 9)), gate: iso(rel.freeze), text: rel.name + ' with ' + plural(rel.feats.length, 'feature', 'features'), due: rel.date.slice(0, 9), state: ok >= 6 ? 'watch' : 'bad',
      ev: `${ok} of ${D.readiness.length} checks pass · ${rel.issuesDone} of ${rel.issues} issues done`, to: '#/release/readiness', risks: ['R-1', 'R-4', 'R-6'], dec: 'D-2',
      def: 'Issues of the fix version done against all of them, and the eight readiness checks. The promise is off track while fewer than six checks pass.', q: 'fixVersion = "2026.12"', rows: rel.issues });
    D.slos.forEach(s => list.push({ id: s.id, short: s.name, kind: 'Service level', dom: 'ops', src: ['mon'], day: null, text: `${s.name}: ${s.target} % over ${s.win}`, due: 'rolling', state: s.state, ev: `${s.actual} % · budget ${s.left <= 0 ? 'spent' : s.left + ' % left'}`, to: '#/ops/slo',
      risks: s.id === 'slo-export-time' ? ['R-3'] : [], dec: s.id === 'slo-export-time' ? 'D-3' : null,
      def: `Target ${s.target} % over ${s.win}. The budget is ${s.budget}; ${s.used} % of it is used.`, q: `FROM ServiceLevel SELECT ... WHERE sli.guid = '…${s.id}' SINCE 30 days ago`, rows: /nights/.test(s.win) ? 30 : 43200 }));
    D.agreements.forEach(a => { const g = K.agreed(a), pr = a.id === 'WA-1'; list.push({ id: a.id, short: 'Agreement ' + a.id, kind: 'Working agreement', dom: a.to.split('/')[1], src: pr ? ['git'] : ['jira'], day: null, text: a.text, due: 'standing', state: a.state, ev: g.v + ' ' + g.sub, to: a.to, risks: [], dec: null,
      def: `Working agreement ${a.id}, checked against the data: ${g.v} ${g.sub}.`, q: pr ? 'GET /rest/api/1.0/projects/SHOP/repos/*/pull-requests?state=MERGED' : 'filter = 7', rows: a.of === 100 ? '126 SP' : a.of }); });
    [['KES-4127', 'OSP-2210 of Team Osprey', 'Fri 20.11', 'in Approve'], ['KES-4146', 'OPS-77 of Platform operations', 'Fri 27.11', 'in Implementing for 2 days']].forEach(x => list.push({ id: 'date-' + x[0], short: x[0], kind: 'Date given to another team', dom: 'delivery', src: ['jira'], day: iso(x[2]), text: `${x[0]} for ${x[1]}`, due: x[2], state: 'ok', ev: x[3], to: '#/delivery/dependencies', risks: [], dec: null,
      def: `The date the team gave for ${x[0]}, against the status of the issue.`, q: `key = ${x[0]}`, rows: 1 }));
    list.forEach(p => {
      const st = K.srcState(p.src[0]);
      p.unread = st === 'off' || st === 'down' ? st : null;                     // no number of unknown age, the same rule as a panel
      p.partial = p.unread ? [] : p.src.slice(1).filter(id => /off|down/.test(K.srcState(id))).map(id => K.source(id).name);
      p.factId = p.fact || putFact('promise.' + p.id, { say: p.text + ': ' + p.ev, def: p.def, src: p.src[0], srcs: p.src, q: p.q, rows: p.rows, v: V1 });
    });
    return list;
  }
  /* which promises a risk of the register puts at risk */
  const THREAT = { 'R-1': ['product', ['obj3', 'release']], 'R-2': ['delivery', ['sprint']], 'R-3': ['ops', ['slo-export-time', 'obj4']], 'R-4': ['eng', ['release']], 'R-5': ['ops', []], 'R-6': ['release', ['release']] };
  const SIGNALS = [
    { id: 'blocked', dom: 'delivery', src: 'jira', level: 'bad', text: 'KES-4079 is blocked for 13 days, in its third sprint', hits: ['sprint', 'release'], to: '#/issue/KES-4079', def: 'An open item that stands in the status Blocked for ten days or more.', q: 'key = KES-4079 AND status = Blocked', rows: 1 },
    { id: 'red', dom: 'eng', src: 'ci', level: 'bad', text: 'pricing-engine: main is red for 19 hours', hits: ['release'], to: '#/eng/builds', def: 'The last run of the main pipeline of a repository failed.', q: 'GET /job/SHOP/job/pricing-engine/job/main/api/json', rows: 1 },
    { id: 'wait', dom: 'eng', src: 'git', level: 'watch', text: 'The wait for a first review doubled in week 46', hits: ['WA-1'], to: '#/eng/prs', def: 'Median hours to a first review in a week, against the median of the last six weeks.', q: 'GET /rest/api/1.0/projects/SHOP/repos/*/pull-requests?state=MERGED', rows: D.prStats.merged6w },
    { id: 'errors', dom: 'ops', src: 'mon', level: 'watch', text: 'pricing-engine: error rate up since 17.11 21:12', hits: ['slo-price-avail'], to: '#/ops/errors', def: 'A new error group whose count keeps growing.', q: "FROM TransactionError SELECT count(*) WHERE appName = 'pricing-engine' SINCE 1 day ago", rows: 268 },
    { id: 'regress', dom: 'quality', src: 'testrep', level: 'watch', text: 'Nightly regression at 94.4 %, 5 failures nobody has looked at', hits: ['release'], to: '#/quality/tests', def: 'Failed items of the last nightly launch that carry no defect type yet.', q: 'GET /api/v1/kestrel/item?filter.eq.launchId=last&filter.in.issueType=ti001', rows: 5 }
  ];
  const DOMSRC = { delivery: 'jira', product: 'jira', eng: 'ci', quality: 'testrep', ops: 'mon', release: 'ci', knowledge: 'wiki' };
  const EVWORD = { worse: 'A fact moved to a worse state.', better: 'A fact came back to a better state.', in: 'An item came in after the start.', done: 'An item was finished.', change: 'A release, a decision or a risk changed.', info: 'A date of the calendar.' };

  /* ── the events of the team, and what the facts bring to each ─────────── */
  const blocked = () => D.issues.filter(i => i.st === 'blocked').sort((a, b) => b.dis - a.dis);
  const STN = { impl: 'Implementing', review: 'Review', approve: 'Approve' };
  const OCC = [
    { id: 'daily', name: 'Daily', when: 'Thu 19.11 09:15', settle: 'Who needs help today, and what is in the way of the sprint.', ask: 'What should we talk about in the Daily?', dec: ['D-1'], risks: ['R-2'],
      pages: [['Sprint board', '#/delivery/sprint'], ['Flow', '#/delivery/flow'], ['Pull requests', '#/eng/prs'], ['Builds', '#/eng/builds']],
      points() {
        const b = blocked(), h = D.sprintHist.chance, out = [], ev = since();
        const slow = D.issues.filter(i => STN[i.st] && i.dis > D.flow.p50).sort((x, y) => y.dis - x.dis).slice(0, 3);
        const prs = D.prs.filter(p => p.st !== 'approved' && p.wait >= 24), build = D.readiness.find(c => c.id === 'build');
        if (b.length) out.push(P('bad', `<b>${plural(b.length, 'item is', 'items are')} blocked:</b> ${b.map(i => `${K.key(i.key)} for ${i.dis} days`).join(', ')}`, '#/delivery/sprint'));
        if (build.state !== 'ok') out.push(P('bad', `<b>Main is not green:</b> ${esc(build.sub)}`, '#/eng/builds'));
        if (prs.length) out.push(P('watch', `<b>${plural(prs.length, 'pull request waits', 'pull requests wait')} for a review for a working day or longer:</b> ${prs.map(p => `<button class="key" data-dr="pr:${p.id}">#${p.id}</button> ${p.wait} h`).join(', ')}`, '#/eng/prs'));
        if (slow.length) out.push(P('watch', `<b>Longer in a status than half of all items take from start to done (${D.flow.p50} days):</b> ${slow.map(i => `${K.key(i.key)} ${i.dis} days in ${STN[i.st]}`).join(', ')}`, '#/delivery/flow'));
        if (D.flow.wip > D.flow.wipLimit) out.push(P('watch', `<b>${D.flow.wip} items are in Implementing.</b> The working agreement says at most ${D.flow.wipLimit}`, '#/delivery/flow'));
        out.push(P(h[h.length - 1] < h[h.length - 2] ? 'bad' : '', `<b>The chance to finish everything went from ${h[h.length - 2]} % to ${h[h.length - 1]} %</b> since yesterday`, '#/delivery/sprint'));
        out.push(P('', `<b>${plural(ev.length, 'event', 'events')} since yesterday,</b> ${ev.filter(e => e.tone === 'bad').length} of them for the worse`, '#/events'));
        return out;
      } },
    { id: 'status', name: 'Weekly status', when: 'Fri 20.11', settle: 'What the train and the stakeholders should know this week.', ask: 'What do I have to decide this week?', dec: ['D-1', 'D-2', 'D-3'], risks: ['R-1'],
      pages: [['Event log and weekly digest', '#/events'], ['Objectives', '#/product/objectives'], ['Release readiness', '#/release/readiness'], ['Risks', '#/knowledge/risks']],
      points() {
        const p = promises(), n = s => p.filter(x => x.state === s).length, wk = D.events.filter(e => e.d >= '2026-11-16'), dec = D.decisions.filter(d => d.state === 'waiting');
        const off = p.filter(x => x.state === 'bad' && x.kind !== 'Working agreement');
        return [P('bad', `<b>${n('bad')} of ${p.length} promises are off track,</b> ${n('watch')} need a look, ${n('ok')} are on track`, '#/home/overview'),
          P('bad', `<b>Off track:</b> ${off.map(x => esc(x.kind === 'PI objective' ? 'objective ' + x.text.slice(0, 1) : x.kind === 'Sprint' ? 'sprint ' + S.id : x.kind === 'Release' ? 'release 2026.12' : x.text.split(':')[0])).join(', ')}`, '#/home/overview'),
          P('watch', `<b>${plural(dec.length, 'decision waits', 'decisions wait')}:</b> ${dec.map(d => `<button class="key" data-dr="decision:${d.id}">${d.id}</button> due ${esc(d.due)}`).join(', ')}`, '#/knowledge/decisions'),
          P('', `<b>${plural(wk.length, 'event', 'events')} this week:</b> ${wk.filter(e => e.tone === 'bad').length} for the worse, ${wk.filter(e => e.tone === 'ok').length} for the better`, '#/events'),
          P('', `<b>${plural(D.risks.filter(r => r.level !== 'ok').length, 'risk is', 'risks are')} open,</b> ${D.risks.filter(r => r.roam === 'New').length} without an owner`, '#/knowledge/risks')];
      } },
    { id: 'review', name: 'Sprint Review', when: 'Fri 27.11', settle: 'What the sprint delivered against what was committed, and what that means for the PI.', ask: 'Will we finish the sprint?', dec: ['D-1'], risks: ['R-2', 'R-1'],
      pages: [['Sprint', '#/delivery/sprint'], ['Features', '#/product/features'], ['Objectives', '#/product/objectives'], ['Drafts in the Inbox', '#/inbox']],
      points() {
        const by = {}; D.issues.filter(i => i.st === 'done' && i.feat).forEach(i => { by[i.feat] = (by[i.feat] || 0) + 1; });
        const held = D.lookback.filter(l => l.held).length;
        return [P('', `<b>Committed at the start: ${S.committedSp} SP in ${S.committedItems} items.</b> Done on day ${D.now.day} of ${D.now.days}: ${S.doneSp} SP in ${S.doneItems} items`, '#/delivery/sprint'),
          P(f.p50 < S.committedSp ? 'bad' : 'ok', `<b>By the end, 85 % sure of at least ${f.p85} SP;</b> an even chance for ${f.p50} SP`, '#/delivery/sprint'),
          P('watch', `<b>Scope after the start:</b> ${S.addedSp} SP in ${plural(S.addedItems, 'item', 'items')} came in, ${S.removedSp} SP in ${plural(S.removedItems, 'item', 'items')} went out`, '#/delivery/sprint'),
          P('', `<b>Done so far, by feature:</b> ${Object.keys(by).map(k => `${K.key(k)} ${plural(by[k], 'item', 'items')}`).join(', ')}`, '#/product/features'),
          P('watch', `<b>Open today: ${S.openSp} SP in ${S.openItems} items,</b> ${blocked().length} of them blocked`, '#/delivery/sprint'),
          P('', `<b>How far to trust the forecast:</b> the 85 % line held in ${held} of ${D.lookback.length} look-backs on closed sprints`, '#/delivery/sprint')];
      } },
    { id: 'retro', name: 'Retrospective', when: 'Fri 27.11', settle: 'What the data would ask. The team answers, the tool only brings the questions.', ask: 'What would the data ask in the retrospective?', dec: [], risks: [],
      pages: [['Agreements', '#/knowledge/agreements'], ['Flow', '#/delivery/flow'], ['Capacity and work mix', '#/delivery/capacity'], ['Pull requests', '#/eng/prs']],
      points() {
        const act = D.actions.filter(a => a.state === 'open' && /^Retro/.test(a.from)), broken = D.agreements.filter(a => a.state !== 'ok');
        const carried = D.issues.filter(i => i.n >= 2 && i.st !== 'done'), stage = D.flow.stages.slice().sort((a, b) => b[1] - a[1])[0];
        const un = D.workmix.filter(w => w.id === 'bugs' || w.id === 'support').reduce((s, w) => s + w.pct, 0), nd = D.velocity.filter(v => !v.ip).map(v => v.done);
        return [P(act.some(a => a.old) ? 'bad' : 'watch', `<b>${plural(act.length, 'action', 'actions')} of earlier retrospectives are open,</b> ${act.filter(a => a.old).length} of them older than 30 days: ${act.map(a => esc(a.id)).join(', ')}`, '#/knowledge/agreements'),
          P('bad', `<b>${plural(broken.length, 'working agreement was', 'working agreements were')} not kept:</b> ${broken.map(a => `${esc(a.id)}: ${esc(K.agreed(a).v)} ${esc(K.agreed(a).sub)}`).join('; ')}`, '#/knowledge/agreements'),
          P('watch', `<b>${plural(carried.length, 'open item is', 'open items are')} in a second sprint or later:</b> ${carried.map(i => `${K.key(i.key)} (sprint no. ${i.n})`).join(', ')}`, '#/delivery/sprint'),
          P('watch', `<b>${S.addedSp} SP came in after the start</b> of a sprint that held ${S.committedSp} SP, against ${Math.min.apply(null, nd)} to ${Math.max.apply(null, nd)} SP finished in a full sprint`, '#/delivery/sprint'),
          P('', `<b>An item spends most of its time in ${esc(stage[0])}:</b> ${stage[1]} days, with ${D.flow.p50} days from start to done for half of all items`, '#/delivery/flow'),
          P(un > 20 ? 'bad' : '', `<b>Bugs and support took ${un} % of the done work of the PI.</b> The agreement says at most 20 %`, '#/delivery/capacity')];
      } },
    { id: 'planning', name: 'Sprint Planning', when: 'Mon 30.11', settle: 'How much fits into the next sprint, with what is carried over counted first.', ask: 'Does the sprint fit the capacity?', dec: ['D-1'], risks: ['R-4'],
      pages: [['Capacity and work mix', '#/delivery/capacity'], ['Backlog readiness', '#/product/readiness'], ['Dependencies', '#/delivery/dependencies'], ['Sprint', '#/delivery/sprint']],
      points() {
        const c = D.capacity[D.capacity.length - 1], ip = D.velocity.find(v => v.ip), rel = K.release('R2026.12'), nd = D.velocity.filter(v => !v.ip).map(v => v.done);
        return [P('watch', `<b>${c.avail} of ${c.planned} person-days are available</b> in sprint ${esc(c.id)}: ${c.absent} absent, ${c.duty} on duty`, '#/delivery/capacity'),
          P('bad', `<b>${S.scopeSp - f.p50} to ${S.scopeSp - f.p85} SP will likely carry over</b> from sprint ${S.id}: scope ${S.scopeSp} SP, forecast ${f.p85} to ${f.p50} SP done`, '#/delivery/sprint'),
          P('', `<b>The last sprint of this kind</b> (${esc(ip.id)}) committed ${ip.committed} SP and finished ${ip.done}`, '#/delivery/pi'),
          P('', `<b>A full sprint finished ${Math.min.apply(null, nd)} to ${Math.max.apply(null, nd)} SP</b> in the last ${nd.length} full sprints`, '#/delivery/pi'),
          P('watch', `<b>${rel.issues - rel.issuesDone} issues of ${esc(rel.name)} are open</b> and the code freeze is on ${esc(rel.freeze)}, before this planning`, '#/release/readiness'),
          P('', `<b>Two dates were given to other teams:</b> KES-4127 by Fri 20.11, KES-4146 by Fri 27.11`, '#/delivery/dependencies')];
      } },
    { id: 'gonogo', name: 'Go or no-go', when: 'Wed 02.12', settle: 'Does release 2026.12 go to production on Thu 03.12.', ask: 'Is release 2026.12 ready?', dec: ['D-2', 'D-3'], risks: ['R-1', 'R-4', 'R-6'],
      pages: [['Release readiness', '#/release/readiness'], ['Environments', '#/release/environments'], ['Service levels', '#/ops/slo'], ['Tests', '#/quality/tests']],
      points() {
        const n = s => D.readiness.filter(c => c.state === s).length;
        return [P(n('bad') ? 'bad' : n('watch') ? 'watch' : 'ok', `<b>${n('ok')} of ${D.readiness.length} checks pass today,</b> ${n('watch')} need a look, ${n('bad')} fail`, '#/release/readiness')]
          .concat(D.readiness.filter(c => c.state !== 'ok').map(c => P(c.state, `<b>${esc(c.text)}:</b> ${esc(c.v)}. ${esc(c.sub)}`, '#/release/readiness')));
      } },
    { id: 'pi', name: 'PI Planning', when: 'Wed 09.12', settle: 'What the team can promise for the next PI, read from how this one went.', ask: 'Where did the time of the PI go?', dec: ['D-2'], risks: ['R-1', 'R-3'],
      pages: [['PI', '#/delivery/pi'], ['Objectives', '#/product/objectives'], ['Capacity and work mix', '#/delivery/capacity'], ['Risks', '#/knowledge/risks'], ['Roadmap', '#/product/roadmap']],
      points() {
        const pr = D.predictability.map(p => Math.round(p.actual / p.planned * 100)), o = D.objectives, late = D.features.filter(x => x.eta && x.eta[1] > D.cal.pi.to);
        const mix = D.workmix.find(w => w.id === 'business'), bugs = D.workmix.find(w => w.id === 'bugs'), cap = D.capacity.filter(c => c.sp != null), old = D.actions.filter(a => a.state === 'open' && a.old);
        return [P('', `<b>Predictability of the last three PIs: ${pr.join(', ')} %</b> of the planned business value`, '#/delivery/pi'),
          P(o.some(x => x.state === 'bad') ? 'bad' : 'watch', `<b>Objectives of this PI:</b> ${o.filter(x => x.state === 'ok').length} on track, ${o.filter(x => x.state === 'watch').length} need a look, ${o.filter(x => x.state === 'bad').length} off track`, '#/product/objectives'),
          P(late.length ? 'bad' : 'ok', late.length ? `<b>${plural(late.length, 'feature has', 'features have')} a forecast past the end of the PI:</b> ${late.map(x => K.key(x.key)).join(', ')}` : '<b>Every feature has a forecast inside the PI</b>', '#/product/features'),
          P('watch', `<b>Business features took ${mix.pct} % of the done work</b> against a target of ${mix.target} %; bugs and incidents ${bugs.pct} % against ${bugs.target} %`, '#/delivery/capacity'),
          P('', `<b>Available against planned person-days:</b> ${cap.map(c => `${c.avail} of ${c.planned} in ${esc(c.id)}`).join(', ')}`, '#/delivery/capacity'),
          P('watch', `<b>${plural(D.risks.filter(r => r.level !== 'ok').length, 'risk', 'risks')} to go through again,</b> and ${plural(old.length, 'action', 'actions')} older than 30 days: ${old.map(a => esc(a.id)).join(', ')}`, '#/knowledge/risks')];
      } }
  ];
  const tone = pts => pts.some(p => p.tone === 'bad') ? 'bad' : pts.some(p => p.tone === 'watch') ? 'watch' : 'ok';
  function ribbon(cur) {
    return `<div class="coming">${OCC.map(o => { const pts = o.points(); return `<button class="cm-card${o.id === cur ? ' on' : ''}" data-act="brief" data-id="${o.id}"><small>${K.dot(tone(pts))}${esc(o.when)}</small><b>${esc(o.name)}</b><span>${plural(pts.length, 'point', 'points')} from the facts</span></button>`; }).join('')}</div>`;
  }
  SM.acts = SM.acts || {};
  SM.acts.brief = t => { SM.ui.brief = t.getAttribute('data-id'); SM.touch('brief'); SM.go('#/briefings'); };

  /* ── Overview ─────────────────────────────────────────────────────────── */
  const offline = id => /off|down/.test(K.srcState(id));
  const srcWord = id => K.source(id).name + (K.srcState(id) === 'off' ? ' is not connected' : ' did not answer');
  function overview(ctx) {
    const fo = FOCUS.some(x => x[0] === SM.ui.focus) ? SM.ui.focus : 'all', keep = x => fo === 'all' || x.dom === fo, hz = ctx.hz;
    const closed = hz === 'sprint' && ctx.sp.state === 'closed', end = hz === 'sprint' && !closed ? ctx.sp.to : ACTIVE.to;
    const inHz = p => hz === 'pi' ? true : hz === 'today' ? (!p.unread && p.state === 'bad') || (!!p.day && p.day <= SOON) : !p.day || (p.gate || p.day) <= end;
    const every = promises(), byId = id => every.find(p => p.id === id);
    const wide = every.filter(inHz), all = wide.filter(keep);
    const rank = p => p.unread ? 3 : ORDER[p.state], list = all.slice().sort((a, b) => rank(a) - rank(b));
    const read = all.filter(p => !p.unread), n = st => read.filter(p => p.state === st).length;
    const when = st => { const r = read.filter(p => p.state === st), d = r.filter(p => p.day).length; return r.length ? `${d} with a date, ${r.length - d} ongoing` : 'none'; };
    const srcs = Array.from(new Set(all.reduce((s, p) => s.concat(p.src), [])));
    const kinds = new Set(all.map(p => p.kind.split(',')[0])).size;
    const cnt = { open: list.filter(p => p.unread || p.state !== 'ok').length, ok: list.filter(p => !p.unread && p.state === 'ok').length, all: list.length };
    let cf = SM.ui['f:prom'] || 'open'; if (!cnt[cf]) cf = 'all'; SM.ui['f:prom'] = cf;

    const lives = id => wide.some(p => p.id === id), label = id => (byId(id) || {}).short || id;
    const reach = t => hz === 'pi' || !t.hits.length || t.hits.some(lives);
    const risks = D.risks.filter(r => r.level !== 'ok').map(r => ({ dom: THREAT[r.id][0], level: r.level, id: r.id, text: r.title, hits: THREAT[r.id][1], sub: r.roam + ' · ' + r.owner + ' · review ' + r.review,
      ev: putFact('risk.' + r.id, { say: r.title, def: `Your own entry in the risk register: ${r.roam}, owner ${r.owner}, review ${r.review}. The level is yours; code only watches the objects it names.`, notes: true, q: 'var/notes/risks: ' + r.id, rows: 1, v: 'your note' }) }));
    const signals = SIGNALS.filter(s => !offline(s.src)).map(s => Object.assign({}, s, { sub: 'a signal from the sources, not in the register', ev: putFact('signal.' + s.id, { say: s.text, def: s.def, src: s.src, q: s.q, rows: s.rows, v: V1 }) }));
    const lost = SIGNALS.filter(s => offline(s.src) && keep(s));
    const threats = risks.concat(signals).filter(t => keep(t) && reach(t)).sort((a, b) => ORDER[a.level] - ORDER[b.level]);

    const decsAll = D.decisions.filter(d => d.state === 'waiting' && (hz !== 'today' || iso(d.due) <= SOON));
    const decs = decsAll.filter(d => fo === 'all' || d.to.split('/')[1] === fo), cmp = SM.cmp && SM.cmp.on;
    const from = hz === 'today' ? yesterday : hz === 'sprint' ? (closed ? ACTIVE.from : ctx.sp.from) : D.cal.pi.from;
    const changedWord = hz === 'today' ? 'since yesterday' : hz === 'sprint' ? 'in sprint ' + (closed ? ACTIVE.id : ctx.sp.id) : 'in the PI';
    const evAll = (cmp ? SM.cmpEvents() : D.events.filter(e => e.d >= from)).filter(keep), evs = evAll.slice().reverse().slice(0, 9);
    const evSrc = Array.from(new Set(evs.map(e => DOMSRC[e.dom])));

    const kp = (id, say, def, rows, ss) => putFact('overview.' + id, { say: say, def: def, srcs: ss, notes: !ss.length, q: 'the rows of this panel, in the chosen horizon and focus', rows: rows, v: V1 });
    const scope = (hz === 'today' ? 'off track or due by ' + dayName(SOON) : hz === 'sprint' ? 'due by ' + dayName(end) + ', and what runs all the time' : 'the whole PI') + (fo === 'all' ? '' : ', ' + FOCUS.find(x => x[0] === fo)[1]);
    const unread = all.filter(p => p.unread), offNames = Array.from(new Set(unread.map(p => p.src[0])));
    const barP = unread.length ? `${offNames.map(srcWord).join(', ')}: ${plural(unread.length, 'promise is', 'promises are')} not read and not counted.` : true;
    const barR = lost.length ? `${Array.from(new Set(lost.map(s => s.src))).map(srcWord).join(', ')}: ${plural(lost.length, 'signal is', 'signals are')} not read. The risks are your own notes and stay.` : true;
    const offEv = evSrc.filter(offline);
    const barC = offEv.length ? `${offEv.map(srcWord).join(', ')}: the log stops at its last read.` : true;

    const pTable = K.table([
      { h: '', cls: 's', v: p => K.dot(p.unread ? '' : p.state, !!p.unread), s: rank },
      { h: 'Promise', cls: 'ttl', v: p => `<a class="dim" href="${p.to}">${esc(p.text)}</a><span class="sub">${esc(p.kind)}</span>` },
      { h: 'Due', cls: 's', v: p => esc(p.due) },
      { h: 'Where it stands', v: p => p.unread
        ? `<span class="faint">not read</span><span class="sub">${esc(srcWord(p.src[0]))}</span>`
        : `<span class="ink">${esc(K.stateWord[p.state])}</span><span class="sub">${evb(p.factId, esc(p.ev))}${p.partial.length ? ' · without ' + esc(p.partial.join(', ')) : ''}</span>`, s: rank },
      { h: 'At risk from', cls: 's', v: p => p.risks.length ? p.risks.map(r => `<button class="key" data-dr="risk:${r}">${r}</button>`).join(' ') : '<span class="faint">–</span>' },
      { h: 'Decision', cls: 's', v: p => p.dec ? `<button class="key" data-dr="decision:${p.dec}">${p.dec}</button>` : '<span class="faint">–</span>' }
    ], list, { attrs: p => `data-f-prom="${p.unread ? 'open' : p.state === 'ok' ? 'ok' : 'open ' + p.state}"${p.unread ? ' data-unread="1"' : ''}`, empty: { title: 'No promise in this view', text: 'Choose another focus or a longer horizon.' } });
    const tList = threats.length ? K.list(threats.map(t => ({ tone: t.level, to: t.to || '#/knowledge/risks',
      html: `${t.id && /^R-/.test(t.id) ? `<button class="key" data-dr="risk:${t.id}">${t.id}</button> ` : ''}<b>${esc(t.text)}</b><span class="ov-sub">${esc(t.sub)}${t.hits.length ? ' · puts at risk: ' + esc(t.hits.map(label).join(', ')) : ' · no promise behind it'} · ${evb(t.ev, 'evidence')}</span>` })))
      : K.stateBlock('empty', { title: 'Nothing puts a promise of this view at risk', text: 'No open risk in the register and no signal from the sources.' });
    const feed = evs.length ? K.feed(evs.map(e => ({ t: K.dm(e.d) + ' ' + e.t, tone: e.tone,
      html: (e.to ? `<a class="dim" href="${e.to}">${esc(e.text)}</a>` : esc(e.text)) + ' ' + evb(putFact('event.' + e.d + '.' + e.t, { say: e.text, def: EVWORD[e.kind] + ' Code wrote this line into the event log when it compared two reads.', src: DOMSRC[e.dom], q: `SELECT * FROM event WHERE at = '${e.d} ${e.t}'`, rows: 1, v: V1 }), 'evidence') })))
      : K.stateBlock('empty', { title: 'Nothing changed in this view', text: 'No event in the window.' });
    const P0 = kp('promises', `${all.length} promises in this view: ${scope}`, 'Everything the team gave its word on: sprint, PI objectives, release, service levels, working agreements, dates given to other teams.', all.length, srcs);
    return {
      title: 'Overview',
      lede: 'What the team promised, what puts a promise at risk, what waits for a decision, and what changed. One page for everybody; narrow it by focus.',
      acts: `<span class="pill line" data-tip="Who laid out this page. Fixed rules put the same facts in the same order; with the agent on it may choose and word them, and code checks every line against the facts.">laid out by rules</span><span class="pill ok">${all.length + threats.length + evs.length} facts, all checked</span><span class="faint fs-12 ml-8" >Focus</span>` + K.seg('focus', FOCUS, fo),
      kpis: [
        { l: 'Promises', v: all.length, s: `${plural(kinds, 'kind', 'kinds')}, from ${srcs.length} source${srcs.length === 1 ? '' : 's'}${unread.length ? ` · <b>${unread.length} not read</b>` : ''}`, ev: P0, nodelta: true },
        { l: 'Off track', v: n('bad'), s: when('bad'), tone: 'bad', ev: kp('off', `${n('bad')} promises are off track`, 'Promises whose forecast or measure says they will not be kept. A promise that was not read is not counted.', n('bad'), srcs), nodelta: true },
        { l: 'Need a look', v: n('watch'), s: when('watch'), tone: 'watch', ev: kp('watch', `${n('watch')} promises need a look`, 'Promises close to their limit.', n('watch'), srcs), nodelta: true },
        { l: 'On track', v: n('ok'), s: when('ok'), tone: 'ok', ev: kp('ok', `${n('ok')} promises are on track`, 'Promises whose forecast or measure says they hold.', n('ok'), srcs), nodelta: true },
        { l: 'At risk from', v: threats.length, s: threats.filter(t => /^R-/.test(t.id)).length + ' risks, ' + threats.filter(t => !/^R-/.test(t.id)).length + ' signals', tone: threats.length ? 'watch' : '', ev: kp('threats', `${threats.length} things can break a promise of this view`, 'Open risks of the register and signals from the sources that are no risk yet.', threats.length, Array.from(new Set(signals.filter(keep).map(s => s.src)))), nodelta: true },
        { l: 'To decide', v: decs.length, s: decs.length ? `next: ${decs[0].id}, due ${decs[0].due}` : 'none in this view', tone: decs.length ? 'bad' : '', ev: kp('decide', `${decs.length} decisions wait in this view`, 'Decisions in your own list that are not made yet, with their due date.', decs.length, []), nodelta: true },
        { l: 'Changed ' + changedWord, v: evAll.length, s: 'events in the log', ev: kp('changed', `${evAll.length} events ${changedWord}`, 'Lines of the event log in the chosen horizon and focus.', evAll.length, evSrc), nodelta: true }
      ],
      body: (closed ? K.note(`Sprint ${esc(ctx.sp.id)} is closed. The Overview always looks forward and shows the running sprint; the closed one is on <a class="ent" href="#/delivery/sprint">Delivery › Sprint</a>.`) : '') +
        `<div class="ov-h">Coming events<span>a click opens the briefing</span></div>` + ribbon(null) + K.grid(
        K.panel({ title: 'Promises', sub: esc(scope) + ' · worst first', w: 'c7 ov-a', src: srcs, mixed: barP, flush: true, isNew: true, body: pTable,
          right: K.filter('prom', [['open', 'Not on track', cnt.open], ['ok', 'On track', cnt.ok], ['all', 'All', cnt.all]]),
          help: 'Everything the team gave its word on, in one list: the sprint commitment, the PI objectives, the release, the service levels, the working agreements, the dates given to other teams. Each row is computed on its own page; here they stand side by side. A click on the numbers of a row opens their evidence.' }),
        K.panel({ title: 'At risk', sub: 'what can break a promise, and which one', w: 'c5 ov-b', src: Array.from(new Set(SIGNALS.filter(keep).map(s => s.src))), mixed: barR, body: tList, foot: 'risks are your own notes; signals come from the sources',
          help: 'The open risks of the register and the signals that are not a risk yet. Each names the promises it puts at risk. A threat with no promise behind it is marked, because it may be noise.' }),
        K.panel({ title: 'To decide', sub: 'what waits for a choice', w: 'c7 ov-c', right: K.pill(decs.length + ' open', decs.length ? 'bad' : ''), foot: 'kept under Knowledge › Decisions',
          body: decs.length ? `<div class="ov-decs">${decs.map(K.dec).join('')}</div>` : K.stateBlock('empty', { title: 'No decision waits in this view', text: 'Another focus or a longer horizon may hold one.' }) }),
        K.panel({ title: 'Changed', sub: cmp ? 'between the two days of the comparison' : changedWord, w: 'c5 ov-d', src: evSrc, mixed: barC, right: `<a class="btn sm" href="#/events">Event log ›</a>`, body: feed,
          foot: evAll.length > evs.length ? `the newest ${evs.length} of ${evAll.length}` : '' })
      )
    };
  }

  /* ── Briefings ────────────────────────────────────────────────────────── */
  function briefings() {
    const o = OCC.find(x => x.id === SM.ui.brief) || OCC[0], pts = o.points();
    const decs = D.decisions.filter(d => o.dec.indexOf(d.id) >= 0 && d.state === 'waiting'), risks = D.risks.filter(r => o.risks.indexOf(r.id) >= 0);
    const draft = o.name + ', ' + o.when + '\n' + pts.map(p => '- ' + strip(p.html)).join('\n');
    const settle = (decs.length ? `<div class="stack">${decs.map(K.dec).join('')}</div>` : '') +
      (risks.length ? K.sect('Risks to look at again') + K.list(risks.map(r => ({ tone: r.level, to: '#/knowledge/risks', html: `<button class="key" data-dr="risk:${r.id}">${r.id}</button> ${esc(r.title)}`, v: esc(r.roam) }))) : '');
    return {
      title: 'Briefings',
      lede: 'What the facts bring to each event of the team. Code picks the points by rules; the agent may word the draft, and every number in its text is checked against the facts.',
      body: ribbon(o.id) + K.grid(
        K.panel({ title: o.name + ' · ' + o.when, sub: o.settle, w: 'c7 x7', src: ['jira', 'git', 'ci', 'testrep', 'mon'], isNew: true, body: K.list(pts), foot: 'a click on a row opens the page that proves it',
          help: 'The points are picked by rules from the same facts the pages show. A point disappears when its fact does. Nothing here names a person.' }),
        K.panel({ title: 'To settle at this event', sub: 'decisions that wait, risks to look at again', w: 'c5 x5',
          body: settle || K.stateBlock('empty', { title: 'Nothing waits for this event', text: 'No open decision and no risk is tied to it.' }) }),
        K.panel({ title: 'Draft', sub: 'built by code from the points; you copy and send it yourself', w: 'c7 x7',
          right: `<button class="btn sm" data-toast="Copied. You send it yourself; the app writes to no other system.">Copy</button><button class="btn sm" data-cmd-say="${esc(o.ask)}"><span class="ai-spark">✦</span> Ask the agent</button>`,
          body: `<pre class="bf-draft">${esc(draft)}</pre>`, foot: 'the agent sees keys and numbers, never titles or names' }),
        K.panel({ title: 'Pages to have open', sub: 'the proof behind the points', w: 'c5 x5', body: K.list(o.pages.map(p => ({ html: esc(p[0]), to: p[1], v: '›' }))) }),
        K.panel({ title: 'How a briefing is made', w: 'c12', body: `<div class="bf-how">
          <div><b>1 · The calendar says what comes.</b> The events of the team are read from the sprint dates of Jira and from the team calendar. Each event has a rules file that lists its points, like the release checks under System › Files.</div>
          <div><b>2 · Code picks the points.</b> A point is a rule over the facts: blocked longer than the limit, main red, a forecast that moved. The same facts feed the pages, so a briefing cannot say something a page does not.</div>
          <div><b>3 · You take it to the event.</b> The draft is plain text to copy. The briefing of a past event stays in the event log, so the next retrospective can see what was known at the time.</div></div>` })
      )
    };
  }

  // Overview joins the home screens; the five homes by role stay as the earlier variant, to compare
  const home = SM.domains.find(d => d.id === 'home');
  const page = { id: 'overview', title: 'Home: Overview', h1: 'Overview', hz: ['today', 'sprint', 'pi'], was: 'moved', from: 'Today, Promises, Risks', find: 'home overview promises at risk decide changed focus', render: overview };
  page.domain = home; page.path = '#/home/overview'; home.pages.unshift(page); SM.routes[page.path] = page; SM.order.unshift(page);
  SM.single({ id: 'briefings', title: 'Briefings', state: ['brief'], hz: ['today'], was: 'new', from: 'Inbox (drafts for the Daily and the Sprint Review)', find: 'briefing daily review retrospective planning go no-go pi planning status event', render: briefings });
  SM.briefNext = () => OCC[0];
  /* what AI Command needs on a home without roles */
  const WORDS = { eng: 'engineering', ops: 'operations', all: 'everything' };
  SM.focusFind = w => FOCUS.find(x => x[0] === w || x[1].toLowerCase() === w || (WORDS[x[0]] || '').indexOf(w) === 0);
  SM.briefFind = w => { const c = w.replace(/[^a-z]/g, ''); return OCC.find(o => o.id === c || o.name.toLowerCase().replace(/[^a-z]/g, '').indexOf(c) === 0 || o.name.toLowerCase().split(' ').some(x => x === w)); };
  SM.todayLines = () => {
    const p = promises().filter(x => !x.unread), off = p.filter(x => x.state === 'bad'), d = D.decisions.find(x => x.state === 'waiting'), o = OCC[0];
    return [`${off.length} of ${p.length} promises are off track: ${off.slice(0, 3).map(x => x.short).join(', ')}${off.length > 3 ? ' and others' : ''}.`, `Decision ${d.id} is due ${d.due}: ${d.title}`, `Next event: ${o.name}, ${o.when}, ${plural(o.points().length, 'point', 'points')} from the facts.`];
  };
  SM.moreItems = () => SM.home === 'roles' ? [] : FOCUS.map(x => ({ g: 'Commands', kd: 'Focus', label: 'Focus on ' + x[1], hay: 'focus area ' + x[1], cmd: () => { SM.ui.focus = x[0]; SM.touch('focus'); SM.go('#/home/overview'); } }))
    .concat(OCC.map(o => ({ g: 'Commands', kd: 'Briefing', label: 'Briefing for ' + o.name, hay: 'brief briefing event ' + o.name, cmd: () => { SM.ui.brief = o.id; SM.touch('brief'); SM.go('#/briefings'); } })));
  SM.pins.overview = [['#/delivery/sprint', 'Sprint', 'bad'], ['#/product/objectives', 'Objectives', 'bad'], ['#/release/readiness', 'Release readiness', 'bad'], ['#/ops/services', 'Applications', 'watch'], ['#/eng/prs', 'Pull requests', 'watch']];
  const bank = [].concat.apply([], Object.keys(SM.askBank).map(k => SM.askBank[k]));
  SM.askBank.overview = ['Will we finish the sprint?', 'What do I have to decide this week?', 'Is release 2026.12 ready?', 'What should we talk about in the Daily?', 'What do we pay for more than once?'].map(q => bank.find(x => x.q === q)).filter(Boolean);
})();
