"""Ollama adapter for a model running on this machine.

Deliberately speaks Ollama's native /api/chat rather than its OpenAI-compatible
/v1 endpoint, for one measured reason: Qwen3 is a hybrid reasoning model, and
only the native endpoint honours ``think: false``. Measured on the 2-core box
this ships to, the same 60-word post took 73s with thinking and 12s without —
the reasoning tokens were roughly three quarters of the work, and none of them
reach the reader. The /v1 endpoint ignores every documented way to switch it
off (``think``, ``chat_template_kwargs``, and the ``/no_think`` prompt suffix
were all tried).

Nothing here needs a credential, and the endpoint is loopback-only: a local
model earns its keep precisely because no prompt leaves the server.
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
from ..http import classify_status, get_client

ENDPOINT = "http://127.0.0.1:11434/api/chat"


class OllamaTextProvider(TextProvider):
    slug = "ollama"
    display_name = "Local model"

    def __init__(self, model: str, enabled: bool = False, timeout_seconds: float = 600.0) -> None:
        self._model = model
        self._enabled = enabled
        self._timeout_seconds = timeout_seconds

    @property
    def is_configured(self) -> bool:
        # No key exists to check. If Ollama is not running the call fails and
        # the manager cools this provider down like any other outage.
        return bool(self._model)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    async def generate(self, request: TextRequest) -> TextResult:
        payload = {
            "model": self._model,
            "think": False,
            "stream": False,
            "messages": [
                {"role": "system", "content": build_system_prompt(request)},
                {"role": "user", "content": request.prompt},
            ],
            "options": {
                "temperature": 0.8,
                "num_predict": request.max_output_tokens,
            },
        }

        started = time.perf_counter()
        try:
            response = await get_client().post(
                ENDPOINT,
                json=payload,
                # CPU inference is measured in minutes, not the seconds the
                # shared client allows for cloud vendors.
                timeout=httpx.Timeout(self._timeout_seconds, connect=5.0),
            )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                ProviderFailure.TIMEOUT, provider=self.slug, detail=str(exc)
            ) from exc
        except httpx.HTTPError as exc:
            # Ollama not running looks like a connection refusal here.
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
            )

        body = response.json()
        if body.get("error"):
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=str(body["error"])[:500],
            )

        text = ((body.get("message") or {}).get("content") or "").strip()
        if not text:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR, provider=self.slug, detail="blank completion"
            )

        return TextResult(
            text=text,
            provider=self.slug,
            model=self._model,
            tokens_in=body.get("prompt_eval_count"),
            tokens_out=body.get("eval_count"),
            latency_ms=latency_ms,
        )
