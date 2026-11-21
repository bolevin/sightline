/* Domain: System. Sources and their state, the modules and how they plug in, the facts, the agent, the settings,
   and a gallery of what a panel says when its source is late, down, empty or off. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc;

  /* which module reads which source: the manifest of each domain module in one table */
  const MODULES = [
    { id: 'delivery', title: 'Delivery', needs: ['jira'], also: ['wiki', 'git'], facts: 41, tools: ['sm_sprint', 'sm_forecast', 'sm_flow'], kinds: ['issue'] },
    { id: 'product', title: 'Product', needs: ['jira'], also: ['wiki', 'logs', 'chat'], facts: 23, tools: ['sm_objectives', 'sm_feature'], kinds: ['feature'] },
    { id: 'eng', title: 'Engineering', needs: ['git'], also: ['ci', 'jira'], facts: 19, tools: ['sm_pull_requests', 'sm_builds'], kinds: ['pull request', 'build'] },
    { id: 'quality', title: 'Quality', needs: ['jira'], also: ['testrep', 'ci'], facts: 22, tools: ['sm_bugs', 'sm_tests'], kinds: ['test launch'] },
    { id: 'ops', title: 'Operations', needs: ['mon'], also: ['logs', 'increp', 'catalog', 'jira', 'chat'], facts: 27, tools: ['sm_services', 'sm_incidents'], kinds: ['application', 'incident', 'service level'] },
    { id: 'release', title: 'Release', needs: ['jira', 'ci'], also: ['testrep', 'mon', 'wiki'], facts: 14, tools: ['sm_release'], kinds: ['release'] },
    { id: 'knowledge', title: 'Knowledge', needs: [], also: ['jira', 'wiki'], facts: 12, tools: ['sm_risks'], kinds: ['risk', 'decision'] }
  ];
  const modState = m => {
    const need = m.needs.map(K.srcState), also = m.also.map(K.srcState);
    if (need.some(s => s === 'down' || s === 'off')) return ['bad', 'cannot compute: ' + m.needs.filter(id => ['down', 'off'].indexOf(K.srcState(id)) >= 0).map(id => K.source(id).name).join(', ')];
    const weak = m.needs.concat(m.also).filter(id => K.srcState(id) !== 'ok');
    if (weak.length) return ['watch', 'runs with gaps: ' + weak.map(id => K.source(id).name + ' ' + K.srcState(id)).join(', ')];
    return ['ok', 'all sources answer'];
  };

  SM.acts = SM.acts || {};
  SM.acts.sim = t => { const v = t.getAttribute('data-v'), id = t.getAttribute('data-id'), base = K.source(id).state; if (v === base) delete SM.src[id]; else SM.src[id] = v; SM.render(); };
  SM.acts.simreset = () => { SM.src = {}; SM.render(); };
  SM.acts.titles = () => { SM.store.set('titles', SM.store.get('titles', '1') === '1' ? '0' : '1'); SM.render(); };

  /* ── Sources ──────────────────────────────────────────────────────────── */
  function sourcesPage() {
    const st = D.sources.map(s => K.srcState(s.id)), n = w => st.filter(x => x === w).length;
    const word = { ok: 'answers', stale: 'stale', down: 'no answer', off: 'not connected' }, tone = { ok: 'ok', stale: 'watch', down: 'bad', off: '' };
    const rows = D.sources.map(s => {
      const cur = K.srcState(s.id), uses = MODULES.filter(m => m.needs.concat(m.also).indexOf(s.id) >= 0);
      return `<tr><td class="s">${K.dot(tone[cur], cur === 'off')} <b class="ink">${esc(s.name)}</b><span class="sub">${esc(s.kind)}</span></td>
        <td class="s">${K.pill(word[cur], tone[cur])}<span class="sub">${cur === 'ok' ? 'read ' + esc(s.age) + ' ago' : cur === 'stale' ? 'last good read ' + esc(s.last) : cur === 'down' ? 'last good read ' + esc(s.last) : esc(s.age)}</span></td>
        <td><span class="dim">${esc(s.reads)}</span>${s.why && cur !== 'ok' ? `<span class="sub">${esc(s.why)}</span>` : ''}</td>
        <td class="s"><span class="mono">${esc(s.via)}</span><span class="sub">every ${esc(s.every)}</span></td>
        <td>${uses.map(m => `<a class="tag" href="#/system/modules">${esc(m.title)}</a>`).join(' ')}</td>
        <td class="s"><div class="seg">${['ok', 'stale', 'down', 'off'].map(v => `<button class="${v === cur ? 'on' : ''}" data-act="sim" data-id="${s.id}" data-v="${v}">${v}</button>`).join('')}</div></td></tr>`;
    }).join('');
    return {
      lede: 'Everything the app reads, how fresh it is, and what stops working when a source does. The app only reads: there is no write path to any of them.',
      acts: Object.keys(SM.src).length ? `<button class="btn pri" data-act="simreset">Reset the simulation</button>` : '',
      kpis: [
        { l: 'Sources', v: D.sources.length, s: n('ok') + ' answer', tone: n('down') ? 'bad' : n('stale') ? 'watch' : 'ok' }, { l: 'Stale', v: n('stale'), s: 'older than twice their interval', tone: n('stale') ? 'watch' : 'ok' },
        { l: 'No answer', v: n('down'), s: 'the last read failed', tone: n('down') ? 'bad' : 'ok' }, { l: 'Not connected', v: n('off'), s: 'The team chat waits for an approval' },
        { l: 'Requests that write', v: 0, s: 'GET only, checked by a test', tone: 'ok' }, { l: 'Agent', v: D.agent.state, s: D.agent.engine + ' · last run ' + D.agent.lastRun, tone: 'ok', to: '#/system/agent' }
      ],
      body: K.grid(
        K.panel({ title: 'Sources', sub: 'state, what is read, how, and who uses it', w: 'c12', flush: true,
          right: '<span class="pill line">demo control: switch a source and open any page to see its panels degrade</span>',
          body: `<div class="tbwrap"><table class="tb"><thead><tr><th>Source</th><th>State</th><th>What the app reads</th><th>How</th><th>Used by</th><th>Simulate</th></tr></thead><tbody>${rows}</tbody></table></div>`,
          help: 'One row per source. The last column exists only in this demo: it sets a source to stale, down or off so that you can see what every panel does about it.' }),
        K.panel({ title: 'What happens when a source is late or gone', w: 'c6 x4', body: K.checks([
          { state: 'ok', html: '<b>Answers.</b> The panel shows its numbers; the footer names the source and its age.' },
          { state: 'watch', html: '<b>Stale.</b> The panel keeps the last read, dims it and says since when and why.', sub: 'older than twice the read interval' },
          { state: 'bad', html: '<b>No answer.</b> A panel that needs the source shows nothing and says so; a panel that uses it as one of several keeps the rest.', sub: 'no number of unknown age is shown as if it were fresh' },
          { state: '', html: '<b>Not connected.</b> The panel says what it would show and what it needs. It is not hidden.' },
          { state: '', html: '<b>Refused.</b> A 401 or 403 is shown as such with the last good read; the app never asks for a password on a page.' }]) }),
        K.panel({ title: 'Never read, never kept', w: 'c6 x4', body: K.list([
          { tone: '', html: 'Names of people, assignees, authors of changes, reviewers. The collectors do not ask for these fields.' },
          { tone: '', html: 'Titles and texts of issues of projects with customer data. Other titles are read while you look and kept nowhere.' },
          { tone: '', html: 'Log lines, payloads, message texts. Counts and error classes only.' },
          { tone: '', html: 'Tokens and passwords. They come from the Windows Credential Manager and go to their own host over https.' }]), foot: 'each line is a test in the repository' }),
        K.panel({ title: 'Reads of the last hour', sub: 'requests per source', w: 'c12 x4', body: K.hbars(D.sources.filter(s => s.state !== 'off').map((s, i) => ({ n: esc(s.name), v: [38, 4, 22, 41, 9, 62, 3, 2, 12][i], cls: K.srcState(s.id) === 'ok' ? 's1' : 'watch', label: [38, 4, 22, 41, 9, 62, 3, 2, 12][i] + ' GET' })), { nw: 110, vw: 64 }) })
      )
    };
  }

  /* ── Architecture ─────────────────────────────────────────────────────── */
  /* the diagram: boxes in columns on a CSS grid, small inline-SVG arrows between them, lamps that follow the sources */
  const LAMP = { ok: 'ok', stale: 'watch', down: 'bad', off: '' };
  const WORD = { ok: 'answers', stale: 'stale', down: 'no answer', off: 'not connected' };
  const lamp = st => K.dot(LAMP[st], st === 'off');
  const harrow = (label, cls) => `<div class="sx-ar ${cls || ''}"><span class="sx-al">${label}</span><svg class="sx-av" width="56" height="12" viewBox="0 0 56 12" aria-hidden="true"><line x1="2" y1="6" x2="49" y2="6"/><path d="M47 1.5 54 6 47 10.5"/></svg></div>`;
  const varrow = (label, up, cls) => `<div class="sx-vr ${cls || ''}"><svg class="sx-av" width="12" height="44" viewBox="0 0 12 44" aria-hidden="true">${up ? '<line x1="6" y1="43" x2="6" y2="7"/><path d="M1.5 9 6 2 10.5 9"/>' : '<line x1="6" y1="1" x2="6" y2="37"/><path d="M1.5 35 6 42 10.5 35"/>'}</svg><span class="sx-al">${label}</span></div>`;
  const box = (o) => {
    const tag = o.to ? 'a' : 'div';
    return `<${tag} class="sx-b${o.dash ? ' dash' : ''}${o.cls ? ' ' + o.cls : ''}"${o.to ? ` href="${o.to}"` : ''}${o.tip ? ` data-tip="${esc(o.tip)}"` : ''}>
      <span class="sx-bt">${o.st != null ? lamp(o.st) : ''}<b>${o.t}</b>${o.v != null ? `<span class="sx-bv">${o.v}</span>` : ''}</span>${o.s ? `<span class="sx-bs">${o.s}</span>` : ''}</${tag}>`;
  };
  const column = (n, title, sub, inner, cls) => `<div class="sx-col ${cls || ''}"><div class="sx-ch"><b>${n} · ${title}</b><span>${sub}</span></div><div class="sx-cb">${inner}</div></div>`;

  function archDiagram() {
    const st = D.sources.map(s => K.srcState(s.id));
    const reading = st.filter(x => x === 'ok' || x === 'stale').length;
    const adSt = st.some(x => x === 'down') ? 'down' : st.some(x => x === 'stale') ? 'stale' : 'ok';
    const facts = MODULES.reduce((s, m) => s + m.facts, 0);
    const domPages = SM.domains.filter(d => !d.hidden && d.id !== 'home' && d.id !== 'system').reduce((s, d) => s + d.pages.length, 0);
    const tools = ['sm_sprint', 'sm_forecast', 'sm_flow', 'sm_feature', 'sm_pull_requests', 'sm_builds', 'sm_bugs', 'sm_tests', 'sm_services', 'sm_incidents', 'sm_release', 'sm_risks'];
    const agOn = D.agent.state === 'on';
    const sources = D.sources.map((s, i) => box({ t: esc(s.name), st: st[i], v: st[i] === 'ok' ? esc(s.age) : st[i] === 'off' ? 'off' : WORD[st[i]], to: '#/system/sources', cls: 'is-' + st[i], tip: s.name + ': ' + s.reads + '<small>' + s.via + ' · every ' + s.every + ' · click for Sources</small>' })).join('');
    const mods = MODULES.map(m => {
      const s = modState(m), dom = SM.domains.find(d => d.id === m.id);
      return box({ t: esc(m.title), st: s[0] === 'ok' ? 'ok' : s[0] === 'watch' ? 'stale' : 'down', v: m.facts + ' facts', s: esc(s[1]), dash: s[0] === 'bad', to: dom ? dom.pages[0].path : null, tip: m.title + ': needs ' + (m.needs.map(id => K.source(id).name).join(', ') || 'nothing but your own notes') + '<small>' + esc(s[1]) + ' · click to open its first page</small>' });
    }).join('');
    const grid = `<div class="sx-arch">
      ${column(1, 'Sources', 'read-only', sources, 'g1')}
      ${harrow('GET only', 'g2')}
      ${column(2, 'Adapters', 'one per source', box({ t: 'Adapters', st: adSt, v: reading + ' of ' + D.sources.length + ' read', s: 'GET-only clients, allow-list of fields, samplers', tip: 'One file per source in sm/adapters/<small>reads with GET, keeps the fields of its allow-list, writes a sanitized sample folder, reports its age and last error</small>' }), 'g3')}
      ${harrow('sanitized objects', 'g4')}
      ${column(3, 'Fact layer', 'plain data under var/', '<i class="sx-sp"></i>' +
        box({ t: 'Objects', v: '12 kinds', s: 'team, application, feature, issue, pull request, build, test launch, release, incident, service level, risk, decision' }) +
        box({ t: 'Links', s: 'issue to pull request to build to deployment to incident' }) +
        box({ t: 'Facts', v: facts, s: 'each with definition, source, query, time', to: '#/system/facts', tip: 'Everything a page may show and the agent may cite<small>click for the list of facts</small>' }) + '<i class="sx-stem"></i>', 'g5 sx-fl')}
      ${harrow('facts', 'g6')}
      ${column(4, 'Domain modules', 'plug-ins', mods, 'g7')}
      ${harrow('pages, tabs, home lines', 'g8')}
      ${column(5, 'Views', 'what you open', '<i class="sx-sp"></i>' +
        box({ t: 'Homes', v: (D.roles.length + 1) + ' screens', s: 'Overview, and five by role', to: SM.homePath() }) +
        box({ t: 'Domain pages', v: domPages, s: 'from the manifests of the modules', to: '#/map' }) +
        box({ t: 'Entity pages', v: Object.keys(SM.entities).length + ' kinds', s: 'one layout per kind, tabs from the modules' }) +
        box({ t: 'Inbox', v: D.notices.length, s: 'notices, decisions waiting, drafts', to: '#/inbox' }) + '<i class="sx-stem"></i>', 'g9 sx-fl')}
      ${harrow('on this computer', 'g10')}
      ${column(6, 'You', 'the only one who acts', box({ t: 'You', s: 'read, decide, copy drafts and send them yourself' }), 'g11')}
      <div class="sx-band" aria-hidden="true"></div>
      <div class="sx-bandh"><b>The agent</b><span>a branch under the main line, optional. With it off, every page is laid out by rules.</span></div>
      ${varrow('facts', false, 'r2 g5')}
      ${varrow('checked lines', true, 'r2 g9')}
      <div class="r3 g5">${box({ t: 'Tools', v: '12', s: '12 read-only tools over MCP', tip: tools.join(', ') + '<small>typed, aggregated, read-only</small>' })}</div>
      ${harrow('facts and tool answers', 'r3 g6')}
      <div class="r3 g7">${box({ t: 'Agents', st: agOn ? 'ok' : 'off', v: agOn ? 'on · ' + esc(D.agent.lastRun) : 'off', s: 'briefing, ask, search, editor. Engine ' + esc(D.agent.engine) + ' with the ' + esc(D.agent.models), to: '#/system/agent', dash: !agOn })}</div>
      ${harrow('lines that cite facts', 'r3 g8')}
      <div class="r3 g9">${box({ t: 'Check by code', v: D.agent.checked + ' checked', s: 'every digit and key is a fact, or the line is dropped. ' + D.agent.dropped + ' dropped today.' })}</div>
      <div class="r4 g7">${box({ t: 'Rule lines', s: 'written by code from the home lines of the modules', cls: 'rule' })}</div>
      <div class="r4 sx-back"><i class="sx-elb"></i><svg class="sx-ah" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M8.5 1.5 1.5 6 8.5 10.5"/></svg><span class="sx-al">no agent, or its line fails the check: the rule line for the same fact</span></div>
    </div>`;
    const side = `<aside class="sx-side">
      <div class="sx-nf">${K.dot('ok')}<span><b>Nothing flows back: there is no write path to any source.</b> Every arrow points away from the sources; the adapters can only GET.</span></div>
      <div class="sx-leg"><span>${K.dot('ok')}answers</span><span>${K.dot('watch')}stale</span><span>${K.dot('bad')}no answer</span><span>${K.dot('', true)}not connected</span><span><i class="sx-dashk"></i>cannot compute</span><span><i class="sx-flowk"></i>dashed arrow: the fallback</span></div>
      <div class="sx-hint">Switch a source under System, Sources and come back: the lamps of the sources, the adapters and the modules follow.</div>
    </aside>`;
    return `<div class="sx-wrap"><div class="sx-scroll tbwrap">${grid}</div>${side}</div>`;
  }

  function modulesPage() {
    const flow = archDiagram();
    const manifest = `{
  "id": "quality",
  "title": "Quality",
  "needs":  ["jira"],                         // without these the module is off
  "also":   ["testrep", "ci"],      // each adds panels; missing ones leave gaps, not errors
  "objects": ["test_launch", "test_item"],    // kinds it adds to the fact layer
  "links":   [["test_item", "fails_for", "issue"]],
  "facts":   "quality/facts.py",              // pure functions: objects in, facts out
  "pages":   [{"id": "bugs", "horizons": ["sprint", "pi", "quarter"]},
              {"id": "tests", "horizons": ["today", "sprint", "pi"]}],
  "entity_tabs": [{"kind": "application", "tab": "Quality"}],
  "home_lines":  [{"role": "tl", "rule": "test.to_investigate > 0"}],
  "agent_tools": ["sm_bugs", "sm_tests"],     // read-only, typed, aggregated
  "definitions": "quality/definitions.md"     // every number: what is counted, version
}`;
    return {
      lede: 'How the app is put together: sources, adapters, one layer of facts, domain modules that plug in, views on top, and the agent as an optional branch. The lamps follow the state of the sources.',
      kpis: [
        { l: 'Domain modules', v: MODULES.length, s: MODULES.filter(m => modState(m)[0] === 'ok').length + ' with all sources', tone: MODULES.some(m => modState(m)[0] === 'bad') ? 'bad' : MODULES.some(m => modState(m)[0] === 'watch') ? 'watch' : 'ok' },
        { l: 'Facts', v: MODULES.reduce((s, m) => s + m.facts, 0), s: 'computed by code', to: '#/system/facts' }, { l: 'Object kinds', v: 12, s: 'team to decision' },
        { l: 'Agent tools', v: MODULES.reduce((s, m) => s + m.tools.length, 0), s: 'all read-only', to: '#/system/agent' }, { l: 'Screens', v: SM.order.length + Object.keys(SM.entities).length, s: 'see the map', to: '#/map' }
      ],
      body: K.grid(
        K.panel({ title: 'From source to screen', sub: 'left to right; the lamps follow the sources; click a box to open it', w: 'c12', body: flow,
          help: 'The main line runs from the sources to you. The agent is a branch under it: it gets facts and tool answers, its lines are checked by code, and a line that fails is replaced by the rule line for the same fact.' }),
        K.panel({ title: 'Modules', sub: 'what each needs and gives', w: 'c7', flush: true, body: K.table([
          { h: 'Module', v: m => `<a class="ent" href="${SM.domains.find(d => d.id === m.id).pages[0].path}">${esc(m.title)}</a>` },
          { h: 'Needs', v: m => m.needs.map(K.srcChip).join(' ') || '<span class="faint">your own notes</span>' }, { h: 'Also reads', v: m => m.also.map(id => `<span class="tag">${esc(K.source(id).name)}</span>`).join(' ') },
          { h: 'Facts', n: true, v: m => m.facts }, { h: 'Pages', n: true, v: m => SM.domains.find(d => d.id === m.id).pages.length }, { h: 'Object kinds', v: m => `<span class="dim">${esc(m.kinds.join(', '))}</span>` },
          { h: 'State', cls: 's', v: m => { const s = modState(m); return K.pill(s[0] === 'ok' ? 'active' : s[0] === 'watch' ? 'with gaps' : 'off', s[0]); } }], MODULES) }),
        K.panel({ title: 'What a module declares', sub: 'its manifest', w: 'c5', body: `<div class="code">${esc(manifest)}</div>`, foot: 'the core reads manifests; a module never imports another module' }),
        K.panel({ title: 'Adding a source', w: 'c6 x4', body: K.checks([
          { state: 'ok', html: '<b>1. An adapter.</b> One file: the GET calls, the allow-list of fields, how fresh is fresh.' },
          { state: 'ok', html: '<b>2. Objects and links.</b> What it adds to the fact layer, in the shared words (application, release, incident).' },
          { state: 'ok', html: '<b>3. A sample folder.</b> Sanitized answers, so the module is built and tested at home.' },
          { state: 'ok', html: '<b>4. Modules opt in.</b> A module names the source under "also"; its panels appear. Nothing else changes.' }]) }),
        K.panel({ title: 'Adding a domain', w: 'c6 x4', body: K.checks([
          { state: 'ok', html: '<b>1. A folder with a manifest.</b> Needs, facts, pages, entity tabs, home lines, agent tools.' },
          { state: 'ok', html: '<b>2. Facts as pure functions.</b> Objects in, facts out, each with its definition and version.' },
          { state: 'ok', html: '<b>3. Pages from the kit.</b> Panels declare their sources; the degradation comes with the panel.' },
          { state: 'ok', html: '<b>4. Tests.</b> The facts against a golden sample; the rule that no fact carries a person.' }]) }),
        K.panel({ title: 'What stays as it is today', w: 'c12 x4', body: K.list([
          { tone: 'ok', html: 'Read-only: a client that can only GET, with your personal key.' }, { tone: 'ok', html: 'Code computes every number; the agent only chooses and words.' },
          { tone: 'ok', html: 'Rules mode: every page works with the agent off.' }, { tone: 'ok', html: 'A local server from the standard library, no database, files under var/.' }, { tone: 'ok', html: 'Team level only, checked by tests.' }]) })
      )
    };
  }

  /* ── Facts ────────────────────────────────────────────────────────────── */
  function factsPage() {
    const ids = Object.keys(D.facts);
    const srcs = Array.from(new Set(ids.map(i => D.facts[i].src)));
    return {
      lede: 'Everything a page may show and the agent may cite. A fact has an id, a value, a definition with a version, a source, a query and a time. This demo lists the facts behind its headline numbers; the app has about 160.',
      kpis: [{ l: 'Facts in this demo', v: ids.length, s: 'of about 158 in the app' }, { l: 'Sources behind them', v: srcs.length }, { l: 'With a definition', v: ids.length, s: 'all of them', tone: 'ok', to: '#/knowledge/definitions' }, { l: 'Carry a person', v: 0, s: 'checked by a test', tone: 'ok' }],
      body: K.grid(K.panel({ title: 'Facts', sub: 'click a row for the evidence', w: 'c12', flush: true, right: K.filter('fs', [['all', 'All', ids.length]].concat(srcs.map(s => [s, K.source(s).name, ids.filter(i => D.facts[i].src === s).length]))),
        body: K.table([{ h: 'Fact', cls: 's', v: i => `<span class="mono">${esc(i)}</span>`, s: i => i }, { h: 'Says', v: i => `<span class="dim">${esc(D.facts[i].say)}</span>` }, { h: 'Source', cls: 's', v: i => K.srcChip(D.facts[i].src), s: i => D.facts[i].src }, { h: 'Rows', n: true, v: i => K.fmt(D.facts[i].rows), s: i => D.facts[i].rows }, { h: 'Definition', cls: 's', v: i => esc(D.facts[i].v) }],
          ids, { attrs: i => `data-ev="${i}" data-f-fs="all ${D.facts[i].src}"` }) }))
    };
  }

  /* ── Agent ────────────────────────────────────────────────────────────── */
  function agentPage() {
    const runs = [
      ['11:42', 'Briefing', 'facts changed: KES-4142 done', '14 s', '8 lines, all kept', 'ok'], ['10:58', 'Ask', 'question in AI Command (Product Owner)', '9 s', '3 tool calls, 3 facts cited', 'ok'],
      ['09:31', 'Briefing', 'Refresh', '16 s', '8 lines, 1 dropped: a number that is no fact', 'watch'], ['09:02', 'Search', 'question turned into JQL', '4 s', 'query shown, run by Jira', 'ok'],
      ['08:15', 'Briefing', 'first open of the day', '15 s', '7 lines, all kept', 'ok'], ['08:15', 'Ask', 'question in AI Command (Scrum Master)', '11 s', '2 tool calls, 3 facts cited', 'ok']
    ];
    return {
      lede: 'The agent is an option on top. It chooses among facts and words them; it computes nothing and has no way to write anywhere. With it switched off every page is laid out by rules.',
      kpis: [{ l: 'Engine', v: D.agent.engine, s: D.agent.models }, { l: 'Runs today', v: D.agent.runsToday, s: 'last at ' + D.agent.lastRun }, { l: 'Lines checked', v: D.agent.checked, s: '<b>' + D.agent.dropped + ' dropped</b>', tone: 'watch' }, { l: 'Tools', v: 12, s: 'all read-only', tone: 'ok' }, { l: 'Write tools', v: 0, tone: 'ok' }],
      body: K.grid(
        K.panel({ title: 'Three agents', w: 'c6', body: K.checks([
          { state: 'ok', html: '<b>Briefing agent.</b> Gets the facts of the home of one role in one message, returns lines that cite fact ids. No tools at all.', sub: 'runs when facts changed, at most every 30 minutes, and on Refresh' },
          { state: 'ok', html: '<b>Ask agent.</b> Answers a question through the read-only tools of the modules.', sub: 'sm_sprint, sm_forecast, sm_flow, sm_feature, sm_pull_requests, sm_builds, sm_bugs, sm_tests, sm_services, sm_incidents, sm_release, sm_risks' },
          { state: 'ok', html: '<b>Search agent.</b> Turns a question into a query for Jira or Wiki. The query is shown and you run it.', sub: 'no tools; a query about a person is refused' }]) }),
        K.panel({ title: 'What code checks before a line is shown', w: 'c6', body: K.checks([
          { state: 'ok', html: 'Every digit in the line is in the facts it cites.' }, { state: 'ok', html: 'Every issue key in the line exists in the data.' },
          { state: 'ok', html: 'A cited fact reads the same now as when the line was written; if not, the line is dropped.' }, { state: 'watch', html: 'The meaning of a sentence is not checked: two numbers of one line could be swapped.', sub: 'said here because it is true' },
          { state: 'ok', html: 'A dropped line is replaced by the rule line for the same fact.' }]) }),
        K.panel({ title: 'Runs', sub: 'today, newest first', w: 'c8', flush: true, body: K.table([{ h: 'When', cls: 's', v: r => r[0] }, { h: 'Agent', cls: 's', v: r => r[1] }, { h: 'Why it ran', v: r => `<span class="dim">${esc(r[2])}</span>` }, { h: 'Took', n: true, v: r => r[3] }, { h: 'Result', v: r => `${K.dot(r[5])} ${esc(r[4])}` }], runs), foot: 'kept in var/agent-runs.jsonl on this computer' }),
        K.panel({ title: 'What the agent never gets', w: 'c4', body: K.list([{ tone: '', html: 'Titles of issues, unless you allow it for projects without customer data.' }, { tone: '', html: 'Your risk register, your drafts, what you sent.' }, { tone: '', html: 'Texts of incident reports: they are written by a model and are shown to you only.' }, { tone: '', html: 'Anything about a person.' }]) })
      )
    };
  }

  /* ── Files ────────────────────────────────────────────────────────────── */
  /* the app's own Markdown files: instructions of the agents, rules, definitions, team texts.
     State lives here for the session; nothing is written to disk or to the browser. */
  const NOWRITE = ['write', 'edit', 'patch', 'bash', 'webfetch'];
  const AGENT_HEAD = (desc, extra) => `---
description: ${desc}
mode: subagent
temperature: 0.1
tools:
  write: false
  edit: false
  patch: false
  bash: false
  webfetch: false${extra || ''}
---
`;
  const FILES = [
    { g: 'Agents', p: 'agents/briefing.md', what: 'words the facts of a role\'s home; no tools', agent: true,
      text: AGENT_HEAD('Words the facts of a role\'s home as short lines. Computes nothing.') + `
You write the briefing of one role of Sightline.

## What you get
- One message with the facts of the role: id, value, text, definition version.
- The role: Scrum Master, Tech Lead, Application Manager, Team Lead or Product Owner.

## What you return
- At most 8 lines, the most important first.
- Each line ends with the fact ids it uses in square brackets, for example [sprint.done_sp].
- Every number and every issue key in a line comes from a cited fact.

## Rules
- Choose and word. Do not add, subtract or round a number.
- Name no person. Say "the team" or the role.
- If two facts disagree, say so in one line and cite both.
- No advice in the imperative. State what is true.

Code checks each line before it is shown. A line that fails is dropped
and the rule line for the same fact takes its place.
`,
      prop: { sum: 'Refuse a line about a person instead of rewording it.', blocks: [['- Name no person. Say "the team" or the role.', '- Name no person. Say "the team" or the role.\n- A line that only makes sense about a person is refused, not reworded.\n  Return "refused: about a person" with the fact id instead.']] },
      asks: ['Add a rule that a line about a person is refused, not reworded', 'Limit a line to 20 words', 'Put the line about blocked items first'] },
    { g: 'Agents', p: 'agents/ask.md', what: 'answers through the twelve read-only tools; cites fact ids', agent: true,
      text: AGENT_HEAD('Answers a question about the team through the read-only tools.', '\n  sm_*: true') + `
You answer questions about one team in the Ask panel.

## Tools
Twelve tools, all read-only and aggregated:
sm_sprint, sm_forecast, sm_flow, sm_feature, sm_pull_requests, sm_builds,
sm_bugs, sm_tests, sm_services, sm_incidents, sm_release, sm_risks.

## How you answer
- Call the tools you need, at most 6 calls for one question.
- Cite the fact id of every number: "25 SP done [sprint.done_sp]".
- If no tool answers the question, say what is missing. Do not guess.
- Keep the answer under 120 words unless the user asks for more.

## What you refuse
- Any question about a person: who did what, who is slow, who reviews most.
  Answer: "The app holds team totals only."
- Writing to Jira, Wiki, Git hosting or the team chat. You have no tool for it.
`,
      prop: { sum: 'Say when a cited fact is stale and how old it is.', blocks: [['- If no tool answers the question, say what is missing. Do not guess.', '- If no tool answers the question, say what is missing. Do not guess.\n- When a cited fact comes from a stale source, say so and give its age.']] },
      asks: ['Say when a fact is stale', 'Allow 8 tool calls for one question', 'Answer in German when asked in German'] },
    { g: 'Agents', p: 'agents/sm-search.md', what: 'turns a question into JQL and CQL; refuses a query about a person', agent: true,
      text: AGENT_HEAD('Turns a question into JQL or CQL that the user sees and runs.').replace('temperature: 0.1', 'temperature: 0') + `
You turn a question in plain words into one query.

## Output
- One JQL query for Jira, or one CQL query for Wiki.
- One line that says in plain words what the query finds.
- Nothing else. The user copies the query and runs it.

## Scope
- Jira: the board filter 7 and the project KES.
- Wiki: the team space KESTREL.

## Refuse
- A query about a person: assignee, reporter, creator, author, reviewer,
  watcher, or a name in any field. Answer: "A query about a person is refused."
- A query on projects with customer data (KESBUG, KES EXT).
`,
      prop: { sum: 'Use field names, never custom field ids.', blocks: [['- One JQL query for Jira, or one CQL query for Wiki.', '- One JQL query for Jira, or one CQL query for Wiki.\n- Use the field names of Jira, never custom field ids.']] },
      asks: ['Use field names, not custom field ids', 'Add the space of the train to the scope', 'Explain the query in German too'] },
    { g: 'Agents', p: 'agents/sm-editor.md', what: 'proposes edits to these files as search-and-replace blocks; cannot save', agent: true,
      text: AGENT_HEAD('Proposes edits to the app\'s own instruction files. Cannot save.').replace('temperature: 0.1', 'temperature: 0.2').replace('tools:\n', 'tools:\n  read: true\n') + `
You propose changes to one Markdown file of Sightline.

## What you get
- The path and the full text of the open file.
- A request in plain words.

## What you return
- A summary of the change in one line.
- One or more blocks of this form, in order:

  <<<<<<< SEARCH
  the exact lines as they are now
  =======
  the lines as they should be
  >>>>>>> REPLACE

- Each SEARCH part must match the file exactly once.

## Rules
- Change only what the request asks for.
- Never switch a write tool on in an agent file.
- Never add a rule that reads or shows a person.
- You cannot save. The user checks the changes and saves or discards them.
`,
      prop: { sum: 'Keep the style of the file in every proposal.', blocks: [['- Change only what the request asks for.', '- Change only what the request asks for.\n- Keep the style of the file: sentence case, plain statements, no slogans.']] },
      asks: ['Keep the style of the file', 'Ask back when the request is unclear', 'Never touch the YAML header'] },
    { g: 'Rules', p: 'rules/team-level.md', what: 'what counts as a person and is never read or shown',
      text: `# Team level only

The app shows one team. It never reads, keeps or shows anything about a person.

## What counts as a person
- A name, a user name, an e-mail address, an avatar, an account id.
- A field that points to one person: assignee, reporter, creator, author,
  reviewer, approver, watcher, the person on call.
- A number that belongs to one person, even without a name:
  "the developer with the most open items", "reviews by the third reviewer".
- A group so small that it is one person: a role held by one person,
  a count of 1 split by who did it.

## What is allowed
- Roles as words: "Product owner", "Test engineer".
- Team totals: story points, items, pull requests, hours of waiting.
- Capacity as typed in at sprint planning, as team totals.

## How it is enforced
- The adapters do not ask Jira, Git hosting or Build server for these fields.
- A test fails when a fact carries a field of the list above.
- The agents get the same facts as the pages, so they cannot see more.

## When in doubt
Leave it out and write the question into docs/questions.md for the owner.
`,
      prop: { sum: 'Allow absences only as one team total per sprint.', blocks: [['- Capacity as typed in at sprint planning, as team totals.', '- Capacity as typed in at sprint planning, as team totals.\n- Absences as one team total per sprint, never by day and person.']] },
      asks: ['Allow absences only as a team total', 'Add commit messages to what is never read', 'Say what happens to a count of 2'] },
    { g: 'Rules', p: 'rules/customer-data.md', what: 'projects whose texts stay in Jira',
      text: `# Customer data stays in Jira

Some projects hold customer data in their texts: names, customer numbers,
card numbers, addresses. The app reads these projects for counts only.

## Projects with customer data
- KESBUG
- KES EXT

## What the app reads from them
- Keys, types, statuses, priorities, dates, links.
- Counts per status and per week.

## What it never reads
- Summary, description, comments, attachments, custom text fields.

## What a page shows
- The count and the keys. A panel says "withheld by a rule" and links here.
- A key opens the issue in Jira, where the access rules of Jira apply.

## What the agent gets
- The counts only. Never a key of these projects in a prompt.
`,
      prop: { sum: 'Treat a project that is not listed as one with customer data.', blocks: [['- The counts only. Never a key of these projects in a prompt.', '- The counts only. Never a key of these projects in a prompt.\n\n## A project that is not listed\nIt counts as a project with customer data until the owner lists it\nin sm-assistant.ini as free of customer data.']] },
      asks: ['Treat an unknown project as one with customer data', 'Add labels to what the app reads', 'Name the panel that shows the counts'] },
    { g: 'Rules', p: 'rules/thresholds.md', what: 'the values the pages compare against', rules: true,
      text: `# Thresholds

The values the pages compare against. Live: the pages follow this file after Save.
A value is a line "- key: value  # what it means". A key the app does not know is refused.

## Bugs
- bug_fix_days_blocker: 2  # working days to fix a Blocker
- bug_fix_days_critical: 5  # working days to fix a Critical
- bug_fix_days_major: 15  # working days to fix a Major
- bug_fix_days_minor: 30  # working days to fix a Minor

## Sprint
- sprint_kept_pct: 80  # a sprint kept its promise at this share of the commitment done, in %
- wip_limit: 6  # items in Implementing at most (working agreement WA-4)
- unplanned_work_pct: 20  # bugs and support at most, in % of the done work (WA-5)

## Code
- pr_wait_hours: 24  # a pull request waits too long after this many hours, weekends left out

## Sources and service levels
- stale_source_factor: 2  # a source is stale when older than this many read intervals
- budget_low_pct: 35  # an error budget below this share is shown as low, in %
`,
      prop: { sum: 'Raise the WIP limit to 7.', blocks: [['- wip_limit: 6  # items in Implementing at most (working agreement WA-4)', '- wip_limit: 7  # items in Implementing at most (working agreement WA-4)']] },
      asks: ['Raise the WIP limit to 7', 'Give a Major 10 working days', 'Call a source stale after three intervals'] },
    { g: 'Rules', p: 'rules/release-checks.md', what: 'the eight checks of the Readiness page', rules: true,
      text: `# Release checks

The checks of the Readiness page, one block per check. A check reads its
source and compares it with the threshold here.
Live: the pages follow this file after Save.

## scope
Is everything planned for the release done? No threshold: every issue counts.

## blockers
Is there an open blocker or critical bug against the release?
- open_blockers_max: 0  # blocked items or critical bugs allowed

## build
Is main green in every repository?
- main_green_repos: all  # repositories whose main must be green

## regress
Is the nightly regression good enough?
- regression_min_pct: 96  # least share of passed test items, in %
- regression_to_investigate_max: 0  # failures still marked "To investigate"

## int
Is the release candidate on INT in every application?
- rc_on_int: all  # applications that must run the candidate on INT

## smoke
Did the smoke test on INT pass?
- smoke_on_int: all passed  # result of the last smoke launch on INT

## notes
Does the release notes page exist, and is it recent?
- release_notes_edited_within_days: 7  # days since the last edit

## slo
Was a service level breached in the last 30 days?
- slo_breached_max: 0  # service levels allowed to be breached
`,
      prop: { sum: 'Lower the regression gate to 94 % and allow up to 5 failures to investigate until release 2026.12.', blocks: [
        ['- regression_min_pct: 96  # least share of passed test items, in %', '- regression_min_pct: 94  # least share of passed test items, in %; 96 again after release 2026.12'],
        ['- regression_to_investigate_max: 0  # failures still marked "To investigate"', '- regression_to_investigate_max: 5  # failures still marked "To investigate"; 0 again after release 2026.12']] },
      asks: ['Lower the regression gate to 94 % until release 2026.12', 'Allow one breached service level', 'Ask for release notes edited within 3 days'] },
    { g: 'Definitions', p: 'modules/delivery/definitions.md', what: 'committed, done, carried over, cycle time',
      text: `# Delivery: definitions

Every number of the Delivery pages is one of these. A change gets a new
version; old numbers keep the version they were computed with.

## Committed
Version 3 of 14.11.2026.
Story points of the items in the sprint at the moment Start was pressed,
with the points they had at that moment. Sub-tasks are left out.
Same rule as Jira's sprint report.

## Done
Version 2 of 14.11.2026.
Items whose status lies in the last column of the board (Done).
Rejected counts as closed, not as done.

## Carried over
Version 1 of 02.10.2026.
An item that was in an earlier sprint of this board and not done there.
Its sprint no. counts the sprints it has been in.

## Cycle time
Version 1 of 14.11.2026.
Days from the first status past To do until Done.
The 85th percentile is taken over the items finished in the last 12 weeks.

## Not counted
- Items without story points add nothing to a sum of points.
  Pages say how many there are.
`,
      prop: { sum: 'Say how an item that left a sprint and came back is counted.', blocks: [['Version 1 of 02.10.2026.', 'Version 2 of 18.11.2026.'], ['Its sprint no. counts the sprints it has been in.', 'Its sprint no. counts the sprints it has been in.\nAn item taken out of a sprint and put back in the same sprint counts once.']] },
      asks: ['Say how an item that came back is counted', 'Add a definition of throughput', 'Say which statuses count as To do'] },
    { g: 'Definitions', p: 'modules/quality/definitions.md', what: 'open bug, days to fix, pass rate, to investigate',
      text: `# Quality: definitions

Every number of the Quality pages is one of these.

## Open bug
Version 2 of 17.11.2026.
An issue of type Bug in the board filter that is not resolved,
whatever its age or priority.

## Days to fix
Version 1 of 16.10.2026.
Working days from created to resolved. Thresholds by priority:
Blocker 2, Critical 5, Major 15, Minor 30.

## Pass rate of the nightly regression
Version 1 of 16.11.2026.
Passed test items of the last launch of regression-nightly against all
its items. Skipped items count as not passed.

## To investigate
Version 1 of 16.11.2026.
Failed test items whose defect type in the test reports is still
"To investigate".

## Found in
Version 1 of 16.10.2026.
The environment a bug was found in, from the Jira field "Found in".
A bug without a value is shown as "not stated".
`,
      prop: { sum: 'Say which days count as working days for days to fix.', blocks: [['Working days from created to resolved. Thresholds by priority:', 'Working days from created to resolved, without the public holidays\nof the team calendar. Thresholds by priority:']] },
      asks: ['Leave public holidays out of days to fix', 'Count skipped tests apart', 'Add a definition of a flaky test'] },
    { g: 'Team', p: 'team/working-agreements.md', what: 'the five agreements the app checks',
      text: `# Working agreements of Team Kestrel

Agreed at PI Planning and in retrospectives. The app checks each one
against the data and shows how often it was kept.

## WA-1 Reviews
Every pull request gets a first review within one working day.

## WA-2 Ready before the sprint
Every story has a feature link and an estimate before the sprint starts.

## WA-3 Production bugs
A bug from production is looked at within one working day.

## WA-4 Work in progress
At most six items in Implementing.

## WA-5 Work mix
At most 20 % of the done work is bugs and support.

## How they change
A change is agreed in a retrospective and written here the same day.
The app shows the date of the last change on Knowledge, Agreements.
`,
      prop: { sum: 'Say that blocked items count against the limit of WA-4.', blocks: [['At most six items in Implementing.', 'At most six items in Implementing. Blocked items count too.']] },
      asks: ['Say that blocked items count against WA-4', 'Add who may change an agreement', 'Name the retrospective of each agreement'] },
    { g: 'Team', p: 'team/glossary.md', what: 'words the team uses, as the app uses them',
      text: `# Glossary

Words the team uses, as the app uses them.

- **Application**: a deployable part the team runs, for example the
  Checkout API. Each has a page.
- **Feature**: an issue of type Feature on the board of the train.
- **PI**: eleven weeks, three sprints of three weeks and an IP sprint of two.
- **Freeze**: the date after which only fixes go into a release.
- **Winter sale**: the sale that starts on 13.12.2026.
- **Role**: the view of one role: its home page and its pinned pages.
- **Horizon**: Today, Sprint, PI or Quarter.
- **Rule line**: a line on a home that code writes when the agent is off
  or its line failed the check.
- **On-call**: who answers for production. The incident reports are read as files.
- **Train**: the agile release train the team belongs to.
`,
      prop: { sum: 'Add the word hotfix.', blocks: [['- **Horizon**: Today, Sprint, PI or Quarter.', '- **Horizon**: Today, Sprint, PI or Quarter.\n- **Hotfix**: a release outside the train for one fix. It counts as a release.']] },
      asks: ['Add the word hotfix', 'Add the word enabler', 'Sort the words alphabetically'] },
    { g: 'Engine', p: 'agents/README.md', what: 'written by the installer', ro: true,
      text: `# agents

This folder is written by the app's installer. Edit the files under
agents/ through System, Files; edit nothing here by hand.

- agents/: one instruction file per agent.
- agents.json: the engine settings. Models come from your subscription.
- The MCP server "sightline" serves the twelve read-only tools on localhost.

Read-only: the app replaces this file on every update.
` }
  ];
  const fileOf = p => FILES.find(f => f.p === p);

  /* rules as files: the two rules files are the single source of thresholds and release checks.
     SM.rules is read from their saved text at load and again on every save; the pages read it. */
  const RULE_KEYS = { bug_fix_days_blocker: 'n', bug_fix_days_critical: 'n', bug_fix_days_major: 'n', bug_fix_days_minor: 'n', sprint_kept_pct: 'n', stale_source_factor: 'n',
    pr_wait_hours: 'n', wip_limit: 'n', unplanned_work_pct: 'n', budget_low_pct: 'n', regression_min_pct: 'n', regression_to_investigate_max: 'n', main_green_repos: 't',
    rc_on_int: 't', smoke_on_int: 't', open_blockers_max: 'n', release_notes_edited_within_days: 'n', slo_breached_max: 'n' };
  function parseRules(text) {
    const out = {}, errs = [];
    text.split('\n').forEach(l => {
      const m = l.match(/^-\s+([A-Za-z0-9_]+):\s*([^#]*?)\s*(#.*)?$/); if (!m) return;
      const k = m[1], v = m[2];
      if (!(k in RULE_KEYS)) errs.push('Unknown key ' + k);
      else if (RULE_KEYS[k] === 'n') { if (/^-?\d+(\.\d+)?$/.test(v)) out[k] = +v; else errs.push('Not a number for ' + k + ': "' + v + '"'); }
      else if (!v) errs.push('No value for ' + k); else out[k] = v;
    });
    return { out: out, errs: errs };
  }
  const RULE_FILES = ['rules/thresholds.md', 'rules/release-checks.md'];
  SM.rules = {};
  SM.rule = (k, fb) => Object.prototype.hasOwnProperty.call(SM.rules, k) ? SM.rules[k] : fb;
  /* today's readings the checks compare with (D.readiness and the fact test.pass_rate) */
  const NOW = { passPct: 94.4, toInvestigate: 5, blocked: 2, breached: 1, notesAgeDays: 2 };
  const R0 = D.readiness.map(c => Object.assign({}, c));
  function applyRules() {
    const ck = id => D.readiness.find(c => c.id === id), o = id => R0.find(c => c.id === id);
    const min = SM.rule('regression_min_pct', 96), mx = SM.rule('regression_to_investigate_max', 0), a = NOW.passPct >= min, b = NOW.toInvestigate <= mx;
    Object.assign(ck('regress'), { state: a && b ? 'ok' : 'watch', text: `Nightly regression above ${min} % and ${mx ? 'at most ' + mx : 'nothing'} left to investigate`,
      sub: b ? `${NOW.toInvestigate} failures to investigate, ${mx} allowed` : o('regress').sub });
    const bl = SM.rule('open_blockers_max', 0);
    Object.assign(ck('blockers'), { state: NOW.blocked <= bl ? 'ok' : o('blockers').state, text: bl ? `At most ${bl} blocked items and no critical bug against the release` : o('blockers').text });
    const sl = SM.rule('slo_breached_max', 0);
    Object.assign(ck('slo'), { state: NOW.breached <= sl ? 'ok' : o('slo').state, text: sl ? `At most ${sl} service level${sl > 1 ? 's' : ''} breached in the last 30 days` : o('slo').text });
    const nd = SM.rule('release_notes_edited_within_days', 7);
    Object.assign(ck('notes'), { state: NOW.notesAgeDays <= nd ? 'ok' : 'watch', text: nd === 7 ? o('notes').text : `Release notes page exists and was edited in the last ${nd} days` });
    D.flow.wipLimit = SM.rule('wip_limit', 6);
  }
  function loadRules() {
    const r = {}; RULE_FILES.forEach(p => Object.assign(r, parseRules(FS.saved[p]).out)); SM.rules = r; applyRules();
  }

  /* a small line diff: longest common subsequence over lines */
  function lineDiff(a, b) {
    const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length;
    const L = []; for (let i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push([' ', A[i], i + 1, j + 1]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push(['-', A[i], i + 1, null]); i++; }
      else { out.push(['+', B[j], null, j + 1]); j++; }
    }
    while (i < n) { out.push(['-', A[i], i + 1, null]); i++; }
    while (j < m) { out.push(['+', B[j], null, j + 1]); j++; }
    return out;
  }
  const diffCount = d => [d.filter(x => x[0] === '+').length, d.filter(x => x[0] === '-').length];
  function diffHtml(d, ctx) {
    ctx = ctx == null ? 2 : ctx;
    if (!d.some(x => x[0] !== ' ')) return '<div class="sx-dnone">No changes against the saved text.</div>';
    const keep = d.map((x, k) => x[0] !== ' ' || d.slice(Math.max(0, k - ctx), k + ctx + 1).some(y => y[0] !== ' '));
    let html = '', skip = 0;
    const flush = () => { if (skip) { html += `<div class="sx-dl skip"><span class="n"></span><span class="n"></span><span class="g"></span><span class="t">${skip} unchanged line${skip > 1 ? 's' : ''}</span></div>`; skip = 0; } };
    d.forEach((x, k) => {
      if (!keep[k]) { skip++; return; }
      flush();
      const cls = x[0] === '+' ? 'add' : x[0] === '-' ? 'del' : 'ctx';
      html += `<div class="sx-dl ${cls}"><span class="n">${x[2] || ''}</span><span class="n">${x[3] || ''}</span><span class="g">${x[0] === '+' ? '+' : x[0] === '-' ? '−' : ''}</span><span class="t">${esc(x[1]) || '&nbsp;'}</span></div>`;
    });
    flush();
    return `<div class="sx-diff" role="table" aria-label="Changes">${html}</div>`;
  }
  /* the permissions of an agent file: the tool lines of its YAML header */
  function toolLines(text) {
    const m = text.match(/^---\n([\s\S]*?)\n---/); if (!m) return null;
    const t = m[1].split('\n'), k = t.indexOf('tools:'); if (k < 0) return [];
    const out = []; for (let i = k + 1; i < t.length && /^\s+\S/.test(t[i]); i++) out.push(t[i].trim());
    return out;
  }
  function checkFile(f, text) {
    if (f.rules) {
      const pr = parseRules(text), n = Object.keys(pr.out).length;
      if (pr.errs.length) return pr.errs.map(e => ['bad', '✕ ' + e + '. The app does not save this.']);
      return [['ok', '✓ Checked: it can be saved.'], ['ok', n + ' values, every key known, every number a number.']];
    }
    if (!f.agent) return [['ok', '✓ Checked: it can be saved.']];
    const now = toolLines(text), was = toolLines(f.saved0);
    if (now == null) return [['bad', '✕ The YAML header is gone. The app does not save an agent file without it.']];
    const on = NOWRITE.filter(w => !now.some(l => l === w + ': false'));
    if (on.length) return [['bad', '✕ A write tool is not off: ' + on.join(', ') + '. The app does not save this.']];
    return [['ok', '✓ Checked: it can be saved.'], ['ok', now.join('|') === was.join('|') ? 'Permissions unchanged: every write tool stays off.' : 'Permissions changed, and every write tool stays off.']];
  }

  const FS = { open: FILES[0].p, view: 'text', text: {}, saved: {}, how: {}, ask: {}, answer: {}, wait: null, seq: 0, hist: [] };
  FILES.forEach(f => { f.saved0 = f.text; FS.text[f.p] = f.text; FS.saved[f.p] = f.text; });
  /* six earlier changes, newest first: each keeps the part that changed */
  [
    ['17.11 14:20', 'modules/quality/definitions.md', 'agent', '## Open bug\nVersion 1 of 16.10.2026.\nAn issue of type Bug in the board filter that is not resolved.', '## Open bug\nVersion 2 of 17.11.2026.\nAn issue of type Bug in the board filter that is not resolved,\nwhatever its age or priority.'],
    ['16.11 09:05', 'agents/ask.md', 'editor', '- If no tool answers the question, say what is missing. Do not guess.\n- Keep the answer under 150 words unless the user asks for more.', '- If no tool answers the question, say what is missing. Do not guess.\n- Keep the answer under 120 words unless the user asks for more.'],
    ['14.11 16:40', 'modules/delivery/definitions.md', 'agent', '## Committed\nVersion 2 of 02.10.2026.\nStory points of the items in the sprint at the moment Start was pressed.\nSame rule as Jira\'s sprint report.', '## Committed\nVersion 3 of 14.11.2026.\nStory points of the items in the sprint at the moment Start was pressed,\nwith the points they had at that moment. Sub-tasks are left out.\nSame rule as Jira\'s sprint report.'],
    ['13.11 11:15', 'team/working-agreements.md', 'outside', '## WA-5 Work mix\nAt most 25 % of the done work is bugs and support.', '## WA-5 Work mix\nAt most 20 % of the done work is bugs and support.'],
    ['12.11 10:02', 'agents/sm-search.md', 'agent', '## Refuse\n- A query about a person: assignee, reporter, creator, author, reviewer,\n  watcher, or a name in any field. Answer: "A query about a person is refused."', '## Refuse\n- A query about a person: assignee, reporter, creator, author, reviewer,\n  watcher, or a name in any field. Answer: "A query about a person is refused."\n- A query on projects with customer data (KESBUG, KES EXT).'],
    ['10.11 15:30', 'rules/team-level.md', 'editor', '- A number that belongs to one person, even without a name:\n  "the developer with the most open items", "reviews by the third reviewer".\n\n## What is allowed', '- A number that belongs to one person, even without a name:\n  "the developer with the most open items", "reviews by the third reviewer".\n- A group so small that it is one person: a role held by one person,\n  a count of 1 split by who did it.\n\n## What is allowed'],
    ['02.11 10:40', 'rules/release-checks.md', 'agent', '## regress\nIs the nightly regression good enough?\n- regression_min_pct: 95  # least share of passed test items, in %', '## regress\nIs the nightly regression good enough?\n- regression_min_pct: 96  # least share of passed test items, in %']
  ].forEach(h => FS.hist.push({ id: ++FS.seq, t: h[0], p: h[1], how: h[2], a: h[3], b: h[4] }));
  loadRules();
  const HOW = { editor: ['editor', ''], agent: ['✦ editing agent', ''], outside: ['outside the app', 'line'] };
  const dirty = p => FS.text[p] !== FS.saved[p];
  const nDirty = () => FILES.filter(f => dirty(f.p)).length;
  const onFiles = () => location.hash.split('?')[0] === '#/system/files';
  const pillOf = f => f.ro ? ['read-only', 'line'] : dirty(f.p) ? ['unsaved changes', 'watch'] : ['saved', 'ok'];

  /* live parts that change on every key stroke, without drawing the page again */
  function updateLive() {
    const f = fileOf(FS.open), pl = document.getElementById('sx-pill');
    if (pl) { const p = pillOf(f); pl.className = 'pill ' + p[1]; pl.textContent = p[0]; }
    FILES.forEach((x, n) => { const mk = document.getElementById('sx-mk-' + n); if (mk) mk.hidden = !dirty(x.p); });
    document.querySelectorAll('.kpis .k').forEach(k => {
      const l = k.querySelector('.k-l .cut'); if (!l || l.textContent !== 'Unsaved') return;
      const v = nDirty(); k.querySelector('.k-v').textContent = v; k.className = 'k t-' + (v ? 'watch' : 'ok');
      const d = k.querySelector('.k-l .dot'); if (d) d.className = 'dot ' + (v ? 'watch' : 'ok');
    });
    document.querySelectorAll('[data-act="fsave"],[data-act="fdiscard"]').forEach(b => { b.disabled = !dirty(FS.open); });
  }
  function hhmm() { const d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  SM.acts.fopen = t => { FS.open = t.getAttribute('data-f'); FS.view = 'text'; SM.render(); };
  SM.acts.fview = t => { FS.view = t.getAttribute('data-v'); SM.render(); };
  SM.acts.ftext = el => { FS.text[FS.open] = el.value; if (FS.how[FS.open] !== 'agent') FS.how[FS.open] = 'editor'; if (!dirty(FS.open)) delete FS.how[FS.open]; updateLive(); };
  SM.acts.fask = el => { FS.ask[FS.open] = el.value; };
  SM.acts.fchip = t => { FS.ask[FS.open] = t.getAttribute('data-q'); const a = document.getElementById('sx-ask'); if (a) { a.value = FS.ask[FS.open]; a.focus(); } };
  SM.acts.fagent = () => {
    const f = fileOf(FS.open); if (f.ro || FS.wait) return;
    const tok = { p: f.p, n: ++FS.seq }; FS.wait = tok; delete FS.answer[f.p]; SM.render();
    setTimeout(() => {
      if (FS.wait !== tok) return;                       // "Don't wait" was clicked, or another request came
      FS.wait = null;
      if (!onFiles() || FS.open !== tok.p) return;      // the page was left: the answer is dropped
      let txt = FS.text[f.p], hit = 0;
      f.prop.blocks.forEach(b => { if (txt.indexOf(b[0]) >= 0) { txt = txt.replace(b[0], b[1]); hit++; } });
      FS.text[f.p] = txt; if (hit) FS.how[f.p] = 'agent';
      FS.answer[f.p] = { sum: f.prop.sum, hit: hit, of: f.prop.blocks.length, req: (FS.ask[f.p] || '').trim() };
      FS.view = 'changes'; SM.render();
    }, 1000);
  };
  SM.acts.fnowait = () => { FS.wait = null; SM.render(); SM.toast('The request is dropped. The editor is unchanged.'); };
  SM.acts.fsave = () => {
    const f = fileOf(FS.open); if (f.ro) return;
    if (!dirty(f.p)) { SM.toast('Nothing to save: the editor holds the saved text.'); return; }
    const bad = checkFile(f, FS.text[f.p]).filter(c => c[0] === 'bad');
    if (bad.length) { FS.view = 'changes'; SM.render(); SM.toast('Not saved: the check failed.'); return; }
    FS.hist.unshift({ id: ++FS.seq, t: K.dm(D.now.date) + ' ' + hhmm(), p: f.p, how: FS.how[f.p] || 'editor', a: FS.saved[f.p], b: FS.text[f.p], session: true });
    FS.saved[f.p] = FS.text[f.p]; delete FS.how[f.p]; delete FS.answer[f.p]; FS.view = 'text';
    if (f.rules) loadRules();
    SM.render(); SM.toast('Saved ' + f.p + '.' + (f.rules ? ' The pages follow the new values.' : '') + ' The old version is kept under var/backups.');
  };
  SM.acts.fgo = t => { FS.open = t.getAttribute('data-f'); FS.view = 'text'; SM.go('#/system/files'); };
  SM.acts.fdiscard = () => { const p = FS.open; FS.text[p] = FS.saved[p]; delete FS.how[p]; delete FS.answer[p]; FS.view = 'text'; SM.render(); SM.toast('Changes discarded: the editor holds the saved text again.'); };
  document.addEventListener('keydown', ev => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    if (ev.target.id === 'sx-ed' && ev.key.toLowerCase() === 's') { ev.preventDefault(); SM.acts.fsave(); }
    else if (ev.target.id === 'sx-ask' && ev.key === 'Enter') { ev.preventDefault(); SM.acts.fagent(); }
  });

  SM.drawer('filechange', id => {
    const h = FS.hist.find(x => String(x.id) === String(id)); if (!h) return null;
    const d = lineDiff(h.a, h.b), c = diffCount(d), how = HOW[h.how];
    return { kind: 'Change of a file', title: h.p, body:
      K.kv([['When', esc(h.t) + (h.session ? ' · this session' : '')], ['How', K.pill(how[0], how[1])], ['Lines', `<span class="c-ok">+${c[0]}</span> / <span class="c-bad">−${c[1]}</span>`], ['Old version', '<span class="mono">var/backups/' + esc(h.p.replace(/\//g, '_')) + '.' + esc(h.t.replace(/[ .:]/g, '')) + '</span>']]) +
      K.sect('The change') + diffHtml(d, 3) +
      `<div class="rowf mt-14" ><button class="btn sm" data-toast="In the real tool this shows a preview first, then puts the earlier version back. Every save keeps the old file under var/backups.">Revert</button></div>` };
  });

  function filesPage() {
    const f = fileOf(FS.open), p = pillOf(f), d = lineDiff(FS.saved[f.p], FS.text[f.p]), c = diffCount(d);
    const groups = Array.from(new Set(FILES.map(x => x.g)));
    const list = groups.map(g => `<div class="sx-fg">${esc(g)}</div>` + FILES.map((x, n) => x.g !== g ? '' :
      `<button class="sx-fr${x.p === f.p ? ' on' : ''}" data-act="fopen" data-f="${esc(x.p)}"><span class="sx-fn"><span class="mono">${esc(x.p.split('/').slice(FILES.filter(y => y.p.split('/').pop() === x.p.split('/').pop()).length > 1 ? -2 : -1).join('/'))}</span><i class="sx-mk" id="sx-mk-${n}" data-tip="Unsaved changes"${dirty(x.p) ? '' : ' hidden'}></i>${x.ro ? '<span class="pill line">read-only</span>' : ''}</span><span class="sx-fw">${esc(x.what)}</span>${x.rules ? '<span class="sx-live">Live: the pages follow this file after Save.</span>' : ''}<span class="sx-fp mono">${esc(x.p)}</span></button>`).join('')).join('');
    const seg = `<div class="seg">${[['text', 'Text'], ['changes', 'Changes' + (c[0] + c[1] ? ' · +' + c[0] + ' −' + c[1] : '')]].map(o => `<button class="${FS.view === o[0] ? 'on' : ''}" data-act="fview" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    const head = `<div class="sx-eh"><span class="mono ink sx-ep">${esc(f.p)}</span><span id="sx-pill" class="pill ${p[1]}">${p[0]}</span><span class="grow"></span>${seg}
      <button class="btn sm" data-toast="In the real tool this reads the file from disk again. Unsaved changes are kept until you discard them.">Reload</button>
      <button class="btn sm" data-toast="In the real tool this opens the folder of the file in Windows Explorer. This demo opens nothing outside.">Open in Windows</button></div>`;
    const lines = FS.text[f.p].split('\n').length;
    const checks = checkFile(f, FS.text[f.p]), bad = checks.some(x => x[0] === 'bad');
    const ans = FS.answer[f.p];
    const live = f.rules ? K.note('<b>Live: the pages follow this file after Save.</b> ' + (f.p === 'rules/thresholds.md' ? 'Settings and the WIP limit of Delivery read these values.' : 'Readiness, the release pages and the Application Manager home count their checks from it.') + ' Reloading the page restores the defaults.', '') + '<div style="height:8px"></div>' : '';
    const view = live + (FS.view === 'text'
      ? `<textarea id="sx-ed" class="sx-ed" spellcheck="false" data-input="ftext" rows="${Math.min(44, lines + 1)}"${f.ro ? ' readonly' : ''} aria-label="Text of ${esc(f.p)}">${esc(FS.text[f.p])}</textarea>`
      : diffHtml(d) + (c[0] + c[1] ? `<div class="sx-chk">${checks.map(x => `<span class="c-${x[0]}">${esc(x[1])}</span>`).join('')}</div>` +
        K.note(ans && FS.how[f.p] === 'agent' ? 'The proposal is in the editor, not saved. Check the changes, then save or discard.' : 'The changes are in the editor, not saved. Check them, then save or discard.', bad ? 'bad' : 'watch') : ''));
    const foot = f.ro ? `<div class="sx-ef faint">This file is replaced by the app on every update. It can be read here, not changed.</div>`
      : `<div class="sx-ef"><button class="btn pri" data-act="fsave"${dirty(f.p) && !bad ? '' : ' disabled'}>Save</button><button class="btn" data-act="fdiscard"${dirty(f.p) ? '' : ' disabled'}>Discard changes</button><span class="faint">Ctrl+S saves while the editor has the focus. Every save keeps the old file under var/backups.</span></div>`;
    const agent = f.ro ? `<div class="sx-ag is-off"><div class="sx-agh">✦ Editing agent · sm-editor</div><div class="faint">A read-only file: the agent proposes nothing for it.</div></div>`
      : `<div class="sx-ag"><div class="sx-agh">✦ Editing agent · sm-editor<span class="faint">proposes search-and-replace blocks; it cannot save</span></div>
        <textarea id="sx-ask" class="inp sx-ask" rows="2" data-input="fask" placeholder="What should change? For example: add a rule that a line about a person is refused, not reworded">${esc(FS.ask[f.p] || '')}</textarea>
        <div class="sx-agr">${FS.wait ? `<span class="sx-wait"><i class="sx-spin"></i>Waiting for the answer · 1 s</span><button class="btn sm" data-act="fnowait">Don't wait</button>` : `<button class="btn pri" data-act="fagent">Ask the agent</button><span class="faint">Ctrl+Enter</span>`}
          <span class="grow"></span><span class="chips">${f.asks.map(q => `<button class="chip" data-act="fchip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</span></div>
        ${ans ? `<div class="sx-ans">${K.dot(ans.hit === ans.of ? 'ok' : 'watch')}<span><b>${esc(ans.sum)}</b> ${ans.hit} of ${ans.of} block${ans.of > 1 ? 's' : ''} applied to the editor${ans.hit < ans.of ? '; the rest did not match the text and was left out' : ''}.<span class="sub">${ans.req ? 'Asked: "' + esc(ans.req) + '". ' : ''}This demo holds one prepared proposal per file; the app sends your request and the file to the agent.</span></span></div>` : ''}</div>`;
    const weekAgo = K.day(D.now.date) - 7, dayOf = t => K.day('2026-' + t.slice(3, 5) + '-' + t.slice(0, 2));
    const hist = K.table([
      { h: 'When', cls: 's', v: h => esc(h.t) + (h.session ? ' <span class="mark-new">this session</span>' : '') },
      { h: 'File', v: h => `<span class="mono">${esc(h.p)}</span>` },
      { h: 'How', cls: 's', v: h => K.pill(HOW[h.how][0], HOW[h.how][1]) },
      { h: 'Lines', n: true, v: h => { const c2 = diffCount(lineDiff(h.a, h.b)); return `<span class="c-ok">+${c2[0]}</span> <span class="c-bad">−${c2[1]}</span>`; } },
      { h: '', cls: 's', v: h => `<button class="btn sm" data-dr="filechange:${h.id}">Changes</button> <button class="btn sm" data-toast="In the real tool this shows a preview first, then puts the earlier version back. Every save keeps the old file under var/backups.">Revert</button>` }
    ], FS.hist);
    return {
      lede: 'The local files that steer the app: what the agents are told, the rules, the definitions, the team\'s own texts. They live in the app\'s folder on this computer, so editing them here writes nothing to Jira or any other source.',
      kpis: [
        { l: 'Files', v: FILES.length, s: groups.length + ' groups' },
        { l: 'Agent instruction files', v: FILES.filter(x => x.agent).length, s: 'every write tool off', tone: 'ok' },
        { l: 'Unsaved', v: nDirty(), s: 'in this session', tone: nDirty() ? 'watch' : 'ok' },
        { l: 'Changes in 7 days', v: FS.hist.filter(h => dayOf(h.t) > weekAgo).length, s: 'since ' + K.dm(new Date((weekAgo + 1) * 864e5).toISOString().slice(0, 10)) },
        { l: 'Read-only', v: FILES.filter(x => x.ro).length, s: 'replaced on update' }
      ],
      body: K.grid(
        K.panel({ title: 'Files', sub: 'agents/, rules/, modules/, team/ in the app\'s folder', w: 'c12', body: `<div class="sx-files"><nav class="sx-fl2" aria-label="Files">${list}</nav><div class="sx-edw">${head}${view}${foot}${agent}</div></div>`,
          foot: 'this demo writes nothing to disk: changes live in memory, and reloading the page restores the defaults' }),
        K.panel({ title: 'History of the files', sub: 'newest first', w: 'c12', flush: true, body: hist, foot: 'every save keeps the old file under var/backups' })
      )
    };
  }

  /* ── Settings ─────────────────────────────────────────────────────────── */
  function settingsPage() {
    const on = SM.store.get('titles', '1') === '1';
    const sw = (label, sub, state, act) => `<div class="ck ${state ? 'ok' : ''}"><span class="m">${state ? '✓' : '·'}</span><span class="tx"><b>${label}</b><span class="sub">${sub}</span></span><span class="v">${act ? `<button class="btn sm" data-act="${act}">${state ? 'Switch off' : 'Switch on'}</button>` : `<span class="faint fw-400" >${state ? 'on' : 'off'}</span>`}</span></div>`;
    return {
      lede: 'One file of settings per computer. This demo changes nothing on disk; the switch for titles works so that you can see both ways.',
      body: K.grid(
        K.panel({ title: 'Team and scope', sub: 'sm-assistant.ini', w: 'c6 x4', body: K.kv([['Team', esc(D.team.name)], ['Train', esc(D.team.train)], ['Jira board', esc(D.team.board)], ['Project', '<span class="mono">' + esc(D.team.project) + '</span>'], ['PI', esc(D.cal.pi.id) + ', ' + K.dm(D.cal.pi.from) + ' to ' + K.dm(D.cal.pi.to)], ['Sprint length', '15 working days, IP sprint 10'], ['"Done" means', 'the last column of the board, as in Jira\'s sprint report'], ['Role at the start', 'the one you used last, kept in this browser']]) }),
        K.panel({ title: 'What is shown', w: 'c6 x4', body:
          sw('Issue titles', 'Read from Jira while you look, held in memory for ten minutes, kept nowhere, never given to the agent. Off: keys only.', on, 'titles') +
          sw('Titles of projects with customer data', 'Always off: counts and keys only.', false) +
          sw('Agent', 'agent runtime with the models of your subscription. Off: pages are laid out by rules.', true) +
          sw('team chat channels', 'Waits for the data protection assessment.', false) }),
        K.panel({ title: 'Thresholds', sub: 'read from rules/thresholds.md and rules/release-checks.md', w: 'c6 x4',
          right: '<button class="btn sm" data-act="fgo" data-f="rules/thresholds.md">Edit in Files</button>',
          body: (function () {
            const r = SM.rule, inv = r('regression_to_investigate_max', 0), f = r('stale_source_factor', 2);
            return K.kv([['Days to fix a bug', `Blocker ${esc(r('bug_fix_days_blocker', 2))} · Critical ${esc(r('bug_fix_days_critical', 5))} · Major ${esc(r('bug_fix_days_major', 15))} · Minor ${esc(r('bug_fix_days_minor', 30))}`],
              ['A sprint kept its promise at', esc(r('sprint_kept_pct', 80)) + ' % of the commitment done'], ['Stale source', 'older than ' + (f === 2 ? 'twice' : esc(f) + ' times') + ' its read interval'],
              ['Release check: regression', esc(r('regression_min_pct', 96)) + ' % passed and ' + (inv ? 'at most ' + esc(inv) : 'nothing') + ' to investigate'], ['Pull request waits too long', esc(r('pr_wait_hours', 24)) + ' hours without weekends'],
              ['WIP limit', esc(r('wip_limit', 6)) + ' items in Implementing (working agreement WA-4)'], ['Work mix', 'at most ' + esc(r('unplanned_work_pct', 20)) + ' % bugs and support (WA-5)'], ['Error budget is low below', esc(r('budget_low_pct', 35)) + ' %']]);
          })(), foot: 'the files are the single source; this panel only shows them' }),
        K.panel({ title: 'Kept on this computer', sub: 'under var/, never committed', w: 'c6 x4', flush: true, body: K.table([{ h: 'File', cls: 's', v: r => `<span class="mono">${r[0]}</span>` }, { h: 'What it holds', v: r => `<span class="dim">${r[1]}</span>` }, { h: 'Size', n: true, v: r => r[2] }], [
          ['var/facts/', 'the last three reads of each source, sanitized', '41 MB'], ['var/forecasts.jsonl', 'the forecast shown on each working day', '212 KB'], ['var/risks.json', 'your risk register', '9 KB'], ['var/decisions.json', 'what you marked as decided', '3 KB'], ['var/outbox.jsonl', 'texts you marked as sent', '38 KB'], ['var/agent-runs.jsonl', 'every run of an agent with its reply', '1.4 MB']]) }),
        K.panel({ title: 'Palette', w: 'c12 x4', body: (function () {
          const pals = SM.palettes || [];
          if (!pals.length) return '<div class="faint">One palette only in this version.</div>';
          const grp = (t, list) => list.length ? `<div class="sx-palg"><span class="faint">${t}</span><div class="rowf">${list.map(p => `<button class="btn sm${p.id === SM.palette ? ' pri' : ''}" data-act="palette" data-id="${esc(p.id)}"${p.note ? ` data-tip="${esc(p.note)}"` : ''}>${esc(p.name)}</button>`).join('')}</div></div>` : '';
          return grp('Dark', pals.filter(p => p.dark)) + grp('Light', pals.filter(p => !p.dark)) + '<div class="faint fs-11 mt-8" >Saved in this browser.</div>';
        })() }),
        K.panel({ title: 'Rules the app keeps', w: 'c12 x8', body: K.list([
          { tone: 'ok', html: '<b>Read-only.</b> Nothing here writes to Jira, Wiki, Git hosting, Build server, Log search, Monitoring, Test reports or the team chat.' },
          { tone: 'ok', html: '<b>Code computes every number.</b> An agent may choose among facts and word them.' },
          { tone: 'ok', html: '<b>Team level only.</b> No person is named, counted, ranked or compared.' },
          { tone: 'ok', html: '<b>Customer data stays in Jira.</b> No titles, descriptions or comments of those projects leave it.' },
          { tone: 'ok', html: '<b>Every number has evidence.</b> Definition, version, query, rows, time.' },
          { tone: 'ok', html: '<b>Local only.</b> The server answers on this computer; the page loads nothing from outside.' }]) })
      )
    };
  }

  /* ── Panel states ─────────────────────────────────────────────────────── */
  function withSrc(id, state, fn) { const old = SM.src[id]; SM.src[id] = state; const html = fn(); if (old === undefined) delete SM.src[id]; else SM.src[id] = old; return html; }
  function statesPage() {
    const tbl = () => K.table([{ h: 'Issue', cls: 'ttl', v: i => K.key(i.key, { title: true }) }, { h: 'Status', cls: 's', v: i => K.status(i.st) }, { h: 'Days', n: true, v: i => i.dis }], D.issues.filter(i => i.st === 'blocked' || i.dis > 8));
    const chart = () => K.chart({ label: 'sample', w: 420, h: 150, x: [0, 8], y: [0, 30], yt: [0, 15, 30], xt: [[0, '09.11'], [8, 'today']], lines: [{ pts: D.sprint.burn.map((v, i) => [i, v]), color: 's1', w: 2.5, end: true }] });
    const list = () => K.list(D.slos.slice(0, 3).map(s => ({ tone: s.state, html: esc(s.name), v: s.left + ' %' })));
    const kinds = [['A table', 'jira', tbl, 'the blocked and slow items of the sprint'], ['A chart', 'jira', chart, 'the burn-up of the sprint'], ['A list', 'mon', list, 'the service levels with their budget']];
    const row = (kind) => [
      K.panel({ title: kind[0] + ': answers', w: 'c4 x2', src: [kind[1]], body: kind[2]() }),
      withSrc(kind[1], 'stale', () => K.panel({ title: kind[0] + ': stale', w: 'c4 x2', src: [kind[1]], body: kind[2]() })),
      withSrc(kind[1], 'down', () => K.panel({ title: kind[0] + ': no answer', w: 'c4 x2', src: [kind[1]], body: kind[2]() })),
      withSrc(kind[1], 'off', () => K.panel({ title: kind[0] + ': not connected', w: 'c4 x2', src: [kind[1]], body: kind[2](), would: kind[3] })),
      K.panel({ title: kind[0] + ': empty', w: 'c4 x2', src: [kind[1]], state: 'empty', empty: { title: 'Nothing in this window', text: 'No row matches the chosen sprint. That is an answer too.' } }),
      K.panel({ title: kind[0] + ': first read', w: 'c4 x2', src: [kind[1]], state: 'loading' })
    ].join('');
    return {
      lede: 'What a panel says when its source is late, gone, empty or off. The same six states for every kind of panel; a page never has to invent its own.',
      acts: `<button class="btn${SM.isWorst ? ' pri' : ''}" data-act="worst" data-tip="Feeds the Sprint page the hardest data Jira can hold: a 255-character title, an empty column, 1,284 story points, an item with nothing filled in">${SM.isWorst ? 'Worst-case data is on: switch it off' : 'Try worst-case data on the Sprint page'}</button>`,
      body: K.grid(
        row(kinds[0]), row(kinds[1]), row(kinds[2]),
        withSrc('logs', 'down', () => K.panel({ title: 'A panel with two sources, one gone', sub: 'the rest stays', w: 'c4 x4', src: ['jira', 'logs'], body: tbl() })),
        K.panel({ title: 'Withheld by a rule', w: 'c4 x4', src: ['jira'], state: 'held', empty: { title: '3 bugs reported by customers are open', text: 'Their titles hold customer data and stay in Jira. The app shows the count and the keys.' } }),
        K.panel({ title: 'Demo data', w: 'c4 x4', src: ['git'], state: 'demo', body: list() }),
        K.panel({ title: 'The KPI strip follows its page', sub: 'a cell whose source is gone shows a dash and the reason on hover', w: 'c12', body: K.kpis([{ l: 'Done', v: 25, u: 'SP', s: 'Jira · 2 min', tone: 'ok' }, { l: 'Group bookings', v: 184, u: 'a day', s: '<b>Log search · stale since 06:10</b>', tone: 'watch' }, { l: 'Requests in the team chat', v: '–', s: 'Team chat · not connected' }, { l: 'Error rate', v: '–', s: '<b>Monitoring · no answer</b>', tone: 'bad' }]) })
      )
    };
  }

  SM.domain({
    id: 'system', title: 'System', icon: 'system',
    pages: [
      { id: 'sources', title: 'Sources', hz: ['today'], was: 'moved', from: 'System (Sources)', find: 'freshness connections simulate outage', render: sourcesPage },
      { id: 'modules', title: 'Architecture', hz: ['today'], was: 'kept', from: 'System (Architecture)', find: 'architecture modules diagram plug-in manifest', render: modulesPage },
      { id: 'facts', title: 'Facts', hz: ['today'], was: 'moved', from: 'Today (All facts)', find: 'evidence fact ids', render: factsPage },
      { id: 'agent', title: 'Agent', hz: ['today'], was: 'moved', from: 'System (Agent runs)', find: 'ai agents runs check', render: agentPage },
      { id: 'files', title: 'Files', hz: ['today'], was: 'new', from: '', find: 'markdown instructions agent prompts definitions edit with ai history', render: filesPage },
      { id: 'settings', title: 'Settings', hz: ['today'], was: 'moved', from: 'System (Team and sprint, Kept on this computer, Rules)', find: 'titles thresholds storage rules', render: settingsPage },
      { id: 'states', title: 'Panel states', hz: ['today'], was: 'new', from: '', find: 'empty stale error loading', render: statesPage }
    ]
  });
})();
