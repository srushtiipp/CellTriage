import asyncio
from app.supabase_client import supabase

async def test():
    if not supabase:
        print("Supabase client not initialized")
        return
    try:
        res = supabase.table("battery_health").select("*", count="exact", head=True).execute()
        print("Count:", res.count)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
