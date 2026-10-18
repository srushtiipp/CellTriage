import getpass
from supabase import create_client

url = "https://yaedtyjcoaubletjpxrt.supabase.co"
key = getpass.getpass("Enter service_role key: ")

db = create_client(url, key)

for table in ["battery_health", "battery_metrics", "vehicles"]:
    response = db.table(table).select("*", count="exact", head=True).execute()
    print(f"{table}: {response.count}")