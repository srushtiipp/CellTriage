"""
auth.py
Authentication and authorization foundation for CellTriage.

Provides:
  - CurrentUser dataclass - the structured internal user object
  - get_current_user()   - FastAPI dependency; validates bearer token,
                           resolves role, and fetches vehicle assignments
  - require_admin()      - dependency that gates admin-only endpoints
  - check_vehicle_access() - authorization helper for vehicle-scoped endpoints

Security principles enforced here:
  - Tokens are validated via Supabase Auth (get_user), never decoded blindly.
  - Role is read from `profiles` using the AUTHENTICATED user JWT so RLS
    sees the correct auth.uid().  A fresh, per-request PostgREST client is
    created for every dependency call so the user JWT is never mixed with
    another request (thread-safe; no shared-state mutation).
  - Vehicle assignments are read from `vehicle_assignments` with the same
    per-request authenticated client.
  - The service-role key is NOT used; RLS remains in effect throughout.
  - Only the two application roles ("admin", "vehicle_user") are accepted.

JWT propagation to PostgREST:
  supabase.auth.get_user(token)  -- validates the token via Supabase Auth
  _authenticated_postgrest(token) -- creates a fresh SyncPostgrestClient
                                     with Authorization: Bearer <user_jwt>
                                     so every PostgREST query runs in the
                                     authenticated user context that RLS
                                     evaluates against auth.uid().
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest._sync.client import SyncPostgrestClient

from app.config import settings
from app.supabase_client import supabase

# ---------------------------------------------------------------------------
# Internal user representation
# ---------------------------------------------------------------------------

VALID_ROLES = {"admin", "vehicle_user"}

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    """
    Structured internal user object populated after full auth resolution.
    Never derived from frontend-supplied data.
    """

    user_id: str
    role: str
    full_name: str | None
    assigned_vehicle_ids: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-request authenticated PostgREST client
# ---------------------------------------------------------------------------


def _authenticated_postgrest(user_jwt: str) -> SyncPostgrestClient:
    """
    Return a *fresh* SyncPostgrestClient whose Authorization header carries
    the authenticated user's JWT (not the anon key).

    Why a fresh client instead of mutating the singleton:
      - supabase.postgrest is a shared singleton.
      - SyncPostgrestClient.auth(token) mutates self.headers IN-PLACE and
        returns the same object (confirmed by source inspection).
      - Mutating the singleton would create a race condition under concurrent
        FastAPI requests: User A's token could overwrite User B's in-flight.
      - A fresh SyncPostgrestClient has its own isolated headers dict and its
        own httpx.Client session, so each request is completely independent.

    The new client inherits the project URL and the anon apikey header
    (required by PostgREST / Supabase to route the request) but its
    Authorization header is set to the caller's validated user JWT.

    RLS therefore evaluates auth.uid() = <this user's UUID>, not null.
    """
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not initialised.",
        )

    rest_url = str(supabase.rest_url)

    # Build headers: carry the project apikey (for routing) but replace
    # the Authorization bearer with the user's own JWT.
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {user_jwt}",
    }

    return SyncPostgrestClient(rest_url, headers=headers)


# ---------------------------------------------------------------------------
# Core dependency: get_current_user
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    """
    FastAPI dependency that:
      1. Requires an Authorization: Bearer <token> header.
      2. Validates the token via Supabase Auth (get_user) - server-side
         cryptographic verification; never blind JWT decode.
      3. Extracts the authenticated user UUID.
      4. Reads the user profile from `profiles` using a fresh PostgREST
         client that carries the user JWT, so RLS evaluates auth.uid()
         correctly.
      5. Enforces that the role is exactly "admin" or "vehicle_user".
      6. For vehicle_user: fetches assigned vehicle IDs from
         `vehicle_assignments` using the same authenticated client.

    Raises:
      HTTP 401 - missing/invalid token, or Supabase cannot verify it.
      HTTP 403 - profile missing, or role is not a recognised application role.
    """

    # 1. Require bearer token
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Guard: Supabase client must be initialised
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not initialised.",
        )

    # 2 & 3. Validate token via Supabase Auth - this makes a server-side
    # call to Supabase Auth; the token is cryptographically verified.
    try:
        auth_response = supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {type(exc).__name__}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if auth_response is None or auth_response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = auth_response.user.id

    # Build a fresh, per-request PostgREST client that carries this user's
    # JWT. All subsequent DB queries use this client so RLS sees the correct
    # auth.uid() = user_id.
    pg = _authenticated_postgrest(token)

    # 4. Retrieve the user profile - runs in the authenticated user context.
    # RLS on `profiles` will evaluate auth.uid() = user_id.
    try:
        profile_response = (
            pg.table("profiles")
            .select("id, full_name, role")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Could not retrieve user profile: {type(exc).__name__}",
        ) from exc

    if not profile_response.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found. Access denied.",
        )

    profile = profile_response.data
    role: str | None = profile.get("role")
    full_name: str | None = profile.get("full_name")

    # 5. Enforce valid application role
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Unrecognised application role: {role!r}. "
                "Access is restricted to 'admin' and 'vehicle_user'."
            ),
        )

    # 6. Resolve vehicle assignments (vehicle_user only).
    # Also runs in the authenticated user context; RLS on
    # `vehicle_assignments` evaluates auth.uid() = user_id.
    assigned_vehicle_ids: List[str] = []

    if role == "vehicle_user":
        try:
            assignments_response = (
                pg.table("vehicle_assignments")
                .select("vehicle_id")
                .eq("user_id", user_id)
                .execute()
            )
            assigned_vehicle_ids = [
                row["vehicle_id"]
                for row in (assignments_response.data or [])
            ]
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Could not retrieve vehicle assignments: {type(exc).__name__}"
                ),
            ) from exc

    return CurrentUser(
        user_id=user_id,
        role=role,
        full_name=full_name,
        assigned_vehicle_ids=assigned_vehicle_ids,
    )


# ---------------------------------------------------------------------------
# Admin-only dependency
# ---------------------------------------------------------------------------


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Dependency that permits only users whose role is exactly "admin".

    Raises:
      HTTP 403 - for any authenticated user who is not an admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Vehicle access authorization helper
# ---------------------------------------------------------------------------


def check_vehicle_access(current_user: CurrentUser, vehicle_id: str) -> None:
    """
    Authorization helper for vehicle-scoped endpoints.

    Rules:
      - admin        -> access granted for any vehicle_id.
      - vehicle_user -> access granted only if vehicle_id is in their
                        assigned_vehicle_ids (sourced from vehicle_assignments).
      - any other role -> HTTP 403

    Args:
      current_user: The resolved CurrentUser from get_current_user().
      vehicle_id:   The vehicle being requested.

    Raises:
      HTTP 403 - if the user is not authorised for the requested vehicle.
    """
    if current_user.role == "admin":
        return  # Fleet-wide access

    if current_user.role == "vehicle_user":
        if vehicle_id in current_user.assigned_vehicle_ids:
            return  # Assigned vehicle - access granted
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied. Vehicle '{vehicle_id}' is not assigned to your account."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Unrecognised role.",
    )
