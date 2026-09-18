"""Google Gemini adapter (generateContent).

IMPORTANT — read before enabling in production. Verified 2026-09 against
ai.google.dev/gemini-api/terms: on the unpaid tier Google uses submitted
content and generated responses to improve its products, and human reviewers
may read that content. The same terms describe the service as being for
developers building for professional purposes, "not for consumer use".

For a public multi-user product this is a privacy and terms problem, so this
provider ships DISABLED by default (GEMINI_ENABLED=false). Enable it only for
development, or after moving the project to Google's paid tier where the data
terms differ. docs/PROVIDER_TERMS.md has the detail.
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

BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiTextProvider(TextProvider):
    slug = "gemini"
    display_name = "Google Gemini"

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
            "systemInstruction": {"parts": [{"text": build_system_prompt(request)}]},
            "contents": [{"role": "user", "parts": [{"text": request.prompt}]}],
            "generationConfig": {
                "maxOutputTokens": request.max_output_tokens,
                "temperature": 0.8,
            },
        }

        started = time.perf_counter()
        try:
            response = await get_client().post(
                f"{BASE}/{self._model}:generateContent",
                json=payload,
                headers={
                    "x-goog-api-key": self._api_key,
                    "Content-Type": "application/json",
                },
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
            raise ProviderError(
                classify_status(response.status_code),
                provider=self.slug,
                detail=response.text[:500],
                http_status=response.status_code,
                retry_after_seconds=parse_retry_after(response),
            )

        body = response.json()

        if (body.get("promptFeedback") or {}).get("blockReason"):
            raise ProviderError(
                ProviderFailure.CONTENT_BLOCKED,
                provider=self.slug,
                detail=str(body["promptFeedback"]["blockReason"]),
            )

        candidates = body.get("candidates") or []
        if not candidates:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="no candidates"
            )

        candidate = candidates[0]
        if candidate.get("finishReason") == "SAFETY":
            raise ProviderError(
                ProviderFailure.CONTENT_BLOCKED, provider=self.slug, detail="safety finish"
            )

        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="blank completion"
            )

        usage = body.get("usageMetadata") or {}
        return TextResult(
            text=text,
            provider=self.slug,
            model=self._model,
            tokens_in=usage.get("promptTokenCount"),
            tokens_out=usage.get("candidatesTokenCount"),
            latency_ms=latency_ms,
        )
