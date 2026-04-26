"""FastAPI application factory.

Run locally:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import alerts, density, websockets


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

    app = FastAPI(
        title="Baku Metro AI — Density API",
        version="1.0.0",
        description=(
            "Real-time passenger density ingestion and broadcast for Baku Metro. "
            "Mock generator and real AI cameras both POST to /api/density."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(density.router)
    app.include_router(alerts.router)
    app.include_router(websockets.router)

    return app


app = create_app()
