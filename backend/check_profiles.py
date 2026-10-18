import asyncio
from app.supabase_client import supabase

def check():
    print('Checking profiles...')
    profiles = supabase.table('profiles').select('*').execute()
    print('Profiles:', profiles.data)
    
    print('Checking assignments...')
    assignments = supabase.table('vehicle_assignments').select('*').execute()
    print('Assignments:', assignments.data)

check()
