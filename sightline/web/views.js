/* Sightline: the tabs behind Today. Everything is drawn from state.views, which the server computes from the same
   data as the facts. What comes from the data goes through esc(). */
"use strict";
const I = k => state.views.issues[k] || {};
const num = v => v == null ? "—" : String(v);
// One panel of a tab. `help`: its entry in HELP (help.js), shown by the ? next to the title.
const panel = (title, meta, body, help) => `<div class="w"><div class="wh"><h2>${title}${help ? helpTip(help) : ""}</h2><div class="meta">${meta || ""}</div></div>${body}</div>`;
const chip = k => `<button type="button" class="chip" data-issue="${esc(k)}"><span class="mono">${esc(k)}</span>${I(k).sp != null ? `<small>${esc(I(k).sp)}</small>` : ""}</button>`;
const chips = keys => keys.length ? `<div class="chips">${keys.map(chip).join("")}</div>` : `<span class="dim small">none</span>`;
// The short name of a sprint for a chart: "Team PI2026-07.4" -> "PI2026-07.4", "Team-2026-09.1" -> "2026-09.1"; any other name: its last word ("Sprint 42" -> "42").
const short = name => { const s = String(name), cut = s.replace(/^.*?(?=(?:PI_?)?\d{4}-\d)/, ""); return cut !== s || /^(?:PI_?)?\d{4}-\d/.test(s) ? cut : s.split(" ").pop(); };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const issueTable = keys => keys.length ? `<div class="tw"><table class="t"><thead><tr><th>Issue</th><th>Type</th><th>Status</th><th>SP</th><th>Days in status</th><th>Sprint no.</th></tr></thead><tbody>
  ${keys.map(k => `<tr><td>${chip(k)}</td><td>${esc(I(k).type)}</td><td>${esc(I(k).status)}</td><td>${esc(num(I(k).sp))}</td><td>${esc(num(I(k).days))}</td><td>${esc(num(I(k).sprints))}</td></tr>`).join("")}
  </tbody></table></div>` : `<div class="dim">None.</div>`;
const frame = (w, h, body, label) => `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
function axes(top, x0, x1, y, unit){
  return [0, .5, 1].map(f => `<line class="g" x1="${x0}" x2="${x1}" y1="${y(top * f)}" y2="${y(top * f)}"/><text class="ax" x="${x0 - 6}" y="${y(top * f) + 4}" text-anchor="end">${Math.round(top * f * 10) / 10}${f === 1 ? unit : ""}</text>`).join("");
}
function burnup(v){
  const s = v.sprint, p = v.promises, n = s.days.length, w = chartW(), h = 250, x0 = 44, x1 = w - 150, y0 = 16, y1 = h - 28;
  const top = Math.max(1, p.committed || 0, p.p50 || 0, ...s.burnup.map(d => d.scope)) * 1.08;
  const x = i => x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : 0), y = val => y0 + (y1 - y0) * (1 - val / top);
  const path = key => s.burnup.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join("");
  const mark = (val, cls, text) => val == null ? "" : `<line class="${cls}" x1="${x(n - 1) - 8}" x2="${x(n - 1) + 8}" y1="${y(val)}" y2="${y(val)}"/><text class="ax" x="${x(n - 1) + 14}" y="${y(val) + 4}">${text} ${val}</text>`;
  const last = s.burnup.length - 1, every = w < 500 ? 3 : 2;         // a narrow chart names fewer days
  return frame(w, h, axes(top / 1.08, x0, x1, y, " SP") +
    s.days.map((d, i) => (i % every === 0 && n - 1 - i >= every - 1) || i === n - 1 ? `<text class="ax" x="${x(i)}" y="${h - 8}" text-anchor="middle">${d.slice(8)}.${d.slice(5, 7)}</text>` : "").join("") +
    (p.committed != null ? `<line class="dashed" x1="${x0}" x2="${x1}" y1="${y(p.committed)}" y2="${y(p.committed)}"/><text class="ax" x="${x0 + 4}" y="${y(p.committed) - 5}">committed ${esc(p.committed)}</text>` : "") +
    `<path class="scope" d="${path("scope")}"/><path class="done" d="${path("done")}"/>` +
    (last >= 0 ? `<circle class="dot" cx="${x(last)}" cy="${y(s.burnup[last].done)}" r="4"/><line class="today" x1="${x(last)}" x2="${x(last)}" y1="${y0}" y2="${y1}"/>` : "") +
    (p.p50 === p.p85 ? mark(p.p85, "m85", "forecast ≥") : mark(p.p50, "m50", "as likely as not ≥") + mark(p.p85, "m85", "85 % sure ≥")), "Burnup of the sprint with the forecast");
}
function pastBars(p){
  const rows = p.past, w = chartW(), h = 220, x0 = 44, x1 = w - 16, y0 = 14, y1 = h - 30;
  if (!rows.length) return `<div class="dim">No closed sprint of this board in the velocity chart yet.</div>`;
  const top = Math.max(1, p.committed || 0, ...rows.map(r => Math.max(r.committed, r.completed))) * 1.1, step = (x1 - x0) / rows.length, bar = Math.min(26, step / 3);
  const y = val => y0 + (y1 - y0) * (1 - val / top);
  return frame(w, h, axes(top / 1.1, x0, x1, y, " SP") + rows.map((r, i) => { const c = x0 + step * (i + .5); return `
    <rect class="b-commit" x="${c - bar - 2}" y="${y(r.committed)}" width="${bar}" height="${y1 - y(r.committed)}"/>
    <rect class="${r.completed >= (p.committed || 0) ? "b-done ok" : "b-done"}" x="${c + 2}" y="${y(r.completed)}" width="${bar}" height="${y1 - y(r.completed)}"/>
    <text class="ax" x="${c}" y="${h - 10}" text-anchor="middle">${esc(short(r.name))}</text>`; }).join("") +
    (p.committed != null ? `<line class="dashed" x1="${x0}" x2="${x1}" y1="${y(p.committed)}" y2="${y(p.committed)}"/><text class="ax" x="${x1 - 4}" y="${y(p.committed) - 5}" text-anchor="end">committed now ${esc(p.committed)}</text>` : ""),
    "Past sprints: committed and completed story points");
}
function scatter(f){
  const pts = f.cycle, w = chartW(), h = 240, x0 = 44, x1 = w - 150, y0 = 14, y1 = h - 28;
  if (!pts.length) return `<div class="dim">No completed item with a start in the sampled sprints.</div>`;
  const t = pts.map(c => Date.parse(c.done)), t0 = Math.min(...t), t1 = Math.max(...t), top = Math.max(1, ...pts.map(c => c.days)) * 1.08;
  const x = ms => x0 + (x1 - x0) * (t1 > t0 ? (ms - t0) / (t1 - t0) : .5), y = val => y0 + (y1 - y0) * (1 - val / top);
  const line = (val, cls, text) => val == null ? "" : `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y(val)}" y2="${y(val)}"/><text class="ax" x="${x1 + 6}" y="${y(val) + 4}">${text}: ${val} d</text>`;
  return frame(w, h, axes(top / 1.08, x0, x1, y, " d") + pts.map((c, i) => `<circle class="pt ${c.type === "Bug" || c.type === "Incident" ? "bug" : ""}" cx="${x(t[i]).toFixed(1)}" cy="${y(c.days).toFixed(1)}" r="4"><title>${esc(c.key)} · ${esc(c.type)} · ${esc(c.days)} days · done ${esc(c.done)}</title></circle>`).join("") +
    line(f.cycle_p50, "m50", "half within") + line(f.cycle_p85, "m85", "85 % within") +
    `<text class="ax" x="${x0}" y="${h - 8}">${esc(pts[0].done)}</text><text class="ax" x="${x1}" y="${h - 8}" text-anchor="end">${esc(pts[pts.length - 1].done)}</text>`, "Cycle time of completed items");
}
const tone = (i, n, name) => /block/i.test(name) ? "var(--crit)" : i === n - 1 ? "var(--ok)" : i === 0 ? "var(--line-strong)" : ["var(--info)", "var(--warn)", "var(--accent)"][(i - 1) % 3];
function stacked(f){
  const w = chartW(), h = 230, x0 = 44, x1 = w - 16, y0 = 14, y1 = h - 28, n = f.days.length;
  if (!n) return `<div class="dim">The sprint has no working day behind it yet.</div>`;
  const top = Math.max(1, ...f.counts.map(c => c.reduce((a, b) => a + b, 0))), step = (x1 - x0) / n, bar = Math.min(44, step * .7), y = val => y0 + (y1 - y0) * (1 - val / top);
  return frame(w, h, axes(top, x0, x1, y, "") + f.days.map((d, i) => { let below = 0; const c = x0 + step * (i + .5);
    return f.counts[i].map((count, col) => { const r = `<rect x="${c - bar / 2}" y="${y(below + count)}" width="${bar}" height="${y(below) - y(below + count)}" fill="${tone(col, f.columns.length, f.columns[col])}"><title>${esc(f.columns[col])}: ${count}</title></rect>`; below += count; return r; }).join("") +
      `<text class="ax" x="${c}" y="${h - 8}" text-anchor="middle">${d.slice(8)}.${d.slice(5, 7)}</text>`; }).join(""), "Items of the sprint in each column, day by day") +
    `<div class="legend">${f.columns.map((name, i) => `<span><i style="background:${tone(i, f.columns.length, name)}"></i>${esc(name)}</span>`).join("")}</div>`;
}

/* When the sprint does not fit: what each obvious move would do. Shown on Today and on Promises; "" when it fits. */
function optionsPanel(){
  const p = state.views.promises;
  if (!p.options.length) return "";
  return panel(p.chance < 50 ? "Decision waiting: the sprint does not fit" : "The sprint is tight", `<span class="pill ${p.chance < 15 ? "critical" : "warning"}">${esc(num(p.chance))} % to finish everything</span>`, `
    <div class="pulse">For an even chance to finish the rest, <b>${esc(num(p.over_50))} SP</b> have to move out; to be 85 % sure, <b>${esc(num(p.over_85))} SP</b>.
      What moves is for the team and the product owner to decide: the app only recomputes the forecast for each move.</div>
    <div class="tw"><table class="t stack"><thead><tr><th>Option</th><th>Moves out</th><th>SP</th><th>Chance to finish the rest</th></tr></thead><tbody>${p.options.map(o => `<tr>
      <td><b>${esc(o.title)}</b></td><td data-l="Moves out">${o.keys.length ? chips(o.keys) : `<span class="dim">nothing</span>`}</td><td data-l="SP">${esc(num(o.sp))}</td>
      <td data-l="Chance"><span class="share"><i class="${o.chance < 50 ? "hot" : ""}" style="width:${Math.max(2, o.chance)}%"></i></span> <b>${esc(num(o.chance))} %</b></td></tr>`).join("")}</tbody></table></div>
    <div class="small dim">Each chance is the same forecast run again without the points of the items that move. Items without story points do not change it. What each option costs the business is not in the data: that part is the Product Owner's call.</div>`, "options");
}
// The app's own record of its forecasts (live reading only), settled when a sprint has closed.
function recordBlock(){
  const rows = state.record, done = rows.filter(r => r.ended != null), held = done.filter(r => r.held_85).length;
  if (!rows.length) return `<div class="small dim"><b>The app's own record</b> is empty: ${state.data.live ? "it starts with the next working day." : "forecasts are recorded only when Jira is read live, once a day."}</div>`;
  return `<div class="lbl">The app's own record · ${plural(rows.length, "forecast")}${done.length ? ` · the 85 % line held ${held} of ${done.length} times` : " · none of their sprints has closed yet"}</div>
    <div class="tw"><table class="t"><thead><tr><th>Said on</th><th>Sprint</th><th>85 % sure</th><th>As likely as not</th><th>Ended with</th><th></th></tr></thead><tbody>${rows.slice(-10).reverse().map(r => `<tr>
      <td class="k">${esc(r.day.slice(8))}.${esc(r.day.slice(5, 7))} · day ${esc(num(r.sprint_day))}</td><td>${esc(short(r.name))}</td><td>≥ ${esc(num(r.p85_done_sp))}</td><td>≥ ${esc(num(r.p50_done_sp))}</td>
      <td>${r.ended == null ? `<span class="dim">running</span>` : `<b>${esc(r.ended)}</b>`}</td><td>${r.ended == null ? "" : `<span class="pill ${r.held_85 ? "ok" : "critical"}">${r.held_85 ? "held" : "missed"}</span>`}</td></tr>`).join("")}</tbody></table></div>`;
}

/* the tabs */
function renderPromises(){
  const v = state.views, p = v.promises, held = p.look_back.filter(r => r.held).length;
  $("#v-promises").innerHTML = panel("The sprint as a promise", `<span class="pill">${esc(state.sprint.name)}</span>`, `
      <div class="kpis k4"><div class="kpi"><span class="lbl">Committed at the start</span><span class="v">${esc(num(p.committed))}<small>SP</small></span></div>
        <div class="kpi"><span class="lbl">Done</span><span class="v">${esc(num(p.done))}<small>SP</small></span><span class="d">${esc(num(p.open))} SP still open</span></div>
        <div class="kpi"><span class="lbl">By the end, 85 % sure</span><span class="v">${esc(num(p.p85))}<small>SP or more</small></span><span class="d">as likely as not: ${esc(num(p.p50))} SP or more</span></div>
        <div class="kpi"><span class="lbl">Chance to finish everything</span><span class="v">${esc(num(p.chance))}<small>%</small></span><span class="d">${p.days_left == null ? "—" : esc(plural(p.days_left, "working day"))} left · ${esc(num(p.history_days))} days of history</span></div></div>
      ${burnup(v)}
      <div class="legend"><span><i style="background:var(--accent)"></i>done</span><span><i style="background:var(--line-strong)"></i>scope (done + open)</span><span><i class="dash"></i>committed at the start</span><span><i style="background:var(--warn)"></i>forecast lines at the end</span></div>`, "promise") + optionsPanel() +
    `<div class="grid2">` + panel("Can they bet on our forecasts?", p.look_back.length ? `<span class="pill ${held === p.look_back.length ? "ok" : "warning"}">the 85 % line held ${held} of ${p.look_back.length} times</span>` : `<span class="pill">no look-back yet</span>`,
      (p.look_back.length ? `<div class="small dim">The forecast is replayed inside past sprints, at three moments each, and compared with how the sprint ended.</div>
      <details class="fold" ${PHONE.matches ? "" : "open"}><summary>Show the ${p.look_back.length} look-backs</summary><div class="tw"><table class="t"><thead><tr><th>Sprint</th><th>Asked at</th><th>Said, 85 % sure</th><th>Said, as likely as not</th><th>Ended with</th><th></th></tr></thead><tbody>
      ${p.look_back.map(r => `<tr><td>${esc(short(r.sprint))}</td><td>${Math.round(r.share * 100)} % of the sprint</td><td>≥ ${esc(r.said_85)}</td><td>≥ ${esc(r.said_50)}</td><td><b>${esc(r.ended)}</b></td>
        <td><span class="pill ${r.held ? "ok" : "critical"}">${r.held ? "held" : "missed"}</span></td></tr>`).join("")}</tbody></table></div></details>`
      : `<div class="dim">Not enough history yet: the forecast needs 20 working days of sampled sprints before it is replayed.</div>`) + recordBlock(), "lookback") +
    panel("The outside view", `<span class="small dim">what past sprints completed, next to what is committed now</span>`, pastBars(p) +
      `<div class="legend"><span><i class="outline"></i>committed</span><span><i style="background:var(--accent)"></i>completed</span><span><i style="background:var(--ok)"></i>completed at least what is committed now</span></div>`, "outside") + `</div>`;
}

/* The risk register: the user's own notes (var/risks.json on this computer). Code offers signals as candidates and
   watches the signal behind each risk; the human decides what is a risk and what is done about it. */
const ROAM = {new: "New: not decided yet", owned: "Owned: someone takes it and acts", accepted: "Accepted: we live with it", mitigated: "Mitigated: a plan makes it smaller", resolved: "Resolved: no longer a risk"};
const riskEdits = {};           // risk id -> its fields as typed and not saved yet; "own": the line of a new risk. Kept while the page is open
const RISK_FIELDS = ["title", "roam", "owner", "review", "response"];
function riskCard(given){
  const typed = riskEdits[given.id], r = {...given, ...typed};
  return `<div class="risk" data-risk="${esc(r.id)}"><div class="risk-h"><span class="mono small dim">${esc(r.id)}</span><input name="title" value="${esc(r.title)}" maxlength="160" aria-label="Risk">
      ${typed ? `<span class="pill warning">not saved</span>` : ""}${r.roam === "new" ? `<span class="pill warning">nobody decided yet</span>` : ""}${r.review_due ? `<span class="pill warning">review is due</span>` : ""}${r.gone ? `<span class="pill ok">the signal is gone: resolve?</span>` : ""}</div>
    ${given.now && given.now !== given.title ? `<div class="small dim">Jira now: ${esc(given.now)}</div>` : ""}
    <div class="risk-f"><label>ROAM<select name="roam">${state.register.roam.map(x => `<option value="${esc(x)}" ${x === r.roam ? "selected" : ""}>${esc(ROAM[x] || x)}</option>`).join("")}</select></label>
      <label>Owner<input name="owner" value="${esc(r.owner)}" maxlength="60" placeholder="a role: PO, tech lead, the team"></label>
      <label>Review on<input name="review" type="date" value="${esc(r.review)}"></label>
      <label class="wide">Response<textarea name="response" rows="2" maxlength="600" placeholder="What is done about it, or why nothing">${esc(r.response)}</textarea></label></div>
    <div class="risk-b">${chips(r.keys)}<span class="grow"></span><span class="small dim">since ${esc(r.created)}</span><button class="btn" type="button" data-risk-do="save">Save</button></div></div>`;
}
function registerPanel(){
  const reg = state.register, open = reg.risks.filter(r => r.roam !== "resolved"), closed = reg.risks.filter(r => r.roam === "resolved");
  return panel("Risk register", `<span class="pill ${open.length ? "agent" : ""}">${open.length} open</span><span class="small dim">your notes, kept on this computer</span>`, `
      <div class="note-bad" id="risk-msg" hidden></div>
      ${open.length ? open.map(riskCard).join("") : `<div class="dim">Nothing is registered yet. Put a signal from the list below into the register, or add a risk of your own.</div>`}
      <div class="risk-new"><input id="risk-title" maxlength="160" value="${esc(riskEdits.own || "")}" placeholder="A risk of your own, in one line" aria-label="A risk of your own"><button class="btn" type="button" data-risk-do="own">Add</button></div>
      ${closed.length ? `<details class="dropped"><summary>${closed.length} resolved</summary><ul>${closed.map(r => `<li data-risk="${esc(r.id)}"><b>${esc(r.title)}</b> · resolved ${esc(r.closed)}
        <button type="button" class="chip" data-risk-do="reopen">reopen</button></li>`).join("")}</ul></details>` : ""}`, "register") +
    panel("Signals not in the register", `<span class="pill ${reg.candidates.length ? "warning" : "ok"}">${reg.candidates.length}</span>`, (reg.candidates.length ? `<table class="t stack lead"><tbody>${reg.candidates.map(c => `<tr data-signal="${esc(c.signal)}">
        <td><span class="dotl ${esc(c.level)}"></span></td><td>${keyed(c.title)}</td><td class="k"><button type="button" class="btn" data-risk-do="add">Add to register</button> <button type="button" class="chip" data-risk-do="dismiss">not a risk</button></td></tr>`).join("")}
      </tbody></table>` : `<div class="dim">Every signal in the Jira data is in the register or was set aside.</div>`) +
      (reg.dismissed.length ? `<details class="dropped"><summary>${reg.dismissed.length} set aside as “not a risk”</summary><ul>${reg.dismissed.map(d => `<li data-signal="${esc(d.signal)}">${esc(d.title || d.signal)} · ${esc(d.at)}
        <button type="button" class="chip" data-risk-do="restore">offer again</button></li>`).join("")}</ul></details>` : ""), "signals");
}
async function riskDo(button){
  const card = button.closest("[data-risk]"), row = button.closest("[data-signal]"), what = button.dataset.riskDo, field = name => $(`[name=${name}]`, card).value;
  const action = what === "save" ? {do: "update", id: card.dataset.risk, title: field("title"), roam: field("roam"), owner: field("owner"), review: field("review"), response: field("response")}
    : what === "reopen" ? {do: "update", id: card.dataset.risk, roam: "new"} : what === "own" ? {do: "add", title: $("#risk-title").value} : {do: what, signal: row.dataset.signal};
  const say = text => { const msg = $("#risk-msg"); if (msg){ msg.hidden = false; msg.textContent = text; } };
  button.disabled = true;                 // a second click must not send it twice
  try {
    const reply = await fetch("api/risks", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(action)});
    if (!reply.ok) return say((await reply.json()).error || reply.statusText);
    if (what === "save") delete riskEdits[card.dataset.risk];           // only this card is saved: what is typed in the others stays
    if (what === "own") delete riskEdits.own;
    await load(false, true);
  } catch (error){ say("The change did not reach the app: " + error.message); }
  finally { button.disabled = false; }
}
$("#v-risks").addEventListener("click", e => { const b = e.target.closest("[data-risk-do]"); if (b) riskDo(b); });
$("#v-risks").addEventListener("input", e => {
  const card = e.target.closest(".risk");
  if (card) riskEdits[card.dataset.risk] = Object.fromEntries(RISK_FIELDS.map(name => [name, $(`[name=${name}]`, card).value]));
  else if (e.target.id === "risk-title") riskEdits.own = e.target.value;
});
// A tab with the cursor in one of its fields is not redrawn; when the cursor leaves, it catches up.
const typingIn = el => el.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
$("#v-risks").addEventListener("focusout", () => setTimeout(() => { if (state) renderRisks(); }, 0));
$("#v-inbox").addEventListener("focusout", () => setTimeout(() => { if (state) renderInbox(); }, 0));

/* The pre-mortem: the running sprint next to the team's own closed sprints, measured at the same point of the sprint
   (sm/premortem.py). A likely reason is offered to the risk register like every other signal. */
function premortemPanel(){
  const p = state.views.premortem, reg = state.register, n = p.history.length, found = p.reasons.map(id => p.signs.find(s => s.id === id));
  const val = (v, unit) => v == null ? "—" : `${esc(v)} ${esc(unit)}`;
  const where = signal => reg.candidates.some(c => c.signal === signal) ? `<button type="button" class="btn" data-risk-do="add">Add to register</button>`
    : reg.risks.some(r => r.signal === signal && r.roam !== "resolved") ? `<span class="pill agent">in the register</span>` : `<span class="pill">set aside</span>`;
  const end = state.sprint.end || "", keys = id => (p.keys[id] || []).slice(0, 12);
  return panel("Pre-mortem: suppose this sprint misses its promise", (p.why_not || !p.running ? `<span class="pill">no verdict</span>` : `<span class="pill ${found.length ? "warning" : "ok"}">${found.length} likely reason${found.length === 1 ? "" : "s"}</span>`) +
      `<span class="small dim">${n} closed sprint${n === 1 ? "" : "s"} behind it, ${esc(p.missed)} missed</span>`,
    (!p.running ? `<div class="dim">The sprint shown is closed. A pre-mortem is for a running sprint; the table shows how the sprints compare at their end.</div>`
      : p.why_not ? `<div class="dim">${esc(p.why_not)}. Until then the table shows the signs sprint by sprint, and nothing is concluded from them.</div>`
      : `<div class="pulse">It is ${esc(end.slice(8, 10))}.${esc(end.slice(5, 7))} and the sprint missed its promise. The most likely reasons, each with <b>how often it came before a miss in this team's own history</b>, not in a textbook.</div>` +
        (found.length ? `<table class="t stack lead"><tbody>${found.map((s, i) => `<tr data-signal="premortem:${esc(p.sprint)}:${esc(s.id)}"><td class="mono dim">${i + 1}</td>
            <td><b>${esc(s.risk[0].toUpperCase() + s.risk.slice(1))}</b><div class="small dim">${esc(s.label)}: ${val(s.now, s.unit)} · as much or ${esc(s.worse)} in ${esc(s.missed_as_bad)} of ${esc(s.missed_n)} sprints that missed
              and in ${esc(s.kept_as_bad)} of ${esc(s.kept_n)} that kept their promise</div>${keys(s.id).length ? chips(keys(s.id)) : ""}</td>
            <td class="k">${where("premortem:" + p.sprint + ":" + s.id)}</td></tr>`).join("")}</tbody></table>`
          : `<div class="dim">No sign of today came before a miss more often than before a kept promise.</div>`)) +
    `<div class="tw"><table class="t"><thead><tr><th>Sign${p.running ? `, at ${esc(p.share)} % of the sprint` : ", at the end of the sprint"}</th><th>${p.running ? "Now" : "This sprint"}</th>
        ${p.history.map(h => `<th>${esc(short(h.name))} <span class="pill ${h.kept ? "ok" : "critical"}">${h.kept ? "kept" : "missed"} · ${esc(h.said_done)} %</span></th>`).join("")}</tr></thead>
      <tbody>${p.signs.map(s => `<tr><td>${esc(s.label)}</td><td><b>${val(s.now, s.unit)}</b></td>${p.history.map(h => `<td>${val(h.values[s.id], s.unit)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="small dim">A sprint kept its promise when at least ${esc(p.kept_from)} % of what it committed at the start was done at its end. The past sprints are measured at the same point of the sprint as now.
      A reason needs ${esc(p.min_history)} closed sprints with a miss and a kept promise among them. Resemblance, not proof.</div>`, "premortem");
}

function renderRisks(){
  if (typingIn($("#v-risks"))) return;
  const r = state.views.risks, block = (title, tone_, keys, why, help) => panel(title, `<span class="pill ${keys.length ? tone_ : "ok"}">${keys.length}</span>`, `<div class="small dim">${why}</div>${issueTable(keys)}`, help);
  $("#v-risks").innerHTML = registerPanel() + premortemPanel() + `<div class="pulse">Below: the signals as lists, read from Jira. They say where to look; what is a risk and what is done about it is in the register above.</div>` +
    `<div class="grid2">` + block("Blocked", "critical", r.blocked, "Open items of the sprint in the status Blocked.", "blocked") +
      block("Carried over", "warning", r.carried, "Open items in their third sprint of this board or later.", "carried") + `</div>` +
    block("Longest in one status", "", r.aging.slice(0, 12), "Open items past the first column of the board, the longest wait first.", "aging") +
    block("Came in after the start", "warning", r.added, "Still in the sprint. What was taken out again is listed under Sprint → Scope changes.", "added");
}

/* Incident reports: what a triage agent wrote about production. Their text is a model's text: shown here, escaped,
   and nowhere else. */
function incidentPanels(){
  const p = state.views.incidents, tone_ = {high: "ok", medium: "warning", low: "critical"};
  if (!p) return panel("Incident reports", "", `<div class="dim">No report in this data.</div>`, "incidents");
  return `<div class="grid2">` + panel("Incident reports", `<span class="pill ${p.week ? "warning" : "ok"}">${esc(p.week)} this week</span><span class="pill">${esc(p.total)} in the folder</span>`,
      p.reports.length ? p.reports.map(r => `<details class="rep"><summary><span class="mono small dim">${esc(when(r.at))}</span><b>${esc(r.title)}</b>
          ${r.confidence ? `<span class="pill ${tone_[r.confidence]}">confidence ${esc(r.confidence)}</span>` : `<span class="pill">no confidence stated</span>`}
          ${r.service ? `<span class="mono small">${esc(r.service)}</span>` : ""}${r.error_events != null ? `<span class="small dim">${esc(r.error_events)} error events</span>` : ""}</summary>
        <div class="rep-b"><div>${esc(r.root_cause) || `<span class="dim">The report gives no root cause.</span>`}</div>
          ${r.steps.length ? `<ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
          <div class="small dim">${[r.severity && `severity ${esc(r.severity)}`, r.alert && `alert ${esc(r.alert)}`, r.error_rate && `error rate ${esc(r.error_rate)}`, r.domain && `domain ${esc(r.domain)}`].filter(Boolean).join(" · ")}</div>
          <div class="small dim mono">${esc(r.file)}</div></div></details>`).join("") : `<div class="dim">The folder holds no report.</div>`, "incidents") +
    panel("What we pay for more than once", `<span class="pill ${p.recurring.length ? "warning" : "ok"}">${p.recurring.length}</span><span class="small dim">two reports or more in 90 days</span>`,
      p.recurring.length ? `<table class="t"><thead><tr><th>Service or feature</th><th>Reports</th><th>Last</th></tr></thead><tbody>${p.recurring.map(x => `<tr><td class="mono small">${esc(x.what)}</td><td><b>${esc(x.n)}</b></td><td class="k">${esc(when(x.last))}</td></tr>`).join("")}</tbody></table>
        <div class="small dim">Grouped by the service the report resolved; by its title when it resolved none. ${esc(p.low_confidence)} of the reports of these 90 days state low confidence.</div>`
      : `<div class="dim">Nothing came back in the last 90 days.</div>`, "recurring") + `</div>`;
}

/* What the team runs: the service catalogue, with links to where each service can be looked at. */
function servicesPanel(){
  const s = state.services, title = "What the team runs", out = l => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.key)}</a>`;
  if (!s || s.status !== "ok") return panel(title, `<span class="pill">not in this data</span>`, `<div class="dim">${esc(s ? s.detail : "")}</div>`, "services");
  const d = s.domain;
  return panel(title, `<span class="small dim">service catalogue · ${esc(d.id)} · asked ${esc(when(s.asked))}</span>`, `
    <div><b>${esc(d.name || d.id)}</b> <span class="small dim">${esc(d.description)}</span></div>
    ${s.apps.length ? `<div class="tw"><table class="t"><thead><tr><th>Service</th><th>Environment</th><th>Links</th></tr></thead><tbody>${s.apps.map(a => a.envs.map((e, i) => `<tr>
      <td>${i ? "" : `<b class="mono small">${esc(a.app)}</b>`}</td><td>${esc(e.env)}</td><td><div class="chips">${e.links.map(out).join("") || `<span class="dim small">none</span>`}</div></td></tr>`).join("")).join("")}</tbody></table></div>`
      : `<div class="dim">The catalogue lists no service for this team.</div>`}
    ${s.links.length ? `<div class="chips">${s.links.map(out).join("")}</div>` : ""}
    ${s.kafka.length ? `<div class="small dim">Message topics: ${s.kafka.map(esc).join(", ")}</div>` : ""}
    <div class="small dim">The links of the demo lead nowhere: they stand for the consoles, dashboards and logs of each service.</div>`, "services");
}

function renderOps(){
  const v = state.views, n = state.notices, mix = v.sprint.mix, all = mix.reduce((a, m) => a + m.n, 0);
  $("#v-ops").innerHTML = `<div class="grid2">` + panel("What reached the team", `<span class="pill ${n.length ? "warning" : "ok"}">${n.length}</span>`, n.length ?
      `<table class="t stack"><tbody>${n.map(x => `<tr><td class="k">${esc(when(x.at))}</td><td>${chip(x.key)}</td><td>${esc(x.text)}</td></tr>`).join("")}</tbody></table>` : `<div class="dim">Nothing in the last days.</div>`, "notices") +
    panel("Open bugs and incidents of the sprint", `<span class="pill ${v.operations.open_bugs.length ? "warning" : "ok"}">${v.operations.open_bugs.length}</span>`, v.operations.open_bugs.length ?
      `<table class="t"><thead><tr><th>Issue</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>${v.operations.open_bugs.map(k => `<tr><td>${chip(k)}</td><td>${esc(I(k).type)}</td><td>${esc(I(k).status)}</td><td>${esc(when(I(k).created))}</td></tr>`).join("")}</tbody></table>`
      : `<div class="dim">None.</div>`, "bugs") + `</div>` +
    panel("What kind of work the sprint holds", `<span class="small dim">bugs and incidents are the part operations take from the sprint</span>`,
      `<table class="t"><thead><tr><th>Type</th><th>Items</th><th>Share of items</th><th>SP</th><th>Done</th></tr></thead><tbody>${mix.map(m => `<tr><td><b>${esc(m.type)}</b></td><td>${m.n}</td>
        <td><span class="share"><i style="width:${all ? Math.round(100 * m.n / all) : 0}%"></i></span></td><td>${esc(m.sp)}</td><td>${esc(plural(m.done_n, "item"))} · ${esc(m.done_sp)} SP</td></tr>`).join("")}</tbody></table>`, "mix") +
    servicesPanel() + incidentPanels();
}

function renderSprint(){
  const v = state.views, s = v.sprint, sc = s.scope, st = state.sprint;
  const row = (name, part, note) => `<tr><td><b>${name}</b><div class="small dim">${note}</div></td><td data-l="Items">${part.n}</td><td data-l="SP">${esc(part.sp)}</td><td>${chips(part.keys)}</td></tr>`;
  $("#v-sprint").innerHTML = panel(`Sprint on the line · ${esc(st.name)}`, `<span class="pill">${esc(when(st.start))} to ${esc(when(st.end))}</span><span class="pill">${esc(st.state)}</span>`,
      `<div class="line">${s.columns.map((c, i) => `<div class="stop" style="--tone:${tone(i, s.columns.length, c.name)}"><div class="stop-h"><b>${esc(c.name)}</b><span>${c.keys.length} · ${esc(c.sp)} SP</span></div>${chips(c.keys)}</div>`).join("")}</div>
       <div class="small dim">The columns of the Jira board, left to right. “Done” for the sprint report is the last one: ${esc(s.done_column)}. The small number on an item is its story points.</div>`, "line") +
    `<div class="grid2">` + panel("Story points view", `<span class="small dim">as Jira's sprint report counts</span>`, `<div class="tw"><table class="t stack"><thead><tr><th></th><th>Items</th><th>SP</th><th>Issues</th></tr></thead><tbody>
        ${row("Committed", sc.committed, "in the sprint when it started, with the points of that moment")}${row("Added", sc.added, "came in after the start, with the points at that moment")}
        ${row("Taken out", sc.removed, "were in it, are not any more")}${row("Done", sc.done, "in the last column now")}${row("Not done", sc.not_done, "still open")}
        ${sc.done_before.n ? row("Done before they came in", sc.done_before, "Jira lists them apart") : ""}</tbody></table></div>`, "scope") +
    panel("Scope changes", `<span class="pill ${s.changes.length ? "warning" : "ok"}">${s.changes.length}</span>`, s.changes.length ?
      `<table class="t stack"><tbody>${s.changes.map(c => `<tr><td class="k">${esc(when(c.at))}</td><td>${chip(c.key)}</td><td>${esc(c.what)}</td><td class="k">${c.sp == null ? "no points" : esc(c.sp) + " SP"}</td></tr>`).join("")}</tbody></table>`
      : `<div class="dim">Nothing came in or went out after the start.</div>`, "changes") + `</div>` +
    panel("Sprint backlog", `<span class="small dim">open items, the longest in their status first</span>`, issueTable([...sc.not_done.keys].sort((a, b) => (I(b).days || 0) - (I(a).days || 0))), "backlog");
}

function renderFlow(){
  const v = state.views, f = v.flow, aging = v.risks.aging, longest = Math.max(1, ...aging.map(k => I(k).days || 0));
  $("#v-flow").innerHTML = `<div class="grid2">` + panel("Cycle time", `<span class="small dim">${f.cycle.length} items the sampled sprints completed</span>`, scatter(f) +
      `<div class="small dim">From the first status past the first column of the board to done. Red dots are bugs and incidents; hover a dot for its issue.</div>`, "cycle") +
    panel("Aging work in progress", `<span class="small dim">days in the current status</span>`, aging.length ? `<div class="bars">${aging.slice(0, 14).map(k => `<div class="bar-row">${chip(k)}<span class="small dim">${esc(I(k).status)}</span>
        <span class="share wide"><i class="${f.cycle_p85 != null && I(k).days > f.cycle_p85 ? "hot" : ""}" style="width:${Math.round(100 * (I(k).days || 0) / longest)}%"></i></span><b>${esc(num(I(k).days))} d</b></div>`).join("")}</div>
        ${f.cycle_p85 != null ? `<div class="small dim">Red: longer in one status than 85 % of completed items needed from start to done (${esc(f.cycle_p85)} days).</div>` : ""}` : `<div class="dim">Nothing is in progress.</div>`, "wip") + `</div>` +
    panel("Cumulative flow, this sprint", `<span class="small dim">items of the sprint in each column at the end of each working day</span>`, stacked(f), "cfd");
}

function renderHygiene(){
  const checks = state.views.hygiene, found = checks.reduce((a, c) => a + (c.keys ? c.keys.length : 0), 0);
  $("#v-hygiene").innerHTML = panel("Jira hygiene · the sprint", `<span class="pill ${found ? "warning" : "ok"}">${plural(found, "finding")}</span>`, `<ul class="checks">${checks.map(c => `<li><details ${c.keys && c.keys.length ? "open" : ""}>
      <summary><span class="ic ${!c.keys ? "na" : c.keys.length ? "warn" : "ok"}">${!c.keys ? "?" : c.keys.length ? "!" : "✓"}</span><span>${esc(c.check)}</span><span class="cnt">${c.keys ? c.keys.length : "—"}</span></summary>
      ${c.keys ? chips(c.keys) : `<div class="small dim">${esc(c.why)}</div>`}</details></li>`).join("")}</ul>`, "hygiene");
}

/* Inbox: drafts composed by code from the facts. The app sends nothing: the user copies a text and sends it. */
const edited = {};              // draft id -> the text as the user changed it, kept while the page is open
function renderInbox(){
  const box = state.inbox, here = $("#v-inbox");
  if (typingIn(here)) return;             // somebody is typing: do not redraw under the cursor
  here.innerHTML = `<div class="pulse">The app writes to no other system. Each draft is composed by code from the facts of this page, so its numbers are the page's numbers. Change it, copy it, send it yourself; “I sent it” keeps a copy on this computer.</div>
    <div class="note-bad" id="inbox-msg" hidden></div>` +
    box.drafts.map(d => `<div class="w draft" data-draft="${esc(d.id)}"><div class="wh"><h2>${esc(d.title)}${helpTip("drafts")}</h2><div class="meta"><span class="small dim">for ${esc(d.to)}</span><span class="pill">${d.facts.length} facts behind it</span></div></div>
      <textarea rows="${Math.min(24, (edited[d.id] ?? d.text).split("\n").length + 1)}" spellcheck="false" aria-label="${esc(d.title)}">${esc(edited[d.id] ?? d.text)}</textarea>
      <div class="risk-b"><button class="btn" type="button" data-draft-do="copy">Copy</button><button class="btn" type="button" data-draft-do="sent">I sent it</button>
        ${edited[d.id] != null ? `<button class="chip" type="button" data-draft-do="reset">back to the generated text</button>` : ""}<span class="grow"></span><span class="small dim" data-draft-note></span></div></div>`).join("") +
    panel("Sent", `<span class="small dim">your own record, kept on this computer only</span>`, box.sent.length ? box.sent.map(s => `<details class="rep"><summary><span class="mono small dim">${esc(when(s.at))}</span><b>${esc(s.title)}</b>
        <span class="small dim">${esc(s.sprint)} · for ${esc(s.to)}</span></summary><pre class="sent">${esc(s.text)}</pre></details>`).join("") : `<div class="dim">Nothing yet.</div>`, "sent");
}
async function draftDo(button){
  const card = button.closest("[data-draft]"), id = card.dataset.draft, area = $("textarea", card), note = $("[data-draft-note]", card), what = button.dataset.draftDo;
  if (what === "reset"){ delete edited[id]; return renderInbox(); }
  if (what === "copy"){
    try { await navigator.clipboard.writeText(area.value); note.textContent = "copied"; }
    catch (error){ area.select(); note.textContent = "select it and press Ctrl C: the browser did not allow copying"; }
    return;
  }
  const say = text => { const msg = $("#inbox-msg"); msg.hidden = false; msg.textContent = text; };
  button.disabled = true;                 // a second click must not record it twice
  try {
    const reply = await fetch("api/outbox", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({kind: id, text: area.value})});
    if (!reply.ok) return say((await reply.json()).error || reply.statusText);
    delete edited[id];
    await load(false, true);
  } catch (error){ say("It did not reach the app: " + error.message); }
  finally { button.disabled = false; }
}
$("#v-inbox").addEventListener("click", e => { const b = e.target.closest("[data-draft-do]"); if (b) draftDo(b); });
$("#v-inbox").addEventListener("input", e => { const card = e.target.closest("[data-draft]"); if (card) edited[card.dataset.draft] = e.target.value; });

/* Code: pull requests of the team, as far as they concern the sprint: where review time goes and what waits. */
function weekBars(weeks){
  const w = chartW(), h = 220, x0 = 44, x1 = w - 16, y0 = 14, y1 = h - 30;
  if (!weeks.length) return `<div class="dim">No merged pull request with a review in these weeks.</div>`;
  const top = Math.max(1, ...weeks.map(k => k.first_review_h)) * 1.1, step = (x1 - x0) / weeks.length, bar = Math.min(46, step * .6), y = val => y0 + (y1 - y0) * (1 - val / top);
  return frame(w, h, axes(top / 1.1, x0, x1, y, " h") + weeks.map((k, i) => { const c = x0 + step * (i + .5); return `<rect class="b-done" x="${c - bar / 2}" y="${y(k.first_review_h)}" width="${bar}" height="${y1 - y(k.first_review_h)}"><title>${esc(k.n)} pull requests</title></rect>
    <text class="ax" x="${c}" y="${y(k.first_review_h) - 5}" text-anchor="middle">${esc(k.first_review_h)}</text><text class="ax" x="${c}" y="${h - 10}" text-anchor="middle">${esc(k.week.slice(5))}</text>`; }).join(""), "Hours to the first review, per week");
}
function sizeDots(sizes){
  const w = chartW(), h = 220, x0 = 44, x1 = w - 16, y0 = 14, y1 = h - 30;
  if (!sizes.length) return `<div class="dim">No merged pull request in these weeks.</div>`;
  const fx = Math.max(1, ...sizes.map(s => s.files)), fy = Math.max(1, ...sizes.map(s => s.days)) * 1.08, x = v => x0 + (x1 - x0) * v / fx, y = v => y0 + (y1 - y0) * (1 - v / fy);
  return frame(w, h, axes(fy / 1.08, x0, x1, y, " d") + sizes.map(s => `<circle class="pt ${s.rounds > 1 ? "bug" : ""}" cx="${x(s.files).toFixed(1)}" cy="${y(s.days).toFixed(1)}" r="4"><title>${esc(s.files)} files · ${esc(s.days)} days · ${esc(s.rounds)} rounds of rework</title></circle>`).join("") +
    `<text class="ax" x="${x0}" y="${h - 8}">0 files</text><text class="ax" x="${x1}" y="${h - 8}" text-anchor="end">${esc(fx)} files</text>`, "Files changed against days to merge");
}
function renderCode(){
  const c = state.views.code;
  if (!c){ $("#v-code").innerHTML = `<div class="pulse">No pull requests in this data.</div>` + deliveryPanels(); return; }
  const slow = c.open.filter(r => r.waiting_h >= 24).length, tone_ = {"waiting for a first review": "warning", "in review": "agent", "approved, not merged": "ok"};
  const prRow = r => `<tr><td class="k"><span class="mono small">${esc(r.repo.split("/").pop())} #${esc(r.id)}</span></td><td>${chips(r.keys)}</td><td><span class="pill ${tone_[r.phase] || ""}">${esc(r.phase)}</span></td>
    <td><b class="${r.waiting_h >= 24 ? "late" : ""}">${esc(r.waiting_h)} h</b></td><td>${esc(r.age_days)} d</td><td>${esc(r.approvals)} of ${esc(r.reviewers)}</td><td>${esc(r.rounds)}</td><td>${esc(r.comments)}</td><td>${esc(r.files)}</td></tr>`;
  const prTable = rows => `<div class="tw"><table class="t"><thead><tr><th>Pull request</th><th>Issues</th><th>Where it stands</th><th>Waiting</th><th>Age</th><th>Approved</th><th>Rounds</th><th>Comments</th><th>Files</th></tr></thead><tbody>${rows.map(prRow).join("")}</tbody></table></div>`;
  const talkTable = rows => `<div class="tw"><table class="t"><thead><tr><th>Pull request</th><th>Issues</th><th>Comments</th><th>Rounds of rework</th><th>Files</th></tr></thead><tbody>${rows.map(r => `<tr>
    <td class="k"><span class="mono small">${esc(r.repo.split("/").pop())} #${esc(r.id)}</span></td><td>${chips(r.keys)}</td><td><b>${esc(r.comments)}</b></td><td>${esc(r.rounds)}</td><td>${esc(r.files)}</td></tr>`).join("")}</tbody></table></div>`;
  $("#v-code").innerHTML = `<div class="kpis k4"><div class="kpi"><span class="lbl">Merged in ${esc(c.window_days / 7)} weeks</span><span class="v">${esc(c.merged)}</span><span class="d">${esc(c.unreviewed)} without any review</span></div>
      <div class="kpi"><span class="lbl">Open to merged</span><span class="v">${esc(num(c.cycle_days_p50))}<small>days, half of them</small></span><span class="d">85 % within ${esc(num(c.cycle_days_p85))} days</span></div>
      <div class="kpi"><span class="lbl">First review after</span><span class="v">${esc(num(c.first_review_h_p50))}<small>h, half of them</small></span><span class="d">weekends left out</span></div>
      <div class="kpi"><span class="lbl">Open now</span><span class="v">${c.open.length}</span><span class="d">${slow} waiting a day or more</span></div></div>` +
    panel("Where pull request time goes", `<span class="small dim">merged pull requests of the last ${esc(c.window_days / 7)} weeks · hours without weekends</span>`, `
      <div class="split"><i style="width:${esc(c.share.first_review)}%;background:var(--warn)"></i><i style="width:${esc(c.share.review)}%;background:var(--accent)"></i><i style="width:${esc(c.share.merge)}%;background:var(--ok)"></i></div>
      <div class="legend"><span><i style="background:var(--warn)"></i>waiting for a first review: ${esc(c.share.first_review)} % · half within ${esc(num(c.first_review_h_p50))} h</span>
        <span><i style="background:var(--accent)"></i>in review: ${esc(c.share.review)} % · half within ${esc(num(c.review_h_p50))} h</span>
        <span><i style="background:var(--ok)"></i>approved, waiting for the merge: ${esc(c.share.merge)} % · half within ${esc(num(c.merge_wait_h_p50))} h</span></div>`, "prtime") +
    panel("Team PR inbox", `<span class="pill ${slow ? "warning" : "ok"}">${c.open.length} open</span><span class="small dim">the longest wait first · by role, never by name</span>`, c.open.length ? prTable(c.open) : `<div class="dim">No open pull request.</div>`, "prinbox") +
    `<div class="grid2">` + panel("Review wait per week", `<span class="small dim">hours to the first review, half of the pull requests opened that week</span>`, weekBars(c.weeks), "prweek") +
      panel("Size and time", `<span class="small dim">files changed against days to merge · red: more than one round of rework</span>`, sizeDots(c.sizes), "prsize") + `</div>` +
    `<div class="grid2">` + panel("Most discussed", "", c.discussed.length ? talkTable(c.discussed) : `<div class="dim">No comments in these weeks.</div>`, "prtalk") +
      panel("Hotspots: where code changes and bugs meet", `<span class="small dim">files changed by two pull requests or more</span>`, c.hotspots.length ? `<table class="t"><thead><tr><th>File</th><th>Pull requests</th><th>Of them for a bug</th></tr></thead><tbody>
        ${c.hotspots.map(f => `<tr><td class="mono small">${esc(f.path)}</td><td>${esc(f.prs)}</td><td>${f.bug_prs ? `<b class="late">${esc(f.bug_prs)}</b>` : "0"}</td></tr>`).join("")}</tbody></table>` : `<div class="dim">No file was changed twice.</div>`, "hotspots") + `</div>` +
    panel("Did the work really start?", `<span class="pill ${c.no_pr.length ? "warning" : "ok"}">${c.no_pr.length}</span>`, `<div class="small dim">Items of the sprint that Jira shows in progress for three days or more and that no pull request names. A branch without a pull request is not seen.</div>${chips(c.no_pr)}`, "nopr") +
    `<div class="small dim">Pull requests of ${c.repos.map(esc).join(", ")} · as of ${esc(when(c.fetched))}</div>` + deliveryPanels();
}

// The tabs are drawn anew with every new state. What the user had opened (a report, a list) stays open: a block is
// known by its summary line.
function renderViews(){
  const tabs = $$(".tabbody[id^=v-]"), line = s => s.textContent.trim().slice(0, 120);
  const open = tabs.map(tab => new Set($$("details[open] > summary", tab).map(line)));
  renderPromises(); renderRisks(); renderOps(); renderSprint(); renderFlow(); renderHygiene(); renderCode(); renderQuality(); renderInbox();
  tabs.forEach((tab, i) => { if (open[i].size) $$("details > summary", tab).forEach(s => { if (open[i].has(line(s))) s.parentNode.open = true; }); });
}

