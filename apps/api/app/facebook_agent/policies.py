"""The cheap pass: everything that can be decided without asking a model.

This module is why the agent can wake every five minutes without costing
anything. Most wakes have an obvious answer — the daily limit is spent, the
last post was twenty minutes ago, there are no new comments — and paying a
language model to reach that conclusion would be both slow and expensive.

So: deterministic rules first, and the reasoning model only when the answer
genuinely depends on judgement.

The other thing this module does is enforce the ceilings. A model is asked what
would be *appropriate*; it is never trusted with what is *permitted*. Limits,
capabilities, cooldowns and the emergency stop are all decided here, in code,
and a decision that comes back from the model is checked against them again
before anything is executed. A hallucinated "publish_image_post" when the daily
limit is spent must not be able to publish anything.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum

from ..services.facebook import capabilities as caps
from .state import AgentState


class Decision(str, Enum):
    """Everything the agent is allowed to decide in this phase.

    Reels are deliberately absent. They are a later phase, and leaving them out
    of the enum means a model that suggests one produces an invalid decision
    that is rejected, rather than reaching an action dispatcher that might try.
    """
    DO_NOTHING = "do_nothing"
    WAIT = "wait"
    PUBLISH_TEXT_POST = "publish_text_post"
    PUBLISH_IMAGE_POST = "publish_image_post"
    PUBLISH_STORY = "publish_story"
    REPLY_TO_COMMENTS = "reply_to_comments"
    FLAG_FOR_REVIEW = "flag_for_review"


#: Decisions that cause something to appear on the Page.
PUBLISHING_DECISIONS = frozenset({
    Decision.PUBLISH_TEXT_POST,
    Decision.PUBLISH_IMAGE_POST,
    Decision.PUBLISH_STORY,
})


@dataclass(slots=True)
class Verdict:
    """The outcome of the cheap pass.

    `needs_reasoning` false means the answer is settled and no model is called.
    """
    decision: Decision | None
    reason: str
    needs_reasoning: bool = False
    #: Action types the model may choose from, when reasoning is needed. The
    #: model is never offered an option the rules have already ruled out.
    allowed: frozenset[Decision] = frozenset()


def _cooling_down(state: AgentState, action_type: str) -> datetime | None:
    until = state.cooling_down.get(action_type)
    if until and until > datetime.now(timezone.utc):
        return until
    return None


def assess(state: AgentState) -> Verdict:
    """Decide, or decide that a decision needs thought.

    Ordered cheapest-and-most-decisive first: an emergency stop ends the
    question immediately and nothing after it needs to run.
    """
    automation = state.automation

    # --- absolute stops ---------------------------------------------------
    if automation.emergency_stopped:
        return Verdict(Decision.DO_NOTHING, "emergency stop is engaged")

    if not automation.enabled:
        return Verdict(Decision.DO_NOTHING, "the agent is switched off")

    if automation.mode == "PAUSED":
        return Verdict(Decision.DO_NOTHING, "the agent is paused")

    if automation.connection_status != "connected":
        # Nothing the agent can do about a dead token except say so. Retrying
        # Graph calls against an invalid token is how an app gets flagged.
        return Verdict(
            Decision.FLAG_FOR_REVIEW,
            f"the Facebook connection is {automation.connection_status} — "
            "it needs to be reconnected",
        )

    # --- what is even possible -------------------------------------------
    can_reply = caps.blocks_action(automation.capabilities, "reply_to_comment") is None
    can_post_text = caps.blocks_action(automation.capabilities, "publish_text_post") is None
    can_post_image = caps.blocks_action(automation.capabilities, "publish_image_post") is None
    can_story = caps.blocks_action(automation.capabilities, "publish_story") is None

    if not any((can_reply, can_post_text, can_post_image, can_story)):
        return Verdict(
            Decision.FLAG_FOR_REVIEW,
            "this connection has no publishing or moderation permissions",
        )

    today = state.today

    # --- comments come first ----------------------------------------------
    #
    # A question under yesterday's post is worth more than a new post: somebody
    # is already engaged and waiting. Posting while ignoring them is what makes
    # a Page feel like a broadcast.
    pending_comments = [
        c for c in state.unanswered_comments
        if not c.already_replied and c.action != "ignore"
    ]
    replies_available = today.replies_last_hour < today.max_replies_per_hour
    reply_cooldown = _cooling_down(state, "reply_to_comment")

    comments_actionable = bool(
        pending_comments and can_reply and replies_available and not reply_cooldown
    )

    # --- can anything be published right now? -----------------------------
    feed_quota_left = today.feed_posts < today.max_feed_posts
    image_quota_left = today.image_posts < today.max_image_posts
    story_quota_left = today.stories < today.max_stories
    post_cooldown = _cooling_down(state, "publish_text_post") or \
        _cooling_down(state, "publish_image_post")

    spacing_ok = (
        today.minutes_since_feed_post is None
        or today.minutes_since_feed_post >= _min_spacing(state)
    )

    can_publish_feed = (
        feed_quota_left and spacing_ok and not post_cooldown
        and (can_post_text or (can_post_image and image_quota_left))
    )
    story_spacing_ok = (
        today.minutes_since_story is None
        or today.minutes_since_story >= today.min_minutes_between_stories
    )
    can_publish_story = (
        can_story and story_quota_left and story_spacing_ok
        and not _cooling_down(state, "publish_story")
    )

    # --- nothing to do ----------------------------------------------------
    #
    # The single most common outcome, and it must cost nothing. No model call,
    # no Graph call beyond what the observer already did.
    if not comments_actionable and not can_publish_feed and not can_publish_story:
        return Verdict(Decision.DO_NOTHING, _why_nothing(
            state, pending_comments, can_reply, replies_available,
            feed_quota_left, spacing_ok, reply_cooldown or post_cooldown,
        ))

    # --- a recent post that is still working ------------------------------
    #
    # Deterministic because it needs no judgement: something published in the
    # last hour that is collecting engagement is a reason not to publish over
    # it. Comments are still handled — that is not "posting over" anything.
    if can_publish_feed and not comments_actionable and state.engagement_still_active:
        last = state.last_post
        return Verdict(
            Decision.DO_NOTHING,
            f"the last post is {last.age_minutes} minutes old and still "
            f"collecting engagement ({last.engagement}); another post now "
            "would bury it",
        )

    # --- genuine judgement required ---------------------------------------
    allowed: set[Decision] = {Decision.DO_NOTHING, Decision.WAIT}
    if comments_actionable:
        allowed.add(Decision.REPLY_TO_COMMENTS)
    if can_publish_feed and can_post_text:
        allowed.add(Decision.PUBLISH_TEXT_POST)
    if can_publish_feed and can_post_image and image_quota_left:
        allowed.add(Decision.PUBLISH_IMAGE_POST)
    if can_publish_story:
        allowed.add(Decision.PUBLISH_STORY)
    allowed.add(Decision.FLAG_FOR_REVIEW)

    parts = []
    if comments_actionable:
        parts.append(f"{len(pending_comments)} unanswered comment(s)")
    if can_publish_feed:
        since = today.minutes_since_feed_post
        parts.append(
            "no feed post yet today" if since is None
            else f"{since} minutes since the last feed post"
        )
    if can_publish_story:
        parts.append("story slots available")

    return Verdict(
        None,
        "; ".join(parts) or "something may need attention",
        needs_reasoning=True,
        allowed=frozenset(allowed),
    )


def _min_spacing(state: AgentState) -> int:
    """Minimum minutes between feed posts, from settings."""
    return state.today.min_minutes_between_feed_posts


def _why_nothing(
    state: AgentState,
    pending: list,
    can_reply: bool,
    replies_available: bool,
    feed_quota_left: bool,
    spacing_ok: bool,
    cooling: datetime | None,
) -> str:
    """A specific reason, not "nothing to do".

    The activity log is the only window into an agent that is deliberately
    idle. "Waiting" tells the owner nothing; "daily limit reached (2/2)" tells
    them the system is working as intended.
    """
    if cooling:
        return (
            "backing off after a Facebook rate limit until "
            f"{cooling.strftime('%H:%M')} UTC"
        )
    if pending and not can_reply:
        return (
            f"{len(pending)} comment(s) are waiting but this connection cannot "
            "reply — pages_manage_engagement is missing"
        )
    if pending and not replies_available:
        return (
            f"{len(pending)} comment(s) waiting, but the hourly reply limit is "
            f"reached ({state.today.replies_last_hour}/"
            f"{state.today.max_replies_per_hour})"
        )
    if not feed_quota_left:
        return (
            f"daily post limit reached ({state.today.feed_posts}/"
            f"{state.today.max_feed_posts}) and no comments need a reply"
        )
    if (state.today.minutes_since_story is not None
            and state.today.minutes_since_story
            < state.today.min_minutes_between_stories):
        return (
            f"{state.today.minutes_since_story} minutes since the last story "
            "and the feed is not due"
        )
    if not spacing_ok:
        return (
            f"only {state.today.minutes_since_feed_post} minutes since the last "
            f"post, minimum spacing is {_min_spacing(state)}"
        )
    return "nothing needs attention"


def validate(decision: Decision, state: AgentState, allowed: frozenset[Decision]) -> str | None:
    """Re-check a decision that came back from the model.

    The model proposes; this disposes. Called immediately before execution, so
    that a decision which was allowed when the prompt was built but is no
    longer — because a concurrent run just published — still cannot act.

    Returns a refusal reason, or None if the decision may proceed.
    """
    if decision not in allowed:
        return f"{decision.value} was not among the permitted decisions"

    if state.automation.emergency_stopped:
        return "emergency stop is engaged"
    if not state.automation.enabled or state.automation.mode == "PAUSED":
        return "the agent is not running"

    if decision in PUBLISHING_DECISIONS:
        blocked = caps.blocks_action(state.automation.capabilities, decision.value)
        if blocked:
            return blocked

        today = state.today
        if decision is Decision.PUBLISH_STORY:
            if today.stories >= today.max_stories:
                return f"story limit reached ({today.stories}/{today.max_stories})"
        else:
            if today.feed_posts >= today.max_feed_posts:
                return (f"daily post limit reached "
                        f"({today.feed_posts}/{today.max_feed_posts})")
            if (today.minutes_since_feed_post is not None
                    and today.minutes_since_feed_post < _min_spacing(state)):
                return (f"only {today.minutes_since_feed_post} minutes since the "
                        f"last post")
            if (decision is Decision.PUBLISH_IMAGE_POST
                    and today.image_posts >= today.max_image_posts):
                return (f"daily image limit reached "
                        f"({today.image_posts}/{today.max_image_posts})")

    if decision is Decision.REPLY_TO_COMMENTS:
        blocked = caps.blocks_action(state.automation.capabilities, "reply_to_comment")
        if blocked:
            return blocked
        if state.today.replies_last_hour >= state.today.max_replies_per_hour:
            return "hourly reply limit reached"

    return None
