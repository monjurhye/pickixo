"""Entry point for the Pickixo API.

Use this rather than `uvicorn app.main:app` on Windows.

Why it exists: psycopg's async driver needs `loop.add_reader()`, which Windows'
default ProactorEventLoop does not implement, so every database connection hangs
until the pool times out. Selecting the selector loop fixes it — but uvicorn
calls `asyncio.run()` and only imports the application *inside* that loop, so
setting the policy from app/main.py happens after the loop already exists. It
has to be set here, before uvicorn is asked to run anything.

    python run.py
    python run.py --reload
"""
from __future__ import annotations

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn  # noqa: E402 — must follow the policy change above

from app.config import get_settings  # noqa: E402


def main() -> None:
    settings = get_settings()
    reload = "--reload" in sys.argv
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=settings.backend_port,
        reload=reload,
        log_level=settings.log_level,
        # uvicorn's access log duplicates our own request middleware, in a
        # format that is not JSON and not correlated by request id.
        access_log=False,
    )


if __name__ == "__main__":
    main()
