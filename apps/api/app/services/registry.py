"""The product registry, and the per-user relationship to it.

Everything that needs to know "what products exist" comes through here:
navigation, search, My Apps, recommendations, the sitemap and the admin panel
(§145). There is deliberately no second place where a product's name, route or
metadata is written down.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from .. import db
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger

log = get_logger(__name__)

# The columns every listing needs. Kept in one constant so a new column reaches
# every caller at once instead of some of them.
_SUMMARY_COLUMNS = """
    a.id, a.slug, a.vertical, a.name, a.name_bn, a.tagline, a.icon, a.route,
    a.status, a.is_featured, a.supports_my_apps, a.requires_auth
"""


async def list_apps(
    *, vertical: str | None = None, featured: bool = False, limit: int = 100
) -> list[dict]:
    """Public products, optionally filtered to one vertical.

    Disabled products are excluded here rather than at the call site, so no
    caller can forget and leak one into a listing.
    """
    clauses = ["a.is_public", "a.status <> 'disabled'"]
    params: list[Any] = []
    if vertical:
        clauses.append("a.vertical = %s")
        params.append(vertical)
    if featured:
        clauses.append("a.is_featured")
    params.append(limit)

    return await db.fetch_all(
        f"""
        SELECT {_SUMMARY_COLUMNS}
          FROM apps a
         WHERE {' AND '.join(clauses)}
         ORDER BY (a.status = 'live') DESC, a.sort_order, a.name
         LIMIT %s
        """,
        params,
    )


async def get_app(slug: str, *, user_id: str | None = None) -> dict | None:
    """One product by slug, with whether this user already has it in My Apps."""
    return await db.fetch_one(
        f"""
        SELECT {_SUMMARY_COLUMNS},
               a.description, a.seo_title, a.seo_description, a.og_image,
               a.structured_data_type, a.use_count, a.updated_at,
               c.name AS category,
               CASE WHEN %s::uuid IS NULL THEN NULL
                    ELSE EXISTS (SELECT 1 FROM user_apps ua
                                  WHERE ua.user_id = %s::uuid AND ua.app_id = a.id)
               END AS in_my_apps
          FROM apps a
     LEFT JOIN app_categories c ON c.id = a.category_id
         WHERE a.slug = %s AND a.is_public AND a.status <> 'disabled'
        """,
        (user_id, user_id, slug),
    )


async def get_app_by_route(route: str, *, user_id: str | None = None) -> dict | None:
    """One product by its public route.

    The landing page resolves on the route rather than the slug because the
    route is the canonical URL and the two are not always the same shape: the
    AI chat product has slug 'ai-chat' but lives at '/ai/chat', because
    '/ai/ai-chat' would be a silly URL. Looking up by the last path segment
    would 404 on exactly those products — and it did, until this existed.
    """
    return await db.fetch_one(
        f"""
        SELECT {_SUMMARY_COLUMNS},
               a.description, a.seo_title, a.seo_description, a.og_image,
               a.structured_data_type, a.use_count, a.updated_at,
               c.name AS category,
               CASE WHEN %s::uuid IS NULL THEN NULL
                    ELSE EXISTS (SELECT 1 FROM user_apps ua
                                  WHERE ua.user_id = %s::uuid AND ua.app_id = a.id)
               END AS in_my_apps
          FROM apps a
     LEFT JOIN app_categories c ON c.id = a.category_id
         WHERE a.route = %s AND a.is_public AND a.status <> 'disabled'
        """,
        (user_id, user_id, route),
    )


async def search(query: str, *, limit: int = 30) -> dict:
    """Global search, grouped by vertical (§10)."""
    query = query.strip()
    if not query:
        return {"query": query, "total": 0, "groups": {}}

    rows = await db.fetch_all(
        "SELECT id, slug, name, vertical, tagline, icon, route, status "
        "  FROM search_apps(%s, %s)",
        (query, limit),
    )

    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["vertical"], []).append(row)
    return {"query": query, "total": len(rows), "groups": groups}


async def indexable_apps() -> list[dict]:
    """Exactly the products allowed into sitemap.xml and IndexNow (§55, §66).

    Planned products are excluded: a page that says "not built yet" is thin
    content, and asking Google to index it is asking to be judged on it.
    """
    return await db.fetch_all(
        """
        SELECT a.slug, a.route, a.updated_at, a.vertical
          FROM apps a
         WHERE a.is_public AND a.is_indexable AND a.status IN ('live', 'beta')
         ORDER BY a.vertical, a.sort_order
        """
    )


async def sitemap_lastmod() -> dict:
    """Real last-modified times for the pages that list products.

    A listing page changes when the products on it change, so its lastmod is the
    newest updated_at among them. The alternative — stamping now() at render
    time — tells search engines the page changed on every crawl, which is both
    false and a good way to have lastmod ignored entirely.

    Verticals with no indexable product get no entry, and the caller omits
    lastmod rather than inventing one.
    """
    rows = await db.fetch_all(
        """
        SELECT vertical, max(updated_at) AS changed_at
          FROM apps
         WHERE is_public AND is_indexable AND status IN ('live', 'beta')
         GROUP BY vertical
        """
    )
    per_vertical = {r["vertical"]: r["changed_at"].isoformat() for r in rows}
    newest = max((r["changed_at"] for r in rows), default=None)
    return {
        "verticals": per_vertical,
        "site": newest.isoformat() if newest else None,
    }


# ===========================================================================
# My Apps
# ===========================================================================
async def list_my_apps(user_id: str) -> list[dict]:
    """Pinned first, then the order the user arranged (§17, §18)."""
    return await db.fetch_all(
        f"""
        SELECT {_SUMMARY_COLUMNS},
               ua.is_pinned, ua.sort_order, ua.created_at AS added_at
          FROM user_apps ua
          JOIN apps a ON a.id = ua.app_id
         WHERE ua.user_id = %s AND a.status <> 'disabled'
         ORDER BY ua.is_pinned DESC, ua.sort_order, ua.created_at
        """,
        (user_id,),
    )


async def resolve_app_id(*, app_id: UUID | None, slug: str | None) -> str:
    """Accept either an id or a slug, return the id, or raise NOT_FOUND."""
    if app_id is None and not slug:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="app_id or slug required")
    row = await db.fetch_one(
        "SELECT id FROM apps WHERE (id = %s::uuid OR slug = %s) "
        "  AND is_public AND status <> 'disabled'",
        (str(app_id) if app_id else None, slug),
    )
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, detail="unknown app")
    return str(row["id"])


async def add_to_my_apps(user_id: str, app_id: str) -> None:
    try:
        await db.execute("SELECT add_to_my_apps(%s, %s)", (user_id, app_id))
    except Exception as exc:  # noqa: BLE001
        # The database raises check_violation for a product that has opted out
        # of My Apps. That is a client mistake, not a server fault.
        if "cannot be added to My Apps" in str(exc):
            raise AppError(ErrorCode.APP_NOT_AVAILABLE, detail=str(exc)) from exc
        raise


async def remove_from_my_apps(user_id: str, app_id: str) -> bool:
    removed = await db.execute(
        "DELETE FROM user_apps WHERE user_id = %s AND app_id = %s", (user_id, app_id)
    )
    if removed:
        await db.execute(
            "INSERT INTO activity_events (user_id, app_id, event) "
            "VALUES (%s, %s, 'app_removed')",
            (user_id, app_id),
        )
    return bool(removed)


async def set_pinned(user_id: str, app_id: str, pinned: bool) -> bool:
    updated = await db.execute(
        "UPDATE user_apps SET is_pinned = %s WHERE user_id = %s AND app_id = %s",
        (pinned, user_id, app_id),
    )
    if updated and pinned:
        await db.execute(
            "INSERT INTO activity_events (user_id, app_id, event) "
            "VALUES (%s, %s, 'app_pinned')",
            (user_id, app_id),
        )
    return bool(updated)


async def reorder(user_id: str, app_ids: list[UUID]) -> int:
    return await db.fetch_value(
        "SELECT reorder_my_apps(%s, %s::uuid[])",
        (user_id, [str(a) for a in app_ids]),
    )


# ===========================================================================
# Activity
# ===========================================================================
async def record_use(user_id: str | None, app_id: str) -> None:
    """Note that a product was opened. Never raises into the request.

    Recently Used being briefly wrong is not worth failing a user's actual
    request over.
    """
    try:
        await db.execute("SELECT record_app_use(%s, %s, 'app_opened')",
                         (user_id, app_id))
    except Exception:  # noqa: BLE001
        log.exception("registry.record_use_failed", app_id=app_id)


async def recent_apps(user_id: str, limit: int = 8) -> list[dict]:
    return await db.fetch_all(
        f"""
        SELECT {_SUMMARY_COLUMNS}, s.last_used_at, s.use_count
          FROM user_app_stats s
          JOIN apps a ON a.id = s.app_id
         WHERE s.user_id = %s AND a.status <> 'disabled'
         ORDER BY s.last_used_at DESC
         LIMIT %s
        """,
        (user_id, limit),
    )


async def recommended_apps(user_id: str | None, limit: int = 6) -> list[dict]:
    """Popular products the user does not already have in My Apps.

    Deliberately simple: this is a popularity list with the obvious exclusion,
    not a recommender pretending to model taste from an empty activity table.
    Real cross-product recommendations (§141) need usage data that does not
    exist yet.
    """
    if user_id is None:
        return await list_apps(featured=True, limit=limit)
    return await db.fetch_all(
        f"""
        SELECT {_SUMMARY_COLUMNS}
          FROM apps a
         WHERE a.is_public AND a.status <> 'disabled' AND a.supports_my_apps
           AND NOT EXISTS (SELECT 1 FROM user_apps ua
                            WHERE ua.user_id = %s AND ua.app_id = a.id)
         ORDER BY (a.status = 'live') DESC, a.is_featured DESC, a.use_count DESC
         LIMIT %s
        """,
        (user_id, limit),
    )
