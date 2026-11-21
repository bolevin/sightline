/* The event log: one place that feeds the notices, the summary of a date comparison, "what moved" and the weekly digest. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;
  const wd = d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()];
  const KIND = { worse: ['turned worse', 'bad'], better: ['came back', 'ok'], done: ['got done', 'ok'], in: ['came in', 'watch'], change: ['change', ''], info: ['note', ''] };
  const DOMS = [['delivery', 'Delivery'], ['product', 'Product'], ['eng', 'Engineering'], ['quality', 'Quality'], ['ops', 'Operations'], ['release', 'Release'], ['knowledge', 'Knowledge']];

  function digest(ev, title) {
    const part = (head, kinds) => { const x = ev.filter(e => kinds.indexOf(e.kind) >= 0); return x.length ? `\n${head} (${x.length})\n` + x.map(e => `- ${wd(e.d)} ${K.dm(e.d)}: ${e.text}.`).join('\n') + '\n' : ''; };
    return `${title}\n` + part('Turned worse', ['worse']) + part('Came back or got done', ['better', 'done']) + part('Came into the sprint after the start', ['in']) + part('Releases, decisions and other changes', ['change', 'info']);
  }
  function page(ctx) {
    const cmp = SM.cmp && SM.cmp.on;
    const from = cmp ? SM.cmp.b : ctx.pick({ today: '2026-11-17', sprint: '2026-11-08', pi: '2026-09-27' }), to = cmp ? SM.cmp.a : D.now.date;
    const win = cmp ? `between ${K.dm(from)} and ${K.dm(to)}, the two days of the comparison` : ctx.pick({ today: 'today', sprint: 'in sprint 42 so far', pi: 'in PI 26.4 so far' });
    const base = D.events.filter(e => e.d > from && e.d <= to);
    const fd = SM.ui.evd || 'all', fk = SM.ui.evk || 'all';
    const rows = base.filter(e => (fd === 'all' || e.dom === fd) && (fk === 'all' || e.kind === fk || (fk === 'better' && e.kind === 'done'))).slice().reverse();
    const n = k => base.filter(e => k.indexOf(e.kind) >= 0).length;
    const fresh = D.events.filter(e => e.d >= '2026-11-17' && (e.d > '2026-11-17' || e.t >= '12:00') && ['worse', 'better', 'done', 'in'].indexOf(e.kind) >= 0);
    const week = D.events.filter(e => e.d >= '2026-11-16' && e.d <= D.now.date);
    const table = K.table([
      { h: 'When', cls: 's', v: e => `${wd(e.d)} ${K.dm(e.d)} <span class="faint">${esc(e.t)}</span>`, s: e => e.d + e.t },
      { h: 'Domain', cls: 's', v: e => `<a class="tag" href="${SM.domains.find(d => d.id === e.dom).pages[0].path}">${esc((DOMS.find(d => d[0] === e.dom) || ['', e.dom])[1])}</a>`, s: e => e.dom },
      { h: 'Kind', cls: 's', v: e => K.pill(KIND[e.kind][0], KIND[e.kind][1]), s: e => e.kind },
      { h: 'What happened', v: e => `${K.dot(e.tone)} ${e.to ? `<a class="dim" href="${e.to}">${esc(e.text)}</a>` : `<span class="dim">${esc(e.text)}</span>`}` },
      { h: 'Object', cls: 's', v: e => e.obj ? K.key(e.obj) : '<span class="faint">–</span>' },
      { h: 'Feeds', cls: 's', v: e => (fresh.indexOf(e) >= 0 ? '<span class="tag">notice</span> ' : '') + (e.kind !== 'info' ? '<span class="tag">digest</span> ' : '') + (e.kind === 'worse' && e.tone === 'bad' ? '<span class="tag">risk signal</span>' : '') }
    ], rows, { empty: { title: 'No event matches', text: 'Nothing of this kind happened in the window. Widen the horizon or clear a filter.' } });
    return {
      lede: `Every change of state of a fact, ${win}. An event is written by code when something goes off track, comes back, comes in, gets done or is released. Numbers that only drift make no event.`,
      acts: `<button class="btn" data-act="cmpmenu">◷ Compare two days</button>`,
      kpis: [
        { l: 'Events', v: base.length, s: win, nodelta: true }, { nodelta: true, l: 'Turned worse', v: n(['worse']), s: base.filter(e => e.kind === 'worse' && e.tone === 'bad').length + ' of them off track', tone: 'bad' },
        { nodelta: true, l: 'Came back or got done', v: n(['better', 'done']), tone: 'ok' }, { nodelta: true, l: 'Came in', v: n(['in']), s: 'into the sprint after its start', tone: 'watch' },
        { nodelta: true, l: 'Releases and decisions', v: n(['change', 'info']) }, { nodelta: true, l: 'Became a notice', v: fresh.length, s: 'since yesterday noon', to: '#/inbox' }
      ],
      body: K.grid(
        K.panel({ title: 'Events', sub: 'newest first · click a row text to open where the fact lives', w: 'c8 x8', src: ['jira', 'mon', 'ci', 'testrep', 'increp'], flush: true,
          right: K.seg('evk', [['all', 'All'], ['worse', 'Worse'], ['better', 'Better'], ['in', 'Came in'], ['change', 'Changes']], fk),
          body: `<div class="pd-0-14-8">${K.seg('evd', [['all', 'All domains']].concat(DOMS), fd)}</div>` + table,
          help: 'The log is computed, not typed: the app compares each read of a source with the one before and writes an event when the state of a fact changed.' }),
        K.stack('c4 x4',
          K.panel({ title: 'What the log feeds', body: K.list([
            { tone: 'ok', html: '<b>Notices</b> of the Inbox: events of the last day that somebody would want to hear about', v: fresh.length, to: '#/inbox' },
            { tone: 'ok', html: '<b>The summary of a date comparison</b> on every page: the events of its domain between two days', v: '◷' },
            { tone: 'ok', html: '<b>What moved</b> on Operations › Applications', to: '#/ops/services' },
            { tone: 'ok', html: '<b>Signals for the risk register</b>: what turned off track and is no risk yet', v: D.riskCandidates.length, to: '#/knowledge/risks' },
            { tone: 'ok', html: '<b>The weekly digest</b>, below' },
            { tone: 'ok', html: '<b>AI Command</b>: the answer to "today" and to "what changed since Monday?"' }]), foot: 'one log, so the same event reads the same everywhere' }),
          K.panel({ title: 'Weekly digest', sub: 'week 47 so far · a draft from the log', isNew: true,
            body: `<textarea class="draft minh-230" spellcheck="false" >${esc(digest(week, 'Team Kestrel · week 47, Mon 16.11 to Wed 18.11'))}</textarea><div class="rowf mt-8" ><button class="btn sm pri" data-toast="Copied. The app sends nothing: you paste it where you want it.">Copy</button><a class="btn sm" href="#/inbox">Drafts in the Inbox</a></div>` }),
          K.panel({ title: 'What makes an event', body: K.checks([
            { state: 'ok', html: 'A fact changes its state: on track, needs a look, off track' }, { state: 'ok', html: 'An item enters or leaves the sprint after its start' },
            { state: 'ok', html: 'An incident opens or is restored; an error group is new' }, { state: 'ok', html: 'A release reaches production; a pipeline turns red or green' },
            { state: 'ok', html: 'A decision is made or comes due; a risk changes its state' }, { state: '', html: 'A number that only drifts makes no event', sub: 'it shows as a change in a date comparison' }]) +
            `<div class="rowf mt-8" ><a class="btn sm" href="#/system/files">The rules as files</a></div>` })
        )
      )
    };
  }
  SM.single({ id: 'events', title: 'Event log', hz: ['today', 'sprint', 'pi'], was: 'new', from: '', find: 'events changes history what moved weekly digest', render: page });
})();
