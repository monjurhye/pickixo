"""Cloudflare Workers AI image adapter (FLUX.1 [schnell]).

Chosen because it is the only image service verified to have a recurring free
allowance: 10,000 neurons per day, reset at 00:00 UTC, no card required. At
roughly 58 neurons per image that is about 170 images a day — enough for a site
this size, where Pollinations now bills prepaid credit per generation.

Two quirks the rest of the app must not have to know about:

  * The model takes only ``prompt`` and ``steps``. There is no width, height,
    seed or negative prompt, so it always returns one square image. Every other
    aspect ratio this app offers is produced here by cropping — see
    ``_fit_to_ratio``. Models that accept real dimensions cost over a hundred
    times more per image, which would turn 170 free images a day into three.
  * The image comes back base64-encoded inside JSON, not as raw bytes.
"""
from __future__ import annotations

import base64
import binascii
import io
import time

import httpx
from PIL import Image

from ..base import (
    ImageProvider,
    ImageRequest,
    ImageResult,
    ProviderError,
    ProviderFailure,
)
from ..http import classify_status, get_client, parse_retry_after

BASE = "https://api.cloudflare.com/client/v4/accounts"

#: Guard against decoding something unreasonable into a 4 GB box's memory.
MAX_IMAGE_BYTES = 12 * 1024 * 1024

#: The model's own ceiling is 8. Four is its default and what the free-tier
#: arithmetic above assumes; each extra step costs 9.6 neurons.
STEPS = 4

JPEG_MAGIC = b"\xff\xd8\xff"


def _fit_to_ratio(data: bytes, width: int, height: int) -> bytes:
    """Centre-crop a square generation to the ratio the user asked for.

    Cropping rather than stretching: a squashed face is more obviously wrong
    than a tighter frame. Returns JPEG bytes at exactly width x height.
    """
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        src_w, src_h = img.size
        if (src_w, src_h) == (width, height):
            return data

        target_ratio = width / height
        src_ratio = src_w / src_h

        if src_ratio > target_ratio:
            # Source is wider than the target: trim the sides.
            new_w = round(src_h * target_ratio)
            left = (src_w - new_w) // 2
            box = (left, 0, left + new_w, src_h)
        else:
            # Source is taller: trim top and bottom.
            new_h = round(src_w / target_ratio)
            top = (src_h - new_h) // 2
            box = (0, top, src_w, top + new_h)

        out = io.BytesIO()
        img.crop(box).resize((width, height), Image.LANCZOS).save(
            out, format="JPEG", quality=90
        )
        return out.getvalue()


class CloudflareImageProvider(ImageProvider):
    slug = "cloudflare_image"
    display_name = "Cloudflare Workers AI"

    def __init__(
        self,
        account_id: str,
        api_token: str,
        model: str,
        enabled: bool = False,
        edit_model: str = "",
    ) -> None:
        self._account_id = account_id
        self._api_token = api_token
        self._model = model
        self._enabled = enabled
        # A second model, used only when a reference image is supplied. schnell
        # takes no image input at all, so character consistency needs one that
        # does. It costs roughly twice as many neurons per image, which is why
        # it is not the default.
        self._edit_model = edit_model

    @property
    def is_configured(self) -> bool:
        return bool(self._account_id and self._api_token and self._model)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    async def generate(self, request: ImageRequest) -> ImageResult:
        if not self.is_configured:
            raise ProviderError(
                ProviderFailure.NOT_CONFIGURED,
                provider=self.slug,
                detail="missing account id or api token",
            )

        prompt = request.prompt
        if request.style:
            prompt = f"{prompt}, {request.style} style"
        # The model has no negative-prompt input. Saying what to avoid in the
        # prompt itself is weaker than a real negative, but it is not nothing.
        if request.negative_prompt:
            prompt = f"{prompt}. Avoid: {request.negative_prompt}"

        # With a reference image the edit model takes multipart, not JSON.
        use_reference = bool(request.reference_image and self._edit_model)
        model = self._edit_model if use_reference else self._model
        url = f"{BASE}/{self._account_id}/ai/run/{model}"
        headers = {"Authorization": f"Bearer {self._api_token}"}

        started = time.perf_counter()
        try:
            if use_reference:
                response = await get_client().post(
                    url,
                    data={"prompt": prompt[:2048]},
                    files={"image": ("reference.jpg", request.reference_image, "image/jpeg")},
                    headers=headers,
                    timeout=httpx.Timeout(180.0, connect=10.0),
                )
            else:
                response = await get_client().post(
                    url,
                    json={"prompt": prompt[:2048], "steps": STEPS},
                    headers=headers,
                    timeout=httpx.Timeout(120.0, connect=10.0),
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
                detail=response.text[:300],
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

        # Cloudflare reports model-level failures in a 200 body.
        if not body.get("success", False):
            errors = body.get("errors") or []
            detail = "; ".join(str(e.get("message", e)) for e in errors)[:300]
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=detail or "request unsuccessful",
            )

        encoded = (body.get("result") or {}).get("image")
        if not isinstance(encoded, str) or not encoded:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail="no image in response",
            )

        try:
            data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail="image was not valid base64",
            ) from exc

        if len(data) > MAX_IMAGE_BYTES:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=f"oversized response: {len(data)} bytes",
            )

        if not data.startswith(JPEG_MAGIC):
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=f"decoded bytes were not a JPEG (first bytes: {data[:8]!r})",
            )

        width, height = request.dimensions
        try:
            data = _fit_to_ratio(data, width, height)
        except OSError as exc:
            raise ProviderError(
                ProviderFailure.UPSTREAM_ERROR,
                provider=self.slug,
                detail=f"could not crop to {width}x{height}: {exc}",
            ) from exc

        return ImageResult(
            data=data,
            mime_type="image/jpeg",
            width=width,
            height=height,
            provider=self.slug,
            model=model,
            seed=None,   # the model takes no seed, so results are not reproducible
            latency_ms=latency_ms,
        )
