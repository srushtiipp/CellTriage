import os
from supabase import create_client, Client

url = "https://yaedtyjcoaubletjpxrt.supabase.co"
key = "sb_publishable_RN93Jnv7DCZIYRYztfww4g_anW7oV52" # from .env

supabase: Client = create_client(url, key)

health = supabase.table("battery_health").select("*").limit(1).execute()
metrics = supabase.table("battery_metrics").select("*").limit(1).execute()

print("Health columns:", list(health.data[0].keys()) if health.data else "None")
print("Metrics columns:", list(metrics.data[0].keys()) if metrics.data else "None")
