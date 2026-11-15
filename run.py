"""Start Sightline from any folder:  python run.py [--port N] [--open]   (the same as  python -m sightline)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sightline.__main__ import main  # noqa: E402

sys.exit(main())
