"""Provider routing: priority, health, cooldown, retry and fallback.

The contract the rest of the app relies on:

  * providers are tried in configured priority order;
  * one that is disabled, unconfigured or cooling down is skipped without a
    network call;
  * a transient failure is retried against the same provider with exponential
    backoff, then the next provider is tried;
  * a rate limit puts that provider in cooldown so we stop hammering it,
    honouring Retry-After when the vendor sends one;
  * a bad request or a safety block is NOT failed over — the next provider
    would reject the same input, so we surface it immediately;
  * every attempt is recorded for the admin health view.

If every provider is exhausted the caller gets SERVICE_BUSY and the user is
told to try again later. Nothing is ever faked.
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, Generic, Sequence, TypeVar

from ..logging_config import get_logger

from ..errors import AppError, ErrorCode
from .base import (
    NON_FAILOVER,
    RETRYABLE,
    BaseProvider,
    ProviderError,
    ProviderFailure,
)

log = get_logger(__name__)

P = TypeVar("P", bound=BaseProvider)
R = TypeVar("R")

#: How long a provider sits out after each failure class, when the vendor
#: does not tell us itself.
_COOLDOWN_SECONDS = {
    ProviderFailure.RATE_LIMITED: 60,
    ProviderFailure.QUOTA_EXHAUSTED: 1800,
    ProviderFailure.UPSTREAM_ERROR: 30,
    ProviderFailure.TIMEOUT: 15,
    ProviderFailure.NOT_CONFIGURED: 0,
    ProviderFailure.UNKNOWN: 30,
}


@dataclass
class ProviderHealth:
    """In-process health record. Mirrored to api_providers for the admin panel."""

    slug: str
    status: str = "unknown"          # unknown | healthy | degraded | down
    consecutive_failures: int = 0
    cooldown_until: float = 0.0      # monotonic clock
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error: str | None = None
    total_calls: int = 0
    total_failures: int = 0

    @property
    def is_cooling_down(self) -> bool:
        return time.monotonic() < self.cooldown_until

    @property
    def cooldown_remaining_seconds(self) -> int:
        return max(0, int(self.cooldown_until - time.monotonic()))


@dataclass
class AttemptRecord:
    """One outbound call, handed to the usage recorder for api_usage."""

    provider_slug: str
    kind: str
    success: bool
    latency_ms: int
    http_status: int | None = None
    error_code: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


#: Called after every attempt so usage can be persisted without the manager
#: knowing anything about the database.
UsageRecorder = Callable[[AttemptRecord], Awaitable[None]]


class ProviderManager(Generic[P]):
    def __init__(
        self,
        kind: str,
        providers: Sequence[P],
        priority: Sequence[str],
        *,
        usage_recorder: UsageRecorder | None = None,
        max_attempts_per_provider: int = 2,
    ) -> None:
        self.kind = kind
        self._by_slug: dict[str, P] = {p.slug: p for p in providers}
        self._priority = [slug for slug in priority if slug in self._by_slug]
        # Anything registered but absent from the priority list still works —
        # it simply sorts last, so a typo in .env degrades rather than breaks.
        self._priority += [s for s in self._by_slug if s not in self._priority]
        self._health: dict[str, ProviderHealth] = {
            slug: ProviderHealth(slug=slug) for slug in self._by_slug
        }
        self._usage_recorder = usage_recorder
        self._max_attempts = max_attempts_per_provider

    # --- introspection ------------------------------------------------------

    @property
    def health(self) -> dict[str, ProviderHealth]:
        return self._health

    def describe(self) -> list[dict]:
        """Admin-facing snapshot. Never returned to normal users."""
        out = []
        for order, slug in enumerate(self._priority, start=1):
            provider = self._by_slug[slug]
            health = self._health[slug]
            out.append(
                {
                    "slug": slug,
                    "displayName": provider.display_name,
                    "kind": self.kind,
                    "priority": order,
                    "enabled": provider.is_enabled,
                    "configured": provider.is_configured,
                    "status": health.status,
                    "coolingDown": health.is_cooling_down,
                    "cooldownRemainingSeconds": health.cooldown_remaining_seconds,
                    "consecutiveFailures": health.consecutive_failures,
                    "totalCalls": health.total_calls,
                    "totalFailures": health.total_failures,
                    "lastSuccessAt": health.last_success_at.isoformat()
                    if health.last_success_at else None,
                    "lastErrorAt": health.last_error_at.isoformat()
                    if health.last_error_at else None,
                    "lastError": health.last_error,
                }
            )
        return out

    @property
    def has_usable_provider(self) -> bool:
        return any(
            p.is_enabled and p.is_configured for p in self._by_slug.values()
        )

    # --- routing ------------------------------------------------------------

    async def execute(
        self,
        call: Callable[[P], Awaitable[R]],
        *,
        user_id: str | None = None,
        usage_recorder: UsageRecorder | None = None,
    ) -> R:
        """Run ``call`` against the first provider that succeeds.

        ``usage_recorder`` overrides the instance-level one for this call only.
        It is passed per call rather than assigned to the manager because the
        manager is shared by every concurrent request: mutating it would mean
        two users in flight at once recording into each other's request.
        """
        if not self._by_slug:
            raise AppError(
                ErrorCode.PROVIDER_NOT_CONFIGURED,
                detail=f"no {self.kind} providers registered",
            )

        skipped: list[str] = []
        last_failure: ProviderError | None = None

        for slug in self._priority:
            provider = self._by_slug[slug]
            health = self._health[slug]

            if not provider.is_enabled:
                skipped.append(f"{slug}:disabled")
                continue
            if not provider.is_configured:
                skipped.append(f"{slug}:unconfigured")
                continue
            if health.is_cooling_down:
                skipped.append(f"{slug}:cooldown({health.cooldown_remaining_seconds}s)")
                continue

            try:
                return await self._attempt_provider(
                    provider, health, call, user_id, usage_recorder
                )
            except ProviderError as exc:
                last_failure = exc
                if exc.failure in NON_FAILOVER:
                    # The next provider would reject this too — stop here.
                    log.info(
                        "provider.no_failover",
                        kind=self.kind, provider=slug, failure=exc.failure.value,
                    )
                    raise self._to_app_error(exc) from exc
                continue

        log.warning(
            "provider.all_exhausted",
            kind=self.kind,
            skipped=skipped,
            last_failure=last_failure.failure.value if last_failure else None,
        )

        if last_failure is None:
            # Nothing was even attempted: everything is off or unconfigured.
            raise AppError(
                ErrorCode.PROVIDER_NOT_CONFIGURED,
                detail=f"no usable {self.kind} provider; skipped={skipped}",
            )
        raise AppError(
            ErrorCode.SERVICE_BUSY,
            detail=f"all {self.kind} providers exhausted; skipped={skipped}",
        )

    async def _attempt_provider(
        self,
        provider: P,
        health: ProviderHealth,
        call: Callable[[P], Awaitable[R]],
        user_id: str | None,
        usage_recorder: UsageRecorder | None = None,
    ) -> R:
        attempt = 0
        while True:
            attempt += 1
            started = time.perf_counter()
            try:
                result = await call(provider)
            except ProviderError as exc:
                latency_ms = int((time.perf_counter() - started) * 1000)
                await self._record(usage_recorder, 
                    AttemptRecord(
                        provider_slug=provider.slug,
                        kind=self.kind,
                        success=False,
                        latency_ms=latency_ms,
                        http_status=exc.http_status,
                        error_code=exc.failure.value,
                    )
                )
                self._note_failure(health, exc)

                retryable = exc.failure in RETRYABLE and attempt < self._max_attempts
                if not retryable:
                    raise

                # Exponential backoff with jitter, so a blip does not turn into
                # a synchronised retry storm across workers.
                delay = min(2 ** (attempt - 1), 8) * (0.5 + random.random() * 0.5)
                log.info(
                    "provider.retry",
                    provider=provider.slug, attempt=attempt,
                    failure=exc.failure.value, delay_s=round(delay, 2),
                )
                await asyncio.sleep(delay)
                continue
            except Exception as exc:  # noqa: BLE001 — adapter bug, not a vendor error
                latency_ms = int((time.perf_counter() - started) * 1000)
                await self._record(usage_recorder, 
                    AttemptRecord(
                        provider_slug=provider.slug, kind=self.kind, success=False,
                        latency_ms=latency_ms, error_code="adapter_error",
                    )
                )
                log.exception("provider.adapter_error", provider=provider.slug)
                raise ProviderError(
                    ProviderFailure.UNKNOWN, provider=provider.slug, detail=repr(exc)
                ) from exc

            latency_ms = int((time.perf_counter() - started) * 1000)
            await self._record(usage_recorder, 
                AttemptRecord(
                    provider_slug=provider.slug,
                    kind=self.kind,
                    success=True,
                    latency_ms=latency_ms,
                    tokens_in=getattr(result, "tokens_in", None),
                    tokens_out=getattr(result, "tokens_out", None),
                )
            )
            self._note_success(health)
            return result

    # --- health bookkeeping -------------------------------------------------

    def _note_success(self, health: ProviderHealth) -> None:
        health.status = "healthy"
        health.consecutive_failures = 0
        health.cooldown_until = 0.0
        health.last_success_at = datetime.now(timezone.utc)
        health.total_calls += 1

    def _note_failure(self, health: ProviderHealth, exc: ProviderError) -> None:
        health.consecutive_failures += 1
        health.total_calls += 1
        health.total_failures += 1
        health.last_error_at = datetime.now(timezone.utc)
        health.last_error = f"{exc.failure.value}: {exc.detail[:200]}"

        cooldown = exc.retry_after_seconds or _COOLDOWN_SECONDS.get(exc.failure, 30)
        if cooldown:
            health.cooldown_until = time.monotonic() + cooldown

        health.status = "down" if health.consecutive_failures >= 3 else "degraded"

    async def _record(
        self, override: UsageRecorder | None, record: AttemptRecord
    ) -> None:
        recorder = override or self._usage_recorder
        if recorder is None:
            return
        try:
            await recorder(record)
        except Exception:  # noqa: BLE001 — telemetry must never break a request
            log.warning("provider.usage_record_failed", provider=record.provider_slug)

    @staticmethod
    def _to_app_error(exc: ProviderError) -> AppError:
        if exc.failure is ProviderFailure.CONTENT_BLOCKED:
            return AppError(ErrorCode.CONTENT_REJECTED, detail=exc.detail)
        return AppError(ErrorCode.GENERATION_FAILED, detail=exc.detail)
