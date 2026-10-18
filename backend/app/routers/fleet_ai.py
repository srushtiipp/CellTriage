"""
routers/fleet_ai.py
AI Fleet Intelligence endpoint for Administrators.
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
from app.services.fleet_ai_agent import run_fleet_copilot

router = APIRouter(prefix="/api/fleet/ai", tags=["Fleet AI"])

class FleetAiRequest(BaseModel):
    message: Optional[str] = None
    vehicle_ids: Optional[List[str]] = None
    run_analysis: bool = False

class FleetAiResponse(BaseModel):
    answer: str
    tools_used: List[str]

@router.post("", response_model=FleetAiResponse)
async def ask_fleet_ai(
    req: FleetAiRequest,
    current_user: CurrentUser = Depends(require_admin),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> FleetAiResponse:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
        
    if req.vehicle_ids and len(req.vehicle_ids) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 5 vehicles allowed per request.")
        
    if not req.message and not req.run_analysis:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide a message or set run_analysis to true.")
        
    pg = _authenticated_postgrest(credentials.credentials)
    
    try:
        result = run_fleet_copilot(pg, req.vehicle_ids, req.message, req.run_analysis)
        return FleetAiResponse(**result)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AI processing failed.")
