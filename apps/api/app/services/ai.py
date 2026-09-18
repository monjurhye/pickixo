"""The Pickixo AI service: quota, routing, usage accounting.

The user-facing contract is one thing (§158): "Pickixo AI". Which vendor served
a request is an implementation detail that shows up in the admin panel and the
logs, never as a choice the user has to make.

The routing, retry, cooldown and failover behaviour all live in
providers/manager.py, which is covered by its own test suite. This module is the
part that is specific to Pickixo: taking a quota unit before the work, giving it
back if every provider failed, and writing the usage trail.
"""
from __future__ import annotations

import uuid
from typing import Any

from .. import db
from ..config import Settings
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..providers.base import TextRequest as ProviderTextRequest
from ..providers.manager import AttemptRecord, ProviderManager
from ..providers.base import (ImageRequest as ProviderImageRequest,
                              ImageResult as ProviderImageResult)
from ..providers.registry import build_image_manager, build_text_manager
from . import quota

log = get_logger(__name__)

_text_manager: ProviderManager | None = None
_image_manager: ProviderManager | None = None


def _usage_recorder(request_id: uuid.UUID, user_id: str | None, capability: str):
    """Build the callback the manager hands every attempt to.

    Attempt number and fallback_used are derived from a counter rather than
    passed in, so the chain in `ai_usage` reads in order even when several
    providers were tried.
    """
    state = {"attempt": 0}

    async def record(rec: AttemptRecord) -> None:
        state["attempt"] += 1
        try:
            await db.execute(
                """
                INSERT INTO ai_usage
                    (request_id, user_id, capability, provider, model, attempt,
                     fallback_used, status, failure_reason,
                     input_tokens, output_tokens, latency_ms)
                VALUES (%s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(request_id), user_id, capability, rec.provider_slug,
                    state["attempt"], state["attempt"] > 1,
                    "success" if rec.success else "failure",
                    rec.error_code, rec.tokens_in, rec.tokens_out, rec.latency_ms,
                ),
            )
        except Exception:  # noqa: BLE001 — accounting must never fail a request
            log.exception("ai.usage_record_failed")

    return record


def init_managers(settings: Settings) -> None:
    """Build the provider managers once, at startup."""
    global _text_manager, _image_manager
    _text_manager = build_text_manager(settings)
    _image_manager = build_image_manager(settings)


def providers_ready() -> int:
    """How many providers are both enabled and hold a key.

    Reported honestly on the health endpoint: zero is the correct answer on a
    fresh install, and the UI says AI is unavailable rather than letting a user
    type a prompt that cannot possibly be answered (§123).
    """
    total = 0
    for manager in (_text_manager, _image_manager):
        if manager is None:
            continue
        total += sum(
            1 for entry in manager.describe()
            if entry.get("enabled") and entry.get("configured")
        )
    return total


def describe_providers() -> list[dict]:
    out: list[dict] = []
    for kind, manager in (("text", _text_manager), ("image", _image_manager)):
        if manager is None:
            continue
        for entry in manager.describe():
            out.append({**entry, "kind": kind})
    return out


async def generate_text(
    *,
    prompt: str,
    system: str | None,
    locale: str,
    max_tokens: int,
    user_id: str | None,
    guest_key: bytes | None,
    settings: Settings,
) -> dict[str, Any]:
    if _text_manager is None:
        raise AppError(ErrorCode.PROVIDER_NOT_CONFIGURED, detail="managers not built")

    if not _text_manager.has_usable_provider:
        # Nothing is enabled and configured. Say so now rather than walking the
        # whole priority list to discover it, and do not spend the user's quota.
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="no text provider is both enabled and configured",
        )

    request_id = uuid.uuid4()
    await quota.consume(
        user_id=user_id, guest_key=guest_key, kind="text", settings=settings
    )

    provider_request = ProviderTextRequest(
        prompt=prompt if not system else f"{system}\n\n{prompt}",
        content_type="assistant",
        language="bn" if locale == "bn" else "en",
        max_output_tokens=max_tokens,
    )

    try:
        result = await _text_manager.execute(
            lambda provider: provider.generate(provider_request),
            user_id=user_id,
            # Per call, not per manager: the manager is shared by every request
            # in flight, so assigning a recorder to it would cross-contaminate
            # two users' accounting.
            usage_recorder=_usage_recorder(request_id, user_id, "text"),
        )
    except AppError:
        # Every provider failed. That is our outage, not the user's mistake, so
        # the quota unit goes back (§40).
        await quota.refund(user_id=user_id, guest_key=guest_key, kind="text")
        raise

    await db.execute(
        "UPDATE ai_usage SET model = %s WHERE request_id = %s AND status = 'success'",
        (result.model, str(request_id)),
    )

    attempts = await db.fetch_value(
        "SELECT count(*) FROM ai_usage WHERE request_id = %s", (str(request_id),)
    )

    return {
        "content": result.text,
        "provider": result.provider,
        "model": result.model,
        "usage": {"input_tokens": result.tokens_in,
                  "output_tokens": result.tokens_out},
        "latency_ms": result.latency_ms,
        "fallback_used": bool(attempts and attempts > 1),
        "request_id": request_id,
    }


# ---------------------------------------------------------------------------
# System generation — for background workers, not for users
# ---------------------------------------------------------------------------
async def generate_for_system(
    *,
    prompt: str,
    system: str | None = None,
    max_tokens: int = 900,
    capability: str = "agent",
) -> str:
    """Run a text generation on the application's own behalf.

    Deliberately separate from generate_text():

    * **No quota.** The Facebook agent is not a visitor. Charging its thinking
      to a person's daily allowance would mean the agent could exhaust the
      owner's quota overnight and lock them out of the tools they pay nothing
      for. Its spending is bounded by how often it is *allowed to think*, which
      policies.py controls, not by a counter.

    * **No guest key.** There is no IP and no session behind this call.

    It still goes through the provider manager, so it inherits priority,
    cooldown and failover exactly like a user request, and it still records
    usage so the cost is attributable.
    """
    if _text_manager is None or not _text_manager.has_usable_provider:
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="no text provider is both enabled and configured",
        )

    request_id = uuid.uuid4()
    provider_request = ProviderTextRequest(
        prompt=prompt if not system else f"{system}\n\n{prompt}",
        content_type="custom",
        language="en",
        max_output_tokens=max_tokens,
    )
    result = await _text_manager.execute(
        lambda provider: provider.generate(provider_request),
        user_id=None,
        usage_recorder=_usage_recorder(request_id, None, capability),
    )
    return result.text


async def generate_image_for_system(
    *,
    prompt: str,
    aspect_ratio: str = "1:1",
    negative_prompt: str | None = None,
) -> "ProviderImageResult":
    """Generate an image on the application's own behalf.

    The image manager was already built at startup but had no caller until the
    Facebook agent needed one — image generation existed at the provider layer
    and stopped there.
    """
    if _image_manager is None or not _image_manager.has_usable_provider:
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="no image provider is both enabled and configured",
        )

    request_id = uuid.uuid4()
    provider_request = ProviderImageRequest(
        prompt=prompt,
        negative_prompt=negative_prompt,
        aspect_ratio=aspect_ratio,
    )
    return await _image_manager.execute(
        lambda provider: provider.generate(provider_request),
        user_id=None,
        usage_recorder=_usage_recorder(request_id, None, "agent_image"),
    )
