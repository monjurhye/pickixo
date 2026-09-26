"""Facebook Page connection and agent control.

The rule that shapes every response in this file: **no endpoint here ever
returns a Page access token, an app secret, or anything derived from them that
could be replayed.** The frontend is told whether a connection exists and what
it can do — never what it is. `capabilities` is safe to send; the credential
that produced it is not.

The OAuth callback is the sensitive path. It carries a code that can be
exchanged for a credential, so it validates `state` against a signed value
before touching it — without that check, any site could send a visitor's
browser to this endpoint with a code of the attacker's choosing and connect
their Page to this account.
"""
from __future__ import annotations

import base64
import json
import secrets
import time
import urllib.parse
from typing import Any

from fastapi import APIRouter, Query, Request, Response

from .. import db
from ..dependencies import CurrentUser, SettingsDep
from ..errors import AppError, ErrorCode
from ..facebook_agent import agent as agent_runner
from ..facebook_agent import repository as repo
from ..facebook_agent.supervisor import get_supervisor
from ..logging_config import get_logger
from ..security import sign_state, verify_state
from ..services import crypto
from ..services.facebook import FacebookClient
from ..services.facebook import capabilities as caps
from ..services.facebook.errors import GraphFailure

log = get_logger(__name__)
router = APIRouter(prefix="/facebook", tags=["facebook"])

#: How long an OAuth attempt stays valid. Long enough to read a consent screen,
#: short enough that a leaked state value is useless later.
_STATE_TTL_SECONDS = 600


def _require_meta(settings) -> None:
    if not settings.meta_configured:
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="Meta is not configured on this deployment",
        )


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
@router.get("/status")
async def status(user: CurrentUser, settings: SettingsDep) -> dict:
    """What the dashboard needs to render, and nothing sensitive.

    Answers honestly when nothing is configured: a Connect button that cannot
    work is worse than a clear "not configured yet".
    """
    page = await db.fetch_one(
        """
        SELECT id, page_id, page_name, category, capabilities, status,
               status_detail, connected_at, last_verified_at, last_synced_at
          FROM facebook_pages WHERE user_id = %s
         ORDER BY connected_at DESC LIMIT 1
        """,
        (str(user["id"]),),
    )

    supervisor = get_supervisor()
    base: dict[str, Any] = {
        "meta_configured": settings.meta_configured,
        "graph_version": settings.meta_graph_version,
        "worker_running": bool(supervisor and supervisor.running),
        "connected": page is not None,
        "page": None,
        "agent": None,
    }
    if page is None:
        return base

    settings_row = await repo.ensure_settings(str(page["id"]))
    activity = await repo.activity_today(str(page["id"]))

    base["page"] = {
        "id": str(page["id"]),
        "page_id": page["page_id"],
        "name": page["page_name"],
        "category": page.get("category"),
        "status": page["status"],
        "status_detail": page.get("status_detail"),
        "connected_at": page["connected_at"],
        "last_synced_at": page.get("last_synced_at"),
        # Safe: says what may be done, not what allows it.
        "capabilities": page.get("capabilities") or {},
    }
    base["agent"] = {
        "enabled": settings_row["enabled"],
        "mode": settings_row["mode"],
        "emergency_stopped": settings_row["emergency_stopped"],
        "limits": {
            "max_feed_posts_per_day": settings_row["max_feed_posts_per_day"],
            "max_image_posts_per_day": settings_row["max_image_posts_per_day"],
            "max_stories_per_day": settings_row["max_stories_per_day"],
            # .get: absent until migration 020 is applied, and reels are off
            # until then (see observer.observe).
            "max_reels_per_day": settings_row.get("max_reels_per_day", 0),
            "max_comment_replies_per_hour": settings_row["max_comment_replies_per_hour"],
            "min_minutes_between_feed_posts": settings_row["min_minutes_between_feed_posts"],
        },
        "content_mix": settings_row["content_mix"],
        "comment_reply_confidence": float(settings_row["comment_reply_confidence"]),
        "diversity_days": settings_row["diversity_days"],
        "today": {
            "feed_posts": int(activity.get("feed_posts") or 0),
            "image_posts": int(activity.get("image_posts") or 0),
            "stories": int(activity.get("stories") or 0),
            "reels": int(activity.get("reels") or 0),
            "comment_replies": int(activity.get("comment_replies") or 0),
            "replies_last_hour": int(activity.get("replies_last_hour") or 0),
            "minutes_since_feed_post": activity.get("minutes_since_feed_post"),
        },
    }
    return base


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------
@router.get("/connect")
async def connect(user: CurrentUser, settings: SettingsDep) -> dict:
    """Begin the connection. Returns the URL to send the person to.

    Pickixo never asks for a Facebook password and never sees one: the whole
    exchange happens on Facebook's own consent screen, and we receive a code.
    """
    _require_meta(settings)

    nonce = secrets.token_urlsafe(24)
    # base64url so the payload cannot contain a '.' — verify_state splits on
    # the last one, and a dot inside the value would silently break the check.
    claims = base64.urlsafe_b64encode(
        json.dumps({"u": str(user["id"]), "n": nonce,
                    "t": int(time.time())}).encode("utf-8")
    ).decode("ascii").rstrip("=")
    state = sign_state(claims, settings)
    query = urllib.parse.urlencode({
        "client_id": settings.meta_app_id,
        "redirect_uri": settings.meta_redirect_uri,
        "state": state,
        "response_type": "code",
        "scope": ",".join(caps.REQUESTED_SCOPES),
    })
    return {
        "url": f"https://www.facebook.com/{settings.meta_graph_version}/dialog/oauth?{query}",
        "scopes": list(caps.REQUESTED_SCOPES),
    }


@router.get("/callback")
async def callback(
    request: Request,
    settings: SettingsDep,
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str = Query(default=""),
) -> dict:
    """Finish the connection.

    Deliberately not protected by the normal session dependency — the browser
    arrives here redirected from Facebook — so `state` is the only thing
    proving who started this. It is signed and time-limited, and the user id
    comes out of it rather than out of anything the caller supplies.
    """
    _require_meta(settings)

    if error:
        raise AppError(ErrorCode.INVALID_REQUEST,
                       detail=f"authorisation was declined: {error[:100]}")
    if not code or not state:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="missing code or state")

    payload = verify_state(state, settings)
    if payload is None:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="state failed verification")
    try:
        raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        decoded = json.loads(raw)
        user_id = str(decoded["u"])
        issued = int(decoded["t"])
    except (ValueError, KeyError) as exc:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="malformed state") from exc

    if time.time() - issued > _STATE_TTL_SECONDS:
        raise AppError(ErrorCode.INVALID_REQUEST,
                       detail="this connection attempt expired; start again")

    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        try:
            short = await client.exchange_code_for_token(
                code=code, redirect_uri=settings.meta_redirect_uri
            )
            # Without this the Page token dies in about an hour and the agent
            # stops overnight.
            long_lived = await client.exchange_for_long_lived(
                user_token=short["access_token"]
            )
            user_token = long_lived["access_token"]

            pages = await client.list_pages(user_token=user_token)
            if not pages:
                raise AppError(
                    ErrorCode.NOT_FOUND,
                    detail="this account manages no Pages that the app can see",
                )

            # Single-Page for now: the first Page the user manages.
            chosen = pages[0]
            page_token = chosen["access_token"]
            debug = await client.debug_token(token=page_token)
        except GraphFailure as failure:
            log.warning("facebook.connect_failed", kind=failure.kind.value)
            raise AppError(
                ErrorCode.GENERATION_FAILED,
                detail="Facebook rejected the connection attempt",
            ) from failure

    granted = list(debug.get("scopes") or [])
    tasks = list(chosen.get("tasks") or [])
    capabilities = caps.detect(granted_scopes=granted, page_tasks=tasks)

    sealed = crypto.encrypt(page_token, key=settings.facebook_token_key)
    page_uuid = await db.fetch_value(
        """
        INSERT INTO facebook_pages
            (user_id, page_id, page_name, category, access_token_encrypted,
             token_fingerprint, granted_scopes, page_tasks, capabilities,
             status, last_verified_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'connected', now())
        ON CONFLICT (page_id) DO UPDATE
           SET access_token_encrypted = EXCLUDED.access_token_encrypted,
               token_fingerprint = EXCLUDED.token_fingerprint,
               granted_scopes = EXCLUDED.granted_scopes,
               page_tasks = EXCLUDED.page_tasks,
               capabilities = EXCLUDED.capabilities,
               page_name = EXCLUDED.page_name,
               status = 'connected',
               status_detail = NULL,
               last_verified_at = now()
        RETURNING id
        """,
        (user_id, str(chosen["id"]), chosen.get("name") or "Unnamed Page",
         chosen.get("category"), sealed, crypto.fingerprint(sealed),
         granted, tasks, json.dumps(capabilities)),
    )
    await repo.ensure_settings(str(page_uuid))

    log.info("facebook.connected", page=str(chosen["id"]),
             capabilities=caps.summarise(capabilities))

    # Note what comes back: no token, not even a masked one.
    return {
        "connected": True,
        "page": {
            "id": str(page_uuid),
            "name": chosen.get("name"),
            "capabilities": capabilities,
        },
    }


@router.post("/disconnect", status_code=204, response_class=Response)
async def disconnect(user: CurrentUser) -> Response:
    """Forget the Page and its credential."""
    await db.execute(
        "DELETE FROM facebook_pages WHERE user_id = %s", (str(user["id"]),)
    )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Agent control
# ---------------------------------------------------------------------------
async def _owned_page(user: dict, page_uuid: str) -> dict:
    page = await db.fetch_one(
        "SELECT * FROM facebook_pages WHERE id = %s AND user_id = %s",
        (page_uuid, str(user["id"])),
    )
    if page is None:
        raise AppError(ErrorCode.NOT_FOUND, detail="page not found")
    return page


@router.patch("/{page_uuid}/settings")
async def update_settings(
    page_uuid: str, user: CurrentUser, settings: SettingsDep, body: dict
) -> dict:
    """Change the agent's configuration.

    Every numeric limit is clamped to the deployment ceiling from config. The
    dashboard may lower a limit; it may never raise one past what the operator
    set, so a mistake in the UI cannot become a posting spree.
    """
    await _owned_page(user, page_uuid)

    allowed_modes = {"FULL_AUTO", "APPROVAL_REQUIRED", "PAUSED"}
    updates: list[str] = []
    values: list[Any] = []

    def add(column: str, value: Any) -> None:
        updates.append(f"{column} = %s")
        values.append(value)

    if "enabled" in body:
        add("enabled", bool(body["enabled"]))
    if "mode" in body:
        mode = str(body["mode"]).upper()
        if mode not in allowed_modes:
            raise AppError(ErrorCode.INVALID_REQUEST, detail="unknown mode")
        add("mode", mode)

    ceilings = {
        "max_feed_posts_per_day": settings.facebook_agent_max_feed_posts_per_day,
        "max_image_posts_per_day": settings.facebook_agent_max_feed_posts_per_day,
        "max_stories_per_day": settings.facebook_agent_max_stories_per_day,
        "max_reels_per_day": settings.facebook_agent_max_reels_per_day,
        "max_comment_replies_per_hour": settings.facebook_agent_max_replies_per_hour,
    }
    for column, ceiling in ceilings.items():
        if column in body:
            add(column, max(0, min(int(body[column]), ceiling)))

    if "min_minutes_between_feed_posts" in body:
        add("min_minutes_between_feed_posts",
            max(0, min(int(body["min_minutes_between_feed_posts"]), 1440)))
    if "comment_reply_confidence" in body:
        add("comment_reply_confidence",
            max(0.0, min(float(body["comment_reply_confidence"]), 1.0)))
    if "diversity_days" in body:
        add("diversity_days", max(1, min(int(body["diversity_days"]), 365)))
    if "content_mix" in body and isinstance(body["content_mix"], dict):
        add("content_mix", json.dumps(body["content_mix"]))

    if not updates:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="nothing to update")

    values.append(page_uuid)
    await db.execute(
        f"UPDATE facebook_agent_settings SET {', '.join(updates)} WHERE page_id = %s",
        values,
    )
    return await repo.get_settings(page_uuid) or {}


@router.post("/{page_uuid}/stop")
async def emergency_stop(page_uuid: str, user: CurrentUser, body: dict | None = None) -> dict:
    """Stop the agent now.

    Separate from `enabled` and from `mode` deliberately: this is the control
    someone reaches for in a hurry, and it must not be cleared as a side effect
    of changing an unrelated setting.

    Work already in flight is allowed to finish recording what it did — losing
    the record of a post that went out is worse than a few seconds' delay — but
    no new action starts.
    """
    await _owned_page(user, page_uuid)
    reason = (body or {}).get("reason") or "stopped from the dashboard"
    await db.execute(
        """
        UPDATE facebook_agent_settings
           SET emergency_stopped = true, emergency_stopped_at = now(),
               emergency_stop_reason = %s
         WHERE page_id = %s
        """,
        (str(reason)[:500], page_uuid),
    )
    log.warning("agent.emergency_stop", page=page_uuid)
    return {"emergency_stopped": True}


@router.post("/{page_uuid}/resume")
async def resume(page_uuid: str, user: CurrentUser) -> dict:
    await _owned_page(user, page_uuid)
    await db.execute(
        """
        UPDATE facebook_agent_settings
           SET emergency_stopped = false, emergency_stopped_at = NULL,
               emergency_stop_reason = NULL
         WHERE page_id = %s
        """,
        (page_uuid,),
    )
    log.info("agent.resumed", page=page_uuid)
    return {"emergency_stopped": False}


@router.post("/{page_uuid}/run")
async def run_now(
    page_uuid: str, user: CurrentUser, settings: SettingsDep
) -> dict:
    """Wake the agent immediately.

    For trying it out without waiting for the next tick. It is the same code
    path the supervisor uses, so what happens here is what happens unattended —
    including the possibility that it decides to do nothing.
    """
    await _owned_page(user, page_uuid)
    outcome = await agent_runner.run_once(
        page_uuid=page_uuid, settings=settings, trigger="manual", force_sync=True,
    )
    return outcome.as_dict()


# ---------------------------------------------------------------------------
# Visibility
# ---------------------------------------------------------------------------
@router.get("/{page_uuid}/activity")
async def activity(page_uuid: str, user: CurrentUser,
                   limit: int = Query(default=25, ge=1, le=100)) -> dict:
    """The agent's own log: what it decided, and why."""
    await _owned_page(user, page_uuid)
    runs = await repo.recent_runs(page_uuid, limit=limit)
    decisions = await db.fetch_all(
        """
        SELECT decision, reason, confidence, topic, source, created_at
          FROM facebook_agent_decisions
         WHERE page_id = %s ORDER BY created_at DESC LIMIT %s
        """,
        (page_uuid, limit),
    )
    actions = await db.fetch_all(
        """
        SELECT action_type, status, external_id, error, started_at, finished_at
          FROM facebook_agent_actions
         WHERE page_id = %s ORDER BY started_at DESC LIMIT %s
        """,
        (page_uuid, limit),
    )
    return {"runs": runs, "decisions": decisions, "actions": actions}


@router.get("/{page_uuid}/memory")
async def memory(page_uuid: str, user: CurrentUser) -> dict:
    """What the Page has recently talked about."""
    await _owned_page(user, page_uuid)
    settings_row = await repo.get_settings(page_uuid) or {}
    days = int(settings_row.get("diversity_days") or 14)
    return {
        "diversity_days": days,
        "topics": await repo.recent_memory(page_uuid, "topic", days=days),
        "animals": await repo.recent_memory(page_uuid, "animal", days=days),
        "performance": await repo.topic_performance(page_uuid),
        "best_hours": await repo.best_posting_hours(page_uuid),
    }


@router.get("/{page_uuid}/comments")
async def comments(page_uuid: str, user: CurrentUser,
                   limit: int = Query(default=30, ge=1, le=100)) -> dict:
    await _owned_page(user, page_uuid)
    return {
        "pending": await repo.pending_comments(page_uuid, limit=limit),
        "flagged": await repo.flagged_comments(page_uuid),
    }


@router.get("/{page_uuid}/plans")
async def plans(page_uuid: str, user: CurrentUser,
                limit: int = Query(default=50, ge=1, le=200)) -> list[dict]:
    """The content calendar."""
    await _owned_page(user, page_uuid)
    return await repo.plans(page_uuid, limit=limit)
