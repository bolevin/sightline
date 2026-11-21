"""The design demo of version 2 under docs/v2: static pages with invented numbers, and they say so."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"
read = lambda name: (V2 / name).read_text(encoding="utf-8")
FILES = [p for p in V2.rglob("*") if p.is_file()]


class Page(unittest.TestCase):
    def test_everything_the_page_loads_is_there_and_nothing_else(self):
        loaded = set(re.findall(r'(?:src|href)="((?:css|js)/[^"]+)"', read("index.html")))
        self.assertGreater(len(loaded), 30)
        self.assertEqual({p.relative_to(V2).as_posix() for p in FILES} - {"index.html"}, loaded)

    def test_it_asks_nothing_of_the_outside(self):
        for p in FILES:
            text = p.read_text(encoding="utf-8")
            self.assertEqual(re.findall(r"https?://[^\s\"'`]+", text), [], p.name)
            self.assertNotIn("fetch(", text, p.name)
            self.assertEqual(re.findall(r"[A-Z]:\\\\|/Users/|(?<!#)/home/[a-z]", text), [], p.name)       # #/home/... is an address of the page

    def test_it_says_that_its_numbers_are_invented(self):
        shell = read("js/shell.js")
        self.assertIn("v2 demo · invented data", shell)
        self.assertIn("are invented and prepared by hand", shell)
        self.assertIn('<a class="demo-pill" href="../demo/"', shell)
        self.assertIn("return `<button class=\"menu-btn\"", shell)           # the mark stands in the top bar of every page
        self.assertTrue((ROOT / "docs" / "demo" / "index.html").exists())    # the way to the version that computes its numbers

    def test_the_address_of_the_demo_opens_it(self):
        root = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        self.assertIn('content="0; url=v2/"', root)
        self.assertIn('<link rel="canonical" href="v2/">', root)
        self.assertIn("invented", root)

    def test_it_is_written_in_english_and_holds_no_private_list(self):
        for p in FILES:
            self.assertEqual(re.findall(r"[äöüÄÖÜß]", p.read_text(encoding="utf-8")), [], p.name)
        self.assertNotIn("columns:", read("js/data-lineage.js"))


class Phone(unittest.TestCase):
    def test_a_phone_gets_a_menu_instead_of_the_rail(self):
        css, shell = read("css/demo.css"), read("js/shell.js")
        phone = css.split("@media (max-width:700px){")[1]
        for rule in ("body.rail-open .rail{transform:none}", ".kpis{grid-template-columns:repeat(2,minmax(0,1fr))}", ".menu-btn{display:inline-flex"):
            self.assertIn(rule, phone, rule)
        self.assertIn("SM.acts.railtoggle = function", shell)
        self.assertIn("document.body.classList.remove('rail-open')", shell)  # a choice in the menu closes it
        self.assertLess(read("index.html").index("css/app.css"), read("index.html").index("css/demo.css"))
        self.assertNotRegex(css, r"#[0-9a-fA-F]{3,6}\b|rgb\(")               # its colours are the palette's


if __name__ == "__main__":
    unittest.main()
