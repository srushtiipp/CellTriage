"""
routers/fleet.py
Fleet Admin endpoints for CellTriage.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.auth import (
    CurrentUser,
    require_admin,
    _authenticated_postgrest,
    bearer_scheme,
)

router = APIRouter(prefix="/api/fleet", tags=["Fleet Admin"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class FleetSummaryResponse(BaseModel):
    total_vehicles: int
    healthy_count: int
    medium_risk_count: int
    high_risk_count: int
    critical_count: int
    average_soh: float
    lowest_soh_vehicle: Optional[str]
    highest_soh_vehicle: Optional[str]

class FleetVehicleRecord(BaseModel):
    vehicle_id: str
    model: str
    latest_soh: Optional[float]
    latest_efc: Optional[float]
    risk_level: Optional[str]
    degradation_rate: Optional[float]
    latest_soc: Optional[float]
    latest_temperature: Optional[float]
    latest_voltage_spread: Optional[float]
    latest_temperature_spread: Optional[float]
    odometer: Optional[float]
    health_history: Optional[List[dict]] = None

class FleetVehiclesResponse(BaseModel):
    vehicles: List[FleetVehicleRecord]

class RiskDistributionResponse(BaseModel):
    low: int
    medium: int
    high: int
    critical: int

class FleetSohRecord(BaseModel):
    vehicle_id: str
    latest_soh: Optional[float]
    latest_efc: Optional[float]
    risk_level: Optional[str]

class FleetSohOverviewResponse(BaseModel):
    vehicles: List[FleetSohRecord]

class CompareResponse(BaseModel):
    vehicles: List[FleetVehicleRecord]


# ---------------------------------------------------------------------------
# Helper function
# ---------------------------------------------------------------------------

def _get_fleet_health_state(pg) -> List[dict]:
    """
    Fetches the latest battery_health record for every vehicle in the fleet.
    Uses efficient sequential limit(1) queries per vehicle to avoid loading
    unnecessary historical records.
    """
    try:
        vehicles_resp = pg.table("vehicles").select("vehicle_id").execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch vehicles: {type(exc).__name__}",
        ) from exc
        
    vehicles = vehicles_resp.data or []
    fleet_health = []
    
    for v in vehicles:
        vid = v["vehicle_id"]
        try:
            h_resp = (
                pg.table("battery_health")
                .select("soh, efc, risk_level, degradation_rate")
                .eq("vehicle_id", vid)
                .order("efc", desc=True)
                .limit(1)
                .execute()
            )
            h_data = h_resp.data[0] if h_resp.data else None
            if h_data:
                h_data["vehicle_id"] = vid
                fleet_health.append(h_data)
        except Exception as exc:
            # We skip on single vehicle failure to avoid breaking the entire dashboard,
            # but ideally we log it. Here we raise to be safe or pass.
            # It's safer to raise 500 for data consistency in a fleet dashboard.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch health for vehicle {vid}: {type(exc).__name__}",
            ) from exc
            
    return fleet_health


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=FleetSummaryResponse)
async def get_fleet_summary(
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> FleetSummaryResponse:
    """
    Provide the overview required by the Fleet Administrator dashboard.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    pg = _authenticated_postgrest(credentials.credentials)
    fleet_health = _get_fleet_health_state(pg)
    
    total_vehicles = len(fleet_health)
    
    healthy_count = 0
    medium_risk_count = 0
    high_risk_count = 0
    critical_count = 0
    total_soh = 0.0
    
    lowest_soh = float('inf')
    highest_soh = float('-inf')
    lowest_soh_vehicle = None
    highest_soh_vehicle = None
    
    for record in fleet_health:
        soh = record.get("soh")
        if soh is None:
            continue
            
        total_soh += soh
        
        # Risk Distribution Logic based on requirements
        if soh >= 90:
            healthy_count += 1
        elif 80 <= soh < 90:
            medium_risk_count += 1
        elif 70 <= soh < 80:
            high_risk_count += 1
        else:
            critical_count += 1
            
        if soh < lowest_soh:
            lowest_soh = soh
            lowest_soh_vehicle = record["vehicle_id"]
            
        if soh > highest_soh:
            highest_soh = soh
            highest_soh_vehicle = record["vehicle_id"]
            
    average_soh = (total_soh / total_vehicles) if total_vehicles > 0 else 0.0
    
    return FleetSummaryResponse(
        total_vehicles=total_vehicles,
        healthy_count=healthy_count,
        medium_risk_count=medium_risk_count,
        high_risk_count=high_risk_count,
        critical_count=critical_count,
        average_soh=average_soh,
        lowest_soh_vehicle=lowest_soh_vehicle,
        highest_soh_vehicle=highest_soh_vehicle
    )


@router.get("/vehicles", response_model=FleetVehiclesResponse)
async def get_fleet_vehicles(
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> FleetVehiclesResponse:
    """
    Return one summary record for each of the 20 vehicles.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    pg = _authenticated_postgrest(credentials.credentials)
    
    try:
        vehicles_resp = pg.table("vehicles").select("vehicle_id, model").execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch vehicles: {type(exc).__name__}",
        ) from exc
        
    vehicles = vehicles_resp.data or []
    fleet_records = []
    
    for v in vehicles:
        vid = v["vehicle_id"]
        
        # Fetch latest health
        h_resp = pg.table("battery_health").select("soh, efc, risk_level, degradation_rate").eq("vehicle_id", vid).order("efc", desc=True).limit(1).execute()
        h_data = h_resp.data[0] if h_resp.data else {}
        
        # Fetch latest metrics
        m_resp = pg.table("battery_metrics").select("soc, temperature, voltage_spread, temperature_spread, odometer").eq("vehicle_id", vid).order("odometer", desc=True).limit(1).execute()
        m_data = m_resp.data[0] if m_resp.data else {}
        
        fleet_records.append(FleetVehicleRecord(
            vehicle_id=vid,
            model=v.get("model", ""),
            latest_soh=h_data.get("soh"),
            latest_efc=h_data.get("efc"),
            risk_level=h_data.get("risk_level"),
            degradation_rate=h_data.get("degradation_rate"),
            latest_soc=m_data.get("soc"),
            latest_temperature=m_data.get("temperature"),
            latest_voltage_spread=m_data.get("voltage_spread"),
            latest_temperature_spread=m_data.get("temperature_spread"),
            odometer=m_data.get("odometer")
        ))
        
    return FleetVehiclesResponse(vehicles=fleet_records)


@router.get("/risk-distribution", response_model=RiskDistributionResponse)
async def get_fleet_risk_distribution(
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> RiskDistributionResponse:
    """
    Return counts for risk categories based on the latest health state of each vehicle.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    pg = _authenticated_postgrest(credentials.credentials)
    fleet_health = _get_fleet_health_state(pg)
    
    low = 0
    medium = 0
    high = 0
    critical = 0
    
    for record in fleet_health:
        soh = record.get("soh")
        if soh is None:
            continue
            
        if soh >= 90:
            low += 1
        elif 80 <= soh < 90:
            medium += 1
        elif 70 <= soh < 80:
            high += 1
        else:
            critical += 1
            
    return RiskDistributionResponse(
        low=low,
        medium=medium,
        high=high,
        critical=critical
    )


@router.get("/soh-overview", response_model=FleetSohOverviewResponse)
async def get_fleet_soh_overview(
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> FleetSohOverviewResponse:
    """
    Provide data needed for an administrator to compare battery health across the fleet.
    Ordered by latest_soh ascending.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    pg = _authenticated_postgrest(credentials.credentials)
    fleet_health = _get_fleet_health_state(pg)
    
    records = []
    for record in fleet_health:
        records.append(FleetSohRecord(
            vehicle_id=record["vehicle_id"],
            latest_soh=record.get("soh"),
            latest_efc=record.get("efc"),
            risk_level=record.get("risk_level")
        ))
        
    # Order by latest_soh ascending, placing None values at the end if any
    records.sort(key=lambda x: (x.latest_soh is None, x.latest_soh))
    
    return FleetSohOverviewResponse(vehicles=records)


def _normalize_vehicle_id(vid: str) -> str:
    """Normalize common typos/confusions such as VOO1 -> V001 (letter O vs digit 0)."""
    v = vid.strip()
    if v.upper().startswith("V") and len(v) == 4:
        return "V" + v[1:].upper().replace("O", "0")
    return v


@router.get("/compare", response_model=CompareResponse)
async def compare_vehicles(
    vehicle_ids: str,
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CompareResponse:
    """
    Compare up to 5 specific vehicles by returning their latest metrics and health history.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    v_ids = [_normalize_vehicle_id(vid) for vid in vehicle_ids.split(",") if vid.strip()]
    if not v_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No vehicle IDs provided.")
    if len(v_ids) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 5 vehicles allowed for comparison.")
        
    pg = _authenticated_postgrest(credentials.credentials)
    
    try:
        vehicles_resp = pg.table("vehicles").select("vehicle_id, model").in_("vehicle_id", v_ids).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch vehicles: {type(exc).__name__}",
        ) from exc
        
    found_vehicles = {v["vehicle_id"]: v for v in (vehicles_resp.data or [])}
    for vid in v_ids:
        if vid not in found_vehicles:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle not found: {vid}")
            
    fleet_records = []
    
    for vid in v_ids:
        v = found_vehicles[vid]
        
        # Fetch latest health
        h_resp = pg.table("battery_health").select("soh, efc, risk_level, degradation_rate").eq("vehicle_id", vid).order("efc", desc=True).limit(1).execute()
        h_data = h_resp.data[0] if h_resp.data else {}
        
        # Fetch latest metrics
        m_resp = pg.table("battery_metrics").select("soc, temperature, voltage_spread, temperature_spread, odometer").eq("vehicle_id", vid).order("odometer", desc=True).limit(1).execute()
        m_data = m_resp.data[0] if m_resp.data else {}
        
        # Fetch health history for comparison progression
        hist_resp = pg.table("battery_health").select("session_id, soh, efc").eq("vehicle_id", vid).order("efc", desc=False).execute()
        health_history = hist_resp.data or []
        
        fleet_records.append(FleetVehicleRecord(
            vehicle_id=vid,
            model=v.get("model", ""),
            latest_soh=h_data.get("soh"),
            latest_efc=h_data.get("efc"),
            risk_level=h_data.get("risk_level"),
            degradation_rate=h_data.get("degradation_rate"),
            latest_soc=m_data.get("soc"),
            latest_temperature=m_data.get("temperature"),
            latest_voltage_spread=m_data.get("voltage_spread"),
            latest_temperature_spread=m_data.get("temperature_spread"),
            odometer=m_data.get("odometer"),
            health_history=health_history
        ))
        
    return CompareResponse(vehicles=fleet_records)
