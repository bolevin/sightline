"""The check of an agent's reply: a line is kept only if every number and every issue key in it is in the facts it cites."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app, demo  # noqa: E402
from sightline.page import check_page, rule_page  # noqa: E402
from sightline.today import Fact  # noqa: E402

FACTS = [Fact("notice.new_bugs_n", "operations", "new bugs in the last 24 hours", 3, "", ("KES-7",), "warning"),
         Fact("forecast.p85_done_sp", "promises", "done by the end, 85 % sure, at least", 29.0, "SP", (), "info"),
         Fact("backlog.blocked_n", "risks", "blocked items", 2, "", ("KES-8", "KES-9"), "warning"),
         Fact("backlog.unassigned_n", "risks", "items without an owner", 0, "", (), "ok")]


def kept(card: str, fact: str, text: str, facts=None, names=()) -> bool:
    reply = {"headline": {"text": "", "facts": []}, "cards": [{"id": card, "note": "", "rows": [{"facts": [fact], "level": "info", "text": text}]}]}
    return text in json.dumps(check_page(reply, facts or FACTS, None, names).page, ensure_ascii=False)


class Numbers(unittest.TestCase):
    def test_a_number_must_be_the_value_of_a_cited_fact(self):
        self.assertTrue(kept("risks", "backlog.blocked_n", "2 items are blocked: KES-8 and KES-9"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "3 items are blocked"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "2 items are blocked, 40 % of the sprint"))      # a share the agent worked out

    def test_a_number_of_the_label_is_no_number_of_the_fact(self):
        self.assertTrue(kept("operations", "notice.new_bugs_n", "3 new bugs in the last 24 hours"))
        self.assertFalse(kept("operations", "notice.new_bugs_n", "24 new bugs came in"))
        self.assertTrue(kept("promises", "forecast.p85_done_sp", "At least 29 SP will be done, 85 % sure"))
        self.assertFalse(kept("promises", "forecast.p85_done_sp", "85 SP will be done"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "8 items are blocked"))      # the digit of a key behind the fact

    def test_a_share_in_words_and_an_unfounded_nothing(self):
        self.assertFalse(kept("risks", "backlog.blocked_n", "Half of the work is blocked"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "Nothing is blocked"))
        self.assertTrue(kept("risks", "backlog.unassigned_n", "Nothing is without an owner"))        # the cited fact is zero
        usual = [Fact("plan.usual_p50_sp", "promises", "half of the past sprints completed at least", 22.0, "SP", (), "info")]
        self.assertTrue(kept("promises", "plan.usual_p50_sp", "Half of the past sprints completed at least 22 SP", usual))     # the fact's own words


class Keys(unittest.TestCase):
    def test_a_key_must_stand_behind_a_cited_fact(self):
        self.assertTrue(kept("risks", "backlog.blocked_n", "KES-8 is blocked"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "KES-10 is blocked"))
        self.assertFalse(kept("risks", "backlog.blocked_n", "kes-99999 is blocked"))                 # small letters are a key too
        self.assertTrue(kept("risks", "backlog.blocked_n", "kes-8 is blocked"))

    def test_the_name_of_a_sprint_is_no_issue_key(self):
        self.assertTrue(kept("risks", "backlog.blocked_n", "TEAM-12 Sprint has 2 blocked items", names=("TEAM-12 Sprint",)))
        self.assertFalse(kept("risks", "backlog.blocked_n", "TEAM-12 Sprint has 2 blocked items"))    # control: unnamed, it is a foreign key

    def test_a_line_must_cite_a_fact_that_exists(self):
        self.assertFalse(kept("risks", "backlog.made_up_n", "2 items are blocked"))


class Replies(unittest.TestCase):
    def test_what_is_no_page_falls_back_to_the_rules(self):
        for reply in ("", "not json", "[1, 2]", {"cards": 5}, {"headline": {"text": "x", "facts": []}, "cards": [{"id": "risks", "rows": 5}]}, "[" * 5000):
            checked = check_page(reply, FACTS)
            self.assertEqual(checked.page["by"], "rules", repr(reply)[:40])
            self.assertEqual([c["id"] for c in checked.page["cards"]], ["promises", "risks", "operations"])
        self.assertEqual(rule_page(FACTS)["by"], "rules")

    def test_the_problems_do_not_carry_the_whole_reply(self):
        rows = [{"facts": ["backlog.blocked_n"], "level": "info", "text": f"{n + 100} items " + "x" * 150} for n in range(40)]
        problems = check_page({"headline": {"text": "", "facts": []}, "cards": [{"id": "risks", "note": "", "rows": rows}]}, FACTS).problems
        self.assertTrue(problems and len(problems) <= 20 and all(len(p) <= 200 for p in problems))


class RecordedBriefing(unittest.TestCase):
    """The briefing that comes with the demo data is checked like a live reply; one of its lines is wrong on purpose."""

    @classmethod
    def setUpClass(cls):
        cls.state = app.build_state(ROOT / "tests" / "no-such-home", data=app.load_data(ROOT))      # a home without notes
        cls.reply = demo.briefing(app.find_data(ROOT, app.load_config(ROOT)))

    def test_all_lines_but_the_planted_one_pass(self):
        written = sum(len(card["rows"]) for card in self.reply["cards"])
        shown = sum(len(card["rows"]) for card in self.state["page"]["cards"] if card["by"] == "agent")
        self.assertEqual((written - shown, len(self.state["composed"]["problems"])), (1, 1))
        self.assertIn("which is not in the cited facts", self.state["composed"]["problems"][0])
        self.assertEqual({card["by"] for card in self.state["page"]["cards"]}, {"agent"})
        self.assertEqual(self.state["composed"]["by"], "agent")

    def test_every_line_shown_cites_facts_of_the_page(self):
        ids = {f["id"] for f in self.state["facts"]}
        for card in self.state["page"]["cards"]:
            for row in card["rows"]:
                self.assertTrue(row["facts"] and set(row["facts"]) <= ids, row["text"])

    def test_without_the_recording_the_rules_lay_out_the_page(self):
        data = app.load_data(ROOT)
        page = rule_page(data.facts)
        self.assertEqual(page["by"], "rules")
        self.assertTrue(all(card["rows"] for card in page["cards"]))


if __name__ == "__main__":
    unittest.main()
