"""Tests for the Anthropic (Claude) text provider.

The real `anthropic` SDK runs against a mocked HTTP transport, so these check
both halves that matter: what goes over the wire, and how the SDK's typed
errors are mapped onto the failures the provider manager routes on. A wrong
mapping is silent in production — a 429 treated as "bad request" stops
failover; a 401 treated as "retry" burns calls on a dead key.

No network, no key, no cost. Run:

    cd apps/api && python -m tests.test_anthropic_provider
"""
from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import anthropic  # noqa: E402
import httpx2  # noqa: E402

from app.config import Settings  # noqa: E402
from app.providers.base import ProviderError, ProviderFailure, TextRequest  # noqa: E402
from app.providers.registry import build_text_manager  # noqa: E402
from app.providers.text.anthropic_provider import AnthropicTextProvider  # noqa: E402

MODEL = "claude-haiku-4-5"


def message(text: str = '{"ok": true}', stop_reason: str = "end_turn") -> dict:
    return {
        "id": "msg_test", "type": "message", "role": "assistant", "model": MODEL,
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": 321, "output_tokens": 45},
    }


def provider_for(handler, *, key: str = "sk-ant-test") -> AnthropicTextProvider:
    client = anthropic.AsyncAnthropic(
        api_key=key, max_retries=0,
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
    )
    return AnthropicTextProvider(key, MODEL, True, client=client)


def run(provider: AnthropicTextProvider, prompt: str = "hello"):
    return asyncio.run(provider.generate(TextRequest(prompt=prompt, max_output_tokens=500)))


def error_body(kind: str) -> dict:
    return {"type": "error", "error": {"type": kind, "message": "test"}}


class Success(unittest.TestCase):
    def test_request_shape_and_result(self) -> None:
        seen: dict = {}

        def handler(request: httpx2.Request) -> httpx2.Response:
            seen["url"] = str(request.url)
            seen["key"] = request.headers.get("x-api-key")
            seen["body"] = json.loads(request.content)
            return httpx2.Response(200, json=message())

        result = run(provider_for(handler), "write a caption")

        self.assertTrue(seen["url"].endswith("/v1/messages"))
        self.assertEqual(seen["key"], "sk-ant-test")
        body = seen["body"]
        self.assertEqual(body["model"], MODEL)
        self.assertEqual(body["max_tokens"], 500)
        self.assertEqual(body["messages"], [{"role": "user", "content": "write a caption"}])
        self.assertTrue(body["system"], "the shared system prompt is sent")
        # Nothing that would add cost or trip a newer model's validation.
        for absent in ("thinking", "temperature", "top_p", "top_k"):
            self.assertNotIn(absent, body)

        self.assertEqual(result.text, '{"ok": true}')
        self.assertEqual(result.provider, "anthropic")
        self.assertEqual((result.tokens_in, result.tokens_out), (321, 45))

    def test_text_blocks_are_joined(self) -> None:
        def handler(request):
            body = message()
            body["content"] = [{"type": "text", "text": "part one "},
                               {"type": "text", "text": "part two"}]
            return httpx2.Response(200, json=body)
        self.assertEqual(run(provider_for(handler)).text, "part one part two")


class Failures(unittest.TestCase):
    def assertFailure(self, handler, expected: ProviderFailure) -> ProviderError:
        with self.assertRaises(ProviderError) as ctx:
            run(provider_for(handler))
        self.assertIs(ctx.exception.failure, expected, ctx.exception)
        return ctx.exception

    def test_status_mapping(self) -> None:
        cases = [
            (429, "rate_limit_error", ProviderFailure.RATE_LIMITED),
            (401, "authentication_error", ProviderFailure.NOT_CONFIGURED),
            (403, "permission_error", ProviderFailure.QUOTA_EXHAUSTED),
            (400, "invalid_request_error", ProviderFailure.BAD_REQUEST),
            (404, "not_found_error", ProviderFailure.BAD_REQUEST),
            (500, "api_error", ProviderFailure.UPSTREAM_ERROR),
            (529, "overloaded_error", ProviderFailure.UPSTREAM_ERROR),
        ]
        for status, kind, expected in cases:
            with self.subTest(status=status):
                self.assertFailure(
                    lambda r, s=status, k=kind: httpx2.Response(s, json=error_body(k)),
                    expected,
                )

    def test_rate_limit_carries_retry_after(self) -> None:
        err = self.assertFailure(
            lambda r: httpx2.Response(429, json=error_body("rate_limit_error"),
                                      headers={"retry-after": "42"}),
            ProviderFailure.RATE_LIMITED,
        )
        self.assertEqual(err.retry_after_seconds, 42)

    def test_refusal_is_content_blocked(self) -> None:
        """Failing over a refusal to another vendor would be shopping for a
        yes; CONTENT_BLOCKED stops the manager doing that."""
        self.assertFailure(
            lambda r: httpx2.Response(200, json=message("", stop_reason="refusal")),
            ProviderFailure.CONTENT_BLOCKED,
        )

    def test_blank_completion_is_an_upstream_error(self) -> None:
        self.assertFailure(lambda r: httpx2.Response(200, json=message("   ")),
                           ProviderFailure.UPSTREAM_ERROR)

    def test_connection_failure(self) -> None:
        def handler(request):
            raise httpx2.ConnectError("refused", request=request)
        self.assertFailure(handler, ProviderFailure.UPSTREAM_ERROR)

    def test_the_key_never_appears_in_an_error(self) -> None:
        err = self.assertFailure(
            lambda r: httpx2.Response(401, json=error_body("authentication_error")),
            ProviderFailure.NOT_CONFIGURED,
        )
        self.assertNotIn("sk-ant-test", str(err))

    def test_no_key_never_calls_out(self) -> None:
        def handler(request):
            raise AssertionError("no request may be made without a key")
        provider = AnthropicTextProvider("", MODEL, True)
        self.assertFalse(provider.is_configured)
        with self.assertRaises(ProviderError) as ctx:
            run(provider)
        self.assertIs(ctx.exception.failure, ProviderFailure.NOT_CONFIGURED)


class Registry(unittest.TestCase):
    def test_second_after_groq_and_off_by_default(self) -> None:
        manager = build_text_manager(Settings(_env_file=None))
        entries = {e["slug"]: e for e in manager.describe()}
        self.assertIn("anthropic", entries)
        self.assertEqual(entries["anthropic"]["priority"], 2)
        self.assertEqual(entries["groq"]["priority"], 1)
        self.assertFalse(entries["anthropic"]["enabled"])
        self.assertFalse(entries["anthropic"]["configured"])

    def test_default_model_is_haiku(self) -> None:
        self.assertEqual(Settings(_env_file=None).anthropic_model, "claude-haiku-4-5")


if __name__ == "__main__":
    unittest.main(verbosity=2)
