"""Typed application settings, loaded once from the environment.

Nothing in this module is ever serialised to a client. Secrets stay here and in
the provider adapters; the API layer only ever sees decisions, never keys.

A missing optional key is not an error (§38): the provider that needed it is
treated as not configured and skipped. Only the settings the process genuinely
cannot start without are validated at boot.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- core ---------------------------------------------------------------
    app_name: str = "Pickixo"
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: str = "info"
    site_url: str = "https://pickixo.com"
    app_base_url: str = "http://localhost:3000"
    backend_port: int = 8000
    api_prefix: str = "/api"

    # --- database -----------------------------------------------------------
    # Local PostgreSQL on this machine. The application connects as a role that
    # is not a superuser and cannot alter the schema.
    database_url: str = ""
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_statement_timeout_ms: int = 15000

    # --- auth ---------------------------------------------------------------
    # Signs short-lived access tokens. Rotating this invalidates every access
    # token immediately; refresh tokens survive because they are database rows.
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 900              # 15 minutes
    refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30   # 30 days
    session_cookie_name: str = "pickixo_session"
    session_cookie_domain: str = ""
    # Off in development because localhost is not https; must be on in prod.
    session_cookie_secure: bool = False

    # Salts the hash that identifies a signed-out visitor for rate limiting, so
    # the counter table never holds a raw IP address.
    guest_key_salt: str = ""

    password_min_length: int = 10
    # After this many failures the account is locked out for the window below.
    login_max_attempts: int = 8
    login_lockout_seconds: int = 900

    # --- pickbot ------------------------------------------------------------
    # Absolute paths to the snapshot the bot writes and to the wrapper script the
    # Run button invokes. Either one empty disables that half: the product then
    # reports itself unconfigured instead of looking broken, and cannot be run
    # from the browser at all.
    pickbot_snapshot_path: str = ""
    pickbot_command: str = ""

    # --- google sign-in -----------------------------------------------------
    # Ships empty and therefore disabled. The sign-in page hides the Google
    # button when these are absent rather than showing a button that fails.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret
                    and self.google_redirect_uri)

    # --- ai providers -------------------------------------------------------
    # Order matters: the router walks this list and uses the first provider that
    # is enabled, keyed, and not cooling down. Every name must match a provider
    # slug registered in providers/registry.py.
    text_provider_priority: str = (
        "groq,anthropic,cerebras,openrouter,mistral,nvidia_nim,gemini,"
        "pollinations_text,ollama"
    )
    image_provider_priority: str = "cloudflare_image,pollinations_image"

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_enabled: bool = False

    # Paid, and second on purpose: it answers when Groq's free tier is spent or
    # down. Haiku 4.5 is the cheapest current Claude model ($1 / $5 per million
    # tokens in / out, checked 2026-09) and plenty for the agent's short JSON
    # jobs. The key is a credential: .env only.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5"
    anthropic_enabled: bool = False

    cerebras_api_key: str = ""
    cerebras_model: str = "gpt-oss-120b"
    cerebras_enabled: bool = False

    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_enabled: bool = False

    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"
    mistral_enabled: bool = False

    nvidia_nim_api_key: str = ""
    nvidia_nim_model: str = "meta/llama-3.3-70b-instruct"
    nvidia_nim_enabled: bool = False

    # Ships disabled deliberately. Its free tier trains on submitted content and
    # permits human review — see docs/PROVIDER_TERMS.md before enabling it for
    # public users.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_enabled: bool = False

    pollinations_api_key: str = ""
    pollinations_text_model: str = "openai"
    pollinations_text_enabled: bool = False
    pollinations_image_model: str = "flux"
    pollinations_image_enabled: bool = False

    # Served by Ollama on this machine, so there is no credential and nothing
    # leaves the server. The timeout dwarfs every cloud provider because CPU-only
    # inference is measured in minutes for long output.
    ollama_model: str = "qwen3:1.7b"
    ollama_enabled: bool = False
    ollama_timeout_seconds: float = 600.0

    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_image_model: str = "@cf/black-forest-labs/flux-1-schnell"
    cloudflare_image_edit_model: str = "@cf/black-forest-labs/flux-2-klein-4b"
    cloudflare_image_enabled: bool = False

    # --- meta / facebook ----------------------------------------------------
    # Ships empty and therefore disabled. Without an approved Meta app there is
    # nothing to connect to, and the dashboard says "not configured" rather than
    # offering a Connect button that cannot work.
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_redirect_uri: str = ""
    # v25.0 is current — Meta announced it in February 2026. Do not move this
    # without checking the changelog: an older version silently loses fields,
    # and a newer one can drop an endpoint this code depends on.
    meta_graph_version: str = "v25.0"
    # A Facebook Login for Business configuration ID. When set, the OAuth
    # dialog is opened with config_id and the permissions come from that
    # configuration, which is what Meta recommends for Login for Business
    # ("scope can still be included, [but] we recommend that you do not use
    # it"). Empty keeps the classic scope list from capabilities.py.
    meta_login_config_id: str = ""
    # The Facebook Page this deployment manages, by numeric Page ID. The
    # consent screen can grant several Pages, and the account that connects
    # may run more than one; without this the first one Facebook lists would
    # be taken, which is how a different Page once got connected. Not a secret.
    facebook_page_id: str = ""

    # Encrypts Page access tokens at rest (AES-256-GCM). A Page token is a
    # bearer credential for someone's Facebook Page, so it is never stored in
    # plaintext and never leaves the backend. 32 bytes, base64, generated per
    # deployment. Rotating it makes every stored token undecryptable, which
    # means reconnecting the Page — not a silent failure, see crypto.py.
    facebook_token_key: str = ""

    @property
    def meta_configured(self) -> bool:
        return bool(self.meta_app_id and self.meta_app_secret
                    and self.meta_redirect_uri and self.facebook_token_key)

    @property
    def graph_base_url(self) -> str:
        return f"https://graph.facebook.com/{self.meta_graph_version}"

    # --- facebook agent -----------------------------------------------------
    # How often the supervisor wakes the agent. This is *only* a wake-up: the
    # agent decides whether anything should happen. Waking often is cheap
    # because the first thing it does is a set of deterministic checks that
    # cost no AI call at all.
    facebook_agent_enabled: bool = False
    facebook_agent_tick_seconds: int = 300

    # A ceiling the dashboard cannot raise. Per-page limits live in
    # facebook_agent_settings and may be lower, never higher — so a mistake in
    # the UI cannot turn into a posting spree on someone's Page.
    facebook_agent_max_feed_posts_per_day: int = 6
    facebook_agent_max_stories_per_day: int = 10
    facebook_agent_max_replies_per_hour: int = 30
    facebook_agent_max_reels_per_day: int = 4

    # --- reels --------------------------------------------------------------
    # A reel is: an AI-written script, Piper narration, AI stills with slow
    # zoom, burned-in captions — and optionally a short Wan clip up front,
    # because the first seconds decide whether anyone stays.
    #
    # Everything except the hook runs on this machine and costs nothing. The
    # hook is the one paid step, so it needs both a key and the flag; without
    # either, reels are still made, with a still-image opening instead.
    reel_voice_model: str = "./storage/voices/en_US-ryan-high.onnx"
    reel_ffmpeg: str = "ffmpeg"
    reel_hook_enabled: bool = False
    # fal.ai. Silent 720p Wan 2.6 Flash is roughly $0.025/s, so a 5 s hook is
    # about $0.13 — check fal's model page before changing model or resolution.
    fal_key: str = ""
    reel_hook_model: str = "wan/v2.6/image-to-video/flash"
    reel_hook_resolution: str = "720p"
    reel_hook_seconds: int = 5
    # A queued fal job that has not finished in this long is abandoned and the
    # reel falls back to a still opening. The spend may still happen.
    reel_hook_timeout_seconds: int = 480

    @property
    def reel_hook_configured(self) -> bool:
        return bool(self.reel_hook_enabled and self.fal_key)

    # --- storage ------------------------------------------------------------
    storage_root: str = "./storage"
    max_upload_mb: int = 25
    # Signs media URLs so an <img> tag works without an Authorization header.
    # Six hours outlives a browsing session without leaving links valid forever.
    file_url_secret: str = ""
    file_url_ttl_seconds: int = 21600

    # --- daily limits (§40) -------------------------------------------------
    # Deliberately generous for signed-in users and tight for guests. These are
    # defaults; app_settings overrides them at runtime without a redeploy.
    limit_text_per_day: int = 50
    limit_image_per_day: int = 20
    limit_guest_text_per_day: int = 5
    limit_guest_image_per_day: int = 2

    # Transcripts cost a provider credit each, so the guest allowance is small.
    # A cache hit does not consume any of these — only a real provider call.
    # Overridable at runtime from app_settings without a redeploy.
    limit_transcript_per_day: int = 25
    limit_guest_transcript_per_day: int = 5

    # --- tools: transcripts ---------------------------------------------------
    # transcriptapi.com. One credit per successful fetch, which is why the
    # cache is checked first and quota is only spent on a cache miss.
    transcript_api_key: str = ""

    # --- search engines -------------------------------------------------------
    # Proves host control to IndexNow: the endpoint fetches
    # https://<site>/<key>.txt and checks it contains this value. Generated per
    # deployment, never committed.
    indexnow_key: str = ""
    google_site_verification: str = ""
    bing_site_verification: str = ""

    # --- cors ---------------------------------------------------------------
    cors_allowed_origins: str = "http://localhost:3000"

    @field_validator(
        "cors_allowed_origins", "text_provider_priority", "image_provider_priority"
    )
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def text_priority(self) -> list[str]:
        return [s.strip() for s in self.text_provider_priority.split(",") if s.strip()]

    @property
    def image_priority(self) -> list[str]:
        return [s.strip() for s in self.image_provider_priority.split(",") if s.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def default_limit(self, kind: str, *, guest: bool) -> int:
        if guest:
            return {
                "text": self.limit_guest_text_per_day,
                "image": self.limit_guest_image_per_day,
                "transcript": self.limit_guest_transcript_per_day,
            }.get(kind, 0)
        return {
            "text": self.limit_text_per_day,
            "image": self.limit_image_per_day,
            "transcript": self.limit_transcript_per_day,
        }.get(kind, 0)

    def startup_problems(self) -> list[str]:
        """Configuration the process genuinely cannot run without.

        Returned rather than raised so main() can log every problem at once
        instead of making an operator fix them one restart at a time.
        """
        problems: list[str] = []
        if not self.database_url:
            problems.append("DATABASE_URL is not set")
        if not self.jwt_secret:
            problems.append("JWT_SECRET is not set")
        elif len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET is shorter than 32 characters")
        if not self.guest_key_salt:
            problems.append("GUEST_KEY_SALT is not set")
        if self.is_production and not self.session_cookie_secure:
            problems.append(
                "SESSION_COOKIE_SECURE must be true in production, or session "
                "cookies will be sent over plain HTTP"
            )
        if self.is_production and self.site_url.startswith("http://"):
            problems.append("SITE_URL must be https in production")
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
