"""Pollinations text adapter.

Pollinations now issues API keys (enter.pollinations.ai/keys); a server-side
``sk_`` key belongs in POLLINATIONS_API_KEY. Ships disabled until a key is set.
"""
from __future__ import annotations

import time

import httpx

from ..base import (
    ProviderError,
    ProviderFailure,
    TextProvider,
    TextRequest,
    TextResult,
    build_system_prompt,
)
from ..http import classify_status, get_client, parse_retry_after

ENDPOINT = "https://text.pollinations.ai/openai"


class PollinationsTextProvider(TextProvider):
    slug = "pollinations_text"
    display_name = "Pollinations (text)"

    def __init__(self, api_key: str, model: str, enabled: bool = False) -> None:
        self._api_key = api_key
        self._model = model
        self._enabled = enabled

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    async def generate(self, request: TextRequest) -> TextResult:
        if not self.is_configured:
            raise ProviderError(
                ProviderFailure.NOT_CONFIGURED, provider=self.slug, detail="missing api key"
            )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": build_system_prompt(request)},
                {"role": "user", "content": request.prompt},
            ],
            "max_tokens": request.max_output_tokens,
        }

        started = time.perf_counter()
        try:
            response = await get_client().post(
                ENDPOINT,
                json=payload,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(ProviderFailure.TIMEOUT, provider=self.slug, detail=str(exc)) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail=str(exc)) from exc

        latency_ms = int((time.perf_counter() - started) * 1000)

        if response.status_code != 200:
            raise ProviderError(
                classify_status(response.status_code),
                provider=self.slug,
                detail=response.text[:500],
                http_status=response.status_code,
                retry_after_seconds=parse_retry_after(response),
            )

        body = response.json()
        choices = body.get("choices") or []
        if not choices:
            raise ProviderError(ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="empty choices")

        text = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not text:
            raise ProviderError(ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="blank completion")

        usage = body.get("usage") or {}
        return TextResult(
            text=text,
            provider=self.slug,
            model=self._model,
            tokens_in=usage.get("prompt_tokens"),
            tokens_out=usage.get("completion_tokens"),
            latency_ms=latency_ms,
        )
