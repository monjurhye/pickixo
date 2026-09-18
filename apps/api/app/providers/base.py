"""Provider contracts.

Every upstream AI vendor is reduced to one of these small interfaces, so the
rest of the application never learns a vendor's name, request shape, or error
format. Swapping or adding a provider touches only this package.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class ProviderFailure(str, Enum):
    """Why a provider call failed, in terms the manager can route on."""

    NOT_CONFIGURED = "not_configured"   # no key / disabled — skip, try next
    RATE_LIMITED = "rate_limited"       # 429 — cool this provider down, try next
    QUOTA_EXHAUSTED = "quota_exhausted" # daily cap hit — long cooldown, try next
    TIMEOUT = "timeout"                 # retry once, then try next
    UPSTREAM_ERROR = "upstream_error"   # 5xx — retry with backoff, then try next
    BAD_REQUEST = "bad_request"         # our fault — do NOT retry, do NOT fail over
    CONTENT_BLOCKED = "content_blocked" # safety filter — do NOT fail over
    UNKNOWN = "unknown"


#: Failures where trying a different provider is pointless — the next one
#: would reject the same input for the same reason.
NON_FAILOVER = frozenset({ProviderFailure.BAD_REQUEST, ProviderFailure.CONTENT_BLOCKED})

#: Failures worth retrying against the *same* provider before moving on.
RETRYABLE = frozenset({ProviderFailure.TIMEOUT, ProviderFailure.UPSTREAM_ERROR})


class ProviderError(Exception):
    def __init__(
        self,
        failure: ProviderFailure,
        *,
        provider: str,
        detail: str = "",
        http_status: int | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        self.failure = failure
        self.provider = provider
        self.detail = detail
        self.http_status = http_status
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"{provider}: {failure.value}: {detail}")


# --- request / result shapes -------------------------------------------------

@dataclass(slots=True)
class TextRequest:
    prompt: str
    content_type: str = "social_post"
    tone: str | None = None
    length_hint: Literal["short", "medium", "long"] = "medium"
    language: Literal["en", "bn"] = "en"
    max_output_tokens: int = 1200


@dataclass(slots=True)
class TextResult:
    text: str
    provider: str
    model: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int = 0


@dataclass(slots=True)
class ImageRequest:
    prompt: str
    negative_prompt: str | None = None
    style: str | None = None
    aspect_ratio: str = "1:1"
    seed: int | None = None

    #: JPEG/PNG bytes to keep a character consistent across a video's scenes.
    #: Text-to-image models cannot hold identity between calls, so the previous
    #: scene's frame is fed back as a reference. Providers that cannot accept an
    #: image ignore this and generate from the prompt alone — a weaker result,
    #: never a failure.
    reference_image: bytes | None = None

    #: Pixel dimensions per supported ratio. Capped deliberately: a 4 GB VPS
    #: has to hold these in memory while writing them to disk.
    _DIMENSIONS = {
        "1:1": (1024, 1024),
        "4:5": (896, 1120),
        "16:9": (1280, 720),
        "9:16": (720, 1280),
    }

    @property
    def dimensions(self) -> tuple[int, int]:
        return self._DIMENSIONS.get(self.aspect_ratio, (1024, 1024))


@dataclass(slots=True)
class ImageResult:
    data: bytes
    mime_type: str
    width: int
    height: int
    provider: str
    model: str
    seed: int | None = None
    latency_ms: int = 0


# --- interfaces --------------------------------------------------------------

class BaseProvider(abc.ABC):
    slug: str = ""
    display_name: str = ""
    kind: str = ""

    @property
    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True when this provider has everything it needs to be called.

        A provider that is not configured is skipped silently by the manager
        and reported as 'Not configured' in the admin panel — never faked.
        """

    @property
    def is_enabled(self) -> bool:
        return True


class TextProvider(BaseProvider):
    kind = "text"

    @abc.abstractmethod
    async def generate(self, request: TextRequest) -> TextResult: ...


class ImageProvider(BaseProvider):
    kind = "image"

    @abc.abstractmethod
    async def generate(self, request: ImageRequest) -> ImageResult: ...


# --- shared prompt construction ---------------------------------------------

_LENGTH_GUIDE = {
    "short": "Keep it brief — roughly 60-120 words.",
    "medium": "Aim for roughly 150-300 words.",
    "long": "Write a thorough piece of roughly 400-700 words.",
}

_CONTENT_GUIDE = {
    "social_post": "a social media post with a strong opening line",
    "blog_outline": "a structured blog outline with headings and sub-points",
    "blog_article": "a complete blog article with an introduction, body and conclusion",
    "product_description": "a persuasive product description focused on benefits",
    "advertisement": "concise advertising copy with a clear call to action",
    "youtube_script": "a spoken-word video script with scene cues",
    "story": "a short narrative story",
    "email": "a professional email with a subject line",
    "custom": "content that follows the instruction exactly",
}


_ASSISTANT_PROMPT_EN = (
    "You are Pickixo AI, a helpful assistant. Answer the question you were "
    "actually asked, directly and without padding. If you do not know "
    "something, or the question depends on information you do not have, say so "
    "plainly rather than inventing an answer. Use Markdown for structure and "
    "fenced code blocks for code. Do not open with a restatement of the "
    "question and do not add notes about being an AI."
)

_ASSISTANT_PROMPT_BN = (
    "You are Pickixo AI, a helpful assistant. Write your entire response in "
    "Bengali (বাংলা), using natural, idiomatic Bengali rather than "
    "transliteration. Answer the question you were actually asked, directly "
    "and without padding. If you do not know something, say so plainly rather "
    "than inventing an answer. Use Markdown for structure and fenced code "
    "blocks for code."
)


def build_system_prompt(request: TextRequest) -> str:
    """One prompt builder shared by every text provider, so switching
    providers does not silently change output style.

    'assistant' is the general chat mode and takes an entirely different prompt:
    the content-writer framing below turns a question into an essay about the
    question, which is not what someone asking "why is my query slow" wants.
    Every other content type keeps the writer behaviour unchanged.
    """
    if request.content_type == "assistant":
        return (
            _ASSISTANT_PROMPT_BN if request.language == "bn" else _ASSISTANT_PROMPT_EN
        )

    language = (
        "Write your entire response in Bengali (বাংলা), using natural, "
        "idiomatic Bengali rather than transliteration."
        if request.language == "bn"
        else "Write your entire response in English."
    )
    parts = [
        "You are a professional content writer.",
        f"Produce {_CONTENT_GUIDE.get(request.content_type, _CONTENT_GUIDE['custom'])}.",
        # The form asks "What should it be about?", so the message is a subject.
        # Without saying so, a bare noun phrase gets read as a brand and the
        # model invents a product for it — "Royal Bengal Tiger" came back as
        # tyre copy, complete with tread design and dealerships.
        "The user's message is the subject to write about, not an instruction "
        "to restate and not a brand to build claims around. Do not invent "
        "specific facts, figures, features or prices that the subject does not "
        "already imply; if the subject is ambiguous, write about its most "
        "widely understood meaning.",
        language,
        _LENGTH_GUIDE.get(request.length_hint, _LENGTH_GUIDE["medium"]),
    ]
    if request.tone:
        parts.append(f"Use a {request.tone} tone.")
    parts.append(
        "Return only the finished content. Do not add commentary, "
        "preamble, or notes about being an AI."
    )
    return " ".join(parts)
