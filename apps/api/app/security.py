"""Passwords, tokens and the primitives the auth routes are built from.

Design notes worth knowing:

* Passwords are argon2id. Not bcrypt (72-byte truncation, and its cost only
  scales with CPU), not PBKDF2 (cheap on GPUs). Parameters below are tuned for
  this 4 GB box: 64 MB of memory per hash is enough to make GPU cracking
  expensive without letting a burst of logins exhaust RAM.

* Refresh tokens are opaque random strings. Only their SHA-256 reaches the
  database, so a dump of `sessions` hands an attacker nothing usable.

* Access tokens are short-lived JWTs, so the common path (authorising a request)
  needs no database round trip, while revocation still works because refresh
  is a database row that can be deleted.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import Settings

# time_cost=3, memory_cost=64 MiB, parallelism=2. Measured ~120 ms per hash on
# this machine: slow enough to matter to an attacker, fast enough that a login
# does not feel broken.
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str | None) -> tuple[bool, str | None]:
    """Check a password. Returns (ok, new_hash_if_it_should_be_upgraded).

    A user who signed up with Google has no password hash. Comparing against a
    dummy hash rather than returning early keeps the timing of "no such account"
    and "wrong password" indistinguishable, so the endpoint cannot be used to
    enumerate which email addresses exist.
    """
    if not stored_hash:
        _dummy_verify()
        return False, None
    try:
        _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False, None
    if _hasher.check_needs_rehash(stored_hash):
        return True, _hasher.hash(password)
    return True, None


# A precomputed hash of a value nobody can supply, used to burn the same time as
# a real verification would.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(32))


def _dummy_verify() -> None:
    try:
        _hasher.verify(_DUMMY_HASH, "not-the-password")
    except Exception:  # noqa: BLE001 — always fails; we only want the delay
        pass


def password_problems(password: str, settings: Settings) -> list[str]:
    """Validate a new password.

    Length is the rule that actually correlates with strength, so it is the rule
    enforced. Composition requirements ("one symbol, one digit") push people
    toward Password1! and are deliberately absent.
    """
    problems: list[str] = []
    if len(password) < settings.password_min_length:
        problems.append(
            f"Password must be at least {settings.password_min_length} characters."
        )
    if len(password) > 1024:
        problems.append("Password is too long.")
    if password.strip() == "":
        problems.append("Password cannot be only spaces.")
    return problems


# ---------------------------------------------------------------------------
# Opaque tokens (refresh, email verification, password reset)
# ---------------------------------------------------------------------------
def new_opaque_token() -> str:
    """256 bits of entropy, URL-safe."""
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> bytes:
    """What we store. Never store the token itself."""
    return hashlib.sha256(token.encode("utf-8")).digest()


def tokens_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------
def issue_access_token(
    *, user_id: str, role: str, session_id: str, settings: Settings
) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    now = datetime.now(timezone.utc)
    ttl = settings.access_token_ttl_seconds
    payload = {
        "sub": str(user_id),
        "role": role,
        "sid": str(session_id),
        "iss": "pickixo",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, ttl


def decode_access_token(token: str, settings: Settings) -> dict[str, Any] | None:
    """Verify and decode. Returns None for anything not valid right now.

    The algorithm is pinned: accepting whatever the token's own header asks for
    is how JWT libraries get turned into signature bypasses.
    """
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer="pickixo",
            options={"require": ["exp", "iat", "sub", "iss"]},
        )
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Guests
# ---------------------------------------------------------------------------
def guest_key(ip: str, settings: Settings) -> bytes:
    """Identify a signed-out visitor for rate limiting without storing their IP.

    Salted so the stored value cannot be reversed by hashing the whole IPv4
    space, which is otherwise a few minutes of work.
    """
    return hashlib.sha256(
        settings.guest_key_salt.encode("utf-8") + b"|" + ip.encode("utf-8")
    ).digest()


# ---------------------------------------------------------------------------
# OAuth state
# ---------------------------------------------------------------------------
def sign_state(value: str, settings: Settings) -> str:
    """Sign an OAuth state value so the callback can trust it came from us."""
    mac = hmac.new(
        settings.jwt_secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()[:32]
    return f"{value}.{mac}"


def verify_state(signed: str, settings: Settings) -> str | None:
    try:
        value, mac = signed.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(
        settings.jwt_secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()[:32]
    return value if hmac.compare_digest(mac, expected) else None
