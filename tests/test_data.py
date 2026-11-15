"""The demo data: what the tools write is what is committed, and the app rebuilds every sprint as the plan says."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import make_demo_data  # noqa: E402
import make_record  # noqa: E402
from sightline import app, journal  # noqa: E402
from sightline.facts import load_run  # noqa: E402
from sightline.forecast import past_sprints  # noqa: E402
from sightline.sprint_scope import sprint_scope  # noqa: E402

DATA = ROOT / "demo_data"
BOARD = 7


class Generated(unittest.TestCase):
    def test_the_generator_writes_the_committed_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            made = make_demo_data.write(Path(tmp))
            names = sorted(p.relative_to(made).as_posix() for p in made.rglob("*") if p.is_file())
            self.assertGreater(len(names), 15)
            for name in names:
                self.assertEqual((made / name).read_bytes(), (DATA / name).read_bytes(), name)

    def test_the_record_of_forecasts_is_what_the_replay_gives(self):
        committed = [json.loads(line) for line in (DATA / journal.FILE).read_text(encoding="utf-8").splitlines()]
        self.assertEqual(committed, make_record.entries(DATA, BOARD))
        self.assertGreater(len(committed), 20)
        self.assertEqual(len({(e["sprint"], e["day"]) for e in committed}), len(committed))      # one forecast per day and sprint

    def test_nothing_in_the_data_names_a_person_or_carries_a_long_text(self):
        for p in list(DATA.glob("board-*/*.json")) + list(DATA.glob("jql-*.json")):      # what stands for Jira
            text = p.read_text(encoding="utf-8")
            for field in ('"assignee"', '"reporter"', '"creator"', '"author"', '"displayName"', '"emailAddress"', '"description"', '"comment"'):
                self.assertNotIn(field, text, f"{p.name}: {field}")
        self.assertTrue(json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))["synthetic"])


class Rebuilt(unittest.TestCase):
    """The answer key (expected.json) is counted from the plan of the generator, without any Jira format in between.
    The app sees only what Jira would give: issues and their changelog."""

    @classmethod
    def setUpClass(cls):
        cls.run_ = load_run(DATA)
        cls.shown = staticmethod(app.board_view(cls.run_))       # a plain function in a class would be taken for a method
        cls.expected = json.loads((DATA / "expected.json").read_text(encoding="utf-8"))

    def test_every_sprint_is_rebuilt_as_planned(self):
        self.assertEqual(len(self.expected), 9)
        for sid, plan in self.expected.items():
            sc = sprint_scope(self.run_, BOARD, int(sid), self.shown)
            for part in ("committed", "completed", "not_completed", "added", "removed"):
                self.assertEqual(sorted(getattr(sc, part)), plan[part], f"{plan['name']}: {part}")
            self.assertEqual((sc.velocity_committed, sc.velocity_completed), (plan["committed_sp"], plan["completed_sp"]), plan["name"])

    def test_the_history_is_no_toy(self):
        plans = list(self.expected.values())
        self.assertTrue(any(p["added"] for p in plans[:-1]) and any(p["removed"] for p in plans) and any(p["not_completed"] for p in plans[:-1]))
        self.assertGreater(len({p["committed_sp"] for p in plans}), 4)
        carried = set(plans[-1]["committed"]) & set(plans[-2]["not_completed"])
        self.assertTrue(carried)                                             # work that travels from sprint to sprint

    def test_the_velocity_chart_says_the_same(self):
        chart = {s.id: (committed, completed) for s, committed, completed in past_sprints(self.run_, BOARD, but=-1)}
        self.assertEqual(len(chart), 8)
        for sid, (committed, completed) in chart.items():
            self.assertEqual((committed, completed), (self.expected[str(sid)]["committed_sp"], self.expected[str(sid)]["completed_sp"]))

    def test_the_scope_at_an_earlier_moment_is_smaller(self):
        running = max(int(sid) for sid in self.expected)
        s = self.run_.boards[BOARD].sprints[running]
        early = sprint_scope(self.run_, BOARD, running, self.shown, at=s.activated)
        now = sprint_scope(self.run_, BOARD, running, self.shown)
        self.assertEqual((sorted(early.committed), early.added, early.completed), (sorted(now.committed), set(), set()))
        self.assertTrue(now.added and now.completed)


if __name__ == "__main__":
    unittest.main()
