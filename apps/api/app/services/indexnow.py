"""IndexNow: tell search engines when a public URL actually changed.

https://www.indexnow.org/documentation

Three rules shape this module, all of them about not crying wolf:

1. **Only public, indexable, shipped URLs.** The candidate list comes from the
   same registry query that builds sitemap.xml, so a private page or an unbuilt
   one cannot be submitted — the query cannot return it.

2. **Only genuine changes.** Every submitted URL is recorded with the content
   timestamp it had at the time. A URL is sent again only when its source row is
   newer than that. Rendering a page, or a use_count ticking up, changes
   nothing here.

3. **Failure is isolated.** IndexNow being down, throttled or misconfigured
   never affects publishing. It is a notification, not a step in the pipeline.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from .. import db
from ..config import Settings
from ..logging_config import get_logger

log = get_logger(__name__)

# The shared endpoint forwards to every participating engine (Bing, Yandex,
# Seznam, Naver), so one call reaches all of them.
INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"

# IndexNow accepts at most 10,000 URLs per request. Pickixo is nowhere near
# that, but a batch limit stops one bad sync becoming one enormous request.
MAX_URLS_PER_REQUEST = 10_000


def is_configured(settings: Settings) -> bool:
    return bool(settings.indexnow_key and settings.site_url.startswith("https://"))


async def _candidates() -> list[dict[str, Any]]:
    """Public URLs eligible for submission, with their real change times.

    Deliberately the same shape as the sitemap: if it does not belong in
    sitemap.xml it does not belong in an IndexNow submission either.
    """
    return await db.fetch_all(
        """
        SELECT a.route, a.updated_at
          FROM apps a
         WHERE a.is_public AND a.is_indexable AND a.status IN ('live', 'beta')
        """
    )


async def pending_changes(settings: Settings) -> list[dict[str, Any]]:
    """URLs whose content is newer than the last time we announced them.

    Includes URLs never submitted, and URLs whose previous submission failed.
    """
    rows = await _candidates()
    base = settings.site_url.rstrip("/")

    submitted = {
        r["url"]: r
        for r in await db.fetch_all(
            "SELECT url, content_changed_at, status FROM indexnow_submissions"
        )
    }

    changes: list[dict[str, Any]] = []
    for row in rows:
        url = f"{base}{row['route']}"
        previous = submitted.get(url)
        if previous is None:
            changes.append({"url": url, "changed_at": row["updated_at"]})
        elif row["updated_at"] > previous["content_changed_at"]:
            changes.append({"url": url, "changed_at": row["updated_at"]})
        elif previous["status"] == "failed":
            # Retry a failure without needing the content to change again.
            changes.append({"url": url, "changed_at": row["updated_at"]})
    return changes


async def submit(settings: Settings, *, dry_run: bool = False) -> dict[str, Any]:
    """Submit everything that genuinely changed. Never raises.

    Returns a report rather than throwing, because every caller of this wants to
    carry on regardless of the outcome.
    """
    if not is_configured(settings):
        return {
            "configured": False,
            "submitted": 0,
            "reason": "INDEXNOW_KEY is not set, or SITE_URL is not https",
        }

    changes = await pending_changes(settings)
    if not changes:
        return {"configured": True, "submitted": 0, "reason": "nothing changed"}

    batch = changes[:MAX_URLS_PER_REQUEST]
    urls = [c["url"] for c in batch]
    host = settings.site_url.split("://", 1)[1].rstrip("/")

    if dry_run:
        return {"configured": True, "submitted": 0, "would_submit": urls,
                "reason": "dry run"}

    payload = {
        "host": host,
        "key": settings.indexnow_key,
        # Proves we control the host: the endpoint fetches this and checks it
        # contains the key. Sent explicitly rather than relying on the default
        # location so the file can live wherever nginx serves it from.
        "keyLocation": f"{settings.site_url.rstrip('/')}/{settings.indexnow_key}.txt",
        "urlList": urls,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                INDEXNOW_ENDPOINT,
                json=payload,
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
        # 200 and 202 both mean accepted. 422 means the key or host was
        # rejected, which is a configuration problem worth surfacing loudly.
        ok = response.status_code in (200, 202)
        detail = None if ok else f"HTTP {response.status_code}"
    except Exception as exc:  # noqa: BLE001 — a notification must not raise
        ok = False
        detail = f"{type(exc).__name__}: {exc}"

    now = datetime.now(timezone.utc)
    for change in batch:
        await db.execute(
            """
            INSERT INTO indexnow_submissions
                (url, content_changed_at, last_submitted_at, status, attempts, last_error)
            VALUES (%s, %s, %s, %s, 1, %s)
            ON CONFLICT (url) DO UPDATE SET
                content_changed_at = EXCLUDED.content_changed_at,
                last_submitted_at  = EXCLUDED.last_submitted_at,
                status             = EXCLUDED.status,
                attempts           = indexnow_submissions.attempts + 1,
                last_error         = EXCLUDED.last_error
            """,
            (change["url"], change["changed_at"], now,
             "submitted" if ok else "failed", detail),
        )

    if ok:
        log.info("indexnow.submitted", count=len(urls))
    else:
        log.warning("indexnow.failed", count=len(urls), detail=detail)

    return {
        "configured": True,
        "submitted": len(urls) if ok else 0,
        "failed": 0 if ok else len(urls),
        "urls": urls,
        "error": detail,
    }


async def status(settings: Settings) -> dict[str, Any]:
    """What the admin panel shows. Never exposes the key itself."""
    rows = await db.fetch_all(
        """
        SELECT status, count(*) AS n, max(last_submitted_at) AS latest
          FROM indexnow_submissions GROUP BY status
        """
    )
    counts = {r["status"]: r["n"] for r in rows}
    latest = max((r["latest"] for r in rows if r["latest"]), default=None)
    changes = await pending_changes(settings) if is_configured(settings) else []

    return {
        "configured": is_configured(settings),
        # The key is a shared secret in the sense that it proves host control.
        # Whether one exists is useful; its value is never returned.
        "key_file": (
            f"{settings.site_url.rstrip('/')}/{settings.indexnow_key}.txt"
            if is_configured(settings) else None
        ),
        "submitted": counts.get("submitted", 0),
        "failed": counts.get("failed", 0),
        "last_submission_at": latest.isoformat() if latest else None,
        "pending_changes": len(changes),
    }
