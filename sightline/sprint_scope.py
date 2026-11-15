"""What happened to the scope of one sprint, rebuilt from the issues and their changelog the way the Jira
sprint report counts it (sub-tasks left out, "done" = right-most board column at the end of the sprint)."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Callable

from .facts import Issue, Run, Sprint


@dataclass
class Scope:
    sprint: Sprint
    start: dt.datetime
    end: dt.datetime                     # completion, or the fetch time for an active sprint
    committed: set[str] = field(default_factory=set)            # in the sprint when it started
    added: set[str] = field(default_factory=set)                # came in after the start
    removed: set[str] = field(default_factory=set)              # in it at some point, not at the end
    completed: set[str] = field(default_factory=set)            # done at the end, finished in this sprint
    not_completed: set[str] = field(default_factory=set)
    completed_elsewhere: set[str] = field(default_factory=set)  # already done when it came in
    points_start: dict[str, float | None] = field(default_factory=dict)   # when it started or came in
    points_end: dict[str, float | None] = field(default_factory=dict)

    def points(self, keys, at_end: bool = True) -> float:
        src = self.points_end if at_end else self.points_start
        return sum(src.get(k) or 0 for k in keys)

    @property
    def velocity_committed(self) -> float:
        return self.points(self.committed, at_end=False)

    @property
    def velocity_completed(self) -> float:
        return self.points(self.completed)


def sprint_scope(run: Run, board: int, sprint: int, on_board: Callable[[Issue], bool] | None = None,
                 at: dt.datetime | None = None) -> Scope:
    """`on_board`: whether the board's filter shows the issue. A board shows only part of the issues in its sprints
    (by a team field, say); without the filter every issue of the sprint counts.
    `at`: look at the sprint as it stood at this moment (for a look back); default is its end, or now if it runs."""
    b = run.boards[board]
    s = b.sprints[sprint]
    t0 = s.activated or s.start
    t1 = s.complete or run.fetched
    if at is not None and t0 <= at < t1:
        t1 = at
    done = b.done_statuses
    out = Scope(s, t0, t1)
    for issue in run.issues.values():
        if issue.subtask or (on_board and not on_board(issue)):
            continue
        at_start = sprint in issue.sprints_at(t0)
        came_in = [t for t, inside in issue.sprint_moves(sprint) if inside and t0 < t <= t1]
        if not at_start and not came_in:
            continue
        key = issue.key
        entered = t0 if at_start else came_in[0]
        (out.committed if at_start else out.added).add(key)
        out.points_start[key] = issue.points_at(entered)
        out.points_end[key] = issue.points_at(t1)
        if sprint not in issue.sprints_at(t1):
            out.removed.add(key)
        elif issue.status_at(t1) not in done:
            out.not_completed.add(key)
        elif issue.done_since(done, t1) < entered:
            out.completed_elsewhere.add(key)
        else:
            out.completed.add(key)
    return out
