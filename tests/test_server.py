"""The local server: what it gives, what it takes, and what it refuses."""
import http.client
import json
import socket
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sightline import app  # noqa: E402
from sightline.server import FILES, Server  # noqa: E402


class Live(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.server = Server(0, config=app.load_config(ROOT), home=self.home)
        threading.Thread(target=self.server.serve_forever, args=(0.02,), daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.port = self.server.server_address[1]
        self.own = {"Origin": f"http://127.0.0.1:{self.port}"}

    def send(self, method: str, path: str, body=None, **headers):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=60)
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode("utf-8"))
        if data is not None:
            headers.setdefault("Content-Type", "application/json")
        c.request(method, path, data, headers)
        r = c.getresponse()
        raw = r.read()
        c.close()
        try:
            return r.status, json.loads(raw) if raw else None
        except ValueError:
            return r.status, raw

    def files(self) -> list[str]:
        return sorted(p.relative_to(self.home).as_posix() for p in self.home.rglob("*") if p.is_file())


class Pages(Live):
    def test_the_page_and_its_state(self):
        for path in FILES:
            self.assertEqual(self.send("GET", path)[0], 200, path)
        status, state = self.send("GET", "/api/today")
        self.assertEqual(status, 200)
        self.assertEqual([c["id"] for c in state["page"]["cards"]], ["promises", "risks", "operations"])
        self.assertTrue(state["data"]["synthetic"])
        self.assertEqual(self.send("GET", "/api/today?refresh=1")[1]["sprint"], state["sprint"])
        self.assertEqual(self.send("GET", "/nothing")[0], 404)
        self.assertEqual(self.files(), [])                                   # looking writes nothing

    def test_only_this_computer_and_only_this_page(self):
        self.assertEqual(self.send("GET", "/api/today", Host="evil.example")[0], 403)
        for headers in ({"Sec-Fetch-Site": "cross-site"}, {"Sec-Fetch-Site": "same-site"}, {"Origin": "https://evil.example"}, {"Origin": "null"}):
            self.assertEqual(self.send("GET", "/api/today", **headers)[0], 403, headers)
        self.assertEqual(self.send("GET", "/api/today", **{"Sec-Fetch-Site": "same-origin"})[0], 200)
        self.assertEqual(self.send("GET", "/", **{"Sec-Fetch-Site": "cross-site"})[0], 200)      # a link to the page still opens it
        self.assertEqual(self.send("POST", "/api/risks", {"do": "add", "title": "x"}, Origin="https://evil.example")[0], 403)
        self.assertEqual(self.files(), [])

    def test_the_headers_of_a_page(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=60)
        c.request("GET", "/")
        r = c.getresponse()
        r.read()
        c.close()
        self.assertIn("default-src 'self'", r.getheader("Content-Security-Policy"))
        self.assertEqual((r.getheader("X-Content-Type-Options"), r.getheader("Cache-Control")), ("nosniff", "no-store"))


class Writes(Live):
    def test_nothing_but_the_users_own_notes_can_be_written(self):
        for method in ("PUT", "DELETE", "PATCH"):
            self.assertEqual(self.send(method, "/api/risks", {"do": "add", "title": "x"}, **self.own)[0], 405)
        for path in ("/", "/api/today", "/api/anything", "/api/search"):
            self.assertEqual(self.send("POST", path, {"x": 1}, **self.own)[0], 405, path)
        self.assertEqual(self.files(), [])

    def test_the_risk_register(self):
        candidates = self.send("GET", "/api/today")[1]["register"]["candidates"]
        self.assertGreaterEqual(len(candidates), 4)
        self.assertEqual(self.send("POST", "/api/risks", {"do": "add", "signal": candidates[0]["signal"]}, **self.own), (200, {"ok": True}))
        self.assertEqual(self.send("POST", "/api/risks", {"do": "add", "title": "The payment provider changes its API in spring"}, **self.own)[0], 200)
        reg = self.send("GET", "/api/today")[1]["register"]
        self.assertEqual([(r["id"], r["roam"]) for r in reg["risks"]], [("R-2", "new"), ("R-1", "new")])
        self.assertEqual(reg["risks"][1]["title"], candidates[0]["title"])                       # the words of the data, not of the page
        self.assertEqual(len(reg["candidates"]), len(candidates) - 1)
        self.assertEqual(self.send("POST", "/api/risks", {"do": "update", "id": "R-1", "roam": "owned", "owner": "Product Owner", "review": "2026-11-19"}, **self.own)[0], 200)
        self.assertEqual(self.send("GET", "/api/today")[1]["register"]["risks"][1]["owner"], "Product Owner")
        self.assertEqual(self.files(), ["var/risks.json"])
        for bad, part in (({"do": "update", "id": "R-9", "roam": "owned"}, "No risk"), ({"do": "update", "id": "R-1", "roam": "ignored"}, "ROAM must be one of"),
                          ({"do": "add", "signal": "item:KES-0"}, "no longer in the data"), ({"do": "dismiss", "signal": "anything"}, "no longer in the data"),
                          ({"do": "explode"}, "Unknown change")):
            status, reply = self.send("POST", "/api/risks", bad, **self.own)
            self.assertEqual(status, 400, bad)
            self.assertIn(part, reply["error"])
        self.assertEqual(self.send("POST", "/api/risks", b"{oops", **self.own)[0], 400)
        self.assertEqual(self.send("POST", "/api/risks", {"do": "add", "title": "x"}, **{**self.own, "Content-Type": "text/plain"})[0], 415)

    def test_what_was_sent(self):
        drafts = self.send("GET", "/api/today")[1]["inbox"]["drafts"]
        self.assertIn("status", [d["id"] for d in drafts])
        text = next(d["text"] for d in drafts if d["id"] == "status")
        self.assertEqual(self.send("POST", "/api/outbox", {"kind": "status", "text": text}, **self.own), (200, {"ok": True}))
        sent = self.send("GET", "/api/today")[1]["inbox"]["sent"]
        self.assertEqual((len(sent), sent[0]["kind"], sent[0]["text"]), (1, "status", text.strip()))
        self.assertEqual(self.send("POST", "/api/outbox", {"kind": "no such draft", "text": "x"}, **self.own)[0], 400)
        self.assertEqual(self.files(), ["var/outbox.jsonl"])

    def test_a_length_that_is_a_digit_and_no_number(self):
        for path, status in (("/api/ask", "413"), ("/nowhere", "405")):
            with socket.create_connection(("127.0.0.1", self.port), timeout=10) as s:
                s.sendall(f"POST {path} HTTP/1.1\r\nHost: 127.0.0.1:{self.port}\r\nContent-Length: ".encode() + b"\xb2\r\n\r\n")
                answer = b""
                while chunk := s.recv(4096):
                    answer += chunk
            self.assertTrue(answer.startswith(b"HTTP/1.1 " + status.encode()), answer[:40])


class Asking(Live):
    def test_recorded_questions_are_answered_and_others_say_what_this_is(self):
        cards = self.send("GET", "/api/today")[1]["ask"]
        self.assertGreaterEqual(len(cards), 5)
        status, reply = self.send("POST", "/api/ask", {"text": "  " + cards[0]["q"].upper() + " "}, **self.own)
        self.assertEqual((status, reply["recorded"], reply["answer"]), (200, True, cards[0]["a"]))
        status, reply = self.send("POST", "/api/ask", {"text": "What is the weather like today?"}, **self.own)
        self.assertEqual((status, reply["recorded"], reply["tool_calls"]), (200, False, 0))
        self.assertIn("no model behind it", reply["answer"])
        self.assertEqual(self.send("POST", "/api/ask", {"text": ""}, **self.own)[0], 400)
        self.assertEqual(self.send("POST", "/api/ask", {"text": "x" * 2001}, **self.own)[0], 400)


class Tools(Live):
    """The same facts for an agent: four read-only tools over the Model Context Protocol."""

    def call(self, method: str, params=None, **headers):
        return self.send("POST", "/mcp", {"jsonrpc": "2.0", "id": 1, "method": method, **({"params": params} if params else {})}, **headers)

    def test_an_agent_can_list_and_call_the_tools(self):
        status, reply = self.call("initialize", {"protocolVersion": "2025-06-18"})
        self.assertEqual((status, reply["result"]["serverInfo"]["name"]), (200, "sightline"))
        names = [t["name"] for t in self.call("tools/list")[1]["result"]["tools"]]
        self.assertEqual(names, ["facts", "sprint", "issue", "forecast"])
        result = self.call("tools/call", {"name": "facts", "arguments": {"card": "risks"}})[1]["result"]
        facts = json.loads(result["content"][0]["text"])["facts"]
        self.assertTrue(facts and all(f["card"] == "risks" for f in facts) and not result["isError"])
        key = next(f["keys"][0] for f in facts if f["keys"])
        issue = json.loads(self.call("tools/call", {"name": "issue", "arguments": {"key": key}})[1]["result"]["content"][0]["text"])
        self.assertEqual(issue["key"], key)
        self.assertNotIn("summary", issue)                                   # no title to give
        self.assertEqual(self.send("GET", "/api/today")[1]["tool_calls"], 2)

    def test_what_the_tools_refuse(self):
        self.assertTrue(self.call("tools/call", {"name": "issue", "arguments": {"key": "KES-0"}})[1]["result"]["isError"])
        self.assertEqual(self.call("tools/call", {"name": "delete_everything"})[1]["error"]["code"], -32602)
        self.assertEqual(self.call("tools/list", **self.own)[0], 403)                            # a web page is no agent
        ping = {"jsonrpc": "2.0", "id": 1, "method": "ping"}
        self.assertEqual(self.send("POST", "/mcp", [ping] * 21)[0], 400)
        self.assertEqual(len(self.send("POST", "/mcp", [ping] * 20)[1]), 20)
        self.assertEqual(self.send("GET", "/mcp")[0], 405)
        self.assertEqual(self.files(), [])


class Settings(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def refused(self, text: str, part: str, encoding: str = "utf-8"):
        (self.root / app.CONFIG).write_text(text, encoding=encoding)
        with self.assertRaises(app.AppError) as e:
            app.load_data(self.root, app.load_config(self.root))
        self.assertIn(part, str(e.exception))

    def test_what_is_wrong_is_said_in_a_sentence(self):
        self.assertEqual(app.load_config(self.root)["port"], 8780)           # no file: the defaults
        self.refused("[server]\nport = 99999\n", "from 1 to 65535")
        self.refused("[server]\nport = ²\n", "must be a number")
        self.refused("[team]\nname = Kestrel\n", "not UTF-8 text", encoding="utf-16")
        self.refused("[data]\nfolder = nowhere\n", "holds no data")
        self.refused(f"[data]\nfolder = {ROOT / 'demo_data'}\n[team]\nboard = 999\n", "Board 999 is not in the data")
        self.refused(f"[data]\nfolder = {ROOT / 'demo_data'}\n[team]\nsprint = 1\n", "sprint 1 of board")
        (self.root / app.CONFIG).write_text(f"[team]\nname = 100% Kestrel\n[data]\nfolder = {ROOT / 'demo_data'}\n", encoding="utf-8")
        self.assertEqual(app.build_state(self.root)["team"], "100% Kestrel")


if __name__ == "__main__":
    unittest.main()
