"""The opening clip: a few seconds of real motion, from Wan via fal.ai.

The only step in a reel that costs money, and deliberately the only one. The
first seconds decide whether anyone watches the rest, so that is where motion
is bought; everything after it is stills with a slow zoom, which are free.

Flow, per fal's queue API (fal.ai/docs/model-apis/model-endpoints/queue):

    POST https://queue.fal.run/<model>        -> request_id, status_url, response_url
    GET  status_url   until COMPLETED
    GET  response_url -> {"video": {"url": ...}}
    GET  video url    -> the mp4

The status and response URLs are taken from the submit response rather than
built here, so a change in fal's URL scheme does not break polling.

Audio generation is switched off: the narration is added later, and a silent
Wan Flash clip is billed at half the rate of one with sound.

The key is sent as a header and never logged. Failure of any kind raises
HookUnavailable, and the caller falls back to a still opening — a reel without
a moving hook is a weaker reel, not a failed one.
"""
from __future__ import annotations

import asyncio
import base64
import io
import time
from typing import Any

import httpx

from ...logging_config import get_logger

log = get_logger(__name__)

QUEUE_BASE = "https://queue.fal.run"
_POLL_SECONDS = 5.0


class HookUnavailable(RuntimeError):
    """No hook clip this time. Never fatal to the reel."""


def _as_data_uri(image: bytes) -> str:
    """JPEG data URI of the first frame.

    fal accepts data URIs for image_url, which avoids hosting the frame
    anywhere public. Re-encoded as JPEG because a 720x1280 PNG is several
    times larger in base64 and the model does not care.
    """
    from PIL import Image

    with Image.open(io.BytesIO(image)) as img:
        buffer = io.BytesIO()
        img.convert("RGB").save(buffer, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


async def generate_hook(
    *, image: bytes, motion_prompt: str, fal_key: str, model: str,
    resolution: str = "720p", seconds: int = 5, timeout_seconds: int = 480,
    client: httpx.AsyncClient | None = None,
) -> bytes:
    """Animate the opening still. Returns mp4 bytes, or raises HookUnavailable."""
    if not fal_key:
        raise HookUnavailable("no fal.ai key is configured")

    duration = str(seconds if seconds in (5, 10, 15) else 5)
    payload: dict[str, Any] = {
        "prompt": motion_prompt[:1400],
        "image_url": _as_data_uri(image),
        "duration": duration,
        "resolution": resolution,
        "generate_audio": False,
        # The prompt is already specific; letting fal rewrite it is how a
        # slow-walking lion becomes a roaring one.
        "enable_prompt_expansion": False,
        "negative_prompt": ("text, watermark, logo, people, humans, cartoon, "
                            "distorted anatomy, extra limbs, flicker"),
    }
    headers = {"Authorization": f"Key {fal_key}"}

    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    started = time.monotonic()
    try:
        try:
            submit = await http.post(f"{QUEUE_BASE}/{model}", json=payload,
                                     headers=headers)
        except httpx.HTTPError as exc:
            raise HookUnavailable(f"could not reach fal.ai: {type(exc).__name__}") from exc
        if submit.status_code >= 400:
            raise HookUnavailable(f"fal.ai refused the job (HTTP {submit.status_code})")

        job = submit.json()
        status_url = job.get("status_url")
        response_url = job.get("response_url")
        if not status_url or not response_url:
            raise HookUnavailable("fal.ai returned no status/response URL")
        log.info("reel.hook_submitted", request_id=str(job.get("request_id"))[:40],
                 model=model)

        # --- wait -----------------------------------------------------------
        while True:
            if time.monotonic() - started > timeout_seconds:
                # The job may still finish and be billed. Said plainly in the
                # log so a charge without a clip is explicable.
                raise HookUnavailable(
                    f"hook not ready after {timeout_seconds}s; abandoned "
                    "(fal may still complete and bill it)"
                )
            await asyncio.sleep(_POLL_SECONDS)
            try:
                status = await http.get(status_url, headers=headers)
            except httpx.HTTPError:
                continue  # a blip while polling is not a failed job
            if status.status_code >= 400:
                raise HookUnavailable(f"status check failed (HTTP {status.status_code})")
            state = str(status.json().get("status") or "").upper()
            if state == "COMPLETED":
                break
            if state not in {"IN_QUEUE", "IN_PROGRESS"}:
                raise HookUnavailable(f"fal.ai job ended as {state or 'unknown'}")

        # --- collect ----------------------------------------------------------
        result = await http.get(response_url, headers=headers)
        if result.status_code >= 400:
            raise HookUnavailable(f"result fetch failed (HTTP {result.status_code})")
        body = result.json()
        video_url = ((body.get("video") or {}).get("url")
                     if isinstance(body, dict) else None)
        if not video_url:
            raise HookUnavailable("fal.ai result had no video")

        # The file URL is a public CDN link; sending the key there would hand
        # it to whoever serves that host.
        video = await http.get(video_url, timeout=httpx.Timeout(120.0, connect=10.0))
        if video.status_code >= 400 or not video.content:
            raise HookUnavailable(f"video download failed (HTTP {video.status_code})")

        log.info("reel.hook_ready", seconds=round(time.monotonic() - started, 1),
                 bytes=len(video.content))
        return video.content
    finally:
        if owns_client:
            await http.aclose()
