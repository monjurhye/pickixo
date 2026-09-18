"""FastAPI dependencies: who is calling, and are they allowed to.

Authorisation is decided here and nowhere else, so a route cannot accidentally
skip it by forgetting a check — it either declares a dependency that returns a
user or it does not receive one.
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Header, Request

from .config import Settings, get_settings
from .errors import AppError, ErrorCode
from .security import guest_key
from .services import auth as auth_service

SettingsDep = Annotated[Settings, Depends(get_settings)]


def client_ip(request: Request) -> str:
    """The caller address, trusting the proxy header only when there is a proxy.

    X-Forwarded-For is attacker-controlled unless something in front of the app
    overwrites it. nginx does that in the shipped config, so the leftmost entry
    is used in production and the socket address in development.
    """
    settings = get_settings()
    if settings.is_production:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


async def optional_user(
    request: Request,
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any] | None:
    """The signed-in user, or None. Never raises.

    Used by routes that work for everyone but do more when signed in — a tool
    landing page, or an AI call within the guest allowance.
    """
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        # Browsers send the httpOnly access cookie automatically, which is how
        # server-rendered pages authenticate without ever putting a token into
        # JavaScript. The header still wins, so non-browser clients are
        # unaffected.
        token = request.cookies.get("pickixo_access")
    if not token:
        return None
    return await auth_service.user_from_access_token(token, settings)


async def current_user(
    user: Annotated[dict | None, Depends(optional_user)],
) -> dict[str, Any]:
    """The signed-in user. Raises 401 when there is not one."""
    if user is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, detail="no valid access token")
    return user


async def admin_user(
    user: Annotated[dict, Depends(current_user)],
) -> dict[str, Any]:
    """An administrator.

    Role comes from the database row loaded for this request, not from the JWT
    claim: a token minted before a demotion would still carry role=admin, and
    an admin panel is precisely where that must not be trusted. It is also not
    an email-address comparison (§79).
    """
    if user.get("role") != "admin":
        raise AppError(ErrorCode.FORBIDDEN, detail="admin role required")
    return user


def quota_identity(
    request: Request, user: dict | None, settings: Settings
) -> tuple[str | None, bytes | None, bool]:
    """Return (user_id, guest_key, is_guest) for the quota ledger.

    Exactly one of the first two is ever non-None, which is what consume_quota
    requires and asserts.
    """
    if user is not None:
        return str(user["id"]), None, False
    return None, guest_key(client_ip(request), settings), True


CurrentUser = Annotated[dict, Depends(current_user)]
OptionalUser = Annotated[dict | None, Depends(optional_user)]
AdminUser = Annotated[dict, Depends(admin_user)]
