"""The card of an issue: it shows the title, and the title goes nowhere else."""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app, cards, page, tools  # noqa: E402

DATA = app.load_data(ROOT)
CARDS = cards.cards(DATA.run, DATA.on_board)
SPRINT = cards.sprint_cards(DATA.run, DATA.on_board)
BUGS = {b["key"] for b in json.loads((DATA.run.folder / "quality.json").read_text(encoding="utf-8"))["bugs"]}
TITLES = sorted({card["title"] for card in CARDS.values()})
WEB = ROOT / "sightline" / "web"


def state() -> dict:
    with tempfile.TemporaryDirectory() as home:
        return app.build_state(Path(home), data=DATA)


class Cards(unittest.TestCase):
    def test_every_issue_has_a_card_with_a_title(self):
        self.assertEqual(set(SPRINT), set(DATA.run.issues))
        self.assertEqual(set(CARDS), set(SPRINT) | BUGS)                     # and every bug the Quality tab names
        self.assertGreater(len(BUGS - set(SPRINT)), 100)
        self.assertGreater(len(CARDS), 100)
        self.assertEqual(len(TITLES), len(CARDS))                            # no two issues share a title
        for key, card in CARDS.items():
            self.assertTrue(8 < len(card["title"]) <= cards.MAX_TITLE, key)
            self.assertIn(card["priority"], ("Highest", "High", "Medium", "Low"), key)
            if key in SPRINT:
                self.assertEqual((card["type"], card["sp"]), (DATA.run.issues[key].type, DATA.run.issues[key].points), key)
            else:
                self.assertEqual((card["type"], card["sp"], card["team"]), ("Bug", None, None), key)

    def test_a_card_says_where_the_issue_stands(self):
        blocked = DATA.run.issues["KES-1290"]
        self.assertEqual({k: CARDS["KES-1290"][k] for k in ("type", "status", "priority", "sp", "feature", "team")},
                         {"type": "Story", "status": "Blocked", "priority": "High", "sp": blocked.points, "feature": blocked.feature, "team": None})
        self.assertEqual(CARDS["PAY-2291"]["team"], "Atlas")                 # an issue of another team says whose it is
        self.assertEqual(state()["cards"], json.loads(json.dumps(CARDS)))

    def test_a_title_that_is_too_long_or_missing(self):
        raw = lambda key, fields: {"key": key, "fields": fields}
        run = DATA.run
        real = cards._raw
        try:
            cards._raw = lambda r: [raw("KES-1290", {"summary": "x" * 500, "priority": None}), raw("KES-1391", {"summary": 5})]
            made = cards.cards(run)
        finally:
            cards._raw = real
        self.assertEqual((len(made["KES-1290"]["title"]), made["KES-1290"]["priority"], made["KES-1391"]["title"], made["KES-1422"]["title"]),
                         (cards.MAX_TITLE, "", "", ""))


class ForYourEyesOnly(unittest.TestCase):
    """No fact, no draft and no agent gets a title: it is in the state under "cards" and nowhere else."""

    def holds_a_title(self, value) -> list[str]:
        text = json.dumps(value, ensure_ascii=False)
        return [title for title in TITLES if title in text]

    def test_the_state_holds_titles_in_the_cards_only(self):
        s = state()
        self.assertTrue(self.holds_a_title(s["cards"]))                      # control: the search finds them where they are
        rest = {name: value for name, value in s.items() if name != "cards"}
        self.assertEqual(self.holds_a_title(rest), [])

    def test_the_tools_for_an_agent_give_no_title(self):
        call = lambda name, **arguments: tools.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}, lambda: DATA)
        answers = [call("facts"), call("sprint"), call("forecast")] + [call("issue", key=key) for key in ("KES-1290", "KES-1391", "KES-1422", "KES-1360")]
        for answer in answers:
            self.assertFalse(answer["result"]["isError"])
            self.assertEqual(self.holds_a_title(answer), [])
        self.assertEqual(self.holds_a_title(tools.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, lambda: DATA)), [])

    def test_what_words_and_checks_a_text_cannot_reach_the_titles(self):
        for name in ("facts", "sprint_scope", "today", "forecast", "premortem", "risks", "drafts", "journal", "page", "tools", "views", "quality"):
            source = (ROOT / "sightline" / f"{name}.py").read_text(encoding="utf-8")
            self.assertNotRegex(source, re.compile(r"^from \.cards|^from \. import [^\n]*\bcards\b|^import [^\n]*\bcards\b|summary", re.M), name)
        self.assertFalse(hasattr(DATA.run.issues["KES-1290"], "title"))      # the fact layer has no field for it
        self.assertNotIn("cards", page.__dict__)
        self.assertNotIn("cards", tools.__dict__)


class OnThePage(unittest.TestCase):
    def test_a_key_becomes_a_place_for_its_card_only_after_escaping(self):
        js = (WEB / "app.js").read_text(encoding="utf-8")
        self.assertIn("const keyed = s => esc(s).replace(", js)
        self.assertIn("state.cards[k] ? `<span class=\"ik\" data-issue=\"${k}\">${k}</span>` : k", js)      # only keys the data holds
        card = js.split("function issueCard(k){")[1].split("\nfunction showCard")[0]
        for field in ("c.title", "c.type", "c.status", "c.priority", "k"):
            self.assertIn(f"esc({field})", card, field)
        self.assertNotRegex(card, r"\$\{c\.(title|status|type|priority)\}")       # nothing of the data goes in unescaped
        self.assertIn("about.map(esc)", card)            # nor the line under the card, which names the feature and the team
        self.assertIn('<div class="icard" id="icard" hidden role="tooltip"></div>', (WEB / "index.html").read_text(encoding="utf-8"))

    def test_the_card_opens_on_hover_on_focus_and_stays_on_a_click(self):
        js = (WEB / "app.js").read_text(encoding="utf-8")
        for event in ("mouseover", "mouseout", "focusin", "focusout"):
            self.assertIn(f'document.addEventListener("{event}", e => hoverCard(e, ', js)
        self.assertRegex(js, r'const key = e\.target\.closest\("\[data-issue\]"\);\s+if \(key\) return pinCard\(key\);')
        self.assertIn("dropCard(); openAsk(false);", js)                     # Escape closes it
        css = (WEB / "style.css").read_text(encoding="utf-8")
        for rule in (".icard{", ".icard.bug{", ".ic-st.blocked{", ".ic-pr.top i{", ".ik{"):
            self.assertIn(rule, css, rule)
        self.assertNotRegex(css.split("/* ---- the card of an issue")[1], r"#[0-9a-fA-F]{3,6}\b")      # its colours are the palette's


if __name__ == "__main__":
    unittest.main()
