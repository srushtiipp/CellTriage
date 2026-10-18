"""
test_compare_verification.py
Verifies the compare endpoint (/api/fleet/compare) logic, vehicle ID normalization (VOO1 -> V001),
validation limits, and response schema structure using FastAPI TestClient and dependency overrides.
No real Supabase credentials or database modifications required.
"""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials

from app.main import app
from app.auth import CurrentUser, require_admin, bearer_scheme

client = TestClient(app)

def test_compare_endpoint():
    print("--- Testing /api/fleet/compare ---")
    
    # 1. No credentials -> 401 Unauthorized
    resp_no_auth = client.get("/api/fleet/compare?vehicle_ids=V001,V002")
    assert resp_no_auth.status_code == 401, f"Expected 401 without auth, got {resp_no_auth.status_code}"
    print("[PASS] 1. Missing credentials returns 401 Unauthorized")
    
    # Setup mock admin authentication
    fake_admin = CurrentUser(
        user_id="mock-admin-uuid",
        role="admin",
        full_name="Fleet Administrator",
        assigned_vehicle_ids=[],
    )
    fake_cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-token-for-test")
    
    app.dependency_overrides[require_admin] = lambda: fake_admin
    app.dependency_overrides[bearer_scheme] = lambda: fake_cred
    
    try:
        # 2. More than 5 vehicles -> 400 Bad Request
        resp_too_many = client.get("/api/fleet/compare?vehicle_ids=V001,V002,V003,V004,V005,V006")
        assert resp_too_many.status_code == 400, f"Expected 400 for >5 vehicles, got {resp_too_many.status_code}"
        assert "Maximum 5 vehicles" in resp_too_many.json()["detail"]
        print("[PASS] 2. Exceeding 5 vehicles returns 400 Bad Request")
        
        # 3. Empty vehicle IDs -> 400 Bad Request
        resp_empty = client.get("/api/fleet/compare?vehicle_ids= , ")
        assert resp_empty.status_code == 400, f"Expected 400 for empty IDs, got {resp_empty.status_code}"
        print("[PASS] 3. Empty vehicle IDs returns 400 Bad Request")
        
        # 4. Mock PostgREST client to verify data response and normalization (VOO1 -> V001)
        mock_pg = MagicMock()
        
        # Mock table("vehicles").select(...).in_(...).execute()
        def fake_table(name):
            t = MagicMock()
            if name == "vehicles":
                # Returns vehicles found (should match normalized V001 and V008)
                t.select.return_value.in_.return_value.execute.return_value = MagicMock(
                    data=[
                        {"vehicle_id": "V001", "model": "Model-E1"},
                        {"vehicle_id": "V008", "model": "Model-E2"},
                    ]
                )
            elif name == "battery_health":
                # Latest health or health history
                t.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[{"soh": 92.5, "efc": 120.0, "risk_level": "low", "degradation_rate": 0.05}]
                )
                t.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
                    data=[
                        {"session_id": "s1", "soh": 98.0, "efc": 10.0},
                        {"session_id": "s2", "soh": 92.5, "efc": 120.0},
                    ]
                )
            elif name == "battery_metrics":
                # Latest metrics
                t.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[{
                        "soc": 78.4,
                        "temperature": 28.5,
                        "voltage_spread": 0.015,
                        "temperature_spread": 1.2,
                        "odometer": 15420.0,
                    }]
                )
            return t
        
        mock_pg.table.side_effect = fake_table
        
        with patch("app.routers.fleet._authenticated_postgrest", return_value=mock_pg):
            # Test requesting "VOO1,VOO8" (with letters 'O' instead of zeroes '0')
            resp_compare = client.get("/api/fleet/compare?vehicle_ids=VOO1,VOO8")
            assert resp_compare.status_code == 200, f"Expected 200, got {resp_compare.status_code}: {resp_compare.text}"
            
            data = resp_compare.json()
            assert "vehicles" in data, "Response missing 'vehicles' list"
            vehicles = data["vehicles"]
            assert len(vehicles) == 2, f"Expected 2 vehicles, got {len(vehicles)}"
            
            # Verify vehicle IDs were normalized from VOO1 -> V001 and VOO8 -> V008
            ids = [v["vehicle_id"] for v in vehicles]
            assert ids == ["V001", "V008"], f"Expected normalized IDs ['V001', 'V008'], got {ids}"
            print("[PASS] 4. Typo normalization (VOO1 -> V001, VOO8 -> V008) succeeded")
            
            # Verify structure and fields
            v1 = vehicles[0]
            assert v1["vehicle_id"] == "V001"
            assert v1["model"] == "Model-E1"
            assert v1["latest_soh"] == 92.5
            assert v1["latest_efc"] == 120.0
            assert v1["risk_level"] == "low"
            assert v1["latest_soc"] == 78.4
            assert len(v1["health_history"]) == 2
            print("[PASS] 5. Response schema and health_history validated")
            
    finally:
        app.dependency_overrides.clear()

if __name__ == "__main__":
    test_compare_endpoint()
    print("\nAll /api/fleet/compare tests PASSED successfully.")
