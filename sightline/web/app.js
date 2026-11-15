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
  const kv = rows => `<table class="t stack">${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("")}</table>`;
  card("settings", "Team and sprint", `<span class="small dim">file ${esc(set.file)}</span>`, kv([
    ["Team", esc(s.team)], ["Board", `${s.board.id} · ${esc(s.board.name)}`], ["Sprint", `${s.sprint.id} · ${esc(s.sprint.name)} · ${esc(s.sprint.state)}`],
    ["Sprint dates", `${esc(when(s.sprint.start))} to ${esc(when(s.sprint.end))}`], ["“Done” means", `the column “${esc(s.board.done_column)}” of the board, as in Jira's sprint report`],
    ["Setting: sprint", set.sprint ? esc(set.sprint) : `<span class="dim">empty: the active sprint</span>`],
    ["Setting: data", `folder <span class="mono">${esc(set.data)}</span>`], ["Port", esc(set.port)]]), "settings");
  const row = (lamp, name, text) => `<tr><td><span class="dotl ${lamp}"></span></td><td><b>${name}</b></td><td>${text}</td></tr>`;
  card("sources", "Sources", "", `<table class="t stack lead"><thead><tr><th></th><th>Source</th><th>In this demo</th></tr></thead><tbody>` +
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
  card("storage", "Kept on this computer", `<span class="small dim">in ${esc(k.folder)} · never committed</span>`, `<div class="tw"><table class="t kept stack">
    <thead><tr><th>File</th><th>What it holds</th><th>Entries</th><th>Size</th></tr></thead><tbody>${k.files.map(f => `<tr><td class="k mono small">${esc(f.path)}</td>
      <td>${esc(f.what)}${f.exists ? "" : ` <span class="dim">· not there yet</span>`}</td><td class="k" data-l="Entries">${f.exists ? esc(f.entries) : "—"}</td><td class="k" data-l="Size">${f.exists ? esc(size(f.bytes)) : "—"}</td></tr>`).join("")}</tbody></table></div>
    <div class="small dim"><b>Never kept:</b> ${k.never.map(esc).join(" · ")}.</div>
    <div class="small dim"><b>In this browser:</b> the palette, where the Ask window stands and which notices you have seen; the conversation stays in this tab until it is closed.</div>`, "storage");
  card("runs", "Agent runs", `<span class="small dim">what the check made of each reply</span>`, a.runs.length ? `<div class="tw"><table class="t stack">
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
  card("arch", "Architecture", `<span class="small dim">who talks to whom · the numbers are those of this page, right now</span>`, architecture(), "arch");
}

/* Architecture: five layers, left to right. A layer names its parts and what it passes on to the next one: the
   guarantees of the app sit on those borders. On a narrow screen the layers stand below each other. The texts are
   written here and nowhere else. */
const REPO_URL = "https://github.com/bolevin/sightline/blob/main/docs/";
const LAYERS = [
  ["Sources", "systems of record, only read", "GET requests, never a write", [
    ["Jira", "issues with their history, sprints, velocity", true],
    ["Git hosting", "pull requests and their reviews", false],
    ["Incident reports", "what a triage agent wrote about production", false],
    ["Service catalogue", "the services the team runs", false]]],
  ["Collect and keep", "one snapshot per read, no database", "the source's own records", [
    ["Collectors", "one read-only client per source", false],
    ["Fact store", "a folder per read, in the source's own format", true],
    ["Your notes", "risk register and what you sent, on this computer", true]]],
  ["Compute", "code decides what is true", "facts only: no titles, no people", [
    ["Sprint and scope", "the sprint as Jira's report counts it, on any day", true],
    ["Forecast and calibration", "simulation from the team's own history, scored afterwards", true],
    ["Signals and pre-mortem", "what looks like a risk, against the team's own past", true],
    ["Quality analytics", "bug flow, escape rate, time to fix, what moves with bugs", true],
    ["Drafts", "texts composed from facts", true],
    ["Read-only tools", "facts, sprint, issue, forecast over MCP", true]]],
  ["Agents", "choose and word, never compute", "a reply that is not trusted yet", [
    ["Briefing agent", "words Today and the findings, has no tools", false],
    ["Question agent", "the Ask window, four read-only tools", false],
    ["An agent of your own", "any MCP client, pointed at /mcp", true]]],
  ["Check and present", "nothing unchecked is shown", "drafts you send yourself", [
    ["Check by code", "every number equals a cited fact, every key stands behind one", true],
    ["The page", "Today, the evidence tabs, Ask", true],
    ["Inbox", "drafts composed by code, copied and sent by you", true]]],
];
const STEPS = [
  ["Read", "The collectors read the sources with GET requests and write one snapshot. Nothing is written back, ever."],
  ["Rebuild", "From the changelog code rebuilds the sprint as it stood on each day. No history is stored: it is computed."],
  ["Compute", "Code turns the sprint into facts: small records with an id, a value and the issue keys behind it."],
  ["Word", "An agent gets the facts and nothing else. It picks what matters this morning and names the facts each line rests on."],
  ["Check", "Code checks every line. A number that is not in the cited facts drops the line, and the page says which and why."],
  ["Decide", "You read, decide and send. Where no agent answered or nothing passed, fixed rules lay out the same facts."],
];
const DECISIONS = [
  ["0001-no-number-comes-from-a-model", "No number comes from a model", "a model chooses and words; arithmetic stays in code"],
  ["0002-history-instead-of-a-database", "History instead of a database", "any past day is rebuilt from the changelog"],
  ["0003-read-only-and-local", "Read-only and local", "the safest write access is none"],
  ["0004-no-people-titles-for-the-eyes-only", "No people, and a title is for the eyes only", "a title has one path, and it ends at your screen"],
  ["0005-standard-library-only", "Standard library only", "it starts on a locked-down laptop without an install"],
  ["0006-the-demo-replaces-the-outside-with-files", "The demo replaces the outside world with files", "the same code runs here and against live systems"],
];
/* The map: who talks to whom. You and your browser on the left, the app in the middle, the agents and a model on the
   right, the systems of the team below. A block with a teal frame sends data off this computer; a dashed one is not
   part of this demo. The lamps and the numbers come from the state of the page, and the names of the parts from
   LAYERS, so the map cannot name something the cards of a narrow screen do not. */
function diagram(){
  const s = state, v = s.views, LETTER = 5.75, part = (layer, n) => LAYERS[layer][3][n];
  const wrap = (text, most) => text.split(" ").reduce((lines, word) => {
    const last = lines.length - 1, joined = (lines[last] + " " + word).trim();
    if (joined.length > most && lines[last]) lines.push(word); else lines[last] = joined;
    return lines; }, [""]);
  const lamp = (x, y, kind) => `<circle class="lamp ${kind}" cx="${x}" cy="${y}" r="4.5"/>`;
  const block = (x, y, w, h, title, cls, light) => `<rect class="blk ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="11"/><text class="bt" x="${x + 14}" y="${y + 27}">${title}</text>${light ? lamp(x + w - 18, y + 22, light) : ""}`;
  // a part of a block: its name, small lines below, and a lamp when it has a state of its own. Gives [drawing, height]
  const box = (x, y, w, name, lines, cls, light) => { const left = x + (light ? 26 : 12), h = 28 + 14 * lines.length + (lines.length ? 5 : 0);
    return [`<rect class="sub ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>${light ? lamp(x + 14, y + 16, light) : ""}<text class="pn ${cls}" x="${left}" y="${y + 20}">${name}</text>` +
      lines.map((line, n) => `<text class="pd ${cls}" x="${left}" y="${y + 36 + 14 * n}">${line}</text>`).join(""), h]; };
  const chips = (x, y, w, names, cls) => { let cx = x, cy = y, out = "";
    names.forEach(name => { const cw = Math.round(name.length * LETTER + 18); if (cx + cw > x + w && cx > x){ cx = x; cy += 24; }
      out += `<rect class="chp ${cls}" x="${cx}" y="${cy}" width="${cw}" height="19" rx="9.5"/><text class="ct ${cls}" x="${cx + cw / 2}" y="${cy + 13}" text-anchor="middle">${name}</text>`; cx += cw + 5; });
    return [out, cy + 19 - y]; };
  const link = (d, cls) => `<path class="ln ${cls}" d="${d}"/>`, say = (x, y, text, anchor) => `<text class="lab" x="${x}" y="${y}" text-anchor="${anchor || "middle"}">${text}</text>`;
  const LIVE = "g", KEPT = "rec", OFF = "off", DARK = "c", NONE = "", TWO = "two", GONE = "leaves", FLOW = "flow", LEFT = "start";
  const YOU = 12, CORE = 394, AGENTS = 776, MODEL = 1142, WIDE = 294, TOP = 16, W = 1338;
  const issues = Object.keys(s.cards).length, kept = s.page.cards.reduce((n, c) => n + (c.by === "agent" ? c.rows.length : 0), 0) + (v.quality && v.quality.findings.by === "agent" ? v.quality.findings.rows.length : 0);
  const dropped = s.composed.problems.length + (v.quality ? v.quality.findings.problems.length : 0);
  let g = `<defs><marker id="mh" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker>
    <marker id="mhf" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>`, at, drawn, tall, inside;

  /* you and your browser */
  const tabs = $$("[data-tab]").map(b => b.textContent.replace(/[^\w ]/g, "").trim());
  inside = ""; at = TOP + 42;
  [drawn, tall] = chips(YOU + 24, at + 30, WIDE - 48, tabs, NONE);
  inside += `<rect class="sub" x="${YOU + 12}" y="${at}" width="${WIDE - 24}" height="${tall + 42}" rx="7"/><text class="pn" x="${YOU + 24}" y="${at + 20}">${part(4, 1)[0]}</text>` + drawn;
  at += tall + 50;
  [drawn, tall] = box(YOU + 12, at, WIDE - 24, "Ask AI, with the microphone", ["your questions, typed or spoken"], NONE, NONE); inside += drawn; at += tall + 8;
  [drawn, tall] = box(YOU + 12, at, WIDE - 24, part(4, 2)[0], wrap(part(4, 2)[1], 44), NONE, NONE); inside += drawn; at += tall + 12;
  const youEnd = at;
  g += block(YOU, TOP, WIDE, youEnd - TOP, "You · browser", NONE, LIVE) + inside;
  const speechTop = youEnd + 34, mailTop = speechTop + 92 + 22, leftEnd = mailTop + 74;
  g += block(YOU, speechTop, WIDE, 92, "Speech service of the browser", GONE, Speech ? LIVE : OFF) + `<text class="pd" x="${YOU + 14}" y="${speechTop + 48}">turns what you say into text for Ask AI</text>
    <text class="pd gone" x="${YOU + 14}" y="${speechTop + 70}">audio leaves this computer</text>`;
  g += block(YOU, mailTop, WIDE, 74, "Your mail and chat", NONE, NONE) + `<text class="pd" x="${YOU + 14}" y="${mailTop + 50}">Drafts are pasted here. You send them.</text>`;

  /* the app */
  inside = ""; at = TOP + 42;
  const inner = CORE + 12, innerW = WIDE - 24, mark = {};
  [drawn, tall] = box(inner, at, innerW, part(1, 0)[0], [part(1, 0)[1]], DARK, NONE); inside += drawn; at += tall + 7;
  [drawn, tall] = box(inner, at, innerW, part(1, 1)[0], [`${issues} issues, each with its history`, `as of ${esc(when(s.data.fetched))}`], DARK, NONE); inside += drawn; at += tall + 7;
  [drawn, tall] = chips(inner + 12, at + 30, innerW - 24, LAYERS[2][3].slice(0, -1).map(p => p[0]), DARK);
  inside += `<rect class="sub c" x="${inner}" y="${at}" width="${innerW}" height="${tall + 42}" rx="7"/><text class="pn c" x="${inner + 12}" y="${at + 20}">Code computes · ${s.facts.length} facts</text>` + drawn;
  mark.facts = at + 16; at += tall + 49;
  [drawn, tall] = box(inner, at, innerW, "Rules without AI", wrap("signals, options, drafts, and the whole page when no agent answers", 44), DARK, NONE); inside += drawn; at += tall + 7;
  [drawn, tall] = box(inner, at, innerW, part(4, 0)[0], [`${kept} lines of an agent shown, ${dropped} dropped`, "a number must equal a fact the line cites"], DARK, NONE); inside += drawn; mark.check = at + tall / 2; at += tall + 7;
  [drawn, tall] = chips(inner + 12, at + 30, innerW - 24, ["facts", "sprint", "issue", "forecast"], DARK);
  inside += `<rect class="sub c" x="${inner}" y="${at}" width="${innerW}" height="${tall + 60}" rx="7"/><text class="pn c" x="${inner + 12}" y="${at + 20}">${part(2, 5)[0]} · 4, over MCP</text>` + drawn +
    `<text class="pd c" x="${inner + 12}" y="${at + tall + 48}">${esc(s.tool_calls ?? 0)} calls since the start</text>`;
  mark.tools = at + (tall + 60) / 2; at += tall + 67;
  [drawn, tall] = box(inner, at, innerW, part(1, 2)[0], [`${s.register.risks.length} in the risk register · ${s.inbox.sent.length} sent`, "two files on this computer"], DARK, NONE); inside += drawn; at += tall + 12;
  const coreEnd = at + 34;
  g += block(CORE, TOP, WIDE, coreEnd - TOP, `Sightline · 127.0.0.1:${esc(s.settings.port)}`, "core", LIVE) + inside +
    `<text class="pd c" x="${CORE + 14}" y="${coreEnd - 26}">standard library only · no database</text><text class="pd c" x="${CORE + 14}" y="${coreEnd - 11}">writes to no system</text>`;

  /* the agents, and the model behind them */
  inside = ""; at = TOP + 42;
  const rows = LAYERS[3][3].map(([name, note, live]) => { [drawn, tall] = box(AGENTS + 12, at, 282 - 24, name, wrap(note, 40), NONE, live ? LIVE : KEPT); inside += drawn; const mid = at + tall / 2; at += tall + 7; return mid; });
  wrap("They get the four tools and nothing else: no files, no shell, no web.", 44).forEach((line, n) => { inside += `<text class="pd" x="${AGENTS + 14}" y="${at + 14 + 14 * n}">${line}</text>`; });
  const agentsEnd = at + 44, demoTop = agentsEnd + 22, demo = wrap("The replies are recordings made for this data. The check runs on them for real, each time the page is built.", 43);
  g += block(AGENTS, TOP, 282, agentsEnd - TOP, "Agents · any runtime", NONE, KEPT) + inside;
  g += block(AGENTS, demoTop, 282, 44 + 14 * demo.length, "In this demo", OFF, NONE) + demo.map((line, n) => `<text class="pd" x="${AGENTS + 14}" y="${demoTop + 46 + 14 * n}">${line}</text>`).join("");
  // the model provider: the agents send it prompts, so it is the other place where data leaves this computer
  g += block(MODEL, TOP, 184, 98, "GitHub Copilot", GONE, KEPT) + `<text class="pd" x="${MODEL + 14}" y="${TOP + 52}">Models of your subscription</text>
    <text class="pd gone" x="${MODEL + 14}" y="${TOP + 76}">data leaves the computer</text>`;

  /* the systems of the team */
  const teamTop = Math.max(leftEnd, coreEnd, demoTop + 44 + 14 * demo.length) + 46, each = (W - 24 - 28) / LAYERS[0][3].length;
  const counts = [`${issues} issues in this data`, v.code ? `${esc(v.code.merged)} merged pull requests` : "not in this data", v.incidents ? `${esc(v.incidents.total)} reports` : "not in this data",
    s.services.status === "ok" ? `${s.services.apps.length} services` : "not in this data"];
  inside = LAYERS[0][3].map(([name, note, live], n) => { const x = YOU + 14 + each * n;
    return lamp(x + 5, teamTop + 51, live ? LIVE : KEPT) + `<text class="pn" x="${x + 17}" y="${teamTop + 55}">${name}</text><text class="pd" x="${x + 17}" y="${teamTop + 71}">${note}</text><text class="pd num" x="${x + 17}" y="${teamTop + 87}">${counts[n]}</text>`; }).join("");
  g += block(YOU, teamTop, W - 24, 102, "Team systems · read only", NONE, NONE) + inside + `<text class="pd" x="${W - 26}" y="${teamTop + 27}" text-anchor="end">${LAYERS[0][3].length} sources</text>`;

  /* who talks to whom */
  const gapYou = YOU + WIDE, gapCore = CORE + WIDE, lane = [gapCore + 24, gapCore + 44, gapCore + 64];
  g += link(`M${gapYou + 5} ${TOP + 96}H${CORE - 5}`, TWO) + say((gapYou + CORE) / 2, TOP + 89, "/api");
  g += link(`M${YOU + 60} ${youEnd + 2}V${speechTop - 5}`, GONE) + say(YOU + 70, youEnd + 21, "voice", LEFT);
  g += link(`M${gapYou} ${youEnd - 34}H${gapYou + 26}V${mailTop + 37}H${gapYou + 5}`, NONE) + say(gapYou + 33, (youEnd + mailTop) / 2 - 4, "you copy", LEFT) + say(gapYou + 33, (youEnd + mailTop) / 2 + 10, "a draft", LEFT);
  g += link(`M${gapCore} ${mark.facts}H${lane[0]}V${rows[0]}H${AGENTS - 5}`, FLOW) + say((lane[0] + AGENTS) / 2, rows[0] - 7, "facts only");
  g += link(`M${AGENTS} ${(rows[0] + rows[1]) / 2}H${lane[1]}V${mark.check}H${gapCore + 5}`, FLOW) + say((gapCore + lane[1]) / 2, mark.check - 7, "replies");
  g += link(`M${AGENTS} ${rows[2]}H${lane[2]}V${mark.tools}H${gapCore + 5}`, FLOW) + say((gapCore + lane[2]) / 2, mark.tools - 7, "MCP");
  g += link(`M${AGENTS + 282 + 5} ${rows[0]}H${MODEL - 5}`, TWO + " " + GONE) + say((AGENTS + 282 + MODEL) / 2, rows[0] - 7, "prompts");
  g += link(`M${CORE + WIDE / 2} ${teamTop - 5}V${coreEnd + 5}`, NONE) + say(CORE + WIDE / 2 + 10, (teamTop + coreEnd) / 2 + 4, "GET requests only, with your own keys", LEFT);
  return `<svg class="amap" viewBox="0 0 ${W} ${teamTop + 114}" role="img" aria-label="Architecture: you and your browser, Sightline on this computer, the agents and their model provider, and the systems of the team, with what goes between them">${g}</svg>`;
}
function architecture(){
  const out = url => `href="${REPO_URL}${url}" target="_blank" rel="noopener noreferrer"`;
  const layer = ([name, role, passes, parts], i) => `<section class="arc-l"><header><span class="arc-n">${i + 1}</span><div><b>${name}</b><small>${role}</small></div></header>
      <ul>${parts.map(([part, note, live]) => `<li class="${live ? "live" : "rec"}"><b>${part}</b><span>${note}</span></li>`).join("")}</ul>
      <footer><span>${["read with", "passes on", "passes on", "passes on", "you get"][i]}</span>${passes}</footer></section>`;
  return `<div class="arc-d">${diagram()}</div><div class="arc-flow">${LAYERS.map((l, i) => (i ? `<i class="arc-x" aria-hidden="true"></i>` : "") + layer(l, i)).join("")}</div>
    <div class="legend"><span class="arc-wide"><i class="arc-frame"></i>on this computer</span><span class="arc-wide"><i class="arc-frame leaves"></i>data leaves the computer</span>
      <span class="arc-wide"><i class="arc-frame off"></i>not in this demo</span><span><i class="arc-dot live"></i>runs in this demo, on invented data</span>
      <span><i class="arc-dot rec"></i>recorded or prepared in this demo, live in the full version</span></div>
    <div class="arc-more"><div><div class="lbl">One morning, step by step</div>
        <ol class="arc-steps">${STEPS.map(([verb, text]) => `<li><b>${verb}.</b> ${text}</li>`).join("")}</ol></div>
      <div><div class="lbl">Decisions that carry the design</div>
        <ul class="arc-adr">${DECISIONS.map(([file, title, why]) => `<li><a ${out("adr/" + file + ".md")}>${title}</a><span>${why}</span></li>`).join("")}</ul>
        <div class="small dim">Each record says what was decided, why, and what it costs. The full description follows the arc42 template:
          <a ${out("architecture.md")}>architecture.md</a>.</div></div></div>`;
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
  $("#ask-mic").disabled = asking && !hearing;
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
  if (!open) stopMic();
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
/* Voice: the microphone of the Ask window. The browser itself turns speech into text, with the speech service of
   its maker, so the audio leaves this computer: the line under the field says so while it listens. Sightline gets
   the text and nothing else, and asks it like a typed question. No browser support, no button. */
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const VOICE_NOTE = "Listening. Your browser turns speech into text with the speech service of its maker, so the audio leaves this computer. Sightline gets only the text.";
const VOICE_ERR = {"not-allowed": "The browser was not allowed to use the microphone.", "service-not-allowed": "This browser does not allow speech recognition here.",
  "audio-capture": "No microphone was found.", "no-speech": "Nothing was heard.", network: "The speech service of the browser could not be reached."};
let hearing = null;
function voiceNote(text, bad){
  const note = $("#ask-voice");
  note.hidden = !text;
  note.textContent = text;
  note.classList.toggle("err", !!bad);
}
function micState(){
  const mic = $("#ask-mic"), on = !!hearing;
  mic.setAttribute("aria-pressed", on);
  mic.title = on ? "Stop listening" : "Dictate";
  mic.setAttribute("aria-label", mic.title);
  mic.disabled = asking && !on;
  $("#ask-text").placeholder = on ? "Listening…" : "Ask about the sprint";
  $(".composer").classList.toggle("hearing", on);
}
function stopMic(){ if (hearing) hearing.stop(); }
function toggleMic(){
  if (hearing) return stopMic();
  if (!Speech || asking) return;
  const rec = new Speech(), box = $("#ask-text");
  let heard = false, failed = false;
  rec.lang = "en-US";                     // the page and its recorded questions are English
  rec.interimResults = true;
  rec.onresult = event => {
    let text = "";
    for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
    box.value = text;
    heard = event.results[event.results.length - 1].isFinal;
  };
  rec.onerror = event => { failed = true; voiceNote(VOICE_ERR[event.error] || `The microphone stopped (${event.error}).`, true); };
  rec.onend = () => {
    hearing = null;
    if (!failed) voiceNote("");
    micState();
    if (heard && box.value.trim()) sendAsk();           // the agent only reads, so a question that was misheard does no harm
  };
  hearing = rec;
  voiceNote(VOICE_NOTE);
  micState();
  try { rec.start(); } catch (error){ hearing = null; voiceNote(""); micState(); }
}
$("#ask-mic").hidden = !Speech;
$("#ask-mic").addEventListener("click", toggleMic);
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
