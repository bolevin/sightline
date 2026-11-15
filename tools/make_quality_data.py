"""Writes demo_data/quality.json: the bugs of team "Kestrel" over four programme increments, invented.

    python tools/make_quality_data.py         # after tools/make_demo_data.py; the same bytes every time

The Quality tab looks further back than the sprints the page shows in detail: twenty sprints, five to an
increment. This file is what a search for the team's bugs would give for that time, reduced to what the analysis
reads: when a bug was written and closed, how it was closed, how severe it was, where and by whom it was found,
which service and feature it belongs to, what the cause was, whether it came back. Next to the bugs stand the
sprints (what was committed, how much scope came in late, how much was merged without a review) and the releases.

The bugs the team planned into its sprints are the same issues as in the sprint data, with the same keys (KES-),
dates and titles. The others came in through the shop-wide intake project (SHOP-) and never entered a sprint of
the team as a planned item. Nothing here comes from a real project.

The story the numbers tell is written into TREND: from increment to increment more bugs reach production, more of
them sit in the payment gateway, more come back after a fix, and more are left lying. How many bugs reach
production in a sprint follows what the sprint before did: scope that came in late and work merged unreviewed.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import cards  # noqa: E402
from sightline.facts import load_run  # noqa: E402

DATA = ROOT / "demo_data"
SEED = 20261120
BOARD = 7
FIRST, LAST = 23, 42                            # the sprints of the file
PIS = (("PI 26.1", 23, 27), ("PI 26.2", 28, 32), ("PI 26.3", 33, 37), ("PI 26.4", 38, 42))
MONDAY_34 = dt.date(2026, 7, 20)
SUMMER = (dt.date(2026, 3, 29), dt.date(2026, 10, 25))          # between these days the clock of the server is an hour ahead
COMPONENTS = ("checkout-api", "payment-gateway", "cart-service", "pricing-engine", "checkout-web", "order-mail")
FEATURE_OF = {"checkout-api": ("KES-908", "KES-900"), "payment-gateway": ("KES-931", "KES-952"), "cart-service": ("KES-900",), "pricing-engine": ("KES-917",),
              "checkout-web": ("KES-908", "KES-946"), "order-mail": ("KES-946",)}
PHASES = ("Development", "Test", "Staging", "Production")
FOUND_BY = {"Development": ("Developer",), "Test": ("QA", "QA", "Developer"), "Staging": ("QA", "Monitoring"), "Production": ("Customer", "Support", "Monitoring")}
CAUSES = ("Regression", "Requirement gap", "Integration contract", "Configuration", "Data", "Concurrency", "UI and text", "Third party")
PRIORITIES = ("Highest", "High", "Medium", "Low")
FIX_DAYS = {"Highest": 1.4, "High": 3.6, "Medium": 9.0, "Low": 21.0}        # the middle bug of its kind, in days
# What changes from increment to increment: bugs a sprint finds before production, how much slower a fix is, how many
# fixed bugs come back, how many bugs nobody picks up, the weight of each cause, the weight of each service among the
# bugs found in production.
TREND = {
    "PI 26.1": {"inside": 6.4, "slow": 1.00, "back": 2, "left": 2, "cause": (20, 22, 14, 12, 10, 6, 12, 4), "prod": (22, 22, 18, 14, 16, 8)},
    "PI 26.2": {"inside": 6.8, "slow": 1.00, "back": 2, "left": 3, "cause": (22, 20, 15, 12, 9, 6, 12, 4), "prod": (22, 24, 18, 12, 16, 8)},
    "PI 26.3": {"inside": 7.4, "slow": 1.20, "back": 4, "left": 5, "cause": (28, 18, 18, 10, 8, 6, 8, 4), "prod": (20, 34, 16, 10, 12, 8)},
    "PI 26.4": {"inside": 8.2, "slow": 1.60, "back": 7, "left": 8, "cause": (38, 13, 22, 8, 6, 4, 6, 3), "prod": (14, 48, 12, 8, 12, 6)},
}
# Sprints before the detailed ones: (committed SP, completed SP, items that came in after the start in % of the commitment).
EARLIER = {23: (28, 27, 7), 24: (30, 27, 12), 25: (27, 27, 0), 26: (31, 26, 18), 27: (26, 26, 8), 28: (29, 28, 7), 29: (32, 27, 14), 30: (28, 28, 4),
           31: (30, 28, 10), 32: (27, 26, 0), 33: (31, 29, 8)}
UNREVIEWED = {23: 9, 24: 4, 25: 6, 26: 5, 27: 11, 28: 3, 29: 7, 30: 10, 31: 4, 32: 8, 33: 5, 34: 12, 35: 6, 36: 9, 37: 16, 38: 8, 39: 14, 40: 21, 41: 12, 42: 24}
RELEASES = {24: "4.11", 26: "4.12", 28: "4.13", 30: "4.14", 32: "4.15", 34: "4.16", 36: "4.17", 38: "4.18", 40: "4.19"}      # shipped at the end of the sprint
PLACED = {"KES-1422": ("Production", "checkout-web", "Customer"), "KES-1420": ("Production", "payment-gateway", "Monitoring"),
          "KES-1391": ("Production", "payment-gateway", "Customer"), "KES-1343": ("Staging", "cart-service", "QA")}       # bugs the page names elsewhere
TITLES = {
    "checkout-api": ("Order is created without a delivery address", "Checkout answers with an error for long street names", "Step back loses the chosen delivery",
                     "Order total ignores the delivery discount", "Checkout accepts an expired cart", "Delivery options are missing for some postcodes",
                     "Two orders share one order number", "Checkout times out when stock is checked", "Order stays pending after a paid checkout",
                     "Address check accepts an empty house number"),
    "payment-gateway": ("Payment is charged and the order is not placed", "Refund status stays pending", "Declined card is reported as a timeout",
                        "Wallet payment returns to an empty page", "Payment callback is processed twice", "Refund amount is rounded the wrong way",
                        "Saved card cannot be chosen", "Capture fails for split deliveries", "Payment page shows the wrong currency",
                        "Retry after a failed payment charges twice"),
    "cart-service": ("Cart loses items when the page is reloaded", "Quantity jumps back after an update", "Cart total lags behind the item list",
                     "Removed item comes back to the cart", "Cart is shared between two accounts on one device", "Bundle is counted as single items",
                     "Cart limit is not applied", "Cart shows a sold-out item as available", "Merged cart doubles the quantity", "Saved cart opens empty"),
    "pricing-engine": ("Voucher is applied to excluded items", "Staggered price uses the wrong step", "Promotion price stays after its end",
                       "Tax is shown for a tax-free delivery", "Discount is applied before the bundle price", "Free delivery threshold counts the voucher",
                       "Price differs between list and cart", "Loyalty discount is granted twice", "Currency conversion uses yesterday's rate",
                       "Rounding differs between line and total"),
    "checkout-web": ("Pay button stays grey after a valid form", "Address form jumps while typing", "Error text hides the field it belongs to",
                     "Summary is cut off on small screens", "Back button skips the delivery step", "Loading spinner never stops after an error",
                     "Keyboard covers the pay button", "Form keeps the old error after a correction", "Delivery date picker opens off screen",
                     "Autofill fills the card number into the name field"),
    "order-mail": ("Confirmation mail is sent twice", "Confirmation mail shows the wrong delivery date", "Invoice attachment is empty",
                   "Mail is sent in the wrong language", "Tracking link in the mail is broken", "Refund mail names the wrong amount",
                   "Mail lists a cancelled item", "Confirmation mail arrives hours late", "Mail subject misses the order number", "Mail shows prices without tax"),
}
WHERE = ("", "", " on mobile", " for guest orders", " after a retry", " in the app", " for returning customers")


def monday(sprint: int) -> dt.date:
    return MONDAY_34 + dt.timedelta(days=14 * (sprint - 34))


def zone(day: dt.date) -> dt.timezone:
    return dt.timezone(dt.timedelta(hours=2 if SUMMER[0] <= day < SUMMER[1] else 1))


def moment(day: dt.date, seconds: float) -> dt.datetime:
    return dt.datetime.combine(day, dt.time(), tzinfo=zone(day)) + dt.timedelta(seconds=int(seconds))


def sprint_of(t: dt.datetime) -> int:
    return max(FIRST, min(LAST, 34 + (t.date() - MONDAY_34).days // 14))


def pi_of(sprint: int) -> str:
    return next(name for name, first, last in PIS if first <= sprint <= last)


def pick(rnd: random.Random, names, weights) -> str:
    return rnd.choices(names, weights=weights, k=1)[0]


def shares(rnd: random.Random, names, weights, n: int) -> list[str]:
    """`n` names in the proportion of the weights, as exactly as whole numbers allow, in a random order."""
    exact = [w * n / sum(weights) for w in weights]
    counts = [int(x) for x in exact]
    for i in sorted(range(len(names)), key=lambda i: exact[i] - counts[i], reverse=True)[:n - sum(counts)]:
        counts[i] += 1
    out = [name for name, count in zip(names, counts) for _ in range(count)]
    rnd.shuffle(out)
    return out


def sprints() -> list[dict]:
    """The twenty sprints: dates, what was committed and completed, how much came in late, how much was merged unreviewed."""
    expected = json.loads((DATA / "expected.json").read_text(encoding="utf-8"))
    detailed = {int(plan["name"].split()[-1]): plan for plan in expected.values()}
    out = []
    for n in range(FIRST, LAST + 1):
        if n in detailed:
            plan = detailed[n]
            committed, completed, late = plan["committed_sp"], plan["completed_sp"], round(100 * len(plan["added"]) / len(plan["committed"]))
        else:
            committed, completed, late = EARLIER[n]
        start, end = moment(monday(n), 9 * 3600), moment(monday(n) + dt.timedelta(days=11), 16 * 3600)
        out.append({"sprint": n, "name": f"Sprint {n}", "pi": pi_of(n), "start": start.isoformat(), "end": end.isoformat(), "running": n == LAST,
                    "committed_sp": float(committed), "completed_sp": float(completed), "added_pct": late, "unreviewed_pct": UNREVIEWED[n],
                    "release": RELEASES.get(n)})
    return out


def close(rnd: random.Random, bug: dict, now: dt.datetime) -> None:
    """How and when the bug was closed, if it was."""
    created = dt.datetime.fromisoformat(bug["created"])
    how = pick(rnd, ("Fixed", "Duplicate", "Cannot reproduce", "Won't fix"), (76, 10, 9, 5))
    if how == "Fixed":
        days = FIX_DAYS[bug["priority"]] * TREND[pi_of(bug["sprint"])]["slow"] * math.exp(rnd.gauss(0, .65)) * (.7 if bug["found_in"] == "Production" else 1)
    else:
        days = rnd.uniform(.3, 6)
    closed = created + dt.timedelta(days=days)
    while closed.weekday() >= 5:
        closed += dt.timedelta(days=1)
    if closed < now:
        bug.update(resolved=closed.astimezone(zone(closed.date())).isoformat(timespec="seconds"), resolution=how, status="Done")
    else:
        bug["status"] = "In Progress" if rnd.random() < .6 else "Review"


def build() -> dict:
    rnd = random.Random(SEED)
    run = load_run(DATA)
    now = run.fetched
    shown = cards.sprint_cards(run)
    done = run.boards[BOARD].done_statuses
    table = sprints()
    by_sprint = {s["sprint"]: s for s in table}

    def new_bug(key: str, created: dt.datetime, phase: str) -> dict:
        priority = pick(rnd, PRIORITIES, (9, 30, 44, 17) if phase == "Production" else (2, 18, 52, 28))
        return {"key": key, "title": "", "priority": priority, "created": created.isoformat(timespec="seconds"), "sprint": sprint_of(created), "resolved": None,
                "resolution": None, "status": "To Do", "component": rnd.choice(COMPONENTS), "found_in": phase, "found_by": rnd.choice(FOUND_BY[phase]), "cause": None,
                "feature": None, "reopened": 0}

    # how many bugs each sprint brings: before production it follows the increment; in production it follows what the
    # sprint before did to itself (scope that came in late, work merged without a review)
    wanted = {}
    for n in range(FIRST, LAST + 1):
        before = by_sprint.get(n - 1, {"added_pct": 8, "unreviewed_pct": 6})
        escaped = max(0, round(.9 + .055 * before["added_pct"] + .075 * before["unreviewed_pct"] + rnd.uniform(-1.7, 1.7)))
        inside = max(3, round(TREND[pi_of(n)]["inside"] + rnd.uniform(-1.5, 1.5)))
        wanted[n] = (round(inside * .7), round(escaped * .75)) if n == LAST else (inside, escaped)      # the running sprint is seven days old

    # the bugs the sprint data already holds
    bugs = []
    for key, issue in sorted(run.issues.items(), key=lambda kv: kv[1].created):
        if issue.type != "Bug" or not key.startswith("KES-"):
            continue
        fixed_at = issue.done_from(done, now)
        bug = new_bug(key, issue.created, "Test")
        bug.update(title=shown[key]["title"], priority=shown[key]["priority"], status=shown[key]["status"])
        if fixed_at:
            bug.update(resolved=fixed_at.isoformat(timespec="seconds"), resolution="Fixed")
        if key in PLACED:
            bug["found_in"], bug["component"], bug["found_by"] = PLACED[key]
        bugs.append(bug)
    held = {}
    for bug in bugs:
        held.setdefault(bug["sprint"], []).append(bug)
    for n, found in held.items():                                       # of the bugs a sprint holds, as many as wanted were found in production
        loose = [b for b in found if b["key"] not in PLACED]
        already = sum(1 for b in found if b["found_in"] == "Production")
        for bug in loose[:max(0, wanted[n][1] - already)]:
            bug.update(found_in="Production", found_by=rnd.choice(FOUND_BY["Production"]))
        for bug in loose:
            if bug["found_in"] != "Production":
                bug["found_in"] = pick(rnd, PHASES[:3], (2, 6, 3))
                bug["found_by"] = rnd.choice(FOUND_BY[bug["found_in"]])

    # the others came in through the shop-wide intake project SHOP, which other teams use too: its numbers run on
    number = 2900
    for n in range(FIRST, LAST + 1):
        have = held.get(n, [])
        need_out = max(0, wanted[n][1] - sum(1 for b in have if b["found_in"] == "Production"))
        need_in = max(0, wanted[n][0] - sum(1 for b in have if b["found_in"] != "Production"))
        phases = ["Production"] * need_out + [pick(rnd, PHASES[:3], (2, 6, 3)) for _ in range(need_in)]
        rnd.shuffle(phases)
        days = [monday(n) + dt.timedelta(days=d) for d in (0, 1, 2, 3, 4, 7, 8, 9, 10, 11) if n < LAST or d <= 7]
        times = sorted(moment(rnd.choice(days), rnd.uniform(8.2 * 3600, 17.6 * 3600)) for _ in phases)
        for t, phase in zip(times, phases):
            number += rnd.choice((2, 3, 3, 4, 5, 7, 9))
            bugs.append(new_bug(f"SHOP-{number}", min(t, now - dt.timedelta(minutes=45)), phase))

    # increment by increment: where the production bugs sit, what each bug is called, how it ended, what came back
    used = {bug["title"] for bug in bugs}
    for name, first, last in PIS:
        trend = TREND[name]
        ours = [b for b in bugs if first <= b["sprint"] <= last]
        intake = [b for b in ours if b["key"].startswith("SHOP-")]
        outside = [b for b in intake if b["found_in"] == "Production"]
        for bug, component in zip(outside, shares(rnd, COMPONENTS, trend["prod"], len(outside))):
            bug["component"] = component
        for bug in ours:
            bug["feature"] = rnd.choice(FEATURE_OF[bug["component"]]) if rnd.random() < .7 else None
        for bug in intake:
            for _ in range(500):
                text = rnd.choice(TITLES[bug["component"]]) + rnd.choice(WHERE)
                if text not in used:
                    break
            else:
                raise AssertionError(f"no title left for {bug['component']}")
            used.add(text)
            bug["title"] = text
        left = rnd.sample([b for b in intake if b["priority"] in ("Medium", "Low")], trend["left"])     # nobody picks them up: bug debt
        for bug in intake:
            if bug not in left:
                close(rnd, bug, now)
        fixed = [b for b in ours if b["resolution"] == "Fixed"]
        for bug, cause in zip(fixed, shares(rnd, CAUSES, trend["cause"], len(fixed))):
            bug["cause"] = cause
        back = rnd.sample([b for b in fixed if b["key"].startswith("SHOP-")], trend["back"])
        for i, bug in enumerate(back):                                  # fixed, and back again: the final fix came later
            bug["reopened"] = 2 if i == 0 and trend["back"] > 3 else 1
            later = dt.datetime.fromisoformat(bug["resolved"]) + dt.timedelta(days=rnd.uniform(3, 9) * bug["reopened"])
            while later.weekday() >= 5:
                later += dt.timedelta(days=1)
            bug["resolved"] = min(later, now - dt.timedelta(hours=2)).astimezone(zone(min(later, now).date())).isoformat(timespec="seconds")
    bugs.sort(key=lambda b: (b["created"], b["key"]))
    assert len({b["key"] for b in bugs}) == len(bugs) and len({b["title"] for b in bugs}) == len(bugs)

    releases = [{"version": version, "sprint": n, "at": moment(monday(n) + dt.timedelta(days=10), 14 * 3600).isoformat(timespec="seconds")} for n, version in sorted(RELEASES.items())]
    return {"note": "Invented by tools/make_quality_data.py. No real team, product, bug or person.", "now": now.isoformat(timespec="seconds"),
            "targets_days": {"Highest": 2, "High": 5, "Medium": 15, "Low": 30},
            "pis": [{"name": name, "first": first, "last": last} for name, first, last in PIS], "sprints": table, "releases": releases, "bugs": bugs}


def write(target: Path = DATA) -> Path:
    path = target / "quality.json"
    path.write_bytes((json.dumps(build(), ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
    return path


if __name__ == "__main__":
    made = write()
    data = json.loads(made.read_text(encoding="utf-8"))
    print("Wrote", made.name, "with", len(data["bugs"]), "bugs over", len(data["sprints"]), "sprints")
