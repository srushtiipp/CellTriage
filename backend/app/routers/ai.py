"""
routers/ai.py
AI Copilot endpoint.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.auth import (
    CurrentUser,
    get_current_user,
    check_vehicle_access,
    _authenticated_postgrest,
    bearer_scheme,
)
from app.services.ai_agent import run_copilot

router = APIRouter(prefix="/api/ai", tags=["AI Copilot"])

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class CopilotRequestPayload(BaseModel):
    message: Optional[str] = None
    vehicle_id: Optional[str] = None
    run_analysis: bool = False

class CopilotResponse(BaseModel):
    answer: str
    tools_used: List[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/copilot", response_model=CopilotResponse)
async def ai_copilot(
    payload: CopilotRequestPayload,
    current_user: CurrentUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CopilotResponse:
    """
    Core AI Copilot interaction endpoint.
    Inherits the authenticated user's authorization bounds.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
        
    vehicle_id = payload.vehicle_id
    
    # 1. Authorize vehicle scope based on role
    if current_user.role == "vehicle_user":
        if not current_user.assigned_vehicle_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No vehicle assigned to user."
            )
        # Vehicle user must either request their assigned vehicle or provide none
        if vehicle_id and vehicle_id not in current_user.assigned_vehicle_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested vehicle."
            )
        if not vehicle_id:
            vehicle_id = current_user.assigned_vehicle_ids[0]
            
    elif current_user.role == "admin":
        if not vehicle_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins must specify a vehicle_id."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unrecognized role."
        )
        
    # Standard centralized verification just to be strictly compliant with existing architecture
    check_vehicle_access(current_user, vehicle_id)
    
    pg = _authenticated_postgrest(credentials.credentials)
    
    # Verify vehicle existence
    try:
        v_resp = pg.table("vehicles").select("vehicle_id").eq("vehicle_id", vehicle_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {type(exc).__name__}",
        ) from exc
        
    if not v_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found."
        )
        
    # Execute Agent
    try:
        result = run_copilot(
            pg=pg,
            vehicle_id=vehicle_id,
            message=payload.message,
            run_analysis=payload.run_analysis
        )
        return CopilotResponse(
            answer=result["answer"],
            tools_used=result["tools_used"]
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while running the AI Copilot."
        )
