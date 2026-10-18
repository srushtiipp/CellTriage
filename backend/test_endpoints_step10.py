import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_fleet_endpoints():
    print("Testing Fleet API structure and authorization...")
    
    # 1. No JWT -> 401
    endpoints = [
        "/api/fleet/summary",
        "/api/fleet/vehicles",
        "/api/fleet/risk-distribution",
        "/api/fleet/soh-overview"
    ]
    
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 for {ep} with no JWT, got {res.status_code}"
        print(f"No JWT -> 401 on {ep}: PASSED")

if __name__ == "__main__":
    test_fleet_endpoints()
    print("All structural tests passed.")
    print("Tests requiring real Supabase Admin/User JWTs (for 200/403) and 20 vehicles skipped as requested.")
