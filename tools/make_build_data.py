"""Writes demo_data/builds.json: what the build server of team "Kestrel" would answer for the last half year, invented.

    python tools/make_build_data.py         # after tools/make_quality_data.py; the same bytes every time

The build server builds main of the team's two repositories on every merge and runs the deploy job for production.
A read of it, reduced to what the Code tab reads, gives four lists:

- changes: every merge into main, with its repository and time: a short commit id and nothing else
- builds: every build of main, when it ran, how it ended, the stage that failed and what started it
- cuts: the release branches, each with the changes that production did not have yet
- deploys: every run of the production deploy job: releases, hotfixes and rollbacks, with services and changes

The shop ships on a release train: every second sprint a release branch is cut on the Monday, tested on staging and
deployed on the Thursday (the releases of quality.json). Between two releases a hotfix goes out when something cannot
wait. The incident reports of extras.json stand where the deploys around them would put them. Nothing here comes from
a real project.

The story the numbers tell is written into ODDS, HOTFIXES and ROLLBACKS: main is red more often lately, mostly from
tests that pass again when the build is run once more; a change waits weeks for its release; the big releases often
needed a hotfix within two days, the small hotfixes almost never did.
"""
from __future__ import annotations

import datetime as dt
import heapq
import json
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import make_quality_data as mq  # noqa: E402
from sightline.facts import load_run  # noqa: E402

DATA = ROOT / "demo_data"
SEED = 20261117
REPOS = ("SHOP/checkout-api", "SHOP/checkout-web")
REPO_OF = {name: REPOS[1] if name == "checkout-web" else REPOS[0] for name in mq.COMPONENTS}
FIRST_RELEASE = 30                              # the sprint of release 4.14: the data begins with the cut of 4.13 before it
PR_DAYS, PR_MERGED = 42, 35                     # what the pull request view of extras.json counts: 35 merged in its 42 days
MERGES_A_DAY = (22, 62, 16)                     # how often a working day brings none, one or two merges into main
SHARE = (65, 35)                                # of which repository
FIRST_BUILD = {REPOS[0]: 1408, REPOS[1]: 812}
MINUTES = {REPOS[0]: (15, 2), REPOS[1]: (7, 1)}  # how long a build of main runs: the middle one and the spread
BROKEN_BY = ("Compile", "Unit tests", "Integration tests")
# From which day on, how often a merge breaks main for real (a fix has to be merged) and how often a build fails by
# chance (the same build passes when it is run again): a test that fails now and then, or the build machine.
ODDS = ((dt.date(2026, 5, 1), .04, .05), (dt.date(2026, 8, 24), .08, .12), (dt.date(2026, 10, 5), .1, .18))
# The hotfixes: version, service, when it reached production, how many changes it carried.
HOTFIXES = (
    ("4.14.1", "payment-gateway", dt.date(2026, 6, 5), "10:05", 1),
    ("4.15.1", "pricing-engine", dt.date(2026, 7, 14), "15:30", 2),
    ("4.16.1", "cart-service", dt.date(2026, 7, 31), "09:40", 1),
    ("4.17.1", "checkout-web", dt.date(2026, 8, 28), "11:30", 1),
    ("4.17.2", "payment-gateway", dt.date(2026, 9, 9), "16:00", 2),
    ("4.18.1", "cart-service", dt.date(2026, 9, 29), "10:24", 1),          # the incident report of that morning: slow around a deployment
    ("4.18.2", "checkout-api", dt.date(2026, 10, 8), "09:30", 1),          # postal codes with a space refused: rolled back the same day
    ("4.18.3", "checkout-api", dt.date(2026, 10, 9), "15:10", 2),          # the same fix, corrected
    ("4.19.1", "payment-gateway", dt.date(2026, 10, 22), "16:52", 1),      # the certificate on one of two instances, an hour after the release
    ("4.19.2", "cart-service", dt.date(2026, 11, 4), "09:20", 1),          # large carts were not saved
)
ROLLBACKS = (("4.18.0", "checkout-api", dt.date(2026, 10, 8), "13:48"),)    # back to this version


def at(day: dt.date, hhmm: str) -> dt.datetime:
    hours, minutes = map(int, hhmm.split(":"))
    return dt.datetime.combine(day, dt.time(hours, minutes), tzinfo=mq.zone(day))


def iso(t: dt.datetime) -> str:
    return t.astimezone(mq.zone(t.date())).isoformat(timespec="seconds")


def odds(day: dt.date) -> tuple[float, float]:
    return [(real, chance) for since, real, chance in ODDS if since <= day][-1]


def working(t: dt.datetime, rnd: random.Random) -> dt.datetime:
    """The same moment, or the next morning of a working day when it falls outside the working hours."""
    if t.weekday() < 5 and 8 <= t.hour < 18:
        return t
    day = t.date() + dt.timedelta(days=0 if t.hour < 8 else 1)
    while day.weekday() >= 5:
        day += dt.timedelta(days=1)
    return mq.moment(day, rnd.uniform(8.4, 9.8) * 3600)


def releases() -> list[tuple[str, dt.datetime, dt.datetime | None]]:
    """(version, cut, deployed) of every release of the data: cut on the Monday, deployed on the Thursday of the
    second week of its sprint. The last one is cut and not deployed yet."""
    out = [(f"{version}.0", mq.moment(mq.monday(n) + dt.timedelta(days=7), 12 * 3600), mq.moment(mq.monday(n) + dt.timedelta(days=10), 14 * 3600))
           for n, version in sorted(mq.RELEASES.items()) if n >= FIRST_RELEASE]
    last = max(mq.RELEASES)
    major, minor = mq.RELEASES[last].split(".")
    out.append((f"{major}.{int(minor) + 1}.0", mq.moment(mq.monday(last + 2) + dt.timedelta(days=7), 12 * 3600), None))
    return out


def plan(rnd: random.Random, now: dt.datetime, start: dt.datetime) -> list[tuple[dt.datetime, str, str]]:
    """The merges the team would make: (time, repository, why) with why "work" or the version of a hotfix."""
    out = []
    day = start.date()
    while day <= now.date():
        if day.weekday() < 5:
            for _ in range(rnd.choices((0, 1, 2), MERGES_A_DAY)[0]):
                t = mq.moment(day, rnd.uniform(8.6, 17.8) * 3600)
                if start < t < now - dt.timedelta(minutes=50):
                    out.append((t, rnd.choices(REPOS, SHARE)[0], "work"))
        day += dt.timedelta(days=1)
    for version, service, day, hhmm, n in HOTFIXES:      # the fix of a hotfix is merged a few hours before it goes out
        out += [(at(day, hhmm) - dt.timedelta(hours=rnd.uniform(1.2, 3.5) + i), REPO_OF[service], version) for i in range(n)]
    return sorted(out)


def even_out(merges: list, rnd: random.Random, now: dt.datetime, off: int) -> list:
    """One merge less on the busiest working day of the pull request window, or one more on the quietest."""
    since = now - dt.timedelta(days=PR_DAYS)
    days = [d for d in (since.date() + dt.timedelta(days=i) for i in range(1, PR_DAYS)) if d.weekday() < 5]
    count = Counter(t.date() for t, _, why in merges if why == "work" and t >= since)
    if off > 0:
        busiest = max(days, key=lambda d: (count[d], rnd.random()))
        merges.remove(next(m for m in merges if m[2] == "work" and m[0].date() == busiest))
        return merges
    quietest = min(days, key=lambda d: (count[d], rnd.random()))
    return sorted(merges + [(mq.moment(quietest, rnd.uniform(8.6, 17.8) * 3600), rnd.choices(REPOS, SHARE)[0], "work")])


def build_main(merges: list[tuple[dt.datetime, str, str]], rnd: random.Random, now: dt.datetime, start: dt.datetime) -> tuple[list[dict], list[dict]]:
    """Every merge starts a build of main. A build that breaks main stays red until a fix is merged; one that failed by
    chance is run again. Gives (changes, builds)."""
    changes, builds = [], []
    for repo in REPOS:
        queue = [(t, n, "merge", why) for n, (t, r, why) in enumerate(merges) if r == repo]
        heapq.heapify(queue)
        number, busy, broken, extra = FIRST_BUILD[repo], start, None, len(merges)
        while queue:
            t, _, trigger, why = heapq.heappop(queue)
            if t >= now - dt.timedelta(minutes=45):
                continue
            change = None
            if trigger == "merge":
                change = f"{rnd.getrandbits(28):07x}"
                changes.append({"id": change, "repo": repo, "merged": iso(t), "hotfix": None if why in ("work", "fix") else why})
            begin = max(t + dt.timedelta(minutes=rnd.uniform(.5, 3)), busy)
            mean, spread = MINUTES[repo]
            end = begin + dt.timedelta(minutes=max(mean * .6, rnd.gauss(mean, spread)))
            real, chance = odds(begin.date())
            stage = None
            if broken and trigger == "merge" and why == "fix":
                broken = None                                               # the fix: main is green again
            if broken:
                stage = broken
            elif trigger == "merge" and rnd.random() < real:
                stage = broken = rnd.choices(BROKEN_BY, (3, 5, 2))[0]
                extra += 1
                heapq.heappush(queue, (working(end + dt.timedelta(hours=rnd.uniform(1, 6)), rnd), extra, "merge", "fix"))
            elif rnd.random() < chance:
                stage = "Integration tests" if rnd.random() < .75 else "Build machine"
                extra += 1
                heapq.heappush(queue, (working(end + dt.timedelta(minutes=rnd.uniform(20, 180)), rnd), extra, "re-run", None))
            builds.append({"repo": repo, "number": number, "started": iso(begin), "finished": iso(end), "result": "FAILURE" if stage else "SUCCESS",
                           "stage": stage, "trigger": trigger, "change": change})
            number, busy = number + 1, end
    changes.sort(key=lambda c: (c["merged"], c["repo"]))
    builds.sort(key=lambda b: (b["started"], b["repo"]))
    return changes, builds


def build() -> dict:
    run = load_run(DATA)
    now = run.fetched
    trains = releases()
    first_cut = mq.moment(mq.monday(FIRST_RELEASE - 2) + dt.timedelta(days=7), 12 * 3600)     # the cut of the release before: older work is out
    rnd = random.Random(SEED)
    merges = plan(rnd, now, first_cut)
    window = lambda changes: sum(1 for c in changes if dt.datetime.fromisoformat(c["merged"]) >= now - dt.timedelta(days=PR_DAYS))
    for _ in range(60):                                 # as many merges in the 42 days as the pull request view counts
        changes, builds = build_main(merges, random.Random(SEED + 1), now, first_cut)
        off = window(changes) - PR_MERGED
        if not off:
            break
        merges = even_out(merges, rnd, now, off)
    assert window(changes) == PR_MERGED, window(changes)

    # the release branches: each takes what main holds at its cut and production does not have yet
    taken, cuts = set(), []
    for version, cut, _ in trains:
        ids = [c["id"] for c in changes if dt.datetime.fromisoformat(c["merged"]) < cut and not c["hotfix"] and c["id"] not in taken]
        taken.update(ids)
        cuts.append({"version": version, "at": iso(cut), "changes": ids})

    # the production deploy job: the releases, the hotfixes with their own changes, the rollbacks
    deploys = [{"version": version, "kind": "release", "at": iso(out), "services": list(mq.COMPONENTS), "changes": next(c["changes"] for c in cuts if c["version"] == version)}
               for version, _, out in trains if out]
    deploys += [{"version": version, "kind": "hotfix", "at": iso(at(day, hhmm)), "services": [service], "changes": [c["id"] for c in changes if c["hotfix"] == version]}
                for version, service, day, hhmm, _ in HOTFIXES]
    deploys += [{"version": version, "kind": "rollback", "at": iso(at(day, hhmm)), "services": [service], "changes": []} for version, service, day, hhmm in ROLLBACKS]
    deploys.sort(key=lambda d: d["at"])
    for number, deploy in enumerate(deploys, start=301):
        deploy["number"] = number
    for version, service, *_ in HOTFIXES:
        assert len([c for c in changes if c["hotfix"] == version]) == next(n for v, *_, n in HOTFIXES if v == version), version
    for change in changes:
        del change["hotfix"]
    return {"note": "Invented by tools/make_build_data.py. No real team, product, build or person.", "now": now.isoformat(timespec="seconds"),
            "from": iso(first_cut), "repos": list(REPOS), "services": {name: REPO_OF[name] for name in mq.COMPONENTS},
            "changes": changes, "builds": builds, "cuts": cuts, "deploys": deploys}


def write(target: Path = DATA) -> Path:
    path = target / "builds.json"
    path.write_bytes((json.dumps(build(), ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
    return path


if __name__ == "__main__":
    made = write()
    data = json.loads(made.read_text(encoding="utf-8"))
    print("Wrote", made.name, "with", len(data["changes"]), "changes,", len(data["builds"]), "builds and", len(data["deploys"]), "deploys")
