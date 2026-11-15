"""Start the page:  python -m sightline   (or  python run.py).  Options: --port N, --open, --data FOLDER."""
from __future__ import annotations

import argparse
import sys
import webbrowser

from . import app
from .server import Server


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="sightline", description="Sightline: the local page of one team's sprint, on demo data.")
    p.add_argument("--port", type=int, help="port on 127.0.0.1 (default: 8780, or the one in sightline.ini)")
    p.add_argument("--data", help="folder of the data to show (default: demo_data)")
    p.add_argument("--open", action="store_true", help="open the page in the browser")
    args = p.parse_args(argv)
    try:
        overrides = {"data": args.data} if args.data else {}
        if args.port is not None:
            overrides["port"] = app.check_port(args.port)
        settings = {**app.load_config(), **overrides}
        try:
            server = Server(settings["port"], overrides=overrides)
        except OSError as e:
            raise app.AppError(f"Port {settings['port']} is taken ({e.strerror or e}). Is the page already running? Try --port.") from None
        state = server.state()                              # fail now, with a readable text, not in the browser
    except app.AppError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"Sightline · {state['team']} · {state['sprint']['name']} · data: {state['data']['folder']}"
          + (" (invented for the demo)" if state["data"]["synthetic"] else ""))
    print(f"Open {server.url}   (Ctrl+C stops it)")
    if args.open:
        webbrowser.open(server.url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
