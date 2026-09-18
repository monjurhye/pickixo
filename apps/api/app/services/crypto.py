"""Encryption for credentials held at rest.

There is exactly one thing in this application that is someone else's bearer
credential: a Facebook Page access token. Whoever holds it can post to that
Page. So it is encrypted in the database, decrypted only inside the backend
process that is about to make a Graph API call, and never returned by any
endpoint, logged, or put into an AI prompt.

AES-256-GCM rather than something like Fernet because GCM is authenticated: a
row that has been tampered with fails to decrypt instead of yielding attacker
chosen plaintext. The nonce is stored alongside the ciphertext because it must
be unique per encryption, not secret.

The stored format is a single string so it fits one text column:

    v1.<base64url nonce>.<base64url ciphertext+tag>

The version prefix is not decoration. It is the thing that makes it possible to
change algorithm later and still read old rows, rather than discovering that
every stored token is unreadable after a deploy.
"""
from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..logging_config import get_logger

log = get_logger(__name__)

_VERSION = "v1"
_NONCE_BYTES = 12          # 96 bits, the size GCM is specified for
_KEY_BYTES = 32            # AES-256


class CryptoNotConfigured(RuntimeError):
    """No key is set, so nothing can be encrypted or decrypted."""


class DecryptionFailed(RuntimeError):
    """The value could not be decrypted.

    Raised for a wrong key, a corrupted row, or a tampered one — deliberately
    without saying which. The caller's only correct response is the same in
    every case: treat the credential as lost and ask for the Page to be
    reconnected.
    """


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(text: str) -> bytes:
    # urlsafe_b64decode is strict about padding; it was stripped when encoding
    # so that the stored string has no '=' to confuse anything reading it.
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def load_key(configured: str) -> bytes:
    """Turn the configured key into 32 raw bytes, or refuse.

    Accepts base64 (how it should be generated) and falls back to raw bytes so
    that a key produced by a different tool still works. A key of the wrong
    length is refused rather than padded or truncated: silently weakening the
    cipher because the key looked roughly right is worse than not starting.
    """
    if not configured:
        raise CryptoNotConfigured("FACEBOOK_TOKEN_KEY is not set")

    try:
        raw = _b64d(configured)
    except Exception:  # noqa: BLE001
        raw = configured.encode("utf-8")

    if len(raw) != _KEY_BYTES:
        # Try the plain-bytes reading before giving up — a 32-character ASCII
        # key is valid, and base64-decoding it would have produced 24 bytes.
        candidate = configured.encode("utf-8")
        if len(candidate) == _KEY_BYTES:
            raw = candidate
        else:
            raise CryptoNotConfigured(
                f"FACEBOOK_TOKEN_KEY must decode to {_KEY_BYTES} bytes, "
                f"got {len(raw)}"
            )
    return raw


def generate_key() -> str:
    """A fresh base64 key, for documentation and setup instructions.

    Never called by the application itself — only by an operator generating a
    value to put in the environment.
    """
    return base64.urlsafe_b64encode(os.urandom(_KEY_BYTES)).decode("ascii").rstrip("=")


def encrypt(plaintext: str, *, key: str) -> str:
    """Encrypt a credential for storage."""
    if not plaintext:
        raise ValueError("refusing to encrypt an empty value")
    aes = AESGCM(load_key(key))
    nonce = os.urandom(_NONCE_BYTES)
    sealed = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    return f"{_VERSION}.{_b64e(nonce)}.{_b64e(sealed)}"


def decrypt(stored: str, *, key: str) -> str:
    """Recover a credential. Never logs the value, or the reason it failed."""
    if not stored:
        raise DecryptionFailed("nothing stored")

    parts = stored.split(".")
    if len(parts) != 3 or parts[0] != _VERSION:
        raise DecryptionFailed("unrecognised ciphertext format")

    _, nonce_b64, payload_b64 = parts
    try:
        aes = AESGCM(load_key(key))
        plaintext = aes.decrypt(_b64d(nonce_b64), _b64d(payload_b64), None)
    except InvalidTag as exc:
        # The overwhelmingly likely cause is a rotated key. Say that in the log
        # so an operator knows to reconnect the Page, without echoing anything
        # about the value itself.
        raise DecryptionFailed(
            "authentication failed — the key may have been rotated"
        ) from exc
    except CryptoNotConfigured:
        raise
    except Exception as exc:  # noqa: BLE001
        raise DecryptionFailed("could not decrypt") from exc

    return plaintext.decode("utf-8")


def is_configured(key: str) -> bool:
    try:
        load_key(key)
        return True
    except CryptoNotConfigured:
        return False


def fingerprint(stored: str) -> str:
    """A short, non-reversible tag for correlating a token in logs.

    Exists so that "the token changed" is observable without any part of the
    token being observable. Derived from the ciphertext, not the plaintext, so
    it cannot narrow down the credential even in principle.
    """
    import hashlib
    return hashlib.sha256(stored.encode("utf-8")).hexdigest()[:12]
