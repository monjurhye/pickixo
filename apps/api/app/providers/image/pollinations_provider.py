"""Pollinations image adapter.

Returns raw image bytes; the caller is responsible for writing them to disk and
recording a generated_files row. The response is validated as a real image
before it is accepted — a provider that returns an HTML error page with a 200
must not be stored as a .jpg.
"""
from __future__ import annotations

import time
import urllib.parse

import httpx

from ..base import (
    ImageProvider,
    ImageRequest,
    ImageResult,
    ProviderError,
    ProviderFailure,
)
from ..http import classify_status, get_client, parse_retry_after

BASE = "https://image.pollinations.ai/prompt"

#: Guard against a provider streaming something unreasonable onto a small disk.
MAX_IMAGE_BYTES = 12 * 1024 * 1024

_MIME_BY_MAGIC = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"RIFF", "image/webp"),
)


def sniff_mime(data: bytes) -> str | None:
    """Trust the bytes, not the Content-Type header."""
    for magic, mime in _MIME_BY_MAGIC:
        if data.startswith(magic):
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    return None


class PollinationsImageProvider(ImageProvider):
    slug = "pollinations_image"
    display_name = "Pollinations (image)"

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

    async def generate(self, request: ImageRequest) -> ImageResult:
        if not self.is_configured:
            raise ProviderError(
                ProviderFailure.NOT_CONFIGURED, provider=self.slug, detail="missing api key"
            )

        width, height = request.dimensions
        prompt = request.prompt
        if request.style:
            prompt = f"{prompt}, {request.style} style"

        params = {
            "model": self._model,
            "width": width,
            "height": height,
            "nologo": "true",
            "safe": "true",
        }
        if request.seed is not None:
            params["seed"] = request.seed
        if request.negative_prompt:
            params["negative"] = request.negative_prompt

        # The prompt travels in the path, so it must be percent-encoded.
        url = f"{BASE}/{urllib.parse.quote(prompt, safe='')}"

        started = time.perf_counter()
        try:
            response = await get_client().get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=httpx.Timeout(120.0, connect=10.0),
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
                detail=response.text[:300],
                http_status=response.status_code,
                retry_after_seconds=parse_retry_after(response),
            )

        data = response.content
        if len(data) > MAX_IMAGE_BYTES:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=f"oversized response: {len(data)} bytes",
            )

        mime = sniff_mime(data)
        if mime is None:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=f"response was not an image (first bytes: {data[:16]!r})",
            )

        return ImageResult(
            data=data,
            mime_type=mime,
            width=width,
            height=height,
            provider=self.slug,
            model=self._model,
            seed=request.seed,
            latency_ms=latency_ms,
        )
