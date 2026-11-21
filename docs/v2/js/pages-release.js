/* Domain: Release. Getting changes into production: the releases, whether the next one is ready, what runs where,
   how well changes arrive. Sources: Jira (fix versions), Build server (deployments), Test reports, Monitoring, Wiki. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;
  const NEXT = K.release('R2026.12');
  const ENV = { dev: 'DEV', test: 'TEST', int: 'INT', prod: 'PROD' };
  const ALL = D.services.map(s => s.id);
  const sumSp = a => a.reduce((s, i) => s + (i.sp || 0), 0);

  /* which applications each release deployed */
  const APPS = {
    'R2026.12': ['checkout-web', 'checkout-api', 'pricing-engine', 'carrier-export'],
    'R2026.11.1': ['checkout-api'],
    'R2026.11': ['checkout-web', 'checkout-api', 'pricing-engine', 'order-mail'],
    'R2026.10.2': ['carrier-export'],
    'R2026.10': ALL, 'R2026.09': ALL, 'R2026.08': ALL
  };
  const VERDICT = { ok: 'went in calm', bad: 'needed a fix', watch: 'needs a look' };
  const statePill = r => r.state === 'planned' ? K.tag('planned') : K.pill('in production');
  const verdictPill = r => K.pill(VERDICT[r.verdict] || r.verdict, r.verdict);

  /* an issue key this demo does not hold (older releases): looks like a key, opens nothing */
  const xkey = (key, title) => `<span class="rl-k" data-tip="In the real tool this opens the issue. This demo holds the issues of sprint 42 only.">${esc(key)}</span>${title ? ` <span class="ttl-t">${esc(title)}</span>` : ''}`;
  const anyKey = (key, title) => K.issue(key) ? K.key(key, { title: !!title }) : xkey(key, title);

  /* the open part of release 2026.12: open sprint issues of its features plus two bugs = 12 */
  const relOpen = D.issues.filter(i => i.st !== 'done' && i.feat && NEXT.feats.indexOf(i.feat) >= 0)
    .concat(['KES-4079', 'KES-4190'].map(K.issue));
  const relFeats = NEXT.feats.map(K.feature);
  const relSp = relFeats.reduce((s, f) => s + f.sp, 0), relDone = relFeats.reduce((s, f) => s + f.done, 0);
  const relOpenSp = relSp - relDone;                                   // 84 - 48 = 36
  const relSprintSp = relFeats.reduce((s, f) => s + f.left, 0);        // 31, still in sprint 42

  /* incidents within 7 days on an application the release deployed */
  const incAfter = r => D.incidents.filter(i => {
    const d = K.day(i.day) - K.day(r.day);
    return d > 0 && d <= 7 && (APPS[r.id] || []).indexOf(i.svc) >= 0;
  });
  /* bugs found in production after each release (5 production bugs in the PI: 4 follow a release, 1 is not linked) */
  const BUGS = {
    'R2026.11': [['KES-4188', 'Critical', 'checkout-api', 'done'], ['KES-4190', 'Major', 'checkout-web', 'impl'],
      ['KES-4185', 'Minor', 'order-mail', 'done', 'Cancellation mail without the delivery date']],
    'R2026.10': [['KES-3979', 'Minor', 'checkout-web', 'done', 'Stock map does not load in full with more than 12 warehouses']]
  };
  /* error rate %, p95 ms, throughput rpm: 24 h before and after the change marker */
  const BA = {
    'R2026.11': [['checkout-web', 0.30, 0.30, 840, 820, 1210, 1240], ['checkout-api', 0.10, 0.14, 205, 214, 2900, 2960, '<b class="c-bad">4.6 %</b> on 12.11 from 07:41: database connections were not released, the pool ran empty (INC-2291). Back to 0.11 % after the hotfix on 13.11 14:20.'],
      ['pricing-engine', 0.50, 0.60, 330, 340, 1120, 1150], ['order-mail', 0.40, 0.40, 152, 150, 82, 85]],
    'R2026.11.1': [['checkout-api', 0.31, 0.11, 260, 209, 2940, 2960, 'calm since; the pool was restarted by hand on 12.11 08:08 and leaked slowly until the hotfix']],
    'R2026.10.2': [['carrier-export', null, null, null, null, null, null, 'batch job: no request metrics. Nightly run 2 h 44 min before, 2 h 39 min after']],
    'R2026.10': [['checkout-web', 0.30, 0.30, 860, 850, 1180, 1190], ['checkout-api', 0.11, 0.10, 210, 207, 2810, 2830], ['pricing-engine', 0.50, 0.50, 335, 331, 1090, 1100],
      ['carrier-export', null, null, null, null, null, null, 'batch job: nightly run 2 h 31 min before, 2 h 36 min after'], ['order-mail', 0.40, 0.50, 149, 151, 80, 81]],
    'R2026.09': [['checkout-web', 0.40, 0.30, 880, 865, 1150, 1160], ['checkout-api', 0.12, 0.11, 214, 212, 2760, 2790], ['pricing-engine', 0.60, 0.50, 341, 336, 1060, 1070],
      ['carrier-export', null, null, null, null, null, null, 'batch job: nightly run 2 h 28 min before, 2 h 30 min after'], ['order-mail', 0.50, 0.40, 150, 148, 78, 79]],
    'R2026.08': [['checkout-web', 0.30, 0.40, 870, 890, 1090, 1080], ['checkout-api', 0.11, 0.12, 216, 219, 2650, 2640], ['pricing-engine', 0.50, 0.50, 338, 340, 1010, 1020],
      ['carrier-export', null, null, null, null, null, null, 'batch job: nightly run 2 h 25 min before, 2 h 27 min after'], ['order-mail', 0.40, 0.40, 151, 153, 76, 76]]
  };
  /* what each release contained: counts by type that add up to the issues of D.releases, and a few examples */
  const CONTENT = {
    'R2026.11': { types: [['Stories', 18], ['Bugs', 6], ['Tasks', 3]], keys: [
      ['KES-4019', 'Stock hold table: create the new schema (migration step 1)', 'checkout-api'],
      ['KES-4025', 'Refund: calculate the amount from the price tier', 'checkout-api'],
      ['KES-4012', 'Bulk order: load the stock map in the checkout', 'checkout-web'],
      ['KES-4031', 'Price tier query to the price feed v2 with a time limit', 'pricing-engine'],
      ['KES-4044', 'SMS to customers: send special characters correctly', 'order-mail']] },
    'R2026.11.1': { types: [['Stories', 0], ['Bugs', 1], ['Tasks', 0]], keys: [['KES-4188', null, 'checkout-api']] },
    'R2026.10.2': { types: [['Stories', 0], ['Bugs', 2], ['Tasks', 0]], keys: [
      ['KES-4058', 'Export: fix the time zone in the carrier file name', 'carrier-export'], ['KES-4061', 'Export: do not send an empty file to a carrier', 'carrier-export']] },
    'R2026.10': { types: [['Stories', 17], ['Bugs', 5], ['Tasks', 2]], keys: [
      ['KES-3968', 'Bulk order: capture a contact person', 'checkout-web'],
      ['KES-3972', 'Stock hold: set the lock period before shipping', 'checkout-api'],
      ['KES-3981', 'Export: read the carrier list from the configuration', 'carrier-export']] },
    'R2026.09': { types: [['Stories', 15], ['Bugs', 5], ['Tasks', 2]], keys: [
      ['KES-3901', 'Checkout: sort the order overview by delivery date', 'checkout-web'], ['KES-3915', 'Keep cancellation periods per price tier', 'checkout-api']] },
    'R2026.08': { types: [['Stories', 13], ['Bugs', 4], ['Tasks', 2]], keys: [
      ['KES-3844', 'Pricing: member prices for bulk orders', 'pricing-engine'], ['KES-3852', 'E-mail template for the order confirmation', 'order-mail']] }
  };
  /* nightly regression before the deployment, smoke test on INT */
  const TESTS = {
    'R2026.12': [94.4, '389 of 412', 'now: 18.11 01:30', '46 of 46'], 'R2026.11.1': [93.9, '388 of 413', 'night of 13.11', '46 of 46'],
    'R2026.11': [96.4, '392 of 407', 'night of 10.11', '46 of 46'], 'R2026.10.2': [96.9, '388 of 401', 'night of 30.10', '44 of 44'],
    'R2026.10': [97.0, '389 of 401', 'night of 08.10', '44 of 44'], 'R2026.09': [97.4, '376 of 386', 'night of 10.09', '44 of 44'], 'R2026.08': [97.2, '366 of 377', 'night of 13.08', '42 of 42']
  };
  /* path to production */
  const PATH = {
    'R2026.11.1': [['Thu 12.11', 'KES-4188 written after INC-2291', 'bad'], ['Fri 13.11', 'On INT at 11:05: smoke test 46 of 46', 'ok'], ['Fri 13.11', 'Production at 14:20: checkout-api only', 'ok'], ['Fri 13.11', 'Change marker in monitoring at 14:22', '']],
    'R2026.11': [['Tue 03.11', 'Release candidate rc1 on INT', ''], ['Fri 06.11', 'Sign-off on INT by the product owner', 'ok'], ['Tue 10.11', 'Production at 06:00: four applications', 'ok'], ['Thu 12.11', 'INC-2291 at 07:42 on checkout-api', 'bad']],
    'R2026.10.2': [['Thu 29.10', 'Patch on INT after INC-2262', 'watch'], ['Fri 30.10', 'Production at 06:00: carrier-export only', 'ok'], ['Fri 30.10', 'First nightly run after the patch: on time', 'ok']],
    'R2026.10': [['Thu 01.10', 'Release candidate rc2 on INT', ''], ['Mon 05.10', 'Sign-off on INT by the product owner', 'ok'], ['Thu 08.10', 'Production at 06:00: five applications', 'ok']],
    'R2026.09': [['Thu 03.09', 'Release candidate rc1 on INT', ''], ['Mon 07.09', 'Sign-off on INT by the product owner', 'ok'], ['Thu 10.09', 'Production at 06:00: five applications', 'ok']],
    'R2026.08': [['Thu 06.08', 'Release candidate rc1 on INT', ''], ['Mon 10.08', 'Sign-off on INT by the product owner', 'ok'], ['Thu 13.08', 'Production at 06:00: five applications', 'ok']]
  };

  /* deployments of each cell of the environment matrix: when, run, version before, what changed */
  const DEP = {
    'checkout-web|dev': ['Tue 17.11 15:10', 612, '2026.12.0-rc2', [], 'dependency updates only (Angular 19.2.4), no issue'],
    'checkout-web|test': ['Mon 16.11 10:15', 604, '2026.12.0-rc1', ['KES-4150']],
    'checkout-web|int': ['Mon 16.11 08:40', 601, '2026.11.0', ['KES-4102']],
    'checkout-web|prod': ['Tue 10.11 06:00', 588, '2026.10.0', ['KES-4012'], 'release 2026.11: 7 issues of this application'],
    'checkout-api|dev': ['Wed 18.11 10:58', 1873, '2026.12.0-rc3', ['KES-4160'], 'step 2 of the migration, behind a switch'],
    'checkout-api|test': ['Tue 17.11 11:30', 1861, '2026.12.0-rc2', ['KES-4121']],
    'checkout-api|int': ['Mon 16.11 08:40', 1852, '2026.11.1', ['KES-4103', 'KES-4120']],
    'checkout-api|prod': ['Fri 13.11 14:20', 1840, '2026.11.0', ['KES-4188'], 'hotfix 2026.11.1'],
    'pricing-engine|dev': ['Mon 16.11 14:05', 455, '2026.12.0-rc1', ['KES-4135'], 'second part, behind a switch. Main is red since 17.11 16:40: no newer build reached DEV'],
    'pricing-engine|test': ['Thu 12.11 16:10', 449, '2026.11.0', ['KES-4135'], 'first part, behind a switch'],
    'pricing-engine|int': ['Tue 03.11 10:00', 431, '2026.10.0', ['KES-4031'], 'release 2026.11: 5 issues of this application'],
    'pricing-engine|prod': ['Tue 10.11 06:00', 432, '2026.10.0', ['KES-4031'], 'release 2026.11: 5 issues of this application'],
    'carrier-export|dev': ['Wed 18.11 09:05', 371, '2026.12.0-rc2', ['KES-4143']],
    'carrier-export|test': ['Wed 18.11 09:20', 372, '2026.12.0-rc2', ['KES-4143']],
    'carrier-export|int': ['Mon 16.11 08:40', 366, '2026.10.2', ['KES-4142']],
    'carrier-export|prod': ['Fri 30.10 06:00', 351, '2026.10.0', ['KES-4058', 'KES-4061'], 'patch 2026.10.2. Skipped release 2026.11 on purpose: the retry ships with 2026.12'],
    'order-mail|dev': ['Thu 12.11 13:45', 208, '2026.11.0', ['KES-4124'], 'first part; the feature ships with 2027.01'],
    'order-mail|test': ['Tue 03.11 10:20', 201, '2026.10.0', ['KES-4044'], 'release 2026.11'],
    'order-mail|int': ['Tue 03.11 14:00', 202, '2026.10.0', ['KES-4044'], 'release 2026.11. Ships nothing in 2026.12'],
    'order-mail|prod': ['Tue 10.11 06:00', 203, '2026.10.0', ['KES-4044'], 'release 2026.11']
  };
  const TITLES = {};
  Object.keys(CONTENT).forEach(r => CONTENT[r].keys.forEach(k => { if (k[1]) TITLES[k[0]] = k[1]; }));
  BUGS['R2026.11'].concat(BUGS['R2026.10']).forEach(b => { if (b[4]) TITLES[b[0]] = b[4]; });

  /* what 2026.12 needs in each application; order-mail ships nothing in it */
  const NEED = { 'checkout-web': '2026.12.0', 'checkout-api': '2026.12.0', 'pricing-engine': '2026.12.0', 'carrier-export': '2026.12.0', 'order-mail': null };
  const isRed = (svc, env) => env === 'dev' && (D.builds.pipes.find(p => p.repo === svc) || {}).state === 'bad';
  const isBehind = (svc, env) => env === 'int' && NEED[svc] && D.envMatrix[svc][2].indexOf('2026.12') !== 0;

  function matrix(svcs, envs) {
    envs = envs || D.envs;
    const idx = envs.map(e => D.envs.indexOf(e));
    const head = `<div class="h"></div>${envs.map(e => `<div class="h">${ENV[e]}</div>`).join('')}<div class="h">2026.12 needs</div>`;
    const rows = svcs.map(svc => `<div class="rowh">${K.svc(svc)}</div>` + idx.map((n, j) => {
      const env = envs[j], v = D.envMatrix[svc][n], dp = DEP[svc + '|' + env];
      const cls = isRed(svc, env) ? ' red' : isBehind(svc, env) ? ' behind' : '';
      const tip = isRed(svc, env) ? 'The build that feeds this environment is red' : isBehind(svc, env) ? 'Behind what release 2026.12 needs on INT' : '';
      return `<button class="cell${cls}" data-dr="deploy:${svc}|${env}"${tip ? ` data-tip="${esc(tip)}"` : ''}><b>${esc(v)}</b><span>${dp ? esc(dp[0].slice(4)) : ''}</span></button>`;
    }).join('') + `<div class="rowh rl-need">${NEED[svc] ? esc(NEED[svc]) : '<span class="faint">no change</span>'}</div>`).join('');
    return `<div class="tbwrap"><div class="envm rl-mx" style="min-width:max-content;grid-template-columns:minmax(150px,1.1fr) repeat(${envs.length},minmax(108px,1.1fr)) minmax(76px,.7fr)">${head}${rows}</div></div>`;
  }
  const matrixLegend = () => K.legend([['behind what the release needs', 'bg-watch'], ['fed by a red build', 'bg-bad']]);

  /* readiness checks with their source and the page that holds the detail */
  const CK_TO = { scope: '#/release/R2026.12', blockers: '#/delivery/dependencies', build: '#/eng/builds', regress: '#/quality/tests', int: '#/release/environments', smoke: '#/quality/tests', notes: '#/knowledge/documents', slo: '#/ops/slo' };
  const ckCount = st => D.readiness.filter(c => c.state === st).length;
  const ckTone = () => ckCount('bad') ? 'bad' : ckCount('watch') ? 'watch' : 'ok';
  const checks = short => K.checks(D.readiness.map(c => ({
    state: c.state, v: esc(c.v), sub: short ? '' : esc(c.sub),
    html: `<a class="ent" href="${CK_TO[c.id]}">${esc(c.text)}</a> ${K.tag(K.source(c.src).name)}`
  })));

  function scopeBars() {
    return K.hbars(relFeats.map(f => {
      const blocked = f.key === 'KES-3318' ? 5 : 0;
      const parts = [[f.done, 's1', `Done: ${f.done} SP`]];
      if (f.left - blocked > 0) parts.push([f.left - blocked, 'bg-mute', `Open in sprint 42: ${f.left - blocked} SP`]);
      if (blocked) parts.push([blocked, 'bad', 'Blocked by ATL-882 of Team Atlas: 5 SP (KES-4131)']);
      if (f.later) parts.push([f.later, 'bg-off', `Planned for sprint 43, after the code freeze: ${f.later} SP`]);
      return { n: K.key(f.key) + ` <span class="ttl-t">${esc(f.title.split(':')[0])}</span>`, plain: f.title, max: 34, parts, label: `${f.done}<span class="faint"> of ${f.sp}</span>` };
    }), { max: 34, nw: 210, vw: 60 }) + K.legend([['done', 'bg-s1'], ['open in 42', 'bg-mute'], ['blocked by another team', 'bg-bad'], ['planned after the freeze', 'bg-off']]);
  }
  const nextKpis = () => [
    { l: 'Checks passed', v: ckCount('ok') + ' of ' + D.readiness.length, s: `<b>${ckCount('bad')} failed</b>, ${ckCount('watch')} need a look`, tone: ckTone(), to: '#/release/readiness' },
    { l: 'Issues done', v: NEXT.issuesDone + ' of ' + NEXT.issues, s: `${NEXT.issues - NEXT.issuesDone} open · ${K.pct(NEXT.issuesDone, NEXT.issues)} %`, tone: 'watch' },
    { l: 'Open story points', v: relOpenSp, u: 'SP', s: `${relSprintSp} in sprint 42 · <b>${relOpenSp - relSprintSp} after the freeze</b>`, tone: 'bad' },
    { l: 'Blocked', v: 2, u: 'issues', s: '<b>KES-4131</b> 9 d, KES-4079 13 d', tone: 'bad', to: '#/delivery/dependencies' },
    { l: 'To the code freeze', v: 7, u: 'working days', s: 'Fri 27.11 · release Thu 03.12', tone: 'watch' }
  ];

  /* ── Releases ─────────────────────────────────────────────────────────── */
  function calendarPage(ctx) {
    const base = '2026-09-01', x = d => K.day(d) - K.day(base), end = x('2027-01-20');
    const rels = D.releases.filter(r => r.day >= base);
    const tl = K.chart({
      label: 'Releases, incidents and fixed dates', w: 760, h: 240, x: [-2, end], y: [-5, 36], yt: [0, 10, 20, 30],
      xt: [['2026-09-01', 'Sep'], ['2026-10-01', 'Oct'], ['2026-11-01', 'Nov'], ['2026-12-01', 'Dec'], ['2027-01-01', 'Jan 2027']].map(t => [x(t[0]) + 2, t[1]]),
      areas: [{ pts: [[x(D.cal.quarter.from), -5, 36], [x(D.cal.quarter.to), -5, 36]], color: 'faint', op: .07, tip: 'Q4 2026' }],
      bars: rels.map(r => ({ x: x(r.day), w: 2.4, y0: 0, y1: r.issues, color: r.state === 'planned' ? 's1' : r.verdict === 'bad' ? 'bad' : 's1',
        fill: r.state === 'planned' ? 'none' : null, stroke: r.state === 'planned' ? 's1' : null,
        tip: `${r.name} · ${r.date}<small>${r.issuesDone} of ${r.issues} issues done · ${r.state === 'planned' ? 'planned' : VERDICT[r.verdict]}</small>` })),
      dots: D.incidents.map(i => ({ x: x(i.day), y: -2.6, r: 4, color: i.prio === 'P2' ? 'bad' : 'watch', tip: `${i.id} · ${i.prio} · ${i.at}<small>${esc(i.title)}</small>` })),
      vmarks: [{ x: x(D.now.date), color: 'ink', label: 'today', dash: false }, { x: x('2026-11-27'), color: 'watch', label: 'freeze 27.11', row: 1, tip: 'Code freeze for release 2026.12: Fri 27.11' },
        { x: x('2026-12-13'), color: 'watch', label: 'Winter sale 13.12', row: 2, tip: 'Winter sale 13.12.2026' }, { x: x('2027-01-14'), color: 'faint', label: '2027.01', left: true, tip: 'Release 2027.01 planned: Thu 14.01.2027' }]
    }) + K.legend([['release in production, height: issues', 'bg-s1'], ['release that needed a fix', 'bg-bad'], ['incident P2', 'bg-bad'], ['incident P3', 'bg-watch'], ['freeze and Winter sale', 'bg-watch', 1]]);

    const table = K.table([
      { h: 'Release', cls: 'ttl', v: r => K.key(r.id) + ` <span class="ttl-t">${esc(r.name)}</span>`, s: r => r.day },
      { h: 'Date', cls: 's', v: r => esc(r.date.slice(0, 9)), s: r => r.day },
      { h: 'State', cls: 's', v: statePill, s: r => r.state },
      { h: 'Issues done', n: true, v: r => `${r.issuesDone}<span class="faint"> of ${r.issues}</span>`, s: r => r.issues },
      { h: 'Features', v: r => r.feats.length ? K.keys(r.feats) : '<span class="faint">not linked</span>' },
      { h: 'Verdict', cls: 's', v: verdictPill, s: r => r.verdict },
      { h: 'Note', v: r => r.note ? `<span class="dim">${esc(r.note)}</span>` : r.state === 'planned' ? `<span class="dim">freeze ${esc(r.freeze)}</span>` : '<span class="faint">–</span>' }
    ], D.releases, { attrs: r => `data-go="#/release/${r.id}"` });

    const prod = D.releases.filter(r => r.state === 'prod' && r.day >= '2026-09-01');
    const brought = `<div class="cols2"><div>${K.sect('Bugs found in production afterwards')}${K.hbars(prod.map(r => ({ n: K.key(r.id), v: (BUGS[r.id] || []).length, max: 4, cls: 's2', label: String((BUGS[r.id] || []).length) })), { max: 4, nw: 90, vw: 28 })}
      </div><div>${K.sect('Incidents within 7 days', 'same application')}${K.hbars(prod.map(r => { const n = incAfter(r).filter(i => i.prio === 'P2' || i.prio === 'P1').length; return { n: K.key(r.id), v: n, max: 4, cls: 'bad', label: String(n) }; }), { max: 4, nw: 90, vw: 28 })}</div></div>` +
      K.note(`Release ${K.key('R2026.11')} brought <b>3 bugs</b> and ${K.key('INC-2291')} two days later. ${K.key('INC-2274')} (P3) came 6 days after patch 2026.10.2 on carrier-export: its cause was the slow carrier endpoint, not the patch, and a P3 does not count. 4 of the 5 production bugs of the PI follow a release; the fifth is not linked to one.`, 'watch');

    const dates = K.list([
      { tone: 'watch', html: '<b>Code freeze</b> for release 2026.12', v: 'Fri 27.11', cite: 'in 7 working days' },
      { tone: 'bad', html: `<b>Release 2026.12</b> to production at 06:00 ${K.key('R2026.12')}`, v: 'Thu 03.12', cite: 'in 11 working days' },
      { tone: 'watch', html: `<b>Winter sale</b>: the new price tiers of ${K.key('KES-3318')} must be live`, v: 'Sun 13.12', cite: 'in 25 days' },
      { tone: '', html: '<b>Release 2027.01</b>, freeze on Fri 08.01.2027', v: 'Thu 14.01', cite: 'in 8 weeks' }
    ]) + K.note('One release train a month, on a Thursday at 06:00, plus patches when needed. The dates come from the fix versions in Jira.', '');

    const nxt = K.list(relFeats.map(f => ({ tone: f.state, html: K.key(f.key) + ` <span class="ttl-t">${esc(f.title.length > 60 ? f.title.slice(0, 58) + '…' : f.title)}</span>`, v: `${f.sp - f.done} SP open` }))) +
      `<div class="rowf mt-10" ><a class="btn sm pri" href="#/release/readiness">Is it ready?</a><a class="btn sm" href="#/release/R2026.12">Open release 2026.12</a></div>`;

    return {
      lede: `Every release of the team with what it brought afterwards. Window: ${ctx.pick({ pi: 'PI 26.4 and the month before', quarter: 'Q4 2026 and the month before' })}; the table holds all seven fix versions.`,
      acts: K.extLink('Fix versions in Jira', 'Jira'),
      kpis: [
        { l: 'Next release', v: 11, u: 'working days', s: '<b>Thu 03.12</b> · release 2026.12', tone: 'watch', to: '#/release/R2026.12' },
        { l: 'Code freeze', v: 7, u: 'working days', s: 'Fri 27.11', tone: 'watch' },
        { l: 'Production deployments', v: D.dora.deploys30, u: 'in 30 days', s: '30.10, 10.11, 13.11', to: '#/release/performance' },
        { l: 'Needed a fix', v: D.dora.cfr[0] + ' of ' + D.dora.cfr[1], u: 'last deployments', s: '<b>release 2026.11</b>', tone: 'bad', ev: 'dora.cfr' },
        { l: 'Next release done', v: NEXT.issuesDone + ' of ' + NEXT.issues, u: 'issues', s: '<b>12 open</b>, 2 blocked', tone: 'watch', to: '#/release/readiness' }
      ],
      body: K.grid(
        K.panel({ title: 'Releases on the line', sub: 'September to January · bar height: issues in the release', w: 'c8 x6', src: ['jira', 'increp'], body: tl,
          help: 'Each bar is a release: its date and how many issues its fix version holds. The marks below the line are incidents. Hover a bar or a mark for details.' }),
        K.panel({ title: 'Next dates', w: 'c4 x3', src: ['jira'], body: dates }),
        K.panel({ title: 'In the next release', sub: '4 features', w: 'c4 x3', src: ['jira'], right: verdictPill(NEXT), body: nxt }),
        K.panel({ title: 'All releases', sub: 'fix versions of project KES · click a row', w: 'c8 x8', src: ['jira'], flush: true, body: table }),
        K.panel({ title: 'What each release brought', sub: 'after it reached production', w: 'c12 x4', src: ['jira', 'increp'], ev: 'dora.cfr', body: brought, isNew: true,
          help: 'A bug counts when it was written with "found in: production" after the release and on one of its applications. An incident counts when it started within 7 days on an application the release deployed.' })
      )
    };
  }

  /* ── Readiness ────────────────────────────────────────────────────────── */
  function readinessPage() {
    const summary = K.note(`<b>${ckCount('ok')} passed, ${ckCount('watch')} need a look, ${ckCount('bad')} failed.</b> This is what code can check. Whether release 2026.12 goes or not stays with people: the product owner and the application manager.`, ckTone());
    const countdown = K.hbars([
      { n: 'Dry run on INT', v: 2, max: 11, cls: 's1', label: '2 d' }, { n: 'Sign-off on INT', v: 6, max: 11, cls: 's1', label: '6 d' },
      { n: 'Code freeze', v: 7, max: 11, cls: 'watch', label: '7 d' }, { n: 'Production', v: 11, max: 11, cls: 's1', label: '11 d' }
    ], { max: 11, nw: 110, vw: 34 }) + K.feed([
      { t: 'Fri 20.11', tone: 'watch', html: `<b>Dry run</b> of the migration on INT`, sub: `${K.key('KES-4160')} · risk R-4 · in 2 working days` },
      { t: 'Tue 24.11', tone: 'bad', html: '<b>Decision D-2</b> is due', sub: 'ship without the school price tiers, or move the release' },
      { t: 'Thu 26.11', tone: 'watch', html: '<b>Sign-off on INT</b> by the product owner', sub: 'one working day before the freeze · risk R-6' },
      { t: 'Fri 27.11', tone: 'bad', html: '<b>Code freeze</b>', sub: 'what is not on main by then waits for 2027.01' },
      { t: 'Thu 03.12', tone: '', html: '<b>Deployment to production</b> at 06:00', sub: 'four applications · change marker in monitoring' }
    ]);
    const risks = K.list(['R-1', 'R-3', 'R-4', 'R-6'].map(id => D.risks.find(r => r.id === id)).map(r => ({
      tone: r.level, html: `<button class="key" data-dr="risk:${r.id}">${r.id}</button> ${esc(r.title)}`, v: K.pill(r.roam, r.roam === 'New' ? 'watch' : ''), cite: r.review === 'not set' ? 'no review date' : 'review ' + r.review
    })));
    return {
      lede: 'Is release 2026.12 ready for Thu 03.12? Eight checks the app can read, the scope that is still open, and what has to happen before the code freeze.',
      acts: K.extLink('Release notes in the wiki', 'Wiki'),
      kpis: nextKpis(),
      body: K.grid(
        K.panel({ title: 'Readiness checks', sub: 'release 2026.12 · each check links to its detail', w: 'c7 x4', src: ['jira', 'ci', 'testrep', 'wiki', 'mon'], body: checks(false) + '<div class="mt-8">' + summary + '</div>',
          help: 'Each check reads one source and names it. A check is a reading of the data, not an approval.' }),
        K.panel({ title: 'Decision waiting', w: 'c5 x3', src: ['jira', 'wiki'], right: K.pill('due Tue 24.11', 'bad'), body: K.dec(D.decisions.find(d => d.id === 'D-2')) +
          K.note(`${K.key('KES-3318')} has to be live for the Winter sale on 13.12. The fallback of ${'<button class="key" data-dr="risk:R-1">R-1</button>'}: ship the price tiers as static data for the first two weeks.`, 'watch') }),
        K.panel({ title: 'Scope by feature', sub: 'story points of the four features in the fix version', w: 'c7 x5', src: ['jira'], body: scopeBars() +
          K.note(`The release holds <b>${relSp} SP</b>: ${relDone} done, <b>${relOpenSp} open</b>. ${relSprintSp} of them sit in sprint 42, which ends with the freeze. ${K.key('KES-3325')} has 5 SP planned for 43, after the freeze.`, 'bad') }),
        K.panel({ title: 'Countdown', sub: 'working days from today', w: 'c5 x3', src: ['jira', 'wiki'], body: countdown }),
        K.panel({ title: 'Risks that name the release', w: 'c4 x3', src: ['wiki'], body: risks }),
        K.panel({ title: 'Open issues of the release', sub: '12: the open sprint issues of its features and two bugs', w: 'c8 x6', src: ['jira', 'git'], flush: true, right: K.pill('2 blocked', 'bad'),
          body: K.issueTable(relOpen.slice().sort((a, b) => (b.st === 'blocked') - (a.st === 'blocked') || b.dis - a.dis), { hide: ['Type', 'Sprint no.', 'Pull request'] }) })
      )
    };
  }

  /* ── Environments ─────────────────────────────────────────────────────── */
  const FEED = [
    ['Wed 18.11', '10:58', 'checkout-api', '2026.12.0-rc4', ['dev'], ''],
    ['Wed 18.11', '09:20', 'carrier-export', '2026.12.0-rc3', ['dev', 'test'], ''],
    ['Tue 17.11', '15:10', 'checkout-web', '2026.12.0-rc3', ['dev'], ''],
    ['Tue 17.11', '11:30', 'checkout-api', '2026.12.0-rc3', ['test'], ''],
    ['Mon 16.11', '14:05', 'pricing-engine', '2026.12.0-rc2', ['dev'], 'last green build before main turned red on 17.11'],
    ['Mon 16.11', '10:15', 'checkout-web', '2026.12.0-rc2', ['test'], ''],
    ['Mon 16.11', '08:40', 'three applications', '2026.12.0-rc1', ['int'], 'checkout-web, checkout-api, carrier-export'],
    ['Fri 13.11', '14:20', 'checkout-api', '2026.11.1', ['prod'], 'hotfix for INC-2291'],
    ['Fri 13.11', '11:05', 'checkout-api', '2026.11.1', ['int'], 'smoke test 46 of 46'],
    ['Tue 10.11', '06:00', 'four applications', '2026.11.0', ['prod'], 'release 2026.11']
  ];
  function environmentsPage() {
    const feed = K.feed(FEED.map(f => ({
      t: f[0], tone: f[4][0] === 'prod' ? 'ok' : '',
      html: `${D.envMatrix[f[2]] ? K.svc(f[2]) : esc(f[2])} ${D.envMatrix[f[2]] ? `<button class="key" data-dr="deploy:${f[2]}|${f[4][f[4].length - 1]}">${esc(f[3])}</button>` : `<b>${esc(f[3])}</b>`} to <b>${f[4].map(e => ENV[e]).join(' and ')}</b>`,
      sub: f[1] + (f[5] ? ' · ' + esc(f[5]) : '')
    })));
    const rcBehind = svc => { const m = D.envMatrix[svc], rc = v => v.indexOf('-rc') > 0 ? +v.split('-rc')[1] : 0; return rc(m[0]) && rc(m[2]) ? rc(m[0]) - rc(m[2]) : null; };
    const drift = K.table([
      { h: 'Application', cls: 's', v: r => K.svc(r) },
      { h: 'Production', cls: 's', v: r => `<span class="mono">${esc(D.envMatrix[r][3])}</span>` },
      { h: 'INT', cls: 's', v: r => `<span class="mono">${esc(D.envMatrix[r][2])}</span>` },
      { h: 'INT ahead', cls: 's', tip: 'Releases between production and INT', v: r => ({ 'carrier-export': '<b class="ink">2 releases</b>', 'pricing-engine': '<span class="c-watch">none yet</span>', 'order-mail': '<span class="faint">none, no change</span>' }[r] || '1 release') },
      { h: 'DEV ahead', n: true, v: r => rcBehind(r) == null ? '<span class="faint">–</span>' : rcBehind(r) + ' rc', tip: 'Release candidates built since the one on INT' },
      { h: 'Why', v: r => `<span class="dim">${esc({ 'carrier-export': 'skipped 2026.11 on purpose', 'pricing-engine': 'candidate waits for a green main', 'order-mail': 'ships nothing in 2026.12', 'checkout-api': 'production has the hotfix' }[r] || 'as planned')}</span>` }
    ], ALL);
    const hot = DEP['checkout-api|prod'];
    const contained = `<div class="cols2"><div>${K.sect('Hotfix 2026.11.1', 'checkout-api · by ticket')}${K.issueTable([K.issue('KES-4188')], { hide: ['Sprint no.', 'Days in status', 'Pull request', 'Application'] })}
      ${K.kv([['Version before', '<span class="mono">2026.11.0</span>'], ['Pipeline run', `<span class="mono">checkout-api » deploy-prod #${hot[1]}</span>`], ['Deployed', esc(hot[0])], ['Fixes', K.key('INC-2291')]])}</div>
      <div>${K.sect('How it got there')}${K.feed(PATH['R2026.11.1'].map(p => ({ t: p[0], tone: p[2], html: esc(p[1]) })))}
      <div class="rowf mt-8" ><button class="btn sm" data-dr="deploy:checkout-api|prod">Open the deployment</button>${K.extLink('Run in the build server', 'Build server')}</div></div></div>`;
    return {
      lede: 'What runs where now: five applications in four environments, read from the deployment jobs in the build server. Click a cell for its deployment.',
      kpis: [
        { l: 'Applications', v: ALL.length, s: '4 ship in 2026.12' },
        { l: 'Environments', v: D.envs.length, s: 'DEV, TEST, INT, PROD' },
        { l: 'Ready on INT', v: '4 of 5', s: 'release candidate, or nothing to ship', tone: 'watch' },
        { l: 'Behind on INT', v: 1, u: 'application', s: '<b>pricing-engine</b> still 2026.11.0', tone: 'watch' },
        { l: 'Last to production', v: '13.11', u: '14:20', s: 'hotfix 2026.11.1', to: '#/release/R2026.11.1' }
      ],
      body: K.grid(
        K.panel({ title: 'Applications by environment', sub: 'version and date of the last deployment', w: 'c8 x5', src: ['ci', 'catalog'], body: matrix(ALL) + matrixLegend(),
          help: 'Each cell is the version the deployment job last put into that environment. Amber: behind what release 2026.12 needs. Red: the build of main that feeds it is red.' }),
        K.panel({ title: 'What each environment is for', w: 'c4 x3', src: ['catalog'], body: K.kv([
          ['DEV', 'every green build of main, several times a day'], ['TEST', 'release candidates; the nightly regression runs here at 01:30'],
          ['INT', 'the release candidate with carrier systems; smoke test and sign-off by the product owner'], ['PROD', 'release train at 06:00 on the release day; patches in the day']]) +
          K.note('pricing-engine cannot get a candidate on INT while its main is red (contract test against the price feed v3, since 17.11 16:40).', 'bad') }),
        K.panel({ title: 'Last deployments', sub: '10 most recent, all environments', w: 'c4 x4', src: ['ci'], body: feed }),
        K.panel({ title: 'Drift', sub: 'production against INT', w: 'c8 x6', src: ['ci'], flush: true, body: drift + `<div class="pd-8-14-0">${K.note('carrier-export in production is <b>2026.10.2</b>, the patch of 30.10: two releases behind INT. On purpose: it skipped 2026.11 and ships with 2026.12.', '')}</div><div class="pd-4-14-0">${K.sect('Release candidates built since the one on INT')}${K.hbars(ALL.filter(a => rcBehind(a) != null).map(a => ({ n: K.svc(a), v: rcBehind(a), max: 4, cls: 's1', label: rcBehind(a) + ' rc' })).concat([{ n: K.svc('pricing-engine'), v: 0, max: 4, cls: 'watch', label: '<span class="c-watch">none on INT</span>' }]), { max: 4, nw: 170, vw: 90 })}</div>` }),
        K.panel({ title: 'What a deployment contained', sub: 'by ticket, never by author', w: 'c12 x6', src: ['ci', 'jira'], body: contained })
      )
    };
  }

  /* ── Delivery performance ─────────────────────────────────────────────── */
  function performancePage(ctx) {
    const base = '2026-08-10', x = d => K.day(d) - K.day(base), end = x('2026-11-20');
    const prod = D.releases.filter(r => r.state === 'prod');
    const deploys = K.chart({
      label: 'Production deployments', w: 560, h: 210, x: [0, end], y: [0, 30], yt: [0, 10, 20, 30],
      xt: [['2026-08-13', '13.08'], ['2026-09-10', '10.09'], ['2026-10-08', '08.10'], ['2026-11-10', '10.11'], ['2026-11-18', 'today']].map(t => [x(t[0]), t[1]]),
      areas: [{ pts: [[x('2026-10-19'), 0, 30], [x('2026-11-18'), 0, 30]], color: 'faint', op: .08, tip: 'The last 30 days: 3 deployments' }],
      bars: prod.map(r => ({ x: x(r.day), w: 2, y1: Math.max(r.issues, .6), color: r.verdict === 'bad' ? 'bad' : r.issues > 3 ? 's1' : 's3',
        tip: `${r.name} · ${r.date}<small>${r.issues} issue${r.issues > 1 ? 's' : ''} · ${VERDICT[r.verdict]}</small>` })),
      vmarks: [{ x: x('2026-11-18'), color: 'ink', dash: false }, { x: x('2026-10-19'), color: 'faint', label: '30 days', tip: 'From 19.10: 30 days back' }]
    }) + K.legend([['release train, height: issues', 'bg-s1'], ['patch or hotfix', 'bg-s3'], ['needed a fix', 'bg-bad']]);
    const lead = [['Coding', 2.1, 'bg-r1'], ['Review', 1.3, 'bg-r2'], ['Waiting for the release train', 6.9, 'bg-r4'], ['Deployment', 0.7, 'bg-r5']];
    const LT = [['2026.06', 43], ['2026.07', 11.7], ['2026.08', 40], ['2026.09', 10.8], ['2026.10', 11.4], ['2026.11', 11.0]];
    const trend = K.chart({
      label: 'Lead time per release', w: 560, h: 200, x: [-.4, 5.4], y: [0, 16], yt: [0, 4, 8, 12, 16], yu: ' d',
      xt: LT.map((v, i) => [i, v[0]]),
      hlines: [{ y: 11, color: 'faint', dash: true, label: 'now 11 days', left: true }],
      lines: [{ pts: LT.map((v, i) => [i, v[1]]), color: 's1', end: true, tip: (i, y) => `Release ${LT[i][0]}: half of its changes took at most ${y} days` }]
    });
    const last6 = prod.slice(0, 6);
    const cfr = K.list(last6.map(r => ({ tone: r.verdict, html: `${K.key(r.id)} <span class="ttl-t">${esc(r.name)}</span>`, v: verdictPill(r), cite: r.date.slice(4, 9) }))) +
      K.note(`${K.key('R2026.11')} was followed by ${K.key('INC-2291')} (P2) two days later on checkout-api. Fixed by hotfix 2026.11.1, which counts as its own deployment.`, 'bad');
    const restore = K.feed([
      { t: '07:41', tone: 'bad', html: 'First errors: <span class="mono">HikariPool-1: Connection is not available</span>', sub: 'Monitoring error group' },
      { t: '07:42', tone: 'bad', html: `${K.key('INC-2291')} opened, P2`, sub: 'alert on the availability service level' },
      { t: '07:50', tone: 'watch', html: 'On-call acknowledged', sub: 'report of the incident agent: cause "connections not released", high confidence' },
      { t: '08:08', tone: 'ok', html: '<b>Restored</b>: pods restarted, orders possible again', sub: '26 minutes after the first error' },
      { t: '13.11', tone: 'ok', html: `Hotfix 2026.11.1 with ${K.key('KES-4188')} in production at 14:20`, sub: 'the fix of the cause, a day later' }
    ]) + K.note('One incident of P2 or higher in 90 days: the 26 minutes are that one value, not a typical one.', '');
    return {
      lede: `The four keys of delivery for the team, ${ctx.pick({ pi: 'PI 26.4 so far', quarter: 'the last 90 days' })}. They describe how changes arrive in production, not how much the team works.`,
      kpis: [
        { l: 'Production deployments', v: D.dora.deploys30, u: 'in 30 days', s: '30.10, 10.11, 13.11' },
        { l: 'Lead time for changes', v: D.dora.leadDays, u: 'days', s: 'half of the changes · <b>6.9 d</b> waiting', tone: 'watch' },
        { l: 'Changes that needed a fix', v: D.dora.cfr[0] + ' of ' + D.dora.cfr[1], u: 'deployments', s: '<b>release 2026.11</b>', tone: 'bad', ev: 'dora.cfr' },
        { l: 'Time to restore', v: 26, u: 'min', s: 'one incident of P2 or higher', to: '#/incident/INC-2291' },
        { l: 'Waiting for the train', v: K.pct(6.9, 11), u: '% of lead time', s: 'between merge and release', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Deployments to production', sub: 'one release train a month plus patches', w: 'c6 x4', src: ['ci'], body: deploys,
          help: 'Every run of a deploy-prod job that ended with success. Bar height: the issues of its fix version.' }),
        K.panel({ title: 'Lead time for changes', sub: 'days from the first commit to production · median of the last 90 days', w: 'c6 x4', src: ['git', 'ci'],
          body: K.stackbar(lead, { unit: 'days', h: 16 }) + `<div class="rl-sum">= <b>11.0 days</b> for half of the changes</div>` +
            K.kv([['From', 'the first commit of a merged pull request'], ['To', 'the deploy-prod run that carried it'], ['Window', 'changes deployed in the last 90 days, trains and patches']]) + '<div class="mt-10"></div>' + K.note('More than half of the lead time is waiting: a change that is merged on day 3 waits <b>6.9 days</b> for the next release train. A shorter train cycle would cut it; the coding part is short already.', 'watch') }),
        K.panel({ title: 'Lead time per release', sub: 'median days, release trains only', w: 'c6 x4', src: ['git', 'ci'], body: trend + K.note('Between 10.8 and 12.4 days for six releases: steady.', '') }),
        K.panel({ title: 'Changes that needed a fix', sub: 'the last 6 production deployments', w: 'c6 x4', src: ['ci', 'increp'], ev: 'dora.cfr', right: K.pill('1 of 6', 'bad'), body: cfr }),
        K.panel({ title: 'Time to restore', sub: 'INC-2291 on Thu 12.11', w: 'c6 x4', src: ['increp', 'mon'], body: restore }),
        K.panel({ title: 'What these numbers are not', w: 'c6 x4', src: ['ci'], body: K.list([
          { tone: '', html: '<b>No comparison with other teams.</b> Teams ship different applications on different trains; the app shows this team against its own past.' },
          { tone: '', html: '<b>No target on a count.</b> More deployments are not better by themselves; a target on them makes teams split releases.' },
          { tone: '', html: '<b>No person.</b> Commits and deployments are counted for the team; who wrote or deployed what is not read.' },
          { tone: '', html: '<b>Small numbers.</b> 6 deployments and 1 incident: one event moves every key a lot.' }
        ]) })
      )
    };
  }

  /* ── entity: release ──────────────────────────────────────────────────── */
  function baTable(r) {
    const rows = BA[r.id] || [];
    const ch = (a, b, unit, dec, upBad) => {
      if (a == null) return '';
      const d = b - a, rel = a ? d / a : 0, tone = Math.abs(rel) < .1 ? 'faint' : (d > 0) === upBad ? 'c-bad' : 'c-ok';
      return `${a.toFixed(dec)} → <b class="ink">${b.toFixed(dec)}</b>${unit} <span class="${tone}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(dec)}</span>`;
    };
    return K.table([
      { h: 'Application', cls: 's', v: x => K.svc(x[0]) },
      { h: 'Error rate', cls: 's', v: x => x[1] == null ? '<span class="faint">–</span>' : ch(x[1], x[2], ' %', 2, true) },
      { h: 'Response time p95', cls: 's', v: x => x[3] == null ? '<span class="faint">–</span>' : ch(x[3], x[4], ' ms', 0, true) },
      { h: 'Throughput', cls: 's', v: x => x[5] == null ? '<span class="faint">–</span>' : ch(x[5], x[6], ' rpm', 0, false) },
      { h: 'Later within 7 days', v: x => x[7] ? `<span class="dim">${x[7]}</span>` : '<span class="faint">calm</span>' }
    ], rows);
  }

  function plannedBody(r) {
    const bySvc = {};
    relOpen.forEach(i => { bySvc[i.svc] = bySvc[i.svc] || [0, 0]; bySvc[i.svc][0]++; bySvc[i.svc][1] += i.sp || 0; });
    const apps = K.hbars(APPS[r.id].map(s => ({ n: K.svc(s), v: (bySvc[s] || [0])[0], max: 6, cls: s === 'pricing-engine' ? 'bad' : 's1', label: `${(bySvc[s] || [0])[0]}<span class="faint"> · ${(bySvc[s] || [0, 0])[1]} SP</span>` })), { max: 6, nw: 150, vw: 64 }) +
      K.note('Open issues by application. pricing-engine carries the blocked story and a red main.', 'bad');
    return {
      lede: `Planned for ${r.date}, code freeze ${r.freeze}. The go or no-go is decided by people; the app shows what it can read.`,
      kpis: nextKpis(),
      body: K.grid(
        K.panel({ title: 'Scope by feature', sub: 'story points', w: 'c7 x4', src: ['jira'], body: scopeBars() +
          K.note(`<b>${relSp} SP</b> in four features: ${relDone} done, <b>${relOpenSp} open</b>. ${K.key('KES-3318')} carries the Winter sale and has 16 SP open, 5 of them blocked by another team.`, 'bad') }),
        K.panel({ title: 'Readiness', sub: `${ckCount('ok')} of ${D.readiness.length} passed`, w: 'c5 x4', src: ['jira', 'ci', 'testrep', 'wiki', 'mon'], body: checks(true) +
          `<div class="rowf mt-8" ><a class="btn sm pri" href="#/release/readiness">Open the full readiness</a></div>` }),
        K.panel({ title: 'Scope by application', sub: 'open issues and story points', w: 'c5 x4', src: ['jira'], body: apps }),
        K.panel({ title: 'Environments for this release', sub: 'the four applications it ships', w: 'c7 x5', src: ['ci'], body: matrix(APPS[r.id]) + matrixLegend() +
          `<div class="rowf mt-8" ><a class="btn sm" href="#/release/environments">All environments</a></div>` }),
        K.panel({ title: 'Open issues', sub: '12 of 31', w: 'c12 x7', src: ['jira', 'git'], flush: true, body: K.issueTable(relOpen, { hide: ['Type'] }) })
      )
    };
  }

  function prodBody(r) {
    const inc = incAfter(r), bugs = BUGS[r.id] || [], c = CONTENT[r.id], t = TESTS[r.id], p2 = inc.filter(i => i.prio === 'P2' || i.prio === 'P1');
    const incBody = inc.length ? K.list(inc.map(i => ({ tone: i.prio === 'P2' ? 'bad' : 'watch', html: `${K.key(i.id)} ${esc(i.title)}`, v: i.prio, cite: i.at.slice(4, 9) + ' · ' + i.dur }))) +
      (p2.length ? '' : K.note('A P3 with another cause: it does not count as a change that needed a fix.', '')) : null;
    const bugBody = bugs.length ? K.list(bugs.map(b => ({ tone: b[3] === 'done' ? 'ok' : 'watch', html: anyKey(b[0], TITLES[b[0]] || (K.issue(b[0]) || {}).title), v: K.pill(b[1], b[1] === 'Critical' ? 'bad' : ''), cite: b[2] }))) : null;
    const contained = K.stackbar(c.types.map((x, i) => [x[0], x[1], ['bg-r3', 'bg-s2', 'bg-r5'][i]]), { unit: 'issues', h: 12 }) + K.sect('Examples', `${c.keys.length} of ${r.issues}`) +
      K.list(c.keys.map(k => ({ tone: '', html: anyKey(k[0], k[1] || (K.issue(k[0]) || {}).title), v: `<span class="faint">${esc(k[2])}</span>` })));
    return {
      lede: `In production since ${r.date}. ${r.note ? esc(r.note) + '.' : 'What changed around it and what it brought afterwards.'}`,
      kpis: [
        { l: 'Issues', v: r.issuesDone + ' of ' + r.issues, s: 'done when it shipped', tone: 'ok' },
        { l: 'Applications', v: APPS[r.id].length, s: APPS[r.id].length === 1 ? APPS[r.id][0] : 'deployed together' },
        { l: 'Incidents within 7 days', v: p2.length, u: 'P2 or higher', s: inc.length > p2.length ? (inc.length - p2.length) + ' P3 with another cause' : p2.length ? '<b>' + p2[0].id + '</b> after 2 days' : 'none', tone: p2.length ? 'bad' : 'ok' },
        { l: 'Bugs from production', v: bugs.length, u: 'afterwards', s: bugs.length ? bugs.filter(b => b[3] !== 'done').length + ' still open' : 'none', tone: bugs.length > 1 ? 'watch' : '' },
        { l: 'Regression at release', v: t[0], u: '%', s: t[2], tone: t[0] >= 96 ? 'ok' : 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Before and after', sub: '24 hours before and after the change marker, per application', w: 'c8 x6', src: ['mon'], flush: true, body: baTable(r),
          help: 'Monitoring sets a change marker when the deploy-prod job finishes. The app compares the golden metrics of the 24 hours on each side. Colour: a change of more than 10 %.' }),
        K.panel({ title: 'Incidents within 7 days', sub: 'on its applications', w: 'c4 x3', src: ['increp'], body: incBody || '',
          state: incBody ? null : 'empty', empty: { title: 'No incident within 7 days', text: 'No incident started on an application of this release in the 7 days after it.' } }),
        K.panel({ title: 'Bugs found in production afterwards', w: 'c4 x3', src: ['jira'], body: bugBody || '',
          state: bugBody ? null : 'empty', empty: { title: 'No bug from production', text: 'No bug was written with "found in: production" on its applications after this release.' } }),
        K.panel({ title: 'What it contained', sub: `${r.issues} issue${r.issues > 1 ? 's' : ''}, by ticket`, w: 'c8 x6', src: ['jira'], body: contained }),
        K.panel({ title: 'Tests at release time', w: 'c6 x3', src: ['testrep'], body: K.kv([['Nightly regression', `<b class="ink">${t[0]} %</b> · ${t[1]} passed · ${esc(t[2])}`], ['Smoke test on INT', t[3] + ' passed'], ['Gate', t[0] >= 96 ? 'above 96 %' : '<span class="c-watch">below 96 %: released as a hotfix with a known export failure</span>']]) }),
        K.panel({ title: 'Path to production', w: 'c6 x3', src: ['ci', 'mon'], body: K.feed((PATH[r.id] || []).map(p => ({ t: p[0], tone: p[2], html: esc(p[1]) }))) })
      )
    };
  }

  SM.entity({
    kind: 'release', title: 'Releases', domain: 'release', list: '#/release/calendar', hz: ['sprint', 'pi'], was: 'new', from: '',
    ids: () => D.releases.map(r => r.id),
    render(id) {
      const r = K.release(id), planned = r.state === 'planned';
      const res = planned ? plannedBody(r) : prodBody(r);
      const head = K.ehead({
        kind: `Release ${statePill(r)} ${verdictPill(r)}`, title: r.name,
        facts: [`<b>${esc(r.date)}</b>`].concat(planned ? [`freeze <b>${esc(r.freeze)}</b>`] : [])
          .concat([`<b>${r.issuesDone} of ${r.issues}</b> issues done`, r.feats.length ? 'features ' + K.keys(r.feats) : `${APPS[r.id].length} application${APPS[r.id].length > 1 ? 's' : ''}`]),
        links: [K.extLink('Fix version in Jira', 'Jira'), K.extLink('Release notes in the wiki', 'Wiki'), K.extLink('Pipelines in the build server', 'Build server')]
      });
      return { lede: res.lede, body: head + K.kpis(res.kpis) + res.body };
    }
  });

  SM.drawer('deploy', function (key) {
    const p = key.split('|'), svc = p[0], env = p[1];
    if (!D.envMatrix[svc] || D.envs.indexOf(env) < 0) return null;
    const v = D.envMatrix[svc][D.envs.indexOf(env)], d = DEP[key] || ['–', 0, '–', []];
    const red = isRed(svc, env), behind = isBehind(svc, env);
    return {
      kind: 'Deployment · ' + ENV[env], title: `${svc} ${v} on ${ENV[env]}`,
      body: K.kv([['Version', `<span class="mono">${esc(v)}</span>`], ['Deployed', esc(d[0])], ['Pipeline run', `<span class="mono">${esc(svc)} » deploy-${env} #${d[1]}</span>`], ['Version before', `<span class="mono">${esc(d[2])}</span>`], ['Source', K.srcChip('ci')]]) +
        (red ? '<div class="mt-10">' + K.note('Main of this repository is red since 17.11 16:40: the contract test against the price feed v3 fails. No newer build reaches this environment until it is green.', 'bad') + '</div>' : '') +
        (behind ? '<div class="mt-10">' + K.note('Release 2026.12 needs a release candidate here. The candidate waits for a green main.', 'watch') + '</div>' : '') +
        K.sect('What changed against ' + d[2], 'by ticket') +
        (d[3].length ? K.list(d[3].map(k => ({ tone: (K.issue(k) || {}).st === 'done' ? 'ok' : '', html: anyKey(k, TITLES[k] || (K.issue(k) || {}).title), v: K.issue(k) ? K.status(K.issue(k).st) : '' }))) : '') +
        (d[4] ? `<p class="dim fs-12 mt-6" >${esc(d[4])}</p>` : '') +
        `<div class="rowf mt-14" ><a class="btn sm" href="#/release/environments">All environments</a>${K.extLink('Open the run in the build server', 'Build server')}</div>`
    };
  });

  SM.domain({
    id: 'release', title: 'Release', icon: 'release',
    pages: [
      { id: 'calendar', title: 'Releases', hz: ['pi', 'quarter'], was: 'new', from: 'Quality (What each release brought, was not connected)', find: 'release calendar fix versions train hotfix patch', render: calendarPage },
      { id: 'readiness', title: 'Readiness', hz: ['sprint'], was: 'new', from: '', find: 'release readiness go no-go checklist code freeze', render: readinessPage },
      { id: 'environments', title: 'Environments', hz: ['today'], was: 'new', from: '', find: 'environments versions dev test int prod drift deployments', render: environmentsPage },
      { id: 'performance', title: 'Delivery performance', hz: ['pi', 'quarter'], was: 'new', from: '', find: 'dora deployment frequency lead time change failure restore', render: performancePage }
    ]
  });
})();
