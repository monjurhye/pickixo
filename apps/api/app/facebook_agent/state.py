"""The compact picture of the Page the agent reasons over.

Two properties matter more than the shape:

**No secrets, ever.** Part of this object is serialised into an AI prompt and
all of it is written to facebook_agent_runs.observation, which the dashboard
reads. A Page access token must never be in either. There is no token field on
any dataclass here, and `for_model()` is an allowlist rather than a redaction
pass — things are absent because they were never added, not because something
remembered to strip them.

**Small.** Everything in here is paid for twice: once in prompt tokens and once
in the row it is stored in. Fifteen recent posts is enough to see rhythm and
repetition; a hundred just costs money.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


@dataclass(slots=True)
class PageSnapshot:
    name: str
    page_id: str
    followers: int | None = None
    category: str | None = None


@dataclass(slots=True)
class PostSnapshot:
    fb_post_id: str
    message: str | None
    created_time: datetime
    post_type: str
    reactions: int = 0
    comments: int = 0
    shares: int = 0
    topic: str | None = None
    animal: str | None = None
    created_by: str = "agent"

    @property
    def age_minutes(self) -> int:
        delta = datetime.now(timezone.utc) - self.created_time
        return max(0, int(delta.total_seconds() // 60))

    @property
    def engagement(self) -> int:
        return self.reactions + self.comments + self.shares


@dataclass(slots=True)
class CommentSnapshot:
    comment_id: str
    fb_post_id: str
    message: str
    created_time: datetime
    author_name: str | None = None
    classification: str = "unclassified"
    action: str = "pending"
    already_replied: bool = False
    #: The caption of the post it sits under. A reply cannot be written
    #: without it — "what animal is this?" is unanswerable otherwise.
    post_context: str | None = None

    @property
    def age_minutes(self) -> int:
        delta = datetime.now(timezone.utc) - self.created_time
        return max(0, int(delta.total_seconds() // 60))


@dataclass(slots=True)
class TodayActivity:
    feed_posts: int = 0
    image_posts: int = 0
    text_posts: int = 0
    stories: int = 0
    comment_replies: int = 0
    replies_last_hour: int = 0
    minutes_since_feed_post: int | None = None
    minutes_since_story: int | None = None

    #: The ceilings, carried alongside the counts so that every consumer sees
    #: "1 of 2" rather than a bare number it has to look the limit up for.
    max_feed_posts: int = 2
    max_image_posts: int = 2
    max_stories: int = 5
    max_replies_per_hour: int = 10
    #: Minimum gap between feed posts. Carried here so policies.py needs no
    #: database access and stays a pure function of the state.
    min_minutes_between_feed_posts: int = 180
    #: Stories need spacing too, and not only for the audience's sake. Without
    #: it a free story slot — and with five a day there nearly always is one —
    #: would make the cheap pass hand over to the reasoning model on virtually
    #: every wake, which is exactly the cost the cheap pass exists to avoid.
    min_minutes_between_stories: int = 120


@dataclass(slots=True)
class AutomationState:
    enabled: bool = False
    mode: str = "PAUSED"
    emergency_stopped: bool = False
    capabilities: dict[str, Any] = field(default_factory=dict)
    connection_status: str = "disconnected"


@dataclass(slots=True)
class PerformanceSummary:
    """Measured numbers only.

    Computed in SQL from stored metrics — see agent_topic_performance. The
    model is allowed to interpret this; it is never asked to supply it, because
    a model asked for analytics will produce extremely plausible fiction.
    """
    top_topics: list[dict[str, Any]] = field(default_factory=list)
    weak_topics: list[dict[str, Any]] = field(default_factory=list)
    best_hours: list[int] = field(default_factory=list)
    sample_size: int = 0

    @property
    def is_meaningful(self) -> bool:
        """Whether there is enough history to learn anything from.

        Below this the agent keeps its default content mix. Reshaping strategy
        around three posts is not learning, it is overfitting.
        """
        return self.sample_size >= 8


@dataclass(slots=True)
class AgentState:
    """Everything the agent knows when it decides."""
    page: PageSnapshot
    automation: AutomationState
    today: TodayActivity
    recent_posts: list[PostSnapshot] = field(default_factory=list)
    unanswered_comments: list[CommentSnapshot] = field(default_factory=list)
    recent_topics: list[str] = field(default_factory=list)
    recent_animals: list[str] = field(default_factory=list)
    recent_captions: list[str] = field(default_factory=list)
    performance: PerformanceSummary = field(default_factory=PerformanceSummary)
    #: Action types currently backed off after a rate limit, with the time they
    #: may be tried again.
    cooling_down: dict[str, datetime] = field(default_factory=dict)
    observed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # -- derived, used by the deterministic pass ---------------------------
    @property
    def last_post(self) -> PostSnapshot | None:
        return self.recent_posts[0] if self.recent_posts else None

    @property
    def minutes_since_last_post(self) -> int | None:
        post = self.last_post
        return post.age_minutes if post else None

    @property
    def has_unanswered_comments(self) -> bool:
        return bool(self.unanswered_comments)

    @property
    def engagement_still_active(self) -> bool:
        """Whether the most recent post is still doing something.

        Used to answer "should we post again yet?". A post that is two hours
        old and still collecting comments is a reason to wait: publishing over
        it splits the audience's attention and buries something that is working.
        """
        post = self.last_post
        if post is None:
            return False
        return post.age_minutes < 180 and post.engagement >= 3

    def to_dict(self) -> dict[str, Any]:
        """Full state, for storage in the run record."""
        data = asdict(self)
        return _isoformat_dates(data)

    def for_model(self) -> dict[str, Any]:
        """The subset handed to the reasoning model.

        An allowlist, built field by field. Nothing is copied wholesale from
        the state object, so a field added later cannot reach a third-party
        model by accident.
        """
        return {
            "page": {
                "name": self.page.name,
                "followers": self.page.followers,
            },
            "now_utc": self.observed_at.strftime("%Y-%m-%d %H:%M"),
            "today": {
                "feed_posts": f"{self.today.feed_posts}/{self.today.max_feed_posts}",
                "image_posts": f"{self.today.image_posts}/{self.today.max_image_posts}",
                "stories": f"{self.today.stories}/{self.today.max_stories}",
                "comment_replies_this_hour":
                    f"{self.today.replies_last_hour}/{self.today.max_replies_per_hour}",
                "minutes_since_last_feed_post": self.today.minutes_since_feed_post,
            },
            "recent_posts": [
                {
                    "minutes_ago": p.age_minutes,
                    "type": p.post_type,
                    "topic": p.topic,
                    "animal": p.animal,
                    "engagement": p.engagement,
                    # Truncated: the model needs to recognise the subject, not
                    # re-read the whole caption.
                    "caption_start": (p.message or "")[:120],
                }
                for p in self.recent_posts[:8]
            ],
            "recent_topics": self.recent_topics[:20],
            "recent_animals": self.recent_animals[:20],
            "unanswered_comments": len(self.unanswered_comments),
            "engagement_still_active": self.engagement_still_active,
            "performance": {
                "top_topics": self.performance.top_topics[:5],
                "weak_topics": self.performance.weak_topics[:5],
                "sample_size": self.performance.sample_size,
                "meaningful": self.performance.is_meaningful,
            },
            "capabilities": {
                k: v for k, v in self.automation.capabilities.items()
                if k.startswith("can_")
            },
        }


def _isoformat_dates(value: Any) -> Any:
    """asdict leaves datetimes as objects, and jsonb will not take them."""
    if isinstance(value, dict):
        return {k: _isoformat_dates(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_isoformat_dates(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value
