/* Domain: Delivery. Planning and delivery of the sprint and the PI: commitment, flow, capacity, dependencies, hygiene. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, S = D.sprint;
  const open = D.issues.filter(i => i.st !== 'done');
  const sumSp = a => a.reduce((s, i) => s + (i.sp || 0), 0);

  /* shared view: a table of issues. Used by other domains too. */
  K.issueTable = function (list, o) {
    o = o || {};
    const cols = [
      { h: 'Issue', cls: 'ttl', v: i => K.key(i.key, { title: true }), s: i => i.key },
      { h: 'Type', cls: 's', v: i => esc(i.type || 'Bug'), s: i => i.type || 'Bug' },
      { h: 'Status', cls: 's', v: i => K.status(i.st), s: i => D.statusOrder.indexOf(i.st) },
      { h: 'SP', n: true, v: i => i.sp == null ? '<span class="faint">none</span>' : i.sp, s: i => i.sp == null ? -1 : i.sp },
      { h: 'Days in status', n: true, v: i => i.st === 'done' ? '<span class="faint">–</span>' : `<span class="${i.dis >= D.flow.p85 ? 'c-bad' : i.dis >= D.flow.p50 ? 'c-watch' : ''}">${i.dis}</span>`, s: i => i.st === 'done' ? -1 : i.dis, tip: 'Amber: longer than half of the finished items took in total. Red: longer than 85 % of them.' },
      { h: 'Sprint no.', n: true, v: i => i.n > 1 ? `<span class="${i.n > 2 ? 'c-bad' : 'c-watch'}">${i.n}</span>` : '1', s: i => i.n, tip: 'In which sprint of this board the item is now' },
      { h: 'Feature', cls: 's', v: i => i.feat ? K.key(i.feat) : '<span class="faint">none</span>', s: i => i.feat || '' },
      { h: 'Application', cls: 's', v: i => K.svc(i.svc), s: i => i.svc },
      { h: 'Pull request', cls: 's', v: i => i.pr ? `<button class="key" data-dr="pr:${i.pr}">#${i.pr}</button>` : '<span class="faint">–</span>', s: i => i.pr || 0 }
    ].filter(c => !o.hide || o.hide.indexOf(c.h) < 0);
    return K.table(cols, list, { attrs: o.attrs, empty: o.empty });
  };
  const flags = i => ['all', i.st !== 'done' ? 'open' : 'done', i.st === 'blocked' ? 'blocked' : '', i.added ? 'added' : '', i.sp == null ? 'nosp' : '', i.n > 1 ? 'carried' : ''].join(' ');

  /* ── Sprint ───────────────────────────────────────────────────────────── */
  function sprintPage(ctx) {
    const sp = ctx.sp;
    if (sp.state === 'future') {
      return { lede: `${esc(sp.name)}, ${K.dm(sp.from)} to ${K.dm(sp.to)}. The sprint has not started.`, body: K.grid(K.panel({ title: 'Nothing committed yet', w: 'c12', src: ['jira'], state: 'empty',
        empty: { title: 'The sprint starts on Mon 30.11', text: 'Commitment, forecast and board appear when Start is pressed in Jira. What is planned for it so far is on the PI page.', act: 'Open the PI', to: '#/delivery/pi' } })) };
    }
    if (sp.state === 'closed') {
      return {
        lede: `${esc(sp.name)}, ${K.dm(sp.from)} to ${K.dm(sp.to)}. Closed. Click a sprint on the line above to move between sprints.`,
        kpis: [
          { l: 'Committed at the start', v: sp.committed, u: 'SP' }, { l: 'Completed', v: sp.done, u: 'SP', s: `<b>${K.pct(sp.done, sp.committed)} %</b> of the commitment`, tone: sp.done / sp.committed >= .9 ? 'ok' : 'watch' },
          { l: 'Items', v: sp.doneItems + ' of ' + sp.items, s: 'done at the end' }, { l: 'Came in after the start', v: '+' + sp.addedSp, u: 'SP' }, { l: 'Taken out', v: '−' + sp.removedSp, u: 'SP' }
        ],
        body: K.grid(
          K.panel({ title: 'What the sprint delivered', w: 'c7', src: ['jira'], body: K.hbars([
            { n: 'Committed', v: sp.committed, cls: 'bg-mute', label: sp.committed + ' SP' }, { n: 'Completed', v: sp.done, cls: 's1', label: sp.done + ' SP' },
            { n: 'Came in later', v: sp.addedSp, cls: 's3', label: sp.addedSp + ' SP' }, { n: 'Taken out', v: sp.removedSp, cls: 'bg-off', label: sp.removedSp + ' SP' }], { max: 70 }),
            foot: 'as Jira\'s sprint report counts' }),
          K.panel({ title: 'Board and backlog of a closed sprint', w: 'c5', src: ['jira'], state: 'empty', empty: { title: 'This demo holds the detail of sprint 42 only', text: 'In the real tool a closed sprint shows the same panels as the active one, frozen at its end. Closed sprints are read once and kept.', act: 'Back to 42', to: '#/delivery/sprint' } })
        )
      };
    }
    const f = S.forecast, x15 = [0, 15], blocked = D.issues.filter(i => i.st === 'blocked');
    const yr = K.nice(Math.max(S.scopeSp, S.committedSp, f.p50) * 1.08);
    const burn = K.chart({
      label: 'Burn-up of sprint 42', w: 760, h: 250, right: 112, x: x15, y: [0, yr[0]], yt: yr[1], yu: '',
      xt: [[0, '09.11'], [3, '12.11'], [5, '16.11'], [8, 'today'], [10, '20.11'], [13, '25.11'], [15, '27.11']],
      areas: [{ pts: [[8, S.doneSp, S.doneSp], [15, f.p85, f.p50]], color: 's1', op: .16, tip: 'Between the two forecast lines' }],
      hlines: [{ y: S.committedSp, color: 'faint', dash: true, label: 'committed at the start ' + K.fmt(S.committedSp), left: true }],
      vmarks: [{ x: 8, color: 'ink', label: 'day 8 of 15', dash: false }, { x: 3, color: 'faint', label: '', tip: '12.11: KES-4188 came in after INC-2291' }],
      lines: [
        { pts: S.scope.map((v, i) => [i, v]).concat([[15, S.scopeSp]]), color: 'dim', w: 1.5, label: 'scope ' + K.fmt(S.scopeSp), tip: (x, y) => `Day ${x}: scope ${y} SP` },
        { pts: [[8, S.doneSp], [15, f.p50]], color: 's1', dash: true, w: 1.5, label: f.p50 === f.p85 ? '' : 'even chance ≥ ' + K.fmt(f.p50) },
        { pts: [[8, S.doneSp], [15, f.p85]], color: 's1', dash: true, w: 1.5, label: (f.p50 === f.p85 ? 'forecast ≥ ' : '85 % sure ≥ ') + K.fmt(f.p85) },
        { pts: S.burn.map((v, i) => [i, v]), color: 's1', w: 2.5, end: true, tip: (x, y) => `Day ${x}: ${y} SP done` }
      ]
    }) + K.legend([['done', 'bg-s1', 1], ['scope (done + open)', 'bg-dim', 1], ['committed at the start', 'bg-off', 1], ['forecast from the team\'s own last 75 working days', 'bg-s1', 1]]);

    const optRows = S.options.map(o => `<div class="opt"><b>${esc(o.label)}</b><span class="o-sp">${K.fmt(o.sp)} SP out</span>
      <div class="hb"><span></span><span class="tr"><i class="fl ${o.chance >= 50 ? 'ok' : o.chance >= 25 ? 'watch' : 'bad'}" style="width:${o.chance}%"></i></span><span class="vv">${o.chance} %</span></div>
      ${o.moves.length ? `<span class="mv">${K.keys(o.moves)}</span>` : ''}</div>`).join('');
    const decision = `${K.note(`For an even chance to finish the rest, <b>${K.fmt(f.over50)} SP</b> have to move out; to be 85 % sure, <b>${K.fmt(f.over85)} SP</b>. What moves is for the team and the product owner: the app only recomputes the forecast.`, 'bad')}
      <div class="faint fs-11 mg-10-0-2 d-flex jc-sb" ><span>Option</span><span>chance to finish the rest</span></div>${optRows}
      <div class="rowf mt-10" ><a class="btn sm pri" href="#/inbox">Draft the mail to the product owner</a><button class="btn sm" data-dr="decision:D-1">Decision D-1</button></div>`;

    // scope buckets, computed: came in later, carried over once, third sprint or later, and the rest is planned and new
    const bk = list => { const a = sumSp(list.filter(i => i.added)), c2 = sumSp(list.filter(i => !i.added && i.n === 2)), c3 = sumSp(list.filter(i => !i.added && i.n > 2)); return [Math.max(0, sumSp(list) - a - c2 - c3), c2, c3, a]; };
    const bs = bk(D.issues), bd = bk(D.issues.filter(i => i.st === 'done')), carried = D.issues.filter(i => i.n > 1);
    const part = (v, cls, what) => [v, cls, what + ': ' + K.fmt(v) + ' SP'];
    const buckets = K.hbars([
      { n: 'Scope now', parts: [part(bs[0], 'r3', 'Planned at the start, new in this sprint'), part(bs[1], 'r2', 'Carried over from the sprint before'), part(bs[2], 'r1', 'In its third sprint or later'), part(bs[3], 's3', 'Came in after the start')], label: K.fmt(S.scopeSp) + ' SP' },
      { n: 'Completed', parts: [part(bd[0], 'r3', 'From the plan'), part(bd[1], 'r2', 'Carried over'), part(bd[2], 'r1', 'Third sprint or later'), part(bd[3], 's3', 'Came in after the start')], label: K.fmt(S.doneSp) + ' SP' },
      { n: 'Taken out', parts: [part(S.removedSp, 'bg-off', 'Moved out of the sprint')], label: K.fmt(S.removedSp) + ' SP' }
    ], { max: Math.max(S.scopeSp, 1), nw: 84, vw: 64 }) + K.legend([['planned, new', 'bg-r3'], ['carried over', 'bg-r2'], ['third sprint or later', 'bg-r1'], ['came in after the start', 'bg-s3'], ['taken out', 'bg-off']]) +
      K.sect('Carried over', carried.length + ' items, ' + K.fmt(sumSp(carried)) + ' SP') + K.list(carried.slice().sort((a, b) => b.n - a.n).slice(0, 6).map(i => ({ tone: i.st === 'done' ? 'ok' : i.n > 2 ? 'bad' : 'watch', html: K.key(i.key, { title: true }), v: 'sprint no. ' + i.n }))) +
      (carried.length > 6 ? `<div class="faint fs-11 mt-6" >and ${carried.length - 6} more: filter the backlog below by "Carried over".</div>` : '');

    const board = `<div class="board">${D.statusOrder.map(st => {
      const its = D.issues.filter(i => i.st === st);
      return `<div class="col"><div class="col-h">${esc(D.status[st])}<span>${its.length} · ${K.fmt(sumSp(its))} SP</span></div>${its.length ? '' : '<div class="faint fs-11 pd-6-2" >nothing here</div>'}${its.map(i =>
        `<a class="card ${st !== 'done' && (st === 'blocked' || i.dis >= D.flow.p85) ? 'stuck' : st !== 'done' && i.dis >= D.flow.p50 ? 'aged' : ''}" href="#/issue/${i.key}"><span class="key">${i.key}</span> <span class="ttl-t">${esc(i.title)}</span>
          <span class="cm"><span>${i.type}${i.sp != null ? ' · ' + i.sp + ' SP' : ' · no points'}</span><span>${st === 'done' ? '' : i.dis + ' d here'}</span></span></a>`).join('')}</div>`;
    }).join('')}</div>`;

    const changes = K.feed([
      { t: 'Mon 16.11', tone: 'watch', html: K.key('KES-4197') + ' came in · no points', sub: 'Renew the certificate of the SMS gateway on the test system' },
      { t: 'Fri 13.11', tone: 'watch', html: K.key('KES-4193') + ' came in · <b>3 SP</b>', sub: 'Follow-up of INC-2291' },
      { t: 'Fri 13.11', tone: 'watch', html: K.key('KES-4190') + ' came in · no points', sub: 'Bug found after release 2026.11' },
      { t: 'Thu 12.11', tone: 'bad', html: K.key('KES-4188') + ' came in · <b>2 SP</b>', sub: 'Fix for ' + K.key('INC-2291') },
      { t: 'Wed 11.11', tone: '', html: K.key('KES-4155') + ' taken out · <b>3 SP</b>', sub: 'Moved to sprint 43' }
    ]);

    const vel = D.velocity, vr = K.nice(Math.max(S.committedSp, 58) * 1.1), most = Math.max.apply(null, vel.map(v => v.done));
    const velChart = K.chart({
      label: 'Committed and completed per sprint', w: 520, h: 200, x: [-.6, vel.length + .6], y: [0, vr[0]], yt: vr[1], xt: vel.map((v, i) => [i, v.id]).concat([[vel.length, '42']]),
      bars: vel.map((v, i) => ({ x: i - .19, w: .36, y1: v.committed, fill: 'none', stroke: 'faint', tip: `${v.id}: committed ${v.committed} SP` }))
        .concat(vel.map((v, i) => ({ x: i + .19, w: .36, y1: v.done, color: v.ip ? 'r1' : 's1', tip: `${v.id}: completed ${v.done} SP${v.ip ? ' (IP sprint)' : ''}` })))
        .concat([{ x: vel.length - .19, w: .36, y1: S.committedSp, fill: 'none', stroke: 'ink', tip: '42: committed ' + K.fmt(S.committedSp) + ' SP' }, { x: vel.length + .19, w: .36, y1: S.doneSp, color: 's1', op: .55, tip: '42: ' + K.fmt(S.doneSp) + ' SP done so far' }]),
      hlines: [{ y: S.committedSp, color: 'faint', dash: true, label: 'committed now ' + K.fmt(S.committedSp) }]
    }) + K.legend([['committed', 'bg-off'], ['completed', 'bg-s1'], ['IP sprint', 'bg-r1']]);

    return {
      lede: `${esc(S.name)}, ${S.from} to ${S.to}. Working day ${D.now.day} of ${D.now.days}. Click a sprint on the line above to see another one.`,
      acts: `<a class="btn" href="#/inbox">Drafts for this sprint</a>${K.extLink('Open the board in Jira', 'Jira')}`,
      kpis: [
        { l: 'Committed at the start', v: K.fmt(S.committedSp), u: 'SP', s: S.committedItems + ' items', ev: 'sprint.committed_sp' },
        { l: 'Done', spark: D.velocity.filter(x => !x.ip).map(x => x.done).concat([S.doneSp]), v: K.fmt(S.doneSp), u: 'SP', s: `<b>${K.pct(S.doneSp, S.scopeSp)} %</b> of the scope, ${K.pct(D.now.day, D.now.days)} % of the time`, tone: K.pct(S.doneSp, S.scopeSp) >= K.pct(D.now.day, D.now.days) ? 'ok' : 'watch', ev: 'sprint.done_sp' },
        { l: 'Still open', v: K.fmt(S.openSp), u: 'SP', s: `${S.openItems} items · ${S.noSp} without points`, ev: 'sprint.open_sp' },
        { l: 'By the end, 85 % sure', spark: D.sprintHist.p85, v: '≥ ' + K.fmt(f.p85), u: 'SP', s: `as likely as not ≥ ${K.fmt(f.p50)}`, ev: 'forecast.p85' },
        { l: 'Chance to finish it all', spark: D.sprintHist.chance, v: f.all, u: '%', s: `<b>${K.fmt(f.over50)} SP over</b> an even chance`, tone: 'bad', ev: 'forecast.chance_all' },
        { l: 'Scope since the start', v: '+' + K.fmt(S.addedSp) + ' / −' + K.fmt(S.removedSp), u: 'SP', s: S.addedItems + ' items in, ' + S.removedItems + ' out', tone: S.addedItems ? 'watch' : 'ok' },
        { l: 'Blocked', v: blocked.length, u: 'items', s: blocked.length ? '<b>' + K.fmt(sumSp(blocked)) + ' SP</b> · longest ' + Math.max.apply(null, blocked.map(i => i.dis)) + ' days' : 'nothing is blocked', tone: blocked.length ? 'bad' : 'ok' }
      ],
      body: K.grid(
        K.panel({ title: 'Commitment and forecast', sub: 'story points, by working day', w: 'c8 x5', src: ['jira'], ev: 'forecast.p85', body: burn,
          help: 'Done and scope per working day, as Jira\'s sprint report counts them. The two dashed lines are the forecast: the team\'s own pace of the last 75 working days, replayed 10 000 times for the days left.' }),
        K.panel({ title: 'Decision waiting: the sprint does not fit', w: 'c4 x4', src: ['jira'], ev: 'forecast.chance_all', right: K.pill('due Thu 19.11', 'bad'), body: decision }),
        K.panel({ title: 'Scope changes', sub: 'since the start', w: 'c4 x3', src: ['jira'], right: K.pill('5', 'watch'), body: changes }),
        K.panel({ title: 'What the scope is made of', sub: 'story points', w: 'c4 x4', src: ['jira'], body: buckets, help: 'The scope split by where it came from. Carried over means the item was already in the sprint before. Hover a segment for its issues.' }),
        K.panel({ title: 'The outside view', sub: 'what past sprints completed', w: 'c4 x4', src: ['jira'], body: velChart + K.note(S.committedSp > most ? 'No full sprint completed <b>' + K.fmt(S.committedSp) + ' SP</b> or more. The most was ' + most + '.' : vel.filter(v => !v.ip && v.done >= S.committedSp).length + ' of 5 full sprints completed ' + K.fmt(S.committedSp) + ' SP or more.', S.committedSp > most ? 'watch' : 'ok'), help: 'Committed at the start against completed, sprint by sprint, next to what is committed now.' }),
        K.panel({ title: 'Can they bet on our forecasts?', sub: 'the forecast replayed inside past sprints', w: 'c12 x4', src: ['jira'], flush: true, right: K.pill('85 % line held 5 of 6', 'ok'),
          body: K.table([{ h: 'Sprint', v: r => r.sprint }, { h: 'Asked at', v: r => r.at + ' of the sprint' }, { h: 'Said, 85 % sure', n: true, v: r => '≥ ' + r.p85 }, { h: 'Said, as likely as not', n: true, v: r => '≥ ' + r.p50 }, { h: 'Ended with', n: true, v: r => `<b class="ink">${r.ended}</b>` }, { h: '', v: r => K.pill(r.held ? 'held' : 'missed', r.held ? 'ok' : 'bad') }], D.lookback) }),
        storyPointsPanel(),
        forecastRecordPanel(),
        K.panel({ title: 'Board', sub: 'the columns of the Jira board · amber: slower than half of the finished items, red: blocked or slower than 85 %', w: 'c12 x12', src: ['jira'], body: board }),
        K.panel({ title: 'Sprint backlog', w: 'c12', src: ['jira', 'git'], flush: true,
          right: K.filter('bl', [['all', 'All'], ['open', 'Open'], ['blocked', 'Blocked'], ['added', 'Came in later'], ['nosp', 'No points'], ['carried', 'Carried over']].map(o => o.concat([D.issues.filter(i => (' ' + flags(i) + ' ').indexOf(' ' + o[0] + ' ') >= 0).length]))),
          body: K.issueTable(D.issues.slice().sort((a, b) => (b.st === 'done' ? -1 : b.dis) - (a.st === 'done' ? -1 : a.dis)), { attrs: i => `data-f-bl="${flags(i)}"` }),
          help: 'Every item of the sprint. Click a column head to sort. Titles are read from Jira while you look and are kept nowhere.' })
      )
    };
  }

  /* ── Flow ─────────────────────────────────────────────────────────────── */
  function flowPage(ctx) {
    const F = D.flow, win = ctx.pick({ sprint: 'sprint 42 so far', pi: 'PI 26.4 so far', quarter: 'the last 12 weeks' });
    const dots = ctx.hz === 'sprint' ? F.dots.filter(d => d[0] >= 62) : ctx.hz === 'pi' ? F.dots.filter(d => d[0] >= 33) : F.dots;
    const x0 = ctx.hz === 'sprint' ? 62 : ctx.hz === 'pi' ? 33 : 0;
    const scatter = K.chart({
      label: 'Cycle time of finished items', w: 760, h: 250, x: [x0 - 1, 84], y: [0, 24], yt: [0, 5, 10, 15, 20], yu: ' d',
      xt: ctx.hz === 'sprint' ? [[63, '09.11'], [70, '16.11'], [72, 'today']] : [[0, '26.08'], [21, '16.09'], [33, '28.09'], [54, '19.10'], [75, '09.11'], [83, 'today']],
      hlines: [{ y: F.p50, color: 's1', label: 'half within 4.6 d' }, { y: F.p85, color: 'watch', dash: true, label: '85 % within 11.2 d' }, { y: F.p95, color: 'faint', dash: true, label: '95 % within 17.5 d' }],
      vmarks: ctx.hz === 'sprint' ? [] : [{ x: 33, label: 'PI start', color: 'faint' }, { x: 54, label: '41', color: 'faint' }, { x: 75, label: '42', color: 'faint' }],
      dots: dots.map(d => ({ x: d[0], y: d[1], color: d[2] ? 's2' : 's1', r: 4, op: .9, tip: `${d[2] ? 'Bug' : 'Story'} finished after ${d[1]} days` }))
    }) + K.legend([['story or task', 'bg-s1'], ['bug', 'bg-s2']]);
    const aging = K.hbars(open.filter(i => i.st !== 'todo').sort((a, b) => b.dis - a.dis).map(i => ({
      n: K.key(i.key) + ` <span class="faint">${esc(D.status[i.st])}</span>`, v: i.dis, max: 26, cls: i.dis >= F.p85 || i.st === 'blocked' ? 'bad' : i.dis >= F.p50 ? 'watch' : 's1', label: i.dis + ' d', tick: F.p85, tickTip: '85 % of finished items needed at most 11.2 days in total'
    })), { max: 26, nw: 170, vw: 40 });
    const cols = ['r1', 'bad', 'r2', 'r3', 'r4', 'r5'], lab = ['To do', 'Blocked', 'Implementing', 'Review', 'Approve', 'Done'];
    const order = [5, 4, 3, 2, 1, 0];          // done at the bottom
    const cfdAreas = order.map((ci, n) => ({
      color: ci === 1 ? 'bad' : cols[ci], op: ci === 1 ? .55 : .95, tip: lab[ci],
      pts: S.cfd.map((row, d) => { const below = order.slice(0, n).reduce((s, c) => s + row[c], 0); return [d + 1, below, below + row[ci]]; })
    }));
    const cfd = K.chart({ label: 'Cumulative flow of sprint 42', w: 620, h: 220, x: [1, 8], y: [0, 26], yt: [0, 5, 10, 15, 20, 25], xt: [[1, '09.11'], [3, '11.11'], [5, '13.11'], [6, '16.11'], [8, 'today']], areas: cfdAreas }) +
      K.legend(lab.map((l, i) => [l, i === 1 ? 'bg-bad' : 'bg-' + cols[i]]));
    const thr = K.chart({ label: 'Items finished per week', w: 520, h: 200, x: [-.6, 11.6], y: [0, 12], yt: [0, 4, 8, 12], xt: [[0, 'W36'], [3, 'W39'], [6, 'W42'], [9, 'W45'], [11, 'W47']],
      bars: F.thrWeek.map((v, i) => ({ x: i, w: .7, y1: v, color: 's1', op: i === 11 ? .55 : 1, tip: `Week ${36 + i}: ${v} items finished${i === 11 ? ' so far' : ''}` })), hlines: [{ y: 8, color: 'faint', dash: true, label: 'usual 8 a week' }] });
    return {
      lede: `How work moves from start to done. Window: ${win}. Times are medians and percentiles, never averages.`,
      kpis: [
        { l: 'Half of the items finish within', v: F.p50, u: 'days', s: `${ctx.pick({ sprint: 15, pi: 51, quarter: F.n })} items finished`, ev: 'flow.p85' },
        { l: '85 % finish within', v: F.p85, u: 'days', s: 'the service level expectation', ev: 'flow.p85' },
        { l: 'In progress now', v: F.wip, u: 'items', s: `<b>limit ${F.wipLimit}</b> · over it on 5 of 8 days`, tone: 'bad', to: '#/knowledge/agreements' },
        { l: 'Finished per week', v: ctx.pick({ sprint: '8.5', pi: '8.1', quarter: '8.0' }), u: 'items', s: 'between 6 and 10', spark: F.thrWeek },
        { l: 'Older than the 85 % line', v: 3, u: 'items', s: '<b>KES-4160</b> 24 d, KES-4079 13 d', tone: 'bad' },
        { l: 'Waiting share', v: 30, u: '%', s: 'of the time is To do and Blocked', tone: 'watch' }
      ],
      body: K.grid(
        K.panel({ title: 'Cycle time', sub: 'days from the first status past To do until Done · one dot is one item', w: 'c8 x6', src: ['jira'], ev: 'flow.p85', body: scatter,
          help: 'Every finished item as a dot: when it was done and how long it took. The lines say how long half, 85 % and 95 % of them took at most.' }),
        K.panel({ title: 'Aging work in progress', sub: 'days in the current status', w: 'c4 x3', src: ['jira'], body: aging + '<div class="faint fs-11 mt-6" >The mark is the 85 % line of finished items (11.2 days from start to done).</div>' }),
        K.panel({ title: 'Where the time goes', sub: 'median days per status, finished items', w: 'c4 x3', src: ['jira'], body: K.hbars(F.stages.map((s, i) => ({ n: s[0], v: s[1], cls: s[0] === 'Blocked' ? 'bad' : s[0] === 'To do' ? 'bg-mute' : 's1', label: s[1] + ' d' })), { max: 4, nw: 100, vw: 44 }) +
          K.note('Items wait <b>2.9 days</b> in To do after the sprint started and <b>1.6 days</b> for a review.', '') }),
        K.panel({ title: 'Cumulative flow, this sprint', sub: 'items per board column at the end of each working day', w: 'c8 x7', src: ['jira'], body: cfd }),
        K.panel({ title: 'Throughput', sub: 'items finished per week, last 12 weeks', w: 'c4 x5', src: ['jira'], body: thr })
      )
    };
  }

  /* ── PI ───────────────────────────────────────────────────────────────── */
  /* ── PI statistics, from what the app already reads ── */
  const piPct = (a, b) => Math.round(a / b * 100);
  const PIX = ['04', '06', '09', '12'];
  function theVote() { const v = parseFloat(SM.store.get('pivote', '')); return isNaN(v) ? D.piStats[3].vote : v; }
  SM.acts = SM.acts || {};
  SM.acts.pivote = el => {
    const v = parseFloat(String(el.value).replace(',', '.')), ok = !isNaN(v) && v >= 0 && v <= 10;
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    const msg = document.getElementById('pi-vote-msg');
    if (msg) msg.textContent = ok ? 'kept in your own notes on this computer' : 'a vote is a number from 0 to 10';
    if (!ok) return;
    SM.store.set('pivote', String(v));
    const cell = document.getElementById('pi-vote-now'); if (cell) cell.textContent = v.toFixed(1);
  };
  function piStatsPanel() {
    const S = D.piStats, table = K.table([
      { h: 'PI', cls: 's', v: r => `<b class="ink">${esc(r.pi)}</b>${r.running ? '<span class="sub">running</span>' : ''}` },
      { h: 'Capacity', n: true, v: r => `${r.avail}<span class="faint"> of ${r.capacity} d</span>`, tip: 'Person-days available for sprint work, of those planned' },
      { h: 'Velocity', n: true, v: r => (r.paceDone / r.paceDays).toFixed(2) + '<span class="faint"> SP/day</span>', tip: 'Completed story points per available person-day, closed sprints only' },
      { h: 'Committed', n: true, v: r => r.committed },
      { h: 'Completed', n: true, v: r => `<b class="ink">${r.completed}</b>` },
      { h: 'Planning accuracy, BV', n: true, v: r => r.bvActual == null ? '<span class="faint">at the end</span>' : piPct(r.bvActual, r.bvPlanned) + ' %', tip: 'Business value delivered against planned, set by the business owners at the end of the PI' },
      { h: 'Planning accuracy, SP', n: true, v: r => piPct(r.paceDone, r.closedCommitted) + ' %', tip: 'Story points completed against committed, closed sprints only' },
      { h: 'Bugs created', n: true, v: r => r.created }, { h: 'Bugs fixed', n: true, v: r => r.fixed },
      { h: 'Confidence', n: true, v: r => r.running ? `<b class="ink" id="pi-vote-now">${theVote().toFixed(1)}</b>` : r.vote.toFixed(1), tip: 'The vote of the team at PI Planning, 0 to 10' },
      { h: 'Comments', v: r => `<span class="dim">${esc(r.note)}</span>` }
    ], S);
    return K.panel({ title: 'PI statistics', sub: 'statistics by PI, from what the app reads', w: 'c12', src: ['jira', 'wiki'], flush: true, isNew: true, body: table +
      `<div class="pi-vote"><label for="pi-vote">Confidence vote of ${esc(S[3].pi)}</label><input id="pi-vote" class="inp" type="text" inputmode="decimal" value="${theVote().toFixed(1)}" data-input="pivote"><span class="faint" id="pi-vote-msg">kept in your own notes on this computer</span></div>`,
      foot: 'until question 16 is answered both ways of planning accuracy are shown',
      help: 'One row per PI, with the columns the team keeps by hand on its wiki page. Capacity comes from the capacity page, story points and bugs from Jira, business value from the objectives. The confidence vote is the one number you type in.' });
  }
  function piChartsPanel() {
    const S = D.piStats, xt = PIX.map((p, i) => [i, p + (S[i].running ? ' so far' : '')]), x = [-.6, 3.6];
    const cap = t => `<div class="pi-cap">${esc(t)}</div>`;
    const abs = K.chart({ label: 'Absolute velocity, committed against completed story points by PI', w: 400, h: 190, x, y: [0, 200], yt: [0, 100, 200], xt,
      bars: S.map((r, i) => ({ x: i - .19, w: .36, y1: r.committed, fill: 'none', stroke: 'dim', tip: `${r.pi}: committed ${r.committed} SP` })).concat(S.map((r, i) => ({ x: i + .19, w: .36, y1: r.completed, color: 's1', op: r.running ? .6 : 1, tip: `${r.pi}: completed ${r.completed} SP` }))) });
    const pace = K.chart({ label: 'Velocity in story points per day, by PI', w: 400, h: 190, x, y: [.4, .6], yt: [.4, .5, .6], xt,
      lines: [{ pts: S.map((r, i) => [i, +(r.paceDone / r.paceDays).toFixed(2)]), color: 's1', w: 2.2, end: true, tip: (a, b) => `${S[a].pi}: ${b.toFixed(2)} SP per available day` }] });
    const acc = K.chart({ label: 'Planning accuracy by PI, by business value and by story points', w: 400, h: 190, x, y: [60, 100], yt: [60, 80, 100], yu: ' %', xt,
      lines: [{ pts: S.filter(r => r.bvActual != null).map(r => [S.indexOf(r), piPct(r.bvActual, r.bvPlanned)]), color: 's1', w: 2.2, end: true, tip: (a, b) => `${S[a].pi}: ${b} % of the planned business value` },
        { pts: S.map((r, i) => [i, piPct(r.paceDone, r.closedCommitted)]), color: 's3', w: 2.2, dash: true, end: true, tip: (a, b) => `${S[a].pi}: ${b} % of the committed story points` }] });
    const bugs = K.chart({ label: 'Bugs created and fixed by PI', w: 400, h: 190, x, y: [0, 25], yt: [0, 10, 20], xt,
      bars: S.map((r, i) => ({ x: i - .19, w: .36, y1: r.created, color: 's2', tip: `${r.pi}: ${r.created} created` })).concat(S.map((r, i) => ({ x: i + .19, w: .36, y1: r.fixed, color: 's1', tip: `${r.pi}: ${r.fixed} fixed` }))) });
    return K.panel({ title: 'PI statistics as charts', sub: 'the four charts of the wiki page', w: 'c12', src: ['jira', 'wiki'], isNew: true,
      body: `<div class="pi-charts"><div>${cap('Absolute velocity')}${abs}${K.legend([['committed', 'bg-dim', 1], ['completed', 'bg-s1']])}</div><div>${cap('Velocity in story points per day')}${pace}</div>
        <div>${cap('Planning accuracy by PI')}${acc}${K.legend([['by business value', 'bg-s1', 1], ['by story points', 'bg-s3', 1]])}</div><div>${cap('Bugs created and fixed by PI')}${bugs}${K.legend([['created', 'bg-s2'], ['fixed', 'bg-s1']])}</div></div>`,
      help: 'The same numbers as the table above, PI by PI. The running PI counts only closed sprints in velocity and in accuracy by story points; its business value is set at the end.' });
  }

  /* ── on the Sprint page ───────────────────────────────────────────────── */
  function storyPointsPanel() {
    const S = D.sprint, rows = [['Committed at the start', S.committedItems, S.committedSp], ['Came in after the start', S.addedItems, S.addedSp], ['Taken out', S.removedItems, S.removedSp], ['Scope now', S.scopeItems, S.scopeSp], ['Done', S.doneItems, S.doneSp], ['Not done', S.openItems, S.openSp]];
    return K.panel({ title: 'Story points view', sub: 'as the Jira sprint report counts', w: 'c4 x4', src: ['jira'], ev: 'sprint.done_sp', flush: true,
      body: K.table([{ h: '', v: r => /^(Scope|Done)/.test(r[0]) ? `<b class="ink">${esc(r[0])}</b>` : esc(r[0]) }, { h: 'Items', n: true, v: r => r[1] }, { h: 'SP', n: true, v: r => r[2] }], rows),
      foot: S.noSp + ' open items have no points and add nothing to the SP',
      help: 'The sprint line by line as the Jira sprint report counts it. Committed plus what came in, minus what was taken out, is the scope. The points of the commitment are those of the moment the sprint started.' });
  }
  function forecastRecordPanel() {
    const R = D.forecastRecord, closed = R.filter(r => r.ended != null), m = closed.reduce((s, r) => s + r.mornings, 0), h = closed.reduce((s, r) => s + r.held, 0);
    return K.panel({ title: 'The forecast record', sub: 'what the app said on the mornings of a sprint, settled when it closed', w: 'c8 x8', src: ['jira'], flush: true, isNew: true, right: K.pill(`held on ${h} of ${m} mornings`, 'ok'),
      body: K.table([
        { h: 'Sprint', cls: 's', v: r => `<b class="ink">${esc(r.sprint)}</b>` }, { h: 'Mornings written', n: true, v: r => r.mornings },
        { h: 'Said, 85 % sure', n: true, v: r => `≥ ${r.low} to ${r.high}` }, { h: 'Ended with', n: true, v: r => r.ended == null ? '<span class="faint">open until 27.11</span>' : r.ended },
        { h: 'The line held', n: true, v: r => r.held == null ? '<span class="faint">not settled</span>' : `<span class="${r.held === r.mornings ? 'c-ok' : 'c-watch'}">${r.held} of ${r.mornings}</span>` }
      ], R), foot: 'two closed sprints are too few to call the forecast calibrated',
      help: 'The look-back replays the forecast afterwards. This record is what the app really showed on each working morning, written down that day and compared with how the sprint ended. A line held when the sprint ended at or above it.' });
  }

  function piPage() {
    const c = D.cal, tone = { ok: 'ok', watch: 'watch', bad: 'bad' };
    const rows = D.features.map(f => ({
      name: `${K.dot(f.state)} ${K.key(f.key)} <span class="ttl-t">${esc(f.title.length > 58 ? f.title.slice(0, 56) + '…' : f.title)}</span>`,
      from: f.key === 'KES-3340' ? '2026-10-19' : f.key === 'KES-3325' ? '2026-11-09' : '2026-09-28', to: f.eta[1] > '2026-12-31' ? '2026-12-31' : f.eta[1],
      done: f.done / f.sp, tone: tone[f.state], tip: `${f.key}: ${f.done} of ${f.sp} SP done · forecast ${K.dm(f.eta[0])} to ${K.dm(f.eta[1])}`
    }));
    const tl = K.timeline(rows, c.from, c.to, { nw: 400,
      ticks: c.sprints.map(s => [s.from, s.id]).concat([['2026-12-13', '13.12']]),
      lines: c.sprints.map(s => [s.from, '']).concat([[D.now.date, 'now', 'Today, 18.11'], ['2026-11-27', 'due', 'Code freeze for release 2026.12: Fri 27.11'], ['2026-12-13', 'due', 'Winter sale 13.12.2026']]) });
    const doneSp = D.features.reduce((s, f) => s + f.done, 0), allSp = D.features.reduce((s, f) => s + f.sp, 0);
    const boardCols = [['40', 'closed'], ['41', 'closed'], ['42', 'now'], ['43 IP', 'planned'], ['after the PI', 'slips']];
    const cell = { 'KES-3301': [11, 8, 15, 0, 0], 'KES-3312': [6, 7, 13, 3, 0], 'KES-3318': [3, 5, 16, 0, 0], 'KES-3325': [0, 0, 8, 5, 0], 'KES-3331': [5, 3, 3, 5, 0], 'KES-3340': [0, 5, 0, 4, 9], 'KES-3347': [5, 3, 5, 0, 0], 'KES-3352': [0, 3, 3, 2, 0] };
    const pboard = `<div class="tbwrap"><table class="tb"><thead><tr><th>Feature</th>${boardCols.map(b => `<th class="n">${b[0]}<span class="faint"> · ${b[1]}</span></th>`).join('')}<th class="n">PI total</th></tr></thead><tbody>${D.features.map(f =>
      `<tr><td class="ttl">${K.key(f.key, { title: true })}</td>${cell[f.key].map((v, i) => `<td class="n">${v ? (i === 2 ? `<b class="ink">${v}</b>` : i === 4 ? `<span class="c-watch">${v}</span>` : v) : '<span class="faint">·</span>'}</td>`).join('')}<td class="n"><b class="ink">${f.sp}</b></td></tr>`).join('')}</tbody></table></div>`;
    return {
      lede: `${c.pi.id}, ${K.dm(c.pi.from)} to ${K.dm(c.pi.to)}: three sprints of three weeks and the IP sprint. Week 8 of 11.`,
      kpis: [
        { l: 'Feature work done', v: doneSp, u: 'of ' + allSp + ' SP', s: `<b>${K.pct(doneSp, allSp)} %</b> at 69 % of the PI`, tone: 'watch' },
        { l: 'Objectives on track', v: '3 of 5', u: 'committed', s: '<b>1 off track</b>, 1 at risk', tone: 'bad', to: '#/product/objectives' },
        { l: 'Planned value at stake', v: 10, u: 'of 37 BV', s: 'objective 3, Winter sale', tone: 'bad', to: '#/product/objectives' },
        { l: 'All work done in the PI', v: 126, u: 'SP', s: '52 + 49 + 25 so far' },
        { l: 'Slips out of the PI', v: 9, u: 'SP', s: 'KES-3340, uncommitted', tone: 'watch' },
        { l: 'Predictability, last PI', v: 89, u: '%', s: '32 of 36 planned BV', spark: D.predictability.map(p => Math.round(p.actual / p.planned * 100)) }
      ],
      body: K.grid(
        K.panel({ title: 'Features on the line of the PI', sub: 'bar: start to the late end of the forecast · fill: share done', w: 'c12', src: ['jira'], body: tl + K.legend([['on track', 'bg-ok'], ['needs a look', 'bg-watch'], ['off track', 'bg-bad'], ['today', 'bg-dim', 1], ['code freeze and Winter sale', 'bg-watch', 1]]),
          help: 'One lane per feature of the PI. The forecast end comes from the story points left and the pace of the team, 85 % sure.' }),
        K.panel({ title: 'What lands in which sprint', sub: 'story points per feature and sprint', w: 'c8', src: ['jira'], flush: true, body: pboard, help: 'The team\'s program board as a table: done story points for closed sprints, scope for the running one, plan for what is ahead.' }),
        K.panel({ title: 'Predictability, PI by PI', sub: 'delivered against planned business value of the committed objectives', w: 'c4', src: ['jira', 'wiki'], body: K.hbars(D.predictability.map(p => ({ n: p.pi, v: Math.round(p.actual / p.planned * 100), max: 100, cls: p.actual / p.planned >= .8 ? 'ok' : 'watch', label: Math.round(p.actual / p.planned * 100) + ' %<span class="faint"> · ' + p.actual + '/' + p.planned + '</span>', tick: 80, tickTip: '80 %: the lower edge of the usual target band' })), { max: 100, nw: 84, vw: 92 }) +
          K.note('PI 26.4 so far: objectives worth <b>21 of 37 BV</b> are on track. If objective 3 misses, at most 27 BV are delivered: <b>73 %</b>.', 'watch'), foot: 'actual BV is set by the business owners at the end of the PI' }),
        piStatsPanel(),
        piChartsPanel()
      )
    };
  }

  /* ── Capacity and work mix ────────────────────────────────────────────── */
  function capacityPage() {
    const cap = D.capacity, cur = cap[2];
    const bars = K.hbars(cap.map(c => ({ n: c.id, max: 105, parts: [[c.avail, 's1', `Available for sprint work: ${c.avail} person-days`], [c.duty, 's3', `On-call duty: ${c.duty} person-days`], [c.absent, 'bg-off', `Absence: ${c.absent} person-days`]], label: c.avail + ' d' })), { max: 105, nw: 64, vw: 44 }) +
      K.legend([['available for sprint work', 'bg-s1'], ['on-call duty', 'bg-s3'], ['absence', 'bg-off']]);
    const load = K.hbars([
      { n: '40', parts: [[52, 's1', 'Completed 52 SP on 98 available days']], label: '0.53 SP per day' }, { n: '41', parts: [[49, 's1', 'Completed 49 SP on 94 available days']], label: '0.52 SP per day' },
      { n: '42 outlook', parts: [[45, 'r4', '86 available days at the pace of the last two sprints: about 45 SP']], label: '≈ 45 SP', tick: 63, tickTip: 'Committed at the start: 63 SP' }
    ], { max: 70, nw: 84, vw: 104 });
    const mix = K.stackbar(D.workmix.map((w, i) => [w.name, w.sp, ['bg-r3', 'bg-r5', 'bg-s2', 'bg-s3'][i]]), { unit: 'SP', h: 14 });
    return {
      lede: 'What the team can carry and what the time went into. Team totals only: no person is listed, counted or compared.',
      kpis: [
        { l: 'Available this sprint', v: cur.avail, u: 'of 105 person-days', s: '<b>14 d</b> absence, 5 d on-call', tone: 'watch', ev: 'capacity.avail' },
        { l: 'Outlook from capacity', v: '≈ 45', u: 'SP', s: '<b>18 SP below</b> the commitment', tone: 'bad' },
        { l: 'Pace', v: '0.53', u: 'SP per available day', s: 'last two sprints' },
        { l: 'Planned work', v: 69, u: '% of done SP', s: 'features and enablers', tone: 'watch', ev: 'mix.unplanned' },
        { l: 'Bugs and support', v: 31, u: '%', s: '<b>agreed: at most 20 %</b>', tone: 'bad', ev: 'mix.unplanned' },
        { l: 'On-call this PI', v: 6, u: 'call-outs', s: '2 at night · team total' }
      ],
      body: K.grid(
        K.panel({ title: 'Capacity per sprint', sub: 'person-days of the seven people who deliver', w: 'c6', src: ['wiki'], ev: 'capacity.avail', body: bars + K.sect('Absence in 42', 'team totals') + K.kv([['Vacation', D.absence.vacation + ' days'], ['Training', D.absence.training + ' days'], ['Sick', D.absence.sick + ' days']]),
          help: 'Typed in by the team at sprint planning on its wiki page, as totals. The app reads the table; it does not know who is away.' }),
        K.panel({ title: 'Does the commitment fit the capacity?', sub: 'story points', w: 'c6', src: ['jira', 'wiki'], body: load + K.note('At the pace of the last two sprints, 86 available days carry about <b>45 SP</b>. The sprint started with <b>63 SP</b>. The forecast from the daily pace says the same from the other side: 85 % sure of 47.', 'bad') }),
        K.panel({ title: 'Where the work of the PI went', sub: '126 SP done so far, by kind of work', w: 'c7', src: ['jira'], ev: 'mix.unplanned', body: mix + K.sect('Against what the team agreed') + K.hbars(D.workmix.map(w => ({ n: w.name, v: w.pct, max: 70, cls: (w.id === 'bugs' || w.id === 'support') && w.pct > w.target ? 'bad' : 's1', label: w.pct + ' %<span class="faint"> · agreed ' + w.target + ' %</span>', tick: w.target, tickTip: 'agreed share: ' + w.target + ' %' })), { max: 70, nw: 190, vw: 120 }),
          help: 'Each done item is put into one kind by rules: its feature\'s type, its issue type, its labels. What no rule catches would show as "not classified": here nothing is left over.' }),
        K.panel({ title: 'Work mix, sprint by sprint', sub: 'share of done story points', w: 'c5', src: ['jira'], body: K.hbars([
          { n: '40', parts: [[25, 'r3', 'Business features: 25 SP'], [5, 'r5', 'Enablers: 5 SP'], [9, 's2', 'Bugs and incidents: 9 SP'], [13, 's3', 'Support and maintenance: 13 SP']], label: '52 SP' }, { n: '41', parts: [[28, 'r3', 'Business features: 28 SP'], [6, 'r5', 'Enablers: 6 SP'], [11, 's2', 'Bugs and incidents: 11 SP'], [4, 's3', 'Support and maintenance: 4 SP']], label: '49 SP' }, { n: '42 so far', parts: [[18, 'r3', 'Business features: 18 SP'], [5, 'r5', 'Enablers: 5 SP'], [2, 's2', 'Bugs and incidents: 2 SP'], [0, 's3', 'Support and maintenance: 0 SP']], label: '25 SP' }], { max: 56, nw: 84, vw: 48 }) +
          K.legend([['business features', 'bg-r3'], ['enablers', 'bg-r5'], ['bugs and incidents', 'bg-s2'], ['support', 'bg-s3']]) + K.note('Sprint 40 spent <b>22 of 52 SP</b> on bugs and support: the start of the PI carried the support for release 2026.10 and the export patch.', 'watch') })
      )
    };
  }

  /* ── Dependencies ─────────────────────────────────────────────────────── */
  const deps = [
    { dir: 'in', ours: 'KES-4131', theirs: 'ATL-882', team: 'Team Atlas', what: 'Price feed v3 with the tiers for schools', need: '20.11', promised: 'no date', state: 'bad', age: 9 },
    { dir: 'in', ours: 'KES-4079', theirs: 'PARTNER-311', team: 'Carrier-Integration', what: 'The test system of the carrier sends duplicate order numbers', need: '25.11', promised: '24.11', state: 'watch', age: 13 },
    { dir: 'in', ours: 'KES-4136', theirs: 'ATL-890', team: 'Team Atlas', what: 'Test system with old and new price tiers', need: '24.11', promised: '23.11', state: 'ok', age: 6 },
    { dir: 'out', ours: 'KES-4127', theirs: 'OSP-2210', team: 'Team Osprey', what: 'Cancellation reasons as a pick list in the support tool', need: '27.11', promised: '20.11', state: 'ok', age: 4 },
    { dir: 'out', ours: 'KES-4146', theirs: 'OPS-77', team: 'Platform operations', what: 'Report a stopped export to the central alert system', need: '03.12', promised: '27.11', state: 'ok', age: 2 }
  ];
  function depsPage() {
    const row = d => [
      { h: 'Our item', cls: 'ttl', v: d => K.key(d.ours, { title: true }) }, { h: 'Their item', cls: 's', v: d => K.key(d.theirs) + `<span class="sub">${esc(d.team)}</span>` }, { h: 'What is needed', v: d => `<span class="dim">${esc(d.what)}</span>` },
      { h: 'Needed by', cls: 's', n: true, v: d => d.need }, { h: 'Promised', cls: 's', n: true, v: d => d.promised === 'no date' ? '<span class="c-bad">no date</span>' : d.promised }, { h: 'Open for', n: true, v: d => d.age + ' d' }, { h: '', v: d => K.pill(K.stateWord[d.state], d.state) }];
    return {
      lede: 'Who the team waits for and who waits for the team. Read from the Jira links "blocks" and "is blocked by"; the other team\'s issue is named, not read.',
      kpis: [
        { l: 'We wait for others', v: 3, u: 'links', s: '<b>1 without a date</b>', tone: 'bad' }, { l: 'Others wait for us', v: 2, u: 'links', s: 'both on time', tone: 'ok' },
        { l: 'Story points behind a link', v: 7, u: 'SP', s: 'KES-4131 and KES-4136' }, { l: 'Provider later than needed', v: 1, u: 'link', s: 'ATL-882 for 20.11', tone: 'bad' }, { l: 'Longest wait', v: 13, u: 'days', s: 'KES-4079' }
      ],
      body: K.grid(
        K.panel({ title: 'We wait for', sub: 'incoming dependencies', w: 'c12', src: ['jira'], flush: true, body: K.table(row(), deps.filter(d => d.dir === 'in')) }),
        K.panel({ title: 'Wait for us', sub: 'outgoing dependencies', w: 'c8', src: ['jira'], flush: true, body: K.table(row(), deps.filter(d => d.dir === 'out')) }),
        K.panel({ title: 'By team', sub: 'open links', w: 'c4', src: ['jira'], body: K.hbars([{ n: 'Team Atlas', v: 2, cls: 'bad', label: '2 in' }, { n: 'Carrier-Integration', v: 1, cls: 'watch', label: '1 in' }, { n: 'Team Osprey', v: 1, cls: 's1', label: '1 out' }, { n: 'Platform operations', v: 1, cls: 's1', label: '1 out' }], { max: 3, nw: 150, vw: 50 }) +
          K.note('Both links to Team Atlas sit under feature ' + K.key('KES-3318') + ' and risk ' + `<button class="key" data-dr="risk:R-1">R-1</button>.`, 'bad') })
      )
    };
  }

  /* ── Hygiene ──────────────────────────────────────────────────────────── */
  const hyg = [
    { g: 'Sprint', state: 'ok', text: 'Stories in progress without story points', n: 0 },
    { g: 'Sprint', state: 'watch', text: 'Open items without story points', n: 3, keys: ['KES-4079', 'KES-4190', 'KES-4197'], sub: 'two bugs and a task: the forecast does not see them' },
    { g: 'Sprint', state: 'ok', text: 'Stories without a feature link', n: 0 },
    { g: 'Sprint', state: 'watch', text: 'In progress, no update for more than 7 days', n: 1, keys: ['KES-4160'] },
    { g: 'Sprint', state: 'bad', text: 'Open items in their third sprint or later', n: 2, keys: ['KES-4160', 'KES-4079'] },
    { g: 'Sprint', state: 'ok', text: 'Done items with an open pull request', n: 0 },
    { g: 'Sprint', state: 'watch', text: 'Blocked without a link that says by what', n: 1, keys: ['KES-4079'], sub: 'the carrier issue is named in a comment only' },
    { g: 'Sprint', state: 'bad', text: 'In the sprint, blocked by others', n: 2, keys: ['KES-4131', 'KES-4079'], sub: 'by ATL-882 of Team Atlas, and by a carrier' },
    { g: 'PI', state: 'watch', text: 'Features without a due date', n: 1, keys: ['KES-3352'] },
    { g: 'PI', state: 'ok', text: 'Features without a fix version', n: 0 },
    { g: 'PI', state: 'ok', text: 'Features with a fix version but no planned version', n: 0 },
    { g: 'PI', state: 'ok', text: 'Features without a parent epic', n: 0 },
    { g: 'PI', state: 'ok', text: 'Features with a non-valid fix or planned version', n: 0 },
    { g: 'PI', state: 'watch', text: 'Features of the last PI that are not closed', n: 1, sub: 'KES-3288, closed stories, open feature' },
    { g: 'PI', state: 'ok', text: 'Closed features with open stories', n: 0 },
    { g: 'Backlog', state: 'watch', text: 'Items without an update for more than 365 days', n: 4, sub: 'Jira archives after 18 months' },
    { g: 'Backlog', state: 'ok', text: 'Stories in progress without a sprint', n: 0 },
    { g: 'Backlog', state: 'watch', text: 'Items of the team without an assignee', n: 6, sub: 'a count: the app reads no assignee' },
    { g: 'Backlog', state: 'ok', text: 'Stories closed with open sub-tasks', n: 0 },
    { g: 'Backlog', state: 'ok', text: 'Items that block others and are not planned', n: 0 }
  ];
  function hygienePage() {
    const grp = g => K.checks(hyg.filter(h => h.g === g).map(h => ({ state: h.state, html: esc(h.text) + (h.keys ? ' &nbsp;' + K.keys(h.keys) : ''), sub: h.sub, v: h.n })));
    const bad = hyg.filter(h => h.state !== 'ok');
    return {
      lede: hyg.length + ' checks of the data in Jira, the ones the team kept by hand as Wiki filters. A finding is not a fault: it says where a number of this app may be thin.',
      kpis: [
        { l: 'Checks passed', v: hyg.length - bad.length, u: 'of ' + hyg.length, tone: 'watch' }, { l: 'Findings', v: bad.reduce((s, h) => s + h.n, 0), u: 'items', s: 'in ' + bad.length + ' checks' },
        { l: 'Hurts the forecast', v: 3, u: 'items', s: 'open without story points', tone: 'watch' }, { l: 'Third sprint or later', v: 2, u: 'items', s: 'KES-4160, KES-4079', tone: 'bad' }
      ],
      body: K.grid(
        K.panel({ title: 'Sprint', sub: hyg.filter(h => h.g === 'Sprint').length + ' checks', w: 'c4', src: ['jira', 'git'], body: grp('Sprint') }),
        K.panel({ title: 'PI', sub: hyg.filter(h => h.g === 'PI').length + ' checks', w: 'c4', src: ['jira'], body: grp('PI') }),
        K.panel({ title: 'Team backlog', sub: '5 checks', w: 'c4', src: ['jira'], body: grp('Backlog') })
      )
    };
  }

  SM.domain({
    id: 'delivery', title: 'Delivery', icon: 'delivery',
    pages: [
      { id: 'sprint', title: 'Sprint', hz: ['sprint'], was: 'moved', from: 'Sprint, Promises', find: 'burnup commitment forecast board backlog scope', render: sprintPage },
      { id: 'flow', title: 'Flow', hz: ['sprint', 'pi', 'quarter'], was: 'kept', from: 'Flow', find: 'cycle time aging wip throughput cumulative', render: flowPage },
      { id: 'pi', title: 'PI', hz: ['pi'], was: 'new', from: 'PI (was empty)', find: 'program increment features timeline predictability', render: piPage },
      { id: 'capacity', title: 'Capacity and work mix', hz: ['sprint', 'pi'], was: 'new', from: '', find: 'capacity absence allocation investment unplanned', render: capacityPage },
      { id: 'dependencies', title: 'Dependencies', hz: ['sprint', 'pi'], was: 'new', from: '', find: 'blocked by other teams links', render: depsPage },
      { id: 'hygiene', title: 'Hygiene', hz: ['sprint', 'pi'], was: 'kept', from: 'Hygiene', find: 'jira data quality checks', render: hygienePage }
    ]
  });
})();
