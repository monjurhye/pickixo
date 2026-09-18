"""YouTube transcripts: cache first, provider only when we must.

Shaped like the AI providers already in this codebase — one adapter per vendor
behind a normalised result — for the same reason: the rest of the application
should not know or care who supplied the data.

Cost is the thing driving the design. The provider charges one credit per
successful fetch, so:

  * the cache is checked before the provider, always;
  * a video is fetched once, whatever URL shape it arrives as, because the
    cache key is the video id and not the URL;
  * quota is taken only when we are about to spend a credit — a cache hit
    costs the user nothing;
  * a failed fetch is never stored as a success, because captions get added to
    videos later and a cached failure would outlive the reason for it.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any

import httpx

from .. import db
from ..config import Settings
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from .youtube import canonical_url

log = get_logger(__name__)

PROVIDER = "transcriptapi"
BASE_URL = "https://transcriptapi.com/api/v2"
TRANSCRIPT_PATH = "/youtube/transcript"

#: Their documented ceiling is 300/min per key. Ours is far lower by design —
#: see the daily quota — so this is only about not hanging a request forever.
REQUEST_TIMEOUT_SECONDS = 45.0

#: A transcript larger than this is refused rather than stored. A very long
#: stream can produce megabytes of JSON, and neither the database row nor the
#: browser rendering it benefits from that.
MAX_SEGMENTS = 20_000

#: Statuses the provider documents as retryable. Retrying these is free: only a
#: 200 is charged a credit, so a 408 costs nothing and trying again is strictly
#: better than handing the user a failure they could have avoided.
RETRYABLE_STATUSES = {408, 429, 503}

#: One retry, not a loop. The failures worth retrying are transient blips; if
#: the second attempt fails too, waiting longer is the user's decision, not
#: something to do while they watch a spinner.
MAX_ATTEMPTS = 2
RETRY_DELAY_SECONDS = 1.5


@dataclass(slots=True)
class Transcript:
    """Our shape, not the provider's.

    Everything downstream — the API response, the cache row, any future summary
    or translation feature — reads this. Swapping providers means writing a new
    `_fetch_*` that returns one of these, and changing nothing else.
    """

    video_id: str
    language: str
    segments: list[dict[str, Any]]
    title: str | None = None
    channel: str | None = None
    channel_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    from_cache: bool = False
    provider: str = PROVIDER

    @property
    def video_url(self) -> str:
        return canonical_url(self.video_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "video": {
                "id": self.video_id,
                "url": self.video_url,
                "title": self.title,
                "channel": self.channel,
                "channel_url": self.channel_url,
                "thumbnail_url": self.thumbnail_url,
                "duration_seconds": self.duration_seconds,
            },
            "language": self.language,
            "segment_count": len(self.segments),
            "transcript": self.segments,
            "cached": self.from_cache,
        }


# ===========================================================================
# Cache
# ===========================================================================
async def _from_cache(video_id: str, language: str | None) -> Transcript | None:
    """Look for a stored transcript.

    With no language asked for, any stored track will do — the user pasted a
    URL and wants the transcript, not a specific caption track.
    """
    if language:
        row = await db.fetch_one(
            "SELECT * FROM transcript_cache "
            " WHERE youtube_video_id = %s AND language = %s",
            (video_id, language),
        )
    else:
        row = await db.fetch_one(
            "SELECT * FROM transcript_cache WHERE youtube_video_id = %s "
            " ORDER BY last_accessed_at DESC LIMIT 1",
            (video_id,),
        )
    if row is None:
        return None

    # Recording the hit is what makes the cache's value measurable rather than
    # assumed. It must never fail the request.
    try:
        await db.execute(
            "UPDATE transcript_cache "
            "   SET hit_count = hit_count + 1, last_accessed_at = now() "
            " WHERE id = %s",
            (row["id"],),
        )
    except Exception:  # noqa: BLE001
        log.exception("transcript.cache_hit_count_failed", video_id=video_id)

    segments = row["transcript_data"]
    if isinstance(segments, str):
        segments = json.loads(segments)

    return Transcript(
        video_id=row["youtube_video_id"],
        language=row["language"],
        segments=segments,
        title=row["video_title"],
        channel=row["channel_name"],
        channel_url=row["channel_url"],
        thumbnail_url=row["thumbnail_url"],
        duration_seconds=row["duration_seconds"],
        from_cache=True,
        provider=row["provider"],
    )


async def _store(transcript: Transcript) -> None:
    """Save a successful fetch. Never raises into the request.

    A transcript we could not store is still a transcript we can return; the
    only cost is fetching it again next time.
    """
    try:
        await db.execute(
            """
            INSERT INTO transcript_cache
                (youtube_video_id, language, video_url, video_title, channel_name,
                 channel_url, thumbnail_url, duration_seconds, transcript_data,
                 segment_count, provider)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (youtube_video_id, language) DO UPDATE SET
                video_title      = EXCLUDED.video_title,
                channel_name     = EXCLUDED.channel_name,
                channel_url      = EXCLUDED.channel_url,
                thumbnail_url    = EXCLUDED.thumbnail_url,
                duration_seconds = EXCLUDED.duration_seconds,
                transcript_data  = EXCLUDED.transcript_data,
                segment_count    = EXCLUDED.segment_count,
                updated_at       = now()
            """,
            (
                transcript.video_id, transcript.language, transcript.video_url,
                transcript.title, transcript.channel, transcript.channel_url,
                transcript.thumbnail_url, transcript.duration_seconds,
                json.dumps(transcript.segments, ensure_ascii=False),
                len(transcript.segments), transcript.provider,
            ),
        )
    except Exception:  # noqa: BLE001
        log.exception("transcript.cache_write_failed", video_id=transcript.video_id)


# ===========================================================================
# Provider
# ===========================================================================
def is_configured(settings: Settings) -> bool:
    return bool(settings.transcript_api_key)


def _normalise(payload: dict[str, Any], video_id: str) -> Transcript:
    """Provider response -> our shape.

    Defensive about the parts that are not load-bearing: metadata is optional
    and a missing title should not fail a request that produced a transcript.
    The segments are not optional — without them there is nothing to return.
    """
    raw_segments = payload.get("transcript")
    if not isinstance(raw_segments, list) or not raw_segments:
        raise AppError(
            ErrorCode.TRANSCRIPT_UNAVAILABLE,
            detail=f"provider returned no segments for {video_id}",
        )
    if len(raw_segments) > MAX_SEGMENTS:
        raise AppError(
            ErrorCode.TRANSCRIPT_TOO_LARGE,
            detail=f"{len(raw_segments)} segments exceeds the {MAX_SEGMENTS} limit",
        )

    segments: list[dict[str, Any]] = []
    for item in raw_segments:
        if not isinstance(item, dict):
            continue
        text = (item.get("text") or "").strip()
        if not text:
            continue
        try:
            start = round(float(item.get("start") or 0.0), 3)
            duration = round(float(item.get("duration") or 0.0), 3)
        except (TypeError, ValueError):
            continue
        segments.append({"start": start, "duration": duration, "text": text})

    if not segments:
        raise AppError(
            ErrorCode.TRANSCRIPT_UNAVAILABLE,
            detail=f"every segment for {video_id} was empty or malformed",
        )

    metadata = payload.get("metadata") or {}
    length = payload.get("length_seconds")

    return Transcript(
        video_id=payload.get("video_id") or video_id,
        language=payload.get("language") or "unknown",
        segments=segments,
        title=metadata.get("title"),
        channel=metadata.get("author_name"),
        channel_url=metadata.get("author_url"),
        thumbnail_url=metadata.get("thumbnail_url"),
        duration_seconds=int(length) if isinstance(length, (int, float)) else None,
    )


def _provider_error(status: int, body: str, video_id: str) -> AppError:
    """Map the provider's status codes onto our vocabulary.

    The provider's own message is kept for the log and never returned: it can
    name the vendor, and a user does not need to know which one we use.
    """
    if status == 404:
        return AppError(
            ErrorCode.TRANSCRIPT_UNAVAILABLE,
            detail=f"provider 404 for {video_id}: {body[:200]}",
        )
    if status == 429:
        return AppError(ErrorCode.SERVICE_BUSY,
                        detail=f"provider rate limited: {body[:200]}")
    if status in (401, 403):
        # Our key is wrong or expired. The user cannot fix this and should not
        # be told it is their fault.
        return AppError(ErrorCode.PROVIDER_NOT_CONFIGURED,
                        detail=f"provider auth failed ({status}): {body[:200]}")
    if status == 402:
        return AppError(ErrorCode.PROVIDER_QUOTA_EXHAUSTED,
                        detail=f"provider credits exhausted: {body[:200]}")
    if status in (400, 422):
        return AppError(ErrorCode.INVALID_YOUTUBE_URL,
                        detail=f"provider rejected input ({status}): {body[:200]}")
    return AppError(ErrorCode.TRANSCRIPT_FAILED,
                    detail=f"provider returned {status}: {body[:200]}")


async def _fetch_from_provider(
    video_id: str, language: str | None, settings: Settings
) -> Transcript:
    """One provider call, retried once on the failures it documents as transient.

    The retry is deliberately narrow. A 404 means the video has no transcript
    and asking again will not change that; a 401 means our key is wrong. Only
    408, 429 and 503 — the three the provider itself marks retryable — get a
    second attempt, and only one.
    """
    params: dict[str, Any] = {
        "video_url": video_id,
        "send_metadata": "true",
        "include_timestamp": "true",
        "format": "json",
    }
    if language:
        params["language"] = language

    headers = {"Authorization": f"Bearer {settings.transcript_api_key}"}
    last_error: AppError | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    f"{BASE_URL}{TRANSCRIPT_PATH}", params=params, headers=headers
                )
        except httpx.TimeoutException as exc:
            last_error = AppError(ErrorCode.TRANSCRIPT_FAILED,
                                  detail=f"provider timeout: {exc}")
        except httpx.HTTPError as exc:
            last_error = AppError(ErrorCode.TRANSCRIPT_FAILED,
                                  detail=f"provider unreachable: {exc}")
        else:
            if response.status_code == 200:
                try:
                    payload = response.json()
                except ValueError as exc:
                    raise AppError(
                        ErrorCode.TRANSCRIPT_FAILED,
                        detail="provider returned a non-JSON body",
                    ) from exc

                transcript = _normalise(payload, video_id)
                log.info(
                    "transcript.provider_fetch",
                    video_id=video_id,
                    language=transcript.language,
                    segments=len(transcript.segments),
                    attempt=attempt,
                    # Set by the provider when a credit was actually spent.
                    credits=response.headers.get("x-credits-charged"),
                )
                return transcript

            error = _provider_error(response.status_code, response.text, video_id)
            if response.status_code not in RETRYABLE_STATUSES:
                raise error
            last_error = error
            log.info("transcript.provider_retryable",
                     video_id=video_id, status=response.status_code, attempt=attempt)

        if attempt < MAX_ATTEMPTS:
            await asyncio.sleep(RETRY_DELAY_SECONDS)

    log.warning("transcript.provider_gave_up", video_id=video_id,
                attempts=MAX_ATTEMPTS, detail=last_error.detail if last_error else None)
    raise last_error or AppError(ErrorCode.TRANSCRIPT_FAILED,
                                 detail="provider exhausted without a result")


# ===========================================================================
# Entry point
# ===========================================================================
async def get_transcript(
    video_id: str, *, language: str | None, settings: Settings
) -> Transcript:
    """Cache first; provider only if we have to.

    The caller decides what a cache miss costs the user — quota is deliberately
    not consumed here, so a cache hit can be free.
    """
    cached = await _from_cache(video_id, language)
    if cached is not None:
        log.info("transcript.cache_hit", video_id=video_id,
                 language=cached.language)
        return cached

    if not is_configured(settings):
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="TRANSCRIPT_API_KEY is not set",
        )

    transcript = await _fetch_from_provider(video_id, language, settings)
    await _store(transcript)
    return transcript


async def peek_cache(video_id: str, language: str | None) -> Transcript | None:
    """A cached transcript, or None. Does not touch the provider or quota.

    Public so the route can answer a cache hit without spending anything — the
    route needs that decision, and reaching into a private helper to get it
    would make the free path an implementation detail rather than a contract.
    """
    return await _from_cache(video_id, language)


async def stats() -> dict[str, Any]:
    """What the cache has saved us. Used by the admin view."""
    row = await db.fetch_one(
        """
        SELECT count(*)                        AS cached_videos,
               coalesce(sum(hit_count), 0)     AS cache_hits,
               coalesce(sum(segment_count), 0) AS total_segments,
               max(last_accessed_at)           AS last_used_at
          FROM transcript_cache
        """
    )
    return {
        # One provider call per cached video: that is what we have spent.
        "provider_fetches": row["cached_videos"],
        "cache_hits": row["cache_hits"],
        "cached_videos": row["cached_videos"],
        "total_segments": row["total_segments"],
        "last_used_at": row["last_used_at"].isoformat() if row["last_used_at"] else None,
    }
