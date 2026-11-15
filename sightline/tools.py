"""The data of the page as read-only tools for an agent (Model Context Protocol).

Transport: Streamable HTTP, one JSON-RPC 2.0 message or a batch per POST, answered as plain JSON. There are no
sessions and no server-initiated messages. An agent runtime that is pointed at http://127.0.0.1:<port>/mcp sees
four tools: facts, sprint, issue and forecast. Every tool reads what the page itself is built from; the only
arguments are a card name and an issue key. Nothing here can change anything.
"""
from __future__ import annotations

import json

from .forecast import look_back, sprint_forecast
from .page import CARDS
from .sprint_scope import sprint_scope
from .today import status_names

SERVER = "sightline"                                         # the name this MCP server gives itself
PROTOCOLS = ("2025-06-18", "2025-03-26", "2024-11-05")       # newest first
INSTRUCTIONS = ("Sightline: one team's sprint, read from Jira. Start with the facts tool; "
                "sprint lists the issues behind the sprint numbers, issue shows one issue with its history, forecast "
                "explains the forecast. Numbers come from these tools only: quote them, do not work out new ones.")
HISTORY = ("status", "sprint", "story points")               # the changes of an issue that are shown
MAX_HISTORY = 40


class ToolError(Exception):
    """A tool could not answer; the text is for the model."""


def _iso(t) -> str | None:
    return t.isoformat(timespec="minutes") if t else None


def _sprint(d) -> dict:
    s = d.run.boards[d.board].sprints[d.sprint]
    return {"id": s.id, "name": s.name, "state": s.state, "start": _iso(s.activated or s.start), "end": _iso(s.end),
            "board": d.run.boards[d.board].name, "data_of": _iso(d.run.fetched)}


def facts(d, a: dict) -> dict:
    card = a.get("card")
    if card and card not in CARDS:
        raise ToolError(f"Unknown card {card!r}: use one of {', '.join(CARDS)}, or leave it out")
    return {"sprint": _sprint(d),
            "facts": [{"id": f.id, "card": f.card, "level": f.level, "text": f.text(), "keys": list(f.keys)}
                      for f in d.facts if not card or f.card == card]}


def sprint(d, a: dict) -> dict:
    sc = sprint_scope(d.run, d.board, d.sprint, d.on_board)
    names = status_names(d.run)
    done = sorted(names.get(s, s) for s in d.run.boards[d.board].done_statuses)

    def part(keys, at_end=True) -> dict:
        src = sc.points_end if at_end else sc.points_start
        rows = [{"key": k, "type": d.run.issues[k].type, "status": names.get(d.run.issues[k].status, d.run.issues[k].status),
                 "sp": src.get(k)} for k in sorted(keys)]
        return {"items": len(rows), "sp": round(sc.points(keys, at_end), 1), "issues": rows}

    return {"sprint": _sprint(d), "done_means_status": done,
            "committed_at_start": part(sc.committed, False), "added_after_start": part(sc.added, False),
            "taken_out": part(sc.removed), "done": part(sc.completed), "not_done": part(sc.not_completed),
            "done_before_it_came_in": part(sc.completed_elsewhere)}


def issue(d, a: dict) -> dict:
    key = a["key"].strip().upper()
    i = d.run.issues.get(key)
    if i is None:
        raise ToolError(f"No issue {key} in the Jira data of {_iso(d.run.fetched)}: it holds the sprints of the board only")
    names = status_names(d.run)
    sprints = {s.id: s.name for b in d.run.boards.values() for s in b.sprints.values()}
    history = [{"at": _iso(c.at), "what": c.field, "from": c.old_text, "to": c.new_text} for c in i.changes if c.field in HISTORY]
    return {"key": i.key, "type": i.type, "status": names.get(i.status, i.status), "story_points": i.points, "team": i.team,
            "feature": i.feature, "created": _iso(i.created), "in_this_sprint": d.sprint in i.sprints,
            "sprints": [sprints.get(s, str(s)) for s in sorted(i.sprints)],
            "history": history[-MAX_HISTORY:], "history_left_out": max(0, len(history) - MAX_HISTORY)}


def forecast(d, a: dict) -> dict:
    f = sprint_forecast(d.run, d.board, d.sprint, None, d.on_board)
    r1 = lambda v: None if v is None else round(v, 1)
    names = {s.id: s.name for s in d.run.boards[d.board].sprints.values()}
    back = [{"sprint": names.get(x["sprint"], str(x["sprint"])), "asked_at_share_of_sprint": round(x["share"], 2),
             "said_85_sure_at_least": r1(x["p85"]), "said_as_likely_as_not_at_least": r1(x["p50"]), "sprint_ended_with": r1(x["actual"]),
             "line_85_held": x["actual"] >= x["p85"] - 1e-9} for x in look_back(d.run, d.board, d.on_board)]
    return {"sprint": _sprint(d),
            "method": ("Monte Carlo: the story points the team completed on each working day of its sampled sprints are drawn "
                       "at random for each working day left. The look-back replays this inside past sprints."),
            "working_days_of_history": f["history_days"], "working_days_left": f["days_left"],
            "done_sp": r1(f["done"]), "open_sp": r1(f["open"]), "open_issues": list(f["open_keys"]),
            "by_the_end_85_sure_at_least_sp": r1(f.get("p85")), "by_the_end_as_likely_as_not_at_least_sp": r1(f.get("p50")),
            "chance_to_finish_everything_pct": None if "chance_all" not in f else round(100 * f["chance_all"]),
            "look_back": back}


_NONE = {"type": "object", "properties": {}, "additionalProperties": False}
TOOLS = [
    {"name": "facts", "run": facts,
     "description": ("Start here. Every fact the Today page may show about the running sprint: the promise (committed, done, "
                     "forecast), the risks (blocked, stuck and carried-over items) and what arrived (bugs, items handed to the "
                     "team). Each fact has an id, a text with its number, and the issue keys behind it."),
     "inputSchema": {"type": "object", "additionalProperties": False, "properties": {
         "card": {"type": "string", "description": f"Optional: only the facts of one card: {', '.join(CARDS)}"}}}},
    {"name": "sprint", "run": sprint,
     "description": ("The issues behind the sprint numbers, counted as Jira's sprint report counts them: committed at the "
                     "start, added after it, taken out, done, not done. Each with type, status and story points."),
     "inputSchema": _NONE},
    {"name": "issue", "run": issue,
     "description": "One issue: type, status, story points, team, the sprints it is in, and when its status, sprint or points changed.",
     "inputSchema": {"type": "object", "required": ["key"], "additionalProperties": False, "properties": {
         "key": {"type": "string", "description": "Issue key as the other tools list it, e.g. KES-123"}}}},
    {"name": "forecast", "run": forecast,
     "description": ("How the forecast of the running sprint is made and how far it can be trusted: the history behind it, "
                     "the two forecast lines, and a look-back that replays the forecast inside past sprints."),
     "inputSchema": _NONE},
]
_BY_NAME = {tool["name"]: tool for tool in TOOLS}


def _error(message_id, code: int, text: str) -> dict:
    return {"jsonrpc": "2.0", "id": message_id, "error": {"code": code, "message": text}}


def _check(schema: dict, arguments) -> None:
    """Arguments as the tool's inputSchema describes them: a runtime may pass on what the model wrote unchecked."""
    if not isinstance(arguments, dict):
        raise ToolError("Arguments must be an object")
    missing = [key for key in schema.get("required", []) if key not in arguments]
    if missing:
        raise ToolError(f"Missing argument: {', '.join(missing)}")
    for key, value in arguments.items():
        if key in schema["properties"] and not isinstance(value, str):
            raise ToolError(f"Argument {key} must be a string")


def handle(message, data, called=None) -> dict | None:
    """Answer one JSON-RPC message. `data` is a function: the data is loaded only when a tool needs it.
    `called`: told the name of every tool that is run. Returns None for notifications, which get no reply."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        return _error(message.get("id") if isinstance(message, dict) else None, -32600, "Invalid request")
    method = message["method"]
    params = message["params"] if isinstance(message.get("params"), dict) else {}
    if "id" not in message:
        return None
    mid = message["id"]
    if method == "initialize":
        wanted = params.get("protocolVersion")
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": wanted if wanted in PROTOCOLS else PROTOCOLS[0],
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER, "title": "Sightline", "version": "1"},
            "instructions": INSTRUCTIONS}}
    if method == "ping":
        return {"jsonrpc": "2.0", "id": mid, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": [{k: v for k, v in tool.items() if k != "run"} for tool in TOOLS]}}
    if method == "tools/call":
        name = params.get("name")
        tool = _BY_NAME.get(name) if isinstance(name, str) else None
        if tool is None:
            return _error(mid, -32602, f"Unknown tool: {name!r}")
        arguments = params.get("arguments") or {}
        if called:
            called(name)
        try:
            _check(tool["inputSchema"], arguments)
            text, failed = json.dumps(tool["run"](data(), arguments), ensure_ascii=False), False
        except ToolError as error:           # a tool failure is a result the model can read, not a protocol error
            text, failed = str(error), True
        except Exception as error:           # noqa: BLE001  a bug or a broken settings file: still an answer
            text, failed = f"Sightline could not run {name}: {type(error).__name__}: {error}", True
        return {"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": failed}}
    return _error(mid, -32601, f"Method not found: {method}")


MAX_BATCH = 20              # messages of one POST: an agent sends one, and every call may read the whole data


def handle_body(raw: bytes, data, called=None) -> tuple[int, object]:
    """Answer the body of one POST: (HTTP status, JSON payload or None when there is nothing to send back)."""
    try:
        payload = json.loads(raw)
    except (ValueError, RecursionError):
        return 400, _error(None, -32700, "Parse error")
    if isinstance(payload, list):
        if not payload:
            return 400, _error(None, -32600, "Invalid request")
        if len(payload) > MAX_BATCH:
            return 400, _error(None, -32600, f"More than {MAX_BATCH} messages in one request")
        replies = [reply for reply in (handle(m, data, called) for m in payload) if reply is not None]
        return (200, replies) if replies else (202, None)
    reply = handle(payload, data, called)
    return (200, reply) if reply is not None else (202, None)
