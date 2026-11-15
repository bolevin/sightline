"""The Today page as data, the layout by rules, and the check of an agent's reply.

The briefing agent returns the page as JSON: cards with rows, and every row cites the facts it rests on.

    {"headline": {"text": "...", "facts": ["sprint.day", "sprint.done_sp"]},
     "cards": [{"id": "promises", "note": "...",
                "rows": [{"facts": ["sprint.done_sp", "sprint.committed_sp"], "level": "warning", "text": "..."}]}]}

`check_page` keeps a row only if every number and every issue key in its text is found in the facts it cites: the
agent chooses and words, it never computes. A number must be the value of a cited fact or stand in its unit
("of 13"); a number of a fact's label ("the last 24 hours", "85 % sure") may be repeated only as that phrase, so
"24 bugs" does not pass on its strength. A share in words ("half", "a quarter") is dropped, since it is the agent's
own arithmetic, and "no" or "nothing" needs a cited fact that is zero. If a share is wanted on the page, code adds
it as a fact. Whatever fails is replaced by the layout by rules, so the page is never empty and never shows an
unchecked number. The check does not understand a sentence: two numbers of one line swapped would pass.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

from .today import LEVELS, Fact

CARDS = ("promises", "risks", "operations")
MAX_ROWS, MAX_TEXT, MAX_NOTE, MAX_HEADLINE = 5, 160, 240, 400
# An issue key, KES-123. Not the name of a programme increment or of a sprint, which can look alike: PI2026-12, PI2026-12.3, PI_2026-09.
ISSUE_KEY = re.compile(r"\b(?!PI_?\d{4}-)[A-Z][A-Z0-9_]+-\d+\b(?!\.\d)")
_KEY_ANY_CASE = re.compile(ISSUE_KEY.pattern, re.I)                 # "kes-123" names an issue too
_LABEL_NUMBER = re.compile(r"(\d+(?:[.,]\d+)?)\s?(%|[A-Za-z]+)?")
_SHARE = re.compile(r"\b(half|halves|quarters?|percent|per cent|majority|most of|twice|doubled?|(?:thirds|fifths|tenths)|a (?:third|fifth|tenth) of)\b", re.I)
_ZERO = re.compile(r"\b(no|none|nothing|nobody|zero)\b", re.I)
MAX_PROBLEM, MAX_PROBLEMS = 200, 20
MAX_LINES = 12              # lines of findings on a tab
_WORD_WITH_DIGITS = re.compile(r"\b[A-Za-z_][\w-]*\d[\w.-]*")      # P85, PI2026-12.3, sm_1: names, not numbers
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def _numbers(text: str) -> set[float]:
    return {float(n.replace(",", ".")) for n in _NUMBER.findall(text)}


def stated_numbers(text: str) -> set[float]:
    """Numbers an agent states in a text, without issue keys and names such as P85 or PI2026-12."""
    return _numbers(_WORD_WITH_DIGITS.sub(" ", ISSUE_KEY.sub(" ", text)))


def known_numbers(fact: Fact) -> set[float]:
    """Every number a fact carries: its value, its unit ("of 15") and its label."""
    return own_numbers(fact) | _numbers(fact.label)


def own_numbers(fact: Fact) -> set[float]:
    """The numbers a fact states: its value and its unit ("of 15")."""
    value = f"{fact.value:g}" if isinstance(fact.value, float) else "" if fact.value is None else str(fact.value)
    return _numbers(f"{value} {fact.unit}")


def label_phrases(fact: Fact) -> list:
    """The numbers in a fact's label, each with the word after it: "24 hours", "85 %", "3rd", "29 SP". They belong to
    the wording of the fact, not to what it counts. The digits of an issue key in a label are no number at all."""
    out = []
    for number, word in _LABEL_NUMBER.findall(ISSUE_KEY.sub(" ", fact.label)):
        out.append(re.compile(r"(?<![\w.,])" + re.escape(number) + (r"\s*" + re.escape(word) if word else "") + r"(?!\w)", re.I))
    return out


def parse_reply(text: str):
    """The JSON of an agent's reply, or None. A code fence around it is tolerated, text around it is not."""
    text = text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, re.S)
    try:
        return json.loads(fenced.group(1) if fenced else text)
    except (ValueError, RecursionError):
        return None


def _cited(part: dict) -> list:
    ids = part.get("facts", part.get("fact"))
    return [ids] if isinstance(ids, str) else ids if isinstance(ids, list) else []


def _problem(text, ids: list, by_id: dict[str, Fact], limit: int, composed: dict[str, str] | None = None, names: tuple = ()) -> str | None:
    """Why this text may not be shown, or None if every number and key in it is backed by the cited facts.
    `composed`: what each fact said when the agent wrote the text. A text without a digit passes the check of the
    numbers whatever the facts say now, so it is dropped as soon as one of its facts reads differently."""
    if not isinstance(text, str) or not text.strip():
        return "no text"
    if len(text) > limit:
        return f"longer than {limit} characters"
    if not ids:
        return "cites no fact"
    unknown = [i for i in ids if not isinstance(i, str) or i not in by_id]
    if unknown:
        return f"cites an unknown fact: {unknown[0]!r}"
    changed = [i for i in ids if composed is not None and composed.get(i) != by_id[i].text()]
    if changed:
        return f"rests on {changed[0]}, which has changed since the agent wrote this"
    facts = [by_id[i] for i in ids]
    for name in names:                      # the name of the sprint or of the team is neither an issue key nor a number
        text = text.replace(name, " ")
    keys = {k for f in facts for k in f.keys}
    foreign = sorted({k.upper() for k in _KEY_ANY_CASE.findall(text)} - keys)
    if foreign:
        return f"names {foreign[0]}, which is not behind the cited facts"
    for phrase in (p for f in facts for p in label_phrases(f)):
        text = phrase.sub(" ", text)
    known = {n for f in facts for n in own_numbers(f)}
    invented = sorted(n for n in stated_numbers(text) if not any(abs(n - k) < 1e-6 for k in known))
    if invented:
        return f"states {invented[0]:g}, which is not in the cited facts"
    worded = " ".join(f.label for f in facts).lower()          # a word of a cited fact's own label may be repeated
    share = next((m.group(0).lower() for m in _SHARE.finditer(text) if m.group(0).lower() not in worded), None)
    if share:
        return f"states a share in words ({share}), which no fact holds"
    nothing = next((m.group(0).lower() for m in _ZERO.finditer(text) if m.group(0).lower() not in worded), None)
    if nothing and not any(f.value == 0 for f in facts):
        return f"says {nothing!r}, and none of the cited facts is zero"
    return None


# Among facts of the same level the rules show these first.
FIRST = ("sprint.done_sp", "forecast.chance_all_pct", "plan.over_50_sp", "forecast.p85_done_sp", "plan.sprints_reaching_commitment", "sprint.added_n",
         "backlog.blocked_n", "premortem.reasons_n", "risks.review_due_n", "risks.undecided_n", "risks.candidates_n", "backlog.carried_n", "notice.new_bugs_n")


def _rank(fact_id: str) -> int:
    return FIRST.index(fact_id) if fact_id in FIRST else len(FIRST)


def rule_page(facts: list[Fact]) -> dict:
    """The page without an agent: every card shows its facts, the most serious first."""
    by_id = {f.id: f for f in facts}
    cards = []
    for cid in CARDS:
        own = sorted((f for f in facts if f.card == cid), key=lambda f: (LEVELS.index(f.level), _rank(f.id)))
        cards.append({"id": cid, "by": "rules", "note": "",
                      "rows": [{"facts": [f.id], "level": f.level, "text": f.text()} for f in own[:MAX_ROWS]]})
    lead = [by_id[i] for i in ("sprint.day", "sprint.done_sp", "sprint.committed_sp") if i in by_id]
    return {"by": "rules", "headline": "; ".join(f.text() for f in lead), "cards": cards}


@dataclass
class Checked:
    page: dict              # safe to show: only rows that passed, the rest laid out by rules
    problems: list[str]     # what was dropped and why (for the log and for "How it was built")


def check_lines(rows, facts: list[Fact], names: tuple = (), where: str = "line") -> tuple[list[dict], list[str]]:
    """Check lines of an agent that stand outside the three cards (the findings of another tab) the same way as a
    row of a card: (the lines that may be shown, what was dropped and why)."""
    by_id = {f.id: f for f in facts}
    kept, problems = [], []
    for n, row in enumerate(rows if isinstance(rows, list) else [], 1):
        if not isinstance(row, dict):
            problems.append(f"{where} {n}: not a line, dropped")
            continue
        ids = _cited(row)
        why = _problem(row.get("text"), ids, by_id, MAX_TEXT, None, names)
        if why is None and row.get("level") not in LEVELS:
            why = f"unknown level {row.get('level')!r}"
        if why:
            problems.append(f"{where} {n}: {why}, dropped")
        elif len(kept) < MAX_LINES:
            kept.append({"facts": ids, "level": row["level"], "text": row["text"].strip()})
    return kept, [p[:MAX_PROBLEM] for p in problems[:MAX_PROBLEMS]]


def check_page(reply, facts: list[Fact], composed: dict[str, str] | None = None, names: tuple = ()) -> Checked:
    """Check an agent's reply (the JSON text or the parsed object) against the facts.
    `composed`: the text of every fact at the moment the agent wrote the reply (fact id -> text), when the reply is
    shown again later. `names`: the names of the sprint and of the team, which may stand in a line as they are."""
    by_id = {f.id: f for f in facts}
    rules = rule_page(facts)
    spec = parse_reply(reply) if isinstance(reply, str) else reply
    if not isinstance(spec, dict) or not isinstance(spec.get("cards"), list):
        return Checked(rules, ["the reply is not a page: everything is laid out by rules"])
    problems: list[str] = []
    done: dict[str, dict] = {}
    cited_on_page: list[str] = []
    for card in spec["cards"]:
        cid = card.get("id") if isinstance(card, dict) else None
        if cid not in CARDS or cid in done:
            problems.append(f"card {cid!r}: unknown or repeated, dropped")
            continue
        rows, cited = [], []
        for n, row in enumerate(card["rows"] if isinstance(card.get("rows"), list) else [], 1):
            where = f"{cid}, row {n}"
            if not isinstance(row, dict):
                problems.append(f"{where}: not a row, dropped")
                continue
            if len(rows) >= MAX_ROWS:
                problems.append(f"{cid}: more than {MAX_ROWS} rows, the rest dropped")
                break
            ids = _cited(row)
            why = _problem(row.get("text"), ids, by_id, MAX_TEXT, composed, names)
            if why is None and row.get("level") not in LEVELS:
                why = f"unknown level {row.get('level')!r}"
            if why:
                problems.append(f"{where}: {why}, dropped")
                continue
            rows.append({"facts": ids, "level": row["level"], "text": row["text"].strip()})
            cited += ids
        if not rows:
            problems.append(f"{cid}: no usable row, laid out by rules")
            continue
        note = card.get("note") or ""
        if note:
            why = _problem(note, cited, by_id, MAX_NOTE, composed, names)
            if why:
                problems.append(f"{cid}, note: {why}, dropped")
                note = ""
        done[cid] = {"id": cid, "by": "agent", "rows": rows, "note": note.strip()}
        cited_on_page += cited
    for cid in CARDS:
        if cid not in done and not any(p.startswith(f"{cid}:") for p in problems):
            problems.append(f"{cid}: missing in the reply, laid out by rules")
    cards = [done.get(c["id"], c) for c in rules["cards"]]

    head = spec.get("headline")
    text, ids = (head.get("text"), _cited(head) or cited_on_page) if isinstance(head, dict) else (head, cited_on_page)
    why = _problem(text, ids, by_id, MAX_HEADLINE, composed, names)
    if why:
        problems.append(f"headline: {why}, replaced by rules")
    agent_parts = [c["by"] == "agent" for c in cards] + [why is None]
    by = "agent" if all(agent_parts) else "mixed" if any(agent_parts) else "rules"
    problems = [p[:MAX_PROBLEM] for p in problems[:MAX_PROBLEMS]]          # they quote the reply: not more of it than a reader needs
    return Checked({"by": by, "headline": rules["headline"] if why else text.strip(), "cards": cards}, problems)
