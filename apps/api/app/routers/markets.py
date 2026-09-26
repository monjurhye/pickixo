"""Markets — Pickbot.

Three routes: read the bot's latest snapshot, run it now, clear its kill switch.

Why a file and not a table: Pickbot is a separate process on the same box that
already keeps its own state as files. Copying that into Postgres would add a
writer, a token and a migration to gain nothing — the snapshot is one document,
always replaced whole, never queried by field.

Why running it from a browser is safe here, and the rules that make it so:

* Reading needs a session; **running needs an admin**. A visitor cannot make this
  process spawn anything. Note the caveat on `pickbot_snapshot` about what
  "reading" exposes once the bot is no longer on paper money.
* The command is not built from a request. The path comes from configuration and
  the only variable part is one word chosen from `ACTIONS` below, in this file.
  No request body is accepted at all, so there is nothing to inject.
* One run at a time, and killed after a timeout. The lock below only covers this
  process, which is not enough on its own: the hourly scheduled task is a
  separate process and cannot see it. Pickbot therefore takes an OS lock on its
  own state directory, and a second pass exits saying so. This lock stays
  because refusing early is a better answer than spawning a JVM to be told no.
* Pickbot itself is idempotent: a run does nothing until a new daily candle has
  closed. So the button is safe to press repeatedly — worst case it re-reads
  market data.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter

from ..dependencies import AdminUser, CurrentUser, SettingsDep
from ..errors import AppError, ErrorCode
from ..logging_config import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/markets", tags=["markets"])

# A snapshot is a few hundred rows of decisions. Anything larger is not the file
# we think it is, and json.loads on an unbounded file is a memory primitive.
MAX_SNAPSHOT_BYTES = 2_000_000

# The complete set of things this API is allowed to ask Pickbot to do. The value is
# passed to the wrapper script as its single argument; nothing else ever is.
ACTIONS: dict[str, str] = {
    "run": "run",
    "resume": "resume",
}

RUN_TIMEOUT_SECONDS = 300
LOG_TAIL_LINES = 25

# Module-level: one run at a time per API process.
_run_lock = asyncio.Lock()


def _snapshot_path(settings: Any) -> Path:
    configured = (settings.pickbot_snapshot_path or "").strip()
    if not configured:
        # Said out loud rather than returning an empty dashboard that looks broken.
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="PICKBOT_SNAPSHOT_PATH is not set, so there is no snapshot to read.",
        )
    return Path(configured)


def _read_snapshot(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise AppError(ErrorCode.NOT_FOUND, detail="Pickbot has not written a snapshot yet.")
    if path.stat().st_size > MAX_SNAPSHOT_BYTES:
        log.warning("pickbot snapshot too large", extra={"bytes": path.stat().st_size})
        raise AppError(ErrorCode.NOT_FOUND, detail="Snapshot file is larger than expected.")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # A half-written file is normal: the bot replaces it while we may be reading.
        log.warning("pickbot snapshot unreadable", extra={"error": str(exc)})
        raise AppError(ErrorCode.NOT_FOUND, detail="Snapshot is being rewritten; try again.") from exc
    if not isinstance(data, dict):
        raise AppError(ErrorCode.NOT_FOUND, detail="Snapshot is not an object.")
    return data


def _log_tail(snapshot: Path, lines: int = LOG_TAIL_LINES) -> list[str]:
    """The end of Pickbot's own log, which sits beside its snapshot."""
    candidate = snapshot.parent / "rot.log"
    if not candidate.is_file():
        return []
    try:
        with candidate.open("r", encoding="utf-8", errors="replace") as fh:
            return [line.rstrip("\n") for line in fh.readlines()[-lines:]]
    except OSError:
        return []


@router.get("/pickbot")
async def pickbot_snapshot(user: CurrentUser, settings: SettingsDep) -> dict[str, Any]:
    """The latest snapshot: holdings, every past rebalance, every trade.

    Requires sign-in. This is the owner's own research record, not published
    trading calls — see database/schema/019_markets.sql for why that distinction
    lives in the product rather than in a disclaimer.

    DECIDE THIS BEFORE PICKBOT EVER RUNS IN LIVE MODE: while the mode is PAPER
    the figures here are an imaginary book, which is why any signed-in reader may
    see them. In LIVE mode the same fields — equity, cash, invested, the size of
    every holding — are the owner's real account, shown to every signed-in user
    of the site. Either restrict this route to an admin when the snapshot's mode
    is not PAPER, or publish percentages and drop the absolute figures. The track
    record is the point of the page; the balance is not.
    """
    return _read_snapshot(_snapshot_path(settings))


async def _invoke(action: Literal["run", "resume"], settings: Any) -> dict[str, Any]:
    command = (settings.pickbot_command or "").strip()
    if not command:
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="PICKBOT_COMMAND is not set, so Pickbot cannot be run from here.",
        )
    script = Path(command)
    if not script.is_file():
        raise AppError(
            ErrorCode.PROVIDER_NOT_CONFIGURED,
            detail="PICKBOT_COMMAND does not point at a file.",
        )

    if _run_lock.locked():
        raise AppError(ErrorCode.CONFLICT, detail="Pickbot is already running; wait for it to finish.")

    async with _run_lock:
        log.info("pickbot invoke", extra={"action": action})
        try:
            proc = await asyncio.create_subprocess_exec(
                str(script),
                ACTIONS[action],
                cwd=str(script.parent),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        except OSError as exc:
            log.error("pickbot could not start", extra={"error": str(exc)})
            raise AppError(ErrorCode.INTERNAL_ERROR, detail="Pickbot could not be started.") from exc

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=RUN_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            log.error("pickbot timed out", extra={"action": action})
            raise AppError(
                ErrorCode.SERVICE_BUSY,
                detail=f"Pickbot did not finish within {RUN_TIMEOUT_SECONDS}s and was stopped.",
            )

    snapshot = _snapshot_path(settings)
    output = (stdout or b"").decode("utf-8", errors="replace").strip()
    return {
        "action": action,
        "exit_code": proc.returncode,
        "output": output[-4000:],
        "log": _log_tail(snapshot),
        # The bot rewrites the snapshot at the end of every pass, so hand back the
        # fresh one and the page needs no second request.
        "snapshot": _read_snapshot(snapshot) if snapshot.is_file() else None,
    }


@router.post("/pickbot/run")
async def pickbot_run(user: AdminUser, settings: SettingsDep) -> dict[str, Any]:
    """Run one pass now. Admin only.

    Safe to press twice: a pass does nothing until a new daily candle has closed.
    """
    return await _invoke("run", settings)


@router.post("/pickbot/resume")
async def pickbot_resume(user: AdminUser, settings: SettingsDep) -> dict[str, Any]:
    """Clear a latched kill switch. Admin only, and it trades nothing by itself."""
    return await _invoke("resume", settings)
