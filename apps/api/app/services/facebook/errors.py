"""Classifying what Meta just told us.

The agent's retry behaviour hangs entirely on this module. Graph API failures
are not interchangeable:

* a rate limit must stop that action type for a while — retrying digs the hole
  deeper and can escalate to a longer block;
* an invalid token must stop everything and ask for a reconnection, because no
  amount of retrying will fix it;
* a transient network failure *should* be retried;
* a permanent rejection (bad parameter, missing permission) must never be
  retried, because the same call will fail identically forever.

Treating all four the same is how an agent turns one problem into a ban.

Meta's error codes are documented at
developers.facebook.com/docs/graph-api/guides/error-handling/.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class FailureKind(str, Enum):
    #: Retry after a delay. Network blips, Meta's own "unknown error".
    TRANSIENT = "transient"
    #: Back off this action type entirely for a while.
    RATE_LIMITED = "rate_limited"
    #: The token is dead. Stop, mark the connection, ask for a reconnect.
    AUTH = "auth"
    #: We asked for something we are not allowed to do. Never retry.
    PERMISSION = "permission"
    #: The request itself is wrong. Never retry; this is our bug.
    INVALID_REQUEST = "invalid_request"
    #: The thing we referenced is gone — a deleted post, a removed comment.
    NOT_FOUND = "not_found"
    #: Meta said no on content grounds.
    REJECTED = "rejected"
    #: Genuinely unclassified. Treated as permanent, because guessing
    #: "transient" on an unknown failure is what produces retry storms.
    UNKNOWN = "unknown"


#: Codes that mean "you are going too fast".
#:   4   — application request limit
#:   17  — user request limit
#:   32  — page request limit
#:   613 — calls to this api have exceeded the rate limit
#:   80001..80004 — per-product rate limits (pages, etc.)
_RATE_LIMIT_CODES = {4, 17, 32, 613, 80001, 80002, 80003, 80004}

#: 190 is the general OAuth failure: expired, revoked, invalidated by a
#: password change. 102 is a session problem. 463/467 are expired/invalid.
_AUTH_CODES = {102, 190, 463, 467}

#: 10 and the 200-range are "permission denied" in Meta's scheme.
_PERMISSION_CODES = {3, 10, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209,
                     210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220,
                     221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
                     232, 233, 234, 235, 236, 237, 238, 239, 240, 294, 299}

#: 1 and 2 are Meta's own "unknown"/"service temporarily unavailable".
_TRANSIENT_CODES = {1, 2, 341, 368}

_NOT_FOUND_CODES = {100_803, 803}


@dataclass(slots=True)
class GraphFailure(Exception):
    """A Graph API call that did not work, classified.

    `message` is Meta's wording. It is safe to log — Meta does not echo the
    access token back in error text — but it is never shown to an end user,
    because it names the provider and cannot be translated.
    """
    kind: FailureKind
    message: str
    code: int | None = None
    subcode: int | None = None
    http_status: int | None = None
    fbtrace_id: str | None = None
    #: Seconds Meta asked us to wait, when it said so.
    retry_after_seconds: int | None = None

    def __str__(self) -> str:  # pragma: no cover - debugging aid
        return f"[{self.kind.value}] {self.message} (code={self.code})"

    @property
    def is_retryable(self) -> bool:
        """Whether trying the identical call again could plausibly work.

        Rate limiting is deliberately *not* retryable here: it needs a backoff
        at the action-type level, which is a different decision from "try
        again in a moment" and is handled by the caller.
        """
        return self.kind is FailureKind.TRANSIENT


def classify(
    *,
    http_status: int,
    payload: dict | None,
    retry_after_header: str | None = None,
) -> GraphFailure:
    """Turn a Graph error response into something the agent can act on."""
    error = (payload or {}).get("error") or {}
    code = error.get("code")
    subcode = error.get("error_subcode")
    message = (
        error.get("message")
        or error.get("error_user_msg")
        or f"HTTP {http_status}"
    )
    fbtrace = error.get("fbtrace_id")

    retry_after = None
    if retry_after_header:
        try:
            retry_after = int(float(retry_after_header))
        except (TypeError, ValueError):
            retry_after = None

    def made(kind: FailureKind, seconds: int | None = None) -> GraphFailure:
        return GraphFailure(
            kind=kind, message=str(message)[:500], code=code, subcode=subcode,
            http_status=http_status, fbtrace_id=fbtrace,
            retry_after_seconds=retry_after if retry_after is not None else seconds,
        )

    if isinstance(code, int):
        if code in _RATE_LIMIT_CODES:
            # Meta rarely sends Retry-After on these. An hour is the commonly
            # documented window for page-level throttling; better to wait too
            # long than to keep knocking.
            return made(FailureKind.RATE_LIMITED, 3600)
        if code in _AUTH_CODES:
            return made(FailureKind.AUTH)
        if code in _PERMISSION_CODES:
            return made(FailureKind.PERMISSION)
        if code in _TRANSIENT_CODES:
            return made(FailureKind.TRANSIENT, 30)
        if code in _NOT_FOUND_CODES:
            return made(FailureKind.NOT_FOUND)

    # Fall back to HTTP semantics when there is no usable code.
    if http_status == 429:
        return made(FailureKind.RATE_LIMITED, 3600)
    if http_status in (401, 403):
        # 403 without a permission code is usually still a permission problem,
        # but it can be a block. Either way it must not be retried.
        return made(FailureKind.AUTH if http_status == 401 else FailureKind.PERMISSION)
    if http_status == 404:
        return made(FailureKind.NOT_FOUND)
    if http_status == 400:
        return made(FailureKind.INVALID_REQUEST)
    if http_status >= 500:
        return made(FailureKind.TRANSIENT, 30)

    return made(FailureKind.UNKNOWN)


def from_network_error(exc: Exception) -> GraphFailure:
    """A request that never got an answer.

    Important: this is *not* proof that nothing happened. A timeout on a
    publish may well have published. The caller must verify before retrying —
    which is what the idempotency ledger is for.
    """
    return GraphFailure(
        kind=FailureKind.TRANSIENT,
        message=f"{type(exc).__name__}: {str(exc)[:200]}",
        retry_after_seconds=30,
    )
