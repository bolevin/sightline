"""Build the hosted demo: the page as static files under docs/demo, for GitHub Pages.

    python tools/build_site.py

The hosted page is the same page the local server gives. What differs: its state is one file, state.json, written
here from the demo data, and tools/site/host.js takes the place of the server in the browser. The register and the
Inbox start empty, as on a fresh install.
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app  # noqa: E402
from sightline.server import FILES, WEB  # noqa: E402

SITE = ROOT / "docs" / "demo"
SHIM = ROOT / "tools" / "site" / "host.js"
NOTE = ("<b>Demo.</b> The team, its issues and every number here are invented. This page runs in your browser only: "
        "what you add to the risk register or mark as sent stays in this tab and goes nowhere.")


def state() -> dict:
    data = app.load_data(ROOT, app.load_config(ROOT))
    with tempfile.TemporaryDirectory() as home:            # no notes of anybody: a fresh install
        made = app.build_state(Path(home), data=data)
    made["built"] = made["data"]["fetched"]                # the same data gives the same file, byte for byte
    made["tool_calls"] = 0
    return made


def build(target: Path = SITE) -> Path:
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    for name, _ in FILES.values():
        shutil.copyfile(WEB / name, target / name)
    shutil.copyfile(SHIM, target / "host.js")
    page = (target / "index.html").read_text(encoding="utf-8")
    old_note = page[page.index('<div class="demo-note" id="demo-note">'):page.index("</div>", page.index('<div class="demo-note" id="demo-note">'))]
    page = page.replace(old_note, f'<div class="demo-note" id="demo-note">{NOTE}')
    assert page.count('<script src="help.js"></script>') == 1
    page = page.replace('<script src="help.js"></script>', '<script src="host.js"></script>\n<script src="help.js"></script>')
    (target / "index.html").write_text(page, encoding="utf-8", newline="\n")
    (target / "state.json").write_text(json.dumps(state(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")
    return target


if __name__ == "__main__":
    print("Wrote", build())
