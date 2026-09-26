"""Tests for the Facebook OAuth dialog URL.

Facebook Login for Business wants a configuration ID (config_id) in place of
the scope list — Meta's docs: "scope can still be included, [but] we recommend
that you do not use it". These pin both modes, and that the state and redirect
survive encoding untouched, since a mangled redirect_uri fails at Facebook's
last step with a message that does not say why.

No network. Run:

    cd apps/api && python -m tests.test_facebook_connect
"""
from __future__ import annotations

import sys
import unittest
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402
from app.errors import AppError  # noqa: E402
from app.routers.facebook import choose_page, dialog_url  # noqa: E402
from app.services.facebook import capabilities as caps  # noqa: E402


def settings(**overrides) -> Settings:
    base = {"meta_app_id": "123", "meta_app_secret": "s",
            "meta_redirect_uri": "https://pickixo.com/api/facebook/callback",
            "facebook_token_key": "k"}
    base.update(overrides)
    return Settings(_env_file=None, **base)


def parse(url: str) -> tuple[urllib.parse.SplitResult, dict[str, str]]:
    parts = urllib.parse.urlsplit(url)
    return parts, dict(urllib.parse.parse_qsl(parts.query))


class DialogUrl(unittest.TestCase):
    def test_without_a_configuration_the_scope_list_is_sent(self) -> None:
        parts, query = parse(dialog_url(settings(), "st.ate"))
        self.assertEqual(parts.netloc, "www.facebook.com")
        self.assertEqual(parts.path, "/v25.0/dialog/oauth")
        self.assertEqual(query["scope"], ",".join(caps.REQUESTED_SCOPES))
        self.assertNotIn("config_id", query)

    def test_a_configuration_replaces_scope(self) -> None:
        _, query = parse(dialog_url(settings(meta_login_config_id="987654"), "st.ate"))
        self.assertEqual(query["config_id"], "987654")
        self.assertNotIn("scope", query, "Meta recommends not sending both")

    def test_common_parameters_survive_encoding(self) -> None:
        for config in ("", "987654"):
            with self.subTest(config=config or "scope"):
                _, query = parse(dialog_url(settings(meta_login_config_id=config),
                                            "abc-_.XYZ"))
                self.assertEqual(query["client_id"], "123")
                self.assertEqual(query["redirect_uri"],
                                 "https://pickixo.com/api/facebook/callback")
                self.assertEqual(query["state"], "abc-_.XYZ")
                self.assertEqual(query["response_type"], "code")

    def test_the_secret_is_never_in_the_url(self) -> None:
        url = dialog_url(settings(meta_app_secret="TOPSECRET"), "x")
        self.assertNotIn("TOPSECRET", url)


WRONG = {"id": "1343283272196050", "name": "অজানার জানালা", "access_token": "PAGE-TOKEN-ONE"}
RIGHT = {"id": "853404874517675", "name": "The World Frame", "access_token": "PAGE-TOKEN-TWO"}


class ChoosePage(unittest.TestCase):
    """The incident this exists for: an account running two Pages, the other
    one listed first, and the first one being taken."""

    def test_the_configured_page_is_taken_even_when_listed_second(self) -> None:
        self.assertIs(choose_page([WRONG, RIGHT], RIGHT["id"]), RIGHT)

    def test_a_configured_page_that_was_not_granted_is_refused(self) -> None:
        with self.assertRaises(AppError) as ctx:
            choose_page([WRONG], RIGHT["id"])
        detail = ctx.exception.detail
        self.assertIn(RIGHT["id"], detail)
        self.assertIn("অজানার জানালা (1343283272196050)", detail,
                      "the refusal says what was granted instead")

    def test_several_pages_and_no_configuration_is_refused(self) -> None:
        with self.assertRaises(AppError) as ctx:
            choose_page([WRONG, RIGHT], "")
        self.assertIn("FACEBOOK_PAGE_ID", ctx.exception.detail)
        self.assertIn("The World Frame (853404874517675)", ctx.exception.detail)

    def test_a_single_page_needs_no_configuration(self) -> None:
        self.assertIs(choose_page([RIGHT], ""), RIGHT)

    def test_no_pages_is_refused(self) -> None:
        with self.assertRaises(AppError):
            choose_page([], RIGHT["id"])

    def test_ids_compare_as_strings(self) -> None:
        """Graph returns ids as strings; a numeric one must still match."""
        self.assertIs(choose_page([WRONG, {**RIGHT, "id": 853404874517675}],
                                  "853404874517675")["name"], "The World Frame")

    def test_no_token_leaks_into_a_refusal(self) -> None:
        with self.assertRaises(AppError) as ctx:
            choose_page([WRONG, RIGHT], "")
        self.assertNotIn("PAGE-TOKEN", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main(verbosity=2)
