"""Drafts for the Inbox, and the record of what the user sent.

The app writes to no other system. What it can do is prepare a text: the sprint status for the team's page, a
message when the sprint does not fit, the points for the Daily. Code composes these from the facts, so every number
and issue key in a draft is one the page shows too; an agent may word them later, under the same check as the
Today page. The user edits a draft, copies it and sends it; "I sent it" keeps a copy in var/outbox.jsonl
on this computer, as the user's own record. Nothing of it reaches an agent.
"""
from __future__ import annotations

import json
from pathlib import Path

from .forecast import percentile
from .journal import lines
from .sprint_scope import sprint_scope
from .today import BUG_TYPES, Fact
from .views import cycle_times

FILE = Path("var") / "outbox.jsonl"
MAX_TEXT = 20000
KEEP_SHOWN = 20
KEYS_SHOWN = 12


class DraftError(Exception):
    """What was asked cannot be kept. The text is for the user."""


def _keys(keys) -> str:
    keys = list(keys)
    return ", ".join(keys[:KEYS_SHOWN]) + (" and more" if len(keys) > KEYS_SHOWN else "")      # no count: it would be a number that is no fact


def review_facts(data, record=()) -> tuple:
    """The last closed sprint the data holds and what it delivered: (sprint, facts), or (None, []).
    These facts are for the review drafts only: they are about another sprint than the Today page shows."""
    run, board = data.run, data.board
    closed = [s for s in run.boards[board].sprints.values() if s.board == board and s.state == "closed" and run.sampled(board, s.id)]
    if not closed:
        return None, []
    sprint = max(closed, key=lambda s: (s.complete or s.end or s.start, s.id))
    sc = sprint_scope(run, board, sprint.id, data.on_board)
    points = lambda keys, at_end=True: round(sc.points(keys, at_end), 1)
    took = {c["key"]: c["days"] for c in cycle_times(run, board, data.on_board) if c["key"] in sc.completed}
    fact = lambda name, label, value, unit="", keys=(): Fact(f"review.{name}", "promises", label, value, unit, tuple(sorted(keys)))
    out = [fact("committed_sp", "committed at the start", points(sc.committed, False), "SP", sc.committed),
           fact("done_sp", "completed", points(sc.completed), "SP", sc.completed), fact("done_n", "items completed", len(sc.completed), "", sc.completed),
           fact("not_done_n", "items not finished", len(sc.not_completed), "", sc.not_completed), fact("not_done_sp", "not finished", points(sc.not_completed), "SP", sc.not_completed),
           fact("added_n", "items that came in after the start", len(sc.added), "", sc.added),
           fact("added_sp", "came in after the start", round(sum(sc.points_start.get(k) or 0 for k in sc.added), 1), "SP", sc.added),
           fact("removed_n", "items taken out", len(sc.removed), "", sc.removed),
           fact("bugs_done_n", "bugs and incidents completed", sum(1 for k in sc.completed if run.issues[k].type in BUG_TYPES))]
    if took:
        out.append(fact("cycle_days", "half of the completed items took at most", round(percentile(list(took.values()), .5), 1), "days"))
        out += [fact(f"item.{key}.days", f"{key} from start to done", days, "days", (key,)) for key, days in sorted(took.items(), key=lambda x: (-x[1], x[0]))[:3]]
    said = [e for e in record if e.get("sprint") == sprint.id and e.get("held_85") is not None]
    if said:
        out.append(fact("forecasts_held", "forecasts recorded during the sprint whose 85 % line held", sum(1 for e in said if e["held_85"]), f"of {len(said)}"))
    return sprint, out


def _review(data, record) -> list[dict]:
    """Two drafts about the last closed sprint: what it delivered, and what the data suggests asking in the retrospective."""
    sprint, facts = review_facts(data, record)
    if sprint is None:
        return []
    fact = {f.id: f for f in facts}
    used: list[str] = []

    def v(name: str):
        used.append(f"review.{name}")
        value = fact[f"review.{name}"].value
        return f"{value:g}" if isinstance(value, float) else value

    def keys(name: str) -> str:
        used.append(f"review.{name}")
        return _keys(fact[f"review.{name}"].keys)

    has = lambda name: f"review.{name}" in fact
    items = lambda name: f"{v(name)} item" + ("" if fact[f"review.{name}"].value == 1 else "s")
    done, committed = fact["review.done_sp"].value, fact["review.committed_sp"].value
    lines = [f"Sprint Review · {sprint.name}", "", "What we promised and what we delivered",
             f"- Committed at the start: {v('committed_sp')} SP. Completed: {v('done_sp')} SP in {items('done_n')}."]
    if fact["review.not_done_n"].value:
        lines.append(f"- Not finished: {items('not_done_n')} ({v('not_done_sp')} SP): {keys('not_done_n')}.")
    if fact["review.added_n"].value:
        lines.append(f"- Came in after the start: {items('added_n')} ({v('added_sp')} SP).")
    if fact["review.removed_n"].value:
        lines.append(f"- Taken out: {items('removed_n')}: {keys('removed_n')}.")
    lines += ["", "How it went", f"- Bugs and incidents completed: {v('bugs_done_n')}."]
    if has("cycle_days"):
        lines.append(f"- Half of the completed items took at most {v('cycle_days')} days from their start to done.")
    if has("forecasts_held"):
        lines.append(f"- The 85 % line of the forecasts made during the sprint held {v('forecasts_held')} {fact['review.forecasts_held'].unit} times.")
    out = [{"id": "review", "title": "Sprint Review: what the last sprint delivered", "to": "the Sprint Review", "text": "\n".join(lines), "facts": sorted(set(used))}]

    used = []
    lines = [f"Retrospective · {sprint.name} · what the data suggests asking", ""]
    if done < committed:
        lines.append(f"- We completed {v('done_sp')} SP of {v('committed_sp')} SP committed at the start. Where did the time go?")
    elif fact["review.added_n"].value:
        lines.append(f"- We completed {v('done_sp')} SP against {v('committed_sp')} SP committed at the start, and {items('added_n')} came in later. Was the commitment the real plan?")
    if fact["review.added_n"].value:
        lines.append(f"- {items('added_n')} ({v('added_sp')} SP) came in after the start. What made them urgent, and what did they push out?")
    if fact["review.not_done_n"].value:
        lines.append(f"- {items('not_done_n')} not finished: {keys('not_done_n')}. What do they have in common?")
    if fact["review.removed_n"].value:
        lines.append(f"- {items('removed_n')} taken out again: {keys('removed_n')}. What brought them into the sprint?")
    slow = [f for f in facts if f.id.startswith("review.item.")]
    if slow:
        used += [f.id for f in slow]
        lines.append("- Slowest from start to done: " + "; ".join(f"{f.keys[0]}, {f.value:g} days" for f in slow) + ". What held them up?")
    if len(lines) == 2:
        lines.append("- The sprint went as planned: nothing in the data asks for a question.")
    out.append({"id": "retro", "title": "Questions for the retrospective", "to": "the team, in the retrospective", "text": "\n".join(lines), "facts": sorted(set(used))})
    return out


def build(data, register: dict, record=()) -> list[dict]:
    """The drafts that make sense now: [{"id", "title", "to", "text", "facts"}]. `facts` are the ids behind the text.
    `record`: the settled entries of the forecast record (journal.py), when the data comes with one."""
    fact = {f.id: f for f in data.facts}
    used: list[str] = []

    def v(fact_id: str):
        used.append(fact_id)
        value = fact[fact_id].value
        return f"{value:g}" if isinstance(value, float) else value

    def keys(fact_id: str) -> str:
        used.append(fact_id)
        return _keys(fact[fact_id].keys)

    has = lambda *ids: all(i in fact for i in ids)
    items = lambda fact_id: f"{v(fact_id)} item" + ("" if fact[fact_id].value == 1 else "s")
    b = data.run.boards[data.board]
    sprint = b.sprints[data.sprint].name
    stuck = sorted((f for f in data.facts if f.id.startswith("item.") and f.id.endswith(".days_in_status")), key=lambda f: -f.value)
    out = []

    # the sprint status, for the team's page
    lines = [f"Sprint status · {sprint} · day {v('sprint.day')} {fact['sprint.day'].unit}", "",
             "Promise", f"- Committed at the start: {v('sprint.committed_sp')} SP. Done: {v('sprint.done_sp')} SP. Not done yet: {v('sprint.open_sp')} SP in {items('sprint.open_n')}."]
    if has("forecast.p85_done_sp", "forecast.chance_all_pct"):
        lines.append(f"- Forecast from the team's own history: 85 % sure of at least {v('forecast.p85_done_sp')} SP by the end; chance to finish everything: {v('forecast.chance_all_pct')} %.")
    if has("plan.over_50_sp") and fact["plan.over_50_sp"].value:
        lines.append(f"- For an even chance to finish the rest, {v('plan.over_50_sp')} SP have to move out.")
    lines += ["", "Scope"]
    lines.append(f"- Came in after the start: {items('sprint.added_n')} ({v('sprint.added_sp')} SP): {keys('sprint.added_n')}." if has("sprint.added_n", "sprint.added_sp")
                 else "- Nothing came in after the start.")
    if has("sprint.removed_n"):
        lines.append(f"- Taken out: {items('sprint.removed_n')}: {keys('sprint.removed_n')}.")
    lines += ["", "Blocked and stuck"]
    lines.append(f"- Blocked: {items('backlog.blocked_n')} ({v('backlog.blocked_sp')} SP): {keys('backlog.blocked_n')}." if has("backlog.blocked_n", "backlog.blocked_sp")
                 else "- Nothing is blocked.")
    for f in [f for f in stuck if f.level == "warning"][:3]:      # stuck, not merely the oldest of what is in progress
        lines.append(f"- {f.label}: {v(f.id)} days.")
    if has("backlog.carried_n"):
        lines.append(f"- Carried from sprint to sprint: {items('backlog.carried_n')}: {keys('backlog.carried_n')}.")
    lines += ["", "Bugs", f"- New for the team in the last day: {v('notice.new_bugs_n')}. Open bugs and incidents in the sprint: {v('notice.open_bugs_n')}."]
    if has("code.open_n"):
        lines += ["", "Pull requests", f"- Open: {v('code.open_n')}." + (f" Waiting a day or more for a first review: {v('code.waiting_review_n')}." if has("code.waiting_review_n") else "")]
    if has("risks.open_n") or has("risks.candidates_n"):
        lines += ["", "Risks", "- " + " ".join(part for part in (
            f"Open in the register: {v('risks.open_n')}." if has("risks.open_n") else "",
            f"Not decided yet: {v('risks.undecided_n')}." if has("risks.undecided_n") else "",
            f"Reviews that are due: {v('risks.review_due_n')}." if has("risks.review_due_n") else "",
            f"Signals not in the register yet: {v('risks.candidates_n')}." if has("risks.candidates_n") else "") if part)]
    out.append({"id": "status", "title": "Sprint status", "to": "the team's sprint status page", "text": "\n".join(lines), "facts": sorted(set(used))})

    # a decision is waiting: the sprint does not fit
    if has("plan.over_50_sp", "plan.over_85_sp", "forecast.chance_all_pct") and fact["forecast.chance_all_pct"].value < 50:
        used = []
        lines = [f"Subject: {sprint} does not fit, a decision is needed", "",
                 f"On day {v('sprint.day')} {fact['sprint.day'].unit} the sprint has {v('sprint.open_sp')} SP open and {v('sprint.done_sp')} SP done. "
                 f"Going by what the team finished per day in its last sprints, the chance to finish everything is {v('forecast.chance_all_pct')} %.",
                 f"For an even chance, {v('plan.over_50_sp')} SP have to move out; to be 85 % sure of the rest, {v('plan.over_85_sp')} SP.", "", "What moving would do:"]
        for name, what in (("unstarted", "what has not started"), ("blocked", "what is blocked"), ("both", "both")):
            if has(f"option.{name}_sp", f"option.{name}_chance_pct"):
                lines.append(f"- Move out {what} ({v(f'option.{name}_sp')} SP: {keys(f'option.{name}_sp')}): the chance for the rest becomes {v(f'option.{name}_chance_pct')} %.")
        lines += ["", "Which of these matter most to you, and what can wait for the next sprint? I would like to decide by [when]."]
        out.append({"id": "decision", "title": "The sprint does not fit: ask for a decision", "to": "the product owner (chat or mail)", "text": "\n".join(lines), "facts": sorted(set(used))})

    # the points for the Daily
    used = []
    lines = [f"Daily · {sprint} · day {v('sprint.day')} {fact['sprint.day'].unit}", ""]
    if has("backlog.blocked_n"):
        lines.append(f"- Blocked ({v('backlog.blocked_n')}): {keys('backlog.blocked_n')}. Who can unblock each one, and by when?")
    for f in stuck[:3]:
        if f.level == "warning":
            lines.append(f"- {f.label} for {v(f.id)} days. What is in the way?")
    if has("code.waiting_review_n"):
        lines.append(f"- Pull requests waiting a day or more for a first review: {v('code.waiting_review_n')} ({keys('code.waiting_review_n')}). Who takes them today?")
    if has("code.no_pr_n"):
        lines.append(f"- In progress in Jira without a pull request: {v('code.no_pr_n')} ({keys('code.no_pr_n')}). Has the work started?")
    if has("notice.new_bugs_n") and fact["notice.new_bugs_n"].value:
        lines.append(f"- New bugs for the team: {v('notice.new_bugs_n')} ({keys('notice.new_bugs_n')}). Do they go into this sprint?")
    if has("sprint.added_n"):
        lines.append(f"- Came in after the start: {v('sprint.added_n')} items. What do they push out?")
    due = [r for r in register.get("risks", []) if r.get("review_due")]
    if due:
        lines.append("- Risks to look at again today: " + "; ".join(r["title"] for r in due[:5]) + ".")
    if len(lines) == 2:
        lines.append("- Nothing stands out in the data today.")
    out.append({"id": "daily", "title": "Points for the Daily", "to": "the team, in the Daily", "text": "\n".join(lines), "facts": sorted(set(used))})
    return out + _review(data, record)


def sent(root: Path) -> list[dict]:
    """What the user marked as sent, newest first."""
    return lines(root / FILE)[::-1][:KEEP_SHOWN]


def record(root: Path, data, kind: str, text: str, known: list[dict]) -> None:
    """Keep what the user marks as sent. Raises DraftError."""
    draft = next((d for d in known if d["id"] == kind), None)
    if draft is None:
        raise DraftError(f"No draft {kind!r}")
    if not isinstance(text, str) or not text.strip():
        raise DraftError("There is nothing to keep: the text is empty")
    if len(text) > MAX_TEXT:
        raise DraftError(f"The text is longer than {MAX_TEXT} characters")
    entry = {"at": data.run.fetched.isoformat(timespec="minutes"), "kind": kind, "title": draft["title"], "to": draft["to"],
             "sprint": data.run.boards[data.board].sprints[data.sprint].name, "text": text.strip()}
    path = root / FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
