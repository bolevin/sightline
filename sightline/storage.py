"""What the app keeps on this computer: every file it writes and what is in it, for the System page.

Jira stays the store of everything Jira knows: any fact about a sprint can be computed again from the issues and
their history, for any past moment. So the app keeps only what cannot be computed again: the user's own notes and
what the user sent. Both lie under var/ and are never committed; there is no database.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import drafts, risks

NEVER = ("issue titles, descriptions and comments", "names of people", "tokens and passwords", "your questions and the answers to them")


def _lines(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for line in f if line.strip())


def _risks(path: Path):
    try:
        return len(json.loads(path.read_text(encoding="utf-8")).get("risks", []))
    except (ValueError, AttributeError):
        return "not readable"


def kept(root: Path) -> dict:
    """{"folder", "files": [{"path", "what", "exists", "entries", "bytes"}], "never"}."""
    rows = ((risks.FILE, "your risk register: titles, owners, responses and review dates as you typed them", _risks),
            (drafts.FILE, "the texts you marked as sent", _lines))
    files = []
    for rel, what, count in rows:
        path = root / rel
        exists = path.exists()
        files.append({"path": rel.as_posix(), "what": what, "exists": exists, "entries": count(path) if exists else 0,
                      "bytes": path.stat().st_size if exists else 0})
    return {"folder": "var", "files": files, "never": list(NEVER)}
