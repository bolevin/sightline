/* Worst-case data for the densest page (Delivery › Sprint), in the manner of the break-ui skill:
   the data changes, the components do not. Every value is something Jira can really hold:
   a 255-character summary, a one-word summary, a word that cannot break, umlauts, arrows, emoji and CJK,
   an item with no points, no feature and no application, 100 points, 412 days in a status, sprint no. 11,
   a long project key, an empty column, 30 items in one column, a sprint of 1,284 points with nothing done.
   Switch it on under System › Panel states, or with SM.worst(true) in the console. It never ships. */
(function () {
  'use strict';
  const D = window.D, SM = window.SM;
  let keep = null;
  const LONG = 'Bulk orders from 10 units: show stock holds per warehouse, release part of them and move them to another warehouse when stock runs out, with a message to the customer, a log of every change and a refund when delivery fails';
  const titles = [
    LONG, 'Fix', 'Supercalifragilisticexpialidocious-export_v3.2.1-SNAPSHOT/carrier-endpoint/timeout-handling',
    'Crème brûlée → Señor Piñata: price shown wrong «sale» 🛒 (日本語 UI, Ελληνικά)', 'TODO', 'Oversize check for bikes & prams <script>alert(1)</script>',
    'a', 'Stock hold table: move the data to the new schema (migration in three steps, step 2 of 3, second try after a rollback)'
  ];
  function build() {
    const out = [];
    for (let n = 0; n < 38; n++) {
      const st = n < 30 ? 'impl' : n < 34 ? 'blocked' : n < 37 ? 'review' : 'approve';   // To do and Done stay empty
      out.push({
        key: n === 2 ? 'KESBUGEXT-104233' : 'KES-' + (41000 + n * 37), type: n % 9 === 0 ? 'Bug' : n % 11 === 0 ? 'Task' : 'Story',
        sp: n === 0 ? 100 : n % 4 === 1 ? null : n === 5 ? 0.5 : [1, 2, 3, 5, 8, 13, 40][n % 7], st: st,
        feat: n % 5 === 0 ? null : 'KES-3301', svc: n % 6 === 0 ? '' : D.services[n % 5].id, dis: n === 0 ? 412 : n === 1 ? 0 : (n * 7) % 60,
        n: n === 0 ? 11 : 1 + (n % 4), added: n % 3 === 0 ? '2026-11-12' : undefined, pr: n === 3 ? 412 : undefined,
        blockedBy: st === 'blocked' ? 'SHOPPLATFORM-9912' : undefined, title: titles[n % titles.length]
      });
    }
    return out;
  }
  SM.worst = function (on) {
    if (on && !keep) {
      keep = { issues: D.issues.slice(), sprint: JSON.parse(JSON.stringify(D.sprint)) };
      D.issues.splice(0, D.issues.length, ...build());
      const sp = D.issues.reduce((s, i) => s + (i.sp || 0), 0);
      Object.assign(D.sprint, { committedItems: 1, committedSp: 1284, addedItems: 13, addedSp: 0, removedItems: 0, removedSp: 0, scopeItems: 38, scopeSp: 1284, doneItems: 0, doneSp: 0,
        openItems: 38, openSp: 1284, noSp: 10, burn: [0, 0, 0, 0, 0, 0, 0, 0, 0], scope: [3, 3, 640, 640, 1284, 1284, 1284, 1284, 1284] });
      Object.assign(D.sprint.forecast, { p85: 0, p50: 0, all: 0, over50: 1284, over85: 1284 });
      D.sprint.options.forEach(o => { o.moves = o.id === 'keep' ? [] : D.issues.slice(0, o.id === 'both' ? 38 : 12).map(i => i.key); o.sp = o.id === 'keep' ? 0 : sp; o.chance = o.id === 'both' ? 100 : 0; });
    } else if (!on && keep) {
      D.issues.splice(0, D.issues.length, ...keep.issues);
      Object.keys(keep.sprint).forEach(k => { D.sprint[k] = keep.sprint[k]; });
      keep = null;
    }
    SM.isWorst = !!keep;
    SM.render();
  };
  SM.acts = SM.acts || {};
  SM.acts.worst = () => { SM.worst(!SM.isWorst); if (SM.isWorst) SM.go('#/delivery/sprint'); };
})();
