"""Account creation, sign-in, session rotation and Google sign-in.

One account, several ways in (§12). An email sign-up and a Google sign-in with
the same verified address resolve to the same `users` row through `identities`,
so a user who switches method keeps their My Apps, favourites and history rather
than silently starting a second account.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt

from .. import db
from ..config import Settings
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger
from ..security import (
    decode_access_token,
    hash_password,
    issue_access_token,
    new_opaque_token,
    password_problems,
    token_digest,
    verify_password,
)

log = get_logger(__name__)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


# ===========================================================================
# Sessions
# ===========================================================================
async def _create_session(
    conn, user_id: str, *, user_agent: str | None, ip: str | None, settings: Settings
) -> tuple[str, str]:
    """Open a session. Returns (refresh_token, session_id).

    family_id starts equal to the session id and is carried through every
    rotation, so a stolen-and-replayed token can be traced to the whole chain
    it belongs to and that chain revoked as a unit.
    """
    refresh = new_opaque_token()
    expires = datetime.now(timezone.utc) + timedelta(
        seconds=settings.refresh_token_ttl_seconds
    )
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO sessions
                (user_id, family_id, refresh_token_hash, user_agent, ip, expires_at)
            VALUES (%s, gen_random_uuid(), %s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, token_digest(refresh), user_agent, ip, expires),
        )
        row = await cur.fetchone()
    return refresh, str(row["id"])


async def rotate_session(
    refresh_token: str, *, user_agent: str | None, ip: str | None, settings: Settings
) -> dict[str, Any]:
    """Exchange a refresh token for a new one plus a fresh access token.

    Reuse detection: a token that has already been rotated is, by definition,
    one that should no longer exist. Seeing it again means it leaked, so the
    entire family is revoked and the user has to sign in again. Being logged out
    is a far better outcome than an attacker holding a live session.

    Note the shape of this function. Nothing raises inside the transaction, and
    that is deliberate rather than stylistic: raising there rolls the
    transaction back, which would undo the very revocation the exception is
    reporting. The first version of this did exactly that — the stolen token was
    rejected, but the family stayed live, so the defence looked like it worked
    and did nothing. The decision is made under the row lock; the consequences
    are applied after it commits.
    """
    digest = token_digest(refresh_token)

    reuse_family: str | None = None
    reuse_user: str | None = None
    failure: ErrorCode | None = None
    row = new_row = None
    new_refresh = ""

    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT s.id, s.user_id, s.family_id, s.expires_at,
                       s.rotated_at, s.revoked_at, u.role, u.status
                  FROM sessions s
                  JOIN users u ON u.id = s.user_id
                 WHERE s.refresh_token_hash = %s
                 FOR UPDATE OF s
                """,
                (digest,),
            )
            row = await cur.fetchone()

            if row is None:
                failure = ErrorCode.SESSION_INVALID
            elif row["rotated_at"] is not None:
                reuse_family = str(row["family_id"])
                reuse_user = str(row["user_id"])
            elif row["revoked_at"] is not None:
                failure = ErrorCode.SESSION_INVALID
            elif row["expires_at"] <= datetime.now(timezone.utc):
                failure = ErrorCode.SESSION_EXPIRED
            elif row["status"] != "active":
                failure = ErrorCode.ACCOUNT_SUSPENDED
            else:
                new_refresh = new_opaque_token()
                expires = datetime.now(timezone.utc) + timedelta(
                    seconds=settings.refresh_token_ttl_seconds
                )
                await cur.execute(
                    "UPDATE sessions SET rotated_at = now() WHERE id = %s",
                    (row["id"],),
                )
                await cur.execute(
                    """
                    INSERT INTO sessions
                        (user_id, family_id, refresh_token_hash, user_agent, ip,
                         expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (row["user_id"], row["family_id"], token_digest(new_refresh),
                     user_agent, ip, expires),
                )
                new_row = await cur.fetchone()

    # --- past this point the transaction above has committed ----------------
    if reuse_family is not None:
        await db.execute(
            "UPDATE sessions SET revoked_at = now() "
            " WHERE family_id = %s AND revoked_at IS NULL",
            (reuse_family,),
        )
        log.warning(
            "auth.refresh_reuse_detected",
            user_id=reuse_user,
            family_id=reuse_family,
        )
        raise AppError(ErrorCode.SESSION_INVALID, detail="refresh token reuse")

    if failure is not None:
        raise AppError(failure, detail="refresh rejected")

    access, ttl = issue_access_token(
        user_id=str(row["user_id"]), role=row["role"],
        session_id=str(new_row["id"]), settings=settings,
    )
    return {
        "access_token": access,
        "expires_in": ttl,
        "refresh_token": new_refresh,
        "user_id": str(row["user_id"]),
    }


async def revoke_session(refresh_token: str) -> None:
    """Sign out this device. Never raises: signing out must always appear to work."""
    await db.execute(
        "UPDATE sessions SET revoked_at = now() "
        " WHERE refresh_token_hash = %s AND revoked_at IS NULL",
        (token_digest(refresh_token),),
    )


async def revoke_all_sessions(user_id: str) -> int:
    return await db.execute(
        "UPDATE sessions SET revoked_at = now() "
        " WHERE user_id = %s AND revoked_at IS NULL",
        (user_id,),
    )


# ===========================================================================
# Email + password
# ===========================================================================
async def sign_up(
    *, email: str, password: str, display_name: str | None,
    user_agent: str | None, ip: str | None, settings: Settings,
) -> dict[str, Any]:
    email = email.strip().lower()
    problems = password_problems(password, settings)
    if problems:
        raise AppError(
            ErrorCode.WEAK_PASSWORD,
            detail="; ".join(problems),
            meta={"minLength": settings.password_min_length},
        )
    if "@" not in email or len(email) > 320:
        raise AppError(ErrorCode.INVALID_EMAIL, detail="email failed basic validation")

    pw_hash = hash_password(password)

    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id, password_hash FROM users WHERE email = %s",
                              (email,))
            existing = await cur.fetchone()

            if existing is not None:
                # The address is taken. If it was taken by a Google-only account,
                # attaching a password here would let anyone who knows the address
                # set one, so both cases get the same answer and no hint about
                # which it was.
                raise AppError(ErrorCode.EMAIL_TAKEN, detail="email already registered")

            await cur.execute(
                """
                INSERT INTO users (email, password_hash, display_name)
                VALUES (%s, %s, %s)
                RETURNING id, role
                """,
                (email, pw_hash, (display_name or "").strip() or None),
            )
            user = await cur.fetchone()
            await cur.execute(
                "INSERT INTO identities (user_id, provider, provider_uid) "
                "VALUES (%s, 'email', %s)",
                (user["id"], email),
            )
            await cur.execute(
                "INSERT INTO user_settings (user_id) VALUES (%s) "
                "ON CONFLICT DO NOTHING",
                (user["id"],),
            )
            await cur.execute(
                "INSERT INTO activity_events (user_id, event) VALUES (%s, 'signup')",
                (user["id"],),
            )
            refresh, session_id = await _create_session(
                conn, str(user["id"]), user_agent=user_agent, ip=ip, settings=settings
            )

    access, ttl = issue_access_token(
        user_id=str(user["id"]), role=user["role"],
        session_id=session_id, settings=settings,
    )
    log.info("auth.account_created", user_id=str(user["id"]))
    return {"access_token": access, "expires_in": ttl, "refresh_token": refresh,
            "user_id": str(user["id"])}


async def sign_in(
    *, email: str, password: str, user_agent: str | None, ip: str | None,
    settings: Settings,
) -> dict[str, Any]:
    email = email.strip().lower()

    row = await db.fetch_one(
        "SELECT id, password_hash, role, status FROM users WHERE email = %s", (email,)
    )

    # verify_password burns the same time against a dummy hash when the account
    # does not exist, so this path cannot be used to enumerate addresses.
    ok, upgraded = verify_password(password, row["password_hash"] if row else None)
    if row is None or not ok:
        raise AppError(ErrorCode.INVALID_CREDENTIALS, detail="bad email or password")
    if row["status"] != "active":
        raise AppError(ErrorCode.ACCOUNT_SUSPENDED, detail="account not active")

    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            if upgraded:
                await cur.execute("UPDATE users SET password_hash = %s WHERE id = %s",
                                  (upgraded, row["id"]))
            await cur.execute("UPDATE users SET last_login_at = now() WHERE id = %s",
                              (row["id"],))
            await cur.execute(
                "INSERT INTO activity_events (user_id, event) VALUES (%s, 'login')",
                (row["id"],),
            )
            refresh, session_id = await _create_session(
                conn, str(row["id"]), user_agent=user_agent, ip=ip, settings=settings
            )

    access, ttl = issue_access_token(
        user_id=str(row["id"]), role=row["role"], session_id=session_id,
        settings=settings,
    )
    return {"access_token": access, "expires_in": ttl, "refresh_token": refresh,
            "user_id": str(row["id"])}


# ===========================================================================
# Google sign-in
# ===========================================================================
def google_authorize_url(state: str, settings: Settings) -> str:
    if not settings.google_enabled:
        raise AppError(ErrorCode.GOOGLE_NOT_CONFIGURED, detail="google oauth keys absent")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        # We only need identity, so we never ask for offline access: there is no
        # Google refresh token to store, and therefore none to leak.
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}


async def _google_jwks() -> dict[str, Any]:
    """Google's signing keys, cached for an hour.

    Fetched rather than pinned because Google rotates them; cached because
    fetching on every sign-in would make Google's availability our own.
    """
    now = time.monotonic()
    if _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < 3600:
        return _jwks_cache["keys"]
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(GOOGLE_JWKS_URI)
        response.raise_for_status()
        keys = response.json()
    _jwks_cache.update(keys=keys, fetched_at=now)
    return keys


async def _verify_google_id_token(id_token: str, settings: Settings) -> dict[str, Any]:
    """Verify the signature and claims ourselves.

    Decoding without verification and trusting the payload is the classic way
    this integration goes wrong: anyone could then mint a token claiming any
    email address. The signature, the audience and the issuer are all checked.
    """
    jwks = await _google_jwks()
    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.PyJWTError as exc:
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail=str(exc)) from exc

    key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")),
                    None)
    if key_data is None:
        # A rotation we have not picked up yet: refetch once before giving up.
        _jwks_cache["keys"] = None
        jwks = await _google_jwks()
        key_data = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None
        )
    if key_data is None:
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail="id_token not verifiable")

    try:
        key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail=str(exc)) from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail="id_token not verifiable")
    return claims


async def google_callback(
    *, code: str, user_agent: str | None, ip: str | None, settings: Settings
) -> dict[str, Any]:
    if not settings.google_enabled:
        raise AppError(ErrorCode.GOOGLE_NOT_CONFIGURED, detail="google oauth keys absent")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        log.warning("auth.google_token_exchange_failed",
                    status=response.status_code)
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail="id_token not verifiable")

    id_token = response.json().get("id_token")
    if not id_token:
        raise AppError(ErrorCode.GOOGLE_SIGN_IN_FAILED, detail="id_token not verifiable")

    claims = await _verify_google_id_token(id_token, settings)

    google_sub = claims["sub"]
    email = (claims.get("email") or "").strip().lower()
    email_verified = bool(claims.get("email_verified"))
    name = claims.get("name")
    picture = claims.get("picture")

    if not email or not email_verified:
        # Linking an unverified address to an existing account would let anyone
        # who can create a Google account with someone else's address take it
        # over. Refuse rather than guess.
        raise AppError(ErrorCode.GOOGLE_EMAIL_UNVERIFIED, detail="unverified google email")

    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            # 1. Already linked?
            await cur.execute(
                """
                SELECT u.id, u.role, u.status
                  FROM identities i JOIN users u ON u.id = i.user_id
                 WHERE i.provider = 'google' AND i.provider_uid = %s
                """,
                (google_sub,),
            )
            user = await cur.fetchone()

            if user is None:
                # 2. An account with this verified address already exists —
                #    attach Google to it rather than creating a duplicate (§12).
                await cur.execute(
                    "SELECT id, role, status FROM users WHERE email = %s", (email,)
                )
                user = await cur.fetchone()

                if user is None:
                    # 3. Brand new account.
                    await cur.execute(
                        """
                        INSERT INTO users
                            (email, display_name, avatar_url, email_verified_at)
                        VALUES (%s, %s, %s, now())
                        RETURNING id, role, status
                        """,
                        (email, name, picture),
                    )
                    user = await cur.fetchone()
                    await cur.execute(
                        "INSERT INTO user_settings (user_id) VALUES (%s) "
                        "ON CONFLICT DO NOTHING",
                        (user["id"],),
                    )
                    await cur.execute(
                        "INSERT INTO activity_events (user_id, event) "
                        "VALUES (%s, 'signup')",
                        (user["id"],),
                    )

                await cur.execute(
                    """
                    INSERT INTO identities (user_id, provider, provider_uid, provider_data)
                    VALUES (%s, 'google', %s, %s)
                    ON CONFLICT (provider, provider_uid) DO NOTHING
                    """,
                    (user["id"], google_sub,
                     json.dumps({"name": name, "picture": picture})),
                )

            if user["status"] != "active":
                raise AppError(ErrorCode.ACCOUNT_SUSPENDED, detail="account not active")

            await cur.execute(
                "UPDATE users SET last_login_at = now(), "
                "       email_verified_at = coalesce(email_verified_at, now()) "
                " WHERE id = %s",
                (user["id"],),
            )
            await cur.execute(
                "INSERT INTO activity_events (user_id, event) VALUES (%s, 'login')",
                (user["id"],),
            )
            refresh, session_id = await _create_session(
                conn, str(user["id"]), user_agent=user_agent, ip=ip, settings=settings
            )

    access, ttl = issue_access_token(
        user_id=str(user["id"]), role=user["role"], session_id=session_id,
        settings=settings,
    )
    return {"access_token": access, "expires_in": ttl, "refresh_token": refresh,
            "user_id": str(user["id"])}


# ===========================================================================
# Request authorisation
# ===========================================================================
async def user_from_access_token(token: str, settings: Settings) -> dict | None:
    """Resolve a bearer token to a user, or None.

    The JWT signature is the fast path, but a token stays cryptographically
    valid until it expires even if the session was revoked seconds ago. For a
    15-minute window that is the usual trade; here the session row is checked
    too, so "sign out everywhere" takes effect immediately.
    """
    claims = decode_access_token(token, settings)
    if claims is None:
        return None
    row = await db.fetch_one(
        """
        SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.locale
          FROM users u
          JOIN sessions s ON s.user_id = u.id
         WHERE u.id = %s AND s.id = %s
           AND s.revoked_at IS NULL AND s.expires_at > now()
        """,
        (claims["sub"], claims["sid"]),
    )
    if row is None or row["status"] != "active":
        return None
    return row
