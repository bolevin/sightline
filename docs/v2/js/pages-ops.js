/* Domain: Operations. Running the applications: health, service levels, incidents, errors, requests that reach the team.
   Sources: Monitoring, Log search (stale in this data set), Incident reports, Service catalogue, Jira. Read only: nothing here acknowledges, mutes or assigns. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;

  /* ── lookups and detail that only these pages need (adds up to data.js) ── */
  const NOW = Date.UTC(2026, 10, 18, 11, 48);
  const ago = s => { const m = s.match(/(\d\d)\.(\d\d)(?: (\d\d):(\d\d))?/); return (NOW - Date.UTC(2026, +m[2] - 1, +m[1], +(m[3] || 0), +(m[4] || 0))) / 36e5; };
  const sloOf = id => D.slos.find(s => s.svc === id);
  const alertsOf = id => D.alerts.filter(a => a.svc === id);
  const incOf = id => D.incidents.filter(i => i.svc === id);
  const bugsOf = id => D.bugs.openList.filter(b => b.svc === id);
  const errsOf = id => D.errors.filter(e => e.svc === id);
  const repo = id => K.service(id).repo.split('/')[1];
  const tone = st => K.toneOf(st);
  const budTone = s => s.left <= 0 ? 'bad' : s.left < 35 ? 'watch' : 'ok';
  const bud = s => `<span class="ops-bud"><span class="tr"><i class="${budTone(s)}" style="width:${Math.max(0, s.left)}%"></i></span>${s.left < 0 ? '<span class="c-bad">spent</span>' : s.left + ' %'}</span>`;
  const dash = '<span class="faint">–</span>';

  /* production deployments per application, newest first (versions and dates of D.releases and D.services) */
  const DEPLOYS = {
    'checkout-web': [['2026.11.0', '10.11 06:40', 'R2026.11'], ['2026.10.0', '08.10 06:35', 'R2026.10'], ['2026.09.0', '10.09 06:30', 'R2026.09']],
    'checkout-api': [['2026.11.1', '13.11 14:30', 'R2026.11.1'], ['2026.11.0', '10.11 06:45', 'R2026.11'], ['2026.10.0', '08.10 06:40', 'R2026.10']],
    'pricing-engine': [['2026.11.0', '10.11 06:50', 'R2026.11'], ['2026.10.0', '08.10 06:45', 'R2026.10'], ['2026.09.0', '10.09 06:40', 'R2026.09']],
    'carrier-export': [['2026.10.2', '30.10 10:15', 'R2026.10.2'], ['2026.10.0', '08.10 06:50', 'R2026.10'], ['2026.09.0', '10.09 06:45', 'R2026.09']],
    'order-mail': [['2026.11.0', '10.11 06:55', 'R2026.11'], ['2026.10.0', '08.10 06:55', 'R2026.10'], ['2026.08.0', '13.08 06:40', 'R2026.08']]
  };
  /* error rate and p95 one day before and one day after the last deployment */
  const BA = {
    'checkout-web': { err: [0.3, 0.3], p95: [805, 820] },
    'checkout-api': { err: [0.14, 0.12], p95: [240, 210] },
    'pricing-engine': { err: [0.4, 0.4], p95: [290, 285] },
    'carrier-export': { end: ['04:08', '04:05'], dur: ['2 h 08 min', '2 h 05 min'] },
    'order-mail': { err: [0.4, 0.4], p95: [150, 150] }
  };

  /* the 30 nights of the export, 20.10 to 18.11: end time in hours; a missed night gave up at 05:00 */
  const MISSED = ['29.10', '05.11', '17.11'];
  const NIGHTS = (function () {
    const out = [], ends = [4.1, 3.9, 4.3, 4.0, 3.8, 4.2, 4.4, 3.9, 4.1, 0, 4.0, 4.2, 3.7, 4.1, 4.3, 4.0, 0, 3.9, 4.2, 4.1, 3.8, 4.4, 4.0, 4.1, 3.9, 4.2, 4.0, 4.3, 0, 4.2];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 9, 20 + i)), dm = String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0');
      const miss = MISSED.indexOf(dm) >= 0, end = miss ? 5 : ends[i];
      out.push({ i, dm, miss, end, dur: Math.round((end - 2) * 60), sent: miss ? 0 : 3700 + Math.round(((i * 37) % 23) * 11), timeouts: miss ? (dm === '17.11' ? 412 : dm === '05.11' ? 398 : 405) : i >= 23 ? 0 : (i * 7) % 5 });
    }
    return out;
  })();
  const hm = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');

  /* a small deterministic generator for the golden metrics: the last point equals the number in D.services */
  function prof(h) { h = ((h % 24) + 24) % 24; return h < 5 || h > 23 ? 0.12 : 0.12 + 0.88 * Math.pow(Math.sin(Math.PI * (h - 5) / 18), 0.7); }
  function series(s, metric, hours, step) {
    const n = Math.round(hours / step), pts = [];
    let seed = (s.id.length * 977 + metric.length * 131) % 2147483647;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const res = s.id === 'checkout-api', tar = s.id === 'pricing-engine';
    const inc0 = ago('12.11 07:42'), inc1 = ago('12.11 08:08'), fix = ago('13.11 14:30'), up = ago('17.11 21:12');
    for (let k = n; k >= 0; k--) {
      const t = -k * step, a = -t, hod = 11.8 + t, r = rnd() - 0.5, p = prof(hod) / prof(11.8);
      const inInc = res && a <= inc0 && a >= inc1, beforeFix = res && a > fix, afterUp = tar && a <= up;
      let v;
      if (metric === 'rpm') v = s.rpm * p * (1 + 0.08 * r) * (inInc ? 0.55 : 1);
      else if (metric === 'p95') v = (beforeFix ? 240 : tar ? (afterUp ? 340 : 285) : s.p95) * (1 + 0.12 * (p - 0.5) + 0.06 * r) * (inInc ? 9 : 1);
      else if (metric === 'err') v = inInc ? 38 : (beforeFix ? 0.14 : tar ? (afterUp ? 1.8 : 0.4) : s.err) * (1 + 0.25 * r);
      else v = inInc ? 0.31 : Math.min(1, (tar ? (afterUp ? 0.91 : 0.95) : s.apdex) + 0.012 * r);
      pts.push([t, v]);
    }
    pts[pts.length - 1][1] = s[metric];
    return pts;
  }
  function nice(x) { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  const METRICS = [
    ['rpm', 'Throughput', 'requests per minute', 's1', v => K.fmt(Math.round(v)) + ' rpm'],
    ['p95', 'Response time p95', 'milliseconds', 's1', v => Math.round(v) + ' ms'],
    ['err', 'Error rate', '% of requests', 'bad', v => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' %'],
    ['apdex', 'Apdex', '0 to 1, target 0.85', 's1', v => v.toFixed(2)]
  ];
  function goldenChart(s, m, hz) {
    const hours = hz === 'today' ? 24 : 168, step = hz === 'today' ? 0.25 : 1, pts = series(s, m[0], hours, step);
    const vals = pts.map(p => p[1]), top = Math.max.apply(null, vals);
    let mn = 0, mx, yt;
    if (m[0] === 'apdex') { mn = Math.floor(Math.min(0.8, Math.min.apply(null, vals) - 0.05) * 10) / 10; mx = 1; yt = [mn, Math.round((mn + 1) * 5) / 10, 1]; }
    else { const st = nice(top / 3); mx = Math.ceil(top * 1.08 / st) * st; yt = []; for (let v = 0; v <= mx + 1e-9; v += st) yt.push(Math.round(v * 100) / 100); }
    const xt = hz === 'today' ? [[-24, '11:48 yesterday'], [-18, '18:00'], [-12, '00:00'], [-6, '06:00'], [0, 'now']]
      : [-156, -132, -108, -84, -60, -36, -12].map(h => { const d = new Date(NOW + h * 36e5); return [h - 0.2, String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0')]; });
    const marks = DEPLOYS[s.id].filter(d => ago(d[1]) <= hours).map(d => ({ x: -ago(d[1]), color: 'dim', label: d[0], tip: `Deployment ${d[0]} to production, ${d[1]}` }))
      .concat(incOf(s.id).filter(i => ago(i.at.slice(4)) <= hours).map(i => ({ x: -ago(i.at.slice(4)), color: 'bad', label: i.id, left: true, row: 1, tip: `${i.id}: ${i.title}` })))
      .concat(alertsOf(s.id).filter(a => ago(a.since) <= hours).map(a => ({ x: -ago(a.since), color: 'watch', label: '', tip: `Alert since ${a.since}: ${a.text}` })));
    return K.chart({ label: m[1] + ' of ' + s.id, w: 520, h: 170, left: 44, x: [-hours, 0], y: [mn, mx], yt, xt, vmarks: marks,
      lines: [{ pts, color: m[3], w: 1.6, end: true }] });
  }

  /* ── drawers ──────────────────────────────────────────────────────────── */
  const STACK = {
    e1: 'shop.pricing.client.PriceFeedException: 504 Gateway Timeout from upstream /v3/price-tiers\n  at PriceFeedClient.fetchTiers(PriceFeedClient.java:118)\n  at PriceTierCache.load(PriceTierCache.java:64)\n  at PricingService.priceFor(PricingService.java:201)\n  … 41 frames of Spring and Netty left out',
    e2: 'shop.export.CarrierTimeoutException: carrier endpoint did not answer within 30 s\n  at CarrierClient.send(CarrierClient.java:87)\n  at ExportStep.write(ExportStep.java:142)\n  at org.springframework.batch.core.step.item.ChunkOrientedTasklet.execute(…)\n  … 28 frames left out',
    e3: 'java.lang.IllegalStateException: total negative after a partial cancellation\n  at BulkOrder.calculateTotal(BulkOrder.java:233)\n  at PartialCancelService.removeLines(PartialCancelService.java:96)\n  at PartialCancelController.post(PartialCancelController.java:51)\n  … 36 frames left out',
    e4: 'java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30000 ms\n  at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:181)\n  at StockHoldRepository.findByWarehouse(StockHoldRepository.java:44)\n  at OrderService.place(OrderService.java:310)\n  … 52 frames left out',
    e5: 'shop.notify.MailDeliveryException: 451 temporary failure, try again later\n  at SmtpSender.send(SmtpSender.java:72)\n  at NotifyJob.send(NotifyJob.java:58)\n  … 19 frames left out',
    e6: 'TypeError: Cannot read properties of null (reading \'lines\')\n  at StockMapRenderer.render (stock-map-renderer.ts:88)\n  at StockViewComponent.ngOnChanges (stock-view.component.ts:41)\n  … 12 frames of Angular left out'
  };
  const BYVER = { e1: [['2026.11.0', 268]], e2: [['2026.10.2', 412]], e3: [['2026.11.0', 14], ['2026.11.1', 23]], e4: [['2026.11.0', 1904]], e5: [['2026.11.0', 22]], e6: [['2026.11.0', 9]] };
  const ESTATE = { new: 'watch', known: '', resolved: 'ok', regressed: 'bad' };
  SM.drawer('error', function (id) {
    const e = D.errors.find(x => x.id === id); if (!e) return null;
    return { kind: 'Error group · ' + K.svc(e.svc), title: e.cls, body:
      K.kv([['Status', K.pill(e.st, ESTATE[e.st])], ['Events, 24 h', K.fmt(e.n24)], ['Events, 7 days', K.fmt(e.n7) + ' &nbsp;' + K.spark(e.sp, { w: 90, h: 20, color: e.st === 'new' ? 'watch' : 'dim' })], ['First seen', esc(e.first)], ['Last seen', esc(e.last)], ['Issue', e.issue ? K.key(e.issue, { title: true }) : '<span class="c-watch">none linked</span>']]) +
      K.sect('Stack trace', 'shortened; no request data, no customer data') + `<div class="code">${esc(STACK[id])}</div>` +
      K.sect('Events by version', '7 days') + K.hbars(BYVER[id].map(v => ({ n: '<span class="mono">' + v[0] + '</span>', v: v[1], cls: 's1' })), { nw: 90, vw: 50 }) +
      (e.st === 'resolved' ? K.note('Resolved by hotfix 2026.11.1 on 13.11. If an event with the same fingerprint comes back, the group is marked regressed.', 'ok') : '') +
      K.note('The app reads the error class, the counts and the shortened stack trace. It never reads the payload of a request. Log lines from the log search appear on screen only and are kept nowhere.', '') +
      `<div class="rowf mt-12" >${K.extLink('Open in monitoring errors inbox', 'Monitoring')}${K.extLink('Log lines in the log search', 'Log search')}</div>` };
  });

  const SLOX = {
    'slo-api-avail': { sli: 'Share of order requests that do not end with a 5xx answer, counted per minute', unit: 'min', min: '43.2 min', usedTxt: '30.2 min', used: [['INC-2291, 12.11 07:42 to 08:08', 26, 'bad'], ['Short 5xx bursts before 12.11', 4.2, 'watch']], q: "FROM Transaction SELECT percentage(count(*), WHERE httpResponseCode NOT LIKE '5%') WHERE appName = 'checkout-api' SINCE 30 days ago" },
    'slo-web-p95': { sli: '5-minute windows in which 95 % of page loads finished within 1.5 s', unit: 'windows', min: '86 of 8,640 windows', usedTxt: '52 windows', used: [['Morning peak 12.11 07:45, during INC-2291', 21, 'bad'], ['Monday mornings, booking peak', 31, 'watch']], q: "FROM PageView SELECT percentile(duration, 95) WHERE appName = 'checkout-web' TIMESERIES 5 minutes SINCE 30 days ago" },
    'slo-price-avail': { sli: 'Share of price lookups answered without an error', unit: 'min', min: '216 min', usedTxt: '125 min', used: [['Upstream 504 since 17.11 21:12', 91, 'watch'], ['Other errors in the 30 days', 34, 'watch']], q: "FROM Transaction SELECT percentage(count(*), WHERE error IS false) WHERE appName = 'pricing-engine' SINCE 30 days ago" },
    'slo-export-time': { sli: 'Nights in which the export to every carrier finished before 05:00', unit: 'night', min: '2 nights of 30', usedTxt: '3 nights', used: [['29.10, INC-2262', 1, 'bad'], ['05.11, INC-2274', 1, 'bad'], ['17.11, INC-2299', 1, 'bad']], q: "FROM ExportRun SELECT percentage(count(*), WHERE endTime < '05:00') WHERE job = 'carrier-export' SINCE 30 days ago" },
    'slo-notify': { sli: 'Share of e-mails and SMS accepted by the gateway within 10 minutes', unit: 'messages', min: '612 of 61,200 messages', usedTxt: '245 messages', used: [['451 temporary failures of the mail gateway', 220, 'watch'], ['SMS gateway not reachable', 25, 'watch']], q: "FROM Notification SELECT percentage(count(*), WHERE delivered IS true AND delay < 600) SINCE 30 days ago" }
  };
  SM.drawer('slo', function (id) {
    const s = D.slos.find(x => x.id === id), x = SLOX[id]; if (!s) return null;
    return { kind: 'Service level · ' + K.svc(s.svc), title: s.name, body:
      K.kv([['Indicator', esc(x.sli)], ['Target', s.target + ' %'], ['Actual', `<b class="ink">${s.actual} %</b>`], ['Window', esc(s.win) + ', rolling'], ['Error budget', esc(x.min)], ['Used', esc(x.usedTxt) + ' · ' + s.used + ' %'], ['Left', bud(s)]]) +
      K.sect('What used the budget') + K.hbars(x.used.map(u => ({ n: esc(u[0]), v: u[1], cls: u[2], label: u[1] + ' ' + x.unit })), { nw: 220, vw: 90 }) +
      K.sect('The query', 'as defined in monitoring') + `<div class="code">${esc(x.q)}</div>` +
      (s.note ? K.note(esc(s.note), s.state) : '') +
      `<div class="rowf mt-12" >${K.extLink('Open the service level in monitoring', 'Monitoring')}</div>` };
  });

  const ALX = {
    a1: { cond: 'Error rate of pricing-engine above 1 % for 30 minutes', val: '1.8 %', pol: 'KES Pricing', err: 'e1', inc: null, sub: 'Breach began 17.11 21:12; the condition held 30 minutes at 21:42. Monitoring dates the alert to the first evaluation above the threshold, 21:15.' },
    a2: { cond: 'Export run of carrier-export not finished at 05:00', val: 'gave up at 05:00', pol: 'KES Carrier export', err: 'e2', inc: 'INC-2299', sub: 'Stays open until a run finishes before 05:00 with every carrier. The run of 18.11 did; the alert closes when the incident is closed.' }
  };
  SM.drawer('alert', function (id) {
    const a = D.alerts.find(x => x.id === id), x = ALX[id]; if (!a) return null;
    return { kind: 'Alert · ' + K.svc(a.svc), title: a.text, body:
      K.kv([['Level', K.pill(a.level === 'bad' ? 'critical' : 'warning', a.level)], ['Since', esc(a.since)], ['Condition', esc(x.cond)], ['Value now', esc(x.val)], ['Policy', esc(x.pol)], ['Error group', `<button class="ent" data-dr="error:${x.err}">${esc(D.errors.find(e => e.id === x.err).cls.split(':')[0])}</button>`], ['Incident', x.inc ? K.key(x.inc, { title: true }) : '<span class="faint">none</span>']]) +
      K.note(esc(x.sub), '') +
      K.note('The app shows alerts. Acknowledging, muting and closing happen in monitoring.', '') +
      `<div class="rowf mt-12" >${K.extLink('Open the alert in monitoring', 'Monitoring')}</div>` };
  });

  /* ── Applications ─────────────────────────────────────────────────────── */
  const lastInc = id => incOf(id)[0];
  function servicesPage(ctx) {
    const view = SM.ui.opsview || 'list';
    const cmp = ctx.pick({ today: 'now against the hour before', sprint: 'now against the week before', pi: 'now against the PI so far' });
    const rows = D.services.map(s => {
      const slo = sloOf(s.id), al = alertsOf(s.id), inc = lastInc(s.id), dep = DEPLOYS[s.id][0];
      const metrics = s.rpm == null
        ? `<td colspan="4"><span class="dim">Batch: last run 18.11, 02:00 to 04:12 · 3,870 orders sent</span><span class="sub">no request metrics</span></td>`
        : `<td class="n">${K.fmt(s.rpm)}</td><td class="n">${s.p95} ms</td><td class="n ${s.err >= 1 ? 'c-bad' : ''}">${s.err} %</td><td class="n">${s.apdex.toFixed(2)}</td>`;
      return `<tr data-go="#/service/${s.id}"><td class="s">${K.dot(s.state)} <span class="dim">${K.stateWord[s.state]}</span></td>
        <td class="ttl"><a class="ent" href="#/service/${s.id}">${esc(s.name)}</a><span class="sub mono">${esc(s.id)}</span></td><td class="s dim">${esc(s.kind)}</td>${metrics}
        <td class="s">${bud(slo)}</td><td class="s mono">${esc(s.prod)}</td><td class="s">${dep[1].slice(0, 5)}</td>
        <td class="s">${inc ? K.key(inc.id) + `<span class="sub">${inc.at.slice(4, 9)}</span>` : dash}</td>
        <td class="n">${al.length ? al.map(a => `<button class="pill ${a.level}" data-dr="alert:${a.id}">${a.level === 'bad' ? 'critical' : 'warning'}</button>`).join(' ') : dash}</td></tr>`;
    }).join('');
    const list = `<div class="tbwrap"><table class="tb"><thead><tr><th>State</th><th>Application</th><th>Kind</th><th class="n">Requests/min</th><th class="n">p95</th><th class="n">Errors</th><th class="n">Apdex</th><th>Budget left</th><th>In prod</th><th>Deployed</th><th>Last incident</th><th class="n">Alerts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const map = `<div class="honey ops-honey">${D.services.map(s => `<a class="hex ${s.state}" href="#/service/${s.id}" data-tip="${esc(s.name)}<small>${K.stateWord[s.state]} · ${alertsOf(s.id).length} open alerts</small>"><span>${esc(s.id)}<small>${s.rpm == null ? 'batch · last night ok' : s.err + ' % errors'}</small></span></a>`).join('')}</div>` +
      K.legend([['on track', 'bg-ok'], ['needs a look', 'bg-watch'], ['off track', 'bg-bad']]) + K.note('The colour is the state of the application: an open critical alert or a missed service level makes it red, a warning or little budget left makes it amber.', '');
    const moved = K.table([
      { h: 'Application', cls: 's', v: r => K.svc(r.svc) }, { h: 'Signal', v: r => esc(r.sig) }, { h: 'Usual', n: true, v: r => `<span class="dim">${esc(r.usual)}</span>` },
      { h: 'Now', n: true, v: r => `<b class="c-${r.tone}">${esc(r.now)}</b>` }, { h: 'Since', cls: 's', v: r => esc(r.since) }, { h: 'Likely related', v: r => r.rel }
    ], [
      { svc: 'pricing-engine', sig: 'Error rate', usual: '0.4 %', now: '1.8 %', tone: 'bad', since: '17.11 21:12', rel: `<button class="ent" data-dr="error:e1">504 from the price feed v3</button>` },
      { svc: 'pricing-engine', sig: 'Response time p95', usual: '285 ms', now: '340 ms', tone: 'watch', since: '17.11 21:12', rel: '<span class="dim">same upstream</span>' },
      { svc: 'pricing-engine', sig: 'Apdex', usual: '0.95', now: '0.91', tone: 'watch', since: '17.11 21:12', rel: '<span class="dim">same upstream</span>' },
      { svc: 'carrier-export', sig: 'End of the nightly run', usual: '04:05', now: 'gave up 05:00', tone: 'bad', since: 'night of 17.11', rel: K.key('INC-2299') + ' · last night 04:12 again' },
      { svc: 'checkout-api', sig: 'Service level budget left', usual: '90 %', now: '30 %', tone: 'watch', since: '12.11', rel: K.key('INC-2291') + ' used 26 min' }
    ]) + `<div class="faint fs-11 mg-8-14-0" >Compared ${esc(cmp)}. checkout-web and order-mail are inside their usual range.</div>`;
    const body = view === 'map' ? map : view === 'moved' ? moved : list;
    const recent = K.feed([
      { t: '18.11 11:44', tone: 'watch', html: K.svc('pricing-engine') + ' error group still growing', sub: '268 events in 24 h' },
      { t: '18.11 04:12', tone: 'ok', html: K.svc('carrier-export') + ' run finished before 05:00' },
      { t: '17.11 21:15', tone: 'watch', html: 'Alert on ' + K.svc('pricing-engine'), sub: 'error rate above 1 % for 30 min' },
      { t: '17.11 05:00', tone: 'bad', html: K.key('INC-2299') + ' export gave up at 05:00', sub: 'third time in 30 nights' },
      { t: '13.11 14:30', tone: 'ok', html: 'Hotfix 2026.11.1 to production', sub: K.svc('checkout-api') + ', fix for INC-2291' },
      { t: '12.11 07:42', tone: 'bad', html: K.key('INC-2291') + ' orders down 26 min', sub: 'two days after release 2026.11' }
    ]);
    const rag = K.table([
      { h: 'Environment', cls: 's', v: r => `<b class="ink">${r.e}</b>` }, { h: 'cluster project', cls: 's', v: r => `<span class="mono">${r.ns}</span>` }, { h: 'Cluster', cls: 's', v: r => `<span class="dim">${r.cl}</span>` },
      { h: 'Applications', n: true, v: r => r.n }, { h: 'Open', v: r => `<div class="rowf">${K.extLink('cluster', 'cluster')}${K.extLink('Log search', 'Log search')}${r.e === 'prod' || r.e === 'int' ? K.extLink('Monitoring', 'Monitoring') : ''}</div>` }
    ], [{ e: 'dev', ns: 'kes-dev', cl: 'cluster-nonprod-1', n: 5 }, { e: 'test', ns: 'kes-test', cl: 'cluster-nonprod-1', n: 5 }, { e: 'int', ns: 'kes-int', cl: 'cluster-nonprod-2', n: 5 }, { e: 'prod', ns: 'kes-prod', cl: 'cluster-prod-a, cluster-prod-b', n: 5 }]) +
      `<div class="rowf mg-8-14-0" >${K.extLink('Build server folder KES', 'Build server')}<span class="faint fs-11" >The links come from the service catalogue; the app reads nothing from cluster.</span></div>`;
    return {
      lede: 'The five applications Team Kestrel runs, in one list with the same columns for every one. Rows open the application.',
      acts: K.extLink('Open in monitoring', 'Monitoring'),
      kpis: [
        { l: 'Applications', v: D.services.length, s: 'tier 1: 2 · tier 2: 2 · tier 3: 1' },
        { l: 'Need a look', v: 2, s: 'checkout-api, pricing-engine', tone: 'watch' },
        { l: 'Off track', v: 1, s: '<b>carrier-export</b>', tone: 'bad', to: '#/service/carrier-export' },
        { l: 'Open alerts', v: D.alerts.length, s: '1 critical, 1 warning', tone: 'bad' },
        { l: 'Service levels missed', v: 1, u: 'of 5', s: 'export before 05:00', tone: 'bad', to: '#/ops/slo' },
        { l: 'Incidents, 30 days', v: D.incidents.length, s: '1 P2 · 3 P3', to: '#/ops/incidents' },
        { l: 'Last deployment', v: '13.11', s: 'hotfix 2026.11.1' }
      ],
      body: K.grid(
        K.panel({ title: 'Applications', sub: view === 'moved' ? 'what deviates from its usual value' : 'golden metrics now', w: 'c12 x8', src: ['mon', 'catalog'], flush: view === 'list' || view === 'moved',
          right: K.seg('opsview', [['list', 'List'], ['map', 'Health map'], ['moved', 'What moved']], view),
          help: 'One row per application with the golden metrics of monitoring at 11:47: throughput, response time p95, error rate, Apdex. The budget is the error budget of its service level. The batch job has no requests: its row shows the last run.', body }),
        K.panel({ title: 'Open alerts', w: 'c4 x4', src: ['mon'], right: K.pill('2', 'bad'), body: K.list(D.alerts.map(a => ({ tone: a.level, html: `<button class="ent" data-dr="alert:${a.id}">${esc(a.text)}</button><br><span class="faint">${K.svc(a.svc)} · since ${esc(a.since)}</span>`, v: a.level === 'bad' ? 'critical' : 'warning' }))) + '<div class="faint fs-11 mt-8" >Acknowledged and closed in monitoring, not here.</div>' }),
        K.panel({ title: 'Error budget left', sub: '30-day service levels', w: 'c4 x4', src: ['mon'], ev: 'slo.res.budget', body: K.hbars(D.slos.map(s => ({ n: K.svc(s.svc), v: Math.max(0, s.left), max: 100, cls: budTone(s), label: s.left < 0 ? '<span class="c-bad">spent</span>' : s.left + ' %', tick: 35, tickTip: 'below 35 %: little budget left' })), { max: 100, nw: 160, vw: 50 }) }),
        K.panel({ title: 'Recent activity', sub: 'all applications', w: 'c4 x4', src: ['mon', 'increp', 'ci'], body: recent }),
        K.panel({ title: 'Where the team\'s applications run', sub: 'from the team\'s domain in the service catalogue', w: 'c12 x4', src: ['catalog'], flush: true, body: rag })
      )
    };
  }

  /* ── Service levels ───────────────────────────────────────────────────── */
  const OPS_C = { 'slo-api-avail': [100, 100, 99.74, 99.93], 'slo-web-p95': [100, 99.7, 99.2, 99.4], 'slo-price-avail': [98.2, 98.9, 99.6, 99.71], 'slo-export-time': [null, 100, 85.7, 90.0], 'slo-notify': [99.8, 99.7, 99.5, 99.6] };
  const POP = { 'slo-api-avail': [99.98, 99.97, 99.99, 99.92], 'slo-web-p95': [99.6, 99.5, 99.5, 99.3], 'slo-price-avail': [99.8, 99.9, 99.8, 99.62], 'slo-export-time': [100, 100, 96.8, 88.9], 'slo-notify': [99.7, 99.6, 99.5, 99.6] };
  const cTone = (v, s) => v == null ? '' : v < s.target ? 'bad' : v < s.target + (100 - s.target) * 0.25 ? 'watch' : 'ok';
  function sloPage() {
    const base = [
      { h: 'Application', cls: 's', v: s => K.svc(s.svc) }, { h: 'Service level', cls: 'ttl', v: s => `<button class="ent" data-dr="slo:${s.id}">${esc(s.name)}</button>` },
      { h: 'Target', n: true, v: s => s.target + ' %' }];
    const opCols = base.concat(['last 2 h', '1 day', '7 days', '30 days'].map((h, n) => ({ h, n: true, cls: 'ops-c', v: s => { const v = OPS_C[s.id][n]; return `<span class="c-${cTone(v, s)}">${v == null ? '–' : v + ' %'}</span>`; } })))
      .concat([{ h: 'Window', cls: 's', v: s => esc(s.win) }, { h: 'Budget left', cls: 's', v: s => bud(s) }, { h: 'Note', v: s => `<span class="dim">${esc(s.note || '')}</span>` }]);
    const popCols = base.concat(['August', 'September', 'October', 'November so far'].map((h, n) => ({ h, n: true, cls: 'ops-c', v: s => { const v = POP[s.id][n]; return `<span class="c-${cTone(v, s)}">${v} %</span>`; } })));
    const views = K.tabs('slov', [
      { id: 'op', label: 'Operational', html: K.table(opCols, D.slos) },
      { id: 'pop', label: 'Period over period', html: K.table(popCols, D.slos) + '<div class="faint fs-11 mg-8-14-0" >Calendar months, for the review with the business owners. The export counts nights, the others minutes or messages.</div>' }
    ]);
    // burn-down of orders: 43.2 min, small bursts before 12.11 (4.2 min), 26 min on 12.11, then flat: 13.0 min left
    const left = []; let l = 43.2;
    for (let d = 0; d <= 29; d++) { if ([3, 9, 14, 19].indexOf(d) >= 0) l -= 1.05; if (d === 23) l -= 26; left.push([d, Math.round(l * 10) / 10]); }
    const burn = K.chart({ label: 'Error budget of checkout-api', w: 760, h: 250, right: 64, x: [0, 29], y: [0, 48], yt: [0, 10, 20, 30, 40], yu: '',
      xt: [[0, '20.10'], [7, '27.10'], [14, '03.11'], [21, '10.11'], [23, '12.11'], [29, '18.11']],
      hlines: [{ y: 43.2 * 0.35, color: 'watch', dash: true, label: '35 % left', left: true }],
      vmarks: [{ x: 21, color: 'dim', label: '2026.11', left: true, tip: 'Release 2026.11, 10.11' }, { x: 23, color: 'bad', label: 'INC-2291 −26 min', tip: 'INC-2291, 12.11 07:42: 26 minutes of the budget' }, { x: 24, color: 'dim', label: '', tip: 'Hotfix 2026.11.1, 13.11' }],
      lines: [{ pts: left, color: 's1', w: 2, end: true, label: '13.0 min', tip: (x, y) => `${NIGHTS[x].dm}: ${y} min of 43.2 left` }] });
    const nights = `<div class="ops-nights">${NIGHTS.map(n => `<i class="${n.miss ? 'bad' : ''}" data-tip="Night of ${n.dm}<small>${n.miss ? 'gave up at 05:00 · missed' : 'finished ' + hm(n.end)}</small>"></i>`).join('')}</div>
      <div class="ops-nights-x">${[0, 9, 16, 28].map(i => `<span style="left:${(i + 0.5) / 30 * 100}%">${NIGHTS[i].dm}</span>`).join('')}</div>` +
      K.legend([['finished before 05:00', 'bg-ok'], ['missed', 'bg-bad']]) + K.note('<b>27 of 30 nights</b> on time: the target of 93.3 % allows 2 missed nights. The budget is spent by one night.', 'bad');
    return {
      lede: 'Five service levels in monitoring, one per application, each a target over a rolling window and the error budget it leaves.',
      acts: K.extLink('Service levels in monitoring', 'Monitoring'),
      kpis: [
        { l: 'Service levels', v: D.slos.length, s: 'one per application' },
        { l: 'On track', v: 3, s: 'checkout-web, pricing-engine, notifications', tone: 'ok' },
        { l: 'Little budget left', v: 1, s: '<b>orders: 30 % left</b>', tone: 'watch', ev: 'slo.res.budget' },
        { l: 'Missed', v: 1, s: '<b>export: 27 of 30 nights</b>', tone: 'bad' },
        { l: 'Budget used, orders', v: '30.2', u: 'of 43.2 min', s: '26 min in INC-2291', ev: 'slo.res.budget' },
        { l: 'Budget used, prices', v: 125, u: 'of 216 min', s: 'availability of price lookups' }
      ],
      body: K.grid(
        K.panel({ title: 'Service levels', sub: 'compliance by window · click a name for its definition', w: 'c12 x9', src: ['mon'], flush: true, body: views,
          help: 'Green: budget left. Amber: less than a quarter of the budget left in that window. Red: below the target, the budget is spent. The 30-day column is the actual value of the service level.' }),
        K.panel({ title: 'Decision waiting', w: 'c4 x3', src: ['wiki'], right: K.pill('due Mon 23.11', 'watch'), body: K.dec(D.decisions.find(d => d.id === 'D-3')) }),
        K.panel({ title: 'Error budget of orders', sub: 'minutes left of 43.2, last 30 days', w: 'c8 x5', src: ['mon'], ev: 'slo.res.budget', body: burn,
          help: 'The budget of "Availability of checkout": 0.1 % of 30 days is 43.2 minutes. Flat for weeks, then 26 minutes went in one morning.' }),
        K.panel({ title: 'Export nights', sub: 'last 30 nights, one cell per night', w: 'c6 x4', src: ['mon', 'increp'], body: nights }),
        K.panel({ title: 'Where the budgets went', sub: 'share of each budget used', w: 'c6 x3', src: ['mon'], body: K.hbars(D.slos.map(s => ({ n: K.svc(s.svc), v: Math.min(s.used, 150), max: 150, cls: s.used > 100 ? 'bad' : s.used > 75 ? 'watch' : 's1', label: s.used + ' %', tick: 100, tickTip: '100 %: the whole budget' })), { max: 150, nw: 160, vw: 50 }) +
          '<div class="faint fs-11 mt-6" >The mark is the whole budget. Past it, the service level is missed.</div>' })
      )
    };
  }

  /* ── Incidents ────────────────────────────────────────────────────────── */
  const DUR_MIN = { 'INC-2299': 171, 'INC-2291': 26, 'INC-2274': 168, 'INC-2262': 170 };
  function incidentsPage(ctx) {
    const cols = [
      { h: 'Incident', cls: 's', v: i => K.key(i.id), s: i => i.id }, { h: 'When', cls: 's', v: i => esc(i.at), s: i => i.day },
      { h: 'Application', cls: 's', v: i => K.svc(i.svc), s: i => i.svc }, { h: 'Priority', cls: 's', v: i => K.pill(i.prio, i.prio === 'P2' ? 'bad' : 'watch'), s: i => i.prio },
      { h: 'Duration', n: true, v: i => esc(i.dur), s: i => DUR_MIN[i.id] }, { h: 'State', cls: 's', v: i => K.pill(i.state, i.state === 'open' ? 'watch' : ''), s: i => i.state },
      { h: 'Cause', cls: 'ttl', v: i => `<span class="dim">${esc(i.cause)}</span>` },
      { h: 'Report', cls: 's', v: i => K.pill(i.conf, i.conf === 'confirmed' ? 'ok' : ''), tip: 'Confidence the report of the incident reports gives its cause' },
      { h: 'Issue', cls: 's', v: i => K.key(i.issue) }, { h: 'Change before', cls: 's', v: i => i.change ? K.key(i.change) + '<span class="sub">2 days earlier</span>' : dash }
    ];
    const tlx = d => K.day(d) - K.day('2026-09-28');
    const tl = K.chart({ dayX: d => K.day(d) - K.day('2026-09-28'), label: 'Incidents against releases, PI 26.4', w: 760, h: 210, x: [0, tlx('2026-12-11')], y: [0, 200], yt: [0, 60, 120, 180], yu: '′',
      xt: D.cal.sprints.map(s => [tlx(s.from) + 1, s.id]).concat([[tlx('2026-12-11') - 1, '11.12']]),
      vmarks: D.releases.filter(r => r.day >= '2026-09-28').map((r, n) => ({ x: tlx(r.day), color: r.state === 'planned' ? 'faint' : 'dim', label: r.id.replace('R', ''), row: n % 2, left: r.id === 'R2026.11', tip: r.name + ', ' + r.date }))
        .concat([{ x: tlx(D.now.date), color: 'ink', dash: false, label: 'today', row: 2 }]),
      dots: D.incidents.map(i => ({ x: tlx(i.day), y: DUR_MIN[i.id], r: i.prio === 'P2' ? 7 : 5, color: i.prio === 'P2' ? 's2' : 's1', tip: `${i.id} · ${i.prio} · ${i.dur}<small>${esc(i.title)}</small>` })) }) +
      K.legend([['P2', 'bg-s2'], ['P3', 'bg-s1'], ['release in production', 'bg-dim', 1], ['planned release', 'bg-off', 1]]);
    const mttr = K.hbars(D.incidents.map(i => ({ n: K.key(i.id) + ' <span class="faint">' + i.prio + '</span>', v: DUR_MIN[i.id], max: 180, cls: i.prio === 'P2' ? 's2' : 's1', label: esc(i.dur) })), { max: 180, nw: 110, vw: 76 }) +
      K.note('Median <b>2 h 49 min</b>: the three exports set it, each ran until the job gave up at 05:00. The P2 took <b>26 min</b>, the number DORA counts.', '');
    const post = D.actions.filter(a => a.from.indexOf('Postmortem') === 0);
    return {
      lede: 'Incidents of the team\'s applications from the reports of the incident reports and Monitoring. Each opens with its timeline, its report and what changed before it.',
      kpis: [
        { l: 'Incidents, 30 days', v: D.incidents.length, s: '<b>1 P2</b> · 3 P3', tone: 'watch' },
        { l: 'Open', v: 1, s: 'INC-2299, export', tone: 'watch', to: '#/incident/INC-2299' },
        { l: 'Median time to restore', v: '2 h 49', u: 'min', s: 'P2: 26 min' },
        { l: 'Same cause', v: 3, u: 'incidents', s: '<b>export timed out</b>', tone: 'bad' },
        { l: 'Followed a release', v: 1, s: 'INC-2291 after 2026.11', tone: 'bad', ev: 'dora.cfr' },
        { l: 'On-call this PI', v: D.requests.duty.callouts, u: 'call-outs', s: D.requests.duty.night + ' at night · team total' }
      ],
      body: K.grid(
        K.panel({ title: 'Incidents', sub: 'last 30 days · rows open the incident', w: 'c12 x8', src: ['increp', 'mon', 'jira'], flush: true,
          body: K.table(cols, D.incidents, { attrs: i => `data-go="#/incident/${i.id}"` }), help: 'One row per incident report of the incident reports. The cause is the report\'s own sentence; the confidence says how sure the report is of it.' }),
        K.panel({ title: 'What we pay for more than once', w: 'c4 x4', src: ['increp', 'jira'], right: K.pill('3 in 30 nights', 'bad'), body:
          K.list(D.incidents.filter(i => i.svc === 'carrier-export').map(i => ({ tone: i.state === 'open' ? 'watch' : 'bad', html: K.key(i.id) + ' ' + esc(i.at.slice(4, 9)), v: esc(i.dur) }))) +
          K.note('Same cause each time: the carrier endpoint does not answer within 30 s and the job has no retry. The fix ' + K.key('KES-4142') + ' is done and waits for <b>release 2026.12</b> on 03.12. Until then the on-call restarts the export by hand (risk R-3).', 'bad') }),
        K.panel({ title: 'Incidents against releases', sub: 'PI 26.4 · height: minutes to restore', w: 'c8 x4', src: ['increp', 'ci'], body: tl,
          help: 'Every production release of the PI as a line, every incident as a dot. INC-2291 came two days after release 2026.11; the exports have no release before them.' }),
        K.panel({ title: 'Time to restore', sub: 'per incident', w: 'c4 x3', src: ['increp'], body: mttr }),
        K.panel({ title: 'On-call load', sub: 'PI 26.4 · team totals', w: 'c4 x2', src: ['wiki'], body: K.kv([['Call-outs', `<b class="ink">${D.requests.duty.callouts}</b>`], ['At night (22:00 to 06:00)', `<b class="ink">${D.requests.duty.night}</b>`], ['On-call days per sprint', '5 person-days, since 41']]) +
          K.note('Counted for the team. The app does not know who was on call and does not count anyone\'s nights.', '') }),
        K.panel({ title: 'Follow-ups from postmortems', w: 'c4 x3', src: ['wiki', 'jira'], body: K.list(post.map(a => ({ tone: a.state === 'done' ? 'ok' : 'watch', html: `<b>${a.id}</b> ${esc(a.text)} ${a.key ? K.key(a.key) : ''}`, cite: a.from, v: a.age + ' d' })).concat([
          { tone: 'ok', html: '<b>ADR-030</b> Connection pool per pod from 20 to 30', cite: 'INC-2291', v: 'made' }, { tone: 'watch', html: K.key('KES-4146') + ' Export: stop after five attempts and report', cite: 'INC-2299', v: 'in progress' }])) })
      )
    };
  }

  /* ── Errors ───────────────────────────────────────────────────────────── */
  function errorsPage(ctx) {
    const cnt = st => D.errors.filter(e => e.st === st).length;
    const cols = [
      { h: 'Error class', cls: 'ttl', v: e => `<button class="mono ent ta-l" data-dr="error:${e.id}" >${esc(e.cls)}</button>` },
      { h: 'Application', cls: 's', v: e => K.svc(e.svc), s: e => e.svc },
      { h: '24 h', n: true, v: e => e.n24 ? `<b class="ink">${K.fmt(e.n24)}</b>` : '<span class="faint">0</span>', s: e => e.n24 },
      { h: '7 days', n: true, v: e => K.fmt(e.n7), s: e => e.n7 },
      { h: '', cls: 's', v: e => K.spark(e.sp, { w: 80, h: 20, color: e.st === 'new' ? 'watch' : 'dim' }) },
      { h: 'First seen', cls: 's', v: e => esc(e.first), s: e => e.first }, { h: 'Last seen', cls: 's', v: e => esc(e.last), s: e => e.last },
      { h: 'Status', cls: 's', v: e => K.pill(e.st, ESTATE[e.st]), s: e => e.st }, { h: 'Issue', cls: 's', v: e => e.issue ? K.key(e.issue) : '<span class="c-watch">none</span>', s: e => e.issue || '' }
    ];
    const win = ctx.pick({ today: 'last 24 hours', sprint: 'last 7 days' });
    return {
      lede: `Errors grouped by fingerprint, the way Monitoring's errors inbox does. Window: ${win}. The error class opens the group.`,
      acts: K.extLink('Errors inbox in monitoring', 'Monitoring'),
      kpis: [
        { l: 'Error groups', v: D.errors.length, s: 'five applications' },
        { l: 'New', v: cnt('new'), s: 'since release 2026.11', tone: 'watch' },
        { l: 'Newest group, 24 h', v: 268, u: 'events', s: '<b>pricing-engine</b> since 17.11 21:12', tone: 'bad' },
        { l: 'Resolved', v: cnt('resolved'), s: 'by hotfix 2026.11.1', tone: 'ok' },
        { l: 'Without an issue', v: D.errors.filter(e => !e.issue).length, s: 'pricing-engine, notifications', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Errors inbox', sub: 'one row per error group', w: 'c12 x12', src: ['mon', 'jira'], flush: true,
          right: K.filter('err', [['all', 'All', D.errors.length], ['new', 'New', cnt('new')], ['known', 'Known', cnt('known')], ['resolved', 'Resolved', cnt('resolved')], ['regressed', 'Regressed', 0]]),
          body: K.table(cols, D.errors, { attrs: e => `data-f-err="all ${e.st}"` }),
          help: 'Status: new is a group first seen since the last release; known has been seen before; resolved was closed with a fix. Regressed would mark a resolved group whose error came back: none in this data. Statuses are set in monitoring, the app only shows them.' }),
        K.panel({ title: 'Open alerts', w: 'c4 x4', src: ['mon'], body: K.list(D.alerts.map(a => ({ tone: a.level, html: `<button class="ent" data-dr="alert:${a.id}">${esc(a.text)}</button><br><span class="faint">${K.svc(a.svc)} · since ${esc(a.since)}</span>`, v: a.level === 'bad' ? 'critical' : 'warning' }))) }),
        K.panel({ title: 'New since the last release', sub: 'release 2026.11, 10.11', w: 'c4 x4', src: ['mon', 'jira'], body: K.list(D.errors.filter(e => e.st === 'new').map(e => ({ tone: e.issue ? 'watch' : 'bad', html: `<button class="ent mono" data-dr="error:${e.id}">${esc(e.cls.split(':')[0])}</button> ${K.svc(e.svc)}<br><span class="faint">first ${esc(e.first)} · ${e.issue ? 'issue ' : 'no issue yet'}</span>${e.issue ? K.key(e.issue) : ''}`, v: K.fmt(e.n7) }))) +
          K.note('The pricing-engine group started at 17.11 21:12, with no deployment before it: the upstream Price feed v3 answers 504. No issue is linked yet.', 'watch') }),
        K.panel({ title: 'What the app reads here', w: 'c4 x4', src: ['mon', 'logs'], body: K.checks([
          { state: 'ok', html: 'Error class, counts, first and last seen, status', sub: 'from monitoring, every 2 min' },
          { state: 'ok', html: 'A shortened stack trace', sub: 'frames only, no variables' },
          { state: '', html: 'Never the payload of a request', sub: 'no customer names, no order numbers' },
          { state: '', html: 'Log search log lines: on screen only', sub: 'kept nowhere, never passed to the agent' }]) })
      )
    };
  }

  /* ── Requests ─────────────────────────────────────────────────────────── */
  const HANDED = [
    { key: 'OSP-2231', team: 'Team Osprey', title: 'Cancellation fee shown wrong for a partial cancellation in the support tool', age: 1, ans: true },
    { key: 'OPS-81', team: 'Platform operations', title: 'Agree the alert rule for the carrier export', age: 3, ans: false },
    { key: 'ATL-895', team: 'Team Atlas', title: 'Small business tier: confirm the VAT check', age: 4, ans: false },
    { key: 'PARTNER-318', team: 'Carrier-Integration', title: 'Export file of 17.11 incomplete', age: 1, ans: true }
  ];
  function requestsPage() {
    const wk = D.requests.week;
    return {
      lede: 'What reached the team from outside the sprint plan this week: issues handed over, mentions in other teams\' issues, new bugs.',
      kpis: [
        { l: 'Handed to the team', v: wk[0][1], u: 'issues', s: 'this week' },
        { l: 'Mentions elsewhere', v: wk[1][1], s: 'in issues of other teams' },
        { l: 'New bugs', v: wk[2][1], s: 'KES-4188, KES-4190, KES-4181', to: '#/quality/bugs' },
        { l: 'Unanswered > 2 days', v: D.requests.unanswered, s: '<b>OPS-81, ATL-895</b>', tone: 'watch' },
        { l: 'Support in done work', v: D.workmix[3].pct, u: '%', s: 'agreed: 10 %', tone: 'watch', ev: 'mix.unplanned' }
      ],
      body: K.grid(
        K.panel({ title: 'Issues handed to the team', sub: 'this week · keys of other teams stay text', w: 'c8 x6', src: ['jira'], flush: true, right: K.pill('2 unanswered', 'watch'), body: K.table([
          { h: 'Issue', cls: 's', v: r => K.key(r.key) + `<span class="sub">${esc(r.team)}</span>` }, { h: 'Subject', cls: 'ttl', v: r => `<span class="dim">${esc(r.title)}</span>` },
          { h: 'Age', n: true, v: r => `<span class="${!r.ans && r.age > 2 ? 'c-watch' : ''}">${r.age} d</span>`, s: r => r.age },
          { h: 'Answered', cls: 's', v: r => r.ans ? K.pill('answered', 'ok') : K.pill('not yet', 'watch'), s: r => r.ans ? 1 : 0 }], HANDED),
          help: 'Issues of other projects that name the team as the receiver. "Answered" means a comment from the team after the hand-over; the app does not say who wrote it.' }),
        K.panel({ title: 'This week', sub: 'requests by kind', w: 'c4 x3', src: ['jira'], body: K.hbars(wk.map((w, n) => ({ n: esc(w[0]), v: w[1], cls: ['s1', 's3', 's2'][n] })), { max: 7, nw: 200, vw: 30 }) }),
        K.panel({ title: 'Support in the done work', sub: 'PI so far, story points', w: 'c4 x3', src: ['jira'], ev: 'mix.unplanned', body: K.stackbar(D.workmix.map((w, i) => [w.name, w.sp, ['bg-r3', 'bg-r5', 'bg-s2', 'bg-s3'][i]]), { unit: 'SP', h: 12 }) +
          K.note(`Support and maintenance: <b>${D.workmix[3].sp} SP, ${D.workmix[3].pct} %</b> of 126 SP; agreed are ${D.workmix[3].target} %.`, 'watch') }),
        K.panel({ title: 'Requests in team chat channels', w: 'c4 x6', src: ['chat'], would: 'questions to the team in two team chat channels with their age and whether somebody answered' }),
        K.panel({ title: 'What the app never does here', w: 'c4 x6', src: ['jira'], body: K.checks([
          { state: '', html: 'Read private chats or direct messages', sub: 'two team channels at most, once approved' },
          { state: '', html: 'Measure response times per person', sub: 'answered or not, for the team' },
          { state: '', html: 'Answer, comment or assign in Jira', sub: 'the app only reads' }]) })
      )
    };
  }

  SM.domain({
    id: 'ops', title: 'Operations', icon: 'ops',
    pages: [
      { id: 'services', title: 'Applications', hz: ['today', 'sprint', 'pi'], was: 'moved', from: 'Operations (What the team runs)', find: 'services health golden metrics apdex throughput entity explorer cluster', render: servicesPage },
      { id: 'slo', title: 'Service levels', hz: ['today', 'sprint', 'pi'], was: 'new', from: '', find: 'slo sli error budget compliance burn', render: sloPage },
      { id: 'incidents', title: 'Incidents', hz: ['sprint', 'pi', 'quarter'], was: 'moved', from: 'Operations (incident reports)', find: 'incident postmortem on-call on-call restore mttr', render: incidentsPage },
      { id: 'errors', title: 'Errors', hz: ['today', 'sprint'], was: 'new', from: '', find: 'errors inbox exceptions error groups stack trace', render: errorsPage },
      { id: 'requests', title: 'Requests', hz: ['today', 'sprint'], was: 'moved', from: 'Operations (What reached the team), Notices', find: 'requests support handed over mentions teams channels', render: requestsPage }
    ]
  });

  /* ── Entity: application ──────────────────────────────────────────────── */
  const ACT = {
    'checkout-web': [['18.11 09:15', '', 'Error group <button class="ent" data-dr="error:e6">NullPointerException in StockMapRenderer</button> again', '1 event'], ['17.11 15:20', '', 'Pull request #231 merged', 'KES-4150 Keyboard use of the quantity picker'], ['13.11 10:05', '', 'Pull request #228 merged', 'KES-4102 Stock holds per warehouse'], ['10.11 06:40', 'ok', 'Deployment 2026.11.0 to production', 'release 2026.11']],
    'checkout-api': [['18.11 10:31', 'watch', 'Error group <button class="ent" data-dr="error:e3">total negative after a partial cancellation</button>', '6 events in 24 h · KES-4190'], ['17.11 11:02', '', 'Pull request #410 merged', 'KES-4121 Calculate the refund'], ['13.11 14:30', 'ok', 'Deployment 2026.11.1 to production', 'hotfix, KES-4188'], ['13.11 09:00', '', 'ADR-030: pool per pod from 20 to 30', 'decided after INC-2291'], ['12.11 08:08', 'ok', 'INC-2291 restored after 26 min', ''], ['12.11 07:42', 'bad', 'INC-2291 opened, P2', 'alert: error rate above 5 %'], ['10.11 06:45', 'ok', 'Deployment 2026.11.0 to production', 'release 2026.11']],
    'pricing-engine': [['18.11 11:44', 'watch', 'Error group <button class="ent" data-dr="error:e1">504 from upstream /v3/price-tiers</button>', '268 events in 24 h'], ['17.11 21:15', 'watch', 'Alert opened: error rate above 1 % for 30 min', ''], ['17.11 21:12', 'watch', 'New error group first seen', 'no deployment before it'], ['17.11 16:40', 'bad', 'Main red: contract test against the price feed v3', 'Build server'], ['16.11 14:12', '', 'Pull request #116 merged', 'KES-4135 prepared'], ['10.11 06:50', 'ok', 'Deployment 2026.11.0 to production', 'release 2026.11']],
    'carrier-export': [['18.11 04:12', 'ok', 'Nightly run finished before 05:00', '3,870 orders'], ['17.11 05:00', 'bad', 'Alert: export not finished at 05:00', 'INC-2299 open'], ['17.11 02:09', 'bad', 'INC-2299 opened, P3', 'carrier endpoint did not answer'], ['16.11 13:40', '', 'Pull request #95 merged', 'KES-4143 Log the transfers'], ['13.11 11:25', '', 'Pull request #94 merged', 'KES-4142 Retry with a growing delay'], ['05.11 02:12', 'bad', 'INC-2274 opened, P3', ''], ['30.10 10:15', 'ok', 'Deployment 2026.10.2 to production', 'patch'], ['29.10 02:10', 'bad', 'INC-2262 opened, P3', '']],
    'order-mail': [['18.11 08:02', '', 'Error group <button class="ent" data-dr="error:e5">MailDeliveryException 451</button>', '3 events in 24 h · no issue'], ['12.11 16:30', '', 'Pull request #55 merged', 'Move the mail templates into a module of their own'], ['10.11 06:55', 'ok', 'Deployment 2026.11.0 to production', 'release 2026.11']]
  };
  function batchCharts() {
    const x = [-0.6, 29.6], xt = [[0, '20.10'], [9, '29.10'], [16, '05.11'], [23, '12.11'], [28, '17.11']], vm = [{ x: 10, color: 'dim', label: '2026.10.2', tip: 'Patch 2026.10.2 to production, 30.10' }];
    const c = (title, sub, src, chart) => K.panel({ title, sub, w: 'c6 x3', src, body: chart });
    return [
      c('Duration of the nightly run', 'minutes, 30 nights', ['mon'], K.chart({ label: 'Duration', w: 520, h: 170, x, y: [0, 200], yt: [0, 60, 120, 180], yu: '′', xt, vmarks: vm,
        hlines: [{ y: 180, color: 'bad', dash: true, label: 'window ends 05:00' }], bars: NIGHTS.map(n => ({ x: n.i, w: .7, y1: n.dur, color: n.miss ? 'bad' : 's1', tip: `${n.dm}: ${n.dur} min${n.miss ? ', gave up' : ''}` })) })),
      c('End of the run', 'clock time against 05:00', ['mon'], K.chart({ label: 'End time', w: 520, h: 170, x, y: [3, 5.4], yt: [3, 4, 5], yu: ':00', xt, vmarks: vm,
        hlines: [{ y: 5, color: 'bad', dash: true, label: '05:00' }], lines: [{ pts: NIGHTS.map(n => [n.i, n.end]), color: 's1', w: 1.6, end: true }],
        dots: NIGHTS.filter(n => n.miss).map(n => ({ x: n.i, y: 5, color: 'bad', r: 4.5, tip: `${n.dm}: gave up at 05:00` })) })),
      c('Orders sent', 'per night', ['logs'], K.chart({ label: 'Orders sent', w: 520, h: 170, left: 44, x, y: [0, 4400], yt: [0, 2000, 4000], xt, vmarks: vm,
        bars: NIGHTS.map(n => ({ x: n.i, w: .7, y1: n.sent || 40, color: n.miss ? 'bad' : 's3', tip: `${n.dm}: ${n.miss ? 'none sent in the window, sent by hand in the morning' : K.fmt(n.sent) + ' sent'}` })) })),
      c('Carrier timeouts', 'events of the error group per night', ['mon'], K.chart({ label: 'Carrier timeouts', w: 520, h: 170, x, y: [0, 460], yt: [0, 200, 400], xt, vmarks: vm,
        bars: NIGHTS.map(n => ({ x: n.i, w: .7, y1: Math.max(n.timeouts, 2), color: n.miss ? 'bad' : 'faint', tip: `${n.dm}: ${n.timeouts} timeouts` })) }))
    ];
  }
  SM.entity({
    kind: 'service', title: 'Applications', domain: 'ops', list: '#/ops/services', hz: ['today', 'sprint', 'pi'], was: 'new', from: '',
    ids: () => D.services.map(s => s.id),
    render(id, ctx) {
      const s = K.service(id), slo = sloOf(id), al = alertsOf(id), inc = incOf(id), openInc = inc.filter(i => i.state === 'open'), dep = DEPLOYS[id], ba = BA[id], bugs = bugsOf(id);
      const batch = s.rpm == null;
      const kpis = K.kpis([
        { l: 'Alerts and incidents', v: al.length + ' · ' + openInc.length, u: 'open', s: al.length ? esc(al[0].text) : inc.length ? 'last ' + inc[0].id + ', ' + inc[0].at.slice(4, 9) : 'none in 30 days', tone: al.some(a => a.level === 'bad') ? 'bad' : al.length ? 'watch' : 'ok' },
        { l: 'Last deployment', v: dep[0][1].slice(0, 5), u: dep[0][0], s: batch ? `end ${ba.end[0]} → <b>${ba.end[1]}</b>` : `errors ${ba.err[0]} → <b>${ba.err[1]} %</b> · p95 ${ba.p95[0]} → <b>${ba.p95[1]} ms</b>` },
        { l: 'Service level', v: slo.left < 0 ? 'spent' : slo.left + ' %', u: 'budget left', s: `${esc(slo.name)}: ${slo.actual} % of ${slo.target} %`, tone: slo.state, ev: id === 'checkout-api' ? 'slo.res.budget' : null },
        { l: 'Open bugs', v: bugs.length, s: bugs.length ? bugs.filter(b => b.prio === 'Major').length + ' major · oldest ' + Math.max.apply(null, bugs.map(b => b.age)) + ' d' : 'none', tone: bugs.some(b => b.prio === 'Major') ? 'watch' : '' }
      ]);
      const win = ctx.hz === 'today' ? 'last 24 hours' : 'last 7 days';
      const charts = batch ? batchCharts() : METRICS.map(m => K.panel({ title: m[1], sub: m[2] + ' · ' + win, w: 'c6 x3', src: ['mon'], right: `<b class="ink">${m[4](s[m[0]])}</b>`, body: goldenChart(s, m, ctx.hz) }));
      const noMark = !batch && !DEPLOYS[id].some(d => ago(d[1]) <= (ctx.hz === 'today' ? 24 : 168));
      const summary = K.grid.apply(null, charts.concat([
        K.panel({ title: 'Activity', sub: 'deployments, incidents, alerts, merged pull requests', w: 'c6 x6', src: ['mon', 'increp', 'git'], body: K.feed(ACT[id].map(a => ({ t: a[0], tone: a[1], html: a[2], sub: a[3] }))) }),
        K.panel({ title: 'Last deployment: before and after', sub: dep[0][0] + ', ' + dep[0][1], w: 'c6 x6', src: ['mon', 'ci'], body:
          (batch ? K.kv([['Median end, 7 nights before', ba.end[0]], ['Median end, 7 nights after', `<b class="ink">${ba.end[1]}</b>`], ['Median duration', ba.dur[0] + ' → ' + ba.dur[1]]])
            : K.kv([['Error rate', `${ba.err[0]} % → <b class="ink">${ba.err[1]} %</b>`], ['Response time p95', `${ba.p95[0]} ms → <b class="ink">${ba.p95[1]} ms</b>`], ['Compared', 'one day before against one day after']])) +
          (noMark ? K.note('No deployment in this window: the last one was on ' + dep[0][1].slice(0, 5) + '. The charts show no change marker.', '') : '') +
          (id === 'pricing-engine' ? K.note('The rise of 17.11 21:12 has no deployment before it. The error group points to the upstream Price feed v3 (504).', 'watch') : '') +
          (id === 'checkout-api' ? K.note('Release 2026.11 on 10.11 raised p95 from 190 to 240 ms; INC-2291 followed on 12.11. The hotfix brought it back to 210 ms.', 'watch') : '') +
          K.sect('Deployments to production') + K.list(dep.map(d => ({ tone: '', html: `<span class="mono">${d[0]}</span> <span class="faint">·</span> ${K.key(d[2], { title: true })}`, v: d[1] }))) })
      ]));
      const open = D.issues.filter(i => i.svc === id && i.st !== 'done');
      const prs = D.prs.filter(p => p.repo === repo(id)), pipe = D.builds.pipes.find(p => p.repo === repo(id));
      const flaky = D.flaky.filter(f => f.svc === id);
      const ev = D.envMatrix[id];
      const tabs = K.tabs('svc', [
        { id: 'sum', label: 'Summary', html: summary },
        { id: 'del', label: 'Delivery', cnt: open.length, html: K.grid(K.panel({ title: 'Open sprint issues of this application', sub: 'sprint 42', w: 'c12', src: ['jira', 'git'], flush: true, body: K.issueTable(open, { hide: ['Application'], empty: { title: 'Nothing open in the sprint', text: 'No open issue of sprint 42 names this application.' } }) })) },
        { id: 'code', label: 'Code', cnt: prs.length, html: K.grid(
          K.panel({ title: 'Open pull requests', sub: esc(s.repo), w: 'c8 x8', src: ['git'], flush: true, body: K.table([
            { h: 'Pull request', cls: 's', v: p => `<button class="key" data-dr="pr:${p.id}">#${p.id}</button>` }, { h: 'Issue', cls: 'ttl', v: p => K.key(p.issue, { title: true }) },
            { h: 'State', cls: 's', v: p => K.pill(p.st, p.st === 'approved' ? 'ok' : '') }, { h: 'Waiting', n: true, v: p => `<span class="${p.wait >= 24 ? 'c-watch' : ''}">${p.wait} h</span>` },
            { h: 'Files', n: true, v: p => p.files }, { h: 'Build', cls: 's', v: p => K.pill(p.build === 'ok' ? 'green' : p.build === 'red' ? 'red' : 'running', p.build === 'ok' ? 'ok' : p.build === 'red' ? 'bad' : '') }
          ], prs, { empty: { title: 'No open pull request', text: 'Nothing waits for a review in ' + s.repo + '.' } }) }),
          K.panel({ title: 'Pipeline on main', w: 'c4 x4', src: ['ci'], right: K.pill(pipe.state === 'ok' ? 'green' : 'red', pipe.state), body: K.kv([['Runs, 30 days', `${pipe.runs}, ${pipe.green} green`], ['Median duration', pipe.min + ' min'], ['Tests', K.fmt(pipe.tests)], ['Last run', esc(pipe.last)]]) +
            (pipe.why ? K.note('Red since ' + esc(pipe.since) + ': ' + esc(pipe.why) + '.', 'bad') : '') + `<div class="rowf mt-10" ><button class="btn sm" data-dr="build:${pipe.repo}">Runs and stages</button>${K.extLink('Open in the build server', 'Build server')}</div>` })) },
        { id: 'qa', label: 'Quality', cnt: bugs.length, html: K.grid(
          K.panel({ title: 'Open bugs', w: 'c6 x6', src: ['jira'], body: bugs.length ? K.list(bugs.map(b => ({ tone: b.prio === 'Major' ? 'watch' : '', html: K.key(b.key, { title: true }), v: b.prio + ' · ' + b.age + ' d' }))) : K.stateBlock('empty', { title: 'No open bug', text: 'No open bug of the team names this application.' }) }),
          K.panel({ title: 'Flaky tests', sub: 'flipped in the last 14 nightly runs', w: 'c6 x6', src: ['testrep'], body: flaky.length ? K.list(flaky.map(f => ({ tone: f.last === 'failed' ? 'watch' : '', html: esc(f.test), v: f.flips + ' of ' + f.of }))) : K.stateBlock('empty', { title: 'No flaky test', text: 'No test of this application flipped in the last 14 runs.' }) })) },
        { id: 'chg', label: 'Changes', html: K.grid(
          K.panel({ title: 'Versions per environment', w: 'c6 x6', src: ['ci', 'catalog'], body: `<div class="envm" style="grid-template-columns:repeat(4,minmax(0,1fr))">${D.envs.map(e => `<div class="h">${e}</div>`).join('')}${ev.map((v, n) => `<span class="cell${n === 2 && v.indexOf('2026.12') < 0 ? ' behind' : ''}"><b>${esc(v)}</b>${D.envs[n]}</span>`).join('')}</div>` +
            (ev[2].indexOf('2026.12') < 0 ? K.note('The release candidate of 2026.12 is not on INT yet.', 'watch') : '') }),
          K.panel({ title: 'Releases', sub: 'that carried this application', w: 'c6 x6', src: ['jira', 'ci'], body: K.list(dep.map(d => ({ tone: d[2] === 'R2026.11' && id === 'checkout-api' ? 'bad' : 'ok', html: K.key(d[2], { title: true }) + ` <span class="mono faint">${d[0]}</span>`, v: d[1].slice(0, 5) })).concat([{ tone: '', html: K.key('R2026.12', { title: true }) + ' <span class="faint">planned</span>', v: '03.12' }])) }))
        }
      ]);
      return { body: K.ehead({
        kind: `${esc(s.kind)} · ${esc(s.stack)} · tier ${s.tier} · ${K.pill(K.stateWord[s.state], s.state)}`, title: s.name,
        facts: [esc(s.does), `<span class="mono">${esc(s.repo)}</span>`, `in production <b>${esc(s.prod)}</b>`, 'owner <b>Team Kestrel</b>'],
        links: [K.extLink('Monitoring', 'Monitoring'), K.extLink('Log search', 'Log search'), K.extLink('Build server', 'Build server'), K.extLink('cluster', 'cluster'), K.extLink('Git hosting', 'Git hosting')]
      }) + kpis + tabs };
    }
  });

  /* ── Entity: incident ─────────────────────────────────────────────────── */
  const LADDER = [['guess', 'a cause named, nothing checked'], ['plausible', 'fits the symptoms'], ['likely', 'one query supports it'], ['strong', 'several signals agree'], ['confirmed', 'alternatives ruled out']];
  const STEP = { medium: 2, high: 3, confirmed: 4 };
  const EXPORT_HYP = full => [
    { state: 'ok', html: '<b>The carrier endpoint answered too slowly</b>', sub: "Monitoring: FROM Span SELECT percentile(duration, 95) WHERE name = 'CarrierClient.send' FACET carrier", v: full ? 'supported' : 'likely' },
    { state: full ? '' : 'watch', html: (full ? 'Dropped: ' : 'Not ruled out: ') + 'our job crashed or ran out of memory', sub: "Monitoring: FROM JvmMetric SELECT max(heapUsed) WHERE appName = 'carrier-export'", v: full ? 'dropped' : 'open' },
    { state: full ? '' : 'watch', html: (full ? 'Dropped: ' : 'Not ruled out: ') + 'certificate or network to the carrier', sub: 'Log search: saved search "export tls handshake" for the night', v: full ? 'dropped' : 'open' }
  ];
  const INC = {
    'INC-2299': { events: 412, lost: ['Orders not exported', '3,912', 'sent by hand at 07:10'], first: '4 h 21 min', firstSub: 'on-call began 06:30', same: 2,
      tl: [['02:00', '', 'Export run starts'], ['02:09', 'bad', 'First carrier timeout; incident opened as P3', 'CarrierTimeoutException'], ['02:10', 'watch', 'Each call waits 30 s, no retry', '412 timeouts until 04:58'], ['05:00', 'bad', 'Run gives up; alert "Export not finished at 05:00"', ''], ['05:07', '', 'Report of the incident reports written', 'confidence high'], ['06:30', '', 'On-call takes the incident', 'P3: from the start of on-call hours'], ['07:10', 'ok', 'Export restarted by hand and finished', '3,912 orders sent'], ['now', 'watch', 'Open until the fix is in production', 'KES-4146, release 2026.12']],
      hyp: EXPORT_HYP(true), steps: ['Restart the export for the missing carrier by hand (done at 07:10)', 'Release the retry with a growing delay, KES-4142, with 2026.12', 'Stop after five attempts and report, KES-4146'] },
    'INC-2291': { events: 1820, lost: ['Requests failed', '1,820', 'one error event each'], first: '4 min', firstSub: 'on-call acknowledged 07:46', same: 0,
      tl: [['07:41', 'watch', 'First "Connection is not available" in checkout-api', 'HikariPool-1'], ['07:42', 'bad', 'Error rate above 5 %; incident opened as P2', 'orders fail'], ['07:46', '', 'On-call takes the incident', ''], ['07:52', '', 'Report of the incident reports: pool runs empty after release 2026.11', 'confidence high, later confirmed'], ['07:58', '', 'Pods restarted with a pool of 30', ''], ['08:04', 'ok', 'Error rate falls', ''], ['08:08', 'ok', 'Restored after 26 min', ''], ['13.11 14:30', 'ok', 'Hotfix 2026.11.1 in production', 'KES-4188: connections are released again']],
      hyp: [
        { state: 'ok', html: '<b>Database connections are not released after release 2026.11</b>', sub: "Monitoring: FROM Metric SELECT max(hikaricp.connections.active), max(hikaricp.connections.max) WHERE appName = 'checkout-api' SINCE '2026-11-10'", v: 'confirmed' },
        { state: '', html: 'Dropped: the database server was overloaded', sub: 'Monitoring: FROM SystemSample SELECT average(cpuPercent) WHERE hostname LIKE \'kes-db%\': 31 %', v: 'dropped' },
        { state: '', html: 'Dropped: an unusual traffic peak', sub: 'Monitoring: throughput 2,960 rpm, as on every Thursday morning', v: 'dropped' }],
      steps: ['Restart the pods with a larger pool (done 07:58)', 'Release connections in the new repository code, KES-4188 (hotfix 2026.11.1)', 'Alert on connections above 80 %, KES-4193'] },
    'INC-2274': { events: 398, lost: ['Orders not exported', '3,840', 'sent by hand at 07:25'], first: '4 h 18 min', firstSub: 'on-call began 06:30', same: 1,
      tl: [['02:00', '', 'Export run starts'], ['02:12', 'bad', 'First carrier timeout; incident opened as P3', ''], ['05:00', 'bad', 'Run gives up', 'restored at 05:00 as the window closed'], ['06:30', '', 'On-call takes the incident'], ['07:25', 'ok', 'Export restarted by hand', '']],
      hyp: EXPORT_HYP(false), steps: ['Add a retry with a growing delay, KES-4142', 'Ask the carrier for its response times'] },
    'INC-2262': { events: 405, lost: ['Orders not exported', '3,790', 'sent by hand at 07:40'], first: '4 h 20 min', firstSub: 'on-call began 06:30', same: 0,
      tl: [['02:00', '', 'Export run starts'], ['02:10', 'bad', 'First carrier timeout; incident opened as P3', ''], ['05:00', 'bad', 'Run gives up', ''], ['06:30', '', 'On-call takes the incident'], ['07:40', 'ok', 'Export restarted by hand', '']],
      hyp: EXPORT_HYP(false), steps: ['Restart the export by hand', 'Look at the timeouts of the carrier'] }
  };
  SM.entity({
    kind: 'incident', title: 'Incidents', domain: 'ops', list: '#/ops/incidents', hz: ['sprint', 'pi'], was: 'moved', from: 'Operations (incident reports)',
    ids: () => D.incidents.map(i => i.id),
    render(id) {
      const i = K.incident(id), x = INC[id], step = STEP[i.conf];
      const errs = D.errors.filter(e => e.svc === i.svc && (id === 'INC-2291' ? e.id === 'e4' : i.svc === 'carrier-export' ? e.id === 'e2' : true));
      const kpis = K.kpis([
        { l: 'Duration', v: i.dur, tone: i.prio === 'P2' ? 'bad' : 'watch' },
        { l: 'Error events', v: K.fmt(x.events), s: errs.length ? errs[0].cls.split(':')[0] : '' },
        { l: x.lost[0], v: x.lost[1], s: x.lost[2] },
        { l: 'Time to the first action', v: x.first, s: x.firstSub },
        { l: 'Same cause before', v: x.same, u: x.same === 1 ? 'time' : 'times', s: x.same ? 'export timed out' : 'not seen before', tone: x.same ? 'bad' : '' }
      ]);
      const ladder = `<div class="ops-ladder">${LADDER.map((l, n) => `<span class="${n === step ? 'at' : n < step ? 'on' : ''}"><b>${n + 1}. ${l[0]}</b>${l[1]}</span>`).join('')}</div>`;
      const report = K.sect('Cause') + `<p class="dim fs-12 lh-15" >${esc(i.cause)}.</p>` +
        K.sect('Confidence', 'the report says: ' + i.conf) + ladder +
        K.sect('Hypotheses it checked', 'with the query behind each') + K.checks(x.hyp) +
        K.sect('Steps it proposes') + K.list(x.steps.map(s => ({ tone: '', html: esc(s) }))) +
        `<div class="mt-10">${K.note('This text is written by a model from the alerts and queries above. It is shown to you as it is and is passed to no other agent.', '')}</div>`;
      const seen = D.incidents.filter(o => o.svc === 'carrier-export');
      const exp = i.svc === 'carrier-export';
      const changed = id === 'INC-2291'
        ? K.kv([['Change', K.key('R2026.11', { title: true })], ['In production', '10.11 06:45, two days earlier'], ['Error rate', '0.10 % → <b class="ink">0.14 %</b>'], ['Response time p95', '190 ms → <b class="ink">240 ms</b>'], ['Compared', 'one day before against one day after']]) +
          K.note('The release changed the repository code of the stock hold table (KES-3347). Connections taken there were not given back; the pool of 20 ran empty in the morning peak.', 'bad')
        : K.kv([['Last change', K.key('R2026.10.2', { title: true })], ['In production', '30.10 10:15']]) + K.note(id === 'INC-2262' ? 'No change to carrier-export in the 20 days before.' : 'No deployment of carrier-export shortly before. The cause lies with the carrier.', '');
      const follow = K.list([{ tone: i.state === 'open' ? 'watch' : 'ok', html: K.key(i.issue, { title: true }), v: K.issue(i.issue) ? D.status[K.issue(i.issue).st] : '' }]
        .concat(D.actions.filter(a => a.from.indexOf(id) >= 0).map(a => ({ tone: 'watch', html: `<b>${a.id}</b> ${esc(a.text)} ${a.key ? K.key(a.key) : ''}`, v: a.state })))
        .concat(id === 'INC-2291' ? [{ tone: 'ok', html: '<b>ADR-030</b> Connection pool per pod from 20 to 30', v: 'decided 13.11' }] : exp ? [{ tone: 'watch', html: K.key('R2026.12', { title: true }) + ' carries the fix', v: '03.12' }] : []));
      return {
        body: K.ehead({
          kind: `Incident · ${K.pill(i.prio, i.prio === 'P2' ? 'bad' : 'watch')} ${K.pill(i.state, i.state === 'open' ? 'watch' : '')}`, title: id + ': ' + i.title,
          facts: [K.svc(i.svc), esc(i.at), 'duration <b>' + esc(i.dur) + '</b>', 'issue ' + K.key(i.issue)],
          links: [K.extLink('Monitoring', 'Monitoring'), K.extLink('Report in the incident reports', 'the Incident reports folder'), K.extLink('Jira', 'Jira')]
        }) + kpis + K.grid(
          K.panel({ title: 'Timeline', sub: i.at.slice(0, 9), w: 'c4 x3', src: ['increp', 'mon'], body: K.feed(x.tl.map(t => ({ t: t[0], tone: t[1], html: esc(t[2]), sub: t[3] ? esc(t[3]) : '' }))) }),
          K.panel({ title: 'The report of the incident reports', w: 'c8 x5', src: ['increp'], right: K.pill('confidence ' + i.conf, i.conf === 'confirmed' ? 'ok' : ''), body: report,
            help: 'Incident reports writes one report per incident by its template: service, cause, confidence, the hypotheses it checked with their queries, the steps it proposes. The app reads the file and shows it.' }),
          K.panel({ title: 'What changed before', w: 'c6 x4', src: ['ci', 'mon'], body: changed }),
          K.panel({ title: 'Related error groups', w: 'c6 x4', src: ['mon'], body: K.list(errs.map(e => ({ tone: ESTATE[e.st], html: `<button class="ent mono" data-dr="error:${e.id}">${esc(e.cls)}</button>`, v: K.fmt(e.n7) + ' in 7 d' }))) }),
          K.panel({ title: 'Follow-ups', w: 'c6 x4', src: ['jira', 'wiki'], body: follow }),
          K.panel({ title: 'Seen before', w: 'c6 x4', src: ['increp'], body: exp
            ? K.list(seen.map(o => ({ tone: o.id === id ? '' : 'bad', html: (o.id === id ? '<b>' + o.id + '</b> this one' : K.key(o.id)) + ' · ' + esc(o.at.slice(4, 9)), v: esc(o.dur) }))) + K.note('Three nights in 30 with the same cause. Decision D-3 asks whether it goes to the risk board of the train.', 'bad')
            : K.stateBlock('empty', { title: 'Not seen before', text: 'No other incident of checkout-api in the last 90 days names this cause.' }) })
        )
      };
    }
  });
})();
