"""Writes demo_data/: the invented Jira data the demo runs on.

Nothing here comes from a real Jira. Team "Kestrel" builds the checkout and the payments of an online shop that
does not exist. The plan below says, for every issue, which sprints it was in and on which working day it moved
from one status to the next; the generator turns that plan into what Jira would answer: issues with their
changelog, the sprints of the board, the velocity chart and two extra searches. Every issue has a title and a
priority, invented like the rest. There are no people, no descriptions and no comments in the data.

The same plan is counted a second time, without any Jira format in between, into expected.json: what each sprint
committed, completed, took in and gave away. A test compares what the app rebuilds from the changelogs with it.

    python tools/make_demo_data.py            # writes demo_data/ (the same bytes every time)
"""
from __future__ import annotations

import datetime as dt
import json
import random
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline.facts import FEATURE_FIELD, POINTS_FIELD, SPRINT_FIELD, TEAM_FIELD  # noqa: E402  (the ids of the fields only)

OUT = ROOT / "demo_data"
SEED = 20261117
BOARD, FILTER = 7, "4711"
TEAM = "Kestrel"
TEAMS = {"Kestrel": "10200", "Atlas": "10201", "Osprey": "10202"}       # option ids of the team field
STATUS = {"T": ("10311", "To Do"), "P": ("10312", "In Progress"), "B": ("10314", "Blocked"), "R": ("10317", "Review"), "D": ("10319", "Done")}
KINDS = {"S": "Story", "B": "Bug", "T": "Task", "U": "Sub-task"}
FEATURES = {"F1": "KES-900", "F2": "KES-908", "F3": "KES-917", "F4": "KES-931", "F5": "KES-946", "F6": "KES-952"}
SPRINTS = {34: 512, 35: 519, 36: 527, 37: 533, 38: 540, 39: 548, 40: 553, 41: 561, 42: 568}      # "Sprint 34" ... -> id
RUNNING = 42
FIRST_MONDAY = dt.date(2026, 7, 20)             # the Monday Sprint 34 started
WINTER = dt.date(2026, 10, 25)                  # the clocks of the server go back an hour
NOW_DAY, NOW_AT = 7, 10 * 3600 + 40 * 60        # the data is read on working day 7 of the running sprint, 10:40
FIRST_KEY = 1187

# The plan: one row per issue.
#   type points feature | sprints | status moves
# type: S story, B bug, T task, U sub-task. points: 3, "-" (none), "3,38.3>5" (3, changed to 5 on day 3 of Sprint 38).
# sprints: "39 40" planned into 39 and carried over to 40 when 39 closed; "36+3" added on day 3; "39*8" created right
#   in the sprint on day 8; "41-9" taken out on day 9; "40-3+5" taken out on day 3 and back on day 5; "37x" carried in
#   when the sprint before closed and taken out again before the start.
# status moves: "4P 8B 40.2P" = In Progress on day 4, Blocked on day 8, In Progress again on day 2 of Sprint 40
#   (P in progress, B blocked, R review, D done; "7Pa" = in the afternoon). Days are the working days of a sprint,
#   1 to 10.
PLAN = """
# Sprint 34
S 3 F1 | 34 | 1P 2R 3D
S 5 F1 | 34 | 1P 4R 5D
T 1 -  | 34 | 2P 3D
S 2 F2 | 34 | 2P 4R 5D
B 2 -  | 34 | 2P 4R 5D
S 3 F2 | 34 | 3P 5R 6D
S 3 F1 | 34 | 4P 8R 10D
S 2 F3 | 34 | 5P 8R 9D
T - -  | 34 | 6P 8D
S 5 F3 | 34 | 4P 9R 10D
B 1 -  | 34 | 8P 9R 10D
S 3 F2 | 34 35 | 7Pa 10R 35.2D
# Sprint 35
S 5 F3 | 35 | 1P 4R 5D
S 3 F1 | 35 | 1P 3R 5D
B 2 -  | 35 | 1P 2R 2D
S 2 F2 | 35 | 3P 5R 6D
S 3 F3 | 35 | 4P 8R 9D
S 3 F2 | 35 | 5P 8R 10D
S 2 F4 | 35 | 6P 9R 10D
S 3 F4 | 35 | 6P 9R 10D
T 1 -  | 35 | 8P 9D
S 2 F4 | 35 36 | 8P 36.2R 36.3D
B 1 -  | 35+4 | 4P 5R 5D
# Sprint 36: too much was taken in, two stories stood blocked
S 3 F4 | 36 | 1P 4R 6D
S 3 F4 | 36 | 1P 3R 5D
B 2 -  | 36 | 1P 2R 3D
S 8 F5 | 36 37 | 2P 5B 9P 37.5R 37.9D
S 3 F5 | 36 | 2P 6R 10D
S 5 F5 | 36 37 | 3P 6B 8P 10R 37.2D
S 2 F3 | 36 | 4P 8R 10D
T 1 -  | 36 | 5P 6D
S 3 F1 | 36 | 6P 9R 10D
S 3 F2 | 36 37 | 6P 37.3R 37.5D
S -,36.3>3 F5 | 36 37x 38 | 38.1P 38.4R 38.5D
B 2 -  | 36+3 | 3P 4R 5D
B 1 -  | 36+5 | 5P 6R 6D
S 2 F5 | 36+6 37 | 8P 37.4R 37.6D
# Sprint 37
S 3 F5 | 37 | 1P 3R 4D
S 2 F1 | 37 | 2P 4R 5D
B 1 -  | 37 | 2P 3R 3D
S 3 F4 | 37 | 5P 8R 9D
S 2 F4 | 37 38 | 6P 38.2R 38.3D
S 2 F2 | 37+3 | 6P 8R 10D
# Sprint 38
S 3,38.3>5 F6 | 38 | 1P 5R 8D
S 3 F6 | 38 | 1P 3R 5D
S 3 F1 | 38 | 2P 5R 6D
B 2 -  | 38 | 2P 3R 4D
T 1 -  | 38 | 3P 4D
S 2 F2 | 38 | 4P 6R 8D
S 3 F6 | 38 | 5P 8R 10D
S 3 F3 | 38 39 | 6P 9R 39.1D
T - -  | 38 | 8P 10D
B 1 -  | 38 | 6P 8R 10D
S 2 F3 | 38+2 | 3P 6R 8D
U - -  | 38*2 | 2P 4D
U - -  | 38*2 | 3P 6R 7D
# Sprint 39: too much again, and the wallet story began its long way
S 5 F6 | 39 40 | 1P 6B 40.3P 40.5R 40.6D
S 5 F6 | 39 40 41 42 | 4P 8B 40.2P 40.7R 40.9P 41.3B 41.8P 41.9R 42.2B
S 3 F3 | 39 | 1P 3R 4D
S 3 F3 | 39 | 5P 8R 10D
B 2 -  | 39 | 2P 3R 3D
S 3 F5 | 39 | 2P 6R 10D
S 3 F1 | 39 | 3P 6B 7Pa 9R 10D
T 1 -  | 39 | 4P 5D
S 3 F2 | 39 | 5P 9R 10D
S 2 F2 | 39 40 | 6P 10R 40.2D
S 2 F4 | 39 40 | 40.1P 40.3R 40.4D
B 2 -  | 39+2 | 2P 4R 5D
B 1 -  | 39+4 | 4P 5R 6D
S 3 F6 | 39+6 40 | 8P 40.4R 40.5D
B 2 -  | 39*8 40 | 9P 40.1R 40.2D
# Sprint 40
S 3 F1 | 40 | 1P 4R 6D
S 2 F2 | 40-3+5 | 5P 8R 9D
T 1 -  | 40 | 5P 6D
S 3 F4 | 40 | 6P 8R 10D
B 1 -  | 40 | 8P 9R 9D
S 2 F3 | 40 | 4P 8R 10D
S 2 F6 | 40+5 41 42 | 5P 9R 41.2P 41.4R
S 3 F5 | 40+3 | 4P 8R 10D
B 2 -  | 40+8 | 8P 9R 10D
U - -  | 40*1 | 1P 3D
# Sprint 41: too much a third time
S 1 F6 | 41 42 | 7Pa
B 2 -  | 41 42 | 8P 10R 42.2D
S 5,41.2>3 F5 | 41 | 1P 4R 6D
S 3 F5 | 41 | 1P 3R 5D
S 2 F2 | 41 | 2P 4R 5D
B 2 -  | 41 | 2P 3R 4D
S 3 F6 | 41-9 | 3P 6B
S 3 F1 | 41 | 4P 8R 10D
T 1 -  | 41 | 5P 6D
S 3 F3 | 41 | 6P 9R 10D
S 3 F3 | 41 42x |
T 1 -  | 41 | 3P 4D
B 2 -  | 41+4 | 4P 5R 6D
S 3 F5 | 41+2 | 5P 9R 10D
U - -  | 41*1 | 1P 3D
# Sprint 42, the running one
S 3 F5 | 42 | 1P 2R 3D
S 2 F2 | 42 | 1P 3R 4D
T 1 -  | 42 | 2P 2D
S 5 F6 | 42 | 2P 5R 6D
S 1 F1 | 42 | 4P 6R
S 1 F2 | 42 | 4P
B 1,42.5>2 - | 42 | 3P 5B
S 2 -  | 42 |
S - -  | 42 |
S 5 F6 | 42-4 |
S 1 F5 | 42+3 | 4P
S - F2 | 42+4 |
B 1 -  | 42*6a |
U - -  | 42*2 | 2P 4D
U - -  | 42*2 | 3P 5R 6D
U - -  | 42*3 | 4P
"""

# Issues of the team that are in no sprint and changed in the last days (the search "inbox" finds them):
# type, points, feature, created (day of the running sprint, seconds), then what happened: ("team", from, day, seconds)
# or ("points", value, day, seconds).
BACKLOG = (
    ("B", None, None, (5, 11 * 3600 + 12 * 60), (("team", "Atlas", 6, 15 * 3600 + 52 * 60),)),      # a bug handed over yesterday afternoon
    ("T", None, None, (3, 15 * 3600 + 48 * 60), (("points", 1.0, 6, 9 * 3600 + 12 * 60),)),
    ("S", None, "F2", (6, 11 * 3600 + 27 * 60), ()),
    ("B", None, None, (4, 16 * 3600 + 5 * 60), (("points", 2.0, 6, 13 * 3600 + 31 * 60),)),
)
# Issues of other teams whose comments name the team (the search "mentions"): key, type, team, points, created
# (days before now), moves as (status, days before now, seconds of that day).
MENTIONS = (
    ("PAY-2291", "S", "Atlas", 5.0, 9, (("P", 5, 10 * 3600 + 8 * 60), ("R", 1, 16 * 3600 + 21 * 60))),
    ("OPS-874", "T", "Osprey", None, 4, (("P", 0, 9 * 3600 + 4 * 60),)),
)

# Titles. The stories of a feature take theirs from the pool of that feature, bugs, tasks and sub-tasks from the pool
# of their kind, in the order the issues were written. The issues the page shows most are named by key (TITLE_OF),
# so that what the title says fits what happens to the issue.
TITLES = {
    "F1": ("Keep the cart when the customer signs in", "Show the delivery cost in the cart", "Change the quantity without a reload", "Save the cart for later",
           "Warn when an item in the cart is sold out", "Merge the carts of two devices", "Cart shows the saving of a bundle", "Undo for removing an item",
           "Limit the quantity per order", "Estimate the delivery date in the cart", "Share a cart by link", "Show recently removed items",
           "Round the cart total per line"),
    "F2": ("Check out without an account", "Validate the address while typing", "Remember the guest address on this device", "Guest checkout on one page",
           "Find the address by postcode", "Separate billing and delivery address", "Phone number is optional for guests", "Guest order status by link",
           "Edit the address before paying", "Offer pick-up points to guests", "Clear error texts in the address form", "Autofill support in the checkout form",
           "Delivery note for the courier", "Keep the form when the session expires", "Country selector with the common ones first",
           "Guest checkout in the mobile layout", "Gift option for guest orders"),
    "F3": ("Apply one voucher per order", "Show why a voucher was refused", "Bundle price for sets", "Staggered price by quantity",
           "Free delivery above a threshold", "Show the price before and after the discount", "Promotion with a start and an end time",
           "Voucher for the first order", "Tax shown per line", "Price in the customer's currency", "Loyalty discount at the checkout",
           "Stack a promotion with a voucher", "Round prices by the rule of the country", "Preview a promotion before it starts"),
    "F4": ("Pay by card with a saved card", "Second attempt after a declined card", "Strong customer authentication in the payment step",
           "Save a card with consent", "Show the card type while typing", "Expiry reminder for saved cards", "Pay in instalments by card",
           "Clear text when the bank declines", "Delete a saved card", "Card payment in the mobile layout", "Authorise at the order, capture at dispatch"),
    "F5": ("Confirmation page with the order number", "Confirmation mail within a minute", "Invoice as a PDF in the mail", "Track the parcel from the confirmation",
           "Confirmation in the customer's language", "Add the delivery to the calendar", "Cancel within ten minutes of ordering",
           "Confirmation shows the payment method", "Text message on the delivery day", "Print view of the order", "Confirmation for split deliveries",
           "Feedback question after the order", "Order page for signed-in customers", "Change the delivery address after ordering"),
    "F6": ("Pay with a wallet at the checkout", "Wallet button in the cart", "Refund to the card that paid", "Refund status on the order page",
           "Automatic refund for a cancelled order", "Wallet payment in the mobile layout", "Show the refund amount before confirming",
           "Refund the delivery cost on a full return", "Wallet as the default payment method", "Mail when a refund is done"),
    "S": ("Research: why customers leave at the payment step", "Draft the checkout for the app", "Explore a faster payment step"),
    "B": ("Voucher is accepted twice", "Address check rejects valid postcodes", "Total differs between cart and confirmation", "Double click places two orders",
          "Saved card shows the wrong expiry date", "Confirmation mail has an empty item list", "Cart is empty after a cancelled payment",
          "Delivery cost is missing for islands", "Payment page times out on slow connections", "Wrong tax for mixed baskets",
          "Back button returns to a paid order", "Quantity field accepts zero", "Guest order lands in the wrong account", "Refund is booked twice",
          "Currency symbol is missing in the summary", "Promotion ends an hour early", "Wallet payment hangs after the redirect",
          "Error page instead of the declined-card text", "Checkout form loses focus on mobile", "Invoice shows the net price as gross",
          "Order number is missing in the mail subject", "Session expires during the payment", "Stock stays reserved after a failed payment",
          "Rounding differs for three-for-two", "Address autofill overwrites the name"),
    "T": ("Update the payment library", "Dashboard for failed payments", "Load test of the checkout before the sale", "Clean up the feature flags of the last release",
          "Alert when confirmations queue up", "Document the refund flow", "Renew the certificate of the payment endpoint", "Archive orders older than five years",
          "Speed up the checkout test suite", "Runbook for a payment outage", "Remove the old voucher service", "Trace ids through the payment calls",
          "Review the log retention of the checkout", "Upgrade the build of the web checkout"),
    "U": ("Write the API contract", "Add the database migration", "Cover the edge cases with tests", "Update the texts", "Review with the designer",
          "Add the metrics", "Update the runbook", "Check accessibility"),
}
TITLE_OF = {            # key: (title, priority)
    "KES-1290": ("Refund to the original wallet through the ledger of team Atlas", "High"),
    "KES-1343": ("Cart total is off by a cent after a voucher", "Medium"),
    "KES-1360": ("Show the wallet that paid on the order summary", "Medium"),
    "KES-1373": ("Remember the last wallet for returning customers", "Low"),
    "KES-1382": ("Split a payment between a wallet and a card", "Medium"),
    "KES-1385": ("Guest checkout keeps the address after a failed payment", "High"),
    "KES-1389": ("Offer an account after a guest order", "Medium"),
    "KES-1390": ("Explore one-click reorder", "Low"),
    "KES-1391": ("Payment confirmation arrives twice after a retry", "High"),
    "KES-1393": ("Partial refund for a single item", "High"),
    "KES-1395": ("Confirmation mail lists the delivery window", "Medium"),
    "KES-1396": ("Cart badge updates without a reload", "Low"),
    "KES-1399": ("Rotate the keys of the payment sandbox", "Medium"),
    "KES-1400": ("Consent text for saved payment methods", "Medium"),
    "KES-1403": ("Resend the order confirmation from the order page", "High"),
    "KES-1408": ("Guest checkout for company orders", "Medium"),
    "KES-1420": ("Ledger rejects refunds above the daily limit", "High"),
    "KES-1422": ("Checkout button stays disabled after the address check", "Highest"),
    "PAY-2291": ("Settlement report misses orders paid by wallet", "High"),
    "OPS-874": ("Raise the rate limit of the checkout API before the sale", "Medium"),
}
PRIORITIES = {"S": ("Medium", "Medium", "High", "Medium", "Low"), "B": ("High", "Medium", "Highest", "Medium", "High", "Low"),
              "T": ("Low", "Medium", "Medium"), "U": ("Medium",)}       # taken in turn, per kind

GAP = 6 * 60                                    # seconds between two events of one issue on one day, at least
VISIT = re.compile(r"(\d+)(x)?(?:([+*])(\d+)(a)?)?(?:-(\d+)(?:\+(\d+))?)?")
MOVE = re.compile(r"(?:(\d+)\.)?(\d+)([PRBD])(a)?")
CHANGE = re.compile(r"(\d+)\.(\d+)>(\d+(?:\.\d+)?)")


def monday(sprint: int) -> dt.date:
    return FIRST_MONDAY + dt.timedelta(days=14 * (sprint - 34))


def workday(sprint: int, day: int) -> dt.date:
    """Working day 1..10 of a sprint as a date."""
    return monday(sprint) + dt.timedelta(days=day - 1 + (2 if day > 5 else 0))


def at(day: dt.date, seconds: float) -> dt.datetime:
    zone = dt.timezone(dt.timedelta(hours=1 if day >= WINTER else 2))
    return dt.datetime(day.year, day.month, day.day, tzinfo=zone) + dt.timedelta(milliseconds=round(seconds * 1000))


def stamp(t: dt.datetime, agile: bool = False) -> str:
    """A time as Jira writes it: ...+0100 in issues and changelogs, ...+01:00 in the sprints of a board."""
    offset = t.strftime("%z")
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}" + (offset[:3] + ":" + offset[3:] if agile else offset)


NOW = at(workday(RUNNING, NOW_DAY), NOW_AT)


@dataclass
class Visit:
    sprint: int
    mode: str                       # plan | carry | add | create
    day: int = 0                    # the day it came in (add, create)
    half: str = ""
    dropped: bool = False           # carried in, taken out before the start: never part of the sprint
    out: int = 0                    # the day it was taken out
    back: int = 0                   # the day it came back


@dataclass
class Item:
    kind: str
    points: float | None            # when created
    changes: list                   # [(sprint, day, points)]
    feature: str | None
    visits: list
    moves: list                     # [(sprint, day, status letter, half)]
    team_from: str | None = None
    points_first: float | None = None               # as the issue was written: `points`, or none yet
    events: list = field(default_factory=list)      # [(time, what, data)], in order
    created: dt.datetime | None = None
    key: str = ""
    title: str = ""
    priority: str = ""

    @property
    def subtask(self) -> bool:
        return self.kind == "U"


def parse_plan() -> list[Item]:
    items = []
    for line in PLAN.splitlines():
        line = line.split("#")[0].strip()
        if not line:
            continue
        head, visits, moves = (part.strip() for part in line.split("|"))
        kind, points, feature = head.split()
        first, *later = points.split(",")
        found = []
        for text in visits.split():
            m = VISIT.fullmatch(text)
            assert m, text
            sprint, dropped, how, day, half, out, back = m.groups()
            mode = {"+": "add", "*": "create", None: "plan"}[how]
            if mode == "plan" and found and found[-1].sprint == int(sprint) - 1 and not found[-1].dropped and not (found[-1].out and not found[-1].back):
                mode = "carry"
            assert not dropped or mode == "carry", text
            found.append(Visit(int(sprint), mode, int(day or 0), half or "", bool(dropped), int(out or 0), int(back or 0)))
        sprint, steps = found[0].sprint, []
        for text in moves.split():
            m = MOVE.fullmatch(text)
            assert m, text
            sprint = int(m.group(1) or sprint)
            steps.append((sprint, int(m.group(2)), m.group(3), m.group(4) or ""))
        assert steps == sorted(steps, key=lambda s: s[:2]), line
        done = [s[0] for s in steps if s[2] == "D"]
        assert not done or (steps[-1][2] == "D" and found[-1].sprint == done[0]), f"done is the end: {line}"
        assert all(v.mode != "carry" or v.sprint <= (done or [99])[0] for v in found), f"carried when done: {line}"
        items.append(Item(kind, None if first == "-" else float(first), [(int(a), int(b), float(c)) for a, b, c in CHANGE.findall(",".join(later))],
                          FEATURES.get(feature), found, steps))
    return items


# ---------------------------------------------------------------- the plan, counted without Jira

def status_at_end(item: Item, sprint: int) -> str:
    done = [s for s in item.moves if s[0] <= sprint]
    return done[-1][2] if done else "T"


def points_at(item: Item, sprint: int, day: float) -> float | None:
    """Story points before anything that changed on `day` of `sprint` or later."""
    value = item.points
    for s, d, new in item.changes:
        if (s, d) < (sprint, day):
            value = new
    return value


def count_plan(items: list[Item]) -> dict:
    """Per sprint: what was committed, added, taken out, completed and left open, as the plan says it."""
    out = {}
    for sprint, sid in SPRINTS.items():
        part = {name: [] for name in ("committed", "completed", "not_completed", "added", "removed")}
        committed_sp = completed_sp = 0.0
        for item in items:
            visit = next((v for v in item.visits if v.sprint == sprint and not v.dropped), None)
            if visit is None or item.subtask:
                continue
            if visit.mode in ("plan", "carry"):
                part["committed"].append(item.key)
                committed_sp += points_at(item, sprint, 0) or 0
            else:
                part["added"].append(item.key)
            if visit.out and not visit.back:
                part["removed"].append(item.key)
            elif status_at_end(item, sprint) == "D":
                part["completed"].append(item.key)
                completed_sp += points_at(item, sprint, 11) or 0
            else:
                part["not_completed"].append(item.key)
        number = lambda key: int(key.split("-")[1])
        out[str(sid)] = {"name": f"Sprint {sprint}", "committed_sp": committed_sp, "completed_sp": completed_sp,
                         **{name: sorted(keys, key=number) for name, keys in part.items()}}
    return out


# ---------------------------------------------------------------- the plan as Jira would tell it

def sprint_times(rnd: random.Random) -> dict:
    """Planned start, the moment "start" was pressed, planned end and the moment the sprint was closed."""
    out = {}
    for sprint in SPRINTS:
        first, last = workday(sprint, 1), workday(sprint, 10)
        out[sprint] = {"start": at(first, 9 * 3600), "activated": at(first, 9 * 3600 + rnd.uniform(120, 540)),
                       "end": at(last, 16 * 3600), "complete": at(last, 16 * 3600 + rnd.uniform(60, 420)) if sprint != RUNNING else None}
    return out


def schedule(item: Item, times: dict, rnd: random.Random) -> None:
    """Give every step of the plan a moment: working hours, working days, in the order things happen."""
    wanted = []         # (date, order within the day, lowest second, highest second, fixed moment, what, data)
    hours = lambda a, b: (a * 3600, b * 3600)
    add = lambda day, order, window, what, data=None, fixed=None: wanted.append((day, order, *window, fixed, what, data))

    def in_sprint(sprint: int, day: int, window: tuple, half: str = "") -> tuple:
        lo, hi = window
        if half == "a":
            lo, hi = 12.7 * 3600, min(hi, 17.1 * 3600)
        if day == 1:
            lo = max(lo, 9.4 * 3600)                        # after the sprint was started
        if day == 10:
            hi = min(hi, 15.5 * 3600)                       # before it was closed
        if sprint == RUNNING and day == NOW_DAY:
            lo, hi = min(lo, 8.35 * 3600), NOW_AT - 15 * 60  # before the data was read
        assert (sprint, day) <= (RUNNING, NOW_DAY), "the plan runs past the moment the data is read"
        return lo, hi

    first = item.visits[0]
    if first.mode == "create":
        born = workday(first.sprint, first.day)
        add(born, 0, in_sprint(first.sprint, first.day, hours(9.5, 16.5), first.half), "created")
    elif first.mode == "add":
        born = workday(first.sprint, first.day)
        for _ in range(rnd.choice((0, 1, 1, 2, 3))):
            born -= dt.timedelta(days=1)
            while born.weekday() >= 5:
                born -= dt.timedelta(days=1)
        add(born, 0, hours(8.5, 15.5), "created")
    else:
        born = workday(first.sprint - 1, rnd.randint(1, 8))
        add(born, 0, hours(8.5, 17), "created")
    if item.points is not None and not item.subtask and first.mode != "create" and rnd.random() < .3:
        add(born, 1, hours(9, 16.5), "points", (None, item.points))            # estimated a little later, not when it was written
        item.points_first = None
    else:
        item.points_first = item.points
    for v in item.visits:
        if v.mode == "plan":
            if rnd.random() < .55:
                add(workday(v.sprint, 1), 2, hours(8.1, 8.9), "sprint in", v.sprint)
            else:
                add(workday(v.sprint - 1, rnd.choice((9, 10))), 2, hours(10, 15.3), "sprint in", v.sprint)
        elif v.mode == "carry":
            closed = times[v.sprint - 1]["complete"]
            add(closed.date(), 9, (0, 0), "sprint in", v.sprint, fixed=closed + dt.timedelta(milliseconds=rnd.randint(40, 900)))
            if v.dropped:
                add(workday(v.sprint, 1), 2, hours(8.2, 8.9), "sprint out", v.sprint)
        elif v.mode == "add":
            add(workday(v.sprint, v.day), 2, in_sprint(v.sprint, v.day, hours(9.25, 15), v.half), "sprint in", v.sprint)
        if v.out:
            add(workday(v.sprint, v.out), 7, in_sprint(v.sprint, v.out, hours(9.5, 16.5)), "sprint out", v.sprint)
        if v.back:
            add(workday(v.sprint, v.back), 2, in_sprint(v.sprint, v.back, hours(9.25, 15)), "sprint in", v.sprint)
    for sprint, day, new in item.changes:
        add(workday(sprint, day), 3, in_sprint(sprint, day, hours(9.2, 16.3)), "points", (points_at(item, sprint, day), new))
    for sprint, day, letter, half in item.moves:
        add(workday(sprint, day), 5, in_sprint(sprint, day, hours(8.7, 17.25), half), "status", letter)

    wanted = [w for _, w in sorted(enumerate(wanted), key=lambda x: (x[1][0], x[1][1], x[0]))]
    last_day, last = None, 0.0
    for n, (day, _, lo, hi, fixed, what, data) in enumerate(wanted):
        if fixed is not None:
            item.events.append((fixed, what, data))
            continue
        rest = [w for w in wanted[n + 1:] if w[0] == day and w[4] is None]
        lo = max(lo, last + GAP) if day == last_day else lo
        hi = min([hi] + [w[3] - GAP * (k + 1) for k, w in enumerate(rest)])
        assert lo <= hi, (item.kind, item.visits[0], day, what)
        last_day, last = day, rnd.uniform(lo, hi)
        item.events.append((at(day, last), what, data))
    assert item.events == sorted(item.events, key=lambda e: e[0]) and item.events[0][1] == "created"
    item.created = item.events[0][0]


def sprint_text(sprint: int, times: dict) -> str:
    """One entry of the sprint field, as the issue search gives it: a line of attributes."""
    t = times[sprint]
    done = stamp(t["complete"], agile=True) if t["complete"] else "<null>"
    return (f"Sprint[id={SPRINTS[sprint]},rapidViewId={BOARD},state={'CLOSED' if t['complete'] else 'ACTIVE'},name=Sprint {sprint},"
            f"startDate={stamp(t['start'], agile=True)},endDate={stamp(t['end'], agile=True)},completeDate={done},"
            f"activatedDate={stamp(t['activated'], agile=True)},sequence={SPRINTS[sprint]},goal=]")


def name_items(items: list[Item]) -> None:
    """A title and a priority for every issue, in the order of their keys."""
    pools = {name: list(titles) for name, titles in TITLES.items()}
    turn: dict[str, int] = {}
    named = set()
    for item in items:
        pool = item.kind if item.kind != "S" else next((name for name, key in FEATURES.items() if key == item.feature), "S")
        fixed = TITLE_OF.get(item.key)
        turn[item.kind] = turn.get(item.kind, 0) + 1
        if fixed:
            item.title, item.priority = fixed
            named.add(item.key)
        else:
            assert pools[pool], f"the pool {pool} has no title left for {item.key}"
            item.title, item.priority = pools[pool].pop(0), PRIORITIES[item.kind][turn[item.kind] % len(PRIORITIES[item.kind])]
    missing = {key for key in TITLE_OF if key.startswith("KES-")} - named
    assert not missing, f"TITLE_OF names issues that are not in the plan any more: {sorted(missing)}"


def to_json(item: Item, times: dict) -> dict:
    """The issue as the search answers it now, with its whole changelog."""
    status, points, inside, team = "T", item.points_first, [], item.team_from or (None if item.subtask else TEAM)
    histories = []
    number = lambda v: None if v is None else f"{v:g}"
    ids = lambda found: ", ".join(str(SPRINTS[s]) for s in found) or None
    names = lambda found: ", ".join(f"Sprint {s}" for s in found) or None
    if item.visits and item.visits[0].mode == "create":
        inside = [item.visits[0].sprint]                    # created right in the sprint: no changelog entry
    for when, what, data in item.events[1:]:
        if what == "status":
            entry = {"field": "status", "from": STATUS[status][0], "to": STATUS[data][0], "fromString": STATUS[status][1], "toString": STATUS[data][1]}
            assert status != data
            status = data
        elif what == "points":
            assert data[0] == points, (item.key, data, points)
            entry = {"field": "Story Points", "from": None, "to": None, "fromString": number(data[0]), "toString": number(data[1])}
            points = data[1]
        elif what == "team":
            entry = {"field": "Team", "from": TEAMS[team], "to": TEAMS[data], "fromString": team, "toString": data}
            team = data
        else:
            after = inside + [data] if what == "sprint in" else [s for s in inside if s != data]
            assert (data in inside) == (what == "sprint out"), (item.key, what, data, inside)
            entry = {"field": "Sprint", "from": ids(inside), "to": ids(after), "fromString": names(inside), "toString": names(after)}
            inside = after
        histories.append({"created": stamp(when), "items": [entry]})
    return {"key": item.key,
            "fields": {"summary": item.title, "issuetype": {"name": KINDS[item.kind], "subtask": item.subtask}, "priority": {"name": item.priority},
                       "created": stamp(item.created), "updated": stamp(item.events[-1][0]),
                       "status": {"id": STATUS[status][0], "name": STATUS[status][1]},
                       SPRINT_FIELD: [sprint_text(s, times) for s in inside] or None, POINTS_FIELD: points,
                       TEAM_FIELD: {"id": TEAMS[team], "value": team} if team else None, FEATURE_FIELD: item.feature},
            "changelog": {"histories": histories}}


def backlog_items(rnd: random.Random) -> list[Item]:
    out = []
    at_about = lambda day, seconds: at(workday(RUNNING, day), seconds + rnd.uniform(0, 59.999))
    for kind, points, feature, (day, seconds), then in BACKLOG:
        item = Item(kind, points, [], FEATURES.get(feature), [], [])
        item.points_first = points
        item.events.append((at_about(day, seconds), "created", None))
        for what, value, day, seconds in then:
            moment = at_about(day, seconds)
            if what == "team":
                item.team_from = value
                item.events.append((moment, "team", TEAM))
            else:
                item.events.append((moment, "points", (points, value)))
        item.created = item.events[0][0]
        out.append(item)
    return out


def mention(rnd: random.Random, key: str, kind: str, team: str, points, created: int, moves: tuple) -> dict:
    """An issue of another team: it is in the data only because one of its comments names the team."""
    back = lambda days, seconds: at(NOW.date() - dt.timedelta(days=days), seconds + rnd.uniform(0, 59.999))
    born = back(created, 10 * 3600 + 17 * 60)
    while born.weekday() >= 5:
        born -= dt.timedelta(days=1)
    status, histories = "T", []
    for letter, days, seconds in moves:
        histories.append({"created": stamp(back(days, seconds)), "items": [
            {"field": "status", "from": STATUS[status][0], "to": STATUS[letter][0], "fromString": STATUS[status][1], "toString": STATUS[letter][1]}]})
        status = letter
    return {"key": key,
            "fields": {"summary": TITLE_OF[key][0], "issuetype": {"name": KINDS[kind], "subtask": False}, "priority": {"name": TITLE_OF[key][1]},
                       "created": stamp(born), "updated": histories[-1]["created"],
                       "status": {"id": STATUS[status][0], "name": STATUS[status][1]}, SPRINT_FIELD: None, POINTS_FIELD: points,
                       TEAM_FIELD: {"id": TEAMS[team], "value": team}, FEATURE_FIELD: None},
            "changelog": {"histories": histories}}


def build() -> dict[str, object]:
    """Every file of the folder, by its path."""
    rnd = random.Random(SEED)
    times = sprint_times(rnd)
    planned = parse_plan()
    for item in planned:
        schedule(item, times, rnd)
    items = planned + backlog_items(rnd)
    number = FIRST_KEY
    for item in sorted(items, key=lambda i: i.created):       # keys in the order the issues were written
        item.key = f"KES-{number}"
        number += rnd.choice((1, 1, 2, 2, 3, 4))
    items.sort(key=lambda i: int(i.key.split("-")[1]))
    name_items(items)
    raw = {item.key: to_json(item, times) for item in items}
    expected = count_plan(planned)

    files: dict[str, object] = {
        "manifest.json": {"tool": "sightline demo data 1.0", "host": "jira.example.com", "fetched_at": NOW.replace(tzinfo=None).isoformat(timespec="seconds"),
                          "synthetic": True, "note": "Invented by tools/make_demo_data.py. No real team, product, issue or person."},
        "server.json": {"serverTime": stamp(NOW + dt.timedelta(seconds=3.512))},
        f"board-{BOARD}/configuration.json": {
            "id": BOARD, "name": "Kestrel board", "type": "scrum", "filter": {"id": FILTER},
            "columnConfig": {"columns": [{"name": name, "statuses": [{"id": sid}]} for sid, name in STATUS.values()], "constraintType": "none"}},
        f"board-{BOARD}/sprints.json": [
            {"id": SPRINTS[n], "state": "closed" if t["complete"] else "active", "name": f"Sprint {n}", "startDate": stamp(t["start"], agile=True),
             "endDate": stamp(t["end"], agile=True), **({"completeDate": stamp(t["complete"], agile=True)} if t["complete"] else {}),
             "activatedDate": stamp(t["activated"], agile=True), "originBoardId": BOARD, "goal": ""} for n, t in times.items()],
        f"board-{BOARD}/velocity.json": {"velocityStatEntries": {
            str(SPRINTS[n]): {"estimated": {"value": expected[str(SPRINTS[n])]["committed_sp"]}, "completed": {"value": expected[str(SPRINTS[n])]["completed_sp"]}}
            for n in SPRINTS if n != RUNNING}},
        "expected.json": expected,
    }
    for sid in SPRINTS.values():
        files[f"board-{BOARD}/sprint-{sid}-issues.json"] = [raw[i.key] for i in items if f"[id={sid}," in "".join(raw[i.key]["fields"][SPRINT_FIELD] or [])]
        gone = expected[str(sid)]["removed"]        # the sprint no longer lists what was taken out of it: read by key
        if gone:
            files[f"board-{BOARD}/sprint-{sid}-removed.json"] = [raw[key] for key in gone]
    lately = NOW - dt.timedelta(days=3)
    files["jql-inbox.json"] = {"jql": f"filter = {FILTER} AND updated >= -3d",
                               "issues": [raw[i.key] for i in items if i.events[-1][0] >= lately]}
    files["jql-mentions.json"] = {"jql": f'comment ~ "\\"{TEAM}\\"" AND updated >= -3d AND filter != {FILTER}', "issues": [mention(rnd, *m) for m in MENTIONS]}
    return files


def write(target: Path = OUT) -> Path:
    files = build()
    shutil.rmtree(target / f"board-{BOARD}", ignore_errors=True)        # other files of the folder are not this tool's
    for name, data in files.items():
        path = target / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((json.dumps(data, ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
    return target


if __name__ == "__main__":
    print("Wrote", write())
