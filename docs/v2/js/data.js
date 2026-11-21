/* Sightline v2 demo: the one data set every page reads.
   Everything here is invented: Team Kestrel, its applications, issues, people-free numbers.
   The numbers add up across pages; the checks at the bottom of this file fail loudly when they do not. */
(function () {
  'use strict';

  var D = {};

  D.now = { date: '2026-11-18', label: 'Wed 18.11.2026 11:48', day: 8, days: 15, daysLeft: 7 };

  D.team = {
    id: 'kestrel', name: 'Team Kestrel', train: 'Shop train', board: 'Kestrel board (7)', project: 'KES',
    product: 'Checkout', pi: 'PI 26.4',
    // by role only: the app never lists, counts or compares a person
    roles: [['Developers', 5], ['Test engineer', 1], ['Application manager', 1], ['Product owner', 1], ['Scrum master', 1]],
    people: 9
  };

  /* the line: PI 26.4 with its sprints, releases, incidents and the Winter sale */
  D.cal = {
    from: '2026-09-28', to: '2026-12-31',
    pi: { id: 'PI 26.4', from: '2026-09-28', to: '2026-12-11' },
    quarter: { id: 'Q4 2026', from: '2026-10-01', to: '2026-12-31' },
    sprints: [
      { id: '40', name: 'Sprint 40', from: '2026-09-28', to: '2026-10-16', state: 'closed', committed: 56, done: 52, addedSp: 6, removedSp: 3, items: 24, doneItems: 21 },
      { id: '41', name: 'Sprint 41', from: '2026-10-19', to: '2026-11-06', state: 'closed', committed: 58, done: 49, addedSp: 9, removedSp: 5, items: 26, doneItems: 20 },
      { id: '42', name: 'Sprint 42', from: '2026-11-09', to: '2026-11-27', state: 'active', committed: 63, done: 25, addedSp: 5, removedSp: 3, items: 25, doneItems: 8 },
      { id: '43', name: 'Sprint 43 (IP)', from: '2026-11-30', to: '2026-12-11', state: 'future', committed: 0, done: 0, addedSp: 0, removedSp: 0, items: 0, doneItems: 0 }
    ],
    marks: [
      { d: '2026-10-08', kind: 'rel', id: 'R2026.10', label: 'Release 2026.10 in production' },
      { d: '2026-10-29', kind: 'inc', id: 'INC-2262', label: 'INC-2262 export timed out' },
      { d: '2026-11-05', kind: 'inc', id: 'INC-2274', label: 'INC-2274 export timed out' },
      { d: '2026-11-10', kind: 'rel', id: 'R2026.11', label: 'Release 2026.11 in production' },
      { d: '2026-11-12', kind: 'inc', id: 'INC-2291', label: 'INC-2291 checkout-api down 26 min' },
      { d: '2026-11-13', kind: 'rel', id: 'R2026.11.1', label: 'Hotfix 2026.11.1 in production' },
      { d: '2026-11-17', kind: 'inc', id: 'INC-2299', label: 'INC-2299 export timed out' },
      { d: '2026-11-27', kind: 'flag', id: 'freeze', label: 'Code freeze for release 2026.12' },
      { d: '2026-12-03', kind: 'plan', id: 'R2026.12', label: 'Release 2026.12 planned' },
      { d: '2026-12-13', kind: 'flag', id: 'sale', label: 'Winter sale 13.12.2026' }
    ]
  };

  /* sources: state is ok | stale | down | off. The Sources page can switch them to show how panels degrade. */
  D.sources = [
    { id: 'jira', name: 'Jira', kind: 'Jira', state: 'ok', age: '2 min', every: '5 min', reads: 'issues with history, sprints, sprint reports, features, links', via: 'REST, GET only, your personal token', last: '11:46' },
    { id: 'wiki', name: 'Wiki', kind: 'Wiki', state: 'ok', age: '38 min', every: '1 h', reads: 'pages of the team space: title, labels, last edit; text only on screen', via: 'REST, GET only', last: '11:10' },
    { id: 'git', name: 'Git hosting', kind: 'Git hosting', state: 'ok', age: '6 min', every: '10 min', reads: 'pull requests with events, commits, changed files, build status', via: 'REST, GET only', last: '11:42' },
    { id: 'ci', name: 'Build server', kind: 'Build server', state: 'ok', age: '3 min', every: '5 min', reads: 'pipelines of the five repositories: runs, stages, durations, test totals', via: 'REST, GET only', last: '11:45' },
    { id: 'testrep', name: 'Test reports', kind: 'Test reports', state: 'ok', age: '12 min', every: '15 min', reads: 'launches, test items, defect types, history of each test', via: 'REST, GET only', last: '11:36' },
    { id: 'mon', name: 'Monitoring', kind: 'Monitoring', state: 'ok', age: '1 min', every: '2 min', reads: 'golden metrics, service levels, error groups, change markers', via: 'GraphQL, fixed queries, read key', last: '11:47' },
    { id: 'logs', name: 'Log search', kind: 'Log search', state: 'stale', age: '5 h 38 min', every: '1 h', reads: 'saved searches of the team: business counters, export log', via: 'REST, saved searches only', last: '06:10', why: 'the last three reads timed out after 60 s' },
    { id: 'catalog', name: 'Service catalogue', kind: 'service catalogue', state: 'ok', age: '52 min', every: '1 h', reads: 'the team\'s domain: applications per environment, links to cluster, Log search, Build server', via: 'REST, GET only, personal key', last: '10:56' },
    { id: 'increp', name: 'Incident reports', kind: 'incident reports (folder)', state: 'ok', age: '4 min', every: '5 min', reads: 'incident reports by its template: service, cause, confidence, steps', via: 'files in a shared folder', last: '11:44' },
    { id: 'chat', name: 'Team chat', kind: 'team chat', state: 'off', age: 'not connected', every: 'n/a', reads: 'requests to the team in two channels', via: 'needs an approval first', last: 'never', why: 'reading channels waits for the data protection assessment' }
  ];
  D.agent = { engine: 'agent runtime', models: 'models of your subscription', state: 'on', lastRun: '11:42', runsToday: 6, dropped: 1, checked: 41 };

  /* applications of the team */
  D.services = [
    { id: 'checkout-web', name: 'Checkout web', kind: 'Web application', stack: 'Angular 19', repo: 'SHOP/checkout-web', tier: 1, state: 'ok',
      rpm: 1240, p95: 820, err: 0.3, apdex: 0.94, prod: '2026.11.0', does: 'Cart, checkout steps and the order overview of the shop' },
    { id: 'checkout-api', name: 'Checkout API', kind: 'Backend service', stack: 'Java 21, Spring Boot', repo: 'SHOP/checkout-api', tier: 1, state: 'watch',
      rpm: 2960, p95: 210, err: 0.12, apdex: 0.97, prod: '2026.11.1', does: 'Stock holds, orders, cancellations and refunds' },
    { id: 'pricing-engine', name: 'Pricing engine', kind: 'Backend service', stack: 'Java 21, Spring Boot', repo: 'SHOP/pricing-engine', tier: 2, state: 'watch',
      rpm: 1150, p95: 340, err: 1.8, apdex: 0.91, prod: '2026.11.0', does: 'Price tiers and price calculation from the price feed' },
    { id: 'carrier-export', name: 'Carrier export (batch)', kind: 'Batch job', stack: 'Java 21, Spring Batch', repo: 'SHOP/carrier-export', tier: 2, state: 'bad',
      rpm: null, p95: null, err: null, apdex: null, prod: '2026.10.2', does: 'Nightly export of orders to the carriers, 02:00 to 05:00' },
    { id: 'order-mail', name: 'Order mail', kind: 'Backend service', stack: 'Kotlin, Spring Boot', repo: 'SHOP/order-mail', tier: 3, state: 'ok',
      rpm: 85, p95: 150, err: 0.4, apdex: 0.98, prod: '2026.11.0', does: 'E-mail and SMS to customers' }
  ];

  /* features of the PI. sp: planned in the PI, done: finished so far, left this sprint, later = planned after 42 */
  D.features = [
    { key: 'KES-3301', title: 'Bulk orders from 10 units: show stock holds per warehouse and release part of them', kind: 'Business', obj: 1, bv: 8, wsjf: 14.5, sp: 34, done: 27, left: 7, later: 0, state: 'ok', eta: ['2026-11-25', '2026-11-27'], rel: 'R2026.12', svc: ['checkout-web', 'checkout-api'] },
    { key: 'KES-3312', title: 'Full and partial cancellation of orders with an automatic refund', kind: 'Business', obj: 2, bv: 8, wsjf: 12.0, sp: 29, done: 21, left: 5, later: 3, state: 'ok', eta: ['2026-12-02', '2026-12-08'], rel: 'R2027.01', svc: ['checkout-web', 'checkout-api', 'order-mail'] },
    { key: 'KES-3318', title: 'Pricing: new volume tiers for schools and small businesses for the Winter sale on 13.12.2026', kind: 'Business', obj: 3, bv: 10, wsjf: 18.3, sp: 24, done: 8, left: 16, later: 0, state: 'bad', eta: ['2026-12-01', '2026-12-10'], rel: 'R2026.12', svc: ['pricing-engine', 'checkout-api'], due: '2026-11-27' },
    { key: 'KES-3325', title: 'Carrier export: retry on a timeout and a complete log', kind: 'Enabler', obj: 4, bv: 6, wsjf: 9.8, sp: 13, done: 5, left: 3, later: 5, state: 'watch', eta: ['2026-12-04', '2026-12-11'], rel: 'R2026.12', svc: ['carrier-export'] },
    { key: 'KES-3331', title: 'Accessible checkout: keyboard use and screen reader texts to WCAG 2.1 AA', kind: 'Business', obj: 5, bv: 5, wsjf: 7.2, sp: 16, done: 10, left: 1, later: 5, state: 'ok', eta: ['2026-12-07', '2026-12-11'], rel: 'R2027.01', svc: ['checkout-web'] },
    { key: 'KES-3340', title: 'Tell the customer when a delivery date moves or a parcel is more than a day late', kind: 'Business', obj: 6, bv: 4, wsjf: 5.1, sp: 18, done: 5, left: 0, later: 13, state: 'watch', eta: ['2027-01-20', '2027-02-10'], rel: 'next PI', svc: ['order-mail'] },
    { key: 'KES-3347', title: 'Technical debt: replace the old stock hold table (database migration in three steps)', kind: 'Enabler', obj: null, bv: null, wsjf: 6.4, sp: 13, done: 8, left: 5, later: 0, state: 'watch', eta: ['2026-11-26', '2026-12-03'], rel: 'R2026.12', svc: ['checkout-api'] },
    { key: 'KES-3352', title: 'Monitoring: service levels and alerts for the Checkout API', kind: 'Enabler', obj: null, bv: null, wsjf: 8.0, sp: 8, done: 3, left: 3, later: 2, state: 'ok', eta: ['2026-12-03', '2026-12-09'], rel: 'R2027.01', svc: ['checkout-api'] }
  ];

  D.objectives = [
    { n: 1, text: 'Bulk buyers see stock holds per warehouse and can release part of them', committed: true, bv: 8, state: 'ok', feat: 'KES-3301', say: 'on track' },
    { n: 2, text: 'Orders can be cancelled in full or in part, and the refund runs by itself', committed: true, bv: 8, state: 'ok', feat: 'KES-3312', say: 'on track' },
    { n: 3, text: 'New volume tiers for schools and small businesses are live for the Winter sale on 13.12.2026', committed: true, bv: 10, state: 'bad', feat: 'KES-3318', say: 'off track' },
    { n: 4, text: 'The nightly carrier export survives carrier timeouts without manual work', committed: true, bv: 6, state: 'watch', feat: 'KES-3325', say: 'at risk' },
    { n: 5, text: 'The checkout works with a keyboard and a screen reader (WCAG 2.1 AA)', committed: true, bv: 5, state: 'ok', feat: 'KES-3331', say: 'on track' },
    { n: 6, text: 'Customers get changed delivery dates and delays as a message', committed: false, bv: 4, state: 'watch', feat: 'KES-3340', say: 'will not be reached in this PI' }
  ];
  D.predictability = [
    { pi: 'PI 26.1', planned: 38, actual: 31 }, { pi: 'PI 26.2', planned: 34, actual: 26 }, { pi: 'PI 26.3', planned: 36, actual: 32 }
  ];

  /* sprint 12.3. st: todo | blocked | impl | review | approve | done. added/removed after the start. dis = days in status. */
  D.issues = [
    { key: 'KES-4102', type: 'Story', sp: 5, st: 'done', feat: 'KES-3301', svc: 'checkout-web', dis: 3, n: 1, title: 'Show stock holds per warehouse in the checkout' },
    { key: 'KES-4103', type: 'Story', sp: 3, st: 'done', feat: 'KES-3301', svc: 'checkout-api', dis: 2, n: 1, title: 'Release part of a hold: pick single items' },
    { key: 'KES-4108', type: 'Story', sp: 3, st: 'review', feat: 'KES-3301', svc: 'checkout-web', dis: 1, n: 1, pr: 233, title: 'Hold overview: filter by delivery date and warehouse' },
    { key: 'KES-4111', type: 'Story', sp: 2, st: 'impl', feat: 'KES-3301', svc: 'checkout-api', dis: 2, n: 1, title: 'Log the release and show it in the order history' },
    { key: 'KES-4115', type: 'Story', sp: 2, st: 'todo', feat: 'KES-3301', svc: 'checkout-web', dis: 8, n: 1, title: 'Notice when fewer than 10 items are left in a warehouse' },
    { key: 'KES-4120', type: 'Story', sp: 5, st: 'done', feat: 'KES-3312', svc: 'checkout-api', dis: 4, n: 2, title: 'Partial cancellation: remove single lines from a bulk order' },
    { key: 'KES-4121', type: 'Story', sp: 3, st: 'done', feat: 'KES-3312', svc: 'checkout-api', dis: 1, n: 1, title: 'Calculate and show the refund before the confirmation' },
    { key: 'KES-4124', type: 'Story', sp: 3, st: 'impl', feat: 'KES-3312', svc: 'checkout-api', dis: 5, n: 1, pr: 412, title: 'Send the cancellation confirmation by e-mail' },
    { key: 'KES-4127', type: 'Story', sp: 2, st: 'approve', feat: 'KES-3312', svc: 'checkout-api', dis: 1, n: 1, pr: 416, title: 'Capture cancellation reasons as a pick list' },
    { key: 'KES-4131', type: 'Story', sp: 5, st: 'blocked', feat: 'KES-3318', svc: 'pricing-engine', dis: 9, n: 2, blockedBy: 'ATL-882', title: 'Take the new price tiers from the price feed v3' },
    { key: 'KES-4132', type: 'Story', sp: 3, st: 'impl', feat: 'KES-3318', svc: 'checkout-api', dis: 3, n: 1, pr: 415, title: 'Price calculation for school orders (one item free per ten)' },
    { key: 'KES-4135', type: 'Story', sp: 3, st: 'impl', feat: 'KES-3318', svc: 'pricing-engine', dis: 4, n: 1, title: 'Small business tier: check the VAT number' },
    { key: 'KES-4136', type: 'Story', sp: 2, st: 'todo', feat: 'KES-3318', svc: 'pricing-engine', dis: 8, n: 1, title: 'Show old and new prices side by side on the test system for sign-off' },
    { key: 'KES-4139', type: 'Story', sp: 3, st: 'review', feat: 'KES-3318', svc: 'pricing-engine', dis: 2, n: 1, pr: 118, title: 'Pricing engine: cache for price tiers that expires with the Winter sale' },
    { key: 'KES-4142', type: 'Story', sp: 3, st: 'done', feat: 'KES-3325', svc: 'carrier-export', dis: 5, n: 1, title: 'Export: retry with a growing delay after a timeout' },
    { key: 'KES-4143', type: 'Story', sp: 2, st: 'done', feat: 'KES-3325', svc: 'carrier-export', dis: 3, n: 1, title: 'Export: log every transfer with carrier, duration and result' },
    { key: 'KES-4146', type: 'Story', sp: 3, st: 'impl', feat: 'KES-3325', svc: 'carrier-export', dis: 2, n: 1, pr: 97, title: 'Export: stop after five attempts and report to monitoring' },
    { key: 'KES-4150', type: 'Story', sp: 2, st: 'done', feat: 'KES-3331', svc: 'checkout-web', dis: 6, n: 1, title: 'Keyboard use of the quantity picker' },
    { key: 'KES-4151', type: 'Story', sp: 1, st: 'review', feat: 'KES-3331', svc: 'checkout-web', dis: 1, n: 1, pr: 236, title: 'Fix the focus order in the checkout flow' },
    { key: 'KES-4160', type: 'Story', sp: 5, st: 'impl', feat: 'KES-3347', svc: 'checkout-api', dis: 24, n: 3, title: 'Stock hold table: move the data to the new schema (migration in three steps)' },
    { key: 'KES-4079', type: 'Bug', sp: null, st: 'blocked', feat: null, svc: 'carrier-export', dis: 13, n: 3, prio: 'Major', title: 'Export stops when a carrier reports the same order number twice' },
    { key: 'KES-4188', type: 'Bug', sp: 2, st: 'done', feat: null, svc: 'checkout-api', dis: 5, n: 1, added: '2026-11-12', prio: 'Critical', title: 'Checkout API does not give back database connections after the release' },
    { key: 'KES-4190', type: 'Bug', sp: null, st: 'impl', feat: null, svc: 'checkout-web', dis: 3, n: 1, added: '2026-11-13', prio: 'Major', title: 'Checkout shows the old total after a partial cancellation' },
    { key: 'KES-4193', type: 'Story', sp: 3, st: 'todo', feat: 'KES-3352', svc: 'checkout-api', dis: 3, n: 1, added: '2026-11-13', title: 'Monitoring: alert when more than 80 % of database connections are in use' },
    { key: 'KES-4197', type: 'Task', sp: null, st: 'review', feat: null, svc: 'order-mail', dis: 1, n: 1, added: '2026-11-16', pr: 57, title: 'Renew the certificate of the SMS gateway on the test system (expires 30.11.2026)' }
  ];
  D.removed = [{ key: 'KES-4155', type: 'Story', sp: 3, feat: 'KES-3331', on: '2026-11-11', to: '43', title: 'Screen reader texts for the order overview' }];
  D.status = { todo: 'To do', blocked: 'Blocked', impl: 'Implementing', review: 'Review', approve: 'Approve', done: 'Done' };
  D.statusOrder = ['todo', 'blocked', 'impl', 'review', 'approve', 'done'];

  D.sprint = {
    id: '42', name: 'Sprint 42', from: 'Mon 09.11', to: 'Fri 27.11',
    committedItems: 22, committedSp: 63, addedItems: 4, addedSp: 5, removedItems: 1, removedSp: 3,
    scopeItems: 25, scopeSp: 65, doneItems: 8, doneSp: 25, openItems: 17, openSp: 40, noSp: 3,
    forecast: { p85: 47, p50: 54, all: 9, over50: 11, over85: 18, historyDays: 75 },
    options: [
      { id: 'keep', label: 'Keep everything in the sprint', moves: [], sp: 0, chance: 9 },
      { id: 'todo', label: 'Move out what has not started', moves: ['KES-4115', 'KES-4136', 'KES-4193'], sp: 7, chance: 31 },
      { id: 'blocked', label: 'Move out what is blocked', moves: ['KES-4131', 'KES-4079'], sp: 5, chance: 24 },
      { id: 'both', label: 'Move out both', moves: ['KES-4115', 'KES-4136', 'KES-4193', 'KES-4131', 'KES-4079'], sp: 12, chance: 55 }
    ],
    // done SP at the end of each working day (day 0 = start), scope SP on the same days
    burn: [0, 0, 3, 5, 10, 13, 18, 20, 25], scope: [63, 63, 63, 60, 62, 65, 65, 65, 65],
    // items per column at the end of each working day: todo, blocked, impl, review, approve, done
    cfd: [[14, 1, 6, 1, 0, 0], [12, 1, 7, 2, 0, 0], [10, 2, 7, 2, 1, 1], [9, 2, 7, 2, 0, 2], [8, 2, 7, 3, 1, 3], [6, 2, 8, 3, 1, 5], [5, 2, 7, 4, 1, 6], [3, 2, 7, 4, 1, 8]]
  };
  D.velocity = [
    { id: '36', committed: 52, done: 48 }, { id: '37', committed: 55, done: 51 }, { id: '38', committed: 54, done: 43 },
    { id: '39 IP', committed: 21, done: 19, ip: true }, { id: '40', committed: 56, done: 52 }, { id: '41', committed: 58, done: 49 }
  ];
  D.lookback = [
    { sprint: '40', at: '33 %', p85: 44, p50: 50, ended: 52, held: true }, { sprint: '40', at: '67 %', p85: 47, p50: 51, ended: 52, held: true },
    { sprint: '41', at: '33 %', p85: 45, p50: 52, ended: 49, held: true }, { sprint: '41', at: '67 %', p85: 46, p50: 51, ended: 49, held: true },
    { sprint: '38', at: '33 %', p85: 46, p50: 52, ended: 43, held: false }, { sprint: '38', at: '67 %', p85: 41, p50: 46, ended: 43, held: true }
  ];

  /* flow of the last 12 weeks (finished items) */
  D.flow = {
    n: 96, p50: 4.6, p85: 11.2, p95: 17.5, wip: 7, wipLimit: 6, thrWeek: [7, 9, 6, 8, 10, 7, 8, 9, 6, 9, 10, 7],
    // [finished on day of the window (0..83), cycle days, type 0 story 1 bug]
    dots: [[1, 3.1, 0], [2, 5.4, 0], [3, 1.2, 1], [4, 8.9, 0], [6, 2.2, 0], [7, 4.0, 0], [8, 12.6, 0], [9, 0.8, 1], [11, 6.1, 0], [13, 3.3, 0], [14, 2.7, 0], [15, 15.9, 0], [16, 4.9, 0], [18, 1.9, 1], [20, 7.4, 0], [21, 3.8, 0], [22, 5.2, 0], [23, 21.3, 0], [25, 2.4, 1], [27, 4.4, 0], [28, 9.7, 0], [29, 3.0, 0], [30, 6.6, 0], [32, 1.4, 1], [34, 5.0, 0], [35, 4.2, 0], [36, 13.8, 0], [37, 2.9, 0], [39, 7.9, 0], [41, 3.6, 0], [42, 4.7, 0], [43, 1.1, 1], [44, 10.4, 0], [46, 5.8, 0], [48, 2.5, 0], [49, 18.2, 0], [50, 4.1, 0], [51, 3.4, 1], [53, 6.9, 0], [55, 4.8, 0], [56, 2.0, 0], [57, 8.3, 0], [58, 5.5, 0], [60, 1.6, 1], [62, 11.9, 0], [63, 3.9, 0], [64, 4.5, 0], [65, 6.3, 0], [67, 2.8, 0], [69, 5.1, 1], [70, 9.2, 0], [71, 3.2, 0], [72, 4.3, 0], [74, 14.7, 0], [76, 2.3, 0], [77, 5.0, 1], [78, 6.0, 0], [79, 3.7, 0], [81, 4.6, 0], [82, 2.1, 0]],
    stages: [['To do', 2.9], ['Implementing', 3.4], ['Review', 1.6], ['Approve', 0.9], ['Blocked', 1.1]]
  };

  /* work done in the PI so far by kind, in story points: 71 + 16 + 22 + 17 = 126 = 52 + 49 + 25 */
  D.workmix = [
    { id: 'business', name: 'Business features', sp: 71, pct: 56, target: 60 },
    { id: 'enabler', name: 'Enablers and technical debt', sp: 16, pct: 13, target: 20 },
    { id: 'bugs', name: 'Bugs and incidents', sp: 22, pct: 18, target: 10 },
    { id: 'support', name: 'Support and maintenance', sp: 17, pct: 13, target: 10 }
  ];
  D.capacity = [
    { id: '40', planned: 105, absent: 7, duty: 0, avail: 98, sp: 52 },
    { id: '41', planned: 105, absent: 6, duty: 5, avail: 94, sp: 49 },
    { id: '42', planned: 105, absent: 14, duty: 5, avail: 86, sp: null, committed: 63, outlook: 45 },
    { id: '43 IP', planned: 70, absent: 11, duty: 5, avail: 54, sp: null, committed: 0, outlook: 0 }
  ];
  D.absence = { vacation: 9, training: 3, sick: 2 };

  /* pull requests open now. st: first | review | approved. wait = hours waiting without weekends */
  D.prs = [
    { id: 412, repo: 'checkout-api', issue: 'KES-4124', st: 'review', wait: 26, age: 2.1, rounds: 2, files: 9, comments: 7, build: 'ok' },
    { id: 233, repo: 'checkout-web', issue: 'KES-4108', st: 'approved', wait: 3, age: 0.9, rounds: 1, files: 5, comments: 2, build: 'ok' },
    { id: 118, repo: 'pricing-engine', issue: 'KES-4139', st: 'review', wait: 30, age: 1.8, rounds: 1, files: 7, comments: 4, build: 'red' },
    { id: 415, repo: 'checkout-api', issue: 'KES-4132', st: 'first', wait: 21, age: 0.9, rounds: 0, files: 11, comments: 0, build: 'ok' },
    { id: 236, repo: 'checkout-web', issue: 'KES-4151', st: 'review', wait: 5, age: 0.4, rounds: 0, files: 2, comments: 1, build: 'ok' },
    { id: 97, repo: 'carrier-export', issue: 'KES-4146', st: 'first', wait: 2, age: 0.1, rounds: 0, files: 6, comments: 0, build: 'run' },
    { id: 416, repo: 'checkout-api', issue: 'KES-4127', st: 'approved', wait: 1, age: 0.6, rounds: 1, files: 3, comments: 3, build: 'ok' },
    { id: 57, repo: 'order-mail', issue: 'KES-4197', st: 'first', wait: 28, age: 1.2, rounds: 0, files: 1, comments: 0, build: 'ok' }
  ];
  D.prStats = { merged6w: 58, p50: 1.3, p85: 3.1, firstReviewH: 6, split: [44, 31, 25], rework: 12, sizeFiles: 6, kept1d: 49,
    waitWeek: [['W41', 5], ['W42', 4], ['W43', 7], ['W44', 6], ['W45', 9], ['W46', 14], ['W47', 8]] };

  /* builds on main, last 30 days: 233 runs, 212 green, 21 red = 9 + 6 + 3 + 3 */
  D.builds = {
    runs: 233, green: 212, medianMin: 14, p85Min: 22,
    failBy: [['Unit tests', 9], ['Integration tests', 6], ['Quality gate', 3], ['Deploy to dev', 3]],
    pipes: [
      { repo: 'checkout-web', state: 'ok', runs: 61, green: 58, min: 11, last: '18.11 10:52', tests: 640 },
      { repo: 'checkout-api', state: 'ok', runs: 74, green: 67, min: 17, last: '18.11 11:20', tests: 920 },
      { repo: 'pricing-engine', state: 'bad', runs: 39, green: 33, min: 13, last: '17.11 16:40', tests: 310, since: '17.11 16:40', why: 'contract test against the price feed v3 fails' },
      { repo: 'carrier-export', state: 'ok', runs: 34, green: 31, min: 15, last: '18.11 09:14', tests: 190 },
      { repo: 'order-mail', state: 'ok', runs: 25, green: 23, min: 9, last: '17.11 15:02', tests: 80 }
    ]
  };

  /* test launches of the test reports. Last nightly: 412 = 389 + 14 + 9; 14 = 4 + 3 + 2 + 5 */
  D.launches = [
    { id: 'regression-nightly', n: 1482, at: '18.11 01:30', total: 412, passed: 389, failed: 14, skipped: 9, env: 'test', dur: '1 h 52 min',
      defects: { pb: 4, ab: 3, si: 2, ti: 5 }, trend: [97.1, 96.8, 97.3, 96.6, 95.9, 96.4, 96.1, 92.0, 93.9, 95.4, 96.1, 95.6, 91.5, 94.4] },
    { id: 'api-contract', n: 3310, at: '17.11 17:02', total: 318, passed: 316, failed: 2, skipped: 0, env: 'dev', dur: '6 min', defects: { pb: 2, ab: 0, si: 0, ti: 0 } },
    { id: 'smoke-int', n: 221, at: '17.11 14:35', total: 46, passed: 46, failed: 0, skipped: 0, env: 'int', dur: '4 min', defects: { pb: 0, ab: 0, si: 0, ti: 0 } },
    { id: 'a11y-checkout', n: 38, at: '16.11 22:00', total: 64, passed: 58, failed: 6, skipped: 0, env: 'test', dur: '12 min', defects: { pb: 6, ab: 0, si: 0, ti: 0 } }
  ];
  D.flaky = [
    { test: 'BulkOrderE2E › Release part of a hold › shows what is left', svc: 'checkout-web', flips: 6, of: 14, last: 'failed' },
    { test: 'CancelE2E › Partial cancellation › refund shows in the overview', svc: 'checkout-web', flips: 5, of: 14, last: 'passed' },
    { test: 'ExportIT › Carrier answers after 29 seconds', svc: 'carrier-export', flips: 5, of: 14, last: 'failed' },
    { test: 'PricingIT › School tier › cache expires', svc: 'pricing-engine', flips: 4, of: 14, last: 'failed' },
    { test: 'NotifyIT › SMS gateway not reachable', svc: 'order-mail', flips: 3, of: 14, last: 'passed' },
    { test: 'OrderIT › 40 orders at once on one hold', svc: 'checkout-api', flips: 3, of: 14, last: 'passed' }
  ];

  /* bugs of the team in the PI so far: 4 open before + 19 written - 16 resolved = 7 open */
  D.bugs = {
    openBefore: 4, written: 19, resolved: 16, open: 7, openMajor: 3, openMinor: 4, old30: 2, p50: 4, p85: 13, inTarget: 13, judged: 16, reopened: 1, noBug: 2,
    found: [['Production', 5], ['Integration test', 6], ['Team test', 8]],
    bySvc: [['checkout-api', 7], ['checkout-web', 6], ['carrier-export', 4], ['pricing-engine', 2]],
    bySprint: [['40', 6, 6], ['41', 8, 6], ['42', 5, 4]],
    customer: 3,
    openList: [
      { key: 'KES-4079', prio: 'Major', age: 42, svc: 'carrier-export', st: 'blocked', title: 'Export stops when a carrier reports the same order number twice' },
      { key: 'KES-4190', prio: 'Major', age: 5, svc: 'checkout-web', st: 'impl', title: 'Checkout shows the old total after a partial cancellation' },
      { key: 'KES-4171', prio: 'Major', age: 12, svc: 'checkout-api', st: 'todo', title: 'A hold is released only 30 minutes after an abandoned checkout' },
      { key: 'KES-3988', prio: 'Minor', age: 63, svc: 'checkout-web', st: 'todo', title: 'Print view of the order confirmation cuts long company names' },
      { key: 'KES-4164', prio: 'Minor', age: 19, svc: 'pricing-engine', st: 'todo', title: 'Price lookup rounds member prices wrong for orders of 40 or more' },
      { key: 'KES-4176', prio: 'Minor', age: 8, svc: 'checkout-web', st: 'todo', title: 'Calendar in the checkout flow does not show the Winter sale' },
      { key: 'KES-4181', prio: 'Minor', age: 7, svc: 'carrier-export', st: 'todo', title: 'Export log names the wrong attempt number on retries' }
    ]
  };

  /* operations */
  D.slos = [
    { id: 'slo-api-avail', svc: 'checkout-api', name: 'Availability of checkout', target: 99.9, actual: 99.93, win: '30 days', budget: '43.2 min', used: 70, left: 30, state: 'watch', note: '26 min went on 12.11 (INC-2291)' },
    { id: 'slo-web-p95', svc: 'checkout-web', name: 'Pages answer within 1.5 s (p95)', target: 99.0, actual: 99.4, win: '30 days', budget: '1 % of windows', used: 60, left: 40, state: 'ok', note: 'slowest window: 12.11 07:45' },
    { id: 'slo-price-avail', svc: 'pricing-engine', name: 'Availability of price lookups', target: 99.5, actual: 99.71, win: '30 days', budget: '3 h 36 min', used: 58, left: 42, state: 'ok', note: 'error rate up since 17.11 21:12' },
    { id: 'slo-export-time', svc: 'carrier-export', name: 'Export finished before 05:00', target: 93.3, actual: 90.0, win: '30 nights', budget: '2 nights', used: 150, left: -50, state: 'bad', note: '3 nights missed: 29.10, 05.11, 17.11' },
    { id: 'slo-notify', svc: 'order-mail', name: 'Messages delivered', target: 99.0, actual: 99.6, win: '30 days', budget: '1 % of messages', used: 40, left: 60, state: 'ok', note: '' }
  ];
  D.incidents = [
    { id: 'INC-2299', at: 'Tue 17.11 02:09', day: '2026-11-17', svc: 'carrier-export', prio: 'P3', dur: '2 h 51 min', state: 'open', title: 'Nightly export to carriers timed out', cause: 'Carrier endpoint did not answer within 30 s; the job gave up at 05:00', conf: 'high', issue: 'KES-4146', report: true },
    { id: 'INC-2291', at: 'Thu 12.11 07:42', day: '2026-11-12', svc: 'checkout-api', prio: 'P2', dur: '26 min', state: 'closed', title: 'Orders not possible in the morning peak', cause: 'Database connections were not released after release 2026.11; the pool ran empty', conf: 'confirmed', issue: 'KES-4188', report: true, change: 'R2026.11' },
    { id: 'INC-2274', at: 'Thu 05.11 02:12', day: '2026-11-05', svc: 'carrier-export', prio: 'P3', dur: '2 h 48 min', state: 'closed', title: 'Nightly export to carriers timed out', cause: 'Carrier endpoint slow; no retry', conf: 'medium', issue: 'KES-4142', report: true },
    { id: 'INC-2262', at: 'Thu 29.10 02:10', day: '2026-10-29', svc: 'carrier-export', prio: 'P3', dur: '2 h 50 min', state: 'closed', title: 'Nightly export to carriers timed out', cause: 'Carrier endpoint slow; no retry', conf: 'medium', issue: 'KES-4142', report: true }
  ];
  D.errors = [
    { id: 'e1', cls: 'PriceFeedClient: 504 from upstream /v3/price-tiers', svc: 'pricing-engine', n24: 268, n7: 268, first: '17.11 21:12', last: '18.11 11:44', st: 'new', issue: null, sp: [0, 0, 0, 0, 0, 96, 172] },
    { id: 'e2', cls: 'CarrierTimeoutException: carrier endpoint did not answer within 30 s', svc: 'carrier-export', n24: 0, n7: 412, first: '02.10 02:14', last: '17.11 04:58', st: 'known', issue: 'KES-4142', sp: [0, 0, 0, 0, 0, 412, 0] },
    { id: 'e3', cls: 'IllegalStateException: total negative after a partial cancellation', svc: 'checkout-api', n24: 6, n7: 37, first: '10.11 14:03', last: '18.11 10:31', st: 'new', issue: 'KES-4190', sp: [4, 7, 5, 3, 8, 4, 6] },
    { id: 'e4', cls: 'HikariPool-1: Connection is not available, request timed out after 30000 ms', svc: 'checkout-api', n24: 0, n7: 1904, first: '12.11 07:41', last: '13.11 14:05', st: 'resolved', issue: 'KES-4188', sp: [1820, 84, 0, 0, 0, 0, 0] },
    { id: 'e5', cls: 'MailDeliveryException: 451 temporary failure', svc: 'order-mail', n24: 3, n7: 22, first: '03.09 09:20', last: '18.11 08:02', st: 'known', issue: null, sp: [2, 4, 3, 5, 2, 3, 3] },
    { id: 'e6', cls: 'NullPointerException in StockMapRenderer.render', svc: 'checkout-web', n24: 1, n7: 9, first: '14.08 11:37', last: '18.11 09:15', st: 'known', issue: 'KES-3988', sp: [1, 2, 1, 1, 2, 1, 1] }
  ];
  D.alerts = [
    { id: 'a1', svc: 'pricing-engine', since: '17.11 21:15', level: 'watch', text: 'Error rate above 1 % for 30 min' },
    { id: 'a2', svc: 'carrier-export', since: '17.11 05:00', level: 'bad', text: 'Export not finished at 05:00' }
  ];
  D.requests = { week: [['Issues handed to the team', 4], ['Mentions in issues of other teams', 6], ['New bugs', 3]], unanswered: 2, duty: { callouts: 6, night: 2 } };

  /* releases and environments */
  D.releases = [
    { id: 'R2026.12', name: 'Release 2026.12', date: 'Thu 03.12.2026', day: '2026-12-03', state: 'planned', freeze: 'Fri 27.11', issues: 31, issuesDone: 19, feats: ['KES-3301', 'KES-3318', 'KES-3325', 'KES-3347'], verdict: 'watch' },
    { id: 'R2026.11.1', name: 'Hotfix 2026.11.1', date: 'Fri 13.11.2026', day: '2026-11-13', state: 'prod', issues: 1, issuesDone: 1, feats: [], verdict: 'ok', note: 'Fix for INC-2291' },
    { id: 'R2026.11', name: 'Release 2026.11', date: 'Tue 10.11.2026', day: '2026-11-10', state: 'prod', issues: 27, issuesDone: 27, feats: [], verdict: 'bad', note: 'Followed by INC-2291 after 2 days' },
    { id: 'R2026.10.2', name: 'Patch 2026.10.2 (carrier-export)', date: 'Fri 30.10.2026', day: '2026-10-30', state: 'prod', issues: 2, issuesDone: 2, feats: [], verdict: 'ok' },
    { id: 'R2026.10', name: 'Release 2026.10', date: 'Thu 08.10.2026', day: '2026-10-08', state: 'prod', issues: 24, issuesDone: 24, feats: [], verdict: 'ok' },
    { id: 'R2026.09', name: 'Release 2026.09', date: 'Thu 10.09.2026', day: '2026-09-10', state: 'prod', issues: 22, issuesDone: 22, feats: [], verdict: 'ok' },
    { id: 'R2026.08', name: 'Release 2026.08', date: 'Thu 13.08.2026', day: '2026-08-13', state: 'prod', issues: 19, issuesDone: 19, feats: [], verdict: 'ok' }
  ];
  D.readiness = [
    { id: 'scope', state: 'bad', text: 'Everything planned for the release is done', v: '19 of 31', sub: '12 issues open, 5 SP of them blocked by ATL-882', src: 'jira' },
    { id: 'blockers', state: 'bad', text: 'No open blocker or critical bug against the release', v: '0 critical, 2 blocked', sub: 'KES-4131 and KES-4079 are blocked', src: 'jira' },
    { id: 'build', state: 'bad', text: 'Main is green in every repository', v: '4 of 5', sub: 'pricing-engine red since 17.11 16:40', src: 'ci' },
    { id: 'regress', state: 'watch', text: 'Nightly regression above 96 % and nothing left to investigate', v: '94.4 %', sub: '5 failures still to investigate', src: 'testrep' },
    { id: 'int', state: 'watch', text: 'Release candidate on INT in every application', v: '4 of 5', sub: 'pricing-engine on INT is still 2026.11.0', src: 'ci' },
    { id: 'smoke', state: 'ok', text: 'Smoke test on INT passed', v: '46 of 46', sub: 'launch smoke-int #221, 17.11 14:35', src: 'testrep' },
    { id: 'notes', state: 'ok', text: 'Release notes page exists and was edited this week', v: 'edited 16.11', sub: 'Release notes 2026.12 (draft)', src: 'wiki' },
    { id: 'slo', state: 'watch', text: 'No service level breached in the last 30 days', v: '1 breached', sub: 'carrier-export: 27 of 30 nights', src: 'mon' }
  ];
  D.envs = ['dev', 'test', 'int', 'prod'];
  D.envMatrix = {
    'checkout-web': ['2026.12.0-rc3', '2026.12.0-rc2', '2026.12.0-rc1', '2026.11.0'],
    'checkout-api': ['2026.12.0-rc4', '2026.12.0-rc3', '2026.12.0-rc1', '2026.11.1'],
    'pricing-engine': ['2026.12.0-rc2', '2026.12.0-rc1', '2026.11.0', '2026.11.0'],
    'carrier-export': ['2026.12.0-rc3', '2026.12.0-rc3', '2026.12.0-rc1', '2026.10.2'],
    'order-mail': ['2026.12.0-rc1', '2026.11.0', '2026.11.0', '2026.11.0']
  };
  D.dora = { deploys30: 3, leadDays: 11, cfr: [1, 6], restore: '26 min' };

  /* knowledge and decisions */
  D.risks = [
    { id: 'R-1', roam: 'Owned', level: 'bad', owner: 'Product owner', review: '20.11', title: 'The price feed v3 arrives too late for the Winter sale on 13.12', links: ['KES-4131', 'KES-3318'], answer: 'Escalated to the train on 16.11; fallback: ship the price tiers as static data for the first two weeks' },
    { id: 'R-2', roam: 'Owned', level: 'bad', owner: 'Scrum master', review: '19.11', title: 'Sprint 42 holds more than the team ever completed in a sprint', links: [], answer: 'Decision D-1 with the product owner on 19.11' },
    { id: 'R-3', roam: 'Accepted', level: 'watch', owner: 'Application manager', review: '03.12', title: 'The export to carriers times out again before the fix is released', links: ['KES-3325', 'INC-2299'], answer: 'Manual restart by the on-call until release 2026.12' },
    { id: 'R-4', roam: 'Owned', level: 'watch', owner: 'Tech lead', review: '24.11', title: 'The database migration is in its third sprint and needs a migration window before the code freeze', links: ['KES-4160'], answer: 'Dry run on INT on 20.11' },
    { id: 'R-5', roam: 'Mitigated', level: 'ok', owner: 'Application manager', review: '30.11', title: 'The certificate of the SMS gateway in the test system expires on 30.11', links: ['KES-4197'], answer: 'New certificate in review' },
    { id: 'R-6', roam: 'New', level: 'watch', owner: 'not set', review: 'not set', title: 'One working day between the sign-off on INT and the code freeze', links: ['R2026.12'], answer: '' }
  ];
  D.riskCandidates = [
    { text: 'KES-4079: blocked for 13 days, in its sprint no. 3', key: 'KES-4079', level: 'bad' },
    { text: 'pricing-engine: main red for 19 hours', key: null, level: 'watch' },
    { text: 'Review wait doubled in week 46: 14 h against 6 h', key: null, level: 'watch' }
  ];
  D.decisions = [
    { id: 'D-1', state: 'waiting', level: 'bad', due: 'Thu 19.11', owner: 'Product owner', title: 'Sprint 42 does not fit: what moves out?', text: 'For an even chance to finish the rest, 11 SP have to move out; to be 85 % sure, 18 SP.', to: '#/delivery/sprint' },
    { id: 'D-2', state: 'waiting', level: 'bad', due: 'Tue 24.11', owner: 'Product owner, application manager', title: 'Release 2026.12 without the school price tiers, or move the release to 08.12?', text: '16 SP of KES-3318 are open, 5 SP of them blocked by another team. The code freeze is on 27.11.', to: '#/release/readiness' },
    { id: 'D-3', state: 'waiting', level: 'watch', due: 'Mon 23.11', owner: 'Application manager', title: 'Take the missed export service level to the risk board of the train?', text: '3 nights missed in 30; the fix is done and waits for release 2026.12.', to: '#/ops/slo' },
    { id: 'ADR-031', state: 'made', on: '03.11', owner: 'Team', title: 'Export retries with a growing delay, at most five attempts', text: 'Wiki: Architecture decisions › ADR-031', to: '#/knowledge/decisions' },
    { id: 'ADR-030', state: 'made', on: '13.11', owner: 'Team', title: 'Connection pool per pod from 20 to 30 after INC-2291', text: 'Wiki: Architecture decisions › ADR-030', to: '#/knowledge/decisions' },
    { id: 'ADR-029', state: 'made', on: '08.10', owner: 'Team', title: 'Migration of the stock hold table in three steps without downtime', text: 'Wiki: Architecture decisions › ADR-029', to: '#/knowledge/decisions' },
    { id: 'WA-4', state: 'made', on: '21.09', owner: 'Team', title: 'At most six items in Implementing', text: 'Working agreement of PI Planning', to: '#/knowledge/agreements' }
  ];
  D.agreements = [
    { id: 'WA-1', text: 'Every pull request gets a first review within one working day', kept: 49, of: 58, unit: 'merged pull requests of 6 weeks', state: 'watch', to: '#/eng/prs' },
    { id: 'WA-4', text: 'At most six items in Implementing', kept: 3, of: 8, unit: 'days of this sprint', state: 'bad', to: '#/delivery/flow' },
    { id: 'WA-2', text: 'Every story has a feature link and an estimate before the sprint starts', kept: 21, of: 21, unit: 'stories of the sprint', state: 'ok', to: '#/delivery/hygiene' },
    { id: 'WA-3', text: 'A bug from production is looked at within one working day', kept: 5, of: 5, unit: 'production bugs of the PI', state: 'ok', to: '#/quality/bugs' },
    { id: 'WA-5', text: 'At most 20 % of the done work is bugs and support', kept: 69, of: 100, unit: '% planned work, PI so far', shown: '31 %', shownSub: 'bugs and support in the done work of the PI', state: 'bad', to: '#/delivery/capacity' }
  ];
  D.actions = [
    { id: 'A-14', from: 'Retro 41', age: 12, text: 'Pair on reviews for the pricing-engine so that two people can approve', state: 'open', owner: 'Tech lead' },
    { id: 'A-13', from: 'Retro 41', age: 12, text: 'Bring the WIP limit back to the Daily board', state: 'open', owner: 'Scrum master' },
    { id: 'A-11', from: 'Retro 40', age: 33, text: 'Agree a date for the price feed v3 with Team Atlas', state: 'open', owner: 'Product owner', old: true },
    { id: 'A-9', from: 'Retro 39', age: 54, text: 'Update the operations manual of the Checkout API', state: 'open', owner: 'Application manager', old: true },
    { id: 'A-15', from: 'Postmortem INC-2291', age: 5, text: 'Alert on database connections above 80 %', state: 'open', owner: 'Application manager', key: 'KES-4193' },
    { id: 'A-12', from: 'Retro 40', age: 33, text: 'Split stories above 5 SP at refinement', state: 'done', owner: 'Team' },
    { id: 'A-10', from: 'Retro 39', age: 54, text: 'Nightly regression report in the team channel', state: 'done', owner: 'Test engineer' }
  ];
  D.docs = [
    { title: 'Operations manual Checkout API', kind: 'Runbook', edited: '14 months ago', state: 'bad', svc: 'checkout-api' },
    { title: 'Operations manual Carrier export', kind: 'Runbook', edited: '3 weeks ago', state: 'ok', svc: 'carrier-export' },
    { title: 'Operations manual Pricing engine', kind: 'Runbook', edited: '7 months ago', state: 'watch', svc: 'pricing-engine' },
    { title: 'Architecture overview Checkout', kind: 'Architecture', edited: '5 months ago', state: 'ok' },
    { title: 'Architecture decisions (ADR-001 to ADR-031)', kind: 'Decisions', edited: '5 days ago', state: 'ok' },
    { title: 'Release notes 2026.12 (draft)', kind: 'Release notes', edited: '2 days ago', state: 'ok' },
    { title: 'Postmortem INC-2291: orders not possible in the morning peak', kind: 'Postmortem', edited: '5 days ago', state: 'ok', svc: 'checkout-api' },
    { title: 'PI Planning PI 26.4: team objectives and risks', kind: 'Planning', edited: '7 weeks ago', state: 'ok' },
    { title: 'Definition of Done', kind: 'Agreement', edited: '8 months ago', state: 'watch' },
    { title: 'Interface description of the carrier export (version 4)', kind: 'Interface', edited: '11 months ago', state: 'watch', svc: 'carrier-export' }
  ];

  /* business signals from saved searches (Log search is stale in this data set) */
  D.business = [
    { id: 'b1', name: 'Bulk orders per day', v: 184, prev: 171, unit: 'yesterday', spark: [162, 170, 158, 176, 181, 190, 184] },
    { id: 'b2', name: 'Online cancellations per day', v: 23, prev: 19, unit: 'yesterday', spark: [17, 19, 22, 20, 24, 25, 23] },
    { id: 'b3', name: 'Drop-off rate in the checkout flow', v: 31, prev: 29, unit: '% of started bookings, yesterday', spark: [29, 28, 30, 33, 34, 31, 31] },
    { id: 'b4', name: 'Price lookups per day', v: 41200, prev: 39800, unit: 'yesterday', spark: [38900, 39400, 40100, 39800, 41000, 42300, 41200] },
    { id: 'b5', name: 'Orders exported per night', v: 3870, prev: 3790, unit: 'last night', spark: [3810, 3650, 3900, 3840, 3920, 0, 3870] }
  ];

  /* notices and drafts of the inbox */
  D.notices = [
    { at: '11:40', level: 'watch', text: 'pricing-engine: error group new since 17.11 21:12, 268 events in 24 h', to: '#/ops/errors' },
    { at: '09:15', level: 'bad', text: 'Decision D-1 is due tomorrow: sprint 42 does not fit', to: '#/knowledge/decisions' },
    { at: '08:02', level: 'ok', text: 'KES-4188 done: fix for INC-2291 is in production since 13.11', to: '#/issue/KES-4188' },
    { at: 'Tue 17:02', level: 'bad', text: 'pricing-engine: main red, contract test against the price feed v3', to: '#/eng/builds' },
    { at: 'Tue 05:00', level: 'bad', text: 'INC-2299: nightly export timed out, third time in 30 nights', to: '#/incident/INC-2299' },
    { at: 'Mon 16:20', level: 'watch', text: 'KES-4197 added to the sprint after the start', to: '#/issue/KES-4197' }
  ];

  /* role lenses */
  D.roles = [
    { id: 'sm', code: 'SM', short: 'Scrum Master', name: 'Scrum Master', asks: 'Will the sprint hold, what is stuck, what do we talk about today?' },
    { id: 'tl', code: 'TL', short: 'Tech Lead', name: 'Tech Lead', asks: 'Where does code wait, what is red, where does quality slip?' },
    { id: 'am', code: 'AM', short: 'App Manager', name: 'Application Manager', asks: 'Are the applications healthy, what changed, is the release ready?' },
    { id: 'lead', code: 'Lead', short: 'Team Lead', name: 'Team Lead', asks: 'Does the load fit the team, where does the time go, what did we agree?' },
    { id: 'po', code: 'PO', short: 'Product Owner', name: 'Product Owner', asks: 'What will we deliver, what slips, what do I have to decide?' }
  ];

  /* evidence behind headline numbers: definition, query, rows. Pages point here with a fact id. */
  D.facts = {
    'sprint.committed_sp': { say: 'committed at the start: 63 SP in 22 items', def: 'Story points of the items in the sprint at the moment Start was pressed, with the points they had at that moment. Sub-tasks are left out. Same rule as Jira\'s sprint report.', src: 'jira', q: 'GET /rest/agile/1.0/board/7/sprint/90123/issue?expand=changelog', rows: 26, v: 'definition 3 of 14.11.2026' },
    'sprint.done_sp': { say: 'done: 25 SP in 8 items', def: 'Items whose status lies in the last column of the board (Done). Rejected counts as closed, not as done.', src: 'jira', q: 'status in (Done) AND sprint = 90123', rows: 8, v: 'definition 2 of 14.11.2026' },
    'sprint.open_sp': { say: 'not done yet: 40 SP in 17 items', def: 'Scope now minus done. 3 open items have no story points and add nothing to the 40.', src: 'jira', q: 'sprint = 90123 AND statusCategory != Done', rows: 17, v: 'definition 2 of 14.11.2026' },
    'forecast.chance_all': { say: 'chance to finish everything that is open: 9 %', def: 'Monte Carlo over the story points the team finished per working day in its last 75 working days, 10 000 runs for the 7 working days left. Items without points are invisible to it.', src: 'jira', q: 'computed from 5 closed sprints of board 7', rows: 75, v: 'forecast 4 of 14.11.2026' },
    'forecast.p85': { say: 'done by the end, 85 % sure: at least 47 SP', def: 'The 15th percentile of the simulated totals. Checked against past sprints: the line held in 5 of 6 look-backs.', src: 'jira', q: 'computed from 5 closed sprints of board 7', rows: 75, v: 'forecast 4 of 14.11.2026' },
    'flow.p85': { say: '85 % of finished items took at most 11.2 days', def: 'Days from the first status past the first board column to Done, for the 96 items finished in the last 12 weeks.', src: 'jira', q: 'resolved >= -12w AND filter = 7', rows: 96, v: 'definition 1 of 14.11.2026' },
    'pr.first_review': { say: 'first review after 6 h, half of them', def: 'Hours from opening a pull request to the first review event of somebody else, weekends left out. Median of the 58 pull requests merged in the last 6 weeks.', src: 'git', q: 'GET /rest/api/1.0/projects/SHOP/repos/*/pull-requests?state=MERGED', rows: 58, v: 'definition 2 of 14.11.2026' },
    'build.green': { say: 'main green in 212 of 233 runs', def: 'Runs of the main pipelines of the five repositories in the last 30 days that ended with success. Aborted runs are left out.', src: 'ci', q: 'GET /job/SHOP/job/*/job/main/api/json?tree=builds[result,duration,timestamp]', rows: 233, v: 'definition 1 of 16.11.2026' },
    'test.pass_rate': { say: 'nightly regression: 389 of 412 passed (94.4 %)', def: 'Passed test items of the last launch of regression-nightly against all its items; skipped items count as not passed.', src: 'testrep', q: 'GET /api/v1/kestrel/launch?filter.eq.name=regression-nightly&page.sort=startTime,desc', rows: 412, v: 'definition 1 of 16.11.2026' },
    'bugs.open': { say: 'open bugs of the team: 7', def: 'Issues of type Bug in the board filter that are not resolved, whatever their age. 4 were open before the PI, 19 were written in it, 16 resolved.', src: 'jira', q: 'filter = 7 AND type = Bug AND resolution = Unresolved', rows: 7, v: 'definition 2 of 17.11.2026' },
    'slo.res.budget': { say: 'error budget left for orders: 30 %', def: 'Target 99.9 % over 30 days allows 43.2 minutes of failed minutes. 30.2 minutes are used.', src: 'mon', q: 'FROM ServiceLevel SELECT ... WHERE sli.guid = \'…res-avail\' SINCE 30 days ago', rows: 43200, v: 'as defined in monitoring' },
    'dora.cfr': { say: 'changes that needed a fix: 1 of the last 6 production deployments', def: 'Of the last six production deployments (13.08 to 13.11), those that were followed within 7 days by an incident of P2 or higher on the same application.', src: 'ci', q: 'deployments to prod joined with incidents by application and time', rows: 6, v: 'definition 1 of 16.11.2026' },
    'mix.unplanned': { say: 'bugs and support: 31 % of the work done in the PI', def: 'Story points done in the PI so far (126) by kind of work. Bugs and incidents 22, support and maintenance 17.', src: 'jira', q: 'resolved in PI 26.4 AND filter = 7, grouped by rule', rows: 67, v: 'rule set 2 of 16.11.2026' },
    'capacity.avail': { say: 'available this sprint: 86 of 105 person-days', def: 'Planned days of the 7 people who deliver, minus 14 days of absence and 5 days of on-call duty. Typed in at sprint planning as team totals; no person is listed.', src: 'wiki', q: 'page "Sprint 42 planning" › table Capacity', rows: 1, v: 'typed in by the team' }
  };

  /* self-check: this demo's numbers must add up */
  (function check() {
    var S = D.sprint, by = function (f) { return D.issues.filter(f); }, sp = function (a) { return a.reduce(function (s, i) { return s + (i.sp || 0); }, 0); };
    var done = by(function (i) { return i.st === 'done'; }), open = by(function (i) { return i.st !== 'done'; }), added = by(function (i) { return i.added; });
    var want = [
      [D.issues.length, S.scopeItems, 'scope items'], [sp(D.issues), S.scopeSp, 'scope SP'], [done.length, S.doneItems, 'done items'], [sp(done), S.doneSp, 'done SP'],
      [open.length, S.openItems, 'open items'], [sp(open), S.openSp, 'open SP'], [added.length, S.addedItems, 'added items'], [sp(added), S.addedSp, 'added SP'],
      [S.committedSp + S.addedSp - S.removedSp, S.scopeSp, 'committed + added - removed'], [open.filter(function (i) { return i.sp == null; }).length, S.noSp, 'open without SP'],
      [D.workmix.reduce(function (s, w) { return s + w.sp; }, 0), 52 + 49 + 25, 'work mix'], [D.bugs.openBefore + D.bugs.written - D.bugs.resolved, D.bugs.open, 'bugs'],
      [D.bugs.openList.length, D.bugs.open, 'open bug list'], [D.features.reduce(function (s, f) { return s + f.left; }, 0), sp(open.filter(function (i) { return i.feat; })), 'feature SP left in the sprint']
    ];
    D.features.forEach(function (f) { want.push([f.done + f.left + f.later, f.sp, 'feature ' + f.key]); });
    want.forEach(function (w) { if (w[0] !== w[1]) console.error('data.js does not add up: ' + w[2] + ' ' + w[0] + ' != ' + w[1]); });
  })();

  window.D = D;
})();
