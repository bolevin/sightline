"""What the sprint will probably finish, from the team's own history.

Two views, both as facts for the Today page:

- the forecast of the running sprint: story points that reached "done" on each past working day are drawn at
  random for every working day that is left, many times over (Monte Carlo). "85 % sure, at least X" is the value
  that 85 % of those runs reach;
- the outside view for planning: what the team's past sprints actually completed, next to what was committed now.

The draw is seeded with the sprint id, so the same data always gives the same forecast.

How far it may be trusted is measured, not assumed: `look_back` replays the forecast inside past sprints and
compares it with what they completed, and the page shows how often each line held.

Limits: every day is drawn independently, so a team that closes most of its work in the last days of a sprint
gets a forecast that is too low; and with little history the 85 % line fails more often, hence the warning on
`forecast.history_days`.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import random
from typing import Callable

from .facts import Issue, Run
from .sprint_scope import sprint_scope
from .today import Fact, status_names, workdays

RUNS = 5000
SHORT_HISTORY = 20          # working days; below this the forecast is marked as weak
DAY = dt.timedelta(days=1)


def percentile(values: list[float], q: float) -> float:
    """The q-quantile (0..1) with linear interpolation; 0.0 for an empty list."""
    v = sorted(values)
    if not v:
        return 0.0
    k = (len(v) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def reached_by(values: list[float], share: float) -> float:
    """The highest value that at least `share` (0..1) of the values reach: no interpolation, so the sentence
    "85 % of them reached X" is true of the X given. 0.0 for an empty list."""
    v = sorted(values)
    return v[len(v) - math.ceil(share * len(v) - 1e-9)] if v else 0.0


def simulate(daily: list[float], days_left: int, runs: int = RUNS, seed: int = 0) -> list[float]:
    """Totals of `days_left` days, each day drawn from the history `daily`; sorted, one value per run."""
    if not daily or days_left <= 0:
        return [0.0]
    rnd = random.Random(seed)
    return sorted(sum(rnd.choice(daily) for _ in range(days_left)) for _ in range(runs))


def at_least(totals: list[float], confidence: float) -> float:
    """The total that this share of the runs reaches or exceeds."""
    return percentile(totals, 1 - confidence)


def chance(totals: list[float], target: float) -> float:
    """Share of the runs (0..1) that reach the target."""
    return sum(1 for t in totals if t >= target - 1e-9) / len(totals)


def _workday_on_or_after(d: dt.date) -> dt.date:
    while d.weekday() >= 5:
        d += DAY
    return d


def _workday_before(d: dt.date) -> dt.date:
    d -= DAY
    while d.weekday() >= 5:
        d -= DAY
    return d


def sampled_sprints(run: Run, board: int) -> list:
    """The board's own sprints whose issues are in the run, oldest first."""
    b = run.boards[board]
    own = [s for s in b.sprints.values() if s.board == board and run.sampled(board, s.id)]
    return sorted(own, key=lambda s: s.activated or s.start)


def daily_history(run: Run, board: int, last: dt.date, on_board: Callable[[Issue], bool] | None = None,
                  at: dt.datetime | None = None) -> dict[dt.date, float]:
    """Story points the board's sprints completed on each working day, from the start of the oldest sampled sprint
    to `last`; days with nothing are 0. Only work completed as part of a sprint counts, with the points Jira's
    sprint report counts, on the day the issue came into "done". A weekend counts for the Monday after.
    `at`: only what was known at this moment (for a look back)."""
    sprints = sampled_sprints(run, board)
    if not sprints:
        return {}
    done = run.boards[board].done_statuses
    days: dict[dt.date, float] = {}
    d = (sprints[0].activated or sprints[0].start).date()
    while d <= last:
        if d.weekday() < 5:
            days[d] = 0.0
        d += DAY
    for s in sprints:
        if at is not None and (s.activated or s.start) > at:
            continue
        sc = sprint_scope(run, board, s.id, on_board, at)
        for key in sc.completed:
            t = run.issues[key].done_from(done, sc.end) or sc.end
            day = _workday_on_or_after(min(max(t, sc.start), sc.end).date())
            if day in days:
                days[day] += sc.points_end.get(key) or 0
    return days


def past_sprints(run: Run, board: int, but: int) -> list[tuple]:
    """(sprint, story points committed, story points completed) of each closed sprint of the board in the saved
    velocity chart, oldest first, without `but`."""
    path = run.folder / f"board-{board}" / "velocity.json"
    if not path.exists():
        return []
    entries = json.loads(path.read_text(encoding="utf-8")).get("velocityStatEntries", {})
    b = run.boards[board]
    out = []
    for sid, e in entries.items():
        s = b.sprints.get(int(sid))
        if s and s.board == board and s.id != but:        # the chart also lists sprints of other boards
            out.append((s, float((e.get("estimated") or {}).get("value") or 0), float((e.get("completed") or {}).get("value") or 0)))
    return sorted(out, key=lambda x: (x[0].activated or x[0].start or dt.datetime.min.replace(tzinfo=dt.timezone.utc), x[0].id))


def past_sprints_done(run: Run, board: int, but: int) -> list[float]:
    """Story points each closed sprint of the board completed, from the saved velocity chart (without `but`)."""
    return [completed for _, _, completed in past_sprints(run, board, but)]


def sprint_forecast(run: Run, board: int, sprint: int, now: dt.datetime | None = None,
                    on_board: Callable[[Issue], bool] | None = None, runs: int = RUNS) -> dict:
    """The forecast of one sprint as it stood at `now`: history_days, days_left, done, open, open_keys and, if
    there is any history, p85 and p50 (story points done by the end, at least) and chance_all (0..1)."""
    now = now or run.fetched
    s = run.boards[board].sprints[sprint]
    sc = sprint_scope(run, board, sprint, on_board, now)
    daily = list(daily_history(run, board, _workday_before(now.date()), on_board, now).values())
    left = workdays(now.date() + DAY, s.end.date()) if s.end else 0
    done, open_sp = sc.points(sc.completed), sc.points(sc.not_completed)
    out = {"history_days": len(daily), "days_left": left, "done": done, "open": open_sp,
           "open_keys": tuple(sorted(sc.not_completed)), "committed": sc.velocity_committed,
           "blind": tuple(sorted(k for k in sc.not_completed if not sc.points_end.get(k)))}
    if daily:
        totals = simulate(daily, left, runs, seed=sprint)
        out.update(p85=done + at_least(totals, .85), p50=done + at_least(totals, .5), chance_all=chance(totals, open_sp), totals=totals)
    return out


FITS = 85                   # per cent: from this chance on the sprint is taken to fit and no option is offered


def candidates(run: Run, board: int, sprint: int, now: dt.datetime, on_board: Callable[[Issue], bool] | None = None) -> list[tuple]:
    """Open work that could move out of the sprint with the least loss: (name, what it is, the move in words,
    issue keys, points).
    Not started: in a status where work waits (Board.waiting). Blocked: in the status Blocked. Which of it moves is for
    the team and the product owner to decide; the app only says what each move would do to the forecast."""
    b = run.boards[board]
    sc = sprint_scope(run, board, sprint, on_board, now)
    names = status_names(run)
    waiting = b.waiting
    unstarted = tuple(k for k in sorted(sc.not_completed) if run.issues[k].status_at(now) in waiting)
    blocked = tuple(k for k in sorted(sc.not_completed) if names.get(run.issues[k].status_at(now), "").lower() == "blocked")
    both = tuple(sorted(set(unstarted) | set(blocked)))
    found = [("unstarted", "open work that has not started", "what has not started moves out", unstarted),
             ("blocked", "open work that is blocked", "what is blocked moves out", blocked)]
    if unstarted and blocked and both not in (unstarted, blocked):
        found.append(("both", "open work that has not started or is blocked", "both move out", both))
    return [(name, what, move, keys, sc.points(keys)) for name, what, move, keys in found if keys]


LOOK_BACK_AT = (1 / 3, 1 / 2, 2 / 3)        # how far into a past sprint the forecast is replayed


def look_back(run: Run, board: int, on_board: Callable[[Issue], bool] | None = None, runs: int = RUNS) -> list[dict]:
    """Replay the forecast inside the board's closed sprints and compare it with what they completed.
    One entry per sprint and moment that had at least SHORT_HISTORY days of history: sprint, share, p85, p50,
    actual. This is how the page can say how far the forecast may be trusted."""
    out = []
    for s in sampled_sprints(run, board):
        if s.state != "closed":
            continue
        final = sprint_scope(run, board, s.id, on_board)
        actual = final.points(final.completed)
        for share in LOOK_BACK_AT:
            f = sprint_forecast(run, board, s.id, final.start + (final.end - final.start) * share, on_board, runs)
            if f["history_days"] >= SHORT_HISTORY:
                out.append({"sprint": s.id, "share": share, "history_days": f["history_days"], "p85": f["p85"], "p50": f["p50"],
                            "actual": actual})
    return out


def forecast_facts(run: Run, board: int, sprint: int, now: dt.datetime | None = None,
                   on_board: Callable[[Issue], bool] | None = None, runs: int = RUNS) -> list[Fact]:
    out: list[Fact] = []
    add = lambda *a, **k: out.append(Fact(*a, **k))

    # the running sprint. A closed sprint has nothing to forecast. A day with no working day after it (the last
    # day, a sprint past its end, a sprint without an end) has nothing to draw: the forecast would say that nothing
    # more gets done. And work without story points is invisible to it: said as a fact, and no chance is given when
    # nothing of the open work is estimated.
    f = sprint_forecast(run, board, sprint, now, on_board, runs)
    this = run.boards[board].sprints[sprint]
    running = this.state != "future" and not (this.complete and (now or run.fetched) >= this.complete)       # also a look into a past sprint
    if running:
        add("forecast.history_days", "promises", "working days of history behind the forecast", f["history_days"], "days", (),
            "warning" if f["history_days"] < SHORT_HISTORY else "info")
        add("forecast.days_left", "promises", "working days left after today", f["days_left"], "days")
        if f["blind"]:
            add("forecast.blind_n", "promises", "open items without story points, which the forecast does not see", len(f["blind"]), "",
                f["blind"], "warning")
    if running and "p85" in f and f["days_left"] > 0:
        p_all = round(100 * f["chance_all"])
        add("forecast.p85_done_sp", "promises", "done by the end of the sprint, 85 % sure, at least", round(f["p85"], 1), "SP")
        add("forecast.p50_done_sp", "promises", "done by the end of the sprint, as likely as not, at least", round(f["p50"], 1), "SP")
    if running and "p85" in f and f["days_left"] > 0 and f["open"] > 0:
        add("forecast.chance_all_pct", "promises", "chance to finish everything that is open", p_all, "%", f["open_keys"],
            "critical" if p_all < 15 else "warning" if p_all < 50 else "ok" if p_all >= 85 else "info")
        if p_all < FITS:        # the sprint does not fit: how much would have to move, and what the obvious moves would do
            totals, open_sp = f["totals"], f["open"]
            level = "critical" if p_all < 15 else "warning" if p_all < 50 else "info"
            add("plan.over_50_sp", "promises", "open work that has to move out for an even chance to finish the rest",
                round(max(0.0, open_sp - at_least(totals, .5)), 1), "SP", (), level)
            add("plan.over_85_sp", "promises", "open work that has to move out to be 85 % sure of the rest",
                round(max(0.0, open_sp - at_least(totals, .85)), 1), "SP")
            for name, what, move, keys, points in candidates(run, board, sprint, now or run.fetched, on_board):
                add(f"option.{name}_sp", "promises", what, round(points, 1), "SP", keys)
                add(f"option.{name}_chance_pct", "promises", f"chance to finish the rest if {move}",
                    round(100 * chance(totals, open_sp - points)), "%", keys)
    back = look_back(run, board, on_board, runs)
    if back:
        held = sum(1 for x in back if x["actual"] >= x["p85"] - 1e-9)
        add("forecast.lookbacks_held", "promises", "look-backs into past sprints where the 85 % line held", held, f"of {len(back)}",
            (), "warning" if held < .7 * len(back) else "info")

    # the outside view: what past sprints completed, next to what was committed now
    past = past_sprints_done(run, board, but=sprint)
    if past:
        committed = round(f["committed"], 1)
        reached = sum(1 for v in past if v >= committed - 1e-9)
        add("plan.past_sprints", "promises", "past sprints behind the outside view", len(past))
        add("plan.usual_p50_sp", "promises", "half of the past sprints completed at least", round(percentile(past, .5), 1), "SP")
        add("plan.usual_p85_sp", "promises", "85 % of the past sprints completed at least", round(reached_by(past, .85), 1), "SP")
        add("plan.sprints_reaching_commitment", "promises", f"past sprints that completed {committed:g} SP or more", reached,
            f"of {len(past)}", (), "critical" if reached == 0 and len(past) >= 3 else "warning" if reached < len(past) / 2 else "info")
    return out
