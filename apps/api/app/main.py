"""Pickixo API.

One FastAPI application, modular by router (§87): a modular monolith, not a set
of services that have to be deployed together anyway.

Failure isolation is the rule that shapes this file (§152). The API starts with
no AI providers configured, and it starts with Google sign-in unconfigured. Both
report themselves unavailable rather than preventing boot, because a tool that
does not use AI should not be down because a vendor key is missing.
"""
from __future__ import annotations

import asyncio
import contextlib
import sys
import time
import uuid
from typing import AsyncIterator

# Windows ships ProactorEventLoop as the asyncio default, and it does not
# implement loop.add_reader(). psycopg's async driver needs exactly that, so on
# the default loop every connection attempt hangs until the pool gives up with
# "pool initialization incomplete". Selecting the selector loop is the supported
# fix; its cost is a 512-descriptor ceiling and no asyncio subprocesses, neither
# of which this API uses.
#
# This has to run before the event loop is created, which is why it sits at
# import time rather than in the lifespan.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import db
from .config import get_settings
from .errors import AppError, ErrorCode
from .logging_config import configure_logging, get_logger
from .routers import admin, ai, apps, auth, facebook, health, me, tools
from .services import ai as ai_service

settings = get_settings()
configure_logging(settings.log_level)
log = get_logger(__name__)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    problems = settings.startup_problems()
    if problems:
        # Every problem at once, so an operator fixes them in one pass rather
        # than discovering them one restart at a time.
        for problem in problems:
            log.error("config.problem", problem=problem)
        raise RuntimeError(
            f"Refusing to start with {len(problems)} configuration problem(s). "
            "See the errors above."
        )

    await db.init_pool(settings)

    # Provider construction must not be able to stop the API booting: a bad key
    # or an unreachable vendor is a degraded AI feature, not a dead site.
    try:
        ai_service.init_managers(settings)
        ready = ai_service.providers_ready()
        if ready == 0:
            log.warning(
                "no AI provider is both enabled and configured — AI endpoints "
                "will report themselves unavailable"
            )
        else:
            log.info("ai.providers_ready", count=ready)
    except Exception:  # noqa: BLE001
        log.exception("AI provider initialisation failed; AI will be unavailable")

    log.info("api.started", env=settings.app_env)
    try:
        yield
    finally:
        await db.close_pool()


app = FastAPI(
    title="Pickixo API",
    version="0.1.0",
    lifespan=lifespan,
    # The interactive docs describe every internal route. Useful in
    # development, an unnecessary map of the attack surface in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

if settings.is_production:
    allowed = [h for h in (
        "pickixo.com", "www.pickixo.com", "localhost", "127.0.0.1"
    )]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Correlation id, timing, and security headers on every response (§80)."""
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    started = time.perf_counter()

    response = await call_next(request)

    duration_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Nothing this API returns should ever be indexed or cached by an
    # intermediary: it is all either private or a JSON view of a public page
    # that has its own canonical HTML URL (§58).
    response.headers["X-Robots-Tag"] = "noindex, nofollow"

    if duration_ms > 1000:
        log.warning("request.slow", path=request.url.path,
                    ms=duration_ms, request_id=request_id)
    return response


# ---------------------------------------------------------------------------
# Error handling — one shape for every failure (§122)
# ---------------------------------------------------------------------------
@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        log.error("app.error", code=exc.code.value, detail=exc.detail)
    else:
        log.info("app.error", code=exc.code.value, detail=exc.detail)
    return JSONResponse(status_code=exc.status_code, content=exc.to_body())


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Pydantic's default body echoes the input back, which for a sign-in form
    # means echoing a password into a response and probably a log.
    log.info("request.validation_failed", path=request.url.path)
    return JSONResponse(
        status_code=400,
        content=AppError(ErrorCode.INVALID_REQUEST).to_body(),
    )


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    # The traceback goes to the log with the request id; the caller gets a code.
    log.exception("request.unhandled", path=request.url.path)
    return JSONResponse(
        status_code=500,
        content=AppError(ErrorCode.INTERNAL_ERROR).to_body(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
prefix = settings.api_prefix
app.include_router(health.router, prefix=prefix)
app.include_router(auth.router, prefix=prefix)
app.include_router(me.router, prefix=prefix)
app.include_router(apps.router, prefix=prefix)
app.include_router(ai.router, prefix=prefix)
app.include_router(tools.router, prefix=prefix)
app.include_router(facebook.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)


@app.get("/")
async def root() -> dict:
    return {"name": "Pickixo API", "version": "0.1.0", "docs": app.docs_url}
