import asyncio
from app.supabase_client import supabase

async def test():
    if not supabase:
        print("Supabase client not initialized")
        return
    try:
        res = supabase.table("battery_health").insert({
            "vehicle_id": "V001",
            "soh": 90.0,
            "efc": 10.0,
            "risk_level": "low"
        }).execute()
        print("Insert success:", res.data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
