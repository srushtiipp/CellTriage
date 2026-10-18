"""
routers/vehicles.py
Vehicle data endpoints.
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from pydantic import BaseModel

from app.auth import (
    CurrentUser,
    get_current_user,
    check_vehicle_access,
    _authenticated_postgrest,
    bearer_scheme,
)

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class BatteryHealthRecord(BaseModel):
    vehicle_id: str
    session_id: int
    soh: float
    efc: float
    risk_level: str
    degradation_rate: Optional[float]
    estimated_capacity_ah: Optional[float]
    timestamp: Optional[datetime]


class BatteryHealthResponse(BaseModel):
    vehicle_id: str
    page: int
    page_size: int
    total: int
    records: List[BatteryHealthRecord]


class BatteryMetricsRecord(BaseModel):
    vehicle_id: str
    session_id: int
    efc: float
    soc: float
    pack_voltage: float
    current: float
    temperature: float
    voltage_spread: float
    temperature_spread: float
    odometer: float
    timestamp: Optional[datetime]


class BatteryMetricsResponse(BaseModel):
    vehicle_id: str
    page: int
    page_size: int
    total: int
    records: List[BatteryMetricsRecord]


class VehicleSummaryResponse(BaseModel):
    vehicle_id: str
    latest_soh: Optional[float]
    latest_efc: Optional[float]
    risk_level: Optional[str]
    degradation_rate: Optional[float]
    latest_soc: Optional[float]
    latest_pack_voltage: Optional[float]
    latest_current: Optional[float]
    latest_temperature: Optional[float]
    latest_voltage_spread: Optional[float]
    latest_temperature_spread: Optional[float]
    latest_odometer: Optional[float]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{vehicle_id}/health", response_model=BatteryHealthResponse)
async def get_vehicle_health(
    vehicle_id: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(100, ge=1, le=500, description="Number of records per page"),
    current_user: CurrentUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> BatteryHealthResponse:
    """
    Retrieve historical battery health records for a specific vehicle.
    
    Orders records by Equivalent Full Cycles (EFC) ascending.
    """
    
    # 1. Authorize vehicle access for the current user
    check_vehicle_access(current_user, vehicle_id)
    
    if not credentials:
        # get_current_user already enforces this, but just to satisfy type checkers
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
        
    token = credentials.credentials
    pg = _authenticated_postgrest(token)
    
    # 2. Check if the vehicle exists
    try:
        vehicle_resp = (
            pg.table("vehicles")
            .select("vehicle_id")
            .eq("vehicle_id", vehicle_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {type(exc).__name__}",
        ) from exc
        
    if not vehicle_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
        
    # 3. Get total count for pagination
    try:
        count_resp = (
            pg.table("battery_health")
            .select("id", count="exact")
            .eq("vehicle_id", vehicle_id)
            .execute()
        )
        total_records = count_resp.count if count_resp.count is not None else 0
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch record count: {type(exc).__name__}",
        ) from exc
        
    # 4. Fetch the paginated records ordered by EFC ASC
    offset = (page - 1) * page_size
    limit = page_size
    
    try:
        records_resp = (
            pg.table("battery_health")
            .select("vehicle_id, session_id, soh, efc, risk_level, degradation_rate, estimated_capacity_ah, timestamp")
            .eq("vehicle_id", vehicle_id)
            .order("efc", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch records: {type(exc).__name__}",
        ) from exc
        
    records = []
    for row in (records_resp.data or []):
        records.append(BatteryHealthRecord(**row))
        
    return BatteryHealthResponse(
        vehicle_id=vehicle_id,
        page=page,
        page_size=page_size,
        total=total_records,
        records=records
    )


@router.get("/{vehicle_id}/metrics", response_model=BatteryMetricsResponse)
async def get_vehicle_metrics(
    vehicle_id: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(100, ge=1, le=500, description="Number of records per page"),
    current_user: CurrentUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> BatteryMetricsResponse:
    """
    Retrieve historical battery metrics records for a specific vehicle.
    
    Orders records by odometer ascending (historical lifecycle ordering).
    """
    check_vehicle_access(current_user, vehicle_id)
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
        
    token = credentials.credentials
    pg = _authenticated_postgrest(token)
    
    try:
        vehicle_resp = pg.table("vehicles").select("vehicle_id").eq("vehicle_id", vehicle_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {type(exc).__name__}",
        ) from exc
        
    if not vehicle_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
        
    try:
        count_resp = pg.table("battery_metrics").select("id", count="exact").eq("vehicle_id", vehicle_id).execute()
        total_records = count_resp.count if count_resp.count is not None else 0
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch record count: {type(exc).__name__}",
        ) from exc
        
    offset = (page - 1) * page_size
    limit = page_size
    
    try:
        records_resp = (
            pg.table("battery_metrics")
            .select("vehicle_id, session_id, efc, soc, pack_voltage, current, temperature, voltage_spread, temperature_spread, odometer, timestamp")
            .eq("vehicle_id", vehicle_id)
            .order("odometer", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch records: {type(exc).__name__}",
        ) from exc
        
    records = []
    for row in (records_resp.data or []):
        records.append(BatteryMetricsRecord(**row))
        
    return BatteryMetricsResponse(
        vehicle_id=vehicle_id,
        page=page,
        page_size=page_size,
        total=total_records,
        records=records
    )


@router.get("/{vehicle_id}/summary", response_model=VehicleSummaryResponse)
async def get_vehicle_summary(
    vehicle_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> VehicleSummaryResponse:
    """
    Retrieve the latest/current available battery state summary for a specific vehicle.
    
    Determines 'latest' using EFC (for health) and odometer (for metrics), not timestamps.
    """
    check_vehicle_access(current_user, vehicle_id)
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
        
    token = credentials.credentials
    pg = _authenticated_postgrest(token)
    
    try:
        vehicle_resp = pg.table("vehicles").select("vehicle_id").eq("vehicle_id", vehicle_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {type(exc).__name__}",
        ) from exc
        
    if not vehicle_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found.",
        )
        
    try:
        health_resp = (
            pg.table("battery_health")
            .select("soh, efc, risk_level, degradation_rate")
            .eq("vehicle_id", vehicle_id)
            .order("efc", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch health summary: {type(exc).__name__}",
        ) from exc
        
    try:
        metrics_resp = (
            pg.table("battery_metrics")
            .select("soc, pack_voltage, current, temperature, voltage_spread, temperature_spread, odometer")
            .eq("vehicle_id", vehicle_id)
            .order("odometer", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch metrics summary: {type(exc).__name__}",
        ) from exc
        
    health_data = health_resp.data[0] if health_resp.data else {}
    metrics_data = metrics_resp.data[0] if metrics_resp.data else {}
    
    return VehicleSummaryResponse(
        vehicle_id=vehicle_id,
        latest_soh=health_data.get("soh"),
        latest_efc=health_data.get("efc"),
        risk_level=health_data.get("risk_level"),
        degradation_rate=health_data.get("degradation_rate"),
        latest_soc=metrics_data.get("soc"),
        latest_pack_voltage=metrics_data.get("pack_voltage"),
        latest_current=metrics_data.get("current"),
        latest_temperature=metrics_data.get("temperature"),
        latest_voltage_spread=metrics_data.get("voltage_spread"),
        latest_temperature_spread=metrics_data.get("temperature_spread"),
        latest_odometer=metrics_data.get("odometer"),
    )
