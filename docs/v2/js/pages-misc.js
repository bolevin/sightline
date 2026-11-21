/* Screens outside the domains: Inbox, Search, the map of all screens, the team, and the page of one issue. */
(function () {
  'use strict';
  const D = window.D, K = window.K, SM = window.SM, esc = K.esc, S = D.sprint, f = S.forecast;

  /* ── Inbox ────────────────────────────────────────────────────────────── */
  const drafts = [
    { id: 'status', title: 'Sprint status', forWhom: 'the team\'s Sprint Status page in the wiki', lens: 'Scrum Master', facts: 19, text:
`Sprint status · Sprint 42 · day 8 of 15

Promise
- Committed at the start: 63 SP. Done: 25 SP. Not done yet: 40 SP in 17 items.
- Forecast from the team's own history: 85 % sure of at least 47 SP by the end; chance to finish everything: 9 %.
- For an even chance to finish the rest, 11 SP have to move out.

Scope
- Came in after the start: 4 items (5 SP): KES-4188, KES-4190, KES-4193, KES-4197.
- Taken out: 1 item (3 SP): KES-4155.

Blocked and stuck
- Blocked: 2 items (5 SP): KES-4131 for 9 days, KES-4079 for 13 days.
- KES-4160 in Implementing: 24 days, in its third sprint.

Risks
- Off track: R-1 (Price feed v3), R-2 (sprint does not fit).` },
    { id: 'po', title: 'The sprint does not fit: ask for a decision', forWhom: 'the product owner (team chat or mail)', lens: 'Scrum Master', facts: 12, text:
`Subject: Sprint 42 does not fit, a decision is needed by Thu 19.11

On day 8 of 15 the sprint has 40 SP open and 25 SP done. Going by what the team finished per day in its last sprints, the chance to finish everything is 9 %.
For an even chance, 11 SP have to move out; to be 85 % sure of the rest, 18 SP.

What moving would do:
- Move out what has not started (7 SP: KES-4115, KES-4136, KES-4193): the chance for the rest becomes 31 %.
- Move out what is blocked (5 SP: KES-4131, KES-4079): the chance for the rest becomes 24 %.
- Move out both (12 SP): the chance for the rest becomes 55 %.

Which of these matter most to you, and what can wait for 43?` },
    { id: 'daily', title: 'Points for the Daily', forWhom: 'the team, in the Daily', lens: 'Scrum Master', facts: 6, text:
`Daily · Sprint 42 · day 8 of 15

- Blocked (2): KES-4131, KES-4079. Who can unblock each one, and by when?
- KES-4160 in Implementing for 24 days. What is in the way of the dry run on 20.11?
- Three pull requests wait a working day or more: #412, #118, #57.
- Seven items in progress against a limit of six. Which one do we finish first?` },
    { id: 'relnote', title: 'Release 2026.12: where it stands', forWhom: 'the release manager and the train (mail)', lens: 'Application Manager', facts: 11, isNew: true, text:
`Release 2026.12 · planned Thu 03.12 · code freeze Fri 27.11

Scope: 19 of 31 issues done. Four features: KES-3301, KES-3318, KES-3325, KES-3347.
Checks: 2 of 8 pass, 3 need a look, 3 fail.
- Fails: 12 issues open, 2 items blocked (KES-4131, KES-4079), main of pricing-engine red since 17.11 16:40.
- Needs a look: nightly regression 94.4 % with 5 failures to investigate; pricing-engine on INT is still 2026.11.0; export service level missed (27 of 30 nights).
- Passes: smoke test on INT 46 of 46; release notes page edited 16.11.

Open decision D-2 (due Tue 24.11): release without the school price tiers, or move the release to 08.12.` },
    { id: 'stake', title: 'Objectives of the PI: update for stakeholders', forWhom: 'business owners (mail or the PI page in the wiki)', lens: 'Product Owner', facts: 14, isNew: true, text:
`PI 26.4 · week 8 of 11 · objectives of Team Kestrel

On track (21 of 37 planned BV): objectives 1, 2 and 5.
At risk: objective 4, the export. 5 of 13 SP done, the rest is planned for this sprint and 12.4.
Off track: objective 3, the new price tiers for 13.12. 16 of 24 SP are open, 5 of them blocked by the price feed v3 of another team, which has no date. The code freeze for release 2026.12 is on 27.11.
Will not be reached in this PI: objective 6 (uncommitted), 13 of 18 SP left.` },
    { id: 'review', title: 'Sprint Review: what sprint 41 delivered', forWhom: 'the Sprint Review', lens: 'Scrum Master', facts: 10, text:
`Sprint Review · Sprint 41

What we promised and what we delivered
- Committed at the start: 58 SP. Completed: 49 SP in 20 of 26 items.
- Came in after the start: 9 SP. Taken out: 5 SP.

How it went
- Bugs and incidents took 11 SP, support 4 SP.
- Half of the completed items took at most 4.6 days from their start to done.` },
    { id: 'retro', title: 'Questions for the retrospective', forWhom: 'the team, in the retrospective', lens: 'Scrum Master', facts: 9, text:
`Retrospective · Sprint 41 · what the data suggests asking

- We completed 49 SP against 58 SP committed, and 9 SP came in later. Was the commitment the real plan?
- The wait for a first review was 14 hours in week 46 against 6 hours usually. What was different that week?
- The limit of six items in progress held on 3 of 8 days of this sprint. Is the limit right, or the habit?
- Two actions are older than 30 days (A-11, A-9). Do we still want them?` }
  ];
  function inboxPage() {
    const waiting = D.decisions.filter(d => d.state === 'waiting');
    const notices = K.feed(D.notices.map((n, i) => ({ t: n.at, tone: n.level, html: `<a href="${n.to}" class="dim">${esc(n.text)}</a>${i < (SM.freshRows || 0) ? ' <span class="nt-new">new</span>' : ''}` })));
    const dr = drafts.map(d => K.panel({ title: d.title, sub: 'for ' + esc(d.forWhom), w: 'c6 x4', isNew: d.isNew, right: `<span class="pill line">${esc(d.lens)}</span><span class="pill">${d.facts} facts behind it</span>`,
      body: `<textarea class="draft" spellcheck="false">${esc(d.text)}</textarea><div class="rowf mt-8" ><button class="btn sm pri" data-toast="Copied. The app sends nothing: you paste it where you want it.">Copy</button><button class="btn sm" data-toast="In the real tool this keeps your copy under Sent on this computer.">I sent it</button><span class="faint fs-11" >composed by code from facts · change it as you like</span></div>` })).join('');
    const sent = K.table([{ h: 'When', cls: 's', v: r => r[0] }, { h: 'What', v: r => `<b class="ink">${r[1]}</b>` }, { h: 'Where you sent it', v: r => `<span class="dim">${r[2]}</span>` }, { h: 'Facts then', n: true, v: r => r[3] }], [
      ['Mon 16.11 09:20', 'Sprint status', 'Wiki, Sprint Status page', 19], ['Fri 06.11 15:40', 'Sprint Review: what sprint 40 delivered', 'Sprint Review', 10]]);
    return {
      lede: 'What arrived, what waits for a decision, and texts ready to send. The app writes to no other system: a draft is composed from facts, you copy it and send it yourself.',
      kpis: [{ l: 'Notices', v: D.notices.length, s: 'since yesterday 17:00' }, { l: 'Waiting for a decision', v: waiting.length, s: '<b>D-1 due tomorrow</b>', tone: 'bad', to: '#/knowledge/decisions' }, { l: 'Drafts', v: drafts.length, s: '2 new kinds for other roles' }, { l: 'Sent', v: 2, s: 'your own record' }, { l: 'Written to another system', v: 0, s: 'by the app, ever', tone: 'ok' }],
      body: K.tabs('inbox', [
        { id: 'notices', label: 'Notices', cnt: D.notices.length, html: K.grid(K.panel({ title: 'What arrived', sub: 'newest first · new since your last look', w: 'c8', src: ['jira', 'mon', 'ci', 'increp'], right: `<button class="btn sm" data-act="noticesagain" data-tip="For this demo: the notices of today count as new again">Show as new</button>`, body: notices, help: 'Changes of facts that somebody in the team would want to hear about. A notice links to the page where the fact lives.' }),
          K.panel({ title: 'What makes a notice', w: 'c4', body: K.list([{ tone: 'bad', html: 'A state turned off track: a pipeline red, an incident open, a decision due.' }, { tone: 'watch', html: 'Something came in: an item after the sprint start, a new error group, a request to the team.' }, { tone: 'ok', html: 'Something the team waited for is done.' }, { tone: '', html: 'Nothing else. No notice says that all is well.' }]) })) },
        { id: 'decide', label: 'Waiting for a decision', cnt: waiting.length, html: K.grid(waiting.map(d => `<div class="c4">${K.dec(d)}</div>`).join('')) },
        { id: 'drafts', label: 'Drafts', cnt: drafts.length, html: K.grid(dr) },
        { id: 'sent', label: 'Sent', cnt: 2, html: K.grid(K.panel({ title: 'Sent', sub: 'your own record, kept on this computer only', w: 'c12', flush: true, body: sent })) }
      ])
    };
  }

  /* ── Search ───────────────────────────────────────────────────────────── */
  function searchPage() {
    const mode = SM.ui.smode || 'ask';
    const jira = ['KES-4131', 'KES-4139', 'KES-4136', 'KES-3318', 'KES-4132'];
    const res = K.table([{ h: 'Found in', cls: 's', v: r => K.pill(r[0]) }, { h: 'What', cls: 'ttl', v: r => r[1] }, { h: 'Why it matches', v: r => `<span class="dim">${r[2]}</span>` }, { h: 'Updated', cls: 's', n: true, v: r => r[3] }],
      jira.map((k, n) => ['Jira', K.key(k, { title: true }), ['title', 'title', 'description', 'title', 'comment'][n], ['17.11', '17.11', '10.11', '16.11', '16.11'][n]])
        .concat([['Wiki', '<span class="ent">Operations manual Pricing engine</span>', 'text, 3 hits', '7 months ago'], ['Wiki', '<span class="ent">PI Planning PI 26.4: team objectives and risks</span>', 'text, 2 hits', '7 weeks ago'], ['Wiki', '<span class="ent">Architecture decisions (ADR-001 to ADR-031)</span>', 'text, 1 hit', '5 days ago']]));
    return {
      lede: 'Search the text of Jira and Wiki with your own access. For what the app has already read (screens, applications, keys) the palette is faster: Ctrl K.',
      body: K.grid(
        K.panel({ title: 'Search', w: 'c12', src: ['jira', 'wiki'], right: `<button class="btn sm" data-dr="searchset:all">⚙ Search settings</button>` + K.seg('smode', [['words', 'Words'], ['ask', 'Ask'], ['query', 'JQL / CQL']], mode),
          body: `<div class="rowf"><input class="inp fs-15 pd-9-12"  value="${mode === 'query' ? 'project = KES AND text ~ &quot;Price feed v3&quot; ORDER BY updated DESC' : mode === 'ask' ? 'What do we know about the price feed v3 and who waits for it?' : 'Price feed v3'}"><button class="btn pri" data-toast="This demo shows one prepared search.">Search</button></div>
            <div class="faint fs-11 mt-6" >${mode === 'ask' ? 'The agent turns your question into the two queries below. You see them, can change them and run them. A question about a person is refused.' : mode === 'words' ? 'Code builds the queries from your words and the filters. Every word must be found.' : 'Your own query, run as it is.'}</div>
            <div class="cols2 mt-10" ><div><div class="faint fs-11 mb-4" >Jira, JQL</div><div class="code">filter = 7 AND text ~ "Price feed v3" ORDER BY updated DESC</div></div><div><div class="faint fs-11 mb-4" >Wiki, CQL</div><div class="code">space = KESTREL AND text ~ "Price feed v3" ORDER BY lastmodified DESC</div></div></div>` }),
        K.panel({ title: 'Filters', w: 'c3', body: K.sect('Whose') + K.filter('s1', [['all', 'My team'], ['any', 'Anyone']]) + K.sect('When') + K.filter('s2', [['all', 'Any time'], ['sp', 'This sprint'], ['pi', 'This PI']]) + K.sect('Where') + K.filter('s3', [['all', 'Jira and Wiki'], ['j', 'Jira'], ['c', 'Wiki']]) + K.sect('Type') + K.filter('s4', [['all', 'Any'], ['st', 'Story'], ['bug', 'Bug'], ['page', 'Page']]) }),
        K.panel({ title: 'Results', sub: '5 issues, 3 pages · counts are Jira\'s and Wiki\'s own', w: 'c9', src: ['jira', 'wiki'], flush: true, body: res, foot: 'titles go from the source to this page and are kept nowhere' }),
        K.panel({ title: 'Answer with sources', sub: 'by the agent, from what the two searches found', w: 'c8', isNew: true, body:
          `<div class="msg ai nosh pd-0 nobg" ><p>The price feed v3 is the interface that delivers the new volume tiers for schools and small businesses. Story <b>KES-4131</b> takes them over and is blocked by <b>ATL-882</b> of Team Atlas for 9 days.</p><p>Three more stories of feature <b>KES-3318</b> build on it: KES-4132, KES-4136 and KES-4139. The PI Planning page names the dependency as a risk; the operations manual of the adapter still describes v2.</p>
            <div class="meta"><span>2 searches</span><span>5 issues and 3 pages read on screen</span><span class="c-ok">every sentence points to a result above</span></div></div>`, foot: 'needs your word that titles may go to the model (settings); until then this panel is off in the app' }),
        K.panel({ title: 'Saved searches', sub: 'tell you in the Inbox when something new matches', w: 'c4', isNew: true, body: K.list([{ tone: 'watch', html: 'Mentions of "Team Kestrel" in issues of other teams', v: '6 this week' }, { tone: '', html: 'New bugs in component Carrier export', v: '0' }, { tone: '', html: 'Pages labelled "postmortem" in the team space', v: '1' }]) })
      )
    };
  }

  /* ── Map ──────────────────────────────────────────────────────────────── */
  const mk = w => `<span class="mk-${w}">${w}</span>`;
  const OLD = [
    ['Today', 'Home of the Scrum Master; the fact table to System › Facts', 'moved', '#/home/sm'], ['Promises', 'Delivery › Sprint (commitment, forecast, outside view); Product › Objectives', 'moved', '#/delivery/sprint'],
    ['Risks', 'Knowledge › Risks; the signal lists live where the items live (Sprint, Flow)', 'kept', '#/knowledge/risks'], ['Operations', 'Operations: Applications, Incidents, Requests', 'moved', '#/ops/services'],
    ['Sprint', 'Delivery › Sprint', 'kept', '#/delivery/sprint'], ['Flow', 'Delivery › Flow', 'kept', '#/delivery/flow'], ['Code', 'Engineering › Pull requests, Repositories', 'kept', '#/eng/prs'],
    ['Quality', 'Quality › Bugs', 'kept', '#/quality/bugs'], ['PI', 'Delivery › PI, Product › Objectives', 'moved', '#/delivery/pi'], ['Hygiene', 'Delivery › Hygiene', 'kept', '#/delivery/hygiene'],
    ['Inbox', 'Inbox › Drafts, Sent', 'kept', '#/inbox'], ['Notices', 'Inbox › Notices', 'moved', '#/inbox'], ['Search', 'Search, and the palette (Ctrl K)', 'kept', '#/search'],
    ['System', 'System: Sources, Modules, Facts, Agent, Settings', 'moved', '#/system/sources'], ['Ask AI', 'AI Command: the window with a dispatcher and the agent, conversations, docking (Ctrl K)', 'kept', null],
    ['Palettes', 'Eleven palettes as tokens, the picker in the top bar and in System › Settings', 'kept', '#/system/settings']
  ];
  const DROPPED = [
    ['"Not connected yet" at the bottom of 8 tabs', 'A panel now says itself what it would show and what it needs; the plan is in System › Sources and Modules.'],
    ['"All facts" on Today', 'Moved to System › Facts; every number opens its own evidence.'],
    ['Three lists of the same slow items (Sprint backlog, Longest in one status, Aging)', 'One home each: the backlog on Sprint, the aging view on Flow, the risk in the register.'],
    ['This demo part of the Search tab', 'Became the real layout of Search.'],
    ['The empty PI tab', 'Replaced by Delivery › PI and Product › Objectives.']
  ];
  function mapPage() {
    const L = D.lineage;
    const all = SM.order.filter(p => !p.hidden), ents = Object.keys(SM.entities).map(k => SM.entities[k]);
    const cnt = w => all.filter(p => p.was === w).length + ents.filter(e => e.was === w).length;
    const dom = d => `<tr class="grp"><td colspan="4">${esc(d.title || 'Outside the domains')}</td></tr>` + d.pages.filter(p => !p.hidden).map(p =>
      `<tr><td class="s"><a class="ent" href="${p.path}">${esc(p.title)}</a></td><td class="s"><span class="mono">${esc(p.path)}</span></td><td class="s">${mk(p.was || 'new')}</td><td><span class="dim">${esc(p.from || 'not in the first version')}</span></td></tr>`).join('');
    const groups = SM.domains.concat([SM.routes['#/inbox'].domain]);
    const entRows = ents.map(e => `<tr><td class="s"><a class="ent" href="#/${e.kind}/${encodeURIComponent(e.ids()[0])}">One ${esc(e.kind)}</a></td><td class="s"><span class="mono">#/${e.kind}/${esc(e.ids()[0])}</span> <span class="faint">+ ${e.ids().length - 1} more</span></td><td class="s">${mk(e.was || 'new')}</td><td><span class="dim">${esc(e.from || 'not in the first version')} · reached from every key and name of that kind</span></td></tr>`).join('');
    return {
      lede: 'Every screen of this demo with its address, and what happened to each part of the first version. Kept: same place, same job. Moved: same content, a new home. New: not in the first version. Dropped: gone, with the reason.',
      kpis: [{ l: 'Screens', v: all.length + ents.length, s: all.length + ' pages, ' + ents.length + ' kinds of entity page' }, { l: 'Kept', v: cnt('kept'), s: 'same place, same job' }, { l: 'Moved', v: cnt('moved'), s: 'same content, new home' }, { l: 'New', v: cnt('new'), s: 'not in the first version', tone: 'ok' }, { l: 'Dropped', v: DROPPED.length, s: 'see below' }],
      body: K.grid(
        K.panel({ title: 'The first version, tab by tab', sub: 'where each of the 13 tabs and 3 buttons went', w: 'c12 x6', flush: true, body: K.table([{ h: 'Today', cls: 's', v: r => `<b class="ink">${r[0]}</b>` }, { h: 'In v2', v: r => r[3] ? `<a class="dim" href="${r[3]}">${esc(r[1])}</a>` : `<span class="dim">${esc(r[1])}</span>` }, { h: '', cls: 's', v: r => mk(r[2]) }], OLD) }),
        K.panel({ title: 'Dropped', sub: 'and why', w: 'c12 x6', flush: true, body: K.table([{ h: 'What', v: r => `<span class="mk-dropped">${esc(r[0])}</span>` }, { h: 'Why', v: r => `<span class="dim">${esc(r[1])}</span>` }], DROPPED) }),
        K.panel({ title: 'The first version, panel by panel', sub: `all ${L.panels.length} panels of the first version, and where each is now`, w: 'c12', flush: true, isNew: true,
          body: `<div class="tall">${K.table([{ h: 'Tab', cls: 's', v: r => `<span class="faint">${esc(r[0])}</span>` }, { h: 'Panel', v: r => `<b class="ink">${esc(r[1])}</b>` }, { h: 'Where it is now', v: r => `<a class="ent" href="${r[3]}">${esc(r[2])}</a>` }], L.panels)}</div>`,
          help: 'Every panel of the first version with its place in this demo. A script opens each address and checks that the panel is there.' }),
        K.panel({ title: 'All screens', sub: 'built from the registry: a screen that exists is in this list', w: 'c12', flush: true,
          body: `<div class="tbwrap"><table class="tb"><thead><tr><th>Screen</th><th>Address</th><th></th><th>In the first version</th></tr></thead><tbody>${groups.map(dom).join('')}<tr class="grp"><td colspan="4">Entity pages</td></tr>${entRows}</tbody></table></div>` }),
        K.panel({ title: 'Side panels', sub: 'open over any page, close with Esc', w: 'c12', body: `<div class="chips">${Object.keys(SM.drawers).map(k => `<span class="chip">${esc(k)}</span>`).join('')}</div><div class="faint fs-11 mt-8" >A side panel is the short look at an object that has no page of its own: a pull request, a build, a test launch, an error group, a service level, a risk, a decision, the evidence of a number.</div>` })
      )
    };
  }

  /* ── Team ─────────────────────────────────────────────────────────────── */
  function teamPage() {
    return {
      title: D.team.name,
      lede: `${esc(D.team.train)}. Product: ${esc(D.team.product)}. One installation of the app looks at one team.`,
      kpis: [{ l: 'People', v: D.team.people, s: 'by role, no names' }, { l: 'Applications', v: D.services.length, s: '2 of tier 1', to: '#/ops/services' }, { l: 'Features in the PI', v: D.features.length, s: '5 business, 3 enablers', to: '#/product/features' }, { l: 'Sprint', v: '42', s: 'day 8 of 15', to: '#/delivery/sprint' }, { l: 'Working agreements', v: D.agreements.length, to: '#/knowledge/agreements' }],
      body: K.grid(
        K.panel({ title: 'Who the team is', sub: 'roles and head counts', w: 'c4', src: ['wiki'], body: K.hbars(D.team.roles.map(r => ({ n: esc(r[0]), v: r[1], cls: 's1', label: r[1] })), { max: 5, nw: 150, vw: 30 }) + K.note('The app holds no list of people. Capacity and absence are typed in by the team as totals.', '') }),
        K.panel({ title: 'What the team runs', w: 'c8', src: ['catalog', 'mon'], flush: true, body: K.table([{ h: 'Application', v: s => `${K.dot(s.state)} <a class="ent" href="#/service/${s.id}">${esc(s.name)}</a><span class="sub">${esc(s.does)}</span>` }, { h: 'Kind', cls: 's', v: s => esc(s.kind) }, { h: 'Stack', cls: 's', v: s => esc(s.stack) }, { h: 'Tier', n: true, v: s => s.tier }, { h: 'In production', cls: 's', n: true, v: s => `<span class="mono">${esc(s.prod)}</span>` }], D.services) }),
        K.panel({ title: 'Where the team is found in the sources', w: 'c6', body: K.kv([['Jira', 'board ' + esc(D.team.board) + ', project ' + esc(D.team.project) + ', team field "' + esc(D.team.name) + '"'], ['Wiki', 'space KESTREL'], ['Git hosting', 'project KES, 5 repositories'], ['Build server', 'folder KES, 5 pipelines'], ['Test reports', 'project kestrel, 4 launches'], ['Monitoring', 'workload "Checkout", 5 entities'], ['Log search', 'index shop_kestrel, 5 saved searches'], ['Service catalogue', 'domain "Checkout"']]) }),
        K.panel({ title: 'The calendar of the team', w: 'c6', src: ['jira'], body: K.kv([['PI', esc(D.cal.pi.id) + ', ' + K.dm(D.cal.pi.from) + ' to ' + K.dm(D.cal.pi.to)]].concat(D.cal.sprints.map(s => ['Sprint ' + s.id, K.dm(s.from) + ' to ' + K.dm(s.to) + ' · ' + s.state])).concat([['Releases', 'second Thursday of the month, freeze the Friday before'], ['Dailies', 'on working days, 09:15'], ['PI Planning', '14.12 and 15.12 for PI 2027-03']])) })
      )
    };
  }

  /* ── one issue ────────────────────────────────────────────────────────── */
  const allIssues = () => D.issues.concat(D.bugs.openList.filter(b => !D.issues.some(i => i.key === b.key)).map(b => Object.assign({ type: 'Bug', sp: null, dis: b.age, n: 0, feat: null }, b)))
    .concat(D.removed.map(r => Object.assign({ st: 'todo', dis: 5, n: 0, svc: 'checkout-web' }, r)));
  function issuePage(key) {
    const i = allIssues().find(x => x.key === key), ft = i.feat ? K.feature(i.feat) : null, pr = i.pr ? D.prs.find(p => p.id === i.pr) : null;
    const inSprint = D.issues.some(x => x.key === key), idx = D.statusOrder.indexOf(i.st);
    // a plausible journey through the statuses, consistent with days in status
    const pre = { todo: [], blocked: [['To do', 2], ['Implementing', 3]], impl: [['To do', 2]], review: [['To do', 2], ['Implementing', 3]], approve: [['To do', 1], ['Implementing', 3], ['Review', 1]], done: [['To do', 1], ['Implementing', 3], ['Review', 1], ['Approve', 1]] }[i.st] || [];
    const journey = pre.concat([[D.status[i.st], i.st === 'done' ? 0 : i.dis]]).filter(s => s[1] > 0 || i.st === 'done');
    const cls = { 'To do': 'bg-mute', 'Implementing': 'bg-r2', 'Review': 'bg-r3', 'Approve': 'bg-r4', 'Blocked': 'bg-bad', 'Done': 'bg-r5' };
    const total = journey.reduce((s, x) => s + x[1], 0);
    const env = i.st === 'done' ? (key === 'KES-4188' ? 3 : 1) : i.st === 'approve' || i.st === 'review' ? 0 : -1;
    const envRow = `<div class="envm" style="grid-template-columns:repeat(4,minmax(0,1fr))">${D.envs.map((e, n) => `<div class="cell${n <= env ? '' : ' op-45'}"><b>${e}</b>${n <= env ? 'has the change' : 'not yet'}</div>`).join('')}</div>`;
    const feed = [];
    if (i.added) feed.push({ t: K.dm(i.added), tone: 'watch', html: 'Came into sprint 42 after the start' });
    if (pr) feed.push({ t: 'Mon 16.11', tone: '', html: `Pull request <button class="key" data-dr="pr:${pr.id}">#${pr.id}</button> opened in ${esc(pr.repo)}` });
    if (i.st === 'blocked') feed.push({ t: i.dis + ' d ago', tone: 'bad', html: 'Moved to Blocked' + (i.blockedBy ? ', waits for ' + K.key(i.blockedBy) : '') });
    if (i.st === 'done') feed.push({ t: 'this sprint', tone: 'ok', html: 'Moved to Done' });
    feed.push({ t: i.n > 1 ? 'sprint 12.' + (4 - i.n) : 'Mon 09.11', tone: '', html: i.n > 1 ? 'First planned ' + (i.n - 1) + ' sprint' + (i.n > 2 ? 's' : '') + ' ago and carried over since' : inSprint ? 'In sprint 42 from its start' : 'In the team backlog, not in the sprint' });
    return {
      body: K.ehead({
        kind: `${esc(i.type)} ${K.status(i.st)} ${i.prio ? K.pill(i.prio, i.prio === 'Critical' ? 'bad' : '') : ''} ${i.added ? K.pill('came in after the start', 'watch') : ''}`,
        title: i.key + '  ' + i.title,
        facts: [i.sp != null ? `<b>${i.sp}</b> SP` : 'no story points', ft ? 'Feature ' + K.key(ft.key) : 'no feature', 'Application ' + K.svc(i.svc), inSprint ? 'Sprint <b>42</b>' : 'not in the sprint', i.n > 1 ? `<span class="c-watch">in its sprint no. ${i.n}</span>` : ''].filter(Boolean),
        links: [K.extLink('Open in Jira', 'Jira')].concat(pr ? [K.btn('Pull request #' + pr.id, `data-dr="pr:${pr.id}"`, 'sm')] : [])
      }) + K.kpis([
        { l: 'Days in this status', v: i.st === 'done' ? '–' : i.dis, s: i.st === 'done' ? 'done' : i.dis >= D.flow.p85 ? '<b>longer than 85 %</b> of finished items took in total' : i.dis >= D.flow.p50 ? '<b>longer than half</b> of finished items took in total' : 'within the usual', tone: i.st === 'done' ? 'ok' : i.dis >= D.flow.p85 || i.st === 'blocked' ? 'bad' : i.dis >= D.flow.p50 ? 'watch' : 'ok' },
        { l: 'From start to now', v: total || '–', u: total ? 'days' : '', s: 'half of the items finish within ' + D.flow.p50, ev: 'flow.p85' },
        { l: 'Sprint no.', v: i.n || '–', s: i.n > 2 ? '<b>third sprint or later</b>' : i.n === 2 ? 'carried over once' : 'first sprint', tone: i.n > 2 ? 'bad' : i.n === 2 ? 'watch' : '' },
        { l: 'Pull request', v: pr ? '#' + pr.id : 'none', s: pr ? { first: 'waiting for a first review', review: 'in review', approved: 'approved, not merged' }[pr.st] + ' · ' + pr.wait + ' h' : i.st === 'impl' && i.dis >= 3 ? '<b>in progress for ' + i.dis + ' days</b>, none names it' : '', tone: pr && pr.wait >= 24 ? 'watch' : '' },
        { l: 'Furthest environment', v: env >= 0 ? D.envs[env] : 'none', s: env === 3 ? 'in production since 13.11' : env >= 0 ? 'built, not released' : 'not merged yet' }
      ]) + K.grid(
        K.panel({ title: 'Its way through the board', sub: 'days per status', w: 'c7', src: ['jira'], body: (journey.length && total ? K.stackbar(journey.map(s => [s[0], s[1], cls[s[0]] || 'bg-mute']), { unit: 'days', h: 14 }) : K.note('Not started yet.', '')) + K.sect('What happened') + K.feed(feed),
          help: 'From the history of the issue in Jira: when it entered each status. This demo draws a plausible way; the app reads the real one.' }),
        K.panel({ title: 'Where the change is', sub: 'from the pull request to production', w: 'c5', src: ['git', 'ci'], body: envRow + (pr ? K.sect('Pull request') + K.kv([['Stands', { first: 'waiting for a first review', review: 'in review', approved: 'approved, not merged' }[pr.st]], ['Waiting', pr.wait + ' h'], ['Rounds', String(pr.rounds)], ['Build', pr.build === 'red' ? '<span class="c-bad">red</span>' : pr.build === 'run' ? 'running' : 'green']]) : '') }),
        K.panel({ title: 'What it belongs to', w: 'c6', src: ['jira'], body: K.kv([['Feature', ft ? K.key(ft.key, { title: true }) : '<span class="faint">none</span>'], ['Objective', ft && ft.obj ? `<button class="ent" data-dr="objective:${ft.obj}">Objective ${ft.obj}</button> · BV ${ft.bv}` : '<span class="faint">none</span>'], ['Release', ft && K.release(ft.rel) ? K.key(ft.rel) : key === 'KES-4188' ? K.key('R2026.11.1') : '<span class="faint">not set</span>'], ['Application', K.svc(i.svc)]]) }),
        K.panel({ title: 'Links', sub: 'blocks and is blocked by', w: 'c6', src: ['jira'], body: i.blockedBy ? K.list([{ tone: 'bad', html: 'Is blocked by ' + K.key(i.blockedBy) + ' of Team Atlas, which has no date', v: i.dis + ' d' }]) + `<div class="rowf mt-8" ><a class="btn sm" href="#/delivery/dependencies">Dependencies</a><button class="btn sm" data-dr="risk:R-1">Risk R-1</button></div>` : key === 'KES-4188' ? K.list([{ tone: 'ok', html: 'Fixes ' + K.key('INC-2291'), v: 'closed' }]) : K.stateBlock('empty', { title: 'No link to another issue', text: 'Nothing blocks this item and it blocks nothing.' }) })
      )
    };
  }

  SM.single({ id: 'inbox', title: 'Inbox', hz: ['today'], was: 'kept', from: 'Inbox, Notices', find: 'notices drafts decisions sent', render: inboxPage });
  const ssCheck = (t, on, off) => `<label class="ss-c"><input type="checkbox"${on ? ' checked' : ''}${off ? ' disabled' : ''}> ${esc(t)}</label>`;
  SM.drawer('searchset', () => ({ kind: 'Search', title: 'Search settings', body:
    K.sect('Where to look') + ssCheck('Jira projects of the team: KES, KESBUG (keys only)', true) + ssCheck('Pinned page trees: How we work, Postmortems, Retrospectives', true) + ssCheck('The whole of the wiki', false) +
    K.sect('How to match') + `<p class="dim ss-p">Words find what is written. Meaning finds what was meant, through the semantic index, and can be wrong.</p><label class="ss-c">Words <input type="range" min="0" max="10" value="6" aria-label="Words against meaning"> Meaning</label>` + ssCheck('Newer first when the match is equal', true) + ssCheck('Lift results of my team', true) +
    K.sect('Team vocabulary', 'words that mean the same here; they widen a query, nothing else learns from them') + K.table([{ h: 'Word', cls: 's', v: r => `<span class="mono">${esc(r[0])}</span>` }, { h: 'Also finds', v: r => esc(r[1]) }], [['DoD', 'Definition of Done'], ['PI', 'program increment, fix version of the PI'], ['FPW', 'Winter sale'], ['Stock hold', 'reserved stock, a hold']]) +
    `<div class="rowf mt-6" ><button class="btn sm" data-toast="This demo does not save the vocabulary.">Add a word</button></div>` +
    K.sect('The answer', 'the agent may only cite what the search found') + ssCheck('Say "not found" rather than guess', true) + ssCheck('Quote the passage next to each source', true) + `<label class="ss-c">Length <select class="inp" style="width:auto"><option>one line</option><option selected>short</option><option>detailed</option></select></label>` +
    K.sect('What the model may read', 'the search runs with your own access') + ssCheck('Titles of issues and pages', false) + ssCheck('Comments', false) + ssCheck('Never: titles and texts of projects with customer data (keys only)', true, true) +
    K.note('This demo does not save these settings.', '') }));
  SM.single({ id: 'search', title: 'Search', hz: ['sprint'], was: 'kept', from: 'Search', find: 'jira wiki jql cql', render: searchPage });
  SM.single({ id: 'team', title: 'Team', h1: 'Team', hz: ['pi'], was: 'new', from: 'System (Team and sprint)', find: 'team kestrel roles applications', render: teamPage });
  SM.single({ id: 'map', title: 'Map of all screens', hz: ['today'], was: 'new', from: '', find: 'sitemap kept moved new dropped', render: mapPage });
  SM.entity({ kind: 'issue', title: 'Sprint', domain: 'delivery', list: '#/delivery/sprint', hz: ['sprint'], was: 'moved', from: 'the card that opened on hover', ids: () => allIssues().map(i => i.key), render: issuePage });
})();
