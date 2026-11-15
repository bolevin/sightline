/* Sightline: renders the state of api/today. Everything that comes from Jira or from an agent goes through esc(). */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
// A text of the data with every issue key the page knows made a place for its card: the text is escaped first, and
// a key is capital letters, digits and a hyphen, so nothing of it can be markup.
const keyed = s => esc(s).replace(/\b[A-Z][A-Z0-9_]+-\d+\b/g, k => state && state.cards && state.cards[k] ? `<span class="ik" data-issue="${k}">${k}</span>` : k);
// Times are shown as Jira wrote them (its own clock), whatever the time zone of this browser is.
const when = iso => {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(iso || "");
  if (!m) return "—";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()];
  return `${day} ${m[3]}.${m[2]} ${m[4]}:${m[5]}`;
};
const CARDS = {
  promises: ["Promises", "What did we promise, and will we keep it?"],
  risks: ["Risks", "What can hurt us?"],
  operations: ["Operations", "What does production say?"],
};
const COMPOSED = {
  rules: "This page is laid out by rules",
  mixed: "✦ The briefing agent composed part of this page",
  agent: "✦ The briefing agent composed this page",
};
let state = null;
// A phone: the charts are drawn for a narrow screen and long tables fold. Decided by the width of the window, and
// drawn anew when the window crosses it (a phone turned on its side).
const PHONE = window.matchMedia ? matchMedia("(max-width: 700px)") : {matches: false};
const TOUCH = window.matchMedia ? matchMedia("(hover: none)") : {matches: false};
const chartW = () => PHONE.matches ? 350 : 760;

/* Choices of this browser: the palette, and where the Ask window stands. Storage can be missing or refuse (a private
   window): then the defaults apply. */
const stored = key => { try { return localStorage.getItem("sightline." + key) || ""; } catch (error){ return ""; } };
const store = (key, value) => { try { localStorage.setItem("sightline." + key, value); } catch (error){ /* not remembered */ } };
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
const PALETTES = {sightline: ["Sightline", "paper and deep teal, amber marks"], dusk: ["Sightline dusk", "the same colours after dark"],
  auto: ["Auto", "follows the system: Day or Console"], day: ["Day", "all light"], console: ["Console", "all dark"], classic: ["Classic", "a light page with a dark desk"],
  night: ["Night", "dark blue, little glare"]};
// Page, desk, accent, lamp: a small preview of each palette in the menu.
const SWATCH = {sightline: ["#F3F5F4", "#0F2E33", "#0F5C63", "#F5B83D"], dusk: ["#0B1416", "#132024", "#5CC8CF", "#F5B83D"],
  auto: ["#E9EEEC", "#DCE4E0", "#18211E", "#0C1210"], day: ["#E9EEEC", "#DCE4E0", "#0B6870", "#B87800"], console: ["#0C1210", "#18211E", "#4FB8C0", "#F2C14C"],
  classic: ["#E9EEEC", "#26302C", "#0B6870", "#F2C14C"], night: ["#0A0F1D", "#152038", "#7FA4F2", "#D6AC4C"]};
const ASKED = new URLSearchParams(location.search);       // ?palette=dusk and ?ask=1 open the page in a given look: for links and screenshots
const DARK = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
const swatch = id => SWATCH[id].map(colour => `<i style="background:${colour}"></i>`).join("");
function applyPalette(name){            // a name this page does not know (an old value of the browser) gives the default
  const choice = PALETTES[name] ? name : "sightline";
  document.documentElement.dataset.palette = choice === "auto" ? (DARK && DARK.matches ? "console" : "day") : choice;
  $("#pal-name").textContent = PALETTES[choice][0];
  $("#pal-now").innerHTML = swatch(choice);
  $$("#pal-menu .pal-opt").forEach(option => option.setAttribute("aria-checked", option.dataset.palette === choice));
}
$("#pal-menu").innerHTML = Object.entries(PALETTES).map(([id, [name, note]]) => `<button type="button" class="pal-opt" role="menuitemradio" aria-checked="false" data-palette="${id}">
    <span class="swatch">${swatch(id)}</span><span>${name} <span class="dim">· ${note}</span></span></button>`).join("") + `<div class="pal-note">Remembered in this browser.</div>`;
applyPalette(ASKED.get("palette") || stored("palette"));
if (DARK && DARK.addEventListener) DARK.addEventListener("change", () => applyPalette(stored("palette")));
document.addEventListener("click", e => {
  const option = e.target.closest(".pal-opt"), menu = $("#pal-menu");
  if (option){ store("palette", option.dataset.palette); applyPalette(option.dataset.palette); }
  menu.hidden = !(e.target.closest("#pal-btn") && menu.hidden);
  $("#pal-btn").setAttribute("aria-expanded", !menu.hidden);
});

function card(id, title, meta, body, help){ $("#" + id).innerHTML = `<div class="wh"><h2>${title}${help ? helpTip(help) : ""}</h2><div class="meta">${meta || ""}</div></div>${body}`; }

// What the briefing agent is doing, in a few words.
function agentLine(a){ return a.status === "ok" ? "a recorded reply, checked by code just now" : "none in this data, see System"; }

function renderToday(){
  const s = state, a = s.agent, d = s.data, by = s.composed.by, dropped = s.composed.problems;
  $("#team").textContent = s.team;
  $("#fresh").textContent = `${d.synthetic ? "Demo data" : "Data"} of ${when(d.fetched)}`;
  document.title = `Sightline · ${s.sprint.name}`;
  card("composed", COMPOSED[by] || COMPOSED.rules,
    `<span class="pill ${by === "rules" ? "rules" : "agent"}">${esc(by)}</span><span class="pill">${esc(when(s.composed.at))}</span>`,
    `<div class="pulse"><b>${esc(s.sprint.name)}</b> · ${keyed(s.page.headline)}</div>
     <div class="verify"><span>${s.facts.length} facts computed from the data</span><span>every line on this page cites its facts: click a line</span>
       <span>briefing agent: ${esc(agentLine(a))}</span></div>
     ${dropped.length ? `<details class="dropped" ${PHONE.matches ? "" : "open"}><summary>The check dropped ${dropped.length} part${dropped.length > 1 ? "s" : ""} of the agent's reply</summary>
       <ul>${dropped.map(p => `<li>${keyed(p)}</li>`).join("")}</ul></details>` : ""}`, "composed");
  $("#cards").innerHTML = s.page.cards.map(c => `<div class="qcard"><div class="qk"><span>${CARDS[c.id][0]}</span><span>${esc(c.by)}</span></div><h2>${CARDS[c.id][1]}${c.id === "promises" ? helpTip("cards") : ""}</h2>
      ${c.rows.map(r => `<button class="qrow" type="button" data-facts="${esc(r.facts.join("|"))}"><span class="dotl ${esc(r.level)}"></span><span>${keyed(r.text)}</span></button>`).join("")}
      ${c.note ? `<div class="qnote">${keyed(c.note)}</div>` : ""}
      ${c.id === "operations" ? `<div class="qnote">From Jira: bugs, incidents and what reached the team. The services the team runs and the incident reports are on the Operations tab.</div>` : ""}</div>`).join("");
  $("#now").innerHTML = s.now.map(k => { const tag = k.facts.length ? `button class="kpi" type="button" data-facts="${esc(k.facts.join("|"))}"` : `div class="kpi"`;
    return `<${tag}><span class="lbl">${esc(k.label)}</span><span class="v">${esc(k.value)}<small>${esc(k.unit)}</small></span><span class="d">${esc(k.note)}</span></${tag.split(" ")[0]}>`; }).join("");
  $("#options").innerHTML = optionsPanel();
  const rows = [...Object.keys(CARDS), "quality"].map(id => `<tr class="sec"><td colspan="4">${CARDS[id] ? CARDS[id][0] : "Quality: the facts of the Quality tab"}</td></tr>` + s.facts.filter(f => f.card === id).map(f =>
    `<tr><td class="mono small">${esc(f.id)}</td><td>${keyed(f.text)}</td><td><span class="pill ${esc(f.level)}">${esc(f.level)}</span></td>
     <td class="keys">${f.keys.slice(0, 8).map(keyed).join(" ")}${f.keys.length > 8 ? ` <span class="dim">+${f.keys.length - 8}</span>` : ""}</td></tr>`).join("")).join("");
  const table = `<div class="tw"><table class="t stack"><thead><tr><th>Fact</th><th>Says</th><th>Level by rules</th><th>Issues behind it</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  card("facts", "All facts", `<span class="small dim">what an agent may choose from, and nothing else</span>`,
    `${PHONE.matches ? `<details class="dropped"><summary>Show all ${s.facts.length} facts</summary>${table}</details>` : table}`, "facts");
}

function renderSystem(){
  const s = state, set = s.settings, a = s.agent, d = s.data, v = s.views;
  const kv = rows => `<table class="t">${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("")}</table>`;
  card("settings", "Team and sprint", `<span class="small dim">file ${esc(set.file)}</span>`, kv([
    ["Team", esc(s.team)], ["Board", `${s.board.id} · ${esc(s.board.name)}`], ["Sprint", `${s.sprint.id} · ${esc(s.sprint.name)} · ${esc(s.sprint.state)}`],
    ["Sprint dates", `${esc(when(s.sprint.start))} to ${esc(when(s.sprint.end))}`], ["“Done” means", `the column “${esc(s.board.done_column)}” of the board, as in Jira's sprint report`],
    ["Setting: sprint", set.sprint ? esc(set.sprint) : `<span class="dim">empty: the active sprint</span>`],
    ["Setting: data", `folder <span class="mono">${esc(set.data)}</span>`], ["Port", esc(set.port)]]), "settings");
  const row = (lamp, name, text) => `<tr><td><span class="dotl ${lamp}"></span></td><td><b>${name}</b></td><td>${text}</td></tr>`;
  card("sources", "Sources", "", `<table class="t"><thead><tr><th></th><th>Source</th><th>In this demo</th></tr></thead><tbody>` +
    row("ok", "Jira", `the folder <span class="mono">${esc(d.folder)}</span> in Jira's own format: issues with their history, sprints, the velocity chart · as of ${esc(when(d.fetched))}
      <div class="small dim">${d.synthetic ? "Invented for the demo: no team, issue or date in it is real. " : ""}Extra searches in the folder: ${d.searches.length ? d.searches.map(esc).join(", ") : "none"}. The full version reads Jira itself, with GET requests only.</div>`) +
    row(a.status === "ok" ? "ok" : "", "Agents", `${esc(a.detail)}<div class="small dim">The check of the reply is the real one. The full version asks agents that run on a model; they reach the data through the read-only tools and nothing else.</div>`) +
    row("ok", "Tools for agents", `four read-only tools answer at <span class="mono">/mcp</span> on this port (Model Context Protocol) · ${esc(s.tool_calls ?? 0)} calls since the start
      <div class="small dim">Point an agent runtime of your own at it: facts, sprint, issue, forecast.</div>`) +
    row(v.code ? "ok" : "", "Pull requests", v.code ? "a prepared view, made from invented pull requests" : "none in this data") +
    row(v.incidents ? "ok" : "", "Incident reports", v.incidents ? `a prepared view of ${esc(v.incidents.total)} invented reports` : "none in this data") +
    row(s.services.status === "ok" ? "ok" : "", "Service catalogue", s.services.status === "ok" ? "a prepared list of invented services" : "none in this data") +
    `</tbody></table>`, "sources");
  const k = s.storage, size = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B";
  card("storage", "Kept on this computer", `<span class="small dim">in ${esc(k.folder)} · never committed</span>`, `<div class="tw"><table class="t kept">
    <thead><tr><th>File</th><th>What it holds</th><th>Entries</th><th>Size</th></tr></thead><tbody>${k.files.map(f => `<tr><td class="k mono small">${esc(f.path)}</td>
      <td>${esc(f.what)}${f.exists ? "" : ` <span class="dim">· not there yet</span>`}</td><td class="k">${f.exists ? esc(f.entries) : "—"}</td><td class="k">${f.exists ? esc(size(f.bytes)) : "—"}</td></tr>`).join("")}</tbody></table></div>
    <div class="small dim"><b>Never kept:</b> ${k.never.map(esc).join(" · ")}.</div>
    <div class="small dim"><b>In this browser:</b> the palette, where the Ask window stands and which notices you have seen; the conversation stays in this tab until it is closed.</div>`, "storage");
  card("runs", "Agent runs", `<span class="small dim">what the check made of each reply</span>`, a.runs.length ? `<div class="tw"><table class="t">
    <thead><tr><th>When</th><th>Agent</th><th>Why</th><th>Result</th><th>What the check said</th></tr></thead><tbody>${a.runs.map(r => `<tr>
      <td class="k">${esc(when(r.at))}</td><td>${esc(r.kind)}</td><td>${esc(r.why)}</td>
      <td><span class="pill ${r.result === "failed" || r.result === "rules" ? "critical" : r.result === "mixed" ? "warning" : "ok"}">${esc(r.result)}</span></td>
      <td>${r.error ? `<div>${esc(r.error)}</div>` : ""}${esc(r.rows)} lines by the agent kept
        ${r.problems.length ? `<details class="dropped" open><summary>${r.problems.length} dropped</summary><ul>${r.problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul></details>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="dim">No reply of an agent in this data: the page is laid out by rules.</div>`, "runs");
  card("rules", "Rules the app keeps", "", `<ul style="margin:0;padding-left:18px;display:grid;gap:5px">
    <li><b>Code computes every number.</b> An agent may only choose among the facts and word them.</li>
    <li><b>An agent's reply is checked before it is shown.</b> A line whose digits or issue keys are not in the facts it cites is dropped; so is a share in words (“half”) and a “nothing” without a fact that is zero. What is left empty is laid out by rules. The check does not understand a sentence: it cannot tell whether two numbers of one line were swapped.</li>
    <li><b>Read-only.</b> Nothing here writes to Jira or to any other system. The server answers on this computer only and takes four things besides page loads: a tool call of an agent, which reads, a question of the Ask window, your own notes in the risk register and the texts you mark as sent. The last two are files on this computer.</li>
    <li><b>Agents have no hands.</b> They get four read-only tools and nothing else: no files, no shell, no web.</li>
    <li><b>Team level only.</b> No person is counted, ranked or named.</li>
    <li><b>A title is for your eyes only.</b> Rest the pointer on an issue key and its card shows the title, the type and the priority. No fact, no draft and no agent ever gets a title, and the app keeps no descriptions, comments or people.</li></ul>`, "rules");
  card("arch", "Architecture", `<span class="small dim">green: runs in this demo · grey: recorded or prepared here, live in the full version · dashed: next</span>`, `<div class="tw">${architecture()}</div>`, "arch");
}

function architecture(){
  const box = (x, y, w, h, t, lines = [], cls = "") => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/><text class="b" x="${x + 10}" y="${y + 17}">${t}</text>` +
    lines.map((l, i) => `<text class="d" x="${x + 10}" y="${y + 32 + i * 13}">${l}</text>`).join("");
  const ar = (d, cls = "") => `<path class="ar ${cls}" d="${d}"/>`, ln = d => `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.4"/>`;
  const band = (x, t) => `<text class="band" x="${x}" y="14">${t}</text>`;
  let g = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>`;
  g += band(10, "1 · Sources, read-only");
  [["Jira · issues and their history", "live"], ["Git hosting · pull requests", ""], ["Incident reports", ""], ["Service catalogue", ""]].forEach(([s, cls], i) => g += box(10, 26 + i * 32, 176, 26, s, [], cls));
  g += `<text class="d" x="10" y="166">next</text>`;
  ["Docs and wiki", "Builds and tests", "Monitoring", "Team chat"].forEach((s, i) => g += box(10, 174 + i * 32, 176, 26, s, [], "later"));
  g += ln("M186 39H198V283H186") + ar("M198 99H216");
  g += band(220, "2 · Collect and keep") + box(220, 40, 190, 78, "Collectors", ["read only, with GET requests", "titles and people stay", "in the source"]) +
    box(220, 150, 190, 78, "Fact store", ["one folder per read:", "issues with history,", "sprints, velocity"], "live") +
    box(220, 260, 190, 78, "Kept on this computer", ["your risk register,", "what you sent", "no titles, no people"], "live") + ar("M315 118V148");
  g += band(440, "3 · Code decides what is true");
  [["Metrics and forecast", "the sprint as Jira counts it, simulation"], ["Signals and notices", "blocked, carried over, new bugs"], ["Promises and risks", "options, pre-mortem, the register"],
   ["Calibration", "how often the forecast held"], ["Drafts", "texts for the Inbox, composed from facts"]]
    .forEach(([title, line], i) => g += box(440, 26 + i * 46, 200, 40, title, [line], "live") + ar(`M425 ${46 + i * 46}H438`));
  g += box(440, 268, 200, 52, "Read-only tools", ["over MCP:", "facts, sprint, issue, forecast"], "live");
  g += ln("M410 189H425") + ln("M410 300H425") + ln("M425 46V300") + ar("M540 252V266");
  g += band(670, "4 · Agents choose and word") + `<rect class="fr" x="664" y="26" width="212" height="200" rx="9"/><text class="d" x="674" y="42">any agent runtime · no write access</text>` +
    box(674, 54, 192, 46, "Briefing agent", ["words the Today page · no tools"]) + box(674, 108, 192, 46, "Question agent", ["the Ask window · four tools"]) +
    box(674, 162, 192, 46, "An agent of your own", ["point it at /mcp"], "live");
  g += ar("M640 294H652V131H672");
  g += band(900, "5 · Check, show, you send") + box(900, 40, 230, 78, "Check by code", ["the reply fits the schema", "every number equals a fact", "every key exists"], "live") +
    box(900, 140, 230, 52, "The page", ["Today, the evidence tabs, Ask"], "live") + box(900, 214, 230, 40, "Inbox", ["drafts by code: you copy and send"], "live") +
    box(900, 276, 230, 40, "You", ["nothing is sent for you"], "you");
  g += ar("M876 120H888V79H898") + ar("M1015 118V138") + ar("M1015 192V212") + ar("M1015 254V274");
  g += ar("M540 320V356H1142V166H1132", "dash") + `<text class="d" x="556" y="350">no agent, or its reply fails the check → the same facts, laid out by fixed rules</text>`;
  return `<svg class="arch" viewBox="0 0 1150 366" role="img" aria-label="Architecture: sources, collectors and what is kept, code, agents, check, page">${g}</svg>`;
}

/* the facts behind a line */
const pop = $("#pop");
function showFacts(anchor){
  const facts = anchor.dataset.facts.split("|").map(id => state.facts.find(f => f.id === id)).filter(Boolean);
  pop.setAttribute("aria-label", "Facts behind this line");
  pop.innerHTML = `<div class="ph">Facts behind this line</div>` + facts.map(f => `<div class="f"><span class="mono small dim">${esc(f.id)}</span><b>${keyed(f.text)}</b>
    ${f.keys.length ? `<span class="keys">${f.keys.slice(0, 30).map(keyed).join(" ")}${f.keys.length > 30 ? ` +${f.keys.length - 30}` : ""}</span>` : ""}</div>`).join("") +
    `<div class="small dim">Computed from the data of ${esc(when(state.data.fetched))}.</div>`;
  place(anchor);
}
// What a mark of a chart says. Where no pointer can rest on a mark, a tap shows it.
function showNote(anchor, text){
  pop.setAttribute("aria-label", "This mark");
  pop.innerHTML = `<div class="ph">This mark</div>`;
  pop.append(Object.assign(document.createElement("div"), {textContent: text}));
  place(anchor);
}
function place(anchor){
  pop.hidden = false;
  const r = anchor.getBoundingClientRect(), w = Math.min(420, innerWidth - 24);
  pop.style.left = Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12)) + "px";
  pop.style.top = (r.bottom + scrollY + 6) + "px";
}

/* The card of an issue: its title, type, priority and where it stands, gathered in one place. It shows while the
   pointer rests on an issue key anywhere on the page, or the key has the keyboard focus; a click keeps it open
   until a click elsewhere or Escape. The title comes from state.cards, which holds nothing but what a card shows:
   no fact, no draft and no agent ever gets a title. */
const icard = $("#icard");
const KIND = {Story: "story", Bug: "bug", Incident: "bug", Task: "task", "Sub-task": "sub"};
const PRIORITY = {Highest: ["▲▲", "top"], High: ["▲", "high"], Medium: ["＝", "mid"], Low: ["▼", "low"], Lowest: ["▼▼", "low"]};
let cardTimer = 0, cardPinned = false;
function statusTone(name){
  const columns = state.views.sprint.columns.map(c => c.name), at = columns.indexOf(name);
  return /block/i.test(name) ? "blocked" : at === columns.length - 1 ? "done" : at === 0 ? "todo" : /review|test|verif/i.test(name) ? "review" : "doing";
}
function issueCard(k){
  const c = state.cards[k], i = I(k);
  if (!c) return `<div class="ic-h"><span class="ic-key">${esc(k)}</span></div><div class="ic-t dim">This issue is not in the data.</div>`;
  const p = PRIORITY[c.priority], about = [];
  if (i.days != null) about.push(`${plural(i.days, "day")} in this status`);
  if (i.sprints > 1) about.push(`in its sprint no. ${i.sprints} on this board`);
  if (c.feature) about.push(`feature ${c.feature}`);
  if (c.team) about.push(`an issue of team ${c.team}`);
  return `<div class="ic-h"><span class="ic-type ${KIND[c.type] || "task"}">${esc(c.type)}</span><span class="ic-key">${esc(k)}</span><span class="grow"></span>
      <span class="ic-sp${c.sp == null ? " none" : ""}">${c.sp == null ? "no estimate" : `${esc(c.sp)} SP`}</span></div>
    <div class="ic-t">${esc(c.title) || `<span class="dim">No title in the data.</span>`}</div>
    <div class="ic-f"><span class="ic-st ${statusTone(c.status)}">${esc(c.status)}</span>${p ? `<span class="ic-pr ${p[1]}"><i aria-hidden="true">${p[0]}</i>${esc(c.priority)}</span>` : ""}</div>
    ${about.length ? `<div class="ic-m">${about.map(esc).join(" · ")}</div>` : ""}`;
}
function showCard(anchor){
  const k = anchor.dataset.issue, c = state.cards[k];
  icard.className = "icard " + ((c && KIND[c.type]) || "task");
  icard.innerHTML = issueCard(k);
  icard.hidden = false;
  const r = anchor.getBoundingClientRect(), w = icard.offsetWidth, h = icard.offsetHeight, below = r.bottom + 8 + h <= innerHeight || r.top < h + 16;
  icard.style.left = Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12)) + "px";
  icard.style.top = (below ? r.bottom + scrollY + 8 : r.top + scrollY - h - 8) + "px";
}
function pinCard(anchor){ clearTimeout(cardTimer); cardPinned = true; pop.hidden = true; showCard(anchor); }
function dropCard(){ clearTimeout(cardTimer); cardPinned = false; icard.hidden = true; }
function hoverCard(e, show){
  const anchor = e.target.closest && e.target.closest("[data-issue]");
  if (!anchor || cardPinned || !state) return;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => { if (show) showCard(anchor); else icard.hidden = true; }, show ? 140 : 180);
}
document.addEventListener("mouseover", e => hoverCard(e, true));
document.addEventListener("mouseout", e => hoverCard(e, false));
document.addEventListener("focusin", e => hoverCard(e, true));
document.addEventListener("focusout", e => hoverCard(e, false));

/* Notices: what reached the team. "New" is what came after the last look, remembered in this browser only. */
const SEEN = "sightline.notices.seen";
const lastLook = () => { try { return +localStorage.getItem(SEEN) || 0; } catch (error){ return 0; } };
function renderBell(){
  const fresh = state.notices.filter(n => Date.parse(n.at) > lastLook()).length;
  $("#bell-n").textContent = fresh;
  $("#bell-n").hidden = !fresh;
}
function showNotices(anchor){
  const d = state.data, since = lastLook();
  pop.setAttribute("aria-label", "What reached the team");
  pop.innerHTML = `<div class="ph">What reached the team</div>` + (state.notices.length ? state.notices.map(n => `<div class="f">
      <span class="mono small dim">${esc(when(n.at))}${Date.parse(n.at) > since ? " · new" : ""}</span><span><b>${keyed(n.key)}</b> · ${esc(n.text)}</span></div>`).join("")
    : `<div class="f">Nothing in the last days.</div>`) +
    `<div class="small dim">Looked for among the issues of the sprint${d.searches.includes("inbox") ? " and every issue of the board that changed in the last days" : ""}.
      ${d.searches.includes("mentions") ? "Comments of other teams were searched for the team's name." : ""}</div>`;
  place(anchor);
  try { localStorage.setItem(SEEN, String(Math.max(since, ...state.notices.map(n => Date.parse(n.at))))); } catch (error){ /* private window: the count simply stays */ }
  renderBell();
}

/* Ask: the window of the question agent. It stands on the right, docked at the bottom, or floats; a floating window
   dragged to the right or the bottom edge docks there. Where it stands is remembered in this browser. The
   conversation is kept in this tab until it is closed, so a reload does not lose it. */
const ask = $("#ask"), ghost = $("#ask-ghost");
const askCards = () => ((state && state.ask) || []).filter(row => row.kind).map(row => [row.kind, row.q]);
const ASK_WHAT = "What can I ask you, and what can you see?";
let chat = [], asking = false, askMode = ["side", "bottom", "float"].includes(stored("ask.mode")) ? stored("ask.mode") : "side";
try {
  chat = JSON.parse(sessionStorage.getItem("sightline.ask.chat") || "[]").filter(item => item && typeof item.q === "string");
  chat.forEach(item => { if (item.a === undefined && !item.err) item.err = "The page was loaded again before the answer came."; });
} catch (error){ chat = []; }
let fresh = !chat.length;
function keepChat(){ try { sessionStorage.setItem("sightline.ask.chat", JSON.stringify(chat.slice(-40))); } catch (error){ /* not kept */ } }
function renderAsk(){
  const off = !state;
  $("#ask-log").innerHTML = `<div class="note-mock"><b>Recorded answers.</b> This demo has no model behind it. The cards are answered from a recording made for this data, with the facts the agent read at the time.</div>` +
    (chat.length ? "" : `<div class="cmd-empty"><h3 class="cmd-empty-h">What do you want to know?</h3>
      <p class="cmd-empty-p">The agent reads the facts of this page through four read-only tools. It names the facts and the issues it answers from, so you can check every number on the page.</p>
      <div class="cmd-cards">${askCards().map(([kind, q]) => `<button type="button" class="cmd-card" data-ask-q="${esc(q)}" ${off || asking ? "disabled" : ""}><span class="cmd-card-k">${esc(kind)}</span><span>${esc(q)}</span></button>`).join("")}</div></div>`) +
    chat.map(item => `<div class="q">${esc(item.q)}</div>` + (item.err ? `<div class="note-bad">${esc(item.err)}</div>` :
      item.a === undefined ? `<div class="a dim">The agent is reading the data…</div>` :
      `<div class="a"><div class="lbl">${item.recorded ? `Recorded answer of the agent · ${esc(item.tools)} call${item.tools === 1 ? "" : "s"} of the read-only tools; open the facts to check a number` : "Not a question of the recording"}</div>${keyed(item.a)}</div>`)).join("");
  $("#ask-send").disabled = asking;
  $("#ask-what").disabled = asking || off;
  $("#ask-log").scrollTop = chat.length ? $("#ask-log").scrollHeight : 0;
}
function askPos(){              // the floating window, fitted into this screen
  let p = null;
  try { p = JSON.parse(stored("ask.pos") || "null"); } catch (error){ p = null; }
  p = p && typeof p.x === "number" ? p : {x: 24, y: 80, w: 440, h: 620};
  const w = clamp(p.w || 440, 340, innerWidth - 16), h = clamp(p.h || 620, 320, innerHeight - 16);
  return {x: clamp(p.x, 8 - w + 160, innerWidth - 160), y: clamp(p.y, 8, innerHeight - 48), w, h};
}
function placeAsk(){
  const s = ask.style, head = Math.round($("#top").getBoundingClientRect().height);
  document.documentElement.style.setProperty("--head-h", head + "px");
  ask.className = "cmd" + (askMode === "side" ? "" : " " + askMode);
  s.left = s.top = s.width = s.height = "";
  if (askMode === "float"){ const p = askPos(); s.left = p.x + "px"; s.top = p.y + "px"; s.width = p.w + "px"; s.height = p.h + "px"; }
  if (askMode === "bottom") s.height = clamp(+stored("ask.h") || 320, 200, Math.max(200, innerHeight - head - 40)) + "px";
  document.body.style.paddingBottom = askMode === "bottom" && !ask.hidden ? s.height : "";       // the end of the page stays reachable
  $$("[data-ask-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.askMode === askMode));
}
function setAskMode(mode){ askMode = mode; store("ask.mode", mode); placeAsk(); }
function openAsk(open){
  ask.hidden = !open;
  $("#ask-open").setAttribute("aria-pressed", open);
  placeAsk();
  if (open){ renderAsk(); $("#ask-text").focus(); }
}
function keepAskPos(){
  if (askMode !== "float" || ask.hidden) return;
  const r = ask.getBoundingClientRect();
  store("ask.pos", JSON.stringify({x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)}));
}
async function sendAsk(given){
  const box = $("#ask-text"), text = (given || box.value).trim();
  if (!text || asking) return;
  const item = {q: text};
  chat.push(item); asking = true;
  if (!given){ box.value = ""; box.style.height = ""; }
  renderAsk();
  try {
    const reply = await fetch("api/ask", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({text})});
    const data = await reply.json();
    if (!reply.ok) throw new Error(data.error || reply.statusText);
    item.a = data.answer; item.tools = data.tool_calls; item.recorded = data.recorded; fresh = false;
  } catch (error){ item.err = error.message; }
  asking = false; keepChat(); renderAsk();
}
/* the floating window: moved by its header; at the right or the bottom edge the ghost shows where it would dock */
let drag = null, grip = false;
$("#ask-head").addEventListener("pointerdown", e => {
  if (askMode !== "float" || e.target.closest("button")) return;
  const r = ask.getBoundingClientRect();
  drag = {dx: e.clientX - r.left, dy: e.clientY - r.top, snap: ""};
  $("#ask-head").setPointerCapture(e.pointerId);
});
$("#ask-head").addEventListener("pointermove", e => {
  if (!drag) return;
  ask.style.left = clamp(e.clientX - drag.dx, 8 - ask.offsetWidth + 160, innerWidth - 160) + "px";
  ask.style.top = clamp(e.clientY - drag.dy, 8, innerHeight - 48) + "px";
  drag.snap = e.clientX >= innerWidth - 24 ? "side" : e.clientY >= innerHeight - 24 ? "bottom" : "";
  ghost.className = "snap-ghost " + drag.snap;
  ghost.hidden = !drag.snap;
});
function dropAsk(){
  if (!drag) return;
  const snap = drag.snap;
  drag = null; ghost.hidden = true;
  if (snap) setAskMode(snap); else keepAskPos();
}
$("#ask-head").addEventListener("pointerup", dropAsk);
$("#ask-head").addEventListener("pointercancel", dropAsk);
ask.addEventListener("pointerup", keepAskPos);              // after it was sized by its corner
/* the docked window: its height by its top edge */
$("#ask-grip").addEventListener("pointerdown", e => { grip = true; $("#ask-grip").setPointerCapture(e.pointerId); });
$("#ask-grip").addEventListener("pointermove", e => {
  if (!grip) return;
  ask.style.height = clamp(innerHeight - e.clientY, 200, Math.max(200, innerHeight - $("#top").getBoundingClientRect().height - 40)) + "px";
  document.body.style.paddingBottom = ask.style.height;
});
$("#ask-grip").addEventListener("pointerup", () => { if (grip){ grip = false; store("ask.h", parseInt(ask.style.height, 10)); } });
$("#ask-help").innerHTML = helpTip("ask", "left");
$("#ask-open").addEventListener("click", () => openAsk(ask.hidden));
$("#ask-close").addEventListener("click", () => openAsk(false));
$("#ask-send").addEventListener("click", () => sendAsk());
$("#ask-what").addEventListener("click", () => sendAsk(ASK_WHAT));
$("#ask-new").addEventListener("click", () => { if (!asking){ chat.length = 0; fresh = true; keepChat(); renderAsk(); } });
ask.addEventListener("click", e => {
  const mode = e.target.closest("[data-ask-mode]"), q = e.target.closest("[data-ask-q]");
  if (mode) setAskMode(mode.dataset.askMode);
  if (q) sendAsk(q.dataset.askQ);
});
$("#ask-text").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendAsk(); } });
$("#ask-text").addEventListener("input", e => { e.target.style.height = "auto"; e.target.style.height = Math.min(168, e.target.scrollHeight) + "px"; });
addEventListener("resize", () => { if (!ask.hidden) placeAsk(); });

document.addEventListener("click", e => {
  const key = e.target.closest("[data-issue]");
  if (key) return pinCard(key);                 // a click on an issue key keeps its card open; it does not open the facts of the line around it
  if (!e.target.closest("#icard")) dropCard();
  const a = e.target.closest("[data-facts]");
  if (a) return showFacts(a);
  const mark = (TOUCH.matches || PHONE.matches) && e.target.closest("svg.ch *"), said = mark && [mark, mark.parentNode].find(el => el.querySelector && el.querySelector(":scope > title"));
  if (said) return showNote(said, said.querySelector(":scope > title").textContent);
  const bell = e.target.closest("#bell");
  if (bell) return showNotices(bell);
  if (!e.target.closest("#pop")) pop.hidden = true;
  const t = e.target.closest("[data-tab]");
  if (t){ showTab(t.dataset.tab); history.replaceState(null, "", "#" + t.dataset.tab); }
});
// A tab has an address (#risks), so a link can open the page on it.
function showTab(name){
  if (!$("#p-" + name)) return;
  $$(".page").forEach(p => p.classList.toggle("on", p.id === "p-" + name));
  $$("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === name));
  const strip = $(".seg"), at = $(`.seg [data-tab="${name}"]`);          // on a phone the tabs are one strip: keep the open one in sight
  if (at && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = at.offsetLeft - strip.offsetLeft - (strip.clientWidth - at.offsetWidth) / 2;
  scrollTo(0, 0);
}
addEventListener("hashchange", () => showTab(location.hash.slice(1)));
if (PHONE.addEventListener) PHONE.addEventListener("change", () => { if (state){ renderToday(); renderViews(); } });
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){ pop.hidden = true; dropCard(); openAsk(false); }
  if ((e.key || "").toLowerCase() === "k" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); openAsk(true); }
});

/* Loading. The data of the demo does not change by itself, so the page is built once; Refresh reads the settings
   and the data folder again, and every change of the risk register or the Inbox loads the state anew. */
let shown = "";
async function load(refresh){
  const boot = $("#boot"), btn = $("#refresh");
  btn.disabled = true;
  try {
    const reply = await fetch("api/today" + (refresh ? "?refresh=1" : ""));
    const data = await reply.json();
    if (!reply.ok) throw new Error(data.error || reply.statusText);
    state = data;
    const now = JSON.stringify({...data, built: "", tool_calls: 0});
    if (now !== shown){ renderToday(); renderViews(); renderSystem(); renderBell(); if (!ask.hidden) renderAsk(); shown = now; }
    else renderSystem();
    boot.hidden = true;
  } catch (error){
    boot.hidden = false; boot.className = "boot err";
    boot.textContent = "The page could not be built: " + error.message;
  } finally { btn.disabled = false; }
}
$("#refresh").addEventListener("click", () => load(true));
// The first load waits until every script of the page has run. Then the address decides what is open.
document.addEventListener("DOMContentLoaded", async () => {
  await load(false);
  showTab(location.hash.slice(1));
  const card = askCards()[+ASKED.get("ask") - 1];
  if (ASKED.get("ask")){ openAsk(true); if (card && !chat.length) sendAsk(card[1]); }
  if (ASKED.get("show") === "facts" && $(".qrow")) showFacts($$(".qrow")[+ASKED.get("row") || 0] || $(".qrow"));
  const shown = ASKED.get("card") && $$(`.page.on [data-issue="${CSS.escape(ASKED.get("card"))}"]`)[+ASKED.get("nth") || 0];
  if (shown){
    const r = shown.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight - 220) shown.scrollIntoView({block: "center"});
    pinCard(shown);
  }
});
