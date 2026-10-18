import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.auth import get_current_user
from fastapi.security import HTTPAuthorizationCredentials

client = TestClient(app)

def test_no_jwt():
    response = client.get("/api/vehicles/V001/health")
    print("1. No JWT ->", response.status_code)
    assert response.status_code == 401

if __name__ == "__main__":
    test_no_jwt()
    print("Test 1 structurally validated. Tests 2-7 require real Supabase JWTs since auth requires interacting with Supabase Auth service directly (get_user).")
