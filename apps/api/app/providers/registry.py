"""Builds the provider managers from settings at application startup."""
from __future__ import annotations

from ..logging_config import get_logger

from ..config import Settings
from .base import ImageProvider, TextProvider
from .image.cloudflare_provider import CloudflareImageProvider
from .image.pollinations_provider import PollinationsImageProvider
from .manager import ProviderManager, UsageRecorder
from .text.anthropic_provider import AnthropicTextProvider
from .text.gemini_provider import GeminiTextProvider
from .text.groq_provider import GroqTextProvider
from .text.ollama_provider import OllamaTextProvider
from .text.openai_compatible import OpenAICompatibleTextProvider
from .text.pollinations_provider import PollinationsTextProvider

log = get_logger(__name__)

#: Chat-completions endpoints for the vendors that speak OpenAI's shape.
#: Kept here rather than in config so an operator cannot point a key at an
#: arbitrary host by editing .env.
#
# GitHub Models is deliberately absent: it was retired on 30 July 2026 and its
# inference API no longer answers. Do not re-add it.
CEREBRAS_ENDPOINT = "https://api.cerebras.ai/v1/chat/completions"
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions"
NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"


def _build_openai_compatible(settings: Settings) -> list[TextProvider]:
    """The free-tier fallback bench, in the order registry callers expect.

    Every one of these ships disabled with an empty key. The manager skips a
    provider that is not both enabled and configured, so an untouched install
    behaves exactly as before this bench existed.
    """
    return [
        OpenAICompatibleTextProvider(
            slug="cerebras",
            display_name="Cerebras",
            endpoint=CEREBRAS_ENDPOINT,
            api_key=settings.cerebras_api_key,
            model=settings.cerebras_model,
            enabled=settings.cerebras_enabled,
        ),
        OpenAICompatibleTextProvider(
            slug="openrouter",
            display_name="OpenRouter",
            endpoint=OPENROUTER_ENDPOINT,
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            enabled=settings.openrouter_enabled,
            # OpenRouter asks callers to identify the app; these show up in
            # its dashboard and are not required for the call to succeed.
            extra_headers={
                "HTTP-Referer": settings.app_base_url,
                "X-Title": settings.app_name,
            },
        ),
        OpenAICompatibleTextProvider(
            slug="mistral",
            display_name="Mistral",
            endpoint=MISTRAL_ENDPOINT,
            api_key=settings.mistral_api_key,
            model=settings.mistral_model,
            enabled=settings.mistral_enabled,
        ),
        OpenAICompatibleTextProvider(
            slug="nvidia_nim",
            display_name="NVIDIA NIM",
            endpoint=NVIDIA_NIM_ENDPOINT,
            api_key=settings.nvidia_nim_api_key,
            model=settings.nvidia_nim_model,
            enabled=settings.nvidia_nim_enabled,
        ),
    ]


def build_text_manager(
    settings: Settings, recorder: UsageRecorder | None = None
) -> ProviderManager[TextProvider]:
    providers: list[TextProvider] = [
        GroqTextProvider(settings.groq_api_key, settings.groq_model, settings.groq_enabled),
        AnthropicTextProvider(
            settings.anthropic_api_key, settings.anthropic_model,
            settings.anthropic_enabled,
        ),
        OllamaTextProvider(
            settings.ollama_model,
            settings.ollama_enabled,
            settings.ollama_timeout_seconds,
        ),
        *_build_openai_compatible(settings),
        GeminiTextProvider(settings.gemini_api_key, settings.gemini_model, settings.gemini_enabled),
        PollinationsTextProvider(
            settings.pollinations_api_key,
            settings.pollinations_text_model,
            settings.pollinations_text_enabled,
        ),
    ]
    manager = ProviderManager(
        "text", providers, settings.text_priority, usage_recorder=recorder
    )
    _log_registry("text", manager)
    return manager


def build_image_manager(
    settings: Settings, recorder: UsageRecorder | None = None
) -> ProviderManager[ImageProvider]:
    providers: list[ImageProvider] = [
        CloudflareImageProvider(
            settings.cloudflare_account_id,
            settings.cloudflare_api_token,
            settings.cloudflare_image_model,
            settings.cloudflare_image_enabled,
            settings.cloudflare_image_edit_model,
        ),
        PollinationsImageProvider(
            settings.pollinations_api_key,
            settings.pollinations_image_model,
            settings.pollinations_image_enabled,
        ),
    ]
    manager = ProviderManager(
        "image", providers, settings.image_priority, usage_recorder=recorder
    )
    _log_registry("image", manager)
    return manager


def _log_registry(kind: str, manager: ProviderManager) -> None:
    """Startup visibility: which providers will actually be used, and why not."""
    for entry in manager.describe():
        state = (
            "active"
            if entry["enabled"] and entry["configured"]
            else "disabled" if not entry["enabled"]
            else "not_configured"
        )
        log.info(
            "provider.registered",
            kind=kind, provider=entry["slug"],
            priority=entry["priority"], state=state,
        )
    if not manager.has_usable_provider:
        log.warning(
            "provider.none_usable",
            kind=kind,
            hint=f"No {kind} provider is both enabled and configured. "
                 f"{kind.title()} generation will report 'temporarily unavailable' "
                 f"until a key is set in .env.",
        )
