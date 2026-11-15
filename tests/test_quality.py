"""The Quality tab: what code computes from the bugs, the facts it makes of it, and the check of the agent's lines."""
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import make_quality_data  # noqa: E402
from sightline import app, demo, page, quality  # noqa: E402
from sightline.server import FILES, WEB  # noqa: E402

DATA = app.load_data(ROOT)
VIEW = DATA.quality
RAW = json.loads((DATA.run.folder / quality.FILE).read_text(encoding="utf-8"))
FACTS = {f.id: f for f in DATA.facts if f.card == quality.CARD}
T0 = dt.datetime(2026, 3, 2, 9, 0, tzinfo=dt.timezone(dt.timedelta(hours=1)))
at = lambda days: (T0 + dt.timedelta(days=days)).isoformat(timespec="seconds")


def bug(key: str, created: float, closed: float | None = None, how: str = "Fixed", priority: str = "High", found_in: str = "Test", **more) -> dict:
    return {"key": key, "priority": priority, "created": at(created), "resolved": at(closed) if closed is not None else None, "resolution": how if closed is not None else None,
            "found_in": found_in, "found_by": "QA", "component": "api", "cause": "Regression" if closed is not None and how == "Fixed" else None, "feature": None, "reopened": 0, **more}


def view(bugs: list[dict], now: float = 38) -> dict:
    """What the tab computes for a handful of bugs: two increments of two sprints, ten days each; the last one is running."""
    sprints = [{"sprint": n, "name": f"Sprint {n}", "pi": "PI 1" if n < 3 else "PI 2", "start": at(10 * (n - 1)), "end": at(10 * n - 1), "running": n == 4, "committed_sp": 20.0,
                "completed_sp": 20.0, "added_pct": 5 * n, "unreviewed_pct": 3 * n, "release": "1.0" if n == 2 else None} for n in (1, 2, 3, 4)]
    raw = {"now": at(now), "targets_days": {"Highest": 2, "High": 5, "Medium": 15, "Low": 30}, "pis": [{"name": "PI 1", "first": 1, "last": 2}, {"name": "PI 2", "first": 3, "last": 4}],
           "sprints": sprints, "releases": [{"version": "1.0", "sprint": 2, "at": at(19)}], "bugs": bugs}
    with tempfile.TemporaryDirectory() as home:
        (Path(home) / quality.FILE).write_text(json.dumps(raw), encoding="utf-8")
        return quality.build(Path(home))


class Arithmetic(unittest.TestCase):
    """Each measure on a handful of bugs whose answer can be counted on one hand."""

    def test_an_open_bug_past_its_target_counts_as_missed(self):
        bugs = [bug("B-1", 21, 23), bug("B-2", 21, 30), bug("B-3", 22), bug("B-4", 37), bug("B-5", 25, 26, "Duplicate")]
        now = view(bugs)["pis"][-1]
        self.assertEqual((now["created"], now["resolved"], now["still_open"], now["fixed"], now["not_a_bug_pct"]), (5, 3, 2, 2, 20))
        self.assertEqual(now["kept_pct"], 33)            # B-1 kept it; B-2 was late; B-3 is open for 16 days against 5
        self.assertEqual(view(bugs[:2] + bugs[3:])["pis"][-1]["kept_pct"], 50)       # control: without the open late one it is 1 of 2
        self.assertEqual(view(bugs, now=26.5)["pis"][-1]["kept_pct"], 50)            # and while B-3 is within its target it is not judged either

    def test_a_severity_with_few_bugs_gets_counts_and_no_median(self):
        few = view([bug("B-1", 21, 23), bug("B-2", 21, 30), bug("B-3", 22)])["severity"][1]
        self.assertEqual((few["priority"], few["n"], few["fixed"], few["p50"], few["kept_pct"], few["kept"], few["judged"], few["late_open"]), ("High", 3, 2, None, None, 1, 3, ["B-3"]))
        many = view([bug(f"B-{n}", 21, 21 + n) for n in (1, 2, 3, 4, 9)])["severity"][1]
        self.assertEqual((many["fixed"], many["p50"], many["kept"], many["judged"], many["kept_pct"]), (5, 3.0, 4, 5, 80))

    def test_found_in_production_and_caught_before(self):
        v = view([bug("B-1", 21, 23), bug("B-2", 21, 30, found_in="Production"), bug("B-3", 22, found_in="Staging"), bug("B-4", 23), bug("B-5", 5, 6, found_in="Production")])
        now, was = v["pis"][-1], v["pis"][0]
        self.assertEqual((now["phases"], now["escaped"], now["escape_pct"], now["caught_pct"]), ([0, 2, 1, 1], 1, 25, 75))
        self.assertEqual((was["created"], was["escape_pct"]), (1, 100))
        self.assertEqual((v["escaped_keys"], v["top_component"]["pct"]), (["B-2"], 100))

    def test_a_bug_belongs_to_the_sprint_of_its_date(self):
        rows = view([bug("B-1", 21, 23, sprint=1), bug("B-2", 3, 12), bug("B-3", 35)])["sprints"]
        self.assertEqual([r["created"] for r in rows], [1, 0, 1, 1])        # whatever the file says about B-1
        self.assertEqual([r["resolved"] for r in rows], [0, 1, 1, 0])
        self.assertEqual([(r["created_sum"], r["resolved_sum"], r["open"]) for r in rows], [(1, 0, 1), (1, 1, 0), (2, 2, 0), (3, 2, 1)])

    def test_bug_debt_by_age(self):
        aging = view([bug("B-1", 1, priority="Low"), bug("B-2", 22), bug("B-3", 37, priority="Highest"), bug("B-4", 2, 9)])["aging"]
        self.assertEqual((aging["open"], [b["n"] for b in aging["buckets"]], aging["old"]), (3, [1, 1, 1, 0], ["B-1"]))
        self.assertEqual(aging["buckets"][0]["by_priority"], [1, 0, 0, 0])
        self.assertEqual(aging["oldest"][0], {"key": "B-1", "days": 37})

    def test_what_a_release_brought(self):
        bugs = [bug("B-1", 21, found_in="Production", priority="Medium"), bug("B-2", 32.9, found_in="Production", priority="Highest"), bug("B-3", 33.1, found_in="Production"), bug("B-4", 22), bug("B-5", 18, found_in="Production")]
        release = view(bugs)["releases"][0]
        self.assertEqual((release["bugs"], release["severe"], release["keys"], release["complete"]), (2, 1, ["B-1", "B-2"], True))        # not the one before it, not the one of day 15
        self.assertFalse(view(bugs, now=32)["releases"][0]["complete"])

    def test_services_with_as_many_bugs_stand_in_the_order_of_their_names(self):
        names = ["mail", "cart", "web", "api", "price", "pay", "search"]
        rows = view([bug(f"B-{n}", 21 + n, component=name) for n, name in enumerate(names)] + [bug("B-9", 30, component="web")])["components"]
        self.assertEqual([row["component"] for row in rows], ["web"] + sorted(set(names) - {"web"}))       # the same data gives the same page

    def test_causes_add_up(self):
        bugs = [bug(f"B-{n}", 21, 22) for n in range(4)] + [dict(bug("B-8", 21, 22), cause="Data"), bug("B-9", 22)]
        pareto = view(bugs)["pareto"]
        self.assertEqual([(c["cause"], c["n"], c["pct"], c["cum_pct"]) for c in pareto], [("Regression", 4, 80, 80), ("Data", 1, 20, 100)])


class Statistics(unittest.TestCase):
    def test_how_two_series_move_together(self):
        self.assertAlmostEqual(quality.pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), .8)
        self.assertAlmostEqual(quality.pearson([1, 2, 3], [9, 6, 3]), -1)
        self.assertIsNone(quality.pearson([1, 2, 3], [4, 4, 4]))            # a series that never moves moves with nothing
        self.assertIsNone(quality.pearson([1, 2], [1, 2]))

    def test_the_range_says_how_little_few_sprints_prove(self):
        found = quality.link([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])
        self.assertEqual((found["n"], found["r"], found["low"], found["high"], found["slope"], found["at_zero"]), (5, .8, -.28, .99, .8, .6))
        self.assertEqual(found["strength"], "strong, not certain")          # the range crosses 0
        many = quality.link(list(range(40)), [x + (3 if x % 2 else -3) for x in range(40)])
        self.assertEqual(many["strength"], "strong")
        self.assertGreater(many["low"], .8)
        self.assertEqual(quality.link([1, 2, 3, 4, 5, 6], [3, 1, 2, 3, 1, 2.2])["strength"], "no clear link")

    def test_survival_counts_the_open_bugs_too(self):
        now, day = T0 + dt.timedelta(days=10), lambda n: dt.timedelta(days=n)
        fixed = [{"created": T0, "resolved": T0 + day(n), "resolution": "Fixed"} for n in (1, 3, 5)]
        still = {"created": now - day(2), "resolved": None, "resolution": None}
        self.assertEqual(quality.survival(fixed + [still], now)[:6], [1.0, .75, .75, .375, .375, 0.0])
        self.assertEqual(quality.survival(fixed, now)[:6], [1.0, .667, .667, .333, .333, 0.0])           # control: the open bug changes the curve
        gone = {"created": T0, "resolved": T0 + day(2), "resolution": "Duplicate"}                       # closed without a fix: seen for two days, then out of the count
        self.assertEqual(quality.survival(fixed + [gone], now)[:6], [1.0, .75, .75, .375, .375, 0.0])
        self.assertEqual(len(quality.survival(fixed, now)), quality.SURVIVAL_DAYS + 1)


class DemoData(unittest.TestCase):
    def test_the_file_is_what_the_generator_writes(self):
        self.assertEqual(json.loads(json.dumps(make_quality_data.build())), RAW)
        self.assertEqual(json.loads(json.dumps(make_quality_data.build())), json.loads(json.dumps(make_quality_data.build())))

    def test_nobody_is_in_it(self):
        self.assertEqual({key for b in RAW["bugs"] for key in b}, {"key", "title", "priority", "created", "sprint", "resolved", "resolution", "status", "component", "found_in", "found_by",
                                                                 "cause", "feature", "reopened"})
        self.assertEqual({b["found_by"] for b in RAW["bugs"]}, {"Developer", "QA", "Monitoring", "Support", "Customer"})        # roles, never names

    def test_the_counts_add_up(self):
        rows, pis, total = VIEW["sprints"], VIEW["pis"], len(RAW["bugs"])
        closed = sum(1 for b in RAW["bugs"] if b["resolved"])
        self.assertEqual((rows[-1]["created_sum"], rows[-1]["resolved_sum"], rows[-1]["open"]), (total, closed, total - closed))
        self.assertEqual((sum(p["created"] for p in pis), sum(p["resolved"] for p in pis)), (total, closed))
        self.assertEqual((VIEW["aging"]["open"], sum(b["n"] for b in VIEW["aging"]["buckets"])), (total - closed, total - closed))
        for p in pis:
            self.assertEqual({sum(p["phases"]), sum(p["severity"]), sum(p["components"].values()), sum(p["found_by"].values())}, {p["created"]}, p["name"])
            self.assertEqual((p["phases"][-1], sum(p["components_escaped"].values())), (p["escaped"], p["escaped"]), p["name"])
            self.assertEqual(p["net"], p["created"] - p["resolved"], p["name"])
        for row in VIEW["components"]:
            self.assertEqual(sum(row["per_sprint"]), sum(row["per_pi"]), row["component"])
        self.assertEqual(len(VIEW["survival"]["curves"]), 3)
        self.assertEqual(sum(c["n"] for c in VIEW["survival"]["curves"]), total)

    def test_the_links_rest_on_full_sprints_only(self):
        self.assertEqual([found["id"] for found in VIEW["links"]], ["added_pct", "unreviewed_pct", "load_pct", "completed_sp"])
        for found in VIEW["links"]:
            self.assertEqual((found["n"], len(found["points"])), (len(VIEW["sprints"]) - 2, len(VIEW["sprints"]) - 2), found["id"])       # no pair for the first sprint, none into the running one
            self.assertTrue(-1 <= found["low"] <= found["r"] <= found["high"] <= 1, found["id"])
            self.assertEqual("not certain" in found["strength"] or found["strength"] == "no clear link", found["low"] * found["high"] <= 0 or abs(found["r"]) < .3, found["id"])

    def test_no_title_is_in_what_the_tab_computes(self):
        titles = [b["title"] for b in RAW["bugs"]]
        self.assertEqual(len(set(titles)), len(titles))
        shown = json.dumps(VIEW, ensure_ascii=False) + " ".join(f.text() for f in FACTS.values())
        self.assertIn(RAW["bugs"][0]["key"], json.dumps(app.cards.cards(DATA.run)))             # control: the keys are known to the cards
        self.assertEqual([t for t in titles if t in shown], [])


class Facts(unittest.TestCase):
    def test_the_facts_say_what_the_tab_shows(self):
        now, was = VIEW["pis"][-1], VIEW["pis"][-2]
        said = {name: FACTS[f"quality.{name}"].value for name in ("created_n", "open_n", "escaped_n", "escape_pct", "reopen_pct", "fix_p50_days", "kept_pct", "per_100_sp",
                                                                 "open_before_n", "escape_before_pct", "reopen_before_pct", "old_n", "net_per_sprint")}
        self.assertEqual(said, {"created_n": now["created"], "open_n": VIEW["aging"]["open"], "escaped_n": now["escaped"], "escape_pct": now["escape_pct"], "reopen_pct": now["reopen_pct"],
                                "fix_p50_days": now["fix_p50"], "kept_pct": now["kept_pct"], "per_100_sp": now["per_100_sp"], "open_before_n": was["open_end"],
                                "escape_before_pct": was["escape_pct"], "reopen_before_pct": was["reopen_pct"], "old_n": len(VIEW["aging"]["old"]), "net_per_sprint": VIEW["net_per_sprint"]})
        self.assertEqual(set(FACTS["quality.escaped_n"].keys), set(VIEW["escaped_keys"]))
        self.assertEqual(len(VIEW["escaped_keys"]), now["escaped"])
        for found in VIEW["links"]:
            self.assertEqual(FACTS[f"quality.link.{found['id']}"].value, found["r"])
        self.assertGreater(len(FACTS), 20)

    def test_they_stay_on_their_tab(self):
        with tempfile.TemporaryDirectory() as home:
            state = app.build_state(Path(home), data=DATA)
        on_today = [fact for card in state["page"]["cards"] for row in card["rows"] for fact in row["facts"]] + [fact for tile in state["now"] for fact in tile["facts"]]
        self.assertTrue(on_today)
        self.assertEqual([fact for fact in on_today if fact.startswith("quality.")], [])
        self.assertEqual(state["views"]["quality"]["pi"], VIEW["pi"])
        self.assertIsNone(quality.build(Path(home)))                         # a folder without bugs has no Quality view
        self.assertEqual(quality.facts(None), [])


class Findings(unittest.TestCase):
    """The lines under "What the numbers say": an agent words them, code checks them like every other line."""

    NAMES = tuple(sorted({p["name"] for p in VIEW["pis"]} | {s["name"] for s in VIEW["sprints"]}, key=len, reverse=True))

    def check(self, *rows):
        return page.check_lines(list(rows), list(FACTS.values()), self.NAMES, "finding")

    def line(self, text, *facts, level="warning"):
        return {"text": text, "facts": list(facts), "level": level}

    def test_the_recording_passes_but_for_the_planted_line(self):
        found = app.findings(DATA, DATA.facts)
        recorded = demo.findings(DATA.run.folder)
        self.assertEqual((found["by"], len(found["rows"]), len(found["problems"])), ("agent", len(recorded) - 1, 1))
        self.assertIn("doubled", found["problems"][0])
        self.assertGreaterEqual(len(found["rows"]), 8)
        for row in found["rows"]:
            self.assertTrue(row["facts"] and all(fact in FACTS for fact in row["facts"]), row)
            self.assertIn(row["level"], ("critical", "warning", "info"))
        self.assertEqual(found["rows"][0]["level"], "critical")              # the most serious first

    def test_a_number_must_be_in_the_facts_the_line_cites(self):
        good = self.line(f"{FACTS['quality.open_n'].value} bugs are open now.", "quality.open_n")
        self.assertEqual(self.check(good), ([{"facts": ["quality.open_n"], "level": "warning", "text": good["text"]}], []))
        kept, problems = self.check(self.line("31 bugs are open now.", "quality.open_n"))
        self.assertEqual((kept, len(problems)), ([], 1))
        self.assertIn("finding 1: states 31", problems[0])
        kept, problems = self.check(good, self.line(good["text"], "quality.old_n"))             # the right number, the wrong fact
        self.assertEqual((len(kept), len(problems)), (1, 1))
        self.assertIn("finding 2", problems[0])

    def test_the_name_of_an_increment_is_no_number(self):
        text = f"{VIEW['pi']} has {FACTS['quality.created_n'].value} bugs so far."
        self.assertEqual(len(self.check(self.line(text, "quality.created_n"))[0]), 1)
        kept, problems = page.check_lines([self.line(text, "quality.created_n")], list(FACTS.values()), (), "finding")           # control: without the names it is a number
        self.assertEqual((kept, len(problems)), ([], 1))

    def test_what_is_no_line_is_dropped(self):
        open_n = FACTS["quality.open_n"].value
        kept, problems = self.check("a text", self.line(f"{open_n} open.", "quality.open_n", level="loud"), self.line(f"{open_n} open."), self.line("", "quality.open_n"),
                                    self.line(f"{open_n} open.", "quality.nowhere"), self.line("Half of the bugs are open.", "quality.open_n"))
        self.assertEqual((kept, len(problems)), ([], 6))
        self.assertEqual(page.check_lines({"rows": 1}, list(FACTS.values())), ([], []))
        many = [self.line(f"{open_n} bugs are open.", "quality.open_n")] * (page.MAX_LINES + 5)
        self.assertEqual(len(self.check(*many)[0]), page.MAX_LINES)

    def test_without_a_recording_the_rules_lay_it_out(self):
        real = demo.findings
        try:
            demo.findings = lambda folder: None
            found = app.findings(DATA, DATA.facts)
        finally:
            demo.findings = real
        loud = [f.id for f in FACTS.values() if f.level in ("critical", "warning")]
        self.assertEqual((found["by"], [row["facts"] for row in found["rows"]], found["problems"]), ("rules", [[fid] for fid in loud], []))
        self.assertTrue(loud)
        self.assertEqual(found["rows"][0]["text"], FACTS[loud[0]].text())


class OnThePage(unittest.TestCase):
    def test_the_tab_is_served_and_drawn(self):
        self.assertEqual(FILES["/quality.js"][0], "quality.js")
        html, views = (WEB / "index.html").read_text(encoding="utf-8"), (WEB / "views.js").read_text(encoding="utf-8")
        self.assertIn('data-tab="quality"', html)
        self.assertLess(html.index('src="views.js"'), html.index('src="quality.js"'))
        self.assertIn("renderQuality();", views)

    def test_what_comes_from_the_data_is_shown_as_text(self):
        js = (WEB / "quality.js").read_text(encoding="utf-8")
        for field in ("c.component", "c.cause", "p.name", "r.name", "l.strength", "o.key", "s.priority", "f.id", "who"):
            self.assertIn(f"esc({field})", js, field)
        for field in ("r.text", "p", "f.text"):
            self.assertIn(f"keyed({field})", js, field)                      # a line of the agent and what the check said about it
        self.assertNotRegex(js, r"\$\{(?:r\.text|c\.component|c\.cause|l\.strength|l\.x|l\.y|p\.name|f\.feature)\}")
        self.assertNotIn("fetch(", js)                                       # the tab asks nothing of its own

    def test_its_colours_are_the_palette_s(self):
        css = (WEB / "style.css").read_text(encoding="utf-8").split("/* ---- Quality")[1].split("/* ---- the card of an issue")[0]
        self.assertNotRegex(css, r"#[0-9a-fA-F]{3,6}\b")
        self.assertNotRegex((WEB / "quality.js").read_text(encoding="utf-8"), r"#[0-9a-fA-F]{6}\b|rgb\(")
        for token in ("--sev1", "--sev4", "--ph1", "--ph4", "--made-soft"):
            self.assertIn(token + ":", css, token)


if __name__ == "__main__":
    unittest.main()
