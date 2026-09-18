"""Everything scoped to the signed-in user: profile, My Apps, recent, quota.

Every query in this module carries the caller's own user_id. There is no route
here that takes a user id from the client, so one account cannot address
another's rows by changing a parameter.
"""
from __future__ import annotations

from fastapi import APIRouter, Request, Response

from ..dependencies import CurrentUser, SettingsDep, quota_identity
from ..errors import AppError, ErrorCode
from ..schemas import (
    AddToMyAppsRequest,
    AppSummary,
    MyAppEntry,
    PinRequest,
    QuotaStatus,
    RecentEntry,
    ReorderRequest,
    UserResponse,
)
from ..services import quota, registry

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserResponse)
async def get_me(user: CurrentUser) -> UserResponse:
    return UserResponse(**user)


# ---------------------------------------------------------------------------
# My Apps (§15-§18)
# ---------------------------------------------------------------------------
@router.get("/apps", response_model=list[MyAppEntry])
async def my_apps(user: CurrentUser) -> list[MyAppEntry]:
    rows = await registry.list_my_apps(str(user["id"]))
    return [
        MyAppEntry(
            app=AppSummary(**row),
            is_pinned=row["is_pinned"],
            sort_order=row["sort_order"],
            added_at=row["added_at"],
        )
        for row in rows
    ]


@router.post("/apps", status_code=201)
async def add_app(body: AddToMyAppsRequest, user: CurrentUser) -> dict:
    app_id = await registry.resolve_app_id(app_id=body.app_id, slug=body.slug)
    await registry.add_to_my_apps(str(user["id"]), app_id)
    return {"app_id": app_id, "in_my_apps": True}


@router.delete("/apps/{app_id}", status_code=204, response_class=Response)
async def remove_app(app_id: str, user: CurrentUser) -> Response:
    removed = await registry.remove_from_my_apps(str(user["id"]), app_id)
    if not removed:
        raise AppError(ErrorCode.NOT_FOUND, detail="not in My Apps")
    return Response(status_code=204)


@router.patch("/apps/{app_id}/pin", status_code=204, response_class=Response)
async def pin_app(app_id: str, body: PinRequest, user: CurrentUser) -> Response:
    updated = await registry.set_pinned(str(user["id"]), app_id, body.is_pinned)
    if not updated:
        raise AppError(ErrorCode.NOT_FOUND, detail="not in My Apps")
    return Response(status_code=204)


@router.put("/apps/order")
async def reorder_apps(body: ReorderRequest, user: CurrentUser) -> dict:
    """Persist a new order (§18).

    Takes the full ordered list. The database pushes anything not named behind
    what was, so a stale client cannot wipe ordering for apps added elsewhere.
    """
    updated = await registry.reorder(str(user["id"]), body.app_ids)
    return {"updated": updated}


# ---------------------------------------------------------------------------
# Recently used and recommendations
# ---------------------------------------------------------------------------
@router.get("/recent", response_model=list[RecentEntry])
async def recent(user: CurrentUser) -> list[RecentEntry]:
    rows = await registry.recent_apps(str(user["id"]))
    return [
        RecentEntry(
            app=AppSummary(**row),
            last_used_at=row["last_used_at"],
            use_count=row["use_count"],
        )
        for row in rows
    ]


@router.get("/recommended", response_model=list[AppSummary])
async def recommended(user: CurrentUser) -> list[AppSummary]:
    rows = await registry.recommended_apps(str(user["id"]))
    return [AppSummary(**row) for row in rows]


# ---------------------------------------------------------------------------
# Quota
# ---------------------------------------------------------------------------
@router.get("/quota", response_model=list[QuotaStatus])
async def quota_status(
    request: Request, user: CurrentUser, settings: SettingsDep
) -> list[QuotaStatus]:
    user_id, guest, _ = quota_identity(request, user, settings)
    return [
        QuotaStatus(
            **await quota.status(
                user_id=user_id, guest_key=guest, kind=kind, settings=settings
            )
        )
        for kind in ("text", "image")
    ]
