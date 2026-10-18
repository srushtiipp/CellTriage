import os
from supabase import create_client

url = os.getenv("SUPABASE_URL", "https://yaedtyjcoaubletjpxrt.supabase.co")
key = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_RN93Jnv7DCZIYRYztfww4g_anW7oV52")
supabase = create_client(url, key)

tables = ["battery_health", "battery_metrics", "vehicles", "battery_health_backup", "battery_metrics_backup"]

for table in tables:
    try:
        res = supabase.table(table).select("id", count="exact", head=True).execute()
        print(f"{table}: {res.count} rows")
    except Exception as e:
        print(f"{table}: Error - {e}")
