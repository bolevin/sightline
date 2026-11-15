/* Sightline, the hosted demo. There is no server behind this page, so this file answers what the page asks one:
   the state comes from state.json, built by tools/build_site.py, and what you change (the risk register, texts
   marked as sent, questions) lives in this tab until it is closed. Nothing is sent anywhere. */
"use strict";
(() => {
  const real = window.fetch.bind(window);
  const NO_ANSWER = "This demo has no model behind it. The cards above are answered from a recording; a question of your own " +
    "is answered in the full version by an agent that reads the facts through the read-only tools.";
  const ROAM = ["new", "owned", "accepted", "mitigated", "resolved"];
  let base = null, next = 1;
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {"Content-Type": "application/json"}});
  const refuse = text => { throw new Error(text); };
  const text = (value, name, most, needed) => {
    if (typeof value !== "string") refuse(`${name} must be plain text`);
    const out = value.trim();
    if (needed && !out) refuse(`A risk needs a ${name}`);
    if (out.length > most) refuse(`The ${name} is longer than ${most} characters`);
    return out;
  };

  // The risk register as sightline/risks.py keeps it, for one tab: the same actions, the same refusals in short.
  function risk(action){
    const reg = base.register, today = base.data.fetched.slice(0, 10);
    if (action.do === "add"){
      const found = action.signal ? reg.candidates.find(c => c.signal === action.signal) : null;
      if (action.signal && !found) refuse("This signal is no longer in the data: refresh the page");
      const title = found ? found.title : text(action.title, "title", 160, true);
      reg.risks.unshift({id: `R-${next++}`, board: base.board.id, signal: found ? found.signal : null, title, keys: found ? found.keys : [], roam: "new",
        owner: "", response: "", review: "", created: today, closed: null, now: found ? found.title : null, gone: false, review_due: false});
      if (found) reg.candidates = reg.candidates.filter(c => c !== found);
    } else if (action.do === "update"){
      const r = reg.risks.find(x => x.id === action.id) || refuse(`No risk '${action.id}'`);
      if ("roam" in action && !ROAM.includes(action.roam)) refuse(`ROAM must be one of ${ROAM.join(", ")}`);
      if ("review" in action && action.review !== "" && !/^\d{4}-\d\d-\d\d$/.test(action.review)) refuse("The review date must be a date, such as 2026-11-20");
      const change = {};
      if ("title" in action) change.title = text(action.title, "title", 160, true);
      if ("owner" in action) change.owner = text(action.owner, "owner", 60);
      if ("response" in action) change.response = text(action.response, "response", 600);
      if ("roam" in action) change.roam = action.roam;
      if ("review" in action) change.review = action.review;
      Object.assign(r, change);
      r.closed = r.roam === "resolved" ? (r.closed || today) : null;
      r.review_due = r.roam !== "resolved" && !!r.review && r.review <= today;
      reg.risks.sort((a, b) => (a.roam === "resolved") - (b.roam === "resolved") || +b.id.slice(2) - +a.id.slice(2));
    } else if (action.do === "dismiss"){
      const found = reg.candidates.find(c => c.signal === action.signal) || refuse("This signal is no longer in the data: refresh the page");
      reg.candidates = reg.candidates.filter(c => c !== found);
      reg.dismissed.push({board: base.board.id, signal: found.signal, at: today, level: found.level, title: found.title, keys: found.keys});
    } else if (action.do === "restore"){
      const d = reg.dismissed.find(x => x.signal === action.signal);
      if (d){ reg.dismissed = reg.dismissed.filter(x => x !== d); reg.candidates.push({signal: d.signal, title: d.title, keys: d.keys || [], level: d.level}); }
    } else refuse(`Unknown change: ${action.do}`);
  }

  function sent(body){
    const draft = base.inbox.drafts.find(d => d.id === body.kind) || refuse(`No draft '${body.kind}'`);
    if (typeof body.text !== "string" || !body.text.trim()) refuse("There is nothing to keep: the text is empty");
    base.inbox.sent.unshift({at: base.data.fetched, kind: body.kind, title: draft.title, to: draft.to, sprint: base.sprint.name, text: body.text.trim()});
  }

  window.fetch = async (url, options = {}) => {
    const path = String(url).split("?")[0];
    if (!path.startsWith("api/")) return real(url, options);
    if (!base){
      base = await (await real("state.json")).json();
      base.storage.folder = "this browser tab";
      base.storage.files.forEach(f => { f.path = f.path.replace("var/", "in memory: "); });
    }
    let body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; } catch (error){ return reply({error: "Send application/json."}, 400); }
    try {
      if (path === "api/today") return reply(base);
      if (path === "api/ask"){
        const asked = String(body.text || "").trim().replace(/\s+/g, " ").toLowerCase();
        const hit = base.ask.find(row => row.q.trim().replace(/\s+/g, " ").toLowerCase() === asked);
        return reply(hit ? {answer: hit.a, tool_calls: hit.tools || 0, recorded: true} : {answer: NO_ANSWER, tool_calls: 0, recorded: false});
      }
      if (path === "api/risks"){ risk(body); return reply({ok: true}); }
      if (path === "api/outbox"){ sent(body); return reply({ok: true}); }
    } catch (error){ return reply({error: error.message}, 400); }
    return reply({error: "Not found."}, 404);
  };
})();
