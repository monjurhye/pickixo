"""Daily usage limits.

Two rules this module exists to keep (§40, §88):

1. The limit is enforced in the database, atomically. The API never reads a
   counter, decides, and writes it back — that pattern loses races, and losing
   a race here means handing out free capacity we do not have.

2. A unit is refunded when the work did not happen. If every provider was down,
   that is our outage, and a user should not lose a day of their allowance to it.

Limits come from app_settings when an operator has set them, and from the
environment defaults otherwise, so they can be changed without a redeploy.
"""
from __future__ import annotations

import json

from .. import db
from ..config import Settings
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger

log = get_logger(__name__)


async def _configured_limit(kind: str, *, guest: bool, settings: Settings) -> int:
    key = f"LIMIT_{'GUEST_' if guest else ''}{kind.upper()}_PER_DAY"
    row = await db.fetch_one("SELECT value FROM app_settings WHERE key = %s", (key,))
    if row is not None:
        try:
            value = row["value"]
            if isinstance(value, str):
                value = json.loads(value)
            return max(0, int(value))
        except (TypeError, ValueError):
            log.warning("quota.setting_not_an_integer", key=key)
    return settings.default_limit(kind, guest=guest)


async def consume(
    *, user_id: str | None, guest_key: bytes | None, kind: str, settings: Settings
) -> dict:
    """Take one unit or raise DAILY_LIMIT_REACHED.

    Returns the post-attempt state so a caller can put remaining-quota headers
    on a successful response without a second query.
    """
    guest = user_id is None
    limit = await _configured_limit(kind, guest=guest, settings=settings)

    if limit <= 0:
        raise AppError(
            ErrorCode.DAILY_LIMIT_REACHED,
            detail=f"{kind} limit is zero for {'guests' if guest else 'users'}",
            meta={"used": 0, "limit": 0, "isGuest": guest},
        )

    row = await db.fetch_one(
        "SELECT allowed, used, quota_limit FROM consume_quota(%s, %s, %s, %s)",
        (user_id, guest_key, kind, limit),
    )

    if not row["allowed"]:
        raise AppError(
            ErrorCode.DAILY_LIMIT_REACHED,
            detail=f"{kind} daily limit reached",
            meta={"used": row["used"], "limit": row["quota_limit"], "isGuest": guest},
        )

    return {
        "kind": kind,
        "used": row["used"],
        "limit": row["quota_limit"],
        "remaining": max(0, row["quota_limit"] - row["used"]),
        "is_guest": guest,
    }


async def refund(*, user_id: str | None, guest_key: bytes | None, kind: str) -> None:
    """Give a unit back. Never raises — a failed refund must not mask the
    original failure the caller is already reporting."""
    try:
        await db.execute("SELECT release_quota(%s, %s, %s)", (user_id, guest_key, kind))
    except Exception:  # noqa: BLE001
        log.exception("quota.refund_failed", kind=kind)


async def status(
    *, user_id: str | None, guest_key: bytes | None, kind: str, settings: Settings
) -> dict:
    """Read the ledger without touching it."""
    guest = user_id is None
    limit = await _configured_limit(kind, guest=guest, settings=settings)
    used = await db.fetch_value(
        """
        SELECT used FROM usage_counters
         WHERE kind = %s AND day = (now() AT TIME ZONE 'utc')::date
           AND (user_id = %s OR guest_key = %s)
        """,
        (kind, user_id, guest_key),
    ) or 0
    return {
        "kind": kind,
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "is_guest": guest,
    }
