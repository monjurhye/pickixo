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
from app.routers.facebook import dialog_url  # noqa: E402
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
