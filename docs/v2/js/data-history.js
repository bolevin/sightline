/* What came back from the first version needs a longer past than data.js holds: the statistics by PI, bugs by sprint and feature, the forecast record. All invented; a self-check at the end
   ties every total to the numbers of data.js. */
(function () {
  'use strict';
  const D = window.D;

  /* capacity: planned person-days, avail: available for sprint work. paceDone and paceDays: closed sprints only.
     tasks and the priorities are the columns of the page "PI extended statistics". */
  D.piStats = [
    { pi: 'PI 26.1', capacity: 362, avail: 330, committed: 190, completed: 158, paceDone: 158, paceDays: 330, closedCommitted: 190, bvPlanned: 38, bvActual: 31, created: 17, fixed: 18, tasks: 9, blocker: 0, critical: 2, major: 8, minor: 7, vote: 7.2, note: 'The order rewrite took one sprint longer than planned' },
    { pi: 'PI 26.2', capacity: 370, avail: 318, committed: 196, completed: 150, paceDone: 150, paceDays: 318, closedCommitted: 196, bvPlanned: 34, bvActual: 26, created: 22, fixed: 20, tasks: 12, blocker: 1, critical: 4, major: 9, minor: 8, vote: 6.4, note: 'Two incidents in the summer peak' },
    { pi: 'PI 26.3', capacity: 365, avail: 322, committed: 182, completed: 161, paceDone: 161, paceDays: 322, closedCommitted: 182, bvPlanned: 36, bvActual: 32, created: 14, fixed: 17, tasks: 7, blocker: 0, critical: 2, major: 6, minor: 6, vote: 7.9, note: 'Sprint 38 missed its promise' },
    { pi: 'PI 26.4', running: true, capacity: 385, avail: 332, committed: 177, completed: 126, paceDone: 101, paceDays: 192, closedCommitted: 114, bvPlanned: 37, bvActual: null, created: 19, fixed: 16, tasks: 11, blocker: 1, critical: 3, major: 8, minor: 7, vote: 6.8, note: 'Running: three of four sprints counted, the third so far' }
  ];

  /* bugs written and resolved per full sprint; the last row is the running sprint */
  D.bugHist = [['33', 7, 6], ['34', 8, 7], ['36', 5, 6], ['37', 4, 5], ['38', 3, 4], ['40', 6, 6], ['41', 8, 6], ['42', 5, 4]];

  /* the bugs written in the last two PIs, by feature and by how they ended: fixed + dup + nr + wont + open = bugs */
  D.bugFeatures = [
    { f: 'KES-3301', bugs: 8, back: 0, fixed: 6, dup: 1, nr: 0, wont: 0, open: 1 },
    { f: 'KES-3312', bugs: 7, back: 1, fixed: 5, dup: 0, nr: 1, wont: 0, open: 1 },
    { f: 'KES-3325', bugs: 6, back: 0, fixed: 4, dup: 0, nr: 0, wont: 0, open: 2 },
    { f: 'KES-3318', bugs: 3, back: 0, fixed: 2, dup: 0, nr: 0, wont: 0, open: 1 },
    { f: null, bugs: 9, back: 0, fixed: 6, dup: 0, nr: 0, wont: 1, open: 2 }
  ];

  /* the forecast as the app showed it each morning, settled when the sprint closed */
  D.forecastRecord = [
    { sprint: '40', mornings: 15, low: 44, high: 49, ended: 52, held: 15 },
    { sprint: '41', mornings: 15, low: 45, high: 50, ended: 49, held: 14 },
    { sprint: '42', mornings: D.sprintHist.p85.length, low: Math.min.apply(null, D.sprintHist.p85), high: Math.max.apply(null, D.sprintHist.p85), ended: null, held: null }
  ];

  /* pull requests of the last six weeks with the longest conversation */
  D.discussed = [
    { id: 398, repo: 'checkout-api', issue: 'KES-4103', st: 'merged', comments: 14, rounds: 3 },
    { id: 226, repo: 'checkout-web', issue: 'KES-4102', st: 'merged', comments: 11, rounds: 2 }
  ].concat(D.prs.slice().sort((a, b) => b.comments - a.comments).slice(0, 3).map(p => ({ id: p.id, repo: p.repo, issue: p.issue, st: p.st, comments: p.comments, rounds: p.rounds, open: true })));

  /* code keeps watching what made a risk a risk, and says when it is gone */
  D.riskSignals = {
    'R-1': ['there', 'KES-4131 blocked for 9 days'], 'R-2': ['there', 'chance to finish 9 %'], 'R-3': ['there', 'last missed on 17.11'],
    'R-4': ['there', 'KES-4160 in Implementing for 24 days'], 'R-5': ['gone', 'gone since 16.11: KES-4197 now covers it'], 'R-6': ['none', 'a date, no signal to watch']
  };

  /* self-check: the past must add up to what data.js says */
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0), v = D.velocity, st = D.piStats, last = st[3], prev = st[2];
  const fail = m => console.error('data-history: ' + m);
  if (prev.committed !== sum(v.slice(0, 4), x => x.committed) || prev.completed !== sum(v.slice(0, 4), x => x.done)) fail('PI 26.3 is not the sum of its sprints');
  if (last.committed !== 56 + 58 + D.sprint.committedSp || last.completed !== 52 + 49 + D.sprint.doneSp) fail('PI 26.4 is not the sum of its sprints');
  if (last.capacity !== sum(D.capacity, c => c.planned) || last.avail !== sum(D.capacity, c => c.avail)) fail('the capacity of PI 26.4 does not match');
  if (last.created !== D.bugs.written || last.fixed !== D.bugs.resolved) fail('the bugs of PI 26.4 do not match');
  st.forEach((r, i) => { if (r.blocker + r.critical + r.major + r.minor !== r.created) fail(r.pi + ': the priorities do not add up'); if (r.bvPlanned !== (D.predictability[i] || { planned: 37 }).planned) fail(r.pi + ': planned BV differs'); });
  D.bugFeatures.forEach(b => { if (b.fixed + b.dup + b.nr + b.wont + b.open !== b.bugs) fail('bugs of ' + b.f + ' do not add up'); });
  if (sum(D.bugFeatures, b => b.bugs) !== prev.created + last.created) fail('the features do not hold the bugs of two PIs');
  if (sum(D.bugFeatures, b => b.open) !== D.bugs.open) fail('open bugs by feature differ');
  if (D.bugHist.slice(-3).some((r, i) => r[1] !== D.bugs.bySprint[i][1] || r[2] !== D.bugs.bySprint[i][2])) fail('the last three sprints of the bug history differ');
})();
