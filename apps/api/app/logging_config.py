"""Structured JSON logging on the standard library only.

Deliberately dependency-free: one less package to install and keep patched on a
small VPS, and JSON lines that `jq` and any log shipper can read directly.

Redaction is enforced here rather than left to call sites, so a stray
`log.info("x", api_key=...)` cannot leak a secret into a log file.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

#: Substrings that mark a field as secret. Matching values are replaced.
_SENSITIVE_HINTS = (
    "api_key", "apikey", "authorization", "password", "secret",
    "token", "service_role", "access_token", "refresh_token", "jwt",
)

_RESERVED = frozenset(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
) | {"message", "asctime", "taskName"}


def _redact(key: str, value: Any) -> Any:
    lowered = key.lower()
    if any(hint in lowered for hint in _SENSITIVE_HINTS):
        return "[redacted]"
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "event": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED or key.startswith("_"):
                continue
            payload[key] = _redact(key, value)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class BoundLogger:
    """Thin adapter giving structlog-style ``log.info("event", key=value)``."""

    def __init__(self, logger: logging.Logger, context: dict[str, Any] | None = None):
        self._logger = logger
        self._context = context or {}

    def bind(self, **kwargs: Any) -> "BoundLogger":
        return BoundLogger(self._logger, {**self._context, **kwargs})

    def _log(self, level: int, event: str, exc_info: bool = False, **kwargs: Any) -> None:
        self._logger.log(
            level, event, exc_info=exc_info, extra={**self._context, **kwargs}
        )

    def debug(self, event: str, **kw: Any) -> None:   self._log(logging.DEBUG, event, **kw)
    def info(self, event: str, **kw: Any) -> None:    self._log(logging.INFO, event, **kw)
    def warning(self, event: str, **kw: Any) -> None: self._log(logging.WARNING, event, **kw)
    def error(self, event: str, **kw: Any) -> None:   self._log(logging.ERROR, event, **kw)
    def exception(self, event: str, **kw: Any) -> None:
        self._log(logging.ERROR, event, exc_info=True, **kw)


def get_logger(name: str) -> BoundLogger:
    return BoundLogger(logging.getLogger(name))


def configure_logging(level: str = "info", json_output: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        JsonFormatter() if json_output
        else logging.Formatter("%(asctime)s %(levelname)-7s %(name)s  %(message)s")
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # These are chatty at INFO and would bury our own events.
    for noisy in ("httpx", "httpcore", "asyncio", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
