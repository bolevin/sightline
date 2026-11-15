"""The local web server of the page.

Listens on 127.0.0.1 only, and the Host header must name this machine (DNS rebinding). Nothing is loaded from
outside: the page is five files of this package. The app reads; it never writes to Jira or to any other system.
It takes four kinds of POST and nothing else: a call of the read-only tools by an agent (/mcp, never from a web
page), a question of the Ask window (/api/ask), a change of the user's own risk register (/api/risks) and a text the
user marks as sent (/api/outbox). The last two are files on this computer, and the last three come from this page
only.
"""
from __future__ import annotations

import json
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from . import app, demo, drafts, risks, tools

WEB = (Path(__file__).parent / "web").resolve()
FILES = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"),
         "/help.js": ("help.js", "text/javascript; charset=utf-8"), "/views.js": ("views.js", "text/javascript; charset=utf-8"),
         "/quality.js": ("quality.js", "text/javascript; charset=utf-8"),
         "/style.css": ("style.css", "text/css; charset=utf-8")}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
LOCAL = ("127.0.0.1", "localhost")
MAX_BODY = 262144           # bytes of a POST body: a tool call or a question is far smaller
MAX_QUESTION = 2000


class Handler(BaseHTTPRequestHandler):
    server_version = "Sightline"
    protocol_version = "HTTP/1.1"
    timeout = 120               # seconds a connection may stay silent: half a request does not keep a thread for ever

    def log_message(self, *args):       # the console stays quiet
        pass

    def _send(self, code: int, body: bytes, content_type: str, allow: str = "") -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        if allow:
            self.send_header("Allow", allow)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code: int, data, allow: str = "") -> None:
        self._send(code, json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", allow)

    def _local(self) -> bool:
        return (self.headers.get("Host") or "").rsplit(":", 1)[0] in LOCAL

    def _own(self) -> set[str]:
        return {f"http://{host}:{self.server.server_address[1]}" for host in LOCAL}

    def _foreign(self) -> bool:
        """Whether a browser says that another web site sent this request: it names the site in Origin, and says
        cross-site or same-site in Sec-Fetch-Site (an image, a link or a prefetch has no Origin)."""
        origin = self.headers.get("Origin")
        site = (self.headers.get("Sec-Fetch-Site") or "none").strip().lower()
        return (origin is not None and origin not in self._own()) or site not in ("same-origin", "none")

    def do_GET(self):
        if not self._local():
            return self._json(403, {"error": "This page answers on this computer only."})
        url = urlsplit(self.path)
        if url.path in FILES:
            name, content_type = FILES[url.path]
            return self._send(200, (WEB / name).read_bytes(), content_type)
        if url.path.startswith("/api/") and self._foreign():
            return self._json(403, {"error": "The data is given to this page only."})
        if url.path == "/api/today":
            return self._guarded(lambda: self.server.state("refresh" in parse_qs(url.query)))
        if url.path == "/mcp":          # no server-initiated stream: the tools endpoint only answers POSTs
            return self._json(405, {"error": "Use POST."}, "POST")
        self._json(404, {"error": "Not found."})

    do_HEAD = do_GET

    def _refuse(self, code: int = 405, text: str = "This app only reads."):
        # A small body is read and thrown away: closing a socket with unread data makes Windows reset the
        # connection, and the client may then lose the answer. Anything bigger is not read at all.
        length = self.headers.get("Content-Length") or ""
        if length.isascii() and length.isdigit() and 0 < int(length) <= 65536:
            self.rfile.read(int(length))
        self.close_connection = True
        self._json(code, {"error": text})

    do_PUT = do_DELETE = do_PATCH = _refuse

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ("/mcp", "/api/ask", "/api/risks", "/api/outbox"):
            return self._refuse()
        length = self.headers.get("Content-Length") or ""
        if not (length.isascii() and length.isdigit()) or int(length) > MAX_BODY or self.headers.get("Transfer-Encoding"):
            return self._refuse(413, f"Send Content-Length, at most {MAX_BODY} bytes.")
        raw = self.rfile.read(int(length))
        if not self._local():
            return self._json(403, {"error": "This page answers on this computer only."})
        origin = self.headers.get("Origin")
        if path == "/mcp":
            if origin:                  # an agent's MCP client sends none; a page in a browser always does
                return self._json(403, {"error": "The tools are for the agent, not for web pages."})
            status, payload = tools.handle_body(raw, self.server.data, self.server.tool_called)
            return self._json(status, payload) if payload is not None else self._send(status, b"", "application/json")
        if origin and origin not in self._own():
            return self._json(403, {"error": "Changes are taken from this page only."})
        if (self.headers.get("Content-Type") or "").split(";")[0].strip().lower() != "application/json":
            return self._json(415, {"error": "Send application/json."})
        try:
            body = json.loads(raw)
        except (ValueError, RecursionError):
            body = None
        if path == "/api/outbox":
            if not isinstance(body, dict) or not isinstance(body.get("kind"), str) or not isinstance(body.get("text"), str):
                return self._json(400, {"error": 'Send {"kind": "the draft", "text": "what you sent"}.'})
            return self._guarded(lambda: self.server.sent(body["kind"], body["text"]))
        if path == "/api/risks":
            if not isinstance(body, dict) or not isinstance(body.get("do"), str):
                return self._json(400, {"error": 'Send {"do": "add" | "update" | "dismiss" | "restore", ...}.'})
            return self._guarded(lambda: self.server.risk(body))
        if not isinstance(body, dict) or not isinstance(body.get("text"), str) or not 0 < len(body["text"].strip()) <= MAX_QUESTION:
            return self._json(400, {"error": f'Send {{"text": "the question"}}, at most {MAX_QUESTION} characters.'})
        self._guarded(lambda: self.server.ask(body["text"]))

    def _guarded(self, make) -> None:
        try:
            self._json(200, make())
        except (risks.RiskError, drafts.DraftError) as e:
            self._json(400, {"error": str(e)})
        except app.AppError as e:
            self._json(500, {"error": str(e)})
        except Exception as e:  # noqa: BLE001  a bug must reach the page as text, not as a dead connection
            traceback.print_exc()
            self._json(500, {"error": f"The page could not be built ({type(e).__name__}: {e})."})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False     # on Windows "reuse" would let a second copy bind the same port silently

    def __init__(self, port: int, root: Path = app.ROOT, config: dict | None = None, overrides: dict | None = None,
                 home: Path | None = None):
        """`config`: fixed settings (tests). Without it the settings file is read, and read again on every refresh;
        `overrides` (the command line) then win over the file. `home`: where the user's own files are kept (var/
        inside it); the folder of the app by default."""
        self.root, self.home, self.config, self.overrides = root, home or root, config, overrides or {}
        self._settings, self._loaded, self._lock = None, None, threading.Lock()
        self._writing = threading.Lock()    # the user's own files (risk register, outbox): one change at a time
        self._tool_calls = 0
        super().__init__(("127.0.0.1", port), Handler)

    def _load(self, refresh: bool = False) -> tuple[app.Data, dict]:
        """The data and the page state. Built once; again on a refresh (which also reads the settings again) and
        after every change of the user's own files."""
        with self._lock:
            before = self._settings
            if self._settings is None or refresh:
                self._settings = self.config or {**app.load_config(self.root), **self.overrides}
            try:
                if self._loaded is None or refresh:
                    data = app.load_data(self.root, self._settings)
                    self._loaded = (data, app.build_state(self.home, data=data))
            except Exception:
                if before is not None:
                    self._settings = before     # a refresh that failed changes nothing
                raise
            return self._loaded

    def data(self) -> app.Data:
        return self._load()[0]

    def state(self, refresh: bool = False) -> dict:
        return {**self._load(refresh)[1], "tool_calls": self._tool_calls}

    def tool_called(self, name: str) -> None:
        with self._lock:
            self._tool_calls += 1

    def sent(self, kind: str, text: str) -> dict:
        """Keep a text the user marks as sent, in a record on this computer."""
        data, state = self._load()
        with self._writing:
            drafts.record(self.home, data, kind, text, state["inbox"]["drafts"])
        with self._lock:
            self._loaded = None
        return {"ok": True}

    def risk(self, action: dict) -> dict:
        """One change of the user's risk register, then the page state is built anew."""
        data = self.data()
        with self._writing:
            risks.apply(self.home, data, action)
        with self._lock:
            self._loaded = None
        return {"ok": True}

    def ask(self, text: str) -> dict:
        return {**demo.answer(self.data().run.folder, text), "unknown_keys": []}

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server_address[1]}/"
