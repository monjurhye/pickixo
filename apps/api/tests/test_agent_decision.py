"""Tests for parsing what the reasoning model sends back.

This is the boundary where model output stops being text and starts being
something that can publish to a real Facebook Page, so it is treated as
untrusted input — because that is exactly what it is. Comment text goes *into*
the prompt, which means anyone on the internet can write something intended to
steer the response.

No network and no AI: every test feeds a canned response through the parser.

    cd apps/api && python -m tests.test_agent_decision
"""
from __future__ import annotations

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.facebook_agent.decision import (  # noqa: E402
    DecisionParseError, apply_post_fact_check, extract_json,
    parse_comment_judgements, parse_decision, validate_quiz_caption,
)
from app.facebook_agent.policies import Decision  # noqa: E402

ALL = frozenset(Decision)
POSTING_ONLY = frozenset({Decision.PUBLISH_TEXT_POST, Decision.DO_NOTHING})


class ExtractJson(unittest.TestCase):
    def test_plain_object(self) -> None:
        self.assertEqual(extract_json('{"a": 1}'), {"a": 1})

    def test_fenced(self) -> None:
        self.assertEqual(extract_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(extract_json('```\n{"a": 1}\n```'), {"a": 1})

    def test_surrounded_by_prose(self) -> None:
        """Models add commentary however firmly they are told not to."""
        text = 'Sure! Here is my decision:\n{"a": 1}\nHope that helps.'
        self.assertEqual(extract_json(text), {"a": 1})

    def test_junk_is_refused_not_repaired(self) -> None:
        for bad in ("", "   ", "no json here", "{broken", "[1,2,3]", "null"):
            with self.subTest(bad=bad):
                with self.assertRaises(DecisionParseError):
                    extract_json(bad)


class ParseDecision(unittest.TestCase):
    def test_valid(self) -> None:
        result = parse_decision(
            {"decision": "publish_text_post", "reason": "nothing today",
             "confidence": 0.9, "topic": "Owl hearing", "animal": "owl"},
            POSTING_ONLY,
        )
        self.assertIs(result.decision, Decision.PUBLISH_TEXT_POST)
        self.assertEqual(result.animal, "owl")
        self.assertAlmostEqual(result.confidence, 0.9)

    def test_unknown_decision_is_refused(self) -> None:
        with self.assertRaises(DecisionParseError):
            parse_decision({"decision": "delete_the_page", "reason": "x"}, ALL)

    def test_a_reel_is_chosen_only_when_offered(self) -> None:
        """publish_reel is a real decision now — but only when the rules
        offered it, and the made-up variants are still refused."""
        chosen = parse_decision({"decision": "publish_reel", "reason": "x"}, ALL)
        self.assertIs(chosen.decision, Decision.PUBLISH_REEL)
        with self.assertRaises(DecisionParseError):
            parse_decision({"decision": "publish_reel", "reason": "x"}, POSTING_ONLY)
        for invented in ("generate_reel", "schedule_reel", "publish_video"):
            with self.subTest(reel=invented):
                with self.assertRaises(DecisionParseError):
                    parse_decision({"decision": invented, "reason": "x"}, ALL)

    def test_the_reel_step_appears_only_when_a_reel_is_allowed(self) -> None:
        from datetime import datetime, timezone
        from app.facebook_agent.decision import build_decision_prompt
        from app.facebook_agent.state import (
            AgentState, AutomationState, PageSnapshot, TodayActivity,
        )
        state = AgentState(
            page=PageSnapshot(name="X", page_id="1"),
            automation=AutomationState(enabled=True, mode="FULL_AUTO",
                                       connection_status="connected"),
            today=TodayActivity(),
            observed_at=datetime.now(timezone.utc),
        )
        with_reel = build_decision_prompt(
            state, frozenset({Decision.PUBLISH_REEL, Decision.DO_NOTHING}))
        self.assertIn("If you choose publish_reel", with_reel)

    def test_a_decision_not_offered_is_refused(self) -> None:
        """The limits already ruled this out before the prompt was built."""
        with self.assertRaises(DecisionParseError):
            parse_decision(
                {"decision": "publish_image_post", "reason": "x"}, POSTING_ONLY
            )

    def test_unparseable_confidence_is_not_certainty(self) -> None:
        result = parse_decision(
            {"decision": "do_nothing", "reason": "x", "confidence": "very high"},
            ALL,
        )
        self.assertEqual(result.confidence, 0.0)

    def test_confidence_is_clamped(self) -> None:
        for given, expected in ((5, 1.0), (-2, 0.0), (0.5, 0.5)):
            result = parse_decision(
                {"decision": "do_nothing", "reason": "x", "confidence": given}, ALL
            )
            self.assertEqual(result.confidence, expected)

    def test_wait_minutes_is_bounded(self) -> None:
        result = parse_decision(
            {"decision": "wait", "reason": "x", "wait_minutes": 999999}, ALL
        )
        self.assertLessEqual(result.wait_minutes, 720)

    def test_missing_reason_does_not_crash(self) -> None:
        result = parse_decision({"decision": "do_nothing"}, ALL)
        self.assertTrue(result.reason)


class CommentTriage(unittest.TestCase):
    KNOWN = {"c1", "c2", "c3"}

    def judge(self, entries: list[dict], *, min_confidence: float = 0.75):
        return parse_comment_judgements(
            {"judgements": entries}, known_ids=self.KNOWN,
            min_confidence=min_confidence,
        )

    def test_a_good_question_gets_a_reply(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "question", "action": "reply",
            "confidence": 0.9, "reply": "It is a snow leopard.",
        }])
        self.assertEqual(out[0].action, "reply")
        self.assertEqual(out[0].reply, "It is a snow leopard.")

    def test_judgement_for_an_unknown_comment_is_dropped(self) -> None:
        """The prompt-injection case.

        Comment text is written by the public and goes into the prompt. A
        response naming a comment we never asked about is either a
        hallucination or an injection trying to get a reply posted somewhere
        else — either way it must not reach the Graph API.
        """
        out = self.judge([
            {"comment_id": "not-ours", "classification": "question",
             "action": "reply", "confidence": 1.0, "reply": "pwned"},
            {"comment_id": "c1", "classification": "compliment",
             "action": "ignore", "confidence": 0.9},
        ])
        self.assertEqual([j.comment_id for j in out], ["c1"])

    def test_spam_is_always_ignored(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "spam", "action": "reply",
            "confidence": 1.0, "reply": "Thanks for your interest!",
        }])
        self.assertEqual(out[0].action, "ignore")
        self.assertIsNone(out[0].reply)

    def test_sensitive_is_flagged_never_answered(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "sensitive", "action": "reply",
            "confidence": 1.0, "reply": "Here is my view on that election.",
        }])
        self.assertEqual(out[0].action, "flag")
        self.assertIsNone(out[0].reply)

    def test_abuse_and_hate_are_ignored_not_engaged(self) -> None:
        for classification in ("abuse", "hate"):
            with self.subTest(classification=classification):
                out = self.judge([{
                    "comment_id": "c1", "classification": classification,
                    "action": "reply", "confidence": 1.0, "reply": "How dare you",
                }])
                self.assertEqual(out[0].action, "ignore")
                self.assertIsNone(out[0].reply)

    def test_low_confidence_reply_is_downgraded(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "question", "action": "reply",
            "confidence": 0.4, "reply": "Probably a leopard?",
        }], min_confidence=0.75)
        self.assertEqual(out[0].action, "ignore")
        self.assertIsNone(out[0].reply)

    def test_reply_action_without_text_becomes_ignore(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "question", "action": "reply",
            "confidence": 0.95, "reply": None,
        }])
        self.assertEqual(out[0].action, "ignore")

    def test_unknown_classification_becomes_unclear_and_is_flagged(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "banana", "action": "reply",
            "confidence": 1.0, "reply": "sure",
        }])
        self.assertEqual(out[0].classification, "unclear")
        self.assertEqual(out[0].action, "flag")
        self.assertIsNone(out[0].reply)

    def test_unknown_action_becomes_ignore(self) -> None:
        out = self.judge([{
            "comment_id": "c1", "classification": "compliment",
            "action": "delete_everything", "confidence": 1.0,
        }])
        self.assertEqual(out[0].action, "ignore")

    def test_malformed_list_is_refused(self) -> None:
        with self.assertRaises(DecisionParseError):
            parse_comment_judgements({"judgements": "lots"},
                                     known_ids=self.KNOWN, min_confidence=0.7)

    def test_non_dict_entries_are_skipped(self) -> None:
        out = self.judge(["nonsense", {"comment_id": "c1",
                                       "classification": "compliment",
                                       "action": "ignore", "confidence": 0.9}])
        self.assertEqual(len(out), 1)


class PromptHygiene(unittest.TestCase):
    def test_decision_prompt_carries_no_secret(self) -> None:
        """Built from state.for_model(), which is an allowlist."""
        from datetime import datetime, timezone
        from app.facebook_agent.decision import build_decision_prompt
        from app.facebook_agent.state import (
            AgentState, AutomationState, PageSnapshot, TodayActivity,
        )

        state = AgentState(
            page=PageSnapshot(name="The World Frame", page_id="123"),
            automation=AutomationState(
                enabled=True, mode="FULL_AUTO",
                capabilities={"can_publish_posts": True},
                connection_status="connected",
            ),
            today=TodayActivity(),
            observed_at=datetime.now(timezone.utc),
        )
        prompt = build_decision_prompt(state, ALL).lower()
        for forbidden in ("access_token", "appsecret", "bearer", "secret",
                          "password", "eaag"):
            self.assertNotIn(forbidden, prompt)

    def test_decision_prompt_lists_only_allowed_options(self) -> None:
        from datetime import datetime, timezone
        from app.facebook_agent.decision import build_decision_prompt
        from app.facebook_agent.state import (
            AgentState, AutomationState, PageSnapshot, TodayActivity,
        )
        state = AgentState(
            page=PageSnapshot(name="X", page_id="1"),
            automation=AutomationState(enabled=True, mode="FULL_AUTO",
                                       connection_status="connected"),
            today=TodayActivity(),
            observed_at=datetime.now(timezone.utc),
        )
        prompt = build_decision_prompt(state, POSTING_ONLY)
        self.assertIn("publish_text_post", prompt)
        self.assertNotIn("publish_story", prompt)
        self.assertNotIn("reel", prompt.lower())


# ===========================================================================
# Quizzes: layout checked in code, content checked by a second call
# ===========================================================================
QUIZ = ("How many hearts does an octopus have?\n"
        "A) One\nB) Two\nC) Three\n"
        "Comment your answer 👇\n.\n.\n.\n.\n.\n"
        "✅ Answer: C) Three — two pump blood through the gills, one to the body.")


class QuizLayout(unittest.TestCase):
    def test_a_well_formed_quiz_passes(self) -> None:
        validate_quiz_caption(QUIZ)

    def test_layout_faults_are_refused(self) -> None:
        cases = {
            "missing option C": QUIZ.replace("C) Three\n", ""),
            "a fourth option": QUIZ.replace("C) Three\n", "C) Three\nD) Four\n"),
            "no answer line": QUIZ.split("✅")[0],
            "answer names no option": QUIZ.replace("Answer: C)", "Answer: D)"),
        }
        for name, caption in cases.items():
            with self.subTest(name):
                with self.assertRaises(DecisionParseError):
                    validate_quiz_caption(caption)


class PostFactCheck(unittest.TestCase):
    DRAFT = {"topic": "Octopus hearts", "animal": "octopus", "caption": QUIZ,
             "visual_prompt": "an octopus on a reef", "fact_check": ""}

    def test_ok_keeps_the_post(self) -> None:
        out = apply_post_fact_check(dict(self.DRAFT), {"verdict": "ok"}, quiz=True)
        self.assertEqual(out["caption"], QUIZ)
        self.assertIn("no issues", out["fact_check"])

    def test_fixed_replaces_caption_and_picture(self) -> None:
        """The picture fix is the point: a WHICH-animal quiz over a clear
        photo of the answer gets its image description rewritten."""
        fixed = QUIZ.replace("Answer: C)", "Answer: C)")
        out = apply_post_fact_check(dict(self.DRAFT), {
            "verdict": "fixed", "issues": ["image gave the answer away"],
            "caption": fixed, "visual_prompt": "extreme close-up of an octopus eye",
        }, quiz=True)
        self.assertEqual(out["visual_prompt"], "extreme close-up of an octopus eye")
        self.assertIn("gave the answer away", out["fact_check"])

    def test_reject_stops_the_post(self) -> None:
        with self.assertRaises(DecisionParseError) as ctx:
            apply_post_fact_check(dict(self.DRAFT), {
                "verdict": "reject", "issues": ["two options are arguably right"]},
                quiz=True)
        self.assertIn("arguably right", str(ctx.exception))

    def test_a_fix_that_breaks_the_quiz_is_refused(self) -> None:
        with self.assertRaises(DecisionParseError):
            apply_post_fact_check(dict(self.DRAFT), {
                "verdict": "fixed", "issues": ["x"],
                "caption": "How many hearts? Three."}, quiz=True)

    def test_no_verdict_is_not_a_pass(self) -> None:
        for payload in ({}, {"verdict": "looks fine"}):
            with self.assertRaises(DecisionParseError):
                apply_post_fact_check(dict(self.DRAFT), payload, quiz=True)


class DraftContentChecks(unittest.TestCase):
    def run_draft(self, replies: list[str], **kwargs) -> tuple[dict, list[str]]:
        import asyncio
        from datetime import datetime, timezone
        from app.facebook_agent import decision
        from app.facebook_agent.state import (
            AgentState, AutomationState, PageSnapshot, TodayActivity,
        )
        calls: list[str] = []

        async def fake(*, prompt, system, max_tokens, capability):
            calls.append(capability)
            return replies[len(calls) - 1]

        original = decision.ai_service.generate_for_system
        decision.ai_service.generate_for_system = fake
        try:
            state = AgentState(page=PageSnapshot(name="X", page_id="1"),
                               automation=AutomationState(), today=TodayActivity(),
                               observed_at=datetime.now(timezone.utc))
            draft = asyncio.run(decision.draft_content(state, topic=None, animal=None,
                                                       **kwargs))
        finally:
            decision.ai_service.generate_for_system = original
        return draft, calls

    def test_a_quiz_is_written_then_checked(self) -> None:
        written = json.dumps({"topic": "Octopus hearts", "animal": "octopus",
                              "caption": QUIZ, "visual_prompt": "an octopus"})
        draft, calls = self.run_draft([written, json.dumps({"verdict": "ok"})],
                                      want_image=True, quiz=True)
        self.assertEqual(calls, ["agent_content", "agent_fact_check"])
        self.assertIn("no issues", draft["fact_check"])

    def test_a_malformed_quiz_is_refused_before_the_check_is_paid_for(self) -> None:
        written = json.dumps({"topic": "t", "caption": "Guess the animal!",
                              "visual_prompt": "x"})
        with self.assertRaises(DecisionParseError):
            self.run_draft([written], want_image=True, quiz=True)

    def test_a_text_post_is_checked_too(self) -> None:
        written = json.dumps({"topic": "t", "caption": "Octopuses have three hearts."})
        _, calls = self.run_draft([written, json.dumps({"verdict": "ok"})],
                                  want_image=False)
        self.assertEqual(calls, ["agent_content", "agent_fact_check"])

    def test_a_story_has_no_caption_to_check(self) -> None:
        written = json.dumps({"topic": "t", "caption": "c", "visual_prompt": "v"})
        _, calls = self.run_draft([written], want_image=True, quiz=False)
        self.assertEqual(calls, ["agent_content"])


class AmericanAudience(unittest.TestCase):
    """Everything the Page says is for a US audience, in US units first."""

    def test_every_writing_prompt_asks_for_american_english(self) -> None:
        from app.facebook_agent import decision as d
        for name in ("_CONTENT_SYSTEM", "_REEL_SYSTEM", "_COMMENT_SYSTEM"):
            prompt = getattr(d, name)
            self.assertIn("American English", prompt, name)
            self.assertNotIn("commenter's language", prompt, name)

    def test_us_units_come_first(self) -> None:
        from app.facebook_agent import decision as d
        for name in ("_CONTENT_SYSTEM", "_REEL_SYSTEM"):
            prompt = getattr(d, name)
            self.assertIn("mph (80 km/h)", prompt, name)
            self.assertIn("pounds (180 kg)", prompt, name)
            self.assertNotIn("metres", prompt, name)

    def test_the_fact_checkers_check_the_units(self) -> None:
        from app.facebook_agent import decision as d
        for name in ("_FACT_SYSTEM", "_POST_FACT_SYSTEM"):
            self.assertIn("conversion", getattr(d, name), name)


if __name__ == "__main__":
    unittest.main(verbosity=2)
