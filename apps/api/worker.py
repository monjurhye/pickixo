"""Entry point for the Facebook agent worker.

    python worker.py

This is what makes the agent autonomous. It is a separate process from the API
on purpose:

* it must keep running when nobody has the dashboard open — that is the whole
  point, and a browser tab is not a runtime;
* restarting the API to deploy a frontend change must not interrupt an agent
  that is mid-publish;
* and if the agent wedges, it can be restarted without taking the website down
  with it.

Windows event-loop note: the same constraint as run.py. psycopg's async driver
needs `loop.add_reader()`, which the default ProactorEventLoop does not
implement, so the policy has to be set before any loop exists — which means
before the imports that would create one.
"""
from __future__ import annotations

import asyncio
import contextlib
import signal
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app import db  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.facebook_agent.supervisor import Supervisor  # noqa: E402
from app.logging_config import configure_logging, get_logger  # noqa: E402
from app.services import ai as ai_service  # noqa: E402

log = get_logger(__name__)


async def main() -> int:
    settings = get_settings()
    configure_logging(settings.log_level)

    problems = settings.startup_problems()
    if problems:
        for problem in problems:
            log.error("config.problem", problem=problem)
        return 1

    if not settings.facebook_agent_enabled:
        # Refuse to start rather than run and do nothing: a worker that appears
        # healthy while being switched off is how "why has it not posted?"
        # becomes a long afternoon.
        log.error(
            "FACEBOOK_AGENT_ENABLED is not set — refusing to start a worker "
            "that would never act"
        )
        return 1

    if not settings.meta_configured:
        log.error(
            "Meta is not configured. META_APP_ID, META_APP_SECRET, "
            "META_REDIRECT_URI and FACEBOOK_TOKEN_KEY must all be set before "
            "the agent can reach a Page."
        )
        return 1

    await db.init_pool(settings)

    # The agent needs text generation to think and image generation to
    # illustrate. Without a text provider it cannot make a judgement call at
    # all, so that is fatal; without an image provider it can still publish
    # text posts and handle comments, so that is a warning.
    try:
        ai_service.init_managers(settings)
    except Exception:  # noqa: BLE001
        log.exception("AI provider initialisation failed")
        await db.close_pool()
        return 1

    if ai_service.providers_ready() == 0:
        log.error("no AI provider is enabled and configured — the agent cannot think")
        await db.close_pool()
        return 1

    supervisor = Supervisor(settings)
    stopping = asyncio.Event()

    def request_stop(*_: object) -> None:
        log.info("agent.worker_stop_requested")
        stopping.set()

    # SIGTERM is what a service manager sends; SIGINT is Ctrl+C. Both should
    # let the current cycle finish rather than killing a publish halfway.
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError, AttributeError):
            signal.signal(sig, request_stop)

    supervisor.start()
    log.info("agent.worker_started",
             tick_seconds=settings.facebook_agent_tick_seconds)

    try:
        await stopping.wait()
    finally:
        await supervisor.stop()
        await db.close_pool()

    log.info("agent.worker_stopped")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        raise SystemExit(0)
