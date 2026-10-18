import os
import sys
import getpass
import pandas as pd
from supabase import create_client

def main():
    print("--- POST-INGESTION VALIDATION ---")
    
    # In an automated script, we can read the key from env or prompt
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        key = getpass.getpass("Enter Supabase service_role key (starts with eyJ...): ").strip()
        
    url = "https://yaedtyjcoaubletjpxrt.supabase.co"
    try:
        supabase = create_client(url, key)
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        sys.exit(1)

    print("\nFetching total counts...")
    try:
        bh_count_res = supabase.table("battery_health").select("*", count="exact", head=True).execute()
        bm_count_res = supabase.table("battery_metrics").select("*", count="exact", head=True).execute()
        
        print(f"battery_health final count: {bh_count_res.count}")
        print(f"battery_metrics final count: {bm_count_res.count}")
        
        if bh_count_res.count != 12361 or bm_count_res.count != 12361:
            print("WARNING: Counts do not equal 12361!")
            
    except Exception as e:
        print(f"Failed to query database: {e}")
        sys.exit(1)

    print("\nDownloading full tables to verify exact pairs...")
    all_health = []
    has_more = True
    offset = 0
    limit = 1000
    while has_more:
        res = supabase.table("battery_health").select("vehicle_id, session_id, efc").range(offset, offset+limit-1).execute()
        if len(res.data) > 0:
            all_health.extend(res.data)
            offset += limit
        else:
            has_more = False
            
    all_metrics = []
    has_more = True
    offset = 0
    while has_more:
        res = supabase.table("battery_metrics").select("vehicle_id, session_id, efc").range(offset, offset+limit-1).execute()
        if len(res.data) > 0:
            all_metrics.extend(res.data)
            offset += limit
        else:
            has_more = False

    df_health = pd.DataFrame(all_health)
    df_metrics = pd.DataFrame(all_metrics)

    print(f"Downloaded {len(df_health)} health records and {len(df_metrics)} metrics records.")

    # Validate all (vehicle_id, session_id) pairs match exactly
    health_pairs = set(zip(df_health['vehicle_id'], df_health['session_id']))
    metrics_pairs = set(zip(df_metrics['vehicle_id'], df_metrics['session_id']))

    if health_pairs == metrics_pairs:
        print(f"\n[+] SUCCESS: All {len(health_pairs)} (vehicle_id, session_id) pairs match exactly between both tables.")
    else:
        print("\n[-] ERROR: Pairs do not match!")
        only_in_health = health_pairs - metrics_pairs
        only_in_metrics = metrics_pairs - health_pairs
        if only_in_health: print(f"    Missing in metrics: {len(only_in_health)} pairs")
        if only_in_metrics: print(f"    Missing in health: {len(only_in_metrics)} pairs")

    # Verify identical EFC values
    merged = pd.merge(df_health, df_metrics, on=['vehicle_id', 'session_id'], suffixes=('_health', '_metrics'))
    merged['efc_diff'] = abs(merged['efc_health'] - merged['efc_metrics'])
    
    mismatched_efc = merged[merged['efc_diff'] > 1e-9]
    if len(mismatched_efc) == 0:
        print("[+] SUCCESS: All matched pairs have identically matching EFC values.")
    else:
        print(f"[-] ERROR: Found {len(mismatched_efc)} pairs with mismatched EFC values!")
        print(mismatched_efc.head())

if __name__ == "__main__":
    main()
