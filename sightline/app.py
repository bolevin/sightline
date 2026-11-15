"""The data of the page: the settings, the facts of one sprint and everything the page shows of it.

The demo reads a folder of invented Jira data (demo_data/) instead of a Jira. Everything from there on is the real
thing: the facts are computed from the issues and their history, the forecast is run on them, and the briefing that
comes with the folder is checked against the facts line by line before it is shown.
"""
from __future__ import annotations

import configparser
import datetime as dt
import json
from dataclasses import dataclass, field
from pathlib import Path

from . import __doc__ as _about
from . import cards, demo, drafts, journal, premortem, quality, risks, storage
from .facts import Run, load_run
from .forecast import forecast_facts
from .page import check_lines, check_page, rule_page
from .today import MENTIONS, Fact, notices, today_facts
from .views import build as build_views

ROOT = Path(__file__).resolve().parent.parent
CONFIG = "sightline.ini"
DEFAULTS = {"team": {"name": "", "board": "7", "sprint": ""}, "data": {"folder": "demo_data"}, "server": {"port": "8780"}}


class AppError(Exception):
    """Something the user can fix: a setting, a missing folder."""


def check_port(port: int) -> int:
    if not 1 <= port <= 65535:
        raise AppError(f"The port must be a number from 1 to 65535, got {port}")
    return port


def load_config(root: Path = ROOT) -> dict:
    """The settings: the defaults, then sightline.ini when there is one."""
    parser = configparser.ConfigParser(inline_comment_prefixes=(";",), interpolation=None)
    parser.read_dict(DEFAULTS)
    if (root / CONFIG).exists():
        try:
            parser.read(root / CONFIG, encoding="utf-8")
        except configparser.Error as e:
            raise AppError(f"{CONFIG} cannot be read: {e}") from None
        except UnicodeError:
            raise AppError(f"{CONFIG} cannot be read: it is not UTF-8 text") from None

    def number(section: str, key: str, empty_ok: bool = False) -> int | None:
        text = parser[section][key].strip()
        if not text and empty_ok:
            return None
        if not (text.isascii() and text.isdigit()) or len(text) > 9:
            raise AppError(f"{CONFIG}: [{section}] {key} must be a number, got {text[:40]!r}")
        return int(text)

    return {"name": parser["team"]["name"].strip(), "board": number("team", "board"), "sprint": number("team", "sprint", True),
            "data": parser["data"]["folder"].strip(), "port": check_port(number("server", "port"))}


def find_data(root: Path, config: dict) -> Path:
    path = Path(config["data"])
    path = path if path.is_absolute() else root / path
    if not (path / "manifest.json").exists():
        raise AppError(f"{CONFIG}: [data] folder = {config['data']!r} holds no data (no manifest.json)")
    return path


def board_view(run: Run):
    """Which issues count for the board: not those of other teams that are in the data only because a comment in
    them names the team."""
    foreign = set(run.sets.get(MENTIONS, ()))
    return (lambda issue: issue.key not in foreign) if foreign else None


def pick_sprint(run: Run, board: int, wanted: int | None) -> int:
    b = run.boards[board]
    held = [s for s in b.sprints.values() if s.board == board and run.sampled(board, s.id)]
    if wanted is not None:
        if wanted not in {s.id for s in held}:
            raise AppError(f"{CONFIG}: sprint {wanted} of board {board} is not in the data ({run.folder.name})")
        return wanted
    active = [s for s in held if s.state == "active"]
    if not (active or held):
        raise AppError(f"No sprint of board {board} in the data ({run.folder.name})")
    return max(active or held, key=lambda s: s.activated or s.start).id


def now_row(facts: list[Fact]) -> list[dict]:
    """Six numbers for the row under the cards, taken from the facts (so they carry the same evidence)."""
    f = {x.id: x for x in facts}
    v = lambda i, default=0: f[i].value if i in f else default
    top = max((x for x in facts if x.id.startswith("backlog.status.")), key=lambda x: x.value, default=None)
    row = [
        ("Sprint status", f"{v('sprint.done_sp'):g} / {v('sprint.committed_sp'):g}", "SP", f"day {v('sprint.day')} {f['sprint.day'].unit}",
         ["sprint.done_sp", "sprint.committed_sp", "sprint.day"]),
        ("Sprint backlog", str(v("sprint.open_n")), "items open", f"{top.value} in {top.id[len('backlog.status.'):]}" if top else "",
         ["sprint.open_n"] + ([top.id] if top else [])),
        ("Forecast", f"{v('forecast.p85_done_sp'):g}" if "forecast.p85_done_sp" in f else "—", "SP or more, 85 % sure",
         f"{v('forecast.chance_all_pct')} % to finish everything" if "forecast.chance_all_pct" in f else
         "no forecast: the sprint does not run" if "forecast.days_left" not in f else "no working day left to forecast" if not v("forecast.days_left") else
         "no chance given: the open work has no story points" if "forecast.p85_done_sp" in f else "no history yet",
         [i for i in ("forecast.p85_done_sp", "forecast.chance_all_pct", "forecast.history_days") if i in f]),
        ("Blocked", str(v("backlog.blocked_n")), "items", f"{v('backlog.blocked_sp'):g} SP" if "backlog.blocked_sp" in f else "",
         [i for i in ("backlog.blocked_n", "backlog.blocked_sp") if i in f]),
        ("Scope", f"+{v('sprint.added_n')}", "after the start", f"{v('sprint.removed_n')} taken out" if "sprint.removed_n" in f else "",
         [i for i in ("sprint.added_n", "sprint.added_sp", "sprint.removed_n") if i in f]),
        ("Carried over", str(v("backlog.carried_n")), "items", "third sprint or later", ["backlog.carried_n"] if "backlog.carried_n" in f else []),
    ]
    return [{"label": label, "value": value, "unit": unit, "note": note, "facts": ids} for label, value, unit, note, ids in row]


@dataclass
class Data:
    """What one load of the data folder gives: the run and everything computed from it."""
    config: dict
    run: Run
    board: int
    sprint: int
    on_board: object
    facts: list[Fact]
    extras: dict = field(default_factory=dict)      # prepared views of the demo: pull requests, incident reports, services
    premortem: dict | None = None
    quality: dict | None = None                     # what the bugs of the last increments say (quality.py)

    @property
    def context(self) -> dict:
        """What an agent is told about where it is."""
        b = self.run.boards[self.board]
        return {"team": self.config["name"] or b.name, "sprint": b.sprints[self.sprint].name,
                "fetched": self.run.fetched.isoformat(timespec="minutes")}


def load_data(root: Path = ROOT, config: dict | None = None) -> Data:
    config = config or load_config(root)
    run = load_run(find_data(root, config))
    board = config["board"]
    if board not in run.boards:
        raise AppError(f"Board {board} is not in the data ({run.folder.name}); it has: {', '.join(map(str, sorted(run.boards)))}")
    sprint = pick_sprint(run, board, config["sprint"])
    on_board = board_view(run)
    facts = today_facts(run, board, sprint, on_board=on_board) + forecast_facts(run, board, sprint, on_board=on_board)
    extras = demo.extras(run.folder)
    facts += extras["facts"]
    pre = premortem.build(run, board, sprint, on_board)
    facts += premortem.facts(pre)
    bugs = quality.build(run.folder)
    facts += quality.facts(bugs)
    data = Data(config, run, board, sprint, on_board, facts, extras, pre, bugs)
    facts += journal.facts(run.folder, data)        # the record of past forecasts that comes with the data
    return data


def findings(data: Data, facts: list[Fact]) -> dict:
    """What stands under "What the numbers say" on the Quality tab: the lines the briefing agent wrote about the
    bugs, each checked against the facts it cites; without an agent, the facts that call for a look, as they are."""
    mine = [f for f in facts if f.card == quality.CARD]
    rows = demo.findings(data.run.folder)
    if rows is None:
        return {"by": "rules", "rows": [{"facts": [f.id], "level": f.level, "text": f.text()} for f in mine if f.level in ("critical", "warning")], "problems": []}
    names = sorted({p["name"] for p in data.quality["pis"]} | {s["name"] for s in data.quality["sprints"]} | set(data.context.values()), key=len, reverse=True)
    kept, problems = check_lines(rows, mine, tuple(names), "finding")
    return {"by": "agent", "rows": kept, "problems": problems}


def build_state(root: Path = ROOT, config: dict | None = None, data: Data | None = None) -> dict:
    """Everything the page needs, as JSON-ready data. `root`: where the user's own files are kept (var/)."""
    data = data or load_data(root, config)
    config, run, board, sprint, on_board = data.config, data.run, data.board, data.sprint, data.on_board
    s, b = run.boards[board].sprints[sprint], run.boards[board]
    iso = lambda t: t.isoformat(timespec="minutes") if t else None
    manifest = json.loads((run.folder / "manifest.json").read_text(encoding="utf-8"))
    record = journal.settled(run.folder, data)
    register = risks.register(root, data)           # the user's own notes, with what the data says about them now
    facts = data.facts + risks.facts(register)
    names = tuple(n for n in (data.context["sprint"], data.context["team"]) if n)
    reply = demo.briefing(run.folder)               # what the briefing agent wrote for this data; checked here, now
    checked = check_page(reply, facts, None, names) if reply else None
    page = checked.page if checked else rule_page(facts)
    return {
        "team": config["name"] or b.name,
        "board": {"id": board, "name": b.name, "done_column": b.columns[-1][0] if b.columns else ""},
        "sprint": {"id": sprint, "name": s.name, "state": s.state, "start": iso(s.activated or s.start), "end": iso(s.end)},
        "data": {"folder": run.folder.name, "fetched": iso(run.fetched), "made_by": manifest.get("tool", ""), "host": manifest.get("host", ""),
                 "synthetic": bool(manifest.get("synthetic")), "searches": sorted(run.sets)},
        "composed": {"by": page["by"], "at": iso(run.fetched), "problems": checked.problems if checked else []},
        "agent": demo.agent_state(reply, checked, iso(run.fetched)),
        "page": page,
        "now": now_row(facts),
        "notices": [dict(n, at=iso(n["at"])) for n in notices(run, board, sprint, None, on_board)],
        "views": {**build_views(data), "quality": data.quality and {**data.quality, "findings": findings(data, facts)}},
        "cards": cards.cards(run, on_board),            # titles and priorities: shown on the card of an issue, part of no fact
        "services": data.extras["services"],
        "ask": demo.questions(run.folder),
        "storage": storage.kept(root),
        "record": record,
        "register": register,
        "inbox": {"drafts": drafts.build(data, register, record), "sent": drafts.sent(root)},
        "facts": [{"id": x.id, "card": x.card, "level": x.level, "text": x.text(), "value": x.value, "unit": x.unit, "keys": list(x.keys)}
                  for x in facts],
        "settings": {"file": CONFIG, "name": config["name"], "board": board, "sprint": config["sprint"], "data": config["data"], "port": config["port"]},
        "built": iso(dt.datetime.now().astimezone()),
        "about": (_about or "").strip(),
    }
