"""Shared HTTP client and status→failure mapping for provider adapters."""
from __future__ import annotations

import httpx

from .base import ProviderFailure

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """One pooled client for the whole process.

    Connection reuse matters on a small VPS: a fresh TLS handshake per
    generation is both slow and memory-hungry.
    """
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            follow_redirects=True,
            headers={"User-Agent": "Pickixo/0.1 (+https://pickixo.com)"},
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def classify_status(status: int) -> ProviderFailure:
    if status == 429:
        return ProviderFailure.RATE_LIMITED
    if status in (402, 403):
        # 402 = payment required, 403 = key rejected/over cap on several vendors
        return ProviderFailure.QUOTA_EXHAUSTED
    if status == 401:
        return ProviderFailure.NOT_CONFIGURED
    if status in (400, 404, 422):
        return ProviderFailure.BAD_REQUEST
    if status >= 500:
        return ProviderFailure.UPSTREAM_ERROR
    return ProviderFailure.UNKNOWN


def parse_retry_after(response: httpx.Response) -> int | None:
    raw = response.headers.get("retry-after")
    if not raw:
        return None
    try:
        return max(1, min(int(float(raw)), 3600))
    except (TypeError, ValueError):
        return None
