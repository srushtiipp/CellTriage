"""
diagnose_profile.py  -  READ-ONLY diagnostic, no data is modified.

Mirrors the exact authentication + PostgREST / RLS context used by
backend/app/auth.py (get_current_user).

Usage (from backend/ directory with .venv active):
    python diagnose_profile.py
"""

import getpass
import sys
from postgrest._sync.client import SyncPostgrestClient
from supabase import create_client
from app.config import settings

if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY is missing from .env")
    sys.exit(1)

sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

print("\n[diagnose_profile.py]  Read-only diagnostic - no data will be modified.\n")
email    = input("Supabase login email: ").strip()
password = getpass.getpass("Password (hidden): ")

try:
    auth_resp = sb.auth.sign_in_with_password({"email": email, "password": password})
except Exception as exc:
    print(f"\nERROR: Supabase sign-in failed - {exc}")
    sys.exit(1)

if auth_resp is None or auth_resp.user is None:
    print("\nERROR: Sign-in returned no user.")
    sys.exit(1)

user    = auth_resp.user
session = auth_resp.session
user_id = user.id

print(f"\n[OK] Authenticated.  auth.uid() = {user_id}")
print(f"     Email confirmed : {user.email_confirmed_at is not None}")

rest_url = str(sb.rest_url)
headers  = {
    "apikey":        settings.SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {session.access_token}",
}
pg = SyncPostgrestClient(rest_url, headers=headers)

print("\n-- Querying profiles table (authenticated RLS context) --")

try:
    profile_resp = (
        pg.table("profiles")
        .select("id, role")
        .eq("id", user_id)
        .execute()
    )
except Exception as exc:
    print(f"\nERROR: PostgREST raised an exception - {type(exc).__name__}: {exc}")
    sys.exit(1)

rows = profile_resp.data or []

if not rows:
    print(f"\n[PROBLEM] No row found in profiles for id = {user_id}")
    print("  Either the row does not exist, or RLS is hiding it.")
else:
    row        = rows[0]
    profile_id = row.get("id")
    role       = row.get("role")
    print(f"\n[OK] Profile row found.")
    print(f"     profiles.id = {profile_id}")
    print(f"     auth.uid()  = {user_id}")
    print(f"     Match       : {'YES' if profile_id == user_id else 'NO - UUID mismatch!'}")
    print(f"     role        : {role!r}")
    if role not in ("admin", "vehicle_user"):
        print(f"\n[PROBLEM] role {role!r} is not an accepted application role.")
    else:
        print(f"\n[OK] Role is valid.")

print("\n-- Querying vehicle_assignments (authenticated RLS context) --")
try:
    va_resp = (
        pg.table("vehicle_assignments")
        .select("vehicle_id")
        .eq("user_id", user_id)
        .execute()
    )
    assignments = [r["vehicle_id"] for r in (va_resp.data or [])]
    if assignments:
        print(f"[OK] Vehicle assignments: {assignments}")
    else:
        print(f"[PROBLEM] No vehicle_assignments rows for user_id = {user_id}")
except Exception as exc:
    print(f"ERROR reading vehicle_assignments - {type(exc).__name__}: {exc}")

print("\n-- Diagnosis complete --\n")
