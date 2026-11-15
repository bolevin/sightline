"""The fact layer: the Jira data of one read as plain objects, with the value of a field at any moment.

Jira keeps only the current value of a field plus a changelog. The value at moment t is the current value with every
change after t undone, newest first. Before the issue was created it was in no sprint and had no status.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

# The custom fields of the Jira the data comes from. Their ids differ from one Jira to the next.
SPRINT_FIELD = "customfield_10020"
POINTS_FIELD = "customfield_10016"
TEAM_FIELD = "customfield_10001"
FEATURE_FIELD = "customfield_10014"
TEAM_CHANGE = "team"             # the name of the team field in a changelog entry, lower case
_SPRINT_ID = re.compile(r"[\[,]id=(\d+)[,\]]")       # the id attribute of a sprint string, not an "id=" inside its goal


def when(text: str | None) -> dt.datetime | None:
    """Jira time stamps: 2026-05-12T09:20:54.750+0200 (changelog) or ...+02:00 (agile API)."""
    if not text:
        return None
    return dt.datetime.fromisoformat(re.sub(r"([+-]\d\d)(\d\d)$", r"\1:\2", text))


def _ids(text: str | None) -> frozenset[int]:
    return frozenset(int(x) for x in re.findall(r"\d+", text or ""))


def _points(text: str | None) -> float | None:
    try:
        return float(text) if text not in (None, "") else None
    except ValueError:
        return None


@dataclass(frozen=True)
class Change:
    at: dt.datetime
    field: str          # lower case: sprint, status, story points, ...
    old: str | None     # raw id(s) where Jira has them, else the shown value
    new: str | None
    old_text: str | None
    new_text: str | None


@dataclass
class Issue:
    key: str
    type: str
    subtask: bool
    created: dt.datetime
    status: str                     # status id now
    points: float | None            # story points now
    sprints: frozenset[int]         # sprint ids now
    team: str | None                # the team field: "Kestrel"
    feature: str | None
    changes: list[Change] = field(default_factory=list)   # oldest first
    updated: dt.datetime | None = None

    def _at(self, name: str, t: dt.datetime, now, undo):
        value = now
        for c in reversed(self.changes):
            if c.at <= t:
                break
            if c.field == name:
                value = undo(c)
        return value

    def sprints_at(self, t: dt.datetime) -> frozenset[int]:
        if t < self.created:
            return frozenset()
        return self._at("sprint", t, self.sprints, lambda c: _ids(c.old))

    def status_at(self, t: dt.datetime) -> str | None:
        if t < self.created:
            return None
        return self._at("status", t, self.status, lambda c: c.old)

    def points_at(self, t: dt.datetime) -> float | None:
        if t < self.created:
            return None
        return self._at("story points", t, self.points, lambda c: _points(c.old_text))

    def done_since(self, done: frozenset[str], t: dt.datetime) -> dt.datetime | None:
        """When the issue last moved into (or within) the done statuses, as seen at t; None if not done at t."""
        if self.status_at(t) not in done:
            return None
        last = self.created
        for c in self.changes:
            if c.at > t:
                break
            if c.field == "status" and c.new in done:
                last = c.at
        return last

    def done_from(self, done: frozenset[str], t: dt.datetime) -> dt.datetime | None:
        """When the issue came into the done statuses and has stayed in them since, as seen at t; None if not done
        at t. Unlike `done_since`, a move between two done statuses (Approve -> Done on some boards) does not count:
        this is the day the work was finished."""
        if self.status_at(t) not in done:
            return None
        since = self.created
        for c in self.changes:
            if c.at > t:
                break
            if c.field == "status" and c.new in done and c.old not in done:
                since = c.at
        return since

    def sprint_moves(self, sprint: int) -> list[tuple[dt.datetime, bool]]:
        """(moment, now in the sprint?) for every change that put the issue into or out of the sprint. Creating an
        issue right in a sprint leaves no changelog entry; it counts as a move in at the creation time."""
        out = []
        if sprint in self.sprints_at(self.created):
            out.append((self.created, True))
        for c in self.changes:
            if c.field == "sprint":
                was, now = sprint in _ids(c.old), sprint in _ids(c.new)
                if was != now:
                    out.append((c.at, now))
        return out


@dataclass(frozen=True)
class Sprint:
    id: int
    name: str
    board: int
    state: str
    start: dt.datetime | None       # planned start (Jira startDate)
    activated: dt.datetime | None   # when someone pressed "start"
    end: dt.datetime | None
    complete: dt.datetime | None


QUEUES = ("backlog", "ready", "todo", "open", "new", "refinement")       # names of columns where work waits to be started


@dataclass
class Board:
    id: int
    name: str
    columns: list[tuple[str, frozenset[str]]]   # (column, status ids), left to right
    sprints: dict[int, Sprint]

    @property
    def done_statuses(self) -> frozenset[str]:
        """Jira counts an issue as done for a sprint when its status is in the right-most column."""
        return self.columns[-1][1] if self.columns else frozenset()

    @property
    def waiting(self) -> frozenset[str]:
        """The statuses of work that has not started: those of the left-most column, and of the columns right after it
        that are named as a queue (Backlog, Ready, To Do). The category Jira gives a status does not tell: a
        workflow may count "Backlog" as in progress, and on some boards it is the second column, where work waits."""
        out: set[str] = set()
        for n, (name, statuses) in enumerate(self.columns):
            if n and name.lower().replace(" ", "") not in QUEUES:
                break
            out |= statuses
        return frozenset(out)


def _team(v) -> str | None:
    if not isinstance(v, dict):
        return None
    child = (v.get("child") or {}).get("value")
    return v.get("value") + (f"/{child}" if child else "") if v.get("value") else None


def issue_from_json(raw: dict) -> Issue:
    f = raw["fields"]
    changes = []
    for h in (raw.get("changelog") or {}).get("histories", []):
        at = when(h["created"])
        for it in h.get("items", []):
            changes.append(Change(at, str(it.get("field", "")).lower(), it.get("from"), it.get("to"),
                                  it.get("fromString"), it.get("toString")))
    changes.sort(key=lambda c: c.at)
    sprints = frozenset(int(m) for s in (f.get(SPRINT_FIELD) or []) for m in _SPRINT_ID.findall(str(s)))
    return Issue(key=raw["key"], type=f["issuetype"]["name"], subtask=bool(f["issuetype"].get("subtask")),
                 created=when(f["created"]), status=str(f["status"]["id"]), points=f.get(POINTS_FIELD),
                 sprints=sprints, team=_team(f.get(TEAM_FIELD)), feature=f.get(FEATURE_FIELD), changes=changes,
                 updated=when(f.get("updated")))


@dataclass
class Run:
    folder: Path
    fetched: dt.datetime
    boards: dict[int, Board]
    issues: dict[str, Issue]
    sets: dict[str, tuple[str, ...]] = field(default_factory=dict)    # issue keys of each extra search (jql-<name>.json)

    def report(self, board: int, sprint: int) -> dict | None:
        """Jira's own sprint report, when the folder holds it (a reference the own numbers can be checked against)."""
        p = self.folder / f"board-{board}" / f"sprint-{sprint}-report.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

    def sampled(self, board: int, sprint: int) -> bool:
        """Whether the run holds the sprint: the issues the board shows in it, each with its history."""
        return (self.folder / f"board-{board}" / f"sprint-{sprint}-issues.json").exists()


def load_run(folder: str | Path) -> Run:
    folder = Path(folder)
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    manifest = read(folder / "manifest.json")
    server = read(folder / "server.json")
    tz = when(server["serverTime"]).tzinfo
    fetched = dt.datetime.fromisoformat(manifest["fetched_at"]).replace(tzinfo=tz)
    boards: dict[int, Board] = {}
    for bdir in sorted(folder.glob("board-*")):
        bid = int(bdir.name.split("-")[1])
        conf = read(bdir / "configuration.json")
        columns = [(c["name"], frozenset(str(s["id"]) for s in c.get("statuses", [])))
                   for c in conf.get("columnConfig", {}).get("columns", [])]
        sprints = {s["id"]: Sprint(s["id"], s["name"], s.get("originBoardId", bid), s["state"], when(s.get("startDate")),
                                   when(s.get("activatedDate")), when(s.get("endDate")), when(s.get("completeDate")))
                   for s in read(bdir / "sprints.json")}
        boards[bid] = Board(bid, conf.get("name", ""), columns, sprints)
    issues: dict[str, Issue] = {}
    files = (sorted(folder.glob("board-*/sprint-*-issues.json")) + sorted(folder.glob("board-*/sprint-*-removed.json"))
             + sorted(folder.glob("jql-*.json")))
    sets: dict[str, tuple[str, ...]] = {}
    for p in files:
        data = read(p)
        raws = data["issues"] if isinstance(data, dict) else data
        if p.name.startswith("jql-"):
            sets[p.stem[4:]] = tuple(raw["key"] for raw in raws)
        for raw in raws:            # an issue carried from sprint to sprint is in several files: the newest copy counts.
            issue = issue_from_json(raw)
            seen = issues.get(issue.key)
            if seen is None or (issue.updated is not None and (seen.updated is None or issue.updated > seen.updated)):
                issues[issue.key] = issue
    return Run(folder, fetched, boards, issues, sets)
