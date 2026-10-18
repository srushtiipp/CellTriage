import pandas as pd

df = pd.read_csv('d:/CellTriage Final/ml_data/fleet_ml_dataset.csv')
total = len(df)

# Check efc uniqueness per vehicle
unique_efc_pairs = len(df.groupby(['vehicle_id', 'start_equivalent_full_cycles']))
print(f"Total rows: {total}")
print(f"Unique (vehicle_id, efc): {unique_efc_pairs}")

# Check odometer uniqueness per vehicle
unique_odo_pairs = len(df.groupby(['vehicle_id', 'start_totalodometer']))
print(f"Unique (vehicle_id, odometer): {unique_odo_pairs}")
