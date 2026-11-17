"""Quality: what the team's bugs say, sprint by sprint and increment by increment.

The tab looks at every bug of the team over the last programme increments: when it was written and closed, how
severe it was, where it was found, which service and feature it belongs to, what the cause was, whether it came
back. From these code computes the measures a team lead asks for, each with its denominator:

- flow: bugs created and resolved per sprint, and the gap between the two, which is the open backlog;
- escape: the share of bugs that were found in production, and its mirror, the share caught before;
- time to fix: the middle bug and the slow tail (never an average), judged against a target per severity, with
  the bugs that are still open counted against the target once they are older than it;
- survival: the share of bugs still open after N days (Kaplan-Meier), which a plain "time to fix" hides, because
  that only counts the bugs that were fixed;
- reopen rate, bug debt by age, where bugs concentrate (service, cause, feature), what each release brought;
- what moves with bugs: sprint measures set against the bugs of the sprint after, with the strength of the link
  and the range it could really have. Twenty sprints are a hint, not a proof, and the page says so.

Team level only: nothing here counts bugs per person, and no target is set on a bug count.
"""
from __future__ import annotations

import datetime as dt
import json
import math
from collections import Counter
from pathlib import Path

from .forecast import percentile
from .today import Fact

FILE = "quality.json"
PHASES = ("Development", "Test", "Staging", "Production")
PRIORITIES = ("Highest", "High", "Medium", "Low")
BUCKETS = ((0, 7, "up to 7 days"), (8, 30, "8 to 30 days"), (31, 90, "31 to 90 days"), (91, 10 ** 6, "over 90 days"))
SURVIVAL_DAYS = 45          # how far the survival curves go
AFTER_RELEASE = 14          # days after a release in which a production bug counts as brought by it
OLD = 30                    # days from which an open bug is old
MIN_SAMPLE = 5              # below so many bugs no median and no share is given for a severity: the count is shown instead
USUAL, MIN_USUAL = 6, 3     # the usual range of new bugs: the full sprints before the last one, and how many it needs at least
CARD = "quality"
STRENGTH = ((.7, "strong"), (.5, "moderate"), (.3, "weak"), (0, "no clear link"))


def _when(text: str | None) -> dt.datetime | None:
    return dt.datetime.fromisoformat(text) if text else None


def _pct(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def _days(a: dt.datetime, b: dt.datetime) -> float:
    return (b - a).total_seconds() / 86400


def load(folder: Path) -> dict | None:
    """The bugs, sprints and releases of the data folder, with times as times; None when the folder has none."""
    path = folder / FILE
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    now = _when(raw["now"])
    sprints = [dict(s, start=_when(s["start"]), end=_when(s["end"])) for s in raw["sprints"]]
    bugs = [dict(b, created=_when(b["created"]), resolved=_when(b["resolved"])) for b in raw["bugs"]]
    for bug in bugs:
        bug["sprint"] = max((s["sprint"] for s in sprints if s["start"] <= bug["created"]), default=sprints[0]["sprint"])      # by its date, not by what the file says
    return {"now": now, "targets": raw["targets_days"], "pis": raw["pis"], "sprints": sprints, "bugs": bugs,
            "releases": [dict(r, at=_when(r["at"])) for r in raw["releases"]]}


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx, syy = sum((x - mx) ** 2 for x in xs), sum((y - my) ** 2 for y in ys)
    if not sxx or not syy:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / math.sqrt(sxx * syy)


def link(xs: list[float], ys: list[float]) -> dict | None:
    """How two series move together: r, the range r could have with so few points (95 %, Fisher), the word for its
    strength, and the straight line through the points."""
    r = pearson(xs, ys)
    if r is None:
        return None
    n = len(xs)
    z, half = math.atanh(max(-.999, min(.999, r))), 1.96 / math.sqrt(n - 3) if n > 3 else float("inf")
    low, high = (math.tanh(z - half), math.tanh(z + half)) if n > 3 else (-1.0, 1.0)
    mx, my = sum(xs) / n, sum(ys) / n
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    strength = next(word for limit, word in STRENGTH if abs(r) >= limit)
    return {"n": n, "r": round(r, 2), "low": round(low, 2), "high": round(high, 2), "strength": strength if low * high > 0 or strength == "no clear link" else f"{strength}, not certain",
            "slope": round(slope, 3), "at_zero": round(my - slope * mx, 2)}


def survival(bugs: list[dict], now: dt.datetime) -> list[float]:
    """Kaplan-Meier: the share of bugs still open N days after they were written, for N = 0 .. SURVIVAL_DAYS. A bug
    that is still open, or was closed without a fix, counts for as long as it was seen and then leaves the count."""
    seen = sorted(((_days(b["created"], b["resolved"] or now), b["resolution"] == "Fixed") for b in bugs), key=lambda x: x[0])
    out, share, i, at_risk = [], 1.0, 0, len(seen)
    for day in range(SURVIVAL_DAYS + 1):
        while i < len(seen) and seen[i][0] <= day:
            if seen[i][1] and at_risk:
                share *= 1 - 1 / at_risk
            at_risk -= 1
            i += 1
        out.append(round(share, 3))
    return out


def build(folder: Path) -> dict | None:
    """Everything the Quality tab draws, or None when the data holds no bugs."""
    data = load(folder)
    if not data or not data["bugs"]:
        return None
    now, bugs, sprints, targets = data["now"], data["bugs"], data["sprints"], data["targets"]
    iso = lambda t: t.isoformat(timespec="minutes") if t else None
    fixed = lambda found: [b for b in found if b["resolution"] == "Fixed"]
    took = lambda found: [_days(b["created"], b["resolved"]) for b in fixed(found)]
    open_at = lambda t: [b for b in bugs if b["created"] < t and (b["resolved"] is None or b["resolved"] >= t)]      # sprints are [start, end): what happens at t belongs to the next one
    by_sprint = {s["sprint"]: s for s in sprints}
    order = [s["sprint"] for s in sprints]
    ends = {n: (sprints[i + 1]["start"] if i + 1 < len(sprints) else now) for i, n in enumerate(order)}      # a sprint's bugs: until the next one starts

    def late(bug: dict) -> bool | None:
        """Whether the bug missed the target of its severity: None while it is open and still within it."""
        target = targets[bug["priority"]]
        if bug["resolution"] == "Fixed":
            return _days(bug["created"], bug["resolved"]) > target
        if bug["resolved"] is None:
            return True if _days(bug["created"], now) > target else None
        return None                                                     # closed without a fix: no fix to be late with

    def kept(found: list[dict]) -> int | None:
        judged = [late(b) for b in found if late(b) is not None]
        return _pct(sum(1 for x in judged if not x), len(judged))

    # sprint by sprint
    rows, made, closed = [], 0, 0
    for s in sprints:
        n, start, end = s["sprint"], s["start"], ends[s["sprint"]]
        new = [b for b in bugs if b["sprint"] == n]
        gone = [b for b in bugs if b["resolved"] and start <= b["resolved"] < end]
        made, closed = made + len(new), closed + len(gone)
        rows.append({"sprint": n, "name": s["name"], "pi": s["pi"], "running": s["running"], "created": len(new), "resolved": len(gone),
                     "escaped": sum(1 for b in new if b["found_in"] == "Production"), "open": len(open_at(min(end, now))), "created_sum": made, "resolved_sum": closed,
                     "added_pct": s["added_pct"], "unreviewed_pct": s["unreviewed_pct"], "committed_sp": s["committed_sp"], "completed_sp": s["completed_sp"],
                     "release": s["release"]})
    full = [r for r in rows if not r["running"]]

    # increment by increment
    pis = []
    for p in data["pis"]:
        inside = [n for n in order if p["first"] <= n <= p["last"]]
        start, end = by_sprint[inside[0]]["start"], ends[inside[-1]]
        new = [b for b in bugs if b["sprint"] in inside]
        done, spent = fixed(new), took(new)
        resolved = [b for b in bugs if b["resolved"] and start <= b["resolved"] < end]
        not_a_bug = sum(1 for b in new if b["resolution"] in ("Duplicate", "Cannot reproduce"))
        delivered = sum(by_sprint[n]["completed_sp"] for n in inside)
        escaped = [b for b in new if b["found_in"] == "Production"]
        pis.append({
            "name": p["name"], "sprints": inside, "running": any(by_sprint[n]["running"] for n in inside), "start": iso(start), "end": iso(by_sprint[inside[-1]]["end"]),
            "created": len(new), "resolved": len(resolved), "net": len(new) - len(resolved), "open_end": len(open_at(min(end, now))), "still_open": sum(1 for b in new if b["resolved"] is None),
            "escaped": len(escaped), "escape_pct": _pct(len(escaped), len(new)), "caught_pct": _pct(len(new) - len(escaped), len(new)),
            "fixed": len(done), "reopened": sum(1 for b in done if b["reopened"]), "reopen_pct": _pct(sum(1 for b in done if b["reopened"]), len(done)),
            "fix_p50": round(percentile(spent, .5), 1) if spent else None, "fix_p85": round(percentile(spent, .85), 1) if spent else None,
            "fix_box": [round(percentile(spent, q), 1) for q in (.1, .25, .5, .75, .9)] if spent else None,
            "kept_pct": kept(new), "not_a_bug_pct": _pct(not_a_bug, len(new)), "per_100_sp": round(100 * len(new) / delivered, 1) if delivered else None,
            "phases": [sum(1 for b in new if b["found_in"] == phase) for phase in PHASES],
            "found_by": dict(Counter(b["found_by"] for b in new).most_common()),
            "severity": [sum(1 for b in new if b["priority"] == priority) for priority in PRIORITIES],
            "components": dict(Counter(b["component"] for b in new)), "components_escaped": dict(Counter(b["component"] for b in escaped)),
            "causes": dict(Counter(b["cause"] for b in done if b["cause"])),
        })
    this, last = pis[-1], pis[-2] if len(pis) > 1 else None
    current = [b for b in bugs if b["sprint"] in this["sprints"]]

    # severity: how long a fix takes and whether the target holds, over the last two increments
    recent = [b for b in bugs if b["sprint"] in this["sprints"] + (last["sprints"] if last else [])]
    severity = []
    for priority in PRIORITIES:
        mine = [b for b in recent if b["priority"] == priority]
        spent, verdicts = took(mine), [late(b) for b in mine if late(b) is not None]
        enough = len(spent) >= MIN_SAMPLE
        severity.append({"priority": priority, "n": len(mine), "fixed": len(spent), "p50": round(percentile(spent, .5), 1) if enough else None,
                         "p85": round(percentile(spent, .85), 1) if enough else None, "target": targets[priority],
                         "kept": sum(1 for v in verdicts if not v), "judged": len(verdicts), "kept_pct": kept(mine) if len(verdicts) >= MIN_SAMPLE else None,
                         "late_open": sorted((b["key"] for b in mine if b["resolved"] is None and late(b)), key=lambda k: next(b["created"] for b in mine if b["key"] == k))})
    curves = [{"name": name, "n": len(found), "open": survival(found, now)} for name, found in (
        ("Highest and High", [b for b in bugs if b["priority"] in ("Highest", "High")]), ("Medium", [b for b in bugs if b["priority"] == "Medium"]),
        ("Low", [b for b in bugs if b["priority"] == "Low"])) if found]

    # bug debt: what is open, by age
    still = sorted((b for b in bugs if b["resolved"] is None), key=lambda b: b["created"])
    age = lambda b: int(_days(b["created"], now))
    ages = [age(b) for b in still]
    aging = {"open": len(still), "age_p50": round(percentile(ages, .5)) if ages else None, "age_p85": round(percentile(ages, .85)) if ages else None,
             "buckets": [{"name": name, "by_priority": [sum(1 for b in still if low <= age(b) <= high and b["priority"] == priority) for priority in PRIORITIES],
                          "n": sum(1 for b in still if low <= age(b) <= high)} for low, high, name in BUCKETS],
             "old": [b["key"] for b in still if age(b) > OLD], "oldest": [{"key": b["key"], "days": age(b)} for b in still[:8]]}

    # where bugs concentrate
    components = sorted({b["component"] for b in bugs}, key=lambda c: (-sum(1 for b in current if b["component"] == c), c))      # the name settles a tie: the same data, the same order
    heat = [{"component": c, "per_pi": [p["components"].get(c, 0) for p in pis], "escaped": [p["components_escaped"].get(c, 0) for p in pis],
             "per_sprint": [sum(1 for b in bugs if b["component"] == c and b["sprint"] == n) for n in order]} for c in components]
    causes_now, causes_before = this["causes"], last["causes"] if last else {}
    total, running_sum, pareto = sum(causes_now.values()), 0, []
    for cause, n in sorted(causes_now.items(), key=lambda x: (-x[1], x[0])):
        running_sum += n
        pareto.append({"cause": cause, "n": n, "pct": _pct(n, total), "cum_pct": _pct(running_sum, total), "before_pct": _pct(causes_before.get(cause, 0), sum(causes_before.values()))})
    features = []
    for feature, n in Counter(b["feature"] for b in recent if b["feature"]).most_common(6):
        mine = [b for b in recent if b["feature"] == feature]
        features.append({"feature": feature, "bugs": n, "escaped": sum(1 for b in mine if b["found_in"] == "Production"), "reopened": sum(1 for b in mine if b["reopened"]),
                         "open": sum(1 for b in mine if b["resolved"] is None)})
    releases = []
    for r in data["releases"]:
        after = [b for b in bugs if b["found_in"] == "Production" and r["at"] <= b["created"] < r["at"] + dt.timedelta(days=AFTER_RELEASE)]
        releases.append({"version": r["version"], "at": iso(r["at"]), "sprint": r["sprint"], "bugs": len(after), "severe": sum(1 for b in after if b["priority"] in ("Highest", "High")),
                         "keys": [b["key"] for b in after], "complete": r["at"] + dt.timedelta(days=AFTER_RELEASE) <= now})

    # what moves with bugs: a measure of one sprint against the bugs of the sprint after
    def lagged(measure: str, outcome: str, label: str, what: str) -> dict | None:
        pairs = [(a[measure], b[outcome], a["name"]) for a, b in zip(rows, rows[1:]) if not b["running"]]
        found = link([float(x) for x, _, _ in pairs], [float(y) for _, y, _ in pairs])
        return found and {"id": measure, "x": label, "y": what, "points": [{"x": x, "y": y, "sprint": name} for x, y, name in pairs], **found}

    strain = {r["sprint"]: round(100 * r["committed_sp"] / (sum(q["completed_sp"] for q in rows[max(0, i - 3):i]) / len(rows[max(0, i - 3):i]))) for i, r in enumerate(rows) if i}
    for r in rows:
        r["load_pct"] = strain.get(r["sprint"])
    rows[0]["load_pct"] = 100
    links = [x for x in (
        lagged("added_pct", "escaped", "scope added after the start, % of the commitment", "bugs found in production in the sprint after"),
        lagged("unreviewed_pct", "escaped", "merged without a review, % of the pull requests", "bugs found in production in the sprint after"),
        lagged("load_pct", "escaped", "committed, % of what the three sprints before completed", "bugs found in production in the sprint after"),
        lagged("completed_sp", "created", "story points completed", "bugs created in the sprint after")) if x]

    usual = [r["created"] for r in full[-1 - USUAL:-1]]                 # the full sprints before the last one: the last is what is judged
    net = [r["created"] - r["resolved"] for r in full[-3:]]
    worst = max((r for r in releases if r["complete"]), key=lambda r: (r["bugs"], r["at"]), default=None)
    top_component = max(this["components_escaped"].items(), key=lambda x: (x[1], x[0]), default=None)
    return {
        "now": iso(now), "targets": targets, "phases": list(PHASES), "priorities": list(PRIORITIES), "sprints": rows, "pis": pis, "pi": this["name"],
        "severity": severity, "survival": {"days": SURVIVAL_DAYS, "curves": curves}, "aging": aging, "components": heat, "pareto": pareto, "features": features,
        "releases": releases, "links": links, "after_release": AFTER_RELEASE,
        "usual": {"low": min(usual), "high": max(usual), "sprints": len(usual), "last": full[-1]["created"], "last_name": full[-1]["name"]} if len(usual) >= MIN_USUAL else None,
        "net_per_sprint": round(sum(net) / len(net), 1) if net else None, "worst_release": worst and {"version": worst["version"], "bugs": worst["bugs"], "keys": worst["keys"]},
        "top_component": top_component and {"component": top_component[0], "n": top_component[1], "pct": _pct(top_component[1], this["escaped"]),
                                            "keys": sorted(b["key"] for b in current if b["found_in"] == "Production" and b["component"] == top_component[0])},
        "escaped_keys": sorted(b["key"] for b in current if b["found_in"] == "Production"),
        "reopened_keys": sorted(b["key"] for b in current if b["reopened"]),
    }


def facts(view: dict | None) -> list[Fact]:
    """What the Quality tab says, as facts: an agent may word them, and its lines are checked against them."""
    if not view:
        return []
    this, last, name = view["pis"][-1], view["pis"][-2] if len(view["pis"]) > 1 else None, view["pi"]
    before = last["name"] if last else ""
    out: list[Fact] = []
    add = lambda fid, label, value, unit="", keys=(), level="info": value is not None and out.append(Fact(f"quality.{fid}", CARD, label, value, unit, tuple(keys), level))
    worse = lambda now, then, margin=0: "warning" if now is not None and then is not None and now > then + margin else "info"
    add("created_n", f"bugs created in {name} so far", this["created"])
    add("open_n", "bugs open now", view["aging"]["open"], level=worse(view["aging"]["open"], last and last["open_end"]))
    add("escaped_n", f"bugs of {name} found in production", this["escaped"], f"of {this['created']}", view["escaped_keys"])
    add("escape_pct", f"share of the bugs of {name} that were found in production", this["escape_pct"], "%", view["escaped_keys"], worse(this["escape_pct"], last and last["escape_pct"], 4))
    add("reopen_pct", f"share of the fixed bugs of {name} that came back", this["reopen_pct"], "%", view["reopened_keys"], worse(this["reopen_pct"], last and last["reopen_pct"], 4))
    add("fix_p50_days", f"days in which half of the fixed bugs of {name} were fixed", this["fix_p50"], "days", (), worse(this["fix_p50"], last and last["fix_p50"], 1))
    add("kept_pct", f"share of the bugs of {name} that kept the target of their severity", this["kept_pct"], "%", (), "warning" if last and this["kept_pct"] is not None and this["kept_pct"] < (last["kept_pct"] or 0) - 4 else "info")
    add("per_100_sp", f"bugs created in {name} per 100 story points completed", this["per_100_sp"])
    if last:
        add("open_before_n", f"bugs open at the end of {before}", last["open_end"])
        add("escape_before_pct", f"share of the bugs of {before} that were found in production", last["escape_pct"], "%")
        add("reopen_before_pct", f"share of the fixed bugs of {before} that came back", last["reopen_pct"], "%")
        add("fix_before_p50_days", f"days in which half of the fixed bugs of {before} were fixed", last["fix_p50"], "days")
        add("kept_before_pct", f"share of the bugs of {before} that kept the target of their severity", last["kept_pct"], "%")
    add("old_n", f"open bugs older than {OLD} days", len(view["aging"]["old"]), "", view["aging"]["old"], "warning" if view["aging"]["old"] else "info")
    if view["top_component"]:
        top = view["top_component"]
        add("top_component_pct", f"share of the production bugs of {name} that sit in {top['component']}", top["pct"], "%", top["keys"], "warning" if top["pct"] >= 35 else "info")
    if view["pareto"]:
        first = view["pareto"][0]
        add("top_cause_pct", f"share of the fixed bugs of {name} whose cause was: {first['cause'].lower()}", first["pct"], "%", (), "warning" if first["pct"] >= 30 else "info")
    if view["net_per_sprint"] is not None:
        add("net_per_sprint", "bugs created minus bugs resolved per sprint, over the last three full sprints", view["net_per_sprint"], "", (), "warning" if view["net_per_sprint"] > 0 else "info")
    if view["usual"]:
        u = view["usual"]
        add("last_sprint_n", f"bugs created in {u['last_name']}", u["last"], f"against {u['low']} to {u['high']} in the {u['sprints']} full sprints before",
            level="warning" if u["last"] > u["high"] else "info")
    if view["worst_release"]:
        w = view["worst_release"]
        add("worst_release_n", f"production bugs in the {AFTER_RELEASE} days after release {w['version']}, the most of any release", w["bugs"], "", w["keys"])
    for found in view["links"]:
        add(f"link.{found['id']}", f"how closely “{found['x']}” and “{found['y']}” move together (r from -1 to 1): {found['strength']}", found["r"],
            f"over {found['n']} sprints, could be {found['low']} to {found['high']}")
    return out
