"""Closed testing — live tester activity for Google Play closed tests.

Play Console will not say which testers actually open an app, so each app says
it itself: one heartbeat on launch to `POST /testing/heartbeat`. That route is
public because an installed app has no Pickixo session; everything else here is
admin-only.

What the heartbeat can and cannot do:

* It only counts for a package listed in `closed_test_apps` and enabled. Any
  other package is accepted and ignored, so the response does not reveal which
  apps are being tested.
* It counts once per install per day, whatever the app sends. A loop in an app
  makes one row, not thousands.
* It can link an install to a tester only when the email is already on the
  tester list. It never adds a tester: the list is the Play Console list, and
  only an admin edits it.
* Nothing stops someone who reads an APK from inventing install ids. That would
  add fake rows to a private dashboard, not reach anything else; delete the app
  and re-add it to wipe them.
"""
from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .. import db
from ..dependencies import AdminUser
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/testing", tags=["testing"])

#: The testers' day. A heartbeat at 01:00 in Dhaka belongs to that day, not to
#: the UTC day before it.
TESTER_TZ = "Asia/Dhaka"

#: Loose on purpose: Play accepts any Google account address, and a stricter
#: pattern would only reject real testers.
EMAIL_RE = re.compile(r"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")

MAX_EMAILS_PER_REQUEST = 2000


async def _audit(actor_id: str, action: str, target: str | None, detail: dict) -> None:
    await db.execute(
        "INSERT INTO audit_logs (actor_id, action, target, detail) "
        "VALUES (%s, %s, %s, %s)",
        (actor_id, action, target, json.dumps(detail)),
    )


# ---------------------------------------------------------------------------
# Public: the heartbeat
# ---------------------------------------------------------------------------
class HeartbeatRequest(BaseModel):
    package: str = Field(min_length=3, max_length=200)
    install_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    email: str | None = Field(default=None, max_length=254)
    device: str = Field(default="", max_length=100)
    app_version: str = Field(default="", max_length=40)


@router.post("/heartbeat")
async def heartbeat(body: HeartbeatRequest) -> dict:
    email = (body.email or "").strip().lower() or None
    if email and not EMAIL_RE.match(email):
        email = None

    # One statement: the install upsert and the day upsert succeed together, and
    # an unknown or disabled package matches no row and writes nothing.
    counted = await db.fetch_value(
        """
        WITH app AS (
            SELECT id FROM closed_test_apps WHERE package = %s AND enabled
        ), install AS (
            INSERT INTO closed_test_installs (app_id, install_id, tester_id, device, app_version)
            SELECT app.id, %s,
                   (SELECT id FROM closed_test_testers WHERE email = %s),
                   %s, %s
              FROM app
            ON CONFLICT (app_id, install_id) DO UPDATE
               SET last_seen   = now(),
                   device      = EXCLUDED.device,
                   app_version = EXCLUDED.app_version,
                   tester_id   = coalesce(EXCLUDED.tester_id, closed_test_installs.tester_id)
            RETURNING id
        )
        INSERT INTO closed_test_activity (install_id, day)
        SELECT id, (now() AT TIME ZONE %s)::date FROM install
        ON CONFLICT (install_id, day) DO UPDATE
           SET opens = closed_test_activity.opens + 1
        RETURNING true
        """,
        (body.package, body.install_id, email, body.device.strip(),
         body.app_version.strip(), TESTER_TZ),
    )
    return {"ok": True, "counted": bool(counted)}


# ---------------------------------------------------------------------------
# Admin: the panel
# ---------------------------------------------------------------------------
def _streak(days: set[date], today: date) -> int:
    """Consecutive days with activity, ending today — or yesterday, so a tester
    who has not opened the app yet today is not shown as having broken it."""
    cursor = today if today in days else today - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


@router.get("/overview")
async def overview(
    admin: AdminUser, window: int = Query(default=14, ge=7, le=60)
) -> dict[str, Any]:
    today: date = await db.fetch_value(
        "SELECT (now() AT TIME ZONE %s)::date", (TESTER_TZ,)
    )
    since = today - timedelta(days=window + 60)  # extra history for streaks

    testers = await db.fetch_all(
        "SELECT id, email, name, created_at FROM closed_test_testers ORDER BY email"
    )
    apps = await db.fetch_all(
        """
        SELECT id, package, name, test_started_on, required_testers,
               required_days, enabled, created_at
          FROM closed_test_apps ORDER BY created_at, name
        """
    )
    installs = await db.fetch_all(
        """
        SELECT i.id, i.app_id, i.tester_id, i.device, i.app_version,
               i.first_seen, i.last_seen,
               coalesce(array_agg(a.day ORDER BY a.day)
                        FILTER (WHERE a.day IS NOT NULL), '{}') AS days
          FROM closed_test_installs i
          LEFT JOIN closed_test_activity a
                 ON a.install_id = i.id AND a.day >= %s
         GROUP BY i.id
         ORDER BY i.last_seen DESC
        """,
        (since,),
    )

    by_app: dict[Any, list[dict]] = {}
    for row in installs:
        days = set(row["days"])
        by_app.setdefault(row["app_id"], []).append({
            "id": row["id"],
            "tester_id": row["tester_id"],
            "device": row["device"],
            "app_version": row["app_version"],
            "first_seen": row["first_seen"],
            "last_seen": row["last_seen"],
            "days": sorted(d for d in days if d > today - timedelta(days=window)),
            "streak": _streak(days, today),
            "active_today": today in days,
        })

    result = []
    for app in apps:
        rows = by_app.get(app["id"], [])
        result.append({
            **app,
            "installs": rows,
            "active_today": sum(1 for r in rows if r["active_today"]),
            "qualified": sum(1 for r in rows if r["streak"] >= app["required_days"]),
        })
    return {"today": today, "window": window, "testers": testers, "apps": result}


class AddTestersRequest(BaseModel):
    #: Free text: one address per line, or comma/semicolon separated, or a CSV
    #: pasted whole. Anything that is not an address is skipped and reported.
    text: str = Field(max_length=200_000)


@router.post("/testers")
async def add_testers(body: AddTestersRequest, admin: AdminUser) -> dict:
    tokens = [t.strip().strip('"\'').lower() for t in re.split(r"[\s,;]+", body.text)]
    tokens = [t for t in tokens if t]
    emails = sorted({t for t in tokens if EMAIL_RE.match(t)})
    skipped = sorted({t for t in tokens if not EMAIL_RE.match(t)})[:50]
    if not emails:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="no email addresses found")
    if len(emails) > MAX_EMAILS_PER_REQUEST:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="too many addresses at once")

    rows = await db.fetch_all(
        """
        INSERT INTO closed_test_testers (email)
        SELECT unnest(%s::text[])
        ON CONFLICT (email) DO NOTHING
        RETURNING email
        """,
        (emails,),
    )
    added = [r["email"] for r in rows]
    if added:
        await _audit(str(admin["id"]), "testers_added", None, {"count": len(added)})
    return {
        "added": added,
        "already_listed": [e for e in emails if e not in set(added)],
        "skipped": skipped,
    }


@router.delete("/testers/{tester_id}")
async def remove_tester(tester_id: UUID, admin: AdminUser) -> dict:
    email = await db.fetch_value(
        "DELETE FROM closed_test_testers WHERE id = %s RETURNING email", (tester_id,)
    )
    if not email:
        raise AppError(ErrorCode.NOT_FOUND, detail="no such tester")
    await _audit(str(admin["id"]), "tester_removed", email, {})
    return {"removed": email}


class AppRequest(BaseModel):
    package: str | None = Field(default=None, min_length=3, max_length=200,
                                pattern=r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    test_started_on: date | None = None
    required_testers: int | None = Field(default=None, ge=1, le=500)
    required_days: int | None = Field(default=None, ge=1, le=90)
    enabled: bool | None = None


@router.post("/apps")
async def add_app(body: AppRequest, admin: AdminUser) -> dict:
    if not body.package or not body.name:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="package and name are required")
    row = await db.fetch_one(
        """
        INSERT INTO closed_test_apps (package, name, test_started_on,
                                      required_testers, required_days)
        VALUES (%s, %s, %s, coalesce(%s, 12), coalesce(%s, 14))
        ON CONFLICT (package) DO NOTHING
        RETURNING id
        """,
        (body.package, body.name.strip(), body.test_started_on,
         body.required_testers, body.required_days),
    )
    if row is None:
        raise AppError(ErrorCode.CONFLICT, detail="that package is already listed")
    await _audit(str(admin["id"]), "test_app_added", body.package, {})
    return {"id": row["id"]}


@router.patch("/apps/{app_id}")
async def update_app(app_id: UUID, body: AppRequest, admin: AdminUser) -> dict:
    changes = body.model_dump(exclude_unset=True, exclude={"package"})
    if not changes:
        raise AppError(ErrorCode.INVALID_REQUEST, detail="no fields to update")
    # Column names come from the model's own field names, never from the request.
    allowed = ("name", "test_started_on", "required_testers", "required_days", "enabled")
    fields = [f"{k} = %s" for k in allowed if k in changes]
    params = [changes[k] for k in allowed if k in changes]
    updated = await db.execute(
        f"UPDATE closed_test_apps SET {', '.join(fields)} WHERE id = %s",
        [*params, app_id],
    )
    if not updated:
        raise AppError(ErrorCode.NOT_FOUND, detail="no such app")
    await _audit(str(admin["id"]), "test_app_updated", str(app_id),
                 json.loads(json.dumps(changes, default=str)))
    return {"updated": True}


@router.delete("/apps/{app_id}")
async def remove_app(app_id: UUID, admin: AdminUser) -> dict:
    package = await db.fetch_value(
        "DELETE FROM closed_test_apps WHERE id = %s RETURNING package", (app_id,)
    )
    if not package:
        raise AppError(ErrorCode.NOT_FOUND, detail="no such app")
    await _audit(str(admin["id"]), "test_app_removed", package, {})
    return {"removed": package}


class LinkInstallRequest(BaseModel):
    tester_id: UUID | None = None


@router.patch("/installs/{install_id}")
async def link_install(install_id: UUID, body: LinkInstallRequest, admin: AdminUser) -> dict:
    """Say which tester an install belongs to, for apps that do not send an email."""
    updated = await db.execute(
        "UPDATE closed_test_installs SET tester_id = %s WHERE id = %s",
        (body.tester_id, install_id),
    )
    if not updated:
        raise AppError(ErrorCode.NOT_FOUND, detail="no such install")
    return {"updated": True}
