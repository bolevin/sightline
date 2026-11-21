/* Domain: Product. What is built and why: PI objectives, features, backlog readiness, roadmap, business signals. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;
  const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const short = (t, n) => t.length > n ? t.slice(0, n - 2) + '…' : t;

  /* dates that matter */
  const FREEZE = '2026-11-27', FPW = '2026-12-13';
  const REL = {
    'R2026.12': { name: 'Release 2026.12', day: '2026-12-03', date: 'Thu 03.12.2026', target: FREEZE, tlabel: 'code freeze 27.11' },
    'R2027.01': { name: 'Release 2027.01', day: '2027-01-14', date: 'Thu 14.01.2027', target: '2027-01-14', tlabel: 'release 14.01' },
    'R2027.02': { name: 'Release 2027.02', day: '2027-02-11', date: 'Thu 11.02.2027', target: '2027-02-11', tlabel: 'release 11.02' },
    'next PI': { name: 'Next PI', day: '2027-02-11', date: 'PI 2027-03', target: '2027-02-11', tlabel: 'release 11.02, if planned' }
  };
  /* forecast against the date of its release: ok = late end before, watch = date inside the range, bad = early end after */
  const verdict = f => {
    const t = (f.due && f.due < REL[f.rel].target) ? f.due : REL[f.rel].target;
    return f.eta[1] <= t ? 'ok' : f.eta[0] <= t ? 'watch' : 'bad';
  };
  const vWord = { ok: 'before its date', watch: 'date inside the range', bad: 'after its date' };
  const range = f => `${K.dm(f.eta[0])} to ${K.dm(f.eta[1])}${f.eta[1] > '2026-12-31' ? '.' + f.eta[1].slice(2, 4) : ''}`;
  const relName = id => id === 'next PI' ? 'next PI' : id.replace('R', '');

  /* done / left in this sprint / later as one thin bar */
  const pbar = f => `<div style="min-width:120px"><div class="stackbar" style="height:8px">${[[f.done, 'bg-s1', 'done'], [f.left, 'bg-r4', 'left in sprint 42'], [f.later, 'bg-mute', 'later']].filter(p => p[0] > 0)
    .map(p => `<i class="${p[1]}" style="flex:${p[0]}" data-tip="${esc(p[2])}: ${p[0]} SP"></i>`).join('')}</div><span class="sp">${f.done} done · ${f.left} now · ${f.later} later</span></div>`;
  const pbarLegend = K.legend([['done', 'bg-s1'], ['left in sprint 42', 'bg-r4'], ['later', 'bg-mute']]);

  /* story points per feature and sprint: the same numbers as the PI page of Delivery */
  const CELL = { 'KES-3301': [11, 8, 15, 0, 0], 'KES-3312': [6, 7, 13, 3, 0], 'KES-3318': [3, 5, 16, 0, 0], 'KES-3325': [0, 0, 8, 5, 0], 'KES-3331': [5, 3, 3, 5, 0], 'KES-3340': [0, 5, 0, 4, 9], 'KES-3347': [5, 3, 5, 0, 0], 'KES-3352': [0, 3, 3, 2, 0] };

  /* ── Objectives ───────────────────────────────────────────────────────── */
  /* weekly status updates, due on Monday. st: ok | watch | bad | miss */
  const UPD = {
    1: [['W44', '26.10', 'ok', '14 of 34 SP done. Stock holds per warehouse show on the test system.', 'Next: release single items of a hold.'],
      ['W45', '02.11', 'ok', '17 of 34 SP done. Partial release works on test for whole warehouses.', 'Next: filter by delivery date and warehouse.'],
      ['W46', '09.11', 'ok', '19 of 34 SP done. 15 SP planned in sprint 12.3.', 'Forecast 25.11 to 27.11, inside the code freeze.'],
      ['W47', '16.11', 'ok', '27 of 34 SP done. KES-4102 and KES-4103 are done.', 'The late end of the forecast touches the code freeze on 27.11.']],
    2: [['W44', '26.10', 'ok', '9 of 29 SP done. Partial cancellation is on test.', 'Next: refund amount before the confirmation.'],
      ['W45', '02.11', 'ok', '13 of 29 SP done.', '13 SP in sprint 42, 3 SP in 12.4.'],
      ['W46', '09.11', 'ok', '13 of 29 SP done. Sprint 42 started with 4 stories of this feature.', 'Ships with release 2027.01.'],
      ['W47', '16.11', 'ok', '21 of 29 SP done. Partial cancellation and the refund preview are done.', 'Forecast 02.12 to 08.12; release 2027.01 on 14.01.']],
    3: [['W44', '26.10', 'ok', '6 of 24 SP done. Price feed v3 was promised for early November.', 'Next: take over the new price tiers.'],
      ['W45', '02.11', 'watch', '8 of 24 SP done. ATL-882 of Team Atlas has no date yet.', 'Risk R-1 opened: v3 may come too late for 13.12.'],
      ['W46', '09.11', 'bad', '8 of 24 SP done. KES-4131 is blocked by ATL-882.', 'Forecast 01.12 to 10.12: after the code freeze of release 2026.12.'],
      ['W47', '16.11', 'bad', '8 of 24 SP done, 16 SP open, 5 of them blocked.', 'Escalated to the train on 16.11. Decision D-2 due 24.11.']],
    4: [['W44', '26.10', 'watch', 'Carrier timeouts seen since 02.10. Work starts in sprint 12.3.', 'The on-call restarts the export by hand.'],
      ['W45', '02.11', 'watch', 'INC-2262 on 29.10: the export timed out again.', 'Retry design goes to the team on 03.11.'],
      ['W46', '09.11', 'watch', 'INC-2274 on 05.11. ADR-031: retries with a growing delay, at most five.', '8 SP in sprint 42, 5 SP in 12.4.'],
      ['W47', '16.11', 'miss', 'No update was written this week.', 'The last one is from 09.11; INC-2299 happened since.']],
    5: [['W44', '26.10', 'ok', '6 of 16 SP done. Keyboard use of the quantity picker is on test.', 'Next: focus order in the booking flow.'],
      ['W45', '02.11', 'ok', '8 of 16 SP done.', 'The accessibility test of the checkout runs every night.'],
      ['W46', '09.11', 'ok', '8 of 16 SP done. 6 SP planned in sprint 12.3.', 'Forecast 07.12 to 11.12.'],
      ['W47', '16.11', 'ok', '10 of 16 SP done. KES-4155 moved to sprint 43 on 11.11.', 'The last 5 SP are in 12.4.']],
    6: [['W44', '26.10', 'watch', '2 of 18 SP done. Uncommitted at PI Planning.', 'Waits for the delivery status feed of Team Carriers.'],
      ['W45', '02.11', 'watch', '5 of 18 SP done.', '13 SP left, none of them in sprint 12.3.'],
      ['W46', '09.11', 'watch', 'Will not be reached in this PI.', '4 SP in 43, 9 SP go to PI 2027-03.'],
      ['W47', '16.11', 'watch', '5 of 18 SP done, unchanged.', 'Goes to PI Planning on 14.12 as a candidate.']]
  };
  const updTone = { ok: 'ok', watch: 'watch', bad: 'bad', miss: '' };
  const updWord = { ok: 'on track', watch: 'at risk', bad: 'off track', miss: 'update missing' };
  const objSay = o => o.committed ? o.say : 'uncommitted · ' + o.say;

  function objectivesPage() {
    const O = D.objectives, com = O.filter(o => o.committed);
    const bv = sum(com, o => o.bv), onTrack = sum(com.filter(o => o.state === 'ok'), o => o.bv);
    const risk = sum(com.filter(o => o.state === 'watch'), o => o.bv), off = sum(com.filter(o => o.state === 'bad'), o => o.bv), unc = sum(O.filter(o => !o.committed), o => o.bv);
    const feats = O.map(o => K.feature(o.feat)), fDone = sum(feats, f => f.done), fAll = sum(feats, f => f.sp);
    const pred = D.predictability, last = pred[pred.length - 1];

    const table = K.table([
      { h: 'No.', n: true, v: o => '<b class="ink">' + o.n + '</b>', s: o => o.n },
      { h: 'Objective', cls: 'ttl', v: o => `<span class="ttl-t">${esc(o.text)}</span>` },
      { h: 'Kind', cls: 's', v: o => o.committed ? 'committed' : '<span class="faint">uncommitted</span>', s: o => o.committed ? 0 : 1 },
      { h: 'BV', n: true, v: o => o.bv, s: o => o.bv, tip: 'Planned business value, set by the business owners at PI Planning' },
      { h: 'State', cls: 's', v: o => K.pill(o.say, o.state), s: o => ({ ok: 0, watch: 1, bad: 2 }[o.state]) },
      { h: 'Feature', cls: 's', v: o => K.key(o.feat) },
      { h: 'Progress', v: o => pbar(K.feature(o.feat)), s: o => K.feature(o.feat).done / K.feature(o.feat).sp },
      { h: 'Forecast', cls: 's', n: true, v: o => { const f = K.feature(o.feat), v = verdict(f); return `${range(f)}<span class="sub"><span class="${v === 'ok' ? '' : 'c-' + v}">${esc(REL[f.rel].tlabel)}</span></span>`; }, s: o => K.feature(o.feat).eta[1] },
      { h: 'This week', cls: 's', v: o => { const u = UPD[o.n][3]; return u[2] === 'miss' ? '<span class="c-watch">update missing</span>' : '<span class="faint">written ' + u[1] + '</span>'; } },
      { h: '', cls: 's', v: o => `<button class="btn sm" data-dr="objective:${o.n}">Updates</button>` }
    ], O, { attrs: o => `data-dr="objective:${o.n}"` });

    const tlRows = O.map(o => { const f = K.feature(o.feat), v = verdict(f); return {
      name: `${K.dot(o.state)} <b class="ink">${o.n}</b> ${K.key(f.key)} <span class="sp">${f.sp - f.done} SP open</span>`,
      from: f.eta[0] > '2026-12-31' ? '2026-12-30' : f.eta[0], to: f.eta[1] > '2026-12-31' ? '2026-12-31' : f.eta[1], done: 1, tone: v,
      tip: `${f.key}: forecast ${range(f)} · ${REL[f.rel].tlabel}: ${vWord[v]}` }; });
    const tl = K.timeline(tlRows, '2026-11-16', '2026-12-31', { nw: 190,
      ticks: [['2026-11-16', '16.11'], ['2026-11-27', 'freeze 27.11'], ['2026-12-03', 'rel. 03.12'], ['2026-12-13', 'FPW 13.12'], ['2026-12-24', '24.12']],
      lines: [[D.now.date, 'now', 'Today, 18.11'], [FREEZE, 'due', 'Code freeze for release 2026.12: Fri 27.11'], ['2026-12-03', 'due', 'Release 2026.12: Thu 03.12'], [FPW, 'due', 'Winter sale 13.12.2026']] }) +
      K.legend([['forecast range, 85 % sure', 'bg-mute'], ['today', 'bg-dim', 1], ['code freeze, release, Winter sale', 'bg-watch', 1]]) +
      K.note(`Objective 6 runs into 2027 (${range(K.feature('KES-3340'))}): the bar is cut at 31.12. Objective 3 needs release 2026.12 to reach the Winter sale; its forecast starts after the code freeze.`, 'bad');

    const weeks = ['W44', 'W45', 'W46', 'W47'];
    const grid = `<div class="tbwrap"><table class="tb"><thead><tr><th>Objective</th>${weeks.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${O.map(o =>
      `<tr data-dr="objective:${o.n}"><td><b class="ink">${o.n}</b> <span class="faint">${o.bv} BV</span></td>${UPD[o.n].map(u => `<td class="s" data-tip="${esc(u[3] + ' ' + u[4])}">${K.pill(updWord[u[2]], updTone[u[2]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` +
      K.sect('This week', 'due Mon 16.11') + K.feed(O.filter(o => o.n === 3 || o.n === 4).map(o => { const u = UPD[o.n][3]; return { t: 'Obj. ' + o.n, tone: updTone[u[2]], html: esc(u[3]), sub: esc(u[4]) }; }));

    const value = K.stackbar([['On track', onTrack, 'bg-ok'], ['At risk', risk, 'bg-watch'], ['Off track', off, 'bg-bad'], ['Uncommitted', unc, 'bg-mute']], { unit: 'BV', h: 14 }) +
      K.sect('By objective') + K.hbars(O.map(o => ({ n: `<b class="ink">${o.n}</b> <span class="faint">${o.committed ? 'committed' : 'uncommitted'}</span>`, v: o.bv, max: 10, cls: o.committed ? o.state : 'bg-mute', label: o.bv + ' BV' })), { max: 10, nw: 110, vw: 48 }) +
      K.note(`Committed: <b>${bv} BV</b>. On track: <b>${onTrack}</b>. At stake: <b>${off} BV</b> of objective 3.`, 'bad');

    const predP = K.hbars(pred.map(p => ({ n: p.pi, v: Math.round(p.actual / p.planned * 100), max: 100, cls: p.actual / p.planned >= .8 ? 'ok' : 'watch', label: Math.round(p.actual / p.planned * 100) + ' %<span class="faint"> · ' + p.actual + '/' + p.planned + '</span>', tick: 80, tickTip: '80 %: the lower edge of the usual target band' }))
      .concat([{ n: 'PI 26.4', v: K.pct(onTrack, bv), max: 100, cls: 'bg-mute', label: K.pct(onTrack, bv) + ' %<span class="faint"> · on track now</span>', tick: 80, tickTip: '80 %' }]), { max: 100, nw: 84, vw: 128 }) +
      K.note(`If objectives 1, 2, 4 and 5 are reached and 3 misses: <b>${bv - off} of ${bv} BV</b>, ${K.pct(bv - off, bv)} %.`, 'watch');

    return {
      lede: 'The promise of PI 26.4: six objectives, the feature behind each and what the dates say about them.',
      acts: K.extLink('Open the PI objectives in the wiki', 'Wiki'),
      kpis: [
        { l: 'Committed on track', v: '3 of 5', u: 'objectives', s: '<b>1 off track</b>, 1 at risk', tone: 'bad' },
        { l: 'Planned value', v: bv, u: 'BV committed', s: `+ ${unc} BV uncommitted` },
        { l: 'Value on track', v: onTrack, u: 'of ' + bv + ' BV', s: `<b>${K.pct(onTrack, bv)} %</b> of the committed value`, tone: 'watch' },
        { l: 'Value at stake', v: off, u: 'BV', s: 'objective 3, Winter sale', tone: 'bad' },
        { l: 'Feature work done', v: fDone, u: 'of ' + fAll + ' SP', s: `<b>${K.pct(fDone, fAll)} %</b> · features of the six objectives` },
        { l: 'Updates this week', v: '5 of 6', u: 'written', s: '<b>objective 4</b> is missing', tone: 'watch' },
        { l: 'Predictability', v: K.pct(last.actual, last.planned), u: '% last PI', s: pred.map(p => K.pct(p.actual, p.planned) + ' %').join(', '), spark: pred.map(p => K.pct(p.actual, p.planned)) }
      ],
      body: K.grid(
        K.panel({ title: 'Objectives of PI 26.4', sub: 'click a row for the status updates', w: 'c12 x9', src: ['jira', 'wiki'], flush: true, body: table,
          help: 'Objectives and planned business value come from the PI Planning page in the wiki. Progress and forecast come from the feature linked to each objective in Jira.' }),
        K.panel({ title: 'Planned value', sub: 'business value by state', w: 'c4 x3', src: ['wiki', 'jira'], body: value }),
        K.panel({ title: 'Forecast against the dates', sub: '16.11 to 31.12 · bar: forecast range of the feature', w: 'c8 x5', src: ['jira'], body: tl,
          help: 'The range comes from the story points left and the pace of the team, 85 % sure. Green: the range ends before the date of its release. Amber: the date lies inside the range. Red: the range starts after it.' }),
        K.panel({ title: 'Status updates', sub: 'one per objective and week', w: 'c8 x4', src: ['wiki'], right: K.pill('1 missing', 'watch'), body: grid,
          help: 'The team writes two lines per objective every Monday on the PI page. The app reads whether an update exists and its state; hover a cell for the text.' }),
        K.panel({ title: 'Predictability', sub: 'delivered against planned BV of the committed objectives', w: 'c4 x3', src: ['jira', 'wiki'], body: predP, foot: 'actual BV is set by the business owners at the end of the PI' })
      )
    };
  }

  SM.drawer('objective', function (n) {
    const o = D.objectives.find(x => String(x.n) === String(n)); if (!o) return null;
    const f = K.feature(o.feat), v = verdict(f);
    return { kind: `PI objective ${o.n} · ${o.committed ? 'committed' : 'uncommitted'} · ${K.pill(o.say, o.state)}`, title: o.text, body:
      K.kv([['Planned value', o.bv + ' BV'], ['Feature', K.key(f.key, { title: true })], ['Progress', pbar(f)], ['Forecast', `${range(f)} · ${esc(REL[f.rel].tlabel)}: <span class="${v === 'ok' ? 'c-ok' : 'c-' + v}">${vWord[v]}</span>`], ['Release', esc(REL[f.rel].name)]]) +
      K.sect('Status updates', 'newest first') + K.feed(UPD[o.n].slice().reverse().map(u => ({ t: u[0] + ' · ' + u[1], tone: updTone[u[2]], html: `<b>${updWord[u[2]]}</b> · ${esc(u[3])}`, sub: esc(u[4]) }))) +
      (UPD[o.n][3][2] === 'miss' ? K.note('The update of this week was due on Mon 16.11. The app does not write it: it is copied into the PI page by the team.', 'watch') : '') +
      `<div class="rowf mt-14" ><a class="btn sm pri" href="#/feature/${f.key}">Open the feature</a><button class="btn sm" data-toast="This demo copies nothing. In the real tool this puts a draft of the update on the clipboard.">Copy a draft of the update</button>${K.extLink('Open in the wiki', 'Wiki')}</div>` };
  });

  /* ── Features ─────────────────────────────────────────────────────────── */
  /* story points at PI Planning and the changes since */
  const SCOPE = [
    { key: 'KES-3301', was: 31, d: 3, why: 'KES-4115 notice added, KES-4111 re-estimated' },
    { key: 'KES-3318', was: 21, d: 3, why: 'KES-4135 VAT check for small businesses added' },
    { key: 'KES-3325', was: 8, d: 5, why: 'KES-4146 after INC-2262 and INC-2274' },
    { key: 'KES-3340', was: 22, d: -4, why: 'channel choice split off to the next PI' },
    { key: 'KES-3352', was: 5, d: 3, why: 'KES-4193 after INC-2291' }
  ];
  function featuresPage() {
    const F = D.features, need = f => f.state !== 'ok';
    const done = sum(F, f => f.done), all = sum(F, f => f.sp), left = sum(F, f => f.left), later = sum(F, f => f.later);
    const add = sum(SCOPE.filter(s => s.d > 0), s => s.d), rem = -sum(SCOPE.filter(s => s.d < 0), s => s.d);
    const table = K.table([
      { h: 'Feature', cls: 'ttl', v: f => K.key(f.key, { title: true }), s: f => f.key },
      { h: 'Kind', cls: 's', v: f => esc(f.kind), s: f => f.kind },
      { h: 'Objective', n: true, v: f => f.obj ? f.obj : '<span class="faint">none</span>', s: f => f.obj || 9 },
      { h: 'BV', n: true, v: f => f.bv == null ? '<span class="faint">–</span>' : f.bv, s: f => f.bv || 0 },
      { h: 'WSJF', n: true, v: f => f.wsjf.toFixed(1), s: f => f.wsjf, tip: 'Weighted shortest job first, as set in the feature in Jira' },
      { h: 'Progress', v: f => pbar(f), s: f => f.done / f.sp },
      { h: 'SP', n: true, v: f => f.sp, s: f => f.sp },
      { h: 'Forecast', cls: 's', n: true, v: f => { const v = verdict(f); return `${range(f)}<span class="sub"><span class="${v === 'ok' ? '' : 'c-' + v}">${vWord[v]}</span></span>`; }, s: f => f.eta[1] },
      { h: 'Release', cls: 's', v: f => esc(relName(f.rel)), s: f => REL[f.rel].day },
      { h: 'State', cls: 's', v: f => K.pill(K.stateWord[f.state], f.state), s: f => ({ ok: 0, watch: 1, bad: 2 }[f.state]) }
    ], F, { attrs: f => `data-go="#/feature/${f.key}" data-f-ft="all ${f.kind.toLowerCase()} ${need(f) ? 'look' : ''}"` });

    const short3 = k => k.slice(4);
    const chart = K.chart({
      label: 'WSJF against story points left', w: 520, h: 240, right: 40, x: [0, 18], y: [0, 20], yt: [0, 5, 10, 15, 20], xt: [[0, '0'], [5, '5'], [10, '10'], [15, '15 SP left']],
      hlines: [{ y: 10, color: 'faint', dash: true, label: 'WSJF 10', left: true }],
      lines: F.map(f => ({ pts: [[f.left + f.later, f.wsjf]], color: 'dim', w: 0, label: short3(f.key) })),
      dots: F.map(f => ({ x: f.left + f.later, y: f.wsjf, r: f.bv ? 3 + f.bv / 2 : 4, color: f.kind === 'Enabler' ? 's3' : 's1', tip: `${f.key} · ${f.kind}: WSJF ${f.wsjf}, ${f.left + f.later} SP left${f.bv ? ', ' + f.bv + ' BV' : ''}` }))
    }) + K.legend([['business feature (size: BV)', 'bg-s1'], ['enabler', 'bg-s3']]) +
      K.note('Top left is high value for little work. ' + K.key('KES-3318') + ' has the highest WSJF and the most left: 16 SP.', '');

    const scope = K.table([
      { h: 'Feature', cls: 's', v: s => K.key(s.key) },
      { h: 'At planning', n: true, v: s => s.was },
      { h: 'Change', n: true, v: s => `<b class="${s.d > 0 ? 'c-watch' : 'ink'}">${s.d > 0 ? '+' : '−'}${Math.abs(s.d)}</b>` },
      { h: 'Now', n: true, v: s => K.feature(s.key).sp },
      { h: 'Why', v: s => `<span class="dim">${esc(s.why)}</span>` }
    ], SCOPE) + K.note(`Since PI Planning on 21.09: <b>+${add} SP</b> added, <b>−${rem} SP</b> removed. The eight features held ${all - add + rem} SP then and hold ${all} SP now.`, 'watch');

    const rels = ['R2026.12', 'R2027.01', 'next PI'].map(r => { const fs = F.filter(f => f.rel === r); return { n: esc(relName(r)), parts: [[sum(fs, f => f.left), 'r4', 'left in sprint 42'], [sum(fs, f => f.later), 'bg-mute', 'later']], label: sum(fs, f => f.left + f.later) + ' SP', fs: fs }; });
    const byRel = K.hbars(rels, { max: 40, nw: 74, vw: 50 }) + K.legend([['left in sprint 42', 'bg-r4'], ['later', 'bg-mute']]) +
      rels.map(r => K.sect(r.n, r.fs.length + (r.fs.length === 1 ? ' feature' : ' features')) + `<div class="faint fs-11 lh-18" >${K.keys(r.fs.map(f => f.key))}</div>`).join('');

    const kinds = ['Business', 'Enabler'].map(k => { const fs = F.filter(f => f.kind === k); return [k === 'Business' ? 'Business features' : 'Enablers', sum(fs, f => f.sp), fs]; });
    const kind = K.stackbar([[kinds[0][0], kinds[0][1], 'bg-s1'], [kinds[1][0], kinds[1][1], 'bg-s3']], { unit: 'SP', h: 14 }) +
      K.sect('Done so far') + K.hbars(kinds.map(k => ({ n: k[0], v: sum(k[2], f => f.done), max: k[1], parts: [[sum(k[2], f => f.done), k[0] === 'Enablers' ? 's3' : 's1'], [k[1] - sum(k[2], f => f.done), 'bg-mute']], label: sum(k[2], f => f.done) + ' of ' + k[1] })), { nw: 120, vw: 64 }) +
      K.note('Enablers are 34 of 155 SP of the features (22 %). The work mix of the PI counts done work by kind: see Capacity and work mix.', '');

    return {
      lede: 'The eight features of PI 26.4: what each is worth, how far it is and when it ships. Click a row to open the feature.',
      acts: K.extLink('Open the features in Jira', 'Jira'),
      kpis: [
        { l: 'Features in the PI', v: F.length, s: `${F.filter(f => f.kind === 'Business').length} business, ${F.filter(f => f.kind === 'Enabler').length} enablers` },
        { l: 'Done', v: done, u: 'of ' + all + ' SP', s: `<b>${K.pct(done, all)} %</b> at 69 % of the PI`, tone: 'watch' },
        { l: 'Left this sprint', v: left, u: 'SP', s: 'open in sprint 42', ev: 'sprint.open_sp' },
        { l: 'Later', v: later, u: 'SP', s: '19 in 43, 9 after the PI' },
        { l: 'Off track', v: F.filter(f => f.state === 'bad').length, u: 'feature', s: '<b>KES-3318</b>, 16 SP open', tone: 'bad', to: '#/feature/KES-3318' },
        { l: 'Needs a look', v: F.filter(f => f.state === 'watch').length, u: 'features', s: 'KES-3325, KES-3340, KES-3347', tone: 'watch' },
        { l: 'Scope since planning', v: `+${add} / −${rem}`, u: 'SP', s: `${all - add + rem} SP then, ${all} now`, tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Features', sub: 'click a column head to sort', w: 'c12 x8', src: ['jira'], flush: true,
          right: K.filter('ft', [['all', 'All', F.length], ['business', 'Business', 5], ['enabler', 'Enabler', 3], ['look', 'Needs a look', F.filter(need).length]]), body: table + `<div class="pd-0-14-10">${pbarLegend}</div>`,
          help: 'Every feature of the team in the PI. Forecast: the range from the story points left and the pace of the team, against the date of its release (code freeze for release 2026.12).' }),
        K.panel({ title: 'Value against effort', sub: 'WSJF against story points left', w: 'c6 x4', src: ['jira'], body: chart }),
        K.panel({ title: 'What changed in scope', sub: 'story points since PI Planning', w: 'c6 x6', src: ['jira'], flush: false, body: scope,
          help: 'The sum of the story points of the stories under each feature at the end of PI Planning, against now. Features without a change are left out.' }),
        K.panel({ title: 'Work left by release', sub: 'story points', w: 'c6 x3', src: ['jira'], body: byRel }),
        K.panel({ title: 'Business and enablers', sub: 'story points of the features', w: 'c6 x3', src: ['jira'], body: kind })
      )
    };
  }

  /* ── Backlog readiness ────────────────────────────────────────────────── */
  /* the 12 candidate stories for sprint 12.4. from: plan = the later SP of the features planned for 43 (19 SP),
     pull = stories of KES-3340 planned after the PI that could come forward (9 SP). Fields as Jira holds them. */
  const CAND = [
    { key: 'KES-4155', feat: 'KES-3331', sp: 3, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Screen reader texts for the order overview', note: 'moved out of 42 on 11.11' },
    { key: 'KES-4201', feat: 'KES-3312', sp: 3, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Pass the refund of a partial cancellation to the payment service' },
    { key: 'KES-4204', feat: 'KES-3325', sp: 3, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Export: set the retries per carrier' },
    { key: 'KES-4207', feat: 'KES-3325', sp: 2, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Export: keep the transfer log for 90 days' },
    { key: 'KES-4210', feat: 'KES-3331', sp: 2, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Screen reader texts for the cancellation flow' },
    { key: 'KES-4216', feat: 'KES-3340', sp: 3, from: 'plan', ac: 1, dep: 'CAR-415', st: 'Ready', title: 'Subscribe to delivery changes from the carrier status feed' },
    { key: 'KES-4219', feat: 'KES-3340', sp: 1, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Text template for the SMS on a delivery change' },
    { key: 'KES-4235', feat: 'KES-3352', sp: 2, from: 'plan', ac: 1, dep: null, st: 'Ready', title: 'Set the service level for the availability of the Checkout API' },
    { key: 'KES-4240', feat: 'KES-3312', sp: null, from: 'plan', ac: 0, dep: null, st: 'Funnel', title: 'Show cancellation fees separately in the refund', note: 'written on 17.11' },
    { key: 'KES-4224', feat: 'KES-3340', sp: 5, from: 'pull', ac: 1, dep: null, st: 'Ready', title: 'Detect a parcel more than a day late and tell the customer' },
    { key: 'KES-4228', feat: 'KES-3340', sp: 3, from: 'pull', ac: 0, dep: 'CAR-421', st: 'Refinement', title: 'Unsubscribe from messages and choose the channel (e-mail or SMS)' },
    { key: 'KES-4231', feat: 'KES-3340', sp: 1, from: 'pull', ac: 0, dep: null, st: 'Refinement', title: 'Show sent messages in the order history' }
  ];
  const RULES = [
    { id: 'est', h: 'Estimate', text: 'Has an estimate', field: 'Story Points is not empty', ok: c => c.sp != null },
    { id: 'link', h: 'Feature', text: 'Has a feature link', field: 'Parent Link points to a feature', ok: c => !!c.feat },
    { id: 'ac', h: 'Criteria', text: 'Acceptance criteria filled', field: 'Acceptance criteria are filled in', ok: c => !!c.ac },
    { id: 'dep', h: 'No dependency', text: 'No open dependency', field: 'no unresolved "is blocked by" link', ok: c => !c.dep },
    { id: 'st', h: 'Past Refinement', text: 'Status past Refinement', field: 'status is Ready or later', ok: c => c.st === 'Ready' }
  ];
  const ready = c => RULES.every(r => r.ok(c));
  const ckey = c => `<span class="key" data-toast="In the real tool this opens ${esc(c.key)} in Jira. This demo opens nothing outside.">${esc(c.key)}</span> <span class="ttl-t">${esc(c.title)}</span>${c.note ? `<span class="sub">${esc(c.note)}</span>` : ''}`;
  const fromWord = { plan: 'plan of 43', pull: 'from the next PI' };

  function readinessPage(ctx) {
    const cap = 28, plan = CAND.filter(c => c.from === 'plan'), pull = CAND.filter(c => c.from === 'pull');
    const rd = CAND.filter(ready), rdSp = sum(rd, c => c.sp), allSp = sum(CAND, c => c.sp), planSp = sum(plan, c => c.sp), pullSp = sum(pull, c => c.sp);
    const mark = ok => ok ? '<span class="c-ok" aria-label="yes">✓</span>' : '<span class="c-bad" aria-label="no">✕</span>';
    const table = K.table([
      { h: 'Story', cls: 'ttl', v: ckey, s: c => c.key },
      { h: 'Feature', cls: 's', v: c => c.feat ? K.key(c.feat) : '<span class="faint">none</span>', s: c => c.feat || '' },
      { h: 'SP', n: true, v: c => c.sp == null ? '<span class="faint">none</span>' : c.sp, s: c => c.sp == null ? -1 : c.sp },
      { h: 'From', cls: 's', v: c => c.from === 'pull' ? '<span class="dim">' + fromWord.pull + '</span>' : fromWord.plan, s: c => c.from }
    ].concat(RULES.map(r => ({ h: r.h, n: true, v: c => mark(r.ok(c)) + (r.id === 'dep' && c.dep ? ` <span class="faint">${K.key(c.dep)}</span>` : ''), s: c => r.ok(c) ? 1 : 0, tip: r.field }))).concat([
      { h: 'Status', cls: 's', v: c => `<span class="pill">${esc(c.st)}</span>`, s: c => c.st },
      { h: '', cls: 's', v: c => ready(c) ? K.pill('ready', 'ok') : K.pill((5 - RULES.filter(r => r.ok(c)).length) + ' missing', 'watch'), s: c => RULES.filter(r => r.ok(c)).length }
    ]), CAND, { attrs: c => `data-f-rd="all ${c.from} ${ready(c) ? 'ready' : 'notready'}"` });

    const per = K.hbars(RULES.map(r => { const n = CAND.filter(r.ok).length; return { n: esc(r.text), v: n, max: CAND.length, cls: n === CAND.length ? 'ok' : n >= 10 ? 's1' : 'watch', label: n + ' of ' + CAND.length }; }), { max: CAND.length, nw: 170, vw: 54 }) +
      K.note(`All five rules hold for <b>${rd.length} of ${CAND.length}</b> stories. The rule that fails most: acceptance criteria (${CAND.filter(c => !RULES[2].ok(c)).length} stories without).`, 'watch');

    const capP = K.hbars([
      { n: 'Capacity of 43', v: cap, cls: 'bg-mute', label: '≈ ' + cap + ' SP' },
      { n: 'All candidates', parts: [[planSp, 'r4', 'Plan of the features for 43: ' + planSp + ' SP'], [pullSp, 'r2', 'From the next PI: ' + pullSp + ' SP']], label: allSp + ' SP' },
      { n: 'Ready now', v: rdSp, cls: 'watch', label: rdSp + ' SP' }
    ], { max: 30, nw: 120, vw: 54 }) + K.legend([['plan of 43', 'bg-r4'], ['from the next PI', 'bg-r2']]) +
      K.kv([['Sprint', '43 (IP), Mon 30.11 to Fri 11.12'], ['Available', '54 person-days, team total'], ['Pace', '0.52 SP per available day, last two sprints'], ['Not estimated', '1 story (KES-4240)']]) +
      K.note(`<b>${rdSp} of about ${cap} SP</b> are ready: ${sum(plan.filter(ready), c => c.sp)} from the plan and ${sum(pull.filter(ready), c => c.sp)} from the next PI.`, 'watch');

    const reads = K.checks(RULES.map(r => ({ state: '', html: `<b>${esc(r.text)}</b>`, sub: 'Jira: ' + esc(r.field), v: CAND.filter(r.ok).length + ' of ' + CAND.length }))) +
      K.note('The check reads whether a field is filled, not whether its text is good. A story with one word in the acceptance criteria passes. Whether a story is understood is for the refinement, not for this page.', 'watch');

    const pulled = K.list(pull.map(c => ({ tone: ready(c) ? 'ok' : 'watch', html: ckey(c), v: c.sp + ' SP' }))) +
      K.note(`These ${pull.length} stories are the ${pullSp} SP of ${K.key('KES-3340')} that the plan puts after the PI. If sprint 43 has room they can come forward; until the team says so, the roadmap counts them as slipping. ${pull.filter(ready).length} of ${pull.length} is ready.`, '');

    return {
      lede: `Is the backlog ready for sprint 43, the IP sprint from 30.11 to 11.12? Five checks per story, computed from Jira fields.${ctx.hz === 'pi' ? ' The PI view adds the stories that could come forward from the next PI.' : ''}`,
      acts: K.extLink('Open the backlog in Jira', 'Jira'),
      kpis: [
        { l: 'Candidate stories', v: CAND.length, s: `${allSp} SP · ${plan.length} from the plan, ${pull.length} from the next PI` },
        { l: 'Ready for 43', v: rd.length + ' of ' + CAND.length, u: 'stories', s: 'all five checks pass', tone: 'watch' },
        { l: 'Ready story points', v: rdSp, u: 'of ≈ ' + cap + ' SP', s: `<b>${K.pct(rdSp, cap)} %</b> of the capacity`, tone: 'watch' },
        { l: 'Capacity of 43', v: '≈ ' + cap, u: 'SP', s: '54 person-days × 0.52' },
        { l: 'No acceptance criteria', v: CAND.filter(c => !c.ac).length, u: 'stories', s: 'the field is empty', tone: 'watch' },
        { l: 'Open dependency', v: CAND.filter(c => c.dep).length, u: 'stories', s: 'CAR-415, CAR-421 of Team Carriers' }
      ],
      body: K.grid(
        K.panel({ title: 'Candidate stories for sprint 43', sub: 'hover a column head for the Jira field it reads', w: 'c12 x8', src: ['jira'], flush: true,
          right: K.filter('rd', [['all', 'All', CAND.length], ['plan', 'Plan of 43', plan.length], ['pull', 'From the next PI', pull.length], ['ready', 'Ready', rd.length], ['notready', 'Not ready', CAND.length - rd.length]]), body: table,
          help: 'Stories of the team backlog planned for sprint 43, and the stories of KES-3340 that could come forward. Titles are read from Jira while you look and are kept nowhere.' }),
        K.panel({ title: 'Per rule', sub: 'stories that pass', w: 'c4 x4', src: ['jira'], body: per }),
        K.panel({ title: 'Ready against capacity', sub: 'sprint 43, story points', w: 'c4 x4', src: ['jira', 'wiki'], ev: 'capacity.avail', body: capP }),
        K.panel({ title: 'What the check reads', sub: 'five fields, nothing else', w: 'c4 x4', src: ['jira'], body: reads }),
        K.panel({ title: 'Could come forward from the next PI', sub: 'KES-3340, before PI Planning on 14.12', w: 'c12 x4', src: ['jira'], body: pulled })
      )
    };
  }

  /* ── Roadmap ──────────────────────────────────────────────────────────── */
  function roadmapPage() {
    const F = D.features, r12 = K.release('R2026.12'), K40 = K.feature('KES-3340');
    const frow = f => ({ tone: f.state, html: K.key(f.key) + ` <span class="ttl-t">${esc(short(f.title, 64))}</span>`, v: (f.left + f.later) + ' SP left' });
    const col = (id, extra) => { const R = REL[id], fs = F.filter(f => f.rel === id); return `<div>${K.sect(R.name, R.date)}${fs.length ? K.list(fs.map(frow)) : '<div class="faint fs-12 pd-6-0" >No feature has this fix version yet.</div>'}${extra}</div>`; };
    const cols = `<div class="cols3">${col('R2026.12', K.sect('What the release still needs') + K.checks(D.readiness.filter(c => c.state === 'bad').map(c => ({ state: c.state, html: esc(c.text), sub: esc(c.sub), v: esc(c.v) }))) +
        `<div class="rowf mt-8" >${K.key('R2026.12')} <span class="faint">code freeze Fri 27.11 · ${r12.issuesDone} of ${r12.issues} issues done</span></div>`)}
      ${col('R2027.01', K.sect('What the release still needs') + K.checks([{ state: 'watch', html: 'Story points left in its three features', v: sum(F.filter(f => f.rel === 'R2027.01'), f => f.left + f.later) + ' SP', sub: sum(F.filter(f => f.rel === 'R2027.01'), f => f.left) + ' in sprint 42, ' + sum(F.filter(f => f.rel === 'R2027.01'), f => f.later) + ' in 43' }, { state: '', html: 'Release page in the wiki', v: 'not yet', sub: 'the fix version exists in Jira' }]))}
      ${col('R2027.02', K.list([{ tone: 'watch', html: K.key('KES-3340') + ' <span class="ttl-t">would fit if the forecast holds</span>', v: 'late end ' + K.dm(K40.eta[1]) }]) + K.note('Its fix version is "next PI": it gets a release at PI Planning on 14.12.', ''))}</div>`;

    const rows = F.slice().sort((a, b) => REL[a.rel].day.localeCompare(REL[b.rel].day) || a.eta[1].localeCompare(b.eta[1])).map(f => ({
      name: `${K.dot(f.state)} ${K.key(f.key)} <span class="ttl-t">${esc(short(f.title, 44))}</span>`,
      from: f.key === 'KES-3340' ? '2026-10-19' : f.key === 'KES-3325' ? '2026-11-09' : '2026-10-01', to: f.eta[1],
      done: f.done / f.sp, tone: f.state, tip: `${f.key}: ${f.done} of ${f.sp} SP done · forecast ${range(f)} · ships in ${relName(f.rel)}` }));
    const tl = K.timeline(rows, '2026-10-01', '2027-02-28', { nw: 360,
      ticks: [['2026-10-01', 'Oct'], ['2026-11-01', 'Nov'], ['2026-11-27', '27.11'], ['2026-12-14', 'PI Pl.'], ['2027-01-01', 'Jan'], ['2027-01-14', '14.01'], ['2027-02-11', '11.02']],
      lines: [[D.now.date, 'now', 'Today, 18.11'], [FREEZE, 'due', 'Code freeze for release 2026.12: Fri 27.11'], ['2026-12-03', 'due', 'Release 2026.12: Thu 03.12'], [FPW, 'due', 'Winter sale 13.12.2026'],
        ['2026-12-14', '', 'PI Planning PI 2027-03: 14.12 and 15.12'], ['2027-01-14', '', 'Release 2027.01 planned: Thu 14.01.2027'], ['2027-02-11', '', 'Release 2027.02 planned: Thu 11.02.2027']] }) +
      K.legend([['on track', 'bg-ok'], ['needs a look', 'bg-watch'], ['off track', 'bg-bad'], ['today', 'bg-dim', 1], ['code freeze, release 2026.12, Winter sale', 'bg-watch', 1], ['PI Planning and later releases', 'bg-mute', 1]]);

    const nnl = `<div class="cols3"><div>${K.sect('Now', 'PI 26.4, until 11.12')}${K.list(F.filter(f => f.rel !== 'next PI').map(f => ({ tone: f.state, html: K.key(f.key) + ` <span class="ttl-t">${esc(short(f.title, 40))}</span>`, v: esc(relName(f.rel)) })))}</div>
      <div>${K.sect('Next', 'PI 2027-03, planned on 14.12')}${K.list([{ tone: 'watch', html: K.key('KES-3340') + ' <span class="ttl-t">the 9 SP that slip</span>', v: '9 SP' },
        { tone: '', html: '<span class="dim">Orders with split delivery across carriers</span>', v: 'proposal' }, { tone: '', html: '<span class="dim">Collective invoice for schools and clubs</span>', v: 'proposal' }])}
        <div class="faint fs-11 mt-6" >Proposals sit in the funnel of the train and are no feature of the team yet.</div></div>
      <div>${K.sect('Later', 'no PI yet')}${K.list([{ tone: '', html: '<span class="dim">Choice of carrier for bulk orders</span>', v: 'idea' }, { tone: '', html: '<span class="dim">Replace Order mail with the platform service</span>', v: 'idea' }])}</div></div>`;

    const dates = K.list([
      { tone: 'watch', html: '<b>Fri 27.11</b> · code freeze for release 2026.12', v: '7 working days' },
      { tone: '', html: '<b>Mon 30.11</b> · sprint 43 (IP) starts', v: 'to 11.12' },
      { tone: 'watch', html: '<b>Thu 03.12</b> · ' + K.key('R2026.12') + ' release 2026.12', v: '4 features' },
      { tone: '', html: '<b>Fri 11.12</b> · PI 26.4 ends', v: '' },
      { tone: 'bad', html: '<b>Sun 13.12</b> · Winter sale: new price tiers must be live', v: 'objective 3' },
      { tone: '', html: '<b>Mon 14.12 and Tue 15.12</b> · PI Planning for PI 2027-03', v: '' },
      { tone: '', html: '<b>Thu 14.01.2027</b> · release 2027.01, planned', v: '3 features' },
      { tone: '', html: '<b>Thu 11.02.2027</b> · release 2027.02, planned', v: '' }
    ]);
    const slip = K.hbars([{ n: K.key('KES-3340'), parts: [[K40.done, 's1', 'Done in 41: 5 SP'], [4, 'r4', 'Planned in 43: 4 SP'], [9, 'watch', 'After the PI: 9 SP']], label: K40.sp + ' SP' }], { max: K40.sp, nw: 74, vw: 50 }) +
      K.legend([['done', 'bg-s1'], ['sprint 43', 'bg-r4'], ['after the PI', 'bg-watch']]) +
      K.note(`<b>9 of its 13 later SP</b> go to PI 2027-03. Objective 6 is uncommitted (4 BV): the committed value does not change.`, 'watch') +
      K.sect('At risk of slipping') + K.list([{ tone: 'bad', html: K.key('KES-3318') + ' out of release 2026.12', v: '16 SP', cite: 'decision D-2, due 24.11' }, { tone: 'watch', html: K.key('KES-3325') + ' forecast ends 11.12', v: '8 SP' }]);

    return {
      lede: 'Q4 2026 and one step beyond: which feature ships in which release, the dates around them and what moves to the next PI.',
      kpis: [
        { l: 'In release 2026.12', v: F.filter(f => f.rel === 'R2026.12').length, u: 'features', s: `<b>${sum(F.filter(f => f.rel === 'R2026.12'), f => f.left + f.later)} SP</b> left`, tone: 'bad', to: '#/release/R2026.12' },
        { l: 'Code freeze', v: '27.11', s: '7 working days from today', tone: 'watch' },
        { l: 'In release 2027.01', v: F.filter(f => f.rel === 'R2027.01').length, u: 'features', s: `${sum(F.filter(f => f.rel === 'R2027.01'), f => f.left + f.later)} SP left · 14.01` },
        { l: 'Winter sale', v: '13.12', s: '<b>objective 3</b> depends on it', tone: 'bad' },
        { l: 'Slips out of the PI', v: 9, u: 'SP', s: 'KES-3340, uncommitted', tone: 'watch' },
        { l: 'PI Planning', v: '14.12', s: 'and 15.12, for PI 2027-03' }
      ],
      body: K.grid(
        K.panel({ title: 'Releases', sub: 'features by fix version', w: 'c12 x8', src: ['jira', 'ci', 'wiki'], body: cols }),
        K.panel({ title: 'Now, next, later', w: 'c12 x4', src: ['jira'], body: nnl }),
        K.panel({ title: 'Features on the line', sub: '01.10.2026 to 28.02.2027 · bar: start to the late end of the forecast · fill: share done', w: 'c12 x12', src: ['jira'], body: tl,
          help: 'One lane per feature, ordered by release. The forecast end comes from the story points left and the pace of the team, 85 % sure.' }),
        K.panel({ title: 'Dates around the work', w: 'c6 x6', src: ['jira', 'wiki'], body: dates }),
        K.panel({ title: 'What slips to the next PI', w: 'c6 x6', src: ['jira'], body: slip })
      )
    };
  }

  /* ── Business signals ─────────────────────────────────────────────────── */
  /* 14 days, 04.11 to 17.11; the first seven average to prev, the last seven are the spark of data.js */
  const FIRST7 = { b1: [168, 172, 175, 166, 170, 178, 168], b2: [18, 20, 17, 19, 21, 20, 18], b3: [28, 29, 30, 28, 29, 30, 29], b4: [39200, 39900, 40300, 39500, 39700, 40400, 39600], b5: [3760, 3820, 3740, 3800, 3790, 3830, 3790] };
  const DAYS = ['04.11', '05.11', '06.11', '07.11', '08.11', '09.11', '10.11', '11.11', '12.11', '13.11', '14.11', '15.11', '16.11', '17.11'];
  const series = b => FIRST7[b.id].concat(b.spark);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  function sigChart(b, o) {
    o = o || {};
    const k = o.k || 1, s = series(b).map(v => v / k), lo = o.y[0], hi = o.y[1];
    return K.chart({ label: b.name, w: 520, h: o.h || 170, left: 40, right: 16, x: [0, 13], y: [lo, hi], yt: o.yt, yu: o.yu || '',
      xt: [[0, '04.11'], [3, '07.11'], [6, '10.11'], [9, '13.11'], [13, '17.11']],
      vmarks: [{ x: 6, color: 's3', label: 'release 2026.11', tip: 'Release 2026.11 in production, Tue 10.11', dash: false }, { x: 9, color: 's3', label: 'hotfix', tip: 'Hotfix 2026.11.1 in production, Fri 13.11', row: 1 }],
      hlines: [{ y: mean(FIRST7[b.id]) / k, color: 'faint', dash: true, label: 'before: ' + K.fmt(Math.round(mean(FIRST7[b.id]))), left: true }],
      lines: [{ pts: s.map((v, i) => [i, v]), color: o.color || 's1', end: true, tip: (x, y) => `${DAYS[x]}: ${K.fmt(Math.round(y * k))}` }] });
  }
  function signalsPage(ctx) {
    const B = id => D.business.find(b => b.id === id);
    const b1 = B('b1'), b2 = B('b2'), b3 = B('b3'), b4 = B('b4'), b5 = B('b5');
    const kd = (b, l, u, tone) => ({ l: l, v: K.fmt(b.v), u: u, s: `before the release ${K.fmt(b.prev)}`, spark: b.spark, tone: tone });
    const ba = [b1, b2, b3].map(b => { const be = mean(FIRST7[b.id]), af = mean(b.spark), d = (af - be) / be * 100; return { b: b, be: be, af: af, d: d }; });
    const baT = K.table([
      { h: 'Counter', cls: 'ttl', v: r => `<span class="ttl-t">${esc(r.b.name)}</span>` },
      { h: '7 days before', n: true, v: r => r.be.toFixed(r.b.id === 'b1' ? 0 : 1) },
      { h: '7 days after', n: true, v: r => `<b class="ink">${r.af.toFixed(r.b.id === 'b1' ? 0 : 1)}</b>` },
      { h: 'Change', n: true, v: r => `<span class="${r.b.id === 'b3' && r.d > 0 ? 'c-watch' : ''}">${r.d > 0 ? '+' : '−'}${Math.abs(r.d).toFixed(1)} %</span>` },
      { h: 'Days', v: r => K.spark(series(r.b), { w: 90, h: 22, color: r.b.id === 'b3' ? 'watch' : 's1' }) }
    ], ba);
    return {
      lede: 'What the applications do for the business, counted by saved searches in the log search. Log search is stale: the panels show the read of 06:10.',
      acts: K.extLink('Open the saved searches in the log search', 'Log search'),
      kpis: [
        kd(b1, 'Group bookings', 'per day'), kd(b2, 'Online cancellations', 'per day'), kd(b3, 'Booking drop-off', '%', 'watch'),
        kd(b4, 'Price lookups', 'per day'), kd(b5, 'Exported per night', 'orders', 'bad'),
        { l: 'Customer bugs', v: D.bugs.customer, u: 'open', s: 'count only: customer data', to: '#/quality/bugs' }
      ],
      body: K.grid(
        K.panel({ title: 'Bookings', sub: esc(b1.name) + ' and ' + esc(b2.name), w: 'c6 x3', src: ['logs'], body: sigChart(b1, { y: [140, 200], yt: [140, 160, 180, 200], h: 150 }) + sigChart(b2, { y: [10, 30], yt: [10, 20, 30], h: 130, color: 's3' }) + K.legend([['bookings', 'bg-s1', 1], ['cancellations', 'bg-s3', 1], ['mean of the 7 days before the release', 'bg-off', 1]]) }),
        K.panel({ title: 'Booking flow', sub: esc(b3.name) + ', % of started bookings', w: 'c6 x3', src: ['logs'], body: sigChart(b3, { y: [24, 36], yt: [24, 28, 32, 36], yu: ' %', color: 'watch' }) +
          K.note('Drop-off rose to <b>34 %</b> on 15.11, two days after the hotfix, and is back at 31 %. The error group of a negative total after a partial cancellation (KES-4190) started on 10.11.', 'watch') }),
        K.panel({ title: 'Price lookups', sub: esc(b4.name) + ', thousands', w: 'c6 x3', src: ['logs'], body: sigChart(b4, { k: 1000, y: [37, 43], yt: [37, 39, 41, 43], yu: 'k' }) +
          K.note('Lookups keep rising towards the Winter sale. Errors of the pricing-engine since 17.11 21:12 are not in this count yet.', '') }),
        K.panel({ title: 'Nightly export', sub: esc(b5.name), w: 'c6 x3', src: ['logs', 'increp'], body: sigChart(b5, { y: [0, 4500], yt: [0, 1500, 3000, 4500], color: 's1' }) +
          K.note('<b>0</b> in the night of 16 to 17.11: ' + K.key('INC-2299') + ', the job gave up at 05:00 and was restarted by hand.', 'bad') }),
        K.panel({ title: 'Before and after release 2026.11', sub: 'mean of the 7 days up to the release day against the 7 days after', w: 'c6 x6', src: ['logs'], flush: true, body: baT +
          `<div class="pd-8-14-12">${K.note('A change after a release is not caused by it. The week after 10.11 also held INC-2291 and the hotfix.', '')}</div>` }),
        K.panel({ title: 'Bugs reported by customers', w: 'c3 x3', src: ['jira'], state: 'held', right: K.pill(D.bugs.customer + ' open', 'watch'),
          empty: { title: D.bugs.customer + ' open bugs reported by customers', text: 'Their titles stay in Jira: they can hold customer data. The app shows the count only.' } }),
        K.panel({ title: 'What stakeholders asked for', w: 'c3 x3', src: ['chat'], would: 'requests to the team from two team chat channels, with their age' })
      )
    };
  }

  SM.domain({
    id: 'product', title: 'Product', icon: 'product',
    pages: [
      { id: 'objectives', title: 'Objectives', hz: ['pi'], was: 'new', from: 'PI (was empty), Promises', find: 'pi objectives business value status updates predictability committed', render: objectivesPage },
      { id: 'features', title: 'Features', hz: ['pi', 'quarter'], was: 'new', from: '', find: 'features wsjf business value scope progress forecast', render: featuresPage },
      { id: 'readiness', title: 'Backlog readiness', hz: ['sprint', 'pi'], was: 'new', from: '', find: 'refinement definition of ready backlog stories acceptance criteria', render: readinessPage },
      { id: 'roadmap', title: 'Roadmap', hz: ['quarter'], was: 'new', from: '', find: 'roadmap releases now next later winter sale pi planning', render: roadmapPage },
      { id: 'signals', title: 'Business signals', hz: ['today', 'sprint', 'pi'], was: 'new', from: '', find: 'business counters bookings cancellations log search customers stakeholders', render: signalsPage }
    ]
  });

  /* ── Feature (entity) ─────────────────────────────────────────────────── */
  const ADR = { 'KES-3325': ['ADR-031'], 'KES-3347': ['ADR-029'], 'KES-3352': ['ADR-030'] };
  const ACT = {
    'KES-3301': [['18.11 10:52', 'ok', '#233 of KES-4108 approved, build green', 'checkout-web'], ['16.11', '', 'KES-4111 moved to Implementing', ''], ['13.11', 'ok', 'KES-4102 done', 'Show stock holds per warehouse in the checkout'], ['12.11', 'ok', 'KES-4103 done', 'Release part of a hold'], ['09.11', '', 'Sprint 42 started with 5 stories, 15 SP', ''], ['06.11', '', 'Sprint 41 closed: 19 of 34 SP done', '']],
    'KES-3312': [['18.11', 'ok', '#416 of KES-4127 approved', 'checkout-api'], ['17.11', 'watch', '#412 of KES-4124 in its second review round', '26 h waiting'], ['16.11', 'ok', 'KES-4121 done', 'The refund before the confirmation'], ['12.11', 'ok', 'KES-4120 done in its second sprint', ''], ['11.11', '', 'KES-4124 moved to Implementing', ''], ['06.11', '', 'KES-4201 refined for sprint 43, 3 SP', '']],
    'KES-3318': [['17.11 21:12', 'bad', 'New error group in pricing-engine: 504 from /v3/price-tiers', '268 events in 24 h'], ['17.11 16:40', 'bad', 'Main of pricing-engine red', 'contract test against the price feed v3'], ['16.11', 'bad', 'Risk R-1 escalated to the train', 'fallback: static price tiers for two weeks'], ['16.11', '', '#118 of KES-4139 opened', ''], ['09.11', 'bad', 'State set to off track', 'forecast after the code freeze'], ['06.11', 'bad', 'KES-4131 blocked by ATL-882', 'Team Atlas, no date']],
    'KES-3325': [['18.11 09:14', '', '#97 of KES-4146 opened, build running', 'carrier-export'], ['17.11 02:09', 'bad', 'INC-2299: nightly export timed out', 'third time in 30 nights'], ['16.11', 'ok', 'KES-4143 done', 'log every transfer'], ['13.11', 'ok', 'KES-4142 done', 'Retry with a growing delay'], ['05.11 02:12', 'bad', 'INC-2274: nightly export timed out', ''], ['03.11', 'ok', 'ADR-031 decided', 'at most five attempts']],
    'KES-3331': [['18.11', '', '#236 of KES-4151 opened', 'checkout-web'], ['16.11 22:00', 'watch', 'Accessibility test of the checkout: 58 of 64 passed', '6 product bugs'], ['12.11', 'ok', 'KES-4150 done', 'Keyboard use of the quantity picker'], ['11.11', '', 'KES-4155 moved to sprint 43', '3 SP'], ['09.11', '', 'Sprint 42 started with 2 stories, 3 SP', ''], ['06.11', '', 'Sprint 41 closed: 8 of 16 SP done', '']],
    'KES-3340': [['18.11', 'watch', 'KES-4224 still in Refinement without acceptance criteria', 'candidate for PI 2027-03'], ['13.11', 'watch', 'KES-4216 linked to CAR-415 of Team Carriers', 'open dependency'], ['09.11', '', 'Objective 6: will not be reached in this PI', 'status update W46'], ['06.11', '', 'Sprint 41 closed: 5 SP done', ''], ['30.10', '', 'Plan: 4 SP in sprint 43, 9 SP to the next PI', ''], ['19.10', '', 'Sprint 41 started with 2 stories of this feature', '']],
    'KES-3347': [['18.11', 'watch', 'Risk R-4: dry run of the migration on INT on 20.11', ''], ['16.11', 'bad', 'KES-4160 in Implementing for 24 days', ''], ['09.11', 'bad', 'KES-4160 carried into its third sprint', ''], ['06.11', '', 'Sprint 41 closed: step 2 of the migration, 3 SP', ''], ['16.10', '', 'Sprint 40 closed: step 1 of the migration, 5 SP', ''], ['08.10', 'ok', 'ADR-029 decided', 'migration in three steps without downtime']],
    'KES-3352': [['18.11', 'ok', 'KES-4235 ready for sprint 43', '2 SP'], ['13.11', 'watch', 'KES-4193 came into sprint 42', 'from the postmortem of INC-2291'], ['13.11', 'ok', 'ADR-030 decided', 'connection pool per pod from 20 to 30'], ['12.11 07:42', 'bad', 'INC-2291: orders not possible for 26 min', 'checkout-api'], ['06.11', '', 'Sprint 41 closed: 3 SP done', ''], ['02.11', 'watch', 'Hygiene: feature has no due date', '']]
  };

  SM.entity({
    kind: 'feature', title: 'Features', domain: 'product', list: '#/product/features', hz: ['sprint', 'pi'], was: 'new', from: '',
    ids: () => D.features.map(f => f.key),
    render(id) {
      const f = K.feature(id), o = D.objectives.find(x => x.feat === id), v = verdict(f);
      const its = D.issues.filter(i => i.feat === id), keys = its.map(i => i.key);
      const prs = D.prs.filter(p => keys.indexOf(p.issue) >= 0), blocked = its.filter(i => i.st === 'blocked');
      const risks = D.risks.filter(r => r.links.some(l => l === id || keys.indexOf(l) >= 0));
      const decs = D.decisions.filter(d => (d.title + ' ' + d.text).indexOf(id) >= 0 || (ADR[id] || []).indexOf(d.id) >= 0);
      const cell = CELL[id], doneIts = its.filter(i => i.st === 'done').length;
      const tgt = (f.due && f.due < REL[f.rel].target) ? f.due : REL[f.rel].target;

      const head = K.ehead({
        kind: `Feature · ${esc(f.kind)} · ${K.pill(K.stateWord[f.state], f.state)}`, title: f.key + ' ' + f.title,
        facts: [o ? `Objective <b>${o.n}</b> · ${esc(objSay(o))}` : 'No objective', `BV <b>${f.bv == null ? '–' : f.bv}</b>`, `WSJF <b>${f.wsjf.toFixed(1)}</b>`, `Release <b>${esc(relName(f.rel))}</b>`, `Forecast <b>${range(f)}</b>`, 'Applications ' + f.svc.map(K.svc).join(', ')],
        links: [K.extLink('Open in Jira', 'Jira'), o ? `<button class="btn sm" data-dr="objective:${o.n}">Objective ${o.n}</button>` : '']
      });
      const kpis = K.kpis([
        { l: 'Done', v: f.done, u: 'of ' + f.sp + ' SP', s: `<b>${K.pct(f.done, f.sp)} %</b>`, tone: f.state },
        { l: 'Left this sprint', v: f.left, u: 'SP', s: 'open in sprint 42' },
        { l: 'Later', v: f.later, u: 'SP', s: cell[4] ? `<b>${cell[4]} after the PI</b>` : cell[3] ? 'in sprint 43' : 'nothing planned later', tone: cell[4] ? 'watch' : '' },
        { l: 'Stories in 42', v: its.length ? doneIts + ' of ' + its.length : 'none', u: its.length ? 'done' : '', s: its.length ? sum(its, i => i.sp) + ' SP in the sprint' : 'nothing in this sprint' },
        { l: 'Forecast', v: K.dm(f.eta[1]), u: 'late end', s: `${esc(REL[f.rel].tlabel)}: <b>${vWord[v]}</b>`, tone: v },
        { l: 'Open pull requests', v: prs.length, s: prs.length ? prs.map(p => '#' + p.id).join(', ') : 'none' },
        { l: 'Blocked', v: blocked.length, u: 'items', s: blocked.length ? `<b>${blocked.map(i => i.key + ' by ' + i.blockedBy).join(', ')}</b>` : 'nothing blocked', tone: blocked.length ? 'bad' : '' }
      ]);

      const labels = ['40', '41', '42', '43 IP', 'after the PI'], st = ['done', 'done', 'scope now', 'planned', 'slips'];
      const prog = K.hbars(cell.map((n, i) => ({ n: labels[i] + ` <span class="faint">${st[i]}</span>`, v: n, max: 16, cls: i < 2 ? 's1' : i === 2 ? 'r4' : i === 3 ? 'bg-mute' : 'watch', label: n ? n + ' SP' : '<span class="faint">·</span>' })), { max: 16, nw: 130, vw: 48 }) +
        (cell[2] ? K.note(`Sprint 42: <b>${cell[2] - f.left} of ${cell[2]} SP</b> done so far.`, '') : K.note('Nothing of this feature in sprint 12.3.', ''));

      const rd = (risks.length || decs.length) ? K.list(risks.map(r => ({ tone: r.level, html: `<button class="key" data-dr="risk:${r.id}">${r.id}</button> ${esc(r.title)}`, v: esc(r.roam) })).concat(decs.map(d => ({ tone: d.level || 'ok', html: `<button class="key" data-dr="decision:${d.id}">${d.id}</button> ${esc(d.title)}`, v: d.state === 'made' ? 'decided ' + esc(d.on) : 'due ' + esc(d.due) }))))
        : K.stateBlock('empty', { title: 'No risk or decision names it', text: 'Risks and decisions are matched by the keys of the feature and its stories.' });

      const pipes = f.svc.map(s => D.builds.pipes.find(p => p.repo === s)).filter(Boolean);
      const code = (prs.length ? K.list(prs.map(p => ({ tone: p.build === 'red' ? 'bad' : p.wait >= 24 ? 'watch' : '', html: `<button class="key" data-dr="pr:${p.id}">#${p.id}</button> ${K.key(p.issue)} <span class="faint">${esc(p.repo)}</span>`, v: `${p.st === 'first' ? 'no review yet' : p.st} · ${p.wait} h` })))
        : '<div class="faint fs-12 pd-4-0" >No open pull request of its stories.</div>') +
        K.sect('Main builds of its applications') + K.checks(pipes.map(p => ({ state: p.state, html: K.svc(p.repo), sub: p.why ? 'red since ' + esc(p.since) + ': ' + esc(p.why) : 'last run ' + esc(p.last) + ' · ' + p.tests + ' tests', v: p.green + ' of ' + p.runs + ' green' })));

      let ships;
      if (f.rel === 'R2026.12') {
        const r = K.release('R2026.12');
        ships = K.kv([['Release', K.key('R2026.12') + ' ' + esc(r.date)], ['Code freeze', esc(r.freeze)], ['Issues of the release', r.issuesDone + ' of ' + r.issues + ' done'], ['This feature', `${f.left + f.later} SP open · forecast <span class="c-${v === 'ok' ? 'ok' : v}">${vWord[v]}</span>`]]) +
          K.sect('What the release still needs') + K.checks(D.readiness.filter(c => c.state === 'bad').map(c => ({ state: c.state, html: esc(c.text), v: esc(c.v) }))) +
          (id === 'KES-3318' ? K.note('Decision D-2: release 2026.12 without the school price tiers, or move the release to 08.12. Due Tue 24.11.', 'bad') : '');
      } else if (f.rel === 'R2027.01') {
        ships = K.kv([['Release', 'Release 2027.01, planned ' + esc(REL['R2027.01'].date)], ['This feature', `${f.left + f.later} SP open · forecast ${range(f)}`], ['Margin', 'the forecast ends five weeks before the release']]) +
          K.note('The release has no release page in the wiki yet: its checks start when it does.', '');
      } else {
        ships = K.kv([['Fix version', 'next PI'], ['Would fit', 'release 2027.02, planned ' + esc(REL['R2027.02'].date)], ['This feature', `${f.later} SP later: 4 in sprint 43, 9 after the PI`]]) +
          K.note('Gets a release at PI Planning on 14.12 and 15.12.', 'watch');
      }

      const feed = K.feed((ACT[id] || []).map(a => ({ t: a[0], tone: a[1], html: esc(a[2]), sub: esc(a[3]) })));
      return {
        body: head + kpis + K.grid(
          K.panel({ title: 'Stories in sprint 42', w: 'c8 x6', src: ['jira', 'git'], flush: true, right: its.length ? K.pill(its.length + ' · ' + sum(its, i => i.sp) + ' SP', '') : '',
            body: K.issueTable(its, { hide: ['Feature'], empty: { title: 'No story of this feature in sprint 42', text: f.later ? `Its ${f.later} later SP are planned for sprint 43 and the next PI.` : 'Nothing is planned for it in this sprint.', act: 'Open backlog readiness', to: '#/product/readiness' } }) }),
          K.panel({ title: 'Progress by sprint', sub: 'story points', w: 'c4 x3', src: ['jira'], body: prog, help: 'Done story points for closed sprints, scope for the running one, plan for what is ahead. The same numbers as the PI page.' }),
          K.panel({ title: 'Risks and decisions', w: 'c4 x3', src: ['wiki', 'jira'], body: rd }),
          K.panel({ title: 'Code and tests', sub: 'pull requests of its stories', w: 'c4 x4', src: ['git', 'ci'], body: code }),
          K.panel({ title: 'Where it ships', w: 'c4 x4', src: ['jira', 'wiki'], body: ships }),
          K.panel({ title: 'Activity', sub: 'last changes', w: 'c12 x4', src: ['jira', 'git', 'ci'], body: feed })
        )
      };
    }
  });
})();
