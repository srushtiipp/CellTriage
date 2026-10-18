import os
import sys
import getpass
import pandas as pd
import numpy as np
import math
from supabase import create_client, Client

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_data", "fleet_ml_dataset.csv")

vehicle_mapping = {
    'vin3': 'V001', 'vin7': 'V002', 'vin31': 'V003', 'vin36': 'V004', 'vin40': 'V005',
    'vin44': 'V006', 'vin48': 'V007', 'vin52': 'V008', 'vin57': 'V009', 'vin61': 'V010',
    'vin65': 'V011', 'vin69': 'V012', 'vin73': 'V013', 'vin78': 'V014', 'vin82': 'V015',
    'vin86': 'V016', 'vin90': 'V017', 'vin94': 'V018', 'vin99': 'V019', 'vin296': 'V020'
}

def get_risk_level(soh):
    if soh >= 90: return 'low'
    if soh >= 80: return 'medium'
    if soh >= 70: return 'high'
    return 'critical'

def clean_float(val):
    if pd.isna(val) or not math.isfinite(val):
        return 0.0
    return float(val)

def main():
    service_role_key = getpass.getpass("Enter Supabase service_role key (starts with eyJ...): ").strip()
    
    if not service_role_key.startswith("eyJ"):
        print("\nError: The key provided does not look like a valid Supabase service_role key.")
        print("A valid key is a JWT that starts with 'eyJ'.")
        print("Please make sure you copied the 'service_role' (secret) key from Project Settings -> API.")
        sys.exit(1)
        
    supabase_url = "https://yaedtyjcoaubletjpxrt.supabase.co"
    
    try:
        supabase: Client = create_client(supabase_url, service_role_key)
    except Exception as e:
        print(f"\nError initializing Supabase client: {e}")
        sys.exit(1)

    print("Verifying database tables are empty...")
    try:
        bh_count_res = supabase.table("battery_health").select("*", count="exact", head=True).execute()
        bm_count_res = supabase.table("battery_metrics").select("*", count="exact", head=True).execute()
    except Exception as e:
        print(f"\nFailed to connect or authenticate: {e}")
        print("This usually means the service_role key was incorrect. Please verify it and try again.")
        sys.exit(1)

    if bh_count_res.count != 0 or bm_count_res.count != 0:
        print(f"Error: Target tables are not empty (battery_health={bh_count_res.count}, battery_metrics={bm_count_res.count})")
        sys.exit(1)

    print("Reading dataset...")
    df = pd.read_csv(DATASET_PATH)
    if len(df) != 12361:
        print(f"Error: Dataset has {len(df)} rows, expected 12361")
        sys.exit(1)

    print("Validating vehicle mappings...")
    unique_vins = df['vehicle_id'].unique()
    for vin in unique_vins:
        if vin not in vehicle_mapping:
            print(f"Error: Unknown vin {vin}")
            sys.exit(1)

    print("Generating records...")
    df = df.sort_values('start_timestamp')
    
    health_records = []
    metrics_records = []

    for vin, group in df.groupby('vehicle_id', sort=False):
        vehicle_id = vehicle_mapping[vin]
        group = group.sort_values('start_timestamp').reset_index(drop=True)
        
        sohs = group['estimated_SOH'].values
        efcs = group['start_equivalent_full_cycles'].values
        
        for i in range(len(group)):
            row = group.iloc[i]
            
            if i < 9:
                deg_rate = 0.0
            else:
                x = efcs[i-9:i+1]
                y = sohs[i-9:i+1]
                if np.std(x) == 0:
                    deg_rate = 0.0
                else:
                    m, _ = np.polyfit(x, y, 1)
                    deg_rate = float(m)
                    
            deg_rate = clean_float(deg_rate)
            
            health_records.append({
                "vehicle_id": vehicle_id,
                "session_id": int(row['session_id']),
                "soh": float(row['estimated_SOH']),
                "efc": float(row['start_equivalent_full_cycles']),
                "estimated_capacity_ah": None,
                "risk_level": get_risk_level(row['estimated_SOH']),
                "degradation_rate": deg_rate,
                "timestamp": None
            })
            
            metrics_records.append({
                "vehicle_id": vehicle_id,
                "session_id": int(row['session_id']),
                "efc": float(row['start_equivalent_full_cycles']),
                "soc": float(row['end_soc']),
                "pack_voltage": float(row['voltage_mean']),
                "current": float(row['current_mean']),
                "temperature": float(row['temperature_mean']),
                "voltage_spread": float(row['cell_voltage_imbalance_mean']),
                "temperature_spread": float(row['temperature_imbalance_mean']),
                "odometer": float(row['start_totalodometer']),
                "timestamp": None
            })
            
    if len(health_records) != 12361 or len(metrics_records) != 12361:
        print("Error: Generated record counts do not match expected 12361")
        sys.exit(1)

    print(f"Starting ingestion of {len(health_records)} records...")
    batch_size = 1000
    
    num_batches = 0
    for i in range(0, len(health_records), batch_size):
        batch = health_records[i:i+batch_size]
        res = supabase.table("battery_health").insert(batch).execute()
        if not res.data:
            print(f"Failed to insert battery_health batch {i//batch_size + 1}")
            sys.exit(1)
        num_batches += 1
        print(f"Inserted health batch {i//batch_size + 1}")
        
    for i in range(0, len(metrics_records), batch_size):
        batch = metrics_records[i:i+batch_size]
        res = supabase.table("battery_metrics").insert(batch).execute()
        if not res.data:
            print(f"Failed to insert battery_metrics batch {i//batch_size + 1}")
            sys.exit(1)
        num_batches += 1
        print(f"Inserted metrics batch {i//batch_size + 1}")

    print("Verifying final counts...")
    bh_count_res = supabase.table("battery_health").select("*", count="exact", head=True).execute()
    bm_count_res = supabase.table("battery_metrics").select("*", count="exact", head=True).execute()
    print(f"Final battery_health count: {bh_count_res.count}")
    print(f"Final battery_metrics count: {bm_count_res.count}")
    
    print("\n--- POST-INGESTION VALIDATION ---")
    
    # We will fetch all records for deep validation since 12k rows is small enough to fit in memory
    print("Fetching all health records for deep validation...")
    all_health = []
    has_more = True
    offset = 0
    limit = 1000
    while has_more:
        res = supabase.table("battery_health").select("*").range(offset, offset+limit-1).execute()
        if len(res.data) > 0:
            all_health.extend(res.data)
            offset += limit
        else:
            has_more = False

    df_h = pd.DataFrame(all_health)
    
    vins_found = set(df_h['vehicle_id'].dropna().unique())
    expected_vins = set(vehicle_mapping.values())
    
    print(f"Vehicle coverage (expected 20): {len(vins_found)}")
    if vins_found != expected_vins:
        print("WARNING: Vehicle IDs do not match expected V001-V020!")
        
    null_soh = df_h['soh'].isna().sum()
    null_efc = df_h['efc'].isna().sum()
    null_vid = df_h['vehicle_id'].isna().sum()
    print(f"Null vehicle_id: {null_vid}")
    print(f"Null soh: {null_soh}")
    print(f"Null efc: {null_efc}")
    
    capacity_nulls = df_h['estimated_capacity_ah'].isna().sum()
    timestamp_nulls = df_h['timestamp'].isna().sum()
    print(f"estimated_capacity_ah NULL count: {capacity_nulls} (expected 12361)")
    print(f"timestamp NULL count: {timestamp_nulls} (expected 12361)")
    
    invalid_risk = df_h[~df_h['risk_level'].isin(['low', 'medium', 'high', 'critical'])]
    print(f"Invalid risk levels found: {len(invalid_risk)}")
    
    invalid_degradation = df_h[~np.isfinite(df_h['degradation_rate'].fillna(0.0))]
    print(f"Invalid degradation_rate (NaN/inf): {len(invalid_degradation)}")
    
    print("\nRepresentative records:")
    for v in ["V001", "V007", "V014", "V020"]:
        sample = df_h[df_h['vehicle_id'] == v].head(1)
        if not sample.empty:
            print(f"{v}: SOH={sample['soh'].values[0]:.2f}, Risk={sample['risk_level'].values[0]}, DegRate={sample['degradation_rate'].values[0]:.4f}")
        else:
            print(f"{v}: Not found!")

    # Clear credential from memory explicitly
    del service_role_key
    print("\n[+] Cleared service_role_key from memory.")
    print("[+] Please return to the AI assistant and confirm ingestion is complete.")
    
if __name__ == "__main__":
    main()
