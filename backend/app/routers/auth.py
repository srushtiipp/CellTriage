"""
routers/auth.py
Authentication-related API endpoints for CellTriage.

Endpoints:
  GET /api/auth/me  - Returns the authenticated user identity, role,
                      and (for vehicle users) their assigned vehicle IDs.

No credentials, tokens, or Supabase keys are ever returned.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from app.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class MeResponse(BaseModel):
    """Response schema for GET /api/auth/me."""

    user_id: str
    role: str
    full_name: Optional[str]
    assigned_vehicle_ids: List[str]


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    """
    Returns the authenticated user identity, role, and vehicle assignments.

    Requires:
      Authorization: Bearer <supabase_access_token>

    Returns:
      - user_id              : Supabase Auth UUID
      - role                 : "admin" or "vehicle_user"
      - full_name            : Display name from profiles (may be null)
      - assigned_vehicle_ids : Vehicle IDs from vehicle_assignments
                               (empty list for admins; they have fleet-wide access)

    Never returns:
      - access tokens
      - refresh tokens
      - Supabase keys
      - passwords
    """
    return MeResponse(
        user_id=current_user.user_id,
        role=current_user.role,
        full_name=current_user.full_name,
        assigned_vehicle_ids=current_user.assigned_vehicle_ids,
    )
