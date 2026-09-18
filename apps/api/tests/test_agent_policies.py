"""Tests for the agent's deterministic pass.

These protect the two claims the whole design rests on:

1. **The agent may decide to do nothing, and usually should.** A scheduler that
   wakes something which always acts is just a cron job with extra steps.

2. **A limit cannot be exceeded.** Not by the rules, and not by a decision that
   comes back from a language model either — `validate` re-checks every
   decision immediately before execution, so a hallucinated or stale one is
   refused rather than published.

No network, no database, no AI. Run:

    cd apps/api && python -m tests.test_agent_policies
"""
from __future__ import annotations

import pathlib
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.facebook_agent.policies import (  # noqa: E402
    Decision, assess, validate,
)
from app.facebook_agent.state import (  # noqa: E402
    AgentState, AutomationState, CommentSnapshot, PageSnapshot, PostSnapshot,
    TodayActivity,
)
from app.services.facebook import capabilities as caps  # noqa: E402

FULL_CAPS = caps.detect(
    granted_scopes=list(caps.REQUESTED_SCOPES),
    page_tasks=["CREATE_CONTENT", "MODERATE", "MANAGE", "ANALYZE"],
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def make_state(**overrides) -> AgentState:
    """A healthy, running Page with nothing needing attention."""
    automation = AutomationState(
        enabled=True, mode="FULL_AUTO", emergency_stopped=False,
        capabilities=overrides.pop("capabilities", FULL_CAPS),
        connection_status=overrides.pop("connection_status", "connected"),
    )
    for key in ("enabled", "mode", "emergency_stopped"):
        if key in overrides:
            setattr(automation, key, overrides.pop(key))

    today_kwargs = overrides.pop("today", {})
    today = TodayActivity(**today_kwargs)

    state = AgentState(
        page=PageSnapshot(name="The World Frame", page_id="1", followers=1000),
        automation=automation,
        today=today,
    )
    for key, value in overrides.items():
        setattr(state, key, value)
    return state


def post(minutes_ago: int, *, engagement: int = 0, topic: str = "Tiger") -> PostSnapshot:
    return PostSnapshot(
        fb_post_id=f"p{minutes_ago}",
        message=f"A post about {topic}",
        created_time=now() - timedelta(minutes=minutes_ago),
        post_type="photo",
        reactions=engagement,
        topic=topic,
    )


def comment(minutes_ago: int = 5, *, replied: bool = False,
            action: str = "pending") -> CommentSnapshot:
    return CommentSnapshot(
        comment_id=f"c{minutes_ago}",
        fb_post_id="p1",
        message="What animal is this?",
        created_time=now() - timedelta(minutes=minutes_ago),
        already_replied=replied,
        action=action,
    )


# ===========================================================================
# Doing nothing is a correct outcome
# ===========================================================================
class DoingNothing(unittest.TestCase):
    def test_emergency_stop_beats_everything(self) -> None:
        """Even with work waiting, the stop button wins."""
        state = make_state(
            emergency_stopped=True,
            unanswered_comments=[comment(), comment(9)],
            today={"feed_posts": 0},
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertFalse(verdict.needs_reasoning, "must not pay for reasoning")
        self.assertIn("emergency", verdict.reason.lower())

    def test_disabled_and_paused_do_nothing(self) -> None:
        for kwargs in ({"enabled": False}, {"mode": "PAUSED"}):
            with self.subTest(**kwargs):
                verdict = assess(make_state(**kwargs))
                self.assertIs(verdict.decision, Decision.DO_NOTHING)
                self.assertFalse(verdict.needs_reasoning)

    def test_daily_limit_reached_costs_no_ai(self) -> None:
        """The most common idle case, and it must be free."""
        state = make_state(today={"feed_posts": 2, "max_feed_posts": 2,
                                  "image_posts": 2, "stories": 5,
                                  "max_stories": 5})
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertFalse(verdict.needs_reasoning)
        self.assertIn("2/2", verdict.reason)

    def test_recent_post_still_engaging_is_left_alone(self) -> None:
        """The brief's own example: don't post over something that is working."""
        state = make_state(
            today={"feed_posts": 1, "minutes_since_feed_post": 240,
                   "stories": 5, "max_stories": 5},
            recent_posts=[post(30, engagement=25)],
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertIn("bury", verdict.reason)

    def test_spacing_not_met_does_nothing(self) -> None:
        state = make_state(
            today={"feed_posts": 1, "minutes_since_feed_post": 40,
                   "min_minutes_between_feed_posts": 180,
                   "stories": 5, "max_stories": 5},
            recent_posts=[post(40)],
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertFalse(verdict.needs_reasoning)

    def test_a_free_story_slot_alone_does_not_wake_the_model(self) -> None:
        """Five stories a day means a slot is nearly always free. Without
        story spacing that fact alone would buy a reasoning call on every
        single wake, all day."""
        state = make_state(
            today={"feed_posts": 2, "max_feed_posts": 2,
                   "stories": 1, "max_stories": 5, "minutes_since_story": 20},
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertFalse(verdict.needs_reasoning)

    def test_story_is_considered_when_the_feed_is_not_due(self) -> None:
        """A story does not bury a feed post, so a blocked feed is not a
        reason to rule one out."""
        state = make_state(
            today={"feed_posts": 2, "max_feed_posts": 2,
                   "stories": 0, "max_stories": 5, "minutes_since_story": None},
        )
        verdict = assess(state)
        self.assertTrue(verdict.needs_reasoning)
        self.assertIn(Decision.PUBLISH_STORY, verdict.allowed)
        self.assertNotIn(Decision.PUBLISH_TEXT_POST, verdict.allowed)

    def test_reason_is_specific_not_vague(self) -> None:
        """'Waiting' tells the owner nothing; the numbers tell them it works."""
        state = make_state(today={"feed_posts": 2, "max_feed_posts": 2,
                                  "stories": 5, "max_stories": 5})
        self.assertRegex(assess(state).reason, r"\d+/\d+")


# ===========================================================================
# Reasoning happens only when judgement is genuinely needed
# ===========================================================================
class WhenToThink(unittest.TestCase):
    def test_long_gap_with_quota_needs_reasoning(self) -> None:
        state = make_state(
            today={"feed_posts": 0, "minutes_since_feed_post": 400},
            recent_posts=[post(400)],
        )
        verdict = assess(state)
        self.assertTrue(verdict.needs_reasoning)
        self.assertIsNone(verdict.decision)
        self.assertIn(Decision.PUBLISH_IMAGE_POST, verdict.allowed)
        self.assertIn(Decision.DO_NOTHING, verdict.allowed,
                      "doing nothing must always remain available")

    def test_unanswered_comments_need_reasoning(self) -> None:
        state = make_state(
            today={"feed_posts": 2, "max_feed_posts": 2, "stories": 5,
                   "max_stories": 5},
            unanswered_comments=[comment()],
        )
        verdict = assess(state)
        self.assertTrue(verdict.needs_reasoning)
        self.assertIn(Decision.REPLY_TO_COMMENTS, verdict.allowed)

    def test_ignored_and_answered_comments_do_not_wake_reasoning(self) -> None:
        """Only genuinely pending comments count."""
        state = make_state(
            today={"feed_posts": 2, "max_feed_posts": 2, "stories": 5,
                   "max_stories": 5},
            unanswered_comments=[comment(replied=True), comment(9, action="ignore")],
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertFalse(verdict.needs_reasoning)

    def test_options_exclude_what_is_not_permitted(self) -> None:
        """The model is never offered a choice the rules already refused."""
        state = make_state(
            today={"feed_posts": 0, "image_posts": 2, "max_image_posts": 2,
                   "minutes_since_feed_post": 400},
        )
        verdict = assess(state)
        self.assertTrue(verdict.needs_reasoning)
        self.assertNotIn(Decision.PUBLISH_IMAGE_POST, verdict.allowed)
        self.assertIn(Decision.PUBLISH_TEXT_POST, verdict.allowed)


# ===========================================================================
# Capabilities gate decisions before any work happens
# ===========================================================================
class Capabilities(unittest.TestCase):
    def test_cannot_reply_without_manage_engagement(self) -> None:
        limited = caps.detect(
            granted_scopes=["pages_show_list", "pages_read_engagement",
                            "pages_manage_posts"],
            page_tasks=["CREATE_CONTENT"],
        )
        state = make_state(
            capabilities=limited,
            today={"feed_posts": 2, "max_feed_posts": 2, "stories": 5,
                   "max_stories": 5},
            unanswered_comments=[comment()],
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertIn("pages_manage_engagement", verdict.reason)

    def test_no_permissions_at_all_is_flagged(self) -> None:
        state = make_state(capabilities=caps.detect(granted_scopes=[], page_tasks=[]))
        self.assertIs(assess(state).decision, Decision.FLAG_FOR_REVIEW)

    def test_broken_connection_is_flagged_not_retried(self) -> None:
        state = make_state(connection_status="token_invalid")
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.FLAG_FOR_REVIEW)
        self.assertFalse(verdict.needs_reasoning)


# ===========================================================================
# Rate-limit backoff
# ===========================================================================
class Cooldowns(unittest.TestCase):
    def test_cooldown_suppresses_the_action(self) -> None:
        state = make_state(
            today={"feed_posts": 0, "minutes_since_feed_post": 400},
            cooling_down={
                "publish_text_post": now() + timedelta(minutes=30),
                "publish_image_post": now() + timedelta(minutes=30),
                "publish_story": now() + timedelta(minutes=30),
            },
        )
        verdict = assess(state)
        self.assertIs(verdict.decision, Decision.DO_NOTHING)
        self.assertIn("rate limit", verdict.reason.lower())

    def test_expired_cooldown_is_ignored(self) -> None:
        state = make_state(
            today={"feed_posts": 0, "minutes_since_feed_post": 400},
            cooling_down={"publish_image_post": now() - timedelta(minutes=5)},
        )
        self.assertTrue(assess(state).needs_reasoning)


# ===========================================================================
# validate() — the model proposes, the rules dispose
# ===========================================================================
class Validation(unittest.TestCase):
    def test_a_decision_outside_the_offered_set_is_refused(self) -> None:
        state = make_state(today={"feed_posts": 0, "minutes_since_feed_post": 400})
        refusal = validate(Decision.PUBLISH_STORY, state,
                           frozenset({Decision.PUBLISH_TEXT_POST}))
        self.assertIsNotNone(refusal)

    def test_limits_are_rechecked_at_execution_time(self) -> None:
        """A concurrent run may have published since the prompt was built."""
        state = make_state(today={"feed_posts": 2, "max_feed_posts": 2})
        refusal = validate(Decision.PUBLISH_TEXT_POST, state,
                           frozenset({Decision.PUBLISH_TEXT_POST}))
        self.assertIsNotNone(refusal)
        self.assertIn("2/2", refusal)

    def test_emergency_stop_refuses_an_already_made_decision(self) -> None:
        """Hit mid-run, the stop must take effect before anything publishes."""
        state = make_state(emergency_stopped=True,
                           today={"feed_posts": 0, "minutes_since_feed_post": 400})
        refusal = validate(Decision.PUBLISH_IMAGE_POST, state,
                           frozenset({Decision.PUBLISH_IMAGE_POST}))
        self.assertIsNotNone(refusal)
        self.assertIn("emergency", refusal.lower())

    def test_spacing_is_rechecked(self) -> None:
        state = make_state(today={"feed_posts": 1, "minutes_since_feed_post": 10,
                                  "min_minutes_between_feed_posts": 180})
        self.assertIsNotNone(
            validate(Decision.PUBLISH_TEXT_POST, state,
                     frozenset({Decision.PUBLISH_TEXT_POST}))
        )

    def test_image_limit_is_separate_from_feed_limit(self) -> None:
        state = make_state(today={"feed_posts": 1, "max_feed_posts": 4,
                                  "image_posts": 2, "max_image_posts": 2,
                                  "minutes_since_feed_post": 400})
        self.assertIsNotNone(
            validate(Decision.PUBLISH_IMAGE_POST, state,
                     frozenset({Decision.PUBLISH_IMAGE_POST}))
        )
        self.assertIsNone(
            validate(Decision.PUBLISH_TEXT_POST, state,
                     frozenset({Decision.PUBLISH_TEXT_POST})),
            "a text post is still allowed when only the image limit is spent",
        )

    def test_a_permitted_decision_passes(self) -> None:
        state = make_state(today={"feed_posts": 0, "minutes_since_feed_post": 400})
        self.assertIsNone(
            validate(Decision.PUBLISH_IMAGE_POST, state,
                     frozenset({Decision.PUBLISH_IMAGE_POST}))
        )


# ===========================================================================
# The state object must never carry a credential
# ===========================================================================
class NoSecrets(unittest.TestCase):
    def test_model_payload_contains_no_token_field(self) -> None:
        state = make_state(recent_posts=[post(60)],
                           unanswered_comments=[comment()])
        blob = repr(state.for_model()).lower()
        for forbidden in ("token", "secret", "access_token", "appsecret",
                          "password", "bearer"):
            self.assertNotIn(forbidden, blob,
                             f"{forbidden!r} reached the model payload")

    def test_stored_observation_contains_no_token_field(self) -> None:
        state = make_state(recent_posts=[post(60)])
        blob = repr(state.to_dict()).lower()
        for forbidden in ("access_token", "appsecret", "secret", "bearer"):
            self.assertNotIn(forbidden, blob)

    def test_reels_are_not_a_possible_decision(self) -> None:
        """Reels are a later phase; the enum is what keeps them out."""
        values = {d.value for d in Decision}
        for forbidden in ("publish_reel", "generate_reel", "schedule_reel"):
            self.assertNotIn(forbidden, values)


if __name__ == "__main__":
    unittest.main(verbosity=2)
