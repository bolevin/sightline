"""What stands in for the outside world in this demo.

The full application reads Jira and the Git hosting itself, asks agents that run on a model, and reads incident reports
and a service catalogue. None of that is part of the demo. Its place is taken by files in the data folder:

- extras.json    the views of pull requests, incident reports and services, prepared from invented inputs
- briefing.json  a reply of the briefing agent, recorded for this data: the page as the agent worded it
- ask.json       answers of the question agent to a handful of questions, recorded the same way
- quality_briefing.json  what the briefing agent wrote about the bugs: the findings of the Quality tab

Nothing here is trusted because it is a file: the briefing is checked against the facts by page.check_page every
time the page is built, exactly as a live reply would be. One of its lines is wrong on purpose, so the check has
something to drop.
"""
from __future__ import annotations

import json
from pathlib import Path

from .today import Fact

EXTRAS, BRIEFING, ASK, FINDINGS = "extras.json", "briefing.json", "ask.json", "quality_briefing.json"
NO_ANSWER = ("This demo has no model behind it. The cards above are answered from a recording; a question of your own "
             "is answered in the full version by an agent that reads the facts through the read-only tools.")


def _read(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def extras(folder: Path) -> dict:
    """{"code", "incidents", "services", "facts"}: prepared views and the facts that come with them."""
    raw = _read(folder / EXTRAS, {})
    raw = raw if isinstance(raw, dict) else {}
    rows = [r for name in ("code_facts", "incident_facts") for r in raw.get(name) or [] if isinstance(r, dict)]
    facts = [Fact(r["id"], r["card"], r["label"], r["value"], r.get("unit", ""), tuple(r.get("keys") or ()), r.get("level", "info")) for r in rows]
    return {"code": raw.get("code"), "incidents": raw.get("incidents"), "facts": facts,
            "services": raw.get("services") or {"status": "off", "detail": "no service catalogue in this data"}}


def briefing(folder: Path) -> dict | None:
    """The recorded reply of the briefing agent, or None when the folder has none (the page is then laid out by rules)."""
    reply = _read(folder / BRIEFING, None)
    return reply if isinstance(reply, dict) else None


def findings(folder: Path) -> list | None:
    """The recorded lines of the briefing agent about the bugs, or None when the folder has none."""
    reply = _read(folder / FINDINGS, None)
    return reply.get("rows") if isinstance(reply, dict) and isinstance(reply.get("rows"), list) else None


def questions(folder: Path) -> list[dict]:
    """The recorded questions and answers of the Ask window: [{"kind", "q", "a", "tools"}]."""
    rows = _read(folder / ASK, [])
    return [r for r in rows if isinstance(r, dict) and isinstance(r.get("q"), str) and isinstance(r.get("a"), str)] if isinstance(rows, list) else []


def answer(folder: Path, text: str) -> dict:
    """{"answer", "tool_calls", "recorded"} for a question of the Ask window."""
    asked = " ".join(text.split()).lower()
    for row in questions(folder):
        if " ".join(row["q"].split()).lower() == asked:
            return {"answer": row["a"], "tool_calls": int(row.get("tools") or 0), "recorded": True}
    return {"answer": NO_ANSWER, "tool_calls": 0, "recorded": False}


def agent_state(reply, checked, at: str | None) -> dict:
    """What the System page says about the agents, and the one run the demo has to show."""
    if not reply:
        return {"engine": "off", "status": "off", "detail": "no recorded briefing in the data folder: the page is laid out by rules", "runs": []}
    rows = sum(len(c["rows"]) for c in checked.page["cards"] if c["by"] == "agent")
    run = {"kind": "briefing", "at": at, "why": "recorded for this data", "seconds": None, "result": checked.page["by"], "rows": rows,
           "problems": checked.problems, "error": ""}
    return {"engine": "replay", "status": "ok", "runs": [run],
            "detail": "a recorded reply of the briefing agent, checked against the facts each time the page is built"}
