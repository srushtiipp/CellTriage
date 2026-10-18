"""
routers/test.py
Temporary diagnostic endpoints used only to verify backend–Supabase connectivity.

These endpoints MUST be removed or protected before production deployment.
They perform ONLY safe, read-only queries.
They do NOT bypass RLS — the anon key is used exactly as every future request will be.
They do NOT expose credentials.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.supabase_client import supabase

router = APIRouter(prefix="/api/test", tags=["Diagnostics"])


@router.get("/supabase")
async def test_supabase_connection() -> JSONResponse:
    """
    Verifies that the FastAPI backend can reach the existing Supabase project.

    Performs a lightweight, read-only query against the `vehicles` table.
    Returns connection status, record count, and a small sanitised sample of
    vehicle IDs.  No credentials or sensitive data are returned.
    """

    # Guard: credentials not configured
    if supabase is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": (
                    "Supabase client is not initialised. "
                    "Check that SUPABASE_URL and SUPABASE_ANON_KEY are set "
                    "in the backend .env file."
                ),
            },
        )

    try:
        # Read-only query — fetch only the vehicle_id column, limit to 5 rows.
        # RLS is fully in effect; we use the anon key.
        response = (
            supabase.table("vehicles")
            .select("vehicle_id")
            .limit(5)
            .execute()
        )

        records = response.data or []
        vehicle_ids = [r["vehicle_id"] for r in records]

        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "message": "Supabase connection is working.",
                "records_retrieved": len(records),
                "sample_vehicle_ids": vehicle_ids,
            },
        )

    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": f"Could not reach Supabase: {type(exc).__name__}: {exc}",
            },
        )
