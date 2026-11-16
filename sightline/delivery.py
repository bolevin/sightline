"""Delivery: what the build server says about how the team ships, the last twelve weeks against the twelve before.

The build server builds main on every merge and runs the deploy job for production. From its records code computes
the four measures of the DORA research and what stands behind them:

- deploys: how many reached production, and of what kind: release, hotfix, rollback;
- lead time for changes: days from the merge into main to production, the middle change and the slow tail; and
  where that time goes: the build of main, the wait for a release cut or a hotfix, release testing;
- failed deploys: the share that had to be repaired, by a rollback or by a hotfix of one of its services within
  48 hours; a rollback is a repair, not a deploy that can fail;
- time to restore: hours from a failed deploy to its repair;
- main: the hours without weekends in which a build of main was red, the longest stretch, the stages that failed,
  and the failures that passed when the same build was run again;
- batches: releases against hotfixes, their size and how often each needed a repair.

Every share names what it is a share of; times are medians, never averages. Team level only: no commit has an
author here, and nothing is counted per person.
"""
from __future__ import annotations

import datetime as dt
import json
from collections import Counter
from pathlib import Path

from .forecast import percentile
from .today import Fact

FILE = "builds.json"
CARD = "delivery"
WEEKS = 12                  # the window of the measures, and the window before it
REPAIR_HOURS = 48           # a hotfix within so many hours repairs the deploy before it
INCIDENT_HOURS = 24         # an incident report within so many hours is shown next to the deploy before it
KINDS = {"release": "releases", "hotfix": "hotfixes", "rollback": "rollbacks"}


def _when(text: str | None) -> dt.datetime | None:
    return dt.datetime.fromisoformat(text) if text else None


def _pct(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def _hours(a: dt.datetime, b: dt.datetime) -> float:
    return (b - a).total_seconds() / 3600


def _mid(values: list[float], q: float = .5) -> float | None:
    return round(percentile(values, q), 1) if values else None


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def weekday_hours(a: dt.datetime, b: dt.datetime) -> float:
    """Hours from a to b with Saturdays and Sundays left out, by the clock of a."""
    total, t = 0.0, a
    while t < b:
        nxt = min(b, dt.datetime.combine(t.date() + dt.timedelta(days=1), dt.time(), tzinfo=t.tzinfo))
        if t.weekday() < 5:
            total += _hours(t, nxt)
        t = nxt
    return total


def load(folder: Path) -> dict | None:
    """The records of the build server in the data folder, with times as times; None when the folder has none."""
    path = folder / FILE
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"now": _when(raw["now"]), "from": _when(raw["from"]), "repos": raw["repos"], "services": raw["services"],
            "changes": [dict(c, merged=_when(c["merged"])) for c in raw["changes"]],
            "builds": sorted((dict(b, started=_when(b["started"]), finished=_when(b["finished"])) for b in raw["builds"]), key=lambda b: b["started"]),
            "cuts": [dict(c, at=_when(c["at"])) for c in raw["cuts"]],
            "deploys": sorted((dict(d, at=_when(d["at"])) for d in raw["deploys"]), key=lambda d: d["at"])}


def red_stretches(builds: list[dict], now: dt.datetime) -> list[tuple[dt.datetime, dt.datetime, bool]]:
    """When main was red: from the end of a failed build to the end of the next build that passed; (from, to, still red)."""
    out, since = [], None
    for b in sorted(builds, key=lambda b: b["finished"]):
        if b["result"] == "FAILURE" and since is None:
            since = b["finished"]
        elif b["result"] == "SUCCESS" and since is not None:
            out.append((since, b["finished"], False))
            since = None
    if since is not None:
        out.append((since, now, True))
    return out


def repairs(deploys: list[dict]) -> dict[int, dict]:
    """Deploy number -> the rollback or hotfix that repaired it: the next deploy of one of its services, when that was a
    rollback, or a hotfix within REPAIR_HOURS. The first such repair counts."""
    out = {}
    for i, d in enumerate(deploys):
        if d["kind"] == "rollback":
            continue
        found = []
        for service in d["services"]:
            nxt = next((n for n in deploys[i + 1:] if service in n["services"]), None)
            if nxt and (nxt["kind"] == "rollback" or nxt["kind"] == "hotfix" and _hours(d["at"], nxt["at"]) <= REPAIR_HOURS):
                found.append(nxt)
        if found:
            out[d["number"]] = min(found, key=lambda n: n["at"])
    return out


def build(folder: Path, incidents: dict | None = None) -> dict | None:
    """Everything the delivery panels of the Code tab draw, or None when the data holds no deploy."""
    data = load(folder)
    if not data or not data["deploys"]:
        return None
    now, changes, builds, deploys = data["now"], data["changes"], data["builds"], data["deploys"]
    iso = lambda t: t.isoformat(timespec="minutes") if t else None
    start = now - dt.timedelta(weeks=WEEKS)
    windows = (("last", start, now), ("before", start - dt.timedelta(weeks=WEEKS), start))
    cut_of = {c["version"]: c["at"] for c in data["cuts"]}
    fixed = repairs(deploys)

    # every change: when a build of main passed with it, and when it reached production
    arrived = {}
    for d in deploys:
        for cid in d["changes"]:
            arrived.setdefault(cid, d)
    green = {}
    for c in changes:
        passed = [b["finished"] for b in builds if b["repo"] == c["repo"] and b["result"] == "SUCCESS" and b["started"] >= c["merged"]]
        green[c["id"]] = min(passed) if passed else None
    lead = []
    for c in changes:
        d = arrived.get(c["id"])
        if not d:
            continue
        out, ok = d["at"], green[c["id"]] or d["at"]
        ok = min(ok, out)
        cut = cut_of.get(d["version"]) if d["kind"] == "release" else None
        ready = max(cut, ok) if cut else out
        lead.append({"id": c["id"], "at": out, "days": _hours(c["merged"], out) / 24, "build": _hours(c["merged"], ok), "wait": max(0.0, _hours(ok, cut or out)),
                     "testing": _hours(ready, out) if cut else 0.0})

    # main: when it was red, by repository
    red = {repo: red_stretches([b for b in builds if b["repo"] == repo], now) for repo in data["repos"]}

    def in_window(a: dt.datetime, b: dt.datetime) -> dict:
        shown = [d for d in deploys if a <= d["at"] < b]
        can_fail = [d for d in shown if d["kind"] != "rollback"]
        failed = [d for d in can_fail if d["number"] in fixed]
        restore = [_hours(d["at"], fixed[d["number"]]["at"]) for d in failed]
        times = [x for x in lead if a <= x["at"] < b]
        spent = sum(x["build"] + x["wait"] + x["testing"] for x in times)
        ran = [x for x in builds if a <= x["finished"] < b]
        broke = [x for x in ran if x["result"] == "FAILURE"]
        after = lambda x: next((y for y in builds if y["repo"] == x["repo"] and y["started"] > x["finished"]), None)       # the next build of the same main
        hours = {repo: sum(weekday_hours(max(p, a), min(q, b)) for p, q, _ in red[repo] if q > a and p < b) for repo in red}
        longest = max((weekday_hours(max(p, a), min(q, b)) for repo in red for p, q, _ in red[repo] if q > a and p < b), default=0.0)
        whole = weekday_hours(a, b)
        return {"deploys": len(shown), "per_week": round(len(shown) / WEEKS, 1), **{many: sum(1 for d in shown if d["kind"] == kind) for kind, many in KINDS.items()},
                "can_fail": len(can_fail), "failed": len(failed), "failed_pct": _pct(len(failed), len(can_fail)),
                "restore_p50": _mid(restore), "restore_max": round(max(restore), 1) if restore else None,
                "changes": len(times), "lead_p50": _mid([x["days"] for x in times]), "lead_p85": _mid([x["days"] for x in times], .85),
                "share": {part: _pct(round(sum(x[part] for x in times)), round(spent)) for part in ("build", "wait", "testing")},
                "build_h_p50": _mid([x["build"] for x in times]), "wait_d_p50": _mid([x["wait"] / 24 for x in times]),
                "testing_d_p50": _mid([x["testing"] / 24 for x in times if x["testing"]]),
                "builds": len(ran), "broke": len(broke), "rerun_passed": sum(1 for x in broke if (y := after(x)) and y["trigger"] == "re-run" and y["result"] == "SUCCESS"),
                "stages": dict(Counter(x["stage"] for x in broke).most_common()),
                "red_h": round(sum(hours.values()), 1), "red_by_repo": {repo: round(h, 1) for repo, h in hours.items()},
                "red_pct": round(100 * sum(hours.values()) / (whole * len(red)), 1) if whole else None, "red_longest_h": round(longest, 1)}

    measures = {name: in_window(a, b) for name, a, b in windows}

    # every deploy, the newest first, with its repair and the incident reports on its services that followed it
    reports = [dict(r, at=_when(r["at"])) for r in ((incidents or {}).get("reports") or [])]
    log = []
    for d in reversed(deploys):
        repair = fixed.get(d["number"])
        near = [r for r in reports if r["service"] in d["services"] and d["at"] <= r["at"] < d["at"] + dt.timedelta(hours=INCIDENT_HOURS)]
        log.append({"number": d["number"], "version": d["version"], "kind": d["kind"], "at": iso(d["at"]), "services": d["services"], "changes": len(d["changes"]),
                    "window": "last" if d["at"] >= start else "before" if d["at"] >= windows[1][1] else "older",
                    "failed": d["number"] in fixed, "repair": repair and {"version": repair["version"], "kind": repair["kind"], "at": iso(repair["at"]),
                                                                          "hours": round(_hours(d["at"], repair["at"]), 1)},
                    "incidents": [{"at": iso(r["at"]), "title": r["title"], "service": r["service"]} for r in near]})

    # releases against hotfixes, over all the data
    batches = []
    for kind in ("release", "hotfix"):
        mine = [d for d in deploys if d["kind"] == kind]
        batches.append({"kind": kind, "n": len(mine), "changes_p50": round(percentile([len(d["changes"]) for d in mine], .5)) if mine else None, "changes_max": max((len(d["changes"]) for d in mine), default=0),
                        "failed": sum(1 for d in mine if d["number"] in fixed), "failed_pct": _pct(sum(1 for d in mine if d["number"] in fixed), len(mine))})

    # what is merged and not in production yet
    waiting = [c for c in changes if c["id"] not in arrived]
    open_cut = next(({"version": c["version"], "at": iso(c["at"]), "changes": len(c["changes"])} for c in data["cuts"]
                     if not any(d["version"] == c["version"] for d in deploys)), None)

    # week by week, Monday to Sunday, for the charts
    first = (data["from"] + dt.timedelta(days=7 - data["from"].weekday())).date()
    weeks = []
    day = first
    while day <= now.date():
        a = dt.datetime.combine(day, dt.time(), tzinfo=now.tzinfo)
        b = min(now, a + dt.timedelta(days=7))
        weeks.append({"week": f"{day.isocalendar()[0]}-W{day.isocalendar()[1]:02d}", "from": day.isoformat(), "running": b == now,
                      "red_h": {repo: round(sum(weekday_hours(max(p, a), min(q, b)) for p, q, _ in red[repo] if q > a and p < b), 1) for repo in red},
                      "passed": sum(1 for x in builds if a <= x["finished"] < b and x["result"] == "SUCCESS"),
                      "failed": sum(1 for x in builds if a <= x["finished"] < b and x["result"] == "FAILURE")})
        day += dt.timedelta(days=7)

    red_now = [repo for repo in red if red[repo] and red[repo][-1][2]]
    return {"now": iso(now), "from": iso(data["from"]), "weeks_window": WEEKS, "start": iso(start), "before_start": iso(windows[1][1]), "repos": data["repos"],
            "repair_hours": REPAIR_HOURS, "incident_hours": INCIDENT_HOURS, **measures, "deploys": log, "batches": batches,
            "waiting": {"n": len(waiting), "oldest_days": round(_hours(min(c["merged"] for c in waiting), now) / 24) if waiting else None, "cut": open_cut},
            "weeks": weeks, "red_now": red_now}


def facts(view: dict | None) -> list[Fact]:
    """What the delivery panels say, as facts: an agent may word them; the Code tab and the Ask window use them."""
    if not view:
        return []
    now, was, weeks = view["last"], view["before"], view["weeks_window"]
    out: list[Fact] = []
    add = lambda fid, label, value, unit="", level="info": value is not None and out.append(Fact(f"delivery.{fid}", CARD, label, value, unit, (), level))
    worse = lambda a, b, margin=0: "warning" if a is not None and b is not None and a > b + margin else "info"
    last = f"in the last {weeks} weeks"
    kinds = lambda m: ", ".join(_plural(m[many], kind, many) for kind, many in KINDS.items())
    add("deploys_n", f"production deploys {last}", now["deploys"], kinds(now))
    add("deploys_before_n", f"production deploys in the {weeks} weeks before", was["deploys"], kinds(was))
    add("per_week", f"production deploys per week {last}", now["per_week"])
    add("lead_p50_days", f"days from the merge into main to production, half of the changes that reached production {last}", now["lead_p50"], "days",
        worse(now["lead_p50"], was["lead_p50"], 1))
    add("lead_p85_days", f"days from the merge into main to production, 85 % of those changes", now["lead_p85"], "days")
    add("lead_before_p50_days", f"days from the merge into main to production, half of the changes of the {weeks} weeks before", was["lead_p50"], "days")
    add("wait_pct", f"share of the lead time {last} that changes spent waiting for a release cut or a hotfix", now["share"]["wait"], "%")
    add("testing_pct", f"share of the lead time {last} that changes spent in release testing", now["share"]["testing"], "%")
    add("build_hours", f"hours from the merge to a build of main that passed, half of the changes that reached production {last}", now["build_h_p50"], "hours")
    add("failed_pct", f"share of the production deploys {last} that a rollback or a hotfix within {view['repair_hours']} hours had to repair", now["failed_pct"], "%",
        worse(now["failed_pct"], was["failed_pct"], 4))
    add("failed_n", f"production deploys {last} that a rollback or a hotfix had to repair", now["failed"], f"of {now['can_fail']}, rollbacks not counted")
    add("failed_before_pct", f"share of the production deploys of the {weeks} weeks before that had to be repaired", was["failed_pct"], "%")
    add("restore_p50_hours", f"hours from a failed deploy to its repair, the middle one {last}", now["restore_p50"], f"over {_plural(now['failed'], 'failed deploy', 'failed deploys')}",
        worse(now["restore_p50"], was["restore_p50"]))
    add("restore_before_p50_hours", f"hours from a failed deploy to its repair, the middle one of the {weeks} weeks before", was["restore_p50"], f"over {_plural(was['failed'], 'failed deploy', 'failed deploys')}")
    add("red_pct", f"share of the hours without weekends in which main was red {last}, both repositories", now["red_pct"], "%", worse(now["red_pct"], was["red_pct"], 1))
    add("red_before_pct", f"share of the hours without weekends in which main was red in the {weeks} weeks before", was["red_pct"], "%")
    add("red_longest_hours", f"the longest time main was red in one stretch {last}, weekends left out", now["red_longest_h"], "hours")
    add("rerun_passed_n", f"failed builds of main {last} that passed when the same build was run again", now["rerun_passed"], f"of {now['broke']} failed builds",
        "warning" if now["broke"] and now["rerun_passed"] * 2 >= now["broke"] else "info")
    w = view["waiting"]
    add("waiting_n", "changes merged into main that are not in production yet", w["n"], f"the oldest merged {w['oldest_days']} days ago" if w["oldest_days"] is not None else "")
    if w["cut"]:
        add("testing_n", f"changes in release {w['cut']['version']}, cut and not deployed yet", w["cut"]["changes"])
    for b in view["batches"]:
        add(f"{b['kind']}_failed_n", f"{KINDS[b['kind']]} since {view['from'][:10]} that a rollback or a hotfix had to repair", b["failed"], f"of {b['n']}",
            "warning" if b["kind"] == "release" and b["failed"] * 2 >= b["n"] > 0 else "info")
        add(f"{b['kind']}_changes_p50", f"changes in the middle {b['kind']} since {view['from'][:10]}", b["changes_p50"])
    add("incident_after_n", f"production deploys {last} followed within {view['incident_hours']} hours by an incident report on one of their services",
        sum(1 for d in view["deploys"] if d["window"] == "last" and d["incidents"]))
    if view["red_now"]:
        add("red_now_n", "repositories whose main is red right now", len(view["red_now"]), ", ".join(view["red_now"]), "warning")
    return out
