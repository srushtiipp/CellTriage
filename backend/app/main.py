"""
main.py
CellTriage FastAPI application entry point.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth as auth_router
from app.routers import ml as ml_router
from app.routers import vehicles as vehicles_router
from app.routers import fleet as fleet_router
from app.routers import ai as ai_router
from app.routers import fleet_ai as fleet_ai_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CellTriage — EV Battery Health Monitoring & Fleet Management",
    description="Backend API for intelligent EV battery health monitoring across a managed fleet.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — local origins plus any production origins from the CORS_ORIGINS env var
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"] + [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check — no authentication or Supabase required
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Returns a simple confirmation that the backend is running."""
    return {"status": "ok", "service": "CellTriage Backend"}


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router.router)
app.include_router(ml_router.router)
app.include_router(vehicles_router.router)
app.include_router(fleet_router.router)
app.include_router(ai_router.router)
app.include_router(fleet_ai_router.router)

