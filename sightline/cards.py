"""The card of an issue: what the page shows when the pointer rests on an issue key.

A title is for the eyes of the person at the page and for nobody else. So it does not travel with the facts: the
fact layer has no field for it, and nothing that words or checks a text (page, drafts, tools) imports this
module. The titles are read here, straight from the data folder, and go one way only: into the state of the page,
next to the facts and never inside them. The full application reads a title from Jira at the moment the card is
shown and keeps it nowhere.
"""
from __future__ import annotations

import json

from .facts import Run
from .today import status_names

MAX_TITLE = 200


def _raw(run: Run):
    """Every issue of the data folder as Jira gave it."""
    for path in sorted(run.folder.glob("board-*/sprint-*.json")) + sorted(run.folder.glob("jql-*.json")):
        if path.name.endswith("-issues.json") or path.name.endswith("-removed.json") or path.name.startswith("jql-"):
            data = json.loads(path.read_text(encoding="utf-8"))
            yield from (data.get("issues") or []) if isinstance(data, dict) else data


def sprint_cards(run: Run, on_board=None) -> dict[str, dict]:
    """Issue key -> {"title", "priority", "type", "status", "sp", "feature", "team"} for the issues of the sprint
    data. `team` is given for an issue the board does not show (one of another team that names this team in a
    comment)."""
    names = status_names(run)
    shown = {}
    for raw in _raw(run):
        fields = raw.get("fields") or {}
        title, priority = fields.get("summary"), (fields.get("priority") or {}).get("name")
        shown[raw.get("key")] = (title[:MAX_TITLE] if isinstance(title, str) else "", priority if isinstance(priority, str) else "")
    out = {}
    for key, issue in sorted(run.issues.items()):
        title, priority = shown.get(key, ("", ""))
        foreign = on_board is not None and not on_board(issue)
        out[key] = {"title": title, "priority": priority, "type": issue.type, "status": names.get(issue.status, issue.status), "sp": issue.points,
                    "feature": issue.feature, "team": issue.team if foreign else None}
    return out


def cards(run: Run, on_board=None) -> dict[str, dict]:
    """The cards of every issue the page can name: those of the sprint data and the bugs of the Quality tab."""
    out = sprint_cards(run, on_board)
    path = run.folder / "quality.json"
    bugs = json.loads(path.read_text(encoding="utf-8")).get("bugs") or [] if path.exists() else []
    for bug in bugs:
        if bug["key"] not in out:
            out[bug["key"]] = {"title": str(bug.get("title") or "")[:MAX_TITLE], "priority": bug.get("priority") or "", "type": "Bug", "status": bug.get("status") or "",
                               "sp": None, "feature": bug.get("feature"), "team": None}
    return out
