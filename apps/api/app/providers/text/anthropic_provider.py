"""Anthropic (Claude) adapter, through the official `anthropic` SDK.

A paid provider on a bench of free ones, and placed accordingly: after Groq in
TEXT_PROVIDER_PRIORITY, so it is only called when the free tier is rate-limited,
out of daily quota, or down. With Claude Haiku 4.5 ($1 / $5 per million input /
output tokens, checked 2026-09) the Facebook agent's whole day is roughly $0.25
if every call landed here; as a fallback it is usually cents a month.

Two deliberate choices:

* **SDK retries are off** (`max_retries=0`). The provider manager already
  retries timeouts and 5xx once and then fails over, with cooldowns; letting
  the SDK retry underneath it would multiply the wait and the spend on a
  provider that is having a bad minute.
* **Thinking is not requested.** Haiku 4.5 runs without it unless asked, and
  the agent's calls are short structured-JSON jobs where it would only add
  cost. Nothing here sends `thinking` or sampling parameters.

The key lives in .env as ANTHROPIC_API_KEY and is passed to the client
explicitly — never logged, never in an error detail.
"""
from __future__ import annotations

import time

import anthropic

from ..base import (
    ProviderError,
    ProviderFailure,
    TextProvider,
    TextRequest,
    TextResult,
    build_system_prompt,
)


def _retry_after(exc: anthropic.APIStatusError) -> int | None:
    raw = exc.response.headers.get("retry-after") if exc.response is not None else None
    if not raw:
        return None
    try:
        return max(1, min(int(float(raw)), 3600))
    except (TypeError, ValueError):
        return None


class AnthropicTextProvider(TextProvider):
    slug = "anthropic"
    display_name = "Anthropic Claude"

    def __init__(self, api_key: str, model: str, enabled: bool = True,
                 timeout_seconds: float = 60.0,
                 client: anthropic.AsyncAnthropic | None = None) -> None:
        self._api_key = api_key
        self._model = model
        self._enabled = enabled
        self._timeout = timeout_seconds
        self._client = client

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def _get_client(self) -> anthropic.AsyncAnthropic:
        # Created on first use, not at startup: an unconfigured install never
        # builds one, and a configured one reuses its connection pool.
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=self._api_key, max_retries=0, timeout=self._timeout,
            )
        return self._client

    async def generate(self, request: TextRequest) -> TextResult:
        if not self.is_configured:
            raise ProviderError(
                ProviderFailure.NOT_CONFIGURED, provider=self.slug, detail="missing api key"
            )

        started = time.perf_counter()
        try:
            response = await self._get_client().messages.create(
                model=self._model,
                max_tokens=request.max_output_tokens,
                system=build_system_prompt(request),
                messages=[{"role": "user", "content": request.prompt}],
            )
        # Most specific first: the typed subclasses carry the distinction the
        # manager routes on (cool down vs. give up vs. try the next provider).
        except anthropic.APITimeoutError as exc:
            raise ProviderError(ProviderFailure.TIMEOUT, provider=self.slug,
                                detail="request timed out") from exc
        except anthropic.RateLimitError as exc:
            raise ProviderError(ProviderFailure.RATE_LIMITED, provider=self.slug,
                                detail="rate limited", http_status=429,
                                retry_after_seconds=_retry_after(exc)) from exc
        except anthropic.AuthenticationError as exc:
            raise ProviderError(ProviderFailure.NOT_CONFIGURED, provider=self.slug,
                                detail="api key rejected", http_status=401) from exc
        except anthropic.PermissionDeniedError as exc:
            # Includes an organisation out of credit or over its spend limit.
            raise ProviderError(ProviderFailure.QUOTA_EXHAUSTED, provider=self.slug,
                                detail="permission denied", http_status=403) from exc
        except (anthropic.BadRequestError, anthropic.NotFoundError) as exc:
            # A bad model id is a 404 — our configuration, not a transient fault.
            raise ProviderError(ProviderFailure.BAD_REQUEST, provider=self.slug,
                                detail=str(exc.message)[:300],
                                http_status=exc.status_code) from exc
        except anthropic.APIStatusError as exc:
            # 5xx and 529 overloaded: worth one retry, then fail over.
            failure = (ProviderFailure.UPSTREAM_ERROR if exc.status_code >= 500
                       else ProviderFailure.UNKNOWN)
            raise ProviderError(failure, provider=self.slug,
                                detail=f"HTTP {exc.status_code}",
                                http_status=exc.status_code,
                                retry_after_seconds=_retry_after(exc)) from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderError(ProviderFailure.UPSTREAM_ERROR, provider=self.slug,
                                detail="connection failed") from exc

        latency_ms = int((time.perf_counter() - started) * 1000)

        if response.stop_reason == "refusal":
            raise ProviderError(ProviderFailure.CONTENT_BLOCKED, provider=self.slug,
                                detail="model declined the request")

        text = "".join(block.text for block in response.content if block.type == "text")
        if not text.strip():
            raise ProviderError(ProviderFailure.UPSTREAM_ERROR, provider=self.slug,
                                detail="blank completion")

        return TextResult(
            text=text.strip(),
            provider=self.slug,
            model=self._model,
            tokens_in=response.usage.input_tokens,
            tokens_out=response.usage.output_tokens,
            latency_ms=latency_ms,
        )
