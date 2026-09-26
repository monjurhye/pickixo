"""Tests for the Groq provider's handling of the monthly spend limit.

Once the organisation's spend limit is reached, Groq answers every call with
HTTP 400 and error code `blocked_api_access` (console.groq.com/docs/spend-limits).
Read as a plain 400 that is BAD_REQUEST, which the provider manager never
fails over — so the agent would stop dead on the one day the fallback exists
for. These pin it as QUOTA_EXHAUSTED, and check end to end that the manager
then gets its answer from the next provider.

No network. Run:

    cd apps/api && python -m tests.test_groq_provider
"""
from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.providers import http as provider_http  # noqa: E402
from app.providers.base import (  # noqa: E402
    ProviderError, ProviderFailure, TextProvider, TextRequest, TextResult,
)
from app.providers.manager import ProviderManager  # noqa: E402
from app.providers.text.groq_provider import GroqTextProvider  # noqa: E402

BLOCKED = {"error": {"message": "Organization has been restricted: spend limit reached.",
                     "type": "invalid_request_error", "code": "blocked_api_access"}}


def use(handler) -> None:
    provider_http._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))


class Backup(TextProvider):
    """Stands in for the Claude fallback."""
    slug = "anthropic"
    display_name = "Backup"
    calls = 0

    @property
    def is_configured(self) -> bool:
        return True

    @property
    def is_enabled(self) -> bool:
        return True

    async def generate(self, request: TextRequest) -> TextResult:
        type(self).calls += 1
        return TextResult(text="from the backup", provider=self.slug, model="m")


class SpendLimit(unittest.TestCase):
    def tearDown(self) -> None:
        provider_http._client = None

    def generate(self) -> TextResult:
        provider = GroqTextProvider("gsk-test", "openai/gpt-oss-120b", True)
        return asyncio.run(provider.generate(TextRequest(prompt="hi")))

    def test_blocked_api_access_is_quota_exhausted(self) -> None:
        use(lambda r: httpx.Response(400, json=BLOCKED))
        with self.assertRaises(ProviderError) as ctx:
            self.generate()
        self.assertIs(ctx.exception.failure, ProviderFailure.QUOTA_EXHAUSTED)
        self.assertIn("spend limit", ctx.exception.detail)

    def test_an_unstructured_body_is_still_recognised(self) -> None:
        use(lambda r: httpx.Response(400, text="error: blocked_api_access"))
        with self.assertRaises(ProviderError) as ctx:
            self.generate()
        self.assertIs(ctx.exception.failure, ProviderFailure.QUOTA_EXHAUSTED)

    def test_an_ordinary_400_is_still_a_bad_request(self) -> None:
        """Only the spend limit is reclassified. A real bad request must not
        fail over: the next provider would reject it the same way."""
        use(lambda r: httpx.Response(400, json={"error": {
            "message": "bad", "type": "invalid_request_error", "code": "invalid_value"}}))
        with self.assertRaises(ProviderError) as ctx:
            self.generate()
        self.assertIs(ctx.exception.failure, ProviderFailure.BAD_REQUEST)

    def test_the_manager_fails_over_to_the_next_provider(self) -> None:
        use(lambda r: httpx.Response(400, json=BLOCKED))
        Backup.calls = 0
        manager = ProviderManager(
            "text",
            [GroqTextProvider("gsk-test", "openai/gpt-oss-120b", True), Backup()],
            ["groq", "anthropic"],
        )
        request = TextRequest(prompt="hi")
        result = asyncio.run(manager.execute(lambda p: p.generate(request)))
        self.assertEqual(result.text, "from the backup")
        self.assertEqual(Backup.calls, 1)

        # And Groq is cooling down, so the next call goes straight to the
        # backup instead of paying a round trip to be refused again.
        groq = {e["slug"]: e for e in manager.describe()}["groq"]
        self.assertGreater(groq["cooldownRemainingSeconds"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
