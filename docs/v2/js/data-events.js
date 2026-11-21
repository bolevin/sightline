/* The event log of the invented team, and the history behind the sprint numbers.
   An event is written when the state of a fact changes: something went off track, came back, came in, got done, was released.
   One log feeds the notices of the Inbox, the summary of a date comparison on every page, "what moved" and the weekly digest.
   kind: worse | better | in | done | change | info.   dom: the domain whose page is the home of the fact. */
(function () {
  'use strict';
  const D = window.D;
  const E = (d, t, dom, kind, tone, text, obj, to) => ({ d: d, t: t, dom: dom, kind: kind, tone: tone, text: text, obj: obj || null, to: to || null });
  D.events = [
    E('2026-09-28', '09:00', 'product', 'info', '', 'PI 26.4 started: five committed objectives, 37 planned BV', null, '#/product/objectives'),
    E('2026-09-28', '10:30', 'delivery', 'info', '', 'Sprint 40 started: 56 SP committed', null, '#/delivery/sprint'),
    E('2026-10-08', '06:40', 'release', 'change', 'ok', 'Release 2026.10 went to production', 'R2026.10', '#/release/R2026.10'),
    E('2026-10-16', '16:00', 'delivery', 'done', 'ok', 'Sprint 40 closed: 52 of 56 SP done, the promise was kept', null, '#/delivery/sprint'),
    E('2026-10-19', '10:15', 'delivery', 'info', '', 'Sprint 41 started: 58 SP committed', null, '#/delivery/sprint'),
    E('2026-10-29', '02:10', 'ops', 'worse', 'bad', 'INC-2262 opened: the nightly export timed out', 'INC-2262', '#/incident/INC-2262'),
    E('2026-10-30', '14:05', 'release', 'change', 'ok', 'Patch 2026.10.2 of carrier-export went to production', 'R2026.10.2', '#/release/R2026.10.2'),
    E('2026-11-03', '11:20', 'knowledge', 'info', '', 'ADR-031 decided: export retries with a growing delay', null, '#/knowledge/decisions'),
    E('2026-11-05', '02:12', 'ops', 'worse', 'bad', 'INC-2274 opened: the nightly export timed out, second time in 30 nights', 'INC-2274', '#/incident/INC-2274'),
    E('2026-11-05', '15:30', 'product', 'worse', 'watch', 'Objective 3 went from on track to at risk: Price feed v3 has no date', 'KES-3318', '#/product/objectives'),
    E('2026-11-06', '16:00', 'delivery', 'done', 'watch', 'Sprint 41 closed: 49 of 58 SP done', null, '#/delivery/sprint'),
    E('2026-11-09', '10:10', 'delivery', 'info', '', 'Sprint 42 started: 63 SP committed in 22 items', null, '#/delivery/sprint'),
    E('2026-11-09', '14:20', 'delivery', 'worse', 'bad', 'KES-4131 moved to Blocked: waits for ATL-882 of Team Atlas', 'KES-4131', '#/issue/KES-4131'),
    E('2026-11-10', '06:45', 'release', 'change', 'ok', 'Release 2026.11 went to production', 'R2026.11', '#/release/R2026.11'),
    E('2026-11-10', '14:03', 'ops', 'worse', 'watch', 'New error group in checkout-api: total negative after a partial cancellation', null, '#/ops/errors'),
    E('2026-11-11', '09:40', 'delivery', 'change', '', 'KES-4155 taken out of the sprint: 3 SP moved to 43', 'KES-4155', '#/issue/KES-4155'),
    E('2026-11-12', '07:42', 'ops', 'worse', 'bad', 'INC-2291 opened: orders not possible in the morning peak', 'INC-2291', '#/incident/INC-2291'),
    E('2026-11-12', '08:08', 'ops', 'better', 'ok', 'INC-2291 restored after 26 minutes', 'INC-2291', '#/incident/INC-2291'),
    E('2026-11-12', '08:10', 'ops', 'worse', 'watch', 'Service level of orders: error budget from 90 % to 30 % left', null, '#/ops/slo'),
    E('2026-11-12', '10:25', 'delivery', 'in', 'watch', 'KES-4188 came into the sprint after the start: 2 SP', 'KES-4188', '#/issue/KES-4188'),
    E('2026-11-13', '10:00', 'knowledge', 'info', '', 'ADR-030 decided: connection pool per pod from 20 to 30', null, '#/knowledge/decisions'),
    E('2026-11-13', '11:15', 'delivery', 'in', 'watch', 'KES-4190 and KES-4193 came into the sprint after the start', 'KES-4190', '#/delivery/sprint'),
    E('2026-11-13', '14:20', 'release', 'change', 'ok', 'Hotfix 2026.11.1 went to production', 'R2026.11.1', '#/release/R2026.11.1'),
    E('2026-11-13', '15:10', 'product', 'worse', 'bad', 'Objective 3 went from at risk to off track: 16 of 24 SP open, 5 blocked', 'KES-3318', '#/product/objectives'),
    E('2026-11-13', '16:30', 'eng', 'worse', 'watch', 'Week 46 closed with a first review after 14 h, against 6 h usually', null, '#/eng/prs'),
    E('2026-11-16', '09:05', 'knowledge', 'change', '', 'Risk R-1 escalated to the train', null, '#/knowledge/risks'),
    E('2026-11-16', '16:20', 'delivery', 'in', 'watch', 'KES-4197 came into the sprint after the start', 'KES-4197', '#/issue/KES-4197'),
    E('2026-11-16', '17:30', 'delivery', 'worse', 'watch', 'Seven items in progress: over the limit of six for the fifth day', null, '#/delivery/flow'),
    E('2026-11-17', '02:09', 'ops', 'worse', 'bad', 'INC-2299 opened: the nightly export timed out, third time in 30 nights', 'INC-2299', '#/incident/INC-2299'),
    E('2026-11-17', '05:00', 'ops', 'worse', 'bad', 'Service level of the export missed: 27 of 30 nights', null, '#/ops/slo'),
    E('2026-11-17', '14:35', 'quality', 'better', 'ok', 'Smoke test on INT passed 46 of 46 after the release candidate', null, '#/quality/tests'),
    E('2026-11-17', '16:40', 'eng', 'worse', 'bad', 'pricing-engine: main turned red, contract test against the price feed v3', null, '#/eng/builds'),
    E('2026-11-17', '17:02', 'quality', 'worse', 'watch', 'Contract tests: 316 of 318, both failures in pricing-engine', null, '#/quality/tests'),
    E('2026-11-17', '21:12', 'ops', 'worse', 'watch', 'New error group in pricing-engine: 504 from upstream /v3/price-tiers', null, '#/ops/errors'),
    E('2026-11-17', '21:15', 'ops', 'worse', 'watch', 'Alert opened on pricing-engine: error rate above 1 %', null, '#/ops/errors'),
    E('2026-11-18', '01:30', 'quality', 'better', 'watch', 'Nightly regression back to 94.4 % from 91.5 %; 5 failures to investigate', null, '#/quality/tests'),
    E('2026-11-18', '03:47', 'ops', 'better', 'ok', 'The nightly export finished before 05:00', null, '#/service/carrier-export'),
    E('2026-11-18', '08:02', 'delivery', 'done', 'ok', 'KES-4188 closed after the check in production', 'KES-4188', '#/issue/KES-4188'),
    E('2026-11-18', '08:40', 'delivery', 'done', 'ok', 'KES-4142 done: 3 SP', 'KES-4142', '#/issue/KES-4142'),
    E('2026-11-18', '09:15', 'knowledge', 'worse', 'bad', 'Decision D-1 is due tomorrow: the sprint does not fit', null, '#/knowledge/decisions'),
    E('2026-11-18', '11:40', 'ops', 'worse', 'watch', 'The new error group of pricing-engine keeps growing: 268 events in 24 h', null, '#/ops/errors')
  ];

  /* one snapshot of the facts per working day. For the numbers of the running sprint the history is exact:
     done and scope per day come from the burn-up, blocked and in progress from the cumulative flow. */
  D.snapDays = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'];
  D.sprintHist = {
    days: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'],
    chance: [34, 30, 27, 22, 19, 15, 12, 9], p85: [50, 50, 49, 48, 48, 47, 47, 47]
  };
})();
