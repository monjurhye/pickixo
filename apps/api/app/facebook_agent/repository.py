"""Every database statement the agent uses, in one place.

Kept separate from the agent's logic so that the logic can be read without SQL
in the way, and so the SQL can be reviewed without following control flow. Same
reasoning as db.py elsewhere in this project: no ORM, parameterised everywhere,
and the operations that must be atomic are database functions rather than
read-think-write in Python.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .. import db
from ..logging_config import get_logger

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Page + settings
# ---------------------------------------------------------------------------
async def get_page(page_uuid: str) -> dict | None:
    return await db.fetch_one(
        """
        SELECT id, user_id, page_id, page_name, category, access_token_encrypted,
               token_fingerprint, granted_scopes, page_tasks, capabilities,
               status, status_detail, connected_at, last_verified_at
          FROM facebook_pages WHERE id = %s
        """,
        (page_uuid,),
    )


async def active_pages() -> list[dict]:
    """Pages the supervisor should wake an agent for.

    Filtered in SQL rather than in the loop: a disabled or emergency-stopped
    Page should not even be loaded, let alone observed.
    """
    return await db.fetch_all(
        """
        SELECT p.id, p.page_id, p.page_name, p.status
          FROM facebook_pages p
          JOIN facebook_agent_settings s ON s.page_id = p.id
         WHERE p.status = 'connected'
           AND s.enabled = true
           AND s.emergency_stopped = false
           AND s.mode <> 'PAUSED'
         ORDER BY p.connected_at
        """
    )


async def get_settings(page_uuid: str) -> dict | None:
    return await db.fetch_one(
        "SELECT * FROM facebook_agent_settings WHERE page_id = %s", (page_uuid,)
    )


async def ensure_settings(page_uuid: str) -> dict:
    """Create the settings row if this Page has none.

    Defaults are conservative and the mode is APPROVAL_REQUIRED, so a freshly
    connected Page never starts publishing on its own before anybody has looked
    at the settings.
    """
    await db.execute(
        """
        INSERT INTO facebook_agent_settings (page_id)
        VALUES (%s) ON CONFLICT (page_id) DO NOTHING
        """,
        (page_uuid,),
    )
    return await get_settings(page_uuid)  # type: ignore[return-value]


async def set_connection_status(
    page_uuid: str, status: str, detail: str | None = None
) -> None:
    await db.execute(
        """
        UPDATE facebook_pages
           SET status = %s, status_detail = %s, last_verified_at = now()
         WHERE id = %s
        """,
        (status, detail, page_uuid),
    )


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------
async def start_run(page_uuid: str, *, trigger: str = "scheduled") -> str:
    row = await db.fetch_one(
        """
        INSERT INTO facebook_agent_runs (page_id, trigger, state, status)
        VALUES (%s, %s, 'observing', 'running')
        RETURNING id
        """,
        (page_uuid, trigger),
    )
    return str(row["id"])


async def set_run_state(run_id: str, state: str) -> None:
    await db.execute(
        "UPDATE facebook_agent_runs SET state = %s WHERE id = %s", (state, run_id)
    )


async def finish_run(
    run_id: str,
    *,
    status: str,
    state: str,
    decision: str | None,
    reason: str | None,
    actions_taken: int,
    used_ai: bool,
    observation: dict | None,
    error: str | None = None,
) -> None:
    await db.execute(
        """
        UPDATE facebook_agent_runs
           SET status = %s, state = %s, decision = %s, reason = %s,
               actions_taken = %s, used_ai = %s, observation = %s,
               error = %s, finished_at = now(),
               duration_ms = EXTRACT(EPOCH FROM (now() - started_at))* 1000
         WHERE id = %s
        """,
        (status, state, decision, reason, actions_taken, used_ai,
         json.dumps(observation) if observation is not None else None,
         error, run_id),
    )


async def recent_runs(page_uuid: str, limit: int = 20) -> list[dict]:
    return await db.fetch_all(
        """
        SELECT id, started_at, finished_at, state, status, decision, reason,
               actions_taken, used_ai, error, duration_ms
          FROM facebook_agent_runs
         WHERE page_id = %s
         ORDER BY started_at DESC
         LIMIT %s
        """,
        (page_uuid, limit),
    )


async def record_decision(
    *, run_id: str, page_uuid: str, decision: str, reason: str,
    priority: str = "normal", confidence: float | None = None,
    content_type: str | None = None, topic: str | None = None,
    payload: dict | None = None, source: str = "rules",
) -> str:
    row = await db.fetch_one(
        """
        INSERT INTO facebook_agent_decisions
            (run_id, page_id, decision, reason, priority, confidence,
             content_type, topic, payload, source)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
        """,
        (run_id, page_uuid, decision, reason[:2000], priority, confidence,
         content_type, topic, json.dumps(payload or {}), source),
    )
    return str(row["id"])


# ---------------------------------------------------------------------------
# Limits and activity
# ---------------------------------------------------------------------------
async def activity_today(page_uuid: str) -> dict:
    """Today's counts, plus reels. "Today" is the Page's posting-time-zone day.

    Reels are counted outside agent_activity_today because that function's
    return columns must stay as 012 defined them: the deploy script re-applies
    every migration, and changing a function's columns makes the older file's
    CREATE OR REPLACE fail. See 020_facebook_reels.sql and 021.
    """
    row = await db.fetch_one(
        """
        SELECT a.*, agent_reels_today(%s) AS reels
          FROM agent_activity_today(%s) a
        """,
        (page_uuid, page_uuid),
    )
    return row or {}


async def last_model_decision(page_uuid: str) -> dict | None:
    """The reasoning model's most recent decision for this Page.

    Only model-sourced rows: a rule's "do nothing" (limit reached, spacing)
    is recomputed every wake and must not be mistaken for the model choosing
    to wait. Includes the "could not think" rows the agent records when no
    provider answers, so a dead provider is also not asked every five minutes.
    """
    return await db.fetch_one(
        """
        SELECT decision, created_at, payload
          FROM facebook_agent_decisions
         WHERE page_id = %s AND source = 'model'
         ORDER BY created_at DESC
         LIMIT 1
        """,
        (page_uuid,),
    )


async def may_act(page_uuid: str, action_type: str) -> tuple[bool, str]:
    row = await db.fetch_one(
        "SELECT allowed, reason FROM agent_may_act(%s, %s)", (page_uuid, action_type)
    )
    if not row:
        return False, "limit check returned nothing"
    return bool(row["allowed"]), str(row["reason"])


async def cooldowns(page_uuid: str) -> dict[str, datetime]:
    """Action types currently backed off after a Meta rate limit."""
    rows = await db.fetch_all(
        """
        SELECT action_type, max(retry_after) AS until
          FROM facebook_agent_actions
         WHERE page_id = %s AND retry_after IS NOT NULL AND retry_after > now()
         GROUP BY action_type
        """,
        (page_uuid,),
    )
    return {r["action_type"]: r["until"] for r in rows}


# ---------------------------------------------------------------------------
# Idempotent actions
# ---------------------------------------------------------------------------
async def claim_action(
    *, page_uuid: str, action_type: str, idempotency_key: str,
    run_id: str | None = None, request: dict | None = None,
) -> dict:
    """Claim the right to perform an external action exactly once."""
    row = await db.fetch_one(
        """
        SELECT claimed, action_id, status, external_id
          FROM claim_agent_action(%s, %s, %s, %s, %s)
        """,
        (page_uuid, action_type, idempotency_key, run_id,
         json.dumps(request or {})),
    )
    return row or {"claimed": False, "action_id": None,
                   "status": "unknown", "external_id": None}


async def finish_action(
    action_id: str, *, status: str, external_id: str | None = None,
    result: dict | None = None, error: str | None = None,
    retry_after: datetime | None = None,
) -> None:
    await db.execute(
        "SELECT finish_agent_action(%s, %s, %s, %s, %s, %s)",
        (action_id, status, external_id,
         json.dumps(result) if result is not None else None,
         error[:2000] if error else None, retry_after),
    )


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------
async def upsert_post(
    *, page_uuid: str, fb_post_id: str, post_type: str, message: str | None,
    published_at: datetime, topic: str | None = None, animal: str | None = None,
    image_path: str | None = None, permalink: str | None = None,
    created_by: str = "agent",
) -> str:
    row = await db.fetch_one(
        """
        INSERT INTO facebook_posts
            (page_id, fb_post_id, post_type, message, published_at, topic,
             animal, image_path, permalink, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (page_id, fb_post_id) DO UPDATE
           SET message = COALESCE(EXCLUDED.message, facebook_posts.message),
               permalink = COALESCE(EXCLUDED.permalink, facebook_posts.permalink),
               observed_at = now()
        RETURNING id
        """,
        (page_uuid, fb_post_id, post_type, message, published_at, topic,
         animal, image_path, permalink, created_by),
    )
    return str(row["id"])


async def adopt_post_id(page_uuid: str, *, old_id: str, new_id: str) -> bool:
    """Move our record of a post onto the id Facebook's feed uses for it.

    Reels are published as videos and come back from the Reels API with a
    video id, while the feed — where comments and engagement live — knows them
    by a post id. Renaming the row keeps one record per reel, so its comments
    attach to it and it is measured once. A no-op if the new id is already
    recorded, so running it on every sync is safe.
    """
    changed = await db.execute(
        """
        UPDATE facebook_posts
           SET fb_post_id = %s, observed_at = now()
         WHERE page_id = %s AND fb_post_id = %s
           AND NOT EXISTS (SELECT 1 FROM facebook_posts
                            WHERE page_id = %s AND fb_post_id = %s)
        """,
        (new_id, page_uuid, old_id, page_uuid, new_id),
    )
    return changed > 0


async def recent_posts(page_uuid: str, limit: int = 15) -> list[dict]:
    return await db.fetch_all(
        """
        SELECT p.id, p.fb_post_id, p.message, p.post_type, p.published_at,
               p.topic, p.animal, p.created_by,
               COALESCE(m.reactions, 0) AS reactions,
               COALESCE(m.comments, 0)  AS comments,
               COALESCE(m.shares, 0)    AS shares
          FROM facebook_posts p
          LEFT JOIN LATERAL (
              SELECT reactions, comments, shares
                FROM facebook_post_metrics
               WHERE post_id = p.id
               ORDER BY collected_at DESC
               LIMIT 1
          ) m ON true
         WHERE p.page_id = %s
         ORDER BY p.published_at DESC
         LIMIT %s
        """,
        (page_uuid, limit),
    )


async def record_metrics(
    *, post_id: str, age_hours: int, impressions: int | None = None,
    reach: int | None = None, reactions: int | None = None,
    comments: int | None = None, shares: int | None = None,
    clicks: int | None = None,
) -> None:
    await db.execute(
        """
        INSERT INTO facebook_post_metrics
            (post_id, age_hours, impressions, reach, reactions, comments,
             shares, clicks)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (post_id, age_hours) DO UPDATE
           SET impressions = EXCLUDED.impressions,
               reach       = EXCLUDED.reach,
               reactions   = EXCLUDED.reactions,
               comments    = EXCLUDED.comments,
               shares      = EXCLUDED.shares,
               clicks      = EXCLUDED.clicks,
               collected_at = now()
        """,
        (post_id, age_hours, impressions, reach, reactions, comments,
         shares, clicks),
    )


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
async def upsert_comment(
    *, page_uuid: str, comment_id: str, fb_post_id: str, message: str,
    created_time: datetime, author_id: str | None, author_name: str | None,
    parent_comment_id: str | None = None,
) -> bool:
    """Record a comment. Returns True when it is new to us.

    DO NOTHING rather than DO UPDATE on conflict: a comment we have already
    classified must not be reset to unclassified just because we saw it again,
    or every observation would re-trigger triage on the whole backlog.
    """
    row = await db.fetch_one(
        """
        INSERT INTO facebook_comments
            (page_id, comment_id, fb_post_id, parent_comment_id, message,
             created_time, author_id, author_name)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (page_id, comment_id) DO NOTHING
        RETURNING id
        """,
        (page_uuid, comment_id, fb_post_id, parent_comment_id, message,
         created_time, author_id, author_name),
    )
    return row is not None


async def pending_comments(page_uuid: str, limit: int = 25) -> list[dict]:
    """Comments that have neither been answered nor deliberately dismissed."""
    return await db.fetch_all(
        """
        SELECT c.id, c.comment_id, c.fb_post_id, c.message, c.created_time,
               c.author_name, c.classification, c.action,
               c.reply_comment_id IS NOT NULL AS already_replied,
               p.message AS post_context, p.topic AS post_topic,
               p.animal AS post_animal
          FROM facebook_comments c
          LEFT JOIN facebook_posts p
                 ON p.page_id = c.page_id AND p.fb_post_id = c.fb_post_id
         WHERE c.page_id = %s
           AND c.reply_comment_id IS NULL
           AND c.action IN ('pending', 'reply')
           AND c.needs_review = false
         ORDER BY c.created_time DESC
         LIMIT %s
        """,
        (page_uuid, limit),
    )


async def save_comment_judgement(
    *, page_uuid: str, comment_id: str, classification: str, action: str,
    confidence: float, reply_text: str | None, reason: str,
) -> None:
    await db.execute(
        """
        UPDATE facebook_comments
           SET classification = %s, action = %s, confidence = %s,
               reply_text = %s, action_reason = %s,
               needs_review = (%s = 'flag'),
               processed_at = now()
         WHERE page_id = %s AND comment_id = %s
        """,
        (classification, action, confidence, reply_text, reason[:1000],
         action, page_uuid, comment_id),
    )


async def record_reply(
    *, page_uuid: str, comment_id: str, reply_comment_id: str, reply_text: str
) -> bool:
    """Attach a reply, but only if the comment does not already have one.

    The WHERE clause is the guard: two concurrent runs both reaching this
    statement means the second one updates nothing and can see that it did.
    """
    changed = await db.execute(
        """
        UPDATE facebook_comments
           SET reply_comment_id = %s, reply_text = %s, replied_at = now(),
               action = 'reply', processed_at = now()
         WHERE page_id = %s AND comment_id = %s
           AND reply_comment_id IS NULL
        """,
        (reply_comment_id, reply_text, page_uuid, comment_id),
    )
    return changed > 0


async def flagged_comments(page_uuid: str, limit: int = 20) -> list[dict]:
    return await db.fetch_all(
        """
        SELECT comment_id, fb_post_id, message, author_name, classification,
               action_reason, created_time
          FROM facebook_comments
         WHERE page_id = %s AND needs_review = true AND reviewed_at IS NULL
         ORDER BY created_time DESC
         LIMIT %s
        """,
        (page_uuid, limit),
    )


# ---------------------------------------------------------------------------
# Content memory and duplicate rejection
# ---------------------------------------------------------------------------
async def is_fresh(page_uuid: str, kind: str, hash_value: str,
                   days: int | None = None) -> bool:
    return bool(await db.fetch_value(
        "SELECT agent_content_is_fresh(%s, %s, %s, %s)",
        (page_uuid, kind, hash_value, days),
    ))


async def remember(
    *, page_uuid: str, kind: str, value: str, normalized: str, hash_value: str,
    post_id: str | None = None,
) -> None:
    await db.execute(
        """
        INSERT INTO facebook_content_memory
            (page_id, kind, value, normalized, hash, post_id)
        VALUES (%s,%s,%s,%s,%s,%s)
        """,
        (page_uuid, kind, value[:1000], normalized[:1000], hash_value, post_id),
    )


async def recent_memory(page_uuid: str, kind: str, days: int = 14,
                        limit: int = 40) -> list[str]:
    rows = await db.fetch_all(
        """
        SELECT DISTINCT ON (hash) value
          FROM facebook_content_memory
         WHERE page_id = %s AND kind = %s
           AND created_at > now() - make_interval(days => %s)
         ORDER BY hash, created_at DESC
         LIMIT %s
        """,
        (page_uuid, kind, days, limit),
    )
    return [r["value"] for r in rows]


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------
async def topic_performance(page_uuid: str, days: int = 60) -> list[dict]:
    return await db.fetch_all(
        "SELECT * FROM agent_topic_performance(%s, %s)", (page_uuid, days)
    )


async def best_posting_hours(page_uuid: str, days: int = 60) -> list[int]:
    """Hours that have actually performed, measured from stored metrics.

    Hours of the Page's posting time zone, the same clock preferred_hours uses.

    Returns an empty list when there is not enough history — which the caller
    must treat as "no opinion", not as "midnight". An agent that invents a best
    time from three posts is guessing with extra steps.
    """
    rows = await db.fetch_all(
        """
        WITH snapshot AS (
            SELECT DISTINCT ON (m.post_id)
                   m.post_id, m.reactions, m.comments, m.shares
              FROM facebook_post_metrics m
              JOIN facebook_posts p ON p.id = m.post_id
             WHERE p.page_id = %s
               AND p.published_at > now() - make_interval(days => %s)
             ORDER BY m.post_id, abs(m.age_hours - 24)
        )
        SELECT EXTRACT(HOUR FROM p.published_at
                       AT TIME ZONE agent_page_timezone(p.page_id))::int AS hour,
               avg(COALESCE(s.reactions,0) + COALESCE(s.comments,0)
                   + COALESCE(s.shares,0)) AS score,
               count(*) AS n
          FROM facebook_posts p
          JOIN snapshot s ON s.post_id = p.id
         WHERE p.page_id = %s
         GROUP BY 1
        HAVING count(*) >= 2
         ORDER BY 2 DESC
         LIMIT 5
        """,
        (page_uuid, days, page_uuid),
    )
    return [int(r["hour"]) for r in rows]


async def metrics_sample_size(page_uuid: str, days: int = 60) -> int:
    return int(await db.fetch_value(
        """
        SELECT count(DISTINCT p.id)
          FROM facebook_posts p
          JOIN facebook_post_metrics m ON m.post_id = p.id
         WHERE p.page_id = %s
           AND p.published_at > now() - make_interval(days => %s)
        """,
        (page_uuid, days),
    ) or 0)


# ---------------------------------------------------------------------------
# Content plans (the calendar)
# ---------------------------------------------------------------------------
async def create_plan(
    *, page_uuid: str, run_id: str | None, content_type: str,
    topic: str | None, animal: str | None, caption: str | None,
    visual_prompt: str | None, status: str = "draft",
    scheduled_for: datetime | None = None, created_by: str = "agent",
) -> str:
    row = await db.fetch_one(
        """
        INSERT INTO facebook_content_plans
            (page_id, run_id, content_type, topic, animal, caption,
             visual_prompt, status, scheduled_for, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
        """,
        (page_uuid, run_id, content_type, topic, animal, caption,
         visual_prompt, status, scheduled_for, created_by),
    )
    return str(row["id"])


async def set_plan_status(
    plan_id: str, status: str, *, detail: str | None = None,
    image_path: str | None = None, published_post_id: str | None = None,
) -> None:
    await db.execute(
        """
        UPDATE facebook_content_plans
           SET status = %s,
               status_detail = COALESCE(%s, status_detail),
               image_path = COALESCE(%s, image_path),
               published_post_id = COALESCE(%s, published_post_id)
         WHERE id = %s
        """,
        (status, detail, image_path, published_post_id, plan_id),
    )


async def plans(page_uuid: str, limit: int = 50) -> list[dict]:
    return await db.fetch_all(
        """
        SELECT id, scheduled_for, content_type, topic, animal, caption,
               status, status_detail, created_by, created_at
          FROM facebook_content_plans
         WHERE page_id = %s
         ORDER BY COALESCE(scheduled_for, created_at) DESC
         LIMIT %s
        """,
        (page_uuid, limit),
    )
