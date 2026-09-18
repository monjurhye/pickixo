"""Pickixo AI.

One endpoint per capability, not one per vendor. Which provider answered is
reported in the response for debugging, but the user never chooses one and never
needs to know that there is more than one (§158).
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..dependencies import OptionalUser, SettingsDep, quota_identity
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..schemas import TextRequest, TextResponse, UsageInfo
from ..services import ai as ai_service
from ..services import quota

log = get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/text", response_model=TextResponse)
async def generate_text(
    body: TextRequest, request: Request, user: OptionalUser, settings: SettingsDep
) -> TextResponse:
    """Generate a text answer.

    Works signed out within a smaller daily allowance, so someone arriving from
    a search result can try it before deciding to create an account (§52).
    """
    user_id, guest, _ = quota_identity(request, user, settings)

    result = await ai_service.generate_text(
        prompt=body.prompt,
        system=body.system,
        locale=body.locale,
        max_tokens=body.max_tokens,
        user_id=user_id,
        guest_key=guest,
        settings=settings,
    )
    return TextResponse(
        content=result["content"],
        provider=result["provider"],
        model=result["model"],
        usage=UsageInfo(**result["usage"]),
        latency_ms=result["latency_ms"],
        fallback_used=result["fallback_used"],
        request_id=result["request_id"],
    )


@router.get("/status")
async def ai_status(
    request: Request, user: OptionalUser, settings: SettingsDep
) -> dict:
    """Whether AI can actually serve a request right now, and what is left.

    The chat page calls this before enabling its input. Telling someone up front
    that AI is unavailable is better than taking their prompt and failing.
    """
    user_id, guest, is_guest = quota_identity(request, user, settings)
    ready = ai_service.providers_ready()
    return {
        "available": ready > 0,
        "free": True,
        "quota": await quota.status(
            user_id=user_id, guest_key=guest, kind="text", settings=settings
        ),
        "signed_in": not is_guest,
    }
