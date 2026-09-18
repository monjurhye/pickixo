"""Pickixo tools.

One router for the small single-purpose products. They share a shape: validate
strictly, do one thing, return our own format.
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..dependencies import OptionalUser, SettingsDep, quota_identity
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..schemas import TranscriptRequest, TranscriptResponse
from ..services import quota, registry
from ..services import transcript as transcript_service
from ..services.youtube import InvalidYouTubeUrl, extract_video_id

log = get_logger(__name__)
router = APIRouter(prefix="/tools", tags=["tools"])


@router.post("/youtube-transcript", response_model=TranscriptResponse)
async def youtube_transcript(
    body: TranscriptRequest,
    request: Request,
    user: OptionalUser,
    settings: SettingsDep,
) -> TranscriptResponse:
    """Fetch a YouTube transcript.

    Order of operations, and the reason for it:

    1. **Extract the video id first.** Nothing reaches the provider that has not
       been proved to be a YouTube video. A pasted blog URL is rejected here,
       for free, rather than becoming a paid API call that fails.
    2. **Check the cache.** A hit costs nothing and consumes no quota — the same
       video pasted twice, or a double-clicked button, must not bill anyone.
    3. **Only then take quota**, because only now are we about to spend a
       provider credit.
    4. **Refund on failure.** A provider outage is our problem, not the user's
       allowance.

    Works signed out: someone arriving from a search result can use the tool
    before deciding whether to create an account.
    """
    try:
        video_id = extract_video_id(body.url)
    except InvalidYouTubeUrl as exc:
        # The user's mistake, answered without touching the provider.
        raise AppError(ErrorCode.INVALID_YOUTUBE_URL, detail=str(exc)) from exc

    language = body.language or None
    user_id, guest_key, is_guest = quota_identity(request, user, settings)

    # --- 2. cache ----------------------------------------------------------
    cached = await transcript_service.peek_cache(video_id, language)
    if cached is not None:
        await _record_use(user)
        return TranscriptResponse(**cached.to_dict())

    # --- 3. quota, only now that a credit is at stake -----------------------
    await quota.consume(
        user_id=user_id, guest_key=guest_key, kind="transcript", settings=settings
    )

    try:
        result = await transcript_service.get_transcript(
            video_id, language=language, settings=settings
        )
    except AppError:
        # Nothing usable came back, so the allowance should not have been spent.
        await quota.refund(user_id=user_id, guest_key=guest_key, kind="transcript")
        raise

    await _record_use(user)
    return TranscriptResponse(**result.to_dict())


async def _record_use(user: dict | None) -> None:
    """Note that the tool was opened, for Recently Used.

    Product-level only: which tool, never which video. Never raises — a missing
    activity row is not worth failing a successful request over.
    """
    try:
        app = await registry.get_app("youtube-transcript")
        if app:
            await registry.record_use(
                str(user["id"]) if user else None, str(app["id"])
            )
    except Exception:  # noqa: BLE001
        log.exception("tools.record_use_failed", tool="youtube-transcript")


@router.get("/youtube-transcript/status")
async def transcript_status(
    request: Request, user: OptionalUser, settings: SettingsDep
) -> dict:
    """Whether the tool can serve a request, and what the caller has left.

    The page asks before enabling its button, so an unconfigured deployment says
    so instead of taking a URL it cannot process.
    """
    user_id, guest_key, is_guest = quota_identity(request, user, settings)
    return {
        "available": transcript_service.is_configured(settings),
        "quota": await quota.status(
            user_id=user_id, guest_key=guest_key, kind="transcript", settings=settings
        ),
        "signed_in": not is_guest,
    }
