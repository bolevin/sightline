"""The risk register.

Jira shows signals: an item blocked or stuck in one status, an item carried from sprint to sprint, a sprint that
does not fit, scope that came in after the start, a likely reason of the pre-mortem. Whether a signal is a risk, who owns it and what is done about
it is a human's call. So code offers each signal as a candidate; the Scrum Master puts it into the register or
says it is no risk; a risk then carries a ROAM state (new, owned, accepted, mitigated, resolved), an owner, a
response and a review date. Code keeps watching the signal behind a risk and says when it is gone or when the
review date has passed.

The register is the user's own notes, kept on this computer in var/risks.json and never committed. What the user
types (titles, owners, responses) stays there: the facts for the agent hold only counts and issue keys.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path

from . import premortem
from .today import Fact, status_names, status_since

FILE = Path("var") / "risks.json"
ROAM = ("new", "owned", "accepted", "mitigated", "resolved")
STUCK_DAYS = 10             # from this many days in one status on, an item in progress counts as stuck
LIMITS = {"title": 160, "owner": 60, "response": 600}


class RiskError(Exception):
    """The request cannot be done as asked. The text is for the user."""


def _days(n: int) -> str:
    return f"{n} day" if n == 1 else f"{n} days"


def signals(data) -> list[dict]:
    """What in the Jira data looks like a risk now: {"signal", "title", "keys", "level"}. One per item, however
    many reasons it has, one each for a sprint that does not fit and for scope that came in after the start, and
    one for every likely reason of the pre-mortem."""
    run, board, sprint = data.run, data.board, data.sprint
    now = run.fetched
    b = run.boards[board]
    name = b.sprints[sprint].name
    fact = {f.id: f for f in data.facts}
    keys = lambda fact_id: fact[fact_id].keys if fact_id in fact else ()
    names = status_names(run)
    waiting = b.waiting
    own = {x.id for x in b.sprints.values() if x.board == board}
    blocked, carried = set(keys("backlog.blocked_n")), set(keys("backlog.carried_n"))
    out = []
    for key in keys("sprint.open_n"):
        issue = run.issues[key]
        days = (now - status_since(issue, now)).days
        why = []
        if key in blocked:
            why.append(f"blocked for {_days(days)}")
        elif issue.status not in waiting and days >= STUCK_DAYS:
            why.append(f"in {names.get(issue.status, issue.status)} for {_days(days)}")
        if key in carried:
            why.append(f"in its sprint no. {len(issue.sprints_at(now) & own)} on this board")
        if why:
            out.append({"signal": f"item:{key}", "title": f"{key}: {', '.join(why)}", "keys": [key],
                        "level": "critical" if key in blocked else "warning"})
    chance = fact.get("forecast.chance_all_pct")
    if "plan.over_50_sp" in fact and chance.value < 50:
        out.append({"signal": f"fit:{sprint}", "keys": [], "level": "critical" if chance.value < 15 else "warning",
                    "title": f"{name}: {chance.value} % to finish everything, {fact['plan.over_50_sp'].value:g} SP over an even chance"})
    added = keys("sprint.added_n")
    if added:
        out.append({"signal": f"scope:{sprint}", "keys": list(added), "level": "warning",
                    "title": f"{name}: {len(added)} {'item' if len(added) == 1 else 'items'} came in after the start"})
    for r in premortem.reasons(data.premortem) if data.premortem else ():
        out.append({"signal": f"premortem:{sprint}:{r['id']}", "keys": data.premortem["keys"].get(r["id"], []), "level": "warning",
                    "title": f"{name}: {r['risk']} ({r['now']} {r['unit']}), as before {r['missed_as_bad']} of {r['missed_n']} missed sprints"})
    return sorted(out, key=lambda s: (s["level"] != "critical", s["signal"]))


def _read(root: Path) -> dict:
    path = root / FILE
    if not path.exists():
        return {"next": 1, "risks": [], "dismissed": []}
    try:
        store = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise RiskError(f"{FILE} cannot be read ({e}). Rename it to start an empty register.") from None
    rows = lambda name, needed: (isinstance(store.get(name), list)
                                 and all(isinstance(r, dict) and all(k in r for k in needed) for r in store[name]))
    if not (isinstance(store, dict) and isinstance(store.get("next"), int) and rows("risks", ("id", "board", "signal", "roam", "keys", "review"))
            and rows("dismissed", ("board", "signal"))):
        raise RiskError(f"{FILE} is not a risk register any more. Rename it to start an empty register.")
    return store


def _write(root: Path, store: dict) -> None:
    path = root / FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    draft = path.with_suffix(".tmp")
    draft.write_text(json.dumps(store, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(draft, path)             # the register is never left half written


def _text(action: dict, name: str, needed: bool = False) -> str:
    value = action.get(name, "")
    if not isinstance(value, str) or any(ord(c) < 32 and c not in "\n\t" for c in value):
        raise RiskError(f"{name} must be plain text")
    value = value.strip()
    if needed and not value:
        raise RiskError(f"A risk needs a {name}")
    if len(value) > LIMITS[name]:
        raise RiskError(f"{name} is longer than {LIMITS[name]} characters")
    return value


def apply(root: Path, data, action: dict) -> None:
    """One change of the register, asked for by the user on the page:
    {"do": "add", "signal": ...} or {"do": "add", "title": ...}; {"do": "update", "id": ..., fields};
    {"do": "dismiss", "signal": ...}; {"do": "restore", "signal": ...}. Raises RiskError."""
    store = _read(root)
    today = data.run.fetched.date().isoformat()
    do = action.get("do")
    if do == "add":
        offered = {s["signal"]: s for s in signals(data)}
        signal = action.get("signal")
        if signal is not None and (not isinstance(signal, str) or signal not in offered):
            raise RiskError("This signal is no longer in the data: refresh the page")
        if signal is not None and any(r["signal"] == signal and r["board"] == data.board and r["roam"] != "resolved" for r in store["risks"]):
            raise RiskError("This signal is in the register already")
        source = offered.get(signal) or {"title": _text(action, "title", needed=True), "keys": []}
        store["risks"].append({"id": f"R-{store['next']}", "board": data.board, "signal": signal, "title": source["title"], "keys": source["keys"],
                               "roam": "new", "owner": "", "response": "", "review": "", "created": today, "updated": today, "closed": None})
        store["next"] += 1
    elif do == "update":
        risk = next((r for r in store["risks"] if r["id"] == action.get("id") and r["board"] == data.board), None)
        if risk is None:
            raise RiskError(f"No risk {action.get('id')!r} in the register of this board")
        if "roam" in action:
            if action["roam"] not in ROAM:
                raise RiskError(f"ROAM must be one of {', '.join(ROAM)}")
            risk["roam"] = action["roam"]
            risk["closed"] = today if risk["roam"] == "resolved" else None
        if "review" in action:
            review = action["review"]
            try:
                risk["review"] = dt.date.fromisoformat(review).isoformat() if review else ""
            except (TypeError, ValueError):
                raise RiskError("The review date must be a date, as 2026-11-30") from None
        for name in ("title", "owner", "response"):
            if name in action:
                risk[name] = _text(action, name, needed=name == "title")
        risk["updated"] = today
    elif do in ("dismiss", "restore"):
        signal = action.get("signal")
        if not isinstance(signal, str) or not signal:
            raise RiskError("Say which signal")
        offered = {s["signal"]: s for s in signals(data)}
        if do == "dismiss" and signal not in offered:
            raise RiskError("This signal is no longer in the data: refresh the page")
        store["dismissed"] = [d for d in store["dismissed"] if (d["board"], d["signal"]) != (data.board, signal)]
        if do == "dismiss":
            store["dismissed"].append({"board": data.board, "signal": signal, "at": today, "level": offered[signal]["level"]})
    else:
        raise RiskError(f"Unknown change: {do!r}")
    _write(root, store)


def register(root: Path, data) -> dict:
    """The register of the board as the page shows it: risks with what code sees about them now, the candidates
    (signals that are neither in the register nor dismissed) and what was dismissed."""
    store = _read(root)
    now = {s["signal"]: s for s in signals(data)}
    today = data.run.fetched.date().isoformat()
    risks = []
    for r in store["risks"]:
        if r["board"] != data.board:
            continue
        open_ = r["roam"] != "resolved"
        seen = now.get(r["signal"]) if r["signal"] else None
        risks.append(dict(r, now=seen["title"] if seen else None, gone=bool(open_ and r["signal"] and seen is None),
                          review_due=bool(open_ and r["review"] and r["review"] <= today)))
    covered = {r["signal"] for r in risks if r["roam"] != "resolved"}
    # set aside as "not a risk"; a signal that was a warning then and is critical now is offered again
    worse = lambda d: d.get("level") == "warning" and d["signal"] in now and now[d["signal"]]["level"] == "critical"
    dismissed = [d for d in store["dismissed"] if d["board"] == data.board and not worse(d)]
    hidden = {d["signal"] for d in dismissed}
    return {"risks": sorted(risks, key=lambda r: (r["roam"] == "resolved", -int(r["id"].split("-")[1]))),
            "candidates": [s for s in now.values() if s["signal"] not in covered | hidden],
            "dismissed": [dict(d, title=now[d["signal"]]["title"] if d["signal"] in now else None) for d in dismissed],
            "roam": list(ROAM)}


def facts(reg: dict) -> list[Fact]:
    """What the register says, for the page and the agent: counts and issue keys only, never what the user typed."""
    open_ = [r for r in reg["risks"] if r["roam"] != "resolved"]
    keys = lambda rows: tuple(sorted({k for r in rows for k in r["keys"]}))
    cand = reg["candidates"]
    out = [Fact("risks.candidates_n", "risks", "signals in Jira that are not in the risk register yet", len(cand), "", keys(cand),
                "warning" if cand else "ok")]
    groups = (("risks.open_n", "open risks in the register", open_, "info"),
              ("risks.undecided_n", "risks in the register nobody has decided on yet", [r for r in open_ if r["roam"] == "new"], "warning"),
              ("risks.review_due_n", "risks whose review date has come", [r for r in open_ if r["review_due"]], "warning"),
              ("risks.signal_gone_n", "open risks whose signal in Jira is gone", [r for r in open_ if r["gone"]], "info"))
    return out + [Fact(fact_id, "risks", label, len(rows), "", keys(rows), level) for fact_id, label, rows, level in groups if rows]
