"""Tests for the learning step.

Learning is the part most likely to go wrong quietly. A bug here does not
crash anything — it just steers the Page somewhere nobody chose, one small
adjustment at a time, and by the time it is noticeable the cause is weeks in
the past.

So the properties worth pinning down are the restraints:

  * a small sample changes nothing
  * one good post cannot rewrite the strategy
  * no content type is ever driven to zero, because a type with no posts
    stops producing evidence about itself and could never recover
  * the mix always sums to 100

Pure arithmetic — no network, no database, no AI.

    cd apps/api && python -m tests.test_agent_evaluator
"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.facebook_agent.evaluator import (  # noqa: E402
    MAX_MIX_SHIFT, MIN_MIX_SHARE, MIN_SAMPLE_FOR_LEARNING,
    _normalise_mix, _type_scores,
)


class NormaliseMix(unittest.TestCase):
    def test_always_sums_to_100(self) -> None:
        for mix in (
            {"text": 25, "image": 50, "story": 25},
            {"text": 33, "image": 33, "story": 33},
            {"text": 1, "image": 1, "story": 1},
            {"text": 90, "image": 90, "story": 90},
            {"text": 0, "image": 0, "story": 100},
        ):
            with self.subTest(mix=mix):
                self.assertEqual(sum(_normalise_mix(mix).values()), 100)

    def test_no_type_is_driven_to_zero(self) -> None:
        """A type with no posts stops generating evidence about itself."""
        result = _normalise_mix({"text": 0, "image": 100, "story": 0})
        for key, value in result.items():
            self.assertGreaterEqual(value, MIN_MIX_SHARE - 1,
                                    f"{key} was squeezed out entirely")

    def test_proportions_are_preserved(self) -> None:
        result = _normalise_mix({"text": 20, "image": 40, "story": 20})
        self.assertGreater(result["image"], result["text"])

    def test_missing_keys_do_not_crash(self) -> None:
        result = _normalise_mix({"image": 100})
        self.assertEqual(sum(result.values()), 100)
        self.assertIn("text", result)


class TypeScores(unittest.TestCase):
    def test_maps_post_types_to_mix_keys(self) -> None:
        rows = [
            {"post_type": "photo", "avg_engagement": 40},
            {"post_type": "text", "avg_engagement": 10},
        ]
        scores = _type_scores(rows)
        self.assertEqual(scores["image"], 40)
        self.assertEqual(scores["text"], 10)

    def test_averages_across_topics_of_the_same_type(self) -> None:
        rows = [
            {"post_type": "photo", "avg_engagement": 30},
            {"post_type": "photo", "avg_engagement": 50},
        ]
        self.assertEqual(_type_scores(rows)["image"], 40)

    def test_unknown_types_are_ignored(self) -> None:
        """Reels are not part of this phase and must not influence learning."""
        rows = [
            {"post_type": "reel", "avg_engagement": 999},
            {"post_type": "text", "avg_engagement": 10},
        ]
        scores = _type_scores(rows)
        self.assertNotIn("reel", scores)
        self.assertEqual(list(scores), ["text"])

    def test_empty_input(self) -> None:
        self.assertEqual(_type_scores([]), {})


class ShiftArithmetic(unittest.TestCase):
    """The shift calculation, mirrored from evaluate().

    Kept as arithmetic here so the restraint properties can be checked without
    a database. evaluate() itself is exercised against real tables in
    tests/db/02_facebook_agent_test.sql.
    """

    @staticmethod
    def shift_for(best_score: float, worst_score: float) -> int:
        if best_score == worst_score or worst_score <= 0:
            return 0
        advantage = (best_score - worst_score) / max(worst_score, 1.0)
        return int(min(MAX_MIX_SHIFT, round(advantage * MAX_MIX_SHIFT)))

    def test_a_modest_difference_moves_a_little(self) -> None:
        self.assertLessEqual(self.shift_for(12, 10), 3)

    def test_an_enormous_difference_is_still_capped(self) -> None:
        """One viral post must not turn the Page into a monoculture."""
        self.assertEqual(self.shift_for(10_000, 1), MAX_MIX_SHIFT)

    def test_equal_performance_moves_nothing(self) -> None:
        self.assertEqual(self.shift_for(25, 25), 0)

    def test_zero_baseline_does_not_divide_by_zero(self) -> None:
        self.assertEqual(self.shift_for(50, 0), 0)

    def test_one_shift_cannot_empty_a_type(self) -> None:
        """Even the maximum shift leaves the weaker type above the floor."""
        mix = {"text": 25, "image": 50, "story": 25}
        shift = min(MAX_MIX_SHIFT, max(0, mix["text"] - MIN_MIX_SHARE))
        after = _normalise_mix({**mix, "text": mix["text"] - shift,
                                "image": mix["image"] + shift})
        self.assertGreaterEqual(after["text"], MIN_MIX_SHARE - 1)
        self.assertEqual(sum(after.values()), 100)


class Restraint(unittest.TestCase):
    def test_learning_threshold_is_not_trivially_small(self) -> None:
        """Two posts is an anecdote. The threshold must be meaningfully above it."""
        self.assertGreaterEqual(MIN_SAMPLE_FOR_LEARNING, 5)

    def test_a_single_evaluation_cannot_swing_the_mix_wildly(self) -> None:
        self.assertLessEqual(MAX_MIX_SHIFT, 20)


if __name__ == "__main__":
    unittest.main(verbosity=2)
