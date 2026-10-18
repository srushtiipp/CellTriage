import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ai_endpoints():
    print("Testing AI Copilot API structure and authorization...")
    
    # 1. No JWT -> 401
    payload = {"message": "How is my battery?", "run_analysis": False}
    res = client.post("/api/ai/copilot", json=payload)
    assert res.status_code == 401, f"Expected 401 for /api/ai/copilot with no JWT, got {res.status_code}"
    print("1. No JWT -> 401 on /api/ai/copilot: PASSED")
    
    # Check 501 missing configuration
    # Since we can't test valid requests because of no JWTs, we just report it.
    
if __name__ == "__main__":
    test_ai_endpoints()
    print("All structural tests passed.")
    print("Tests requiring real Supabase Admin/User JWTs (for 403/501) skipped as requested.")
