import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    print("Testing API structure and validation...")
    
    # 1. No JWT -> 401
    res_metrics = client.get("/api/vehicles/V001/metrics")
    assert res_metrics.status_code == 401, f"Expected 401, got {res_metrics.status_code}"
    print("1. Metrics No JWT -> 401: PASSED")
    
    res_summary = client.get("/api/vehicles/V001/summary")
    assert res_summary.status_code == 401, f"Expected 401, got {res_summary.status_code}"
    print("1. Summary No JWT -> 401: PASSED")
    
    # Validation logic test (page, page_size) without JWT will return 422 if parameters are invalid
    # before it hits the 401 (Depends execution order). Let's check which one FastAPI returns.
    # Actually, Depends order matters. Let's just check invalid query params.
    res_invalid_page = client.get("/api/vehicles/V001/metrics?page=0")
    assert res_invalid_page.status_code == 422, f"Expected 422 for page=0, got {res_invalid_page.status_code}"
    print("3 & 4. Invalid page (page=0) -> 422: PASSED")
    
    res_invalid_page_size = client.get("/api/vehicles/V001/metrics?page_size=1000")
    assert res_invalid_page_size.status_code == 422, f"Expected 422 for page_size=1000, got {res_invalid_page_size.status_code}"
    print("3 & 4. Invalid page_size (page_size=1000) -> 422: PASSED")
    
    res_invalid_page_size_low = client.get("/api/vehicles/V001/metrics?page_size=0")
    assert res_invalid_page_size_low.status_code == 422, f"Expected 422 for page_size=0, got {res_invalid_page_size_low.status_code}"
    print("3 & 4. Invalid page_size (page_size=0) -> 422: PASSED")

if __name__ == "__main__":
    test_endpoints()
    print("All structural and validation tests passed.")
    print("Tests requiring real Supabase JWTs (for 200/403/404) skipped as requested.")
