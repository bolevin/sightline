"""The record of what was forecast, so that it can be said how often the forecast was right.

The look-back of forecast.py replays the forecast inside past sprints: that is hindsight. A record is made at the
time: once per day and sprint the forecast of that morning is appended to a file, and when the sprint has closed
each entry is settled against what the sprint completed. The full application writes the file while it reads Jira.
The demo has no days to live through, so its record (forecasts.jsonl in the data folder) is made by
tools/make_record.py, which lets the forecast run through the invented history day by day.
"""
from __future__ import annotations

import json
from pathlib import Path

from .forecast import past_sprints
from .sprint_scope import sprint_scope
from .today import Fact

FILE = Path("forecasts.jsonl")           # in the data folder
KEPT = {"sprint_day": "sprint.day", "committed_sp": "sprint.committed_sp", "done_sp": "sprint.done_sp", "open_sp": "sprint.open_sp",
        "days_left": "forecast.days_left", "history_days": "forecast.history_days", "p85_done_sp": "forecast.p85_done_sp",
        "p50_done_sp": "forecast.p50_done_sp", "chance_all_pct": "forecast.chance_all_pct"}       # name in the record: fact


def lines(path: Path) -> list[dict]:
    """The entries of one of the app's own files, one JSON object per line. A line that cannot be read (cut off when
    the computer went down, say) is left out. Split at line feeds only: a text can hold other line separators."""
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").split("\n"):
        try:
            entry = json.loads(line) if line.strip() else None
        except ValueError:
            continue
        if isinstance(entry, dict):
            out.append(entry)
    return out


def read(root: Path) -> list[dict]:
    return lines(root / FILE)


def settled(root: Path, data) -> list[dict]:
    """The entries of this board, each with what its sprint completed in the end (`ended`, None while the sprint
    runs or when the data no longer holds it) and whether the two forecast lines held."""
    run, board = data.run, data.board
    b = run.boards[board]
    from_chart = {s.id: completed for s, _, completed in past_sprints(run, board, but=-1)}
    ended: dict[int, float | None] = {}
    out = []
    for e in read(root):
        if e["board"] != board:
            continue
        sid = e["sprint"]
        if sid not in ended:
            s = b.sprints.get(sid)
            if s is None or s.state != "closed":
                ended[sid] = None
            elif run.sampled(board, sid):
                sc = sprint_scope(run, board, sid, data.on_board)
                ended[sid] = round(sc.points(sc.completed), 1)
            else:
                ended[sid] = from_chart.get(sid)
        actual = ended[sid]
        out.append(dict(e, ended=actual, held_85=None if actual is None else actual >= e["p85_done_sp"] - 1e-9,
                        held_50=None if actual is None else actual >= e["p50_done_sp"] - 1e-9))
    return out


def facts(root: Path, data) -> list[Fact]:
    """What the record says, for the page and the agent. Nothing while the record is empty."""
    entries = settled(root, data)
    if not entries:
        return []
    done = [e for e in entries if e["ended"] is not None]
    out = [Fact("calibration.logged_n", "promises", "forecasts in the app's own record", len(entries), "", (), "info")]
    if done:
        held = sum(1 for e in done if e["held_85"])
        out.append(Fact("calibration.held_85_n", "promises", "recorded forecasts of closed sprints whose 85 % line held", held,
                        f"of {len(done)}", (), "warning" if held < .7 * len(done) else "info"))
    return out
