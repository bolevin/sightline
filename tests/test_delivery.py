"""Builds and deploys on the Code tab: what code computes from the build server, the facts it makes of it, the data."""
import datetime as dt
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import make_build_data  # noqa: E402
from sightline import app, delivery, demo, quality  # noqa: E402
from sightline.server import FILES, WEB  # noqa: E402

DATA = app.load_data(ROOT)
VIEW = DATA.delivery
RAW = json.loads((DATA.run.folder / delivery.FILE).read_text(encoding="utf-8"))
FACTS = {f.id: f for f in DATA.facts if f.card == delivery.CARD}
ZONE = dt.timezone(dt.timedelta(hours=1))
T0 = dt.datetime(2026, 3, 2, 9, 0, tzinfo=ZONE)            # a Monday
at = lambda hours: (T0 + dt.timedelta(hours=hours)).isoformat(timespec="seconds")
DAY = 24


def change(cid: str, merged: float, repo: str = "R") -> dict:
    return {"id": cid, "repo": repo, "merged": at(merged)}


def ran(number: int, started: float, minutes: float = 10, result: str = "SUCCESS", trigger: str = "merge", repo: str = "R", stage: str | None = None) -> dict:
    return {"repo": repo, "number": number, "started": at(started), "finished": at(started + minutes / 60), "result": result,
            "stage": stage or (None if result == "SUCCESS" else "Unit tests"), "trigger": trigger, "change": None}


def deploy(number: int, version: str, kind: str, hours: float, services=("a",), changes=()) -> dict:
    return {"number": number, "version": version, "kind": kind, "at": at(hours), "services": list(services), "changes": list(changes)}


def view(deploys: list[dict], changes=(), builds=(), cuts=(), now: float = 30 * 7 * DAY, incidents=None) -> dict:
    """What the panels compute from a handful of records: the data begins at T0, the last twelve weeks end at `now`."""
    raw = {"now": at(now), "from": at(0), "repos": ["R"], "services": {"a": "R", "b": "R"}, "changes": list(changes), "builds": list(builds) or [ran(1, 0)],
           "cuts": list(cuts), "deploys": deploys}
    with tempfile.TemporaryDirectory() as home:
        (Path(home) / delivery.FILE).write_text(json.dumps(raw), encoding="utf-8")
        return delivery.build(Path(home), incidents)


class Arithmetic(unittest.TestCase):
    """Each measure on a handful of records whose answer can be counted on one hand."""

    def test_hours_without_weekends(self):
        friday_evening = T0 + dt.timedelta(days=4, hours=9)           # Friday 18:00
        self.assertEqual(delivery.weekday_hours(friday_evening, friday_evening + dt.timedelta(hours=60)), 12)      # 6 on Friday, 6 on Monday
        self.assertEqual(delivery.weekday_hours(T0, T0 + dt.timedelta(hours=10)), 10)                              # control: a Monday counts whole

    def test_main_is_red_until_a_build_passes(self):
        builds = [ran(1, 0), ran(2, 2, result="FAILURE"), ran(3, 3, result="FAILURE"), ran(4, 5), ran(5, 7, result="FAILURE")]
        now = T0 + dt.timedelta(hours=9)
        found = delivery.red_stretches([dict(b, started=dt.datetime.fromisoformat(b["started"]), finished=dt.datetime.fromisoformat(b["finished"])) for b in builds], now)
        self.assertEqual([(round(delivery._hours(T0, a), 2), round(delivery._hours(T0, b), 2), still) for a, b, still in found],
                         [(2.17, 5.17, False), (7.17, 9.0, True)])     # the second failure in a row does not start a new stretch

    def test_a_rollback_or_a_quick_hotfix_repairs_what_came_before(self):
        deploys = [deploy(1, "1.0.0", "release", 0, ("a", "b")), deploy(2, "1.0.1", "hotfix", 30, ("a",)), deploy(3, "1.1.0", "release", 200, ("a", "b")),
                   deploy(4, "1.1.1", "hotfix", 250, ("b",)), deploy(5, "1.1.2", "hotfix", 300, ("a",)), deploy(6, "1.1.1", "rollback", 330, ("a",))]
        fixed = delivery.repairs([dict(d, at=dt.datetime.fromisoformat(d["at"])) for d in deploys])
        self.assertEqual({n: r["version"] for n, r in fixed.items()}, {1: "1.0.1", 5: "1.1.1"})
        # 1.0.1 came 30 hours after 1.0.0; 1.1.1 came 50 hours after 1.1.0: too late to be its repair; 1.1.2 was rolled back
        later = [dict(d, at=dt.datetime.fromisoformat(d["at"])) for d in deploys[:1] + [deploy(2, "1.0.1", "hotfix", 49, ("a",))]]
        self.assertEqual(delivery.repairs(later), {})                  # control: the same hotfix a day later repairs nothing

    def test_the_first_repair_counts(self):
        deploys = [deploy(1, "1.0.0", "release", 0, ("a", "b")), deploy(2, "1.0.0", "rollback", 20, ("b",)), deploy(3, "1.0.1", "hotfix", 10, ("a",))]
        fixed = delivery.repairs(sorted(({**d, "at": dt.datetime.fromisoformat(d["at"])} for d in deploys), key=lambda d: d["at"]))
        self.assertEqual({n: (r["version"], r["kind"]) for n, r in fixed.items()}, {1: ("1.0.1", "hotfix")})       # after 10 hours, not 20

    def test_only_the_next_deploy_of_a_service_can_repair(self):
        deploys = [deploy(1, "1.0.0", "release", 0, ("a",)), deploy(2, "1.0.1", "hotfix", 5, ("b",)), deploy(3, "1.0.2", "hotfix", 10, ("b",))]
        fixed = delivery.repairs([dict(d, at=dt.datetime.fromisoformat(d["at"])) for d in deploys])
        self.assertEqual({n: r["version"] for n, r in fixed.items()}, {2: "1.0.2"})        # b's hotfix says nothing about a's release

    def test_failed_share_and_time_to_restore(self):
        now = 30 * 7 * DAY
        last = now - 12 * 7 * DAY
        deploys = [deploy(1, "1.0.0", "release", last + 10, ("a",)), deploy(2, "1.0.1", "hotfix", last + 16, ("a",)), deploy(3, "1.1.0", "release", last + 500, ("a",)),
                   deploy(4, "1.0.1", "rollback", last + 504, ("a",)), deploy(5, "0.9.0", "release", last - 100, ("a",)), deploy(6, "0.9.1", "hotfix", last, ("b",))]
        v = view(deploys)
        m = v["last"]
        self.assertEqual((m["deploys"], m["releases"], m["hotfixes"], m["rollbacks"], m["can_fail"], m["failed"], m["failed_pct"]), (5, 2, 2, 1, 4, 2, 50))
        self.assertEqual((m["restore_p50"], m["restore_max"]), (5.0, 6.0))
        self.assertEqual((v["before"]["deploys"], v["before"]["failed_pct"]), (1, 0))     # the old release held: nothing came within 48 hours
        self.assertEqual([d["window"] for d in v["deploys"]], ["last", "last", "last", "last", "last", "before"])      # 0.9.1 came at the very start of the window

    def test_lead_time_and_where_it_goes(self):
        now = 30 * 7 * DAY
        base = now - 10 * DAY
        changes = [change("c1", base), change("c2", base + 50), change("c3", base + 100)]
        builds = [ran(1, base + 1), ran(2, base + 50.5, result="FAILURE"), ran(3, base + 53), ran(4, base + 100.2)]
        cuts = [{"version": "2.0.0", "at": at(base + 72), "changes": ["c1", "c2"]}]
        deploys = [deploy(1, "2.0.0", "release", base + 144, changes=("c1", "c2")), deploy(2, "2.0.1", "hotfix", base + 102, changes=("c3",))]
        v = view(deploys, changes, builds, cuts, now=now)
        m = v["last"]
        self.assertEqual(m["changes"], 3)
        self.assertEqual(m["lead_p50"], round(94 / 24, 1))                              # 144, 94 and 2 hours: the middle one
        self.assertEqual((m["share"]["build"], m["share"]["wait"], m["share"]["testing"]), (2, 38, 60))
        # of 240 hours: c1 1.17 h build, 70.8 h wait, 72 h testing; c2 3.17 h build (main was red), 18.8 h wait, 72 h testing; c3 0.37 h, 1.63 h, no testing
        self.assertEqual(m["build_h_p50"], 1.2)
        self.assertEqual(v["waiting"], {"n": 0, "oldest_days": None, "cut": None})
        more = view(deploys, changes + [change("c4", base + 200)], builds, cuts + [{"version": "2.1.0", "at": at(base + 210), "changes": ["c4"]}], now=now)
        self.assertEqual(more["waiting"], {"n": 1, "oldest_days": 2, "cut": {"version": "2.1.0", "at": at(base + 210)[:16] + at(base + 210)[19:], "changes": 1}})

    def test_a_change_counts_when_it_first_reaches_production(self):
        now = 30 * 7 * DAY
        base = now - 10 * DAY
        deploys = [deploy(1, "2.0.1", "hotfix", base + 5, changes=("c1",)), deploy(2, "2.1.0", "release", base + 100, changes=("c1",))]
        m = view(deploys, [change("c1", base)], [ran(1, base + 1)], now=now)["last"]
        self.assertEqual((m["changes"], m["lead_p50"]), (1, round(5 / 24, 1)))      # by the hotfix after 5 hours, not by the release after 100

    def test_a_build_that_passes_when_run_again(self):
        now = 30 * 7 * DAY
        base = now - 20 * DAY
        builds = [ran(1, base), ran(2, base + 1, result="FAILURE", stage="Integration tests"), ran(3, base + 2, trigger="re-run"),
                  ran(4, base + 3, result="FAILURE", stage="Compile"), ran(5, base + 4, result="FAILURE", stage="Compile", trigger="re-run"), ran(6, base + 6)]
        m = view([deploy(1, "1.0.0", "release", base)], builds=builds, now=now)["last"]
        self.assertEqual((m["builds"], m["broke"], m["rerun_passed"], m["stages"]), (6, 3, 1, {"Compile": 2, "Integration tests": 1}))
        self.assertEqual(m["red_h"], 4.0)                                # an hour until the re-run passed, then 3 hours until build 6

    def test_a_re_run_counts_on_its_own_main_only(self):
        now = 30 * 7 * DAY
        base = now - 20 * DAY
        rerun = lambda repo: [ran(1, base, result="FAILURE"), ran(7, base + .5, trigger="re-run", repo=repo), ran(2, base + 1)]
        self.assertEqual(view([deploy(1, "1.0.0", "release", base)], builds=rerun("S"), now=now)["last"]["rerun_passed"], 0)    # the other repository ran again
        self.assertEqual(view([deploy(1, "1.0.0", "release", base)], builds=rerun("R"), now=now)["last"]["rerun_passed"], 1)    # control: the same on its own main

    def test_an_incident_report_is_shown_next_to_the_deploy_before_it(self):
        deploys = [deploy(1, "1.0.0", "release", 30 * 7 * DAY - 100, ("a", "b"))]
        reports = {"reports": [{"at": at(30 * 7 * DAY - 90), "title": "Cart", "service": "b"}, {"at": at(30 * 7 * DAY - 60), "title": "Late", "service": "a"},
                               {"at": at(30 * 7 * DAY - 95), "title": "Other", "service": "c"}]}
        self.assertEqual([r["title"] for r in view(deploys, incidents=reports)["deploys"][0]["incidents"]], ["Cart"])


class DemoData(unittest.TestCase):
    def test_the_file_is_what_the_generator_writes(self):
        self.assertEqual(json.loads(json.dumps(make_build_data.build())), RAW)

    def test_nobody_is_in_it(self):
        self.assertEqual({key for c in RAW["changes"] for key in c}, {"id", "repo", "merged"})              # a commit without an author or a message
        self.assertEqual({key for b in RAW["builds"] for key in b}, {"repo", "number", "started", "finished", "result", "stage", "trigger", "change"})
        self.assertEqual({key for d in RAW["deploys"] for key in d}, {"number", "version", "kind", "at", "services", "changes"})

    def test_it_agrees_with_the_other_data_of_the_demo(self):
        code = DATA.extras["code"]
        since = dt.datetime.fromisoformat(RAW["now"]) - dt.timedelta(days=code["window_days"])
        merged = [c for c in RAW["changes"] if dt.datetime.fromisoformat(c["merged"]) >= since]
        self.assertEqual(len(merged), code["merged"])                   # the pull requests merged in the window of the Code tab
        self.assertEqual({c["repo"] for c in RAW["changes"]}, set(code["repos"]))
        bugs = quality.load(DATA.run.folder)
        releases = {r["version"] + ".0": r["at"] for r in bugs["releases"]}
        shipped = {d["version"]: dt.datetime.fromisoformat(d["at"]) for d in RAW["deploys"] if d["kind"] == "release"}
        self.assertTrue(shipped)
        self.assertEqual({v: t for v, t in releases.items() if v in shipped}, shipped)      # the releases of the Quality tab, at the same minute
        self.assertEqual(set(RAW["services"]), {c["component"] for c in bugs["bugs"]})

    def test_every_change_reaches_production_once_at_most(self):
        carried = [cid for d in RAW["deploys"] for cid in d["changes"]]
        self.assertEqual(len(carried), len(set(carried)))
        ids = {c["id"] for c in RAW["changes"]}
        self.assertEqual(set(carried) - ids, set())
        for cut in RAW["cuts"]:
            out = next((d for d in RAW["deploys"] if d["version"] == cut["version"]), None)
            self.assertTrue(out is None or out["changes"] == cut["changes"], cut["version"])

    def test_the_incident_reports_stand_where_the_deploys_put_them(self):
        near = {(d["version"], d["kind"]): [r["title"] for r in d["incidents"]] for d in VIEW["deploys"] if d["incidents"]}
        self.assertEqual(near, {("4.19.0", "release"): ["Card payments"], ("4.18.2", "hotfix"): ["Checkout"], ("4.18.1", "hotfix"): ["Cart"]})
        failed = {d["version"]: d["repair"]["version"] for d in VIEW["deploys"] if d["failed"]}
        self.assertEqual(failed, {"4.19.0": "4.19.1", "4.18.2": "4.18.0", "4.17.0": "4.17.1", "4.16.0": "4.16.1", "4.14.0": "4.14.1"})


class Facts(unittest.TestCase):
    def test_the_facts_say_what_the_panels_show(self):
        now, was, w = VIEW["last"], VIEW["before"], VIEW["waiting"]
        said = {name: FACTS[f"delivery.{name}"].value for name in ("deploys_n", "deploys_before_n", "lead_p50_days", "lead_p85_days", "lead_before_p50_days", "failed_pct",
                                                                   "failed_n", "failed_before_pct", "restore_p50_hours", "red_pct", "red_before_pct", "rerun_passed_n", "waiting_n")}
        self.assertEqual(said, {"deploys_n": now["deploys"], "deploys_before_n": was["deploys"], "lead_p50_days": now["lead_p50"], "lead_p85_days": now["lead_p85"],
                                "lead_before_p50_days": was["lead_p50"], "failed_pct": now["failed_pct"], "failed_n": now["failed"], "failed_before_pct": was["failed_pct"],
                                "restore_p50_hours": now["restore_p50"], "red_pct": now["red_pct"], "red_before_pct": was["red_pct"], "rerun_passed_n": now["rerun_passed"],
                                "waiting_n": w["n"]})
        self.assertEqual(FACTS["delivery.failed_n"].unit, f"of {now['can_fail']}, rollbacks not counted")
        self.assertEqual(FACTS["delivery.release_failed_n"].unit, f"of {VIEW['batches'][0]['n']}")
        self.assertGreater(len(FACTS), 20)

    def test_they_stay_on_their_tab(self):
        with tempfile.TemporaryDirectory() as home:
            state = app.build_state(Path(home), data=DATA)
            self.assertIsNone(delivery.build(Path(home)))                # a folder without a build server has no panels
        on_today = [fact for card in state["page"]["cards"] for row in card["rows"] for fact in row["facts"]] + [fact for tile in state["now"] for fact in tile["facts"]]
        self.assertTrue(on_today)
        self.assertEqual([fact for fact in on_today if fact.startswith("delivery.")], [])
        self.assertEqual(state["views"]["delivery"]["now"], RAW["now"][:16] + RAW["now"][19:])
        self.assertEqual(delivery.facts(None), [])

    def test_the_recorded_answer_says_only_what_the_facts_say(self):
        answer = next(row["a"] for row in demo.questions(DATA.run.folder) if row["kind"] == "Delivery")
        told = " ".join(f.text() for f in FACTS.values())
        numbers = lambda text: set(re.findall(r"\d+(?:\.\d+)?", re.sub(r"\b\d+\.\d+\.\d+\b|\(delivery\.\w+\)", "", text)))
        self.assertEqual(numbers(answer) - numbers(told), set())
        self.assertIn("4.20.0", answer)
        self.assertNotEqual(numbers(answer.replace("16.1 days", "16.4 days")) - numbers(told), set())        # control: a number the facts do not hold is caught


class OnThePage(unittest.TestCase):
    def test_the_panels_are_served_and_drawn(self):
        self.assertEqual(FILES["/delivery.js"][0], "delivery.js")
        html, views = (WEB / "index.html").read_text(encoding="utf-8"), (WEB / "views.js").read_text(encoding="utf-8")
        self.assertLess(html.index('src="quality.js"'), html.index('src="delivery.js"'))      # it draws with the axis and the arrows of the Quality tab
        code = views.split("function renderCode(){")[1].split("\n}")[0]
        self.assertEqual(code.count("deliveryPanels()"), 2)             # with pull requests and without

    def test_what_comes_from_the_data_is_shown_as_text(self):
        js = (WEB / "delivery.js").read_text(encoding="utf-8")
        for field in ("d.version", "d.kind", "s", "r.title", "r.service", "name", "d.changes", "v.waiting.cut.version"):
            self.assertIn(f"esc({field})", js, field)
        said = re.search(r"const said = .*?;\n", js).group(0)        # the words of a mark: escaped as a whole where they are put in
        self.assertEqual(js.count("<title>${esc(said)}</title>"), 2)
        self.assertEqual(re.findall(r"\$\{(?:d\.version|d\.kind|r\.title|r\.service|name|s)\}", js.replace(said, "")), [])
        self.assertNotIn("fetch(", js)                                       # the panels ask nothing of their own

    def test_its_colours_are_the_palette_s(self):
        css = (WEB / "style.css").read_text(encoding="utf-8").split("/* ---- builds and deploys")[1].split("/* ---- ")[0]
        self.assertIn(".ch .d-bad{fill:var(--crit)", css)
        self.assertNotRegex(css, r"#[0-9a-fA-F]{3,6}\b|rgb\(")
        self.assertNotRegex((WEB / "delivery.js").read_text(encoding="utf-8"), r"#[0-9a-fA-F]{3,6}\b|rgb\(")


if __name__ == "__main__":
    unittest.main()
