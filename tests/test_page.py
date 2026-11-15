"""The page files: what they promise each other, and the hosted copy of them under docs/demo."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import build_site  # noqa: E402
from sightline.server import FILES, WEB  # noqa: E402

read = lambda name: (WEB / name).read_text(encoding="utf-8")
SITE = ROOT / "docs" / "demo"


class Help(unittest.TestCase):
    def test_every_question_mark_has_a_text_and_every_text_a_place(self):
        texts = dict(re.findall(r'^  (\w+): "(.+)",$', read("help.js"), re.M))
        views = re.sub(r"plural\([^)]*\)", "", read("views.js") + read("quality.js"))
        asked = (set(re.findall(r'helpTip\("(\w+)"', read("app.js") + views)) | set(re.findall(r', "([a-z]+)"\)', views))
                 | set(re.findall(r'[`)], "([a-z]+)"\);', read("app.js"))))
        self.assertGreater(len(texts), 50)
        self.assertEqual(asked - set(texts), set())
        self.assertEqual(set(texts) - asked, set())
        for key, text in texts.items():
            self.assertGreater(len(text), 60, key)
            self.assertNotRegex(text, r"[<>]|\$\{", key)
        self.assertIn("pop.textContent = HELP[button.dataset.help]", read("help.js"))        # put into the page as text


class Palettes(unittest.TestCase):
    def test_every_palette_of_the_menu_has_all_the_colours(self):
        js, css = read("app.js"), read("style.css")
        names = re.findall(r'"?([\w-]+)"?: \["', js.split("const PALETTES = {")[1].split("};")[0])
        self.assertEqual(names[:2], ["sightline", "dusk"])
        blocks = {name: dict(re.findall(r"(--[\w-]+|color-scheme):\s*([^;]+);", re.search(r'\[data-palette="%s"\][^{\n]*\{\n(.*?)\n\}' % name, css, re.S).group(1)))
                  for name in names if name != "auto"}
        tokens = set(blocks["sightline"])
        self.assertGreater(len(tokens), 30)
        for name, block in blocks.items():
            self.assertEqual(set(block), tokens, name)
        self.assertEqual({blocks[n]["color-scheme"] for n in ("sightline", "day", "classic")}, {"light"})
        self.assertEqual({blocks[n]["color-scheme"] for n in ("dusk", "console", "night")}, {"dark"})
        self.assertEqual(set(re.findall(r"^const SWATCH = \{(.*?)\};", js, re.S | re.M)[0].replace('"', "").split(": [")[0:1]), {"sightline"})


class Tabs(unittest.TestCase):
    def test_every_tab_has_its_page_and_every_page_its_tab(self):
        html = read("index.html")
        tabs, pages = set(re.findall(r'data-tab="(\w+)"', html)), set(re.findall(r'<section class="page[^"]*" id="p-(\w+)"', html))
        self.assertEqual(tabs, pages)
        self.assertEqual(len(tabs), 11)

    def test_the_page_asks_for_everything_by_a_relative_address(self):
        for name, _ in FILES.values():                   # the hosted copy lives in a folder of a site, not at its root
            self.assertNotRegex(read(name), r'''(?:src|href)="/|fetch\(["'`]/''', name)
        self.assertEqual(sorted(set(re.findall(r'fetch\("(api/\w+)"', read("app.js") + read("views.js")))), ["api/ask", "api/outbox", "api/risks", "api/today"])

    def test_what_comes_from_the_data_is_shown_as_text(self):
        js = read("views.js")
        for field in ("r.title", "r.owner", "r.response", "s.text", "d.title"):
            self.assertIn(f"esc({field})", js, field)
        self.assertIn("keyed(c.title)", js)              # escaped too, with its issue keys made places for their cards
        self.assertIn("msg.textContent = ", js)          # an error text is never put in as HTML


class Hosted(unittest.TestCase):
    """docs/demo is the page for GitHub Pages: the same files, one state, and a script in the place of the server."""

    def test_the_hosted_copy_is_what_the_builder_writes(self):
        for name, _ in FILES.values():
            if name != "index.html":
                self.assertEqual((SITE / name).read_text(encoding="utf-8"), read(name), name)
        page = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertLess(page.index('src="host.js"'), page.index('src="app.js"'))
        self.assertEqual((SITE / "host.js").read_text(encoding="utf-8"), build_site.SHIM.read_text(encoding="utf-8"))
        state = build_site.state()
        self.assertEqual(json.loads((SITE / "state.json").read_text(encoding="utf-8")), json.loads(json.dumps(state)))
        self.assertEqual((state["register"]["risks"], state["inbox"]["sent"]), ([], []))       # nobody's notes are published

    def test_the_script_answers_what_the_page_asks(self):
        host = build_site.SHIM.read_text(encoding="utf-8")
        for path in ("api/today", "api/ask", "api/risks", "api/outbox"):
            self.assertIn(f'path === "{path}"', host, path)
        self.assertNotRegex(host, r"https?://")           # it sends nothing anywhere
        self.assertNotIn("localStorage", host)

    def test_the_site_holds_no_address_of_this_computer(self):
        for p in SITE.iterdir():
            text = p.read_text(encoding="utf-8")
            self.assertNotRegex(text, r"[A-Z]:\\\\|/Users/|/home/", p.name)


class Phone(unittest.TestCase):
    """The page on a phone: what the script and the style sheet have to agree on. How it looks is checked by eye."""

    def test_the_script_and_the_style_sheet_mean_the_same_phone(self):
        js, css = read("app.js"), read("style.css")
        in_js = re.findall(r'const PHONE = window\.matchMedia \? matchMedia\("\(max-width: (\d+)px\)"\)', js)
        block = css.split("/* ---- a phone.")[1].split("/* ---- the card of an issue")[0]
        self.assertEqual(in_js, re.findall(r"@media \(max-width:(\d+)px\)", block))       # one width, in both files
        self.assertEqual(len(in_js), 1)
        self.assertIn('<meta name="viewport" content="width=device-width, initial-scale=1">', read("index.html"))
        self.assertIn('PHONE.addEventListener("change", () => { if (state){ renderToday(); renderViews(); } });', js)       # a phone turned on its side is drawn anew

    def test_every_chart_takes_its_width_from_the_screen(self):
        charts = read("views.js") + read("quality.js")
        self.assertEqual(re.findall(r"\bw = (?:7|8|9)\d\d,", charts), [])    # no chart with the width of a desk of its own
        self.assertGreaterEqual(charts.count("w = chartW(),"), 11)
        self.assertIn("const chartW = () => PHONE.matches ? 350 : 760;", read("app.js"))

    def test_the_header_of_a_phone(self):
        html, css = read("index.html"), read("style.css").split("/* ---- a phone.")[1].split("/* ---- the card of an issue")[0]
        self.assertIn('aria-label="Notices"><svg class="bell-i"', html)      # an icon stands for the word, and the button keeps its name
        self.assertIn('aria-label="System">⚙<span class="t"> System</span>', html)
        for rule in (".top .seg{order:9;flex:1 0 100%;flex-wrap:nowrap;overflow-x:auto", ".top .grow,.top .pal,#refresh,.fresh,.top .btn .t{display:none}",
                     "table.t.stack tr{display:grid", "@media (pointer:coarse){"):
            self.assertIn(rule, css, rule)
        self.assertNotRegex(css, r"#[0-9a-fA-F]{6}\b|rgb\(")                 # its colours are the palette's
        self.assertIn("strip.scrollLeft = at.offsetLeft - strip.offsetLeft - (strip.clientWidth - at.offsetWidth) / 2;", read("app.js"))

    def test_a_tap_on_a_mark_shows_its_words_as_text(self):
        js = read("app.js")
        note = js.split("function showNote(anchor, text){")[1].split("\nfunction place")[0]
        self.assertIn("{textContent: text}", note)                           # what a chart says goes in as text, never as markup
        self.assertNotIn("${text}", note)
        self.assertIn('e.target.closest("svg.ch *")', js)
        self.assertLess(js.index("if (key) return pinCard(key);"), js.index("if (said) return showNote("))       # an issue key in a chart still opens its card


if __name__ == "__main__":
    unittest.main()
