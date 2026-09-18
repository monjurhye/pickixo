"""A single error vocabulary for the whole backend.

Design rule from the brief (§122): users must never see a raw upstream error.
Every failure is mapped to a stable machine code plus a translation key. The
frontend renders the key in the user's language; the technical detail goes to
the logs and nowhere else.

This is also why there is no free-text `message` on AppError. A literal English
string thrown from a service is a string that can never be translated, and one
that tends to leak implementation detail on its way out.
"""
from __future__ import annotations

from enum import Enum


class ErrorCode(str, Enum):
    # --- client-side --------------------------------------------------------
    INVALID_REQUEST = "invalid_request"
    UNAUTHENTICATED = "unauthenticated"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    ACCOUNT_SUSPENDED = "account_suspended"

    # --- auth ---------------------------------------------------------------
    # Deliberately one code for "wrong email" and "wrong password": telling them
    # apart turns the sign-in form into an account-enumeration oracle.
    INVALID_CREDENTIALS = "invalid_credentials"
    EMAIL_TAKEN = "email_taken"
    INVALID_EMAIL = "invalid_email"
    WEAK_PASSWORD = "weak_password"
    SESSION_INVALID = "session_invalid"
    SESSION_EXPIRED = "session_expired"
    TOO_MANY_ATTEMPTS = "too_many_attempts"
    GOOGLE_NOT_CONFIGURED = "google_not_configured"
    GOOGLE_SIGN_IN_FAILED = "google_sign_in_failed"
    GOOGLE_EMAIL_UNVERIFIED = "google_email_unverified"

    # --- quota --------------------------------------------------------------
    DAILY_LIMIT_REACHED = "daily_limit_reached"

    # --- provider / capacity ------------------------------------------------
    SERVICE_BUSY = "service_busy"
    PROVIDER_NOT_CONFIGURED = "provider_not_configured"
    GENERATION_FAILED = "generation_failed"
    CONTENT_REJECTED = "content_rejected"

    # --- tools ----------------------------------------------------------------
    INVALID_YOUTUBE_URL = "invalid_youtube_url"
    TRANSCRIPT_UNAVAILABLE = "transcript_unavailable"
    TRANSCRIPT_TOO_LARGE = "transcript_too_large"
    TRANSCRIPT_FAILED = "transcript_failed"
    PROVIDER_QUOTA_EXHAUSTED = "provider_quota_exhausted"

    # --- product ------------------------------------------------------------
    APP_NOT_AVAILABLE = "app_not_available"

    # --- server -------------------------------------------------------------
    INTERNAL_ERROR = "internal_error"


#: user-facing translation keys — the frontend owns the actual wording
MESSAGE_KEYS: dict[ErrorCode, str] = {
    ErrorCode.INVALID_REQUEST: "errors.invalidRequest",
    ErrorCode.UNAUTHENTICATED: "errors.unauthenticated",
    ErrorCode.FORBIDDEN: "errors.forbidden",
    ErrorCode.NOT_FOUND: "errors.notFound",
    ErrorCode.CONFLICT: "errors.conflict",
    ErrorCode.ACCOUNT_SUSPENDED: "errors.accountSuspended",

    ErrorCode.INVALID_CREDENTIALS: "errors.invalidCredentials",
    ErrorCode.EMAIL_TAKEN: "errors.emailTaken",
    ErrorCode.INVALID_EMAIL: "errors.invalidEmail",
    ErrorCode.WEAK_PASSWORD: "errors.weakPassword",
    ErrorCode.SESSION_INVALID: "errors.sessionInvalid",
    ErrorCode.SESSION_EXPIRED: "errors.sessionExpired",
    ErrorCode.TOO_MANY_ATTEMPTS: "errors.tooManyAttempts",
    ErrorCode.GOOGLE_NOT_CONFIGURED: "errors.googleNotConfigured",
    ErrorCode.GOOGLE_SIGN_IN_FAILED: "errors.googleSignInFailed",
    ErrorCode.GOOGLE_EMAIL_UNVERIFIED: "errors.googleEmailUnverified",

    ErrorCode.DAILY_LIMIT_REACHED: "errors.dailyLimitReached",
    ErrorCode.SERVICE_BUSY: "errors.serviceBusy",
    ErrorCode.PROVIDER_NOT_CONFIGURED: "errors.providerNotConfigured",
    ErrorCode.GENERATION_FAILED: "errors.generationFailed",
    ErrorCode.CONTENT_REJECTED: "errors.contentRejected",
    ErrorCode.INVALID_YOUTUBE_URL: "errors.invalidYoutubeUrl",
    ErrorCode.TRANSCRIPT_UNAVAILABLE: "errors.transcriptUnavailable",
    ErrorCode.TRANSCRIPT_TOO_LARGE: "errors.transcriptTooLarge",
    ErrorCode.TRANSCRIPT_FAILED: "errors.transcriptFailed",
    ErrorCode.PROVIDER_QUOTA_EXHAUSTED: "errors.providerQuotaExhausted",
    ErrorCode.APP_NOT_AVAILABLE: "errors.appNotAvailable",
    ErrorCode.INTERNAL_ERROR: "errors.internalError",
}

HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.INVALID_REQUEST: 400,
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.CONFLICT: 409,
    ErrorCode.ACCOUNT_SUSPENDED: 403,

    ErrorCode.INVALID_CREDENTIALS: 401,
    ErrorCode.EMAIL_TAKEN: 409,
    ErrorCode.INVALID_EMAIL: 400,
    ErrorCode.WEAK_PASSWORD: 400,
    ErrorCode.SESSION_INVALID: 401,
    ErrorCode.SESSION_EXPIRED: 401,
    ErrorCode.TOO_MANY_ATTEMPTS: 429,
    ErrorCode.GOOGLE_NOT_CONFIGURED: 503,
    ErrorCode.GOOGLE_SIGN_IN_FAILED: 401,
    ErrorCode.GOOGLE_EMAIL_UNVERIFIED: 403,

    ErrorCode.DAILY_LIMIT_REACHED: 429,
    ErrorCode.SERVICE_BUSY: 503,
    ErrorCode.PROVIDER_NOT_CONFIGURED: 503,
    ErrorCode.GENERATION_FAILED: 502,
    ErrorCode.CONTENT_REJECTED: 422,
    ErrorCode.INVALID_YOUTUBE_URL: 400,
    # 404: the transcript genuinely does not exist for that video.
    ErrorCode.TRANSCRIPT_UNAVAILABLE: 404,
    ErrorCode.TRANSCRIPT_TOO_LARGE: 413,
    ErrorCode.TRANSCRIPT_FAILED: 502,
    # 503: our supply problem, not the caller's request.
    ErrorCode.PROVIDER_QUOTA_EXHAUSTED: 503,
    ErrorCode.APP_NOT_AVAILABLE: 404,
    ErrorCode.INTERNAL_ERROR: 500,
}


class AppError(Exception):
    """Raised anywhere in the app; rendered by a single exception handler.

    ``detail`` is for logs only and is never returned to the client.
    ``meta`` is returned, so it must carry only values safe for a user to see —
    a remaining quota, a minimum password length — and never a provider name,
    a query, or anything about how the system is built.
    """

    def __init__(
        self,
        code: ErrorCode,
        *,
        detail: str | None = None,
        meta: dict | None = None,
    ) -> None:
        self.code = code
        self.detail = detail
        self.meta = meta or {}
        super().__init__(detail or code.value)

    @property
    def status_code(self) -> int:
        return HTTP_STATUS[self.code]

    def to_body(self) -> dict:
        """The exact JSON the client receives. No stack traces, no provider names."""
        return {
            "error": {
                "code": self.code.value,
                "messageKey": MESSAGE_KEYS[self.code],
                **({"meta": self.meta} if self.meta else {}),
            }
        }
