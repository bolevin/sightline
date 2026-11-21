/* Home: one page per lens. A home shows nothing of its own: every panel is a view of a fact that lives on a domain page,
   and says where. The lens only chooses which facts stand here and which pages are pinned in the rail. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, S = D.sprint, f = S.forecast;

  SM.pins = {
    sm: [['#/delivery/sprint', 'Sprint', 'bad'], ['#/delivery/flow', 'Flow', 'watch'], ['#/knowledge/risks', 'Risks', 'bad'], ['#/knowledge/agreements', 'Agreements and actions', 'watch']],
    tl: [['#/eng/prs', 'Pull requests', 'watch'], ['#/eng/builds', 'Builds', 'bad'], ['#/quality/tests', 'Test runs', 'watch'], ['#/eng/debt', 'Technical debt', '']],
    am: [['#/ops/services', 'Applications', 'watch'], ['#/ops/slo', 'Service levels', 'bad'], ['#/release/readiness', 'Readiness', 'bad'], ['#/ops/errors', 'Errors', 'watch']],
    lead: [['#/delivery/capacity', 'Capacity and work mix', 'bad'], ['#/knowledge/agreements', 'Agreements and actions', 'watch'], ['#/knowledge/risks', 'Risks', 'bad'], ['#/delivery/pi', 'PI', 'watch']],
    po: [['#/product/objectives', 'Objectives', 'bad'], ['#/product/features', 'Features', 'watch'], ['#/release/readiness', 'Readiness', 'bad'], ['#/product/readiness', 'Backlog readiness', 'watch']]
  };

  /* a KPI cell from a tuple: [label, value, unit, sub, tone, to, ev] */
  const cells = rows => rows.map(r => ({ l: r[0], v: r[1], u: r[2], s: r[3], tone: r[4], to: r[5], ev: r[6] }));
  const more = (href, label) => `<a class="btn sm" href="${href}">${esc(label)} ›</a>`;
  /* the briefing: lines by rules, each cites its fact */
  function briefing(groups, o) {
    const body = groups.map(g => `<div class="sect">${esc(g[0])} <a class="faint fw-400" href="${g[1]}" >open ›</a></div>` + K.list(g[2].map(l => ({ tone: l[0], html: l[1], cite: l[2], to: l[3], ev: l[4] })))).join('');
    return K.panel({ title: 'Briefing', sub: o.sub, w: o.w || 'c8 x8', src: o.src, right: `<span class="pill line">laid out by rules</span><span class="pill ok">${o.n} facts, all checked</span>`,
      body: body, foot: 'every line cites its fact · the agent may reword and reorder, code checks its numbers',
      help: 'The lines a person in this role would look for first, chosen by fixed rules from the facts of the domains. With the agent on, it words them; a line whose number is not a fact is dropped and the rule line comes back.' });
  }
  const waiting = (ids, w) => K.panel({ title: 'Waiting for a decision', w: w || 'c4 x4', right: K.pill(ids.length + ' open', 'bad'),
    body: `<div class="stack">${ids.map(id => K.dec(D.decisions.find(d => d.id === id))).join('')}</div>`, foot: 'home: Knowledge › Decisions' });
  const svcRows = () => K.list(D.services.map(s => {
    const slo = D.slos.find(x => x.svc === s.id);
    return { tone: s.state, html: `<b>${esc(s.name)}</b> <span class="faint">${s.rpm ? K.fmt(s.rpm) + ' rpm · p95 ' + s.p95 + ' ms · errors ' + s.err + ' %' : 'last run 18.11 02:00 to 03:47'}</span>`, v: slo.left < 0 ? '<span class="c-bad">budget spent</span>' : slo.left + ' % budget', to: '#/service/' + s.id };
  }));
  const hzWord = ctx => ctx.pick({ today: 'today', sprint: 'this sprint', pi: 'this PI', quarter: 'this quarter' });

  /* ── Scrum Master ─────────────────────────────────────────────────────── */
  function sm(ctx) {
    const kp = ctx.pick({
      today: [['Done since yesterday', 5, 'SP', 'KES-4142 and KES-4188', 'ok', '#/delivery/sprint'], ['Blocked', 2, 'items', '<b>5 SP</b> · 9 and 13 days', 'bad', '#/delivery/sprint'], ['In progress', 7, 'items', '<b>limit 6</b>', 'bad', '#/delivery/flow'], ['Came in today', 0, 'items', 'last: KES-4197 on Mon', '', '#/delivery/sprint'], ['Reviews waiting a day', 3, 'pull requests', '#412, #118, #57', 'watch', '#/eng/prs'], ['Decision due tomorrow', 'D-1', '', 'the sprint does not fit', 'bad', '#/knowledge/decisions']],
      sprint: [['Done', S.doneSp, 'of 65 SP', '<b>38 %</b> of the scope, 53 % of the time', 'watch', null, 'sprint.done_sp'], ['By the end, 85 % sure', '≥ ' + f.p85, 'SP', 'as likely as not ≥ ' + f.p50, '', null, 'forecast.p85'], ['Chance to finish it all', f.all, '%', '<b>' + f.over50 + ' SP over</b> an even chance', 'bad', null, 'forecast.chance_all'], ['Blocked', 2, 'items', '<b>5 SP</b> · 9 and 13 days', 'bad', '#/delivery/sprint'], ['In progress', 7, 'items', '<b>limit 6</b>, over it on 5 of 8 days', 'bad', '#/delivery/flow'], ['Scope since the start', '+5 / −3', 'SP', '4 items in, 1 out', 'watch', '#/delivery/sprint']],
      pi: [['Work done in the PI', 126, 'SP', '52 + 49 + 25', '', '#/delivery/pi'], ['Objectives on track', '3 of 5', '', '<b>1 off track</b>, 1 at risk', 'bad', '#/product/objectives'], ['Sprints that kept the promise', '2 of 2', '', '93 % and 84 % of the commitment', 'ok', '#/delivery/sprint'], ['Bugs and support', 31, '% of done SP', '<b>agreed: 20 %</b>', 'bad', '#/delivery/capacity'], ['Risks off track', 2, 'of 6', 'R-1 and R-2', 'bad', '#/knowledge/risks'], ['Retro actions open', 5, '', '<b>2 older</b> than 30 days', 'watch', '#/knowledge/agreements']],
      quarter: [['Sprints closed', 5, '', '4 kept their promise', 'ok', '#/delivery/sprint'], ['Completed per sprint', '43 to 52', 'SP', 'full sprints, median 49', '', '#/delivery/sprint'], ['85 % of items within', D.flow.p85, 'days', 'half within ' + D.flow.p50, '', '#/delivery/flow'], ['Predictability, last PI', 89, '%', '32 of 36 planned BV', 'ok', '#/delivery/pi'], ['Incidents', 4, '', '3 with the same cause', 'watch', '#/ops/incidents'], ['Forecast line held', '5 of 6', 'look-backs', 'the 85 % line', 'ok', '#/delivery/sprint']]
    });
    const mini = K.chart({ label: 'Burn-up of sprint 42', w: 520, h: 170, right: 96, x: [0, 15], y: [0, 72], yt: [0, 30, 60], xt: [[0, '09.11'], [8, 'today'], [15, '27.11']],
      areas: [{ pts: [[8, 25, 25], [15, f.p85, f.p50]], color: 's1', op: .16 }], hlines: [{ y: 63, color: 'faint', dash: true, label: 'committed 63', left: true }], vmarks: [{ x: 8, color: 'ink', dash: false }],
      lines: [{ pts: S.scope.map((v, i) => [i, v]).concat([[15, 65]]), color: 'dim', w: 1.5, label: 'scope 65' }, { pts: [[8, 25], [15, f.p50]], color: 's1', dash: true, w: 1.5, label: 'even ≥ ' + f.p50 }, { pts: [[8, 25], [15, f.p85]], color: 's1', dash: true, w: 1.5, label: '85 % ≥ ' + f.p85 }, { pts: S.burn.map((v, i) => [i, v]), color: 's1', w: 2.5, end: true }] });
    const stuck = D.issues.filter(i => i.st !== 'done' && (i.st === 'blocked' || i.dis >= D.flow.p50)).sort((a, b) => b.dis - a.dis);
    return {
      lede: 'Will the sprint hold, what is stuck, and what do we talk about today? Scope: ' + hzWord(ctx) + '.',
      kpis: cells(kp),
      body: K.grid(
        briefing([
          ['The promise', '#/delivery/sprint', [['bad', 'Chance to finish everything that is open: <b>9 %</b>. For an even chance 11 SP have to move out.', 'forecast.chance_all', null, 'forecast.chance_all'], ['watch', '<b>25 of 65 SP</b> are done on working day 8 of 15.', 'sprint.done_sp', null, 'sprint.done_sp'], ['watch', 'No full sprint of the team completed 63 SP or more; the most was 52.', 'plan.outside_view', '#/delivery/sprint']]],
          ['What is stuck', '#/delivery/flow', [['bad', K.key('KES-4131') + ' is blocked for <b>9 days</b> by ATL-882 of Team Atlas, which has no date.', 'item.KES-4131.blocked', '#/delivery/dependencies'], ['bad', K.key('KES-4160') + ' is in Implementing for <b>24 days</b>, in its third sprint.', 'item.KES-4160.days_in_status', '#/issue/KES-4160'], ['watch', '<b>7 items</b> are in progress; the team agreed on 6.', 'flow.wip', '#/knowledge/agreements']]],
          ['What came from outside', '#/ops/requests', [['watch', '<b>4 items</b> came in after the start: two bugs after release 2026.11, one follow-up of INC-2291, one certificate.', 'sprint.added_n', '#/delivery/sprint'], ['bad', 'The nightly export timed out again on 17.11: the third time in 30 nights.', 'ops.recurring', '#/incident/INC-2299']]]
        ], { sub: 'Wed 18.11, before the Daily', n: 8, src: ['jira', 'increp'] }),
        waiting(['D-1', 'D-2']),
        K.panel({ title: 'The sprint as a promise', sub: 'story points', w: 'c6 x4', src: ['jira'], ev: 'forecast.p85', right: more('#/delivery/sprint', 'Sprint'), body: mini }),
        K.panel({ title: 'Stuck and slow', sub: 'open items past the usual time in one status', w: 'c6 x4', src: ['jira'], flush: true, right: more('#/delivery/flow', 'Flow'),
          body: K.table([{ h: 'Issue', cls: 'ttl', v: i => K.key(i.key, { title: true }) }, { h: 'Status', cls: 's', v: i => K.status(i.st) }, { h: 'Days here', n: true, v: i => `<span class="${i.dis >= D.flow.p85 || i.st === 'blocked' ? 'c-bad' : 'c-watch'}">${i.dis}</span>` }, { h: 'Sprint no.', n: true, v: i => i.n }], stuck) }),
        K.panel({ title: 'Points for the Daily', sub: 'a draft from the facts above', w: 'c6 x4', src: ['jira'], right: more('#/inbox', 'Inbox'),
          body: K.list([{ tone: 'bad', html: 'Blocked: KES-4131 and KES-4079. Who can unblock each one, and by when?' }, { tone: 'bad', html: 'KES-4160 in Implementing for 24 days. What is in the way of the dry run on 20.11?' }, { tone: 'watch', html: 'Three pull requests wait a working day or more: #412, #118, #57.' }, { tone: 'watch', html: 'Seven items in progress against a limit of six. Which one do we finish first?' }, { tone: '', html: 'Decision D-1 is due tomorrow: what moves out of the sprint?' }]) + '<div class="rowf mt-9" ><button class="btn sm pri" data-toast="Copied. The app sends nothing: you paste it where you want it.">Copy</button><a class="btn sm" href="#/inbox">Edit in the Inbox</a></div>' }),
        K.panel({ title: 'What the team agreed and how it holds', w: 'c6 x4', src: ['jira', 'git'], right: more('#/knowledge/agreements', 'Agreements'),
          body: K.checks(D.agreements.map(a => ({ state: a.state, html: esc(a.text), sub: esc(K.agreed(a).sub), v: K.agreed(a).v }))) }),
        K.panel({ title: 'Risks to look at this week', w: 'c6 x4', right: more('#/knowledge/risks', 'Risks'), foot: 'your notes, kept on this computer',
          body: K.list(D.risks.filter(r => r.level !== 'ok').map(r => ({ tone: r.level, html: `<button class="key" data-dr="risk:${r.id}">${r.id}</button> ${esc(r.title)} <span class="faint">· ${esc(r.owner)}</span>`, v: r.review === 'not set' ? '<span class="c-watch">no review date</span>' : 'review ' + r.review }))) }),
        K.panel({ title: 'Improvement actions getting old', sub: 'open, oldest first', w: 'c6 x4', src: ['wiki'], right: more('#/knowledge/agreements', 'Actions'),
          body: K.list(D.actions.filter(a => a.state === 'open').sort((a, b) => b.age - a.age).map(a => ({ tone: a.age >= 50 ? 'bad' : a.age >= 30 ? 'watch' : '', html: `${esc(a.text)} <span class="faint">· ${esc(a.from)} · ${esc(a.owner)}</span>`, v: a.age + ' d' }))) })
      )
    };
  }

  /* ── Tech Lead ────────────────────────────────────────────────────────── */
  function tl(ctx) {
    const P = D.prStats, B = D.builds, N = D.launches[0];
    const kp = ctx.pick({
      today: [['Main red', 1, 'of 5 pipelines', '<b>pricing-engine</b> since 17.11 16:40', 'bad', '#/eng/builds'], ['Reviews waiting a day', 3, 'of 8 open', '#412, #118, #57', 'watch', '#/eng/prs'], ['Nightly regression', '94.4', '%', '<b>5 failures</b> to investigate', 'watch', '#/quality/tests', 'test.pass_rate'], ['New error groups', 2, '', '268 events in 24 h', 'watch', '#/ops/errors'], ['Contract tests', '316 of 318', '', 'both failures: Price feed v3', 'bad', '#/quality/tests'], ['Blocked by another team', 1, 'story', 'KES-4131, 9 days', 'bad', '#/delivery/dependencies']],
      sprint: [['First review after', P.firstReviewH, 'h', 'half of them · week 46: <b>14 h</b>', 'watch', null, 'pr.first_review'], ['Open to merged', P.p50, 'days', '85 % within ' + P.p85 + ' days', '', '#/eng/prs'], ['Main green', 91, '%', '212 of 233 runs', 'watch', null, 'build.green'], ['Nightly regression', '94.4', '%', 'the release check asks for 96 %', 'watch', null, 'test.pass_rate'], ['Open bugs', 7, '', '<b>2 older</b> than 30 days', 'watch', null, 'bugs.open'], ['Flaky tests', 6, '', 'in the last 14 nights', 'watch', '#/quality/flaky']],
      pi: [['Merged pull requests', 58, 'in 6 weeks', '12 needed more than one round', '', '#/eng/prs'], ['Enabler work', 13, '% of done SP', '<b>agreed: 20 %</b>', 'watch', '#/eng/debt'], ['Bugs written', 19, '', '16 resolved, 7 open', '', '#/quality/bugs'], ['Found in production', 5, 'of 19 bugs', '26 %', 'watch', '#/quality/escaped'], ['Changes that needed a fix', '1 of 6', 'deployments', 'release 2026.11', 'watch', null, 'dora.cfr'], ['Migration KES-4160', 3, 'sprints', 'dry run on INT 20.11', 'bad', '#/issue/KES-4160']],
      quarter: [['Lead time for changes', 11, 'days', 'first commit to production', '', '#/release/performance'], ['85 % of items within', D.flow.p85, 'days', '', '', '#/delivery/flow'], ['Deployments to production', 3, 'in 30 days', 'one train a month plus patches', '', '#/release/performance'], ['Time main was red', 31, 'hours', '19 h of it pricing-engine', 'watch', '#/eng/builds'], ['Runbooks out of date', 1, 'of 3', '2 applications have none', 'watch', '#/knowledge/documents'], ['Hotspots with bugs', 4, 'files', '', '', '#/eng/repos']]
    });
    return {
      lede: 'Where does code wait, what is red, and where does quality slip? Scope: ' + hzWord(ctx) + '.',
      kpis: cells(kp),
      body: K.grid(
        briefing([
          ['Code', '#/eng/prs', [['bad', '<b>pricing-engine</b>: main is red since 17.11 16:40. The contract test against the price feed v3 fails; pull request #118 waits behind it.', 'build.pricing-engine.red', '#/eng/builds'], ['watch', 'Three pull requests wait a working day or more for a review: <b>#412</b> (26 h), <b>#118</b> (30 h), <b>#57</b> (28 h).', 'pr.waiting_1d', '#/eng/prs'], ['watch', 'The wait for a first review was <b>14 h</b> in week 46 against 6 h usually.', 'pr.first_review', null, 'pr.first_review']]],
          ['Quality', '#/quality/tests', [['watch', 'Nightly regression: <b>389 of 412</b> passed. 14 failed, 5 of them nobody has looked at yet.', 'test.pass_rate', null, 'test.pass_rate'], ['watch', '<b>6 tests</b> switch between passed and failed without a code change.', 'test.flaky_n', '#/quality/flaky'], ['watch', K.key('KES-4190') + ': found in production after release 2026.11, in Implementing for 3 days.', 'item.KES-4190', '#/issue/KES-4190']]],
          ['Run', '#/ops/errors', [['watch', 'New error group in pricing-engine since 17.11 21:12: <b>268 events</b> in 24 hours, no issue yet.', 'errors.e1', '#/ops/errors'], ['ok', 'The connection pool errors of 12.11 stopped with hotfix 2026.11.1.', 'errors.e4', '#/incident/INC-2291']]]
        ], { sub: 'Wed 18.11', n: 8, src: ['git', 'ci', 'testrep', 'mon'] }),
        waiting(['D-2']),
        K.panel({ title: 'Pull requests that wait', sub: 'longest wait first', w: 'c6 x4', src: ['git'], flush: true, right: more('#/eng/prs', 'Pull requests'),
          body: K.table([{ h: 'Pull request', cls: 's', v: p => `<button class="key" data-dr="pr:${p.id}">${esc(p.repo)} #${p.id}</button>` }, { h: 'Issue', cls: 'ttl', v: p => K.key(p.issue, { title: true }) }, { h: 'Stands', cls: 's', v: p => K.pill({ first: 'waiting for a first review', review: 'in review', approved: 'approved, not merged' }[p.st], p.st === 'approved' ? 'ok' : '') }, { h: 'Waiting', n: true, v: p => `<span class="${p.wait >= 24 ? 'c-bad' : ''}">${p.wait} h</span>` }], D.prs.slice().sort((a, b) => b.wait - a.wait).slice(0, 5)) }),
        K.panel({ title: 'Pipelines on main', sub: 'last 30 days', w: 'c6 x4', src: ['ci'], ev: 'build.green', right: more('#/eng/builds', 'Builds'),
          body: K.hbars(B.pipes.map(p => ({ n: `${K.dot(p.state)} <button class="key" data-dr="build:${p.repo}">${esc(p.repo)}</button>`, v: p.green, max: p.runs, cls: p.state === 'bad' ? 'bad' : 'ok', label: K.pct(p.green, p.runs) + ' %<span class="faint"> · ' + p.min + ' min</span>' })), { nw: 210, vw: 96 }) + K.note('<b>21 red runs</b> in 30 days: 9 in unit tests, 6 in integration tests, 3 at the quality gate, 3 at the deployment to dev.', '') }),
        K.panel({ title: 'Last night\'s regression', sub: 'launch #' + N.n + ', ' + N.at, w: 'c6 x4', src: ['testrep'], ev: 'test.pass_rate', right: more('#/quality/tests', 'Test runs'),
          body: K.stackbar([['Passed', N.passed, 'bg-ok'], ['Failed', N.failed, 'bg-bad'], ['Skipped', N.skipped, 'bg-off']], { h: 12 }) + K.sect('Why the 14 failed') + K.stackbar([['Product bug', 4, 'bg-s2'], ['Automation bug', 3, 'bg-s3'], ['System issue', 2, 'bg-r4'], ['To investigate', 5, 'bg-mute']], { h: 12 }) }),
        K.panel({ title: 'Did the work really start?', sub: 'in Implementing for 3 days or more, no pull request names it', w: 'c6 x6', src: ['jira', 'git'], right: more('#/eng/prs', 'Pull requests'),
          body: K.list(D.issues.filter(i => i.st === 'impl' && i.dis >= 3 && !i.pr).map(i => ({ tone: i.dis >= D.flow.p85 ? 'bad' : 'watch', html: K.key(i.key, { title: true }), v: i.dis + ' d' }))) }),
        K.panel({ title: 'Flaky tests', sub: 'switched without a code change, last 14 nights', w: 'c12 x6', src: ['testrep'], right: more('#/quality/flaky', 'Flaky tests'),
          body: K.list(D.flaky.slice(0, 4).map((t, n) => ({ tone: t.last === 'failed' ? 'bad' : 'watch', html: `<button class="ent" data-dr="test:${n}">${esc(t.test)}</button>`, v: t.flips + ' of ' + t.of }))) })
      )
    };
  }

  /* ── Application Manager ──────────────────────────────────────────────── */
  function am(ctx) {
    const rk = st => D.readiness.filter(c => c.state === st).length, rkTone = rk('bad') ? 'bad' : rk('watch') ? 'watch' : 'ok';
    const kp = ctx.pick({
      today: [['Applications', '2 of 5', 'healthy', '<b>1 off track</b>, 2 need a look', 'bad', '#/ops/services'], ['Open alerts', 2, '', 'pricing-engine, carrier-export', 'watch', '#/ops/errors'], ['Open incidents', 1, '', 'INC-2299 since Tue 02:09', 'bad', '#/incident/INC-2299'], ['Errors in 24 h', 278, 'events', '<b>268</b> in one new group', 'watch', '#/ops/errors'], ['Last night\'s export', 'done 03:47', '', '3,870 orders', 'ok', '#/service/carrier-export'], ['Deployments today', 0, '', 'last: 13.11 14:20 to production', '', '#/release/environments']],
      sprint: [['Service levels on track', '3 of 5', '', '<b>1 missed</b>, 1 at 30 % budget', 'bad', '#/ops/slo'], ['Budget left, orders', 30, '%', '26 min went on 12.11', 'watch', null, 'slo.res.budget'], ['Incidents', 2, 'in this sprint', 'INC-2291 (P2), INC-2299 (P3)', 'bad', '#/ops/incidents'], ['Release 2026.12', rk('ok') + ' of ' + D.readiness.length, 'checks passed', (rk('bad') ? '<b>' + rk('bad') + ' failed</b>, ' : '') + rk('watch') + ' need a look', rkTone, '#/release/readiness'], ['Code freeze in', 7, 'working days', 'Fri 27.11', 'watch', '#/release/readiness'], ['Requests from outside', 13, 'in 7 days', '<b>2 unanswered</b>', 'watch', '#/ops/requests']],
      pi: [['Incidents', 4, 'in the PI', '<b>3 with the same cause</b>', 'bad', '#/ops/incidents'], ['Deployments to production', 4, '', '2 releases, 1 hotfix, 1 patch', '', '#/release/calendar'], ['Changes that needed a fix', '1 of 6', '', 'release 2026.11', 'watch', null, 'dora.cfr'], ['Time to restore', 26, 'min', 'one incident of P2 or higher', 'ok', '#/release/performance'], ['On-call', 6, 'call-outs', '2 at night · team total', '', '#/ops/incidents'], ['Bugs found in production', 5, 'of 19', '', 'watch', '#/quality/escaped']],
      quarter: [['Export nights missed', 3, 'of 30', 'target: at most 2', 'bad', '#/ops/slo'], ['Availability, orders', '99.93', '%', 'target 99.9', 'ok', '#/ops/slo'], ['Lead time for changes', 11, 'days', '', '', '#/release/performance'], ['Releases', 3, '', '2026.10, 2026.11, 2026.12 planned', '', '#/release/calendar'], ['Runbooks out of date', 1, '', 'Checkout API: 14 months', 'bad', '#/knowledge/documents'], ['Support share', 13, '% of done SP', 'agreed: 10 %', 'watch', '#/delivery/capacity']]
    });
    const bad = D.readiness.filter(c => c.state !== 'ok');
    return {
      lede: 'Are the applications healthy, what changed, and is the next release ready? Scope: ' + hzWord(ctx) + '.',
      kpis: cells(kp),
      body: K.grid(
        briefing([
          ['Run', '#/ops/services', [['bad', '<b>carrier-export</b> missed its end time on 17.11: the third night in 30. The fix is done and waits for release 2026.12.', 'slo.export.missed', '#/incident/INC-2299'], ['watch', '<b>pricing-engine</b>: error rate 1.8 % since 17.11 21:12, usually 0.4 %. The upstream answers with 504.', 'svc.pricing-engine.err', '#/service/pricing-engine'], ['watch', '<b>checkout-api</b> has 30 % of its error budget left for the next 24 days of the window.', 'slo.res.budget', null, 'slo.res.budget']]],
          ['Change', '#/release/readiness', [[rkTone, 'Release 2026.12: <b>' + rk('bad') + ' of ' + D.readiness.length + ' checks fail</b>' + (rk('watch') ? ', ' + rk('watch') + ' need a look' : '') + '. 12 of 31 issues are open, main of pricing-engine is red, pricing-engine on INT is still 2026.11.0.', 'release.R2026.12.checks', '#/release/readiness'], ['watch', 'Release 2026.11 was followed by INC-2291 after two days. Hotfix 2026.11.1 is in production since 13.11.', 'release.R2026.11.verdict', '#/release/R2026.11']]],
          ['From outside', '#/ops/requests', [['watch', '<b>2 requests</b> to the team are unanswered for more than two days.', 'requests.unanswered', '#/ops/requests'], ['watch', 'The certificate of the SMS gateway in the test system expires on 30.11; the renewal is in review.', 'item.KES-4197', '#/issue/KES-4197']]]
        ], { sub: 'Wed 18.11', n: 7, src: ['mon', 'increp', 'ci', 'jira'] }),
        waiting(['D-2', 'D-3']),
        K.panel({ title: 'Applications', sub: 'now', w: 'c6 x4', src: ['mon'], right: more('#/ops/services', 'Applications'), body: svcRows() }),
        K.panel({ title: 'Service levels', sub: 'error budget left in the window', w: 'c6 x4', src: ['mon'], ev: 'slo.res.budget', right: more('#/ops/slo', 'Service levels'),
          body: K.hbars(D.slos.map(s => ({ n: `<button class="ent" data-dr="slo:${s.id}">${esc(s.name)}</button>`, v: Math.max(0, s.left), max: 100, cls: s.state, label: s.left <= 0 ? '<span class="c-bad">spent</span>' : s.left + ' %' })), { max: 100, nw: 230, vw: 56 }) }),
        K.panel({ title: 'Release 2026.12: what is not ready', sub: 'Thu 03.12 · freeze Fri 27.11', w: 'c6 x4', src: ['jira', 'ci', 'testrep', 'mon'], right: more('#/release/readiness', 'Readiness'),
          body: K.checks(bad.map(c => ({ state: c.state, html: esc(c.text), sub: esc(c.sub), v: esc(c.v) }))) }),
        K.panel({ title: 'Incidents', sub: 'last 30 days', w: 'c6 x6', src: ['increp', 'jira'], right: more('#/ops/incidents', 'Incidents'),
          body: K.list(D.incidents.map(i => ({ tone: i.state === 'open' ? 'bad' : i.prio === 'P2' ? 'watch' : '', html: `${K.key(i.id)} <b>${esc(i.title)}</b> <span class="faint">· ${esc(i.svc)} · ${esc(i.at)}</span>`, v: i.dur }))) + K.note('Three of the four have one cause: the carrier endpoint is slow and the export does not retry. ' + K.key('KES-4142') + ' is done and ships with release 2026.12.', 'watch') }),
        K.panel({ title: 'What runs where', sub: 'version per environment', w: 'c12 x6', src: ['ci', 'catalog'], right: more('#/release/environments', 'Environments'),
          body: `<div class="envm" style="grid-template-columns:minmax(0,1.5fr) repeat(4,minmax(0,1fr))"><span></span>${D.envs.map(e => `<span class="h">${e}</span>`).join('')}${D.services.map(s => `<span class="rowh cut">${K.svc(s.id)}</span>` + D.envMatrix[s.id].map((v, n) => `<button class="cell ${s.id === 'pricing-engine' && n === 2 ? 'behind' : s.id === 'pricing-engine' && n === 0 ? 'red' : ''}" data-dr="deploy:${s.id}|${D.envs[n]}"><b>${esc(v.replace('2026.', '26.'))}</b></button>`).join('')).join('')}</div>` })
      )
    };
  }

  /* ── Team Lead ────────────────────────────────────────────────────────── */
  function lead(ctx) {
    const kp = ctx.pick({
      today: [['Available today', 6, 'of 7 delivering', 'team total, no names', '', '#/delivery/capacity'], ['In progress', 7, 'items', '<b>limit 6</b>', 'bad', '#/delivery/flow'], ['Decisions waiting', 3, '', '<b>D-1 due tomorrow</b>', 'bad', '#/knowledge/decisions'], ['Requests unanswered', 2, '', 'older than two days', 'watch', '#/ops/requests'], ['Reviews due', 2, 'risks', 'R-2 on 19.11, R-1 on 20.11', 'watch', '#/knowledge/risks'], ['On call this week', 'yes', '', '5 person-days of the sprint', '', '#/delivery/capacity']],
      sprint: [['Available', 86, 'of 105 person-days', '<b>14 d</b> absence, 5 d on call', 'watch', null, 'capacity.avail'], ['Capacity carries', '≈ 45', 'SP', '<b>committed: 63</b>', 'bad', '#/delivery/capacity'], ['Bugs and support', 8, '% of done SP', '2 of 25 SP so far in this sprint', 'ok', '#/delivery/capacity'], ['Agreements kept', '2 of 5', '', '<b>2 broken</b>', 'bad', '#/knowledge/agreements'], ['Actions open', 5, '', '<b>2 older</b> than 30 days', 'watch', '#/knowledge/agreements'], ['Risks without an owner', 1, '', 'R-6', 'watch', '#/knowledge/risks']],
      pi: [['Planned work', 69, '% of done SP', 'features and enablers', 'watch', null, 'mix.unplanned'], ['Bugs and support', 31, '%', '<b>agreed: at most 20 %</b>', 'bad', null, 'mix.unplanned'], ['Pace', '0.52', 'SP per available day', 'stable over two sprints', 'ok', '#/delivery/capacity'], ['Objectives on track', '3 of 5', '', '10 of 37 BV at stake', 'bad', '#/product/objectives'], ['On-call', 6, 'call-outs', '2 at night · team total', 'watch', '#/ops/incidents'], ['Depends on other teams', 3, 'links', '1 without a date', 'bad', '#/delivery/dependencies']],
      quarter: [['Predictability', '82, 76, 89', '%', 'last three PIs', 'ok', '#/delivery/pi'], ['Completed per sprint', '43 to 52', 'SP', 'five full sprints', '', '#/delivery/sprint'], ['Enabler work', 13, '%', 'agreed: 20 %', 'watch', '#/eng/debt'], ['Incidents', 4, '', '3 with one cause', 'watch', '#/ops/incidents'], ['Actions done', '2 of 7', '', 'since retro 39', 'watch', '#/knowledge/agreements'], ['Lead time for changes', 11, 'days', '', '', '#/release/performance']]
    });
    const cap = D.capacity;
    return {
      lede: 'Does the load fit the team, where does the time go, and do we do what we agreed? Team totals only. Scope: ' + hzWord(ctx) + '.',
      kpis: cells(kp),
      body: K.grid(
        briefing([
          ['Load', '#/delivery/capacity', [['bad', 'The sprint started with <b>63 SP</b>. With 86 available person-days and the pace of the last two sprints the team carries about <b>45 SP</b>.', 'capacity.outlook', '#/delivery/capacity'], ['watch', '<b>14 person-days</b> of absence and 5 of on-call duty in this sprint; 40 had 7.', 'capacity.avail', null, 'capacity.avail']]],
          ['Where the time goes', '#/delivery/capacity', [['bad', '<b>31 %</b> of the work done in the PI is bugs and support. The team agreed on at most 20 %.', 'mix.unplanned', null, 'mix.unplanned'], ['watch', 'Enablers and technical debt got <b>13 %</b>; the agreed share is 20 %.', 'mix.enabler', '#/eng/debt']]],
          ['What we agreed', '#/knowledge/agreements', [['bad', 'The WIP limit of six held on <b>3 of 8 days</b> of this sprint.', 'agreement.WA-4', '#/knowledge/agreements'], ['watch', 'Two retro actions are older than 30 days: the date for the price feed v3 and the operations manual.', 'actions.old', '#/knowledge/agreements'], ['watch', 'Risk <b>R-6</b> has no owner and no review date.', 'risks.R-6', '#/knowledge/risks']]]
        ], { sub: 'Wed 18.11', n: 7, src: ['jira', 'wiki'] }),
        waiting(['D-1', 'D-2', 'D-3']),
        K.panel({ title: 'Capacity and commitment', sub: 'person-days and story points per sprint', w: 'c6 x4', src: ['wiki', 'jira'], ev: 'capacity.avail', right: more('#/delivery/capacity', 'Capacity'),
          body: K.hbars(cap.slice(0, 3).map(c => ({ n: c.id, max: 105, parts: [[c.avail, 's1', 'available: ' + c.avail + ' person-days'], [c.duty, 's3', 'on call: ' + c.duty], [c.absent, 'bg-off', 'absent: ' + c.absent]], label: c.avail + ' d · ' + (c.sp != null ? c.sp + ' SP done' : '<span class="c-bad">63 SP committed</span>') })), { max: 105, nw: 48, vw: 150 }) + K.legend([['available', 'bg-s1'], ['on call', 'bg-s3'], ['absent', 'bg-off']]) }),
        K.panel({ title: 'Work mix against the agreement', sub: '126 SP done in the PI', w: 'c6 x4', src: ['jira'], ev: 'mix.unplanned', right: more('#/delivery/capacity', 'Work mix'),
          body: K.hbars(D.workmix.map(w => ({ n: w.name, v: w.pct, max: 70, cls: (w.id === 'bugs' || w.id === 'support') && w.pct > w.target ? 'bad' : 's1', label: w.pct + ' %<span class="faint"> · agreed ' + w.target + '</span>', tick: w.target, tickTip: 'agreed share: ' + w.target + ' %' })), { max: 70, nw: 180, vw: 110 }) }),
        K.panel({ title: 'Agreements', w: 'c6 x4', src: ['jira', 'git'], right: more('#/knowledge/agreements', 'Agreements'), body: K.checks(D.agreements.map(a => ({ state: a.state, html: esc(a.text), sub: esc(K.agreed(a).sub), v: K.agreed(a).v }))) }),
        K.panel({ title: 'Improvement actions', sub: 'open, oldest first', w: 'c6 x6', src: ['wiki'], right: more('#/knowledge/agreements', 'Actions'),
          body: K.list(D.actions.filter(a => a.state === 'open').sort((a, b) => b.age - a.age).map(a => ({ tone: a.age >= 50 ? 'bad' : a.age >= 30 ? 'watch' : '', html: `${esc(a.text)} <span class="faint">· ${esc(a.from)} · ${esc(a.owner)}</span>`, v: a.age + ' d' }))) }),
        K.panel({ title: 'What the app will not show here', w: 'c12 x6', body: K.list([{ tone: '', html: 'No name, no count and no ranking of a person. Capacity and on-call are team totals typed in by the team.' }, { tone: '', html: 'No comparison with other teams and no target on velocity or on a bug count.' }, { tone: '', html: 'No reading of private chats or mailboxes; team chat channels wait for an approval.' }]), foot: 'the rule is checked by tests: no fact carries a person' })
      )
    };
  }

  /* ── Product Owner ────────────────────────────────────────────────────── */
  function po(ctx) {
    const kp = ctx.pick({
      today: [['Decisions for you', 2, '', '<b>D-1 due tomorrow</b>', 'bad', '#/knowledge/decisions'], ['Stories done since yesterday', 2, '', 'KES-4142, KES-4188', 'ok', '#/delivery/sprint'], ['Blocked for your objective 3', 5, 'SP', 'KES-4131, 9 days', 'bad', '#/feature/KES-3318'], ['Group bookings', 184, 'yesterday', 'a week before: 171', 'ok', '#/product/signals'], ['Customer bugs open', 3, '', 'titles stay in Jira', '', '#/quality/bugs'], ['Waiting for acceptance', 1, 'story', 'KES-4127 in Approve', '', '#/issue/KES-4127']],
      sprint: [['Sprint goal work done', 25, 'of 65 SP', '85 % sure of ≥ 47 by the end', 'watch', null, 'sprint.done_sp'], ['Has to move out', 11, 'SP', 'for an even chance', 'bad', null, 'forecast.chance_all'], ['Price tiers open', 16, 'of 24 SP', '<b>freeze in 7 working days</b>', 'bad', '#/feature/KES-3318'], ['Came in after the start', 4, 'items', '5 SP, two of them bugs', 'watch', '#/delivery/sprint'], ['Release 2026.12', '19 of 31', 'issues done', 'Thu 03.12', 'watch', '#/release/R2026.12'], ['Ready for 43', '8 of 12', 'stories', '', 'watch', '#/product/readiness']],
      pi: [['Objectives on track', '3 of 5', 'committed', '<b>1 off track</b>, 1 at risk', 'bad', '#/product/objectives'], ['Planned value on track', 21, 'of 37 BV', '<b>10 at stake</b>', 'bad', '#/product/objectives'], ['Feature work done', 87, 'of 155 SP', '56 % at 69 % of the PI', 'watch', '#/delivery/pi'], ['Slips out of the PI', 9, 'SP', 'KES-3340, uncommitted', 'watch', '#/product/features'], ['Planned work', 69, '% of done SP', '31 % bugs and support', 'watch', null, 'mix.unplanned'], ['Predictability, last PI', 89, '%', '', 'ok', '#/delivery/pi']],
      quarter: [['Releases', 3, '', '2026.12 carries 4 features', '', '#/product/roadmap'], ['Predictability', '82, 76, 89', '%', 'last three PIs', 'ok', '#/delivery/pi'], ['Group bookings', '+8', '%', 'against the quarter before', 'ok', '#/product/signals'], ['Drop-off in the booking flow', 31, '%', 'was 29', 'watch', '#/product/signals'], ['Found in production', 5, 'bugs', 'of 19 in the PI', 'watch', '#/quality/escaped'], ['Next PI Planning', '14.12', '', 'PI 2027-03', '', '#/product/roadmap']]
    });
    const feats = D.features;
    return {
      lede: 'What will we deliver, what slips, and what do I have to decide? Scope: ' + hzWord(ctx) + '.',
      kpis: cells(kp),
      body: K.grid(
        briefing([
          ['The promise of the PI', '#/product/objectives', [['bad', 'Objective 3, the new price tiers for 13.12: <b>16 of 24 SP</b> are open, 5 of them blocked by another team. The code freeze is on 27.11.', 'feature.KES-3318.left', '#/feature/KES-3318'], ['watch', 'Objective 4, the export: 5 of 13 SP done; the rest is split over this sprint and 12.4.', 'feature.KES-3325.left', '#/feature/KES-3325'], ['ok', 'Objectives 1, 2 and 5 are on track: <b>21 of 37</b> planned BV.', 'pi.value_on_track', '#/product/objectives']]],
          ['This sprint', '#/delivery/sprint', [['bad', 'The sprint does not fit: chance to finish everything <b>9 %</b>. Your call which 11 SP move out.', 'forecast.chance_all', null, 'forecast.chance_all'], ['watch', 'Four items came in after the start; two are bugs found after release 2026.11.', 'sprint.added_n', '#/delivery/sprint']]],
          ['The release', '#/release/readiness', [['bad', 'Release 2026.12 on 03.12: <b>19 of 31</b> issues done. Without KES-3318 the price tiers miss the Winter sale.', 'release.R2026.12.scope', '#/release/R2026.12'], ['watch', 'Uncommitted objective 6 will not be reached in this PI: 13 of 18 SP are left.', 'feature.KES-3340.left', '#/feature/KES-3340']]]
        ], { sub: 'Wed 18.11', n: 7, src: ['jira'] }),
        waiting(['D-1', 'D-2']),
        K.panel({ title: 'Objectives of the PI', sub: 'planned business value', w: 'c6 x4', src: ['jira', 'wiki'], right: more('#/product/objectives', 'Objectives'),
          body: K.list(D.objectives.map(o => ({ tone: o.state, html: `<button class="ent" data-dr="objective:${o.n}">${o.n}</button> ${esc(o.text)}${o.committed ? '' : ' <span class="tag">uncommitted</span>'}`, v: 'BV ' + o.bv }))) }),
        K.panel({ title: 'Features against their dates', sub: 'story points done, left in this sprint, later', w: 'c6 x4', src: ['jira'], right: more('#/product/features', 'Features'),
          body: K.hbars(feats.map(x => ({ n: `${K.dot(x.state)} ${K.key(x.key)}`, plain: x.title, max: 34, parts: [[x.done, 'r3', x.done + ' SP done'], [x.left, 'r5', x.left + ' SP left in sprint 42'], [x.later, 'bg-mute', x.later + ' SP after this sprint']], label: K.dm(x.eta[0]) + ' to ' + K.dm(x.eta[1]) })), { max: 34, nw: 104, vw: 104 }) + K.legend([['done', 'bg-r3'], ['left in this sprint', 'bg-r5'], ['later', 'bg-mute']]) + '<div class="faint fs-11 mt-4" >Right column: the forecast range, 50 % to 85 % sure.</div>' }),
        K.panel({ title: 'What release 2026.12 carries', sub: 'Thu 03.12 · freeze Fri 27.11', w: 'c6 x4', src: ['jira'], right: more('#/release/R2026.12', 'Release'),
          body: K.list(K.release('R2026.12').feats.map(k => { const x = K.feature(k); return { tone: x.state, html: K.key(k, { title: true }), v: x.left ? x.left + ' SP open' : 'done' }; })) + K.note('Open for the release: <b>24 SP</b> in this sprint (7 + 16 + 3 + 5 minus what is done by the freeze). The forecast says 85 % sure of 22 more SP by 27.11.', 'watch') }),
        K.panel({ title: 'Business signals', sub: 'counters of the product', w: 'c6 x6', src: ['logs'], right: more('#/product/signals', 'Signals'),
          body: K.list(D.business.slice(0, 4).map(b => ({ tone: '', html: esc(b.name) + ` <span class="faint">· ${esc(b.unit)}</span>`, v: K.fmt(b.v) + (b.unit.charAt(0) === '%' ? ' %' : '') + ` <span class="faint fw-400" >was ${K.fmt(b.prev)}</span>` }))) }),
        K.panel({ title: 'Ready for the next sprint?', sub: '43 (IP), from Mon 30.11', w: 'c12 x6', src: ['jira'], right: more('#/product/readiness', 'Backlog readiness'),
          body: K.checks([{ state: 'ok', html: 'Stories with an estimate', v: '11 of 12' }, { state: 'ok', html: 'Stories with a feature link', v: '12 of 12' }, { state: 'watch', html: 'Acceptance criteria filled in', v: '9 of 12' }, { state: 'watch', html: 'No open dependency', v: '10 of 12' }, { state: 'watch', html: 'Ready by all five checks', sub: '21 SP ready against about 28 SP of capacity', v: '8 of 12' }]) })
      )
    };
  }

  SM.domain({
    id: 'home', title: 'Home', hidden: true, noTabs: true,
    pages: [
      { id: 'sm', title: 'Home: Scrum Master', h1: 'Scrum Master', hz: ['today', 'sprint', 'pi', 'quarter'], was: 'moved', from: 'Today', find: 'home lens briefing', render: sm },
      { id: 'tl', title: 'Home: Tech Lead', h1: 'Tech Lead', hz: ['today', 'sprint', 'pi', 'quarter'], was: 'new', from: '', find: 'home lens briefing', render: tl },
      { id: 'am', title: 'Home: Application Manager', h1: 'Application Manager', hz: ['today', 'sprint', 'pi', 'quarter'], was: 'new', from: '', find: 'home lens briefing', render: am },
      { id: 'lead', title: 'Home: Team Lead', h1: 'Team Lead', hz: ['today', 'sprint', 'pi', 'quarter'], was: 'new', from: '', find: 'home lens briefing', render: lead },
      { id: 'po', title: 'Home: Product Owner', h1: 'Product Owner', hz: ['today', 'sprint', 'pi', 'quarter'], was: 'new', from: '', find: 'home lens briefing', render: po }
    ]
  });

  /* prepared questions of AI Command, per role. Each answer cites facts and says how it was checked. */
  const meta = (tools, facts) => `<div class="meta"><span>${tools} tool calls</span><span>${facts.length} facts cited</span><span class="c-ok">every number is a fact</span></div><div class="rowf mt-6" >${facts.map(x => D.facts[x] ? `<button class="fact" data-ev="${x}">${x}</button>` : `<span class="fact">${x}</span>`).join('')}</div>`;
  SM.askBank = {
    sm: [
      { q: 'What should we talk about in the Daily?', a: `<p>Three things stand out today.</p><p>Two items are blocked: KES-4131 for 9 days by another team's ATL-882, which has no date, and KES-4079 for 13 days.</p><p>KES-4160 is in Implementing for 24 days and in its third sprint.</p><p>Seven items are in progress against the agreed limit of six, and three pull requests wait a working day or more.</p>` + meta(3, ['sprint.open_sp', 'flow.p85', 'pr.first_review']) },
      { q: 'Will we finish the sprint?', a: `<p>Probably not all of it. The chance to finish everything that is open is 9 %.</p><p>By the end the team is 85 % sure of at least 47 SP and as likely as not reaches 54. The scope is 65 SP.</p><p>If what has not started and what is blocked moves out (12 SP), the chance for the rest is 55 %.</p>` + meta(2, ['forecast.chance_all', 'forecast.p85', 'sprint.done_sp']) },
      { q: 'What would the data ask in the retrospective?', a: `<p>Four items came in after the start. What made them urgent, and what did they push out?</p><p>The wait for a first review doubled in week 46. What was different that week?</p><p>The limit of six items in progress held on 3 of 8 days. Is the limit right?</p>` + meta(2, ['pr.first_review', 'sprint.committed_sp']) }
    ],
    tl: [
      { q: 'Why is main of the pricing-engine red?', a: `<p>The contract test against the price feed v3 fails since 17.11 16:40. Both failing contract tests are in that launch (316 of 318 passed).</p><p>In production the same upstream answers with 504 since 17.11 21:12: a new error group with 268 events in 24 hours.</p><p>I can show both facts; whether they share a cause is for you to judge.</p>` + meta(4, ['build.green', 'test.pass_rate']) },
      { q: 'Where do pull requests lose time?', a: `<p>Of the time of the 58 pull requests merged in six weeks, 44 % went into waiting for a first review, 31 % into the review and 25 % into waiting for the merge after the approval.</p><p>Half of them got a first review within 6 hours. In week 46 it was 14 hours.</p>` + meta(2, ['pr.first_review']) }
    ],
    am: [
      { q: 'Is release 2026.12 ready?', a: `<p>Not yet. Of eight checks two pass, three need a look and three fail.</p><p>Failing: 12 of 31 issues are open, two items are blocked, and main of the pricing-engine is red.</p><p>The code freeze is in 7 working days, on Fri 27.11. The go or no-go is yours and the product owner's (decision D-2).</p>` + meta(4, ['build.green', 'test.pass_rate', 'sprint.open_sp']) },
      { q: 'What do we pay for more than once?', a: `<p>The nightly export. It missed its end time on 29.10, 05.11 and 17.11, each time because a carrier endpoint did not answer and the job did not retry.</p><p>The retry is built (KES-4142, done) and ships with release 2026.12 on 03.12.</p>` + meta(3, ['dora.cfr']) }
    ],
    lead: [
      { q: 'Does the sprint fit the capacity?', a: `<p>No. The team has 86 of 105 person-days available in this sprint. At the pace of the last two sprints, 0.52 SP per available day, that carries about 45 SP.</p><p>The sprint started with 63 SP.</p>` + meta(2, ['capacity.avail', 'sprint.committed_sp']) },
      { q: 'Where did the time of the PI go?', a: `<p>Of 126 SP done so far, 56 % were business features, 13 % enablers, 18 % bugs and incidents and 13 % support.</p><p>Bugs and support together are 31 %. The team agreed on at most 20 %.</p>` + meta(1, ['mix.unplanned']) }
    ],
    po: [
      { q: 'Will the price tiers make the Winter sale?', a: `<p>It is off track. 16 of the 24 SP of KES-3318 are open and 5 of them are blocked by ATL-882 of another team, which has no date.</p><p>The code freeze for release 2026.12 is on Fri 27.11, the release on 03.12, the Winter sale on 13.12.</p><p>The decision (D-2) is whether to release without them and patch, or to move the release.</p>` + meta(3, ['sprint.open_sp', 'forecast.p85']) },
      { q: 'What do I have to decide this week?', a: `<p>Two things. D-1, due Thu 19.11: which 11 SP move out of sprint 42 for an even chance to finish the rest.</p><p>D-2, due Tue 24.11: release 2026.12 without the school price tiers, or move it to 08.12.</p>` + meta(2, ['forecast.chance_all']) }
    ]
  };
})();
