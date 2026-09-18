"""Building the picture the agent reasons over.

Observation is the step most likely to be quietly expensive. The agent wakes
every few minutes; a Page changes far less often. Pulling the full post and
comment list from the Graph API on every wake would burn Meta's rate limit on
finding out that nothing has happened — and Meta's page-level limits are the
thing standing between this system and a temporary block.

So observation is layered:

  1. Settings, limits and today's activity come from our own tables. Always.
     These answer most questions and cost nothing.
  2. Posts and comments are pulled from Graph only when the sync window has
     elapsed, or when something makes a refresh worthwhile.
  3. Everything else — recent topics, memory, measured performance — is ours
     already.

A wake that finds nothing due therefore makes zero Graph calls and zero AI
calls, which is what makes waking often affordable.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..logging_config import get_logger
from ..services.crypto import CryptoNotConfigured, DecryptionFailed, decrypt
from ..services.facebook import FacebookClient, PageRef
from ..services.facebook.errors import FailureKind, GraphFailure
from . import repository as repo
from .memory import extract_subject
from .state import (
    AgentState, AutomationState, CommentSnapshot, PageSnapshot,
    PerformanceSummary, PostSnapshot, TodayActivity,
)

log = get_logger(__name__)

#: How stale the Page picture may get before Graph is asked again. Five
#: minutes of staleness costs nothing real: a comment answered five minutes
#: later is still a prompt reply.
SYNC_INTERVAL = timedelta(minutes=10)


class ConnectionUnusable(RuntimeError):
    """The stored token cannot be used. Never carries the token itself."""


def page_ref(page_row: dict, *, token_key: str) -> PageRef:
    """Decrypt the Page token for immediate use.

    The plaintext exists only inside the returned object, for the life of one
    set of Graph calls. It is never stored on the state, never logged and never
    returned by an endpoint.
    """
    try:
        token = decrypt(page_row["access_token_encrypted"], key=token_key)
    except CryptoNotConfigured as exc:
        # The key is absent from the environment. Distinct from a bad key: the
        # stored token is probably fine and nothing needs reconnecting — a
        # setting is missing. Saying so is the difference between a five-second
        # fix and re-authorising a Page for no reason.
        raise ConnectionUnusable(
            "FACEBOOK_TOKEN_KEY is not set on this server, so the stored Page "
            "token cannot be read"
        ) from exc
    except DecryptionFailed as exc:
        # Almost always a rotated FACEBOOK_TOKEN_KEY. The Page has to be
        # reconnected; there is no recovery from here.
        raise ConnectionUnusable(
            "the stored Page token could not be decrypted — the Page needs "
            "to be reconnected"
        ) from exc
    return PageRef(page_id=page_row["page_id"], access_token=token)


async def _sync_from_graph(
    *, page_row: dict, token_key: str, graph_base_url: str,
    app_id: str, app_secret: str,
) -> None:
    """Pull recent posts and comments into our tables.

    Failures here are logged and swallowed rather than raised: a Graph outage
    should make the agent act on slightly stale information, not crash the run.
    The one exception is an auth failure, which marks the connection so the
    agent stops trying.
    """
    ref = page_ref(page_row, token_key=token_key)
    page_uuid = str(page_row["id"])

    async with FacebookClient(
        graph_base_url=graph_base_url, app_id=app_id, app_secret=app_secret
    ) as client:
        try:
            posts = await client.recent_posts(ref, limit=15)
        except GraphFailure as failure:
            if failure.kind is FailureKind.AUTH:
                await repo.set_connection_status(
                    page_uuid, "token_invalid", failure.message[:300]
                )
                raise ConnectionUnusable(failure.message) from failure
            log.warning("agent.sync_posts_failed", kind=failure.kind.value)
            return

        for post in posts:
            created = _parse_time(post.get("created_time"))
            if created is None:
                continue
            summary = _engagement(post)
            post_id = await repo.upsert_post(
                page_uuid=page_uuid,
                fb_post_id=str(post["id"]),
                post_type=_post_type(post),
                message=post.get("message"),
                published_at=created,
                permalink=post.get("permalink_url"),
                # Anything we did not create is somebody posting by hand. It
                # still counts towards the day's activity.
                created_by="agent" if await _is_ours(page_uuid, str(post["id"]))
                           else "human",
            )
            # Store engagement as an age-bucketed snapshot so the evaluator can
            # compare posts fairly later.
            age_hours = max(0, int(
                (datetime.now(timezone.utc) - created).total_seconds() // 3600
            ))
            await repo.record_metrics(
                post_id=post_id,
                age_hours=min(age_hours, 24 if age_hours >= 24 else age_hours),
                reactions=summary["reactions"],
                comments=summary["comments"],
                shares=summary["shares"],
            )

        # Comments, newest posts first — an old post rarely gains new comments,
        # and pulling every post's thread is what makes this expensive.
        for post in posts[:6]:
            try:
                comments = await client.post_comments(
                    ref, fb_post_id=str(post["id"]), limit=25
                )
            except GraphFailure as failure:
                if failure.kind is FailureKind.AUTH:
                    raise ConnectionUnusable(failure.message) from failure
                log.warning("agent.sync_comments_failed", kind=failure.kind.value)
                continue

            for comment in comments:
                created = _parse_time(comment.get("created_time"))
                if created is None or not (comment.get("message") or "").strip():
                    continue
                author = comment.get("from") or {}
                await repo.upsert_comment(
                    page_uuid=page_uuid,
                    comment_id=str(comment["id"]),
                    fb_post_id=str(post["id"]),
                    message=str(comment["message"])[:4000],
                    created_time=created,
                    author_id=str(author.get("id")) if author.get("id") else None,
                    author_name=author.get("name"),
                    parent_comment_id=(comment.get("parent") or {}).get("id"),
                )

    from .. import db
    await db.execute(
        "UPDATE facebook_pages SET last_synced_at = now() WHERE id = %s",
        (page_uuid,),
    )


async def _is_ours(page_uuid: str, fb_post_id: str) -> bool:
    """Did this system publish that post?

    Answered from the action ledger, which records the external id of every
    publish we performed.
    """
    from .. import db
    return bool(await db.fetch_value(
        """
        SELECT 1 FROM facebook_agent_actions
         WHERE page_id = %s AND external_id = %s AND status = 'succeeded'
         LIMIT 1
        """,
        (page_uuid, fb_post_id),
    ))


async def observe(
    *, page_row: dict, settings_row: dict, token_key: str,
    graph_base_url: str, app_id: str = "", app_secret: str = "",
    force_sync: bool = False,
) -> AgentState:
    """Build the agent's view of the Page."""
    page_uuid = str(page_row["id"])
    connection_status = page_row.get("status", "disconnected")

    # --- refresh from Graph, if it is time -------------------------------
    last_sync = page_row.get("last_synced_at")
    due = (
        force_sync
        or last_sync is None
        or (datetime.now(timezone.utc) - last_sync) > SYNC_INTERVAL
    )
    if due and connection_status == "connected":
        try:
            await _sync_from_graph(
                page_row=page_row, token_key=token_key,
                graph_base_url=graph_base_url, app_id=app_id,
                app_secret=app_secret,
            )
        except ConnectionUnusable as exc:
            # Expected and actionable, so it is recorded on the connection
            # rather than logged as a crash.
            connection_status = "token_invalid"
            log.warning("agent.connection_unusable", detail=str(exc)[:200])
            await repo.set_connection_status(page_uuid, "token_invalid", str(exc)[:300])
        except Exception:  # noqa: BLE001
            # Observation must not be able to kill a run. Acting on slightly
            # stale data is strictly better than not acting at all.
            log.exception("agent.sync_failed")

    # --- our own tables ---------------------------------------------------
    activity = await repo.activity_today(page_uuid)
    posts = await repo.recent_posts(page_uuid, limit=15)
    pending = await repo.pending_comments(page_uuid, limit=25)
    cooling = await repo.cooldowns(page_uuid)

    diversity_days = int(settings_row.get("diversity_days") or 14)
    topics = await repo.recent_memory(page_uuid, "topic", days=diversity_days)
    animals = await repo.recent_memory(page_uuid, "animal", days=diversity_days)
    captions = await repo.recent_memory(page_uuid, "caption", days=diversity_days,
                                        limit=15)

    performance = await _performance(page_uuid)

    today = TodayActivity(
        feed_posts=int(activity.get("feed_posts") or 0),
        image_posts=int(activity.get("image_posts") or 0),
        text_posts=int(activity.get("text_posts") or 0),
        stories=int(activity.get("stories") or 0),
        comment_replies=int(activity.get("comment_replies") or 0),
        replies_last_hour=int(activity.get("replies_last_hour") or 0),
        minutes_since_feed_post=(
            int(activity["minutes_since_feed_post"])
            if activity.get("minutes_since_feed_post") is not None else None
        ),
        minutes_since_story=await _minutes_since_story(page_uuid),
        max_feed_posts=int(settings_row.get("max_feed_posts_per_day") or 2),
        max_image_posts=int(settings_row.get("max_image_posts_per_day") or 2),
        max_stories=int(settings_row.get("max_stories_per_day") or 5),
        max_replies_per_hour=int(settings_row.get("max_comment_replies_per_hour") or 10),
        min_minutes_between_feed_posts=int(
            settings_row.get("min_minutes_between_feed_posts") or 180
        ),
    )

    return AgentState(
        page=PageSnapshot(
            name=page_row.get("page_name") or "Unknown Page",
            page_id=str(page_row.get("page_id") or ""),
            category=page_row.get("category"),
        ),
        automation=AutomationState(
            enabled=bool(settings_row.get("enabled")),
            mode=str(settings_row.get("mode") or "PAUSED"),
            emergency_stopped=bool(settings_row.get("emergency_stopped")),
            capabilities=page_row.get("capabilities") or {},
            connection_status=connection_status,
        ),
        today=today,
        recent_posts=[
            PostSnapshot(
                fb_post_id=str(p["fb_post_id"]),
                message=p.get("message"),
                created_time=p["published_at"],
                post_type=str(p.get("post_type") or "text"),
                reactions=int(p.get("reactions") or 0),
                comments=int(p.get("comments") or 0),
                shares=int(p.get("shares") or 0),
                topic=p.get("topic"),
                animal=p.get("animal") or extract_subject(p.get("message") or ""),
                created_by=str(p.get("created_by") or "agent"),
            )
            for p in posts
        ],
        unanswered_comments=[
            CommentSnapshot(
                comment_id=str(c["comment_id"]),
                fb_post_id=str(c["fb_post_id"]),
                message=str(c["message"]),
                created_time=c["created_time"],
                author_name=c.get("author_name"),
                classification=str(c.get("classification") or "unclassified"),
                action=str(c.get("action") or "pending"),
                already_replied=bool(c.get("already_replied")),
                post_context=c.get("post_context"),
            )
            for c in pending
        ],
        recent_topics=topics,
        recent_animals=animals,
        recent_captions=captions,
        performance=performance,
        cooling_down=cooling,
    )


async def _performance(page_uuid: str) -> PerformanceSummary:
    """Measured numbers only. Never estimated, never asked of a model."""
    rows = await repo.topic_performance(page_uuid)
    sample = await repo.metrics_sample_size(page_uuid)
    ranked = [
        {
            "topic": r["topic"],
            "type": r["post_type"],
            "posts": int(r["posts"]),
            "avg_engagement": float(r["avg_engagement"] or 0),
        }
        for r in rows
    ]
    return PerformanceSummary(
        top_topics=ranked[:5],
        weak_topics=list(reversed(ranked))[:5] if len(ranked) > 5 else [],
        best_hours=await repo.best_posting_hours(page_uuid),
        sample_size=sample,
    )


async def _minutes_since_story(page_uuid: str) -> int | None:
    from .. import db
    value = await db.fetch_value(
        """
        SELECT EXTRACT(EPOCH FROM (now() - max(started_at))) / 60
          FROM facebook_agent_actions
         WHERE page_id = %s AND action_type = 'publish_story'
           AND status = 'succeeded'
        """,
        (page_uuid,),
    )
    return int(value) if value is not None else None


# ---------------------------------------------------------------------------
# Parsing Graph payloads
# ---------------------------------------------------------------------------
def _parse_time(value: Any) -> datetime | None:
    """Graph returns ISO 8601 with a +0000 offset Python 3.10 cannot read."""
    if not value:
        return None
    text = str(value)
    try:
        # "+0000" -> "+00:00"
        if len(text) >= 5 and (text[-5] in "+-") and ":" not in text[-5:]:
            text = f"{text[:-2]}:{text[-2:]}"
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _engagement(post: dict) -> dict[str, int]:
    def summary_count(key: str) -> int:
        block = post.get(key) or {}
        return int((block.get("summary") or {}).get("total_count") or 0)

    shares = post.get("shares") or {}
    return {
        "reactions": summary_count("reactions"),
        "comments": summary_count("comments"),
        "shares": int(shares.get("count") or 0),
    }


def _post_type(post: dict) -> str:
    attachments = (post.get("attachments") or {}).get("data") or []
    media = (attachments[0].get("media_type") if attachments else None)
    status = str(post.get("status_type") or "")

    if media == "photo" or status in {"added_photos", "mobile_status_update"}:
        return "photo" if media == "photo" else "text"
    if media == "video":
        return "video"
    if media == "link":
        return "link"
    return "text"
