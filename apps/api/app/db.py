"""Database access: one pool, parameterised queries, no ORM.

Why psycopg3 rather than a driver that needs compiling: it ships binary wheels
for Windows, so `pip install` works on this box without a C toolchain.

Why no ORM: every query in this application is either a small lookup or a
deliberate join, and the ones that matter (quota, My Apps ordering) are database
functions because they must be atomic. An ORM would add a layer between us and
the exact SQL we care about without removing the need to understand it.

Every statement here is parameterised. There is no string interpolation of user
input into SQL anywhere in this file, and there must never be.
"""
from __future__ import annotations

import contextlib
from typing import Any, AsyncIterator, Sequence

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import Settings
from .logging_config import get_logger

log = get_logger(__name__)

_pool: AsyncConnectionPool | None = None


async def init_pool(settings: Settings) -> AsyncConnectionPool:
    """Open the pool. Called once, from the application lifespan."""
    global _pool
    if _pool is not None:
        return _pool

    async def _configure(conn: AsyncConnection) -> None:
        # A runaway query holding a connection is worse than a failed request:
        # it starves everyone else. Every session gets a ceiling.
        async with conn.cursor() as cur:
            await cur.execute(
                f"SET statement_timeout = {int(settings.db_statement_timeout_ms)}"
            )
            await cur.execute("SET idle_in_transaction_session_timeout = 30000")

    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        kwargs={"row_factory": dict_row, "autocommit": True},
        configure=_configure,
        open=False,
        name="pickixo",
    )
    await _pool.open(wait=True, timeout=10)
    log.info("db.pool_opened", min=settings.db_pool_min,
             max=settings.db_pool_max)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        log.info("database pool closed")


def get_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("database pool is not open")
    return _pool


@contextlib.asynccontextmanager
async def connection() -> AsyncIterator[AsyncConnection]:
    async with get_pool().connection() as conn:
        yield conn


@contextlib.asynccontextmanager
async def transaction() -> AsyncIterator[AsyncConnection]:
    """A connection wrapped in an explicit transaction.

    Needed wherever more than one statement must succeed or fail together —
    sign-up writing a user, an identity and a session, for instance.
    """
    async with get_pool().connection() as conn:
        async with conn.transaction():
            yield conn


# ---------------------------------------------------------------------------
# Query helpers
#
# Thin on purpose. They exist so call sites read as "fetch one row" rather than
# four lines of cursor ceremony, not to become a query builder.
# ---------------------------------------------------------------------------
async def fetch_one(sql: str, params: Sequence[Any] | None = None) -> dict | None:
    async with connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return await cur.fetchone()


async def fetch_all(sql: str, params: Sequence[Any] | None = None) -> list[dict]:
    async with connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return await cur.fetchall()


async def fetch_value(sql: str, params: Sequence[Any] | None = None) -> Any:
    row = await fetch_one(sql, params)
    if row is None:
        return None
    return next(iter(row.values()))


async def execute(sql: str, params: Sequence[Any] | None = None) -> int:
    """Run a statement and return the number of rows it touched."""
    async with connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            return cur.rowcount


async def healthcheck() -> bool:
    try:
        return await fetch_value("SELECT 1") == 1
    except Exception:  # noqa: BLE001 — health must never raise into the handler
        log.exception("database healthcheck failed")
        return False
