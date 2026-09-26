"""Groq adapter (OpenAI-compatible chat completions).

Free-tier reality check, verified 2026-09 against console.groq.com/docs/rate-limits:
limits apply at the ORGANISATION level, not per end user. For
openai/gpt-oss-120b that is 30 req/min and 1,000 req/day for the whole
application. Per-user daily caps in this app are sized against that ceiling —
see docs/PROVIDER_TERMS.md.
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

ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

#: The error code Groq returns, with HTTP 400, once the organisation's monthly
#: spend limit is reached (console.groq.com/docs/spend-limits).
SPEND_LIMIT_CODE = "blocked_api_access"


def _spend_limit_reached(response: httpx.Response) -> bool:
    """Whether a failed response is the spend limit rather than a bad request.

    Read from the structured error first; the substring check is the fallback
    for a body that is not the usual {"error": {"code": ...}} shape.
    """
    try:
        error = (response.json() or {}).get("error") or {}
        if isinstance(error, dict) and error.get("code") == SPEND_LIMIT_CODE:
            return True
    except ValueError:
        pass
    return SPEND_LIMIT_CODE in response.text


class GroqTextProvider(TextProvider):
    slug = "groq"
    display_name = "Groq"

    def __init__(self, api_key: str, model: str, enabled: bool = True) -> None:
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
            "max_completion_tokens": request.max_output_tokens,
            "temperature": 0.8,
        }

        started = time.perf_counter()
        try:
            response = await get_client().post(
                ENDPOINT,
                json=payload,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                ProviderFailure.TIMEOUT, provider=self.slug, detail=str(exc)
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail=str(exc)
            ) from exc

        latency_ms = int((time.perf_counter() - started) * 1000)

        if response.status_code != 200:
            if _spend_limit_reached(response):
                # The organisation's monthly spend limit is spent. Groq says
                # so with a 400, and classify_status would call a 400 our own
                # bad request — which the manager never fails over. It is a
                # quota: cool Groq down and let the next provider answer.
                raise ProviderError(
                    ProviderFailure.QUOTA_EXHAUSTED,
                    provider=self.slug,
                    detail="monthly spend limit reached (blocked_api_access)",
                    http_status=response.status_code,
                )
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
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="empty choices"
            )

        choice = choices[0]
        if choice.get("finish_reason") == "content_filter":
            raise ProviderError(
                ProviderFailure.CONTENT_BLOCKED, provider=self.slug, detail="content filter"
            )

        text = (choice.get("message") or {}).get("content") or ""
        if not text.strip():
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="blank completion"
            )

        usage = body.get("usage") or {}
        return TextResult(
            text=text.strip(),
            provider=self.slug,
            model=self._model,
            tokens_in=usage.get("prompt_tokens"),
            tokens_out=usage.get("completion_tokens"),
            latency_ms=latency_ms,
        )
