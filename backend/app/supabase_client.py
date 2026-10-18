"""
supabase_client.py
Initializes and exposes the Supabase client for use by future API routers.
No database queries, table creation, or RLS policies are performed here.
"""

from supabase import create_client, Client
from app.config import settings

# The client is set to None when credentials are missing (e.g., during local
# health-check testing without a .env file). Routers that require Supabase
# should guard against a None client.
supabase: Client | None = None

if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
