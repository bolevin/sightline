"""The facts the Today page is built from, computed from the Jira data of one board and sprint.

A fact is a small record: an id, a value and the issue keys behind it. Code computes facts; agents get them through
read-only tools and may only choose among them and word them. page.py checks an agent's reply against the same
facts, so a number on the page is always a number from here.
"""
from __future__ import annotations

import datetime as dt
from collections import Counter
from dataclasses import dataclass
from typing import Callable

from .facts import TEAM_CHANGE, Issue, Run
from .sprint_scope import Scope, sprint_scope

LEVELS = ("critical", "warning", "info", "ok")
CARRIED_FROM = 3            # an item counts as carried over from its third sprint on this board
HANDOVER_DAYS = 3           # how far back a change of the team field counts as "handed to the team"
NEW_HOURS = 24              # how far back a created bug counts as new
BUG_TYPES = ("Bug", "Incident")
INBOX, MENTIONS = "inbox", "mentions"       # two extra searches that come with the data: jql-inbox.json, jql-mentions.json


@dataclass(frozen=True)
class Fact:
    id: str                         # "sprint.done_sp", "item.KES-1.days_in_status"
    card: str                       # where the rules put it: promises | risks | operations
    label: str                      # plain English, without the value: "done", "blocked items"
    value: float | int | str | None
    unit: str = ""
    keys: tuple[str, ...] = ()      # issue keys behind the fact
    level: str = "info"             # the rules' own judgement

    def text(self) -> str:
        v = "" if self.value is None else f"{self.value:g}" if isinstance(self.value, float) else str(self.value)
        return " ".join(x for x in (self.label + ":" if v else self.label, v, self.unit) if x)


def workdays(a: dt.date, b: dt.date) -> int:
    """Monday to Friday days from a to b, both included."""
    n, d = 0, a
    while d <= b:
        n += d.weekday() < 5
        d += dt.timedelta(days=1)
    return n


def status_names(run: Run) -> dict[str, str]:
    """Status id -> name, learnt from the changelogs (a status change holds both)."""
    names: dict[str, str] = {}
    for issue in run.issues.values():
        for c in issue.changes:
            if c.field == "status":
                if c.new and c.new_text:
                    names[c.new] = c.new_text
                if c.old and c.old_text:
                    names[c.old] = c.old_text
    return names


def status_since(issue: Issue, now: dt.datetime) -> dt.datetime:
    last = issue.created
    for c in issue.changes:
        if c.at > now:
            break
        if c.field == "status":
            last = c.at
    return last


def arrivals(run: Run, sc: Scope, now: dt.datetime) -> list[dict]:
    """What reached the team lately, newest first: {"kind", "key", "at", "text", "handed"}.

    bug: a bug or an incident created in the last NEW_HOURS, or handed to the team in that time.
    handed: any other item whose team field was set to the team in the last HANDOVER_DAYS (a value chosen when
    the issue was created leaves no trace in the changelog, so this is always somebody passing it on).
    mention: an issue of another team whose comments name the team (the search "mentions").
    Looked for among the issues of the sprint and among all issues of the board that changed lately (the search
    "inbox")."""
    since, recent = now - dt.timedelta(hours=NEW_HOURS), now - dt.timedelta(days=HANDOVER_DAYS)
    foreign = [k for k in run.sets.get(MENTIONS, ()) if k in run.issues]
    seen = {k: run.issues[k] for k in sorted(sc.not_completed | sc.completed | sc.completed_elsewhere)}
    team = Counter(i.team for i in seen.values() if i.team).most_common(1)
    team = team[0][0] if team else None
    for k in run.sets.get(INBOX, ()):
        if k not in foreign and not run.issues[k].subtask:
            seen.setdefault(k, run.issues[k])
    out = []
    for i in seen.values():
        bug = i.type in BUG_TYPES
        moved = [c for c in i.changes if c.field == TEAM_CHANGE and recent <= c.at <= now and team and c.new_text == team]
        if moved:
            origin = moved[-1].old_text
            out.append({"kind": "bug" if bug and moved[-1].at >= since else "handed", "key": i.key, "at": moved[-1].at, "handed": True,
                        "text": f"{i.type} handed to the team" + (f" by {origin}" if origin else "")})
        elif bug and since <= i.created <= now:
            out.append({"kind": "bug", "key": i.key, "at": i.created, "handed": False, "text": f"New {i.type.lower()} for the team"})
    for k in foreign:
        out.append({"kind": "mention", "key": k, "at": min(run.issues[k].updated or now, now), "handed": False,
                    "text": "An issue of another team names the team in a comment"})
    return sorted(out, key=lambda n: (n["at"], n["key"]), reverse=True)


def notices(run: Run, board: int, sprint: int, now: dt.datetime | None = None,
            on_board: Callable[[Issue], bool] | None = None) -> list[dict]:
    now = now or run.fetched
    return arrivals(run, sprint_scope(run, board, sprint, on_board, now), now)


def today_facts(run: Run, board: int, sprint: int, now: dt.datetime | None = None,
                on_board: Callable[[Issue], bool] | None = None) -> list[Fact]:
    """Facts about one sprint as of `now` (default: when the data was fetched)."""
    now = now or run.fetched
    b = run.boards[board]
    s = b.sprints[sprint]
    sc = sprint_scope(run, board, sprint, on_board, now)
    names = status_names(run)
    own = {x.id for x in b.sprints.values() if x.board == board}
    sp = lambda keys, end=True: round(sc.points(keys, at_end=end), 1)
    out: list[Fact] = []
    add = lambda *a, **k: out.append(Fact(*a, **k))

    # the sprint as a promise
    start = (s.activated or s.start).date()
    day = workdays(start, min(now, sc.end).date())
    days = workdays(start, s.end.date()) if s.end else day
    committed, done = sp(sc.committed, False), sp(sc.completed)
    behind = days and committed and day / days >= .4 and done / committed < .5 * day / days
    add("sprint.day", "promises", "working day of the sprint", day, f"of {days}")
    add("sprint.committed_sp", "promises", "committed at the start", committed, "SP", tuple(sorted(sc.committed)))
    add("sprint.done_sp", "promises", "done", done, "SP", tuple(sorted(sc.completed)), "warning" if behind else "info")
    add("sprint.done_n", "promises", "items done", len(sc.completed), "", tuple(sorted(sc.completed)))
    add("sprint.open_sp", "promises", "not done yet", sp(sc.not_completed), "SP", tuple(sorted(sc.not_completed)))
    add("sprint.open_n", "promises", "items not done yet", len(sc.not_completed), "", tuple(sorted(sc.not_completed)))
    if sc.added:
        add("sprint.added_n", "promises", "items added after the start", len(sc.added), "", tuple(sorted(sc.added)), "warning")
        add("sprint.added_sp", "promises", "added after the start", round(sum(sc.points_start.get(k) or 0 for k in sc.added), 1),
            "SP", tuple(sorted(sc.added)))
    if sc.removed:
        add("sprint.removed_n", "promises", "items taken out", len(sc.removed), "", tuple(sorted(sc.removed)))

    # the backlog of the sprint: where the open work stands
    open_items = [run.issues[k] for k in sorted(sc.not_completed)]
    then = sc.end                                           # now for a running sprint; the close of a closed one
    status = {i.key: i.status_at(then) for i in open_items}
    by_status = Counter(names.get(status[i.key], status[i.key]) for i in open_items)
    for name, n in by_status.most_common():
        keys = tuple(i.key for i in open_items if names.get(status[i.key], status[i.key]) == name)
        add(f"backlog.status.{name}", "risks", f"open items in {name}", n, "", keys)
    blocked = [i for i in open_items if names.get(status[i.key], "").lower() == "blocked"]
    if blocked:
        add("backlog.blocked_n", "risks", "blocked items", len(blocked), "", tuple(i.key for i in blocked), "critical")
        add("backlog.blocked_sp", "risks", "blocked", sp([i.key for i in blocked]), "SP", tuple(i.key for i in blocked), "critical")
    waiting = b.waiting                                     # not started, so it cannot be stuck
    aged = sorted(((then - status_since(i, then)).days, i.key) for i in open_items if status[i.key] not in waiting)
    for age, key in aged[::-1][:5]:
        add(f"item.{key}.days_in_status", "risks", f"{key} in {names.get(status[key], status[key])}", age, "days", (key,),
            "warning" if age >= 10 else "info")
    carried = sorted(((len(i.sprints_at(now) & own), i.key) for i in open_items), reverse=True)
    carried = [(n, k) for n, k in carried if n >= CARRIED_FROM]
    if carried:
        add("backlog.carried_n", "risks", f"items in their {CARRIED_FROM}rd sprint or later", len(carried), "",
            tuple(k for _, k in carried), "warning")
        n, k = carried[0]
        add(f"item.{k}.sprints", "risks", f"{k} is in sprint number", n, "", (k,), "warning")
    no_points = [i.key for i in open_items if i.type == "Story" and i.points_at(now) is None]
    if no_points:
        add("backlog.unestimated_n", "risks", "open stories without story points", len(no_points), "", tuple(no_points))

    # what arrived: new bugs, items handed to the team, the team named by others
    arrived = arrivals(run, sc, now)
    bugs = sorted(n["key"] for n in arrived if n["kind"] == "bug")
    add("notice.new_bugs_n", "operations", f"bugs and incidents new for the team in the last {NEW_HOURS} hours", len(bugs), "",
        tuple(bugs), "warning" if bugs else "ok")
    open_bugs = [i.key for i in open_items if i.type in BUG_TYPES]
    add("notice.open_bugs_n", "operations", "open bugs and incidents in the sprint", len(open_bugs), "", tuple(open_bugs))
    handed = sorted(n["key"] for n in arrived if n["handed"])
    if handed:
        add("notice.handed_n", "operations", f"items handed to the team in the last {HANDOVER_DAYS} days", len(handed), "", tuple(handed))
    if MENTIONS in run.sets:
        named = sorted(n["key"] for n in arrived if n["kind"] == "mention")
        add("notice.mentions_n", "operations", f"issues of other teams that name the team in a comment, updated in the last {HANDOVER_DAYS} days",
            len(named), "", tuple(named), "warning" if named else "ok")
    return out
