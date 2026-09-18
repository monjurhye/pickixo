"""Behavioural tests for the shared OpenAI-compatible text adapter.

Runs on the standard library alone (no pytest), matching the other suites, so
it works on a bare VPS with nothing installed but Python and httpx.

    python3 -m tests.test_openai_compatible

What matters here is not that a happy path works, but that every *failure*
maps to the right ProviderFailure — that mapping is what decides whether the
manager fails over to the next free provider, retries, or stops. Getting it
wrong silently strands users on an exhausted provider.
"""
from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.providers import http as provider_http
from app.providers.base import ProviderError, ProviderFailure, TextRequest
from app.providers.registry import build_text_manager
from app.providers.text.openai_compatible import OpenAICompatibleTextProvider

ENDPOINT = "https://example.invalid/v1/chat/completions"
REQUEST = TextRequest(prompt="write something")


def make(**overrides) -> OpenAICompatibleTextProvider:
    kwargs = dict(
        slug="testp",
        display_name="Test Provider",
        endpoint=ENDPOINT,
        api_key="test-key",
        model="test-model",
        enabled=True,
    )
    kwargs.update(overrides)
    return OpenAICompatibleTextProvider(**kwargs)


def serve(handler) -> None:
    """Point the shared pooled client at a mock transport."""
    if callable(handler):
        transport = httpx.MockTransport(handler)
    else:
        transport = httpx.MockTransport(lambda request: handler)
    provider_http._client = httpx.AsyncClient(transport=transport)


def ok(content) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


class ResponseParsing(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        provider_http._client = None

    async def test_plain_string_content_is_returned_stripped(self):
        serve(httpx.Response(200, json={
            "choices": [{"message": {"content": "  Hello  "}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 11, "completion_tokens": 4},
        }))
        result = await make().generate(REQUEST)
        self.assertEqual(result.text, "Hello")
        self.assertEqual(result.tokens_in, 11)
        self.assertEqual(result.tokens_out, 4)
        self.assertEqual(result.provider, "testp")

    async def test_multipart_array_content_is_joined(self):
        # Some gateways return content as an array of parts rather than a
        # string. Treating that as a string raises AttributeError.
        serve(httpx.Response(200, json={"choices": [{"message": {"content": [
            {"type": "text", "text": "part one "},
            {"type": "text", "text": "part two"},
        ]}}]}))
        self.assertEqual((await make().generate(REQUEST)).text, "part one part two")

    async def test_reasoning_content_is_used_when_content_is_empty(self):
        serve(httpx.Response(200, json={"choices": [
            {"message": {"content": "", "reasoning_content": "the answer"}}]}))
        self.assertEqual((await make().generate(REQUEST)).text, "the answer")

    async def test_blank_completion_is_an_error_not_an_empty_post(self):
        serve(ok("   "))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.UPSTREAM_ERROR)

    async def test_missing_choices_is_an_error(self):
        serve(httpx.Response(200, json={"choices": []}))
        with self.assertRaises(ProviderError):
            await make().generate(REQUEST)

    async def test_non_json_body_does_not_crash(self):
        serve(httpx.Response(200, text="<html>502 from a proxy</html>"))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.UPSTREAM_ERROR)

    async def test_error_object_inside_a_200_is_not_treated_as_success(self):
        # OpenRouter and NVIDIA both answer 200 with an error object when a
        # free model is out of quota.
        serve(httpx.Response(200, json={"error": {"message": "rate limit"}}))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.UPSTREAM_ERROR)


class FailureMapping(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        provider_http._client = None

    async def test_429_is_rate_limited_and_retry_after_is_parsed(self):
        serve(httpx.Response(429, text="slow down", headers={"retry-after": "30"}))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.RATE_LIMITED)
        self.assertEqual(ctx.exception.retry_after_seconds, 30)

    async def test_402_is_quota_exhausted(self):
        serve(httpx.Response(402, text="payment required"))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.QUOTA_EXHAUSTED)

    async def test_401_reads_as_not_configured(self):
        serve(httpx.Response(401, text="bad key"))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.NOT_CONFIGURED)

    async def test_content_filter_does_not_fail_over(self):
        serve(httpx.Response(200, json={"choices": [
            {"message": {"content": ""}, "finish_reason": "content_filter"}]}))
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.CONTENT_BLOCKED)

    async def test_timeout_is_retryable(self):
        def explode(request):
            raise httpx.ConnectTimeout("timed out")
        serve(explode)
        with self.assertRaises(ProviderError) as ctx:
            await make().generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.TIMEOUT)

    async def test_missing_key_is_skipped_without_a_network_call(self):
        def explode(request):
            raise AssertionError("an unconfigured provider must not be called")
        serve(explode)
        provider = make(api_key="")
        self.assertFalse(provider.is_configured)
        with self.assertRaises(ProviderError) as ctx:
            await provider.generate(REQUEST)
        self.assertIs(ctx.exception.failure, ProviderFailure.NOT_CONFIGURED)

    async def test_secrets_never_appear_in_the_error_detail(self):
        serve(httpx.Response(500, text="upstream exploded"))
        with self.assertRaises(ProviderError) as ctx:
            await make(api_key="sk-super-secret").generate(REQUEST)
        self.assertNotIn("sk-super-secret", str(ctx.exception))


class RequestShape(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.seen = {}

        def capture(request):
            self.seen.update(json.loads(request.content))
            self.seen["_headers"] = dict(request.headers)
            return ok("fine")

        serve(capture)

    def tearDown(self):
        provider_http._client = None

    async def test_max_tokens_is_the_default_spelling(self):
        await make().generate(REQUEST)
        self.assertIn("max_tokens", self.seen)
        self.assertNotIn("max_completion_tokens", self.seen)

    async def test_max_completion_tokens_when_requested(self):
        await make(token_param="max_completion_tokens").generate(REQUEST)
        self.assertIn("max_completion_tokens", self.seen)
        self.assertNotIn("max_tokens", self.seen)

    async def test_temperature_can_be_suppressed(self):
        await make(supports_temperature=False).generate(REQUEST)
        self.assertNotIn("temperature", self.seen)

    async def test_bearer_token_and_extra_headers_are_sent(self):
        await make(extra_headers={"X-Title": "Pickixo"}).generate(REQUEST)
        self.assertEqual(self.seen["_headers"]["authorization"], "Bearer test-key")
        self.assertEqual(self.seen["_headers"]["x-title"], "Pickixo")

    async def test_system_prompt_is_the_shared_one(self):
        await make().generate(TextRequest(prompt="hi", language="bn"))
        system = self.seen["messages"][0]
        self.assertEqual(system["role"], "system")
        self.assertIn("Bengali", system["content"])


class RegistryWiring(unittest.TestCase):
    """The chain must stay coherent: every name in the priority list has to
    resolve to a registered provider, or that entry silently does nothing."""

    def setUp(self):
        self.settings = Settings(_env_file=None)
        self.slugs = [e["slug"] for e in build_text_manager(self.settings).describe()]

    def test_every_priority_entry_resolves_to_a_provider(self):
        orphans = [p for p in self.settings.text_priority if p not in self.slugs]
        self.assertEqual(orphans, [], f"priority names with no provider: {orphans}")

    def test_free_tier_bench_is_registered(self):
        for slug in ("groq", "cerebras", "openrouter", "mistral", "nvidia_nim"):
            self.assertIn(slug, self.slugs)

    def test_github_models_is_not_registered(self):
        # Retired 2026-07-30; its endpoint no longer answers.
        self.assertNotIn("github_models", self.slugs)

    def test_groq_is_still_first(self):
        self.assertEqual(self.settings.text_priority[0], "groq")

    def test_new_providers_ship_disabled_and_unconfigured(self):
        entries = build_text_manager(self.settings).describe()
        for entry in entries:
            if entry["slug"] in ("cerebras", "openrouter", "mistral", "nvidia_nim"):
                self.assertFalse(entry["enabled"], f"{entry['slug']} enabled by default")
                self.assertFalse(entry["configured"], f"{entry['slug']} configured by default")


if __name__ == "__main__":
    unittest.main(verbosity=2)
