"""Behavioural tests for the provider fallback layer.

Runs on the standard library alone (no pytest) so it can be executed anywhere,
including a bare 4 GB VPS with nothing installed but Python.

    python3 -m tests.test_provider_manager
"""
from __future__ import annotations

import asyncio
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.errors import AppError, ErrorCode
from app.providers.base import (
    ProviderError,
    ProviderFailure,
    TextProvider,
    TextRequest,
    TextResult,
)
from app.providers.manager import AttemptRecord, ProviderManager


class FakeProvider(TextProvider):
    """A scriptable text provider. ``script`` is consumed one call at a time."""

    def __init__(self, slug, script, *, configured=True, enabled=True):
        self.slug = slug
        self.display_name = slug
        self._script = list(script)
        self._configured = configured
        self._enabled = enabled
        self.calls = 0

    @property
    def is_configured(self):
        return self._configured

    @property
    def is_enabled(self):
        return self._enabled

    async def generate(self, request: TextRequest) -> TextResult:
        self.calls += 1
        outcome = self._script.pop(0) if self._script else "ok"
        if isinstance(outcome, ProviderFailure):
            raise ProviderError(outcome, provider=self.slug, detail="scripted")
        if isinstance(outcome, tuple):  # (failure, retry_after)
            raise ProviderError(
                outcome[0], provider=self.slug, detail="scripted",
                retry_after_seconds=outcome[1],
            )
        return TextResult(text=f"output from {self.slug}", provider=self.slug, model="m")


def build(providers, priority=None, recorder=None, max_attempts=2):
    return ProviderManager(
        "text", providers,
        priority or [p.slug for p in providers],
        usage_recorder=recorder, max_attempts_per_provider=max_attempts,
    )


async def run(manager):
    return await manager.execute(lambda p: p.generate(TextRequest(prompt="hello")))


class TestFallback(unittest.IsolatedAsyncioTestCase):

    async def test_first_healthy_provider_wins(self):
        a, b = FakeProvider("a", ["ok"]), FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "a")
        self.assertEqual(b.calls, 0, "second provider must not be called")

    async def test_priority_order_is_respected_not_registration_order(self):
        a, b = FakeProvider("a", ["ok"]), FakeProvider("b", ["ok"])
        result = await run(build([a, b], priority=["b", "a"]))
        self.assertEqual(result.provider, "b")

    async def test_unconfigured_provider_is_skipped_without_a_call(self):
        a = FakeProvider("a", ["ok"], configured=False)
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "b")
        self.assertEqual(a.calls, 0, "an unconfigured provider must never be dialled")

    async def test_disabled_provider_is_skipped(self):
        a = FakeProvider("a", ["ok"], enabled=False)
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "b")
        self.assertEqual(a.calls, 0)

    async def test_rate_limited_provider_fails_over_to_the_next(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED])
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "b")

    async def test_timeout_is_retried_on_the_same_provider_before_failover(self):
        a = FakeProvider("a", [ProviderFailure.TIMEOUT, "ok"])
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "a", "should recover on its own retry")
        self.assertEqual(a.calls, 2)
        self.assertEqual(b.calls, 0)

    async def test_retries_are_capped_then_it_fails_over(self):
        a = FakeProvider("a", [ProviderFailure.UPSTREAM_ERROR] * 5)
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b], max_attempts=2))
        self.assertEqual(a.calls, 2, "must stop at max_attempts_per_provider")
        self.assertEqual(result.provider, "b")

    async def test_bad_request_does_not_fail_over(self):
        """A malformed prompt would be rejected by every provider — surfacing it
        immediately avoids burning the whole fallback chain on a user error."""
        a = FakeProvider("a", [ProviderFailure.BAD_REQUEST])
        b = FakeProvider("b", ["ok"])
        with self.assertRaises(AppError) as ctx:
            await run(build([a, b]))
        self.assertEqual(ctx.exception.code, ErrorCode.GENERATION_FAILED)
        self.assertEqual(b.calls, 0, "must not try the next provider")

    async def test_content_block_does_not_fail_over_and_maps_to_its_own_code(self):
        a = FakeProvider("a", [ProviderFailure.CONTENT_BLOCKED])
        b = FakeProvider("b", ["ok"])
        with self.assertRaises(AppError) as ctx:
            await run(build([a, b]))
        self.assertEqual(ctx.exception.code, ErrorCode.CONTENT_REJECTED)
        self.assertEqual(b.calls, 0)

    async def test_all_providers_exhausted_reports_service_busy(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED])
        b = FakeProvider("b", [ProviderFailure.QUOTA_EXHAUSTED])
        with self.assertRaises(AppError) as ctx:
            await run(build([a, b]))
        self.assertEqual(ctx.exception.code, ErrorCode.SERVICE_BUSY)

    async def test_nothing_configured_reports_not_configured_not_busy(self):
        """The admin needs to tell 'no key set' apart from 'everyone is rate
        limited'. These must not collapse into the same error."""
        a = FakeProvider("a", ["ok"], configured=False)
        b = FakeProvider("b", ["ok"], enabled=False)
        with self.assertRaises(AppError) as ctx:
            await run(build([a, b]))
        self.assertEqual(ctx.exception.code, ErrorCode.PROVIDER_NOT_CONFIGURED)

    async def test_cooldown_keeps_a_rate_limited_provider_out_of_rotation(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED, "ok"])
        b = FakeProvider("b", ["ok", "ok"])
        manager = build([a, b])
        first = await run(manager)
        self.assertEqual(first.provider, "b")
        calls_after_first = a.calls
        second = await run(manager)
        self.assertEqual(second.provider, "b", "a is still cooling down")
        self.assertEqual(a.calls, calls_after_first, "a must not be dialled again")
        self.assertTrue(manager.health["a"].is_cooling_down)

    async def test_retry_after_header_sets_the_cooldown_length(self):
        a = FakeProvider("a", [(ProviderFailure.RATE_LIMITED, 300)])
        b = FakeProvider("b", ["ok"])
        manager = build([a, b])
        await run(manager)
        remaining = manager.health["a"].cooldown_remaining_seconds
        self.assertGreater(remaining, 290, "should honour the vendor's Retry-After")
        self.assertLessEqual(remaining, 300)

    async def test_recovery_after_cooldown_expires(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED, "ok"])
        b = FakeProvider("b", ["ok"])
        manager = build([a, b])
        await run(manager)
        manager.health["a"].cooldown_until = time.monotonic() - 1   # expire it
        result = await run(manager)
        self.assertEqual(result.provider, "a", "must return to rotation")
        self.assertEqual(manager.health["a"].status, "healthy")

    async def test_health_marks_down_after_three_consecutive_failures(self):
        a = FakeProvider("a", [ProviderFailure.UPSTREAM_ERROR] * 10)
        b = FakeProvider("b", ["ok"] * 10)
        manager = build([a, b], max_attempts=1)
        for _ in range(3):
            manager.health["a"].cooldown_until = 0   # ignore cooldown for this test
            await run(manager)
        self.assertEqual(manager.health["a"].status, "down")
        self.assertEqual(manager.health["a"].consecutive_failures, 3)

    async def test_success_resets_the_failure_streak(self):
        a = FakeProvider("a", [ProviderFailure.UPSTREAM_ERROR, "ok"])
        manager = build([a], max_attempts=2)
        await run(manager)
        self.assertEqual(manager.health["a"].status, "healthy")
        self.assertEqual(manager.health["a"].consecutive_failures, 0)

    async def test_every_attempt_is_recorded_for_the_admin_health_view(self):
        records: list[AttemptRecord] = []
        async def recorder(rec): records.append(rec)
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED])
        b = FakeProvider("b", ["ok"])
        await run(build([a, b], recorder=recorder))
        self.assertEqual(len(records), 2)
        self.assertFalse(records[0].success)
        self.assertEqual(records[0].error_code, "rate_limited")
        self.assertTrue(records[1].success)

    async def test_a_broken_recorder_never_breaks_a_user_request(self):
        async def recorder(rec): raise RuntimeError("telemetry database is down")
        a = FakeProvider("a", ["ok"])
        result = await run(build([a], recorder=recorder))
        self.assertEqual(result.provider, "a", "telemetry must not fail the request")

    async def test_adapter_bug_is_contained_and_fails_over(self):
        class Exploding(FakeProvider):
            async def generate(self, request):
                self.calls += 1
                raise ValueError("bug in the adapter, not the vendor")
        a, b = Exploding("a", []), FakeProvider("b", ["ok"])
        result = await run(build([a, b]))
        self.assertEqual(result.provider, "b", "a crash must fail over, not 500")

    async def test_unknown_slug_in_priority_list_is_tolerated(self):
        """A typo in TEXT_PROVIDER_PRIORITY should degrade, never crash."""
        a = FakeProvider("a", ["ok"])
        result = await run(build([a], priority=["typo", "a"]))
        self.assertEqual(result.provider, "a")

    async def test_provider_missing_from_priority_still_usable_as_last_resort(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED])
        b = FakeProvider("b", ["ok"])
        result = await run(build([a, b], priority=["a"]))
        self.assertEqual(result.provider, "b")

    async def test_describe_reports_state_for_the_admin_panel(self):
        a = FakeProvider("a", ["ok"], configured=False)
        b = FakeProvider("b", ["ok"])
        rows = build([a, b]).describe()
        self.assertEqual([r["slug"] for r in rows], ["a", "b"])
        self.assertFalse(rows[0]["configured"])
        self.assertTrue(rows[1]["configured"])
        self.assertEqual(rows[0]["priority"], 1)

    async def test_no_secret_leaks_into_the_client_error_body(self):
        a = FakeProvider("a", [ProviderFailure.RATE_LIMITED])
        try:
            await run(build([a]))
        except AppError as exc:
            body = exc.to_body()
            self.assertNotIn("detail", body["error"])
            self.assertEqual(body["error"]["code"], "service_busy")
            self.assertEqual(body["error"]["messageKey"], "errors.serviceBusy")


if __name__ == "__main__":
    unittest.main(verbosity=2)
