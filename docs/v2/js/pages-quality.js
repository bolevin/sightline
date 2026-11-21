/* Domain: Quality. Bugs, test runs, flaky tests and where defects are found. Sources: Jira, Test reports, Build server. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, B = D.bugs;
  const nightly = D.launches.find(l => l.id === 'regression-nightly');
  const target = { Blocker: 2, Critical: 5, Major: 15, Minor: 30 };
  const nights = ['05.11', '06.11', '07.11', '08.11', '09.11', '10.11', '11.11', '12.11', '13.11', '14.11', '15.11', '16.11', '17.11', '18.11'];
  const dtName = { pb: 'Product bug', ab: 'Automation bug', si: 'System issue', ti: 'To investigate' };
  const dtCls = { pb: 'bg-s2', ab: 'bg-s3', si: 'bg-r4', ti: 'bg-mute' };
  const mono = t => `<span class="mono">${esc(t)}</span>`;

  /* the 14 failures of the last nightly, grouped by error text: 4 pb + 3 ab + 2 si + 5 ti; 6 web, 2 api, 4 pricing, 2 export */
  const groups = [
    { err: 'AssertionError: total expected 1240.00 but was 1380.00', svc: 'checkout-web', link: 'KES-4190' },
    { err: 'TimeoutError: locator [data-test=items-left] not visible after 10000 ms', svc: 'checkout-web' },
    { err: 'CarrierTimeoutException: carrier endpoint did not answer within 30 s', svc: 'carrier-export' },
    { err: 'PriceFeedClient: 504 from upstream /v3/price-tiers', svc: 'pricing-engine' },
    { err: 'IllegalStateException: hold already released', svc: 'checkout-api' }
  ];
  const fails = [
    { test: 'CancelE2E › Partial cancellation › total after removing single lines', g: 0, dt: 'pb', by: 'analyzer' },
    { test: 'CancelE2E › Partial cancellation › total in the confirmation', g: 0, dt: 'pb', by: 'analyzer' },
    { test: 'OrderOverviewE2E › Price after the quantity changes', g: 0, dt: 'pb', by: 'human' },
    { test: 'BulkOrderE2E › Release part of a hold › shows what is left', g: 1, dt: 'ab', by: 'analyzer' },
    { test: 'BulkOrderE2E › Quantity picker › what is left after a release', g: 1, dt: 'ab', by: 'human' },
    { test: 'StockHoldE2E › Overview › filter by warehouse', g: 1, dt: 'ab', by: 'human' },
    { test: 'ExportIT › Carrier answers after 29 seconds', g: 2, dt: 'si', by: 'analyzer' },
    { test: 'ExportIT › Retry after a timeout', g: 2, dt: 'si', by: 'analyzer' },
    { test: 'PricingIT › School tier › cache expires', g: 3, dt: 'ti', by: '' },
    { test: 'PricingIT › School tier › one free per ten', g: 3, dt: 'ti', by: '' },
    { test: 'PricingIT › Small business tier › VAT number check', g: 3, dt: 'ti', by: '' },
    { test: 'PriceCompareIT › old and new tiers', g: 3, dt: 'ti', by: '' },
    { test: 'OrderIT › Release after a partial cancellation', g: 4, dt: 'pb', by: 'human' },
    { test: 'OrderIT › Release twice in a row', g: 4, dt: 'ti', by: '' }
  ];
  const failsOther = {
    'api-contract': [
      { test: 'PriceFeedContract › GET /v3/price-tiers › field customerGroup', svc: 'pricing-engine', dt: 'pb', by: 'human' },
      { test: 'PriceFeedContract › GET /v3/price-tiers › tier SCHOOL', svc: 'pricing-engine', dt: 'pb', by: 'human' }],
    'a11y-checkout': [
      { test: 'Quantity picker › reachable by keyboard', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '2.1.1', issue: 'KES-4150' },
      { test: 'Checkout flow › Focus order from step 2 to step 3', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '2.4.3', issue: 'KES-4151' },
      { test: 'Order overview › Screen reader text of the price line', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '4.1.2', issue: 'KES-4155' },
      { test: 'Order overview › Table headers are read out', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '1.3.1', issue: 'KES-4155' },
      { test: 'Cancel dialog › Focus stays in the dialog', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '2.4.3', issue: null },
      { test: 'Calendar › contrast of blocked days', svc: 'checkout-web', dt: 'pb', by: 'human', wcag: '1.4.3', issue: null }]
  };
  /* the nightly per application: totals 412 = 389 passed + 14 failed + 9 skipped */
  const comp = [
    { svc: 'checkout-web', total: 156, passed: 147, failed: 6, skipped: 3 },
    { svc: 'checkout-api', total: 118, passed: 114, failed: 2, skipped: 2 },
    { svc: 'pricing-engine', total: 64, passed: 57, failed: 4, skipped: 3 },
    { svc: 'carrier-export', total: 46, passed: 43, failed: 2, skipped: 1 },
    { svc: 'order-mail', total: 28, passed: 28, failed: 0, skipped: 0 }
  ];
  /* last 14 nights of each flaky test (index as in D.flaky), oldest first; switches must equal D.flaky[n].flips */
  const runs = ['fppppfppfpppff', 'fpppfppppfpppp', 'pppfppppfpppff', 'fpppppfpppppff', 'fppppppfpppppp', 'fpppppppppfppp'];
  const flakyMore = [
    { errs: ['TimeoutError: locator [data-test=items-left] not visible after 10000 ms', 'AssertionError: expected 12 free items but saw 10'], prs: [229, 233] },
    { errs: ['AssertionError: refund expected 186.00 but was 0.00', 'StaleElementReferenceError: summary row was drawn again'], prs: [224] },
    { errs: ['CarrierTimeoutException: carrier endpoint did not answer within 30 s', 'AssertionError: expected 1 retry but saw 2'], prs: [91, 97] },
    { errs: ['PriceFeedClient: 504 from upstream /v3/price-tiers', 'AssertionError: cache entry still present after expiry'], prs: [112, 118] },
    { errs: ['ConnectException: sms-gateway-mock:8443 connection refused', 'AssertionError: expected 1 fallback mail but saw 0'], prs: [54] },
    { errs: ['OptimisticLockException: hold version 41 changed', 'AssertionError: expected 40 orders but saw 39'], prs: [401, 409] }
  ];
  const switches = s => s.split('').reduce((n, c, i, a) => n + (i && c !== a[i - 1] ? 1 : 0), 0);
  runs.forEach((r, n) => { if (switches(r) !== D.flaky[n].flips || (r[13] === 'f' ? 'failed' : 'passed') !== D.flaky[n].last) console.error('pages-quality: flaky run ' + n + ' does not match D.flaky'); });
  const strip = s => `<span class="q-strip">${s.split('').map((c, i) => `<i class="${c === 'f' ? 'f' : ''}" data-tip="${nights[i]}: ${c === 'f' ? 'failed' : 'passed'}"></i>`).join('')}</span>`;
  const resBar = l => `<span class="q-bar" data-tip="${l.passed} passed · ${l.failed} failed · ${l.skipped} skipped">${[[l.passed, 'bg-ok'], [l.failed, 'bg-bad'], [l.skipped, 'bg-mute']].filter(p => p[1] && p[0]).map(p => `<i class="${p[1]}" style="flex:${p[0]}"></i>`).join('')}</span>`;
  const prTxt = n => D.prs.some(p => p.id === n) ? `<button class="key" data-dr="pr:${n}">#${n}</button>` : mono('#' + n);

  /* ── Bugs ─────────────────────────────────────────────────────────────── */
  function bugsPage(ctx) {
    const win = ctx.pick({ sprint: 'sprint 42 so far', pi: 'PI 26.4 so far', quarter: 'Q4 2026 so far' });
    const wr = ctx.pick({ sprint: [5, 4], pi: [B.written, B.resolved], quarter: [B.written, B.resolved] });
    const bs = B.bySprint, opens = [B.openBefore, 4, 6, B.open];
    const flowChart = K.chart({
      label: 'Bugs written and resolved per sprint', w: 560, h: 220, right: 60, x: [-1.4, 2.6], y: [0, 10], yt: [0, 2, 4, 6, 8, 10],
      xt: [[-1, 'before'], [0, '40'], [1, '41'], [2, '42 so far']],
      bars: bs.map((s, i) => ({ x: i - .17, w: .32, y1: s[1], color: 's2', tip: `${s[0]}: ${s[1]} bugs written` }))
        .concat(bs.map((s, i) => ({ x: i + .17, w: .32, y1: s[2], color: 's1', tip: `${s[0]}: ${s[2]} bugs resolved` }))),
      lines: [{ pts: opens.map((v, i) => [i - 1, v]), color: 'dim', w: 1.8, dash: true, end: true, label: 'open ' + B.open, tip: (x, y) => (x < 0 ? 'Before the PI' : 'End of ' + bs[x][0]) + `: ${y} open` }]
    }) + K.legend([['written', 'bg-s2'], ['resolved', 'bg-s1'], ['open at the end of the sprint', 'bg-dim', 1]]);

    const ttf = [
      { p: 'Blocker', n: 1, p50: 1, p85: 1, inT: 1 }, { p: 'Critical', n: 3, p50: 2, p85: 4, inT: 3 },
      { p: 'Major', n: 7, p50: 6, p85: 14, inT: 6 }, { p: 'Minor', n: 5, p50: 11, p85: 38, inT: 3 }
    ];
    const ttfBars = K.hbars(ttf.map(t => ({ n: `${t.p} <span class="faint">· ${t.n}</span>`, max: 40, tick: target[t.p], tickTip: `Target for ${t.p}: ${target[t.p]} days`,
      parts: [[t.p50, 'r3', `Half of them within ${t.p50} d`], [t.p85 - t.p50, 'r5', `85 % within ${t.p85} d`]], label: `${t.inT} of ${t.n}<span class="faint"> in target</span>` })), { max: 40, nw: 92, vw: 104 }) +
      K.legend([['half fixed within', 'bg-r3'], ['85 % fixed within', 'bg-r5'], ['target of the priority', 'bg-dim', 1]]) +
      K.note('Targets: Blocker 2, Critical 5, Major 15, Minor 30 days. These are the app\'s defaults until the team sets its own under System, Settings.', '');

    const step = pts => pts.reduce((a, p, i) => i ? a.concat([[p[0], pts[i - 1][1]], p]) : [p], []);
    const major = [[0, 100], [2, 86], [4, 71], [6, 50], [9, 36], [12, 21], [14, 14], [30, 7], [60, 7]];
    const minor = [[0, 100], [3, 89], [7, 67], [11, 50], [19, 39], [30, 22], [38, 15], [60, 11]];
    const surv = K.chart({
      label: 'Share of bugs still open after N days', w: 560, h: 220, right: 30, x: [0, 60], y: [0, 100], yt: [0, 25, 50, 75, 100], yu: ' %',
      xt: [[0, '0'], [7, '7'], [15, '15'], [30, '30'], [45, '45'], [60, '60 days']],
      hlines: [{ y: 50, color: 'faint', dash: true, label: 'half fixed', left: true }],
      vmarks: [{ x: 15, color: 'faint', label: 'Major target', tip: 'Target for Major: 15 days' }, { x: 30, color: 'faint', label: 'Minor target', tip: 'Target for Minor: 30 days' }],
      lines: [
        { pts: step(major), color: 's1', w: 2, label: 'Major', at: [1, 32], tip: (x, y) => `Major: ${y} % still open after ${x} days` },
        { pts: step(minor), color: 's3', w: 2, label: 'Minor', at: [13, 58], tip: (x, y) => `Minor: ${y} % still open after ${x} days` }]
    });

    const ageB = [['up to 7 days', 0, 7, 'r5'], ['8 to 30 days', 8, 30, 'r4'], ['31 to 90 days', 31, 90, 'r2'], ['over 90 days', 91, 9999, 'r1']];
    const debt = K.hbars(ageB.map(b => { const ks = B.openList.filter(i => i.age >= b[1] && i.age <= b[2]); return { n: b[0], v: ks.length, max: 4, cls: b[3], label: String(ks.length) }; }), { max: 4, nw: 100, vw: 30 }) +
      K.sect('Which ones') + K.list(ageB.filter(b => B.openList.some(i => i.age >= b[1] && i.age <= b[2])).map(b => ({ tone: b[1] > 30 ? 'bad' : '', html: K.keys(B.openList.filter(i => i.age >= b[1] && i.age <= b[2]).map(i => i.key)), v: b[0] }))) +
      K.note(`<b>${B.old30} of ${B.open}</b> open bugs are older than 30 days: ${K.keys(['KES-4079', 'KES-3988'])}.`, 'watch');

    const prioRank = { Blocker: 0, Critical: 1, Major: 2, Minor: 3 };
    const openTable = K.table([
      { h: 'Bug', cls: 'ttl', v: i => K.key(i.key, { title: true }), s: i => i.key },
      { h: 'Priority', cls: 's', v: i => esc(i.prio), s: i => prioRank[i.prio] },
      { h: 'Age', n: true, v: i => `<span class="${i.age > target[i.prio] ? 'c-bad' : ''}">${i.age} d</span>`, s: i => i.age, tip: 'Red: older than the target of its priority' },
      { h: 'Target', n: true, v: i => `<span class="faint">${target[i.prio]} d</span>`, s: i => target[i.prio] },
      { h: 'Application', cls: 's', v: i => K.svc(i.svc), s: i => i.svc },
      { h: 'Status', cls: 's', v: i => K.status(i.st), s: i => D.statusOrder.indexOf(i.st) }
    ], B.openList.slice().sort((a, b) => b.age - a.age), { attrs: i => `data-go="#/issue/${i.key}"` });

    const hot = [['checkout-api', 'StockHoldService.java', 4], ['checkout-web', 'cancel-summary.component.ts', 3], ['carrier-export', 'CarrierExportWriter.java', 3], ['pricing-engine', 'PriceTierMapper.java', 2], ['checkout-api', 'DataSourceConfig.java', 1]];
    const gather = `<div class="cols2"><div>${K.sect('Bugs written in the PI', '19')}${K.hbars(B.bySvc.map(s => ({ n: K.svc(s[0]), v: s[1], cls: 's2', label: String(s[1]) })), { max: 8, nw: 160, vw: 30 })}
      <div class="faint fs-11 mt-6" >order-mail: no bug in the PI.</div></div>
      <div>${K.sect('Hotspots', 'files changed by the most bug fixes')}${K.list(hot.map(h => ({ tone: '', html: `${mono(h[1])}<span class="cite">${esc(h[0])}</span>`, v: h[2] + (h[2] > 1 ? ' fixes' : ' fix') })))}</div></div>` +
      K.note('checkout-api holds 7 of 19 bugs and the file changed most by fixes. StockHoldService.java is also part of the migration ' + K.key('KES-4160') + '.', '');

    /* what came back from the first version: the findings of the tab, running totals, the usual range, how bugs ended, PI by PI */
    const late = B.openList.filter(i => i.age > target[i.prio]), topS = B.bySvc[0];
    const says = [];
    if (B.open > B.openBefore) says.push({ tone: 'watch', ev: 'bugs.open', html: `<b>${B.open} bugs are open</b>, ${B.open - B.openBefore} more than when the PI started` });
    if (B.written > B.resolved) says.push({ tone: 'watch', html: `<b>${B.written} written, ${B.resolved} resolved</b> in this PI: bugs come in faster than they go out` });
    if (late.length) says.push({ tone: 'bad', html: `<b>${late.length} open bugs are past the target of their priority:</b> ${K.keys(late.map(i => i.key))}` });
    if (B.old30) says.push({ tone: 'watch', html: `<b>${B.old30} open bugs are older than 30 days</b>` });
    if (topS[1] / B.written >= 1 / 3) says.push({ tone: 'watch', html: `<b>${esc(topS[0])} holds ${topS[1]} of ${B.written} bugs</b> of this PI. An application that changes a lot has more bugs, and that alone is no finding` });
    const saysPanel = K.panel({ title: 'What the numbers say', sub: 'the findings of this page, by rules', w: 'c12 x4', src: ['jira'], isNew: true, body: K.list(says), foot: 'laid out by code, not by the agent',
      help: 'The facts of this page that call for a look: more bugs open than before, bugs past the target of their priority, more written than resolved, one application holding much of them. A line disappears when its fact does.' });

    const flowMode = SM.ui.qflow === 'bars' ? 'bars' : 'run';
    let wr0 = B.openBefore, re0 = 0;
    const cum = [[-1, re0, wr0]].concat(bs.map((s, i) => { wr0 += s[1]; re0 += s[2]; return [i, re0, wr0]; }));
    const runChart = K.chart({
      label: 'Running totals of bugs written and resolved in the PI', w: 560, h: 220, right: 60, x: [-1.2, 2.4], y: [0, 25], yt: [0, 5, 10, 15, 20, 25],
      xt: [[-1, 'before'], [0, '40'], [1, '41'], [2, '42 so far']],
      areas: [{ pts: cum, color: 's2', op: .16, tip: 'The band is the open backlog' }],
      lines: [{ pts: cum.map(c => [c[0], c[2]]), color: 's2', w: 2.2, end: true, label: 'written ' + cum[3][2], tip: (x, y) => (x < 0 ? 'Open before the PI' : 'Up to ' + bs[x][0]) + `: ${y} written` },
        { pts: cum.map(c => [c[0], c[1]]), color: 's1', w: 2.2, end: true, label: 'resolved ' + cum[3][1], tip: (x, y) => (x < 0 ? 'Before the PI' : 'Up to ' + bs[x][0]) + `: ${y} resolved` }]
    }) + K.legend([['written, starting from the bugs open before the PI', 'bg-s2', 1], ['resolved', 'bg-s1', 1]]);

    const H = D.bugHist, before = H.slice(0, 6).map(r => r[1]), lo = Math.min.apply(null, before), hi = Math.max.apply(null, before);
    const sprintChart = K.chart({
      label: 'Bugs written per sprint against the usual range of the six full sprints before the last one', w: 560, h: 220, right: 14, x: [-.6, H.length - .4], y: [0, 10], yt: [0, 2, 4, 6, 8, 10],
      xt: H.map((r, i) => [i, r[0]]),
      areas: [{ pts: [[-.6, lo, hi], [H.length - .4, lo, hi]], color: 'mute-fill', op: .55, tip: `Usual range: ${lo} to ${hi} bugs written in a sprint` }],
      bars: H.map((r, i) => ({ x: i - .17, w: .32, y1: r[1], color: 's2', op: i === H.length - 1 ? .55 : 1, tip: `${r[0]}: ${r[1]} written` })).concat(H.map((r, i) => ({ x: i + .17, w: .32, y1: r[2], color: 's1', op: i === H.length - 1 ? .55 : 1, tip: `${r[0]}: ${r[2]} resolved` })))
    }) + K.legend([['written', 'bg-s2'], ['resolved', 'bg-s1'], [`usual range, ${lo} to ${hi}`, 'bg-mute']]);
    const lastFull = H[H.length - 2];
    const sprintPanel = K.panel({ title: 'Sprint by sprint', sub: 'written and resolved, with the usual range', w: 'c7 x4', src: ['jira'], isNew: true,
      body: sprintChart + K.note(`Sprint ${esc(lastFull[0])} wrote <b>${lastFull[1]} bugs</b>, ${lastFull[1] > hi ? 'above the usual range: worth a look' : 'inside the usual range: noise, not news'}. The running sprint is drawn lighter.`, ''),
      help: 'Bugs written and resolved in each sprint. The grey band is the usual range: the fewest and the most bugs written in the six full sprints before the last one. A sprint inside it is noise, a sprint above it is worth a look.' });

    const feats = K.table([
      { h: 'Feature', cls: 'ttl', v: r => r.f ? K.key(r.f, { title: true }) : '<span class="faint">no feature</span>' },
      { h: 'Bugs', n: true, v: r => `<b class="ink">${r.bugs}</b>`, s: r => r.bugs }, { h: 'Came back', n: true, v: r => r.back ? `<span class="c-watch">${r.back}</span>` : '<span class="faint">0</span>', s: r => r.back },
      { h: 'Fixed', n: true, v: r => r.fixed, s: r => r.fixed }, { h: 'Duplicate', n: true, v: r => r.dup, s: r => r.dup }, { h: 'Not reproducible', n: true, v: r => r.nr, s: r => r.nr },
      { h: "Won't do", n: true, v: r => r.wont, s: r => r.wont }, { h: 'Open', n: true, v: r => r.open ? `<span class="c-watch">${r.open}</span>` : '0', s: r => r.open }
    ], D.bugFeatures);
    const featPanel = K.panel({ title: 'Features and how bugs were closed', sub: 'bugs written in the last two PIs', w: 'c12 x6', src: ['jira'], flush: true, isNew: true, body: feats,
      help: 'The features with the most bugs in the last two PIs, how many came back after a fix, how many are open and how the others were closed. A large share closed as duplicate, not reproducible or won\'t do says the intake needs care, not the code.' });

    const piTable = K.table([
      { h: 'PI', cls: 's', v: r => `<b class="ink">${esc(r.pi)}</b>${r.running ? '<span class="sub">running</span>' : ''}` },
      { h: 'Tasks', n: true, v: r => r.tasks }, { h: 'Bugs', n: true, v: r => r.created }, { h: 'Total', n: true, v: r => `<b class="ink">${r.tasks + r.created}</b>` },
      { h: 'Blocker', n: true, v: r => r.blocker }, { h: 'Critical', n: true, v: r => r.critical }, { h: 'Major', n: true, v: r => r.major }, { h: 'Minor', n: true, v: r => r.minor },
      { h: 'Major or worse', n: true, v: r => `<b class="ink">${r.blocker + r.critical + r.major}</b>` }
    ], D.piStats);
    const piPanel = K.panel({ title: 'PI by PI', sub: 'operations and bug priorities, the columns of the page PI extended statistics', w: 'c12', src: ['jira'], flush: true, isNew: true, body: piTable, foot: 'the running PI is not over: its counts still grow',
      help: 'Operational tasks and bugs written in each PI, and the bugs by priority. The running PI is not over, so compare its shares with earlier PIs and not its counts.' });

    return {
      lede: `Bugs of the team: what is written, what is fixed and how fast, what stays open. Window: ${win}.`,
      kpis: [
        { l: 'Open bugs', spark: [B.openBefore, 4, 6, B.open], v: B.open, s: `<b>${B.old30} older than 30 days</b>`, tone: 'watch', ev: 'bugs.open' },
        { l: 'Written / resolved', spark: D.bugHist.map(r => r[1]), v: wr[0] + ' / ' + wr[1], s: win },
        { l: 'Time to fix', v: B.p50, u: 'days', s: `half of them · 85 % within ${B.p85} d` },
        { l: 'Fixed in target', v: B.inTarget + ' of ' + B.judged, s: 'target of their priority', tone: 'watch' },
        { l: 'Came back after the fix', v: B.reopened + ' of ' + B.judged, s: 'reopened once' },
        { l: 'Closed as no bug', v: B.noBug + ' of ' + B.written, s: 'rejected or a duplicate' },
        { l: 'Bugs per 100 SP done', v: '15.1', s: '19 bugs on 126 SP' }
      ],
      body: K.grid(
        saysPanel,
        K.panel({ title: 'Written and resolved', sub: flowMode === 'run' ? 'running totals: the band is the open backlog' : 'per sprint, and the open count over time', w: 'c7 x4', src: ['jira'], ev: 'bugs.open',
          right: K.seg('qflow', [['run', 'Running totals'], ['bars', 'Per sprint']], flowMode), body: flowMode === 'run' ? runChart : flowChart,
          help: 'Bugs of type Bug in the board filter. Running totals add them up sprint by sprint from the bugs open before the PI, so the band between the lines is the open backlog: 4 before the PI, 7 now. Where it widens, bugs come in faster than they go out.' }),
        K.panel({ title: 'Time to fix against the target', sub: 'resolved in the PI, days', w: 'c5 x4', src: ['jira'], body: ttfBars }),
        K.panel({ title: 'Still open after N days', sub: 'Major and Minor bugs of the PI, including the ones still open', w: 'c7 x4', src: ['jira'], body: surv,
          help: 'Read it like a survival curve: of all bugs of one priority, the share that was not yet fixed after so many days. Bugs still open count until today. A line that stays up at the right means old bugs that nobody closes.' }),
        K.panel({ title: 'Bug debt', sub: 'open bugs by age', w: 'c5 x4', src: ['jira'], ev: 'bugs.open', body: debt }),
        sprintPanel,
        K.panel({ title: 'Bugs reported by customers', sub: 'project KESBUG, linked to the team', w: 'c5 x4', src: ['jira'], state: 'held', right: K.pill('3 open', 'watch'),
          empty: { title: `${B.customer} open bugs reported by customers`, text: 'Their titles can hold names and customer numbers, so the app shows the count only. Titles and detail stay in Jira.' } }),
        K.panel({ title: 'Open bugs', sub: 'click a row for the issue', w: 'c12 x8', src: ['jira'], flush: true, right: K.pill(B.open + ' open', 'watch'), body: openTable }),
        K.panel({ title: 'Where bugs gather', sub: 'by application, next to the files that fixes touch most', w: 'c12 x6', src: ['jira', 'git'], body: gather }),
        featPanel,
        piPanel
      ) + K.note('No bug is counted per person, and no target stands on a bug count. A rising count can mean better testing as much as worse code: read it next to where the bugs were found.', '')
    };
  }

  /* ── Test runs ────────────────────────────────────────────────────────── */
  const launchInfo = { 'regression-nightly': 'nightly regression, end to end', 'api-contract': 'contract tests of the APIs', 'smoke-int': 'smoke test after each deployment to INT', 'a11y-checkout': 'accessibility checks of the checkout' };
  function testsPage() {
    const N = nightly, d = N.defects, classified = d.pb + d.ab + d.si;
    const ltab = K.table([
      { h: 'Launch', cls: 'ttl', v: l => `${mono(l.id)}<span class="sub">${esc(launchInfo[l.id])}</span>`, s: l => l.id },
      { h: 'No.', n: true, v: l => '#' + l.n, s: l => l.n },
      { h: 'When', cls: 's', v: l => esc(l.at), s: l => l.at },
      { h: 'Env', cls: 's', v: l => K.tag(l.env.toUpperCase()), s: l => l.env },
      { h: 'Passed · failed · skipped', cls: 's', v: l => `${resBar(l)} <span class="dim">${l.passed} · <span class="${l.failed ? 'c-bad' : ''}">${l.failed}</span> · ${l.skipped}</span>` },
      { h: 'Duration', n: true, v: l => esc(l.dur) }
    ], D.launches, { attrs: l => `data-dr="launch:${l.id}"` });

    const trend = K.chart({
      label: 'Passing rate of the nightly regression, last 14 nights', w: 520, h: 240, right: 14, left: 40, x: [0, 13], y: [90, 98], yt: [90, 92, 94, 96, 98], yu: ' %',
      xt: [[0, '05.11'], [3, '08.11'], [5, '10.11'], [8, '13.11'], [11, '16.11'], [13, '18.11']],
      hlines: [{ y: 96, color: 'watch', dash: true }],
      vmarks: [{ x: 5, color: 'faint', label: 'release 2026.11', tip: '10.11: release 2026.11 in production' }, { x: 12, color: 'faint', label: 'environment 17.11', left: true, tip: '17.11: TEST environment ran out of database connections during the run' }],
      lines: [{ pts: N.trend.map((v, i) => [i, v]), color: 's1', w: 2.2, end: true, tip: (x, y) => `${nights[x]}: ${y} % passed` }]
    }) + K.legend([['passed, share of all items', 'bg-s1', 1], ['the release check asks for 96 %', 'bg-watch', 1]]);

    const grpRows = groups.map((g, n) => ({ g, n, cnt: fails.filter(f => f.g === n).length, dts: [...new Set(fails.filter(f => f.g === n).map(f => dtName[f.dt]))] })).sort((a, b) => b.cnt - a.cnt);
    const why = K.stackbar([['Product bug', d.pb, dtCls.pb], ['Automation bug', d.ab, dtCls.ab], ['System issue', d.si, dtCls.si], ['To investigate', d.ti, dtCls.ti]], { unit: 'failures', h: 14 }) +
      K.sect('The same failure only once', `${N.failed} failures, ${groups.length} error texts`) +
      K.list(grpRows.map(r => ({ tone: r.dts.indexOf('To investigate') >= 0 ? 'watch' : '', html: `${mono(r.g.err)}<span class="cite">${esc(r.g.svc)} · ${esc(r.dts.join(', '))}${r.g.link ? ' · ' : ''}</span>${r.g.link ? K.key(r.g.link) : ''}`, v: r.cnt }))) +
      K.note(`<b>${classified} of ${N.failed}</b> failures are classified, ${d.ti} wait for someone to look. The four of pricing-engine share one error with the new error group of monitoring.`, 'watch');

    const levels = K.hbars([
      { n: 'Unit', v: 2140, cls: 'r1', label: '2,140' }, { n: 'Contract', v: 318, cls: 'r2', label: '318' }, { n: 'End to end', v: 412, cls: 'r3', label: '412' },
      { n: 'Accessibility', v: 64, cls: 'r4', label: '64' }, { n: 'Smoke', v: 46, cls: 'r5', label: '46' }], { max: 2140, nw: 92, vw: 48 }) +
      K.kv([['Unit', 'Build server, five pipelines: 640 + 920 + 310 + 190 + 80'], ['Others', 'Test reports, the last launch of each']]);

    const health = K.hbars(comp.map(c => { const r = Math.round(c.passed / c.total * 1000) / 10; return { n: K.svc(c.svc), v: r, max: 100, cls: r >= 96 ? 'ok' : r >= 93 ? 'watch' : 'bad', tick: 96, tickTip: 'Release check: 96 %', label: `${r} %<span class="faint"> · ${c.passed}/${c.total}</span>` }; }), { max: 100, nw: 160, vw: 104 }) +
      K.note('Two of five applications are above the line. The sum is the launch: <b>389 of 412</b>.', '');

    const a11y = failsOther['a11y-checkout'];
    const a11yBody = K.list(a11y.map(f => ({ tone: 'bad', html: `${esc(f.test)}<span class="cite">WCAG ${esc(f.wcag)}${f.issue ? ' · ' : ''}</span>${f.issue ? K.key(f.issue) : ''}`, v: '' }))) +
      K.note(`All ${a11y.length} are known gaps of feature ${K.key('KES-3331')} and classified as product bugs. They close with its open stories; ${K.key('KES-4155')} moved to sprint 12.4.`, '');

    return {
      lede: 'The test launches of the test reports and the unit tests of the build server: what ran, what failed and why.',
      acts: K.extLink('Open Test reports', 'Test reports'),
      kpis: [
        { l: 'Nightly regression', v: '94.4', u: '%', s: `<b>${N.passed} of ${N.total}</b> · check asks 96 %`, tone: 'watch', ev: 'test.pass_rate' },
        { l: 'Failed last night', v: N.failed, s: `${N.skipped} skipped` },
        { l: 'Still to investigate', v: d.ti, s: 'no defect type yet', tone: 'watch' },
        { l: 'Failures classified', v: classified + ' of ' + N.failed, s: '5 by the analyzer, 4 by hand' },
        { l: 'Contract tests', v: '316 of 318', s: 'pricing-engine against v3', tone: 'watch' },
        { l: 'Smoke on INT', v: '46 of 46', s: '17.11 14:35', tone: 'ok' }
      ],
      body: K.grid(
        K.panel({ title: 'Launches', sub: 'the last run of each, click a row for its failures', w: 'c7 x5', src: ['testrep'], flush: true, body: ltab }),
        K.panel({ title: 'Passing rate, last 14 nights', sub: 'regression-nightly', w: 'c5 x4', src: ['testrep'], ev: 'test.pass_rate', body: trend,
          help: 'Passed items of each nightly launch against all its items; skipped items count as not passed. The dashed line is what the release check asks for.' }),
        K.panel({ title: 'Tests by level', sub: 'number of tests', w: 'c4 x3', src: ['ci', 'testrep'], body: levels }),
        K.panel({ title: 'Why tests failed last night', sub: 'defect types of the test reports', w: 'c8 x5', src: ['testrep'], body: why,
          help: 'The defect type is set on each failed item in the test reports, by its analyzer or by hand. Failures with the same error text are shown once with their count.' }),
        K.panel({ title: 'Component health', sub: 'nightly passing rate per application', w: 'c6 x4', src: ['testrep'], body: health }),
        K.panel({ title: 'Accessibility', sub: 'a11y-checkout #38, 6 known failures', w: 'c6 x3', src: ['testrep', 'jira'], right: K.pill('58 of 64', 'watch'), body: a11yBody })
      )
    };
  }

  /* ── Flaky and failing tests ──────────────────────────────────────────── */
  function flakyPage() {
    const ftab = K.table([
      { h: 'Test', cls: 'ttl', v: t => esc(t.test), s: t => t.test },
      { h: 'Application', cls: 's', v: t => K.svc(t.svc), s: t => t.svc },
      { h: 'Switches', n: true, v: t => `<b class="ink">${t.flips}</b><span class="faint"> of ${t.of}</span>`, s: t => t.flips, tip: 'How often the result changed between passed and failed in the last 14 nights, without a change to the code under test' },
      { h: 'Last night', cls: 's', v: t => K.pill(t.last, t.last === 'failed' ? 'bad' : ''), s: t => t.last },
      { h: 'Last 14 nights', cls: 's', v: (t) => strip(runs[D.flaky.indexOf(t)]) }
    ], D.flaky, { attrs: t => `data-dr="test:${D.flaky.indexOf(t)}"` });

    const most = [
      { test: 'CancelE2E › Partial cancellation › total after removing single lines', svc: 'checkout-web', n: 7, last: 'pb', sub: 'every night since 12.11' },
      { test: D.flaky[0].test, svc: 'checkout-web', n: 5, last: 'ab', fl: 0 },
      { test: D.flaky[2].test, svc: 'carrier-export', n: 4, last: 'si', fl: 2 },
      { test: D.flaky[3].test, svc: 'pricing-engine', n: 4, last: 'ti', fl: 3 },
      { test: 'CancelE2E › Partial cancellation › total in the confirmation', svc: 'checkout-web', n: 4, last: 'pb', sub: 'since 15.11' },
      { test: 'ExportIT › Retry after a timeout', svc: 'carrier-export', n: 3, last: 'si' },
      { test: 'OrderIT › Release after a partial cancellation', svc: 'checkout-api', n: 3, last: 'pb' },
      { test: D.flaky[1].test, svc: 'checkout-web', n: 3, last: null, fl: 1 }
    ];
    const mtab = K.table([
      { h: 'Test', cls: 'ttl', v: m => esc(m.test) + (m.fl != null ? ' ' + K.tag('flaky') : '') + (m.sub ? `<span class="sub">${esc(m.sub)}</span>` : ''), s: m => m.test },
      { h: 'Application', cls: 's', v: m => K.svc(m.svc), s: m => m.svc },
      { h: 'Failed', n: true, v: m => `<b class="ink">${m.n}</b><span class="faint"> of 14</span>`, s: m => m.n },
      { h: 'Last night', cls: 's', v: m => m.last ? `<span class="c-bad">failed</span> <span class="faint">· ${esc(dtName[m.last])}</span>` : '<span class="faint">passed</span>' }
    ], most, { attrs: m => m.fl != null ? `data-dr="test:${m.fl}"` : 'data-dr="launch:regression-nightly"' });

    const slow = [
      ['OrderIT › 40 orders at once on one hold', 'checkout-api', 94, 61],
      ['ExportIT › Full export of 4000 orders', 'carrier-export', 88, 85],
      ['BulkOrderE2E › A school order from start to end', 'checkout-web', 71, 48],
      ['CancelE2E › Partial cancellation with a refund', 'checkout-web', 52, 50],
      ['PricingIT › all tiers of a price list', 'pricing-engine', 47, 22],
      ['NotifyIT › SMS to 60 customers', 'order-mail', 31, 30]
    ];
    const slowBody = K.hbars(slow.map(s => ({ n: esc(s[0]), plain: s[0] + ' (' + s[1] + ')', max: 100, parts: [[s[3], 'r3', `30 days ago: ${s[3]} s`], [s[2] - s[3], 's3', `grew by ${s[2] - s[3]} s`]], label: `${s[2]} s<span class="faint"> · ${s[2] - s[3] > 5 ? '+' + (s[2] - s[3]) : '±' + (s[2] - s[3])}</span>` })), { max: 100, nw: 280, vw: 76 }) +
      K.legend([['30 days ago', 'bg-r3'], ['grown since', 'bg-s3']]) +
      K.note('Three tests grew by more than 20 s in 30 days. Together the six take <b>6 min 23 s</b> of the 1 h 52 min nightly.', '');

    const sumFlips = D.flaky.reduce((s, t) => s + t.flips, 0), failedNow = D.flaky.filter(t => t.last === 'failed').length;
    return {
      lede: 'Tests whose result changes without a change to the code, the tests that fail most and the tests that grow slow.',
      kpis: [
        { l: 'Flaky tests', v: D.flaky.length, s: '3 or more switches', tone: 'watch' },
        { l: 'Switches in 14 nights', v: sumFlips, s: 'of the six together' },
        { l: 'Failed last night', v: failedNow + ' of ' + D.flaky.length, s: `${failedNow} of the 14 failures` },
        { l: 'Most failed test', v: '7 of 14', s: 'CancelE2E, since 12.11', tone: 'bad' },
        { l: 'Slowest test', v: 94, u: 's', s: '<b>+33 s</b> in 30 days' },
        { l: 'Team agreement', v: 'none', s: 'on flaky tests', to: '#/knowledge/agreements' }
      ],
      body: K.grid(
        K.panel({ title: 'Flaky tests', sub: 'click a row for its results, errors and pull requests', w: 'c8 x8', src: ['testrep', 'git'], flush: true, body: ftab,
          help: 'A test is flaky here when its result switched between passed and failed at least three times in the last 14 nightly launches while the repository of its application had no merged change between the two runs.' }),
        K.panel({ title: 'What the team agreed about flaky tests', w: 'c4 x4', src: ['wiki'], state: 'empty',
          empty: { title: 'No agreement yet', text: 'The working agreements of the team say nothing about flaky tests: whether they are quarantined, who looks at them, how long one may stay. The page shows the agreement here once it exists.', act: 'Open the agreements', to: '#/knowledge/agreements' } }),
        K.panel({ title: 'Most failed tests', sub: 'last 14 nights of regression-nightly', w: 'c7 x6', src: ['testrep'], flush: true, body: mtab }),
        K.panel({ title: 'Slowest tests and how they grew', sub: 'seconds now against 30 days ago', w: 'c5 x6', src: ['testrep'], body: slowBody })
      )
    };
  }

  /* ── Found where ──────────────────────────────────────────────────────── */
  function escapedPage() {
    const F = B.found, total = F.reduce((s, f) => s + f[1], 0), prod = F[0][1];
    const fcls = { Production: 'bg-s2', 'Integration test': 'bg-r4', 'Team test': 'bg-r2' };
    const where = K.stackbar(F.map(f => [f[0], f[1], fcls[f[0]]]).concat([['Not stated', 0, 'bg-off']]), { unit: 'bugs', h: 14 }) +
      K.sect('By sprint', 'when the bug was written') + K.hbars([
        { n: '40', parts: [[3, 'r2', 'Team test: 3'], [2, 'r4', 'Integration test: 2'], [1, 's2', 'Production: 1']], label: '6' },
        { n: '41', parts: [[4, 'r2', 'Team test: 4'], [3, 'r4', 'Integration test: 3'], [1, 's2', 'Production: 1']], label: '8' },
        { n: '42 so far', parts: [[1, 'r2', 'Team test: 1'], [1, 'r4', 'Integration test: 1'], [3, 's2', 'Production: 3']], label: '5' }], { max: 8, nw: 84, vw: 30 }) +
      K.note('Sprint 42 has 3 of its 5 bugs from production, all after release 2026.11.', 'watch');

    const funnel = K.hbars([
      { n: 'Reached team test', v: 19, cls: 'r2', label: '19' }, { n: 'Got past team test', v: 11, cls: 'r4', label: '11 <span class="faint">· 8 found</span>' },
      { n: 'Reached production', v: 5, cls: 's2', label: '5 <span class="faint">· 6 found on INT</span>' }], { max: 19, nw: 140, vw: 110 }) +
      K.note('Team test catches <b>8 of 19</b>, integration test <b>6 of the 11</b> that pass it. <b>5</b> reach the customer.', '');

    const rel = [
      { n: 'After release 2026.11', v: 3, keys: ['KES-4188', 'KES-4190', 'KES-4176'] },
      { n: 'After release 2026.10', v: 1, keys: ['KES-4171'] },
      { n: 'Before any release of the PI', v: 1, keys: [], txt: 'KES-4029' }
    ];
    const byRel = K.hbars(rel.map(r => ({ n: r.n, v: r.v, cls: 's2', label: String(r.v) })), { max: 4, nw: 170, vw: 30 }) +
      K.sect('Which ones') + K.list(rel.map(r => ({ tone: '', html: r.keys.length ? K.keys(r.keys) : `<span class="mono" data-tip="Resolved on 05.10; this demo holds no detail of it">${r.txt}</span>`, v: r.n.replace('After release ', 'after ').replace('Before any release of the PI', 'before a release') }))) +
      K.note(`Release 2026.11 is followed by 3 production bugs in 8 days and by ${K.key('INC-2291')}.`, 'bad');

    const prodBugs = [
      { key: 'KES-4188', found: '12.11', after: 'R2026.11', inc: 'INC-2291', st: 'done' },
      { key: 'KES-4190', found: '13.11', after: 'R2026.11', inc: null, st: 'impl' },
      { key: 'KES-4176', found: '09.11', after: 'R2026.11', inc: null, st: 'todo' },
      { key: 'KES-4171', found: '06.11', after: 'R2026.10', inc: null, st: 'todo' },
      { key: 'KES-4029', found: '02.10', after: null, inc: null, st: 'done', title: 'resolved 05.10, no detail in this demo' }
    ];
    const ptab = K.table([
      { h: 'Bug', cls: 'ttl', v: b => K.issue(b.key) ? K.key(b.key, { title: true }) : `<span class="mono">${b.key}</span> <span class="faint">${esc(b.title)}</span>` },
      { h: 'After', cls: 's', v: b => b.after ? K.key(b.after) : '<span class="faint">no release</span>' },
      { h: 'Incident', cls: 's', v: b => b.inc ? K.key(b.inc) + ` <span class="faint">${esc(K.incident(b.inc).prio)} · ${esc(K.incident(b.inc).dur)}</span>` : '<span class="faint">none</span>' },
      { h: 'Status', cls: 's', v: b => K.status(b.st) }
    ], prodBugs, { attrs: b => K.issue(b.key) ? `data-go="#/issue/${b.key}"` : '' });

    const field = K.kv([['Field', `${mono('Found in')} <span class="faint">(select list in Jira)</span>`], ['Values', 'Team test, Integration test, Production'], ['Set', '<b class="ink">19 of 19</b> bugs of the PI in this data set'], ['When empty', 'counted as "not stated", in grey, never spread over the three values']]) +
      K.note('This page needs a Jira field that names where a bug was found. In this data set all 19 bugs carry it. A bug without a value shows as a grey part "not stated" in the bar, and the share from production is then given as "at least".', 'watch');

    return {
      lede: 'Where the bugs of the PI were found: by the team, on the integration test or by the customer in production.',
      kpis: [
        { l: 'Bugs written in the PI', v: total, s: 'all carry the field' },
        { l: 'Found in production', v: prod, s: `<b>${Math.round(prod / total * 100)} %</b> of the bugs`, tone: 'bad' },
        { l: 'Found on integration test', v: F[1][1], s: Math.round(F[1][1] / total * 100) + ' %' },
        { l: 'Found in team test', v: F[2][1], s: Math.round(F[2][1] / total * 100) + ' %' },
        { l: 'After release 2026.11', v: 3, s: 'in production within 8 days', tone: 'watch' },
        { l: 'With an incident', v: '1 of 5', s: 'KES-4188, INC-2291' }
      ],
      body: K.grid(
        K.panel({ title: 'Where the bugs were found', sub: '19 bugs of the PI', w: 'c6 x4', src: ['jira'], body: where }),
        K.panel({ title: 'Found in, step by step', sub: 'from team test to production', w: 'c6 x4', src: ['jira'], body: funnel,
          help: 'Every bug passes the steps in order. Of the bugs that reach a step, the bar shows how many got there; the rest were found one step before.' }),
        K.panel({ title: 'Production bugs by release', sub: 'the release last deployed before the bug was found', w: 'c6 x4', src: ['jira', 'ci'], body: byRel }),
        K.panel({ title: 'Bugs found in production', sub: 'with their incident if there was one', w: 'c6 x7', src: ['jira', 'increp'], flush: true, body: ptab }),
        K.panel({ title: 'The field behind this page', w: 'c12 x5', src: ['jira'], body: field })
      )
    };
  }

  /* ── drawers ──────────────────────────────────────────────────────────── */
  SM.drawer('launch', function (id) {
    const l = D.launches.find(x => x.id === id); if (!l) return null;
    const d = l.defects;
    const rows = id === 'regression-nightly' ? fails.map(f => ({ test: f.test, svc: groups[f.g].svc, dt: f.dt, by: f.by })) : (failsOther[id] || []);
    const ftab = rows.length ? K.table([
      { h: 'Test', cls: 'ttl', v: f => esc(f.test) },
      { h: 'Application', cls: 's', v: f => esc(f.svc) },
      { h: 'Defect type', cls: 's', v: f => `<i class="dot ${dtCls[f.dt]}"></i> ${esc(dtName[f.dt])}` },
      { h: 'Classified by', cls: 's', v: f => f.by ? esc(f.by === 'analyzer' ? 'the analyzer' : 'by hand') : '<span class="c-watch">not yet</span>' }
    ], rows) : K.stateBlock('empty', { title: 'Nothing failed', text: `All ${l.total} tests of launch #${l.n} passed.` });
    return {
      kind: 'Test launch · Test reports', title: `${l.id} #${l.n}`,
      body: K.kv([['Ran', esc(l.at) + ' on ' + esc(l.env.toUpperCase())], ['Duration', esc(l.dur)], ['Tests', `${l.total}: <b class="ink">${l.passed}</b> passed, <span class="${l.failed ? 'c-bad' : ''}">${l.failed}</span> failed, ${l.skipped} skipped`], ['Passing rate', (Math.round(l.passed / l.total * 1000) / 10) + ' %']]) +
        K.sect('Defect types', l.failed + ' failures') + K.stackbar([['Product bug', d.pb, dtCls.pb], ['Automation bug', d.ab, dtCls.ab], ['System issue', d.si, dtCls.si], ['To investigate', d.ti, dtCls.ti]], { unit: 'failures' }) +
        K.sect('Failed tests') + ftab +
        `<div class="rowf mt-14" >${K.extLink('Open the launch in the test reports', 'Test reports')}</div>`
    };
  });

  SM.drawer('test', function (n) {
    n = +n; const t = D.flaky[n], r = runs[n], m = flakyMore[n]; if (!t) return null;
    const fl = r.split('').filter(c => c === 'f').length;
    return {
      kind: 'Flaky test · ' + esc(t.svc), title: t.test,
      body: K.kv([['Application', K.svc(t.svc)], ['Switches', `<b class="ink">${t.flips}</b> of ${t.of} nights`], ['Failed', `${fl} of 14 nights`], ['Last night', K.pill(t.last, t.last === 'failed' ? 'bad' : '')]]) +
        K.sect('Last 14 nights', '05.11 to 18.11') + `<div class="mg-4-0-2">${strip(r)}</div><div class="faint fs-11 d-flex jc-sb" style="max-width:194px"><span>05.11</span><span>18.11</span></div>` +
        K.sect('It fails with') + K.list(m.errs.map((e, i) => ({ tone: 'bad', html: mono(e), v: i ? 'sometimes' : 'most often' }))) +
        K.sect('Pull requests that touched it', 'last 30 days') + `<div class="rowf">${m.prs.map(prTxt).join(' &nbsp;')}</div>` +
        K.note('None of these was merged between two runs that gave different results: that is what makes the test flaky here.', '') +
        `<div class="rowf mt-14" >${K.extLink('Open the history in the test reports', 'Test reports')}</div>`
    };
  });

  SM.domain({
    id: 'quality', title: 'Quality', icon: 'quality',
    pages: [
      { id: 'bugs', title: 'Bugs', hz: ['sprint', 'pi', 'quarter'], was: 'kept', from: 'Quality', find: 'defects time to fix open bugs age debt customer', render: bugsPage },
      { id: 'tests', title: 'Test runs', hz: ['today', 'sprint', 'pi'], was: 'new', from: 'Operations (was a line under Not connected)', find: 'test reports launches regression passing rate defect types', render: testsPage },
      { id: 'flaky', title: 'Flaky and failing tests', hz: ['sprint', 'pi'], was: 'new', from: '', find: 'flaky unstable slow tests quarantine', render: flakyPage },
      { id: 'escaped', title: 'Found where', hz: ['pi', 'quarter'], was: 'new', from: 'Quality (was a line under Not connected)', find: 'escaped defects production found in leakage', render: escapedPage }
    ]
  });
})();
