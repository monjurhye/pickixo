"""Learning from what actually happened.

The division of labour here is the whole point, and it is the opposite of the
tempting one:

* **Python and SQL compute the numbers.** Reach, reactions, which topic did
  better, which hour did better. These are facts about the Page.
* **The model may interpret them.** It is never asked to supply them.

A language model asked "how did our posts perform?" will answer fluently and
completely inventively, and the answer will then be used to change strategy.
So `agent_topic_performance` is a SQL function over stored metrics, and the
model only ever sees its output.

The second rule is restraint. One post going well is not a trend. Adjustments
require a real sample, move gradually, and are bounded — so a single viral
accident cannot turn the Page into a monoculture, and one flop cannot delete a
topic that normally works.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .. import db
from ..config import Settings
from ..logging_config import get_logger
from ..services.facebook import FacebookClient, PageRef
from ..services.facebook.errors import GraphFailure
from . import repository as repo

log = get_logger(__name__)

#: Below this many measured posts, the content mix is left alone. Eight is not
#: statistics — it is simply the point past which a change is more likely to be
#: signal than noise for a Page posting a couple of times a day.
MIN_SAMPLE_FOR_LEARNING = 8

#: The most the mix may move in one evaluation, in percentage points. Learning
#: should look like drift, not like lurching.
MAX_MIX_SHIFT = 10

#: No content type is ever driven to zero. A type with no recent posts stops
#: generating evidence about itself, and the agent would never rediscover it.
MIN_MIX_SHARE = 10

#: Snapshots are taken at these ages so posts are compared like with like.
SNAPSHOT_AGES = (1, 6, 24, 72)


@dataclass(slots=True)
class Evaluation:
    sample_size: int
    top_topics: list[dict[str, Any]]
    weak_topics: list[dict[str, Any]]
    best_hours: list[int]
    mix_before: dict[str, int]
    mix_after: dict[str, int]
    changed: bool
    note: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "sample_size": self.sample_size,
            "top_topics": self.top_topics,
            "weak_topics": self.weak_topics,
            "best_hours": self.best_hours,
            "content_mix": self.mix_after,
            "changed": self.changed,
            "note": self.note,
        }


# ---------------------------------------------------------------------------
# Collecting
# ---------------------------------------------------------------------------
async def _posts_needing_snapshot(page_uuid: str) -> list[dict]:
    """Posts that have crossed a snapshot age without being measured at it.

    Each post is measured at roughly 1, 6, 24 and 72 hours. Without fixed ages
    the comparison would be between a post measured after an hour and one
    measured after a week, and the evaluator would simply learn that older
    posts perform better.
    """
    rows = await db.fetch_all(
        """
        SELECT p.id, p.fb_post_id, p.published_at,
               EXTRACT(EPOCH FROM (now() - p.published_at)) / 3600 AS age_hours
          FROM facebook_posts p
         WHERE p.page_id = %s
           AND p.published_at > now() - interval '7 days'
         ORDER BY p.published_at DESC
         LIMIT 40
        """,
        (page_uuid,),
    )

    due: list[dict] = []
    for row in rows:
        age = float(row["age_hours"] or 0)
        # The most recent age bucket this post has passed.
        bucket = max((a for a in SNAPSHOT_AGES if age >= a), default=None)
        if bucket is None:
            continue
        exists = await db.fetch_value(
            "SELECT 1 FROM facebook_post_metrics WHERE post_id = %s AND age_hours = %s",
            (str(row["id"]), bucket),
        )
        if not exists:
            due.append({**row, "bucket": bucket})
    return due


async def collect_metrics(
    *, page_uuid: str, ref: PageRef, settings: Settings, limit: int = 10
) -> int:
    """Pull fresh numbers from Facebook for posts that are due a snapshot.

    Returns how many posts were measured. Failures are logged and skipped: a
    missing snapshot degrades learning slightly, while a raised exception would
    take down the agent run that called it.
    """
    due = (await _posts_needing_snapshot(page_uuid))[:limit]
    if not due:
        return 0

    measured = 0
    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        for row in due:
            fb_post_id = str(row["fb_post_id"])
            try:
                obj = await client.get_object(
                    ref, object_id=fb_post_id,
                    fields="reactions.summary(true).limit(0),"
                           "comments.summary(true).limit(0),shares",
                )
            except GraphFailure as failure:
                # A deleted post is not an error worth retrying.
                log.info("evaluator.metrics_unavailable",
                         kind=failure.kind.value, post=fb_post_id[:30])
                continue

            reactions = int(((obj.get("reactions") or {}).get("summary") or {})
                            .get("total_count") or 0)
            comments = int(((obj.get("comments") or {}).get("summary") or {})
                           .get("total_count") or 0)
            shares = int((obj.get("shares") or {}).get("count") or 0)

            insights: dict[str, int] = {}
            try:
                insights = await client.post_insights(ref, fb_post_id=fb_post_id)
            except GraphFailure:
                # read_insights may not be granted. Engagement alone is still
                # enough to rank topics; reach simply stays unknown.
                pass

            await repo.record_metrics(
                post_id=str(row["id"]),
                age_hours=int(row["bucket"]),
                reactions=reactions,
                comments=comments,
                shares=shares,
                impressions=insights.get("post_impressions"),
                reach=insights.get("post_impressions_unique"),
                clicks=insights.get("post_clicks"),
            )
            measured += 1

    if measured:
        log.info("evaluator.metrics_collected", page=page_uuid, posts=measured)
    return measured


# ---------------------------------------------------------------------------
# Learning
# ---------------------------------------------------------------------------
def _normalise_mix(mix: dict[str, int]) -> dict[str, int]:
    """Force the mix back to 100 with every share at or above the floor.

    Order matters here, and getting it wrong is subtle: applying the floor
    *before* scaling does not work, because scaling back down to 100 can push
    a floored value under the floor again. {0, 100, 0} floors to {10, 100, 10},
    which is 120, which scales to {8, 84, 8} — and 8 is below the floor the
    step was supposed to guarantee.

    So: scale first, then enforce the floor, then pay for the floor out of the
    largest shares.
    """
    keys = ("text", "image", "story")
    values = {k: max(0, int(mix.get(k, 0))) for k in keys}

    total = sum(values.values())
    if total <= 0:
        # Nothing to preserve; fall back to the documented default.
        return {"text": 25, "image": 50, "story": 25}

    scaled = {k: int(round(v * 100 / total)) for k, v in values.items()}

    # Raise anything under the floor, and take the cost from whoever can
    # afford it — largest first, never dropping them below the floor either.
    deficit = 0
    for key in keys:
        if scaled[key] < MIN_MIX_SHARE:
            deficit += MIN_MIX_SHARE - scaled[key]
            scaled[key] = MIN_MIX_SHARE

    while deficit > 0:
        donors = [k for k in keys if scaled[k] > MIN_MIX_SHARE]
        if not donors:
            break
        biggest = max(donors, key=lambda k: scaled[k])
        take = min(deficit, scaled[biggest] - MIN_MIX_SHARE)
        scaled[biggest] -= take
        deficit -= take

    # Rounding rarely lands on exactly 100; settle the remainder on the
    # largest share, which can absorb it without crossing the floor.
    drift = 100 - sum(scaled.values())
    if drift:
        biggest = max(keys, key=lambda k: scaled[k])
        scaled[biggest] += drift

    return scaled


def _type_scores(rows: list[dict]) -> dict[str, float]:
    """Average engagement per content type, from measured rows only."""
    totals: dict[str, list[float]] = {}
    for row in rows:
        post_type = str(row.get("post_type") or "")
        key = {"photo": "image", "text": "text", "story": "story"}.get(post_type)
        if key is None:
            continue
        totals.setdefault(key, []).append(float(row.get("avg_engagement") or 0))
    return {k: sum(v) / len(v) for k, v in totals.items() if v}


async def evaluate(page_uuid: str, *, apply_changes: bool = True) -> Evaluation:
    """Look at what happened, and adjust the content mix if the evidence warrants."""
    settings_row = await repo.get_settings(page_uuid) or {}
    mix_before = _normalise_mix(dict(settings_row.get("content_mix") or
                                     {"text": 25, "image": 50, "story": 25}))

    rows = await repo.topic_performance(page_uuid)
    sample = await repo.metrics_sample_size(page_uuid)
    best_hours = await repo.best_posting_hours(page_uuid)

    ranked = [
        {
            "topic": r["topic"],
            "type": r["post_type"],
            "posts": int(r["posts"]),
            "avg_engagement": float(r["avg_engagement"] or 0),
        }
        for r in rows
    ]
    top = ranked[:5]
    weak = list(reversed(ranked))[:5] if len(ranked) > 5 else []

    if sample < MIN_SAMPLE_FOR_LEARNING:
        return Evaluation(
            sample_size=sample, top_topics=top, weak_topics=weak,
            best_hours=best_hours, mix_before=mix_before, mix_after=mix_before,
            changed=False,
            note=(f"only {sample} measured post(s); keeping the current mix until "
                  f"there are at least {MIN_SAMPLE_FOR_LEARNING}"),
        )

    scores = _type_scores(rows)
    if len(scores) < 2:
        return Evaluation(
            sample_size=sample, top_topics=top, weak_topics=weak,
            best_hours=best_hours, mix_before=mix_before, mix_after=mix_before,
            changed=False,
            note="not enough different content types have been measured to compare",
        )

    # Shift towards the better-performing type, gently and within bounds.
    best = max(scores, key=lambda k: scores[k])
    worst = min(scores, key=lambda k: scores[k])
    if best == worst or scores[worst] <= 0:
        shift = 0
    else:
        # How much better, expressed as a fraction, capped.
        advantage = (scores[best] - scores[worst]) / max(scores[worst], 1.0)
        shift = int(min(MAX_MIX_SHIFT, round(advantage * MAX_MIX_SHIFT)))

    mix_after = dict(mix_before)
    if shift > 0:
        # Never below the floor: a type with no posts stops producing evidence
        # about itself and could never recover.
        takeable = max(0, mix_before[worst] - MIN_MIX_SHARE)
        shift = min(shift, takeable)
        if shift > 0:
            mix_after[worst] = mix_before[worst] - shift
            mix_after[best] = mix_before[best] + shift

    mix_after = _normalise_mix(mix_after)
    changed = mix_after != mix_before

    if changed and apply_changes:
        import json
        await db.execute(
            "UPDATE facebook_agent_settings SET content_mix = %s WHERE page_id = %s",
            (json.dumps(mix_after), page_uuid),
        )
        log.info("evaluator.mix_adjusted", page=page_uuid,
                 before=mix_before, after=mix_after)

    note = (
        f"{best} posts are averaging {scores[best]:.1f} engagement against "
        f"{scores[worst]:.1f} for {worst}; shifted {shift} points"
        if changed else
        "measured performance does not justify changing the mix"
    )

    return Evaluation(
        sample_size=sample, top_topics=top, weak_topics=weak,
        best_hours=best_hours, mix_before=mix_before, mix_after=mix_after,
        changed=changed, note=note,
    )


async def suggested_hour(page_uuid: str) -> int | None:
    """The hour the agent should prefer, or None if there is no evidence.

    Returning None matters. An agent that invents a best time from three posts
    is guessing with extra steps, and the caller is expected to treat None as
    "no opinion" rather than substituting a default.
    """
    hours = await repo.best_posting_hours(page_uuid)
    return hours[0] if hours else None


async def due_for_evaluation(page_uuid: str, *, every_hours: int = 6) -> bool:
    """Whether it is worth re-evaluating yet.

    Learning is cheap but not free, and the answer changes slowly. Running it
    on every wake would mostly re-derive the same numbers.
    """
    last = await db.fetch_value(
        """
        SELECT max(started_at) FROM facebook_agent_actions
         WHERE page_id = %s AND action_type = 'fetch_insights'
           AND status = 'succeeded'
        """,
        (page_uuid,),
    )
    if last is None:
        return True
    return (datetime.now(timezone.utc) - last) > timedelta(hours=every_hours)
