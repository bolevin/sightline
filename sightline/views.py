"""The evidence behind Today: what the other tabs of the page show, from the same Jira data.

Lists and series for the page to draw: the sprint on the board's columns, its scope as Jira's sprint report counts
it, the same day by day, the forecast and how it held in past sprints, the signals behind the risks, cycle times,
a few hygiene checks. Every list holds issue keys; `issues` describes each key once. Nothing here is computed
outside the fact layer, and nothing names a person or a title.
"""
from __future__ import annotations

import datetime as dt
from collections import Counter

from .forecast import look_back, past_sprints, percentile, sampled_sprints
from .sprint_scope import sprint_scope
from .today import BUG_TYPES, arrivals, status_names, status_since

STALE_DAYS = 7              # "in progress, no update": how long without any change
PAST_SPRINTS = 8            # bars of the outside view


def _iso(t) -> str | None:
    return t.isoformat(timespec="minutes") if t else None


def _working_days(first: dt.date, last: dt.date) -> list[dt.date]:
    out, d = [], first
    while d <= last:
        if d.weekday() < 5:
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def cycle_times(run, board: int, on_board) -> list[dict]:
    """Items the sampled sprints completed: days from the first status in which work is going on (Board.waiting) to done."""
    b = run.boards[board]
    done = b.done_statuses
    waiting = b.waiting
    out: dict[str, dict] = {}
    for s in sampled_sprints(run, board):
        sc = sprint_scope(run, board, s.id, on_board)
        for key in sc.completed:
            issue = run.issues[key]
            end = issue.done_from(done, sc.end)
            started = next((c.at for c in issue.changes if c.field == "status" and c.new not in waiting and c.new not in done), None)
            if end and started and started <= end:
                out[key] = {"key": key, "type": issue.type, "done": end.date().isoformat(),
                            "days": round((end - started).total_seconds() / 86400, 1)}
    return sorted(out.values(), key=lambda r: (r["done"], r["key"]))


def build(d) -> dict:
    """`d`: the loaded data of the app (run, board, sprint, on_board, facts)."""
    run, board, sprint, on_board = d.run, d.board, d.sprint, d.on_board
    now = run.fetched
    b = run.boards[board]
    s = b.sprints[sprint]
    sc = sprint_scope(run, board, sprint, on_board, now)
    names = status_names(run)
    own = {x.id for x in b.sprints.values() if x.board == board}
    fact = {f.id: f for f in d.facts}
    keys_of = lambda fact_id: list(fact[fact_id].keys) if fact_id in fact else []
    value = lambda fact_id: fact[fact_id].value if fact_id in fact else None
    inside = sc.not_completed | sc.completed | sc.completed_elsewhere
    waiting = b.waiting
    open_items = [run.issues[k] for k in sorted(sc.not_completed)]
    in_progress = [i for i in open_items if i.status not in waiting]

    # the sprint on the board's columns, now
    columns = [{"name": name, "keys": sorted(k for k in inside if run.issues[k].status in statuses)} for name, statuses in b.columns]
    unmapped = inside - {k for c in columns for k in c["keys"]}
    if unmapped:
        columns.append({"name": "Not on the board", "keys": sorted(unmapped)})
    for c in columns:
        c["sp"] = round(sc.points(c["keys"]), 1)

    # its scope, and every move in or out after the start
    part = lambda keys, at_end=True: {"n": len(keys), "sp": round(sc.points(keys, at_end), 1), "keys": sorted(keys)}
    changes = [{"at": _iso(t), "key": k, "what": "added" if came_in else "taken out", "sp": run.issues[k].points_at(t)}
               for k in sc.added | sc.removed for t, came_in in run.issues[k].sprint_moves(sprint) if sc.start < t <= sc.end]
    mix = Counter()
    for k in sc.completed | sc.not_completed:
        kind = run.issues[k].type
        mix[kind, "n"] += 1
        mix[kind, "sp"] += sc.points_end.get(k) or 0
        if k in sc.completed:
            mix[kind, "done_n"] += 1
            mix[kind, "done_sp"] += sc.points_end.get(k) or 0
    kinds = sorted({kind for kind, _ in mix}, key=lambda kind: -mix[kind, "n"])

    # day by day: done and scope (the burnup), and how many items stood in each column (cumulative flow)
    first = sc.start.date()
    last = (s.complete or max(s.end or now, now)).date()     # a sprint that runs past its planned end is drawn on to today
    days, flow = [], []
    shown = _working_days(first, min(now.date(), last))
    for day in shown:
        moment = min(dt.datetime.combine(day, dt.time(23, 59, 59), tzinfo=sc.start.tzinfo), sc.end)
        if day == shown[-1] and now.date() > day:           # a weekend: what was done on it counts for the Friday before
            moment = sc.end
        at = sprint_scope(run, board, sprint, on_board, moment)
        there = at.completed | at.not_completed | at.completed_elsewhere
        days.append({"day": day.isoformat(), "done": round(at.points(at.completed), 1),
                     "scope": round(at.points(at.completed | at.not_completed), 1)})
        flow.append([sum(1 for k in there if run.issues[k].status_at(moment) in statuses) for _, statuses in b.columns])

    cycle = cycle_times(run, board, on_board)
    spans = [c["days"] for c in cycle]
    back = [{"sprint": b.sprints[x["sprint"]].name, "share": round(x["share"], 2), "said_85": round(x["p85"], 1), "said_50": round(x["p50"], 1),
             "ended": round(x["actual"], 1), "held": x["actual"] >= x["p85"] - 1e-9} for x in look_back(run, board, on_board)]
    past = [{"name": p.name, "committed": estimated, "completed": completed} for p, estimated, completed in past_sprints(run, board, sprint)]
    # when the sprint does not fit: what each obvious move would do to the forecast (the facts hold the numbers)
    moves = [("Keep everything in the sprint", [], 0, value("forecast.chance_all_pct"))] if "plan.over_50_sp" in fact else []
    for name, title in (("unstarted", "Move out what has not started"), ("blocked", "Move out what is blocked"), ("both", "Move out both")):
        if f"option.{name}_sp" in fact:
            moves.append((title, keys_of(f"option.{name}_sp"), value(f"option.{name}_sp"), value(f"option.{name}_chance_pct")))
    stale = now - dt.timedelta(days=STALE_DAYS)
    arrived = arrivals(run, sc, now)

    described = inside | sc.removed | sc.added | {n["key"] for n in arrived}        # the options name open items: they are inside
    issues = {k: {"type": i.type, "status": names.get(i.status, i.status), "sp": i.points, "feature": i.feature,
                  "days": (now - status_since(i, now)).days, "sprints": len(i.sprints_at(now) & own), "created": _iso(i.created)}
              for k, i in ((k, run.issues[k]) for k in sorted(described))}
    return {
        "issues": issues,
        "sprint": {"days": [x.isoformat() for x in _working_days(first, last)], "columns": columns, "done_column": b.columns[-1][0] if b.columns else "",
                   "scope": {"committed": part(sc.committed, False), "added": part(sc.added, False), "removed": part(sc.removed),
                             "done": part(sc.completed), "not_done": part(sc.not_completed), "done_before": part(sc.completed_elsewhere)},
                   "changes": sorted(changes, key=lambda c: (c["at"], c["key"]), reverse=True), "burnup": days,
                   "mix": [{"type": kind, "n": mix[kind, "n"], "sp": round(mix[kind, "sp"], 1), "done_n": mix[kind, "done_n"],
                            "done_sp": round(mix[kind, "done_sp"], 1)} for kind in kinds]},
        "promises": {"committed": value("sprint.committed_sp"), "done": value("sprint.done_sp"), "open": value("sprint.open_sp"),
                     "p85": value("forecast.p85_done_sp"), "p50": value("forecast.p50_done_sp"), "chance": value("forecast.chance_all_pct"),
                     "history_days": value("forecast.history_days"), "days_left": value("forecast.days_left"),
                     "look_back": back, "past": past[-PAST_SPRINTS:], "over_50": value("plan.over_50_sp"), "over_85": value("plan.over_85_sp"),
                     "options": [{"title": title, "keys": keys, "sp": sp, "chance": chance} for title, keys, sp, chance in moves]},
        "risks": {"blocked": keys_of("backlog.blocked_n"), "carried": keys_of("backlog.carried_n"), "added": sorted(sc.added & inside),
                  "aging": [i.key for i in sorted(in_progress, key=lambda i: (status_since(i, now), i.key))]},
        "flow": {"columns": [name for name, _ in b.columns], "days": [x["day"] for x in days], "counts": flow, "cycle": cycle,
                 "cycle_p50": round(percentile(spans, .5), 1) if spans else None, "cycle_p85": round(percentile(spans, .85), 1) if spans else None},
        "code": d.extras.get("code"),
        "incidents": d.extras.get("incidents"),
        "premortem": d.premortem,
        "operations": {"open_bugs": sorted((i.key for i in open_items if i.type in BUG_TYPES), key=lambda k: run.issues[k].created)},
        "hygiene": [
            {"check": "Stories in progress with no story points", "keys": [i.key for i in in_progress if i.type == "Story" and i.points is None]},
            {"check": "Stories with no feature link", "keys": [i.key for i in open_items if i.type == "Story" and not i.feature]},
            {"check": f"In progress, no update for more than {STALE_DAYS} days", "keys": [i.key for i in in_progress if i.updated and i.updated < stale]},
            {"check": "Open items in their third sprint or later", "keys": keys_of("backlog.carried_n")},
        ],
    }
