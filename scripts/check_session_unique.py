import pandas as pd

df = pd.read_csv('d:/CellTriage Final/ml_data/fleet_ml_dataset.csv')

total_rows = len(df)
unique_sessions = df['session_id'].nunique()

print(f"Total rows: {total_rows}")
print(f"Unique session_ids: {unique_sessions}")

# Check if there are duplicates of session_id across vehicles
is_unique_globally = (total_rows == unique_sessions)

if not is_unique_globally:
    # See if (vehicle_id, session_id) is unique
    unique_combinations = len(df.groupby(['vehicle_id', 'session_id']))
    print(f"Unique (vehicle_id, session_id) combinations: {unique_combinations}")
