"""Request and response shapes.

Validation lives here so that every route gets the same treatment and no handler
has to remember to bound a string. Limits are deliberate: an unbounded text field
is a memory-exhaustion primitive, not a convenience.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ===========================================================================
# Auth
# ===========================================================================
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)
    display_name: str | None = Field(default=None, max_length=80)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class SessionResponse(BaseModel):
    """What the browser receives after signing in.

    The refresh token is NOT in this body — it is set as an httpOnly cookie the
    page script cannot read, so an XSS bug cannot walk off with a 30-day
    credential. Only the short-lived access token is handed to the client.
    """
    access_token: str
    expires_in: int
    user: "UserResponse"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str | None = None
    avatar_url: str | None = None
    role: Literal["user", "admin"]
    locale: Literal["en", "bn"] = "en"


# ===========================================================================
# Registry
# ===========================================================================
Vertical = Literal[
    "ai", "apps", "tools", "games", "jobs", "education", "banking", "bangladesh"
]
AppStatus = Literal["live", "beta", "planned", "disabled"]


class AppSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    vertical: Vertical
    name: str
    name_bn: str | None = None
    tagline: str | None = None
    icon: str | None = None
    route: str
    status: AppStatus
    is_featured: bool = False
    supports_my_apps: bool = True
    requires_auth: bool = False


class AppDetail(AppSummary):
    description: str | None = None
    # The real content change time, used for og:modified_time and sitemap
    # lastmod. Exposed so the frontend never has to invent a date.
    updated_at: datetime | None = None
    category: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    og_image: str | None = None
    structured_data_type: str | None = None
    use_count: int = 0
    # Whether the caller already has this in My Apps. Null when signed out,
    # which the UI renders differently from false.
    in_my_apps: bool | None = None


class SearchResult(BaseModel):
    id: UUID
    slug: str
    name: str
    vertical: Vertical
    tagline: str | None = None
    icon: str | None = None
    route: str
    status: AppStatus


class SearchResponse(BaseModel):
    query: str
    total: int
    # Grouped by vertical, because §10 asks for categorised results rather than
    # one undifferentiated list.
    groups: dict[str, list[SearchResult]]


# ===========================================================================
# My Apps
# ===========================================================================
class MyAppEntry(BaseModel):
    app: AppSummary
    is_pinned: bool
    sort_order: int
    added_at: datetime


class AddToMyAppsRequest(BaseModel):
    app_id: UUID | None = None
    slug: str | None = None


class PinRequest(BaseModel):
    is_pinned: bool


class ReorderRequest(BaseModel):
    # Bounded so a payload cannot ask the database to sort an arbitrary array.
    app_ids: list[UUID] = Field(min_length=1, max_length=200)


class RecentEntry(BaseModel):
    app: AppSummary
    last_used_at: datetime
    use_count: int


# ===========================================================================
# AI
# ===========================================================================
class TextRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    system: str | None = Field(default=None, max_length=2000)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    locale: Literal["en", "bn"] = "en"


class UsageInfo(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class TextResponse(BaseModel):
    """The normalised shape every provider is flattened into (§35).

    `provider` and `model` are included because an operator debugging a bad
    answer needs to know which one produced it. They are facts about the
    response, not a menu — the UI shows "Pickixo AI" (§158).
    """
    content: str
    provider: str
    model: str
    usage: UsageInfo
    latency_ms: int
    fallback_used: bool
    request_id: UUID


class QuotaStatus(BaseModel):
    kind: str
    used: int
    limit: int
    remaining: int
    is_guest: bool


# ===========================================================================
# Tools
# ===========================================================================
class TranscriptRequest(BaseModel):
    # Bounded: a URL longer than this is not a URL, and an unbounded string is
    # something to allocate rather than something to parse.
    url: str = Field(min_length=1, max_length=2048)
    # Optional caption track. Absent means "whatever the video has", which is
    # what someone pasting a link almost always wants.
    language: str | None = Field(default=None, max_length=32)


class TranscriptSegment(BaseModel):
    start: float
    duration: float
    text: str


class TranscriptVideo(BaseModel):
    id: str
    url: str
    title: str | None = None
    channel: str | None = None
    channel_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None


class TranscriptResponse(BaseModel):
    """Our shape, not the provider's.

    Deliberately stable: swapping transcript providers must not change what the
    frontend parses, and must not invalidate anything already cached.
    """
    video: TranscriptVideo
    language: str
    segment_count: int
    transcript: list[TranscriptSegment]
    # True when this cost no provider credit. Surfaced so the UI can be honest
    # about why a repeat request was instant.
    cached: bool = False


# ===========================================================================
# Admin
# ===========================================================================
class ProviderStatus(BaseModel):
    """What the admin panel shows about one provider.

    There is no api_key field, and there must never be one (§37, §38). Whether
    a key exists is reported as a boolean; its value never leaves the server.
    """
    slug: str
    display_name: str
    enabled: bool
    configured: bool
    capabilities: list[str]
    priority: int
    status: str
    default_model: str | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_error: str | None = None
    failure_count: int = 0
    cooldown_until: datetime | None = None
    avg_latency_ms: int | None = None


class ProviderUpdateRequest(BaseModel):
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    default_model: str | None = Field(default=None, max_length=200)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: bool
    version: str
    # Providers that are enabled AND have a key. Reported honestly: zero is a
    # normal answer on a fresh install and the UI says AI is unavailable rather
    # than failing at request time.
    ai_providers_ready: int


class SettingResponse(BaseModel):
    key: str
    value: Any
    description: str | None = None
    updated_at: datetime | None = None


SessionResponse.model_rebuild()
