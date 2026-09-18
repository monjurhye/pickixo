"""One adapter for every vendor that speaks OpenAI's chat-completions shape.

Cerebras, OpenRouter, GitHub Models, Mistral and NVIDIA NIM all accept the
same request body and return the same response body as Groq does. Rather than
copy the Groq adapter five times, they are all instances of this class,
differing only in endpoint, key, model and a couple of quirks.

Adding another such vendor is a config change, not a code change — which is
the point of the provider package (see base.py).

Free-tier positions verified 2026-09 from each vendor's own docs. They change
without notice; docs/PROVIDER_TERMS.md records what was true when and where to
re-check. Nothing here assumes a tier still exists: a provider whose key is
absent is skipped silently, and one that starts refusing is cooled down by the
manager and failed past.
"""
from __future__ import annotations

import time
from typing import Literal

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


class OpenAICompatibleTextProvider(TextProvider):
    """A text provider defined entirely by its endpoint and credentials.

    Args:
        slug: stable identifier used in priority lists, logs and the admin
            panel. Must match the name used in TEXT_PROVIDER_PRIORITY.
        display_name: what a human sees in the admin panel.
        endpoint: full chat-completions URL, including path.
        api_key: bearer token. Empty means "not configured" — skipped, never
            faked.
        model: model identifier as that vendor spells it.
        enabled: operator kill-switch, independent of whether a key exists.
        token_param: vendors disagree on the output-cap field name. OpenAI's
            newer spelling is ``max_completion_tokens``; most others still
            take ``max_tokens`` and reject the newer one outright.
        extra_headers: vendor-specific headers (OpenRouter asks callers to
            identify themselves, for example).
        supports_temperature: a few reasoning-tuned endpoints reject any
            temperature at all.
    """

    kind = "text"

    def __init__(
        self,
        *,
        slug: str,
        display_name: str,
        endpoint: str,
        api_key: str,
        model: str,
        enabled: bool = False,
        token_param: Literal["max_tokens", "max_completion_tokens"] = "max_tokens",
        extra_headers: dict[str, str] | None = None,
        supports_temperature: bool = True,
    ) -> None:
        self.slug = slug
        self.display_name = display_name
        self._endpoint = endpoint
        self._api_key = api_key
        self._model = model
        self._enabled = enabled
        self._token_param = token_param
        self._extra_headers = extra_headers or {}
        self._supports_temperature = supports_temperature

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._endpoint and self._model)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def _build_payload(self, request: TextRequest) -> dict:
        payload: dict = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": build_system_prompt(request)},
                {"role": "user", "content": request.prompt},
            ],
            self._token_param: request.max_output_tokens,
        }
        if self._supports_temperature:
            payload["temperature"] = 0.8
        return payload

    async def generate(self, request: TextRequest) -> TextResult:
        if not self.is_configured:
            raise ProviderError(
                ProviderFailure.NOT_CONFIGURED,
                provider=self.slug,
                detail="missing api key",
            )

        headers = {"Authorization": f"Bearer {self._api_key}", **self._extra_headers}

        started = time.perf_counter()
        try:
            response = await get_client().post(
                self._endpoint, json=self._build_payload(request), headers=headers
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

        try:
            body = response.json()
        except ValueError as exc:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail="response was not JSON",
            ) from exc

        # Some gateways answer 200 with an error object rather than choices.
        if isinstance(body.get("error"), dict):
            message = str(body["error"].get("message", ""))[:500]
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=message or "error object in 200 response",
            )

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

        message = choice.get("message") or {}
        raw_content = message.get("content")

        # `content` is normally a string, but some gateways return the
        # multi-part array shape instead. Normalise both to text.
        if isinstance(raw_content, list):
            text = "".join(
                part.get("text", "")
                for part in raw_content
                if isinstance(part, dict)
            )
        elif isinstance(raw_content, str):
            text = raw_content
        else:
            text = ""

        # Reasoning-tuned models sometimes leave `content` empty and put the
        # answer here. Fall back rather than reporting a blank generation.
        if not text.strip():
            reasoning = message.get("reasoning_content")
            if isinstance(reasoning, str):
                text = reasoning

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
