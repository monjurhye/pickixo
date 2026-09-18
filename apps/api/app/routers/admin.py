"""Admin: providers, usage, settings, users, audit.

Access is by role on the database row loaded for this request, never by
comparing an email address against a list (§79).

No endpoint in this module returns an API key, and none ever should. Whether a
provider holds a key is reported as `configured: true|false` (§37).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Query

from .. import db
from ..dependencies import AdminUser, SettingsDep
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..schemas import ProviderUpdateRequest, SettingResponse
from ..services import ai as ai_service
from ..services import indexnow as indexnow_service

log = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


async def _audit(actor_id: str, action: str, target: str | None, detail: dict) -> None:
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target, detail) "
        "VALUES (%s, %s, %s, %s)",
        (actor_id, action, target, json.dumps(detail)),
    )


@router.get("/providers")
async def list_providers(admin: AdminUser) -> list[dict]:
    """Live provider health, merged with the durable registry row.

    Live state comes from the in-process router (which is what actually decides
    routing); the database row supplies the admin-editable priority and the
    history that survives a restart.
    """
    live = {entry["slug"]: entry for entry in ai_service.describe_providers()}
    rows = await db.fetch_all(
        """
        SELECT slug, display_name, capabilities, priority, enabled, status,
               default_model, models, last_success_at, last_failure_at,
               last_error, failure_count, cooldown_until, avg_latency_ms
          FROM ai_providers ORDER BY priority, slug
        """
    )
    merged = []
    for row in rows:
        entry = live.get(row["slug"], {})
        merged.append({
            **row,
            # The router's own view wins for the two fields it owns, because it
            # is the thing that will actually skip or use this provider.
            "configured": entry.get("configured", False),
            "enabled": entry.get("enabled", row["enabled"]),
            "live_status": entry.get("status"),
            "kind": entry.get("kind"),
        })
    return merged


@router.patch("/providers/{slug}")
async def update_provider(
    slug: str, body: ProviderUpdateRequest, admin: AdminUser
) -> dict:
    """Change a provider's priority, model or enabled flag (§30, §37).

    Note the honest limitation: this writes the durable row, and the running
    router picks it up at next startup. It does not hot-swap the in-process
    manager. Restarting the API applies it.
    """
    fields, params = [], []
    for column, value in (
        ("enabled", body.enabled),
        ("priority", body.priority),
        ("default_model", body.default_model),
    ):
        if value is not None:
            fields.append(f"{column} = %s")
            params.append(value)
    if not fields:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="no fields to update")

    params.append(slug)
    updated = await db.execute(
        f"UPDATE ai_providers SET {', '.join(fields)} WHERE slug = %s", params
    )
    if not updated:
        raise AppError(ErrorCode.NOT_FOUND, detail=f"no provider {slug!r}")

    await _audit(str(admin["id"]), "provider_updated", slug,
                 body.model_dump(exclude_none=True))
    return {"slug": slug, "updated": True, "applies_at": "next API restart"}


@router.get("/usage")
async def usage(
    admin: AdminUser, days: int = Query(default=7, ge=1, le=90)
) -> list[dict]:
    """Per-provider outcomes over a window, including the failover picture."""
    return await db.fetch_all(
        """
        SELECT provider,
               count(*)                                              AS attempts,
               count(*) FILTER (WHERE status = 'success')            AS successes,
               count(*) FILTER (WHERE status = 'failure')            AS failures,
               count(*) FILTER (WHERE fallback_used)                 AS as_fallback,
               count(*) FILTER (WHERE failure_reason = 'rate_limited')     AS rate_limited,
               count(*) FILTER (WHERE failure_reason = 'quota_exhausted')  AS quota_exhausted,
               round(avg(latency_ms) FILTER (WHERE status = 'success'))    AS avg_latency_ms,
               sum(coalesce(input_tokens, 0))                        AS input_tokens,
               sum(coalesce(output_tokens, 0))                       AS output_tokens
          FROM ai_usage
         WHERE created_at > now() - make_interval(days => %s)
         GROUP BY provider
         ORDER BY attempts DESC
        """,
        (days,),
    )


@router.get("/usage/fallbacks")
async def fallback_chains(
    admin: AdminUser, limit: int = Query(default=50, ge=1, le=200)
) -> list[dict]:
    """Recent requests that needed more than one provider (§36).

    This is the view that answers "is failover actually happening, and which
    provider is carrying the load when it does".
    """
    return await db.fetch_all(
        """
        SELECT request_id,
               min(created_at) AS started_at,
               count(*)        AS attempts,
               array_agg(provider || ':' ||
                         coalesce(failure_reason, status) ORDER BY attempt) AS chain
          FROM ai_usage
         GROUP BY request_id
        HAVING count(*) > 1
         ORDER BY started_at DESC
         LIMIT %s
        """,
        (limit,),
    )


@router.get("/settings", response_model=list[SettingResponse])
async def list_settings(admin: AdminUser) -> list[SettingResponse]:
    rows = await db.fetch_all(
        "SELECT key, value, description, updated_at FROM app_settings ORDER BY key"
    )
    return [SettingResponse(**row) for row in rows]


@router.put("/settings/{key}")
async def update_setting(key: str, body: dict, admin: AdminUser) -> dict:
    if "value" not in body:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="value is required")
    updated = await db.execute(
        "UPDATE app_settings SET value = %s, updated_by = %s, updated_at = now() "
        " WHERE key = %s",
        (json.dumps(body["value"]), str(admin["id"]), key),
    )
    if not updated:
        raise AppError(ErrorCode.NOT_FOUND, detail=f"no setting {key!r}")
    await _audit(str(admin["id"]), "setting_changed", key, {"value": body["value"]})
    return {"key": key, "value": body["value"]}


@router.get("/users")
async def list_users(
    admin: AdminUser, limit: int = Query(default=50, ge=1, le=200)
) -> list[dict]:
    """Account list. Deliberately without any credential material."""
    return await db.fetch_all(
        """
        SELECT u.id, u.email, u.display_name, u.role, u.status,
               u.created_at, u.last_login_at,
               (SELECT count(*) FROM user_apps ua WHERE ua.user_id = u.id) AS my_apps,
               (SELECT array_agg(i.provider) FROM identities i
                 WHERE i.user_id = u.id) AS sign_in_methods
          FROM users u
         ORDER BY u.created_at DESC
         LIMIT %s
        """,
        (limit,),
    )


@router.get("/overview")
async def overview(admin: AdminUser) -> dict:
    row = await db.fetch_one(
        """
        SELECT (SELECT count(*) FROM users WHERE status = 'active')      AS users,
               (SELECT count(*) FROM users
                 WHERE created_at > now() - interval '7 days')           AS new_users_7d,
               (SELECT count(*) FROM apps WHERE status IN ('live','beta')) AS live_apps,
               (SELECT count(*) FROM apps WHERE status = 'planned')      AS planned_apps,
               (SELECT count(*) FROM user_apps)                          AS my_apps_total,
               (SELECT count(*) FROM ai_usage
                 WHERE created_at > now() - interval '24 hours')         AS ai_calls_24h,
               (SELECT count(*) FROM ai_usage
                 WHERE status = 'failure'
                   AND created_at > now() - interval '24 hours')         AS ai_failures_24h
        """
    )
    return {**row, "ai_providers_ready": ai_service.providers_ready()}


@router.get("/indexnow")
async def indexnow_status(admin: AdminUser, settings: SettingsDep) -> dict:
    """Whether IndexNow is configured, and what is waiting to be announced.

    Never returns the key. Whether one is set is useful; its value is not.
    """
    return await indexnow_service.status(settings)


@router.post("/indexnow/submit")
async def indexnow_submit(
    admin: AdminUser, settings: SettingsDep, dry_run: bool = False
) -> dict:
    """Announce every URL whose content is newer than its last submission.

    Safe to call repeatedly: a URL that has not changed since it was last
    announced is not sent again. `dry_run=true` reports what would go without
    sending it.
    """
    result = await indexnow_service.submit(settings, dry_run=dry_run)
    if not dry_run and result.get("submitted"):
        await _audit(str(admin["id"]), "indexnow_submitted", None,
                     {"count": result["submitted"]})
    return result


@router.get("/audit")
async def audit_log(
    admin: AdminUser, limit: int = Query(default=100, ge=1, le=500)
) -> list[dict]:
    return await db.fetch_all(
        """
        SELECT a.id, a.action, a.target, a.result, a.detail, a.created_at,
               u.email AS actor
          FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.created_at DESC
         LIMIT %s
        """,
        (limit,),
    )
