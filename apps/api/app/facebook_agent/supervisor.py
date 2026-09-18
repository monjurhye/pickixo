"""The thing that wakes the agent, and nothing else.

This is the one place in the system where "scheduler" is the right word, and it
is deliberately stupid. It knows how often to knock on the door. It does not
know what content should be published, when a post is due, or whether any
action is appropriate — every one of those is the agent's judgement, made fresh
each time from the current state of the Page.

    supervisor: "anything to do?"
    agent:      "no" / "yes, and here is what and why"

Getting this boundary wrong is how an autonomous agent quietly degrades into a
cron job: the moment the scheduler starts saying "it is 8pm, post something",
the agent is just a template renderer.
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from ..config import Settings
from ..logging_config import get_logger
from . import agent, repository as repo

log = get_logger(__name__)

#: A failing Page is backed off rather than retried every tick, so one broken
#: connection cannot fill the log or hammer Meta.
_FAILURE_BACKOFF_SECONDS = 900


class Supervisor:
    """Wakes the agent for every eligible Page, forever."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._stopping = asyncio.Event()
        self._task: asyncio.Task | None = None
        self._failures: dict[str, datetime] = {}
        self.last_tick: datetime | None = None
        self.next_tick: datetime | None = None

    # -- lifecycle ---------------------------------------------------------
    def start(self) -> None:
        if self._task is not None:
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop(), name="facebook-agent-supervisor")
        log.info("agent.supervisor_started",
                 tick_seconds=self._settings.facebook_agent_tick_seconds)

    async def stop(self) -> None:
        """Ask the loop to finish the cycle it is in and stop.

        Deliberately not a cancel: a run that is mid-publish should be allowed
        to finish recording what it did. Losing the record of a post that went
        out is worse than waiting a few seconds for shutdown.
        """
        self._stopping.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=90)
            except asyncio.TimeoutError:
                log.warning("agent.supervisor_stop_timeout")
                self._task.cancel()
            self._task = None
        log.info("agent.supervisor_stopped")

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    # -- the loop ----------------------------------------------------------
    async def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                await self.tick()
            except Exception:  # noqa: BLE001
                # The supervisor must outlive anything that goes wrong inside a
                # single tick. A crash here means the agent silently stops, and
                # nobody notices until the Page has been quiet for a week.
                log.exception("agent.tick_failed")

            interval = self._settings.facebook_agent_tick_seconds
            # A little jitter so that a restart does not align every future
            # wake with the same second of the minute.
            delay = max(30, interval + random.randint(-15, 15))
            self.next_tick = datetime.now(timezone.utc)
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass

    async def tick(self) -> list[dict]:
        """One pass over every eligible Page."""
        self.last_tick = datetime.now(timezone.utc)

        if not self._settings.meta_configured:
            # Nothing is connected and nothing can be. Not an error — this is
            # the correct state before a Meta app exists.
            return []

        pages = await repo.active_pages()
        results: list[dict] = []

        for page in pages:
            page_uuid = str(page["id"])

            until = self._failures.get(page_uuid)
            if until and (datetime.now(timezone.utc) - until).total_seconds() \
                    < _FAILURE_BACKOFF_SECONDS:
                continue

            try:
                outcome = await agent.run_once(
                    page_uuid=page_uuid, settings=self._settings,
                    trigger="scheduled",
                )
                if outcome.error:
                    self._failures[page_uuid] = datetime.now(timezone.utc)
                else:
                    self._failures.pop(page_uuid, None)
                results.append(outcome.as_dict())

                log.info(
                    "agent.tick",
                    page=page.get("page_name"),
                    decision=outcome.decision,
                    actions=outcome.actions_taken,
                    used_ai=outcome.used_ai,
                )
            except Exception:  # noqa: BLE001
                log.exception("agent.page_run_failed", page=page_uuid)
                self._failures[page_uuid] = datetime.now(timezone.utc)

        return results


_supervisor: Supervisor | None = None


def get_supervisor(settings: Settings | None = None) -> Supervisor | None:
    global _supervisor
    if _supervisor is None and settings is not None:
        _supervisor = Supervisor(settings)
    return _supervisor
