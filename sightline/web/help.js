/* Sightline: the ? of each panel. HELP holds one plain paragraph per panel: what it shows, where the numbers come
   from, how to read it. helpTip(key) is the button; a click opens the text under it, one at a time. The texts are
   written here and nowhere else, so they are put into the page as text. */
"use strict";
const HELP = {
  // Today
  composed: "Who laid out this page. A briefing agent chooses among the facts and words them; code then checks every line against the facts it cites and drops a line whose number or issue key is not there. Without an agent, or when nothing passes, fixed rules lay out the same facts. In this demo the agent's reply is a recording, and the check runs on it for real. Click any line to see the facts behind it.",
  cards: "The three questions of the page: what did we promise and will we keep it, what can hurt us, what does production say. Each card shows at most five lines, the most serious first. A line is a fact computed from Jira, or several facts joined by the agent; the coloured dot is its level.",
  facts: "Every fact code computed from the data, with the issues behind it. This list is all an agent may choose from: a number that is not here cannot appear on the page.",
  options: "Shown when the forecast gives less than 85 % to finish everything. It says how many story points would have to move out for an even chance and for 85 %, and what the obvious moves would do: the forecast is run again without the items that move. What moves is for the team and the product owner to decide.",
  // Promises
  promise: "The sprint as a promise: what was committed when it started, what is done, and what the forecast says about the end. The forecast draws the story points the team finished on each past working day, at random, for every working day left, 5 000 times; “85 % sure” is what 85 % of those runs reach. The chart shows done and scope day by day.",
  lookback: "How far the forecast may be trusted. It is replayed inside past sprints, at a third, a half and two thirds of each, and compared with how the sprint really ended. Below it stands the app's own record: the forecast it showed each morning, settled when the sprint closed. The record is kept only when Jira is read live.",
  outside: "What past sprints of this board completed, from Jira's velocity chart, next to what is committed now. A commitment above everything the team has ever finished is the first thing to question at planning.",
  // Risks
  register: "Your risk register: your own notes, kept on this computer and never given to a model. A risk has a ROAM state (new, owned, accepted, mitigated, resolved), an owner by role, a response and a review date. Code keeps watching the signal behind a risk and says when it is gone or when the review is due.",
  signals: "What in the Jira data looks like a risk and is not in the register yet: an item blocked, stuck or carried over, a sprint that does not fit, scope that came in after the start, a likely reason of the pre-mortem. Add one to the register or say it is no risk: that is your call, not the code's.",
  premortem: "Suppose the sprint missed its promise: what will it have been? Seven signs of the sprint are measured next to the board's closed sprints at the same point of the sprint. A sign that was as bad or worse before missed sprints more often than before kept ones is a likely reason, shown with its counts. Below four closed sprints nothing is concluded. Resemblance, not proof.",
  blocked: "Open items of the sprint in the status Blocked, with the days they have been there.",
  carried: "Open items that are in their third sprint of this board or later. Work that travels from sprint to sprint is the usual sign of an item that is too big or that waits for somebody else.",
  aging: "Open items past the first column of the board, the longest in their current status first. Ten days or more in one status counts as stuck.",
  added: "Items that came into the sprint after it started and are still in it. Scope added later is the most common reason a commitment slips.",
  // Operations
  notices: "What reached the team lately: bugs and incidents created in the last 24 hours, items whose team field was set to the team in the last 3 days, and issues of other teams that name the team in a comment. The Notices button in the header counts what is new since you last looked.",
  bugs: "Open bugs and incidents in the sprint, the oldest first: the part production takes out of the plan.",
  mix: "The items of the sprint by type, with what is done of each. A large share of bugs and incidents means the sprint serves operations more than the plan.",
  services: "What the team runs, from the service catalogue: the services of the team, their environments and the links to them. Nothing from it becomes a fact on Today.",
  incidents: "Incident reports written by a triage agent: time, service, root cause, suggested steps and how sure the report says it is. A report is a model's text about production: it is shown here and never given to another agent. Only the counts become facts.",
  recurring: "Services or features with two or more incident reports in 90 days: what the team pays for more than once. A candidate for a fix at the root instead of another analysis.",
  // Sprint
  line: "The sprint on the columns of the Jira board, left to right, as it stands now. The last column is what Jira's sprint report counts as done. The small number on an item is its story points; click an item for what the data says about it.",
  scope: "The sprint as Jira's sprint report counts it: committed at the start, added later, taken out, done, not done. The points of the commitment are those of the moment the sprint started. The tests compare these numbers with an answer key that was written together with the data.",
  changes: "Every item that came into the sprint or left it after the start, the newest first.",
  backlog: "The open items of the sprint, the longest in their status first.",
  // Flow
  cycle: "How long completed items took from the first status past the first column to done; each dot is one item. The lines say within how many days half and 85 % of them were finished. Red dots are bugs and incidents.",
  wip: "Items in progress and the days they have spent in their current status. Red: longer in one status than 85 % of the completed items needed from start to done.",
  cfd: "How many items of the sprint stood in each column at the end of each working day. A band that keeps growing is where work queues up.",
  // Hygiene, Inbox
  hygiene: "Checks of the sprint's data in Jira: stories without points, items without a feature, and the like.",
  drafts: "Texts composed by code from the facts of this page, so their numbers are the page's numbers: the sprint status, a note to the product owner when the sprint does not fit, points for the Daily, a summary of the last closed sprint and questions for the retrospective. Change a draft, copy it and send it yourself: the app writes to no other system.",
  sent: "What you marked as sent, kept on this computer only, so that you can see later what was said and when.",
  // Code
  prtime: "Where the time of merged pull requests went: waiting for a first review, in review, approved and waiting for the merge. Hours are counted without weekends.",
  prinbox: "Open pull requests of the team, the longest wait first: waiting for a first review, in review, or approved and not merged. By role, never by name.",
  prweek: "Hours until the first review for the pull requests opened in each week: half of them were reviewed within this time.",
  prsize: "Files changed against days to merge, one dot per merged pull request. Red: more than one round of rework after the first review.",
  prtalk: "The pull requests with the most comments in these weeks: where the team needed the longest conversation.",
  hotspots: "Files changed by two pull requests or more, and how many of those were for a bug. Where code changes often and bugs meet, a test or a clean-up pays off first.",
  nopr: "Items of the sprint that Jira shows in progress for three days or more and that no pull request names. A branch without a pull request is not seen.",
  // Quality
  qsays: "What stands out in the numbers of this tab, the most serious first. A briefing agent chooses among the facts of the tab and words them. Code then checks every line: each number must equal a fact the line cites, and a share in words or an issue key that is not in those facts drops the line. In this demo the agent's reply is a recording, and the check runs on it for real. Click a line to see its facts.",
  qflow: "Every bug created and every bug resolved, added up sprint by sprint. The band between the two lines is the open backlog: where it widens, bugs come in faster than they go out. A bug closed as a duplicate or as not reproducible counts as resolved, as in Jira's own report.",
  qsprints: "Bugs created and resolved in each sprint. The dark part of a red bar is what was found in production. The grey band is the usual range: the fewest and the most new bugs of the last six full sprints. A sprint inside the band is noise, not news. The running sprint is pale: it is not over.",
  qfound: "The phase in which each bug was found, per increment: development, test, staging, production. The later a bug is found, the more it costs. The share found in production is the escape rate; its mirror, the share caught before, is what testers call containment. The table says who found the bugs, by role and never by name.",
  qheat: "Bugs per service and increment: the darker a cell, the more bugs. The red dot counts those found in production, and the small line shows the service sprint by sprint. Read it next to the Code tab: a service that changes a lot has more bugs, and that alone is not a finding.",
  qsevere: "The bugs created in each increment by severity, the most severe on the left. A growing share of Highest and High says the bugs got worse, not only more. The severity is the one Jira holds; where a team sets it loosely, read this chart with care.",
  qfix: "Days from the report of a bug to its fix. The box holds the middle half of the bugs, the line in it is the median, the whiskers reach from the fastest tenth to the slowest. No average: a few very slow bugs would drag it. The table sets each severity against its target, and below five fixed bugs it gives the count instead of a median; a bug that is open and already older than its target counts as missed, so leaving the hard ones open cannot make the share look better.",
  qsurvival: "The share of bugs still open N days after they were reported, by severity (a Kaplan-Meier curve). Unlike a time to fix it counts the bugs that are still open, so slow bugs nobody closed cannot flatter it. A curve that falls fast is good news; a curve that flattens is a pile nobody works on.",
  qdebt: "The bugs open now, by age and severity. An old bug is debt: it is read again at every refinement and fixed in none. The honest ways out are to fix it, or to close it and say why. The oldest are listed below the bars.",
  qcauses: "The causes of the fixed bugs of the increment, the most common first, with the share each holds and what the shares add up to. Two or three causes usually explain most of the bugs: that is where a fix at the root pays. The last column compares with the increment before. A cause is set when a bug is fixed, so open bugs have none.",
  qlinks: "A measure of one sprint set against the bugs of the sprint after: each dot is one sprint. r says how closely the two move together, from -1 to 1. With about twenty sprints r is rough, so the bar shows the range it could really have (95 %). A range that crosses 0 may be chance. Moving together is not cause: use it to pick what to try, then watch what happens.",
  qreleases: "Production bugs reported in the 14 days after each release, the severe ones dark. A release younger than 14 days is pale: its count can still grow. The attribution is rough: a bug found after a release was not always brought by it.",
  qfeatures: "The features with the most bugs in the last two increments: how many were found in production, how many came back after a fix, how many are still open. A feature at the top is worth a look at its tests and its acceptance criteria before more work goes into it.",
  qpis: "The same measures for every increment, side by side. An arrow compares with the increment before; green and red say whether that is better or worse. The running increment is not over: its counts still grow, its shares can already be compared.",
  // Ask and System
  ask: "Questions to the question agent. It reads the same facts as this page through four read-only tools and cannot change or send anything. In this demo the answers are recordings made for this data. The microphone lets you ask aloud: your browser turns speech into text with the speech service of its maker, so the audio leaves this computer, and the app gets only the text. The window stands on the right, at the bottom or floats: drag a floating window by its header; dragged to the right or the bottom edge it docks there. The conversation stays in this tab until you close it.",
  arch: "Who talks to whom. You and your browser stand on the left, the app in the middle, the agents and their model provider on the right, the systems of the team below. Every link says what goes over it: the page asks the app, the app reads the systems with GET requests, an agent gets facts only and reaches the app over MCP, and its replies come back to be checked. A teal frame marks what sends data off this computer; a dashed one is not part of this demo. A green lamp runs in this demo, a hollow one is recorded or prepared here and live in the full version. The numbers are those of this page, right now. On a narrow screen the same parts stand as layers below each other.",
  settings: "The team, the board and the sprint the page shows, and the folder the data comes from. The settings file is optional; Refresh reads it and the data folder again.",
  sources: "Where the data of the page comes from. In the full version every source is read live and read-only; in this demo the data is a folder of invented Jira data and prepared views.",
  runs: "What the check made of each reply of an agent: how many of its lines were kept, and which were dropped and why.",
  rules: "The rules the app keeps. Each of them is enforced by code and covered by a test, not only written down: a line of an agent that breaks one is dropped, and a request that breaks one is refused.",
  storage: "Every file the app keeps on this computer and what is in it. Both lie under var/ and are never committed. Jira stays the store of everything Jira knows: the app keeps only what cannot be computed again, your notes and what you sent.",
};

function helpTip(key, side){
  return `<span class="help-wrap${side ? " " + side : ""}"><button type="button" class="help" data-help="${key}" aria-expanded="false" aria-label="About this panel" title="About this panel">?</button></span>`;
}

function closeHelp(){
  const open = document.querySelector(".help-pop");
  if (!open) return null;
  const button = open.parentNode.querySelector(".help");
  button.setAttribute("aria-expanded", "false");
  open.remove();
  return button;
}

document.addEventListener("click", e => {
  if (e.target.closest(".help-pop")) return;
  const button = e.target.closest("[data-help]"), was = closeHelp();
  if (!button || button === was) return;
  const pop = document.createElement("span");
  pop.className = "help-pop";
  pop.setAttribute("role", "note");
  pop.textContent = HELP[button.dataset.help] || "";
  button.setAttribute("aria-expanded", "true");
  button.parentNode.append(pop);
  if (pop.getBoundingClientRect().right > innerWidth - 8) button.parentNode.classList.add("left");     // near the right edge: open to the left
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeHelp(); });
