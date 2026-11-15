/* Sightline: the Quality tab. What the team's bugs say, sprint by sprint and increment by increment. Everything is
   drawn from state.views.quality, which the server computes (sightline/quality.py). The lines under "What the numbers
   say" are an agent's wording, checked by code against the facts they cite. What comes from the data goes through esc().

   Colour has one meaning each: red is what came in or was found in production, green is what went out, the amber
   ramp is severity (darkest: highest), the teal ramp is the phase a bug was found in (lightest: earliest), plain teal
   is a neutral measure. */
"use strict";
const LOWER = -1, HIGHER = 1;           // which way a measure is better
const qLast = q => q.pis[q.pis.length - 1], qBefore = q => q.pis[q.pis.length - 2] || {};
// A step for an axis that gives about four round ticks.
const nice = top => { const raw = top / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag; };
function qAxis(top, x0, x1, y, unit){
  const step = nice(top), out = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(`<line class="g" x1="${x0}" x2="${x1}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${x0 - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 10) / 10}${v ? unit : ""}</text>`);
  return out.join("");
}
// How a measure moved against the increment before: the direction, the difference, and whether that is good news.
function moved(now, before, better, unit){
  if (now == null || before == null) return "";
  const d = Math.round((now - before) * 10) / 10;
  if (!d) return `<span class="q-d">＝</span>`;
  return `<span class="q-d${better ? (d < 0) === (better === LOWER) ? " good" : " bad" : ""}">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}${unit}</span>`;
}
// The lines that part the increments in a chart over sprints, with their names on top.
function qIncrements(q, x, y0, y1){
  return q.pis.map((p, i) => { const at = x(q.sprints.findIndex(r => r.sprint === p.sprints[0]));
    return `${i ? `<line class="g" x1="${at}" x2="${at}" y1="${y0 - 10}" y2="${y1}"/>` : ""}<text class="ax" x="${at + 5}" y="${y0 - 10}">${esc(p.name)}</text>`; }).join("");
}

function qTiles(q){
  const now = qLast(q), was = qBefore(q), then = was.name ? esc(was.name) : "";
  const tile = (label, value, unit, delta, note, facts) => `<button class="kpi" type="button" data-facts="${facts}"><span class="lbl">${label}</span>
    <span class="v">${esc(num(value))}<small>${unit}</small></span><span class="d">${delta} ${note}</span></button>`;
  return `<div class="kpis">` +
    tile("Open bugs", q.aging.open, "", moved(q.aging.open, was.open_end, LOWER, ""), then ? `${esc(was.open_end)} at the end of ${then}` : "", "quality.open_n|quality.open_before_n|quality.net_per_sprint") +
    tile("Found in production", now.escape_pct, "%", moved(now.escape_pct, was.escape_pct, LOWER, " points"), `${esc(now.escaped)} of ${esc(now.created)} bugs`, "quality.escape_pct|quality.escape_before_pct|quality.escaped_n") +
    tile("Came back after the fix", now.reopen_pct, "%", moved(now.reopen_pct, was.reopen_pct, LOWER, " points"), `${esc(now.reopened)} of ${esc(now.fixed)} fixed`, "quality.reopen_pct|quality.reopen_before_pct") +
    tile("Half fixed within", now.fix_p50, "days", moved(now.fix_p50, was.fix_p50, LOWER, " d"), `85 % within ${esc(num(now.fix_p85))} d`, "quality.fix_p50_days|quality.fix_before_p50_days") +
    tile("Fixed within the target", now.kept_pct, "%", moved(now.kept_pct, was.kept_pct, HIGHER, " points"), "of those that can be judged", "quality.kept_pct|quality.kept_before_pct") +
    tile("Bugs per 100 SP delivered", now.per_100_sp, "", moved(now.per_100_sp, was.per_100_sp, LOWER, ""), then ? `${esc(num(was.per_100_sp))} in ${then}` : "", "quality.per_100_sp|quality.created_n") + `</div>`;
}

/* What the numbers say: the agent's lines that passed the check, each one a door to its facts. */
function qSays(q){
  const f = q.findings, agent = f.by === "agent", all = f.rows.length + f.problems.length;
  return panel(agent ? "✦ What the numbers say" : "What the numbers say",
    `<span class="pill ${agent ? "agent" : "rules"}">${agent ? "agent" : "rules"}</span><span class="small dim">${agent ? `${f.rows.length} of ${all} lines passed the check` : "the facts that call for a look, as they are"}</span>`,
    (f.rows.length ? `<div class="q-says">${f.rows.map(r => `<button class="q-say" type="button" data-facts="${esc(r.facts.join("|"))}"><span class="dotl ${esc(r.level)}"></span><span>${keyed(r.text)}</span></button>`).join("")}</div>`
      : `<div class="dim">Nothing in the numbers calls for a look.</div>`) +
    (f.problems.length ? `<details class="dropped" open><summary>The check dropped ${plural(f.problems.length, "line")} of the agent</summary><ul>${f.problems.map(p => `<li>${keyed(p)}</li>`).join("")}</ul></details>` : "") +
    `<div class="small dim">${agent ? "Worded by the briefing agent from the facts of this tab; a recording in this demo. Code checked every line just now: a number that is not in the facts a line cites drops the line. " : ""}Click a line to see the facts behind it.</div>`, "qsays");
}

function qFlow(q){
  const rows = q.sprints, n = rows.length, w = chartW(), h = 270, x0 = 40, x1 = w - 104, y0 = 26, y1 = h - 28, last = rows[n - 1];
  const top = Math.max(1, last.created_sum) * 1.05, x = i => x0 + (x1 - x0) * i / n, y = v => y0 + (y1 - y0) * (1 - v / top);
  const pts = key => [[x(0), y(0)], ...rows.map((r, i) => [x(i + 1), y(r[key])])], d = p => p.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join("");
  const made = pts("created_sum"), gone = pts("resolved_sum"), mid = (y(last.created_sum) + y(last.resolved_sum)) / 2;
  return frame(w, h, qAxis(top / 1.05, x0, x1, y, "") + qIncrements(q, x, y0, y1) +
    `<path class="q-gap" d="${d(made)}${[...gone].reverse().map(([a, b]) => `L${a.toFixed(1)} ${b.toFixed(1)}`).join("")}Z"/><path class="q-gone" d="${d(gone)}"/><path class="q-made" d="${d(made)}"/>` +
    rows.map((r, i) => `${i % 2 ? "" : `<text class="ax" x="${x(i + .5)}" y="${h - 8}" text-anchor="middle">${esc(r.sprint)}</text>`}
      <rect class="q-hit" x="${x(i)}" y="${y0}" width="${x(1) - x(0)}" height="${y1 - y0}"><title>${esc(r.name)}: ${r.created} created, ${r.resolved} resolved, ${r.open} open at its end</title></rect>`).join("") +
    `<text class="ax b" x="${x1 + 8}" y="${y(last.created_sum) + 4}">created ${last.created_sum}</text><text class="ax b" x="${x1 + 8}" y="${y(last.resolved_sum) + 4}">resolved ${last.resolved_sum}</text>
     <text class="ax" x="${x1 + 8}" y="${mid + 4}">${last.open} open</text>`, "Bugs created and resolved, added up sprint by sprint");
}

function qSprints(q){
  const rows = q.sprints, n = rows.length, w = chartW(), h = 270, x0 = 40, x1 = w - 12, y0 = 26, y1 = h - 28, u = q.usual;
  const top = Math.max(1, ...rows.map(r => Math.max(r.created, r.resolved))) * 1.12, step = (x1 - x0) / n, bar = Math.min(13, step / 2 - 3), x = i => x0 + step * i, y = v => y0 + (y1 - y0) * (1 - v / top);
  return frame(w, h, (u ? `<rect class="q-usual" x="${x0}" y="${y(u.high)}" width="${x1 - x0}" height="${y(u.low) - y(u.high)}"/>` : "") + qAxis(top / 1.12, x0, x1, y, "") + qIncrements(q, x, y0, y1) +
    rows.map((r, i) => { const c = x(i + .5), run = r.running ? " run" : "";
      return `<g><title>${esc(r.name)}${r.running ? " (running)" : ""}: ${r.created} created, ${r.escaped} of them found in production, ${r.resolved} resolved</title>
        <rect class="q-in${run}" x="${c - bar - 1}" y="${y(r.created)}" width="${bar}" height="${y(r.escaped) - y(r.created)}" rx="2"/>
        <rect class="q-prod${run}" x="${c - bar - 1}" y="${y(r.escaped)}" width="${bar}" height="${y1 - y(r.escaped)}"/>
        <rect class="q-out${run}" x="${c + 1}" y="${y(r.resolved)}" width="${bar}" height="${y1 - y(r.resolved)}" rx="2"/>
        ${i % 2 ? "" : `<text class="ax" x="${c}" y="${h - 8}" text-anchor="middle">${esc(r.sprint)}</text>`}</g>`; }).join(""), "Bugs created and resolved in each sprint");
}

/* Where bugs are found: one bar per increment, split by phase. The later, the more a bug costs. */
function qFound(q){
  const finders = [...new Set(q.pis.flatMap(p => Object.keys(p.found_by)))].sort((a, b) => (qLast(q).found_by[b] || 0) - (qLast(q).found_by[a] || 0));
  return `<div class="q-rows">${q.pis.map(p => `<div class="q-row"><b>${esc(p.name)}</b>
      <div class="split q-split">${p.phases.map((n, i) => n ? `<i class="ph${i + 1}" style="flex-grow:${n}" title="${esc(q.phases[i])}: ${n} of ${p.created}">${n / p.created >= .07 ? n : ""}</i>` : "").join("")}</div>
      <span class="q-num"><b>${esc(num(p.escape_pct))} %</b> in production</span></div>`).join("")}</div>
    <div class="legend">${q.phases.map((name, i) => `<span><i class="ph${i + 1}"></i>${esc(name)}</span>`).join("")}</div>
    <div class="lbl">Who found them, by role</div>
    <div class="tw"><table class="t"><thead><tr><th>Found by</th>${q.pis.map(p => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${finders.map(who => `<tr><td><b>${esc(who)}</b></td>
      ${q.pis.map(p => { const n = p.found_by[who] || 0; return `<td class="q-nw">${n} <span class="dim small">· ${p.created ? Math.round(100 * n / p.created) : 0} %</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* How severe the bugs of each increment were. */
function qSevere(q){
  return `<div class="q-rows">${q.pis.map(p => `<div class="q-row"><b>${esc(p.name)}</b>
      <div class="split q-split">${p.severity.map((n, i) => n ? `<i class="sev${i + 1}" style="flex-grow:${n}" title="${esc(q.priorities[i])}: ${n} of ${p.created}">${n / p.created >= .07 ? n : ""}</i>` : "").join("")}</div>
      <span class="q-num"><b>${p.created ? Math.round(100 * (p.severity[0] + p.severity[1]) / p.created) : 0} %</b> Highest or High</span></div>`).join("")}</div>
    <div class="legend">${q.priorities.map((name, i) => `<span><i class="sev${i + 1}"></i>${esc(name)}</span>`).join("")}</div>`;
}

/* Days to a fix per increment: the middle half as a box, the median as a line, the fastest and slowest tenth as whiskers. */
function qBoxes(q){
  // On a narrow screen the words of a row stand above its box instead of beside it.
  const rows = q.pis.filter(p => p.fix_box), w = chartW(), slim = w < 500, lane = slim ? 48 : 38, x0 = slim ? 14 : 66, x1 = slim ? w - 14 : w - 268, y0 = 6, h = y0 + rows.length * lane + 24;
  if (!rows.length) return `<div class="dim">No bug was fixed yet.</div>`;
  const top = Math.max(1, ...rows.map(p => p.fix_box[4])) * 1.04, step = nice(top), x = v => x0 + (x1 - x0) * v / top, ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(`<line class="g" x1="${x(v)}" x2="${x(v)}" y1="${y0}" y2="${h - 22}"/><text class="ax" x="${x(v)}" y="${h - 7}" text-anchor="middle">${v}${slim ? " d" : v ? "" : " days"}</text>`);
  return frame(w, h, ticks.join("") + rows.map((p, i) => { const [a, b, m, c, e] = p.fix_box, mid = y0 + lane * (i + .5), cy = slim ? mid + 10 : mid, words = slim ? mid - 12 : mid + 4;
    return `<g><title>${esc(p.name)}: a tenth within ${a} days, a quarter within ${b}, half within ${m}, three quarters within ${c}, nine tenths within ${e}</title>
      <text class="ax b" x="${slim ? x0 : 2}" y="${words}">${esc(p.name)}</text><line class="q-whisk" x1="${x(a)}" x2="${x(e)}" y1="${cy}" y2="${cy}"/>
      <rect class="q-box" x="${x(b)}" y="${cy - 8}" width="${Math.max(3, x(c) - x(b))}" height="16" rx="4"/><line class="q-mid" x1="${x(m)}" x2="${x(m)}" y1="${cy - 11}" y2="${cy + 11}"/>
      <text class="ax" x="${slim ? x0 + 54 : x1 + 12}" y="${words}">half within ${m} d · 85 % within ${esc(num(p.fix_p85))} d${slim ? "" : ` · ${p.fixed} fixed`}</text></g>`; }).join(""), "Days from the report of a bug to its fix, per increment");
}
function qTargets(q){
  const few = s => `<span class="dim small">${s.fixed} fixed: too few for a median</span>`, late = q.severity.flatMap(s => s.late_open);
  return `<div class="tw"><table class="t"><thead><tr><th>Severity</th><th>Target</th><th>Half fixed within</th><th>85 % within</th><th>Within the target</th><th>Open past it</th></tr></thead><tbody>
    ${q.severity.map((s, i) => `<tr><td class="k"><span class="q-sw sev${i + 1}"></span><b class="q-ink">${esc(s.priority)}</b> · ${plural(s.n, "bug")}</td><td class="k">${esc(s.target)} d</td>
      ${s.p50 == null ? `<td colspan="2">${few(s)}</td>` : `<td><b class="${s.p50 > s.target ? "late" : ""}">${esc(s.p50)} d</b></td><td>${esc(s.p85)} d</td>`}
      <td class="k">${s.kept_pct == null ? "" : `<b class="${s.kept_pct < 50 ? "late" : "q-ink"}">${esc(s.kept_pct)} %</b> · `}${s.kept} of ${s.judged}</td>
      <td>${s.late_open.length ? `<b class="late">${s.late_open.length}</b>` : "0"}</td></tr>`).join("")}</tbody></table></div>
    ${late.length ? `<div class="lbl">Open and past the target · the most severe first</div><div class="chips">${late.slice(0, 12).map(chip).join("")}${late.length > 12 ? `<span class="dim small">+${late.length - 12} more</span>` : ""}</div>` : ""}`;
}

/* Still open after N days: the curve a plain time to fix cannot show, because it counts the open bugs too. */
function qSurvival(q){
  const s = q.survival, w = chartW(), slim = w < 500, h = 250, x0 = 44, x1 = w - (slim ? 52 : 158), y0 = 12, y1 = h - 28, x = day => x0 + (x1 - x0) * day / s.days, y = share => y0 + (y1 - y0) * (1 - share);
  const ends = s.curves.map((c, i) => ({name: c.name, at: y(c.open[s.days]), pct: Math.round(c.open[s.days] * 100), i})).sort((a, b) => a.at - b.at);
  ends.forEach((e, k) => { if (k && e.at - ends[k - 1].at < 14) e.at = ends[k - 1].at + 14; });
  return frame(w, h, [0, .25, .5, .75, 1].map(f => `<line class="g" x1="${x0}" x2="${x1}" y1="${y(f)}" y2="${y(f)}"/><text class="ax" x="${x0 - 6}" y="${y(f) + 4}" text-anchor="end">${f * 100}${f ? " %" : ""}</text>`).join("") +
    [0, 7, 14, 30, s.days].map(day => `${day && day < s.days ? `<line class="g" x1="${x(day)}" x2="${x(day)}" y1="${y0}" y2="${y1}"/>` : ""}<text class="ax" x="${x(day)}" y="${h - 8}" text-anchor="middle">${day}${day ? "" : " days"}</text>`).join("") +
    s.curves.map((c, i) => `<path class="q-surv s${i + 1}" d="M${x(0)} ${y(1)}${c.open.map((v, day) => `H${x(day).toFixed(1)}V${y(v).toFixed(1)}`).join("")}"><title>${esc(c.name)}: ${c.n} bugs</title></path>`).join("") +
    ends.map(e => `<text class="ax b" x="${x1 + 8}" y="${e.at + 4}">${slim ? "" : `${esc(e.name)} · `}${e.pct} %</text>`).join(""), "Share of bugs still open, by days since they were reported") +
    `<div class="tw"><table class="t"><thead><tr><th>Still open after</th><th>Bugs</th><th>7 days</th><th>14 days</th><th>30 days</th></tr></thead><tbody>${s.curves.map((c, i) => `<tr>
      <td class="k"><span class="q-sw line s${i + 1}"></span><b>${esc(c.name)}</b></td><td>${c.n}</td>${[7, 14, 30].map(day => `<td>${Math.round(c.open[day] * 100)} %</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* Bug debt: what is open now, by age and severity. */
function qDebt(q){
  const a = q.aging, most = Math.max(1, ...a.buckets.map(b => b.n));
  return `<div class="q-rows">${a.buckets.map(b => `<div class="q-row debt"><span>${esc(b.name)}</span>
      <div><div class="q-stack" style="width:${Math.round(100 * b.n / most)}%">${b.by_priority.map((n, i) => n ? `<i class="sev${i + 1}" style="flex-grow:${n}" title="${esc(q.priorities[i])}: ${n}"></i>` : "").join("")}</div></div>
      <b class="q-num">${b.n}</b></div>`).join("")}</div>
    <div class="legend">${q.priorities.map((name, i) => `<span><i class="sev${i + 1}"></i>${esc(name)}</span>`).join("")}</div>
    <div class="lbl">The oldest</div>
    <div class="chips">${a.oldest.map(o => `<button type="button" class="chip" data-issue="${esc(o.key)}"><span class="mono">${esc(o.key)}</span><small>${esc(o.days)} d</small></button>`).join("")}</div>`;
}

/* Where bugs concentrate: services against increments, the darker the more. */
function qHeat(q){
  const most = Math.max(1, ...q.components.flatMap(c => c.per_pi));
  const spark = vals => { const w = 110, h = 26, top = Math.max(1, ...vals), at = (v, i) => [(3 + (w - 6) * i / Math.max(1, vals.length - 1)).toFixed(1), (h - 3 - (h - 6) * v / top).toFixed(1)], end = at(vals[vals.length - 1], vals.length - 1);
    return `<svg class="q-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bugs per sprint: ${vals.join(", ")}"><polyline points="${vals.map((v, i) => at(v, i).join(",")).join(" ")}"/><circle cx="${end[0]}" cy="${end[1]}" r="2.5"/></svg>`; };
  return `<div class="tw"><table class="t q-heat"><thead><tr><th>Service</th>${q.pis.map(p => `<th>${esc(p.name)}</th>`).join("")}<th>Sprint by sprint</th></tr></thead><tbody>${q.components.map(c => `<tr>
    <td class="mono small k"><b class="q-ink">${esc(c.component)}</b></td>${c.per_pi.map((n, i) => `<td class="q-cell" style="--s:${Math.round(4 + 42 * n / most)}%"><b>${n}</b>${c.escaped[i] ? `<small><i></i>${c.escaped[i]} in prod.</small>` : ""}</td>`).join("")}
    <td>${spark(c.per_sprint)}</td></tr>`).join("")}</tbody></table></div>`;
}

/* Causes, the most common first, with what they add up to (Pareto). */
function qCauses(q){
  const most = Math.max(1, ...q.pareto.map(c => c.pct || 0)), few = q.pareto.findIndex(c => c.cum_pct >= 80), was = qBefore(q).name;
  if (!q.pareto.length) return `<div class="dim">No fixed bug of this increment has a cause yet.</div>`;
  return `<div class="tw"><table class="t"><thead><tr><th>Cause</th><th>Share of the fixed bugs</th><th>Bugs</th><th>Adds up to</th>${was ? `<th>Against ${esc(was)}</th>` : ""}</tr></thead><tbody>${q.pareto.map((c, i) => `<tr>
    <td>${i <= few ? `<b>${esc(c.cause)}</b>` : esc(c.cause)}</td><td><span class="share q-wide"><i style="width:${Math.round(100 * c.pct / most)}%"></i></span> <b>${esc(c.pct)} %</b></td><td>${c.n}</td>
    <td class="${i <= few ? "" : "dim"}">${esc(c.cum_pct)} %</td>${was ? `<td class="k">${moved(c.pct, c.before_pct, LOWER, " points")} <span class="small">was ${esc(num(c.before_pct))} %</span></td>` : ""}</tr>`).join("")}</tbody></table></div>
    <div class="small dim">${few >= 0 ? `The first ${few + 1} causes, in bold, explain ${esc(q.pareto[few].cum_pct)} % of the fixed bugs.` : ""} The cause is set when a bug is fixed.</div>`;
}

/* What each release brought: production bugs reported in the days after it. */
function qReleases(q){
  const rows = q.releases, w = chartW(), h = 240, x0 = 40, x1 = w - 12, y0 = 20, y1 = h - 42;
  if (!rows.length) return `<div class="dim">No release in this data.</div>`;
  const top = Math.max(1, ...rows.map(r => r.bugs)) * 1.2, step = (x1 - x0) / rows.length, bar = Math.min(38, step * .5), y = v => y0 + (y1 - y0) * (1 - v / top);
  return frame(w, h, qAxis(top / 1.2, x0, x1, y, "") + rows.map((r, i) => { const c = x0 + step * (i + .5), soft = r.complete ? "" : " run";
    return `<g><title>Release ${esc(r.version)}, ${esc(when(r.at))}: ${r.bugs} production bugs in the ${q.after_release} days after, ${r.severe} of them Highest or High${r.complete ? "" : " (so far)"}</title>
      <rect class="q-in${soft}" x="${c - bar / 2}" y="${y(r.bugs)}" width="${bar}" height="${y(r.severe) - y(r.bugs)}" rx="2"/><rect class="q-prod${soft}" x="${c - bar / 2}" y="${y(r.severe)}" width="${bar}" height="${y1 - y(r.severe)}"/>
      <text class="ax b" x="${c}" y="${y(r.bugs) - 5}" text-anchor="middle">${r.bugs}${r.complete ? "" : " so far"}</text>
      <text class="ax b" x="${c}" y="${h - 24}" text-anchor="middle">${esc(r.version)}</text><text class="ax" x="${c}" y="${h - 9}" text-anchor="middle">${esc(r.at.slice(8, 10))}.${esc(r.at.slice(5, 7))}</text></g>`; }).join(""),
    "Production bugs in the days after each release");
}

/* What moves with bugs: one sprint measure against the bugs of the sprint after, one dot per sprint. */
const LINK = {added_pct: "Scope added late, and production bugs a sprint later", unreviewed_pct: "Merged without a review, and production bugs a sprint later",
  load_pct: "An overloaded sprint, and production bugs a sprint later", completed_sp: "A fast sprint, and new bugs a sprint later"};
function qLink(l){
  const w = PHONE.matches ? 384 : 360, h = 214, x0 = 30, x1 = w - 12, y0 = 24, y1 = h - 36, xs = l.points.map(p => p.x), lo = Math.min(...xs), hi = Math.max(...xs), pad = (hi - lo) * .07 || 1;
  const top = Math.max(1, ...l.points.map(p => p.y)) * 1.12, x = v => x0 + (x1 - x0) * (v - lo + pad) / (hi - lo + 2 * pad), y = v => y0 + (y1 - y0) * (1 - Math.max(0, Math.min(top, v)) / top), fit = v => l.at_zero + l.slope * v;
  const sure = l.low * l.high > 0, r = v => 14 + (w - 28) * (v + 1) / 2;
  return `<div class="q-link"><div class="q-link-h"><b>${esc(LINK[l.id] || l.x)}</b><button type="button" class="pill ${sure ? "agent" : ""}" data-facts="quality.link.${esc(l.id)}">${esc(l.strength)}</button></div>` +
    frame(w, h, qAxis(top / 1.12, x0, x1, y, "") + `<text class="ax" x="${x0 - 22}" y="12">↑ ${esc(l.y)}</text>
      <line class="q-trend" x1="${x(lo)}" x2="${x(hi)}" y1="${y(fit(lo))}" y2="${y(fit(hi))}"/>` +
      l.points.map(p => `<circle class="q-dot" cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="5"><title>${esc(p.sprint)}: ${esc(p.x)}, then ${esc(p.y)} bugs in the sprint after</title></circle>`).join("") +
      `<text class="ax" x="${x(lo)}" y="${h - 20}" text-anchor="middle">${lo}</text><text class="ax" x="${x(hi)}" y="${h - 20}" text-anchor="middle">${hi}</text>
       <text class="ax" x="${(x0 + x1) / 2}" y="${h - 5}" text-anchor="middle">${esc(l.x)} →</text>`, `${esc(l.x)} against ${esc(l.y)}`) +
    `<svg class="ch" viewBox="0 0 ${w} 40" role="img" aria-label="r is ${l.r}; with ${l.n} sprints it could be ${l.low} to ${l.high}"><line class="g" x1="${r(-1)}" x2="${r(1)}" y1="13" y2="13"/><line class="q-zero" x1="${r(0)}" x2="${r(0)}" y1="4" y2="22"/>
      <line class="q-ci" x1="${r(l.low)}" x2="${r(l.high)}" y1="13" y2="13"/><circle class="q-r" cx="${r(l.r)}" cy="13" r="5.5"/>
      <text class="ax" x="${r(-1)}" y="36">−1 opposite</text><text class="ax" x="${r(0)}" y="36" text-anchor="middle">0 no link</text><text class="ax" x="${r(1)}" y="36" text-anchor="end">+1 together</text></svg>
    <div class="small dim"><b>r ${esc(l.r)}</b> over ${esc(l.n)} sprints; it could be ${esc(l.low)} to ${esc(l.high)}. ${sure ? `In these sprints, 10 more on the bottom scale went with about ${Math.round(Math.abs(l.slope) * 100) / 10} ${l.slope < 0 ? "fewer" : "more"} bugs.`
      : "The range crosses 0: this may be chance."}</div></div>`;
}

function qFeatures(q){
  const name = k => state.cards[k] ? chip(k) : `<span class="mono small">${esc(k)}</span>`;
  if (!q.features.length) return `<div class="dim">No bug of these increments names a feature.</div>`;
  return `<div class="tw"><table class="t"><thead><tr><th>Feature</th><th>Bugs</th><th>Found in production</th><th>Came back</th><th>Still open</th></tr></thead><tbody>${q.features.map(f => `<tr>
    <td>${name(f.feature)}</td><td><b>${f.bugs}</b></td><td>${f.escaped ? `<b class="late">${f.escaped}</b>` : "0"}</td><td>${f.reopened}</td><td>${f.open}</td></tr>`).join("")}</tbody></table></div>`;
}

/* The same measures for every increment, side by side; an arrow compares with the increment before. */
const MEASURES = [["Bugs created", "created", 0, ""], ["Bugs resolved", "resolved", 0, ""], ["Created minus resolved", "net", LOWER, ""], ["Open at the end", "open_end", LOWER, ""],
  ["Found in production", "escape_pct", LOWER, " %"], ["Caught before production", "caught_pct", HIGHER, " %"], ["Came back after the fix", "reopen_pct", LOWER, " %"],
  ["Half fixed within", "fix_p50", LOWER, " d"], ["85 % fixed within", "fix_p85", LOWER, " d"], ["Fixed within the target", "kept_pct", HIGHER, " %"],
  ["Closed as duplicate or not reproducible", "not_a_bug_pct", LOWER, " %"], ["Bugs per 100 SP delivered", "per_100_sp", LOWER, ""]];
function qIncrementTable(q){
  const from = PHONE.matches ? Math.max(0, q.pis.length - 2) : 0, shown = q.pis.slice(from);        // a phone has room for the last two
  return `<div class="tw"><table class="t q-pi"><thead><tr><th>Measure</th>${shown.map(p => `<th>${esc(p.name)}${p.running ? " · so far" : ""}</th>`).join("")}</tr></thead><tbody>${MEASURES.map(([label, key, better, unit]) => `<tr>
    <td>${label}</td>${shown.map((p, n) => `<td><b>${esc(num(p[key]))}</b>${p[key] == null ? "" : unit} ${from + n ? moved(p[key], q.pis[from + n - 1][key], better, "") : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function qFacts(){
  const rows = state.facts.filter(f => f.card === "quality");
  return `<details class="dropped"><summary>The ${rows.length} facts code computed for this tab</summary><div class="tw"><table class="t"><thead><tr><th>Fact</th><th>Says</th><th>Level by rules</th></tr></thead><tbody>
    ${rows.map(f => `<tr><td class="mono small">${esc(f.id)}</td><td>${keyed(f.text)}</td><td><span class="pill ${esc(f.level)}">${esc(f.level)}</span></td></tr>`).join("")}</tbody></table></div></details>`;
}

function renderQuality(){
  const q = state.views.quality, here = $("#v-quality");
  if (!q){ here.innerHTML = `<div class="pulse">No bug data in this folder.</div>`; return; }
  const now = qLast(q), was = qBefore(q), a = q.aging, bugs = q.sprints[q.sprints.length - 1].created_sum;
  here.innerHTML = `<div class="pulse"><b>${esc(now.name)}${now.running ? " so far" : ""}</b>${was.name ? `, next to ${esc(was.name)}` : ""} · ${bugs} bugs of ${plural(q.sprints.length, "sprint")} and ${plural(q.pis.length, "increment")} ·
      as of ${esc(when(q.now))}. Every share names what it is a share of; times are medians, never averages.</div>` + qTiles(q) + qSays(q) +
    `<div class="grid2">` + panel("Created and resolved", `<span class="pill ${q.net_per_sprint > 0 ? "warning" : "ok"}">${q.net_per_sprint > 0 ? "+" : ""}${esc(num(q.net_per_sprint))} per sprint lately</span>`, qFlow(q) +
        `<div class="legend"><span><i style="background:var(--crit)"></i>created, added up</span><span><i style="background:var(--ok)"></i>resolved, added up</span><span><i style="background:var(--warn-soft)"></i>the gap: bugs open</span></div>`, "qflow") +
      panel("Sprint by sprint", q.usual ? `<span class="small dim">${esc(q.usual.last_name)}: ${esc(q.usual.last)} new · usual ${esc(q.usual.low)} to ${esc(q.usual.high)}</span>` : "", qSprints(q) +
        `<div class="legend"><span><i style="background:var(--made-soft)"></i>created, found before production</span><span><i style="background:var(--crit)"></i>created, found in production</span><span><i style="background:var(--ok)"></i>resolved</span>
          <span><i style="background:var(--sunk)"></i>usual range of the last ${q.usual ? q.usual.sprints : 0} full sprints</span></div>`, "qsprints") + `</div>` +
    `<div class="grid2">` + panel("Where bugs are found", `<span class="pill ${now.escape_pct > (was.escape_pct ?? now.escape_pct) ? "critical" : "ok"}">${esc(num(now.caught_pct))} % caught before production</span>`, qFound(q), "qfound") +
      panel("Where bugs concentrate", q.top_component ? `<span class="small dim">${esc(q.top_component.component)}: ${esc(q.top_component.pct)} % of the production bugs of ${esc(now.name)}</span>` : "", qHeat(q) +
        `<div class="small dim">Bugs created per service and increment; the red dot counts those found in production.</div>`, "qheat") + `</div>` +
    `<div class="grid2">` + panel("Time to fix", `<span class="small dim">days from the report to the fix · fixed bugs only</span>`, qBoxes(q) +
        `<div class="lbl">Against the target of each severity · the last two increments</div>` + qTargets(q), "qfix") +
      panel("Still open after N days", `<span class="small dim">every bug counts, the open ones too</span>`, qSurvival(q), "qsurvival") + `</div>` +
    `<div class="grid2"><div class="tabbody">` + panel("Bug debt", `<span class="pill ${a.old.length ? "warning" : "ok"}">${a.old.length} older than 30 days</span><span class="small dim">${a.open} open · half older than ${esc(num(a.age_p50))} d</span>`, qDebt(q), "qdebt") +
        panel("How severe they were", `<span class="small dim">bugs created in each increment, by severity</span>`, qSevere(q), "qsevere") + `</div>` +
      panel(`Causes · ${esc(now.name)}`, `<span class="small dim">${now.fixed} fixed bugs</span>`, qCauses(q), "qcauses") + `</div>` +
    panel("What moves with bugs", `<span class="small dim">one dot per sprint · a hint where to look, never a proof</span>`, q.links.length ? `<div class="q-links">${q.links.map(qLink).join("")}</div>
        <div class="small dim">Moving together is not cause. Pick one thing to change, change it, and watch the next sprints.</div>` : `<div class="dim">Too few sprints to compare.</div>`, "qlinks") +
    `<div class="grid2">` + panel("What each release brought", `<span class="small dim">production bugs in the ${esc(q.after_release)} days after · dark: Highest and High</span>`, qReleases(q), "qreleases") +
      panel("Features with the most bugs", `<span class="small dim">the last two increments</span>`, qFeatures(q), "qfeatures") + `</div>` +
    panel("Increment by increment", `<span class="small dim">▲▼ against the increment before · green: better, red: worse</span>`, qIncrementTable(q), "qpis") +
    `<div class="pulse"><b>What this tab leaves out on purpose.</b> No bug is counted per person: the team owns its quality. No target stands on a bug count: a count with a target gets managed, the quality does not.
      And nothing here says why: the numbers say where to look, the team says what it is.</div>` + qFacts();
}
