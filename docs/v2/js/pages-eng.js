/* Domain: Engineering. Everything about code: pull requests, builds, repositories, technical debt.
   Sources: Git hosting and Build server, plus Jira for the link to issues. By role, never by person. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, PS = D.prStats, B = D.builds;
  const REPOS = D.services.map(s => s.id);
  const pipe = repo => B.pipes.find(p => p.repo === repo);

  /* time helpers: "now" of the data set is Wed 18.11.2026 11:48 */
  const NOW = Date.UTC(2026, 10, 18, 11, 48);
  const pad = n => (n < 10 ? '0' : '') + n;
  const ago = h => { const d = new Date(NOW - h * 36e5); return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
  const mmss = m => Math.floor(m) + ':' + pad(Math.round((m - Math.floor(m)) * 60) % 60);

  /* ── pull requests: detail only this domain needs ─────────────────────── */
  const ST = { first: ['waiting for a first review', ''], review: ['in review', ''], approved: ['approved, not merged', 'ok'] };
  const stPill = p => K.pill(ST[p.st][0], p.st === 'first' && p.wait >= 24 ? 'watch' : ST[p.st][1]);
  const buildCell = b => b === 'ok' ? K.dot('ok') + ' green' : b === 'red' ? K.dot('bad') + ' <span class="c-bad">red</span>' : K.dot('', true) + ' <span class="faint">running</span>';
  const prLabel = p => `<span class="mono">${esc(p.repo)}</span> <b class="ink">#${p.id}</b>`;

  /* events of each open pull request: [hours ago, tone, text]. The last event is "wait" hours ago, the first "age" days ago. */
  const EV = {
    412: [[50.4, '', 'Opened by the author · 9 files'], [46.1, 'watch', 'First review: changes requested · 4 comments'], [41.0, '', 'Author pushed a second version'], [26, 'watch', 'Second review: changes requested · 3 comments · waiting for the author since']],
    233: [[21.6, '', 'Opened by the author · 5 files'], [17.2, '', 'First review · 2 comments'], [3, 'ok', 'Approved by a reviewer · waiting for the merge']],
    118: [[43.2, '', 'Opened by the author · 7 files'], [30, 'watch', 'First review: changes requested · 4 comments · waiting since'], [19.13, 'bad', 'Main turned red: the contract test against the price feed v3 fails on this branch too']],
    415: [[21.6, '', 'Opened by the author · 11 files'], [21.2, 'ok', 'Build of the branch green'], [21, 'watch', 'Waiting for a first review']],
    236: [[9.6, '', 'Opened by the author · 2 files'], [5, '', 'Review started · 1 comment']],
    97: [[2.4, '', 'Opened by the author · 6 files'], [2, '', 'Waiting for a first review'], [0.3, '', 'Build of the branch running']],
    416: [[14.4, '', 'Opened by the author · 3 files'], [6.5, '', 'First review · 3 comments'], [1, 'ok', 'Approved by a reviewer · waiting for the merge']],
    57: [[28.8, '', 'Opened by the author · 1 file'], [28.5, 'ok', 'Build of the branch green'], [28, 'watch', 'Waiting for a first review']]
  };
  /* changed files per pull request: [path, added, removed] */
  const FILES = {
    412: [['src/main/java/shop/orders/cancel/CancelService.java', 48, 12], ['src/main/java/shop/orders/cancel/CancelConfirmedEvent.java', 31, 0], ['src/main/java/shop/orders/cancel/CancelEventPublisher.java', 44, 0],
      ['src/main/java/shop/orders/config/MessagingConfig.java', 18, 3], ['src/main/resources/application.yml', 6, 1], ['src/test/java/shop/orders/cancel/CancelServiceTest.java', 62, 8],
      ['src/test/java/shop/orders/cancel/CancelEventPublisherTest.java', 57, 0], ['src/test/resources/cancel/partial-cancel.json', 40, 0], ['docs/events.md', 12, 0]],
    233: [['src/app/stock/stock-overview.component.ts', 64, 9], ['src/app/stock/stock-overview.component.html', 38, 4], ['src/app/stock/stock-filter.pipe.ts', 27, 0],
      ['src/app/stock/stock-overview.component.spec.ts', 71, 2], ['src/assets/i18n/de.json', 6, 0]],
    118: [['src/main/java/shop/pricing/cache/PriceTierCache.java', 86, 0], ['src/main/java/shop/pricing/cache/SaleExpiry.java', 41, 0], ['src/main/java/shop/pricing/client/PriceFeedClient.java', 22, 9],
      ['src/main/resources/application.yml', 8, 0], ['src/test/java/shop/pricing/cache/PriceTierCacheTest.java', 94, 0], ['src/test/java/shop/pricing/contract/PriceFeedV3ContractTest.java', 18, 4], ['pom.xml', 5, 1]],
    415: [['src/main/java/shop/orders/price/PriceCalculator.java', 58, 21], ['src/main/java/shop/orders/price/BundleRule.java', 47, 0], ['src/main/java/shop/orders/price/PriceTier.java', 9, 2],
      ['src/main/java/shop/orders/stock/StockHoldService.java', 14, 6], ['src/main/java/shop/orders/api/PriceController.java', 11, 3], ['src/main/resources/db/migration/V44__price_tier_school.sql', 16, 0],
      ['src/test/java/shop/orders/price/PriceCalculatorTest.java', 88, 12], ['src/test/java/shop/orders/price/BundleRuleTest.java', 64, 0], ['src/test/java/shop/orders/api/PriceControllerIT.java', 39, 0],
      ['src/test/resources/price/school-order-24-items.json', 33, 0], ['docs/price-rules.md', 19, 2]],
    236: [['src/app/checkout/checkout-flow.component.html', 14, 9], ['src/app/checkout/checkout-flow.component.spec.ts', 22, 0]],
    97: [['src/main/java/shop/export/CarrierExportStep.java', 36, 8], ['src/main/java/shop/export/retry/StopAfterAttempts.java', 42, 0], ['src/main/java/shop/export/alarm/OpsAlertSender.java', 51, 0],
      ['src/main/resources/application.yml', 7, 1], ['src/test/java/shop/export/CarrierExportStepTest.java', 49, 3], ['src/test/java/shop/export/retry/StopAfterAttemptsTest.java', 58, 0]],
    416: [['src/main/java/shop/orders/cancel/CancelReason.java', 24, 0], ['src/main/java/shop/orders/api/CancelController.java', 12, 4], ['src/test/java/shop/orders/api/CancelControllerTest.java', 31, 2]],
    57: [['src/main/resources/certs/carrier-test.p12', 1, 1]]
  };

  /* the 58 merged pull requests of 6 weeks: [files changed, days to merge, more than one round]. Fixed list:
     median 1.3 d, 85 % within 3.1 d, 12 with more than one round of rework. */
  const DAYS = [0.2, 0.3, 0.3, 0.4, 0.5, 0.5, 0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.1, 1.1, 1.2, 1.2, 1.2, 1.2, 1.3, 1.3, 1.3, 1.3,
    1.3, 1.4, 1.5, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.1, 3.4, 3.7, 4.0, 4.4, 4.8, 5.3, 6.1, 7.2, 8.5];
  const REWORK = [22, 33, 38, 41, 44, 47, 50, 52, 53, 55, 56, 57];
  const MERGED = DAYS.map((d, i) => [Math.max(1, Math.round(2.4 + d * 2.3 + ((i * 37) % 11 - 5) * 0.7)), d, REWORK.indexOf(i) >= 0]);

  /* review themes: the agent sorts each comment of the 58 merged pull requests into a theme, code counts them */
  const THEMES = [['Tests missing or too thin', 31], ['Error handling, retries and time-outs', 22], ['Transactions and database connections', 14], ['Naming and readability', 12], ['Accessibility in templates', 7]];

  /* ── builds: detail only this domain needs ─────────────────────────────── */
  const STAGES = ['Checkout', 'Build', 'Unit tests', 'Integration tests', 'Quality gate', 'Deploy to dev'];
  const BASE = [0.3, 2.1, 3.4, 5.2, 1.4, 1.6];        // minutes, sums to 14
  /* last 8 runs on main, newest first: the stage that failed or null */
  const RUNS = {
    'checkout-web': { no: 1288, gap: 9, fail: [null, null, null, 'Unit tests', null, null, null, null] },
    'checkout-api': { no: 2041, gap: 8, fail: [null, null, 'Quality gate', null, null, 'Integration tests', null, null] },
    'pricing-engine': { no: 339, gap: 14, fail: ['Integration tests', null, null, 'Integration tests', null, 'Unit tests', null, null] },
    'carrier-export': { no: 512, gap: 17, fail: [null, null, null, null, 'Deploy to dev', null, null, null] },
    'order-mail': { no: 207, gap: 23, fail: [null, null, null, null, null, null, 'Unit tests', null] }
  };
  const lastH = p => { const m = p.last.match(/(\d+)\.(\d+) (\d+):(\d+)/); return (NOW - Date.UTC(2026, +m[2] - 1, +m[1], +m[3], +m[4])) / 36e5; };
  function runsOf(repo) {
    const p = pipe(repo), r = RUNS[repo], k = p.min / 14, h0 = lastH(p);
    return r.fail.map((f, i) => {
      const at = i === 0 ? p.last : ago(h0 + i * r.gap);
      const fi = f ? STAGES.indexOf(f) : 99;
      const st = STAGES.map((s, n) => n < fi ? ['ok', BASE[n] * k * (1 + ((i * 7 + n * 3) % 5 - 2) * 0.05)] : n === fi ? ['bad', BASE[n] * k * 0.8] : ['skip', 0]);
      return { no: r.no - i, at: at, fail: f, st: st };
    });
  }
  const FAILING = [
    ['PriceFeedV3ContractTest › tiers include SCHOOL', 'expected status 200, got 404 from the test stub of the price feed v3'],
    ['PriceFeedV3ContractTest › tiers know SMALL_BUSINESS', 'field customerGroup missing in the answer'],
    ['PriceFeedV3ContractTest › validFrom falls on the Winter sale 13.12.2026', 'expected 2026-12-13, got null']
  ];
  /* duration of runs on main per day, last 30 days (20.10 to 18.11): median and 85 % line in minutes */
  const DUR50 = [13, 14, 13, 15, 14, 12, 13, 14, 15, 14, 13, 14, 16, 15, 14, 13, 14, 15, 17, 16, 14, 13, 14, 15, 14, 13, 14, 15, 14, 14];
  const DUR85 = [20, 22, 21, 23, 22, 19, 20, 22, 24, 23, 21, 22, 25, 24, 22, 21, 22, 23, 27, 26, 22, 21, 22, 23, 22, 21, 22, 23, 22, 22];
  /* hours main was red per repository, last 30 days. pricing-engine is still red. */
  const RED_H = [['pricing-engine', 19, true], ['checkout-api', 6], ['checkout-web', 3], ['carrier-export', 2], ['order-mail', 1]];   // 31 h in total

  /* ── repositories: detail only this domain needs ──────────────────────── */
  /* merged per week W42..W47 by repository: 21 + 17 + 9 + 7 + 4 = 58 */
  const WEEKS = ['W42', 'W43', 'W44', 'W45', 'W46', 'W47'];
  const REPO = {
    'checkout-api': { wk: [3, 4, 3, 4, 4, 3], med: 1.4, files: 214, fix: 6, br: [4, 96] },
    'checkout-web': { wk: [3, 3, 2, 4, 3, 2], med: 1.0, files: 163, fix: 5, br: [3, 41] },
    'pricing-engine': { wk: [1, 2, 1, 2, 1, 2], med: 2.2, files: 71, fix: 2, br: [1, 12] },
    'carrier-export': { wk: [1, 1, 1, 2, 1, 1], med: 1.6, files: 52, fix: 3, br: [2, 130] },
    'order-mail': { wk: [1, 1, 1, 0, 1, 0], med: 0.8, files: 19, fix: 0, br: [1, 210] }
  };
  const merged = id => REPO[id].wk.reduce((s, v) => s + v, 0);
  const openOf = id => D.prs.filter(p => p.repo === id).length;
  /* files changed by two or more of the 58 merged pull requests: [repo, path, pull requests, of them for a bug] */
  const HOT = [
    ['checkout-api', 'src/main/java/shop/orders/stock/StockHoldService.java', 7, 3],
    ['checkout-web', 'src/app/checkout/picker/picker.component.ts', 6, 2],
    ['checkout-api', 'src/main/java/shop/orders/cancel/CancelService.java', 5, 2],
    ['carrier-export', 'src/main/java/shop/export/CarrierExportStep.java', 5, 2],
    ['checkout-api', 'src/main/java/shop/orders/persistence/StockHoldRepository.java', 4, 1],
    ['pricing-engine', 'src/main/java/shop/pricing/client/PriceFeedClient.java', 4, 1],
    ['checkout-web', 'src/app/checkout/checkout-flow.component.html', 4, 0],
    ['checkout-web', 'src/app/cancel/cancel-overview.component.ts', 3, 1],
    ['checkout-api', 'src/main/resources/db/migration/V42__stock_hold_new_schema.sql', 3, 0],
    ['order-mail', 'src/main/kotlin/shop/notify/mail/MailSender.kt', 2, 0]
  ];
  const short = p => { const a = p.split('/'); return (a.length > 3 ? '…/' : '') + a.slice(-2).join('/'); };

  /* ── technical debt: items the team labelled "techdebt" in Jira ───────── */
  const DEBT = [
    { key: 'KES-3712', title: 'Move the Pricing engine from Spring Boot 3.2 to 3.4', svc: 'pricing-engine', age: 142, plan: null },
    { key: 'KES-3768', title: 'Switch off the old v1 REST endpoints of orders', svc: 'checkout-api', age: 118, plan: 'Sprint 43' },
    { key: 'KES-3805', title: 'Move the checkout forms to typed Angular forms', svc: 'checkout-web', age: 96, plan: null },
    { key: 'KES-3851', title: 'Export job: replace fixed waits with configuration', svc: 'carrier-export', age: 81, plan: 'under KES-3325' },
    { key: 'KES-3920', title: 'One test data generator for stock holds', svc: 'checkout-api', age: 54, plan: null },
    { key: 'KES-3977', title: 'Update Kotlin and the Gradle wrapper in Order mail', svc: 'order-mail', age: 33, plan: null },
    { key: 'KES-4012', title: 'Merge the duplicate price calculation of checkout and pricing', svc: 'checkout-web', age: 21, plan: 'Sprint 43' }
  ];
  /* a key of the team backlog that is not in the sprint: shown, not opened */
  const bkey = k => `<span class="key" data-tip="Team backlog, not in the sprint: opens in Jira in the app">${esc(k)}</span>`;

  /* ── Pull requests ────────────────────────────────────────────────────── */
  function prsPage(ctx) {
    const prs = D.prs.slice().sort((a, b) => b.wait - a.wait);
    const day = prs.filter(p => p.wait >= 24);
    const flags = p => ['all', p.st, p.wait >= 24 ? 'day' : ''].join(' ');
    const n = st => D.prs.filter(p => p.st === st).length;
    const inbox = K.table([
      { h: 'Pull request', cls: 's', v: prLabel, s: p => p.repo + p.id },
      { h: 'Issue', cls: 'ttl', v: p => K.key(p.issue, { title: true }), s: p => p.issue },
      { h: 'Where it stands', cls: 's', v: stPill, s: p => ['first', 'review', 'approved'].indexOf(p.st) },
      { h: 'Waiting', n: true, v: p => `<span class="${p.wait >= 24 ? 'c-bad' : ''}">${p.wait} h</span>`, s: p => p.wait, tip: 'Hours since the pull request last moved, weekends left out. Red from 24 h: a working day.' },
      { h: 'Age', n: true, v: p => p.age + ' d', s: p => p.age },
      { h: 'Rounds', n: true, v: p => p.rounds > 1 ? `<span class="c-watch">${p.rounds}</span>` : p.rounds, s: p => p.rounds, tip: 'Review passes so far' },
      { h: 'Comments', n: true, v: p => p.comments, s: p => p.comments },
      { h: 'Files', n: true, v: p => p.files, s: p => p.files },
      { h: 'Build', cls: 's', v: p => buildCell(p.build), s: p => p.build }
    ], prs, { attrs: p => `data-dr="pr:${p.id}" data-f-engpr="${flags(p)}"` });

    const wk = PS.waitWeek;
    const waitChart = K.chart({
      label: 'Hours to a first review per week', w: 460, h: 210, x: [-.6, wk.length - .4], y: [0, 16], yt: [0, 4, 8, 12, 16], yu: ' h',
      xt: wk.map((w, i) => [i, w[0]]),
      bars: wk.map((w, i) => ({ x: i, w: .62, y1: w[1], color: w[1] >= 12 ? 'watch' : 's1', op: i === wk.length - 1 ? .6 : 1, tip: `Week ${w[0].slice(1)}: first review after ${w[1]} h, half of them${i === wk.length - 1 ? ' (week not over)' : ''}` })),
      hlines: [{ y: PS.firstReviewH, color: 'faint', dash: true, label: '6 weeks: 6 h', left: true }]
    });

    const scatter = K.chart({
      label: 'Files changed against days to merge', w: 640, h: 240, x: [0, 26], y: [0, 9], yt: [0, 2, 4, 6, 8], yu: ' d',
      xt: [[1, '1'], [5, '5'], [10, '10'], [15, '15'], [20, '20'], [25, '25 files']],
      hlines: [{ y: PS.p50, color: 's1', label: 'half within 1.3 d' }, { y: PS.p85, color: 'watch', dash: true, label: '85 % within 3.1 d' }],
      dots: MERGED.map(m => ({ x: m[0], y: m[1], color: m[2] ? 's2' : 's1', r: 4, op: .9, tip: `${m[0]} files · merged after ${m[1]} days${m[2] ? ' · more than one round of rework' : ''}` }))
    }) + K.legend([['one round', 'bg-s1'], ['more than one round of rework', 'bg-s2']]);

    const quiet = D.issues.filter(i => i.st === 'impl' && i.dis >= 3 && !i.pr).sort((a, b) => b.dis - a.dis);
    const themes = K.hbars(THEMES.map(t => ({ n: t[0], v: t[1], cls: 's1', label: t[1] })), { nw: 190, vw: 30 });

    return {
      lede: `Where code waits between opening and merging. ${ctx.pick({ today: 'Today: the 8 pull requests open now.', sprint: 'Sprint 42 started in week 46.', pi: 'PI 26.4 so far.' })} Times of merged pull requests cover the last 6 weeks.`,
      acts: K.extLink('Open the pull requests in Git hosting', 'Git hosting'),
      kpis: [
        { l: 'Merged in 6 weeks', v: PS.merged6w, u: 'pull requests', s: 'five repositories' },
        { l: 'Open to merged, half', v: PS.p50, u: 'days', s: `85 % within <b>${PS.p85} days</b>` },
        { l: 'First review after', v: PS.firstReviewH, u: 'h', s: 'half of them · weekends left out', ev: 'pr.first_review' },
        { l: 'Open now', v: D.prs.length, u: 'pull requests', s: `<b>${day.length} wait a working day</b> or more`, tone: 'bad' },
        { l: 'More than one round', v: PS.rework + ' of ' + PS.merged6w, s: 'needed rework after a review', tone: 'watch' },
        { l: 'First review in a day', v: PS.kept1d + ' of ' + PS.merged6w, s: 'agreement WA-1', tone: 'watch', to: '#/knowledge/agreements' }
      ],
      body: K.grid(
        K.panel({ title: 'Open pull requests', sub: 'the team\'s inbox · click a row for its timeline', w: 'c12 x6', src: ['git', 'jira', 'ci'], flush: true,
          right: K.filter('engpr', [['all', 'All', D.prs.length], ['first', 'Waiting for a first review', n('first')], ['review', 'In review', n('review')], ['approved', 'Approved', n('approved')], ['day', 'A day or more', day.length]]),
          body: inbox, help: 'Every open pull request of the five repositories. No author or reviewer is shown: the inbox belongs to the team.' }),
        K.panel({ title: 'Where pull request time goes', sub: 'share of the time, open to merged', w: 'c4 x3', src: ['git'], ev: 'pr.first_review',
          body: K.stackbar([['Waiting for a first review', PS.split[0], 'bg-r1'], ['In review', PS.split[1], 'bg-r3'], ['Approved, waiting for the merge', PS.split[2], 'bg-r5']], { unit: '%', h: 14 }) +
            K.sect('What it says') + K.list([
              { tone: 'watch', html: 'The longest part is the wait before anybody looks', v: PS.split[0] + ' %' },
              { tone: '', html: 'Approved code waits a quarter of the time for the merge', v: PS.split[2] + ' %' },
              { tone: 'watch', html: 'First review within a working day', v: PS.kept1d + ' of ' + PS.merged6w, to: '#/knowledge/agreements' }]),
          help: 'The time of the 58 pull requests merged in the last 6 weeks, split by what they waited for. Weekends are left out.' }),
        K.panel({ title: 'Review wait per week', sub: 'hours to a first review, median', w: 'c4 x3', src: ['git'], body: waitChart +
          K.note('Week 46 stands out: <b>14 h</b> against 6 h over six weeks. It was the week after release 2026.11 and INC-2291.', 'watch') }),
        K.panel({ title: 'Did the work really start?', sub: '3 days or more in Implementing, no pull request', w: 'c4 x4', src: ['jira', 'git'], right: K.pill(String(quiet.length), 'watch'),
          body: K.list(quiet.map(i => ({ tone: i.dis >= D.flow.p85 ? 'bad' : 'watch', html: K.key(i.key, { title: true }) + ` <span class="faint">${esc(i.svc)}</span>`, v: i.dis + ' d' }))) +
            K.note('No branch or pull request names these keys. The work may sit on a branch without the key, or not have started.', ''),
          help: 'Items of the sprint in Implementing whose key appears in no branch name, commit message or pull request of the five repositories.' }),
        K.panel({ title: 'Size and time', sub: 'the 58 merged pull requests · one dot is one pull request', w: 'c8 x4', src: ['git'], body: scatter,
          help: 'Files changed against working days from opening to the merge. Large pull requests take longer and need rework more often.' }),
        K.panel({ title: 'What reviews keep saying', sub: 'comments of 58 merged pull requests', w: 'c4 x4', src: ['git'], body: themes +
          K.note('The agent sorts each comment into a theme; code counts them. Comment texts are read live and never stored.', ''),
          help: 'The themes are the agent\'s reading. The counts are code. No comment text is shown or kept: the texts stay in Git hosting.' }),
        K.panel({ title: 'Most discussed', sub: 'the longest conversations of the last 6 weeks, by comments', w: 'c12', src: ['git', 'jira'], flush: true, isNew: true,
          body: K.table([
            { h: 'Pull request', cls: 's', v: r => r.open ? `<button class="key" data-dr="pr:${r.id}">#${r.id}</button>` : `<span class="mono">#${r.id}</span>` },
            { h: 'Repository', cls: 's', v: r => K.svc(r.repo) }, { h: 'Issue', cls: 'ttl', v: r => K.key(r.issue, { title: true }) },
            { h: 'Comments', n: true, v: r => `<b class="ink">${r.comments}</b>`, s: r => r.comments }, { h: 'Rounds', n: true, v: r => r.rounds, s: r => r.rounds },
            { h: 'State', cls: 's', v: r => K.pill(r.st === 'merged' ? 'merged' : r.st === 'first' ? 'waits for a first review' : r.st === 'approved' ? 'approved' : 'in review', r.st === 'merged' ? 'ok' : '') }
          ], D.discussed), foot: 'counts of comments only: their text stays in Git hosting',
          help: 'The pull requests with the most comments in the last six weeks: where the team needed the longest conversation. A long conversation is not a fault. It often marks a part of the code that deserves a talk at the board.' })
      )
    };
  }

  /* ── Builds ───────────────────────────────────────────────────────────── */
  const STAGE_SHORT = ['Checkout', 'Build', 'Unit', 'Integration', 'Gate', 'Deploy'];
  function stageTable(repo, compact) {
    const runs = runsOf(repo);
    return `<div class="tbwrap"><table class="tb eng-stg${compact ? ' compact' : ''}"><thead><tr><th>Run</th><th>Started</th>${(compact ? STAGE_SHORT : STAGES).map(s => `<th class="n">${esc(s)}</th>`).join('')}</tr></thead><tbody>${runs.map(r =>
      `<tr><td class="s">${K.dot(r.fail ? 'bad' : 'ok')} <span class="mono">#${r.no}</span></td><td class="s faint">${esc(r.at)}</td>${r.st.map((c, i) =>
        `<td class="cell ${c[0]}" data-tip="${esc(STAGES[i])}: ${c[0] === 'ok' ? 'passed in ' + mmss(c[1]) : c[0] === 'bad' ? 'failed after ' + mmss(c[1]) : 'not run'}">${c[0] === 'skip' ? 'skipped' : mmss(c[1])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function buildsPage(ctx) {
    const red = B.pipes.filter(p => p.state === 'bad'), tests = B.pipes.reduce((s, p) => s + p.tests, 0), redRuns = B.runs - B.green;
    const t = B.pipes.find(p => p.repo === 'pricing-engine');
    const cur = SM.ui.engpipe || 'pricing-engine';
    const banner = `<div class="note bad eng-banner">${K.dot('bad')}<span><b>pricing-engine: main red since ${esc(t.since)}</b>, 19 h now. The contract test against the price feed v3 fails. It blocks pull request <button class="key" data-dr="pr:118">#118</button> and the release check <a class="ent" href="#/release/readiness">Main is green in every repository</a>.</span><span class="rowf eng-banner-a"><button class="btn sm" data-dr="build:pricing-engine">Open the pipeline</button></span></div>`;
    const pipes = K.table([
      { h: 'Pipeline', cls: 's', v: p => `${K.dot(p.state)} <span class="mono">${esc(p.repo)}</span>`, s: p => p.repo },
      { h: 'Green on main', v: p => { const r = K.pct(p.green, p.runs); return `<span class="eng-rate"><span class="eng-mini"><i class="${r >= 90 ? 'ok' : 'watch'}" style="width:${r}%"></i></span>${r} %<span class="faint"> · ${p.green}/${p.runs}</span></span>`; }, s: p => p.green / p.runs },
      { h: 'Median', n: true, v: p => p.min + ' min', s: p => p.min },
      { h: 'Tests', n: true, v: p => K.fmt(p.tests), s: p => p.tests },
      { h: 'Last run', cls: 's', n: true, v: p => p.state === 'bad' ? `<span class="c-bad">${esc(p.last)}</span>` : esc(p.last), s: p => -lastH(p) }
    ], B.pipes, { attrs: p => `data-dr="build:${p.repo}"` });
    const dur = K.chart({
      label: 'Duration of runs on main per day', w: 640, h: 220, x: [0, 29], y: [0, 30], yt: [0, 10, 20, 30], yu: ' min', right: 18,
      xt: [[0, '20.10'], [7, '27.10'], [14, '03.11'], [21, '10.11'], [29, '18.11']],
      hlines: [{ y: B.medianMin, color: 'faint', dash: true }, { y: B.p85Min, color: 'faint', dash: true }],
      lines: [
        { pts: DUR85.map((v, i) => [i, v]), color: 'watch', w: 1.6, tip: (x, y) => `${ago((29 - x) * 24).slice(0, 5)}: 85 % within ${y} min` },
        { pts: DUR50.map((v, i) => [i, v]), color: 's1', w: 2.2, tip: (x, y) => `${ago((29 - x) * 24).slice(0, 5)}: half within ${y} min` }
      ]
    }) + K.legend([['half of the runs within', 'bg-s1', 1], ['85 % of the runs within', 'bg-watch', 1], ['30 days: 14 and 22 min', 'bg-off', 1]]);
    return {
      lede: `The pipelines on main of the five repositories, as Build server runs them. Counts cover the last 30 days${ctx.hz === 'today' ? '; the state is now' : ''}.`,
      acts: K.extLink('Open Build server', 'Build server'),
      kpis: [
        { l: 'Green on main', v: K.pct(B.green, B.runs), u: '%', s: `${B.green} of ${B.runs} runs · 30 days`, ev: 'build.green' },
        { l: 'Run duration, half', v: B.medianMin, u: 'min', s: `85 % within <b>${B.p85Min} min</b>` },
        { l: 'Red now', v: red.length + ' of ' + B.pipes.length, u: 'pipelines', s: '<b>pricing-engine</b> since 17.11 16:40', tone: 'bad' },
        { l: 'Red runs', v: redRuns, u: 'in 30 days', s: '9 of them at unit tests' },
        { l: 'Unit tests', v: K.fmt(tests), s: 'in the five pipelines' },
        { l: 'Main red, longest', v: 19, u: 'h', s: '<b>still running</b>', tone: 'bad' }
      ],
      body: banner + K.grid(
        K.panel({ title: 'Pipelines', sub: 'main branch, last 30 days · click a row for its runs', w: 'c7 x5', src: ['ci'], ev: 'build.green', flush: true, body: pipes }),
        K.panel({ title: 'Where red runs fail', sub: `the ${redRuns} red runs by stage`, w: 'c5 x3', src: ['ci'],
          body: K.hbars(B.failBy.map(f => ({ n: f[0], v: f[1], cls: 'bad', label: f[1] })), { nw: 120, vw: 30 }) +
            K.note('Unit tests stop most red runs. Integration tests follow; three of their six were in pricing-engine.', '') }),
        K.panel({ title: 'Build duration', sub: 'runs on main per day, last 30 days', w: 'c7 x4', src: ['ci'], body: dur }),
        K.panel({ title: 'Time main was red', sub: `${RED_H.reduce((s, r) => s + r[1], 0)} h in 30 days, per repository`, w: 'c5 x4', src: ['ci'],
          body: K.hbars(RED_H.map(r => ({ n: `<span class="mono">${esc(r[0])}</span>`, v: r[1], max: 20, cls: r[2] ? 'bad' : 'watch', label: r[1] + ' h' + (r[2] ? '<span class="faint"> · still red</span>' : '') })), { max: 20, nw: 170, vw: 96 }) }),
        K.panel({ title: 'Stages of the last runs', sub: 'one row per run on main, newest on top · minutes:seconds', w: 'c12 x8', src: ['ci'],
          right: K.seg('engpipe', REPOS.map(r => [r, r]), cur),
          body: stageTable(cur) + K.legend([['passed', 'bg-ok'], ['failed', 'bg-bad'], ['not run after a failure', 'bg-off']]),
          help: 'The stage view of the build server for one pipeline: each cell is a stage of one run with its duration.' })
      )
    };
  }

  /* ── Repositories ─────────────────────────────────────────────────────── */
  function reposPage(ctx) {
    const maxM = Math.max.apply(null, REPOS.map(merged));
    const tbl = K.table([
      { h: 'Repository', cls: 's', v: id => `<span class="mono">${esc(id)}</span><span class="sub">${esc(K.service(id).stack)}</span>`, s: id => id },
      { h: 'Application', cls: 's', v: id => K.svc(id), s: id => id },
      { h: 'Merged, 6 weeks', v: id => `<span class="eng-rate"><span class="eng-mini"><i class="s1" style="width:${merged(id) / maxM * 100}%"></i></span>${merged(id)}</span>`, s: merged },
      { h: 'Open now', n: true, v: openOf, s: openOf },
      { h: 'Days to merge', n: true, v: id => REPO[id].med, s: id => REPO[id].med, tip: 'Median, merged pull requests of 6 weeks' },
      { h: 'Files changed', n: true, v: id => REPO[id].files, s: id => REPO[id].files },
      { h: 'Hotspots', n: true, v: id => HOT.filter(h => h[0] === id).length, s: id => HOT.filter(h => h[0] === id).length },
      { h: 'Main', cls: 's', v: id => buildCell(pipe(id).state === 'bad' ? 'red' : 'ok'), s: id => pipe(id).state }
    ], REPOS, { attrs: id => `data-dr="build:${id}"` });
    const hot = K.table([
      { h: 'File', cls: 'ttl', v: h => `<span class="mono" data-tip="${esc(h[1])}">${esc(short(h[1]))}</span><span class="sub">${esc(h[0])}</span>`, s: h => h[1] },
      { h: 'Pull requests', n: true, v: h => h[2], s: h => h[2] },
      { h: 'For a bug', n: true, v: h => h[3] >= 2 ? `<span class="c-watch">${h[3]}</span>` : h[3], s: h => h[3] },
      { h: '', cls: 's', v: h => `<span class="eng-mini wide"><i class="bad" style="width:${h[3] / 7 * 100}%" data-tip="${h[3]} for a bug"></i><i class="s1" style="width:${(h[2] - h[3]) / 7 * 100}%" data-tip="${h[2] - h[3]} for other work"></i></span>` }
    ], HOT);
    const bugsOf = id => (D.bugs.bySvc.find(b => b[0] === id) || [id, 0])[1];
    const meet = K.table([
      { h: 'Application', cls: 's', v: id => K.svc(id) },
      { h: 'Hotspots', n: true, v: id => HOT.filter(h => h[0] === id).length },
      { h: 'Bug-fix pull requests', n: true, v: id => REPO[id].fix, tip: 'Merged in the last 6 weeks, issue type Bug' },
      { h: 'Bugs in the PI', n: true, v: id => bugsOf(id) ? `<b class="ink">${bugsOf(id)}</b>` : '<span class="faint">0</span>', tip: 'Bugs written in PI 26.4, from Jira' }
    ], REPOS.slice().sort((a, b) => bugsOf(b) - bugsOf(a)));
    const wkChart = K.chart({
      label: 'Merged pull requests per week by repository', w: 520, h: 200, x: [-.6, 5.6], y: [0, 14], yt: [0, 4, 8, 12], xt: WEEKS.map((w, i) => [i, w]),
      bars: [].concat.apply([], WEEKS.map((w, i) => { let y = 0; return REPOS.map((id, n) => { const v = REPO[id].wk[i], b = { x: i, w: .62, y0: y, y1: y + v, color: ['r1', 'r2', 'r3', 'r4', 'r5'][n], tip: `${w}: ${v} merged in ${id}` }; y += v; return b; }).filter(b => b.y1 > b.y0); }))
    }) + K.legend(REPOS.map((id, n) => [id, 'bg-r' + (n + 1)])) + K.note('Per week: ' + WEEKS.map((w, i) => REPOS.reduce((s, id) => s + REPO[id].wk[i], 0)).join(', ') + ' merged. 38 of the 58 went to checkout-api and the checkout.', '');
    const branches = REPOS.reduce((s, id) => s + REPO[id].br[0], 0);
    return {
      lede: `The five repositories of the team in Git hosting, project KES. Pull request counts cover the last 6 weeks; ${ctx.pick({ pi: 'bugs come from PI 26.4', quarter: 'bugs come from Q4 2026 so far' })}.`,
      acts: K.extLink('Open project KES in Git hosting', 'Git hosting'),
      kpis: [
        { l: 'Repositories', v: REPOS.length, s: 'Angular, Java, Kotlin' },
        { l: 'Merged in 6 weeks', v: REPOS.reduce((s, id) => s + merged(id), 0), u: 'pull requests', s: '<b>21</b> in checkout-api' },
        { l: 'Open now', v: D.prs.length, u: 'pull requests', to: '#/eng/prs' },
        { l: 'Hotspot files', v: HOT.length, s: 'changed by 2 or more', tone: 'watch' },
        { l: 'Hotspots with bugs', v: HOT.filter(h => h[3] >= 2).length, s: 'two bug fixes or more', tone: 'watch' },
        { l: 'Old branches', v: branches, s: 'without a pull request' }
      ],
      body: K.grid(
        K.panel({ title: 'Repositories', sub: 'click a row for its pipeline', w: 'c12 x8', src: ['git', 'ci'], flush: true, body: tbl }),
        K.panel({ title: 'Merged per week', sub: 'pull requests, weeks 42 to 47', w: 'c5 x4', src: ['git'], body: wkChart }),
        K.panel({ title: 'Hotspots', sub: 'files changed by two or more of the 58 merged pull requests', w: 'c7 x6', src: ['git', 'jira'], flush: true, body: hot,
          help: 'A file counts when two or more merged pull requests changed it. "For a bug" means the pull request names an issue of type Bug.' }),
        K.panel({ title: 'Where code changes and bugs meet', sub: 'per application', w: 'c5 x3', src: ['git', 'jira'], flush: true, body: meet +
          `<div class="eng-pad">${K.note('The Checkout API has the most bugs and two of its files gather bugs: <b>StockHoldService</b> and <b>CancelService</b>, 5 bug fixes.', 'watch')}</div>` }),
        K.panel({ title: 'Old branches', sub: 'no pull request, no commit for 10 days or more', w: 'c7 x3', src: ['git'],
          body: K.hbars(REPOS.map(id => ({ n: `<span class="mono">${esc(id)}</span>`, v: REPO[id].br[0], max: 5, cls: REPO[id].br[1] > 90 ? 'watch' : 's1', label: REPO[id].br[0] + '<span class="faint"> · oldest ' + REPO[id].br[1] + ' d</span>' })), { max: 5, nw: 170, vw: 120 }) +
            K.note('Counts and ages only: the app names no branch and nobody who made one.', '') })
      )
    };
  }

  /* ── Technical debt ───────────────────────────────────────────────────── */
  function debtPage() {
    const en = D.features.filter(f => f.kind === 'Enabler'), mixE = D.workmix.find(w => w.id === 'enabler');
    const enDone = en.reduce((s, f) => s + f.done, 0), enSp = en.reduce((s, f) => s + f.sp, 0);
    const m = K.issue('KES-4160');
    const feats = K.hbars(en.map(f => ({ n: `${K.dot(f.state)} ${K.key(f.key)} <span class="ttl-t">${esc(f.title)}</span>`, plain: f.title, max: 13,
      parts: [[f.done, 's1', `Done: ${f.done} SP`], [f.left, 'r4', `Open in sprint 42: ${f.left} SP`], [f.later, 'bg-off', `Planned later: ${f.later} SP`]], label: f.done + '<span class="faint"> of ' + f.sp + ' SP</span>' })), { max: 13, nw: 330, vw: 80 }) +
      K.legend([['done', 'bg-s1'], ['open in sprint 42', 'bg-r4'], ['planned later', 'bg-off']]);
    const share = K.hbars(D.workmix.map(w => ({ n: w.name, v: w.pct, max: 70, cls: w.id === 'enabler' ? 'watch' : 'bg-mute', label: w.pct + '<span class="faint"> / ' + w.target + ' %</span>', tick: w.target, tickTip: 'agreed share: ' + w.target + ' %' })), { max: 70, nw: 150, vw: 64 }) + '<div class="faint fs-11 mt-4" >done share / agreed share · the mark is the agreed share</div>' +
      K.sect('Enablers sprint by sprint', 'done SP') + K.hbars([{ n: '40', v: 7, max: 52, cls: 's1', label: '7 of 52' }, { n: '41', v: 4, max: 52, cls: 's1', label: '4 of 49' }, { n: '42 so far', v: 5, max: 52, cls: 's1', label: '5 of 25' }], { max: 52, nw: 84, vw: 60 });
    const reg = K.table([
      { h: 'Issue', cls: 'ttl', v: d => bkey(d.key) + ` <span class="ttl-t">${esc(d.title)}</span>`, s: d => d.key },
      { h: 'Application', cls: 's', v: d => K.svc(d.svc), s: d => d.svc },
      { h: 'Age', n: true, v: d => `<span class="${d.age > 90 ? 'c-watch' : ''}">${d.age} d</span>`, s: d => d.age },
      { h: 'Planned', cls: 's', v: d => d.plan ? K.pill(d.plan, 'ok') : '<span class="faint">not planned</span>', s: d => d.plan ? 1 : 0 }
    ], DEBT.slice().sort((a, b) => b.age - a.age));
    const hotBugs = HOT.filter(h => h[3] >= 2);
    const stale = D.docs.filter(d => d.state !== 'ok');
    const watch = K.kv([['Feature', K.key('KES-3347')], ['Status', K.status(m.st) + ` <span class="c-bad">${m.dis} days</span>`], ['Sprint no.', `<span class="c-bad">${m.n}</span>`], ['Story points', m.sp + ' SP, the 5 SP left of KES-3347'], ['Pull request', '<span class="faint">none names it</span>'], ['Decided in', 'ADR-029, three steps without downtime']]) +
      K.sect('The three steps') + K.feed([
        { t: 'Sprint 40', tone: 'ok', html: 'New schema next to the old table', sub: 'migration V42, merged' },
        { t: 'Sprint 41', tone: 'ok', html: 'Writes go to both tables', sub: 'switched on in test and INT' },
        { t: 'Sprint 42', tone: 'bad', html: '<b>Copy the data and switch the reads</b>', sub: 'dry run on INT planned for 20.11 · code freeze Fri 27.11' }
      ]) + `<div class="rowf mt-10" ><button class="btn sm" data-dr="risk:R-4">Risk R-4</button>${K.link('Open KES-4160', '#/issue/KES-4160', 'btn sm')}</div>`;
    return {
      lede: 'Debt the team named itself: enabler features, items labelled techdebt in Jira, and the code where changes and bugs pile up.',
      acts: K.extLink('Open the techdebt filter in Jira', 'Jira'),
      kpis: [
        { l: 'Enabler share', v: mixE.pct, u: '%', s: `of done SP · <b>agreed ${mixE.target} %</b>`, tone: 'bad', ev: 'mix.unplanned' },
        { l: 'Enabler features', v: enDone, u: 'of ' + enSp + ' SP', s: en.length + ' features in the PI' },
        { l: 'Debt items', v: DEBT.length, s: `<b>${DEBT.filter(d => !d.plan).length} not planned</b>`, tone: 'watch' },
        { l: 'Hotspots with bugs', v: hotBugs.length, u: 'files', s: 'two bug fixes or more', to: '#/eng/repos' },
        { l: 'Flaky tests', v: D.flaky.length, s: 'flip in 14 nights', tone: 'watch', to: '#/quality/flaky' },
        { l: 'Migration KES-4160', v: m.dis, u: 'days', s: `<b>sprint no. ${m.n}</b> · Implementing`, tone: 'bad', to: '#/issue/KES-4160' }
      ],
      body: K.grid(
        K.panel({ title: 'Enabler features of the PI', sub: 'story points', w: 'c8 x5', src: ['jira'], body: feats }),
        K.panel({ title: 'How much goes into enablers', sub: '126 SP done in the PI so far', w: 'c4 x3', src: ['jira'], ev: 'mix.unplanned', body: share }),
        K.panel({ title: 'To watch: the database migration', sub: K.key('KES-4160'), w: 'c4 x4', src: ['jira', 'git'], right: K.pill('third sprint', 'bad'), body: watch }),
        K.panel({ title: 'Debt register', sub: 'items the team labelled techdebt in Jira', w: 'c8 x6', src: ['jira'], flush: true, right: K.pill(DEBT.filter(d => d.plan).length + ' of ' + DEBT.length + ' planned', 'watch'), body: reg,
          help: 'Open items of the team with the label techdebt. Planned means the item sits in a sprint or under a feature.' }),
        K.panel({ title: 'Hotspots that gather bugs', sub: 'two or more bug fixes in 6 weeks', w: 'c6 x3', src: ['git', 'jira'],
          body: K.list(hotBugs.map(h => ({ tone: h[3] >= 3 ? 'bad' : 'watch', html: `<span class="mono">${esc(short(h[1]))}</span> <span class="faint">${esc(h[0])}</span>`, v: h[3] + ' of ' + h[2] }))) +
            `<div class="rowf mt-8" >${K.link('All hotspots', '#/eng/repos', 'btn sm')}</div>` }),
        K.panel({ title: 'Debt outside the code', sub: 'tests and documents', w: 'c6 x3', src: ['testrep', 'wiki'],
          body: K.sect('Flaky tests', D.flaky.length + ' tests') + K.list(D.flaky.slice(0, 3).map(f => ({ tone: f.flips >= 5 ? 'watch' : '', html: esc(f.test), v: f.flips + ' of ' + f.of }))) +
            `<div class="rowf mg-6-0-2" >${K.link('All flaky tests', '#/quality/flaky', 'btn sm')}</div>` +
            K.sect('Documents out of date', stale.length + ' pages') + K.list(stale.map(d => ({ tone: d.state, html: esc(d.title), v: esc(d.edited) }))) +
            `<div class="rowf mt-6" >${K.link('All documents', '#/knowledge/documents', 'btn sm')}</div>` })
      )
    };
  }

  /* ── drawers ──────────────────────────────────────────────────────────── */
  SM.drawer('pr', function (id) {
    const p = D.prs.find(x => String(x.id) === String(id)); if (!p) return null;
    const ev = (EV[p.id] || []).map(e => ({ t: ago(e[0]), tone: e[1], html: esc(e[2]) }));
    const files = FILES[p.id] || [];
    const issue = K.issue(p.issue);
    const checks = [
      { state: p.build === 'ok' ? 'ok' : p.build === 'red' ? 'bad' : 'watch', html: 'Build of the branch green', sub: p.build === 'red' ? 'contract test against the price feed v3 fails' : p.build === 'run' ? 'running' : '', v: p.build === 'ok' ? 'green' : p.build === 'red' ? 'red' : 'running' },
      { state: p.st === 'approved' ? 'ok' : 'watch', html: 'At least one approval by a reviewer', v: p.st === 'approved' ? '1 of 1' : '0 of 1' },
      { state: p.st === 'review' && p.rounds > 0 ? 'watch' : 'ok', html: 'No open review tasks', v: p.st === 'review' && p.rounds > 0 ? 'open' : 'none' },
      { state: 'ok', html: 'Names an issue of the sprint', v: p.issue },
      { state: p.id === 118 ? 'bad' : 'ok', html: 'Branch up to date with main', sub: p.id === 118 ? 'main is red: a merge waits for it either way' : '', v: p.id === 118 ? 'main red' : 'yes' },
      { state: p.build === 'run' ? 'watch' : p.build === 'red' ? 'bad' : 'ok', html: 'Quality gate passed', v: p.build === 'ok' ? 'passed' : p.build === 'red' ? 'not reached' : 'pending' }
    ];
    return { kind: 'Pull request · ' + esc(p.repo), title: p.repo + ' #' + p.id + (issue ? ': ' + issue.title : ''), body:
      K.kv([['Issue', K.key(p.issue, { title: true })], ['Where it stands', stPill(p) + (p.wait >= 24 ? ` <span class="c-bad">waiting ${p.wait} h</span>` : ` <span class="faint">waiting ${p.wait} h</span>`)],
        ['Age', p.age + ' days'], ['Review rounds', p.rounds + ' · ' + p.comments + ' comments'], ['Build', buildCell(p.build) + (p.build !== 'run' ? ` · <button class="key" data-dr="build:${p.repo}">pipeline</button>` : '')]]) +
      K.sect('Timeline', 'weekends left out of the hours') + K.feed(ev.concat([{ t: ago(0), tone: '', html: '<span class="faint">now</span>' }])) +
      K.sect('Files changed', files.length + ' files · +' + files.reduce((s, f) => s + f[1], 0) + ' −' + files.reduce((s, f) => s + f[2], 0)) +
      `<div class="eng-files">${files.map(f => `<div><span class="mono">${esc(short(f[0]))}</span><span class="c-ok">+${f[1]}</span><span class="c-bad">−${f[2]}</span></div>`).join('')}</div>` +
      K.sect('Checks before a merge') + K.checks(checks) +
      K.note('Author and reviewer are roles here: the app shows no name and counts nobody.', '') +
      `<div class="rowf mt-12" >${K.extLink('Open in Git hosting', 'Git hosting')}${issue ? K.link('Open ' + p.issue, '#/issue/' + p.issue, 'btn sm') : ''}</div>` };
  });

  SM.drawer('build', function (repo) {
    const p = pipe(repo); if (!p) return null;
    const runs = runsOf(repo), r = K.pct(p.green, p.runs);
    const failing = repo === 'pricing-engine' ? K.sect('Failing tests of run #' + runs[0].no, FAILING.length + ' of ' + p.tests) +
      K.checks(FAILING.map(f => ({ state: 'bad', html: `<span class="mono">${esc(f[0])}</span>`, sub: esc(f[1]) }))) +
      K.note('The provider side of the price feed v3 is not delivered yet (ATL-882). The same test fails on the branch of <button class="key" data-dr="pr:118">#118</button>.', 'bad') : '';
    return { kind: 'Pipeline · main', title: repo, body:
      K.kv([['State', p.state === 'bad' ? `${K.dot('bad')} <span class="c-bad">red since ${esc(p.since)}</span>` : K.dot('ok') + ' green'], ['Green on main', `${r} % · ${p.green} of ${p.runs} runs in 30 days`],
        ['Median duration', p.min + ' min'], ['Unit tests', K.fmt(p.tests)], ['Last run', esc(p.last)], ['Application', K.svc(repo)]]) +
      failing +
      K.sect('Last runs', 'stages, minutes:seconds') + stageTable(repo, true) +
      `<div class="rowf mt-12" >${K.extLink('Open the pipeline in the build server', 'Build server')}${K.link('All pipelines', '#/eng/builds', 'btn sm')}</div>` };
  });

  SM.domain({
    id: 'eng', title: 'Engineering', icon: 'eng',
    pages: [
      { id: 'prs', title: 'Pull requests', hz: ['today', 'sprint', 'pi'], was: 'kept', from: 'Code', find: 'pull request review wait merge git hosting inbox', render: prsPage },
      { id: 'builds', title: 'Builds', hz: ['today', 'sprint', 'pi'], was: 'new', from: 'Code (was a line under Not connected)', find: 'build server pipeline red green ci stages tests', render: buildsPage },
      { id: 'repos', title: 'Repositories', hz: ['pi', 'quarter'], was: 'moved', from: 'Code', find: 'repository hotspots branches files git hosting', render: reposPage },
      { id: 'debt', title: 'Technical debt', hz: ['pi', 'quarter'], was: 'new', from: '', find: 'tech debt enabler migration techdebt flaky', render: debtPage }
    ]
  });
})();
