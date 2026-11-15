"""Write the record of forecasts that comes with the demo data: demo_data/forecasts.jsonl.

    python tools/make_record.py

The full application appends one line per working day while it reads Jira: the forecast it showed that morning.
The demo has no days to live through, so the same lines are made here by letting the forecast run through the
invented history, morning by morning, seeing only what was known at that moment. Each line is what the page would
have shown on that day; journal.settled() later compares it with how the sprint ended.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app, journal  # noqa: E402
from sightline.facts import load_run  # noqa: E402
from sightline.forecast import forecast_facts, sampled_sprints  # noqa: E402
from sightline.today import today_facts  # noqa: E402

SPRINTS = 4                 # the running sprint and the closed ones before it
MORNING = dt.time(9, 30)


def entries(folder: Path, board: int) -> list[dict]:
    run = load_run(folder)
    on_board = app.board_view(run)
    out = []
    for sprint in sampled_sprints(run, board)[-SPRINTS:]:
        start, last = (sprint.activated or sprint.start), min(sprint.complete or sprint.end, run.fetched)
        day = start.date()
        while day <= last.date():
            now = dt.datetime.combine(day, MORNING, tzinfo=start.tzinfo)
            if day.weekday() < 5 and start <= now <= last:
                facts = today_facts(run, board, sprint.id, now=now, on_board=on_board) + forecast_facts(run, board, sprint.id, now=now, on_board=on_board)
                fact = {f.id: f for f in facts}
                if "forecast.p85_done_sp" in fact:
                    out.append({"board": board, "sprint": sprint.id, "name": sprint.name, "day": day.isoformat(), "at": now.isoformat(timespec="minutes"),
                                **{name: fact[i].value for name, i in journal.KEPT.items() if i in fact}})
            day += dt.timedelta(days=1)
    return out


def write(root: Path = ROOT) -> Path:
    config = app.load_config(root)
    folder = app.find_data(root, config)
    path = folder / journal.FILE
    path.write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in entries(folder, config["board"])), encoding="utf-8", newline="\n")
    return path


if __name__ == "__main__":
    print("Wrote", write())
