"""What the app says about the sprint of the demo: the forecast, the pre-mortem, the risks and the drafts."""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app, drafts, forecast, premortem, risks  # noqa: E402
from sightline.page import ISSUE_KEY, known_numbers, stated_numbers  # noqa: E402

DATA = app.load_data(ROOT)
FACT = {f.id: f for f in DATA.facts}
BOARD = DATA.board


class Forecast(unittest.TestCase):
    def test_the_arithmetic(self):
        self.assertEqual([forecast.percentile([0.0, 10.0, 20.0, 30.0, 40.0], q) for q in (0, .5, 1)], [0.0, 20.0, 40.0])
        six = [9.0, 15.0, 22.0, 22.0, 24.0, 26.0]
        self.assertEqual([forecast.reached_by(six, share) for share in (.85, .5, 1)], [9.0, 22.0, 9.0])     # "85 % reached X" is true of X
        self.assertEqual(forecast.simulate([0.0, 1.0, 5.0], 8, runs=200, seed=7), forecast.simulate([0.0, 1.0, 5.0], 8, runs=200, seed=7))
        self.assertGreater(forecast.percentile(forecast.simulate([0.0, 1.0, 5.0], 8, runs=400, seed=7), .5),
                           forecast.percentile(forecast.simulate([0.0, 1.0, 5.0], 2, runs=400, seed=7), .5))

    def test_the_sprint_of_the_demo_does_not_fit(self):
        self.assertLess(FACT["forecast.chance_all_pct"].value, 25)
        self.assertEqual(FACT["forecast.chance_all_pct"].level, "critical")
        self.assertLessEqual(FACT["forecast.p85_done_sp"].value, FACT["forecast.p50_done_sp"].value)
        self.assertGreaterEqual(FACT["forecast.p85_done_sp"].value, FACT["sprint.done_sp"].value)        # what is done stays done
        self.assertLess(FACT["plan.over_50_sp"].value, FACT["plan.over_85_sp"].value)

    def test_every_way_out_is_forecast_again(self):
        chance = lambda name: FACT[f"option.{name}_chance_pct"].value
        self.assertLess(FACT["forecast.chance_all_pct"].value, chance("unstarted"))
        self.assertLess(max(chance("unstarted"), chance("blocked")), chance("both"))
        self.assertEqual(set(FACT["option.both_sp"].keys), set(FACT["option.unstarted_sp"].keys) | set(FACT["option.blocked_sp"].keys))
        self.assertEqual(FACT["option.blocked_sp"].keys, FACT["backlog.blocked_n"].keys)

    def test_the_same_data_gives_the_same_forecast(self):
        again = {f.id: f.value for f in forecast.forecast_facts(DATA.run, BOARD, DATA.sprint, on_board=DATA.on_board)}
        self.assertEqual(again["forecast.chance_all_pct"], FACT["forecast.chance_all_pct"].value)

    def test_the_forecast_is_judged_by_what_happened(self):
        with tempfile.TemporaryDirectory() as home:
            back = app.build_state(Path(home), data=DATA)["views"]["promises"]["look_back"]
        self.assertGreater(len(back), 10)
        held = sum(1 for row in back if row["held"])
        self.assertEqual(FACT["forecast.lookbacks_held"].value, held)
        self.assertGreaterEqual(held, .8 * len(back))
        self.assertTrue(all(row["said_85"] <= row["said_50"] for row in back))


class PreMortem(unittest.TestCase):
    def test_reasons_come_from_the_teams_own_missed_sprints(self):
        view = premortem.build(DATA.run, BOARD, DATA.sprint, DATA.on_board)
        self.assertEqual((len(view["history"]), view["why_not"]), (8, ""))
        missed = [h for h in view["history"] if not h["kept"]]
        self.assertEqual(len(missed), 3)
        self.assertTrue(all(h["said_done"] < premortem.KEPT for h in missed))
        reasons = [sign for sign in view["signs"] if sign["reason"]]
        self.assertGreaterEqual(len(reasons), 2)
        for sign in reasons:                             # seen before a miss more often than before a kept promise
            self.assertGreater(sign["missed_as_bad"] / sign["missed_n"], sign["kept_as_bad"] / sign["kept_n"], sign["id"])

    def test_a_short_history_gives_no_verdict(self):
        few = [{"kept": False, "values": {}}, {"kept": True, "values": {}}]
        self.assertFalse([sign["id"] for sign in premortem.judge({"blocked": 2}, few) if sign["reason"]])


class Risks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)

    def do(self, **action):
        risks.apply(self.home, DATA, action)
        return risks.register(self.home, DATA)

    def test_signals_are_offered_once_each(self):
        found = risks.signals(DATA)
        ids = [s["signal"] for s in found]
        self.assertEqual(len(ids), len(set(ids)))
        kinds = {i.split(":")[0] for i in ids}
        self.assertEqual(kinds, {"fit", "item", "scope", "premortem"})
        waiting = DATA.run.boards[BOARD].waiting
        for s in found:
            if s["signal"].startswith("item:") and "sprint no." not in s["title"]:
                self.assertNotIn(DATA.run.issues[s["signal"][5:]].status, waiting, s["title"])       # what has not started is not stuck

    def test_the_register_keeps_the_users_decision(self):
        signal = "item:" + FACT["backlog.blocked_n"].keys[0]
        reg = self.do(do="add", signal=signal, title="words of the page are ignored")
        self.assertEqual((reg["risks"][0]["id"], reg["risks"][0]["roam"]), ("R-1", "new"))
        self.assertIn("blocked for", reg["risks"][0]["title"])
        self.assertNotIn(signal, [c["signal"] for c in reg["candidates"]])
        reg = self.do(do="update", id="R-1", roam="owned", owner="Product Owner", response="Asked the other team", review="2026-11-10")
        self.assertEqual((reg["risks"][0]["owner"], reg["risks"][0]["review_due"], reg["risks"][0]["gone"]), ("Product Owner", True, False))
        reg = self.do(do="update", id="R-1", roam="resolved")
        self.assertEqual(reg["risks"][0]["closed"], "2026-11-17")
        self.assertIn(signal, [c["signal"] for c in reg["candidates"]])      # the signal is still there: it is offered again
        with self.assertRaises(risks.RiskError):
            self.do(do="add", signal="item:KES-0")
        with self.assertRaises(risks.RiskError):
            self.do(do="update", id="R-1", review="next week")

    def test_not_a_risk_holds_until_the_signal_gets_worse(self):
        self.do(do="dismiss", signal="scope:568")
        reg = risks.register(self.home, DATA)
        self.assertEqual([(d["signal"], d["level"]) for d in reg["dismissed"]], [("scope:568", "warning")])
        self.assertNotIn("scope:568", [c["signal"] for c in reg["candidates"]])
        critical = next(s["signal"] for s in risks.signals(DATA) if s["level"] == "critical")
        (self.home / risks.FILE).write_text(json.dumps({"next": 1, "risks": [], "dismissed": [
            {"board": BOARD, "signal": critical, "at": "2026-11-10", "level": "warning"}]}), encoding="utf-8")
        self.assertIn(critical, [c["signal"] for c in risks.register(self.home, DATA)["candidates"]])     # a warning then, critical now

    def test_what_the_user_types_never_becomes_a_fact(self):
        reg = self.do(do="add", title="The payment provider changes its API in spring")
        texts = json.dumps([[f.id, f.label, f.value, f.unit, f.keys] for f in risks.facts(reg)])
        self.assertNotIn("payment provider", texts)
        self.assertIn("risks.open_n", texts)


class Drafts(unittest.TestCase):
    def test_every_number_and_key_of_a_draft_is_a_fact(self):
        made = drafts.build(DATA, {"risks": [], "candidates": [], "dismissed": [], "roam": []}, [])
        self.assertEqual([d["id"] for d in made], ["status", "decision", "daily", "review", "retro"])
        review = {f.id: f for f in drafts.review_facts(DATA, [])[1]}
        names = [s.name for s in DATA.run.boards[BOARD].sprints.values()]
        for d in made:
            cited = [FACT[i] if i in FACT else review[i] for i in d["facts"]]
            text = d["text"]
            for name in sorted(names, key=len, reverse=True):
                text = text.replace(name, " ")
            known = {n for f in cited for n in known_numbers(f)}
            self.assertEqual([n for n in stated_numbers(text) if not any(abs(n - k) < 1e-6 for k in known)], [], d["id"])
            self.assertEqual(set(ISSUE_KEY.findall(text)) - {k for f in cited for k in f.keys}, set(), d["id"])

    def test_the_letter_to_the_product_owner_names_the_options(self):
        made = {d["id"]: d for d in drafts.build(DATA, {"risks": [], "candidates": [], "dismissed": [], "roam": []}, [])}
        text = made["decision"]["text"]
        for fact in ("forecast.chance_all_pct", "option.blocked_chance_pct", "option.both_chance_pct"):
            self.assertRegex(text, r"\b%s %%" % re.escape(str(FACT[fact].value)), fact)
        self.assertNotRegex("\n".join(d["text"] for d in made.values()), r"\b1 items\b")


class Tabs(unittest.TestCase):
    def test_the_evidence_tabs_have_something_to_show(self):
        with tempfile.TemporaryDirectory() as home:
            state = app.build_state(Path(home), data=DATA)
        v = state["views"]
        self.assertEqual(v["sprint"]["burnup"][-1]["done"], FACT["sprint.done_sp"].value)
        self.assertEqual(len(v["sprint"]["burnup"]), FACT["sprint.day"].value)
        self.assertEqual([c["name"] for c in v["sprint"]["columns"]], ["To Do", "In Progress", "Blocked", "Review", "Done"])
        self.assertGreater(len(v["flow"]["cycle"]), 20)
        self.assertTrue(v["code"]["open"] and v["incidents"]["reports"] and state["services"]["apps"])
        self.assertEqual(len(state["notices"]), 4)
        self.assertEqual(sum(1 for c in v["hygiene"] if c["keys"]), 3)
        self.assertEqual(state["now"][0]["value"], "13 / 31")


if __name__ == "__main__":
    unittest.main()
