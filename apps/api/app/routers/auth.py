"""Sign up, sign in, refresh, sign out, and Google sign-in.

The refresh token is delivered as an httpOnly cookie and never appears in a
response body, so page JavaScript cannot read it and an XSS bug cannot steal a
30-day credential. The access token is returned in the body and held in memory
by the client.
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse

from ..config import Settings
from ..dependencies import CurrentUser, SettingsDep, client_ip
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..schemas import SessionResponse, SignInRequest, SignUpRequest, UserResponse
from ..security import sign_state, verify_state
from ..services import auth as auth_service

log = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

OAUTH_STATE_COOKIE = "pickixo_oauth_state"
ACCESS_COOKIE = "pickixo_access"


def _set_access_cookie(
    response: Response, token: str, ttl: int, settings: Settings
) -> None:
    """Mirror the access token into an httpOnly cookie.

    Two reasons it is a cookie rather than a value the page holds:

    * Server components need the session to render the dashboard. Without a
      cookie the only way for them to get one would be to spend the refresh
      token on every render, which would rotate a 30-day credential on a page
      reload.
    * httpOnly means page JavaScript cannot read it at all, so an XSS bug
      cannot exfiltrate the session — it can only act inside the current page.

    SameSite=lax is what stops this becoming a CSRF hole: the browser will not
    attach it to a cross-site POST, PATCH, PUT or DELETE, which is every
    state-changing route this API has.
    """
    response.set_cookie(
        ACCESS_COOKIE,
        token,
        max_age=ttl,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
        domain=settings.session_cookie_domain or None,
    )


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.refresh_token_ttl_seconds,
        httponly=True,
        # 'lax' still sends the cookie on the top-level redirect back from
        # Google, while blocking it on cross-site POSTs — which is the CSRF
        # case that matters here.
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
        domain=settings.session_cookie_domain or None,
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    for name in (settings.session_cookie_name, ACCESS_COOKIE):
        response.delete_cookie(
            name, path="/", domain=settings.session_cookie_domain or None
        )


async def _session_body(result: dict) -> SessionResponse:
    from .. import db

    user = await db.fetch_one(
        "SELECT id, email, display_name, avatar_url, role, locale FROM users "
        " WHERE id = %s",
        (result["user_id"],),
    )
    return SessionResponse(
        access_token=result["access_token"],
        expires_in=result["expires_in"],
        user=UserResponse(**user),
    )


@router.post("/sign-up", response_model=SessionResponse, status_code=201)
async def sign_up(
    body: SignUpRequest, request: Request, response: Response, settings: SettingsDep
) -> SessionResponse:
    result = await auth_service.sign_up(
        email=body.email,
        password=body.password,
        display_name=body.display_name,
        user_agent=request.headers.get("user-agent"),
        ip=client_ip(request),
        settings=settings,
    )
    _set_refresh_cookie(response, result["refresh_token"], settings)
    _set_access_cookie(response, result["access_token"], result["expires_in"], settings)
    return await _session_body(result)


@router.post("/sign-in", response_model=SessionResponse)
async def sign_in(
    body: SignInRequest, request: Request, response: Response, settings: SettingsDep
) -> SessionResponse:
    result = await auth_service.sign_in(
        email=body.email,
        password=body.password,
        user_agent=request.headers.get("user-agent"),
        ip=client_ip(request),
        settings=settings,
    )
    _set_refresh_cookie(response, result["refresh_token"], settings)
    _set_access_cookie(response, result["access_token"], result["expires_in"], settings)
    return await _session_body(result)


@router.post("/refresh", response_model=SessionResponse)
async def refresh(
    request: Request, response: Response, settings: SettingsDep
) -> SessionResponse:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise AppError(ErrorCode.SESSION_INVALID, detail="no refresh cookie")
    try:
        result = await auth_service.rotate_session(
            token,
            user_agent=request.headers.get("user-agent"),
            ip=client_ip(request),
            settings=settings,
        )
    except AppError:
        # A refresh that cannot succeed should also leave the browser clean,
        # otherwise the client retries a dead cookie on every page load.
        _clear_refresh_cookie(response, settings)
        raise
    _set_refresh_cookie(response, result["refresh_token"], settings)
    _set_access_cookie(response, result["access_token"], result["expires_in"], settings)
    return await _session_body(result)


@router.post("/sign-out", status_code=204, response_class=Response)
async def sign_out(
    request: Request, response: Response, settings: SettingsDep
) -> Response:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await auth_service.revoke_session(token)
    _clear_refresh_cookie(response, settings)
    return Response(status_code=204)


@router.post("/sign-out-everywhere", status_code=204, response_class=Response)
async def sign_out_everywhere(
    user: CurrentUser, response: Response, settings: SettingsDep
) -> Response:
    count = await auth_service.revoke_all_sessions(str(user["id"]))
    log.info("auth.all_sessions_revoked", user_id=str(user["id"]),
             sessions=count)
    _clear_refresh_cookie(response, settings)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------
@router.get("/google/start")
async def google_start(response: Response, settings: SettingsDep) -> RedirectResponse:
    """Begin Google sign-in.

    The state value is random, signed, and also stored in a short-lived cookie.
    The callback requires both to agree, which is what stops an attacker from
    completing someone else's sign-in flow.
    """
    if not settings.google_enabled:
        raise AppError(ErrorCode.GOOGLE_NOT_CONFIGURED, detail="google keys absent")

    nonce = secrets.token_urlsafe(16)
    state = sign_state(nonce, settings)
    redirect = RedirectResponse(
        auth_service.google_authorize_url(state, settings), status_code=307
    )
    redirect.set_cookie(
        OAUTH_STATE_COOKIE, nonce, max_age=600, httponly=True,
        samesite="lax", secure=settings.session_cookie_secure, path="/",
    )
    return redirect


@router.get("/google/callback")
async def google_callback(
    request: Request, settings: SettingsDep, code: str = "", state: str = "",
    error: str = "",
) -> RedirectResponse:
    base = settings.app_base_url.rstrip("/")

    def fail(reason: str) -> RedirectResponse:
        log.warning("auth.google_rejected", reason=reason)
        return RedirectResponse(f"{base}/sign-in?error=google", status_code=303)

    if error or not code or not state:
        return fail(error or "missing code or state")

    expected = request.cookies.get(OAUTH_STATE_COOKIE)
    nonce = verify_state(state, settings)
    if not expected or not nonce or nonce != expected:
        return fail("state mismatch")

    try:
        result = await auth_service.google_callback(
            code=code,
            user_agent=request.headers.get("user-agent"),
            ip=client_ip(request),
            settings=settings,
        )
    except AppError as exc:
        return fail(exc.code.value)

    redirect = RedirectResponse(f"{base}/dashboard", status_code=303)
    _set_refresh_cookie(redirect, result["refresh_token"], settings)
    _set_access_cookie(redirect, result["access_token"], result["expires_in"], settings)
    redirect.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return redirect


@router.get("/providers")
async def auth_providers(settings: SettingsDep) -> dict:
    """What sign-in methods this server actually supports.

    The sign-in page asks before rendering a Google button, so an unconfigured
    deployment shows no button rather than one that fails (§123).
    """
    return {"email": True, "google": settings.google_enabled}
