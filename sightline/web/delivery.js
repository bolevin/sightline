/* Sightline: builds and deploys, at the foot of the Code tab. What the build server says about how the team ships:
   the four measures of the DORA research and what stands behind them. Everything is drawn from state.views.delivery,
   which the server computes (sightline/delivery.py). What comes from the data goes through esc().

   Colour has one meaning each: green is a deploy that held, red one that had to be repaired and a red main, grey a
   rollback; amber is time spent waiting. */
"use strict";
const D_KINDS = [["release", "releases"], ["hotfix", "hotfixes"], ["rollback", "rollbacks"]];
const dCount = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const dKinds = m => D_KINDS.map(([one, many]) => dCount(m[many], one, many)).join(", ");
const dRepo = name => String(name).split("/").pop();
const dTime = iso => Date.parse(iso);

function dTiles(v){
  const now = v.last, was = v.before, w = v.waiting;
  const tile = (label, value, unit, delta, note, facts) => `<button class="kpi" type="button" data-facts="${facts}"><span class="lbl">${label}</span>
    <span class="v">${esc(num(value))}<small>${unit}</small></span><span class="d">${delta}${delta && note ? " · " : ""}${note}</span></button>`;
  return `<div class="kpis">` +
    tile("Deploys to production", now.deploys, `in ${esc(v.weeks_window)} weeks`, moved(now.deploys, was.deploys, 0, ""), esc(dKinds(now)), "delivery.deploys_n|delivery.deploys_before_n|delivery.per_week") +
    tile("Lead time for changes", now.lead_p50, "days, half of them", moved(now.lead_p50, was.lead_p50, LOWER, " d"), `85 % within ${esc(num(now.lead_p85))} d`,
      "delivery.lead_p50_days|delivery.lead_p85_days|delivery.lead_before_p50_days") +
    tile("Failed deploys", now.failed_pct, "%", moved(now.failed_pct, was.failed_pct, LOWER, " points"), `${esc(now.failed)} of ${esc(now.can_fail)} had to be repaired`,
      "delivery.failed_pct|delivery.failed_n|delivery.failed_before_pct") +
    tile("Time to restore", now.restore_p50, "h, the middle one", moved(now.restore_p50, was.restore_p50, LOWER, " h"), `over ${esc(dCount(now.failed, "failed deploy", "failed deploys"))}`,
      "delivery.restore_p50_hours|delivery.restore_before_p50_hours") +
    tile("Main was red", now.red_pct, "% of the hours", moved(now.red_pct, was.red_pct, LOWER, " points"), `longest ${esc(num(now.red_longest_h))} h in one go`,
      "delivery.red_pct|delivery.red_before_pct|delivery.red_longest_hours") +
    tile("Not in production yet", w.n, "changes", "", w.oldest_days != null ? `the oldest merged ${esc(w.oldest_days)} days ago` : "", "delivery.waiting_n" + (w.cut ? "|delivery.testing_n" : "")) + `</div>`;
}

/* Where the lead time goes: the build of main, the wait for a release cut or a hotfix, release testing. */
function dLead(v){
  const row = (label, m) => { const s = m.share;
    return `<div class="d-row"><span class="small">${label}</span><div class="split">${[["build", "var(--info)"], ["wait", "var(--warn)"], ["testing", "var(--accent)"]].map(([part, colour]) =>
      `<i style="width:${esc(s[part] || 0)}%;background:${colour}" title="${esc(s[part] ?? 0)} %"></i>`).join("")}</div>
      <span class="q-num"><b>${esc(num(m.lead_p50))} d</b> for half of ${esc(dCount(m.changes, "change", "changes"))}</span></div>`; };
  const now = v.last;
  return `<div class="d-rows">${row(`Last ${esc(v.weeks_window)} weeks`, now)}${row(`The ${esc(v.weeks_window)} before`, v.before)}</div>
    <div class="legend"><span><i style="background:var(--info)"></i>merge to a build of main that passed: ${esc(now.share.build)} % · half within ${esc(num(now.build_h_p50))} h</span>
      <span><i style="background:var(--warn)"></i>waiting for a release cut or a hotfix: ${esc(now.share.wait)} % · half ${esc(num(now.wait_d_p50))} d</span>
      <span><i style="background:var(--accent)"></i>release testing, cut to production: ${esc(now.share.testing)} % · half ${esc(num(now.testing_d_p50))} d</span></div>`;
}

/* Every deploy on a time line: the higher, the more changes it carried. A red one had to be repaired; the dashed
   line leads to its repair. */
function dDeploys(v){
  const w = chartW(), h = 240, x0 = 34, x1 = w - 14, y0 = 30, y1 = h - 28, t0 = dTime(v.from), t1 = dTime(v.now);
  const log = [...v.deploys].reverse(), top = Math.max(1, ...log.map(d => d.changes)) * 1.15;
  const x = t => x0 + (x1 - x0) * (t - t0) / (t1 - t0), y = c => y0 + (y1 - y0) * (1 - c / top);
  const find = r => log.find(d => d.version === r.version && d.kind === r.kind && dTime(d.at) >= dTime(r.at) - 1);
  let g = qAxis(top / 1.15, x0, x1, y, "");
  [[v.before_start, `the ${v.weeks_window} weeks before`], [v.start, `the last ${v.weeks_window} weeks`]].forEach(([at, name]) => {
    const p = x(dTime(at)); if (p > x0) g += `<line class="d-win" x1="${p}" x2="${p}" y1="${y0 - 16}" y2="${y1}"/>`;
    g += `<text class="ax" x="${Math.max(p, x0) + 5}" y="${y0 - 18}">${esc(name)}</text>`; });
  const first = new Date(t0);
  for (let m = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)); m.getTime() < t1; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))
    g += `<text class="ax" x="${x(m.getTime())}" y="${h - 8}" text-anchor="middle">${m.toLocaleString("en", {month: "short", timeZone: "UTC"})}</text>`;
  if (v.waiting.cut){ const p = x(dTime(v.waiting.cut.at));
    g += `<line class="d-win" x1="${p}" x2="${p}" y1="${y0}" y2="${y1}"/>${PHONE.matches ? "" : `<text class="ax" x="${p - 9}" y="${y(v.waiting.cut.changes) + 4}" text-anchor="end">${esc(v.waiting.cut.version.replace(/\.0$/, ""))} cut</text>`}<circle class="d-cut" cx="${p}" cy="${y(v.waiting.cut.changes)}" r="6"><title>${esc(v.waiting.cut.version)} · cut ${esc(when(v.waiting.cut.at))} · ${esc(v.waiting.cut.changes)} changes, not deployed yet</title></circle>`; }
  log.filter(d => d.failed).forEach(d => { const r = find(d.repair);
    if (r) g += `<path class="d-fix" d="M${x(dTime(d.at)).toFixed(1)} ${y(d.changes).toFixed(1)}L${x(dTime(r.at)).toFixed(1)} ${y(r.changes).toFixed(1)}"/>`; });
  log.forEach(d => { const cx = x(dTime(d.at)).toFixed(1), cy = y(d.changes).toFixed(1), tone = d.kind === "rollback" ? "back" : d.failed ? "bad" : "ok";
    const said = `${d.version} · ${d.kind} · ${when(d.at)} · ${dCount(d.changes, "change", "changes")}` + (d.repair ? ` · repaired by ${d.repair.kind === "rollback" ? "a rollback" : d.repair.version} after ${d.repair.hours} h` : "");
    g += d.kind === "rollback" ? `<path class="d-back" d="M${cx - 5} ${cy - 9}h10l-5 8z"><title>${esc(said)}</title></path>`
      : `<circle class="d-${tone}" cx="${cx}" cy="${cy}" r="${d.kind === "release" ? 7 : 4.5}"><title>${esc(said)}</title></circle>` +
        (d.kind === "release" ? `<text class="ax" x="${cx}" y="${cy - 12}" text-anchor="middle">${esc(d.version.replace(/\.0$/, ""))}</text>` : ""); });
  return frame(w, h, g, "Production deploys over time, by the changes each one carried");
}

/* Main, week by week: the hours without weekends in which a build of main was red, by repository. */
function dRed(v){
  const weeks = v.weeks, n = weeks.length, w = chartW(), h = 210, x0 = 34, x1 = w - 12, y0 = 22, y1 = h - 28, repos = v.repos;
  const sum = k => repos.reduce((s, r) => s + (k.red_h[r] || 0), 0), top = Math.max(4, ...weeks.map(sum)) * 1.15;
  const step = (x1 - x0) / n, bar = Math.min(16, step * .7), y = val => y0 + (y1 - y0) * (1 - val / top);
  let g = qAxis(top / 1.15, x0, x1, y, " h");
  const at = weeks.findIndex(k => k.from >= v.start.slice(0, 10));
  if (at > 0) g += `<line class="d-win" x1="${x0 + step * at}" x2="${x0 + step * at}" y1="${y0 - 14}" y2="${y1}"/><text class="ax" x="${x0 + step * at + 5}" y="${y0 - 8}">the last ${esc(v.weeks_window)} weeks</text>`;
  weeks.forEach((k, i) => { const c = x0 + step * (i + .5); let below = 0;
    g += `<g><title>${esc(k.week)}${k.running ? " (running)" : ""}: main red ${repos.map(r => `${esc(num(k.red_h[r] || 0))} h in ${esc(dRepo(r))}`).join(", ")} · ${esc(k.passed)} builds passed, ${esc(k.failed)} failed</title>
      <rect class="q-hit" x="${c - step / 2}" y="${y0}" width="${step}" height="${y1 - y0}"/>` +
      repos.map((r, j) => { const hrs = k.red_h[r] || 0, low = y(below), high = y(below += hrs);
        return hrs ? `<rect class="d-red${j ? " two" : ""}" x="${c - bar / 2}" y="${high.toFixed(1)}" width="${bar}" height="${(low - high).toFixed(1)}" rx="2"/>` : ""; }).join("") + `</g>` +
      (i % 4 ? "" : `<text class="ax" x="${c}" y="${h - 8}" text-anchor="middle">${esc(k.from.slice(8, 10))}.${esc(k.from.slice(5, 7))}</text>`); });
  return frame(w, h, g, "Hours in which main was red, week by week");
}

function dBatch(v){
  return `<div class="tw"><table class="t stack"><thead><tr><th>Kind</th><th>Deploys</th><th>Changes, the middle one</th><th>The most</th><th>Had to be repaired</th></tr></thead><tbody>${v.batches.map(b => `<tr>
    <td class="k"><b>${esc(b.kind === "release" ? "Releases" : "Hotfixes")}</b></td><td data-l="Deploys">${esc(b.n)}</td><td data-l="Changes, the middle one"><b>${esc(num(b.changes_p50))}</b></td><td data-l="The most">${esc(b.changes_max)}</td>
    <td data-l="Had to be repaired"><b class="${b.failed_pct >= 50 ? "late" : ""}">${esc(b.failed)} of ${esc(b.n)}</b> · ${esc(num(b.failed_pct))} %</td></tr>`).join("")}</tbody></table></div>
    <div class="small dim">Since ${esc(when(v.from))}. Repaired: a rollback followed it, or a hotfix of one of its services within ${esc(v.repair_hours)} hours.</div>`;
}

/* Why main went red: the stage that failed, and the failures that passed when the same build ran again. */
function dStages(v){
  const now = v.last, was = v.before, names = [...new Set([...Object.keys(now.stages), ...Object.keys(was.stages)])];
  return `<div class="tw"><table class="t"><thead><tr><th>Stage that failed</th><th>Last ${esc(v.weeks_window)} weeks</th><th>The ${esc(v.weeks_window)} before</th></tr></thead><tbody>${names.map(name => `<tr>
    <td>${esc(name)}</td><td><b>${esc(now.stages[name] || 0)}</b></td><td>${esc(was.stages[name] || 0)}</td></tr>`).join("")}
    <tr><td><b>Failed builds of main</b></td><td><b>${esc(now.broke)}</b> of ${esc(now.builds)}</td><td>${esc(was.broke)} of ${esc(was.builds)}</td></tr>
    <tr><td>Of them passed when run again</td><td><b class="${now.rerun_passed * 2 >= now.broke && now.broke ? "late" : ""}">${esc(now.rerun_passed)}</b></td><td>${esc(was.rerun_passed)}</td></tr></tbody></table></div>
    <div class="small dim">A build that passes when it is run again with no change of code did not fail because of the code: a test that fails now and then, or the build machine.</div>`;
}

function dLog(v){
  const outcome = d => d.kind === "rollback" ? `<span class="pill">back to ${esc(d.version)}</span>`
    : d.failed ? `<span class="pill critical">${d.repair.kind === "rollback" ? "rolled back" : `repaired by ${esc(d.repair.version)}`} after ${esc(d.repair.hours)} h</span>` : `<span class="pill ok">held</span>`;
  const table = `<div class="tw"><table class="t stack d-log"><thead><tr><th>Reached production</th><th>Version</th><th>Kind</th><th>Services</th><th>Changes</th><th>Outcome</th><th>Incident reports in the ${esc(v.incident_hours)} h after</th></tr></thead><tbody>${v.deploys.map(d => `<tr class="${d.window === "last" ? "" : "d-old"}">
    <td class="k">${esc(when(d.at))}</td><td data-l="Version"><span class="mono">${esc(d.version)}</span></td><td data-l="Kind">${esc(d.kind)}</td>
    <td data-l="Services">${d.kind === "release" ? `all ${esc(d.services.length)}` : d.services.map(s => `<span class="mono small">${esc(s)}</span>`).join(" ")}</td><td data-l="Changes">${esc(d.changes)}</td>
    <td data-l="Outcome">${outcome(d)}</td><td data-l="Incident reports">${d.incidents.length ? d.incidents.map(r => `${esc(r.title)} · <span class="mono small">${esc(r.service)}</span> · ${esc(when(r.at))}`).join("<br>") : `<span class="dim">none</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  return PHONE.matches ? `<details class="dropped"><summary>Show all ${esc(v.deploys.length)} deploys</summary>${table}</details>` : table;      // a phone folds the long list
}

function dFacts(){
  const rows = state.facts.filter(f => f.card === "delivery");
  return `<details class="dropped"><summary>The ${rows.length} facts code computed for builds and deploys</summary><div class="tw"><table class="t"><thead><tr><th>Fact</th><th>Says</th><th>Level by rules</th></tr></thead><tbody>
    ${rows.map(f => `<tr><td class="mono small">${esc(f.id)}</td><td>${keyed(f.text)}</td><td><span class="pill ${esc(f.level)}">${esc(f.level)}</span></td></tr>`).join("")}</tbody></table></div></details>`;
}

/* The section under the pull requests: called by renderCode. */
function deliveryPanels(){
  const v = state.views.delivery;
  if (!v) return `<div class="pulse">No build server in this data: builds and deploys are not shown.</div>`;
  const now = v.last, red = v.red_now.length;
  return `<div class="pulse d-head"><b>Builds and deploys</b> · the last ${esc(v.weeks_window)} weeks next to the ${esc(v.weeks_window)} before · from the build server, as of ${esc(when(v.now))}.
      Lead time counts calendar days, from the merge into main to production; red main counts hours without weekends. Every share names what it is a share of.</div>` + dTiles(v) +
    panel("Where lead time goes", `<span class="small dim">changes that reached production · calendar days</span>`, dLead(v), "dlead") +
    `<div class="grid2">` + panel("Deploys to production", `<span class="pill ${now.failed ? "critical" : "ok"}">${esc(now.failed)} of ${esc(now.can_fail)} repaired</span><span class="small dim">the higher a dot, the more changes</span>`, dDeploys(v) +
        `<div class="legend"><span><i style="background:var(--ok)"></i>held</span><span><i style="background:var(--crit)"></i>had to be repaired</span><span><i class="dash" style="border-color:var(--crit)"></i>to its repair</span>
          <span><i style="background:var(--line-strong)"></i>rollback</span>${v.waiting.cut ? `<span><i class="outline"></i>cut, not deployed yet</span>` : ""}<span>large dot: a release</span></div>`, "ddeploys") +
      panel("Main, week by week", `<span class="pill ${red ? "critical" : now.red_pct > (v.before.red_pct ?? now.red_pct) ? "warning" : "ok"}">${red ? `red now in ${esc(v.red_now.map(dRepo).join(", "))}` : `${esc(num(now.red_pct))} % red lately`}</span><span class="small dim">hours without weekends with main red</span>`, dRed(v) +
        `<div class="legend">${v.repos.map((r, j) => `<span><i class="d-sw${j ? " two" : ""}"></i>${esc(dRepo(r))}</span>`).join("")}</div>`, "dred") + `</div>` +
    `<div class="grid2">` + panel("Releases against hotfixes", `<span class="small dim">the size of a deploy and how it went</span>`, dBatch(v), "dbatch") +
      panel("Why main went red", `<span class="small dim">failed builds of main, by the stage that failed</span>`, dStages(v), "dstages") + `</div>` +
    panel("Deploy log", `<span class="small dim">every run of the production deploy job, the newest first · grey: before the last ${esc(v.weeks_window)} weeks</span>`, dLog(v), "dlog") + dFacts();
}
