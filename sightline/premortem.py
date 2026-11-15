"""The pre-mortem. Suppose the running sprint missed its promise: what will it have been?

The answer is looked for in the team's own history, not in a textbook. For every closed sprint in the data, code
measures a few signs as they stood at the same point of the sprint where the running sprint is now, and whether the
sprint kept its promise in the end. For each sign it then counts in how many missed sprints, and in how many kept
ones, the sign was at least as bad as it is today. A sign seen more often before a miss than before a kept promise
is a likely reason.

This is resemblance, not statistics: a handful of sprints proves nothing. So nothing is called a reason below
MIN_HISTORY closed sprints, or while the history holds only kept or only missed sprints, and every reason carries
its counts. Team level only: no sign looks at who did what.
"""
from __future__ import annotations

import datetime as dt

from .forecast import past_sprints, sampled_sprints
from .sprint_scope import sprint_scope
from .today import Fact, status_names

KEPT = 80                   # per cent of the commitment done: from here on a sprint kept its promise
MIN_HISTORY = 4             # closed sprints needed before anything is called a reason
BEFORE = 3                  # sprints behind "what the sprints before completed on average"
# id, what it measures, unit, whether more of it is worse, the words for a risk
SIGNS = (
    ("load", "committed, against what the sprints before completed on average", "%", True, "more is committed than the team usually completes"),
    ("carried", "committed items that came over from an earlier sprint", "%", True, "much of the commitment came over from earlier sprints"),
    ("unestimated", "committed items without story points", "%", True, "much of the commitment has no estimate"),
    ("added", "items added after the start, against the committed items", "%", True, "much came in after the start"),
    ("unstarted", "committed items not started yet", "%", True, "much of the commitment has not started"),
    ("blocked", "items in the status Blocked", "open", True, "items are blocked"),
    ("done", "of the commitment done", "%", False, "little of the commitment is done"),
)


def said_done(sc) -> int | None:
    """Per cent of the commitment that is done: by the story points of the start, or by items when the committed
    items carry no points. None when nothing was committed."""
    done = sc.committed & sc.completed
    points = sc.points(sc.committed, at_end=False)
    if points:
        return round(100 * sc.points(done, at_end=False) / points)
    return round(100 * len(done) / len(sc.committed)) if sc.committed else None


def measure(run, board: int, sprint: int, on_board=None, at: dt.datetime | None = None) -> tuple[dict, dict]:
    """The signs of one sprint as they stood at `at` (default: at its end, or now if it runs):
    ({sign: value or None}, {sign: the issue keys behind it, where single issues stand behind it})."""
    b = run.boards[board]
    sc = sprint_scope(run, board, sprint, on_board, at)
    own = {x.id for x in b.sprints.values() if x.board == board}
    names = status_names(run)
    waiting = b.waiting
    issue, t = run.issues, sc.end
    start = sc.sprint.activated or sc.sprint.start
    before = [done for s, _, done in past_sprints(run, board, but=sprint) if (s.activated or s.start) < start][-BEFORE:]
    usual = sum(before) / len(before) if before else 0
    keys = {"carried": {k for k in sc.committed if (issue[k].sprints_at(sc.start) & own) - {sprint}},
            "unestimated": {k for k in sc.committed if sc.points_start.get(k) is None},
            "added": sc.added,
            "unstarted": {k for k in sc.committed & sc.not_completed if issue[k].status_at(t) in waiting},
            "blocked": {k for k in sc.not_completed if names.get(issue[k].status_at(t), "").lower() == "blocked"}}
    share = lambda name: round(100 * len(keys[name]) / len(sc.committed)) if sc.committed else None
    values = {"load": round(100 * sc.points(sc.committed, at_end=False) / usual) if usual else None,
              "carried": share("carried"), "unestimated": share("unestimated"), "added": share("added"), "unstarted": share("unstarted"),
              "blocked": len(keys["blocked"]), "done": said_done(sc)}
    return values, {name: sorted(found) for name, found in keys.items()}


def judge(now: dict, history: list[dict]) -> list[dict]:
    """Each sign of the running sprint against the history: in how many missed and in how many kept sprints it was
    at least as bad as now. `history`: [{"kept": bool, "values": {sign: value}}]. A sign is a likely reason when
    the history is long enough and it was seen in a larger share of the missed sprints than of the kept ones."""
    enough = len(history) >= MIN_HISTORY
    out = []
    for name, label, unit, more_is_worse, risk in SIGNS:
        value = now.get(name)
        as_bad = lambda v: v >= value if more_is_worse else v <= value
        missed = [h["values"][name] for h in history if not h["kept"] and h["values"].get(name) is not None]
        kept = [h["values"][name] for h in history if h["kept"] and h["values"].get(name) is not None]
        row = {"id": name, "label": label, "unit": unit, "worse": "more" if more_is_worse else "less", "risk": risk, "now": value,
               "missed_n": len(missed), "kept_n": len(kept), "missed_as_bad": 0, "kept_as_bad": 0, "reason": False}
        if value is not None:
            row.update(missed_as_bad=sum(map(as_bad, missed)), kept_as_bad=sum(map(as_bad, kept)))
            row["reason"] = enough and row["missed_as_bad"] * len(kept) > row["kept_as_bad"] * len(missed)      # shares, not counts
        out.append(row)
    return out


def build(run, board: int, sprint: int, on_board=None) -> dict:
    """The pre-mortem of the sprint the page shows: the point of the sprint, the history with its signs at the
    same point, and the signs of now with their counts."""
    s = run.boards[board].sprints[sprint]
    start, end = s.activated or s.start, s.complete or s.end
    running = s.state == "active"
    share = min(1.0, max(0.0, (run.fetched - start) / (end - start))) if running and end and end > start else 1.0
    now, keys = measure(run, board, sprint, on_board)
    history = []
    for past in sampled_sprints(run, board):
        if past.state != "closed" or past.id == sprint:
            continue
        final = sprint_scope(run, board, past.id, on_board)
        result = said_done(final)
        if result is None:              # nothing was committed: no promise to keep or miss
            continue
        values, _ = measure(run, board, past.id, on_board, final.start + (final.end - final.start) * share)
        history.append({"sprint": past.id, "name": past.name, "said_done": result, "kept": result >= KEPT, "values": values})
    missed = sum(1 for h in history if not h["kept"])
    why_not = (f"The history holds {len(history)} closed sprint{'' if len(history) == 1 else 's'}: {MIN_HISTORY} are needed before anything is called a reason"
               if len(history) < MIN_HISTORY else "Every sprint of the history missed its promise: there is nothing to tell a miss from" if missed == len(history)
               else "Every sprint of the history kept its promise: there is no miss to learn from" if not missed else "")
    signs = judge(now, history)
    gap = lambda r: r["missed_as_bad"] / r["missed_n"] - r["kept_as_bad"] / r["kept_n"]
    likely = sorted((r for r in signs if r["reason"]), key=lambda r: -gap(r)) if running else []
    return {"sprint": sprint, "running": running, "share": round(100 * share), "kept_from": KEPT, "min_history": MIN_HISTORY,
            "history": history, "missed": missed, "why_not": why_not, "signs": signs, "keys": keys, "reasons": [r["id"] for r in likely]}


def reasons(view: dict) -> list[dict]:
    """The likely reasons of a running sprint, the one that tells a miss from a kept promise best first."""
    by_id = {r["id"]: r for r in view["signs"]}
    return [by_id[name] for name in view["reasons"]]


def facts(view: dict) -> list[Fact]:
    """What the pre-mortem says about a running sprint, for the page and the agents. Nothing while the history is
    too short to say anything."""
    if not view["running"] or view["why_not"]:
        return []
    found = reasons(view)
    out = [Fact("premortem.missed_n", "risks", "closed sprints in the data that missed their promise", view["missed"], f"of {len(view['history'])}"),
           Fact("premortem.reasons_n", "risks", "signs that came before a missed sprint more often than before a kept one, and show today",
                len(found), f"of {len(view['signs'])}", (), "warning" if found else "ok")]
    for r in found:
        out.append(Fact(f"premortem.{r['id']}", "risks", r["label"], r["now"],
                        f"{r['unit']}; as much or {r['worse']} in {r['missed_as_bad']} of {r['missed_n']} missed sprints and {r['kept_as_bad']} of {r['kept_n']} kept ones",
                        tuple(view["keys"].get(r["id"], ())), "warning"))
    return out
