"""Health and readiness.

Reports what is actually true. A degraded database or zero configured AI
providers is said out loud rather than smoothed into "ok", because a health
endpoint that always returns ok is a health endpoint nobody can use.
"""
from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..schemas import HealthResponse
from ..services import ai as ai_service

router = APIRouter(tags=["health"])

VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    database_ok = await db.healthcheck()
    providers = ai_service.providers_ready()
    return HealthResponse(
        status="ok" if database_ok else "degraded",
        database=database_ok,
        version=VERSION,
        ai_providers_ready=providers,
    )
