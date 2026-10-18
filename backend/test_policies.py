import asyncio
from app.supabase_client import supabase

async def test():
    if not supabase:
        print("Supabase client not initialized")
        return
    try:
        res = supabase.table("pg_policies").select("*").execute()
        print("pg_policies:", res.data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
