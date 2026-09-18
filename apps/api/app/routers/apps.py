"""The public product catalogue and global search.

Everything here is readable signed out: §52 is explicit that a useful public
product page must not be hidden behind authentication. Nothing user-specific is
returned except `in_my_apps`, which is null when there is no user.
"""
from __future__ import annotations

from fastapi import APIRouter, Query, Response

from ..dependencies import OptionalUser
from ..errors import AppError, ErrorCode
from ..schemas import AppDetail, AppSummary, SearchResponse, Vertical
from ..services import registry

router = APIRouter(tags=["apps"])


@router.get("/apps", response_model=list[AppSummary])
async def list_apps(
    vertical: Vertical | None = None,
    featured: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[AppSummary]:
    rows = await registry.list_apps(vertical=vertical, featured=featured, limit=limit)
    return [AppSummary(**row) for row in rows]


@router.get("/app-by-route", response_model=AppDetail)
async def get_app_by_route(route: str, user: OptionalUser) -> AppDetail:
    """Resolve a product from its public URL path.

    Declared before /apps/{slug} so the literal path is matched first.
    """
    row = await registry.get_app_by_route(
        route, user_id=str(user["id"]) if user else None
    )
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, detail=f"no public app at route {route!r}")
    return AppDetail(**row)


@router.get("/apps/{slug}", response_model=AppDetail)
async def get_app(slug: str, user: OptionalUser) -> AppDetail:
    row = await registry.get_app(slug, user_id=str(user["id"]) if user else None)
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, detail=f"no public app with slug {slug!r}")
    return AppDetail(**row)


@router.post("/apps/{slug}/opened", status_code=204, response_class=Response)
async def record_opened(slug: str, user: OptionalUser) -> Response:
    """Record that a product was opened, for Recently Used.

    Product-level only — no prompt, no file, no result (§21).
    """
    row = await registry.get_app(slug)
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, detail="unknown app")
    await registry.record_use(str(user["id"]) if user else None, str(row["id"]))
    return Response(status_code=204)


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=30, ge=1, le=50),
) -> SearchResponse:
    """Search every vertical at once (§10).

    Only the public registry is searched. Private user content — files, chats,
    My Apps — is never part of this index (§10, §147).
    """
    return SearchResponse(**await registry.search(q, limit=limit))


@router.get("/sitemap-data")
async def sitemap_data() -> dict:
    """The indexable URL set, for the frontend sitemap route (§55).

    Serving this from the registry rather than a hand-kept list is what keeps
    §55 enforceable: a private or planned page cannot appear here because the
    query cannot select one.
    """
    rows = await registry.indexable_apps()
    lastmod = await registry.sitemap_lastmod()
    return {
        "apps": [
            {"route": r["route"], "updated_at": r["updated_at"].isoformat(),
             "vertical": r["vertical"]}
            for r in rows
        ],
        # Real change times for the listing pages, so the frontend never has to
        # invent one. Absent when a vertical has nothing indexable on it.
        "lastmod": lastmod,
    }
